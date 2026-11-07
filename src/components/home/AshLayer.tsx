import { motion, useTransform } from 'framer-motion'
import type { MotionValue } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { ashFadeEdge, ashParticlePhase } from './ashTiming'

type Range = readonly [number, number]
type AshPixel = { x: number; y: number; size: number; drift: number; lift: number; accent: boolean }
const PADDING = 200
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}

// Read the actual text nodes once per layout change; animate cached fragments.
function sampleTextPixels(root: HTMLElement, content: HTMLElement): AshPixel[] {
  const bounds = root.getBoundingClientRect()
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
  const glyph = document.createElement('canvas')
  const context = glyph.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  const points: AshPixel[] = []
  const glyphCache = new Map<string, Array<[number, number]>>()
  let node: Node | null
  while ((node = walker.nextNode())) {
    const value = node.textContent ?? ''
    const parent = node.parentElement
    if (!parent || !value.trim()) continue
    const style = getComputedStyle(parent)
    if (style.display === 'none') continue
    for (let index = 0; index < value.length; index++) {
      const char = value[index]
      if (!char.trim()) continue
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + 1)
      const rect = range.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      const width = Math.max(2, Math.ceil(rect.width))
      const height = Math.max(2, Math.ceil(rect.height))
      const fontSize = Number.parseFloat(style.fontSize) || height * 0.75
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const cacheKey = `${font}|${width}|${height}|${char}`
      let candidates = glyphCache.get(cacheKey)
      if (!candidates) {
        glyph.width = width
        glyph.height = height
        context.font = font
        context.textBaseline = 'alphabetic'
        context.fillStyle = '#fff'
        context.fillText(char, 0, Math.min(height - 1, (height - fontSize) / 2 + fontSize * 0.83))
        const pixels = context.getImageData(0, 0, width, height).data
        candidates = []
        const stride = fontSize > 52 ? 4 : fontSize > 24 ? 3 : 2
        for (let y = 0; y < height; y += stride) {
          for (let x = 0; x < width; x += stride) {
            if (pixels[(y * width + x) * 4 + 3] > 105) candidates.push([x, y])
          }
        }
        glyphCache.set(cacheKey, candidates)
      }
      const take = Math.min(candidates.length, fontSize > 52 ? 22 : fontSize > 24 ? 14 : 6)
      for (let sample = 0; sample < take; sample++) {
        const pick = candidates[Math.floor((sample + 0.5) * candidates.length / take)]
        if (!pick) continue
        const seed = points.length + index * 31
        points.push({
          x: rect.left - bounds.left + pick[0],
          y: rect.top - bounds.top + pick[1],
          size: fontSize > 52 ? 3.3 : 2.6,
          drift: Math.sin(seed * 13.73) * (52 + (seed % 9) * 9),
          lift: 46 + (seed % 13) * 9,
          accent: seed % 6 === 0,
        })
      }
    }
  }
  const stride = Math.max(1, Math.ceil(points.length / 1200))
  return points.filter((_, index) => index % stride === 0).slice(0, 1200)
}

export function AshLayer({ children, progress, active, enter, exit, className = '', ariaHidden = false }: {
  children: ReactNode
  progress: MotionValue<number>
  active: boolean
  enter?: Range
  exit?: Range
  className?: string
  ariaHidden?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const enterStart = enter?.[0]
  const enterEnd = enter?.[1]
  const exitStart = exit?.[0]
  const exitEnd = exit?.[1]
  const maskImage = useTransform(progress, (p) => {
    if (enterStart !== undefined && enterEnd !== undefined && p < enterEnd) {
      const edge = 100 * ashFadeEdge((p - enterStart) / (enterEnd - enterStart))
      return `linear-gradient(90deg, #000 ${edge - 8}%, transparent ${edge + 8}%)`
    }
    if (exitStart !== undefined && exitEnd !== undefined && p > exitStart) {
      const edge = 100 * ashFadeEdge((p - exitStart) / (exitEnd - exitStart))
      return `linear-gradient(90deg, transparent ${edge - 8}%, #000 ${edge + 8}%)`
    }
    return 'linear-gradient(#000, #000)'
  })
  const y = useTransform(progress, (p) => {
    if (enterStart !== undefined && enterEnd !== undefined && p < enterEnd) return 14 * (1 - smoothstep((p - enterStart) / (enterEnd - enterStart)))
    if (exitStart !== undefined && exitEnd !== undefined && p > exitStart) return -10 * smoothstep((p - exitStart) / (exitEnd - exitStart))
    return 0
  })
  const visibility = useTransform(progress, (p) =>
    (enterStart !== undefined && p < enterStart) || (exitEnd !== undefined && p >= exitEnd) ? 'hidden' as const : 'visible' as const,
  )
  const pointerEvents = useTransform(progress, (p) =>
    exitStart !== undefined && p >= exitStart ? 'none' as const : 'auto' as const,
  )

  useEffect(() => {
    if (!active || (!exit && !enter) || !rootRef.current || !contentRef.current || !canvasRef.current) return
    const root = rootRef.current
    const content = contentRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return
    let points: AshPixel[] = []
    let frame = 0
    let needsSample = true
    let painted = false
    let rootWidth = 1
    let sampledY = 0
    let idleSample = 0
    let sampleTimer = 0
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    const draw = (p: number, seconds: number) => {
      const entering = enter && p > enter[0] && p < enter[1]
      const exiting = exit && p > exit[0] && p < exit[1]
      if (!entering && !exiting) {
        if (painted) context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio)
        painted = false
        return false
      }
      // Text follows scroll immediately; glyph rasterization never blocks it.
      if (needsSample) return false
      context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio)
      painted = true
      const edge = entering
        ? ashFadeEdge((p - enter[0]) / (enter[1] - enter[0]))
        : ashFadeEdge((p - exit![0]) / (exit![1] - exit![0]))
      const currentY = entering
        ? 14 * (1 - smoothstep((p - enter[0]) / (enter[1] - enter[0])))
        : -10 * smoothstep((p - exit![0]) / (exit![1] - exit![0]))
      for (const point of points) {
        const position = point.x / rootWidth
        const local = ashParticlePhase(edge, position)
        if (local <= 0 || local >= 1) continue
        const motion = entering ? 1 - smoothstep(local) : smoothstep(local)
        const sway = Math.sin(Math.PI * motion) * Math.sin(position * 17 + motion * Math.PI) * 12
        // Keep airborne dust alive while scroll (and the text mask) is paused.
        // The envelope anchors fragments to their glyphs at both endpoints.
        const airborne = Math.sin(Math.PI * motion)
        const phase = point.x * 0.037 + point.y * 0.023
        const breezeX = Math.sin(seconds * 0.8 + phase) * 14 * airborne
        const breezeY = Math.cos(seconds * 0.6 + phase) * 9 * airborne
        context.globalAlpha = Math.pow(Math.sin(Math.PI * local), 0.5)
        context.fillStyle = point.accent ? '#40506A' : '#171926'
        context.fillRect(PADDING + point.x + point.drift * motion + sway + breezeX, PADDING + point.y + currentY - sampledY - point.lift * motion + breezeY,
          point.size * (1 - 0.55 * motion), point.size * (1 - 0.55 * motion))
      }
      context.globalAlpha = 1
      return true
    }
    const tick = (time: number) => {
      frame = 0
      if (!document.hidden && draw(progress.get(), time / 1000)) frame = requestAnimationFrame(tick)
    }
    const update = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
        return
      }
      const value = progress.get()
      const inTransition = (enter && value > enter[0] && value < enter[1]) || (exit && value > exit[0] && value < exit[1])
      if (!frame && (inTransition || painted)) frame = requestAnimationFrame(tick)
    }
    const rebuild = () => {
      const rect = root.getBoundingClientRect()
      rootWidth = Math.max(1, rect.width)
      canvas.width = Math.ceil((rect.width + PADDING * 2) * ratio)
      canvas.height = Math.ceil((rect.height + PADDING * 2) * ratio)
      canvas.style.width = `${rect.width + PADDING * 2}px`
      canvas.style.height = `${rect.height + PADDING * 2}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      needsSample = true
      painted = false
      if (idleSample) window.cancelIdleCallback(idleSample)
      window.clearTimeout(sampleTimer)
      const sample = () => {
        points = sampleTextPixels(root, content)
        sampledY = y.get()
        needsSample = false
        update()
      }
      if (typeof window.requestIdleCallback === 'function') idleSample = window.requestIdleCallback(sample, { timeout: 1500 })
      else sampleTimer = window.setTimeout(sample, 100)
      update()
    }
    const observer = new ResizeObserver(rebuild)
    observer.observe(root)
    const unsubscribe = progress.on('change', update)
    document.addEventListener('visibilitychange', update)
    let mounted = true
    document.fonts.ready.then(() => { if (mounted) rebuild() })
    const settleTimer = window.setTimeout(rebuild, 1400)
    rebuild()
    return () => {
      mounted = false
      observer.disconnect()
      unsubscribe()
      document.removeEventListener('visibilitychange', update)
      cancelAnimationFrame(frame)
      window.clearTimeout(settleTimer)
      if (idleSample) window.cancelIdleCallback(idleSample)
      window.clearTimeout(sampleTimer)
    }
  }, [active, enterStart, enterEnd, exitStart, exitEnd, progress])

  return (
    <div ref={rootRef} className={className || 'relative'} aria-hidden={ariaHidden}>
      <motion.div ref={contentRef} style={active ? { maskImage, WebkitMaskImage: maskImage, y, visibility, pointerEvents } : undefined}>
        {children}
      </motion.div>
      {active && (enter || exit) && <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute z-10" style={{ left: -PADDING, top: -PADDING }} />}
    </div>
  )
}
