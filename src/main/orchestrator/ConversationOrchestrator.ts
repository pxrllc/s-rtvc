import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'path'
import { AhoCorasickEngine, INTENT_PATTERNS } from '../../shared/intent-patterns'
import { ResponseBank } from '../bank/ResponseBank'
import { VoicevoxClient } from '../tts/VoicevoxClient'
import { AudioCache } from '../tts/AudioCache'
import { GroqLLMClient } from '../llm/GroqLLMClient'
import { ConversationLogger } from '../logger/ConversationLogger'

export class ConversationOrchestrator {
  private engine = new AhoCorasickEngine(INTENT_PATTERNS)
  private bank = new ResponseBank()
  private voicevox = new VoicevoxClient(1)
  private audioCache = new AudioCache()
  private llm: GroqLLMClient | null = null
  private logger: ConversationLogger
  private win: BrowserWindow
  private cacheReady = false

  constructor(win: BrowserWindow, groqApiKey?: string) {
    this.win = win
    this.logger = new ConversationLogger(app.getPath('userData'))
    if (groqApiKey) this.llm = new GroqLLMClient(groqApiKey)
  }

  /** 起動時にWAVキャッシュをメモリ展開 */
  async loadCache(): Promise<void> {
    const cacheDir = app.isPackaged
      ? join(process.resourcesPath, 'cache', 'audio')
      : join(__dirname, '../../../cache/audio')

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

    // ── Step 1: 意図分類 ──────────────────────────────────────────
    const result = this.engine.classify(text)
    const classifyMs = performance.now() - t0

    const onsetEntry = this.bank.getOnset(result.intent)
    const bodyEntry = this.bank.getBody(result.intent)

    this.log('info', `[Intent] ${result.intent} conf=${result.confidence.toFixed(2)} (${classifyMs.toFixed(1)}ms)`)
    this.win.webContents.send('intent:result', result, classifyMs)

    this.logger.logUserInput(text)
    this.logger.logAlgorithmDecision(result, onsetEntry.text, bodyEntry?.text ?? null, classifyMs)

    // ── Step 2: LLM 即座に起動（並走） ───────────────────────────
    const llmStartTime = performance.now()
    const llmPromise = this.llm
      ? this.llm.generate(text).catch(err => {
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
      const wav = await this.voicevox.synthesize(onsetEntry.text)
      const { pcm, sampleRate } = VoicevoxClient.wavToFloat32(wav)
      this.win.webContents.send('tts:pcm', pcm, sampleRate, 'onset')
      this.log('info', `[Onset] "${onsetEntry.text}" [SYNTH ${(performance.now() - onsetT0).toFixed(0)}ms]`)
    }

    // ── Step 4: Body テンプレート合成 → id 付きでキュー ──────────
    const bodyId = `body-${t0}`

    if (bodyEntry) {
      const bodyCached = this.audioCache.get(bodyEntry.text)
      if (bodyCached) {
        this.win.webContents.send('tts:pcm', bodyCached.pcm, bodyCached.sampleRate, bodyId)
        this.log('info', `[Body Template] "${bodyEntry.text}" [CACHE]`)
      } else {
        const wav = await this.voicevox.synthesize(bodyEntry.text)
        const { pcm, sampleRate } = VoicevoxClient.wavToFloat32(wav)
        this.win.webContents.send('tts:pcm', pcm, sampleRate, bodyId)
        this.log('info', `[Body Template] "${bodyEntry.text}" [SYNTH]`)
      }
    }

    // ── Step 5: LLM 結果待ち → body をキャンセルして差し替え ──────
    const llmText = await llmPromise
    const llmMs = performance.now() - llmStartTime

    if (llmText) {
      this.log('info', `[LLM] "${llmText}" (${llmMs.toFixed(0)}ms)`)
      const llmWav = await this.voicevox.synthesize(llmText)
      const { pcm, sampleRate } = VoicevoxClient.wavToFloat32(llmWav)
      this.win.webContents.send('tts:cancel_and_enqueue', bodyId, pcm, sampleRate)
      this.logger.logLLMResponse(llmText, llmMs, 'llm')
    }

    this.log('info', `[Total] ${(performance.now() - t0).toFixed(0)}ms`)
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    console.log(`[Sentinel] ${message}`)
    this.win.webContents.send('log', level, message)
  }

  async checkVoicevox(): Promise<boolean> {
    return this.voicevox.ping()
  }
}
