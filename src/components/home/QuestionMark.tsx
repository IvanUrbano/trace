import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import type { MotionValue } from 'framer-motion'

const EASE: [number, number, number, number] = [0.21, 0.6, 0.35, 1]
const HOOK_PATH =
  'M 50 78 C 50 45 73 26 100 26 C 127 26 150 45 150 78 C 150 102 130 114 100 132 L 100 172'
const VIEW_BOX = '27 3 146 242'
const EXTRUDE_LAYERS = 16
const EXTRUDE_STEP = 2.5

function extrudeRgb(index: number): [number, number, number] {
  const from = [64, 80, 106]
  const to = [23, 25, 38]
  const t = index / (EXTRUDE_LAYERS - 1)
  return [0, 1, 2].map((i) => Math.round(from[i] + (to[i] - from[i]) * t)) as [number, number, number]
}

function OrbitRing({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion()
  const opacity = useTransform(progress, [0.04, 0.18, 0.8, 1], [0, 0.75, 0.75, 0])
  const scale = useSpring(useTransform(progress, [0.04, 0.2], [0.72, 1]), {
    stiffness: 120,
    damping: 20,
    mass: 0.5,
  })
  const rotate = useTransform(progress, [0, 1], [0, -220])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <motion.div
        data-testid="hero-orbit-ring"
        className="aspect-square h-[86%] rounded-full border border-dashed border-accent/40"
        style={reduce ? { opacity: 0.6 } : { opacity, scale, rotate }}
      />
    </div>
  )
}

function ExtrudeLayer({ index, alpha, reduce }: {
  index: number
  alpha: MotionValue<number>
  reduce: boolean
}) {
  const [r, g, b] = extrudeRgb(index)
  const animated = useTransform(alpha, (a) => `rgba(${r}, ${g}, ${b}, ${a})`)
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center"
      style={{ color: reduce ? `rgb(${r}, ${g}, ${b})` : animated, z: -(index + 1) * EXTRUDE_STEP }}
    >
      <svg viewBox={VIEW_BOX} className="h-full w-auto max-w-full" focusable="false">
        <path d={HOOK_PATH} fill="none" stroke="currentColor" strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 83 222 a 17 17 0 1 0 34 0 a 17 17 0 1 0 -34 0 Z" fill="currentColor" />
      </svg>
    </motion.div>
  )
}

export function QuestionMark({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion()
  const spring = { stiffness: 90, damping: 22, mass: 0.5 }
  const y = useSpring(useTransform(progress, [0, 0.5, 1], [0, 8, 0]), spring)
  const rotateY = useSpring(useTransform(progress, [0, 1], [45, 65]), {
    stiffness: 140,
    damping: 30,
    mass: 0.5,
  })
  const scale = useSpring(useTransform(progress, [0, 1], [1, 0.8]), spring)
  const opacity = useTransform(progress, () => 1)
  const haloOpacity = useTransform(progress, [0, 0.55], [1, 0.15])

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: reduce ? 0.9 : haloOpacity }}>
        <div className="h-full w-full" style={{ background: 'radial-gradient(closest-side at 50% 46%, rgba(23,25,38,0.065) 0%, rgba(23,25,38,0.03) 45%, rgba(23,25,38,0) 76%)' }} />
      </motion.div>
      <OrbitRing progress={progress} />
      <motion.div
        className="relative z-10 h-full w-full"
        initial={reduce ? false : { opacity: 0, y: 28 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.95, ease: EASE, delay: 0.15 }}
      >
        <motion.div
          className="h-full w-full"
          animate={reduce ? undefined : { y: [0, -16, 0] }}
          transition={reduce ? undefined : { duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={reduce ? { rotateY: 45 } : { y, rotateY, scale, transformPerspective: 1400, transformStyle: 'preserve-3d' }}
          >
            {Array.from({ length: EXTRUDE_LAYERS }, (_, i) => (
              <ExtrudeLayer key={i} index={i} alpha={opacity} reduce={!!reduce} />
            ))}
          </motion.div>
          <motion.div
            data-testid="hero-question-mark"
            className="absolute inset-0 flex items-center justify-center"
            style={reduce ? { rotateY: 45 } : { y, rotateY, scale, opacity, transformPerspective: 1400 }}
          >
            <svg viewBox={VIEW_BOX} className="h-full w-auto max-w-full" aria-hidden focusable="false">
              <motion.path
                d={HOOK_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth={34}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
                initial={reduce ? false : { pathLength: 0 }}
                animate={reduce ? undefined : { pathLength: 1 }}
                transition={reduce ? undefined : { duration: 1.15, ease: EASE, delay: 0.3 }}
              />
              <motion.circle
                cx={100}
                cy={222}
                r={17}
                fill="currentColor"
                className="text-accent"
                initial={reduce ? false : { r: 0 }}
                animate={reduce ? undefined : { r: 17 }}
                transition={reduce ? undefined : { type: 'spring', stiffness: 220, damping: 16, delay: 1.15 }}
              />
            </svg>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
