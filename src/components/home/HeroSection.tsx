import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, MapPin } from 'lucide-react'
import { Button } from '../ui/Button'

const words = ['Lost', 'something?', "Let's", 'bring', 'it', 'back.']

const tiles = [
  {
    src: '/img/wallet.jpg',
    alt: 'Black leather wallet found on a bench',
    tag: 'University Library',
    className: 'col-start-1 row-start-1',
    float: { y: [0, -7, 0] },
    duration: 5.5,
  },
  {
    src: '/img/headphones.jpg',
    alt: 'Wireless headphones found in a study booth',
    tag: 'Tech Hub',
    className: 'col-start-2 row-start-1',
    float: { y: [0, 8, 0] },
    duration: 6.5,
  },
  {
    src: '/img/keys.jpg',
    alt: 'Silver keys with keychain',
    tag: 'Parking Garage',
    className: 'col-start-1 row-start-2',
    float: { y: [0, 6, 0] },
    duration: 7,
  },
  {
    src: '/img/tote.jpg',
    alt: 'Canvas tote bag left at a cafe',
    tag: 'Campus Cafe',
    className: 'col-start-2 row-start-2',
    float: { y: [0, -6, 0] },
    duration: 6,
  },
]

export function HeroSection() {
  const reduce = useReducedMotion()
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-24 pb-16">
      <div className="container-x grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div>
          <motion.p
            className="eyebrow"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.21, 0.6, 0.35, 1] }}
          >
            A better way to find what&apos;s lost
          </motion.p>

          <h1 className="h1-display mt-6">
            {words.map((w, i) => (
              <motion.span
                key={i}
                className="inline-block overflow-hidden"
                initial={reduce ? false : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.12 + i * 0.07, ease: [0.21, 0.6, 0.35, 1] }}
              >
                {w}&nbsp;
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="mt-6 max-w-lg text-lg leading-relaxed text-muted"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.62, ease: [0.21, 0.6, 0.35, 1] }}
          >
            Report missing belongings, discover found items, and reconnect people with the things
            that matter.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap gap-3"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.78, ease: [0.21, 0.6, 0.35, 1] }}
          >
            <Button asChildLink="/discover?type=lost" size="lg">
              Find My Item
            </Button>
            <Button asChildLink="/report?type=found" variant="secondary" size="lg">
              I Found Something
            </Button>
          </motion.div>

          <motion.p
            className="mt-10 text-sm text-muted"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            Every return is verified. Every handoff is recorded.
          </motion.p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="grid grid-cols-2 gap-4 sm:gap-5">
            {tiles.map((tile, i) => (
              <motion.div
                key={tile.src}
                className={tile.className}
                initial={reduce ? false : { opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.12, ease: [0.21, 0.6, 0.35, 1] }}
              >
                <motion.figure
                  className="group relative overflow-hidden rounded-[4px] border border-line bg-mist shadow-[0_16px_50px_rgba(0,0,0,0.07)]"
                  animate={reduce ? undefined : tile.float}
                  transition={{
                    duration: tile.duration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.4,
                  }}
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={tile.src}
                      alt={tile.alt}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  </div>
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-medium tracking-wide text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <MapPin className="h-3 w-3" strokeWidth={2} />
                    {tile.tag}
                  </figcaption>
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-paper/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                    Found
                  </span>
                </motion.figure>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="absolute -bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-paper px-5 py-2.5 text-xs font-medium shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.6, ease: [0.21, 0.6, 0.35, 1] }}
          >
            <motion.span
              className="inline-flex items-center gap-2"
              animate={reduce ? undefined : { opacity: [1, 0.55, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ink" />
              </span>
              3 matches found near campus
            </motion.span>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        aria-hidden
      >
        <ChevronDown className={`h-5 w-5 text-muted ${reduce ? '' : 'animate-scroll-hint'}`} />
      </motion.div>
    </section>
  )
}
