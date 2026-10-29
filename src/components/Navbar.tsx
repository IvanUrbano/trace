import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'

const links = [
  { to: '/discover', label: 'Discover Items' },
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/report', label: 'Report an Item' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { user } = useStore()
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [location.pathname, location.hash])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled || open
          ? 'border-b border-line bg-paper/95 backdrop-blur-sm'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container-x flex h-16 items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-[0.28em]" aria-label="TRACE home">
          TRACE
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'relative text-sm font-medium text-ink/80 transition-colors hover:text-ink after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-ink after:transition-all after:duration-300 hover:after:w-full',
                  isActive && l.to !== '/#how-it-works' && 'text-ink after:w-full',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/dashboard'}
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {user.role === 'admin' ? 'Admin' : 'Dashboard'}
            </Link>
          ) : (
            <Link
              to="/signin"
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Sign In
            </Link>
          )}
          <Button asChildLink="/report" size="sm">
            Report an Item
          </Button>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper md:hidden">
          <nav className="container-x flex flex-col gap-1 py-4" aria-label="Mobile">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className="rounded-[3px] px-2 py-3 text-base font-medium hover:bg-mist"
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/signin'} className="rounded-[3px] px-2 py-3 text-base font-medium hover:bg-mist">
              {user ? (user.role === 'admin' ? 'Admin' : 'Dashboard') : 'Sign In'}
            </NavLink>
            <Button asChildLink="/report" className="mt-2 w-full">
              Report an Item
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
