/**
 * GeminiLLMClient
 * Google Gemini API (v1beta) に対応。
 * モデル: gemini-2.0-flash（デフォルト）
 */

import { SYSTEM_PROMPT, ConversationHistory } from './LLMProvider'
import type { LLMProvider } from './LLMProvider'

const DEFAULT_MODEL = 'gemini-2.0-flash'

type GeminiContent = {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

export class GeminiLLMClient implements LLMProvider {
  readonly providerName = 'gemini'
  readonly modelName: string
  private apiKey: string
  private history = new ConversationHistory()

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    this.apiKey = apiKey
    this.modelName = model
  }

  async generate(userText: string, memoryContext?: string): Promise<string> {
    this.history.push('user', userText)

    const systemInstruction = memoryContext
      ? `${SYSTEM_PROMPT}\n\n${memoryContext}`
      : SYSTEM_PROMPT

    // ConversationHistory の形式を Gemini 形式に変換
    const recentMessages = this.history.getRecent()
    const contents: GeminiContent[] = recentMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          maxOutputTokens: 120,
          temperature: 0.75,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API failed: ${res.status} ${err}`)
    }

    const json = await res.json() as {
      candidates: [{ content: { parts: [{ text: string }] } }]
    }
    const reply = json.candidates[0].content.parts[0].text.trim()

    this.history.push('assistant', reply)
    return reply
  }

  clearHistory(): void {
    this.history.clear()
  }
}
