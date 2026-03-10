/**
 * TtsProviderFactory
 * MAIN_VITE_TTS_PROVIDER=http|core (デフォルト: http)
 *
 * core モード追加設定:
 *   MAIN_VITE_VOICEVOX_CORE_DLL      voicevox_core.dll のフルパス
 *   MAIN_VITE_VOICEVOX_OPEN_JTALK_DICT  open_jtalk_dic_utf_8 ディレクトリ
 *   MAIN_VITE_VOICEVOX_VOICE_MODEL    *.vvm ファイルのパス
 *   MAIN_VITE_VOICEVOX_SPEAKER_ID     スピーカーID (省略時: 3)
 */

import type { TtsProvider } from './TtsProvider'
import { VoicevoxClient } from './VoicevoxClient'
import { VoicevoxCoreClient } from './VoicevoxCoreClient'

type Env = Record<string, string | undefined>

export async function createTtsProvider(env: Env, speakerId = 1): Promise<TtsProvider> {
  const provider = (env.MAIN_VITE_TTS_PROVIDER ?? 'http').toLowerCase()

  if (provider === 'core') {
    const dllPath    = env.MAIN_VITE_VOICEVOX_CORE_DLL
    const dictDir    = env.MAIN_VITE_VOICEVOX_OPEN_JTALK_DICT
    const modelPath  = env.MAIN_VITE_VOICEVOX_VOICE_MODEL
    const sid        = env.MAIN_VITE_VOICEVOX_SPEAKER_ID
      ? parseInt(env.MAIN_VITE_VOICEVOX_SPEAKER_ID, 10)
      : speakerId

    if (!dllPath || !dictDir || !modelPath) {
      console.warn('[TTS] core モードに必要な環境変数が未設定。HTTP モードにフォールバック。')
      return new VoicevoxClient(speakerId)
    }

    const core = new VoicevoxCoreClient({ dllPath, openJtalkDictDir: dictDir, voiceModelPath: modelPath, speakerId: sid })
    await core.initialize()
    return core
  }

  // デフォルト: HTTP
  return new VoicevoxClient(speakerId)
}
