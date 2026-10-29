import { motion } from 'framer-motion'
import { ArrowLeftRight, CalendarCheck, Layers } from 'lucide-react'
import { ImageReveal, RevealOnScroll } from '../motion'
import { StatusBadge } from '../ui/StatusBadge'

const matches = [
  {
    title: 'Black Leather Wallet',
    location: 'University Library',
    date: '2 days ago',
    similarity: 87,
    label: 'Strong candidate',
    image: '/img/wallet.jpg',
  },
  {
    title: 'Brown Bi-Fold Wallet',
    location: 'Student Union',
    date: '5 days ago',
    similarity: 62,
    label: 'Possible candidate',
    image: '/img/wallet.jpg',
  },
]

const indicators = [
  {
    icon: ArrowLeftRight,
    label: 'Description similarity',
    value: 87,
  },
  {
    icon: Layers,
    label: 'Category compatibility',
    value: 100,
  },
  {
    icon: CalendarCheck,
    label: 'Date and location relevance',
    value: 74,
  },
]

export function SmartMatching() {
  return (
    <section className="bg-mist py-24 lg:py-32" aria-labelledby="matching-heading">
      <div className="container-x grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
        <div>
          <RevealOnScroll>
            <p className="eyebrow">Smart Matching</p>
            <h2 id="matching-heading" className="h2-section mt-4">
              Found a match.
              <br />
              Not a guess.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              TRACE ranks possible matches using descriptions, categories, dates, and locations —
              so reviewers start from the strongest candidates instead of an empty search box.
            </p>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15}>
            <ul className="mt-10 space-y-5">
              {indicators.map((ind) => (
                <li key={ind.label} className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-line bg-paper">
                    <ind.icon className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-sm font-medium">{ind.label}</p>
                      <p className="font-mono text-xs text-muted">{ind.value}% illustrative</p>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
                      <motion.div
                        className="h-full rounded-full bg-ink"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${ind.value}%` }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 1, delay: 0.2, ease: [0.21, 0.6, 0.35, 1] }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </RevealOnScroll>

          <RevealOnScroll delay={0.25}>
            <p className="mt-10 border-t border-line pt-6 text-sm font-medium">
              AI helps identify possibilities. People verify ownership.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Similarity scores shown here are illustrative suggestions for ranking candidates —
              they are not probabilities of ownership, verified claims, or predictions from a live
              model. Ownership is confirmed only through the verification workflow.
            </p>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delay={0.1}>
          <div className="rounded-[4px] border border-line bg-paper p-6 shadow-[0_16px_50px_rgba(0,0,0,0.05)] sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Your lost report
            </p>
            <div className="mt-4 flex gap-4 border-b border-line pb-6">
              <ImageReveal src="/img/wallet.jpg" alt="Lost brown bi-fold wallet" className="h-24 w-24 shrink-0 rounded-[3px]" />
              <div>
                <h3 className="font-semibold tracking-tight">Brown Bi-Fold Wallet</h3>
                <p className="mt-1 text-sm text-muted">Lost near Student Union · 2 days ago</p>
                <p className="mt-2 inline-block">
                  <StatusBadge status="active" />
                </p>
              </div>
            </div>

            <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Possible found matches
            </p>
            <ul className="mt-4 space-y-4">
              {matches.map((m, i) => (
                <motion.li
                  key={m.title}
                  className="flex items-center gap-4 rounded-[3px] border border-line bg-mist/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-ink hover:bg-paper hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)]"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.12, ease: [0.21, 0.6, 0.35, 1] }}
                >
                  <img
                    src={m.image}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-[3px] object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {m.location} · {m.date}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                      {m.label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <motion.p
                      className="font-mono text-lg font-semibold"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.4 + i * 0.12 }}
                    >
                      {m.similarity}%
                    </motion.p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted">illustrative</p>
                  </div>
                </motion.li>
              ))}
            </ul>
            <p className="mt-6 text-[11px] leading-relaxed text-muted">
              Scores are illustrative similarity indicators for ranking — not verified ownership or
              model predictions. A person reviews every claim.
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
