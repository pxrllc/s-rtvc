/**
 * LongTermMemoryStore
 * ユーザーの頻出トピック・フックをセッションをまたいで蓄積する。
 * userData/memory/longterm.json に永続保存。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

type LongTermData = {
  hookFrequency: Record<string, number>   // フック → 出現回数
  sessionCount: number
  lastUpdated: string
}

const DEFAULT_DATA: LongTermData = {
  hookFrequency: {},
  sessionCount: 0,
  lastUpdated: '',
}

export class LongTermMemoryStore {
  private data: LongTermData
  private filePath: string

  constructor(userDataPath: string) {
    const dir = join(userDataPath, 'memory')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'longterm.json')
    this.data = this.load()
  }

  private load(): LongTermData {
    if (!existsSync(this.filePath)) return { ...DEFAULT_DATA }
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as LongTermData
    } catch {
      return { ...DEFAULT_DATA }
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (e) {
      console.error('[LongTermMemory] write error:', e)
    }
  }

  /** セッション終了時に頻出フックを更新 */
  updateFromSession(allHooks: string[]): void {
    for (const hook of allHooks) {
      this.data.hookFrequency[hook] = (this.data.hookFrequency[hook] ?? 0) + 1
    }
    this.data.sessionCount++
    this.data.lastUpdated = new Date().toISOString()
    this.save()
  }

  /** 頻出トピック上位N件を返す */
  getFrequentTopics(n = 5): string[] {
    return Object.entries(this.data.hookFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([hook]) => hook)
  }

  /** LLMコンテキスト用文字列を生成 */
  buildContextString(): string {
    const topics = this.getFrequentTopics(5)
    if (topics.length === 0) return ''
    return `よく話すトピック: ${topics.join('、')}`
  }

  get sessionCount(): number {
    return this.data.sessionCount
  }
}
