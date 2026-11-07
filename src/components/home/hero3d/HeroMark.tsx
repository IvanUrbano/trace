import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion, type MotionValue } from 'framer-motion'
import { QuestionMark } from '../QuestionMark'
import { isWebGLAvailable } from './webgl'

interface HeroMarkProps {
  progress: MotionValue<number>
  endProgress: MotionValue<number>
}

const SETTLE_DELAY_MS = 300

interface BoundaryProps {
  fallback: ReactNode
  onFail: () => void
  children: ReactNode
}

class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onFail()
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

const LazyHeroScene = lazy(() => import('./HeroScene'))

export function HeroMark({ progress, endProgress }: HeroMarkProps) {
  const reduce = useReducedMotion()
  const [failed, setFailed] = useState(false)
  const [settled, setSettled] = useState(true)
  const [webglOk] = useState(() => isWebGLAvailable())

  useEffect(() => {
    if (reduce) setFailed(true)
  }, [reduce])

  useEffect(() => {
    let timer: number | undefined
    const onMove = () => {
      setSettled(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setSettled(true), SETTLE_DELAY_MS)
    }
    const stopProgress = progress.on('change', onMove)
    const stopEnd = endProgress.on('change', onMove)
    return () => {
      stopProgress()
      stopEnd()
      window.clearTimeout(timer)
    }
  }, [progress, endProgress])

  const fallback = <QuestionMark progress={progress} />

  if (reduce || failed || !webglOk) return fallback

  return (
    <SceneBoundary fallback={fallback} onFail={() => setFailed(true)}>
      <Suspense fallback={fallback}>
        <div
          data-testid="hero-idle-motion"
          data-bobbing={settled ? 'true' : 'false'}
          className={`pointer-events-none absolute inset-0 ${settled ? 'hero-idle-bob' : ''}`}
        >
        <div
          data-testid="hero-question-mark"
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-fade-in"
          style={{ opacity: 0 }}
        >
          <LazyHeroScene progress={progress} onContextLost={() => setFailed(true)} />
        </div>
        </div>
      </Suspense>
    </SceneBoundary>
  )
}
