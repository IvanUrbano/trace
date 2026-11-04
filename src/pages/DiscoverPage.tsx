import { useSearchParams } from 'react-router-dom'
import { ItemGrid } from '../components/ItemGrid'
import { SearchFilters, type Filters } from '../components/SearchFilters'
import { useStore } from '../lib/store'
import { CATEGORIES, LOCATIONS } from '../lib/types'

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function DiscoverPage() {
  const { items } = useStore()
  const [params, setParams] = useSearchParams()
  const type = params.get('type')
  const category = params.get('category')
  const location = params.get('location')
  const from = params.get('from')
  const filters: Filters = {
    q: params.get('q') ?? '',
    type: type === 'lost' || type === 'found' ? type : 'all',
    category: CATEGORIES.find((value) => value === category) ?? '',
    location: LOCATIONS.find((value) => value === location) ?? '',
    from: validDate(from) ? from : '',
    sort: params.get('sort') === 'relevance' ? 'relevance' : 'newest',
  }

  const update = (partial: Partial<Filters>) => {
    const nextFilters = { ...filters, ...partial }
    const next = new URLSearchParams()
    if (nextFilters.q) next.set('q', nextFilters.q)
    if (nextFilters.type !== 'all') next.set('type', nextFilters.type)
    if (nextFilters.category) next.set('category', nextFilters.category)
    if (nextFilters.location) next.set('location', nextFilters.location)
    if (nextFilters.from) next.set('from', nextFilters.from)
    if (nextFilters.sort !== 'newest') next.set('sort', nextFilters.sort)
    setParams(next, { replace: true })
  }

  const results = (() => {
    let list = items.filter((i) => i.status !== 'returned' || filters.type === 'all')
    if (filters.type !== 'all') list = list.filter((i) => i.type === filters.type)
    if (filters.category) list = list.filter((i) => i.category === filters.category)
    if (filters.location) list = list.filter((i) => i.location === filters.location)
    if (filters.from) {
      const firstDate = Date.parse(filters.from)
      list = list.filter((i) => Date.parse(i.date) >= firstDate)
    }
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

      <SearchFilters filters={filters} onChange={update} resultCount={results.length} />

      <div className="mt-10">
        <ItemGrid items={results} emptyMessage="Nothing matches those filters yet." />
      </div>
    </main>
  )
}
