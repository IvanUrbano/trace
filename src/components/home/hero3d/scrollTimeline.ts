export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface HeroFrame {
  camera: { position: Vec3; target: Vec3 }
  mark: { rotation: Vec3; position: Vec3; scale: number; opacity: number }
  ring: { rotationY: number; opacity: number; scale: number }
  lights: { key: number; fill: number; rim: number; warmth: number }
}

interface Key<T> {
  at: number
  value: T
}

const PHASE_KEYS = [0, 0.15, 0.35, 0.55, 0.8, 1] as const

const cameraPositionKeys: Key<Vec3>[] = [
  { at: 0, value: { x: 0, y: 0.1, z: 4.6 } },
  { at: 0.15, value: { x: 0.35, y: 0.05, z: 4.8 } },
  { at: 0.35, value: { x: 0.15, y: 0, z: 4.8 } },
  { at: 0.55, value: { x: 1.1, y: 0.5, z: 4.8 } },
  { at: 0.8, value: { x: -0.9, y: 1, z: 5.1 } },
  { at: 1, value: { x: 0, y: 0.1, z: 5.4 } },
]

const cameraTargetKeys: Key<Vec3>[] = [
  { at: 0, value: { x: 0, y: 0, z: 0 } },
  { at: 0.15, value: { x: 0, y: 0, z: 0 } },
  { at: 0.35, value: { x: -0.05, y: -0.15, z: 0 } },
  { at: 0.55, value: { x: -0.2, y: -0.2, z: 0 } },
  { at: 0.8, value: { x: -0.3, y: 0, z: 0 } },
  { at: 1, value: { x: 0, y: 0, z: 0 } },
]

const markRotationKeys: Key<Vec3>[] = [
  { at: 0, value: { x: 0.02, y: Math.PI / 4, z: 0 } },
  { at: 0.15, value: { x: 0.03, y: 1.0, z: 0 } },
  { at: 0.35, value: { x: 0.08, y: 1.5, z: 0 } },
  { at: 0.55, value: { x: -0.12, y: 2.8, z: 0.06 } },
  { at: 0.8, value: { x: 0.1, y: 4.6, z: 0 } },
  { at: 1, value: { x: 0, y: Math.PI / 4 + Math.PI * 2, z: 0 } },
]

const markPositionKeys: Key<Vec3>[] = [
  { at: 0, value: { x: 0, y: 0, z: 0 } },
  { at: 0.15, value: { x: 0, y: 0.04, z: 0 } },
  { at: 0.35, value: { x: -0.1, y: 0, z: 0 } },
  { at: 0.55, value: { x: -0.35, y: -0.05, z: 0 } },
  { at: 0.8, value: { x: -0.4, y: -0.1, z: 0 } },
  { at: 1, value: { x: 0, y: 0, z: 0 } },
]

const markScaleKeys: Key<number>[] = [
  { at: 0, value: 1 },
  { at: 0.15, value: 1 },
  { at: 0.35, value: 1.03 },
  { at: 0.55, value: 1.02 },
  { at: 0.8, value: 0.92 },
  { at: 1, value: 0.88 },
]

const markOpacityKeys: Key<number>[] = [
  { at: 0, value: 1 },
  { at: 0.15, value: 1 },
  { at: 0.35, value: 1 },
  { at: 0.55, value: 1 },
  { at: 0.8, value: 1 },
  { at: 1, value: 1 },
]

const ringOpacityKeys: Key<number>[] = [
  { at: 0, value: 0 },
  { at: 0.15, value: 0.55 },
  { at: 0.35, value: 0.8 },
  { at: 0.55, value: 0.85 },
  { at: 0.8, value: 0.5 },
  { at: 1, value: 0.25 },
]

const ringScaleKeys: Key<number>[] = [
  { at: 0, value: 0.7 },
  { at: 0.15, value: 1 },
  { at: 0.35, value: 1 },
  { at: 0.55, value: 1.05 },
  { at: 0.8, value: 1.15 },
  { at: 1, value: 1.2 },
]

const keyLightKeys: Key<number>[] = [
  { at: 0, value: 2.2 },
  { at: 0.15, value: 2.4 },
  { at: 0.35, value: 3 },
  { at: 0.55, value: 3.2 },
  { at: 0.8, value: 2.6 },
  { at: 1, value: 2.2 },
]

const fillLightKeys: Key<number>[] = [
  { at: 0, value: 0.9 },
  { at: 0.15, value: 0.9 },
  { at: 0.35, value: 0.8 },
  { at: 0.55, value: 0.7 },
  { at: 0.8, value: 1.1 },
  { at: 1, value: 1 },
]

const rimLightKeys: Key<number>[] = [
  { at: 0, value: 1.2 },
  { at: 0.15, value: 1.6 },
  { at: 0.35, value: 2.2 },
  { at: 0.55, value: 2.6 },
  { at: 0.8, value: 3 },
  { at: 1, value: 2 },
]

const warmthKeys: Key<number>[] = [
  { at: 0, value: 1 },
  { at: 0.15, value: 1 },
  { at: 0.35, value: 0.9 },
  { at: 0.55, value: 0.6 },
  { at: 0.8, value: 0.15 },
  { at: 1, value: 0.45 },
]

export function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0
  if (t < 0) return 0
  if (t > 1) return 1
  return t
}

function smoothstep(t: number): number {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}

function phaseIndex(p: number): number {
  for (let i = 0; i < PHASE_KEYS.length - 1; i++) {
    if (p <= PHASE_KEYS[i + 1]) return i
  }
  return PHASE_KEYS.length - 2
}

function phaseT(p: number, index: number): number {
  const a = PHASE_KEYS[index]
  const b = PHASE_KEYS[index + 1]
  return smoothstep((p - a) / (b - a))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function sampleScalar(keys: Key<number>[], index: number, t: number): number {
  return lerp(keys[index].value, keys[index + 1].value, t)
}

function sampleVec3(keys: Key<Vec3>[], index: number, t: number): Vec3 {
  const a = keys[index].value
  const b = keys[index + 1].value
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }
}

/**
 * Maps normalized hero scroll progress (0..1) to the complete 3D scene state.
 * Pure and deterministic: the same progress always yields the same frame, so
 * forward scroll, reverse scroll, and rapid scrubbing all reconstruct the
 * correct visual state.
 */
export function sampleHeroFrame(progress: number): HeroFrame {
  const p = clamp01(progress)
  const i = phaseIndex(p)
  const t = phaseT(p, i)

  return {
    camera: {
      position: sampleVec3(cameraPositionKeys, i, t),
      target: sampleVec3(cameraTargetKeys, i, t),
    },
    mark: {
      rotation: sampleVec3(markRotationKeys, i, t),
      position: sampleVec3(markPositionKeys, i, t),
      scale: sampleScalar(markScaleKeys, i, t),
      opacity: sampleScalar(markOpacityKeys, i, t),
    },
    ring: {
      rotationY: -p * 3.84,
      opacity: sampleScalar(ringOpacityKeys, i, t),
      scale: sampleScalar(ringScaleKeys, i, t),
    },
    lights: {
      key: sampleScalar(keyLightKeys, i, t),
      fill: sampleScalar(fillLightKeys, i, t),
      rim: sampleScalar(rimLightKeys, i, t),
      warmth: sampleScalar(warmthKeys, i, t),
    },
  }
}
