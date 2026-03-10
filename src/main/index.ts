import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { ConversationOrchestrator } from './orchestrator/ConversationOrchestrator'
import { GroqSTTClient } from './asr/GroqSTTClient'
import { createLLMProvider } from './llm/LLMProviderFactory'
import { createTtsProvider } from './tts/TtsProviderFactory'


const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Sentinel',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:54321')
    win.webContents.openDevTools({ mode: 'bottom' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  const win = createWindow()
  const env = import.meta.env as Record<string, string | undefined>
  const llmProvider = createLLMProvider(env)
  const ttsProvider = await createTtsProvider(env)
  const orchestrator = new ConversationOrchestrator(win, llmProvider, ttsProvider)

  const groqApiKey = env.MAIN_VITE_GROQ_API_KEY
  const validGroqKey = groqApiKey && groqApiKey !== 'your_groq_api_key_here' ? groqApiKey : undefined
  const stt = validGroqKey ? new GroqSTTClient(validGroqKey) : null

  // 起動時初期化（VOICEVOX確認 + キャッシュロード）
  win.webContents.once('did-finish-load', async () => {
    const ttsMode = (env.MAIN_VITE_TTS_PROVIDER ?? 'http').toLowerCase()
    const ttsBase = env.MAIN_VITE_TTS_BASE_URL ?? 'http://localhost:50021'
    win.webContents.send('log', 'info', `[TTS] ${ttsMode} — ${ttsBase}`)

    const ok = await orchestrator.checkVoicevox()
    win.webContents.send('log', ok ? 'info' : 'error',
      ok
        ? ttsMode === 'core' ? '[VOICEVOX Core] 初期化済み' : `[TTS] 接続OK (${ttsBase})`
        : `[TTS] 接続失敗 — ${ttsBase} を確認してください`
    )

    if (ok) await orchestrator.loadCache()

    win.webContents.send('log', llmProvider ? 'info' : 'warn',
      llmProvider ? `[LLM] ${llmProvider.providerName} / ${llmProvider.modelName}` : '[LLM] プロバイダー未設定 — LLMなしモード')
    win.webContents.send('log', stt ? 'info' : 'warn',
      stt ? '[Groq STT] APIキー設定済み' : '[Groq STT] APIキー未設定 — テキスト入力モードのみ')
  })

  // テキスト入力
  ipcMain.on('text:submit', (_event, text: string) => {
    orchestrator.onText(text).catch(err => {
      win.webContents.send('log', 'error', `[Error] ${err.message}`)
    })
  })

  // 音声入力 (VAD確定後の webm blob)
  ipcMain.on('asr:audio', async (_event, audioBuffer: ArrayBuffer) => {
    if (!stt) {
      win.webContents.send('log', 'warn', '[STT] APIキー未設定のためスキップ')
      return
    }

    win.webContents.send('asr:status', 'processing')

    const t0 = performance.now()
    try {
      const text = await stt.transcribe(audioBuffer)
      const groqMs = performance.now() - t0

      win.webContents.send('log', 'info', `[Groq STT] "${text}" (${groqMs.toFixed(0)}ms)`)
      win.webContents.send('asr:transcript', text)
      win.webContents.send('asr:status', 'listening')

      if (text) {
        await orchestrator.onText(text)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      win.webContents.send('log', 'error', `[STT Error] ${msg}`)
      win.webContents.send('asr:status', 'listening')
    }
  })

  // TTS 停止
  ipcMain.on('tts:stop_request', () => {
    win.webContents.send('tts:stop')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('before-quit', () => {
    orchestrator.endSession()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
