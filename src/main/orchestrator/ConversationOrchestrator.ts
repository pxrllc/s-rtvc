import { AhoCorasickEngine, INTENT_PATTERNS } from '../../shared/intent-patterns'
import type { IntentClassification } from '../../shared/intent-patterns'
import { ResponseBank } from '../bank/ResponseBank'
import { VoicevoxClient } from '../tts/VoicevoxClient'
import type { BrowserWindow } from 'electron'

export class ConversationOrchestrator {
  private engine = new AhoCorasickEngine(INTENT_PATTERNS)
  private bank = new ResponseBank()
  private voicevox = new VoicevoxClient(1) // speaker 1: ずんだもん
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
  }

  async onText(text: string): Promise<void> {
    const t0 = performance.now()

    // ===== Step 1: 意図分類 (<5ms) =====
    const result: IntentClassification = this.engine.classify(text)
    const classifyMs = performance.now() - t0

    this.sendLog('info', `[Intent] ${result.intent} (confidence=${result.confidence.toFixed(2)}, ${classifyMs.toFixed(1)}ms)`)
    this.win.webContents.send('intent:result', result, classifyMs)

    // ===== Step 2: Onset 選択 & 合成 → 即時送信 =====
    const onsetEntry = this.bank.getOnset(result.intent)
    this.sendLog('info', `[Onset] "${onsetEntry.text}"`)

    const onsetT0 = performance.now()
    const onsetWav = await this.voicevox.synthesize(onsetEntry.text)
    const { pcm: onsetPcm, sampleRate } = VoicevoxClient.wavToFloat32(onsetWav)
    const onsetSynthMs = performance.now() - onsetT0

    this.sendLog('info', `[TTS Onset] 合成完了 ${onsetSynthMs.toFixed(0)}ms`)

    // Renderer に PCM を送って再生
    this.win.webContents.send('tts:pcm', onsetPcm, sampleRate)

    // ===== Step 3: Body 合成（onset の再生と並行） =====
    const bodyEntry = this.bank.getBody(result.intent)
    if (bodyEntry) {
      this.sendLog('info', `[Body] "${bodyEntry.text}"`)
      const bodyT0 = performance.now()
      const bodyWav = await this.voicevox.synthesize(bodyEntry.text)
      const { pcm: bodyPcm } = VoicevoxClient.wavToFloat32(bodyWav)
      const bodySynthMs = performance.now() - bodyT0

      this.sendLog('info', `[TTS Body] 合成完了 ${bodySynthMs.toFixed(0)}ms`)
      this.win.webContents.send('tts:pcm', bodyPcm, sampleRate)
    }

    const totalMs = performance.now() - t0
    this.sendLog('info', `[Total] ${totalMs.toFixed(0)}ms`)
  }

  private sendLog(level: 'info' | 'warn' | 'error', message: string): void {
    console.log(`[Sentinel] ${message}`)
    this.win.webContents.send('log', level, message)
  }

  async checkVoicevox(): Promise<boolean> {
    return this.voicevox.ping()
  }
}
