import { useEffect, useRef, useState, useCallback } from 'react'
import { WebAudioPlayer } from './audio/WebAudioPlayer'
import { MicCapture, type MicState } from './audio/MicCapture'

type LogEntry = {
  id: number
  level: 'info' | 'warn' | 'error'
  message: string
  time: string
}

type IntentBadge = {
  intent: string
  confidence: number
  latencyMs: number
}

declare global {
  interface Window {
    sentinel: {
      submitText: (text: string) => void
      submitAudio: (buf: ArrayBuffer) => void
      stopTts: () => void
      onPcm: (cb: (pcm: Float32Array, sampleRate: number) => void) => void
      onTtsStop: (cb: () => void) => void
      onLog: (cb: (level: string, message: string) => void) => void
      onIntentResult: (cb: (result: unknown, latencyMs: number) => void) => void
      onTranscript: (cb: (text: string) => void) => void
      onAsrStatus: (cb: (status: string) => void) => void
      removeAllListeners: () => void
    }
  }
}

let logCounter = 0

export default function App() {
  const [text, setText] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [intent, setIntent] = useState<IntentBadge | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [micState, setMicState] = useState<MicState>('idle')
  const [asrStatus, setAsrStatus] = useState<'idle' | 'processing'>('idle')
  const [lastTranscript, setLastTranscript] = useState('')

  const playerRef = useRef<WebAudioPlayer | null>(null)
  const micRef = useRef<MicCapture | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((level: 'info' | 'warn' | 'error', message: string) => {
    setLogs(prev => [...prev.slice(-200), {
      id: ++logCounter,
      level,
      message,
      time: new Date().toLocaleTimeString('ja-JP', { hour12: false })
    }])
  }, [])

  useEffect(() => {
    playerRef.current = new WebAudioPlayer()

    window.sentinel.onPcm((pcm, sampleRate) => {
      setIsPlaying(true)
      playerRef.current!.enqueue(pcm, sampleRate).then(() => setIsPlaying(false))
    })
    window.sentinel.onTtsStop(() => {
      playerRef.current!.stop()
      setIsPlaying(false)
    })
    window.sentinel.onLog((level, message) => addLog(level as LogEntry['level'], message))
    window.sentinel.onIntentResult((result: unknown, latencyMs: number) => {
      const r = result as { intent: string; confidence: number }
      setIntent({ intent: r.intent, confidence: r.confidence, latencyMs })
    })
    window.sentinel.onTranscript((t) => setLastTranscript(t))
    window.sentinel.onAsrStatus((s) => setAsrStatus(s as 'idle' | 'processing'))

    return () => window.sentinel.removeAllListeners()
  }, [addLog])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // マイク ON/OFF
  const toggleMic = useCallback(async () => {
    if (micState !== 'idle') {
      micRef.current?.stop()
      micRef.current = null
      setMicState('idle')
      return
    }

    const mic = new MicCapture()
    mic.onStateChange = (s) => setMicState(s)
    mic.onUtterance = async (blob) => {
      // 再生中の TTS を止めてから送信
      playerRef.current?.stop()
      setIsPlaying(false)
      const buf = await blob.arrayBuffer()
      window.sentinel.submitAudio(buf)
    }

    micRef.current = mic
    try {
      await mic.start()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      addLog('error', `[Mic] ${msg}`)
      setMicState('idle')
    }
  }, [micState, addLog])

  // テキスト送信
  const handleSubmit = useCallback(() => {
    const t = text.trim()
    if (!t) return
    playerRef.current?.stop()
    window.sentinel.submitText(t)
    setText('')
  }, [text])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={styles.root}>
      {/* ヘッダー */}
      <div style={styles.header}>
        <span style={styles.title}>Sentinel</span>
        <span style={styles.subtitle}>MVP — テキスト / 音声入力 → パターンマッチ → TTS</span>
      </div>

      {/* ステータスバー */}
      <div style={styles.statusBar}>
        {/* 意図バッジ */}
        {intent ? (
          <span style={styles.intentBadge}>
            <span style={styles.intentLabel}>{intent.intent}</span>
            <span style={styles.intentConf}>{(intent.confidence * 100).toFixed(0)}%</span>
            <span style={styles.intentLatency}>{intent.latencyMs.toFixed(1)}ms</span>
          </span>
        ) : (
          <span style={styles.intentPlaceholder}>意図: —</span>
        )}

        {/* マイク状態 */}
        <span style={{ ...styles.micStatus, color: micStateColor(micState) }}>
          {micState === 'idle' && '○ 待機'}
          {micState === 'listening' && '● 聴取中'}
          {micState === 'speaking' && '🎤 発話検出'}
        </span>

        {asrStatus === 'processing' && (
          <span style={styles.processingLabel}>⟳ STT処理中...</span>
        )}
        {isPlaying && <span style={styles.playingLabel}>♪ 再生中</span>}
      </div>

      {/* 直近トランスクリプト */}
      {lastTranscript && (
        <div style={styles.transcriptBanner}>
          <span style={styles.transcriptPrefix}>STT:</span>
          <span style={styles.transcriptText}>{lastTranscript}</span>
        </div>
      )}

      {/* ログ */}
      <div style={styles.logArea}>
        {logs.map(log => (
          <div key={log.id} style={{ ...styles.logLine, color: logColor(log.level) }}>
            <span style={styles.logTime}>{log.time}</span>
            <span>{log.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* 入力行 */}
      <div style={styles.inputRow}>
        <button
          style={{ ...styles.micBtn, background: micBtnBg(micState) }}
          onClick={toggleMic}
          title={micState === 'idle' ? 'マイクON' : 'マイクOFF'}
        >
          {micState === 'idle' ? '🎤' : '⏹'}
        </button>

        <input
          style={styles.input}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="テキスト入力 または 🎤 で音声入力..."
          autoFocus
        />
        <button style={styles.sendBtn} onClick={handleSubmit} disabled={!text.trim()}>
          送信
        </button>
        <button
          style={styles.stopBtn}
          onClick={() => { playerRef.current?.stop(); setIsPlaying(false) }}
        >
          停止
        </button>
      </div>
    </div>
  )
}

function micStateColor(s: MicState) {
  if (s === 'idle') return '#444'
  if (s === 'listening') return '#4ecdc4'
  return '#ff6b6b'
}
function micBtnBg(s: MicState) {
  if (s === 'idle') return '#1a2a1a'
  if (s === 'listening') return '#1a3a3a'
  return '#3a1a1a'
}
function logColor(level: LogEntry['level']) {
  if (level === 'error') return '#ff6b6b'
  if (level === 'warn') return '#ffd93d'
  return '#a0aec0'
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#0f0f0f', color: '#e0e0e0', fontFamily: 'monospace'
  },
  header: {
    padding: '10px 16px', borderBottom: '1px solid #222',
    display: 'flex', alignItems: 'baseline', gap: '12px'
  },
  title: { fontSize: '18px', fontWeight: 700, color: '#fff' },
  subtitle: { fontSize: '11px', color: '#555' },

  statusBar: {
    padding: '6px 16px', borderBottom: '1px solid #1a1a1a',
    display: 'flex', alignItems: 'center', gap: '16px', minHeight: '34px', flexWrap: 'wrap'
  },
  intentBadge: {
    display: 'flex', gap: '8px', alignItems: 'center',
    background: '#1a2a1a', padding: '3px 10px', borderRadius: '4px'
  },
  intentLabel: { color: '#6fcf6f', fontWeight: 700, fontSize: '13px' },
  intentConf: { color: '#a0d0a0', fontSize: '12px' },
  intentLatency: { color: '#556', fontSize: '11px' },
  intentPlaceholder: { color: '#333', fontSize: '12px' },
  micStatus: { fontSize: '12px' },
  processingLabel: { color: '#ffd93d', fontSize: '12px' },
  playingLabel: { color: '#4ecdc4', fontSize: '12px' },

  transcriptBanner: {
    padding: '6px 16px', background: '#111820',
    borderBottom: '1px solid #1a2233', display: 'flex', gap: '8px'
  },
  transcriptPrefix: { color: '#445', fontSize: '12px', flexShrink: 0 },
  transcriptText: { color: '#8ab4f8', fontSize: '13px' },

  logArea: {
    flex: 1, overflowY: 'auto', padding: '8px 16px',
    fontSize: '12px', lineHeight: '1.7'
  },
  logLine: { display: 'flex', gap: '10px' },
  logTime: { color: '#333', flexShrink: 0 },

  inputRow: {
    display: 'flex', gap: '8px', padding: '10px 16px',
    borderTop: '1px solid #222'
  },
  micBtn: {
    border: 'none', padding: '8px 12px', borderRadius: '6px',
    cursor: 'pointer', fontSize: '16px'
  },
  input: {
    flex: 1, background: '#1a1a1a', border: '1px solid #333',
    color: '#e0e0e0', padding: '8px 12px', borderRadius: '6px',
    fontSize: '14px', outline: 'none'
  },
  sendBtn: {
    background: '#2d5a2d', color: '#6fcf6f', border: 'none',
    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  },
  stopBtn: {
    background: '#2a1a1a', color: '#ff6b6b', border: 'none',
    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
  }
}
