import { useCallback, useEffect, useRef, useState } from 'react'

const LONG_PRESS_MS = 450
const EDGE_PX = 56
const MAX_SCROLL_PX = 16

const inRect = (r, x, y) => !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

// The stage and bag boxes do not move during a drag, so they are measured once per press (p.getZones is set when
// the press starts).
const zonesOf = (p) => {
  if (p.zones === undefined) p.zones = p.getZones ? p.getZones() : null
  return p.zones
}

const zoneAt = (p, x, y) => {
  const z = zonesOf(p)
  if (!z) return null
  if ((z.bags || []).some((r) => inRect(r, x, y))) return 'bag'
  if (z.stage) {
    if (z.bagEdge === 'bottom' && y > z.stage.bottom) return 'bag'
    if (z.bagEdge === 'right' && x > z.stage.right) return 'bag'
    if (inRect(z.stage, x, y)) return 'world'
  }
  return null
}

const swallowNextClick = () => {
  const block = (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    done()
  }
  const done = () => {
    clearTimeout(timer)
    window.removeEventListener('click', block, true)
  }
  const timer = setTimeout(done, 400)
  window.addEventListener('click', block, true)
}

/**
 * One pointer drag system for the whole page: pets dragged inside the world, out of the bag into the world, and
 * from the world into the bag.
 *
 * - A press turns into a drag after a few pixels. A press that does not move is a tap. A long press (when asked
 *   for) is "info".
 * - `axis` limits how a drag may start, so scrolling still works: 'y' for the bag strip (it scrolls sideways),
 *   'x' for the bag grid on touch (it scrolls up and down), 'any' elsewhere.
 * - The ghost follows the pointer through a ref, without a React render per move.
 *
 * Callbacks (always the latest ones are used):
 *   getZones() -> { stage: DOMRect, bags: DOMRect[], bagEdge: 'bottom' | 'right' }
 *   onDragStart(press) -> { size, grabX, grabY, lift, baseY, image, flip } describing the ghost, or null to cancel
 *   ghostScale(clientX, clientY, over, press) -> number
 *   autoScroll(dx, dy)
 *   onTap({ id, source }), onLongPress({ id, source }), onDrop({ id, source, zone, x, y })
 */
export function usePetDrag(callbacks) {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  const [drag, setDrag] = useState(null)
  const pressRef = useRef(null)
  const ghostElRef = useRef(null)
  const rafRef = useRef(0)
  const overRef = useRef(null)

  const placeGhost = useCallback(() => {
    const p = pressRef.current
    const el = ghostElRef.current
    if (!p || !p.started || !el) return
    const cx = p.x - p.grabX
    const cy = p.y - p.grabY - p.lift
    // Measure first (ghostScale reads the world box), then write, so the browser does not lay out twice.
    const s = cbRef.current.ghostScale ? cbRef.current.ghostScale(cx, cy, overRef.current, p) : 1
    el.style.transform = `translate3d(${cx - p.size / 2}px, ${cy - p.size / 2}px, 0)`
    const inner = el.firstElementChild
    if (inner) inner.style.transform = `scale(${s})`
  }, [])

  // The ghost element calls this when it mounts, so it never shows a frame at the top-left corner.
  const ghostRef = useCallback(
    (el) => {
      ghostElRef.current = el
      if (el) placeGhost()
    },
    [placeGhost]
  )

  const tick = useCallback(() => {
    const p = pressRef.current
    if (!p || !p.started) return
    // Scroll the world while the pointer rests near its edge.
    const r = zonesOf(p)?.stage
    if (r && inRect(r, p.x, p.y) && cbRef.current.autoScroll) {
      let vx = 0
      let vy = 0
      if (p.x < r.left + EDGE_PX) vx = -((r.left + EDGE_PX - p.x) / EDGE_PX) * MAX_SCROLL_PX
      else if (p.x > r.right - EDGE_PX) vx = ((p.x - (r.right - EDGE_PX)) / EDGE_PX) * MAX_SCROLL_PX
      if (p.y < r.top + EDGE_PX) vy = -((r.top + EDGE_PX - p.y) / EDGE_PX) * MAX_SCROLL_PX
      else if (p.y > r.bottom - EDGE_PX) vy = ((p.y - (r.bottom - EDGE_PX)) / EDGE_PX) * MAX_SCROLL_PX
      if (vx || vy) cbRef.current.autoScroll(vx, vy)
    }
    // Frames where the pointer has not moved need no work.
    if (p.x !== p.drawnX || p.y !== p.drawnY) {
      p.drawnX = p.x
      p.drawnY = p.y
      const over = zoneAt(p, p.x, p.y)
      if (over !== overRef.current) {
        overRef.current = over
        setDrag((d) => (d ? { ...d, over } : d))
      }
      placeGhost()
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [placeGhost])

  const end = useCallback(() => {
    const p = pressRef.current
    if (p) {
      clearTimeout(p.longTimer)
      window.removeEventListener('pointermove', p.onMove)
      window.removeEventListener('pointerup', p.onUp)
      window.removeEventListener('pointercancel', p.onCancel)
      window.removeEventListener('keydown', p.onKey)
      window.removeEventListener('blur', p.onCancel)
    }
    cancelAnimationFrame(rafRef.current)
    pressRef.current = null
    overRef.current = null
    setDrag(null)
  }, [])

  const begin = useCallback(
    (p) => {
      const info = cbRef.current.onDragStart ? cbRef.current.onDragStart(p) : null
      if (!info) {
        end()
        return
      }
      clearTimeout(p.longTimer)
      Object.assign(p, { started: true, size: 80, grabX: 0, grabY: 0, lift: 0 }, info)
      overRef.current = zoneAt(p, p.x, p.y)
      setDrag({ id: p.id, source: p.source, size: p.size, over: overRef.current, image: info.image || null, flip: !!info.flip })
      try {
        // Without a prior tap Chrome blocks vibrate and logs a warning, so only buzz once the page was used.
        if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(8)
      } catch {
        // not supported
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [end, tick]
  )

  /**
   * Call from onPointerDown. opts: { id, source: 'world' | 'bag', axis = 'any' | 'x' | 'y' | 'none', el,
   * tap, hold }. `tap` / `hold` replace onTap / onLongPress for this press; `hold` (or longPress: true) turns the
   * long press on.
   */
  const startPress = useCallback(
    (e, opts) => {
      if (pressRef.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const p = {
        ...opts,
        axis: opts.axis || 'any',
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        started: false,
        longFired: false,
        longTimer: 0,
        getZones: () => (cbRef.current.getZones ? cbRef.current.getZones() : null),
      }
      p.onMove = (ev) => {
        if (ev.pointerId !== p.pointerId) return
        p.x = ev.clientX
        p.y = ev.clientY
        if (p.started || p.longFired) return
        const dx = p.x - p.startX
        const dy = p.y - p.startY
        const threshold = p.pointerType === 'mouse' ? 4 : 8
        if (dx * dx + dy * dy < threshold * threshold) return
        // A gesture along the scroll direction belongs to the browser; 'none' never drags (only taps).
        if (p.axis === 'none') return end()
        if (p.axis === 'y' && Math.abs(dx) > Math.abs(dy)) return end()
        if (p.axis === 'x' && Math.abs(dy) > Math.abs(dx)) return end()
        begin(p)
      }
      p.onUp = (ev) => {
        if (ev.pointerId !== p.pointerId) return
        p.x = ev.clientX
        p.y = ev.clientY
        // A touch tap is followed by a click on whatever is under the finger by then; when the tap opened a sheet,
        // that click would press one of its buttons (it once made a pet the companion). Swallow it.
        swallowNextClick()
        if (p.started) {
          const zone = zoneAt(p, p.x, p.y)
          const drop = { id: p.id, source: p.source, zone, x: p.x - p.grabX, y: p.y - p.grabY - p.lift }
          end()
          cbRef.current.onDrop?.(drop)
        } else {
          const fired = p.longFired
          end()
          if (fired) return
          const info = { id: p.id, source: p.source, pointerType: p.pointerType }
          if (p.tap) p.tap(info)
          else cbRef.current.onTap?.(info)
        }
      }
      p.onCancel = () => end()
      p.onKey = (ev) => {
        if (ev.key === 'Escape') end()
      }
      if (opts.hold || opts.longPress) {
        // Fires while the finger is still down; the press keeps listening so the lift is handled (no tap, no click).
        p.longTimer = setTimeout(() => {
          if (pressRef.current !== p || p.started) return
          p.longFired = true
          const info = { id: p.id, source: p.source }
          if (p.hold) p.hold(info)
          else cbRef.current.onLongPress?.(info)
        }, LONG_PRESS_MS)
      }
      pressRef.current = p
      window.addEventListener('pointermove', p.onMove)
      window.addEventListener('pointerup', p.onUp)
      window.addEventListener('pointercancel', p.onCancel)
      window.addEventListener('keydown', p.onKey)
      window.addEventListener('blur', p.onCancel)
    },
    [begin, end]
  )

  useEffect(() => () => end(), [end])

  return { drag, startPress, ghostRef, cancel: end }
}
