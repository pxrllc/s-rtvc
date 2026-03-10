/**
 * HookExtractor
 * ユーザー発話からトピック語・エンティティを抽出する。
 * 形態素解析なし。正規表現 + キーワードリストで実装。
 */

/** 抽出されたフック（会話の広げどころ） */
export type Hook = {
  surface: string   // 表面テキスト
  type: 'entity' | 'emotion_target' | 'causal' | 'desire' | 'topic'
}

// 因果関係マーカー
const CAUSAL_MARKERS = ['から', 'ので', 'せいで', 'おかげで', 'のに', 'だから', 'なので']

// 欲求・行動マーカー（直前の語をエンティティとして取る）
const DESIRE_PATTERNS = [
  /(\S{2,10})(?:したい|が欲しい|を買いたい|に行きたい|が好き|が嫌い|が苦手)/g,
  /(\S{2,10})(?:を食べ|を飲み|を見|に行|を買)/g,
]

// 感情目的語パターン（「〜で嬉しい」「〜が辛い」の〜）
const EMOTION_OBJECT_PATTERNS = [
  /(\S{2,15})(?:で嬉しい|が嬉しい|で楽しい|が楽しい|で辛い|が辛い|で悲しい|が悲しい|で怖い|で不安|が心配)/g,
]

// トピックキーワードリスト（これ自体をフックとして登録）
const TOPIC_KEYWORDS = new Set([
  '仕事', '職場', '上司', '同僚', '会議', '残業', '転職',
  '家族', '親', '子供', '彼氏', '彼女', '友達', '恋人',
  '学校', '勉強', '試験', '授業', '先生', '部活',
  '健康', '病気', '病院', '薬', '運動', '食事', 'ダイエット',
  '旅行', '観光', 'ホテル', '飛行機', '電車', '車',
  '趣味', 'ゲーム', '映画', '音楽', '読書', 'スポーツ',
  '料理', 'レストラン', 'カフェ', 'コーヒー', 'お酒',
  '買い物', 'ショッピング', '服', 'ファッション',
  '天気', '季節', '春', '夏', '秋', '冬',
  'お金', '給料', '節約', '貯金', 'ローン',
])

export class HookExtractor {
  extract(text: string): string[] {
    const hooks = new Set<string>()

    // 1. カタカナ語（4文字以上）→ 固有名詞・外来語として抽出
    const katakana = text.match(/[ァ-ヶー]{4,}/g) ?? []
    for (const w of katakana) hooks.add(w)

    // 2. 欲求・行動パターンの目的語
    for (const pattern of DESIRE_PATTERNS) {
      pattern.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = pattern.exec(text)) !== null) {
        const word = m[1].trim()
        if (word.length >= 2) hooks.add(word)
      }
    }

    // 3. 感情目的語パターン
    for (const pattern of EMOTION_OBJECT_PATTERNS) {
      pattern.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = pattern.exec(text)) !== null) {
        const word = m[1].trim()
        if (word.length >= 2) hooks.add(word)
      }
    }

    // 4. 因果マーカー周辺テキスト（マーカー前10文字）
    for (const marker of CAUSAL_MARKERS) {
      const idx = text.indexOf(marker)
      if (idx > 0) {
        const before = text.substring(Math.max(0, idx - 10), idx).trim()
        // 句読点・助詞で区切って最後のブロックを取る
        const chunk = before.split(/[、。！？\s]/).filter(Boolean).pop() ?? ''
        if (chunk.length >= 2 && chunk.length <= 10) hooks.add(chunk)
      }
    }

    // 5. トピックキーワードの直接マッチ
    for (const keyword of TOPIC_KEYWORDS) {
      if (text.includes(keyword)) hooks.add(keyword)
    }

    // ノイズ除去: 助詞・助動詞のみの語を除く
    const NOISE = new Set(['です', 'ます', 'ない', 'ある', 'いる', 'する', 'なる', 'ので', 'から', 'けど'])
    for (const h of hooks) {
      if (NOISE.has(h)) hooks.delete(h)
    }

    return [...hooks].slice(0, 8)  // 上位8件
  }
}
