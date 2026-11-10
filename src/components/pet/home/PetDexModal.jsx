import React, { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, X } from 'lucide-react'
import PetImage from './PetImage'
import { RARITY, RARITY_ORDER } from './petHomeUtils'

/**
 * Every species, by rarity. Species you own are in colour (tap one to see your pet), the others are shadows.
 */
const PetDexModal = ({ allPets, userPets, onClose, onOpenPet }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // species id -> your pets of that species (highest level first)
  const owned = useMemo(() => {
    const m = new Map()
    for (const up of userPets) {
      const id = up.pet?.id
      if (!id) continue
      if (!m.has(id)) m.set(id, [])
      m.get(id).push(up)
    }
    for (const list of m.values()) list.sort((a, b) => (b.level || 0) - (a.level || 0))
    return m
  }, [userPets])

  const groups = RARITY_ORDER.map((k) => ({ key: k, pets: allPets.filter((p) => (RARITY[p.rarity] ? p.rarity : 'common') === k) })).filter(
    (g) => g.pets.length
  )
  const total = allPets.length
  const found = allPets.filter((p) => owned.has(p.id)).length
  const pct = total ? Math.round((found / total) * 100) : 0

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Pet Dex">
      <div className="ph-fade-enter absolute inset-0 bg-slate-900/55" onClick={onClose} />
      <div className="ph-sheet-enter relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="shrink-0 bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 px-5 pb-4 pt-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black leading-tight">Pet Dex</h2>
              <p className="text-xs font-bold text-white/80">
                {found} of {total} species found
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-black">{pct}%</span>
          </div>
        </div>

        <div className="ph-thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3" style={{ overscrollBehavior: 'contain' }}>
          {groups.map(({ key, pets }) => {
            const r = RARITY[key]
            const have = pets.filter((p) => owned.has(p.id)).length
            return (
              <section key={key} className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${r.chip}`}>
                    <span className="tracking-[-0.12em]">{'★'.repeat(r.stars)}</span> {r.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full bg-gradient-to-r ${r.bar}`} style={{ width: `${(have / pets.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-black text-slate-500">
                    {have}/{pets.length}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-7">
                  {pets.map((pet) => {
                    const mine = owned.get(pet.id)
                    const has = !!mine
                    return (
                      <button
                        key={pet.id}
                        type="button"
                        disabled={!has}
                        onClick={() => has && onOpenPet(mine[0].id)}
                        title={has ? pet.name : 'Not found yet'}
                        className={`relative flex flex-col items-center rounded-2xl p-1.5 text-center transition ${
                          has ? `bg-gradient-to-b ${r.tile} ring-1 ${r.ring} hover:scale-105` : 'bg-slate-50 ring-1 ring-slate-100'
                        }`}
                      >
                        <div className="flex h-12 w-12 items-center justify-center">
                          {pet.image_url ? (
                            <PetImage src={pet.image_url} size={128} alt={has ? pet.name : 'Unknown pet'} silhouette={!has} className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-xl font-black text-slate-300">?</span>
                          )}
                        </div>
                        <span className={`mt-0.5 w-full truncate text-[10px] font-extrabold ${has ? 'text-slate-700' : 'text-slate-300'}`}>
                          {has ? pet.name : '???'}
                        </span>
                        {mine?.length > 1 && (
                          <span className="absolute -right-1 -top-1 rounded-full bg-slate-800 px-1.5 text-[9px] font-black text-white">×{mine.length}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
          {!groups.length && <p className="py-10 text-center text-sm font-bold text-slate-400">The Pet Dex is empty.</p>}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PetDexModal
