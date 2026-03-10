# Sentinel リアルタイム会話AI 実装仕様書

## STT応答から100ms以内の発話開始を実現する超低遅延会話システム

**Version:** 1.0 Draft  
**Date:** 2026-03-10  
**Platform:** Electron + TypeScript + Vite  
**TTS Engine:** VOICEVOX Core（常駐プロセス）  
**STT Engine:** Groq API（外部、チューニング対象外）

---

# 目次

1. [設計思想と目標](#1-設計思想と目標)
2. [レイテンシバジェット](#2-レイテンシバジェット)
3. [全体アーキテクチャ](#3-全体アーキテクチャ)
4. [意図理解エンジン（ハイブリッド方式）](#4-意図理解エンジンハイブリッド方式)
5. [返答バンクシステム](#5-返答バンクシステム)
6. [応答合成パイプライン](#6-応答合成パイプライン)
7. [TTSハイブリッドエンジン（キャッシュ＋リアルタイム）](#7-ttsハイブリッドエンジンキャッシュリアルタイム)
8. [会話オーケストレーター](#8-会話オーケストレーター)
9. [メモリアーキテクチャ](#9-メモリアーキテクチャ)
10. [フック駆動会話戦略](#10-フック駆動会話戦略)
11. [先読み・投機実行エンジン](#11-先読み投機実行エンジン)
12. [Electron プロセスアーキテクチャ](#12-electron-プロセスアーキテクチャ)
13. [ディレクトリ構成](#13-ディレクトリ構成)
14. [型定義一覧](#14-型定義一覧)
15. [データフロー詳細](#15-データフロー詳細)
16. [MVP実装順序](#16-mvp実装順序)
17. [付録A: VOICEVOX Core 高速化ガイド](#17-付録a-voicevox-core-高速化ガイド)
18. [付録B: 返答バンク初期データ設計](#18-付録b-返答バンク初期データ設計)

---

# 1. 設計思想と目標

## 1.1 最上位目標

**STT（Groq）からテキストが返ってきた瞬間から100ms以内にTTSが発話を開始する。**

これは「完全な回答を100msで返す」のではなく、**発話の開始音声（相槌・つなぎ）を100ms以内に鳴らし始める**ことを意味する。本回答は裏で生成し、発話開始音声の直後にシームレスに接続する。

## 1.2 設計原則

### 原則1: 発話開始と発話本体を分離する

人間の会話では、相手の話が終わった瞬間に「うん」「なるほど」が返る。内容のある返答はその後に続く。この構造を模倣する。

```
ユーザー発話終了
  ↓ 0-100ms
Stage 1: 発話開始音声（キャッシュ済みWAVバイナリ再生）
  ↓ 200-800ms
Stage 2: 本回答音声（リアルタイム合成 or キャッシュ済み断片の組み合わせ）
  ↓ オプション
Stage 3: フォローアップ質問
```

### 原則2: LLMに頼る前にアルゴリズムで解決する

意図理解の80%以上はルールベースで処理する。LLMはルールで判定できなかった場合のfallbackとして使う。

### 原則3: メモリ上に全てを持つ

数千の返答キー、数百のキャッシュ済みWAVバイナリ、意図分類テーブル——すべてをメモリ上に展開し、ディスクI/Oをゼロにする。

### 原則4: 毎回テキストからTTS合成しない

頻出フレーズはPCMバイナリとしてメモリ常駐させ、バッファ参照だけで再生する。新規テキストのみVOICEVOX Coreでリアルタイム合成する。

---

# 2. レイテンシバジェット

## 2.1 100ms発話開始の内訳

STTテキスト受信を t=0 とする。

```
t=0ms    STTテキスト受信（Groq APIからのレスポンス到達）
t=0-5ms  意図分類（ルールベース: ハッシュ検索 + パターンマッチ）
t=5-10ms 返答キー選択（バンクからのO(1)ルックアップ）
t=10-15ms キャッシュ済みWAVバッファのポインタ取得
t=15-25ms AudioBufferSourceNode へのバッファ割り当て
t=25-50ms Web Audio API 再生スケジューリング
t=50-80ms 実際の音声出力開始（オーディオデバイスレイテンシ）
t=80-100ms マージン
```

## 2.2 並行処理タイムライン

```
t=0ms     ──┬── 意図分類開始（メインスレッド）
            ├── 投機的プリフェッチ結果の照合開始
t=5ms     ──┼── 意図確定 → 発話開始キー決定
            ├── [並行] 本回答テンプレート選択開始
t=10ms    ──┼── WAVバッファ参照取得
            ├── [並行] テンプレート変数埋め込み開始
t=15ms    ──┼── AudioBuffer に PCM データ割り当て
            ├── [並行] 本回答テキスト確定
t=25ms    ──┼── 再生開始命令
            ├── [並行] VOICEVOX に本回答テキスト送信
t=50-80ms ──┼── 発話開始音声が鳴り始める ✓
            ├── [並行] VOICEVOX が本回答を合成中
t=300-800ms ─── 発話開始音声終了 → 本回答音声にシームレス接続
```

## 2.3 各コンポーネントのレイテンシ上限

| コンポーネント | 上限 | 方式 |
|---|---|---|
| 意図分類（ルールベース） | 10ms | Aho-Corasick + ハッシュテーブル |
| 意図分類（LLM fallback） | 500ms | Ollama ローカル推論 |
| 返答キー選択 | 5ms | HashMap O(1) |
| WAVキャッシュ読み出し | 5ms | メモリ上 Float32Array 参照 |
| 発話開始（キャッシュ再生） | 30ms | Web Audio API |
| VOICEVOX リアルタイム合成 | 200-600ms | 常駐プロセス、1文単位 |
| 本回答テキスト生成（テンプレート） | 20-50ms | 変数埋め込み + 断片結合 |
| 本回答テキスト生成（LLM） | 800-2000ms | ストリーミング |

---

# 3. 全体アーキテクチャ

## 3.1 システム概要

```
[Groq API] ─── STTテキスト ───→ [Intent Engine] ───→ [Response Composer]
                                    │                      │
                                    │ ルール照合            │ テンプレート組立
                                    │ (< 10ms)             │ (< 50ms)
                                    │                      │
                                    ├── fallback ──→ [Ollama LLM Worker]
                                    │                      │
                                    ▼                      ▼
                              [Response Bank]        [TTS Hybrid Engine]
                              (メモリ常駐)            ├── キャッシュ層（WAVバイナリ）
                              数千エントリ            └── 合成層（VOICEVOX Core常駐）
                                                          │
                                                          ▼
                                                    [Audio Playback]
                                                    (Web Audio API)
```

## 3.2 データフローの全体像

```
[マイク入力]
    ↓
[VAD: 発話区間検出]
    ↓
[Groq API: STT]  ←── ここは外部API、制御不可
    ↓
[部分テキスト / 最終テキスト]
    ↓
┌─────────────────────────────────────────────┐
│ Conversation Orchestrator                    │
│                                              │
│  ┌──────────┐    ┌──────────────┐            │
│  │Intent    │───→│Response      │            │
│  │Engine    │    │Composer      │            │
│  │          │    │              │            │
│  │ルール照合 │    │テンプレート組立│            │
│  │+fallback │    │断片結合       │            │
│  └──────────┘    └──────┬───────┘            │
│       │                 │                    │
│       ▼                 ▼                    │
│  ┌──────────┐    ┌──────────────┐            │
│  │Response  │    │TTS Hybrid    │            │
│  │Bank      │───→│Engine        │            │
│  │          │    │              │            │
│  │キー照合   │    │Stage1: cache │            │
│  │O(1)      │    │Stage2: synth │            │
│  └──────────┘    └──────┬───────┘            │
│                         │                    │
│                         ▼                    │
│                  ┌──────────────┐            │
│                  │Speech Queue  │            │
│                  │+ Playback    │            │
│                  └──────────────┘            │
│                                              │
│  ┌──────────┐    ┌──────────────┐            │
│  │Memory    │    │Speculation   │            │
│  │System    │    │Engine        │            │
│  └──────────┘    └──────────────┘            │
└─────────────────────────────────────────────┘
    ↓
[スピーカー出力]
```

---

# 4. 意図理解エンジン（ハイブリッド方式）

## 4.1 設計方針

ユーザー発話の意図を**10ms以内**に分類することが目標。そのために、ルールベースの高速パターンマッチを第一層とし、判定不能な場合のみローカルLLMにfallbackする。

## 4.2 意図分類体系

```ts
type IntentCategory =
  // 会話制御系
  | "greeting"           // 挨拶
  | "farewell"           // 別れ
  | "acknowledgment"     // 了解・同意
  | "disagreement"       // 反対・否定
  | "confirmation"       // 確認要求
  // 情報系
  | "question_factual"   // 事実質問
  | "question_opinion"   // 意見質問
  | "question_how"       // 方法質問
  | "request_action"     // 行動要求
  | "request_explanation"// 説明要求
  // 感情系
  | "express_positive"   // ポジティブ感情
  | "express_negative"   // ネガティブ感情
  | "express_surprise"   // 驚き
  | "express_complaint"  // 不満・愚痴
  // 会話展開系
  | "topic_continue"     // 話題継続
  | "topic_shift"        // 話題転換
  | "topic_deepen"       // 話題深掘り
  | "storytelling"       // 体験談・物語
  // fallback
  | "ambiguous"          // 判定不能 → LLM fallback
```

## 4.3 第1層: Aho-Corasick マルチパターンマッチ

### 概要

Aho-Corasickアルゴリズムを使い、入力テキストに対して数千のキーワードパターンを**1回の走査**で同時にマッチさせる。

### パターン辞書の構造

```ts
type PatternEntry = {
  pattern: string           // マッチ対象文字列
  intent: IntentCategory    // 対応する意図
  weight: number            // スコア重み（0.0-1.0）
  context?: string[]        // 文脈条件（直前の意図など）
  negation?: string[]       // 否定パターン（これがあったらマッチしない）
}
```

### パターン例

```ts
const INTENT_PATTERNS: PatternEntry[] = [
  // greeting
  { pattern: "おはよう",     intent: "greeting",        weight: 1.0 },
  { pattern: "こんにちは",   intent: "greeting",        weight: 1.0 },
  { pattern: "やあ",         intent: "greeting",        weight: 0.9 },
  { pattern: "ひさしぶり",   intent: "greeting",        weight: 0.9 },

  // acknowledgment
  { pattern: "なるほど",     intent: "acknowledgment",  weight: 1.0 },
  { pattern: "そうだね",     intent: "acknowledgment",  weight: 0.9 },
  { pattern: "たしかに",     intent: "acknowledgment",  weight: 0.9 },
  { pattern: "わかった",     intent: "acknowledgment",  weight: 0.8 },

  // question_how
  { pattern: "どうやって",   intent: "question_how",    weight: 1.0 },
  { pattern: "どうすれば",   intent: "question_how",    weight: 1.0 },
  { pattern: "方法",         intent: "question_how",    weight: 0.7 },
  { pattern: "やり方",       intent: "question_how",    weight: 0.8 },

  // express_negative
  { pattern: "つらい",       intent: "express_negative", weight: 0.9 },
  { pattern: "しんどい",     intent: "express_negative", weight: 0.9 },
  { pattern: "疲れた",       intent: "express_negative", weight: 0.8 },
  { pattern: "めんどう",     intent: "express_negative", weight: 0.7 },

  // topic_shift
  { pattern: "ところで",     intent: "topic_shift",     weight: 1.0 },
  { pattern: "話変わるけど", intent: "topic_shift",     weight: 1.0 },
  { pattern: "そういえば",   intent: "topic_shift",     weight: 0.8 },

  // ... 数百〜数千パターン
]
```

### Aho-Corasick エンジン実装

```ts
class AhoCorasickIntentMatcher {
  private automaton: AhoCorasickAutomaton
  private patternMap: Map<string, PatternEntry[]>

  constructor(patterns: PatternEntry[]) {
    this.patternMap = new Map()
    const keywords: string[] = []

    for (const entry of patterns) {
      keywords.push(entry.pattern)
      const existing = this.patternMap.get(entry.pattern) || []
      existing.push(entry)
      this.patternMap.set(entry.pattern, existing)
    }

    this.automaton = buildAhoCorasick(keywords)
  }

  match(text: string): IntentMatch[] {
    const hits = this.automaton.search(text)
    const results: IntentMatch[] = []

    for (const hit of hits) {
      const entries = this.patternMap.get(hit.keyword)!
      for (const entry of entries) {
        // 否定パターンチェック
        if (entry.negation?.some(neg => text.includes(neg))) continue

        results.push({
          intent: entry.intent,
          weight: entry.weight,
          matchedPattern: entry.pattern,
          position: hit.position
        })
      }
    }

    return results
  }
}
```

## 4.4 第2層: 構文ルール判定

Aho-Corasickで複数の意図候補が出た場合、構文ルールで絞り込む。

```ts
class SyntaxRuleEngine {
  private rules: SyntaxRule[]

  classify(text: string, candidates: IntentMatch[]): IntentResult {
    // ルール1: 文末パターンによる優先度調整
    if (text.endsWith("？") || text.endsWith("?")) {
      boostIntent(candidates, "question_factual", 0.3)
      boostIntent(candidates, "question_opinion", 0.3)
      boostIntent(candidates, "question_how", 0.3)
      boostIntent(candidates, "confirmation", 0.2)
    }

    // ルール2: 文長による判定
    if (text.length <= 5) {
      boostIntent(candidates, "acknowledgment", 0.4)
      boostIntent(candidates, "greeting", 0.3)
    }

    // ルール3: 感嘆符による感情ブースト
    if (text.includes("！") || text.includes("!")) {
      boostIntent(candidates, "express_surprise", 0.2)
      boostIntent(candidates, "express_positive", 0.2)
    }

    // ルール4: 直前ターンの意図による文脈補正
    // （例: AI が質問した直後のユーザー発話は回答の可能性が高い）
    const prevTurn = this.getLastAssistantIntent()
    if (prevTurn === "question") {
      boostIntent(candidates, "topic_continue", 0.3)
    }

    // スコア合算して最高スコアの意図を返す
    return selectTopIntent(candidates)
  }
}
```

## 4.5 第3層: LLM Fallback

ルールベースで `ambiguous` と判定された場合、または信頼度が閾値を下回った場合にのみ呼び出す。

```ts
class LLMFallbackClassifier {
  private client: OllamaClient  // Ollama ローカル推論

  async classify(text: string, context: ConversationContext): Promise<IntentResult> {
    const prompt = `
以下のユーザー発話の意図を分類してください。
直前の会話文脈: ${context.recentTurnsText}
ユーザー発話: 「${text}」

以下から1つ選んでください:
${INTENT_CATEGORIES.join(", ")}

意図: `

    const response = await this.client.generate({
      model: "phi-3",    // 軽量モデル
      prompt,
      options: { num_predict: 20, temperature: 0.1 }
    })

    return parseIntentFromLLMResponse(response)
  }
}
```

## 4.6 ハイブリッド意図エンジン統合

```ts
class HybridIntentEngine {
  private ahoCorasick: AhoCorasickIntentMatcher
  private syntaxRules: SyntaxRuleEngine
  private llmFallback: LLMFallbackClassifier

  private readonly CONFIDENCE_THRESHOLD = 0.6

  async classify(text: string, context: ConversationContext): Promise<IntentResult> {
    const startTime = performance.now()

    // Step 1: Aho-Corasick パターンマッチ（< 2ms）
    const matches = this.ahoCorasick.match(text)

    // Step 2: 構文ルール判定（< 3ms）
    const ruleResult = this.syntaxRules.classify(text, matches)

    const elapsed = performance.now() - startTime
    // ここまでで 5ms 以内

    // Step 3: 信頼度チェック
    if (ruleResult.confidence >= this.CONFIDENCE_THRESHOLD) {
      return {
        ...ruleResult,
        method: "rule",
        latencyMs: elapsed
      }
    }

    // Step 4: LLM Fallback（500ms程度かかる）
    // この間、発話開始はfallback用のキャッシュ音声で対応
    const llmResult = await this.llmFallback.classify(text, context)
    return {
      ...llmResult,
      method: "llm",
      latencyMs: performance.now() - startTime
    }
  }
}
```

---

# 5. 返答バンクシステム

## 5.1 設計思想

毎回LLMでテキスト生成するのではなく、**数千の返答テンプレートをメモリ上に保持**し、意図分類結果から O(1) でルックアップする。テンプレートには変数スロットがあり、文脈に応じて動的に埋め込む。

## 5.2 返答バンクの構造

```ts
type ResponseEntry = {
  id: string                      // ユニークID
  intent: IntentCategory          // 対応する意図
  domain: "universal" | string    // "universal" or ドメイン名
  category: ResponseCategory      // 返答カテゴリ
  stage: "onset" | "body" | "followup"  // 発話段階

  // テキスト
  text: string                    // 返答テキスト（変数スロット含む）
  textVariants: string[]          // バリエーション（ランダム選択用）

  // TTS キャッシュ
  cachedAudioId?: string          // キャッシュ済み WAV の ID（あれば）
  requiresSynthesis: boolean      // リアルタイム合成が必要か

  // メタデータ
  emotion: EmotionTag             // 感情タグ
  energy: "low" | "mid" | "high"  // テンション
  formality: "casual" | "normal" | "formal"
  topicTags: string[]             // 関連トピックタグ

  // スコアリング
  usageCount: number              // 使用回数（繰り返し防止）
  lastUsedAt?: number             // 最終使用時刻
  cooldownMs: number              // 再使用までの待機時間
}

type ResponseCategory =
  | "aizuchi"         // 相槌: 「うん」「なるほど」
  | "empathy"         // 共感: 「それは大変だね」
  | "surprise"        // 驚き: 「えっ、マジで」
  | "confirmation"    // 確認: 「それってつまり〇〇ってこと？」
  | "deepening"       // 深掘り: 「そこもう少し聞きたい」
  | "opinion"         // 意見: 「個人的には〇〇だと思う」
  | "information"     // 情報: 「それについては〇〇だよ」
  | "topic_bridge"    // 橋渡し: 「それに近い話で…」
  | "fallback"        // 汎用: 「面白いね、もっと聞かせて」
  | "filler"          // つなぎ: 「ちょっと考えるね」
```

## 5.3 返答バンクのインデックス構造

```ts
class ResponseBank {
  // プライマリインデックス: 意図 → 返答リスト
  private byIntent: Map<IntentCategory, ResponseEntry[]>

  // セカンダリインデックス: 意図+カテゴリ → 返答リスト
  private byIntentCategory: Map<string, ResponseEntry[]>

  // ステージ別インデックス: ステージ+意図 → 返答リスト
  private byStageIntent: Map<string, ResponseEntry[]>

  // ドメイン別インデックス
  private byDomain: Map<string, ResponseEntry[]>

  // キャッシュ済み発話開始音声の直接参照
  private onsetCache: Map<string, ResponseEntry>

  // 全エントリ（ID引き）
  private byId: Map<string, ResponseEntry>

  constructor(entries: ResponseEntry[]) {
    this.byIntent = new Map()
    this.byIntentCategory = new Map()
    this.byStageIntent = new Map()
    this.byDomain = new Map()
    this.onsetCache = new Map()
    this.byId = new Map()

    for (const entry of entries) {
      // プライマリインデックス構築
      appendToMapList(this.byIntent, entry.intent, entry)

      // セカンダリインデックス構築
      const icKey = `${entry.intent}:${entry.category}`
      appendToMapList(this.byIntentCategory, icKey, entry)

      // ステージ別インデックス
      const siKey = `${entry.stage}:${entry.intent}`
      appendToMapList(this.byStageIntent, siKey, entry)

      // ドメイン別
      appendToMapList(this.byDomain, entry.domain, entry)

      // ID引き
      this.byId.set(entry.id, entry)

      // onset キャッシュ直接参照
      if (entry.stage === "onset" && entry.cachedAudioId) {
        this.onsetCache.set(entry.cachedAudioId, entry)
      }
    }
  }

  /**
   * 最速パス: 意図から発話開始用エントリを取得（< 1ms）
   */
  getOnsetResponse(intent: IntentCategory, emotion?: EmotionTag): ResponseEntry {
    const key = `onset:${intent}`
    const candidates = this.byStageIntent.get(key) || []

    // クールダウン中のエントリを除外
    const available = candidates.filter(e =>
      !e.lastUsedAt || (Date.now() - e.lastUsedAt) > e.cooldownMs
    )

    // 感情マッチ優先 → ランダム選択
    if (emotion) {
      const emotionMatch = available.filter(e => e.emotion === emotion)
      if (emotionMatch.length > 0) {
        return this.selectAndMark(emotionMatch)
      }
    }

    return this.selectAndMark(available.length > 0 ? available : candidates)
  }

  /**
   * 本回答テンプレート取得
   */
  getBodyResponse(
    intent: IntentCategory,
    category: ResponseCategory,
    domain?: string
  ): ResponseEntry[] {
    const key = `${intent}:${category}`
    let candidates = this.byIntentCategory.get(key) || []

    // ドメインフィルタ
    if (domain) {
      const domainSpecific = candidates.filter(e => e.domain === domain)
      if (domainSpecific.length > 0) {
        candidates = domainSpecific
      }
    }

    return candidates
  }

  private selectAndMark(entries: ResponseEntry[]): ResponseEntry {
    // 使用頻度が低いものを優先（多様性確保）
    entries.sort((a, b) => a.usageCount - b.usageCount)
    const selected = entries[0]
    selected.usageCount++
    selected.lastUsedAt = Date.now()
    return selected
  }
}
```

## 5.4 テンプレート変数システム

```ts
type TemplateSlot = {
  name: string              // スロット名
  source: "hook" | "memory" | "context" | "literal"
  fallback: string          // フォールバック値
}

// テンプレート例
// text: "{{topic}}について、{{opinion}}と思うんだよね"
// text: "{{empathy_phrase}}、でも{{suggestion}}"

class TemplateResolver {
  resolve(template: string, context: TemplateContext): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, slotName) => {
      return context[slotName] || this.getFallback(slotName)
    })
  }
}
```

## 5.5 返答バンクの初期データ規模

| カテゴリ | Stage: onset | Stage: body | Stage: followup | 合計 |
|---|---|---|---|---|
| universal（汎用） | 200 | 800 | 300 | 1,300 |
| tech（技術系） | 50 | 400 | 150 | 600 |
| emotion（感情系） | 100 | 300 | 100 | 500 |
| daily（日常） | 80 | 400 | 120 | 600 |
| **合計** | **430** | **1,900** | **670** | **3,000** |

---

# 6. 応答合成パイプライン

## 6.1 3ステージ応答モデル

```
Stage 1: Onset（発話開始）
  - ソース: WAVキャッシュ（メモリ上バイナリ）
  - 所要時間: < 50ms（バッファ参照 + 再生開始）
  - 例: 「なるほど」「うん」「えー」「それ面白い」

Stage 2: Body（本回答）
  - ソース A: テンプレート組立 + VOICEVOX リアルタイム合成
  - ソース B: LLM 生成テキスト + VOICEVOX リアルタイム合成
  - 所要時間: 200-800ms（テンプレート）/ 800-2000ms（LLM）
  - 例: 「低遅延化では返答を二段階に分けるのが効くよ」

Stage 3: Followup（フォロー質問）
  - ソース: テンプレート or LLM
  - 所要時間: Body生成と並行して準備
  - 例: 「ちなみにそれって音声前提？テキスト前提？」
```

## 6.2 応答合成の擬似コード

```ts
class ResponseComposer {
  private bank: ResponseBank
  private templateResolver: TemplateResolver
  private ttsHybrid: TtsHybridEngine
  private speechQueue: SpeechQueue
  private mainLlm: MainLLMClient

  async compose(
    intentResult: IntentResult,
    text: string,
    context: ConversationContext
  ): Promise<void> {

    // ===== Stage 1: Onset（最優先、即時実行）=====
    const onsetEntry = this.bank.getOnsetResponse(
      intentResult.intent,
      intentResult.emotion
    )

    // キャッシュ済みWAVから即時再生（< 50ms）
    if (onsetEntry.cachedAudioId) {
      await this.speechQueue.playImmediate(onsetEntry.cachedAudioId)
    } else {
      // キャッシュがない場合はテキストからリアルタイム合成
      await this.ttsHybrid.synthesizeAndPlay(onsetEntry.text, { priority: "immediate" })
    }

    // ===== Stage 2: Body（Onset再生中に並行生成）=====
    const bodyStrategy = this.selectBodyStrategy(intentResult, context)

    let bodyText: string

    if (bodyStrategy === "template") {
      // テンプレートベース: 20-50ms
      const bodyEntry = this.bank.getBodyResponse(
        intentResult.intent,
        this.selectCategory(intentResult, context),
        context.activeDomain
      )[0]

      bodyText = this.templateResolver.resolve(bodyEntry.text, {
        topic: context.currentTopic,
        hook: context.activeHooks[0]?.surface,
        ...context.templateVars
      })

    } else {
      // LLM ベース: 800-2000ms（ストリーミング）
      bodyText = await this.mainLlm.generate({
        userText: text,
        intent: intentResult,
        context,
        maxTokens: 100
      })
    }

    // 本回答をVOICEVOXで合成して発話キューに追加
    await this.ttsHybrid.synthesizeAndEnqueue(bodyText)

    // ===== Stage 3: Followup（Body合成中に並行準備）=====
    const followupEntry = this.bank.getBodyResponse(
      intentResult.intent,
      "deepening",
      context.activeDomain
    )[0]

    if (followupEntry) {
      const followupText = this.templateResolver.resolve(followupEntry.text, context.templateVars)
      await this.ttsHybrid.synthesizeAndEnqueue(followupText)
    }
  }

  private selectBodyStrategy(
    intent: IntentResult,
    context: ConversationContext
  ): "template" | "llm" {
    // テンプレートで対応可能な場合はテンプレート優先
    if (intent.method === "rule" && intent.confidence > 0.8) {
      return "template"
    }
    // 深い質問、複雑な話題、初出トピックはLLM
    if (
      intent.intent === "question_factual" ||
      intent.intent === "request_explanation" ||
      context.topicNovelty > 0.7
    ) {
      return "llm"
    }
    return "template"
  }
}
```

---

# 7. TTSハイブリッドエンジン（キャッシュ＋リアルタイム）

## 7.1 設計思想

TTSを2層に分ける:

- **キャッシュ層**: 事前生成したWAVバイナリをFloat32Array（PCMデータ）としてメモリ常駐。参照渡しで即時再生。
- **合成層**: VOICEVOX Core常駐プロセスによるリアルタイム合成。新規テキストのみ。

## 7.2 音声キャッシュの構造

```ts
type AudioCacheEntry = {
  id: string                  // キャッシュID
  text: string                // 元テキスト
  speakerId: number           // VOICEVOX speaker ID
  sampleRate: number          // サンプルレート（通常24000）
  pcmBuffer: Float32Array     // デコード済みPCMデータ（メモリ常駐）
  durationMs: number          // 音声長（ミリ秒）
  metadata: {
    speed: number
    pitch: number
    volume: number
  }
}

class AudioCache {
  private cache: Map<string, AudioCacheEntry>
  private totalMemoryBytes: number = 0
  private readonly MAX_MEMORY_BYTES = 200 * 1024 * 1024 // 200MB上限

  constructor() {
    this.cache = new Map()
  }

  /**
   * 起動時にキャッシュファイルからメモリに一括ロード
   */
  async loadFromDisk(cacheDir: string): Promise<void> {
    const manifest = await readJSON(`${cacheDir}/manifest.json`)

    for (const entry of manifest.entries) {
      const wavBuffer = await readFile(`${cacheDir}/${entry.id}.wav`)
      const pcmData = decodeWavToPCM(wavBuffer)

      this.cache.set(entry.id, {
        ...entry,
        pcmBuffer: pcmData
      })

      this.totalMemoryBytes += pcmData.byteLength
    }
  }

  /**
   * メモリ上のPCMバッファを直接取得（< 1ms）
   */
  get(id: string): Float32Array | null {
    const entry = this.cache.get(id)
    return entry?.pcmBuffer || null
  }

  /**
   * リアルタイム合成結果をキャッシュに追加
   */
  addFromSynthesis(id: string, text: string, wavBuffer: Buffer, speakerId: number): void {
    const pcmData = decodeWavToPCM(wavBuffer)

    if (this.totalMemoryBytes + pcmData.byteLength > this.MAX_MEMORY_BYTES) {
      this.evictLeastUsed()
    }

    this.cache.set(id, {
      id,
      text,
      speakerId,
      sampleRate: 24000,
      pcmBuffer: pcmData,
      durationMs: (pcmData.length / 24000) * 1000,
      metadata: { speed: 1.0, pitch: 0, volume: 1.0 }
    })

    this.totalMemoryBytes += pcmData.byteLength
  }
}
```

## 7.3 キャッシュ事前生成（ビルドステップ）

アプリビルド時またはFirstRun時に、返答バンクの onset エントリすべてを VOICEVOX で合成してキャッシュファイルを生成する。

```ts
async function prebuildAudioCache(
  bank: ResponseBank,
  voicevox: VoicevoxClient,
  outputDir: string
): Promise<void> {
  const onsetEntries = bank.getAllByStage("onset")
  const manifest: CacheManifest = { entries: [] }

  for (const entry of onsetEntries) {
    // 全バリエーションを合成
    const texts = [entry.text, ...entry.textVariants]

    for (let i = 0; i < texts.length; i++) {
      const id = `${entry.id}_v${i}`
      const wavBuffer = await voicevox.synthesize(texts[i], entry.speakerId || 1)

      await writeFile(`${outputDir}/${id}.wav`, wavBuffer)

      manifest.entries.push({
        id,
        text: texts[i],
        speakerId: entry.speakerId || 1,
        responseEntryId: entry.id
      })

      entry.cachedAudioId = id
    }
  }

  await writeJSON(`${outputDir}/manifest.json`, manifest)
}
```

## 7.4 TTS ハイブリッドエンジン本体

```ts
class TtsHybridEngine {
  private audioCache: AudioCache
  private voicevoxWorker: VoicevoxWorkerBridge
  private audioPlayer: WebAudioPlayer

  /**
   * キャッシュ済み音声の即時再生（< 30ms）
   */
  async playFromCache(cacheId: string): Promise<void> {
    const pcmBuffer = this.audioCache.get(cacheId)
    if (!pcmBuffer) throw new Error(`Cache miss: ${cacheId}`)

    await this.audioPlayer.playPCM(pcmBuffer, 24000)
  }

  /**
   * テキストからリアルタイム合成して再生
   */
  async synthesizeAndPlay(text: string, options: SynthOptions): Promise<void> {
    // テキスト前処理
    const cleaned = this.preprocess(text)

    if (options.priority === "immediate") {
      // 短文は1回で合成
      const wavBuffer = await this.voicevoxWorker.synthesize(cleaned)
      const pcmData = decodeWavToPCM(wavBuffer)
      await this.audioPlayer.playPCM(pcmData, 24000)
    } else {
      // 長文は文単位分割して逐次再生
      const sentences = splitBySentence(cleaned)
      for (const sentence of sentences) {
        const wavBuffer = await this.voicevoxWorker.synthesize(sentence)
        const pcmData = decodeWavToPCM(wavBuffer)
        await this.audioPlayer.enqueuePCM(pcmData, 24000)
      }
    }
  }

  /**
   * テキスト合成してキューに追加（Stage 2用）
   */
  async synthesizeAndEnqueue(text: string): Promise<void> {
    const sentences = splitBySentence(this.preprocess(text))

    for (const sentence of sentences) {
      // 既存キャッシュチェック
      const cacheKey = this.computeCacheKey(sentence)
      const cached = this.audioCache.get(cacheKey)

      if (cached) {
        await this.audioPlayer.enqueuePCM(cached, 24000)
      } else {
        const wavBuffer = await this.voicevoxWorker.synthesize(sentence)
        const pcmData = decodeWavToPCM(wavBuffer)

        // 合成結果をキャッシュに追加
        this.audioCache.addFromSynthesis(cacheKey, sentence, wavBuffer, 1)

        await this.audioPlayer.enqueuePCM(pcmData, 24000)
      }
    }
  }

  private preprocess(text: string): string {
    return text
      .replace(/https?:\/\/\S+/g, "")  // URL除去
      .replace(/\s+/g, "")              // 空白除去
      .replace(/[#*_~`]/g, "")          // Markdown記号除去
      .trim()
  }
}
```

## 7.5 Web Audio API プレイヤー

```ts
class WebAudioPlayer {
  private ctx: AudioContext
  private gainNode: GainNode
  private queue: AudioQueueItem[] = []
  private isPlaying = false
  private currentSource: AudioBufferSourceNode | null = null

  constructor() {
    this.ctx = new AudioContext({ sampleRate: 24000 })
    this.gainNode = this.ctx.createGain()
    this.gainNode.connect(this.ctx.destination)
  }

  /**
   * PCMデータを即時再生（Stage 1 onset 用）
   */
  async playPCM(pcmData: Float32Array, sampleRate: number): Promise<void> {
    // 再生中の音声があれば停止
    this.stopCurrent()

    const audioBuffer = this.ctx.createBuffer(1, pcmData.length, sampleRate)
    audioBuffer.getChannelData(0).set(pcmData)

    const source = this.ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.gainNode)

    this.currentSource = source
    source.start(0) // 即時開始

    return new Promise(resolve => {
      source.onended = () => {
        this.currentSource = null
        resolve()
        this.playNext() // キューの次を再生
      }
    })
  }

  /**
   * PCMデータをキューに追加（Stage 2 body 用）
   */
  async enqueuePCM(pcmData: Float32Array, sampleRate: number): Promise<void> {
    this.queue.push({ pcmData, sampleRate })

    if (!this.isPlaying && !this.currentSource) {
      await this.playNext()
    }
  }

  /**
   * 割り込み停止（ユーザーが話し始めた場合）
   */
  stopCurrent(): void {
    if (this.currentSource) {
      this.currentSource.stop()
      this.currentSource = null
    }
    this.queue = []
    this.isPlaying = false
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const item = this.queue.shift()!
    await this.playPCM(item.pcmData, item.sampleRate)
  }
}
```

---

# 8. 会話オーケストレーター

## 8.1 責務

オーケストレーターは全コンポーネントを統括する中央制御装置。

- STTテキスト受信時の処理フロー制御
- 意図エンジン・返答バンク・TTS の協調
- 会話状態の管理
- 割り込み（バージイン）制御
- 先読み結果の照合
- メモリシステムとの連携

## 8.2 会話状態モデル

```ts
type ConversationMode =
  | "idle"           // 待機中
  | "listening"      // ユーザー発話受信中
  | "classifying"    // 意図分類中
  | "onset_playing"  // Stage 1 再生中
  | "body_composing" // Stage 2 生成中
  | "body_playing"   // Stage 2 再生中
  | "interrupted"    // ユーザーにより割り込まれた
  | "fallback"       // LLM fallback処理中

type ConversationState = {
  mode: ConversationMode
  turnCount: number
  currentTurnId: string

  // 現在のターン情報
  currentTranscript: string
  currentIntent: IntentResult | null
  onsetPlayed: boolean
  bodyGenerated: boolean

  // 会話コンテキスト
  currentTopic: string | null
  topicHistory: string[]
  activeHooks: Hook[]
  emotionTrend: EmotionTag[]

  // 先読み
  speculativeResults: SpeculativeResult[]

  // タイミング
  turnStartTime: number
  onsetStartTime: number | null
  bodyStartTime: number | null
}
```

## 8.3 オーケストレーターの実装

```ts
class ConversationOrchestrator {
  private state: ConversationState
  private intentEngine: HybridIntentEngine
  private responseComposer: ResponseComposer
  private ttsHybrid: TtsHybridEngine
  private speculationEngine: SpeculationEngine
  private memorySystem: MemorySystem
  private hookExtractor: HookExtractor
  private interruptController: InterruptController

  /**
   * Groq STT から部分テキストを受信した場合
   */
  async onPartialTranscript(text: string): Promise<void> {
    this.state.currentTranscript = text
    this.state.mode = "listening"

    // 部分テキストから投機的に先読み
    await this.speculationEngine.updatePrediction(text, this.state)
  }

  /**
   * Groq STT から最終テキストを受信した場合
   * ここが 100ms 以内に発話開始するための起点
   */
  async onFinalTranscript(text: string): Promise<void> {
    const t0 = performance.now()
    this.state.currentTranscript = text
    this.state.mode = "classifying"

    // ===== Phase 1: 意図分類（< 10ms）=====
    // まず投機実行結果を照合
    const specMatch = this.speculationEngine.matchFinal(text)

    let intentResult: IntentResult
    if (specMatch && specMatch.confidence > 0.8) {
      // 投機実行がヒット → 即時利用（0ms）
      intentResult = specMatch.intentResult
    } else {
      // ルールベース分類（< 10ms）
      intentResult = await this.intentEngine.classify(text, this.getContext())
    }

    this.state.currentIntent = intentResult

    // ===== Phase 2: 発話開始（< 50ms）=====
    this.state.mode = "onset_playing"
    this.state.onsetStartTime = performance.now()

    // 発話開始音声を即時再生（キャッシュ済みバイナリ）
    const onsetPromise = this.responseComposer.playOnset(intentResult)

    // ===== Phase 3: 裏で本回答生成（onset再生中に並行）=====
    this.state.mode = "body_composing"

    // フック抽出
    const hooks = this.hookExtractor.extract(text)
    this.state.activeHooks = hooks

    // メモリ更新
    this.memorySystem.updateShortTerm({
      transcript: text,
      intent: intentResult,
      hooks
    })

    // 本回答生成 + TTS合成 + キュー追加
    const bodyPromise = this.responseComposer.composeBody(
      intentResult,
      text,
      this.getContext()
    )

    // onset再生完了を待つ
    await onsetPromise
    this.state.onsetPlayed = true

    // 本回答の発話
    this.state.mode = "body_playing"
    await bodyPromise
    this.state.bodyGenerated = true

    // ===== Phase 4: 次ターン準備 =====
    this.state.mode = "idle"
    this.state.turnCount++

    // 次ターンの投機実行を開始
    await this.speculationEngine.prepareNextTurn(this.state)

    const totalMs = performance.now() - t0
    console.log(`Turn ${this.state.turnCount}: onset at ${this.state.onsetStartTime! - t0}ms, total ${totalMs}ms`)
  }

  /**
   * ユーザーがAI発話中に話し始めた場合（バージイン）
   */
  async onBargeIn(): Promise<void> {
    this.state.mode = "interrupted"
    this.ttsHybrid.stopAll()
    this.state.mode = "listening"
  }

  private getContext(): ConversationContext {
    return {
      currentTopic: this.state.currentTopic,
      topicHistory: this.state.topicHistory,
      activeHooks: this.state.activeHooks,
      emotionTrend: this.state.emotionTrend,
      turnCount: this.state.turnCount,
      recentTurns: this.memorySystem.getRecentTurns(5),
      activeDomain: this.detectDomain(),
      topicNovelty: this.computeTopicNovelty(),
      templateVars: this.buildTemplateVars()
    }
  }
}
```

---

# 9. メモリアーキテクチャ

## 9.1 4層メモリ構造

```
┌────────────────────────────────────────┐
│ Layer 1: Short-Term Memory             │
│ 直近5-10ターンの生データ                 │
│ TTL: セッション中                       │
├────────────────────────────────────────┤
│ Layer 2: Working Memory                │
│ 現在の推論状態、候補、計画               │
│ TTL: 現在のターン〜数ターン              │
├────────────────────────────────────────┤
│ Layer 3: Episodic Memory               │
│ 過去の会話エピソード要約                 │
│ TTL: 永続（ディスク保存）               │
├────────────────────────────────────────┤
│ Layer 4: Long-Term Memory              │
│ ユーザーの好み・性格・繰り返しトピック    │
│ TTL: 永続（ディスク保存）               │
└────────────────────────────────────────┘
```

## 9.2 型定義

```ts
type ShortTermMemory = {
  recentTurns: TurnRecord[]       // 直近ターンの全データ
  currentTopic: string | null
  activeHooks: Hook[]
  emotionTrend: EmotionTag[]
  speakingRate: number            // ユーザーの発話速度
}

type WorkingMemory = {
  intentCandidates: IntentResult[]
  responseCandidates: ResponseEntry[]
  conversationPlan: ConversationPlan
  speculativeCache: SpeculativeResult[]
  topicBridgeCandidates: string[]
}

type EpisodicMemory = {
  episodes: Episode[]
}

type Episode = {
  id: string
  timestamp: number
  topic: string
  summary: string
  keyHooks: string[]
  turningPoints: string[]
  emotionalArc: EmotionTag[]
  outcome: string | null
  turnCount: number
}

type LongTermMemory = {
  userProfile: {
    preferredTopics: string[]
    avoidTopics: string[]
    communicationStyle: "casual" | "formal" | "mixed"
    typicalEmotions: EmotionTag[]
    knownFacts: Record<string, string>
  }
  recurringPatterns: {
    commonIntents: IntentCategory[]
    frequentHooks: string[]
    conversationPatterns: string[]
  }
}
```

## 9.3 メモリシステム統合

```ts
class MemorySystem {
  private shortTerm: ShortTermMemory
  private working: WorkingMemory
  private episodic: EpisodicMemoryStore    // ディスク永続化
  private longTerm: LongTermMemoryStore    // ディスク永続化

  updateShortTerm(turnData: TurnUpdateData): void {
    this.shortTerm.recentTurns.push({
      id: generateTurnId(),
      timestamp: Date.now(),
      transcript: turnData.transcript,
      intent: turnData.intent,
      hooks: turnData.hooks,
      response: null  // 後で埋める
    })

    // 10ターン以上は古いものを削除
    if (this.shortTerm.recentTurns.length > 10) {
      this.shortTerm.recentTurns.shift()
    }

    // 感情トレンド更新
    if (turnData.intent.emotion) {
      this.shortTerm.emotionTrend.push(turnData.intent.emotion)
      if (this.shortTerm.emotionTrend.length > 5) {
        this.shortTerm.emotionTrend.shift()
      }
    }
  }

  /**
   * メモリからコンテキストを構築（意図分類・応答生成向け）
   */
  buildContext(): MemoryContext {
    return {
      recentTurns: this.shortTerm.recentTurns,
      currentTopic: this.shortTerm.currentTopic,
      activeHooks: this.shortTerm.activeHooks,
      emotionTrend: this.shortTerm.emotionTrend,
      relatedEpisodes: this.episodic.findRelated(this.shortTerm.currentTopic),
      userPreferences: this.longTerm.getUserProfile()
    }
  }
}
```

---

# 10. フック駆動会話戦略

## 10.1 フックとは

フックとは、ユーザー発話中の**会話を広げられるポイント**。感情を含む発言、具体的なエンティティ、因果関係、トピックの転換点など。

## 10.2 フック抽出

```ts
class HookExtractor {
  private ahoCorasick: AhoCorasickIntentMatcher  // パターンマッチ共用
  private topicKeywords: Set<string>

  extract(text: string): Hook[] {
    const hooks: Hook[] = []

    // 1. 感情キーワード検出
    const emotionHits = this.detectEmotionKeywords(text)
    for (const hit of emotionHits) {
      hooks.push({
        id: generateId(),
        surface: hit.phrase,
        topic: hit.topic,
        emotionScore: hit.intensity,
        noveltyScore: 0.5,
        depthScore: 0.5,
        askabilityScore: 0.8,
        type: "emotion"
      })
    }

    // 2. 具体的エンティティ検出（固有名詞、数値、日付など）
    const entities = this.extractEntities(text)
    for (const entity of entities) {
      hooks.push({
        id: generateId(),
        surface: entity.text,
        topic: entity.category,
        emotionScore: 0.2,
        noveltyScore: 0.7,
        depthScore: 0.6,
        askabilityScore: 0.9,
        type: "entity"
      })
    }

    // 3. 因果関係マーカー検出
    const causalMarkers = ["から", "ので", "せいで", "おかげで", "のに", "けど"]
    for (const marker of causalMarkers) {
      const idx = text.indexOf(marker)
      if (idx >= 0) {
        hooks.push({
          id: generateId(),
          surface: text.substring(Math.max(0, idx - 10), idx + marker.length + 10),
          topic: "causal",
          emotionScore: 0.4,
          noveltyScore: 0.6,
          depthScore: 0.8,
          askabilityScore: 0.9,
          type: "causal"
        })
      }
    }

    // スコア計算してソート
    return hooks
      .map(h => ({
        ...h,
        totalScore: this.computeHookScore(h)
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5)  // 上位5つ
  }

  private computeHookScore(hook: Hook): number {
    return (
      hook.emotionScore * 0.25 +
      hook.depthScore * 0.20 +
      hook.askabilityScore * 0.20 +
      hook.noveltyScore * 0.15 +
      0.10 +  // continuity（前ターンとの関連度、後で計算）
      0.10    // specificity
    )
  }
}
```

---

# 11. 先読み・投機実行エンジン

## 11.1 設計思想

ユーザーがまだ話している間に、**次に来そうな発話の意図を予測し、対応する返答を事前に準備**する。STTの部分テキストが来るたびに予測を更新する。

## 11.2 投機実行の流れ

```
[部分テキスト受信]
    ↓
[現在の話題 + 部分テキスト + 会話履歴]
    ↓
[意図候補を3-5本生成]
    ↓
[各候補に対する onset + body テンプレートを事前選択]
    ↓
[最終テキスト受信時に照合]
    ↓
[ヒットした候補を即時利用 → 0ms で意図分類完了]
```

## 11.3 実装

```ts
class SpeculationEngine {
  private predictions: SpeculativeResult[] = []
  private bank: ResponseBank

  /**
   * 部分テキスト受信時に予測を更新
   */
  async updatePrediction(
    partialText: string,
    state: ConversationState
  ): Promise<void> {
    // 短すぎるテキストは無視
    if (partialText.length < 3) return

    // 投機的意図分類（ルールベースのみ、LLMは使わない）
    const intentGuesses = this.quickIntentGuess(partialText, state)

    this.predictions = intentGuesses.map(guess => ({
      predictedIntent: guess.intent,
      confidence: guess.confidence,
      partialTextAtPrediction: partialText,
      onsetEntry: this.bank.getOnsetResponse(guess.intent),
      bodyTemplate: this.bank.getBodyResponse(guess.intent, "empathy")[0],
      preparedAt: Date.now()
    }))
  }

  /**
   * 最終テキスト受信時に投機結果を照合
   */
  matchFinal(finalText: string): SpeculativeResult | null {
    if (this.predictions.length === 0) return null

    // 部分テキストと最終テキストの先頭一致率で判定
    for (const pred of this.predictions) {
      if (finalText.startsWith(pred.partialTextAtPrediction)) {
        if (pred.confidence > 0.6) {
          return pred
        }
      }
    }

    return null
  }

  /**
   * ターン終了後、次ターンの投機準備
   */
  async prepareNextTurn(state: ConversationState): Promise<void> {
    // 現在のトピック・フックから次のユーザー行動を予測
    const likelyIntents: IntentCategory[] = this.predictNextIntents(state)

    // 各意図に対する onset を事前ロード（キャッシュ確認のみ）
    for (const intent of likelyIntents) {
      const onset = this.bank.getOnsetResponse(intent)
      if (onset.cachedAudioId) {
        // キャッシュがあれば何もしない（既にメモリ上）
      }
    }

    this.predictions = likelyIntents.map(intent => ({
      predictedIntent: intent,
      confidence: 0.3,  // 事前予測なので低め
      partialTextAtPrediction: "",
      onsetEntry: this.bank.getOnsetResponse(intent),
      bodyTemplate: null,
      preparedAt: Date.now()
    }))
  }

  private predictNextIntents(state: ConversationState): IntentCategory[] {
    const intents: IntentCategory[] = []

    // AIが質問で終わった → 回答が来る可能性
    if (state.currentIntent?.intent.includes("question")) {
      intents.push("topic_continue")
    }

    // ネガティブ感情トレンド → 愚痴継続 or 話題転換
    const lastEmotion = state.emotionTrend[state.emotionTrend.length - 1]
    if (lastEmotion === "negative") {
      intents.push("express_complaint", "topic_shift")
    }

    // デフォルト候補
    intents.push("topic_continue", "acknowledgment", "question_factual")

    return [...new Set(intents)].slice(0, 5)
  }
}
```

---

# 12. Electron プロセスアーキテクチャ

## 12.1 プロセス配置

```
┌─────────────────────────────────────────────────────┐
│ Renderer Process                                     │
│  - Chat UI / Avatar UI                               │
│  - Audio Visualizer                                  │
│  - Web Audio API Player（AudioContext）               │
│  - マイク入力キャプチャ                                │
│                                                       │
│  ※ 重い処理は一切行わない                              │
│  ※ IPC経由でMain Processとのみ通信                    │
└───────────────────┬─────────────────────────────────┘
                    │ IPC (ipcMain / ipcRenderer)
┌───────────────────┴─────────────────────────────────┐
│ Main Process                                         │
│  - Conversation Orchestrator                         │
│  - Intent Engine (Aho-Corasick + Syntax Rules)       │
│  - Response Bank (メモリ常駐)                         │
│  - Response Composer                                 │
│  - Audio Cache Manager                               │
│  - Memory System                                     │
│  - Speculation Engine                                │
│  - Hook Extractor                                    │
│  - IPC Router                                        │
│                                                       │
│  ※ 高速処理はここで完結（< 10ms）                     │
│  ※ Worker管理もここ                                   │
└──┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │
   │ fork()   │ fork()   │ fork()   │ (child_process)
   ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌──────────┐ ┌──────────────┐
│ TTS  │ │ LLM  │ │ ASR/VAD  │ │ Hook/Memory  │
│Worker│ │Worker│ │ Worker   │ │ Worker       │
│      │ │      │ │          │ │              │
│VOICEVOX│Ollama│ │Groq API  │ │LLM-based     │
│Core  │ │ /    │ │接続 +    │ │hook抽出      │
│常駐  │ │llama │ │VAD       │ │(fallback)    │
│      │ │.cpp  │ │          │ │              │
└──────┘ └──────┘ └──────────┘ └──────────────┘
```

## 12.2 IPC メッセージ型定義

```ts
// Main ↔ Renderer
type IPCMessage =
  | { type: "mic:start" }
  | { type: "mic:stop" }
  | { type: "mic:data"; data: Float32Array }
  | { type: "stt:partial"; text: string }
  | { type: "stt:final"; text: string }
  | { type: "tts:play_cache"; cacheId: string; pcmData: Float32Array }
  | { type: "tts:play_synthesized"; pcmData: Float32Array }
  | { type: "tts:stop" }
  | { type: "state:update"; state: Partial<ConversationState> }
  | { type: "ui:show_text"; text: string; role: "user" | "assistant" }

// Main ↔ TTS Worker
type TTSWorkerMessage =
  | { type: "init"; config: VoicevoxConfig }
  | { type: "synthesize"; id: string; text: string; speakerId: number }
  | { type: "synthesize_result"; id: string; wavBuffer: Buffer }
  | { type: "error"; id: string; error: string }

// Main ↔ LLM Worker
type LLMWorkerMessage =
  | { type: "generate"; id: string; prompt: string; options: LLMOptions }
  | { type: "generate_result"; id: string; text: string }
  | { type: "classify"; id: string; text: string; context: string }
  | { type: "classify_result"; id: string; intent: IntentCategory }
```

## 12.3 Worker起動・管理

```ts
class WorkerManager {
  private ttsWorker: ChildProcess | null = null
  private llmWorker: ChildProcess | null = null
  private pendingRequests: Map<string, PendingRequest> = new Map()

  async startAll(): Promise<void> {
    // TTS Worker: VOICEVOX Core常駐
    this.ttsWorker = fork(path.join(__dirname, "../workers/tts-worker.js"))
    this.ttsWorker.on("message", this.handleTTSMessage.bind(this))

    await this.sendToTTS({
      type: "init",
      config: {
        openJtalkDictDir: "./open_jtalk_dic",
        speakerIds: [1, 3],  // ずんだもん, 四国めたん
        cpuNumThreads: 8,
        accelerationMode: "CPU"  // GPUは後から追加
      }
    })

    // LLM Worker: Ollama
    this.llmWorker = fork(path.join(__dirname, "../workers/llm-worker.js"))
    this.llmWorker.on("message", this.handleLLMMessage.bind(this))
  }

  async synthesize(text: string, speakerId: number = 1): Promise<Buffer> {
    const id = generateId()
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, timeout: setTimeout(() => reject(new Error("TTS timeout")), 5000) })
      this.ttsWorker!.send({ type: "synthesize", id, text, speakerId })
    })
  }
}
```

---

# 13. ディレクトリ構成

```
sentinel/
├── src/
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── AvatarPanel.tsx
│   │   │   └── AudioMeter.tsx
│   │   ├── audio/
│   │   │   └── WebAudioPlayer.ts
│   │   └── ipc/
│   │       └── rendererIpc.ts
│   │
│   ├── main/
│   │   ├── index.ts                          // Electron main entry
│   │   ├── ipc/
│   │   │   └── ipcRouter.ts
│   │   │
│   │   ├── orchestrator/
│   │   │   ├── ConversationOrchestrator.ts   // 中央制御
│   │   │   ├── TurnManager.ts               // ターン状態管理
│   │   │   └── InterruptController.ts       // バージイン制御
│   │   │
│   │   ├── intent/
│   │   │   ├── HybridIntentEngine.ts        // ハイブリッド意図エンジン
│   │   │   ├── AhoCorasickMatcher.ts        // パターンマッチ
│   │   │   ├── SyntaxRuleEngine.ts          // 構文ルール
│   │   │   ├── LLMFallbackClassifier.ts     // LLM fallback
│   │   │   └── patterns/
│   │   │       ├── greeting.ts
│   │   │       ├── question.ts
│   │   │       ├── emotion.ts
│   │   │       ├── topic.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── bank/
│   │   │   ├── ResponseBank.ts              // 返答バンク本体
│   │   │   ├── TemplateResolver.ts          // テンプレート変数解決
│   │   │   └── data/
│   │   │       ├── universal.ts             // 汎用返答データ
│   │   │       ├── tech.ts                  // 技術系ドメイン
│   │   │       ├── emotion.ts              // 感情系ドメイン
│   │   │       └── daily.ts               // 日常ドメイン
│   │   │
│   │   ├── composer/
│   │   │   └── ResponseComposer.ts          // 3ステージ応答合成
│   │   │
│   │   ├── tts/
│   │   │   ├── TtsHybridEngine.ts           // ハイブリッドTTS
│   │   │   ├── AudioCache.ts                // WAVキャッシュ管理
│   │   │   ├── VoicevoxWorkerBridge.ts      // Worker通信
│   │   │   └── SpeechQueue.ts              // 発話キュー
│   │   │
│   │   ├── speculation/
│   │   │   └── SpeculationEngine.ts         // 投機実行
│   │   │
│   │   ├── hooks/
│   │   │   └── HookExtractor.ts             // フック抽出
│   │   │
│   │   ├── memory/
│   │   │   ├── MemorySystem.ts              // メモリ統合管理
│   │   │   ├── ShortTermMemory.ts
│   │   │   ├── WorkingMemory.ts
│   │   │   ├── EpisodicMemoryStore.ts
│   │   │   └── LongTermMemoryStore.ts
│   │   │
│   │   ├── asr/
│   │   │   ├── GroqSTTBridge.ts             // Groq API通信
│   │   │   └── VadBridge.ts                 // VAD制御
│   │   │
│   │   └── workers/
│   │       └── WorkerManager.ts             // Worker起動・管理
│   │
│   ├── workers/
│   │   ├── tts-worker.ts                    // VOICEVOX Core常駐
│   │   ├── llm-worker.ts                    // Ollama/llama.cpp
│   │   └── asr-worker.ts                   // Groq API + VAD
│   │
│   └── shared/
│       ├── types.ts                         // 共通型定義
│       ├── constants.ts                     // 定数
│       └── utils.ts                        // ユーティリティ
│
├── cache/
│   ├── audio/                               // 事前生成WAVキャッシュ
│   │   ├── manifest.json
│   │   └── *.wav
│   └── predictions/                        // 予測キャッシュ
│
├── data/
│   ├── patterns/                           // Aho-Corasickパターン定義
│   ├── responses/                          // 返答バンクデータ
│   └── memory/                            // 永続化メモリ
│
├── scripts/
│   └── prebuild-cache.ts                   // キャッシュ事前生成スクリプト
│
├── electron-builder.yml
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 14. 型定義一覧

```ts
// ===== 意図関連 =====

type IntentResult = {
  intent: IntentCategory
  confidence: number
  method: "rule" | "llm" | "speculation"
  emotion?: EmotionTag
  matchedPatterns?: string[]
  latencyMs: number
}

type IntentMatch = {
  intent: IntentCategory
  weight: number
  matchedPattern: string
  position: number
}

type EmotionTag =
  | "positive" | "negative" | "neutral"
  | "excited" | "sad" | "angry"
  | "surprised" | "anxious" | "relieved"

// ===== フック関連 =====

type Hook = {
  id: string
  surface: string
  topic: string
  emotionScore: number
  noveltyScore: number
  depthScore: number
  askabilityScore: number
  type: "emotion" | "entity" | "causal" | "topic_pivot"
  totalScore: number
}

// ===== 会話関連 =====

type TurnRecord = {
  id: string
  timestamp: number
  role: "user" | "assistant"
  transcript: string
  intent: IntentResult | null
  hooks: Hook[]
  responseEntryIds: string[]
}

type ConversationContext = {
  currentTopic: string | null
  topicHistory: string[]
  activeHooks: Hook[]
  emotionTrend: EmotionTag[]
  turnCount: number
  recentTurns: TurnRecord[]
  activeDomain: string | null
  topicNovelty: number
  templateVars: Record<string, string>
}

type ConversationPlan = {
  currentStrategy: "empathize" | "inform" | "ask" | "bridge" | "fallback"
  nextMoves: string[]
  avoidTopics: string[]
}

// ===== 投機実行関連 =====

type SpeculativeResult = {
  predictedIntent: IntentCategory
  confidence: number
  partialTextAtPrediction: string
  onsetEntry: ResponseEntry | null
  bodyTemplate: ResponseEntry | null
  preparedAt: number
  intentResult?: IntentResult
}

// ===== TTS関連 =====

type SynthOptions = {
  priority: "immediate" | "queued"
  speakerId?: number
  speed?: number
  pitch?: number
}

type AudioQueueItem = {
  pcmData: Float32Array
  sampleRate: number
}

// ===== VOICEVOX設定 =====

type VoicevoxConfig = {
  openJtalkDictDir: string
  speakerIds: number[]
  cpuNumThreads: number
  accelerationMode: "CPU" | "GPU"
}
```

---

# 15. データフロー詳細

## 15.1 通常ターン（ルールベース意図分類成功時）

```
t=0ms    [Groq API] → STT最終テキスト到達
         │
t=0-2ms  [AhoCorasickMatcher] パターンマッチ
         │ → IntentMatch[] (3-5 candidates)
         │
t=2-5ms  [SyntaxRuleEngine] 構文ルール適用
         │ → IntentResult { intent, confidence: 0.9 }
         │
t=5-7ms  [ResponseBank] onset エントリ取得
         │ → ResponseEntry { cachedAudioId: "aizuchi_naruhodo_v0" }
         │
t=7-10ms [AudioCache] PCMバッファ参照取得
         │ → Float32Array (24000Hz, ~0.5秒分)
         │
t=10-15ms [IPC] Main → Renderer: pcmData転送
         │
t=15-25ms [WebAudioPlayer] AudioBuffer作成 + 再生開始
         │
t=25-50ms 🔊 発話開始音声が鳴り始める ✓ (目標100ms以内達成)
         │
         │ [並行処理]
         ├── [HookExtractor] フック抽出 (5-10ms)
         ├── [ResponseComposer] 本回答テンプレート解決 (10-30ms)
         ├── [MemorySystem] 短期メモリ更新 (2-5ms)
         │
t=50-100ms [VoicevoxWorker] 本回答テキスト合成開始
         │
t=300-600ms [VoicevoxWorker] 合成完了 → PCMデータ返却
         │
t=400-700ms 🔊 発話開始音声終了 → 本回答音声にシームレス接続
         │
t=700-2000ms 🔊 本回答再生中
         │
t=2000ms+ [SpeculationEngine] 次ターン投機準備開始
```

## 15.2 LLM Fallback 時のフロー

```
t=0ms    [Groq API] → STT最終テキスト到達
         │
t=0-5ms  [AhoCorasickMatcher + SyntaxRuleEngine]
         │ → IntentResult { intent: "ambiguous", confidence: 0.3 }
         │
t=5-7ms  [ResponseBank] fallback用 onset 取得
         │ → "ちょっと考えるね" or "うーん" (filler系)
         │
t=7-50ms 🔊 filler発話開始 ✓ (目標100ms以内達成)
         │
         │ [並行処理: LLM Fallback]
t=7ms    [LLMFallbackClassifier] Ollama に分類リクエスト送信
         │
t=300-500ms [Ollama] 意図分類結果返却
         │
t=500-550ms [ResponseComposer] LLM結果に基づく本回答生成
         │
t=550-600ms [VoicevoxWorker] 本回答合成開始
         │
t=800-1200ms 🔊 filler終了 → 本回答接続
```

---

# 16. MVP実装順序

## Phase 1: 基盤（1-2週間）

1. Electron + Vite プロジェクトセットアップ
2. TTS Worker（VOICEVOX Core 常駐プロセス）
3. 基本的な IPC ルーティング
4. Web Audio API Player（PCM再生）

## Phase 2: 音声ループ（1-2週間）

5. VAD（Voice Activity Detection）
6. Groq STT Bridge
7. 基本的なオーケストレーター（STT → 固定応答 → TTS）

## Phase 3: 意図理解 + 返答バンク（2-3週間）

8. Aho-Corasick パターンマッチエンジン
9. 構文ルールエンジン
10. 返答バンク（onset 200 + body 500 + followup 100 = 初期800エントリ）
11. テンプレート変数システム
12. 3ステージ応答合成

## Phase 4: キャッシュ + 高速化（1-2週間）

13. WAV事前キャッシュ生成スクリプト
14. AudioCache メモリ常駐
15. レイテンシ計測 + チューニング

## Phase 5: 先読み + メモリ（2-3週間）

16. フック抽出エンジン
17. 投機実行エンジン
18. メモリシステム（短期 + ワーキング）
19. LLM Fallback（Ollama連携）

## Phase 6: 発展（継続）

20. エピソディックメモリ + 長期メモリ
21. ドメイン拡張返答バンク
22. 感情推定
23. アバター表情同期
24. 返答バンクの動的学習・拡張

---

# 17. 付録A: VOICEVOX Core 高速化ガイド

## A.1 最重要原則: voicevox_core を常駐させる

毎リクエストでの初期化は厳禁。アプリ起動時に1回だけ初期化し、以降はプロセスが生き続ける。

## A.2 推奨構成

```
Renderer → IPC → Main → child_process.fork() → TTS Worker
                                                    │
                                                    ├── voicevox_core init (起動時1回)
                                                    ├── speaker load (起動時)
                                                    └── synthesize (リクエスト毎)
```

## A.3 最適化チェックリスト

| 項目 | 設定 |
|---|---|
| CPU threads | 6-8（i7-12700KF） |
| child process | 1（TTS専用） |
| speaker preload | 2話者（ずんだもん + 四国めたん） |
| WAV cache | ON（メモリ + userData） |
| sentence split | ON（句点単位） |
| audio_query cache | ON（同一テキスト再利用） |
| テキスト前処理 | ON（URL除去、空白削除、記号整理） |
| acceleration | CPU（GPUは後から追加） |

## A.4 長文分割合成

```ts
function splitBySentence(text: string): string[] {
  // 句点・感嘆符・疑問符で分割
  return text
    .split(/(?<=[。！？\n])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}
```

1文ずつ合成 → 合成済みから順次再生。長文でもユーザーを待たせない。

---

# 18. 付録B: 返答バンク初期データ設計

## B.1 Onset（発話開始）データ例

```ts
const ONSET_DATA: ResponseEntry[] = [
  // === 汎用相槌 ===
  {
    id: "onset_aizuchi_001",
    intent: "acknowledgment",
    domain: "universal",
    category: "aizuchi",
    stage: "onset",
    text: "なるほど",
    textVariants: ["なるほどね", "なるほどなるほど"],
    cachedAudioId: "onset_aizuchi_001_v0",
    requiresSynthesis: false,
    emotion: "neutral",
    energy: "mid",
    formality: "casual",
    topicTags: [],
    usageCount: 0,
    cooldownMs: 10000
  },
  {
    id: "onset_aizuchi_002",
    intent: "acknowledgment",
    domain: "universal",
    category: "aizuchi",
    stage: "onset",
    text: "うん、うん",
    textVariants: ["うんうん", "うん"],
    cachedAudioId: "onset_aizuchi_002_v0",
    requiresSynthesis: false,
    emotion: "neutral",
    energy: "low",
    formality: "casual",
    topicTags: [],
    usageCount: 0,
    cooldownMs: 8000
  },

  // === 共感系 ===
  {
    id: "onset_empathy_001",
    intent: "express_negative",
    domain: "universal",
    category: "empathy",
    stage: "onset",
    text: "それは大変だね",
    textVariants: ["うわ、それはキツいね", "それは辛いね"],
    cachedAudioId: "onset_empathy_001_v0",
    requiresSynthesis: false,
    emotion: "negative",
    energy: "mid",
    formality: "casual",
    topicTags: [],
    usageCount: 0,
    cooldownMs: 15000
  },

  // === 驚き系 ===
  {
    id: "onset_surprise_001",
    intent: "express_surprise",
    domain: "universal",
    category: "surprise",
    stage: "onset",
    text: "えっ、マジで",
    textVariants: ["えー！", "うそ、本当に？"],
    cachedAudioId: "onset_surprise_001_v0",
    requiresSynthesis: false,
    emotion: "surprised",
    energy: "high",
    formality: "casual",
    topicTags: [],
    usageCount: 0,
    cooldownMs: 12000
  },

  // === filler（LLM fallback時用） ===
  {
    id: "onset_filler_001",
    intent: "ambiguous",
    domain: "universal",
    category: "filler",
    stage: "onset",
    text: "うーん、ちょっと考えるね",
    textVariants: ["えっと、そうだなあ", "うーん"],
    cachedAudioId: "onset_filler_001_v0",
    requiresSynthesis: false,
    emotion: "neutral",
    energy: "low",
    formality: "casual",
    topicTags: [],
    usageCount: 0,
    cooldownMs: 20000
  },

  // ... 合計 200-400 onset エントリ
]
```

## B.2 Body（本回答）テンプレート例

```ts
const BODY_TEMPLATES: ResponseEntry[] = [
  // === 深掘り系 ===
  {
    id: "body_deepen_001",
    intent: "topic_continue",
    domain: "universal",
    category: "deepening",
    stage: "body",
    text: "{{hook}}について、もう少し聞きたいんだけど",
    textVariants: [
      "{{hook}}のところ、もうちょっと詳しく教えて",
      "そこ気になった、{{hook}}ってどういうこと？"
    ],
    requiresSynthesis: true,
    emotion: "neutral",
    energy: "mid",
    formality: "casual",
    topicTags: [],
    usageCount: 0,
    cooldownMs: 30000
  },

  // === 共感 + 意見 ===
  {
    id: "body_empathy_opinion_001",
    intent: "express_negative",
    domain: "universal",
    category: "empathy",
    stage: "body",
    text: "{{empathy_phrase}}。でも{{suggestion}}",
    textVariants: [
      "気持ちはわかる。{{suggestion}}",
      "それは正直しんどいよね。{{suggestion}}"
    ],
    requiresSynthesis: true,
    emotion: "negative",
    energy: "mid",
    formality: "casual",
    topicTags: ["emotion", "support"],
    usageCount: 0,
    cooldownMs: 60000
  },

  // ... 合計 1000-2000 body テンプレート
]
```

## B.3 メモリ使用量の概算

| 項目 | サイズ |
|---|---|
| 返答バンク（3000エントリ、テキスト + メタデータ） | ~5MB |
| Aho-Corasick オートマトン（3000パターン） | ~2MB |
| WAVキャッシュ（400 onset × 平均0.5秒 × 24kHz × 4byte） | ~19MB |
| 短期メモリ（10ターン分） | ~0.1MB |
| ワーキングメモリ | ~0.5MB |
| **合計** | **~27MB** |

128GB RAMの環境では全く問題ない。将来的にキャッシュを増やしても200MB上限で十分余裕がある。

---

# 改訂履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| 1.0 Draft | 2026-03-10 | 初版作成 |
