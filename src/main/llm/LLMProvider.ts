/**
 * LLMProvider — 全LLMクライアントが実装するインターフェース
 */
export interface LLMProvider {
  generate(userText: string, memoryContext?: string): Promise<string>
  clearHistory(): void
  readonly providerName: string
  readonly modelName: string
}

/** 全プロバイダー共通のシステムプロンプト */
export const SYSTEM_PROMPT = `あなたはSentinelという会話AIです。ユーザーと自然な日本語で会話します。
- カジュアルな口調（「だよ」「だね」「かな」など）
- 返答は1〜2文程度、短くテンポよく
- 共感・質問・意見でリズムよく会話を続ける
- 音声読み上げされるため記号（*、#、リスト、括弧など）は一切使わない
- 絵文字も使わない`

export type Message = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 会話履歴の共通管理ロジック */
export class ConversationHistory {
  private history: Message[] = []
  private readonly MAX_TURNS: number

  constructor(maxTurns = 6) {
    this.MAX_TURNS = maxTurns
  }

  push(role: 'user' | 'assistant', content: string): void {
    this.history.push({ role, content })
    if (this.history.length > this.MAX_TURNS * 2) {
      this.history = this.history.slice(-this.MAX_TURNS * 2)
    }
  }

  getRecent(): Message[] {
    return this.history.slice(-this.MAX_TURNS)
  }

  clear(): void {
    this.history = []
  }
}
