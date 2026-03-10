/**
 * VOICEVOX Engine HTTP API クライアント
 * VOICEVOX Engine がローカルで起動していること前提（デフォルト: http://localhost:50021）
 */
import type { TtsProvider } from './TtsProvider'

const DEFAULT_BASE = 'http://localhost:50021'

export class VoicevoxClient implements TtsProvider {
  private speakerId: number
  private base: string

  constructor(speakerId = 1, baseUrl?: string) {
    this.speakerId = speakerId
    this.base = baseUrl ?? DEFAULT_BASE
  }

  /**
   * テキスト → WAV バイナリ（Buffer）
   * audio_query → synthesis の2ステップ
   * @param speedScale 話速倍率（デフォルト 1.0 / 範囲 0.5〜2.0）
   */
  async synthesize(text: string, speedScale = 1.0): Promise<Buffer> {
    // Step1: audio_query
    const queryRes = await fetch(
      `${this.base}/audio_query?text=${encodeURIComponent(text)}&speaker=${this.speakerId}`,
      { method: 'POST' }
    )
    if (!queryRes.ok) {
      throw new Error(`audio_query failed: ${queryRes.status} ${await queryRes.text()}`)
    }
    const query = await queryRes.json()
    query.speedScale = speedScale

    // Step2: synthesis
    const synthRes = await fetch(
      `${this.base}/synthesis?speaker=${this.speakerId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      }
    )
    if (!synthRes.ok) {
      throw new Error(`synthesis failed: ${synthRes.status}`)
    }

    const arrayBuffer = await synthRes.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /** WAV バイナリ → Float32Array (PCM, 24kHz mono) */
  static wavToFloat32(wavBuffer: Buffer): { pcm: Float32Array; sampleRate: number } {
    // WAV ヘッダーを読み取る（最低限）
    const view = new DataView(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength)
    const sampleRate = view.getUint32(24, true)
    const bitsPerSample = view.getUint16(34, true)

    // data チャンクを探す
    let dataOffset = 12
    while (dataOffset < wavBuffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        wavBuffer[dataOffset], wavBuffer[dataOffset + 1],
        wavBuffer[dataOffset + 2], wavBuffer[dataOffset + 3]
      )
      const chunkSize = view.getUint32(dataOffset + 4, true)
      if (chunkId === 'data') {
        dataOffset += 8
        break
      }
      dataOffset += 8 + chunkSize
    }

    const numSamples = (wavBuffer.byteLength - dataOffset) / (bitsPerSample / 8)
    const pcm = new Float32Array(numSamples)

    if (bitsPerSample === 16) {
      for (let i = 0; i < numSamples; i++) {
        const s = view.getInt16(dataOffset + i * 2, true)
        pcm[i] = s / 32768.0
      }
    } else if (bitsPerSample === 32) {
      for (let i = 0; i < numSamples; i++) {
        pcm[i] = view.getFloat32(dataOffset + i * 4, true)
      }
    }

    return { pcm, sampleRate }
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/version`)
      return res.ok
    } catch {
      return false
    }
  }
}
