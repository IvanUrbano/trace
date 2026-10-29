import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface RevealOnScrollProps {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article'
}

export function RevealOnScroll({ children, delay = 0, className, as = 'div' }: RevealOnScrollProps) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]
  if (reduce) return <div className={className}>{children}</div>
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </MotionTag>
  )
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
}: {
  children: ReactNode
  className?: string
  staggerDelay?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: staggerDelay } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.6, 0.35, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function ImageReveal({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string
  alt: string
  className?: string
  imgClassName?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) {
    return (
      <div className={`overflow-hidden bg-mist ${className ?? ''}`}>
        <img src={src} alt={alt} className={`h-full w-full object-cover ${imgClassName ?? ''}`} loading="lazy" />
      </div>
    )
  }
  return (
    <motion.div
      className={`overflow-hidden bg-mist ${className ?? ''}`}
      initial={{ clipPath: 'inset(100% 0 0 0)' }}
      whileInView={{ clipPath: 'inset(0% 0 0 0)' }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.8, ease: [0.21, 0.6, 0.35, 1] }}
    >
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        className={`h-full w-full object-cover ${imgClassName ?? ''}`}
        initial={{ scale: 1.04 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.9, ease: [0.21, 0.6, 0.35, 1] }}
      />
    </motion.div>
  )
}

export function Divider({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <hr className={`border-0 border-t border-line ${className ?? ''}`} />
  return (
    <motion.hr
      className={`border-0 border-t border-line ${className ?? ''}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: [0.21, 0.6, 0.35, 1] }}
      style={{ transformOrigin: 'left' }}
    />
  )
}
