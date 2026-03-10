# Sentinel RTVC

リアルタイム音声会話 AI。ユーザーが話し終えた瞬間に相槌を返し、LLM の応答を続けて発話する **2フェーズ並列パイプライン** を採用しています。

```
ユーザー発話終了
    │
    ├─→ [意図分類] → [相槌選択] → [即時再生]        ← Phase 1（数ms）
    │
    └─→ [LLM生成] ──────────────→ [TTS合成] → [再生]  ← Phase 2（数百ms〜）
```

沈黙の時間をほぼゼロにすることで、AI との会話をより自然なリズムに近づけます。

---

## 動作環境

- **OS**: Windows 10 / 11 (x64)
- **TTS（音声合成）**: VOICEVOX または COEIROINK（どちらかをローカルで起動しておく）
- **STT（音声認識）**: Groq API（オプション。未設定時はテキスト入力のみ）
- **LLM**: Groq / OpenAI / Gemini / Claude / Ollama（いずれか）

---

## ダウンロードと起動

1. [Releases](../../releases) から `SentinelRTVC-vX.X.Xb-win-x64.exe` をダウンロード
2. ダブルクリックで起動（インストール不要）

> **ファイルの配置**
> EXE と同じフォルダに `sentinel-config.json` が自動生成されます。設定はアプリ内の ⚙ パネルからも変更できます。

---

## セットアップ

### 1. TTS を準備する

どちらかをローカルで起動してください。

| TTS | 起動後のURL | デフォルトスピーカーID |
|---|---|---|
| [VOICEVOX](https://voicevox.hiroshiba.jp/) | `http://localhost:50021` | 1（四国めたん） |
| [COEIROINK](https://coeiroink.com/) | `http://localhost:50032/v1` | 0 |

### 2. API キーを取得する（STT / LLM）

| サービス | 取得先 | 用途 |
|---|---|---|
| [Groq](https://console.groq.com/) | `gsk_...` | STT（Whisper） + LLM |
| [OpenAI](https://platform.openai.com/) | `sk-...` | LLM のみ |
| [Gemini](https://aistudio.google.com/) | `AIza...` | LLM のみ |
| [Anthropic](https://console.anthropic.com/) | `sk-ant-...` | LLM のみ |
| Ollama | キー不要 | LLM のみ（ローカル） |

STT には Groq のみ対応しています。LLM はいずれか1つを設定してください。

### 3. アプリ内で設定する

右上の **⚙** ボタンをクリックすると設定パネルが開きます。

```
STT
  └─ Groq API Key          gsk_...

TTS
  ├─ プロバイダー           VOICEVOX / COEIROINK （ポートが２つで異なるかも）
  ├─ ベース URL             http://localhost:50021
  └─ スピーカー ID          0, 1, 2, ...

LLM
  ├─ プロバイダー           Groq / OpenAI / Gemini / Claude / Ollama
  ├─ API Key               各プロバイダーのキー
  └─ モデル                llama-3.3-70b-versatile など
```

「**保存して適用**」を押すと設定が即座に反映されます（再起動不要）。

---

## 使い方

### マイク入力

1. 🎤 ボタンを押す（またはクリック）
2. 話す → 発話が止まると自動で認識が始まる
3. AI が相槌 → 本回答の順で発話する
4. ⏹ ボタンで停止

### テキスト入力

1. 下部のテキストボックスに入力
2. `Enter` または「送信」ボタン

---

## 設定ファイル（上級者向け）

EXE と同じフォルダの `sentinel-config.json` を直接編集することもできます。

```json
{
  "ttsProvider": "coeiroink",
  "ttsBaseUrl": "http://localhost:50032/v1",
  "voicevoxSpeakerId": 0,
  "llmProvider": "groq",
  "groqApiKey": "gsk_...",
  "groqModel": "llama-3.3-70b-versatile"
}
```

| キー | 説明 | 例 |
|---|---|---|
| `ttsProvider` | TTS エンジン | `"http"` / `"coeiroink"` / `"core"` |
| `ttsBaseUrl` | TTS の接続先 | `"http://localhost:50021"` |
| `voicevoxSpeakerId` | スピーカー ID | `1` |
| `llmProvider` | LLM プロバイダー | `"groq"` / `"openai"` / `"gemini"` / `"claude"` / `"ollama"` |
| `groqApiKey` | Groq API Key（STT + LLM 共用） | `"gsk_..."` |
| `groqModel` | Groq モデル名 | `"llama-3.3-70b-versatile"` |
| `openaiApiKey` | OpenAI API Key | `"sk-..."` |
| `openaiModel` | OpenAI モデル名 | `"gpt-4o-mini"` |
| `geminiApiKey` | Gemini API Key | `"AIza..."` |
| `geminiModel` | Gemini モデル名 | `"gemini-2.0-flash"` |
| `claudeApiKey` | Anthropic API Key | `"sk-ant-..."` |
| `claudeModel` | Claude モデル名 | `"claude-sonnet-4-6"` |
| `ollamaModel` | Ollama モデル名 | `"phi3"` |
| `ollamaBaseUrl` | Ollama URL | `"http://localhost:11434"` |

---

## トラブルシューティング

**TTS が鳴らない**
- VOICEVOX / COEIROINK が起動していることを確認してください
- 設定パネルの「ベース URL」と「スピーカー ID」が正しいか確認してください
- ログに `[TTS] 接続失敗` と出ている場合、URL を見直してください

**音声認識が動かない**
- Groq API Key が正しく設定されているか確認してください
- APIキー未設定の場合はテキスト入力のみ利用できます

**LLM が応答しない**
- API Key またはモデル名が正しいか確認してください
- Ollama の場合は `ollama serve` が起動しているか確認してください
- LLM 未設定でも相槌（Phase 1）は動作します

---

## ライセンス

MIT

---

## 関連

- [VOICEVOX](https://voicevox.hiroshiba.jp/)
- [COEIROINK](https://coeiroink.com/)
- [Groq](https://groq.com/)
