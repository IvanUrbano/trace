/** The text mask and particles share this normalized leading edge. */
export function ashFadeEdge(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return 1.1 * t * t * (3 - 2 * t)
}

/** Move particles as soon as the 16%-wide mask starts to fade their glyph. */
export function ashParticlePhase(edge: number, position: number): number {
  // A longer trail gives dust time to travel. Compress only the far-right
  // glyphs' window so every fragment settles before the chapter ends.
  const travel = Math.max(0.08, Math.min(0.42, 1.18 - position))
  return Math.max(0, Math.min(1, (edge - position + 0.08) / travel))
}
