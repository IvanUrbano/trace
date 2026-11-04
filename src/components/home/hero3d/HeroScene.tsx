import { Canvas, invalidate, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MotionValue } from 'framer-motion'
import * as THREE from 'three'
import { createMarkParts, disposeMarkParts } from './markGeometry'
import { MarkMesh } from './MarkMesh'
import { OrbitRing } from './OrbitRing'
import { sampleHeroFrame } from './scrollTimeline'

interface HeroSceneProps {
  progress: MotionValue<number>
  onContextLost: () => void
}

function createInitialProgressValues() {
  const f = sampleHeroFrame(0)
  return {
    camPos: new THREE.Vector3(f.camera.position.x, f.camera.position.y, f.camera.position.z),
    camTarget: new THREE.Vector3(f.camera.target.x, f.camera.target.y, f.camera.target.z),
    markRot: new THREE.Vector3(f.mark.rotation.x, f.mark.rotation.y, f.mark.rotation.z),
    markPos: new THREE.Vector3(f.mark.position.x, f.mark.position.y, f.mark.position.z),
    markScale: f.mark.scale,
    markOpacity: f.mark.opacity,
    ringRotY: f.ring.rotationY,
    ringOpacity: f.ring.opacity,
    ringScale: f.ring.scale,
    key: f.lights.key,
    fill: f.lights.fill,
    rim: f.lights.rim,
    warmth: f.lights.warmth,
    ptrX: 0,
    ptrY: 0,
  }
}

function SceneContents({ progress, onContextLost }: HeroSceneProps) {
  const { camera, gl } = useThree()
  const markRef = useRef<THREE.Group>(null)
  const ringInnerRef = useRef<THREE.Group>(null)
  const keyRef = useRef<THREE.DirectionalLight | null>(null)
  const fillRef = useRef<THREE.DirectionalLight | null>(null)
  const rimRef = useRef<THREE.DirectionalLight | null>(null)
  const lastProgress = useRef<number | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const cur = useRef(createInitialProgressValues())
  const [pointerFine] = useState(() => window.matchMedia('(pointer: fine)').matches)

  const parts = useMemo(() => createMarkParts(window.innerWidth < 640 ? 'low' : 'high'), [])
  useEffect(() => () => disposeMarkParts(parts), [parts])

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#171926',
        roughness: 0.32,
        metalness: 0.06,
        clearcoat: 0.6,
        clearcoatRoughness: 0.28,
        envMapIntensity: 0.9,
        transparent: false,
        opacity: 1,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  const ringLine = useMemo(() => {
    const points: THREE.Vector3[] = []
    const segments = 160
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * 1.35, 0, Math.sin(angle) * 1.35))
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const lineMaterial = new THREE.LineDashedMaterial({
      color: '#171926',
      dashSize: 0.14,
      gapSize: 0.1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const line = new THREE.Line(geometry, lineMaterial)
    line.computeLineDistances()
    return line
  }, [])
  useEffect(
    () => () => {
      ringLine.geometry.dispose()
      ;(ringLine.material as THREE.Material).dispose()
    },
    [ringLine],
  )
  const ringMaterial = ringLine.material as THREE.LineDashedMaterial

  const warmColor = useMemo(() => new THREE.Color('#E7EAF3'), [])
  const coolColor = useMemo(() => new THREE.Color('#8F9DC0'), [])
  const keyColor = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    const el = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      onContextLost()
    }
    el.addEventListener('webglcontextlost', handleLost)
    return () => el.removeEventListener('webglcontextlost', handleLost)
  }, [gl, onContextLost])

  useEffect(() => {
    if (!pointerFine) return
    const handleMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', handleMove, { passive: true })
    return () => window.removeEventListener('pointermove', handleMove)
  }, [pointerFine])

  useEffect(() => {
    const unsubscribe = progress.on('change', () => invalidate())
    invalidate()
    return unsubscribe
  }, [progress])

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const p = progress.get()
    const frame = sampleHeroFrame(p)
    const c = cur.current
    let dirty = lastProgress.current !== p
    lastProgress.current = p

    const damp = (current: number, target: number, lambda: number) => {
      const next = THREE.MathUtils.damp(current, target, lambda, dt)
      if (Math.abs(next - target) > 5e-4) dirty = true
      return next
    }

    if (pointerFine) {
      c.ptrX = damp(c.ptrX, pointer.current.x, 4)
      c.ptrY = damp(c.ptrY, pointer.current.y, 4)
    }
    const pointerWeight = Math.min(1, Math.max(0, (1 - p) / 0.1))
    const parallaxX = pointerFine ? c.ptrX * 0.16 * pointerWeight : 0
    const parallaxY = pointerFine ? c.ptrY * 0.1 * pointerWeight : 0

    c.camPos.x = damp(c.camPos.x, frame.camera.position.x + parallaxX, 6)
    c.camPos.y = damp(c.camPos.y, frame.camera.position.y + parallaxY, 6)
    c.camPos.z = damp(c.camPos.z, frame.camera.position.z, 6)
    c.camTarget.x = damp(c.camTarget.x, frame.camera.target.x + parallaxX * 0.3, 6)
    c.camTarget.y = damp(c.camTarget.y, frame.camera.target.y + parallaxY * 0.3, 6)
    c.camTarget.z = damp(c.camTarget.z, frame.camera.target.z, 6)
    camera.position.copy(c.camPos)
    camera.lookAt(c.camTarget)

    const mark = markRef.current
    if (mark) {
      c.markRot.x = damp(c.markRot.x, frame.mark.rotation.x, 7)
      c.markRot.y = damp(c.markRot.y, frame.mark.rotation.y, 7)
      c.markRot.z = damp(c.markRot.z, frame.mark.rotation.z, 7)
      c.markPos.x = damp(c.markPos.x, frame.mark.position.x, 7)
      c.markPos.y = damp(c.markPos.y, frame.mark.position.y, 7)
      c.markPos.z = damp(c.markPos.z, frame.mark.position.z, 7)
      c.markScale = damp(c.markScale, frame.mark.scale, 7)
      c.markOpacity = damp(c.markOpacity, frame.mark.opacity, 7)
      mark.rotation.set(c.markRot.x, c.markRot.y, c.markRot.z)
      mark.position.copy(c.markPos)
      mark.scale.setScalar(c.markScale)
      material.opacity = c.markOpacity
      const shouldBeTransparent = c.markOpacity < 0.999
      if (material.transparent !== shouldBeTransparent) {
        material.transparent = shouldBeTransparent
        material.needsUpdate = true
      }
    }

    const ringInner = ringInnerRef.current
    if (ringInner) {
      c.ringRotY = damp(c.ringRotY, frame.ring.rotationY, 8)
      c.ringOpacity = damp(c.ringOpacity, frame.ring.opacity, 8)
      c.ringScale = damp(c.ringScale, frame.ring.scale, 8)
      ringInner.rotation.y = c.ringRotY
      ringInner.scale.setScalar(c.ringScale)
      ringMaterial.opacity = c.ringOpacity
      ringMaterial.visible = c.ringOpacity > 0.01
    }

    const keyLight = keyRef.current
    if (keyLight) {
      c.key = damp(c.key, frame.lights.key, 5)
      c.warmth = damp(c.warmth, frame.lights.warmth, 5)
      keyLight.intensity = c.key
      keyColor.copy(coolColor).lerp(warmColor, c.warmth)
      keyLight.color.copy(keyColor)
    }
    const fillLight = fillRef.current
    if (fillLight) {
      c.fill = damp(c.fill, frame.lights.fill, 5)
      fillLight.intensity = c.fill
    }
    const rimLight = rimRef.current
    if (rimLight) {
      c.rim = damp(c.rim, frame.lights.rim, 5)
      rimLight.intensity = c.rim
    }

    if (dirty) invalidate()
  })

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight ref={keyRef} position={[2.6, 3.2, 2.4]} intensity={2.2} />
      <directionalLight ref={fillRef} position={[-2.8, 0.6, 2.2]} intensity={0.9} color="#E7EAF3" />
      <directionalLight ref={rimRef} position={[-1.4, 2.2, -3.2]} intensity={1.2} color="#8F9DC0" />
      <MarkMesh parts={parts} material={material} groupRef={markRef} />
      <OrbitRing line={ringLine} innerRef={ringInnerRef} />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.4} position={[0, 2.5, 2]} scale={[5, 2, 1]} color="#E7EAF3" />
        <Lightformer intensity={1.4} position={[-3, 0.5, 1]} scale={[2, 4, 1]} color="#8F9DC0" rotation-y={Math.PI / 2} />
        <Lightformer intensity={2} position={[3, 1.5, -1.5]} scale={[3, 3, 1]} color="#8F9DC0" rotation-y={-Math.PI / 3} />
      </Environment>
    </>
  )
}

export default function HeroScene({ progress, onContextLost }: HeroSceneProps) {
  const [dpr] = useState<[number, number]>(() => [1, window.innerWidth < 640 ? 1.5 : 1.75])

  return (
    <Canvas
      frameloop="demand"
      dpr={dpr}
      gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 0.1, far: 60, position: [0, 0.1, 4.6] }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContents progress={progress} onContextLost={onContextLost} />
    </Canvas>
  )
}
