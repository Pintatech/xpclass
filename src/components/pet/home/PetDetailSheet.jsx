import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  FlipHorizontal2,
  Loader2,
  LocateFixed,
  PackageMinus,
  PackagePlus,
  Pencil,
  Sparkles,
  Star,
  X,
  Zap,
} from 'lucide-react'
import { getPetLevelFromXp } from '../../../hooks/usePet'
import PetImage from './PetImage'
import { companionBonus, evolutionInfo, isNew, petImage, petName, rarityOf } from './petHomeUtils'

const NAME_MAX = 20

const Tile = ({ icon: Icon, label, children, className = '' }) => (
  <div className={`rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 ${className}`}>
    <div className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
      <Icon className="h-3 w-3" />
      {label}
    </div>
    {children}
  </div>
)

/**
 * Pet details: rename, companion, home or bag, level and evolution. Phones get a bottom sheet (swipe the picture
 * sideways for the next pet), larger screens a dialog. Arrow keys browse, Esc closes.
 */
const PetDetailSheet = ({
  up,
  list,
  placed,
  isCompanion,
  onClose,
  onNavigate,
  onMakeCompanion,
  onPlace,
  onStore,
  onFlip,
  onLocate,
  onRename,
}) => {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [companionBusy, setCompanionBusy] = useState(false)
  const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 640px)').matches
  const swipeRef = useRef(null)

  const index = list.findIndex((p) => p.id === up.id)
  const prev = index > 0 ? list[index - 1] : null
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null

  useEffect(() => {
    setRenaming(false)
    setError(null)
    setSaving(false)
  }, [up.id])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) {
        if (e.key === 'Escape') setRenaming(false)
        return
      }
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prev) onNavigate(prev.id)
      else if (e.key === 'ArrowRight' && next) onNavigate(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNavigate, prev, next])

  const r = rarityOf(up)
  const name = petName(up)
  const lvl = getPetLevelFromXp(up.xp || 0)
  const evo = evolutionInfo(up)
  const bonus = companionBonus(up)
  const metOn = up.obtained_at ? new Date(up.obtained_at).toLocaleDateString() : '—'

  const submitName = async (e) => {
    e.preventDefault()
    const clean = draft.trim().slice(0, NAME_MAX)
    if (clean === (up.nickname || '').trim()) {
      setRenaming(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onRename(up.id, clean)
      setRenaming(false)
    } catch {
      setError('The name was not saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const makeCompanion = async () => {
    setCompanionBusy(true)
    try {
      await onMakeCompanion(up.id)
    } finally {
      setCompanionBusy(false)
    }
  }

  // Swipe the picture sideways for the previous / next pet.
  const onSwipeStart = (e) => {
    if (e.pointerType === 'mouse') return
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }
  const onSwipeEnd = (e) => {
    const s = swipeRef.current
    swipeRef.current = null
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
    if (dx < 0 && next) onNavigate(next.id)
    if (dx > 0 && prev) onNavigate(prev.id)
  }

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={name}>
      <div className="ph-fade-enter absolute inset-0 bg-slate-900/55" onClick={onClose} />
      <div
        className={`${wide ? 'ph-modal-enter rounded-3xl' : 'ph-sheet-enter rounded-t-3xl'} relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl`}
      >
        {/* Picture */}
        <div
          className={`relative shrink-0 bg-gradient-to-b ${r.hero} px-4 pb-4 pt-3`}
          style={{ touchAction: 'pan-y' }}
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={() => (swipeRef.current = null)}
        >
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${r.chip}`}>
              <span className="tracking-[-0.12em]">{'★'.repeat(r.stars)}</span>
              {r.label}
            </span>
            {isCompanion && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-black uppercase text-white shadow">
                <Crown className="h-3 w-3 fill-white" />
                Companion
              </span>
            )}
            {isNew(up) && <span className="rounded-full bg-rose-500 px-2 py-1 text-[11px] font-black text-white">NEW</span>}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-slate-600 hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex items-center justify-center py-2">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && onNavigate(prev.id)}
              aria-label="Previous pet"
              className="absolute left-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-slate-600 shadow transition hover:bg-white disabled:opacity-0"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div key={up.id} className="ph-modal-enter relative h-40 w-40 sm:h-44 sm:w-44">
              {isCompanion && <div className="ph-aura" />}
              <PetImage
                src={petImage(up)}
                alt={name}
                eager
                className="ph-hero-bob h-full w-full object-contain"
                style={{ filter: r.glow ? `drop-shadow(0 0 14px ${r.glow})` : 'drop-shadow(0 10px 10px rgba(0,0,0,0.18))' }}
              />
            </div>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onNavigate(next.id)}
              aria-label="Next pet"
              className="absolute right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-slate-600 shadow transition hover:bg-white disabled:opacity-0"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          {list.length > 1 && index >= 0 && (
            <div className="text-center text-[11px] font-bold text-slate-500">
              {index + 1} / {list.length}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {renaming ? (
            <form onSubmit={submitName} className="mb-1">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={draft}
                  maxLength={NAME_MAX}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={up.pet?.name || 'Name'}
                  aria-label="New name"
                  className="min-w-0 flex-1 rounded-xl border-2 border-sky-300 px-3 py-2 text-lg font-black text-slate-800 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={saving}
                  aria-label="Save name"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setRenaming(false)}
                  aria-label="Cancel"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-400">
                <span>Leave empty to use &quot;{up.pet?.name}&quot;</span>
                <span>
                  {draft.length}/{NAME_MAX}
                </span>
              </div>
              {error && <p className="mt-1 text-xs font-bold text-rose-600">{error}</p>}
            </form>
          ) : (
            <div className="mb-1 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-black leading-tight text-slate-800">{name}</h2>
                {up.nickname && <p className="text-sm font-semibold text-slate-500">{up.pet?.name}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraft(up.nickname || '')
                  setRenaming(true)
                }}
                className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-200"
              >
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </button>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Tile icon={Star} label="Level" className="col-span-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-800">Lv. {up.level || lvl.level}</span>
                <span className="text-xs font-bold text-slate-500">
                  {lvl.xpInLevel} / {lvl.xpForLevel} XP
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full bg-gradient-to-r ${r.bar}`} style={{ width: `${Math.min(100, lvl.progress)}%` }} />
              </div>
            </Tile>
            <Tile icon={Sparkles} label="Evolution">
              {evo.total ? (
                <>
                  <div className="flex gap-1">
                    {Array.from({ length: evo.total + 1 }, (_, i) => (
                      <span key={i} className={`h-2 flex-1 rounded-full ${i <= evo.current ? 'bg-violet-500' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs font-bold text-slate-600">
                    {evo.next ? `Next: ${evo.next.name || `Stage ${evo.next.stage}`}` : 'Fully evolved'}
                  </p>
                </>
              ) : (
                <p className="text-xs font-bold text-slate-500">This pet does not evolve</p>
              )}
            </Tile>
            <Tile icon={Calendar} label="Met on">
              <p className="text-sm font-black text-slate-700">{metOn}</p>
            </Tile>
          </div>

          <div className={`mt-2 flex items-center gap-2 rounded-2xl px-3 py-2.5 ${isCompanion ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-sky-50 ring-1 ring-sky-100'}`}>
            <Zap className={`h-4 w-4 shrink-0 ${isCompanion ? 'fill-amber-400 text-amber-500' : 'text-sky-500'}`} />
            <p className="text-xs font-bold text-slate-600">
              {isCompanion ? (
                <>
                  Your companion gives <span className="text-amber-600">+{bonus}% XP</span>.
                </>
              ) : (
                <>
                  As your companion: <span className="text-sky-600">+{bonus}% XP</span>.
                </>
              )}
            </p>
          </div>

          {up.pet?.description && <p className="mt-3 text-sm italic text-slate-500">{up.pet.description}</p>}

          <div className="mt-4 grid grid-cols-2 gap-2">
            {!isCompanion ? (
              <button
                type="button"
                onClick={makeCompanion}
                disabled={companionBusy}
                className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-3 text-sm font-black text-white shadow-md transition active:scale-[0.98] disabled:opacity-70"
              >
                {companionBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />}
                Make companion
              </button>
            ) : null}
            {placed ? (
              <>
                <button
                  type="button"
                  onClick={() => onLocate(up.id)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-3 py-3 text-sm font-extrabold text-white transition hover:bg-sky-600 active:scale-[0.98]"
                >
                  <LocateFixed className="h-4 w-4" />
                  Find at home
                </button>
                <button
                  type="button"
                  onClick={() => onStore(up.id)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-3 py-3 text-sm font-extrabold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-100 active:scale-[0.98]"
                >
                  <PackageMinus className="h-4 w-4" />
                  Put in bag
                </button>
                <button
                  type="button"
                  onClick={() => onFlip(up.id)}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-200 active:scale-[0.98]"
                >
                  <FlipHorizontal2 className="h-4 w-4" />
                  Turn around
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onPlace(up.id)}
                className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-3 py-3 text-sm font-black text-white shadow-md transition active:scale-[0.98]"
              >
                <PackagePlus className="h-5 w-5" />
                Bring home
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PetDetailSheet
