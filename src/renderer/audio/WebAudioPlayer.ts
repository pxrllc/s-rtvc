/**
 * Web Audio API PCM 順次再生
 * - 各エントリは id 付きでキューに入る
 * - cancelIfPending(id): まだ再生開始していなければキューから取り除く
 */

type QueueItem = {
  id: string
  pcm: Float32Array
  sampleRate: number
  started: boolean
}

export class WebAudioPlayer {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private queue: QueueItem[] = []
  private isPlaying = false
  private currentSource: AudioBufferSourceNode | null = null
  private idCounter = 0

  private ensureContext(sampleRate: number): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext({ sampleRate })
      this.gainNode = this.ctx.createGain()
      this.gainNode.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** PCM をキューに追加して再生（自動開始）。id を返す */
  enqueue(pcm: Float32Array, sampleRate: number, id?: string): string {
    const itemId = id ?? `pcm-${++this.idCounter}`
    this.queue.push({ id: itemId, pcm, sampleRate, started: false })
    if (!this.isPlaying) {
      this.playNext()
    }
    return itemId
  }

  /**
   * 指定 id のアイテムが「まだ再生開始していない」場合、キューから取り除く
   * @returns キャンセルできた(pending だった)なら true
   */
  cancelIfPending(id: string): boolean {
    const idx = this.queue.findIndex(item => item.id === id && !item.started)
    if (idx === -1) return false
    this.queue.splice(idx, 1)
    return true
  }

  /** 再生中 + キュー全クリア */
  stop(): void {
    if (this.currentSource) {
      try { this.currentSource.stop() } catch { /* ignore */ }
      this.currentSource = null
    }
    this.queue = []
    this.isPlaying = false
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false
      return
    }

    const item = this.queue[0]
    item.started = true
    this.isPlaying = true

    const ctx = this.ensureContext(item.sampleRate)
    const buffer = ctx.createBuffer(1, item.pcm.length, item.sampleRate)
    buffer.getChannelData(0).set(item.pcm)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.gainNode!)
    this.currentSource = source

    source.onended = () => {
      this.queue.shift()
      this.currentSource = null
      this.playNext()
    }

    source.start(0)
  }
}
