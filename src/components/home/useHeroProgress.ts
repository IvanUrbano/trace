import { useEffect } from 'react'
import { useMotionValue, type MotionValue } from 'framer-motion'

export const HERO_COPY = {
  introExit: [0.32, 0.54],
  matchingEnter: [0.52, 0.66],
  matchingExit: [0.76, 0.86],
  reviewEnter: [0.85, 0.96],
} as const

/** Demand-driven, reversible catch-up: fast input still traverses each text dissolve. */
export function useHeroProgress(source: MotionValue<number>, active: boolean) {
  const displayed = useMotionValue(source.get())
  useEffect(() => {
    let frame = 0
    let previousTime = 0
    let target = source.get()
    displayed.set(target)
    const tick = (time: number) => {
      const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.04) : 1 / 60
      previousTime = time
      const current = displayed.get()
      const difference = target - current
      if (Math.abs(difference) < 0.0001) {
        displayed.set(target)
        frame = 0
        previousTime = 0
        return
      }
      const transitioning = Object.values(HERO_COPY).some(([start, end]) => current >= start && current <= end)
      const rate = Math.min(transitioning ? 0.14 : 0.7, Math.abs(difference) * 7)
      displayed.set(current + Math.sign(difference) * Math.min(Math.abs(difference), rate * dt))
      frame = requestAnimationFrame(tick)
    }
    const unsubscribe = source.on('change', (value) => {
      target = value
      if (!active) displayed.set(value)
      else if (!frame) frame = requestAnimationFrame(tick)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [source, active, displayed])
  return displayed
}
