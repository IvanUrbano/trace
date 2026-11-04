import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { AshLayer } from './AshLayer'
import { HeroMark } from './hero3d/HeroMark'
import { isWebGLAvailable } from './hero3d/webgl'
import { HERO_COPY, useHeroProgress } from './useHeroProgress'

const words = ['Lost', 'something?', "Let's", 'bring', 'it', 'back.']

export function HeroSection() {
  const reduce = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const handleChange = () => setIsDesktop(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  const cinematic = !reduce && isDesktop && isWebGLAvailable()

  const { scrollYProgress: rawProgress } = useScroll({
    target: sectionRef,
    offset: cinematic ? ['start start', 'end end'] : ['start start', 'end start'],
  })
  // Keep 540vh of story travel, then reserve 120vh for the final composition.
  const storyProgress = useTransform(rawProgress, [0, 540 / 660], [0, 1])
  const scrollYProgress = useHeroProgress(storyProgress, cinematic)
  const markProgress = useTransform(storyProgress, [0, 0.88], [0, 1])
  const hintOpacity = useTransform(rawProgress, [0, 0.1], [1, 0])
  return (
    <section ref={sectionRef} className={cn('relative', cinematic && 'h-[760vh]')}>
      <div
        className={cn(
          'flex min-h-screen flex-col justify-center overflow-hidden pt-24 pb-16',
          cinematic && 'sticky top-0',
        )}
      >
        {/* Soft background and subtle dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-mist via-paper to-paper"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage: 'radial-gradient(circle, #8F9DC0 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
          }}
        />

        <div className="container-x relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="relative">
        <AshLayer progress={scrollYProgress} active={cinematic} exit={HERO_COPY.introExit}>
          <motion.p
            className="eyebrow"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.21, 0.6, 0.35, 1] }}
          >
            A better way to find what&apos;s lost
          </motion.p>

          <h1 className="h1-display mt-6">
            {words.map((word, index) => (
              <motion.span
                key={word}
                className={`inline-block ${word === 'something?' ? 'bg-accentLight/40 px-1 -mx-1 text-ink' : ''}`}
                initial={reduce ? false : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.12 + index * 0.07, ease: [0.21, 0.6, 0.35, 1] }}
              >
                {word}&nbsp;
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="mt-6 max-w-lg text-lg leading-relaxed text-muted"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.62, ease: [0.21, 0.6, 0.35, 1] }}
          >
            Report missing belongings, discover found items, and reconnect people with the things
            that matter.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap gap-3"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.78, ease: [0.21, 0.6, 0.35, 1] }}
          >
            <Button asChildLink="/discover?type=lost" size="lg">
              Find My Item
            </Button>
            <Button asChildLink="/report?type=found" variant="secondary" size="lg">
              I Found Something
            </Button>
          </motion.div>

          <motion.p
            className="mt-10 text-sm text-muted"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            Every return is verified. Every handoff is recorded.
          </motion.p>
        </AshLayer>
        {cinematic && (
          <>
            <AshLayer
              progress={scrollYProgress}
              active={cinematic}
              enter={HERO_COPY.matchingEnter}
              exit={HERO_COPY.matchingExit}
              ariaHidden
              className="pointer-events-none absolute inset-0 flex flex-col justify-center"
            >
              <p className="eyebrow">A possible connection</p>
              <p className="h2-section mt-4 max-w-xl">Possible matches, ranked.</p>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
                Compare found items by category, description, date, and location.
              </p>
            </AshLayer>
            <AshLayer
              progress={scrollYProgress}
              active={cinematic}
              enter={HERO_COPY.reviewEnter}
              ariaHidden
              className="pointer-events-none absolute inset-0 flex flex-col justify-center"
            >
              <p className="eyebrow">A careful return</p>
              <p className="h2-section mt-4 max-w-xl">A person reviews the claim.</p>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
                Only an approved claim can proceed to a recorded handoff.
              </p>
            </AshLayer>
          </>
        )}
        </div>

        {/* Scroll-responsive question mark */}
        <div data-testid="hero-stage" className="relative mx-auto h-[380px] w-full max-w-lg sm:h-[460px] lg:h-[520px]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[6%] inset-y-[5%] rounded-full bg-accentLight/20" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[2%] inset-y-[1%] rounded-full border border-dashed border-accentLight/60" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[18%] bottom-[8%] h-14 rounded-[50%] blur-[6px]" style={{ background: 'radial-gradient(ellipse, rgba(23,25,38,0.24), rgba(23,25,38,0.08) 38%, transparent 70%)' }} />
          <HeroMark progress={markProgress} />
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        aria-hidden
      >
        <motion.div style={reduce ? undefined : { opacity: hintOpacity }}>
          <ChevronDown className={`h-5 w-5 text-muted ${reduce ? '' : 'animate-scroll-hint'}`} />
        </motion.div>
      </motion.div>
      </div>
    </section>
  )
}
