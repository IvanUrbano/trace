import type { Item } from '../lib/types'
import { ItemCard } from './ItemCard'

export function ItemGrid({ items, emptyMessage }: { items: Item[]; emptyMessage?: string }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[3px] border border-dashed border-line bg-mist/50 px-6 py-20 text-center">
        <p className="text-base font-medium">{emptyMessage ?? 'No items match your search.'}</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Try adjusting the filters, or report a new listing to help someone reconnect.
        </p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <ItemCard key={item.id} item={item} index={i} />
      ))}
    </div>
  )
}
