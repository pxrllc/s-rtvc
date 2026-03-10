/**
 * Groq Whisper STT クライアント
 * モデル: whisper-large-v3-turbo（Groq最速）
 * 音声フォーマット: audio/webm (MediaRecorder出力そのまま)
 */
export class GroqSTTClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    const formData = new FormData()
    formData.append(
      'file',
      new Blob([audioBuffer], { type: 'audio/webm' }),
      'audio.webm'
    )
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('language', 'ja')
    formData.append('response_format', 'json')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Groq STT failed: ${res.status} ${errText}`)
    }

    const json = await res.json() as { text: string }
    return json.text.trim()
  }
}
