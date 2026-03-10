/**
 * Groq Chat Completions クライアント
 * モデル: llama-3.3-70b-versatile（高品質・無料枠あり）
 */

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `あなたはSentinelという会話AIです。ユーザーと自然な日本語で会話します。
- カジュアルな口調（「だよ」「だね」「かな」など）
- 返答は1〜2文程度、短くテンポよく
- 共感・質問・意見でリズムよく会話を続ける
- 音声読み上げされるため記号（*、#、リスト、括弧など）は一切使わない
- 絵文字も使わない`

type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class GroqLLMClient {
  private apiKey: string
  private history: Message[] = []
  private readonly MAX_HISTORY_TURNS = 6  // 3往復分

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generate(userText: string, memoryContext?: string): Promise<string> {
    this.history.push({ role: 'user', content: userText })

    const systemContent = memoryContext
      ? `${SYSTEM_PROMPT}\n\n${memoryContext}`
      : SYSTEM_PROMPT

    const messages: Message[] = [
      { role: 'system', content: systemContent },
      ...this.history.slice(-this.MAX_HISTORY_TURNS)
    ]

    const res = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 120,
        temperature: 0.75
      })
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Groq LLM failed: ${res.status} ${err}`)
    }

    const json = await res.json() as {
      choices: [{ message: { content: string } }]
    }
    const reply = json.choices[0].message.content.trim()

    this.history.push({ role: 'assistant', content: reply })

    if (this.history.length > this.MAX_HISTORY_TURNS * 2) {
      this.history = this.history.slice(-this.MAX_HISTORY_TURNS * 2)
    }

    return reply
  }

  clearHistory(): void {
    this.history = []
  }
}
