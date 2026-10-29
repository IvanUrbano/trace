import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, MapPin } from 'lucide-react'
import { Button } from '../ui/Button'

const words = ['Lost', 'something?', "Let's", 'bring', 'it', 'back.']

export function HeroSection() {
  const reduce = useReducedMotion()
  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-24 pb-16">
      {/* Soft background: gradient + subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-mist via-paper to-paper"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: 'radial-gradient(circle, #d4d4d4 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)',
        }}
      />

      <div className="container-x relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
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

        {/* Staggered editorial collage */}
        <div className="relative mx-auto h-[480px] w-full max-w-lg sm:h-[520px]">
          {/* Large card — backpack */}
          <motion.figure
            className="group absolute left-0 top-6 w-[62%] overflow-hidden rounded-[4px] border border-line bg-paper shadow-[0_20px_60px_rgba(0,0,0,0.08)]"
            initial={reduce ? false : { opacity: 0, y: 36, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            transition={{ duration: 0.85, delay: 0.3, ease: [0.21, 0.6, 0.35, 1] }}
            whileHover={reduce ? undefined : { rotate: 0, y: -6, transition: { duration: 0.35 } }}
          >
            <div className="aspect-[3/4] overflow-hidden">
              <img
                src="/img/backpack.jpg"
                alt="Navy backpack turned in at the bus terminal"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-4 pb-4 pt-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">Found</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-white">
                <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                City Bus Terminal
              </p>
            </figcaption>
          </motion.figure>

          {/* Medium card — camera, offset top-right */}
          <motion.figure
            className="group absolute right-0 top-0 w-[44%] overflow-hidden rounded-[4px] border border-line bg-paper shadow-[0_16px_44px_rgba(0,0,0,0.07)]"
            initial={reduce ? false : { opacity: 0, y: 28, rotate: 2.5 }}
            animate={{ opacity: 1, y: 0, rotate: 2.5 }}
            transition={{ duration: 0.85, delay: 0.48, ease: [0.21, 0.6, 0.35, 1] }}
            whileHover={reduce ? undefined : { rotate: 0, y: -5, transition: { duration: 0.35 } }}
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src="/img/camera.jpg"
                alt="Compact digital camera lost at the pavilion"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-medium text-white">
              <MapPin className="h-3 w-3" strokeWidth={2} />
              Central Park
            </figcaption>
          </motion.figure>

          {/* Small card — sunglasses, mid-right */}
          <motion.figure
            className="group absolute right-[4%] top-[46%] w-[38%] overflow-hidden rounded-[4px] border border-line bg-paper shadow-[0_14px_36px_rgba(0,0,0,0.06)]"
            initial={reduce ? false : { opacity: 0, y: 24, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: -1.5 }}
            transition={{ duration: 0.85, delay: 0.62, ease: [0.21, 0.6, 0.35, 1] }}
            whileHover={reduce ? undefined : { rotate: 0, y: -5, transition: { duration: 0.35 } }}
          >
            <div className="aspect-square overflow-hidden">
              <img
                src="/img/sunglasses.jpg"
                alt="Black sunglasses found at the gym"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-medium text-white">
              <MapPin className="h-3 w-3" strokeWidth={2} />
              Riverside Gym
            </figcaption>
          </motion.figure>

          {/* Small card — watch, bottom-left overlap */}
          <motion.figure
            className="group absolute bottom-0 left-[18%] w-[36%] overflow-hidden rounded-[4px] border border-line bg-paper shadow-[0_14px_36px_rgba(0,0,0,0.06)]"
            initial={reduce ? false : { opacity: 0, y: 24, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 2 }}
            transition={{ duration: 0.85, delay: 0.76, ease: [0.21, 0.6, 0.35, 1] }}
            whileHover={reduce ? undefined : { rotate: 0, y: -5, transition: { duration: 0.35 } }}
          >
            <div className="aspect-[5/4] overflow-hidden">
              <img
                src="/img/watch.jpg"
                alt="Analog wrist watch left on a cafe counter"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-medium text-white">
              <MapPin className="h-3 w-3" strokeWidth={2} />
              Campus Cafe
            </figcaption>
          </motion.figure>

          <motion.div
            className="absolute -bottom-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-paper px-5 py-2.5 text-xs font-medium shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
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
