// Sentinel Engine — Public Type Declarations
// Implementation is pre-compiled and not included in this repository.

// ── intent-patterns ───────────────────────────────────────────────────────

export type IntentCategory =
  | 'greeting' | 'farewell' | 'acknowledgment' | 'disagreement' | 'confirmation'
  | 'question_factual' | 'question_opinion' | 'question_how'
  | 'request_action' | 'request_explanation'
  | 'express_positive' | 'express_negative' | 'express_surprise' | 'express_complaint'
  | 'topic_continue' | 'topic_shift' | 'topic_deepen'
  | 'storytelling' | 'ambiguous'

export type PatternEntry = {
  pattern: string
  intent: IntentCategory
  weight: number
  negation?: string[]
}

export type AhoCorasickHit = {
  pattern: string
  intent: IntentCategory
  weight: number
  start: number
  end: number
}

export type IntentClassification = {
  intent: IntentCategory
  confidence: number
  matches: AhoCorasickHit[]
  method: 'aho-corasick' | 'syntax' | 'fallback'
}

export declare const INTENT_PATTERNS: PatternEntry[]

export declare class AhoCorasickEngine {
  constructor(patterns: PatternEntry[])
  classify(text: string): IntentClassification
}

// ── SyntaxRuleEngine ─────────────────────────────────────────────────────

export declare class SyntaxRuleEngine {
  apply(text: string, base: IntentClassification): IntentClassification
}

// ── HookExtractor ────────────────────────────────────────────────────────

export declare class HookExtractor {
  extract(text: string): string[]
}

// ── ResponseBank ─────────────────────────────────────────────────────────

export type ResponseEntry = {
  id: string
  intent: IntentCategory
  stage: 'onset' | 'body' | 'followup'
  text: string
  textVariants: string[]
  emotion: string
  energy: 'low' | 'mid' | 'high'
  usageCount: number
  lastUsedAt?: number
  cooldownMs: number
}

export declare class ResponseBank {
  getOnset(
    intent: IntentCategory,
    confidence: number,
    emotionTrend?: 'positive' | 'negative' | 'neutral'
  ): ResponseEntry
  getBody(intent: IntentCategory): ResponseEntry | null
}

// ── ConversationOrchestrator ─────────────────────────────────────────────

import type { BrowserWindow } from 'electron'
import type { LLMProvider } from '../main/llm/LLMProvider'
import type { TtsProvider } from '../main/tts/TtsProvider'

export declare class ConversationOrchestrator {
  constructor(
    win: BrowserWindow,
    llmProvider?: LLMProvider | null,
    ttsProvider?: TtsProvider
  )
  loadCache(): Promise<void>
  onText(text: string): Promise<void>
  checkVoicevox(): Promise<boolean>
  endSession(): void
}
