import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const svgPath = resolve('docs/aws-architecture.svg')
const pngPath = resolve('docs/aws-architecture.png')
const svg = readFileSync(svgPath)

await sharp(svg, { density: 192 })
  .png({ compressionLevel: 9, quality: 95 })
  .toFile(pngPath)

console.log(`Wrote ${pngPath}`)
