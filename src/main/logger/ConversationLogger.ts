import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import type { IntentClassification } from '../../shared/intent-patterns'

type LogEntry =
  | {
      ts: string
      type: 'user_input'
      text: string
    }
  | {
      ts: string
      type: 'algorithm_decision'
      intent: string
      confidence: number
      method: 'rule' | 'llm'
      onsetText: string
      classifyMs: number
    }
  | {
      ts: string
      type: 'llm_response'
      model: string
      text: string
      latencyMs: number
    }

export class ConversationLogger {
  private logDir: string

  constructor(userDataPath: string) {
    this.logDir = join(userDataPath, 'logs')
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  private get logPath(): string {
    const date = new Date().toISOString().slice(0, 10)
    return join(this.logDir, `conversation-${date}.jsonl`)
  }

  private write(entry: LogEntry): void {
    try {
      appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf-8')
    } catch (e) {
      console.error('[Logger] write error:', e)
    }
  }

  logUserInput(text: string): void {
    this.write({ ts: new Date().toISOString(), type: 'user_input', text })
  }

  logAlgorithmDecision(
    result: IntentClassification,
    onsetText: string,
    classifyMs: number
  ): void {
    this.write({
      ts: new Date().toISOString(),
      type: 'algorithm_decision',
      intent: result.intent,
      confidence: result.confidence,
      method: result.method,
      onsetText,
      classifyMs
    })
  }

  logLLMResponse(text: string, latencyMs: number): void {
    this.write({
      ts: new Date().toISOString(),
      type: 'llm_response',
      model: 'llama-3.3-70b-versatile',
      text,
      latencyMs
    })
  }

  getLogDir(): string {
    return this.logDir
  }
}
