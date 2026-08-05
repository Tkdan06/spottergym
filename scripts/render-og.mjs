import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const svg = readFileSync('public/og-image.svg')
const png = await sharp(svg, { density: 150 }).resize(1200, 630).png().toBuffer()
writeFileSync('public/og-image.png', png)
console.log('wrote', png.length, 'bytes')
