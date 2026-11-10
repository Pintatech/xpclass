// Pet Home (/pets): constants and pure helpers. No React in this file.

import { assetUrl } from '../../../hooks/useBranding'

// The habitat is one fixed 16:9 world. A pet saved at (x%, y%) stands on the same spot on a phone and on a PC:
// phones show part of the world and swipe sideways, wide screens show all of it.
export const WORLD_W = 1600
export const WORLD_H = 900

// Where a pet may stand when dragged by hand (percent of the world, pet centre).
export const BOUNDS = { x0: 3, x1: 97, y0: 8, y1: 95 }
// The floor band used when the app picks a spot by itself (Place, Place all, Tidy up, Shuffle).
export const FLOOR = { x0: 6, x1: 94, y0: 62, y1: 90 }

// Pet size in world pixels before the depth scale.
const SPRITE_BASE = 96
const SPRITE_EVOLVED = 124

export const defaultBackground = () => assetUrl('/pet-habitat/pet-home-2.jpg')

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

// Every class string is written out in full so Tailwind keeps it.
export const RARITY = {
  common: {
    label: 'Common', stars: 1, rank: 0, glow: null, hex: '#94a3b8',
    chip: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300',
    tile: 'from-slate-100 to-slate-200', ring: 'ring-slate-300', text: 'text-slate-500',
    bar: 'from-slate-400 to-slate-500', hero: 'from-slate-300 via-slate-100 to-white', dot: 'bg-slate-400',
  },
  uncommon: {
    label: 'Uncommon', stars: 2, rank: 1, glow: null, hex: '#22c55e',
    chip: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300',
    tile: 'from-emerald-50 to-emerald-100', ring: 'ring-emerald-300', text: 'text-emerald-600',
    bar: 'from-emerald-400 to-green-500', hero: 'from-emerald-300 via-emerald-100 to-white', dot: 'bg-emerald-500',
  },
  rare: {
    label: 'Rare', stars: 3, rank: 2, glow: 'rgba(96,165,250,0.75)', hex: '#3b82f6',
    chip: 'bg-sky-100 text-sky-700 ring-1 ring-sky-300',
    tile: 'from-sky-50 to-blue-100', ring: 'ring-sky-300', text: 'text-sky-600',
    bar: 'from-sky-400 to-blue-500', hero: 'from-sky-300 via-sky-100 to-white', dot: 'bg-sky-500',
  },
  epic: {
    label: 'Epic', stars: 4, rank: 3, glow: 'rgba(192,132,252,0.8)', hex: '#a855f7',
    chip: 'bg-violet-100 text-violet-700 ring-1 ring-violet-300',
    tile: 'from-violet-50 to-fuchsia-100', ring: 'ring-violet-300', text: 'text-violet-600',
    bar: 'from-violet-400 to-fuchsia-500', hero: 'from-violet-300 via-fuchsia-100 to-white', dot: 'bg-violet-500',
  },
  legendary: {
    label: 'Legendary', stars: 5, rank: 4, glow: 'rgba(250,204,21,0.85)', hex: '#f59e0b',
    chip: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
    tile: 'from-amber-50 to-yellow-100', ring: 'ring-amber-300', text: 'text-amber-600',
    bar: 'from-amber-400 to-orange-500', hero: 'from-amber-300 via-yellow-100 to-white', dot: 'bg-amber-500',
  },
}

export const rarityKey = (up) => (RARITY[up?.pet?.rarity] ? up.pet.rarity : 'common')
export const rarityOf = (up) => RARITY[rarityKey(up)]

export const petName = (up) => up?.nickname || up?.pet?.name || 'Pet'

export const isEvolved = (up) => (up?.evolution_stage || 0) > 0

export const petImage = (up) => {
  const pet = up?.pet
  if (!pet) return null
  if (isEvolved(up) && Array.isArray(pet.evolution_stages)) {
    const stage = pet.evolution_stages.find((s) => s.stage === up.evolution_stage)
    if (stage?.image_url) return stage.image_url
  }
  return pet.image_url || null
}

// Same numbers as getActiveBonuses in usePet: rarity bonus plus 5% per evolution stage.
const RARITY_BONUS = { common: 5, uncommon: 10, rare: 15, epic: 20, legendary: 25 }
export const companionBonus = (up) => (RARITY_BONUS[rarityKey(up)] || 0) + (up?.evolution_stage || 0) * 5

export const evolutionInfo = (up) => {
  const stages = Array.isArray(up?.pet?.evolution_stages) ? up.pet.evolution_stages : []
  const current = up?.evolution_stage || 0
  const next = stages.find((s) => s.stage === current + 1) || null
  return { current, total: stages.length, next }
}

// Recently caught pets get a NEW tag.
const NEW_FOR_MS = 48 * 60 * 60 * 1000
export const isNew = (up, now = Date.now()) => {
  const t = up?.obtained_at ? Date.parse(up.obtained_at) : NaN
  return Number.isFinite(t) && now - t < NEW_FOR_MS
}

// Smaller copies of Supabase Storage images (pet art is often 1024px). Only for this kind of URL; GIF and SVG keep
// the original. Callers fall back to the original URL if the resized one fails to load.
const OBJECT_PATH = '/storage/v1/object/public/'
const RENDER_PATH = '/storage/v1/render/image/public/'
export const thumbUrl = (url, size) => {
  if (!url || !size || !url.includes(OBJECT_PATH) || /\.(gif|svg)(\?|#|$)/i.test(url)) return url
  const [base, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  params.set('width', String(size))
  params.set('height', String(size))
  params.set('resize', 'contain')
  params.set('quality', '75')
  return `${base.replace(OBJECT_PATH, RENDER_PATH)}?${params.toString()}`
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round2 = (v) => Math.round(v * 100) / 100

export const clampToBounds = (x, y) => ({
  x: round2(clamp(x, BOUNDS.x0, BOUNDS.x1)),
  y: round2(clamp(y, BOUNDS.y0, BOUNDS.y1)),
})

// Pets further back look a little smaller.
export const depthScale = (y) => 0.8 + 0.3 * (clamp(y, 0, 100) / 100)

export const spriteSize = (up) => (isEvolved(up) ? SPRITE_EVOLVED : SPRITE_BASE)

// ---- Layout: { [userPetId]: { x, y, flip } } for the pets that are in the home ----

const EPS = 0.005
export const samePos = (a, b) => {
  if (!a || !b) return !a && !b
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS && !!a.flip === !!b.flip
}

export const sameLayout = (a, b) => {
  if (a === b) return true
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => samePos(a[k], b[k]))
}

export const layoutFromPets = (userPets) => {
  const out = {}
  for (const up of userPets || []) {
    if (up.habitat_x != null && up.habitat_y != null) {
      out[up.id] = { x: Number(up.habitat_x), y: Number(up.habitat_y), flip: !!up.habitat_flip }
    }
  }
  return out
}

// Rows to write: every pet whose spot differs from what the database holds. x = null means "in the bag".
export const diffLayouts = (next, saved, ids) => {
  const changes = []
  for (const id of ids) {
    const a = next[id]
    const b = saved[id]
    if (samePos(a, b)) continue
    changes.push(a ? { id, x: a.x, y: a.y, flip: !!a.flip } : { id, x: null, y: null, flip: false })
  }
  return changes
}

// Distance in world pixels, so a gap reads the same sideways and up-down.
const dist = (a, b) => Math.hypot(((a.x - b.x) / 100) * WORLD_W, ((a.y - b.y) / 100) * WORLD_H)

// A free spot on the floor: the candidate furthest from every other pet, preferring the part of the world on screen
// (`view` = { x0, x1 } in percent) and the front of the floor.
export const findFreeSpot = (layout, { view = null, exclude = null, rand = Math.random } = {}) => {
  const others = Object.entries(layout)
    .filter(([id]) => id !== exclude)
    .map(([, p]) => p)
  const vx0 = view ? clamp(view.x0 + 4, FLOOR.x0, FLOOR.x1) : FLOOR.x0
  const vx1 = view ? clamp(view.x1 - 4, FLOOR.x0, FLOOR.x1) : FLOOR.x1
  const x0 = vx1 - vx0 >= 8 ? vx0 : FLOOR.x0
  const x1 = vx1 - vx0 >= 8 ? vx1 : FLOOR.x1
  const cols = 9
  const rows = 6
  let best = null
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const c = {
        x: x0 + ((x1 - x0) * (i + 0.5)) / cols + (rand() - 0.5) * 2,
        y: FLOOR.y0 + ((FLOOR.y1 - FLOOR.y0) * (j + 0.5)) / rows + (rand() - 0.5) * 2,
      }
      const gap = others.length ? Math.min(...others.map((o) => dist(c, o))) : 400
      // Gaps beyond ~180px all look free; then prefer the front of the floor and the middle of the view.
      const midX = (x0 + x1) / 2
      const score = Math.min(gap, 180) + (c.y - FLOOR.y0) * 0.9 - Math.abs(c.x - midX) * 0.6 + rand() * 6
      if (!best || score > best.score) best = { ...c, score }
    }
  }
  return clampToBounds(best.x, best.y)
}

// Tidy up: neat staggered rows on the floor, companion in front, then rarity and level.
export const arrangeRows = (ids, keepFlip = {}) => {
  const n = ids.length
  if (!n) return {}
  const perRow = n <= 6 ? n : n <= 14 ? Math.ceil(n / 2) : Math.min(14, Math.ceil(n / 3))
  const rowCount = Math.ceil(n / perRow)
  const front = 88
  const back = Math.max(50, front - (rowCount - 1) * 12)
  const out = {}
  let k = 0
  for (let r = 0; r < rowCount; r += 1) {
    const inRow = Math.min(perRow, n - k)
    const y = rowCount === 1 ? 80 : front - ((front - back) * r) / (rowCount - 1)
    const span = Math.min(84, (inRow - 1) * 11)
    const stagger = r % 2 ? 2.5 : 0
    // Slots from the middle outwards, so the first pets of a row (companion, rarest) stand in the centre.
    const slots = Array.from({ length: inRow }, (_, i) => (inRow === 1 ? 50 : 50 - span / 2 + (span * i) / (inRow - 1)))
      .map((x) => x + stagger)
      .sort((a, b) => Math.abs(a - 50 - stagger) - Math.abs(b - 50 - stagger))
    for (let i = 0; i < inRow; i += 1) {
      const id = ids[k]
      out[id] = { ...clampToBounds(slots[i], y), flip: !!keepFlip[id] }
      k += 1
    }
  }
  return out
}

// Shuffle: random spots on the floor that keep apart (dart throwing, the gap shrinks when the floor gets full).
export const arrangeScatter = (ids, keepFlip = {}, rand = Math.random) => {
  const out = {}
  const placed = []
  let gap = 150
  for (const id of ids) {
    let spot = null
    for (let tries = 0; tries < 40 && !spot; tries += 1) {
      const c = {
        x: FLOOR.x0 + rand() * (FLOOR.x1 - FLOOR.x0),
        y: FLOOR.y0 - 4 + rand() * (FLOOR.y1 - FLOOR.y0 + 4),
      }
      if (placed.every((p) => dist(p, c) >= gap)) spot = c
    }
    if (!spot) {
      gap = Math.max(40, gap * 0.8)
      spot = { x: FLOOR.x0 + rand() * (FLOOR.x1 - FLOOR.x0), y: FLOOR.y0 + rand() * (FLOOR.y1 - FLOOR.y0) }
    }
    placed.push(spot)
    out[id] = { ...clampToBounds(spot.x, spot.y), flip: keepFlip[id] ?? rand() < 0.5 }
  }
  return out
}

// ---- Lists ----

// Lowercase without Vietnamese accents, so "meo" finds "Mèo".
export const normalizeText = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()

export const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'level', label: 'Level' },
  { key: 'name', label: 'Name' },
]

export const sortPets = (list, sortKey, companionId) => {
  const byNewest = (a, b) => (Date.parse(b.obtained_at) || 0) - (Date.parse(a.obtained_at) || 0)
  const cmp = {
    newest: byNewest,
    rarity: (a, b) => rarityOf(b).rank - rarityOf(a).rank || (b.level || 0) - (a.level || 0) || byNewest(a, b),
    level: (a, b) => (b.level || 0) - (a.level || 0) || (b.xp || 0) - (a.xp || 0) || byNewest(a, b),
    name: (a, b) => petName(a).localeCompare(petName(b)) || byNewest(a, b),
  }[sortKey] || byNewest
  return [...list].sort((a, b) => (b.id === companionId) - (a.id === companionId) || cmp(a, b))
}

// ---- Time of day ----

export const LIGHTING_MODES = ['auto', 'day', 'night']

export const timeOfDay = (mode, date = new Date()) => {
  if (mode === 'day' || mode === 'night') return mode
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 6 && h < 17) return 'day'
  if (h >= 17 && h < 19) return 'dusk'
  return 'night'
}

// localStorage can throw (private mode, blocked storage); the page works without it.
export const readPref = (key, fallback) => {
  try {
    const v = window.localStorage.getItem(`petHome.${key}`)
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}

export const writePref = (key, value) => {
  try {
    window.localStorage.setItem(`petHome.${key}`, JSON.stringify(value))
  } catch {
    // ignore
  }
}
