/**
 * Sentinel — Aho-Corasick 意図分類パターン辞書
 *
 * 設計方針:
 *   - 日常会話をカバーする汎用辞書（300-400 パターン）
 *   - パターンは「部分一致」で使う（Aho-Corasick は入力テキスト中の出現を検出）
 *   - weight: そのパターン単体での意図確信度（0.0-1.0）
 *     - 1.0 = ほぼ確実にその意図
 *     - 0.7 = 高確率
 *     - 0.5 = 文脈次第
 *     - 0.3 = 弱いヒント
 *   - negation: このパターンが同一テキストに含まれていたらマッチを無効化
 *
 * メモリ概算:
 *   400 パターン × 平均 40byte(UTF-8) ≈ 16KB（パターン文字列）
 *   Aho-Corasick オートマトン（ノード + fail link） ≈ 200-500KB
 *   合計: 1MB 未満
 */

// =============================================================================
// 型定義
// =============================================================================

export type IntentCategory =
  // 会話制御
  | "greeting"
  | "farewell"
  | "acknowledgment"
  | "disagreement"
  | "confirmation"
  // 情報
  | "question_factual"
  | "question_opinion"
  | "question_how"
  | "request_action"
  | "request_explanation"
  // 感情
  | "express_positive"
  | "express_negative"
  | "express_surprise"
  | "express_complaint"
  // 会話展開
  | "topic_continue"
  | "topic_shift"
  | "topic_deepen"
  | "storytelling"
  // fallback
  | "ambiguous";

export type PatternEntry = {
  /** マッチ対象の部分文字列 */
  pattern: string;
  /** 対応する意図カテゴリ */
  intent: IntentCategory;
  /** 確信度スコア 0.0-1.0 */
  weight: number;
  /** これらが同一テキストに含まれていたらマッチ無効 */
  negation?: string[];
};

// =============================================================================
// パターン辞書本体
// =============================================================================

export const INTENT_PATTERNS: PatternEntry[] = [
  // =========================================================================
  // greeting — 挨拶（18 パターン）
  // =========================================================================
  { pattern: "おはよう",         intent: "greeting", weight: 1.0 },
  { pattern: "こんにちは",       intent: "greeting", weight: 1.0 },
  { pattern: "こんばんは",       intent: "greeting", weight: 1.0 },
  { pattern: "やあ",             intent: "greeting", weight: 0.8 },
  { pattern: "やっほー",         intent: "greeting", weight: 0.9 },
  { pattern: "ひさしぶり",       intent: "greeting", weight: 0.9 },
  { pattern: "久しぶり",         intent: "greeting", weight: 0.9 },
  { pattern: "お久しぶり",       intent: "greeting", weight: 0.9 },
  { pattern: "元気？",           intent: "greeting", weight: 0.8 },
  { pattern: "元気ですか",       intent: "greeting", weight: 0.8 },
  { pattern: "調子どう",         intent: "greeting", weight: 0.8 },
  { pattern: "はじめまして",     intent: "greeting", weight: 1.0 },
  { pattern: "初めまして",       intent: "greeting", weight: 1.0 },
  { pattern: "よろしく",         intent: "greeting", weight: 0.7 },
  { pattern: "ただいま",         intent: "greeting", weight: 0.9 },
  { pattern: "おかえり",         intent: "greeting", weight: 0.9 },
  { pattern: "おつかれ",         intent: "greeting", weight: 0.7 },
  { pattern: "お疲れ",           intent: "greeting", weight: 0.7 },

  // =========================================================================
  // farewell — 別れ（14 パターン）
  // =========================================================================
  { pattern: "じゃあね",         intent: "farewell", weight: 1.0 },
  { pattern: "またね",           intent: "farewell", weight: 1.0 },
  { pattern: "バイバイ",         intent: "farewell", weight: 1.0 },
  { pattern: "さようなら",       intent: "farewell", weight: 1.0 },
  { pattern: "おやすみ",         intent: "farewell", weight: 0.9 },
  { pattern: "お先に",           intent: "farewell", weight: 0.8 },
  { pattern: "落ちるね",         intent: "farewell", weight: 0.9 },
  { pattern: "そろそろ行く",     intent: "farewell", weight: 0.9 },
  { pattern: "もう寝る",         intent: "farewell", weight: 0.8 },
  { pattern: "また明日",         intent: "farewell", weight: 1.0 },
  { pattern: "また今度",         intent: "farewell", weight: 0.9 },
  { pattern: "ありがとう、じゃ", intent: "farewell", weight: 0.9 },
  { pattern: "それじゃ",         intent: "farewell", weight: 0.7 },
  { pattern: "失礼します",       intent: "farewell", weight: 0.9 },

  // =========================================================================
  // acknowledgment — 了解・同意（28 パターン）
  // =========================================================================
  { pattern: "なるほど",         intent: "acknowledgment", weight: 1.0 },
  { pattern: "なるほどね",       intent: "acknowledgment", weight: 1.0 },
  { pattern: "そうだね",         intent: "acknowledgment", weight: 0.9 },
  { pattern: "そうだよね",       intent: "acknowledgment", weight: 0.9 },
  { pattern: "そうですね",       intent: "acknowledgment", weight: 0.9 },
  { pattern: "たしかに",         intent: "acknowledgment", weight: 0.9 },
  { pattern: "確かに",           intent: "acknowledgment", weight: 0.9 },
  { pattern: "わかった",         intent: "acknowledgment", weight: 0.8 },
  { pattern: "わかる",           intent: "acknowledgment", weight: 0.7 },
  { pattern: "分かった",         intent: "acknowledgment", weight: 0.8 },
  { pattern: "了解",             intent: "acknowledgment", weight: 0.9 },
  { pattern: "りょうかい",       intent: "acknowledgment", weight: 0.9 },
  { pattern: "おっけー",         intent: "acknowledgment", weight: 0.8 },
  { pattern: "オッケー",         intent: "acknowledgment", weight: 0.8 },
  { pattern: "うん",             intent: "acknowledgment", weight: 0.6 },
  { pattern: "うんうん",         intent: "acknowledgment", weight: 0.8 },
  { pattern: "ああ",             intent: "acknowledgment", weight: 0.5 },
  { pattern: "はい",             intent: "acknowledgment", weight: 0.6 },
  { pattern: "ですよね",         intent: "acknowledgment", weight: 0.8 },
  { pattern: "だよね",           intent: "acknowledgment", weight: 0.8 },
  { pattern: "それな",           intent: "acknowledgment", weight: 0.9 },
  { pattern: "ほんとそれ",       intent: "acknowledgment", weight: 0.9 },
  { pattern: "同感",             intent: "acknowledgment", weight: 0.9 },
  { pattern: "そのとおり",       intent: "acknowledgment", weight: 0.9 },
  { pattern: "その通り",         intent: "acknowledgment", weight: 0.9 },
  { pattern: "間違いない",       intent: "acknowledgment", weight: 0.8 },
  { pattern: "まさに",           intent: "acknowledgment", weight: 0.7 },
  { pattern: "ほんとに",         intent: "acknowledgment", weight: 0.5 },

  // =========================================================================
  // disagreement — 反対・否定（20 パターン）
  // =========================================================================
  { pattern: "違うと思う",       intent: "disagreement", weight: 0.9 },
  { pattern: "違うよ",           intent: "disagreement", weight: 0.9 },
  { pattern: "違くない",         intent: "disagreement", weight: 0.8 },
  { pattern: "それは違う",       intent: "disagreement", weight: 1.0 },
  { pattern: "そうかな",         intent: "disagreement", weight: 0.6 },
  { pattern: "そうかなあ",       intent: "disagreement", weight: 0.7 },
  { pattern: "どうだろう",       intent: "disagreement", weight: 0.5 },
  { pattern: "微妙",             intent: "disagreement", weight: 0.6 },
  { pattern: "うーん",           intent: "disagreement", weight: 0.3 },
  { pattern: "いや、",           intent: "disagreement", weight: 0.7 },
  { pattern: "いやいや",         intent: "disagreement", weight: 0.8 },
  { pattern: "でもさ",           intent: "disagreement", weight: 0.6 },
  { pattern: "ただ、",           intent: "disagreement", weight: 0.4 },
  { pattern: "とはいえ",         intent: "disagreement", weight: 0.5 },
  { pattern: "そうは思わない",   intent: "disagreement", weight: 1.0 },
  { pattern: "賛成できない",     intent: "disagreement", weight: 1.0 },
  { pattern: "反対",             intent: "disagreement", weight: 0.8 },
  { pattern: "無理がある",       intent: "disagreement", weight: 0.8 },
  { pattern: "それはどうかな",   intent: "disagreement", weight: 0.7 },
  { pattern: "ちょっと違う",     intent: "disagreement", weight: 0.8 },

  // =========================================================================
  // confirmation — 確認要求（16 パターン）
  // =========================================================================
  { pattern: "ってこと？",       intent: "confirmation", weight: 0.9 },
  { pattern: "ってこと",         intent: "confirmation", weight: 0.7 },
  { pattern: "ということ？",     intent: "confirmation", weight: 0.9 },
  { pattern: "で合ってる",       intent: "confirmation", weight: 0.9 },
  { pattern: "であってる",       intent: "confirmation", weight: 0.9 },
  { pattern: "つまり",           intent: "confirmation", weight: 0.6 },
  { pattern: "要するに",         intent: "confirmation", weight: 0.7 },
  { pattern: "言い換えると",     intent: "confirmation", weight: 0.7 },
  { pattern: "確認なんだけど",   intent: "confirmation", weight: 1.0 },
  { pattern: "確認したい",       intent: "confirmation", weight: 1.0 },
  { pattern: "認識合ってる",     intent: "confirmation", weight: 0.9 },
  { pattern: "それって",         intent: "confirmation", weight: 0.5 },
  { pattern: "本当に？",         intent: "confirmation", weight: 0.7 },
  { pattern: "ほんとに？",       intent: "confirmation", weight: 0.7 },
  { pattern: "マジで？",         intent: "confirmation", weight: 0.6, negation: ["マジでやばい", "マジですごい"] },
  { pattern: "まじ？",           intent: "confirmation", weight: 0.6 },

  // =========================================================================
  // question_factual — 事実質問（22 パターン）
  // =========================================================================
  { pattern: "何？",             intent: "question_factual", weight: 0.7 },
  { pattern: "なに？",           intent: "question_factual", weight: 0.7 },
  { pattern: "何ですか",         intent: "question_factual", weight: 0.8 },
  { pattern: "誰？",             intent: "question_factual", weight: 0.8 },
  { pattern: "誰が",             intent: "question_factual", weight: 0.7 },
  { pattern: "いつ？",           intent: "question_factual", weight: 0.8 },
  { pattern: "いつから",         intent: "question_factual", weight: 0.8 },
  { pattern: "いつまで",         intent: "question_factual", weight: 0.8 },
  { pattern: "どこ？",           intent: "question_factual", weight: 0.8 },
  { pattern: "どこで",           intent: "question_factual", weight: 0.7 },
  { pattern: "どこに",           intent: "question_factual", weight: 0.7 },
  { pattern: "いくら",           intent: "question_factual", weight: 0.8 },
  { pattern: "何時",             intent: "question_factual", weight: 0.8 },
  { pattern: "何個",             intent: "question_factual", weight: 0.7 },
  { pattern: "何人",             intent: "question_factual", weight: 0.7 },
  { pattern: "どのくらい",       intent: "question_factual", weight: 0.7 },
  { pattern: "何歳",             intent: "question_factual", weight: 0.8 },
  { pattern: "知ってる？",       intent: "question_factual", weight: 0.6 },
  { pattern: "知ってますか",     intent: "question_factual", weight: 0.6 },
  { pattern: "って何",           intent: "question_factual", weight: 0.9 },
  { pattern: "とは",             intent: "question_factual", weight: 0.5 },
  { pattern: "ある？",           intent: "question_factual", weight: 0.5 },

  // =========================================================================
  // question_opinion — 意見質問（18 パターン）
  // =========================================================================
  { pattern: "どう思う",         intent: "question_opinion", weight: 1.0 },
  { pattern: "どう思います",     intent: "question_opinion", weight: 1.0 },
  { pattern: "どう感じる",       intent: "question_opinion", weight: 0.9 },
  { pattern: "意見聞きたい",     intent: "question_opinion", weight: 1.0 },
  { pattern: "どっちがいい",     intent: "question_opinion", weight: 0.9 },
  { pattern: "どれがおすすめ",   intent: "question_opinion", weight: 0.9 },
  { pattern: "おすすめは",       intent: "question_opinion", weight: 0.8 },
  { pattern: "おすすめある",     intent: "question_opinion", weight: 0.8 },
  { pattern: "好き？",           intent: "question_opinion", weight: 0.6 },
  { pattern: "嫌い？",           intent: "question_opinion", weight: 0.6 },
  { pattern: "賛成？",           intent: "question_opinion", weight: 0.8 },
  { pattern: "反対？",           intent: "question_opinion", weight: 0.8 },
  { pattern: "的にはどう",       intent: "question_opinion", weight: 0.9 },
  { pattern: "ぶっちゃけ",       intent: "question_opinion", weight: 0.5 },
  { pattern: "正直どう",         intent: "question_opinion", weight: 0.9 },
  { pattern: "率直に",           intent: "question_opinion", weight: 0.6 },
  { pattern: "どう考える",       intent: "question_opinion", weight: 1.0 },
  { pattern: "アリだと思う？",   intent: "question_opinion", weight: 0.9 },

  // =========================================================================
  // question_how — 方法質問（20 パターン）
  // =========================================================================
  { pattern: "どうやって",       intent: "question_how", weight: 1.0 },
  { pattern: "どうすれば",       intent: "question_how", weight: 1.0 },
  { pattern: "どうしたら",       intent: "question_how", weight: 1.0 },
  { pattern: "どうやったら",     intent: "question_how", weight: 1.0 },
  { pattern: "やり方",           intent: "question_how", weight: 0.8 },
  { pattern: "方法",             intent: "question_how", weight: 0.6 },
  { pattern: "手順",             intent: "question_how", weight: 0.7 },
  { pattern: "コツ",             intent: "question_how", weight: 0.7 },
  { pattern: "ポイント",         intent: "question_how", weight: 0.5 },
  { pattern: "するにはどう",     intent: "question_how", weight: 0.9 },
  { pattern: "するには",         intent: "question_how", weight: 0.6 },
  { pattern: "教えて",           intent: "question_how", weight: 0.6 },
  { pattern: "教えてほしい",     intent: "question_how", weight: 0.7 },
  { pattern: "知りたい",         intent: "question_how", weight: 0.6 },
  { pattern: "何から始め",       intent: "question_how", weight: 0.9 },
  { pattern: "最初に何",         intent: "question_how", weight: 0.8 },
  { pattern: "手っ取り早く",     intent: "question_how", weight: 0.7 },
  { pattern: "簡単に言うと",     intent: "question_how", weight: 0.5 },
  { pattern: "具体的にどう",     intent: "question_how", weight: 0.9 },
  { pattern: "実際どう",         intent: "question_how", weight: 0.7 },

  // =========================================================================
  // request_action — 行動要求（16 パターン）
  // =========================================================================
  { pattern: "やって",           intent: "request_action", weight: 0.7 },
  { pattern: "してほしい",       intent: "request_action", weight: 0.9 },
  { pattern: "して欲しい",       intent: "request_action", weight: 0.9 },
  { pattern: "してくれない",     intent: "request_action", weight: 0.8 },
  { pattern: "してくれる？",     intent: "request_action", weight: 0.8 },
  { pattern: "してもらえる",     intent: "request_action", weight: 0.8 },
  { pattern: "お願い",           intent: "request_action", weight: 0.7 },
  { pattern: "お願いします",     intent: "request_action", weight: 0.8 },
  { pattern: "頼みたい",         intent: "request_action", weight: 0.9 },
  { pattern: "頼める？",         intent: "request_action", weight: 0.9 },
  { pattern: "できる？",         intent: "request_action", weight: 0.6, negation: ["自分にできる"] },
  { pattern: "可能？",           intent: "request_action", weight: 0.6 },
  { pattern: "作って",           intent: "request_action", weight: 0.8 },
  { pattern: "書いて",           intent: "request_action", weight: 0.8 },
  { pattern: "調べて",           intent: "request_action", weight: 0.8 },
  { pattern: "探して",           intent: "request_action", weight: 0.8 },

  // =========================================================================
  // request_explanation — 説明要求（14 パターン）
  // =========================================================================
  { pattern: "説明して",         intent: "request_explanation", weight: 1.0 },
  { pattern: "詳しく",           intent: "request_explanation", weight: 0.7 },
  { pattern: "もっと詳しく",     intent: "request_explanation", weight: 0.9 },
  { pattern: "わかりやすく",     intent: "request_explanation", weight: 0.8 },
  { pattern: "かみ砕いて",       intent: "request_explanation", weight: 0.9 },
  { pattern: "噛み砕いて",       intent: "request_explanation", weight: 0.9 },
  { pattern: "例えば",           intent: "request_explanation", weight: 0.5 },
  { pattern: "たとえば",         intent: "request_explanation", weight: 0.5 },
  { pattern: "具体的に",         intent: "request_explanation", weight: 0.7 },
  { pattern: "イメージがわかない", intent: "request_explanation", weight: 0.8 },
  { pattern: "ピンとこない",     intent: "request_explanation", weight: 0.8 },
  { pattern: "よくわからない",   intent: "request_explanation", weight: 0.7 },
  { pattern: "意味がわからない", intent: "request_explanation", weight: 0.8 },
  { pattern: "何が違う",         intent: "request_explanation", weight: 0.7 },

  // =========================================================================
  // express_positive — ポジティブ感情（24 パターン）
  // =========================================================================
  { pattern: "嬉しい",           intent: "express_positive", weight: 0.9 },
  { pattern: "うれしい",         intent: "express_positive", weight: 0.9 },
  { pattern: "楽しい",           intent: "express_positive", weight: 0.9 },
  { pattern: "楽しかった",       intent: "express_positive", weight: 0.9 },
  { pattern: "面白い",           intent: "express_positive", weight: 0.8 },
  { pattern: "おもしろい",       intent: "express_positive", weight: 0.8 },
  { pattern: "すごい",           intent: "express_positive", weight: 0.7 },
  { pattern: "すげー",           intent: "express_positive", weight: 0.7 },
  { pattern: "やばい",           intent: "express_positive", weight: 0.4 }, // ポジ/ネガ両方ありうる
  { pattern: "最高",             intent: "express_positive", weight: 0.9 },
  { pattern: "いいね",           intent: "express_positive", weight: 0.8 },
  { pattern: "いいじゃん",       intent: "express_positive", weight: 0.8 },
  { pattern: "良かった",         intent: "express_positive", weight: 0.8 },
  { pattern: "よかった",         intent: "express_positive", weight: 0.8 },
  { pattern: "ワクワク",         intent: "express_positive", weight: 0.9 },
  { pattern: "わくわく",         intent: "express_positive", weight: 0.9 },
  { pattern: "テンション上がる", intent: "express_positive", weight: 0.9 },
  { pattern: "幸せ",             intent: "express_positive", weight: 0.9 },
  { pattern: "しあわせ",         intent: "express_positive", weight: 0.9 },
  { pattern: "気に入った",       intent: "express_positive", weight: 0.8 },
  { pattern: "ハマった",         intent: "express_positive", weight: 0.7 },
  { pattern: "はまった",         intent: "express_positive", weight: 0.7 },
  { pattern: "感動した",         intent: "express_positive", weight: 0.9 },
  { pattern: "ありがたい",       intent: "express_positive", weight: 0.7 },

  // =========================================================================
  // express_negative — ネガティブ感情（26 パターン）
  // =========================================================================
  { pattern: "つらい",           intent: "express_negative", weight: 0.9 },
  { pattern: "辛い",             intent: "express_negative", weight: 0.8 },
  { pattern: "しんどい",         intent: "express_negative", weight: 0.9 },
  { pattern: "疲れた",           intent: "express_negative", weight: 0.8 },
  { pattern: "つかれた",         intent: "express_negative", weight: 0.8 },
  { pattern: "だるい",           intent: "express_negative", weight: 0.7 },
  { pattern: "きつい",           intent: "express_negative", weight: 0.7 },
  { pattern: "落ち込んだ",       intent: "express_negative", weight: 0.9 },
  { pattern: "へこんだ",         intent: "express_negative", weight: 0.9 },
  { pattern: "凹んだ",           intent: "express_negative", weight: 0.9 },
  { pattern: "悲しい",           intent: "express_negative", weight: 0.9 },
  { pattern: "かなしい",         intent: "express_negative", weight: 0.9 },
  { pattern: "寂しい",           intent: "express_negative", weight: 0.8 },
  { pattern: "さみしい",         intent: "express_negative", weight: 0.8 },
  { pattern: "不安",             intent: "express_negative", weight: 0.7 },
  { pattern: "心配",             intent: "express_negative", weight: 0.6 },
  { pattern: "ストレス",         intent: "express_negative", weight: 0.8 },
  { pattern: "限界",             intent: "express_negative", weight: 0.8 },
  { pattern: "無理",             intent: "express_negative", weight: 0.6 },
  { pattern: "もう嫌",           intent: "express_negative", weight: 0.9 },
  { pattern: "もういや",         intent: "express_negative", weight: 0.9 },
  { pattern: "やる気でない",     intent: "express_negative", weight: 0.8 },
  { pattern: "やる気が出ない",   intent: "express_negative", weight: 0.8 },
  { pattern: "モチベ下がる",     intent: "express_negative", weight: 0.8 },
  { pattern: "テンション下がる", intent: "express_negative", weight: 0.8 },
  { pattern: "最悪",             intent: "express_negative", weight: 0.8 },

  // =========================================================================
  // express_surprise — 驚き（16 パターン）
  // =========================================================================
  { pattern: "えっ",             intent: "express_surprise", weight: 0.7 },
  { pattern: "ええ！",           intent: "express_surprise", weight: 0.8 },
  { pattern: "うそ",             intent: "express_surprise", weight: 0.7 },
  { pattern: "嘘でしょ",         intent: "express_surprise", weight: 0.9 },
  { pattern: "まじか",           intent: "express_surprise", weight: 0.8 },
  { pattern: "マジか",           intent: "express_surprise", weight: 0.8 },
  { pattern: "マジで！",         intent: "express_surprise", weight: 0.8 },
  { pattern: "びっくり",         intent: "express_surprise", weight: 0.9 },
  { pattern: "驚いた",           intent: "express_surprise", weight: 0.9 },
  { pattern: "おどろいた",       intent: "express_surprise", weight: 0.9 },
  { pattern: "信じられない",     intent: "express_surprise", weight: 0.8 },
  { pattern: "想像つかない",     intent: "express_surprise", weight: 0.7 },
  { pattern: "予想外",           intent: "express_surprise", weight: 0.8 },
  { pattern: "意外",             intent: "express_surprise", weight: 0.7 },
  { pattern: "知らなかった",     intent: "express_surprise", weight: 0.6 },
  { pattern: "初耳",             intent: "express_surprise", weight: 0.8 },

  // =========================================================================
  // express_complaint — 不満・愚痴（20 パターン）
  // =========================================================================
  { pattern: "めんどくさい",     intent: "express_complaint", weight: 0.9 },
  { pattern: "めんどう",         intent: "express_complaint", weight: 0.8 },
  { pattern: "面倒",             intent: "express_complaint", weight: 0.8 },
  { pattern: "ムカつく",         intent: "express_complaint", weight: 0.9 },
  { pattern: "むかつく",         intent: "express_complaint", weight: 0.9 },
  { pattern: "腹立つ",           intent: "express_complaint", weight: 0.9 },
  { pattern: "イライラ",         intent: "express_complaint", weight: 0.9 },
  { pattern: "いらいら",         intent: "express_complaint", weight: 0.9 },
  { pattern: "うざい",           intent: "express_complaint", weight: 0.8 },
  { pattern: "ウザい",           intent: "express_complaint", weight: 0.8 },
  { pattern: "なんなの",         intent: "express_complaint", weight: 0.7 },
  { pattern: "意味わからない",   intent: "express_complaint", weight: 0.6, negation: ["の意味がわからない"] },
  { pattern: "ありえない",       intent: "express_complaint", weight: 0.8 },
  { pattern: "ひどい",           intent: "express_complaint", weight: 0.7 },
  { pattern: "ずるい",           intent: "express_complaint", weight: 0.7 },
  { pattern: "不公平",           intent: "express_complaint", weight: 0.8 },
  { pattern: "おかしい",         intent: "express_complaint", weight: 0.6 },
  { pattern: "納得できない",     intent: "express_complaint", weight: 0.9 },
  { pattern: "許せない",         intent: "express_complaint", weight: 0.9 },
  { pattern: "もうやだ",         intent: "express_complaint", weight: 0.9 },

  // =========================================================================
  // topic_continue — 話題継続（16 パターン）
  // =========================================================================
  { pattern: "それでね",         intent: "topic_continue", weight: 0.8 },
  { pattern: "それで",           intent: "topic_continue", weight: 0.6 },
  { pattern: "でね",             intent: "topic_continue", weight: 0.7 },
  { pattern: "続きなんだけど",   intent: "topic_continue", weight: 1.0 },
  { pattern: "さっきの話",       intent: "topic_continue", weight: 0.9 },
  { pattern: "さっきの続き",     intent: "topic_continue", weight: 1.0 },
  { pattern: "あと",             intent: "topic_continue", weight: 0.3 },
  { pattern: "あとね",           intent: "topic_continue", weight: 0.6 },
  { pattern: "しかも",           intent: "topic_continue", weight: 0.6 },
  { pattern: "それに",           intent: "topic_continue", weight: 0.5 },
  { pattern: "加えて",           intent: "topic_continue", weight: 0.6 },
  { pattern: "もう一つ",         intent: "topic_continue", weight: 0.7 },
  { pattern: "もうひとつ",       intent: "topic_continue", weight: 0.7 },
  { pattern: "補足すると",       intent: "topic_continue", weight: 0.8 },
  { pattern: "ちなみに",         intent: "topic_continue", weight: 0.6 },
  { pattern: "ついでに",         intent: "topic_continue", weight: 0.6 },

  // =========================================================================
  // topic_shift — 話題転換（14 パターン）
  // =========================================================================
  { pattern: "ところで",         intent: "topic_shift", weight: 1.0 },
  { pattern: "話変わるけど",     intent: "topic_shift", weight: 1.0 },
  { pattern: "話変わるんだけど", intent: "topic_shift", weight: 1.0 },
  { pattern: "全然違う話",       intent: "topic_shift", weight: 1.0 },
  { pattern: "別の話なんだけど", intent: "topic_shift", weight: 1.0 },
  { pattern: "そういえば",       intent: "topic_shift", weight: 0.8 },
  { pattern: "あ、そうだ",       intent: "topic_shift", weight: 0.7 },
  { pattern: "思い出した",       intent: "topic_shift", weight: 0.6 },
  { pattern: "関係ないけど",     intent: "topic_shift", weight: 0.9 },
  { pattern: "関係ないんだけど", intent: "topic_shift", weight: 0.9 },
  { pattern: "それはそうと",     intent: "topic_shift", weight: 0.9 },
  { pattern: "話は変わって",     intent: "topic_shift", weight: 1.0 },
  { pattern: "脱線するけど",     intent: "topic_shift", weight: 0.9 },
  { pattern: "余談だけど",       intent: "topic_shift", weight: 0.9 },

  // =========================================================================
  // topic_deepen — 話題深掘り（14 パターン）
  // =========================================================================
  { pattern: "もう少し詳しく",   intent: "topic_deepen", weight: 0.9 },
  { pattern: "もうちょっと",     intent: "topic_deepen", weight: 0.5 },
  { pattern: "深掘りすると",     intent: "topic_deepen", weight: 0.9 },
  { pattern: "掘り下げると",     intent: "topic_deepen", weight: 0.9 },
  { pattern: "そこをもう少し",   intent: "topic_deepen", weight: 0.9 },
  { pattern: "その先",           intent: "topic_deepen", weight: 0.6 },
  { pattern: "その先は",         intent: "topic_deepen", weight: 0.7 },
  { pattern: "なんでそう思う",   intent: "topic_deepen", weight: 0.8 },
  { pattern: "どうしてそう",     intent: "topic_deepen", weight: 0.7 },
  { pattern: "理由は",           intent: "topic_deepen", weight: 0.7 },
  { pattern: "原因は",           intent: "topic_deepen", weight: 0.7 },
  { pattern: "何がきっかけ",     intent: "topic_deepen", weight: 0.8 },
  { pattern: "きっかけは",       intent: "topic_deepen", weight: 0.7 },
  { pattern: "背景は",           intent: "topic_deepen", weight: 0.7 },

  // =========================================================================
  // storytelling — 体験談・物語（18 パターン）
  // =========================================================================
  { pattern: "実はね",           intent: "storytelling", weight: 0.9 },
  { pattern: "実は",             intent: "storytelling", weight: 0.6 },
  { pattern: "この前",           intent: "storytelling", weight: 0.7 },
  { pattern: "こないだ",         intent: "storytelling", weight: 0.7 },
  { pattern: "先日",             intent: "storytelling", weight: 0.7 },
  { pattern: "昨日",             intent: "storytelling", weight: 0.5 },
  { pattern: "今日ね",           intent: "storytelling", weight: 0.6 },
  { pattern: "さっきね",         intent: "storytelling", weight: 0.7 },
  { pattern: "聞いてよ",         intent: "storytelling", weight: 0.9 },
  { pattern: "聞いて聞いて",     intent: "storytelling", weight: 1.0 },
  { pattern: "あのね",           intent: "storytelling", weight: 0.6 },
  { pattern: "あのさ",           intent: "storytelling", weight: 0.5 },
  { pattern: "驚くんだけど",     intent: "storytelling", weight: 0.8 },
  { pattern: "笑っちゃうんだけど", intent: "storytelling", weight: 0.8 },
  { pattern: "したんだよ",       intent: "storytelling", weight: 0.6 },
  { pattern: "があってさ",       intent: "storytelling", weight: 0.7 },
  { pattern: "だったんだけど",   intent: "storytelling", weight: 0.6 },
  { pattern: "経験があって",     intent: "storytelling", weight: 0.7 },
];

// =============================================================================
// 統計情報
// =============================================================================

/**
 * パターン数の内訳（実行時に検証用）
 */
export function getPatternStats(): Record<IntentCategory, number> {
  const stats: Partial<Record<IntentCategory, number>> = {};
  for (const entry of INTENT_PATTERNS) {
    stats[entry.intent] = (stats[entry.intent] || 0) + 1;
  }
  return stats as Record<IntentCategory, number>;
}

/**
 * 辞書の概要を出力
 */
export function printDictionarySummary(): void {
  const stats = getPatternStats();
  const total = INTENT_PATTERNS.length;

  console.log("=== Aho-Corasick Intent Pattern Dictionary ===");
  console.log(`Total patterns: ${total}`);
  console.log("");

  const categories = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [intent, count] of categories) {
    const pct = ((count / total) * 100).toFixed(1);
    const bar = "█".repeat(Math.ceil(count / 2));
    console.log(`  ${intent.padEnd(22)} ${String(count).padStart(3)}  (${pct.padStart(5)}%)  ${bar}`);
  }

  // メモリ概算
  const patternBytes = INTENT_PATTERNS.reduce(
    (sum, e) => sum + new TextEncoder().encode(e.pattern).length,
    0
  );
  const automatonEstimate = total * 500; // ノードあたり約500byte（保守的見積もり）
  const totalKB = ((patternBytes + automatonEstimate) / 1024).toFixed(1);
  console.log("");
  console.log(`Estimated memory: ~${totalKB} KB`);
  console.log(`  Pattern strings: ${(patternBytes / 1024).toFixed(1)} KB`);
  console.log(`  Automaton (est.): ${(automatonEstimate / 1024).toFixed(1)} KB`);
}

// =============================================================================
// Aho-Corasick 最小実装（外部ライブラリ不要版）
// =============================================================================

type TrieNode = {
  children: Map<string, number>;  // char → node index
  fail: number;                   // failure link
  output: number[];               // マッチするパターンのインデックス群
  depth: number;
};

export class AhoCorasickEngine {
  private nodes: TrieNode[] = [];
  private patterns: PatternEntry[];

  constructor(patterns: PatternEntry[]) {
    this.patterns = patterns;

    // root ノード
    this.nodes.push({
      children: new Map(),
      fail: 0,
      output: [],
      depth: 0,
    });

    // Step 1: Trie 構築
    for (let pi = 0; pi < patterns.length; pi++) {
      this.insertPattern(patterns[pi].pattern, pi);
    }

    // Step 2: Failure link 構築（BFS）
    this.buildFailureLinks();
  }

  private insertPattern(pattern: string, patternIndex: number): void {
    let current = 0;

    for (const char of pattern) {
      let next = this.nodes[current].children.get(char);
      if (next === undefined) {
        next = this.nodes.length;
        this.nodes.push({
          children: new Map(),
          fail: 0,
          output: [],
          depth: this.nodes[current].depth + 1,
        });
        this.nodes[current].children.set(char, next);
      }
      current = next;
    }

    this.nodes[current].output.push(patternIndex);
  }

  private buildFailureLinks(): void {
    const queue: number[] = [];

    // depth=1 のノードの fail は全て root(0)
    for (const child of this.nodes[0].children.values()) {
      this.nodes[child].fail = 0;
      queue.push(child);
    }

    // BFS で failure link を構築
    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const [char, child] of this.nodes[current].children) {
        queue.push(child);

        let fail = this.nodes[current].fail;
        while (fail !== 0 && !this.nodes[fail].children.has(char)) {
          fail = this.nodes[fail].fail;
        }

        const failChild = this.nodes[fail].children.get(char);
        this.nodes[child].fail =
          failChild !== undefined && failChild !== child ? failChild : 0;

        // output を failure link 先からマージ
        this.nodes[child].output = [
          ...this.nodes[child].output,
          ...this.nodes[this.nodes[child].fail].output,
        ];
      }
    }
  }

  /**
   * テキストを1回走査し、全マッチを返す。
   * 計算量: O(n + m)  n=テキスト長, m=マッチ数
   */
  search(text: string): AhoCorasickHit[] {
    const hits: AhoCorasickHit[] = [];
    let current = 0;

    let pos = 0;
    for (const char of text) {
      while (current !== 0 && !this.nodes[current].children.has(char)) {
        current = this.nodes[current].fail;
      }

      const next = this.nodes[current].children.get(char);
      current = next !== undefined ? next : 0;

      for (const patternIndex of this.nodes[current].output) {
        const entry = this.patterns[patternIndex];
        hits.push({
          patternIndex,
          pattern: entry.pattern,
          intent: entry.intent,
          weight: entry.weight,
          position: pos - [...entry.pattern].length + 1,
        });
      }

      pos++;
    }

    return hits;
  }

  /**
   * 意図分類の最終結果を返す（スコア集約 + negation チェック）
   */
  classify(text: string): IntentClassification {
    const hits = this.search(text);

    if (hits.length === 0) {
      return { intent: "ambiguous", confidence: 0, matches: [], method: "rule" };
    }

    // negation チェック: 無効化対象を除外
    const validHits = hits.filter((hit) => {
      const entry = this.patterns[hit.patternIndex];
      if (!entry.negation) return true;
      return !entry.negation.some((neg) => text.includes(neg));
    });

    if (validHits.length === 0) {
      return { intent: "ambiguous", confidence: 0, matches: [], method: "rule" };
    }

    // 意図ごとにスコアを集約
    const intentScores = new Map<IntentCategory, number>();
    const intentHits = new Map<IntentCategory, AhoCorasickHit[]>();

    for (const hit of validHits) {
      const current = intentScores.get(hit.intent) || 0;
      // 複数マッチは加算するが、上限 1.0
      intentScores.set(hit.intent, Math.min(1.0, current + hit.weight * 0.5));

      const hitsForIntent = intentHits.get(hit.intent) || [];
      hitsForIntent.push(hit);
      intentHits.set(hit.intent, hitsForIntent);
    }

    // 最高スコアの意図を選択
    let bestIntent: IntentCategory = "ambiguous";
    let bestScore = 0;

    for (const [intent, score] of intentScores) {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    return {
      intent: bestIntent,
      confidence: Math.min(1.0, bestScore),
      matches: intentHits.get(bestIntent) || [],
      method: "rule",
    };
  }

  /** ノード数を返す（メモリ概算用） */
  get nodeCount(): number {
    return this.nodes.length;
  }
}

export type AhoCorasickHit = {
  patternIndex: number;
  pattern: string;
  intent: IntentCategory;
  weight: number;
  position: number;
};

export type IntentClassification = {
  intent: IntentCategory;
  confidence: number;
  matches: AhoCorasickHit[];
  method: "rule" | "llm";
};
