import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ItemGrid } from '../components/ItemGrid'
import { SearchFilters, defaultFilters, type Filters } from '../components/SearchFilters'
import { ItemGridSkeleton } from '../components/Skeleton'
import { useStore } from '../lib/store'
import { Button } from '../components/ui/Button'

type LoadState = 'loading' | 'ready' | 'error'

export function DiscoverPage() {
  const { items } = useStore()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => ({
    ...defaultFilters,
    q: params.get('q') ?? '',
    type: (params.get('type') as Filters['type']) ?? 'all',
    category: params.get('category') ?? '',
    location: params.get('location') ?? '',
    from: params.get('from') ?? '',
    sort: (params.get('sort') as Filters['sort']) ?? 'newest',
  }))
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    setState('loading')
    const t = window.setTimeout(() => setState('ready'), 450)
    return () => window.clearTimeout(t)
  }, [filters])

  useEffect(() => {
    const next = new URLSearchParams()
    if (filters.q) next.set('q', filters.q)
    if (filters.type !== 'all') next.set('type', filters.type)
    if (filters.category) next.set('category', filters.category)
    if (filters.location) next.set('location', filters.location)
    if (filters.from) next.set('from', filters.from)
    if (filters.sort !== 'newest') next.set('sort', filters.sort)
    setParams(next, { replace: true })
  }, [filters, setParams])

  const update = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }))

  const results = (() => {
    let list = items.filter((i) => i.status !== 'returned' || filters.type === 'all')
    if (filters.type !== 'all') list = list.filter((i) => i.type === filters.type)
    if (filters.category) list = list.filter((i) => i.category === filters.category)
    if (filters.location) list = list.filter((i) => i.location === filters.location)
    if (filters.from) list = list.filter((i) => i.date >= new Date(filters.from).toISOString())
    if (filters.q.trim()) {
      const q = filters.q.toLowerCase()
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
    }
    if (filters.sort === 'newest') {
      list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    } else if (filters.q.trim()) {
      const q = filters.q.toLowerCase()
      list = [...list].sort((a, b) => {
        const sa = (a.title.toLowerCase().includes(q) ? 2 : 0) + (a.description.toLowerCase().includes(q) ? 1 : 0)
        const sb = (b.title.toLowerCase().includes(q) ? 2 : 0) + (b.description.toLowerCase().includes(q) ? 1 : 0)
        return sb - sa
      })
    }
    return list
  })()

  return (
    <main className="container-x pb-24 pt-28 lg:pt-32">
      <header className="mb-10">
        <p className="eyebrow">Discover</p>
        <h1 className="h2-section mt-3">Browse lost &amp; found listings.</h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Search by keyword, narrow by category and location, or toggle between lost reports and
          found items.
        </p>
      </header>

      <SearchFilters filters={filters} onChange={update} resultCount={state === 'ready' ? results.length : 0} />

      <div className="mt-10">
        <AnimatePresence mode="wait">
          {state === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ItemGridSkeleton />
            </motion.div>
          )}
          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center rounded-[3px] border border-line bg-mist/50 px-6 py-20 text-center"
            >
              <AlertTriangle className="h-6 w-6 text-muted" strokeWidth={1.5} />
              <p className="mt-3 font-medium">Something went wrong loading listings.</p>
              <p className="mt-1 text-sm text-muted">Your filters are preserved — try again.</p>
              <Button variant="secondary" className="mt-6" onClick={() => setState('loading')}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </motion.div>
          )}
          {state === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ItemGrid
                items={results}
                emptyMessage="Nothing matches those filters yet."
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
