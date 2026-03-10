/**
 * EpisodicMemoryStore
 * セッション単位の会話エピソードをJSONLファイルに永続保存し、
 * 次回起動時に関連エピソードをLLMコンテキストへ注入する。
 */

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

export type Episode = {
  id: string
  timestamp: number
  date: string                // YYYY-MM-DD
  topics: string[]            // 会話で出たトピック
  frequentHooks: string[]     // 頻出フック上位5件
  turnCount: number
  emotionSummary: 'positive' | 'negative' | 'neutral'
  sampleUtterances: string[]  // 印象的な発話サンプル最大3件
}

export class EpisodicMemoryStore {
  private episodes: Episode[] = []
  private readonly MAX_EPISODES = 50
  private filePath: string

  constructor(userDataPath: string) {
    const dir = join(userDataPath, 'memory')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'episodes.jsonl')
    this.load()
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      const lines = readFileSync(this.filePath, 'utf-8')
        .split('\n')
        .filter(Boolean)
      this.episodes = lines
        .map(line => JSON.parse(line) as Episode)
        .slice(-this.MAX_EPISODES)
    } catch {
      this.episodes = []
    }
  }

  saveEpisode(episode: Episode): void {
    this.episodes.push(episode)
    if (this.episodes.length > this.MAX_EPISODES) {
      this.episodes = this.episodes.slice(-this.MAX_EPISODES)
    }
    try {
      appendFileSync(this.filePath, JSON.stringify(episode) + '\n', 'utf-8')
    } catch (e) {
      console.error('[EpisodicMemory] write error:', e)
    }
  }

  /** フックに関連する直近エピソードを検索（最大3件） */
  findRelated(hooks: string[]): Episode[] {
    if (hooks.length === 0 || this.episodes.length === 0) return []
    const hookSet = new Set(hooks)
    return this.episodes
      .slice()
      .reverse()
      .filter(ep => ep.frequentHooks.some(h => hookSet.has(h)) || ep.topics.some(t => hookSet.has(t)))
      .slice(0, 3)
  }

  /** LLMコンテキスト用文字列を生成 */
  buildContextString(hooks: string[]): string {
    const related = this.findRelated(hooks)
    if (related.length === 0) return ''

    const lines = related.map(ep => {
      const hookStr = ep.frequentHooks.slice(0, 3).join('・')
      return `  - ${ep.date}: ${hookStr}について話した（${ep.turnCount}ターン、${ep.emotionSummary}な雰囲気）`
    })

    return `過去の会話:\n${lines.join('\n')}`
  }

  get episodeCount(): number {
    return this.episodes.length
  }
}
