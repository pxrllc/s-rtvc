/**
 * RuntimeConfig
 * exe と同じディレクトリ（または開発時はプロジェクトルート）の
 * sentinel-config.json をランタイムで読み込む。
 * import.meta.env（ビルド時焼き込み）より優先される。
 *
 * sentinel-config.json 例:
 * {
 *   "ttsBaseUrl": "http://localhost:50032",
 *   "ttsProvider": "http",
 *   "llmProvider": "groq"
 * }
 */

import { app } from 'electron'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'

export type Config = {
  ttsBaseUrl?: string
  ttsProvider?: string
  llmProvider?: string
  groqApiKey?: string
  openaiApiKey?: string
  geminiApiKey?: string
  claudeApiKey?: string
  ollamaModel?: string
  ollamaBaseUrl?: string
  groqModel?: string
  openaiModel?: string
  geminiModel?: string
  claudeModel?: string
  voicevoxCoreDll?: string
  voicevoxOpenJtalkDict?: string
  voicevoxVoiceModel?: string
  voicevoxSpeakerId?: number
}

function getConfigPath(): string {
  if (app.isPackaged) {
    return join(dirname(process.execPath), 'sentinel-config.json')
  }
  return join(process.cwd(), 'sentinel-config.json')
}

let _config: Config | null = null

export function loadRuntimeConfig(): Config {
  if (_config) return _config

  const configPath = getConfigPath()

  if (existsSync(configPath)) {
    try {
      _config = JSON.parse(readFileSync(configPath, 'utf-8')) as Config
      console.log(`[Config] ${configPath} を読み込みました`)
    } catch (e) {
      console.warn(`[Config] sentinel-config.json の解析に失敗: ${e}`)
      _config = {}
    }
  } else {
    _config = {}
    // 初回起動時にテンプレートを生成
    const template: Config = {
      ttsBaseUrl: 'http://localhost:50021',
      ttsProvider: 'http',
    }
    try {
      writeFileSync(configPath, JSON.stringify(template, null, 2), 'utf-8')
      console.log(`[Config] テンプレートを生成しました: ${configPath}`)
    } catch {
      // 書き込み失敗は無視
    }
  }

  return _config
}

/** env変数とruntime configをマージ。runtime configが優先 */
export function mergeConfig(env: Record<string, string | undefined>): Record<string, string | undefined> {
  const rc = loadRuntimeConfig()
  return {
    ...env,
    ...(rc.ttsBaseUrl       && { MAIN_VITE_TTS_BASE_URL:              rc.ttsBaseUrl }),
    ...(rc.ttsProvider      && { MAIN_VITE_TTS_PROVIDER:              rc.ttsProvider }),
    ...(rc.llmProvider      && { MAIN_VITE_LLM_PROVIDER:              rc.llmProvider }),
    ...(rc.groqApiKey       && { MAIN_VITE_GROQ_API_KEY:              rc.groqApiKey }),
    ...(rc.openaiApiKey     && { MAIN_VITE_OPENAI_API_KEY:            rc.openaiApiKey }),
    ...(rc.geminiApiKey     && { MAIN_VITE_GEMINI_API_KEY:            rc.geminiApiKey }),
    ...(rc.claudeApiKey     && { MAIN_VITE_CLAUDE_API_KEY:            rc.claudeApiKey }),
    ...(rc.ollamaModel      && { MAIN_VITE_OLLAMA_MODEL:              rc.ollamaModel }),
    ...(rc.ollamaBaseUrl    && { MAIN_VITE_OLLAMA_BASE_URL:           rc.ollamaBaseUrl }),
    ...(rc.groqModel        && { MAIN_VITE_GROQ_MODEL:                rc.groqModel }),
    ...(rc.openaiModel      && { MAIN_VITE_OPENAI_MODEL:              rc.openaiModel }),
    ...(rc.geminiModel      && { MAIN_VITE_GEMINI_MODEL:              rc.geminiModel }),
    ...(rc.claudeModel      && { MAIN_VITE_CLAUDE_MODEL:              rc.claudeModel }),
    ...(rc.voicevoxCoreDll  && { MAIN_VITE_VOICEVOX_CORE_DLL:         rc.voicevoxCoreDll }),
    ...(rc.voicevoxOpenJtalkDict && { MAIN_VITE_VOICEVOX_OPEN_JTALK_DICT: rc.voicevoxOpenJtalkDict }),
    ...(rc.voicevoxVoiceModel    && { MAIN_VITE_VOICEVOX_VOICE_MODEL:     rc.voicevoxVoiceModel }),
    ...(rc.voicevoxSpeakerId != null && {
      MAIN_VITE_VOICEVOX_SPEAKER_ID: String(rc.voicevoxSpeakerId)
    }),
  }
}
