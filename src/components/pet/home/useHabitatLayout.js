import { useCallback, useEffect, useRef, useState } from 'react'
import { diffLayouts, layoutFromPets, samePos, sameLayout } from './petHomeUtils'

const SAVE_DELAY_MS = 700
const HISTORY_LIMIT = 60
const COALESCE_MS = 1200

// Undo/redo snapshots may name pets that are gone; keep only current pets.
const onlyIds = (snap, ids) => {
  const keep = new Set(ids)
  const out = {}
  for (const [id, pos] of Object.entries(snap)) if (keep.has(id)) out[id] = pos
  return out
}

/**
 * The pet home layout ({ [userPetId]: { x, y, flip } }) with undo/redo and saving in the background.
 *
 * - Only rows that changed are written, a short moment after the last change (no Save button).
 * - A change made while a save is running is saved right after it; nothing made on screen is dropped when the pet
 *   list reloads (for example after Set companion): pets with a change not saved yet keep the local spot.
 * - `status`: 'saved' | 'pending' | 'saving' | 'error'.
 */
export function useHabitatLayout({ userPets, savePlacements }) {
  const [layout, setLayoutState] = useState(() => layoutFromPets(userPets))
  const layoutRef = useRef(layout)
  // What the database holds, as far as we know.
  const savedRef = useRef(layoutFromPets(userPets))
  const idsRef = useRef((userPets || []).map((p) => p.id))
  const saveRef = useRef(savePlacements)
  saveRef.current = savePlacements

  const pastRef = useRef([])
  const futureRef = useRef([])
  const lastActionRef = useRef({ key: null, at: 0 })
  const [, setHistoryVersion] = useState(0)

  const [status, setStatus] = useState('saved')
  const [lastError, setLastError] = useState(null)
  const timerRef = useRef(null)
  const savingRef = useRef(false)
  const againRef = useRef(false)
  const mountedRef = useRef(true)

  const commit = useCallback((next) => {
    layoutRef.current = next
    setLayoutState(next)
  }, [])

  const pendingChanges = useCallback(
    () => diffLayouts(layoutRef.current, savedRef.current, idsRef.current),
    []
  )

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    if (savingRef.current) {
      againRef.current = true
      return
    }
    const changes = pendingChanges()
    if (!changes.length) {
      if (mountedRef.current) setStatus('saved')
      return
    }
    savingRef.current = true
    if (mountedRef.current) setStatus('saving')
    let result
    try {
      result = await saveRef.current(changes)
    } catch (error) {
      result = { saved: [], failed: changes.map((c) => ({ id: c.id, error: error?.message })) }
    }
    savingRef.current = false
    const savedIds = new Set(result?.saved || [])
    const nextSaved = { ...savedRef.current }
    for (const c of changes) {
      if (!savedIds.has(c.id)) continue
      if (c.x == null) delete nextSaved[c.id]
      else nextSaved[c.id] = { x: c.x, y: c.y, flip: c.flip }
    }
    savedRef.current = nextSaved
    const failed = result?.failed || []
    if (!mountedRef.current) return
    if (failed.length) {
      setLastError(failed[0]?.error || 'Could not save')
      setStatus('error')
      return
    }
    setLastError(null)
    if (againRef.current || pendingChanges().length) {
      againRef.current = false
      setStatus('pending')
      timerRef.current = setTimeout(flush, SAVE_DELAY_MS)
    } else {
      setStatus('saved')
    }
  }, [pendingChanges])

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    setStatus('pending')
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS)
  }, [flush])

  /**
   * Change the layout. `updater(prev) => next`. Each call is one undo step, except calls with the same
   * `coalesce` key in quick succession (arrow-key nudges), which share one.
   */
  const apply = useCallback(
    (updater, { coalesce = null } = {}) => {
      const prev = layoutRef.current
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (!next || next === prev || sameLayout(next, prev)) return false
      const now = Date.now()
      const last = lastActionRef.current
      const merge = coalesce && last.key === coalesce && now - last.at < COALESCE_MS
      if (!merge) {
        pastRef.current = [...pastRef.current, prev].slice(-HISTORY_LIMIT)
        futureRef.current = []
      }
      lastActionRef.current = { key: coalesce, at: now }
      commit(next)
      setHistoryVersion((v) => v + 1)
      schedule()
      return true
    },
    [commit, schedule]
  )

  const undo = useCallback(() => {
    const past = pastRef.current
    if (!past.length) return false
    const prev = past[past.length - 1]
    pastRef.current = past.slice(0, -1)
    futureRef.current = [layoutRef.current, ...futureRef.current].slice(0, HISTORY_LIMIT)
    lastActionRef.current = { key: null, at: 0 }
    commit(onlyIds(prev, idsRef.current))
    setHistoryVersion((v) => v + 1)
    schedule()
    return true
  }, [commit, schedule])

  const redo = useCallback(() => {
    const future = futureRef.current
    if (!future.length) return false
    const next = future[0]
    futureRef.current = future.slice(1)
    pastRef.current = [...pastRef.current, layoutRef.current].slice(-HISTORY_LIMIT)
    lastActionRef.current = { key: null, at: 0 }
    commit(onlyIds(next, idsRef.current))
    setHistoryVersion((v) => v + 1)
    schedule()
    return true
  }, [commit, schedule])

  // The pet list reloaded (new pet caught, companion changed, save confirmed...). Follow the database for every pet
  // without a local change waiting; keep the local spot for the others.
  useEffect(() => {
    const db = layoutFromPets(userPets)
    const ids = (userPets || []).map((p) => p.id)
    const cur = layoutRef.current
    const saved = savedRef.current
    const next = {}
    for (const id of ids) {
      const pending = !samePos(cur[id], saved[id])
      const pos = pending ? cur[id] : db[id]
      if (pos) next[id] = pos
    }
    idsRef.current = ids
    savedRef.current = db
    if (!sameLayout(next, cur)) commit(next)
  }, [userPets, commit])

  // Leaving the page or hiding the tab: save now instead of waiting.
  useEffect(() => {
    mountedRef.current = true
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onBeforeUnload = (e) => {
      if (savingRef.current || pendingChanges().length) {
        flush()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      mountedRef.current = false
      if (timerRef.current || pendingChanges().length) flush()
    }
  }, [flush, pendingChanges])

  return {
    layout,
    apply,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    status,
    lastError,
    retry: flush,
  }
}
