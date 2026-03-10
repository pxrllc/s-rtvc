/**
 * ClaudeLLMClient
 * Anthropic Messages API に対応。
 * モデル: claude-haiku-4-5（デフォルト）
 */

import { SYSTEM_PROMPT, ConversationHistory } from './LLMProvider'
import type { LLMProvider } from './LLMProvider'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export class ClaudeLLMClient implements LLMProvider {
  readonly providerName = 'claude'
  readonly modelName: string
  private apiKey: string
  private history = new ConversationHistory()

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    this.apiKey = apiKey
    this.modelName = model
  }

  async generate(userText: string, memoryContext?: string): Promise<string> {
    this.history.push('user', userText)

    const systemContent = memoryContext
      ? `${SYSTEM_PROMPT}\n\n${memoryContext}`
      : SYSTEM_PROMPT

    const messages = this.history.getRecent().map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    }))

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelName,
        system: systemContent,
        messages,
        max_tokens: 120,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Claude API failed: ${res.status} ${err}`)
    }

    const json = await res.json() as {
      content: [{ type: string; text: string }]
    }
    const reply = json.content.find(c => c.type === 'text')?.text.trim() ?? ''

    this.history.push('assistant', reply)
    return reply
  }

  clearHistory(): void {
    this.history.clear()
  }
}
