/**
 * scripts/sync-public.ts
 *
 * ローカルのフルソースから GitHub 公開用ブランチ (public) を生成してプッシュ。
 *
 * 【隠す対象】
 *   src/shared/intent-patterns.ts
 *   src/main/intent/SyntaxRuleEngine.ts
 *   src/main/intent/HookExtractor.ts
 *   src/main/bank/ResponseBank.ts
 *   src/main/orchestrator/ConversationOrchestrator.ts
 *
 *   → esbuild で1ファイルにバンドル + minify
 *   → src/lib/sentinel-engine.js + sentinel-engine.d.ts に出力
 *   → 元の .ts をスタブ（re-export のみ）に差し替え
 *
 * 使い方:
 *   npm run sync:public
 *
 * 前提:
 *   - git remote origin が設定済みであること
 *   - 初回は GitHub でリポジトリを作成後に実行
 */

import { execSync } from 'child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const WORKTREE = join(ROOT, '..', 's-rtvc-public-worktree')  // プロジェクト外
const LIB_DIR  = 'src/lib'

// ── 隠すファイル一覧（ROOT からの相対パス） ─────────────────────────────────

const PRIVATE_FILES = [
  'src/shared/intent-patterns.ts',
  'src/main/intent/SyntaxRuleEngine.ts',
  'src/main/intent/HookExtractor.ts',
  'src/main/bank/ResponseBank.ts',
  'src/main/orchestrator/ConversationOrchestrator.ts',
]

// ── 各プライベートファイルの公開インターフェース定義 ───────────────────────

const STUBS: Record<string, { ts: string; dts: string }> = {
  'src/shared/intent-patterns.ts': {
    ts: `// ⚠ このモジュールはプリビルド済みです
export { AhoCorasickEngine, INTENT_PATTERNS } from '../lib/sentinel-engine'
export type { IntentCategory, IntentClassification, PatternEntry, AhoCorasickHit } from '../lib/sentinel-engine'
`,
    dts: `export { AhoCorasickEngine, INTENT_PATTERNS } from './sentinel-engine'
export type { IntentCategory, IntentClassification, PatternEntry, AhoCorasickHit } from './sentinel-engine'
`,
  },
  'src/main/intent/SyntaxRuleEngine.ts': {
    ts: `export { SyntaxRuleEngine } from '../../lib/sentinel-engine'\n`,
    dts: `export { SyntaxRuleEngine } from './sentinel-engine'\n`,
  },
  'src/main/intent/HookExtractor.ts': {
    ts: `export { HookExtractor } from '../../lib/sentinel-engine'\n`,
    dts: `export { HookExtractor } from './sentinel-engine'\n`,
  },
  'src/main/bank/ResponseBank.ts': {
    ts: `export { ResponseBank } from '../../lib/sentinel-engine'\n`,
    dts: `export { ResponseBank } from './sentinel-engine'\n`,
  },
  'src/main/orchestrator/ConversationOrchestrator.ts': {
    ts: `export { ConversationOrchestrator } from '../../lib/sentinel-engine'\n`,
    dts: `export { ConversationOrchestrator } from './sentinel-engine'\n`,
  },
}

// ── メイン ────────────────────────────────────────────────────────────────

const run = (cmd: string, cwd = ROOT) =>
  execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim()

async function main() {
  // ── 1. git 状態確認 ──────────────────────────────────────────────────
  const status = run('git status --porcelain')
  if (status) {
    console.log('⚠  未コミットの変更があります:')
    console.log(status)
    console.log('   ローカルのコミット状態を確認してから再実行してください。')
    console.log('   (sync:public はローカルの HEAD をベースにします)')
  }

  // ── 2. esbuild でバンドル → minify ───────────────────────────────────
  console.log('\n📦 プライベートモジュールをバンドル中...')

  // 一時出力先
  const tmpOut = join(ROOT, '.tmp-engine-build')
  if (existsSync(tmpOut)) rmSync(tmpOut, { recursive: true })
  mkdirSync(tmpOut)

  // 全プライベートファイルを re-export する一時エントリポイントを生成
  const entryContent = PRIVATE_FILES.map(f =>
    `export * from '${join(ROOT, f).replace(/\\/g, '/')}'`
  ).join('\n') + '\n'
  const tmpEntry = join(tmpOut, '_entry.ts')
  writeFileSync(tmpEntry, entryContent)

  await build({
    entryPoints: [tmpEntry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outfile: join(tmpOut, 'sentinel-engine.js'),
    packages: 'external',
  })

  console.log('   ✓ sentinel-engine.js 生成完了')

  // ── 3. .d.ts スタブ生成 ──────────────────────────────────────────────
  const dts = generateDts()
  writeFileSync(join(tmpOut, 'sentinel-engine.d.ts'), dts)
  console.log('   ✓ sentinel-engine.d.ts 生成完了')

  // ── 4. worktree 準備 ─────────────────────────────────────────────────
  console.log('\n🌿 public ブランチの worktree を準備中...')

  if (existsSync(WORKTREE)) {
    run(`git worktree remove --force "${WORKTREE}"`)
  }

  // public ブランチがなければ作成
  const branches = run('git branch --list public')
  if (!branches) {
    run('git branch public')
    console.log('   ✓ public ブランチ作成')
  }

  run(`git worktree add "${WORKTREE}" public`)
  console.log(`   ✓ worktree: ${WORKTREE}`)

  // ── 5. ファイルをコピー ───────────────────────────────────────────────
  console.log('\n📁 ファイルをコピー中...')

  // git が追跡しているファイルのみ worktree へエクスポート
  // （.git / node_modules / dist 等は自動で除外される）
  run(`git checkout-index -a --force --prefix="${WORKTREE.replace(/\\/g, '/')}/"`)

  // ── 6. lib/ にビルド済みファイルを置く ───────────────────────────────
  const libDir = join(WORKTREE, LIB_DIR)
  mkdirSync(libDir, { recursive: true })
  cpSync(join(tmpOut, 'sentinel-engine.js'),      join(libDir, 'sentinel-engine.js'))
  cpSync(join(tmpOut, 'sentinel-engine.d.ts'),    join(libDir, 'sentinel-engine.d.ts'))
  console.log('   ✓ sentinel-engine.js / .d.ts コピー完了')

  // ── 7. プライベートファイルをスタブに差し替え ───────────────────────
  for (const [rel, stub] of Object.entries(STUBS)) {
    writeFileSync(join(WORKTREE, rel), stub.ts)
  }
  console.log('   ✓ プライベートファイルをスタブに差し替え完了')

  // ── 8. .gitignore 追記（worktree 用） ───────────────────────────────
  const gitignorePublic = [
    'node_modules/',
    'dist/',
    'out/',
    'dist-electron/',
    'cache/',
    'sentinel-config.json',
    '*.log',
  ].join('\n') + '\n'
  writeFileSync(join(WORKTREE, '.gitignore'), gitignorePublic)

  // ── 9. コミット & プッシュ ────────────────────────────────────────────
  console.log('\n🚀 コミット & プッシュ中...')
  const date = new Date().toISOString().slice(0, 10)
  try {
    run(`git -C "${WORKTREE}" add -A`)
    run(`git -C "${WORKTREE}" commit -m "sync: ${date}"`)
    run(`git -C "${WORKTREE}" push -u origin public`)
    console.log('   ✓ GitHub へプッシュ完了')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('   ✗ push 失敗:', msg)
  }

  // ── 10. クリーンアップ ───────────────────────────────────────────────
  run(`git worktree remove --force "${WORKTREE}"`)
  rmSync(tmpOut, { recursive: true })

  console.log('\n✅ 完了！ GitHub の public ブランチを確認してください。')
}

// ── 型定義スタブ生成 ────────────────────────────────────────────────────────

function generateDts(): string {
  return `// Sentinel Engine — Public Type Declarations
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
`
}

main().catch(e => { console.error(e); process.exit(1) })
