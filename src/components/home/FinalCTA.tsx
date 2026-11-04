import { motion, useReducedMotion } from 'framer-motion'
import { RevealOnScroll } from '../motion'
import { Button } from '../ui/Button'

const ctaWords = ["Let's", 'get', 'your', 'belongings', 'home.']

export function FinalCTA() {
  const reduce = useReducedMotion()
  return (
    <section className="relative overflow-hidden bg-ink py-28 text-paper lg:py-36" aria-labelledby="cta-heading">
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[18vw] font-bold tracking-tightest text-accentLight/10 sm:block"
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.21, 0.6, 0.35, 1] }}
      >
        TRACE
      </motion.span>

      <div className="container-x relative text-center">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.22em] text-accentLight">The next step is yours</p>
        <h2 id="cta-heading" className="mx-auto flex max-w-2xl flex-wrap justify-center gap-x-[0.38em] gap-y-1">
          {ctaWords.map((w, i) => (
            <motion.span
              key={w}
              className={`inline-block text-3xl font-semibold leading-[1.08] tracking-tightest sm:text-4xl lg:text-5xl${i === ctaWords.length - 1 ? ' text-accentLight' : ''}`}
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
            <Button asChildLink="/report?type=lost" variant="inverse" size="lg">
              Report a Lost Item
            </Button>
            <Button asChildLink="/report?type=found" variant="inverseOutline" size="lg">
              Report a Found Item
            </Button>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.6}>
          <p className="mt-8 text-sm text-paper/75">
            Free to report. Human-reviewed claims. Recorded handoffs.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
