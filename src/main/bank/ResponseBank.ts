import type { IntentCategory } from '../../shared/intent-patterns'
import type { ResponseEntry } from '../../shared/types'

// =========================================================
// MVP onset データ（各意図カテゴリの代表フレーズ）
// =========================================================
const ONSET_DATA: ResponseEntry[] = [
  // acknowledgment
  { id: 'onset_ack_001', intent: 'acknowledgment', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'なるほど', textVariants: ['なるほどね', 'なるほどなるほど'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 10000 },
  { id: 'onset_ack_002', intent: 'acknowledgment', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'うん、うん', textVariants: ['うんうん'], requiresSynthesis: false, emotion: 'neutral', energy: 'low', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 8000 },
  { id: 'onset_ack_003', intent: 'acknowledgment', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'たしかに', textVariants: ['たしかにね'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 12000 },

  // greeting
  { id: 'onset_greet_001', intent: 'greeting', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'やあ、こんにちは', textVariants: ['よ、元気？'], requiresSynthesis: false, emotion: 'positive', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 5000 },

  // farewell
  { id: 'onset_fare_001', intent: 'farewell', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'またね', textVariants: ['じゃあね'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 5000 },

  // express_positive
  { id: 'onset_pos_001', intent: 'express_positive', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'それ、いいね', textVariants: ['いいじゃん'], requiresSynthesis: false, emotion: 'positive', energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 10000 },

  // express_negative
  { id: 'onset_neg_001', intent: 'express_negative', domain: 'universal', category: 'empathy', stage: 'onset', text: 'それは大変だね', textVariants: ['うわ、それはキツいね', 'それは辛いね'], requiresSynthesis: false, emotion: 'negative', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },

  // express_surprise
  { id: 'onset_sur_001', intent: 'express_surprise', domain: 'universal', category: 'surprise', stage: 'onset', text: 'えっ、マジで', textVariants: ['えー！', 'うそ、ほんとに？'], requiresSynthesis: false, emotion: 'surprised', energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 12000 },

  // express_complaint
  { id: 'onset_comp_001', intent: 'express_complaint', domain: 'universal', category: 'empathy', stage: 'onset', text: 'それはムカつくね', textVariants: ['わかる、それはイライラするね'], requiresSynthesis: false, emotion: 'negative', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },

  // question_factual
  { id: 'onset_qf_001', intent: 'question_factual', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'えーっと', textVariants: ['うーん、そうだな'], requiresSynthesis: false, emotion: 'neutral', energy: 'low', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 5000 },

  // question_opinion
  { id: 'onset_qo_001', intent: 'question_opinion', domain: 'universal', category: 'aizuchi', stage: 'onset', text: '個人的には', textVariants: ['うーん、正直に言うと'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 8000 },

  // question_how
  { id: 'onset_qh_001', intent: 'question_how', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'そうだなぁ', textVariants: ['えっとね'], requiresSynthesis: false, emotion: 'neutral', energy: 'low', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 8000 },

  // request_action
  { id: 'onset_ra_001', intent: 'request_action', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'わかった、やってみる', textVariants: ['了解'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 5000 },

  // request_explanation
  { id: 'onset_re_001', intent: 'request_explanation', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'そうだね、説明すると', textVariants: ['えっとね、簡単に言うと'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 8000 },

  // topic_continue
  { id: 'onset_tc_001', intent: 'topic_continue', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'うん、それでそれで', textVariants: ['なるほど、続きは？'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 8000 },

  // topic_shift
  { id: 'onset_ts_001', intent: 'topic_shift', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'あ、そっちの話ね', textVariants: ['話変わるね、なるほど'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 5000 },

  // topic_deepen
  { id: 'onset_td_001', intent: 'topic_deepen', domain: 'universal', category: 'deepening', stage: 'onset', text: 'そこ気になる', textVariants: ['もう少し聞いていい？'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 10000 },

  // storytelling
  { id: 'onset_st_001', intent: 'storytelling', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'え、何があったの', textVariants: ['聞かせて聞かせて'], requiresSynthesis: false, emotion: 'positive', energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 8000 },

  // confirmation
  { id: 'onset_conf_001', intent: 'confirmation', domain: 'universal', category: 'confirmation', stage: 'onset', text: 'えっと、確認すると', textVariants: ['つまりね'], requiresSynthesis: false, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 8000 },

  // disagreement
  { id: 'onset_dis_001', intent: 'disagreement', domain: 'universal', category: 'aizuchi', stage: 'onset', text: 'うーん、そうかなぁ', textVariants: ['どうだろう'], requiresSynthesis: false, emotion: 'neutral', energy: 'low', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 10000 },

  // ambiguous (filler)
  { id: 'onset_fill_001', intent: 'ambiguous', domain: 'universal', category: 'filler', stage: 'onset', text: 'うーん、ちょっと考えるね', textVariants: ['えっと、そうだなあ'], requiresSynthesis: false, emotion: 'neutral', energy: 'low', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 20000 },
]

// MVP body テンプレート（シンプルな固定テキスト）
const BODY_DATA: ResponseEntry[] = [
  { id: 'body_ack_001', intent: 'acknowledgment', domain: 'universal', category: 'deepening', stage: 'body', text: 'それで、もうちょっと詳しく聞かせてもらえる？', textVariants: [], requiresSynthesis: true, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },
  { id: 'body_neg_001', intent: 'express_negative', domain: 'universal', category: 'empathy', stage: 'body', text: '何かあったの？よかったら話してみて。', textVariants: [], requiresSynthesis: true, emotion: 'negative', energy: 'low', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 20000 },
  { id: 'body_pos_001', intent: 'express_positive', domain: 'universal', category: 'deepening', stage: 'body', text: 'いいじゃん！どんな感じだった？', textVariants: [], requiresSynthesis: true, emotion: 'positive', energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },
  { id: 'body_sur_001', intent: 'express_surprise', domain: 'universal', category: 'deepening', stage: 'body', text: 'それ、もっと詳しく聞かせてよ。', textVariants: [], requiresSynthesis: true, emotion: 'surprised', energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },
  { id: 'body_fall_001', intent: 'ambiguous', domain: 'universal', category: 'fallback', stage: 'body', text: '面白いね。もっと聞かせて。', textVariants: [], requiresSynthesis: true, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 10000 },
]

export class ResponseBank {
  private byStageIntent = new Map<string, ResponseEntry[]>()
  private byId = new Map<string, ResponseEntry>()

  constructor() {
    const all = [...ONSET_DATA, ...BODY_DATA]
    for (const entry of all) {
      const key = `${entry.stage}:${entry.intent}`
      const list = this.byStageIntent.get(key) ?? []
      list.push(entry)
      this.byStageIntent.set(key, list)
      this.byId.set(entry.id, entry)
    }
  }

  getOnset(intent: IntentCategory): ResponseEntry {
    const key = `onset:${intent}`
    const candidates = this.byStageIntent.get(key) ?? []

    const now = Date.now()
    const available = candidates.filter(
      e => !e.lastUsedAt || now - e.lastUsedAt > e.cooldownMs
    )
    const pool = available.length > 0 ? available : candidates

    // 使用回数が少ないものを優先、同数ならランダム
    pool.sort((a, b) => a.usageCount - b.usageCount)
    const minCount = pool[0].usageCount
    const leastUsed = pool.filter(e => e.usageCount === minCount)
    const selected = leastUsed[Math.floor(Math.random() * leastUsed.length)]

    selected.usageCount++
    selected.lastUsedAt = now

    // バリエーションからランダム選択
    const texts = [selected.text, ...selected.textVariants]
    return { ...selected, text: texts[Math.floor(Math.random() * texts.length)] }
  }

  getBody(intent: IntentCategory): ResponseEntry | null {
    const key = `body:${intent}`
    const candidates = this.byStageIntent.get(key) ?? []
    if (candidates.length > 0) return candidates[0]

    // fallback
    return this.byStageIntent.get('body:ambiguous')?.[0] ?? null
  }
}
