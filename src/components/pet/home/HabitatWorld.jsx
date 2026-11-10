import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Crown, FlipHorizontal2, Heart, Info, PackageMinus } from 'lucide-react'
import PetImage from './PetImage'
import {
  WORLD_H,
  clamp,
  depthScale,
  petImage,
  petName,
  rarityOf,
  spriteSize,
} from './petHomeUtils'

const prevent = (e) => e.preventDefault()

// The world box always fills the screen height. PC screens (3:2 or wider) see all of it, edge to edge with no bands;
// narrower screens (phones, the PC with the list open on a small window) keep it 3:2 and swipe sideways.
// Spots are percentages of this box, so a home keeps its look everywhere.
const ASPECT_MIN = 1.5
const computeWorld = (w, h) => {
  if (!w || !h) return { w: 0, h: 0, s: 0 }
  const ww = w / h < ASPECT_MIN ? h * ASPECT_MIN : w
  // Pets are sized from the world height; small screens get them a little bigger.
  return { w: ww, h, s: (h / WORLD_H) * (w < 640 ? 1.15 : 1) }
}

// Fixed pseudo-random numbers so particles do not jump between renders.
const rnd = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

const BURST = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2
  return { '--dx': `${Math.cos(a) * 46}px`, '--dy': `${Math.sin(a) * 34}px` }
})

const Burst = () => (
  <div className="ph-burst" aria-hidden="true">
    {BURST.map((style, i) => (
      <i key={i} style={style} />
    ))}
  </div>
)

const Hearts = () => (
  <div aria-hidden="true">
    {[-26, 0, 24].map((dx, i) => (
      <Heart
        key={dx}
        className="ph-heart w-5 h-5 fill-current"
        style={{ '--dx': `${dx}px`, '--delay': `${i * 0.12}s` }}
      />
    ))}
  </div>
)

// One animated element per sleeping pet (it runs every frame on every visible pet at night).
const Zzz = () => (
  <div className="ph-zzz" aria-hidden="true">
    <span>
      z<small>z</small>
      <b>Z</b>
    </span>
  </div>
)

// Light effects kept to a few animated elements: they all run on every frame.
const Ambient = memo(function Ambient({ tod }) {
  // Two star layers (an SVG each) that twinkle out of step: 30 stars, two animations.
  const stars = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        cx: `${rnd(i * 3) * 100}%`,
        cy: `${rnd(i * 3 + 1) * 100}%`,
        r: 1 + rnd(i * 3 + 2) * 1.4,
      })),
    []
  )
  const flies = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        left: `${4 + rnd(i + 200) * 92}%`,
        top: `${52 + rnd(i + 300) * 42}%`,
        '--d': `${6 + rnd(i + 400) * 6}s`,
        '--delay': `${-rnd(i + 500) * 8}s`,
        '--dx': `${(rnd(i + 600) - 0.5) * 90}px`,
        '--dy': `${-20 - rnd(i + 700) * 60}px`,
      })),
    []
  )
  const motes = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        left: `${rnd(i + 900) * 100}%`,
        top: `${40 + rnd(i + 1000) * 55}%`,
        '--d': `${8 + rnd(i + 1100) * 6}s`,
        '--delay': `${-rnd(i + 1200) * 12}s`,
        '--dx': `${(rnd(i + 1300) - 0.5) * 120}px`,
      })),
    []
  )
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 transition-opacity duration-700 ph-tint-day ${tod === 'day' ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute inset-0 transition-opacity duration-700 ph-tint-dusk ${tod === 'dusk' ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute inset-0 transition-opacity duration-700 ph-tint-night ${tod === 'night' ? 'opacity-100' : 'opacity-0'}`} />
      {tod === 'night' &&
        [0, 1].map((layer) => (
          <svg
            key={layer}
            className="ph-stars"
            style={{ '--d': layer ? '4.6s' : '3.2s', '--delay': layer ? '-2.1s' : '0s' }}
            width="100%"
            height="38%"
          >
            {stars
              .filter((_, i) => i % 2 === layer)
              .map((s, i) => (
                <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" />
              ))}
          </svg>
        ))}
      {tod !== 'day' && flies.map((s, i) => <span key={i} className="ph-firefly" style={s} />)}
      {tod === 'day' && motes.map((s, i) => <span key={i} className="ph-mote" style={s} />)}
    </div>
  )
})

/**
 * One pet standing in the home. Memoized: a drag or a selection change only re-renders the pets it concerns.
 */
const HabitatPet = memo(function HabitatPet({
  up,
  pos,
  s,
  index,
  isCompanion,
  isSelected,
  isDragging,
  sleeping,
  enter,
  reaction,
  onPress,
  onKeyDown,
}) {
  const hopRef = useRef(null)
  const r = rarityOf(up)
  const size = spriteSize(up) * s
  const depth = depthScale(pos.y)
  const bob = {
    '--bob': `${2.6 + (index % 5) * 0.35}s`,
    '--bob-delay': `${-(index % 7) * 0.45}s`,
  }

  // Restart the hop/landing animation without remounting the picture.
  useEffect(() => {
    const el = hopRef.current
    if (!el || !reaction) return
    const cls = reaction.kind === 'land' ? 'ph-land' : 'ph-hop'
    el.classList.remove('ph-hop', 'ph-land')
    void el.offsetWidth
    el.classList.add(cls)
    const t = setTimeout(() => el.classList.remove(cls), 700)
    return () => clearTimeout(t)
  }, [reaction])

  return (
    <div
      className="ph-pet"
      data-pet={up.id}
      data-selected={isSelected ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={`${petName(up)}, ${r.label}${isCompanion ? ', your companion' : ''}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        width: size,
        height: size,
        zIndex: isSelected ? 3000 : Math.round(pos.y * 10),
      }}
      onPointerDown={(e) => onPress(e, up.id)}
      onKeyDown={(e) => onKeyDown(e, up.id)}
      onContextMenu={prevent}
    >
      <div
        className={`ph-pet-pop ${enter ? 'ph-pop-in' : ''}`}
        style={enter ? { animationDelay: `${enter.delay}ms` } : undefined}
      >
        <div className={`ph-pet-depth ${isDragging ? 'ph-dim' : ''}`} style={{ transform: `scale(${depth})` }}>
          {isCompanion && <div className="ph-aura" />}
          {isSelected && <div className="ph-select-ring" />}
          <div className="ph-pet-shadow" style={bob} />
          <div className="ph-pet-flip" style={{ transform: pos.flip ? 'scaleX(-1)' : 'none' }}>
            <div ref={hopRef} className="ph-pet-hop">
              <PetImage
                src={petImage(up)}
                size={320}
                alt={petName(up)}
                eager
                className="ph-pet-img"
                style={{
                  ...bob,
                  filter: r.glow ? `drop-shadow(0 0 ${Math.max(4, 7 * s)}px ${r.glow})` : undefined,
                }}
              />
            </div>
          </div>
          {isCompanion && (
            <div className="ph-crown" aria-hidden="true">
              <div className="rounded-full bg-gradient-to-b from-amber-300 to-amber-500 p-1 shadow-md ring-2 ring-white">
                <Crown className="w-3.5 h-3.5 text-white fill-white" />
              </div>
            </div>
          )}
          {sleeping && <Zzz />}
          {enter?.burst && <Burst />}
          {reaction?.kind === 'love' && <Hearts key={reaction.n} />}
        </div>
        <div className="ph-name">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            <span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />
            {petName(up)}
            <span className="text-white/70 font-semibold">Lv.{up.level || 1}</span>
          </span>
        </div>
      </div>
    </div>
  )
})

const LeavingPet = ({ up, pos, s }) => {
  const size = spriteSize(up) * s
  return (
    <div
      className="ph-pet"
      aria-hidden="true"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: size, height: size, zIndex: Math.round(pos.y * 10), pointerEvents: 'none' }}
    >
      <div className="ph-pet-pop ph-pop-out">
        <div className="ph-pet-depth" style={{ transform: `scale(${depthScale(pos.y)})` }}>
          <div className="ph-pet-flip" style={{ transform: pos.flip ? 'scaleX(-1)' : 'none' }}>
            <PetImage src={petImage(up)} size={320} className="ph-pet-img" eager />
          </div>
        </div>
      </div>
      <Burst />
    </div>
  )
}

/**
 * Phones see a slice of the world. This strip shows the whole width: a dot per pet (gold = companion) and a frame for
 * the slice on screen. Tap or drag on it to jump. Its frame moves through a ref, not a render per scroll.
 */
const MiniMap = memo(
  forwardRef(function MiniMap({ layout, companionId, selectedId, onJump }, ref) {
    const frameRef = useRef(null)
    const boxRef = useRef(null)
    useImperativeHandle(ref, () => ({
      update({ x0, x1 }) {
        const el = frameRef.current
        if (!el) return
        el.style.left = `${x0}%`
        el.style.width = `${Math.max(4, x1 - x0)}%`
      },
    }))
    const jumpTo = (clientX) => {
      const r = boxRef.current?.getBoundingClientRect()
      if (r?.width) onJump(clamp((clientX - r.left) / r.width, 0, 1))
    }
    const onPointerDown = (e) => {
      e.stopPropagation()
      e.preventDefault()
      jumpTo(e.clientX)
      const id = e.pointerId
      const move = (ev) => ev.pointerId === id && jumpTo(ev.clientX)
      const up = (ev) => {
        if (ev.pointerId !== id) return
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    }
    return (
      <div
        ref={boxRef}
        role="slider"
        aria-label="Look around the pet home"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={-1}
        className="relative h-7 w-44 cursor-pointer rounded-full bg-slate-900/35 ring-1 ring-white/40 shadow-lg"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
      >
        <div className="absolute inset-x-2 inset-y-1">
          {Object.entries(layout).map(([id, p]) => (
            <span
              key={id}
              className={`absolute rounded-full ${
                id === companionId
                  ? 'z-10 h-2 w-2 bg-amber-300 ring-1 ring-amber-600'
                  : id === selectedId
                    ? 'z-10 h-2 w-2 bg-white ring-2 ring-sky-400'
                    : 'h-1.5 w-1.5 bg-white/90'
              }`}
              style={{ left: `${p.x}%`, top: `${clamp(p.y, 5, 95)}%`, transform: 'translate(-50%, -50%)' }}
            />
          ))}
        </div>
        <div
          ref={frameRef}
          className="pointer-events-none absolute inset-y-0 rounded-full border-2 border-white bg-white/15"
          style={{ left: '0%', width: '30%' }}
        />
      </div>
    )
  })
)

const BubbleButton = ({ label, onClick, children, tone = 'default' }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onPointerDown={(e) => e.stopPropagation()}
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-90 ${
      tone === 'gold'
        ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-white'
        : tone === 'danger'
          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
)

/**
 * The pet home scene: a fixed 16:9 world that phones swipe through and wide screens show whole.
 * Children are drawn over the stage (top bar, mini map).
 */
const HabitatWorld = forwardRef(function HabitatWorld(
  {
    pets,
    layout,
    background,
    companionId,
    selectedId,
    draggingId,
    tod,
    reaction,
    quietExitIds,
    onPetPress,
    onPetKeyDown,
    onBackgroundTap,
    actions,
    miniMapClass = '',
    children,
  },
  ref
) {
  const stageRef = useRef(null)
  const scrollerRef = useRef(null)
  const worldRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const world = computeWorld(stage.w, stage.h)
  const s = world.s
  const worldW = world.w
  const worldH = world.h
  const wrapW = Math.max(stage.w, worldW)
  const wrapH = Math.max(stage.h, worldH)
  const canPanX = worldW > stage.w + 1
  const canPanY = worldH > stage.h + 1

  // ---- Background: keep the old picture until the new one has loaded ----
  const [shownBg, setShownBg] = useState(background)
  useEffect(() => {
    if (!background || background === shownBg) return
    let alive = true
    const img = new Image()
    img.onload = img.onerror = () => {
      if (alive) setShownBg(background)
    }
    img.src = background
    return () => {
      alive = false
    }
  }, [background, shownBg])

  // ---- Size ----
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = (w, h) =>
      setStage((prev) => (prev.w === Math.round(w) && prev.h === Math.round(h) ? prev : { w: Math.round(w), h: Math.round(h) }))
    const rect = el.getBoundingClientRect()
    measure(rect.width, rect.height)
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => {
        const r = el.getBoundingClientRect()
        measure(r.width, r.height)
      }
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- Scroll: start on the companion (or the middle), keep the same spot in view when the size changes ----
  const centerRef = useRef(null) // { fx, fy } world fraction at the middle of the screen
  const miniRef = useRef(null)
  const reportView = useCallback(() => {
    const sc = scrollerRef.current
    if (!sc || !worldW) return
    const left = (wrapW - worldW) / 2
    const x0 = ((sc.scrollLeft - left) / worldW) * 100
    const x1 = ((sc.scrollLeft - left + sc.clientWidth) / worldW) * 100
    miniRef.current?.update({ x0: clamp(x0, 0, 100), x1: clamp(x1, 0, 100) })
  }, [worldW, wrapW])

  const jumpTo = useCallback(
    (fx) => {
      const sc = scrollerRef.current
      if (!sc || !worldW) return
      const left = (wrapW - worldW) / 2
      sc.scrollLeft = clamp(left + fx * worldW - sc.clientWidth / 2, 0, Math.max(0, wrapW - sc.clientWidth))
    },
    [worldW, wrapW]
  )

  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const companionRef = useRef(companionId)
  companionRef.current = companionId
  const centeredOnPetsRef = useRef(false)
  const touchedRef = useRef(false)
  // Where to look first: the companion, else the middle of the pets, else the middle of the world.
  const homeCenter = () => {
    const home = layoutRef.current
    const comp = companionRef.current && home[companionRef.current]
    if (comp) return { fx: comp.x / 100, fy: comp.y / 100 }
    const spots = Object.values(home)
    if (spots.length) return { fx: spots.reduce((a, p) => a + p.x, 0) / spots.length / 100, fy: 0.6 }
    return { fx: 0.5, fy: 0.6 }
  }
  useLayoutEffect(() => {
    const sc = scrollerRef.current
    if (!sc || !s) return
    let target = centerRef.current
    if (!target) {
      target = homeCenter()
      if (Object.keys(layoutRef.current).length) centeredOnPetsRef.current = true
    }
    const left = (wrapW - worldW) / 2
    const top = (wrapH - worldH) / 2
    sc.scrollLeft = clamp(left + target.fx * worldW - sc.clientWidth / 2, 0, Math.max(0, wrapW - sc.clientWidth))
    sc.scrollTop = clamp(top + target.fy * worldH - sc.clientHeight / 2, 0, Math.max(0, wrapH - sc.clientHeight))
    centerRef.current = target
    reportView()
    // Re-run on size changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, wrapW, wrapH])

  // The pets arrived after the first centring (slow network): centre on them once, unless the user already looked
  // around.
  useLayoutEffect(() => {
    const sc = scrollerRef.current
    if (!sc || !s || centeredOnPetsRef.current || touchedRef.current || !Object.keys(layout).length) return
    centeredOnPetsRef.current = true
    const target = homeCenter()
    const left = (wrapW - worldW) / 2
    const top = (wrapH - worldH) / 2
    sc.scrollLeft = clamp(left + target.fx * worldW - sc.clientWidth / 2, 0, Math.max(0, wrapW - sc.clientWidth))
    sc.scrollTop = clamp(top + target.fy * worldH - sc.clientHeight / 2, 0, Math.max(0, wrapH - sc.clientHeight))
    centerRef.current = target
    reportView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, s])

  const scrollRaf = useRef(0)
  const onScroll = useCallback(() => {
    if (scrollRaf.current) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      const sc = scrollerRef.current
      if (!sc || !worldW) return
      const left = (wrapW - worldW) / 2
      const top = (wrapH - worldH) / 2
      centerRef.current = {
        fx: (sc.scrollLeft + sc.clientWidth / 2 - left) / worldW,
        fy: (sc.scrollTop + sc.clientHeight / 2 - top) / worldH,
      }
      reportView()
    })
  }, [worldW, worldH, wrapW, wrapH, reportView])
  useEffect(() => () => cancelAnimationFrame(scrollRaf.current), [])

  // A mouse wheel scrolls sideways when the world only overflows sideways.
  useEffect(() => {
    const sc = scrollerRef.current
    if (!sc || !canPanX || canPanY) return
    const onWheel = (e) => {
      touchedRef.current = true
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.ctrlKey) return
      e.preventDefault()
      sc.scrollLeft += e.deltaY
    }
    sc.addEventListener('wheel', onWheel, { passive: false })
    return () => sc.removeEventListener('wheel', onWheel)
  }, [canPanX, canPanY])

  // ---- Background press: tap clears the selection; a mouse drag pans the world ----
  const panRef = useRef(null)
  const onBgPointerDown = (e) => {
    touchedRef.current = true
    if (e.target.closest('[data-pet],[data-bubble]')) return
    const sc = scrollerRef.current
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop, moved: false }
    panRef.current = p
    const mousePan = e.pointerType === 'mouse' && (canPanX || canPanY)
    const move = (ev) => {
      if (ev.pointerId !== p.id) return
      const dx = ev.clientX - p.x
      const dy = ev.clientY - p.y
      if (!p.moved && dx * dx + dy * dy > 25) {
        p.moved = true
        if (mousePan) sc.classList.add('ph-panning')
      }
      if (p.moved && mousePan) {
        sc.scrollLeft = p.sl - dx
        sc.scrollTop = p.st - dy
      }
    }
    const up = (ev) => {
      if (ev.pointerId !== p.id) return
      done()
      if (!p.moved && ev.type === 'pointerup') onBackgroundTap?.()
    }
    const done = () => {
      sc.classList.remove('ph-panning')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      panRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // ---- Pets out of view stop animating (data-off, see PetHome.css); phones show about a third of the world ----
  useEffect(() => {
    const sc = scrollerRef.current
    const worldEl = worldRef.current
    if (!sc || !worldEl || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.removeAttribute('data-off')
          else e.target.setAttribute('data-off', '')
        }
      },
      { root: sc, rootMargin: '0px 80px' }
    )
    const watch = () => worldEl.querySelectorAll('.ph-pet[data-pet]').forEach((el) => io.observe(el))
    watch()
    const mo = new MutationObserver((records) => {
      for (const r of records) r.removedNodes.forEach((n) => n.nodeType === 1 && io.unobserve(n))
      watch()
    })
    mo.observe(worldEl, { childList: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])

  // ---- Pets appearing and leaving ----
  // Detected in a layout effect, so the pop-in starts before the first paint (no flash at full size).
  const petsById = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets])
  const prevLayoutRef = useRef({})
  const introDoneRef = useRef(false)
  const [entering, setEntering] = useState(() => new Map())
  const [leaving, setLeaving] = useState([])
  const quietRef = useRef(quietExitIds)
  quietRef.current = quietExitIds
  const timersRef = useRef(new Set())
  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t)
      fn()
    }, ms)
    timersRef.current.add(t)
  }, [])
  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach(clearTimeout)
  }, [])
  useLayoutEffect(() => {
    if (!s) return
    const before = prevLayoutRef.current
    prevLayoutRef.current = layout
    const added = Object.keys(layout).filter((id) => !before[id])
    const removed = Object.keys(before).filter((id) => !layout[id])
    const intro = !introDoneRef.current
    introDoneRef.current = true
    if (added.length) {
      // First view: the pets pop in one after another, left to right. Later: a new pet pops in with sparkles.
      const order = intro ? [...added].sort((a, b) => layout[a].x - layout[b].x) : added
      setEntering((m) => {
        const next = new Map(m)
        order.forEach((id, i) => next.set(id, { delay: intro ? Math.min(i, 24) * 45 : 0, burst: !intro }))
        return next
      })
      later(() => {
        setEntering((m) => {
          const next = new Map(m)
          added.forEach((id) => next.delete(id))
          return next
        })
      }, intro ? 1800 : 900)
    }
    const exits = removed
      .filter((id) => !quietRef.current?.has(id) && petsById.get(id))
      .map((id) => ({ id, pos: before[id], up: petsById.get(id), key: `${id}:${Date.now()}` }))
    if (exits.length) {
      setLeaving((l) => [...l, ...exits])
      const keys = new Set(exits.map((x) => x.key))
      later(() => setLeaving((l) => l.filter((x) => !keys.has(x.key))), 420)
    }
    // petsById is only read for the pets that left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, s > 0])

  // ---- Imperative API for the page (drag maths, scrolling to a pet) ----
  useImperativeHandle(
    ref,
    () => ({
      clientToWorld(clientX, clientY) {
        const r = worldRef.current?.getBoundingClientRect()
        if (!r || !r.width) return null
        return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 }
      },
      stageRect: () => stageRef.current?.getBoundingClientRect() || null,
      scrollBy(dx, dy) {
        const sc = scrollerRef.current
        if (!sc) return
        sc.scrollLeft += dx
        sc.scrollTop += dy
      },
      // Bring a world point (percent) into view; `onlyIfNeeded` leaves it alone when already comfortably visible.
      reveal(xPct, yPct, { smooth = true, onlyIfNeeded = false } = {}) {
        const sc = scrollerRef.current
        if (!sc || !worldW) return
        const left = (wrapW - worldW) / 2
        const top = (wrapH - worldH) / 2
        const px = left + (xPct / 100) * worldW
        const py = top + (yPct / 100) * worldH
        const margin = Math.min(140, sc.clientWidth / 4)
        if (
          onlyIfNeeded &&
          px > sc.scrollLeft + margin &&
          px < sc.scrollLeft + sc.clientWidth - margin &&
          py > sc.scrollTop + 60 &&
          py < sc.scrollTop + sc.clientHeight - 60
        ) {
          return
        }
        const toX = clamp(px - sc.clientWidth / 2, 0, Math.max(0, wrapW - sc.clientWidth))
        const toY = clamp(py - sc.clientHeight / 2, 0, Math.max(0, wrapH - sc.clientHeight))
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        if (smooth && !calm && sc.scrollTo) sc.scrollTo({ left: toX, top: toY, behavior: 'smooth' })
        else {
          sc.scrollLeft = toX
          sc.scrollTop = toY
        }
      },
      // Visible part of the world, in percent.
      view() {
        const sc = scrollerRef.current
        if (!sc || !worldW) return { x0: 0, x1: 100 }
        const left = (wrapW - worldW) / 2
        return {
          x0: clamp(((sc.scrollLeft - left) / worldW) * 100, 0, 100),
          x1: clamp(((sc.scrollLeft - left + sc.clientWidth) / worldW) * 100, 0, 100),
        }
      },
      petElement: (id) => worldRef.current?.querySelector(`[data-pet="${id}"] .ph-pet-depth`) || null,
      scale: () => s,
    }),
    [s, worldW, worldH, wrapW, wrapH]
  )

  // ---- Selection toolbar ----
  const sel = selectedId && layout[selectedId] && petsById.get(selectedId) && draggingId !== selectedId ? selectedId : null
  let bubble = null
  if (sel && s) {
    const pos = layout[sel]
    const up = petsById.get(sel)
    const isComp = sel === companionId
    const half = (spriteSize(up) * s * depthScale(pos.y)) / 2
    const bw = isComp ? 148 : 192
    const cx = (pos.x / 100) * worldW
    const cy = (pos.y / 100) * worldH
    const above = cy - half - 64 > 8
    bubble = (
      <div
        data-bubble
        className="ph-bubble flex items-center gap-1 rounded-2xl bg-white/95 p-1.5 shadow-xl ring-1 ring-black/5"
        style={{
          left: clamp(cx - bw / 2, 6, worldW - bw - 6),
          top: above ? cy - half - 60 : cy + half + 30,
          width: bw,
        }}
      >
        <BubbleButton label="Pet info" onClick={() => actions.onInfo(sel)}>
          <Info className="w-5 h-5" />
        </BubbleButton>
        <BubbleButton label="Turn around" onClick={() => actions.onFlip(sel)}>
          <FlipHorizontal2 className="w-5 h-5" />
        </BubbleButton>
        {!isComp && (
          <BubbleButton label="Make companion" tone="gold" onClick={() => actions.onCompanion(sel)}>
            <Crown className="w-5 h-5" />
          </BubbleButton>
        )}
        <BubbleButton label="Put in bag" tone="danger" onClick={() => actions.onStore(sel)}>
          <PackageMinus className="w-5 h-5" />
        </BubbleButton>
      </div>
    )
  }

  const placed = pets.filter((p) => layout[p.id])
  const sleeping = tod === 'night'

  return (
    <div ref={stageRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-gradient-to-b from-sky-300 to-emerald-200">
      <div
        ref={scrollerRef}
        className={`ph-scroller ph-noselect absolute inset-0 isolate ${canPanX || canPanY ? 'ph-can-pan' : ''}`}
        onScroll={onScroll}
        onPointerDown={onBgPointerDown}
      >
        <div style={{ position: 'relative', width: wrapW, height: wrapH }}>
          <div
            ref={worldRef}
            className="absolute overflow-hidden"
            style={{ left: (wrapW - worldW) / 2, top: (wrapH - worldH) / 2, width: worldW, height: worldH }}
          >
            {shownBg && <div className="ph-bg" style={{ backgroundImage: `url("${shownBg}")` }} />}
            <Ambient tod={tod} />
            {s > 0 &&
              placed.map((up, i) => (
                <HabitatPet
                  key={up.id}
                  up={up}
                  pos={layout[up.id]}
                  s={s}
                  index={i}
                  isCompanion={up.id === companionId}
                  isSelected={up.id === selectedId}
                  isDragging={up.id === draggingId}
                  sleeping={sleeping && up.id !== selectedId && up.id !== draggingId}
                  enter={entering.get(up.id)}
                  reaction={reaction && reaction.id === up.id ? reaction : null}
                  onPress={onPetPress}
                  onKeyDown={onPetKeyDown}
                />
              ))}
            {s > 0 && leaving.map((l) => <LeavingPet key={l.key} up={l.up} pos={l.pos} s={s} />)}
            {bubble}
          </div>
        </div>
      </div>
      {canPanX && (
        <div className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 ${miniMapClass}`}>
          <div className="pointer-events-auto">
            <MiniMap ref={miniRef} layout={layout} companionId={companionId} selectedId={selectedId} onJump={jumpTo} />
          </div>
        </div>
      )}
      {children}
    </div>
  )
})

export default HabitatWorld
