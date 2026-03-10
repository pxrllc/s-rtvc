import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { AhoCorasickEngine, INTENT_PATTERNS } from '../../shared/intent-patterns'
import { ResponseBank } from '../bank/ResponseBank'
import { VoicevoxClient } from '../tts/VoicevoxClient'
import { GroqLLMClient } from '../llm/GroqLLMClient'
import { ConversationLogger } from '../logger/ConversationLogger'

export class ConversationOrchestrator {
  private engine = new AhoCorasickEngine(INTENT_PATTERNS)
  private bank = new ResponseBank()
  private voicevox = new VoicevoxClient(1)
  private llm: GroqLLMClient | null = null
  private logger: ConversationLogger
  private win: BrowserWindow

  constructor(win: BrowserWindow, groqApiKey?: string) {
    this.win = win
    this.logger = new ConversationLogger(app.getPath('userData'))

    if (groqApiKey) {
      this.llm = new GroqLLMClient(groqApiKey)
    }
  }

  async onText(text: string): Promise<void> {
    const t0 = performance.now()

    // ===== Step 1: 意図分類 (<5ms) =====
    const result = this.engine.classify(text)
    const classifyMs = performance.now() - t0

    const onsetEntry = this.bank.getOnset(result.intent)
    const bodyEntry = this.bank.getBody(result.intent)

    this.log('info', `[Intent] ${result.intent} conf=${result.confidence.toFixed(2)} (${classifyMs.toFixed(1)}ms)`)
    this.win.webContents.send('intent:result', result, classifyMs)

    // ログ: ユーザー入力 + アルゴリズム判定
    this.logger.logUserInput(text)
    this.logger.logAlgorithmDecision(result, onsetEntry.text, bodyEntry?.text ?? null, classifyMs)

    // ===== Step 2: LLM を即座に起動（onset合成と並走） =====
    const llmStartTime = performance.now()
    const llmPromise = this.llm
      ? this.llm.generate(text).catch(err => {
          this.log('error', `[LLM Error] ${err.message}`)
          return null
        })
      : Promise.resolve(null)

    // ===== Step 3: Onset 合成 → Renderer へ送信 =====
    this.log('info', `[Onset] "${onsetEntry.text}"`)
    const onsetWav = await this.voicevox.synthesize(onsetEntry.text)
    const { pcm: onsetPcm, sampleRate } = VoicevoxClient.wavToFloat32(onsetWav)

    // onset を renderer に送る（enqueue）
    this.win.webContents.send('tts:pcm', onsetPcm, sampleRate, 'onset')

    // ===== Step 4: Body テンプレート合成 → id 付きでキューに積む =====
    const bodyId = `body-${t0}`
    let bodySent = false

    if (bodyEntry) {
      this.log('info', `[Body Template] "${bodyEntry.text}"`)
      const bodyWav = await this.voicevox.synthesize(bodyEntry.text)
      const { pcm: bodyPcm } = VoicevoxClient.wavToFloat32(bodyWav)
      this.win.webContents.send('tts:pcm', bodyPcm, sampleRate, bodyId)
      bodySent = true
    }

    // ===== Step 5: LLM 結果を待つ → body が pending なら差し替え =====
    const llmText = await llmPromise
    const llmMs = performance.now() - llmStartTime

    if (llmText) {
      this.log('info', `[LLM] "${llmText}" (${llmMs.toFixed(0)}ms)`)

      // Renderer 側でキャンセルを試みる → 結果を受け取って判断
      // IPC経由で cancel を依頼し、結果を非同期で受け取るより
      // 「bodyId を送っておいて renderer 側で cancelIfPending を呼ぶ」
      const llmWav = await this.voicevox.synthesize(llmText)
      const { pcm: llmPcm } = VoicevoxClient.wavToFloat32(llmWav)

      // body をキャンセルしてから LLM を送信
      // cancelIfPending の結果（差し替えたか否か）を renderer から受け取る
      this.win.webContents.send('tts:cancel_and_enqueue', bodyId, llmPcm, sampleRate)

      // ログ: LLM 結果（キャンセル成否は renderer からの応答で補完）
      this.logger.logLLMResponse(llmText, llmMs, bodySent ? 'llm' : 'llm')
    } else if (!bodySent) {
      this.log('warn', '[LLM] 応答なし・body テンプレートもなし')
    }

    const totalMs = performance.now() - t0
    this.log('info', `[Total] ${totalMs.toFixed(0)}ms | logDir: ${this.logger.getLogDir()}`)
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    console.log(`[Sentinel] ${message}`)
    this.win.webContents.send('log', level, message)
  }

  async checkVoicevox(): Promise<boolean> {
    return this.voicevox.ping()
  }

  get hasLLM(): boolean {
    return this.llm !== null
  }
}
