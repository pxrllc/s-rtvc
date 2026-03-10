/**
 * scripts/prebuild-cache.ts
 *
 * 全 onset テキストを事前合成して cache/audio/ に保存する。
 * 実行: npm run cache:build
 *
 * TTS バックエンドは sentinel-config.json の設定に従う:
 *   - ttsProvider: "http"       → VOICEVOX (localhost:50021)
 *   - ttsProvider: "coeiroink"  → COEIROINK (localhost:50032/v1)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const CACHE_DIR = join(PROJECT_ROOT, 'cache', 'audio')
const SPEED_ONSET = 1.2  // ConversationOrchestrator の SPEED_ONSET と合わせること

// ── sentinel-config.json を読む ────────────────────────────────────
type Config = {
  ttsProvider?: string
  ttsBaseUrl?: string
  voicevoxSpeakerId?: number
}

function loadConfig(): Config {
  const path = join(PROJECT_ROOT, 'sentinel-config.json')
  if (existsSync(path)) {
    try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { /**/ }
  }
  return {}
}

const cfg = loadConfig()
const TTS_PROVIDER = cfg.ttsProvider ?? 'http'
const TTS_BASE     = (cfg.ttsBaseUrl ?? 'http://localhost:50021').replace(/\/$/, '')
const STYLE_ID     = cfg.voicevoxSpeakerId ?? (TTS_PROVIDER === 'coeiroink' ? 0 : 1)

// ── onset テキスト一覧 ────────────────────────────────────────────
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

  // listening pool
  'うん', 'そう', 'ね', 'うんうん', 'そっか',
  'たしかに', 'なるほど', 'うんうん', 'そうだよね', 'だよね', 'ふむ',
]

const UNIQUE_TEXTS = [...new Set(ONSET_TEXTS)]

// ── VOICEVOX 合成 ─────────────────────────────────────────────────
async function synthesizeVoicevox(text: string): Promise<Buffer> {
  const queryRes = await fetch(
    `${TTS_BASE}/audio_query?text=${encodeURIComponent(text)}&speaker=${STYLE_ID}`,
    { method: 'POST' }
  )
  if (!queryRes.ok) throw new Error(`audio_query failed: ${queryRes.status}`)
  const query = await queryRes.json()
  query.speedScale = SPEED_ONSET

  const synthRes = await fetch(
    `${TTS_BASE}/synthesis?speaker=${STYLE_ID}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) }
  )
  if (!synthRes.ok) throw new Error(`synthesis failed: ${synthRes.status}`)
  return Buffer.from(await synthRes.arrayBuffer())
}

// ── COEIROINK 合成 ────────────────────────────────────────────────
let _speakerUuid: string | null = null
async function resolveSpeakerUuid(): Promise<string> {
  if (_speakerUuid) return _speakerUuid
  const res = await fetch(`${TTS_BASE}/speakers`)
  if (!res.ok) throw new Error(`/speakers failed: ${res.status}`)
  const speakers: Array<{ speakerUuid: string; styles: { styleId: number }[] }> = await res.json()
  for (const s of speakers) {
    if (s.styles.some(st => st.styleId === STYLE_ID)) {
      _speakerUuid = s.speakerUuid
      return _speakerUuid
    }
  }
  if (speakers.length > 0) _speakerUuid = speakers[0].speakerUuid
  else throw new Error('No speakers found')
  return _speakerUuid!
}

async function synthesizeCoeiroink(text: string): Promise<Buffer> {
  const speakerUuid = await resolveSpeakerUuid()
  const res = await fetch(`${TTS_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speakerUuid, styleId: STYLE_ID, text, speedScale: SPEED_ONSET }),
  })
  if (!res.ok) throw new Error(`/predict failed: ${res.status} ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}

// ── 合成ディスパッチ ──────────────────────────────────────────────
async function synthesize(text: string): Promise<Buffer> {
  return TTS_PROVIDER === 'coeiroink'
    ? synthesizeCoeiroink(text)
    : synthesizeVoicevox(text)
}

// ── 疎通確認 ──────────────────────────────────────────────────────
async function pingCheck(): Promise<void> {
  const url = TTS_PROVIDER === 'coeiroink'
    ? `${TTS_BASE}/speakers`
    : `${TTS_BASE}/version`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const label = TTS_PROVIDER === 'coeiroink' ? 'COEIROINK' : 'VOICEVOX'
    console.log(`✅ ${label} (${TTS_BASE})`)
  } catch (e) {
    console.error(`❌ TTS サーバーに接続できません: ${TTS_BASE}`)
    process.exit(1)
  }
}

// ── メイン ────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎙  Sentinel RTVC — onset WAV キャッシュ生成`)
  console.log(`   provider: ${TTS_PROVIDER}  base: ${TTS_BASE}  styleId/speakerId: ${STYLE_ID}`)
  console.log(`   対象テキスト数: ${UNIQUE_TEXTS.length}`)
  console.log(`   出力先: ${CACHE_DIR}\n`)

  await pingCheck()

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
      const sampleRate = wav.readUInt32LE(24)
      entries.push({ text, file, sampleRate })
      console.log(`✓ (${Date.now() - t}ms)`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`✗ ${msg}`)
      errors.push(text)
    }
  }

  const manifest = {
    version: 1,
    provider: TTS_PROVIDER,
    speakerId: STYLE_ID,
    generatedAt: new Date().toISOString(),
    entries
  }
  writeFileSync(join(CACHE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n✅ 完了: ${entries.length}件 / ${elapsed}s`)
  if (errors.length > 0) console.log(`⚠  失敗: ${errors.length}件 — ${errors.join(', ')}`)
  console.log(`   manifest: ${join(CACHE_DIR, 'manifest.json')}`)
}

main().catch(e => { console.error(e); process.exit(1) })
