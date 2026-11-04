import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sampleHeroFrame } from '../src/components/home/hero3d/scrollTimeline.ts'

const finiteVec = (v, label) => {
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Number.isFinite(v[axis]), `${label}.${axis} must be finite, got ${v[axis]}`)
  }
}

test('samples finite frames across the full scroll range', () => {
  for (let i = 0; i <= 100; i++) {
    const p = i / 100
    const f = sampleHeroFrame(p)
    finiteVec(f.camera.position, `p=${p} camera.position`)
    finiteVec(f.camera.target, `p=${p} camera.target`)
    finiteVec(f.mark.rotation, `p=${p} mark.rotation`)
    finiteVec(f.mark.position, `p=${p} mark.position`)
    for (const value of [f.mark.scale, f.mark.opacity, f.ring.opacity, f.ring.scale, f.lights.key, f.lights.fill, f.lights.rim, f.lights.warmth]) {
      assert.ok(Number.isFinite(value), `all scalars finite at p=${p}`)
    }
  }
})

test('is deterministic: same progress always yields the same frame', () => {
  const a = sampleHeroFrame(0.42)
  const b = sampleHeroFrame(0.42)
  assert.deepEqual(a, b)
})

test('clamps out-of-range progress instead of extrapolating', () => {
  assert.deepEqual(sampleHeroFrame(-1), sampleHeroFrame(0))
  assert.deepEqual(sampleHeroFrame(2), sampleHeroFrame(1))
  assert.deepEqual(sampleHeroFrame(Number.NaN), sampleHeroFrame(0))
})

test('camera keeps a safe distance from the mark at every progress', () => {
  for (let i = 0; i <= 200; i++) {
    const { x, y, z } = sampleHeroFrame(i / 200).camera.position
    const distance = Math.hypot(x, y, z)
    assert.ok(distance > 1.6, `camera distance ${distance.toFixed(2)} too close at step ${i}`)
  }
})

test('mark yaw advances monotonically to a full turn (no snap-back)', () => {
  let previous = -Infinity
  for (let i = 0; i <= 200; i++) {
    const yaw = sampleHeroFrame(i / 200).mark.rotation.y
    assert.ok(yaw >= previous - 1e-9, `yaw decreased at step ${i}: ${yaw} < ${previous}`)
    previous = yaw
  }
  const start = sampleHeroFrame(0).mark.rotation.y
  const end = sampleHeroFrame(1).mark.rotation.y
  assert.ok(Math.abs(end - start - Math.PI * 2) < 1e-6, 'ends exactly one full turn past the intro pose')
})

test('adjacent progress steps never jump discontinuously', () => {
  const steps = 500
  const maxCameraJump = 0.12
  const maxYawJump = 0.12
  for (let i = 0; i <= steps; i++) {
    const a = sampleHeroFrame(i / steps)
    const b = sampleHeroFrame((i + 1) / steps)
    const cameraJump = Math.hypot(
      b.camera.position.x - a.camera.position.x,
      b.camera.position.y - a.camera.position.y,
      b.camera.position.z - a.camera.position.z,
    )
    const yawJump = Math.abs(b.mark.rotation.y - a.mark.rotation.y)
    assert.ok(cameraJump < maxCameraJump, `camera jumped ${cameraJump.toFixed(3)} at step ${i}`)
    assert.ok(yawJump < maxYawJump, `yaw jumped ${yawJump.toFixed(3)} at step ${i}`)
  }
})

test('ring fades in after the intro and light warmth shifts during the wide shot', () => {
  assert.equal(sampleHeroFrame(0).ring.opacity, 0)
  assert.ok(sampleHeroFrame(0.4).ring.opacity > 0.5)
  assert.ok(sampleHeroFrame(0.3).lights.warmth > 0.8)
  assert.ok(sampleHeroFrame(0.8).lights.warmth < 0.3, 'wide shot must cool the key light')
})

test('mark stays opaque and ends on the centered camera axis', () => {
  for (let i = 0; i <= 100; i++) assert.equal(sampleHeroFrame(i / 100).mark.opacity, 1)
  const end = sampleHeroFrame(1)
  assert.equal(end.mark.position.x, 0)
  assert.equal(end.camera.position.x, 0)
  assert.equal(end.camera.target.x, 0)
})
