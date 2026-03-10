/**
 * TtsProvider — TTS バックエンド共通インターフェース
 * 実装: VoicevoxHttpClient (HTTP API) / VoicevoxCoreClient (DLL直接)
 */
export interface TtsProvider {
  synthesize(text: string, speedScale?: number): Promise<Buffer>
  ping(): Promise<boolean>
}
