/**
 * Web Audio API を使った PCM 順次再生
 * onPcm() で届く Float32Array を到着順にシームレス接続して再生する
 */
export class WebAudioPlayer {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private queue: { pcm: Float32Array; sampleRate: number }[] = []
  private isPlaying = false
  private currentSource: AudioBufferSourceNode | null = null

  private ensureContext(sampleRate: number): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext({ sampleRate })
      this.gainNode = this.ctx.createGain()
      this.gainNode.connect(this.ctx.destination)
    }
    return this.ctx
  }

  async enqueue(pcm: Float32Array, sampleRate: number): Promise<void> {
    this.queue.push({ pcm, sampleRate })
    if (!this.isPlaying) {
      await this.playNext()
    }
  }

  stop(): void {
    if (this.currentSource) {
      try { this.currentSource.stop() } catch { /* ignore */ }
      this.currentSource = null
    }
    this.queue = []
    this.isPlaying = false
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const { pcm, sampleRate } = this.queue.shift()!
    const ctx = this.ensureContext(sampleRate)

    const buffer = ctx.createBuffer(1, pcm.length, sampleRate)
    buffer.getChannelData(0).set(pcm)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.gainNode!)
    this.currentSource = source

    await new Promise<void>(resolve => {
      source.onended = () => {
        this.currentSource = null
        resolve()
      }
      source.start(0)
    })

    await this.playNext()
  }
}
