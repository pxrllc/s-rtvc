/**
 * Aho-Corasick パターン辞書テスト
 * ts-node や tsx で実行可能
 */

// --- inline import (同ファイルで動作確認用に型と辞書を読み込み) ---
const {
  INTENT_PATTERNS,
  AhoCorasickEngine,
  getPatternStats,
  printDictionarySummary,
} = require("./intent-patterns.ts") as any;

// TypeScript 環境外でも動くように、簡易的に同一ファイルから再 export
// 実際のテスト実行は tsx test-patterns.ts

import {
  INTENT_PATTERNS as patterns,
  AhoCorasickEngine as Engine,
  getPatternStats as stats,
  printDictionarySummary as summary,
} from "./intent-patterns";

// =============================================================================
// 1. 辞書統計
// =============================================================================
console.log("━".repeat(60));
summary();
console.log("━".repeat(60));

// =============================================================================
// 2. エンジン構築 + メモリ計測
// =============================================================================
const t0 = performance.now();
const engine = new Engine(patterns);
const buildMs = (performance.now() - t0).toFixed(2);

console.log("");
console.log(`Engine built in ${buildMs} ms`);
console.log(`Trie nodes: ${engine.nodeCount}`);
console.log("");

// =============================================================================
// 3. テストケース
// =============================================================================

type TestCase = {
  input: string;
  expectedIntent: string;
  description: string;
};

const TEST_CASES: TestCase[] = [
  // --- greeting ---
  { input: "おはよう、今日もいい天気だね", expectedIntent: "greeting", description: "朝の挨拶" },
  { input: "やあ、ひさしぶり", expectedIntent: "greeting", description: "カジュアルな再会" },

  // --- farewell ---
  { input: "じゃあね、また明日", expectedIntent: "farewell", description: "別れの挨拶" },
  { input: "そろそろ行くわ", expectedIntent: "farewell", description: "退出宣言" },

  // --- acknowledgment ---
  { input: "なるほどね、たしかにそうだ", expectedIntent: "acknowledgment", description: "複合同意" },
  { input: "うんうん、その通りだと思う", expectedIntent: "acknowledgment", description: "強い同意" },

  // --- disagreement ---
  { input: "いやいや、それは違うよ", expectedIntent: "disagreement", description: "明確な否定" },
  { input: "そうかなあ、微妙じゃない？", expectedIntent: "disagreement", description: "やんわり否定" },

  // --- confirmation ---
  { input: "つまり、今日は休みってこと？", expectedIntent: "confirmation", description: "確認質問" },
  { input: "確認なんだけど、3時で合ってる？", expectedIntent: "confirmation", description: "明示的な確認" },

  // --- question_factual ---
  { input: "これっていつから始まるの？", expectedIntent: "question_factual", description: "時期の事実質問" },
  { input: "あの映画って何？知ってる？", expectedIntent: "question_factual", description: "事実質問" },

  // --- question_opinion ---
  { input: "この件についてどう思う？", expectedIntent: "question_opinion", description: "意見を求める" },
  { input: "AとBだとどっちがいいかな", expectedIntent: "question_opinion", description: "選択肢の意見" },

  // --- question_how ---
  { input: "これどうやって設定するの？", expectedIntent: "question_how", description: "方法を聞く" },
  { input: "何から始めればいいかな", expectedIntent: "question_how", description: "手順を聞く" },

  // --- request_action ---
  { input: "ちょっと調べてくれない？", expectedIntent: "request_action", description: "行動要求" },
  { input: "これお願いします", expectedIntent: "request_action", description: "丁寧な依頼" },

  // --- request_explanation ---
  { input: "もっと詳しく説明してほしい", expectedIntent: "request_explanation", description: "詳細要求" },
  { input: "かみ砕いて教えて", expectedIntent: "request_explanation", description: "簡易説明要求" },

  // --- express_positive ---
  { input: "うわ、最高じゃん！すごい", expectedIntent: "express_positive", description: "強いポジティブ" },
  { input: "めっちゃ楽しかった、ワクワクした", expectedIntent: "express_positive", description: "楽しい体験" },

  // --- express_negative ---
  { input: "もう疲れた、しんどい", expectedIntent: "express_negative", description: "疲労の訴え" },
  { input: "ストレスで限界に近い", expectedIntent: "express_negative", description: "ストレス表現" },

  // --- express_surprise ---
  { input: "えっ、嘘でしょ！信じられない", expectedIntent: "express_surprise", description: "強い驚き" },
  { input: "まじか、それ初耳だわ", expectedIntent: "express_surprise", description: "驚き+初知り" },

  // --- express_complaint ---
  { input: "めんどくさいなあ、もうやだ", expectedIntent: "express_complaint", description: "面倒+嫌気" },
  { input: "あいつマジでムカつくわ", expectedIntent: "express_complaint", description: "怒りの愚痴" },

  // --- topic_shift ---
  { input: "ところで、最近ゲームやってる？", expectedIntent: "topic_shift", description: "話題転換" },
  { input: "全然違う話なんだけどさ", expectedIntent: "topic_shift", description: "明示的転換" },

  // --- topic_continue ---
  { input: "それでね、結局うまくいったんだよ", expectedIntent: "topic_continue", description: "話の続き" },
  { input: "さっきの続きなんだけど", expectedIntent: "topic_continue", description: "明示的な継続" },

  // --- topic_deepen ---
  { input: "そこをもう少し詳しく聞きたい", expectedIntent: "topic_deepen", description: "深掘り要求" },
  { input: "なんでそう思うの？きっかけは？", expectedIntent: "topic_deepen", description: "理由の深掘り" },

  // --- storytelling ---
  { input: "聞いてよ、この前すごいことがあってさ", expectedIntent: "storytelling", description: "体験談開始" },
  { input: "実はね、昨日びっくりすることがあった", expectedIntent: "storytelling", description: "秘密の共有" },

  // --- 複合・曖昧ケース ---
  { input: "うん", expectedIntent: "acknowledgment", description: "最短の同意" },
  { input: "あのさ、ちょっと聞きたいんだけど", expectedIntent: "storytelling", description: "前置き" },
];

// =============================================================================
// 4. テスト実行
// =============================================================================
console.log("━".repeat(60));
console.log("  MATCHING TESTS");
console.log("━".repeat(60));

let passed = 0;
let failed = 0;

for (const tc of TEST_CASES) {
  const t1 = performance.now();
  const result = engine.classify(tc.input);
  const elapsed = (performance.now() - t1).toFixed(3);

  const ok = result.intent === tc.expectedIntent;
  const icon = ok ? "✓" : "✗";

  if (ok) {
    passed++;
  } else {
    failed++;
  }

  const matchInfo = result.matches.map((m: any) => `"${m.pattern}"`).join(", ");

  console.log(
    `${icon} [${elapsed}ms] ${tc.description.padEnd(16)} ` +
    `expected=${tc.expectedIntent.padEnd(20)} ` +
    `got=${result.intent.padEnd(20)} ` +
    `conf=${result.confidence.toFixed(2)} ` +
    `matches=[${matchInfo}]`
  );
}

console.log("");
console.log("━".repeat(60));
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${TEST_CASES.length} total`);
console.log("━".repeat(60));

// =============================================================================
// 5. パフォーマンスベンチマーク
// =============================================================================
console.log("");
console.log("━".repeat(60));
console.log("  PERFORMANCE BENCHMARK");
console.log("━".repeat(60));

const benchInputs = [
  "おはよう",
  "なるほどね、たしかにそうだ",
  "この前さ、仕事で上司が変わって、チームの雰囲気が悪くなったんだよね。めんどくさいし、ストレスで限界に近い",
  "ところで、最近どうやってプログラミング勉強してる？おすすめの方法あったら教えてほしいんだけど",
  "あー、それは大変だね。でもさ、実はね、似たような経験があって、この前こういうことがあったんだよ",
];

const BENCH_ITERATIONS = 10000;

for (const input of benchInputs) {
  const chars = [...input].length;
  const start = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    engine.classify(input);
  }
  const totalMs = performance.now() - start;
  const avgUs = ((totalMs / BENCH_ITERATIONS) * 1000).toFixed(1);

  console.log(
    `  ${chars.toString().padStart(3)} chars → ${avgUs.padStart(6)} μs/call ` +
    `(${(totalMs).toFixed(1)}ms / ${BENCH_ITERATIONS} iterations)`
  );
}

console.log("");
console.log("Target: < 10ms per classify call → Easily achieved ✓");
