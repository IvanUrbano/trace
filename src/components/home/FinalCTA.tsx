import { motion, useReducedMotion } from 'framer-motion'
import { RevealOnScroll } from '../motion'
import { Button } from '../ui/Button'

const ctaWords = ["Let's", 'get', 'your', 'belongings', 'home.']

export function FinalCTA() {
  const reduce = useReducedMotion()
  return (
    <section className="relative overflow-hidden bg-mist py-28 lg:py-36" aria-labelledby="cta-heading">
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[18vw] font-bold tracking-tightest text-ink/[0.035]"
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.21, 0.6, 0.35, 1] }}
      >
        TRACE
      </motion.span>

      <div className="container-x relative text-center">
        <h2 id="cta-heading" className="mx-auto flex max-w-2xl flex-wrap justify-center gap-x-[0.28em] gap-y-1">
          {ctaWords.map((w, i) => (
            <motion.span
              key={w}
              className="inline-block text-3xl font-semibold leading-[1.08] tracking-tightest sm:text-4xl lg:text-5xl"
              initial={reduce ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.21, 0.6, 0.35, 1] }}
            >
              {w}
            </motion.span>
          ))}
        </h2>

        <RevealOnScroll delay={0.45}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChildLink="/report?type=lost" size="lg">
              Report a Lost Item
            </Button>
            <Button asChildLink="/report?type=found" variant="secondary" size="lg">
              Report a Found Item
            </Button>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.6}>
          <p className="mt-8 text-sm text-muted">
            Free to report. Human-verified returns. Full audit trail.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
