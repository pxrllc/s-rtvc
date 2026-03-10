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
      bodyTemplateText: string | null
      classifyMs: number
    }
  | {
      ts: string
      type: 'llm_response'
      model: string
      text: string
      latencyMs: number
      usedInstead: 'body_template' | 'llm'  // 実際に再生されたのはどちら
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
    bodyTemplateText: string | null,
    classifyMs: number
  ): void {
    this.write({
      ts: new Date().toISOString(),
      type: 'algorithm_decision',
      intent: result.intent,
      confidence: result.confidence,
      method: result.method,
      onsetText,
      bodyTemplateText,
      classifyMs
    })
  }

  logLLMResponse(
    text: string,
    latencyMs: number,
    usedInstead: 'body_template' | 'llm'
  ): void {
    this.write({
      ts: new Date().toISOString(),
      type: 'llm_response',
      model: 'llama-3.1-8b-instant',
      text,
      latencyMs,
      usedInstead
    })
  }

  getLogDir(): string {
    return this.logDir
  }
}
