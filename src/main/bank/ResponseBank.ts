import type { IntentCategory } from '../../shared/intent-patterns'
import type { ResponseEntry } from '../../shared/types'

// =========================================================
// ヘルパー: エントリを簡潔に書くための型
// =========================================================
type OnsetDef = [
  id: string,
  intent: IntentCategory,
  text: string,           // 短いほど合成が速い（目標: 2-8文字）
  variants: string[],
  cooldownMs: number
]

function onset(
  id: string,
  intent: IntentCategory,
  text: string,
  variants: string[],
  cooldownMs: number,
  emotion: ResponseEntry['emotion'] = 'neutral',
  energy: ResponseEntry['energy'] = 'mid'
): ResponseEntry {
  return {
    id, intent, domain: 'universal', category: 'aizuchi', stage: 'onset',
    text, textVariants: variants,
    requiresSynthesis: false,
    emotion, energy, formality: 'casual', topicTags: [],
    usageCount: 0, cooldownMs
  }
}

// =========================================================
// Onset データ
// ※ テキストは短いほど VOICEVOX 合成が速い
// =========================================================
const ONSET_DATA: ResponseEntry[] = [

  // ── acknowledgment（了解・同意）── 4エントリ
  onset('ack_01', 'acknowledgment', 'なるほど',    ['なるほどね'],         8000),
  onset('ack_02', 'acknowledgment', 'たしかに',    ['たしかにね'],         10000),
  onset('ack_03', 'acknowledgment', 'うんうん',    ['うん、うん'],         6000),
  onset('ack_04', 'acknowledgment', 'そうだよね',  ['だよね'],             9000),

  // ── greeting（挨拶）── 3エントリ
  onset('greet_01', 'greeting', 'やあ',         ['おう'],               5000, 'positive'),
  onset('greet_02', 'greeting', 'こんにちは',    ['よ'],                 5000, 'positive', 'high'),
  onset('greet_03', 'greeting', 'おー、久しぶり', ['ひさしぶり'],         5000, 'positive'),

  // ── farewell（別れ）── 3エントリ
  onset('fare_01', 'farewell', 'またね',     ['じゃあね'],           5000),
  onset('fare_02', 'farewell', 'おつかれ',   ['おつかれさま'],       5000),
  onset('fare_03', 'farewell', 'またいつでも', ['いつでも来てね'],     5000),

  // ── express_positive（ポジティブ）── 4エントリ
  onset('pos_01', 'express_positive', 'いいね',       ['いいじゃん'],         8000,  'positive', 'high'),
  onset('pos_02', 'express_positive', 'それ最高',     ['すごいじゃん'],       30000, 'positive', 'high'),
  onset('pos_03', 'express_positive', 'やるじゃん',   ['すごいね'],           25000, 'positive'),
  onset('pos_04', 'express_positive', 'うれしいね',   ['よかった'],           8000,  'positive'),

  // ── express_negative（ネガティブ）── 4エントリ
  onset('neg_01', 'express_negative', 'それはきつい',   ['つらいね'],           12000, 'negative'),
  onset('neg_02', 'express_negative', '大変だったね',   ['それは大変'],         14000, 'negative'),
  onset('neg_03', 'express_negative', 'うわ、それは',   ['うわー'],             10000, 'negative'),
  onset('neg_04', 'express_negative', 'しんどいね',     ['きついね'],           11000, 'negative'),

  // ── express_surprise（驚き）── 4エントリ
  onset('sur_01', 'express_surprise', 'えっ、マジで',  ['うそ'],               25000, 'surprised', 'high'),
  onset('sur_02', 'express_surprise', 'ほんとに',      ['まじか'],             20000, 'surprised', 'high'),
  onset('sur_03', 'express_surprise', 'えー！',        ['うわっ'],             20000, 'surprised', 'high'),
  onset('sur_04', 'express_surprise', 'びっくりした',  ['それは知らなかった'], 25000, 'surprised'),

  // ── express_complaint（不満・愚痴）── 4エントリ
  onset('comp_01', 'express_complaint', 'それはムカつく', ['わかるそれ'],         12000, 'negative'),
  onset('comp_02', 'express_complaint', 'それはひどい',   ['ありえないね'],       13000, 'negative'),
  onset('comp_03', 'express_complaint', 'わかるわー',     ['めんどいね'],         10000, 'negative'),
  onset('comp_04', 'express_complaint', 'イライラするね', ['それはしんどい'],     11000, 'negative'),

  // ── question_factual（事実質問）── 3エントリ
  onset('qf_01', 'question_factual', 'えっとね',    ['そうだな'],           5000),
  onset('qf_02', 'question_factual', 'うーん',      ['ちょっと待って'],     4000, 'neutral', 'low'),
  onset('qf_03', 'question_factual', 'それはね',    ['確かそれは'],         6000),

  // ── question_opinion（意見質問）── 3エントリ
  onset('qo_01', 'question_opinion', '個人的には',  ['正直言うと'],         8000),
  onset('qo_02', 'question_opinion', 'うーん、そうだな', ['どうだろう'],     7000, 'neutral', 'low'),
  onset('qo_03', 'question_opinion', 'ぶっちゃけ',  ['率直に言うと'],       9000),

  // ── question_how（方法質問）── 3エントリ
  onset('qh_01', 'question_how', 'そうだなぁ',   ['えっとね'],           7000),
  onset('qh_02', 'question_how', 'それはね',     ['やり方としては'],     6000),
  onset('qh_03', 'question_how', 'ポイントは',   ['コツとしては'],       8000),

  // ── request_action（行動要求）── 3エントリ
  onset('ra_01', 'request_action', 'わかった',    ['了解'],               5000),
  onset('ra_02', 'request_action', 'やってみる',  ['やっておく'],         5000),
  onset('ra_03', 'request_action', 'まかせて',    ['オッケー'],           6000),

  // ── request_explanation（説明要求）── 3エントリ
  onset('re_01', 'request_explanation', 'えっとね',     ['説明すると'],         6000),
  onset('re_02', 'request_explanation', 'そうだね',     ['わかりやすく言うと'], 7000),
  onset('re_03', 'request_explanation', 'かいつまんで', ['ざっくり言うと'],     8000),

  // ── topic_continue（話題継続）── 3エントリ
  onset('tc_01', 'topic_continue', 'それで',         ['うん、それで'],       6000),
  onset('tc_02', 'topic_continue', 'うん、続きは',   ['ほんで？'],           7000),
  onset('tc_03', 'topic_continue', 'なるほど、で',   ['それで？'],           7000),

  // ── topic_shift（話題転換）── 3エントリ
  onset('ts_01', 'topic_shift', 'あ、そっちね',   ['話変わるね'],         5000),
  onset('ts_02', 'topic_shift', 'ほお',           ['そういえば'],         4000),
  onset('ts_03', 'topic_shift', 'そういえば',     ['急に話変わるけど'],   6000),

  // ── topic_deepen（深掘り）── 3エントリ
  onset('td_01', 'topic_deepen', 'そこ気になる',   ['もう少し聞いて'],     9000),
  onset('td_02', 'topic_deepen', 'それ詳しく',     ['もっと教えて'],       8000),
  onset('td_03', 'topic_deepen', 'なんで？',       ['理由は？'],           7000),

  // ── storytelling（体験談）── 4エントリ
  onset('st_01', 'storytelling', '何があったの',   ['聞かせて'],           7000,  'positive', 'high'),
  onset('st_02', 'storytelling', 'えっ、マジで',   ['うそ、それ'],         9000,  'surprised', 'high'),
  onset('st_03', 'storytelling', 'あ、それは',     ['そうなんだ'],         6000),
  onset('st_04', 'storytelling', '面白そう',       ['気になる'],           8000,  'positive'),

  // ── confirmation（確認）── 3エントリ
  onset('conf_01', 'confirmation', 'えっとね',       ['確認すると'],         6000),
  onset('conf_02', 'confirmation', 'つまりね',        ['言い換えると'],       7000),
  onset('conf_03', 'confirmation', 'そういうこと？',  ['ってこと？'],         8000),

  // ── disagreement（反対・否定）── 3エントリ
  onset('dis_01', 'disagreement', 'うーん、どうかな', ['そうかなあ'],         9000),
  onset('dis_02', 'disagreement', 'むずかしいね',     ['一概には'],           10000),
  onset('dis_03', 'disagreement', 'でもさ',           ['ちょっと待って'],     7000),

  // ── ambiguous（パターン不一致・汎用リアクション）──
  // confidence >= 0.4 かつ ambiguous 判定のとき使用
  onset('amb_01', 'ambiguous', 'へえ',         [],             4000),
  onset('amb_02', 'ambiguous', 'そっかー',     ['そっか'],     5000),
  onset('amb_03', 'ambiguous', 'そうなんだ',   [],             5000),
  onset('amb_04', 'ambiguous', 'あ、なるほど', ['なるほど'],   6000),
  onset('amb_05', 'ambiguous', 'ふーん',       [],             4000),
  onset('amb_06', 'ambiguous', 'それはそれは', [],             6000),
  onset('amb_07', 'ambiguous', 'マジで',       ['ほんとに？'], 5000),
]

// ── listening（傾聴・低confidence時フォールバック）──────────────────
// confidence < 0.4 の時に使用。文脈に依存しない安全な相槌。
// cooldown 短め（会話の流れを止めないため）
const LISTENING_DATA: ResponseEntry[] = [
  onset('lis_01', 'ambiguous', 'うん',         ['うんうん'],     3000),
  onset('lis_02', 'ambiguous', 'そうそう',     ['そうだね'],     3000),
  onset('lis_03', 'ambiguous', 'そっか',       ['そっかそっか'], 3000),
  onset('lis_04', 'ambiguous', 'ほんとに',     ['ほんとだね'],   4000),
  onset('lis_05', 'ambiguous', 'たしかに',     ['たしかだね'],   4000),
  onset('lis_06', 'ambiguous', 'なるほど',     ['なるほどね'],   3000),
  onset('lis_07', 'ambiguous', 'うんうん',     [],               3000),
  onset('lis_08', 'ambiguous', 'そうだよね',   [],               4000),
  onset('lis_09', 'ambiguous', 'だよね',       [],               3000),
  onset('lis_10', 'ambiguous', 'ふむ',         ['ふむふむ'],     3000),
]

// =========================================================
// Body テンプレート
// =========================================================
const BODY_DATA: ResponseEntry[] = [
  { id: 'body_ack_01',  intent: 'acknowledgment',   domain: 'universal', category: 'deepening', stage: 'body', text: 'もうちょっと詳しく聞かせて。', textVariants: [], requiresSynthesis: true, emotion: 'neutral',   energy: 'mid',  formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },
  { id: 'body_neg_01',  intent: 'express_negative',  domain: 'universal', category: 'empathy',   stage: 'body', text: '何かあったの？よかったら話して。', textVariants: [], requiresSynthesis: true, emotion: 'negative',  energy: 'low',  formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 20000 },
  { id: 'body_pos_01',  intent: 'express_positive',  domain: 'universal', category: 'deepening', stage: 'body', text: 'どんな感じだった？', textVariants: [], requiresSynthesis: true, emotion: 'positive',  energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },
  { id: 'body_sur_01',  intent: 'express_surprise',  domain: 'universal', category: 'deepening', stage: 'body', text: 'もっと詳しく聞かせてよ。', textVariants: [], requiresSynthesis: true, emotion: 'surprised', energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },
  { id: 'body_comp_01', intent: 'express_complaint', domain: 'universal', category: 'empathy',   stage: 'body', text: '気持ちわかるよ。どうしたの？', textVariants: [], requiresSynthesis: true, emotion: 'negative',  energy: 'mid',  formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 15000 },
  { id: 'body_st_01',   intent: 'storytelling',      domain: 'universal', category: 'deepening', stage: 'body', text: 'それ、どうなったの？', textVariants: [], requiresSynthesis: true, emotion: 'positive',  energy: 'high', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 12000 },
  { id: 'body_fall_01', intent: 'ambiguous',         domain: 'universal', category: 'fallback',  stage: 'body', text: 'もっと聞かせて。', textVariants: ['それで？'], requiresSynthesis: true, emotion: 'neutral', energy: 'mid', formality: 'casual', topicTags: [], usageCount: 0, cooldownMs: 10000 },
]

// =========================================================
// ResponseBank
// =========================================================
/** confidence がこの値未満なら傾聴フォールバック */
const LISTENING_THRESHOLD = 0.45

export class ResponseBank {
  private byStageIntent = new Map<string, ResponseEntry[]>()
  private byId = new Map<string, ResponseEntry>()
  private listeningPool: ResponseEntry[]

  constructor() {
    for (const entry of [...ONSET_DATA, ...BODY_DATA]) {
      const key = `${entry.stage}:${entry.intent}`
      const list = this.byStageIntent.get(key) ?? []
      list.push(entry)
      this.byStageIntent.set(key, list)
      this.byId.set(entry.id, entry)
    }
    this.listeningPool = LISTENING_DATA
  }

  getOnset(intent: IntentCategory, confidence: number): ResponseEntry {
    // confidence が低い場合は傾聴フォールバック（文脈乖離を防ぐ）
    if (confidence < LISTENING_THRESHOLD) {
      return this.pickFrom(this.listeningPool)
    }

    const key = `onset:${intent}`
    const candidates = this.byStageIntent.get(key) ?? []

    // candidates がなければ ambiguous にフォールバック
    const pool = candidates.length > 0 ? candidates : (this.byStageIntent.get('onset:ambiguous') ?? [])

    return this.pickFrom(pool)
  }

  private pickFrom(pool: ResponseEntry[]): ResponseEntry {
    const now = Date.now()
    const available = pool.filter(e => !e.lastUsedAt || now - e.lastUsedAt > e.cooldownMs)
    const source = available.length > 0 ? available : pool

    // 使用回数が少ないものを優先（元配列を変えないようコピーしてソート）
    const sorted = [...source].sort((a, b) => a.usageCount - b.usageCount)
    const minCount = sorted[0].usageCount
    const leastUsed = sorted.filter(e => e.usageCount === minCount)
    const selected = leastUsed[Math.floor(Math.random() * leastUsed.length)]

    selected.usageCount++
    selected.lastUsedAt = now

    // textVariants からランダム選択
    const texts = [selected.text, ...selected.textVariants]
    return { ...selected, text: texts[Math.floor(Math.random() * texts.length)] }
  }

  getBody(intent: IntentCategory): ResponseEntry | null {
    const key = `body:${intent}`
    const candidates = this.byStageIntent.get(key) ?? []
    if (candidates.length > 0) return candidates[0]
    return this.byStageIntent.get('body:ambiguous')?.[0] ?? null
  }
}
