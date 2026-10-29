import { RevealOnScroll } from '../motion'
import { Button } from '../ui/Button'

export function FinalCTA() {
  return (
    <section className="bg-mist py-28 lg:py-36" aria-labelledby="cta-heading">
      <div className="container-x text-center">
        <RevealOnScroll>
          <h2 id="cta-heading" className="h2-section mx-auto max-w-2xl">
            Let&apos;s get your belongings home.
          </h2>
        </RevealOnScroll>
        <RevealOnScroll delay={0.12}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChildLink="/report?type=lost" size="lg">
              Report a Lost Item
            </Button>
            <Button asChildLink="/report?type=found" variant="secondary" size="lg">
              Report a Found Item
            </Button>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
