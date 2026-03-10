/**
 * ShortTermMemory
 * セッション中の直近ターンを記録し、LLMコンテキスト文字列を構築する。
 */

import type { IntentCategory } from '../../shared/intent-patterns'

export type TurnRecord = {
  userText: string
  intent: IntentCategory
  confidence: number
  hooks: string[]        // HookExtractor が抽出したフック
  llmResponse: string | null
  timestamp: number
}

// ポジティブ/ネガティブ傾向の判定
const POSITIVE_INTENTS = new Set<IntentCategory>([
  'express_positive', 'greeting', 'storytelling'
])
const NEGATIVE_INTENTS = new Set<IntentCategory>([
  'express_negative', 'express_complaint'
])

export class ShortTermMemory {
  private turns: TurnRecord[] = []
  private readonly MAX_TURNS = 10

  addTurn(turn: TurnRecord): void {
    this.turns.push(turn)
    if (this.turns.length > this.MAX_TURNS) {
      this.turns.shift()
    }
  }

  updateLastLLMResponse(text: string): void {
    if (this.turns.length > 0) {
      this.turns[this.turns.length - 1].llmResponse = text
    }
  }

  /** LLMのシステムプロンプトに追記するコンテキスト文字列を返す */
  buildContext(episodicContext = '', longTermContext = ''): string {
    const lines: string[] = []

    // 長期記憶（頻出トピック）
    if (longTermContext) lines.push(longTermContext)

    // エピソード記憶（過去の関連会話）
    if (episodicContext) lines.push(episodicContext)

    if (this.turns.length > 0) {
      // 直近5ターンのフックを集約（重複除去）
      const recentHooks = [
        ...new Set(this.turns.slice(-5).flatMap(t => t.hooks))
      ]
      if (recentHooks.length > 0) {
        lines.push(`会話で出てきたキーワード: ${recentHooks.join('、')}`)
      }

      // 感情トレンド（直近3ターン）
      const recentIntents = this.turns.slice(-3).map(t => t.intent)
      const posCount = recentIntents.filter(i => POSITIVE_INTENTS.has(i)).length
      const negCount = recentIntents.filter(i => NEGATIVE_INTENTS.has(i)).length
      if (posCount >= 2) {
        lines.push('感情トレンド: ポジティブな流れ')
      } else if (negCount >= 2) {
        lines.push('感情トレンド: ネガティブな流れ（共感を優先）')
      }

      // 直近のユーザー発話（最新3件）
      const recentTexts = this.turns.slice(-3).map(t => `「${t.userText}」`).join(' → ')
      if (recentTexts) {
        lines.push(`直近の流れ: ${recentTexts}`)
      }
    }

    if (lines.length === 0) return ''
    return `【会話コンテキスト】\n${lines.join('\n')}`
  }

  /** セッション終了時にエピソードデータを生成して返す */
  buildEpisode(): {
    topics: string[]
    frequentHooks: string[]
    turnCount: number
    emotionSummary: 'positive' | 'negative' | 'neutral'
    sampleUtterances: string[]
  } | null {
    if (this.turns.length < 2) return null

    const allHooks = this.turns.flatMap(t => t.hooks)
    const hookCount: Record<string, number> = {}
    for (const h of allHooks) {
      hookCount[h] = (hookCount[h] ?? 0) + 1
    }
    const frequentHooks = Object.entries(hookCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([h]) => h)

    const posCount = this.turns.filter(t => POSITIVE_INTENTS.has(t.intent)).length
    const negCount = this.turns.filter(t => NEGATIVE_INTENTS.has(t.intent)).length
    const emotionSummary = posCount > negCount + 2 ? 'positive'
      : negCount > posCount + 2 ? 'negative'
      : 'neutral'

    // 長めの発話をサンプルとして選ぶ
    const sampleUtterances = this.turns
      .filter(t => t.userText.length >= 10)
      .map(t => t.userText)
      .slice(0, 3)

    const topics = [...new Set(frequentHooks)]

    return { topics, frequentHooks, turnCount: this.turns.length, emotionSummary, sampleUtterances }
  }

  /** セッション中に収集した全フックを返す */
  getAllHooks(): string[] {
    return [...new Set(this.turns.flatMap(t => t.hooks))]
  }

  /** 直近3ターンの感情トレンドを返す */
  getEmotionTrend(): 'positive' | 'negative' | 'neutral' {
    const recentIntents = this.turns.slice(-3).map(t => t.intent)
    const posCount = recentIntents.filter(i => POSITIVE_INTENTS.has(i)).length
    const negCount = recentIntents.filter(i => NEGATIVE_INTENTS.has(i)).length
    if (posCount >= 2) return 'positive'
    if (negCount >= 2) return 'negative'
    return 'neutral'
  }

  get turnCount(): number {
    return this.turns.length
  }

  clear(): void {
    this.turns = []
  }
}
