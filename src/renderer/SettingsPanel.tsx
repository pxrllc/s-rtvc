import { useState, useEffect } from 'react'

type Config = {
  // STT
  groqApiKey?: string
  // TTS
  ttsProvider?: string
  ttsBaseUrl?: string
  voicevoxSpeakerId?: number
  // LLM
  llmProvider?: string
  groqModel?: string
  openaiApiKey?: string
  openaiModel?: string
  geminiApiKey?: string
  geminiModel?: string
  claudeApiKey?: string
  claudeModel?: string
  ollamaModel?: string
  ollamaBaseUrl?: string
}

const TTS_PROVIDERS = [
  { value: 'http',      label: 'VOICEVOX (HTTP)',  defaultUrl: 'http://localhost:50021' },
  { value: 'coeiroink', label: 'COEIROINK',         defaultUrl: 'http://localhost:50032/v1' },
  { value: 'core',      label: 'VOICEVOX Core (DLL)', defaultUrl: '' },
]

const LLM_PROVIDERS = [
  { value: 'groq',   label: 'Groq' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'ollama', label: 'Ollama (ローカル)' },
]

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [cfg, setCfg] = useState<Config>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.sentinel.getConfig().then(c => setCfg(c as Config))
  }, [])

  const set = (key: keyof Config, value: string | number | undefined) => {
    setCfg(prev => ({ ...prev, [key]: value }))
  }

  const handleTtsProviderChange = (value: string) => {
    const def = TTS_PROVIDERS.find(p => p.value === value)
    setCfg(prev => ({
      ...prev,
      ttsProvider: value,
      ttsBaseUrl: def?.defaultUrl ?? prev.ttsBaseUrl,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    await window.sentinel.saveConfig(cfg as Record<string, unknown>)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const llm = cfg.llmProvider ?? 'groq'

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.panel}>
        <div style={S.panelHeader}>
          <span style={S.panelTitle}>設定</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>

          {/* ── STT ─────────────────────────────────────────────── */}
          <Section title="STT（音声認識）">
            <Field label="Groq API Key">
              <SecretInput
                value={cfg.groqApiKey ?? ''}
                onChange={v => set('groqApiKey', v)}
                placeholder="gsk_..."
              />
              <Hint>Groq Whisper で音声認識。未設定ならテキスト入力のみ。</Hint>
            </Field>
          </Section>

          {/* ── TTS ─────────────────────────────────────────────── */}
          <Section title="TTS（音声合成）">
            <Field label="プロバイダー">
              <select
                style={S.select}
                value={cfg.ttsProvider ?? 'http'}
                onChange={e => handleTtsProviderChange(e.target.value)}
              >
                {TTS_PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="ベース URL">
              <input
                style={S.input}
                value={cfg.ttsBaseUrl ?? ''}
                onChange={e => set('ttsBaseUrl', e.target.value)}
                placeholder="http://localhost:50021"
              />
              <Hint>VOICEVOX: :50021 / COEIROINK: :50032/v1</Hint>
            </Field>
            <Field label="スピーカー ID">
              <input
                style={{ ...S.input, width: 80 }}
                type="number"
                min={0}
                value={cfg.voicevoxSpeakerId ?? 0}
                onChange={e => set('voicevoxSpeakerId', parseInt(e.target.value) || 0)}
              />
            </Field>
          </Section>

          {/* ── LLM ─────────────────────────────────────────────── */}
          <Section title="LLM（言語モデル）">
            <Field label="プロバイダー">
              <select
                style={S.select}
                value={llm}
                onChange={e => set('llmProvider', e.target.value)}
              >
                {LLM_PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>

            {llm === 'groq' && (
              <>
                <Field label="モデル">
                  <input style={S.input} value={cfg.groqModel ?? ''} onChange={e => set('groqModel', e.target.value)} placeholder="llama-3.3-70b-versatile" />
                </Field>
                <Field label="API Key">
                  <SecretInput value={cfg.groqApiKey ?? ''} onChange={v => set('groqApiKey', v)} placeholder="gsk_（STT と共用）" />
                </Field>
              </>
            )}

            {llm === 'openai' && (
              <>
                <Field label="モデル">
                  <input style={S.input} value={cfg.openaiModel ?? ''} onChange={e => set('openaiModel', e.target.value)} placeholder="gpt-4o-mini" />
                </Field>
                <Field label="API Key">
                  <SecretInput value={cfg.openaiApiKey ?? ''} onChange={v => set('openaiApiKey', v)} placeholder="sk-..." />
                </Field>
              </>
            )}

            {llm === 'gemini' && (
              <>
                <Field label="モデル">
                  <input style={S.input} value={cfg.geminiModel ?? ''} onChange={e => set('geminiModel', e.target.value)} placeholder="gemini-2.0-flash" />
                </Field>
                <Field label="API Key">
                  <SecretInput value={cfg.geminiApiKey ?? ''} onChange={v => set('geminiApiKey', v)} placeholder="AIza..." />
                </Field>
              </>
            )}

            {llm === 'claude' && (
              <>
                <Field label="モデル">
                  <input style={S.input} value={cfg.claudeModel ?? ''} onChange={e => set('claudeModel', e.target.value)} placeholder="claude-sonnet-4-6" />
                </Field>
                <Field label="API Key">
                  <SecretInput value={cfg.claudeApiKey ?? ''} onChange={v => set('claudeApiKey', v)} placeholder="sk-ant-..." />
                </Field>
              </>
            )}

            {llm === 'ollama' && (
              <>
                <Field label="モデル">
                  <input style={S.input} value={cfg.ollamaModel ?? ''} onChange={e => set('ollamaModel', e.target.value)} placeholder="phi3" />
                </Field>
                <Field label="URL">
                  <input style={S.input} value={cfg.ollamaBaseUrl ?? ''} onChange={e => set('ollamaBaseUrl', e.target.value)} placeholder="http://localhost:11434" />
                </Field>
              </>
            )}
          </Section>

        </div>

        {/* フッター */}
        <div style={S.footer}>
          <span style={{ color: '#555', fontSize: 11 }}>
            保存後にサービスを自動再起動します
          </span>
          <button
            style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : saved ? '✓ 保存済み' : '保存して適用'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── サブコンポーネント ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={S.sectionBody}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      <div>{children}</div>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={S.hint}>{children}</div>
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        style={{ ...S.input, flex: 1 }}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button style={S.toggleBtn} onClick={() => setShow(s => !s)}>{show ? '🙈' : '👁'}</button>
    </div>
  )
}

// ── スタイル ──────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    zIndex: 100,
  },
  panel: {
    width: 420, maxWidth: '100vw', height: '100vh',
    background: '#141414', borderLeft: '1px solid #2a2a2a',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'monospace',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid #222',
  },
  panelTitle: { color: '#fff', fontWeight: 700, fontSize: 15 },
  closeBtn: {
    background: 'none', border: 'none', color: '#666',
    cursor: 'pointer', fontSize: 16, padding: '2px 6px',
  },
  body: { flex: 1, overflowY: 'auto', padding: '16px' },
  footer: {
    padding: '12px 16px', borderTop: '1px solid #222',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  sectionTitle: {
    color: '#6fcf6f', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', marginBottom: 10, paddingBottom: 4,
    borderBottom: '1px solid #1e2e1e',
  },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { color: '#888', fontSize: 11 },
  hint: { color: '#444', fontSize: 10, marginTop: 2 },
  input: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e0e0e0',
    padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  select: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e0e0e0',
    padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
    width: '100%',
  },
  toggleBtn: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888',
    padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
  },
  saveBtn: {
    background: '#2d5a2d', color: '#6fcf6f', border: 'none',
    padding: '8px 20px', borderRadius: 4, cursor: 'pointer',
    fontSize: 13, fontWeight: 700,
  },
}
