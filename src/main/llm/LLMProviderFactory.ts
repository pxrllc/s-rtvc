/**
 * LLMProviderFactory
 * 環境変数の設定に基づいてLLMProviderインスタンスを返す。
 *
 * 設定例 (.env):
 *   MAIN_VITE_LLM_PROVIDER=groq
 *   MAIN_VITE_GROQ_API_KEY=gsk_...
 *   MAIN_VITE_OPENAI_API_KEY=sk-...
 *   MAIN_VITE_GEMINI_API_KEY=AIza...
 *   MAIN_VITE_CLAUDE_API_KEY=sk-ant-...
 *   MAIN_VITE_OLLAMA_MODEL=llama3.2
 *   MAIN_VITE_OLLAMA_BASE_URL=http://localhost:11434
 */

import type { LLMProvider } from './LLMProvider'
import { OpenAICompatibleClient } from './OpenAICompatibleClient'
import { GeminiLLMClient } from './GeminiLLMClient'
import { ClaudeLLMClient } from './ClaudeLLMClient'
import { OllamaLLMClient } from './OllamaLLMClient'

type Env = Record<string, string | undefined>

export function createLLMProvider(env: Env): LLMProvider | null {
  const provider = (env.MAIN_VITE_LLM_PROVIDER ?? 'groq').toLowerCase()

  switch (provider) {
    case 'groq': {
      const key = env.MAIN_VITE_GROQ_API_KEY
      if (!key || key === 'your_groq_api_key_here') return null
      return new OpenAICompatibleClient({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: key,
        model: env.MAIN_VITE_GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        providerName: 'groq',
      })
    }

    case 'openai': {
      const key = env.MAIN_VITE_OPENAI_API_KEY
      if (!key) return null
      return new OpenAICompatibleClient({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: key,
        model: env.MAIN_VITE_OPENAI_MODEL ?? 'gpt-4o-mini',
        providerName: 'openai',
      })
    }

    case 'gemini': {
      const key = env.MAIN_VITE_GEMINI_API_KEY
      if (!key) return null
      return new GeminiLLMClient(key, env.MAIN_VITE_GEMINI_MODEL)
    }

    case 'claude': {
      const key = env.MAIN_VITE_CLAUDE_API_KEY
      if (!key) return null
      return new ClaudeLLMClient(key, env.MAIN_VITE_CLAUDE_MODEL)
    }

    case 'ollama': {
      return new OllamaLLMClient(
        env.MAIN_VITE_OLLAMA_MODEL ?? 'llama3.2',
        env.MAIN_VITE_OLLAMA_BASE_URL
      )
    }

    default:
      console.warn(`[LLM] 未知のプロバイダー: ${provider}。groqを使用します。`)
      return null
  }
}
