import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

const cols = [
  {
    title: 'Product',
    links: [
      { to: '/discover', label: 'Discover Items' },
      { to: '/report', label: 'Report an Item' },
      { to: '/#how-it-works', label: 'How It Works' },
      { to: '/signin', label: 'Sign In' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
    ],
  },
]

export function Footer() {
  const reduce = useReducedMotion()
  return (
    <footer className="border-t border-line bg-paper">
      <div className="container-x flex flex-col gap-10 py-14 md:flex-row md:justify-between">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease: [0.21, 0.6, 0.35, 1] }}
        >
          <Link to="/" className="text-lg font-bold tracking-[0.28em]">
            TRACE
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Every return is verified. Every handoff is recorded.
          </p>
        </motion.div>
        <div className="flex gap-16">
          {cols.map((col, ci) => (
            <motion.div
              key={col.title}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.1 + ci * 0.1, ease: [0.21, 0.6, 0.35, 1] }}
            >
              <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l, li) => (
                  <motion.li
                    key={l.label}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.45, delay: 0.2 + ci * 0.1 + li * 0.06, ease: [0.21, 0.6, 0.35, 1] }}
                  >
                    <Link
                      to={l.to}
                      className="group inline-flex text-sm text-ink/80 transition-colors hover:text-ink"
                    >
                      <span className="relative">
                        {l.label}
                        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-ink transition-all duration-300 group-hover:w-full" />
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <motion.div
          className="container-x flex items-center justify-between py-5 text-xs text-muted"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <span>© {new Date().getFullYear()} TRACE</span>
          <span>Built for verified returns.</span>
        </motion.div>
      </div>
    </footer>
  )
}
