// Generates valid PNG PWA icons from scratch (no external deps), using the
// design-reference tokens (Classic RetroUI): cream #FBF7EC, amber #FFC53D,
// ink #1B1A17. Two compositions:
//  - tile: cream canvas, amber card with an ink border and the RetroUI hard
//    offset shadow, double-plate dumbbell glyph (launcher icons).
//  - fullbleed: edge-to-edge amber with the glyph kept inside the maskable
//    safe zone (maskable / apple-touch / small favicon).
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = process.argv[2] ? resolve(process.argv[2]) : resolve(__dirname, '../public')
mkdirSync(OUT, { recursive: true })

const AMBER = [255, 197, 61] // #FFC53D
const INK = [27, 26, 23] // #1B1A17
const CREAM = [251, 247, 236] // #FBF7EC

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

function canvas(size, bg) {
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
  rect(0, 0, size, size, bg)
  return { rgb, rect }
}

/**
 * Double-plate dumbbell, ink, centered on (cx, cy). `g` scales the glyph:
 * total width = 0.62g, plate height = 0.42g.
 */
function dumbbell(rect, cx, cy, g) {
  const bar = { w: 0.56 * g, h: 0.1 * g }
  const inner = { w: 0.09 * g, h: 0.42 * g, at: 0.2 * g }
  const outer = { w: 0.07 * g, h: 0.3 * g, at: 0.275 * g }
  rect(cx - bar.w / 2, cy - bar.h / 2, bar.w, bar.h, INK)
  for (const s of [-1, 1]) {
    rect(cx + s * inner.at - inner.w / 2, cy - inner.h / 2, inner.w, inner.h, INK)
    rect(cx + s * outer.at - outer.w / 2, cy - outer.h / 2, outer.w, outer.h, INK)
  }
}

/** Launcher icon: cream canvas, amber card + ink border + hard offset shadow. */
function tileIcon(size) {
  const { rgb, rect } = canvas(size, CREAM)
  const inset = 0.1 * size
  const card = size - 2 * inset
  const shadow = 0.05 * size
  const border = Math.max(2, Math.round(0.045 * size))
  rect(inset + shadow, inset + shadow, card, card, INK) // hard shadow
  rect(inset, inset, card, card, INK) // border (card underlay)
  rect(inset + border, inset + border, card - 2 * border, card - 2 * border, AMBER)
  dumbbell(rect, size / 2, size / 2, 0.92 * size)
  return png(size, size, rgb)
}

/** Full-bleed amber; glyph sized for the maskable safe zone. Optional frame. */
function fullbleedIcon(size, { border = false } = {}) {
  const { rgb, rect } = canvas(size, AMBER)
  if (border) {
    const bw = Math.max(2, Math.round(0.06 * size))
    rect(0, 0, size, bw, INK)
    rect(0, size - bw, size, bw, INK)
    rect(0, 0, bw, size, INK)
    rect(size - bw, 0, bw, size, INK)
  }
  dumbbell(rect, size / 2, size / 2, size)
  return png(size, size, rgb)
}

const files = [
  ['pwa-192x192.png', tileIcon(192)],
  ['pwa-512x512.png', tileIcon(512)],
  ['pwa-maskable-512x512.png', fullbleedIcon(512)],
  ['apple-touch-icon.png', fullbleedIcon(180)],
  ['favicon-48x48.png', fullbleedIcon(48, { border: true })],
]
for (const [name, buf] of files) {
  writeFileSync(resolve(OUT, name), buf)
  console.log(`wrote ${name} (${buf.length} bytes)`)
}

// A crisp SVG favicon for modern browsers (same fullbleed + frame design).
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#FFC53D"/>
  <path d="M0 0h64v4H0zM0 60h64v4H0zM0 0h4v64H0zM60 0h4v64h-4z" fill="#1B1A17"/>
  <rect x="14.1" y="28.8" width="35.8" height="6.4" fill="#1B1A17"/>
  <rect x="16.3" y="18.6" width="5.8" height="26.9" fill="#1B1A17"/>
  <rect x="41.9" y="18.6" width="5.8" height="26.9" fill="#1B1A17"/>
  <rect x="12.2" y="22.4" width="4.5" height="19.2" fill="#1B1A17"/>
  <rect x="47.4" y="22.4" width="4.5" height="19.2" fill="#1B1A17"/>
</svg>`
writeFileSync(resolve(OUT, 'favicon.svg'), favicon)
console.log('wrote favicon.svg')
