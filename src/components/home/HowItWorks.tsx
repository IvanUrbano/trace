import { motion, useReducedMotion } from 'framer-motion'
import { Search, ShieldCheck, ClipboardList, Handshake } from 'lucide-react'
import { RevealOnScroll } from '../motion'

const steps = [
  {
    icon: ClipboardList,
    title: 'Report',
    description: 'Submit a lost or found item with photos and a description.',
  },
  {
    icon: Search,
    title: 'Discover',
    description: 'Search listings or review AI-suggested possible matches.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify',
    description: 'Answer private ownership questions reviewed by an authorized person.',
  },
  {
    icon: Handshake,
    title: 'Return',
    description: 'Arrange a verified handoff and record the item’s return.',
  },
]

export function HowItWorks() {
  const reduce = useReducedMotion()
  return (
    <section id="how-it-works" className="py-24 lg:py-32" aria-labelledby="how-heading">
      <div className="container-x">
        <RevealOnScroll>
          <p className="eyebrow">How It Works</p>
          <h2 id="how-heading" className="h2-section mt-4 max-w-2xl">
            Four steps. One less thing to worry about.
          </h2>
        </RevealOnScroll>

        <div className="relative mt-16">
          <motion.div
            className="absolute left-0 right-0 top-6 hidden h-px bg-line lg:block"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: [0.21, 0.6, 0.35, 1] }}
            style={{ transformOrigin: 'left' }}
            aria-hidden
          />
          <ol className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {steps.map((step, i) => (
              <motion.li
                key={step.title}
                className="relative"
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.65, delay: i * 0.12, ease: [0.21, 0.6, 0.35, 1] }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper">
                  <step.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                  Step {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{step.description}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
