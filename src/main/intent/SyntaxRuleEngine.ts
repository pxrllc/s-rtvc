/**
 * SyntaxRuleEngine
 * AhoCorasick のスコアマップに文末・文長・感嘆符などの構文ルールでブーストを適用し、
 * 最終的な IntentClassification を返す。
 */

import type { IntentCategory, IntentClassification, AhoCorasickHit } from '../../shared/intent-patterns'

export class SyntaxRuleEngine {
  /**
   * スコアマップにルールを適用して最終意図を確定する
   */
  apply(text: string, base: IntentClassification): IntentClassification {
    // スコアマップのコピー（元を変えない）
    const scores = new Map<IntentCategory, number>(base.scores)

    const trimmed = text.trim()

    // ── ルール1: 文末 ?/？ → question 系・confirmation ブースト ──────
    if (/[?？]\s*$/.test(trimmed)) {
      this.boost(scores, ['question_factual', 'question_opinion', 'question_how'], 0.3)
      this.boost(scores, ['confirmation'], 0.2)
    }

    // ── ルール2: 疑問詞 → question_factual / question_how ブースト ───
    if (/なに|なぜ|どうして|どう|どこ|いつ|だれ|なん|どれ|どんな|どういう/.test(trimmed)) {
      this.boost(scores, ['question_factual', 'question_how'], 0.25)
    }

    // ── ルール3a: 超短文 ≤ 2 → スコアをリセット（傾聴強制）────────
    // 「ね」「うん」「はい」など1-2文字の相槌は傾聴pool へ
    if (trimmed.length <= 2 && !/[?？!！]/.test(trimmed)) {
      scores.clear()
    }
    // ── ルール3b: 文長 ≤ 5 → acknowledgment / greeting ブースト ──────
    else if (trimmed.length <= 5 && !/[?？]/.test(trimmed)) {
      this.boost(scores, ['acknowledgment'], 0.4)
      this.boost(scores, ['greeting'], 0.3)
    }

    // ── ルール4: 感嘆符 → express_surprise / express_positive ブースト
    if (/[!！]/.test(trimmed)) {
      this.boost(scores, ['express_surprise', 'express_positive'], 0.2)
    }

    // ── ルール5: 長文(≥20文字) → storytelling ブースト ─────────────
    if (trimmed.length >= 20) {
      this.boost(scores, ['storytelling'], 0.15)
    }

    // ── ルール6: ネガティブ語 → express_negative / express_complaint ─
    if (/つらい|しんどい|きつい|つかれ|疲れ|最悪|むかつ|ムカつ|ストレス|嫌|やだ/.test(trimmed)) {
      this.boost(scores, ['express_negative', 'express_complaint'], 0.25)
    }

    // ── スコア最高の意図を確定 ────────────────────────────────────
    let bestIntent: IntentCategory = 'ambiguous'
    let bestScore = 0

    for (const [intent, score] of scores) {
      if (score > bestScore) {
        bestScore = score
        bestIntent = intent
      }
    }

    // ブーストで意図が変わった場合は matches を空に（スコア由来のみ）
    const matches: AhoCorasickHit[] = bestIntent === base.intent
      ? base.matches
      : []

    return {
      intent: bestIntent,
      confidence: Math.min(1.0, bestScore),
      matches,
      method: 'rule',
      scores,
    }
  }

  private boost(
    scores: Map<IntentCategory, number>,
    intents: IntentCategory[],
    amount: number
  ): void {
    for (const intent of intents) {
      scores.set(intent, Math.min(1.0, (scores.get(intent) ?? 0) + amount))
    }
  }
}
