// Generates valid PNG PWA icons from scratch (no external deps).
// Draws a RetroUI-yellow tile with a black dumbbell glyph. Placeholder
// branding for Phase 0; polished/branded icons come in Phase 3.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, 'public')
mkdirSync(OUT, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  return Buffer.concat([len, body, crc])
}
function png(width, height, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0 // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}
function makeIcon(size, { border = true } = {}) {
  const BG = [255, 219, 51] // RetroUI yellow
  const FG = [17, 17, 17] // near-black
  const rgb = Buffer.alloc(size * size * 3)
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 3
    rgb[i] = c[0]
    rgb[i + 1] = c[1]
    rgb[i + 2] = c[2]
  }
  const rect = (x, y, w, h, c) => {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) set(xx, yy, c)
  }
  rect(0, 0, size, size, BG)
  if (border) {
    const bw = Math.round(size * 0.06)
    rect(0, 0, size, bw, FG)
    rect(0, size - bw, size, bw, FG)
    rect(0, 0, bw, size, FG)
    rect(size - bw, 0, bw, size, FG)
  }
  // Dumbbell: center bar + two plates, kept within the maskable safe zone.
  const cx = size / 2
  const cy = size / 2
  const barW = size * 0.42
  const barH = size * 0.11
  rect(cx - barW / 2, cy - barH / 2, barW, barH, FG)
  const plateW = size * 0.1
  const plateH = size * 0.32
  rect(cx - barW / 2 - plateW, cy - plateH / 2, plateW, plateH, FG)
  rect(cx + barW / 2, cy - plateH / 2, plateW, plateH, FG)
  return png(size, size, rgb)
}

const files = [
  ['pwa-192x192.png', makeIcon(192)],
  ['pwa-512x512.png', makeIcon(512)],
  ['pwa-maskable-512x512.png', makeIcon(512, { border: false })],
  ['apple-touch-icon.png', makeIcon(180)],
  ['favicon-48x48.png', makeIcon(48)],
]
for (const [name, buf] of files) {
  writeFileSync(resolve(OUT, name), buf)
  console.log(`wrote ${name} (${buf.length} bytes)`)
}

// A crisp SVG favicon for modern browsers.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#ffdb33"/>
  <rect x="0" y="0" width="64" height="4" fill="#111"/>
  <rect x="0" y="60" width="64" height="4" fill="#111"/>
  <rect x="0" y="0" width="4" height="64" fill="#111"/>
  <rect x="60" y="0" width="4" height="64" fill="#111"/>
  <rect x="18" y="28.5" width="28" height="7" fill="#111"/>
  <rect x="11" y="22" width="7" height="20" fill="#111"/>
  <rect x="46" y="22" width="7" height="20" fill="#111"/>
</svg>`
writeFileSync(resolve(OUT, 'favicon.svg'), favicon)
console.log('wrote favicon.svg')
