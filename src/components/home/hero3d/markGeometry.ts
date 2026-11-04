import * as THREE from 'three'

const SCALE = 0.01
const TUBE_RADIUS = 0.17

const tx = (x: number) => (x - 100) * SCALE
const ty = (y: number) => (120 - y) * SCALE
const v = (x: number, y: number) => new THREE.Vector3(tx(x), ty(y), 0)

export interface MarkParts {
  stroke: THREE.BufferGeometry
  sphere: THREE.BufferGeometry
  dot: [number, number, number]
}

/**
 * Builds the TRACE question mark as real 3D geometry: a tube swept along the
 * brand hook path (stroke centerline) with round caps welded into the same
 * vertex buffer, plus the separate dot sphere. Pure SVG-path coordinates ->
 * three.js units, no external assets.
 */
export function createMarkParts(quality: 'low' | 'high'): MarkParts {
  const path = new THREE.CurvePath<THREE.Vector3>()
  path.add(new THREE.CubicBezierCurve3(v(50, 78), v(50, 45), v(73, 26), v(100, 26)))
  path.add(new THREE.CubicBezierCurve3(v(100, 26), v(127, 26), v(150, 45), v(150, 78)))
  // Second control point sits on the stem axis so the tangent entering the
  // straight segment is exactly vertical: no kink where the frames must align.
  path.add(new THREE.CubicBezierCurve3(v(150, 78), v(150, 102), v(100, 114), v(100, 132)))
  path.add(new THREE.LineCurve3(v(100, 132), v(100, 172)))

  const tubularSegments = quality === 'high' ? 96 : 56
  const radialSegments = quality === 'high' ? 16 : 10
  const capRings = quality === 'high' ? 8 : 5
  const dotSegments = quality === 'high' ? 24 : 14

  const tube = new THREE.TubeGeometry(path, tubularSegments, TUBE_RADIUS, radialSegments, false)
  const stroke = weldRoundCaps(tube, path, TUBE_RADIUS, radialSegments, capRings)
  tube.dispose()

  return {
    stroke,
    sphere: new THREE.SphereGeometry(TUBE_RADIUS, dotSegments, dotSegments),
    dot: [tx(100), ty(222), 0],
  }
}

/**
 * Welds hemispherical end caps into the tube's own vertex buffer, sharing the
 * tube's end-ring vertices. Separate cap meshes (equal or fatter radius) never
 * work: two faceted surfaces crossing at a shallow angle z-fight along the
 * junction into a sawtooth seam. One continuous surface cannot fight itself,
 * and the shared ring keeps normals smooth across the join.
 */
function weldRoundCaps(
  tube: THREE.TubeGeometry,
  path: THREE.CurvePath<THREE.Vector3>,
  radius: number,
  radialSegments: number,
  capRings: number,
): THREE.BufferGeometry {
  const tubeIndex = tube.index
  const tubePos = tube.getAttribute('position') as THREE.BufferAttribute
  const tubeNorm = tube.getAttribute('normal') as THREE.BufferAttribute
  const tubeUv = tube.getAttribute('uv') as THREE.BufferAttribute
  if (!tubeIndex) throw new Error('tube geometry is missing its index')

  const rings = tube.parameters.tubularSegments + 1
  const ringVerts = radialSegments + 1
  const tubeVerts = rings * ringVerts
  const capVerts = 1 + Math.max(capRings - 1, 0) * ringVerts

  const positions = Array.from(tubePos.array)
  const normals = Array.from(tubeNorm.array)
  const uvs = Array.from(tubeUv.array)
  const indices = Array.from(tubeIndex.array)

  const start = path.getPointAt(0)
  const startOut = path.getTangentAt(0).normalize().negate()
  indices.push(...appendCap(positions, normals, uvs, start, startOut, 0, tubeVerts, radius, radialSegments, capRings))

  const end = path.getPointAt(1)
  const endOut = path.getTangentAt(1).normalize()
  const endBase = tubeVerts + capVerts
  indices.push(
    ...appendCap(positions, normals, uvs, end, endOut, (rings - 1) * ringVerts, endBase, radius, radialSegments, capRings),
  )

  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(indices)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}

function appendCap(
  positions: number[],
  normals: number[],
  uvs: number[],
  center: THREE.Vector3,
  outward: THREE.Vector3,
  equatorBase: number,
  capBase: number,
  radius: number,
  radialSegments: number,
  capRings: number,
): number[] {
  const ringVerts = radialSegments + 1
  const indices: number[] = []

  positions.push(center.x + outward.x * radius, center.y + outward.y * radius, center.z + outward.z * radius)
  normals.push(outward.x, outward.y, outward.z)
  uvs.push(0.5, 1)

  for (let m = 1; m < capRings; m++) {
    const phi = (m / capRings) * (Math.PI / 2)
    const h = Math.cos(phi) * radius
    const r = Math.sin(phi) * radius
    for (let j = 0; j <= radialSegments; j++) {
      const eq = (equatorBase + j) * 3
      const rx = (positions[eq] - center.x) / radius
      const ry = (positions[eq + 1] - center.y) / radius
      const rz = (positions[eq + 2] - center.z) / radius
      const px = center.x + outward.x * h + rx * r
      const py = center.y + outward.y * h + ry * r
      const pz = center.z + outward.z * h + rz * r
      const dx = px - center.x
      const dy = py - center.y
      const dz = pz - center.z
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
      positions.push(px, py, pz)
      normals.push(dx / len, dy / len, dz / len)
      uvs.push(j / radialSegments, 1 - m / capRings)
    }
  }

  const ringIndex = (m: number) => capBase + 1 + (m - 1) * ringVerts
  const eqIndex = (j: number) => equatorBase + j
  const pole = capBase
  const fan = capRings > 1 ? (j: number) => ringIndex(1) + j : (j: number) => eqIndex(j)

  for (let j = 0; j < radialSegments; j++) {
    pushFace(indices, pole, fan(j + 1), fan(j), positions, center)
  }

  for (let m = 1; m + 1 < capRings; m++) {
    for (let j = 0; j < radialSegments; j++) {
      pushFace(indices, ringIndex(m) + j, ringIndex(m) + j + 1, ringIndex(m + 1) + j + 1, positions, center)
      pushFace(indices, ringIndex(m) + j, ringIndex(m + 1) + j + 1, ringIndex(m + 1) + j, positions, center)
    }
  }

  if (capRings > 1) {
    const last = capRings - 1
    for (let j = 0; j < radialSegments; j++) {
      pushFace(indices, ringIndex(last) + j, ringIndex(last) + j + 1, eqIndex(j + 1), positions, center)
      pushFace(indices, ringIndex(last) + j, eqIndex(j + 1), eqIndex(j), positions, center)
    }
  }

  return indices
}

function pushFace(
  indices: number[],
  a: number,
  b: number,
  c: number,
  positions: number[],
  center: THREE.Vector3,
): void {
  const ai = a * 3
  const bi = b * 3
  const ci = c * 3
  const abx = positions[bi] - positions[ai]
  const aby = positions[bi + 1] - positions[ai + 1]
  const abz = positions[bi + 2] - positions[ai + 2]
  const acx = positions[ci] - positions[ai]
  const acy = positions[ci + 1] - positions[ai + 1]
  const acz = positions[ci + 2] - positions[ai + 2]
  const nx = aby * acz - abz * acy
  const ny = abz * acx - abx * acz
  const nz = abx * acy - aby * acx
  const cx = (positions[ai] + positions[bi] + positions[ci]) / 3 - center.x
  const cy = (positions[ai + 1] + positions[bi + 1] + positions[ci + 1]) / 3 - center.y
  const cz = (positions[ai + 2] + positions[bi + 2] + positions[ci + 2]) / 3 - center.z
  if (nx * cx + ny * cy + nz * cz < 0) {
    indices.push(a, c, b)
  } else {
    indices.push(a, b, c)
  }
}

export function disposeMarkParts(parts: MarkParts): void {
  parts.stroke.dispose()
  parts.sphere.dispose()
}
