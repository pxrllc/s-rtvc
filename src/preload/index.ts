import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sentinel', {
  submitText: (text: string) => ipcRenderer.send('text:submit', text),
  submitAudio: (arrayBuffer: ArrayBuffer) => ipcRenderer.send('asr:audio', arrayBuffer),
  stopTts: () => ipcRenderer.send('tts:stop_request'),

  onPcm: (cb: (pcm: Float32Array, sampleRate: number, id: string) => void) => {
    ipcRenderer.on('tts:pcm', (_e, pcm, sampleRate, id) => cb(pcm, sampleRate, id))
  },
  // body をキャンセルして LLM PCM をエンキュー
  onCancelAndEnqueue: (cb: (cancelId: string, pcm: Float32Array, sampleRate: number) => void) => {
    ipcRenderer.on('tts:cancel_and_enqueue', (_e, cancelId, pcm, sampleRate) =>
      cb(cancelId, pcm, sampleRate)
    )
  },
  onTtsStop: (cb: () => void) => {
    ipcRenderer.on('tts:stop', () => cb())
  },
  onLog: (cb: (level: string, message: string) => void) => {
    ipcRenderer.on('log', (_e, level, message) => cb(level, message))
  },
  onIntentResult: (cb: (result: unknown, latencyMs: number) => void) => {
    ipcRenderer.on('intent:result', (_e, result, latencyMs) => cb(result, latencyMs))
  },
  onTranscript: (cb: (text: string) => void) => {
    ipcRenderer.on('asr:transcript', (_e, text) => cb(text))
  },
  onAsrStatus: (cb: (status: string) => void) => {
    ipcRenderer.on('asr:status', (_e, status) => cb(status))
  },

  removeAllListeners: () => {
    for (const ch of [
      'tts:pcm', 'tts:cancel_and_enqueue', 'tts:stop',
      'log', 'intent:result', 'asr:transcript', 'asr:status'
    ]) {
      ipcRenderer.removeAllListeners(ch)
    }
  }
})
