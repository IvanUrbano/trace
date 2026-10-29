import { Search, SlidersHorizontal, X } from 'lucide-react'
import { CATEGORIES, LOCATIONS } from '../lib/types'
import { cn } from '../lib/utils'

export interface Filters {
  q: string
  type: 'all' | 'lost' | 'found'
  category: string
  location: string
  from: string
  sort: 'newest' | 'relevance'
}

export const defaultFilters: Filters = {
  q: '',
  type: 'all',
  category: '',
  location: '',
  from: '',
  sort: 'newest',
}

export function SearchFilters({
  filters,
  onChange,
  resultCount,
}: {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  resultCount: number
}) {
  const hasActive =
    filters.q || filters.category || filters.location || filters.from || filters.type !== 'all'

  const selectCls =
    'h-10 rounded-[3px] border border-line bg-paper px-3 text-sm focus:border-ink'

  return (
    <div className="rounded-[4px] border border-line bg-paper">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search items by name or description…"
            aria-label="Search items"
            className="h-10 w-full rounded-[3px] border border-line bg-paper pl-10 pr-4 text-sm transition-colors placeholder:text-muted/60 focus:border-ink"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[3px] border border-line" role="group" aria-label="Listing type">
            {(['all', 'lost', 'found'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ type: t })}
                className={cn(
                  'h-10 px-3 text-sm font-medium capitalize transition-colors',
                  filters.type === t ? 'bg-ink text-paper' : 'bg-paper text-muted hover:text-ink',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <select
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value })}
            aria-label="Filter by category"
            className={selectCls}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filters.location}
            onChange={(e) => onChange({ location: e.target.value })}
            aria-label="Filter by location"
            className={selectCls}
          >
            <option value="">All locations</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ from: e.target.value })}
              aria-label="Found on or after"
              className="h-10 rounded-[3px] border border-line bg-paper px-2 text-sm focus:border-ink"
            />
          </label>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as Filters['sort'] })}
            aria-label="Sort results"
            className={selectCls}
          >
            <option value="newest">Newest</option>
            <option value="relevance">Relevance</option>
          </select>
          {hasActive && (
            <button
              type="button"
              onClick={() => onChange({ ...defaultFilters })}
              className="inline-flex h-10 items-center gap-1 px-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-line px-4 py-2.5 text-xs text-muted" aria-live="polite">
        {resultCount} {resultCount === 1 ? 'item' : 'items'} found
      </div>
    </div>
  )
}
