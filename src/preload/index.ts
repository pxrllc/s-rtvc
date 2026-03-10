import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('sentinel', {
  submitText: (text: string) => ipcRenderer.send('text:submit', text),
  submitAudio: (arrayBuffer: ArrayBuffer) => ipcRenderer.send('asr:audio', arrayBuffer),
  stopTts: () => ipcRenderer.send('tts:stop_request'),

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),

  onPcm: (cb: (pcm: Float32Array, sampleRate: number, id: string) => void) => {
    ipcRenderer.on('tts:pcm', (_e, pcm, sampleRate, id) => cb(pcm, sampleRate, id))
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
      'tts:pcm', 'tts:stop',
      'log', 'intent:result', 'asr:transcript', 'asr:status'
    ]) {
      ipcRenderer.removeAllListeners(ch)
    }
  }
})
