import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Button } from '../ui/Button'

const words = ['Lost', 'something?', "Let's", 'bring', 'it', 'back.']

const floatImages = [
  { src: '/img/wallet.jpg', alt: 'Black leather wallet on a white surface', className: 'left-0 top-8 w-[38%] rotate-[-2deg]' },
  { src: '/img/headphones.jpg', alt: 'Wireless headphones', className: 'right-[4%] top-0 w-[42%] rotate-[1.5deg]' },
  { src: '/img/keys.jpg', alt: 'Silver keys with keychain', className: 'left-[12%] bottom-0 w-[36%] rotate-[1deg]' },
  { src: '/img/tote.jpg', alt: 'Canvas tote bag', className: 'right-0 bottom-[6%] w-[34%] rotate-[-1deg]' },
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

        <div className="relative mx-auto aspect-[4/3.4] w-full max-w-xl">
          {floatImages.map((img, i) => (
            <motion.div
              key={img.src}
              className={`absolute overflow-hidden rounded-[3px] border border-line shadow-[0_12px_40px_rgba(0,0,0,0.06)] ${img.className}`}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.35 + i * 0.12, ease: [0.21, 0.6, 0.35, 1] }}
            >
              <img src={img.src} alt={img.alt} className="aspect-[4/3] w-full object-cover" />
            </motion.div>
          ))}
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
