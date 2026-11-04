import { motion, useScroll, useSpring } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { cn } from '../lib/utils'

const links = [
  { to: '/discover', label: 'Discover Items' },
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/#smart-matching', label: 'Matching' },
  { to: '/report', label: 'Report an Item' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const { user } = useStore()
  const location = useLocation()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12)
      const marker = window.innerHeight * 0.4
      const current = ['how-it-works', 'smart-matching'].find((id) => {
        const bounds = document.getElementById(id)?.getBoundingClientRect()
        return bounds && bounds.top <= marker && bounds.bottom > marker
      })
      setActiveSection(current ?? null)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  useEffect(() => setOpen(false), [location.pathname, location.hash])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const selected = (to: string) => to.includes('#')
    ? location.pathname === '/' && activeSection === to.split('#')[1]
    : location.pathname === to || location.pathname.startsWith(to + '/')
  const linkClass = (active: boolean) => cn(
    'rounded-2xl border px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-paper',
    active
      ? 'border-accentLight/70 bg-accentLight text-ink shadow-sm'
      : 'border-transparent text-paper/85 hover:bg-paper/10 hover:text-paper',
  )
  const accountLink = user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/signin'
  const accountLabel = user ? (user.role === 'admin' ? 'Admin' : 'Dashboard') : 'Sign In'

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-6"
    >
      <Link to="/" aria-label="TRACE home" className="pointer-events-auto absolute left-3 top-2 rounded-xl bg-paper/85 px-3 py-2 text-base font-bold tracking-[0.25em] text-ink backdrop-blur-md focus-visible:outline-accent sm:left-6">
        TRACE
      </Link>
      <Link to="/report" aria-current={selected('/report') ? 'page' : undefined} className={cn('pointer-events-auto absolute right-6 top-2 hidden items-center gap-2 rounded-2xl border px-3.5 py-2 text-[13px] font-semibold shadow-sm backdrop-blur-xl transition-colors md:inline-flex', selected('/report') ? 'border-accentLight bg-accentLight text-ink' : 'border-accentLight/40 bg-[#160D25]/85 text-paper hover:bg-accent')}>
        Report an Item <span aria-hidden="true">↗</span>
      </Link>
      <div className={cn(
        'pointer-events-auto relative ml-auto w-[calc(100%-110px)] max-w-[420px] overflow-hidden rounded-[26px] border border-paper/15 text-paper shadow-[inset_0_1px_0_rgba(231,234,243,0.14),0_10px_32px_-12px_rgba(22,13,37,0.5)] backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-300 md:mx-auto md:w-fit md:max-w-[760px]',
        scrolled || open ? 'bg-[#160D25]/90' : 'bg-[#160D25]/80',
      )} style={{ backgroundImage: 'linear-gradient(135deg, rgba(231,234,243,0.07), transparent 45%, rgba(143,157,192,0.04))' }}>
      <motion.div
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-accentLight/60"
        style={{ scaleX: progress }}
        aria-hidden
      />
      <div className="flex h-14 items-center justify-between gap-6 px-3">
        <span className="pl-2 text-xs font-medium tracking-[0.12em] text-paper/80 md:hidden">Navigation</span>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.filter((l) => l.to !== '/report').map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={linkClass(selected(l.to))}
              aria-current={selected(l.to) ? (l.to.includes('#') ? 'location' : 'page') : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link to={accountLink} className={linkClass(selected(accountLink))} aria-current={selected(accountLink) ? 'page' : undefined}>
            {accountLabel}
          </Link>
        </div>

        <button
          ref={menuButton}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-paper/15 bg-paper/5 hover:bg-paper/10 focus-visible:outline-paper md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={open ? 'trace-mobile-nav' : undefined}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-paper/10 md:hidden">
          <nav id="trace-mobile-nav" className="flex flex-col gap-1 p-3" aria-label="Mobile">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={linkClass(selected(l.to))}
                aria-current={selected(l.to) ? (l.to.includes('#') ? 'location' : 'page') : undefined}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link to={accountLink} className={linkClass(selected(accountLink))} aria-current={selected(accountLink) ? 'page' : undefined} onClick={() => setOpen(false)}>
              {accountLabel}
            </Link>
          </nav>
        </div>
      )}
      </div>
    </header>
  )
}
