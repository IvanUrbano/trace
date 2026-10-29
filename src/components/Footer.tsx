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
  return (
    <footer className="border-t border-line bg-paper">
      <div className="container-x flex flex-col gap-10 py-14 md:flex-row md:justify-between">
        <div>
          <Link to="/" className="text-lg font-bold tracking-[0.28em]">
            TRACE
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Every return is verified. Every handoff is recorded.
          </p>
        </div>
        <div className="flex gap-16">
          {cols.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-ink/80 transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-x flex items-center justify-between py-5 text-xs text-muted">
          <span>© {new Date().getFullYear()} TRACE</span>
          <span>Built for verified returns.</span>
        </div>
      </div>
    </footer>
  )
}
