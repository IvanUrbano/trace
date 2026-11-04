import type { RefObject } from 'react'
import type * as THREE from 'three'
import type { MarkParts } from './markGeometry'

interface MarkMeshProps {
  parts: MarkParts
  material: THREE.MeshPhysicalMaterial
  groupRef: RefObject<THREE.Group>
}

export function MarkMesh({ parts, material, groupRef }: MarkMeshProps) {
  return (
    <group ref={groupRef}>
      <mesh geometry={parts.stroke} material={material} />
      <mesh geometry={parts.sphere} material={material} position={parts.dot} />
    </group>
  )
}
