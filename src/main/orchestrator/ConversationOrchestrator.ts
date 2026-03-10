import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'path'
import { AhoCorasickEngine, INTENT_PATTERNS } from '../../shared/intent-patterns'
import { ResponseBank } from '../bank/ResponseBank'
import { VoicevoxClient } from '../tts/VoicevoxClient'
import { AudioCache } from '../tts/AudioCache'
import type { TtsProvider } from '../tts/TtsProvider'
import type { LLMProvider } from '../llm/LLMProvider'
import { ConversationLogger } from '../logger/ConversationLogger'
import { SyntaxRuleEngine } from '../intent/SyntaxRuleEngine'
import { HookExtractor } from '../intent/HookExtractor'
import { ShortTermMemory } from '../memory/ShortTermMemory'
import { EpisodicMemoryStore } from '../memory/EpisodicMemoryStore'
import { LongTermMemoryStore } from '../memory/LongTermMemoryStore'

/** 話速設定（VOICEVOX speedScale: 0.5〜2.0、デフォルト 1.0） */
const SPEED_ONSET = 1.2   // 相槌：やや速め
const SPEED_LLM   = 1.1   // LLM本文：少し速め

export class ConversationOrchestrator {
  private engine = new AhoCorasickEngine(INTENT_PATTERNS)
  private syntax = new SyntaxRuleEngine()
  private bank = new ResponseBank()
  private tts: TtsProvider
  private audioCache = new AudioCache()
  private llm: LLMProvider | null = null
  private logger: ConversationLogger
  private win: BrowserWindow
  private cacheReady = false
  private hookExtractor = new HookExtractor()
  private memory = new ShortTermMemory()
  private episodic!: EpisodicMemoryStore
  private longTerm!: LongTermMemoryStore

  constructor(
    win: BrowserWindow,
    llmProvider: LLMProvider | null = null,
    ttsProvider?: TtsProvider
  ) {
    this.win = win
    const userDataPath = app.getPath('userData')
    this.logger = new ConversationLogger(userDataPath)
    this.episodic = new EpisodicMemoryStore(userDataPath)
    this.longTerm = new LongTermMemoryStore(userDataPath)
    this.llm = llmProvider
    this.tts = ttsProvider ?? new VoicevoxClient(1)
  }

  /** 起動時にWAVキャッシュをメモリ展開 */
  async loadCache(): Promise<void> {
    const cacheDir = app.isPackaged
      ? join(process.resourcesPath, 'cache', 'audio')
      : join(__dirname, '../../cache/audio')

    const { count, totalMB } = await this.audioCache.load(cacheDir)

    if (count > 0) {
      this.cacheReady = true
      this.log('info', `[AudioCache] ${count}件 / ${totalMB}MB をメモリ展開 ✓`)
    } else {
      this.log('warn', '[AudioCache] キャッシュなし — npm run cache:build で生成してください')
    }
  }

  async onText(text: string): Promise<void> {
    const t0 = performance.now()

    // ── Step 1: 意図分類（Aho-Corasick + 構文ルール） ────────────
    const rawResult = this.engine.classify(text)
    const result = this.syntax.apply(text, rawResult)
    const classifyMs = performance.now() - t0

    const emotionTrend = this.memory.getEmotionTrend()
    const onsetEntry = this.bank.getOnset(result.intent, result.confidence, emotionTrend)

    this.log('info', `[Intent] ${result.intent} conf=${result.confidence.toFixed(2)} (${classifyMs.toFixed(1)}ms)`)
    this.win.webContents.send('intent:result', result, classifyMs)

    this.logger.logUserInput(text)
    this.logger.logAlgorithmDecision(result, onsetEntry.text, classifyMs)

    // ── フック抽出 + メモリ記録 ───────────────────────────────────
    const hooks = this.hookExtractor.extract(text)
    this.memory.addTurn({
      userText: text,
      intent: result.intent,
      confidence: result.confidence,
      hooks,
      llmResponse: null,
      timestamp: Date.now()
    })

    // ── Step 2: LLM 即座に起動（並走） ───────────────────────────
    const llmStartTime = performance.now()
    const currentHooks = this.memory.getAllHooks()
    const episodicCtx = this.episodic.buildContextString(currentHooks)
    const longTermCtx = this.longTerm.buildContextString()
    const memoryContext = this.memory.buildContext(episodicCtx, longTermCtx)
    const llmPromise = this.llm
      ? this.llm.generate(text, memoryContext || undefined).catch(err => {
          this.log('error', `[LLM Error] ${err.message}`)
          return null
        })
      : Promise.resolve(null)

    // ── Step 3: Onset 送信（キャッシュ優先） ──────────────────────
    const onsetT0 = performance.now()
    const cached = this.audioCache.get(onsetEntry.text)

    if (cached) {
      this.win.webContents.send('tts:pcm', cached.pcm, cached.sampleRate, 'onset')
      this.log('info', `[Onset] "${onsetEntry.text}" [CACHE ${(performance.now() - onsetT0).toFixed(1)}ms]`)
    } else {
      const wav = await this.tts.synthesize(onsetEntry.text, SPEED_ONSET)
      const { pcm, sampleRate } = VoicevoxClient.wavToFloat32(wav)
      this.win.webContents.send('tts:pcm', pcm, sampleRate, 'onset')
      this.log('info', `[Onset] "${onsetEntry.text}" [SYNTH ${(performance.now() - onsetT0).toFixed(0)}ms]`)
    }

    // ── Step 4: LLM 結果待ち → 直接エンキュー ────────────────────
    const llmText = await llmPromise
    const llmMs = performance.now() - llmStartTime

    if (llmText) {
      this.memory.updateLastLLMResponse(llmText)
      this.log('info', `[LLM] "${llmText}" (${llmMs.toFixed(0)}ms)`)
      const llmWav = await this.tts.synthesize(llmText, SPEED_LLM)
      const { pcm, sampleRate } = VoicevoxClient.wavToFloat32(llmWav)
      this.win.webContents.send('tts:pcm', pcm, sampleRate, 'llm')
      this.logger.logLLMResponse(llmText, llmMs)
    }

    this.log('info', `[Total] ${(performance.now() - t0).toFixed(0)}ms`)
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    console.log(`[Sentinel] ${message}`)
    this.win.webContents.send('log', level, message)
  }

  /** セッション終了時に呼ぶ — エピソード保存・長期記憶更新 */
  endSession(): void {
    const episodeData = this.memory.buildEpisode()
    if (episodeData) {
      this.episodic.saveEpisode({
        id: `ep_${Date.now()}`,
        timestamp: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        ...episodeData,
      })
      this.log('info', `[Memory] エピソード保存 (${episodeData.turnCount}ターン / topics: ${episodeData.topics.join('、')})`)
    }

    const allHooks = this.memory.getAllHooks()
    if (allHooks.length > 0) {
      this.longTerm.updateFromSession(allHooks)
      this.log('info', `[Memory] 長期記憶更新 (セッション${this.longTerm.sessionCount}回目)`)
    }
  }

  async checkVoicevox(): Promise<boolean> {
    return this.tts.ping()
  }
}
