import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Backpack,
  CheckCircle2,
  Hand,
  Home,
  MousePointerClick,
  PackagePlus,
  ShoppingBag,
  Undo2,
  X,
} from 'lucide-react'
import { usePet } from '../../hooks/usePet'
import { useAuth } from '../../hooks/useAuth'
import HabitatWorld from './home/HabitatWorld'
import PetBag from './home/PetBag'
import HomeTopBar from './home/HomeTopBar'
import PetDetailSheet from './home/PetDetailSheet'
import PetDexModal from './home/PetDexModal'
import BackgroundPicker from './home/BackgroundPicker'
import PetImage from './home/PetImage'
import { useHabitatLayout } from './home/useHabitatLayout'
import { usePetDrag } from './home/usePetDrag'
import {
  BOUNDS,
  LIGHTING_MODES,
  arrangeRows,
  arrangeScatter,
  clamp,
  clampToBounds,
  defaultBackground,
  depthScale,
  findFreeSpot,
  petImage,
  petName,
  readPref,
  sortPets,
  spriteSize,
  timeOfDay,
  writePref,
} from './home/petHomeUtils'
import './home/PetHome.css'

const useMediaQuery = (query) => {
  const read = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return undefined
    const onChange = () => setMatches(mq.matches)
    onChange()
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [query])
  return matches
}

const LIGHT_TOAST = { auto: 'Light follows the clock', day: 'Always daytime', night: 'Always night-time' }

// How far around the PC bag button (list hidden) a dropped pet still goes into the bag, in px.
const FLOAT_BAG_REACH = 22

let toastSeq = 0

/**
 * Pet Home (/pets): the pets you put out live in a scene you can rearrange by hand; the rest wait in the bag.
 *
 * - Drag a pet to move it, drop it on the bag to put it away; tap a pet in the bag (or drag it out) to bring it home.
 * - Changes save by themselves (only the pets that changed) and can be undone.
 * - The scene is one fixed 16:9 world, so a home looks the same on a phone and on a PC.
 */
const PetInventory = () => {
  const { userPets, allPets, activePet, loading, setActivePetById, renamePet, savePetPlacements } = usePet()
  const { user, profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // A pet whose species row is missing would break every picture and name; leave it out.
  const pets = useMemo(() => (userPets || []).filter((up) => up.pet), [userPets])
  const petsById = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets])
  // The companion is the pet the dashboard shows (get_active_pet), not just any row flagged active.
  const companionId = (activePet?.id && petsById.has(activePet.id) ? activePet.id : null) ?? pets.find((p) => p.is_active)?.id ?? null

  const { layout, apply, undo, redo, canUndo, canRedo, status, retry } = useHabitatLayout({
    userPets: pets,
    savePlacements: savePetPlacements,
  })
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const worldApi = useRef(null)
  const bagElRef = useRef(null)
  const floatBagRef = useRef(null)
  const setBagEl = useCallback((el) => {
    bagElRef.current = el
  }, [])
  const quietExit = useRef(new Set())

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null) // { id, order: [ids] }
  const [dexOpen, setDexOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)
  const [bgPreview, setBgPreview] = useState(undefined) // undefined = no preview, null = default meadow
  const [sheetOpen, setSheetOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => readPref('panelOpen', typeof window !== 'undefined' && window.innerWidth >= 1280))
  const [lighting, setLighting] = useState(() => {
    const v = readPref('lighting', 'auto')
    return LIGHTING_MODES.includes(v) ? v : 'auto'
  })
  const [clock, setClock] = useState(() => Date.now())
  const [reaction, setReaction] = useState(null)
  const [bump, setBump] = useState(0)
  const [toasts, setToasts] = useState([])
  const [showTips, setShowTips] = useState(() => !readPref('tipsSeen', false))

  const homeCount = useMemo(() => pets.filter((p) => layout[p.id]).length, [pets, layout])
  const storedCount = pets.length - homeCount

  // Saved only when the user opens or closes the list, so a phone visit does not close it on the PC.
  const togglePanel = useCallback((open) => {
    setPanelOpen(open)
    writePref('panelOpen', open)
  }, [])
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 60 * 1000)
    return () => clearInterval(t)
  }, [])
  const tod = timeOfDay(lighting, new Date(clock))

  // ---- Toasts ----
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback(
    (text, { type = 'success', action = null } = {}) => {
      toastSeq += 1
      const id = toastSeq
      setToasts((t) => [...t.slice(-2), { id, text, type, action }])
      setTimeout(() => dismissToast(id), action ? 5000 : 2600)
    },
    [dismissToast]
  )
  const undoAction = useMemo(() => ({ label: 'Undo', run: undo }), [undo])

  // ---- Pet actions ----
  const reveal = useCallback((id, opts) => {
    const p = layoutRef.current[id]
    if (p) worldApi.current?.reveal(p.x, p.y, opts)
  }, [])

  const selectPet = useCallback(
    (id) => {
      setSelectedId(id)
      setReaction({ id, kind: 'love', n: Date.now() })
      reveal(id, { onlyIfNeeded: true })
    },
    [reveal]
  )

  const placePets = useCallback(
    (ids) => {
      const want = ids.filter((id) => petsById.has(id) && !layoutRef.current[id])
      if (!want.length) return
      // One or two pets land where you are looking; a whole bag spreads over the floor.
      const view = want.length <= 2 ? worldApi.current?.view() : null
      apply((prev) => {
        const next = { ...prev }
        for (const id of want) {
          if (!next[id]) next[id] = { ...findFreeSpot(next, { view }), flip: Math.random() < 0.5 }
        }
        return next
      })
      if (want.length === 1) {
        requestAnimationFrame(() => reveal(want[0], { onlyIfNeeded: true }))
        if (sheetOpen) toast(`${petName(petsById.get(want[0]))} came home`)
      } else {
        toast(`${want.length} pets came home`, { action: undoAction })
      }
    },
    [apply, petsById, reveal, sheetOpen, toast, undoAction]
  )

  const storePets = useCallback(
    (ids, { quiet = false } = {}) => {
      const want = ids.filter((id) => layoutRef.current[id])
      if (!want.length) return
      if (quiet) {
        // Dragged into the bag: no "poof" where it used to stand.
        want.forEach((id) => quietExit.current.add(id))
        setTimeout(() => want.forEach((id) => quietExit.current.delete(id)), 1000)
      }
      apply((prev) => {
        const next = { ...prev }
        want.forEach((id) => delete next[id])
        return next
      })
      setBump((b) => b + 1)
      setSelectedId((cur) => (cur && want.includes(cur) ? null : cur))
      if (want.length > 1) toast(`${want.length} pets went into the bag`, { action: undoAction })
    },
    [apply, toast, undoAction]
  )

  const flipPet = useCallback(
    (id) => apply((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], flip: !prev[id].flip } } : prev)),
    [apply]
  )

  const movePet = useCallback(
    (id, x, y, opts) =>
      apply((prev) => ({ ...prev, [id]: { ...clampToBounds(x, y), flip: prev[id] ? prev[id].flip : Math.random() < 0.5 } }), opts),
    [apply]
  )

  const homePetIds = useCallback(
    (order = 'rarity') =>
      sortPets(
        pets.filter((p) => layoutRef.current[p.id]),
        order,
        companionId
      ).map((p) => p.id),
    [pets, companionId]
  )

  const tidyUp = useCallback(() => {
    const ids = homePetIds('rarity')
    if (ids.length < 2) return
    const flips = Object.fromEntries(ids.map((id) => [id, layoutRef.current[id].flip]))
    if (apply((prev) => ({ ...prev, ...arrangeRows(ids, flips) }))) toast('All tidy!', { action: undoAction })
  }, [homePetIds, apply, toast, undoAction])

  const shuffle = useCallback(() => {
    const ids = homePetIds('newest')
    if (ids.length < 2) return
    if (apply((prev) => ({ ...prev, ...arrangeScatter(ids) }))) toast('Shuffled!', { action: undoAction })
  }, [homePetIds, apply, toast, undoAction])

  const makeCompanion = useCallback(
    async (id) => {
      const res = await setActivePetById(id)
      if (res?.success) {
        toast(`${petName(petsById.get(id))} is now your companion!`)
        if (layoutRef.current[id]) setReaction({ id, kind: 'love', n: Date.now() })
      } else {
        toast(res?.error || 'Could not change your companion', { type: 'error' })
      }
    },
    [setActivePetById, petsById, toast]
  )

  const rename = useCallback(
    async (id, name) => {
      await renamePet(name, id)
      toast('Name saved')
    },
    [renamePet, toast]
  )

  const openDetails = useCallback(
    (id) => {
      const order = sortPets(pets, readPref('bagSort', 'newest'), companionId).map((p) => p.id)
      setDetail({ id, order })
    },
    [pets, companionId]
  )

  const locatePet = useCallback(
    (id) => {
      setDetail(null)
      setSheetOpen(false)
      setSelectedId(id)
      setReaction({ id, kind: 'love', n: Date.now() })
      requestAnimationFrame(() => reveal(id, { smooth: true }))
    },
    [reveal]
  )

  // ---- Drag and drop ----
  const drag = usePetDrag({
    getZones: () => {
      const bags = []
      if (bagElRef.current) bags.push(bagElRef.current.getBoundingClientRect())
      if (floatBagRef.current) {
        // The button is small, so a drop near it counts too (the dashed ring shows how near).
        const r = floatBagRef.current.getBoundingClientRect()
        const m = FLOAT_BAG_REACH
        bags.push({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m })
      }
      return {
        stage: worldApi.current?.stageRect(),
        bags,
        bagEdge: isDesktop ? (panelOpen ? 'right' : null) : 'bottom',
      }
    },
    onDragStart: (p) => {
      const up = petsById.get(p.id)
      const s = worldApi.current?.scale() || 0
      if (!up || !s) return null
      if (p.source === 'world') {
        const pos = layoutRef.current[p.id]
        const r = pos && worldApi.current.petElement(p.id)?.getBoundingClientRect()
        if (!r) return null
        setSelectedId((cur) => (cur === p.id ? cur : null))
        return {
          size: r.width,
          grabX: p.startX - (r.left + r.width / 2),
          grabY: p.startY - (r.top + r.height / 2),
          lift: 0,
          baseY: pos.y,
          image: petImage(up),
          flip: pos.flip,
        }
      }
      if (layoutRef.current[p.id]) return null
      const size = spriteSize(up) * s * depthScale(75)
      // On touch the pet floats above the finger so it stays visible.
      return { size, grabX: 0, grabY: 0, lift: p.pointerType === 'mouse' ? 0 : size * 0.55, baseY: 75, image: petImage(up), flip: false }
    },
    ghostScale: (cx, cy, over, p) => {
      if (over === 'bag') return 0.55
      if (over !== 'world') return 0.85
      const pt = worldApi.current?.clientToWorld(cx, cy)
      return pt ? depthScale(clamp(pt.y, BOUNDS.y0, BOUNDS.y1)) / depthScale(p?.baseY ?? 75) : 1
    },
    autoScroll: (dx, dy) => worldApi.current?.scrollBy(dx, dy),
    onTap: ({ id, source }) => {
      if (source === 'world') selectPet(id)
    },
    onDrop: ({ id, source, zone, x, y }) => {
      if (zone === 'bag') {
        if (source === 'world') storePets([id], { quiet: true })
        return
      }
      if (zone !== 'world') return
      const pt = worldApi.current?.clientToWorld(x, y)
      if (!pt) return
      movePet(id, pt.x, pt.y)
      if (source === 'world') setReaction({ id, kind: 'land', n: Date.now() })
    },
  })
  const { startPress } = drag
  const worldDrag = drag.drag?.source === 'world'

  const onPetPress = useCallback((e, id) => startPress(e, { id, source: 'world' }), [startPress])
  const onBackgroundTap = useCallback(() => setSelectedId(null), [])

  // Pets keep the same keydown function (they are memoized); it reads the latest state from a ref.
  const petKeyRef = useRef(null)
  petKeyRef.current = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (selectedId === id) openDetails(id)
      else selectPet(id)
    }
  }
  const onPetKeyDown = useCallback((e, id) => petKeyRef.current(e, id), [])

  // ---- Keyboard: undo/redo, and moving the selected pet ----
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || detail || dexOpen || bgOpen) return
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod || !selectedId || !layoutRef.current[selectedId]) return
      const step = e.shiftKey ? 5 : 1
      const nudge = (dx, dy) => {
        e.preventDefault()
        const p = layoutRef.current[selectedId]
        movePet(selectedId, p.x + dx, p.y + dy, { coalesce: `nudge:${selectedId}` })
      }
      if (e.key === 'ArrowLeft') nudge(-step, 0)
      else if (e.key === 'ArrowRight') nudge(step, 0)
      else if (e.key === 'ArrowUp') nudge(0, -step)
      else if (e.key === 'ArrowDown') nudge(0, step)
      else if (key === 'f') flipPet(selectedId)
      else if (key === 'i') openDetails(selectedId)
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        storePets([selectedId])
      } else if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail, dexOpen, bgOpen, selectedId, undo, redo, movePet, flipPet, openDetails, storePets])

  // ---- Background ----
  const savedBg = profile?.active_background_url || null
  const background = (bgPreview !== undefined ? bgPreview : savedBg) || defaultBackground()
  const applyBackground = useCallback(
    async (url) => {
      const res = await updateProfile({ active_background_url: url })
      // updateProfile reports a failed equipment write only by leaving the field out, so compare the result.
      const ok = !res?.error && (res?.data?.active_background_url ?? null) === (url ?? null)
      if (ok) toast(url ? 'New background on!' : 'Back to the meadow')
      else toast('Could not change the background', { type: 'error' })
      return ok
    },
    [updateProfile, toast]
  )
  const closeBackground = useCallback(() => {
    setBgOpen(false)
    setBgPreview(undefined)
  }, [])

  const cycleLighting = () => {
    const next = LIGHTING_MODES[(LIGHTING_MODES.indexOf(lighting) + 1) % LIGHTING_MODES.length]
    setLighting(next)
    writePref('lighting', next)
    toast(LIGHT_TOAST[next])
  }

  const goBack = () => (location.key && location.key !== 'default' ? navigate(-1) : navigate('/'))

  const dismissTips = () => {
    setShowTips(false)
    writePref('tipsSeen', true)
  }

  const detailPet = detail ? petsById.get(detail.id) : null
  const detailList = detail ? detail.order.map((id) => petsById.get(id)).filter(Boolean) : []

  const worldActions = {
    onInfo: openDetails,
    onFlip: flipPet,
    onStore: (id) => storePets([id]),
    onCompanion: makeCompanion,
  }

  const tips = isDesktop
    ? [
        { icon: PackagePlus, text: 'Drag a pet from My Pets into your home, or click its + button.' },
        { icon: Hand, text: 'Drag pets around. Drop one on My Pets to put it away.' },
        { icon: MousePointerClick, text: 'Click a pet for info and more. Ctrl+Z undoes.' },
      ]
    : [
        { icon: PackagePlus, text: 'Tap a pet in your bag to bring it home, or drag it up.' },
        { icon: Hand, text: 'Drag pets to move them. Drop one on the bag to put it away.' },
        { icon: MousePointerClick, text: 'Tap a pet for info, turning around and more.' },
      ]

  return (
    <div className="ph-root ph-noselect relative flex flex-col overflow-hidden bg-slate-900 lg:flex-row">
      <HabitatWorld
        ref={worldApi}
        pets={pets}
        layout={layout}
        background={background}
        companionId={companionId}
        selectedId={selectedId}
        draggingId={worldDrag ? drag.drag.id : null}
        tod={tod}
        reaction={reaction}
        quietExitIds={quietExit.current}
        onPetPress={onPetPress}
        onPetKeyDown={onPetKeyDown}
        onBackgroundTap={onBackgroundTap}
        actions={worldActions}
        miniMapClass="top-[68px]"
      >
        <HomeTopBar
          compact={!isDesktop}
          title="Pet Home"
          subtitle={`${pets.length} pet${pets.length === 1 ? '' : 's'} · ${homeCount} at home`}
          status={status}
          onRetry={retry}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          lighting={lighting}
          onLighting={cycleLighting}
          onBack={goBack}
          onBackground={() => setBgOpen(true)}
          onDex={() => setDexOpen(true)}
          onShop={() => navigate('/shop?tab=ball')}
        />

        {/* Empty home */}
        {!loading && pets.length > 0 && homeCount === 0 && !drag.drag && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="ph-modal-enter pointer-events-auto max-w-xs rounded-3xl bg-white/90 p-5 text-center shadow-2xl">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Home className="h-7 w-7" />
              </div>
              <p className="text-base font-black text-slate-800">Your home is empty</p>
              <p className="mt-1 text-sm text-slate-500">
                {isDesktop ? 'Drag pets in from My Pets, or bring them all at once.' : 'Tap pets in your bag below, or bring them all at once.'}
              </p>
              <button
                type="button"
                onClick={() => placePets(pets.map((p) => p.id))}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-md active:scale-95"
              >
                <PackagePlus className="h-4 w-4" />
                Bring everyone home
              </button>
            </div>
          </div>
        )}
        {!loading && pets.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="ph-modal-enter pointer-events-auto max-w-xs rounded-3xl bg-white/90 p-5 text-center shadow-2xl">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <Backpack className="h-7 w-7" />
              </div>
              <p className="text-base font-black text-slate-800">No pets yet</p>
              <p className="mt-1 text-sm text-slate-500">Catch pets in the Wild Area on your dashboard or hatch an egg, then they live here.</p>
              <div className="mt-3 flex justify-center gap-2">
                <button type="button" onClick={() => navigate('/')} className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-black text-white active:scale-95">
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/shop?tab=ball')}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 active:scale-95"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Shop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* First-visit tips */}
        {showTips && pets.length > 0 && homeCount > 0 && !drag.drag && (
          // Up in the sky, where it hides no pet.
          <div className={`absolute z-20 ${isDesktop ? 'left-5 top-[76px] w-80' : 'inset-x-3 top-[104px]'}`}>
            <div className="ph-modal-enter rounded-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-black/5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black text-slate-800">Your new Pet Home</p>
                <button type="button" onClick={dismissTips} aria-label="Close tips" className="rounded-full p-1 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="space-y-1.5">
                {tips.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2 text-xs font-semibold text-slate-600">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                    {text}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={dismissTips} className="mt-3 w-full rounded-2xl bg-sky-500 py-2 text-sm font-black text-white active:scale-[0.98]">
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Phones and tablets: the bottom corners of the home curve into the bag strip */}
        {!isDesktop && (
          <>
            <span className="ph-corner ph-corner-l" aria-hidden="true" />
            <span className="ph-corner ph-corner-r" aria-hidden="true" />
          </>
        )}

        {/* PC with the list hidden: the bag button opens it and takes dropped pets (FLOAT_BAG_REACH px around it too) */}
        {isDesktop && !panelOpen && (
          <button
            ref={floatBagRef}
            type="button"
            data-drop="bag"
            onClick={() => togglePanel(true)}
            aria-label={`My Pets: ${storedCount} in the bag`}
            title="My Pets"
            className={`absolute bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-[22px] text-white shadow-xl ring-4 transition ${
              worldDrag && drag.drag.over === 'bag'
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 ring-white'
                : `bg-gradient-to-b from-amber-300 to-orange-400 ${worldDrag ? 'ring-white' : 'ring-white/70 hover:-translate-y-0.5'}`
            }`}
          >
            {worldDrag && (
              <span
                aria-hidden="true"
                style={{ inset: -FLOAT_BAG_REACH }}
                className={`ph-halo pointer-events-none absolute rounded-[34px] border-[3px] border-dashed ${
                  drag.drag.over === 'bag' ? 'border-emerald-400 bg-emerald-400/20' : 'border-white bg-white/15'
                }`}
              />
            )}
            <span key={bump} className={`flex transition-transform ${bump ? 'ph-bag-bump' : ''} ${worldDrag && drag.drag.over === 'bag' ? 'scale-125' : ''}`}>
              <Backpack className="h-7 w-7" />
            </span>
            {storedCount > 0 && !worldDrag && (
              <span className="absolute -right-2 -top-2 min-w-[24px] rounded-full bg-slate-800 px-1.5 py-0.5 text-center text-xs font-black text-white ring-2 ring-white tabular-nums">
                {storedCount}
              </span>
            )}
          </button>
        )}
      </HabitatWorld>

      <PetBag
        variant={isDesktop ? 'panel' : 'sheet'}
        expanded={sheetOpen}
        onExpandedChange={setSheetOpen}
        panelOpen={panelOpen}
        onPanelOpenChange={togglePanel}
        pets={pets}
        layout={layout}
        companionId={companionId}
        loading={loading}
        drag={drag.drag}
        bump={bump}
        dropRef={setBagEl}
        startPress={startPress}
        onPlace={placePets}
        onStore={storePets}
        onInfo={openDetails}
        onTidy={tidyUp}
        onShuffle={shuffle}
        onShop={() => navigate('/shop?tab=ball')}
      />

      {detailPet && (
        <PetDetailSheet
          up={detailPet}
          list={detailList}
          placed={!!layout[detailPet.id]}
          isCompanion={detailPet.id === companionId}
          onClose={() => setDetail(null)}
          onNavigate={(id) => setDetail((d) => (d ? { ...d, id } : d))}
          onMakeCompanion={makeCompanion}
          onPlace={(id) => placePets([id])}
          onStore={(id) => storePets([id])}
          onFlip={flipPet}
          onLocate={locatePet}
          onRename={rename}
        />
      )}

      {dexOpen && (
        <PetDexModal
          allPets={allPets}
          userPets={pets}
          onClose={() => setDexOpen(false)}
          onOpenPet={(id) => {
            setDexOpen(false)
            openDetails(id)
          }}
        />
      )}

      {bgOpen && (
        <BackgroundPicker
          userId={user?.id}
          currentUrl={savedBg}
          previewUrl={bgPreview}
          onPreview={setBgPreview}
          onApply={applyBackground}
          onClose={closeBackground}
          onShop={() => navigate('/shop?tab=background')}
        />
      )}

      {/* The pet under the finger while dragging */}
      {drag.drag &&
        createPortal(
          <div ref={drag.ghostRef} className="ph-ghost" style={{ width: drag.drag.size, height: drag.drag.size }} aria-hidden="true">
            <div className="ph-ghost-inner">
              <div className="h-full w-full" style={{ transform: drag.drag.flip ? 'scaleX(-1)' : undefined }}>
                <PetImage src={drag.drag.image} size={320} eager className="ph-ghost-img" />
              </div>
            </div>
          </div>,
          document.body
        )}

      {createPortal(
        // Below the top bar and the mini map, so a toast never covers Undo or the menu.
        <div className="pointer-events-none fixed inset-x-0 top-[104px] z-[300] flex flex-col items-center gap-2 px-3" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`ph-toast pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold shadow-xl ${
                t.type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-900/90 text-white'
              }`}
            >
              {t.type === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
              <span className="min-w-0">{t.text}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action.run()
                    dismissToast(t.id)
                  }}
                  className="ml-1 flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-xs font-black hover:bg-white/25"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export default PetInventory
