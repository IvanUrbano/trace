import type { RefObject } from 'react'
import type * as THREE from 'three'

interface OrbitRingProps {
  line: THREE.Line
  innerRef: RefObject<THREE.Group>
}

export function OrbitRing({ line, innerRef }: OrbitRingProps) {
  return (
    <group rotation={[0.32, 0, 0]}>
      <group ref={innerRef}>
        <primitive object={line} />
      </group>
    </group>
  )
}
