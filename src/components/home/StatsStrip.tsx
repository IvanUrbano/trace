import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../lib/store'

interface StatData { value: number; label: string }

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!active) return
    if (reduce) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration, reduce])
  return value
}

function Stat({ stat, active, index }: { stat: StatData; active: boolean; index: number }) {
  const value = useCountUp(stat.value, active)
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="border-line px-6 py-8 text-center md:border-l md:first:border-l-0"
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={active ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.21, 0.6, 0.35, 1] }}
    >
      <p className="font-mono text-4xl font-semibold tracking-tightest text-accent sm:text-5xl">
        {value.toLocaleString()}
      </p>
      <p className="mt-2 text-sm text-muted">{stat.label}</p>
    </motion.div>
  )
}

export function StatsStrip() {
  const { items, claims } = useStore()
  const stats: StatData[] = [
    { value: items.length, label: 'Demo reports' },
    { value: items.filter((item) => item.type === 'found' && item.status !== 'returned').length, label: 'Found items listed' },
    { value: claims.length, label: 'Claims submitted' },
    { value: items.filter((item) => item.status === 'returned').length, label: 'Items marked returned' },
  ]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <section ref={ref} className="border-y border-line bg-paper" aria-label="Demo activity in this browser">
      <div className="container-x grid grid-cols-2 divide-line md:grid-cols-4">
        {stats.map((s, i) => (
          <Stat key={s.label} stat={s} active={inView} index={i} />
        ))}
      </div>
    </section>
  )
}
