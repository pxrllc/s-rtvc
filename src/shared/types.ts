import type { IntentCategory, IntentClassification } from './intent-patterns'

export type { IntentCategory, IntentClassification }

export type EmotionTag =
  | 'positive' | 'negative' | 'neutral'
  | 'excited' | 'sad' | 'angry'
  | 'surprised' | 'anxious' | 'relieved'

export type ResponseCategory =
  | 'aizuchi'
  | 'empathy'
  | 'surprise'
  | 'confirmation'
  | 'deepening'
  | 'opinion'
  | 'information'
  | 'topic_bridge'
  | 'fallback'
  | 'filler'

export type ResponseEntry = {
  id: string
  intent: IntentCategory
  domain: 'universal' | string
  category: ResponseCategory
  stage: 'onset' | 'body' | 'followup'
  text: string
  textVariants: string[]
  cachedAudioId?: string
  requiresSynthesis: boolean
  emotion: EmotionTag
  energy: 'low' | 'mid' | 'high'
  formality: 'casual' | 'normal' | 'formal'
  topicTags: string[]
  usageCount: number
  lastUsedAt?: number
  cooldownMs: number
}

// IPC メッセージ型
export type MainToRenderer =
  | { type: 'tts:pcm'; pcmData: Float32Array; sampleRate: number }
  | { type: 'tts:stop' }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'intent:result'; result: IntentClassification; latencyMs: number }

export type RendererToMain =
  | { type: 'text:submit'; text: string }
  | { type: 'tts:stop_request' }
