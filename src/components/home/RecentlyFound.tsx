import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { Divider, RevealOnScroll, StaggerContainer, StaggerItem } from '../motion'
import { ItemCard } from '../ItemCard'
import { Button } from '../ui/Button'

export function RecentlyFound() {
  const { items } = useStore()
  const found = items.filter((i) => i.type === 'found').slice(0, 6)

  return (
    <section className="bg-mist py-24 lg:py-32" aria-labelledby="recently-found-heading">
      <div className="container-x">
        <RevealOnScroll>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Recently Found</p>
              <h2 id="recently-found-heading" className="h2-section mt-4 max-w-xl">
                Somewhere, someone is looking for this.
              </h2>
            </div>
            <Button asChildLink="/discover?type=found" variant="secondary">
              Browse All Items
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </RevealOnScroll>
        <Divider className="mt-10" />
        <StaggerContainer className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.1}>
          {found.map((item) => (
            <StaggerItem key={item.id}>
              <ItemCard item={item} />
            </StaggerItem>
          ))}
        </StaggerContainer>
        <RevealOnScroll delay={0.1}>
          <p className="mt-12 text-center text-sm text-muted">
            Looking for something specific?{' '}
            <Link to="/discover" className="font-medium text-ink underline underline-offset-4">
              Search all listings
            </Link>
          </p>
        </RevealOnScroll>
      </div>
    </section>
  )
}
