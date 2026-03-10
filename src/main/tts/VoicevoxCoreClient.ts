/**
 * VoicevoxCoreClient — VOICEVOX Core v0.15+ DLL 直接 FFI クライアント
 *
 * 必要ファイル（同一ディレクトリに配置推奨）:
 *   voicevox_core.dll
 *   onnxruntime.dll  (VOICEVOX Core に同梱)
 *   open_jtalk_dic_utf_8/  (辞書ディレクトリ)
 *   *.vvm  (音声モデルファイル)
 *
 * 環境変数:
 *   MAIN_VITE_TTS_PROVIDER=core
 *   MAIN_VITE_VOICEVOX_CORE_DLL=C:/path/to/voicevox_core.dll
 *   MAIN_VITE_VOICEVOX_OPEN_JTALK_DICT=C:/path/to/open_jtalk_dic_utf_8
 *   MAIN_VITE_VOICEVOX_VOICE_MODEL=C:/path/to/model.vvm
 *   MAIN_VITE_VOICEVOX_SPEAKER_ID=3   (省略時: 3 = ずんだもん ノーマル)
 */

import koffi from 'koffi'
import type { TtsProvider } from './TtsProvider'

const VOICEVOX_RESULT_OK = 0

export interface VoicevoxCoreConfig {
  dllPath: string
  openJtalkDictDir: string
  voiceModelPath: string
  speakerId?: number
}

export class VoicevoxCoreClient implements TtsProvider {
  private lib: ReturnType<typeof koffi.load> | null = null
  private synthesizerPtr: unknown = null
  private readonly speakerId: number

  // bound koffi functions — set after initialize()
  private fnCreateAudioQuery!: koffi.KoffiFunction
  private fnSynthesis!: koffi.KoffiFunction
  private fnWavFree!: koffi.KoffiFunction
  private fnJsonFree!: koffi.KoffiFunction
  private fnErrorMsg!: koffi.KoffiFunction
  private fnSynthesizerDelete!: koffi.KoffiFunction
  private defaultAqOpts!: unknown
  private defaultSynthOpts!: unknown

  constructor(private readonly config: VoicevoxCoreConfig) {
    this.speakerId = config.speakerId ?? 3
  }

  /** DLL ロード・初期化。app 起動時に一度だけ呼ぶ。 */
  async initialize(): Promise<void> {
    const lib = koffi.load(this.config.dllPath)
    this.lib = lib

    // ── 構造体定義 ──────────────────────────────────────────────────
    koffi.struct('VoicevoxLoadOnnxruntimeOptions', {
      filename: 'const char *',   // NULL = デフォルト (onnxruntime.dll を自動探索)
    })
    koffi.struct('VoicevoxInitializerOptions', {
      acceleration_mode: 'int32', // 0=AUTO, 1=CPU, 2=GPU
      cpu_num_threads: 'uint16',
    })
    koffi.struct('VoicevoxAudioQueryOptions', {
      kana: 'bool',
    })
    koffi.struct('VoicevoxSynthesisOptions', {
      enable_interrogative_upspeak: 'bool',
    })

    // ── 関数バインド ────────────────────────────────────────────────
    const fnMakeLoadOnnxOpts = lib.func(
      'voicevox_make_default_load_onnxruntime_options',
      'VoicevoxLoadOnnxruntimeOptions', []
    )
    const fnLoadOnnx = lib.func(
      'voicevox_onnxruntime_load_once', 'int32',
      ['VoicevoxLoadOnnxruntimeOptions', koffi.out(koffi.pointer('void'))]
    )
    const fnOpenJtalkNew = lib.func(
      'voicevox_open_jtalk_rc_new', 'int32',
      ['str', koffi.out(koffi.pointer('void'))]
    )
    const fnMakeInitOpts = lib.func(
      'voicevox_make_default_initialize_options',
      'VoicevoxInitializerOptions', []
    )
    const fnSynthesizerNew = lib.func(
      'voicevox_synthesizer_new', 'int32',
      ['void *', 'void *', 'VoicevoxInitializerOptions', koffi.out(koffi.pointer('void'))]
    )
    const fnModelFileOpen = lib.func(
      'voicevox_voice_model_file_open', 'int32',
      ['str', koffi.out(koffi.pointer('void'))]
    )
    const fnLoadModel = lib.func(
      'voicevox_synthesizer_load_voice_model', 'int32',
      ['void *', 'void *']
    )
    const fnModelFileClose = lib.func(
      'voicevox_voice_model_file_close', 'void', ['void *']
    )
    this.fnErrorMsg = lib.func(
      'voicevox_error_result_to_message', 'str', ['int32']
    )
    this.fnCreateAudioQuery = lib.func(
      'voicevox_synthesizer_create_audio_query', 'int32',
      ['void *', 'str', 'uint32',
       'VoicevoxAudioQueryOptions', koffi.out(koffi.pointer('char'))]
    )
    this.fnSynthesis = lib.func(
      'voicevox_synthesizer_synthesis', 'int32',
      ['void *', 'str', 'uint32', 'VoicevoxSynthesisOptions',
       koffi.out(koffi.pointer('size_t')), koffi.out(koffi.pointer('uint8'))]
    )
    this.fnWavFree = lib.func('voicevox_wav_free', 'void', ['void *'])
    this.fnJsonFree = lib.func('voicevox_json_free', 'void', ['void *'])
    this.fnSynthesizerDelete = lib.func(
      'voicevox_synthesizer_delete', 'void', ['void *']
    )

    // ── ONNX Runtime ロード ────────────────────────────────────────
    const loadOnnxOpts = fnMakeLoadOnnxOpts()
    const onnxOut = [null]
    this.check(fnLoadOnnx(loadOnnxOpts, onnxOut), 'onnxruntime_load_once')
    const onnxPtr = onnxOut[0]

    // ── OpenJTalk 初期化 ───────────────────────────────────────────
    const openJtalkOut = [null]
    this.check(fnOpenJtalkNew(this.config.openJtalkDictDir, openJtalkOut), 'open_jtalk_rc_new')
    const openJtalkPtr = openJtalkOut[0]

    // ── Synthesizer 生成 ───────────────────────────────────────────
    const initOpts = fnMakeInitOpts()
    const synthOut = [null]
    this.check(fnSynthesizerNew(onnxPtr, openJtalkPtr, initOpts, synthOut), 'synthesizer_new')
    this.synthesizerPtr = synthOut[0]

    // ── 音声モデルロード ──────────────────────────────────────────
    const modelFileOut = [null]
    this.check(fnModelFileOpen(this.config.voiceModelPath, modelFileOut), 'voice_model_file_open')
    const modelFilePtr = modelFileOut[0]
    this.check(fnLoadModel(this.synthesizerPtr, modelFilePtr), 'synthesizer_load_voice_model')
    fnModelFileClose(modelFilePtr)

    // ── デフォルトオプション取得 ──────────────────────────────────
    const fnMakeAqOpts = lib.func(
      'voicevox_make_default_audio_query_options', 'VoicevoxAudioQueryOptions', []
    )
    const fnMakeSynthOpts = lib.func(
      'voicevox_make_default_synthesis_options', 'VoicevoxSynthesisOptions', []
    )
    this.defaultAqOpts = fnMakeAqOpts()
    this.defaultSynthOpts = fnMakeSynthOpts()
  }

  async synthesize(text: string, speedScale = 1.0): Promise<Buffer> {
    if (!this.synthesizerPtr) throw new Error('[VoicevoxCore] 未初期化')

    // ── audio_query ───────────────────────────────────────────────
    const jsonPtrOut = [null]
    this.check(
      this.fnCreateAudioQuery(
        this.synthesizerPtr, text, this.speakerId, this.defaultAqOpts, jsonPtrOut
      ),
      'create_audio_query'
    )
    const jsonPtr = jsonPtrOut[0]

    // char* → JS string
    const MAX_JSON = 65536
    const jsonBytes = koffi.decode(jsonPtr, koffi.array('uint8', MAX_JSON)) as number[]
    const nullIdx = jsonBytes.indexOf(0)
    const jsonStr = Buffer.from(jsonBytes.slice(0, nullIdx >= 0 ? nullIdx : MAX_JSON)).toString('utf-8')
    this.fnJsonFree(jsonPtr)

    // speedScale を注入
    const query = JSON.parse(jsonStr)
    query.speedScale = speedScale
    const modifiedJson = JSON.stringify(query)

    // ── synthesis ─────────────────────────────────────────────────
    const wavLenOut = [0]
    const wavPtrOut = [null]
    this.check(
      this.fnSynthesis(
        this.synthesizerPtr, modifiedJson, this.speakerId,
        this.defaultSynthOpts, wavLenOut, wavPtrOut
      ),
      'synthesis'
    )
    const wavLen = Number(wavLenOut[0])
    const wavPtr = wavPtrOut[0]

    const wavBytes = koffi.decode(wavPtr, koffi.array('uint8', wavLen)) as number[]
    const result = Buffer.from(wavBytes)
    this.fnWavFree(wavPtr)

    return result
  }

  async ping(): Promise<boolean> {
    return this.synthesizerPtr !== null
  }

  dispose(): void {
    if (this.synthesizerPtr && this.fnSynthesizerDelete) {
      this.fnSynthesizerDelete(this.synthesizerPtr)
      this.synthesizerPtr = null
    }
    if (this.lib) {
      koffi.unload(this.lib)
      this.lib = null
    }
  }

  private check(rc: number, ctx: string): void {
    if (rc !== VOICEVOX_RESULT_OK) {
      const msg = this.fnErrorMsg ? this.fnErrorMsg(rc) : `code=${rc}`
      throw new Error(`[VoicevoxCore] ${ctx} failed: ${msg}`)
    }
  }
}
