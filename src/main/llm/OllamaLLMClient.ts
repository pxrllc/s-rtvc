/**
 * OllamaLLMClient
 * Ollama ローカルLLM (OpenAI互換API) に対応。
 * デフォルト: http://localhost:11434
 */

import { OpenAICompatibleClient } from './OpenAICompatibleClient'
import type { LLMProvider } from './LLMProvider'

export class OllamaLLMClient implements LLMProvider {
  private client: OpenAICompatibleClient

  constructor(model = 'llama3.2', baseUrl = 'http://localhost:11434') {
    this.client = new OpenAICompatibleClient({
      baseUrl: `${baseUrl}/v1`,
      apiKey: 'ollama',  // Ollamaは認証不要だが形式上必要
      model,
      providerName: 'ollama',
    })
  }

  get providerName(): string { return this.client.providerName }
  get modelName(): string { return this.client.modelName }

  generate(userText: string, memoryContext?: string): Promise<string> {
    return this.client.generate(userText, memoryContext)
  }

  clearHistory(): void {
    this.client.clearHistory()
  }
}
