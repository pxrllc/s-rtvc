/**
 * OpenAICompatibleClient
 * OpenAI互換APIを持つプロバイダー（Groq / OpenAI）に対応。
 */

import { SYSTEM_PROMPT, ConversationHistory } from './LLMProvider'
import type { LLMProvider } from './LLMProvider'

type Config = {
  baseUrl: string
  apiKey: string
  model: string
  providerName: string
  maxTokens?: number
  temperature?: number
}

export class OpenAICompatibleClient implements LLMProvider {
  readonly providerName: string
  readonly modelName: string
  private config: Config
  private history = new ConversationHistory()

  constructor(config: Config) {
    this.config = config
    this.providerName = config.providerName
    this.modelName = config.model
  }

  async generate(userText: string, memoryContext?: string): Promise<string> {
    this.history.push('user', userText)

    const systemContent = memoryContext
      ? `${SYSTEM_PROMPT}\n\n${memoryContext}`
      : SYSTEM_PROMPT

    const messages = [
      { role: 'system', content: systemContent },
      ...this.history.getRecent()
    ]

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens ?? 120,
        temperature: this.config.temperature ?? 0.75,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`${this.providerName} API failed: ${res.status} ${err}`)
    }

    const json = await res.json() as { choices: [{ message: { content: string } }] }
    const reply = json.choices[0].message.content.trim()

    this.history.push('assistant', reply)
    return reply
  }

  clearHistory(): void {
    this.history.clear()
  }
}
