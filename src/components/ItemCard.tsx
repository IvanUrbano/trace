import { ArrowUpRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Item } from '../lib/types'
import { formatDate } from '../lib/utils'
import { StatusBadge } from './ui/StatusBadge'
import { motion, useReducedMotion } from 'framer-motion'

export function ItemCard({ item, index = 0 }: { item: Item; index?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: index * 0.09, ease: [0.21, 0.6, 0.35, 1] }}
      className="group"
    >
      <Link to={`/items/${item.id}`} className="block">
        <div className="overflow-hidden rounded-[3px] border border-line bg-mist">
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={item.images[0]}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          </div>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{item.title}</h3>
            <p className="mt-1 text-sm text-muted">{item.category}</p>
          </div>
          <StatusBadge status={item.status} className="shrink-0" />
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.location}
          </span>
          <span>{formatDate(item.date)}</span>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-ink">
          View Details
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>
    </motion.article>
  )
}
