/**
 * Packs a pack of loose sprite frames into the strips public/event/ expects.
 *
 *   node scripts/pack-sprite-sheet.mjs --src <dir> --out <dir> [options] Src:name ...
 *
 * A source is either a folder of one-PNG-per-frame, or a strip file (Idle.png)
 * sliced by --cell. --crop takes the same window out of every frame; --canvas
 * pads them all onto a common box.
 *
 * Example — the Dark Ninja pack, whose attacks are drawn on a wider canvas than
 * the rest so the blade has room:
 *
 *   node scripts/pack-sprite-sheet.mjs \
 *     --src "C:/.../Pixel_DarkNinja_32px/frames" \
 *     --out public/event/monsters/ninja --canvas 96x64 \
 *     Idle:idle Move:run Attack1:attack Hurt:hit Teleport1:die Teleport2:arrival
 *
 * Each argument is <source folder>:<animation name>. The folder's PNGs are read
 * in filename order and laid out left to right in one strip.
 *
 * Why --canvas: eventCharacter configs carry ONE frameWidth/frameHeight for the
 * whole monster, so a pack that draws its attacks wider than its idle has to be
 * normalised onto a common box first. Frames are placed at the canvas's top-left,
 * which is right whenever the extra width is reach added on one side — check that
 * with the reported bounds, which is what they are printed for: a body that
 * wanders between animations means the frames are centred instead, and the packer
 * would need an offset.
 *
 * It also prints the measured alpha bounds and a config block to paste into
 * eventMonsters.js — `content.bottom` is where the feet are, `body` is the
 * creature without its swing, and both are guesses from the idle sheet that
 * deserve a look in /event/sprite-lab before they are trusted.
 *
 * PNG support is deliberately minimal — 8-bit RGBA, non-interlaced, which is what
 * every one of these packs ships — so that this needs no dependencies.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

// ---------------------------------------------------------------- PNG reading

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

const readPng = (file) => {
  const buf = readFileSync(file)
  let pos = 8
  let head = null
  const idat = []

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      head = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12]
      }
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }

  if (!head) throw new Error(`no IHDR: ${file}`)
  if (head.depth !== 8 || head.colorType !== 6 || head.interlace !== 0) {
    throw new Error(
      `${file}: need 8-bit RGBA non-interlaced, got depth ${head.depth} type ${head.colorType} interlace ${head.interlace}`
    )
  }

  const { width, height } = head
  const stride = width * 4
  const raw = inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(stride * height)

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null

    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4] : 0
      const b = prev ? prev[x] : 0
      const c = x >= 4 && prev ? prev[x - 4] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) v += paeth(a, b, c)
      cur[x] = v & 0xff
    }
  }

  return { width, height, data: out }
}

// ---------------------------------------------------------------- PNG writing

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const writePng = (file, { width, height, data }) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]))
}

// -------------------------------------------------------------------- packing

/** Alpha bounds of one frame inside a strip, or null if the frame is empty. */
const frameBounds = (png, index, frameWidth, threshold = 8) => {
  const x0 = index * frameWidth
  let left = Infinity, right = -1, top = Infinity, bottom = -1
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < frameWidth; x++) {
      if (png.data[(y * png.width + x0 + x) * 4 + 3] <= threshold) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  return right < 0 ? null : { left, right, top, bottom }
}

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}

const src = flag('src')
const out = flag('out')

// Anything that is a flag or a flag's value is not a pair — a Windows source
// path carries a drive-letter colon and would otherwise read as one. Only the
// flags that actually take a value consume the argument after them; --flip does
// not, and swallowing its neighbour silently drops an animation.
const VALUE_FLAGS = new Set(['--src', '--out', '--cell', '--crop', '--canvas'])
const taken = new Set()
args.forEach((a, i) => {
  if (!a.startsWith('--')) return
  taken.add(i)
  if (VALUE_FLAGS.has(a)) taken.add(i + 1)
})
const pairs = args.filter((a, i) => !taken.has(i) && a.includes(':'))

if (!src || !out || !pairs.length) {
  console.error('usage: pack-sprite-sheet.mjs --src <dir> --out <dir> [--cell WxH] [--crop x,y,w,h] [--flip] [--canvas WxH] Src:name ...')
  process.exit(1)
}

mkdirSync(out, { recursive: true })

const size = (arg) => (arg ? { width: Number(arg.split('x')[0]), height: Number(arg.split('x')[1]) } : null)
const canvas = size(flag('canvas'))

// A source that is already a strip says how big its frames are; one that is a
// folder of loose frames does not need to.
const cell = size(flag('cell'))

// Packs vary wildly in how much empty canvas they leave around the character —
// Little Axion draws a 24x22 creature in the middle of 144x144 — and every
// transparent row is bytes on the wire and a frame box that does not describe
// the creature. --crop takes the same region out of every frame, so alignment
// between animations is preserved. Measure the union of all the animations'
// bounds first; cropping tighter than that clips a swing.
// The battle mirrors a monster to face the hero, which assumes the art faces
// right. A pack drawn the other way — the skeleton holds its sword to the left —
// would fight with its back turned, so it is mirrored once here rather than
// special-cased in the renderer forever.
const mirror = args.includes('--flip')

const cropArg = flag('crop')
const region = cropArg
  ? (([x, y, w, h]) => ({ x, y, width: w, height: h }))(cropArg.split(',').map(Number))
  : null

const cutFrames = (source) => {
  // A .png source is one strip to be sliced; anything else is a folder of frames.
  if (source.toLowerCase().endsWith('.png')) {
    const sheet = readPng(`${src}/${source}`)
    const box = cell || { width: sheet.height, height: sheet.height }
    const count = sheet.width / box.width
    if (!Number.isInteger(count)) {
      throw new Error(`${source}: ${sheet.width}px does not divide into ${box.width}px frames — pass --cell`)
    }
    return Array.from({ length: count }, (_, i) => cropRegion(sheet, i * box.width, 0, box.width, box.height))
  }

  const files = readdirSync(`${src}/${source}`).filter((f) => f.toLowerCase().endsWith('.png')).sort()
  if (!files.length) throw new Error(`no PNGs in ${src}/${source}`)
  return files.map((f) => readPng(`${src}/${source}/${f}`))
}

/** Mirror one frame left to right. */
function flipX (png) {
  const data = Buffer.alloc(png.data.length)
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const from = (y * png.width + x) * 4
      png.data.copy(data, (y * png.width + (png.width - 1 - x)) * 4, from, from + 4)
    }
  }
  return { width: png.width, height: png.height, data }
}

function cropRegion (png, x0, y0, w, h) {
  const data = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * png.width + x0) * 4
    png.data.copy(data, y * w * 4, from, from + w * 4)
  }
  return { width: w, height: h, data }
}

const results = []

for (const pair of pairs) {
  const [folder, name] = pair.split(':')
  let frames = cutFrames(folder)
  if (region) frames = frames.map((f) => cropRegion(f, region.x, region.y, region.width, region.height))
  if (mirror) frames = frames.map(flipX)

  const cellOut = canvas || { width: frames[0].width, height: frames[0].height }

  for (const f of frames) {
    if (f.width > cellOut.width || f.height > cellOut.height) {
      throw new Error(`${folder}: a ${f.width}x${f.height} frame does not fit the ${cellOut.width}x${cellOut.height} canvas`)
    }
  }

  const strip = {
    width: cellOut.width * frames.length,
    height: cellOut.height,
    data: Buffer.alloc(cellOut.width * frames.length * cellOut.height * 4)
  }

  frames.forEach((frame, i) => {
    for (let y = 0; y < frame.height; y++) {
      const to = ((y * strip.width) + i * cellOut.width) * 4
      frame.data.copy(strip.data, to, y * frame.width * 4, (y + 1) * frame.width * 4)
    }
  })

  writePng(`${out}/${name}.png`, strip)

  // Measure what landed on disk, not what was meant to.
  const written = readPng(`${out}/${name}.png`)
  let box = { left: Infinity, right: -1, top: Infinity, bottom: -1 }
  const empty = []
  for (let i = 0; i < frames.length; i++) {
    const b = frameBounds(written, i, cellOut.width)
    if (!b) { empty.push(i); continue }
    box = {
      left: Math.min(box.left, b.left), right: Math.max(box.right, b.right),
      top: Math.min(box.top, b.top), bottom: Math.max(box.bottom, b.bottom)
    }
  }

  results.push({ name, frames: frames.length, cell: cellOut, box, empty })
  console.log(
    `${name.padEnd(10)} ${String(frames.length).padStart(2)} frames  ${cellOut.width}x${cellOut.height}`,
    `x ${box.left}-${box.right}  y ${box.top}-${box.bottom}`,
    empty.length ? `| empty frames: ${empty.join(',')}` : ''
  )
}

// The idle sheet describes the creature at rest, which is what the floor line and
// the melee stop should be measured from — an attack's reach is not its body.
const idle = results.find((r) => r.name === 'idle') || results[0]
const idleCell = idle.cell

console.log(`
config block for src/config/eventMonsters.js:

    frameWidth: ${idleCell.width},
    frameHeight: ${idleCell.height},
    content: { top: ${idle.box.top}, bottom: ${idle.box.bottom} },
    body: { left: ${idle.box.left}, right: ${idle.box.right} },
    animations: {
${results.map((r) => `      ${(r.name + ':').padEnd(8)} { file: '${r.name}.png', frames: ${r.frames}, fps: 12 },`).join('\n')}
    }
`)
