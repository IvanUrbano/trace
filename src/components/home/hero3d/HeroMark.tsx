import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion, type MotionValue } from 'framer-motion'
import { QuestionMark } from '../QuestionMark'
import { isWebGLAvailable } from './webgl'

interface HeroMarkProps {
  progress: MotionValue<number>
}

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

export function HeroMark({ progress }: HeroMarkProps) {
  const reduce = useReducedMotion()
  const [failed, setFailed] = useState(false)
  const [webglOk] = useState(() => isWebGLAvailable())

  useEffect(() => {
    if (reduce) setFailed(true)
  }, [reduce])

  const fallback = <QuestionMark progress={progress} />

  if (reduce || failed || !webglOk) return fallback

  return (
    <SceneBoundary fallback={fallback} onFail={() => setFailed(true)}>
      <Suspense fallback={fallback}>
        <div
          data-testid="hero-question-mark"
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-fade-in"
          style={{ opacity: 0 }}
        >
          <LazyHeroScene progress={progress} onContextLost={() => setFailed(true)} />
        </div>
      </Suspense>
    </SceneBoundary>
  )
}
