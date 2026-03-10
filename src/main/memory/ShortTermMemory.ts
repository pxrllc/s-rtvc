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
  buildContext(): string {
    if (this.turns.length === 0) return ''

    const lines: string[] = []

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

    // 直近のユーザー発話トピック（最新3件を簡潔に）
    const recentTexts = this.turns.slice(-3).map(t => `「${t.userText}」`).join(' → ')
    if (recentTexts) {
      lines.push(`直近の流れ: ${recentTexts}`)
    }

    if (lines.length === 0) return ''
    return `【会話コンテキスト】\n${lines.join('\n')}`
  }

  get turnCount(): number {
    return this.turns.length
  }

  clear(): void {
    this.turns = []
  }
}
