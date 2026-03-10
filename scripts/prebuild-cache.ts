/**
 * scripts/prebuild-cache.ts
 *
 * 全 onset テキストを VOICEVOX で事前合成して cache/audio/ に保存する。
 * 実行: npm run cache:build
 *
 * VOICEVOX Engine が localhost:50021 で起動している必要あり。
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const CACHE_DIR = join(PROJECT_ROOT, 'cache', 'audio')
const VOICEVOX_BASE = 'http://localhost:50021'
const SPEAKER_ID = 1   // ずんだもん
const SPEED_ONSET = 1.2  // ConversationOrchestrator の SPEED_ONSET と合わせること

// ── ResponseBank から全 onset テキストを収集 ────────────────────────
// ※ ResponseBank を直接 import せず、テキスト一覧を独立して管理することで
//    スクリプトの依存を最小にする

const ONSET_TEXTS: string[] = [
  // acknowledgment
  'なるほど', 'なるほどね', 'たしかに', 'たしかにね',
  'うんうん', 'うん、うん', 'そうだよね', 'だよね',

  // greeting
  'やあ', 'おう', 'こんにちは', 'よ', 'おー、久しぶり', 'ひさしぶり',

  // farewell
  'またね', 'じゃあね', 'おつかれ', 'おつかれさま', 'またいつでも', 'いつでも来てね',

  // express_positive
  'いいね', 'いいじゃん', 'それ最高', 'すごいじゃん',
  'やるじゃん', 'すごいね', 'うれしいね', 'よかった',

  // express_negative
  'それはきつい', 'つらいね', '大変だったね', 'それは大変',
  'うわ、それは', 'うわー', 'しんどいね', 'きついね',

  // express_surprise
  'えっ、マジで', 'うそ', 'ほんとに', 'まじか',
  'えー！', 'うわっ', 'びっくりした', 'それは知らなかった',

  // express_complaint
  'それはムカつく', 'わかるそれ', 'それはひどい', 'ありえないね',
  'わかるわー', 'めんどいね', 'イライラするね', 'それはしんどい',

  // question_factual
  'えっとね', 'そうだな', 'うーん', 'ちょっと待って', 'それはね', '確かそれは',

  // question_opinion
  '個人的には', '正直言うと', 'うーん、そうだな', 'どうだろう', 'ぶっちゃけ', '率直に言うと',

  // question_how
  'そうだなぁ', 'えっとね', 'それはね', 'やり方としては', 'ポイントは', 'コツとしては',

  // request_action
  'わかった', '了解', 'やってみる', 'やっておく', 'まかせて', 'オッケー',

  // request_explanation
  '説明すると', 'わかりやすく言うと', 'そうだね', 'かいつまんで', 'ざっくり言うと',

  // topic_continue
  'それで', 'うん、それで', 'うん、続きは', 'ほんで？',
  'なるほど、で', 'それで？',

  // topic_shift
  'あ、そっちね', '話変わるね', 'ほお', 'そういえば', '急に話変わるけど',

  // topic_deepen
  'そこ気になる', 'もう少し聞いて', 'それ詳しく', 'もっと教えて', 'なんで？', '理由は？',

  // storytelling
  '何があったの', '聞かせて', 'えっ、マジで', 'うそ、それ',
  'あ、それは', 'そうなんだ', '面白そう', '気になる',

  // confirmation
  'えっとね', '確認すると', 'つまりね', '言い換えると', 'そういうこと？', 'ってこと？',

  // disagreement
  'うーん、どうかな', 'そうかなあ', 'むずかしいね', '一概には', 'でもさ',

  // ambiguous（短文・汎用反応）
  'へえ', 'そっかー', 'そっか', 'うんうん', 'うん',
  'そうなんだ', 'あ、なるほど', 'なるほど', 'ふーん',
  'それはそれは', 'マジで', 'ほんとに？',
]

// 重複除去
const UNIQUE_TEXTS = [...new Set(ONSET_TEXTS)]

// ── VOICEVOX 合成 ─────────────────────────────────────────────────
async function synthesize(text: string): Promise<Buffer> {
  const queryRes = await fetch(
    `${VOICEVOX_BASE}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER_ID}`,
    { method: 'POST' }
  )
  if (!queryRes.ok) throw new Error(`audio_query failed: ${queryRes.status}`)
  const query = await queryRes.json()
  query.speedScale = SPEED_ONSET

  const synthRes = await fetch(
    `${VOICEVOX_BASE}/synthesis?speaker=${SPEAKER_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    }
  )
  if (!synthRes.ok) throw new Error(`synthesis failed: ${synthRes.status}`)

  return Buffer.from(await synthRes.arrayBuffer())
}

// ── メイン処理 ────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎙  Sentinel RTVC — onset WAV キャッシュ生成`)
  console.log(`   対象テキスト数: ${UNIQUE_TEXTS.length}`)
  console.log(`   出力先: ${CACHE_DIR}\n`)

  // VOICEVOX 疎通確認
  try {
    const res = await fetch(`${VOICEVOX_BASE}/version`)
    const ver = await res.text()
    console.log(`✅ VOICEVOX Engine: ${ver.trim()}`)
  } catch {
    console.error('❌ VOICEVOX Engine に接続できません (localhost:50021)')
    process.exit(1)
  }

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })

  const entries: Array<{ text: string; file: string; sampleRate: number }> = []
  const errors: string[] = []
  const t0 = Date.now()

  for (let i = 0; i < UNIQUE_TEXTS.length; i++) {
    const text = UNIQUE_TEXTS[i]
    const file = `${String(i + 1).padStart(4, '0')}.wav`
    const outPath = join(CACHE_DIR, file)

    process.stdout.write(`  [${i + 1}/${UNIQUE_TEXTS.length}] "${text}" ... `)

    try {
      const t = Date.now()
      const wav = await synthesize(text)
      writeFileSync(outPath, wav)

      // WAV ヘッダーからサンプルレートを読む
      const sampleRate = wav.readUInt32LE(24)
      entries.push({ text, file, sampleRate })

      console.log(`✓ (${Date.now() - t}ms)`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`✗ ${msg}`)
      errors.push(text)
    }
  }

  // manifest.json 保存
  const manifest = {
    version: 1,
    speakerId: SPEAKER_ID,
    generatedAt: new Date().toISOString(),
    entries
  }
  writeFileSync(join(CACHE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n✅ 完了: ${entries.length}件 / ${elapsed}s`)
  if (errors.length > 0) {
    console.log(`⚠  失敗: ${errors.length}件 — ${errors.join(', ')}`)
  }
  console.log(`   manifest: ${join(CACHE_DIR, 'manifest.json')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
