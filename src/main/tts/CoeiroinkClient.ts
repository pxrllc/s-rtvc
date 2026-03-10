/**
 * CoeiroinkClient — COEIROINK v2 専用 TTS クライアント
 *
 * COEIROINK は VOICEVOX 互換 API ではなく独自の /v1/ API を持つ。
 * /v1/predict に speakerUuid + styleId + text + speedScale を POST するだけで WAV が返る。
 *
 * 設定例 (sentinel-config.json):
 *   { "ttsProvider": "coeiroink", "ttsBaseUrl": "http://localhost:50032/v1", "voicevoxSpeakerId": 0 }
 *   voicevoxSpeakerId = styleId (れいせい=0 など)
 */

import type { TtsProvider } from './TtsProvider'

interface CoeiroinkSpeaker {
  speakerUuid: string
  speakerName: string
  styles: { styleId: number; styleName: string }[]
}

export class CoeiroinkClient implements TtsProvider {
  private base: string
  private styleId: number
  private speakerUuid: string | null = null

  constructor(baseUrl = 'http://localhost:50032/v1', styleId = 0) {
    this.base = baseUrl.replace(/\/$/, '')
    this.styleId = styleId
  }

  /** 初回 synthesize 時に speakerUuid をキャッシュ */
  private async resolveSpeakerUuid(): Promise<string> {
    if (this.speakerUuid) return this.speakerUuid

    const res = await fetch(`${this.base}/speakers`)
    if (!res.ok) throw new Error(`COEIROINK /speakers failed: ${res.status}`)

    const speakers: CoeiroinkSpeaker[] = await res.json()

    // styleId が一致する話者を探す
    for (const speaker of speakers) {
      const style = speaker.styles.find(s => s.styleId === this.styleId)
      if (style) {
        this.speakerUuid = speaker.speakerUuid
        return this.speakerUuid
      }
    }

    // 一致しない場合は先頭話者の先頭スタイル
    if (speakers.length > 0 && speakers[0].styles.length > 0) {
      this.speakerUuid = speakers[0].speakerUuid
      this.styleId = speakers[0].styles[0].styleId
      return this.speakerUuid
    }

    throw new Error('[COEIROINK] 利用可能なスピーカーが見つかりません')
  }

  async synthesize(text: string, speedScale = 1.0): Promise<Buffer> {
    const speakerUuid = await this.resolveSpeakerUuid()

    const res = await fetch(`${this.base}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speakerUuid, styleId: this.styleId, text, speedScale }),
    })

    if (!res.ok) {
      throw new Error(`COEIROINK /predict failed: ${res.status} ${await res.text()}`)
    }

    return Buffer.from(await res.arrayBuffer())
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/speakers`)
      return res.ok
    } catch {
      return false
    }
  }
}
