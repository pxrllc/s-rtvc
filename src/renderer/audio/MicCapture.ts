/**
 * マイク入力 + エネルギーベース VAD
 *
 * 動作:
 *   1. getUserMedia でマイク取得
 *   2. AnalyserNode で RMS を 100ms ごとにポーリング
 *   3. RMS > SPEECH_THRESHOLD → 発話中
 *   4. 発話中に RMS < SPEECH_THRESHOLD が SILENCE_MS 続く → 発話終了
 *   5. その時点までの録音 Blob を onUtterance コールバックに渡す
 */

const SPEECH_THRESHOLD = 0.015  // マイク感度（環境に応じて調整）
const SILENCE_MS = 700          // 無音判定ミリ秒
const MIN_SPEECH_MS = 300       // これ未満は雑音として無視

export type MicState = 'idle' | 'listening' | 'speaking'

export class MicCapture {
  private stream: MediaStream | null = null
  private audioCtx: AudioContext | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private rafId: number | null = null
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private speechStartTime = 0
  private isSpeaking = false

  onStateChange: (state: MicState) => void = () => {}
  onUtterance: (blob: Blob) => void = () => {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
    })

    this.audioCtx = new AudioContext({ sampleRate: 16000 })
    const source = this.audioCtx.createMediaStreamSource(this.stream)
    const analyser = this.audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    this.recorder = new MediaRecorder(this.stream, { mimeType })
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: mimeType })
      this.chunks = []
      const durationMs = Date.now() - this.speechStartTime
      if (durationMs >= MIN_SPEECH_MS) {
        this.onUtterance(blob)
      }
      // 連続録音のため即リスタート
      this.recorder?.start()
    }

    this.recorder.start()
    this.onStateChange('listening')

    const buffer = new Float32Array(analyser.fftSize)

    const poll = () => {
      analyser.getFloatTimeDomainData(buffer)
      const rms = Math.sqrt(buffer.reduce((s, v) => s + v * v, 0) / buffer.length)

      if (rms > SPEECH_THRESHOLD) {
        // 発話検出
        if (!this.isSpeaking) {
          this.isSpeaking = true
          this.speechStartTime = Date.now()
          this.onStateChange('speaking')
        }
        // 無音タイマーをリセット
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer)
          this.silenceTimer = null
        }
      } else if (this.isSpeaking) {
        // 発話後の無音
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.isSpeaking = false
            this.silenceTimer = null
            this.onStateChange('listening')
            // recorder を止めて発話区間を確定（onstop でリスタート）
            this.recorder?.stop()
          }, SILENCE_MS)
        }
      }

      this.rafId = requestAnimationFrame(poll)
    }

    this.rafId = requestAnimationFrame(poll)
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.recorder?.stop()
    this.stream?.getTracks().forEach(t => t.stop())
    this.audioCtx?.close()
    this.isSpeaking = false
    this.chunks = []
    this.onStateChange('idle')
  }
}
