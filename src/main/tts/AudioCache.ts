import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { VoicevoxClient } from './VoicevoxClient'

export type CacheManifestEntry = {
  text: string
  file: string      // WAVファイル名 (例: 0001.wav)
  sampleRate: number
}

export type CacheManifest = {
  version: number
  speakerId: number
  generatedAt: string
  entries: CacheManifestEntry[]
}

export class AudioCache {
  private pcmCache = new Map<string, Float32Array>()
  private sampleRateMap = new Map<string, number>()

  /**
   * cache/audio/manifest.json を読み込み、全WAVをメモリ展開する
   * @returns ロードできたエントリ数とメモリ使用量
   */
  async load(cacheDir: string): Promise<{ count: number; totalMB: number }> {
    const manifestPath = join(cacheDir, 'manifest.json')
    if (!existsSync(manifestPath)) {
      return { count: 0, totalMB: 0 }
    }

    const manifest: CacheManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    let totalBytes = 0

    for (const entry of manifest.entries) {
      const wavPath = join(cacheDir, entry.file)
      if (!existsSync(wavPath)) continue

      const wavBuffer = readFileSync(wavPath)
      const { pcm, sampleRate } = VoicevoxClient.wavToFloat32(wavBuffer)

      this.pcmCache.set(entry.text, pcm)
      this.sampleRateMap.set(entry.text, sampleRate)
      totalBytes += pcm.byteLength
    }

    return {
      count: this.pcmCache.size,
      totalMB: Math.round((totalBytes / 1024 / 1024) * 10) / 10
    }
  }

  /** テキストに対応するPCMデータを返す（キャッシュミスはnull） */
  get(text: string): { pcm: Float32Array; sampleRate: number } | null {
    const pcm = this.pcmCache.get(text)
    if (!pcm) return null
    return { pcm, sampleRate: this.sampleRateMap.get(text) ?? 24000 }
  }

  has(text: string): boolean {
    return this.pcmCache.has(text)
  }

  get size(): number {
    return this.pcmCache.size
  }
}
