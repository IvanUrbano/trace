import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { TimelineEvent } from '../lib/types'
import { formatDate } from '../lib/utils'

export function StatusTimeline({ events }: { events: TimelineEvent[] }) {
  const reduce = useReducedMotion()
  return (
    <ol className="relative space-y-0">
      {events.map((ev, i) => {
        const isLast = i === events.length - 1
        return (
          <motion.li
            key={ev.id}
            className="relative flex gap-4 pb-8 last:pb-0"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.21, 0.6, 0.35, 1] }}
          >
            <div className="relative flex flex-col items-center">
              <span
                className={`z-10 flex h-6 w-6 items-center justify-center rounded-full border ${
                  ev.done ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-muted'
                }`}
              >
                {ev.done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted" />}
              </span>
              {!isLast && (
                <motion.span
                  className="absolute top-6 h-[calc(100%-8px)] w-px bg-line"
                  initial={reduce ? false : { scaleY: 0 }}
                  whileInView={reduce ? undefined : { scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.1 + 0.15 }}
                  style={{ transformOrigin: 'top' }}
                />
              )}
            </div>
            <div className="-mt-0.5 flex-1">
              <p className={`text-sm font-semibold ${ev.done ? 'text-ink' : 'text-muted'}`}>{ev.label}</p>
              <p className="mt-0.5 text-sm text-muted">{ev.description}</p>
              <p className="mt-1 text-xs text-muted/70">{formatDate(ev.date)}</p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
