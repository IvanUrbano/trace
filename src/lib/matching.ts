import type { Item } from './types'

export interface MatchResult {
  item: Item
  score: number
  textScore: number
  locationScore: number
  dateScore: number
  reasons: string[]
}

const DAY_MS = 86_400_000
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'has', 'in', 'is', 'it', 'near',
  'of', 'on', 'or', 'the', 'to', 'was', 'with', 'found', 'lost', 'item',
])

function tokens(item: Item): string[] {
  const text = `${item.title} ${item.title} ${item.description}`
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word)
}

function textSimilarity(left: string[], right: string[], documentFrequency: Map<string, number>, total: number): number {
  const vector = (words: string[]) => {
    const counts = new Map<string, number>()
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)
    const weights = new Map<string, number>()
    for (const [word, count] of counts) {
      const idf = Math.log((total + 1) / ((documentFrequency.get(word) ?? 0) + 1)) + 1
      weights.set(word, count * idf)
    }
    return weights
  }

  const a = vector(left)
  const b = vector(right)
  const magnitude = (v: Map<string, number>) => Math.sqrt([...v.values()].reduce((sum, weight) => sum + weight * weight, 0))
  const denominator = magnitude(a) * magnitude(b)
  if (!denominator) return 0
  let dot = 0
  for (const [word, weight] of a) dot += weight * (b.get(word) ?? 0)
  return dot / denominator
}

/** Ranks public listing details only. Scores are ranking signals, not ownership probabilities. */
export function rankFoundMatches(lost: Item, items: Item[], limit = 3): MatchResult[] {
  if (lost.type !== 'lost' || lost.status === 'returned' || limit <= 0) return []

  const candidates = items.filter((item) =>
    item.type === 'found' && item.status !== 'returned' && item.category === lost.category && item.id !== lost.id,
  )
  const documents = [lost, ...candidates].map(tokens)
  const documentFrequency = new Map<string, number>()
  for (const words of documents) {
    for (const word of new Set(words)) documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1)
  }

  return candidates.map((item, index) => {
    const textScore = textSimilarity(documents[0], documents[index + 1], documentFrequency, documents.length)
    const locationScore = item.location.trim().toLowerCase() === lost.location.trim().toLowerCase() ? 1 : 0
    const elapsed = Math.abs(Date.parse(item.date) - Date.parse(lost.date)) / DAY_MS
    const dateScore = Number.isFinite(elapsed) ? 1 / (1 + elapsed / 7) : 0
    const score = Math.round(100 * (0.45 * textScore + 0.30 + 0.15 * locationScore + 0.10 * dateScore))
    const reasons = ['Same category']
    if (textScore >= 0.15) reasons.push('Similar description')
    if (locationScore) reasons.push('Same location')
    if (elapsed <= 7) reasons.push('Dates within a week')
    return { item, score, textScore, locationScore, dateScore, reasons }
  }).filter((result) => result.score >= 45)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id)).slice(0, limit)
}
