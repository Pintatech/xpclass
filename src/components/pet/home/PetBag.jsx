import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowDownAZ,
  Backpack,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Crown,
  Home,
  LayoutGrid,
  ListChecks,
  Minus,
  PanelRightClose,
  Plus,
  Search,
  ShoppingBag,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  Wand2,
  X,
} from 'lucide-react'
import PetImage from './PetImage'
import {
  RARITY,
  RARITY_ORDER,
  SORTS,
  isNew,
  normalizeText,
  petImage,
  petName,
  rarityKey,
  rarityOf,
  readPref,
  sortPets,
  writePref,
} from './petHomeUtils'

// Pictures in the strip and the grid ask for the same thumbnail, so each pet is downloaded once.
const THUMB = 192

const stop = (e) => e.stopPropagation()

const Stars = ({ n, className = '' }) => (
  <span className={`tracking-[-0.12em] ${className}`} aria-hidden="true">
    {'★'.repeat(n)}
  </span>
)

const SORT_ICON = { newest: Clock, rarity: Star, level: TrendingUp, name: ArrowDownAZ }

const TABS = [
  { key: 'bag', label: 'In the bag', icon: Backpack, tone: 'text-amber-500' },
  { key: 'home', label: 'At home', icon: Home, tone: 'text-emerald-500' },
  { key: 'all', label: 'All pets', icon: LayoutGrid, tone: 'text-sky-500' },
]

const matches = (up, q) => !q || normalizeText(petName(up)).includes(q) || normalizeText(up.pet?.name).includes(q)

// ---- Small parts ----

const ToolButton = ({ label, onClick, pressed, expanded, dot, children, className = '' }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    aria-expanded={expanded}
    onClick={onClick}
    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition active:scale-90 ${
      pressed || expanded
        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
        : 'bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/80 hover:text-slate-800'
    } ${className}`}
  >
    {children}
    {dot && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
  </button>
)

// Home +3 brings three pets out, Home −3 puts three away: the same + and − as the buttons on the cards.
const MoveButton = ({ kind, count, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!count}
    aria-label={`${label} (${count})`}
    title={label}
    className={`flex h-9 shrink-0 items-center gap-1 rounded-xl pl-2.5 pr-3 text-sm font-black tabular-nums transition active:scale-95 disabled:opacity-40 ${
      kind === 'place'
        ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-600/25'
        : 'bg-white text-rose-500 shadow-sm ring-1 ring-rose-200 hover:bg-rose-50'
    }`}
  >
    <Home className="h-4 w-4" />
    {kind === 'place' ? <Plus className="-mr-0.5 h-3.5 w-3.5" strokeWidth={3.5} /> : <Minus className="-mr-0.5 h-3.5 w-3.5" strokeWidth={3.5} />}
    {count}
  </button>
)

const BagIcon = ({ bump, className = '' }) => (
  <span
    key={bump}
    className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-amber-300 to-orange-400 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/60 ${
      bump ? 'ph-bag-bump' : ''
    } ${className}`}
  >
    <Backpack className="h-5 w-5" />
  </span>
)

// Shown over the bag while a pet from the home is dragged: a bag with an arrow going in.
const DropHint = ({ active }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute inset-1.5 z-20 flex items-center justify-center rounded-[20px] border-2 border-dashed transition-colors ${
      active ? 'border-emerald-500 bg-emerald-50/95 text-emerald-500' : 'border-amber-400 bg-amber-50/95 text-amber-500'
    }`}
  >
    <div className={`relative flex flex-col items-center transition-transform duration-200 ${active ? 'scale-125' : ''}`}>
      <ArrowDown className="ph-drop-arrow h-6 w-6" strokeWidth={3} />
      <Backpack className="h-10 w-10" />
    </div>
  </div>
)

const EmptyNote = ({ icon: Icon, tone = 'bg-slate-100 text-slate-400', text, children }) => (
  <div className="flex flex-col items-center px-4 py-10 text-center">
    <div className={`mb-2.5 flex h-14 w-14 items-center justify-center rounded-3xl ${tone}`}>
      <Icon className="h-7 w-7" />
    </div>
    {text && <p className="text-sm font-extrabold text-slate-500">{text}</p>}
    {children}
  </div>
)

// ---- Phones: the strip of pets in the bag, under the home ----

const StripCard = memo(function StripCard({ up, isCompanion, startPress, onPlace, onInfo }) {
  const r = rarityOf(up)
  const name = petName(up)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${name}. Tap to bring home, hold for info`}
      title={name}
      className={`ph-noselect ph-tile relative h-[60px] w-[60px] shrink-0 cursor-grab rounded-2xl bg-gradient-to-b ${r.tile} shadow-sm ring-1 ring-inset ${r.ring} transition-transform active:scale-95`}
      onPointerDown={(e) =>
        startPress(e, {
          id: up.id,
          source: 'bag',
          axis: e.pointerType === 'mouse' ? 'any' : 'y',
          tap: () => onPlace([up.id]),
          hold: () => onInfo(up.id),
        })
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlace([up.id])
        } else if (e.key === 'i') onInfo(up.id)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onInfo(up.id)
      }}
    >
      <span className="ph-tile-glow" />
      <PetImage
        src={petImage(up)}
        size={THUMB}
        alt={name}
        className="absolute left-[12%] top-[6%] h-[76%] w-[76%] object-contain"
        style={r.glow ? { filter: `drop-shadow(0 0 4px ${r.glow})` } : undefined}
      />
      <Stars n={r.stars} className={`ph-ink-light absolute inset-x-0 bottom-[3px] text-center text-[8px] leading-none ${r.text}`} />
      {isCompanion && (
        <span className="absolute -left-1 -top-1 rounded-full bg-amber-400 p-[3px] shadow ring-2 ring-white">
          <Crown className="h-2.5 w-2.5 fill-white text-white" />
        </span>
      )}
      {isNew(up) && (
        <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 p-[3px] shadow ring-2 ring-white">
          <Sparkles className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </div>
  )
})

const BagStrip = ({ stored, totalPets, companionId, sort, drag, bump, dropRef, startPress, onPlace, onInfo, onExpand, loading }) => {
  const list = useMemo(() => sortPets(stored, sort, companionId), [stored, sort, companionId])
  const worldDrag = drag?.source === 'world'
  return (
    // Flat top: the home above curves into it (see .ph-corner) and seems to cast a soft shadow on it.
    <div ref={dropRef} data-drop="bag" className="relative z-30 shrink-0 bg-white shadow-[inset_0_10px_12px_-10px_rgba(15,23,42,0.22)]">
      <button type="button" onClick={onExpand} className="flex w-full items-center justify-center pb-1 pt-1.5" aria-label="Open My Pets">
        <span className="h-1 w-9 rounded-full bg-slate-300" />
      </button>
      <div className="flex items-center gap-2 pb-3 pl-3">
        {/* The bag: how many pets are in it; opens the full list */}
        <button
          type="button"
          onClick={onExpand}
          aria-label={`My Pets: ${stored.length} in the bag. Open the list`}
          title="My Pets"
          className="relative flex h-[60px] w-[52px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-400 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/60 transition-transform active:scale-95"
        >
          <span key={bump} className={`flex ${bump ? 'ph-bag-bump' : ''}`}>
            <Backpack className="h-6 w-6" />
          </span>
          <span className="min-w-[26px] rounded-full bg-white/95 px-1.5 text-center text-[11px] font-black leading-4 text-orange-600 shadow-sm tabular-nums">
            {stored.length}
          </span>
        </button>
        <div className="ph-strip ph-fade-right flex min-w-0 flex-1 gap-2 overflow-x-auto py-1.5 pl-1 pr-8">
          {loading && !totalPets
            ? Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[60px] w-[60px] shrink-0 animate-pulse rounded-2xl bg-slate-100" />)
            : list.map((up) => (
                <StripCard key={up.id} up={up} isCompanion={up.id === companionId} startPress={startPress} onPlace={onPlace} onInfo={onInfo} />
              ))}
          {!loading && !list.length && (
            <div className="flex h-[60px] flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 text-xs font-extrabold text-slate-400">
              {totalPets ? (
                <>
                  <Home className="h-4 w-4 text-emerald-400" />
                  Everyone&apos;s home!
                </>
              ) : (
                <>
                  <Backpack className="h-4 w-4" />
                  No pets yet
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {worldDrag && <DropHint active={drag.over === 'bag'} />}
    </div>
  )
}

// ---- The full list: phone sheet (opened from the strip) and PC side panel ----

const GridCard = memo(function GridCard({ up, placed, isCompanion, selecting, picked, dragAxis, startPress, onToggle, onInfo, onPlace, onStore }) {
  const r = rarityOf(up)
  const name = petName(up)
  const level = up.level || 1
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${name}, level ${level}, ${r.label}${isCompanion ? ', companion' : ''}${placed ? ', at home' : ', in the bag'}`}
      aria-pressed={selecting ? picked : undefined}
      className={`ph-noselect ph-card group relative flex flex-col rounded-[20px] bg-white p-1.5 pb-1 ring-1 ${
        picked ? 'ring-2 ring-sky-500' : 'ring-slate-200/70'
      } ${dragAxis === 'none' ? 'cursor-pointer' : 'cursor-grab'}`}
      onPointerDown={(e) =>
        startPress(e, {
          id: up.id,
          source: 'bag',
          axis: e.pointerType === 'mouse' ? (dragAxis === 'none' ? 'none' : 'any') : dragAxis,
          tap: () => (selecting ? onToggle(up.id) : onInfo(up.id)),
        })
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (selecting) onToggle(up.id)
          else onInfo(up.id)
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`ph-tile relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-b ${r.tile} ring-1 ring-inset ${r.ring}`}>
        <span className="ph-tile-glow" />
        <span className="ph-tile-floor" />
        <PetImage
          src={petImage(up)}
          size={THUMB}
          alt={name}
          className="ph-card-img absolute left-[13%] top-[9%] h-[74%] w-[74%] object-contain"
          style={r.glow ? { filter: `drop-shadow(0 0 6px ${r.glow})` } : undefined}
        />
        <span className="absolute left-1 top-1 flex items-baseline rounded-lg bg-white/90 px-1.5 py-0.5 text-[11px] font-black leading-none text-slate-700 shadow-sm tabular-nums">
          <span className="mr-px text-[8px] text-slate-400">Lv</span>
          {level}
        </span>
        {selecting ? (
          <span
            className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow ${
              picked ? 'border-sky-500 bg-sky-500 text-white' : 'border-white bg-white/80 text-transparent'
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        ) : isCompanion ? (
          <span className="absolute right-1 top-1 rounded-full bg-amber-400 p-1 shadow ring-2 ring-white" title="Companion">
            <Crown className="h-3 w-3 fill-white text-white" />
          </span>
        ) : isNew(up) ? (
          <span className="absolute right-1 top-1 rounded-full bg-rose-500 p-1 shadow ring-2 ring-white" title="New">
            <Sparkles className="h-3 w-3 text-white" />
          </span>
        ) : null}
        <Stars n={r.stars} className={`ph-ink-light absolute bottom-1.5 left-2 text-[11px] leading-none ${r.text}`} />
        {!selecting && (
          <button
            type="button"
            aria-label={placed ? `Put ${name} in the bag` : `Bring ${name} home`}
            title={placed ? 'Put in the bag' : 'Bring home'}
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation()
              if (placed) onStore([up.id])
              else onPlace([up.id])
            }}
            className={`absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-2 ring-white transition-transform hover:scale-110 active:scale-90 lg:h-7 lg:w-7 ${
              placed ? 'bg-white text-rose-500' : 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white'
            }`}
          >
            {placed ? <Minus className="h-4 w-4 lg:h-3.5 lg:w-3.5" strokeWidth={3.5} /> : <Plus className="h-4 w-4 lg:h-3.5 lg:w-3.5" strokeWidth={3.5} />}
          </button>
        )}
      </div>
      <div className="flex h-6 items-center justify-center gap-1 px-1">
        {placed && <Home className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />}
        <span className="truncate text-xs font-extrabold text-slate-700">{name}</span>
      </div>
    </div>
  )
})

// Sort order and rarity filter, behind one button.
const SortMenu = ({ sort, onSortChange, rarity, onRarityChange, rarities }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const chip = (on) => `flex h-8 items-center justify-center rounded-xl px-1 text-xs font-black transition ${on ? 'ring-2' : 'bg-slate-100 hover:bg-slate-200'}`

  return (
    <div ref={ref} className="relative">
      <ToolButton label="Sort and filter" expanded={open} dot={rarity !== 'all'} onClick={() => setOpen((v) => !v)}>
        <SlidersHorizontal className="h-4 w-4" />
      </ToolButton>
      {open && (
        <div className="ph-modal-enter absolute right-0 top-11 z-40 w-[232px] rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/5">
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="Sort">
            {SORTS.map((s) => {
              const Icon = SORT_ICON[s.key] || Clock
              const on = sort === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSortChange(s.key)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-extrabold transition ${
                    on ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                </button>
              )
            })}
          </div>
          {rarities.length > 1 && (
            <>
              <div className="my-2 h-px bg-slate-100" />
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Rarity">
                <button
                  type="button"
                  aria-pressed={rarity === 'all'}
                  onClick={() => onRarityChange('all')}
                  className={`${chip(rarity === 'all')} ${rarity === 'all' ? 'bg-slate-800 text-white ring-slate-800' : 'text-slate-600'}`}
                >
                  All
                </button>
                {rarities.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={rarity === k}
                    aria-label={RARITY[k].label}
                    title={RARITY[k].label}
                    onClick={() => onRarityChange(rarity === k ? 'all' : k)}
                    className={`${chip(rarity === k)} ${rarity === k ? RARITY[k].chip : RARITY[k].text}`}
                  >
                    <Stars n={RARITY[k].stars} className="text-[11px]" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const BagManager = ({
  variant,
  pets,
  layout,
  companionId,
  loading,
  sort,
  onSortChange,
  drag,
  bump,
  dropRef,
  startPress,
  onClose,
  onPlace,
  onStore,
  onInfo,
  onTidy,
  onShuffle,
  onShop,
}) => {
  const stored = useMemo(() => pets.filter((p) => !layout[p.id]), [pets, layout])
  const home = useMemo(() => pets.filter((p) => layout[p.id]), [pets, layout])
  const [tab, setTab] = useState(() => {
    const saved = readPref('bagTab', null)
    return TABS.some((t) => t.key === saved) ? saved : stored.length ? 'bag' : 'all'
  })
  const [rarity, setRarity] = useState('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState(() => new Set())

  useEffect(() => writePref('bagTab', tab), [tab])

  const base = tab === 'bag' ? stored : tab === 'home' ? home : pets
  const q = normalizeText(query)
  const list = useMemo(
    () => sortPets(base.filter((p) => (rarity === 'all' || rarityKey(p) === rarity) && matches(p, q)), sort, companionId),
    [base, rarity, q, sort, companionId]
  )
  const ownedRarities = useMemo(() => RARITY_ORDER.filter((k) => pets.some((p) => rarityKey(p) === k)), [pets])
  // A search with no hit in this tab may still find pets in the others.
  const elsewhere = useMemo(
    () => (q && tab !== 'all' && !list.length ? pets.filter((p) => (rarity === 'all' || rarityKey(p) === rarity) && matches(p, q)).length : 0),
    [q, tab, list.length, pets, rarity]
  )

  // Selection only keeps pets still in the list.
  useEffect(() => {
    if (!selecting) return
    setPicked((s) => {
      const ids = new Set(list.map((p) => p.id))
      const next = new Set([...s].filter((id) => ids.has(id)))
      return next.size === s.size ? s : next
    })
  }, [list, selecting])

  // Stable, so the memoized cards do not all redraw when one pet moves.
  const toggle = useCallback(
    (id) =>
      setPicked((s) => {
        const next = new Set(s)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    []
  )

  const closeSearch = () => {
    setQuery('')
    setSearchOpen(false)
  }

  const pickedIds = [...picked]
  const pickedStored = pickedIds.filter((id) => !layout[id])
  const pickedHome = pickedIds.filter((id) => layout[id])
  const listStored = list.filter((p) => !layout[p.id]).map((p) => p.id)
  const listHome = list.filter((p) => layout[p.id]).map((p) => p.id)
  const allPicked = list.length > 0 && picked.size === list.length
  const panel = variant === 'panel'
  const dragAxis = panel ? 'x' : 'none'
  const worldDrag = drag?.source === 'world'
  const canArrange = home.length > 1
  const showFooter = selecting || (pets.length > 0 && (listStored.length > 0 || listHome.length > 0 || canArrange))
  const gridCols = panel ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'

  return (
    <div ref={dropRef} data-drop={panel ? 'bag' : undefined} className="relative flex h-full min-h-0 flex-col">
      {/* Header: title (or the search box) and close */}
      <div className="flex items-center gap-2 px-4 pb-2.5 pt-3">
        <BagIcon bump={bump} className="h-10 w-10" />
        {searchOpen ? (
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  closeSearch()
                }
              }}
              placeholder="Search"
              aria-label="Search pets"
              className="h-10 w-full rounded-xl border-0 bg-white pl-9 pr-9 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 placeholder:font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={closeSearch}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </label>
        ) : (
          <>
            <h2 className="min-w-0 flex-1 truncate text-lg font-black tracking-tight text-slate-800">My Pets</h2>
            {pets.length > 0 && (
              <ToolButton label="Search" onClick={() => setSearchOpen(true)}>
                <Search className="h-[18px] w-[18px]" />
              </ToolButton>
            )}
          </>
        )}
        <ToolButton label={panel ? 'Hide My Pets' : 'Close'} onClick={onClose}>
          {panel ? <PanelRightClose className="h-[18px] w-[18px]" /> : <ChevronDown className="h-5 w-5" />}
        </ToolButton>
      </div>

      {/* Tabs (icon + count), sort and filter, select */}
      {pets.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2.5">
          <div role="tablist" aria-label="Show" className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1">
            {TABS.map((t) => {
              const count = t.key === 'bag' ? stored.length : t.key === 'home' ? home.length : pets.length
              const on = tab === t.key
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={`${t.label} (${count})`}
                  title={t.label}
                  onClick={() => setTab(t.key)}
                  className={`flex h-8 items-center justify-center gap-1.5 rounded-xl text-sm font-black tabular-nums transition ${
                    on ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${on ? t.tone : ''}`} />
                  {count}
                </button>
              )
            })}
          </div>
          <SortMenu sort={sort} onSortChange={onSortChange} rarity={rarity} onRarityChange={setRarity} rarities={ownedRarities} />
          <ToolButton
            label="Select several"
            pressed={selecting}
            onClick={() => {
              setSelecting((v) => !v)
              setPicked(new Set())
            }}
          >
            <ListChecks className="h-[18px] w-[18px]" />
          </ToolButton>
        </div>
      )}

      {/* Grid */}
      <div className="ph-grid-scroll ph-thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1">
        {loading && !pets.length ? (
          <div className={`grid gap-2.5 ${gridCols}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="aspect-[5/6] animate-pulse rounded-[20px] bg-slate-200/70" />
            ))}
          </div>
        ) : !pets.length ? (
          <EmptyNote icon={Backpack} tone="bg-amber-100 text-amber-500" text="No pets yet">
            <button
              type="button"
              onClick={onShop}
              className="mt-3 flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-extrabold text-white shadow-md shadow-sky-500/30 hover:bg-sky-600"
            >
              <ShoppingBag className="h-4 w-4" />
              Shop
            </button>
          </EmptyNote>
        ) : !list.length ? (
          q || rarity !== 'all' ? (
            <EmptyNote icon={Search} text="No match">
              {elsewhere > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('all')}
                  aria-label={`Show ${elsewhere} in all pets`}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-black text-sky-600 shadow-sm ring-1 ring-slate-200 tabular-nums hover:bg-sky-50"
                >
                  <LayoutGrid className="h-4 w-4" />
                  {elsewhere}
                </button>
              )}
            </EmptyNote>
          ) : tab === 'bag' ? (
            <EmptyNote icon={Home} tone="bg-emerald-100 text-emerald-500" text="Everyone's home!" />
          ) : (
            <EmptyNote icon={Home} text="Home is empty">
              {stored.length > 0 && (
                <div className="mt-3">
                  <MoveButton kind="place" count={stored.length} label="Bring all home" onClick={() => onPlace(stored.map((p) => p.id))} />
                </div>
              )}
            </EmptyNote>
          )
        ) : (
          <div className={`grid gap-2.5 ${gridCols}`}>
            {list.map((up) => (
              <GridCard
                key={up.id}
                up={up}
                placed={!!layout[up.id]}
                isCompanion={up.id === companionId}
                selecting={selecting}
                picked={picked.has(up.id)}
                dragAxis={dragAxis}
                startPress={startPress}
                onToggle={toggle}
                onInfo={onInfo}
                onPlace={onPlace}
                onStore={onStore}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: arrange the home, move the listed pets (or the picked ones) */}
      {showFooter && (
        <div className="flex items-center gap-2 border-t border-slate-200/70 bg-white/90 px-4 py-2.5">
          {selecting ? (
            <>
              <ToolButton
                label={allPicked ? 'Clear the selection' : 'Select all'}
                onClick={() => setPicked(allPicked ? new Set() : new Set(list.map((p) => p.id)))}
              >
                {allPicked ? <X className="h-[18px] w-[18px]" /> : <CheckCheck className="h-[18px] w-[18px]" />}
              </ToolButton>
              <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-black text-sky-700 tabular-nums" aria-label={`${picked.size} selected`}>
                {picked.size}
              </span>
              <span className="flex-1" />
              <MoveButton
                kind="store"
                count={pickedHome.length}
                label="Put in the bag"
                onClick={() => {
                  onStore(pickedHome)
                  setPicked(new Set())
                }}
              />
              <MoveButton
                kind="place"
                count={pickedStored.length}
                label="Bring home"
                onClick={() => {
                  onPlace(pickedStored)
                  setPicked(new Set())
                }}
              />
            </>
          ) : (
            <>
              {canArrange && (
                <ToolButton label="Tidy up" onClick={onTidy}>
                  <Wand2 className="h-[18px] w-[18px]" />
                </ToolButton>
              )}
              {canArrange && (
                <ToolButton label="Shuffle" onClick={onShuffle}>
                  <Shuffle className="h-[18px] w-[18px]" />
                </ToolButton>
              )}
              <span className="flex-1" />
              {listHome.length > 0 && (
                <MoveButton
                  kind="store"
                  count={listHome.length}
                  label={listHome.length === home.length ? 'Put all in the bag' : 'Put these in the bag'}
                  onClick={() => onStore(listHome)}
                />
              )}
              {listStored.length > 0 && (
                <MoveButton
                  kind="place"
                  count={listStored.length}
                  label={listStored.length === stored.length ? 'Bring all home' : 'Bring these home'}
                  onClick={() => onPlace(listStored)}
                />
              )}
            </>
          )}
        </div>
      )}

      {panel && worldDrag && <DropHint active={drag.over === 'bag'} />}
    </div>
  )
}

/**
 * My Pets, the pet bag.
 * - variant 'sheet' (phones, tablets): a strip of the pets in the bag under the home, and the full list in a sheet.
 * - variant 'panel' (PC): the full list in a side panel.
 * Words are kept to names and a few labels: tabs, moves and tools are icons with counts (each has a tooltip and an
 * aria-label).
 */
const PetBag = (props) => {
  const { variant, expanded, onExpandedChange, panelOpen, onPanelOpenChange, pets, layout } = props
  const stored = useMemo(() => pets.filter((p) => !layout[p.id]), [pets, layout])
  const [sort, setSort] = useState(() => {
    const saved = readPref('bagSort', 'newest')
    return SORTS.some((s) => s.key === saved) ? saved : 'newest'
  })
  useEffect(() => writePref('bagSort', sort), [sort])

  if (variant === 'panel') {
    if (!panelOpen) return null
    return (
      <aside className="relative z-30 flex w-[340px] shrink-0 flex-col border-l border-slate-200/80 bg-slate-50 shadow-[-12px_0_32px_rgba(15,23,42,0.12)] xl:w-[380px]">
        <BagManager {...props} sort={sort} onSortChange={setSort} onClose={() => onPanelOpenChange(false)} />
      </aside>
    )
  }

  return (
    <>
      <BagStrip
        stored={stored}
        totalPets={pets.length}
        companionId={props.companionId}
        sort={sort}
        drag={props.drag}
        bump={props.bump}
        dropRef={props.dropRef}
        startPress={props.startPress}
        onPlace={props.onPlace}
        onInfo={props.onInfo}
        onExpand={() => onExpandedChange(true)}
        loading={props.loading}
      />
      {expanded && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close My Pets"
            className="ph-fade-enter absolute inset-0 bg-slate-900/40"
            onClick={() => onExpandedChange(false)}
          />
          <div className="ph-sheet-enter relative flex h-[86%] flex-col rounded-t-[26px] bg-slate-50 shadow-2xl">
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              className="flex w-full items-center justify-center pb-0.5 pt-2"
              aria-label="Close My Pets"
            >
              <span className="h-1 w-9 rounded-full bg-slate-300" />
            </button>
            <BagManager {...props} sort={sort} onSortChange={setSort} dropRef={undefined} onClose={() => onExpandedChange(false)} />
          </div>
        </div>
      )}
    </>
  )
}

export default PetBag
