import { Crown } from 'lucide-react'
import { petName, rarityOf } from '../../pet/home/petHomeUtils'
import { EmptyNote, SectionCard, Skel } from './bits'
import PetPic from './PetPic'

export const PawIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <ellipse cx="5.6" cy="10.6" rx="2.2" ry="2.8" />
    <ellipse cx="9.8" cy="6" rx="2.2" ry="2.9" />
    <ellipse cx="14.4" cy="6" rx="2.2" ry="2.9" />
    <ellipse cx="18.5" cy="10.6" rx="2.2" ry="2.8" />
    <path d="M12.1 11.2c-3 0-5.8 3.1-5.8 5.9 0 1.9 1.4 3 3 3 1.2 0 1.9-.6 2.8-.6s1.6.6 2.8.6c1.6 0 3-1.1 3-3 0-2.8-2.8-5.9-5.8-5.9z" />
  </svg>
)

const PetCard = ({ up, owned }) => {
  const r = rarityOf(up)
  const name = owned ? petName(up) : '???'
  return (
    <div className="pf-pet-card w-1/3 min-w-0 max-w-[132px] text-center" data-pet={up.id} data-owned={owned}>
      <div
        className={`pf-noselect relative mx-auto aspect-square w-full max-w-[132px] overflow-hidden rounded-3xl bg-gradient-to-b ring-1 ring-inset ${
          owned ? `${r.tile} ${r.ring}` : 'from-slate-100 to-slate-200 ring-slate-300'
        } ${up.is_active ? 'shadow-lg shadow-amber-500/25' : 'shadow-sm'}`}
        title={`${name} · ${r.label}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="pf-pet-glow" />
        <span className="pf-pet-shadow" />
        <span className="absolute inset-0 flex items-center justify-center">
          <PetPic
            up={up}
            size={256}
            alt={name}
            mystery={!owned}
            className="pf-pet-img absolute left-[12%] top-[6%] h-[76%] w-[76%] object-contain"
            style={owned && r.glow ? { filter: `drop-shadow(0 0 5px ${r.glow})` } : undefined}
          />
        </span>
        <span className={`pf-ink-light absolute inset-x-0 bottom-1 text-center text-[10px] leading-none tracking-[-0.12em] ${r.text}`} aria-label={r.label} role="img">
          {'★'.repeat(r.stars)}
        </span>
        {up.is_active && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-400 p-1 shadow ring-2 ring-white" title="Active" aria-label="Active" role="img">
            <Crown className="h-3 w-3 fill-white text-white" />
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate px-0.5 text-sm font-extrabold text-slate-700">{name}</div>
    </div>
  )
}

/**
 * Up to three pets, the active one first. A pet whose kind the viewer does not own yet stays a mystery: black
 * outline and "???" (the rule the old page had).
 */
const PetShelf = ({ pets, count, isOwn, ownsKind, ready, onViewAll, onEggShop, index, className = '' }) => (
  <SectionCard
    id="pets"
    icon={PawIcon}
    tone="emerald"
    title="Pets"
    count={ready ? count : null}
    onMore={isOwn ? onViewAll : undefined}
    index={index}
    className={className}
    bodyClass="flex flex-col justify-center"
  >
    {!ready ? (
      <div className="flex justify-center gap-2 sm:gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skel key={i} className="aspect-square w-1/3 max-w-[132px] rounded-3xl" />
        ))}
      </div>
    ) : count === 0 ? (
      <EmptyNote icon={PawIcon} tone="bg-emerald-50 text-emerald-300" text="No pets yet">
        {isOwn && (
          <button
            type="button"
            onClick={onEggShop}
            className="pf-press mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 px-4 py-2 text-sm font-black text-white shadow-md shadow-emerald-600/30"
          >
            <span aria-hidden="true">🥚</span>
            Egg Shop
          </button>
        )}
      </EmptyNote>
    ) : (
      <div className="flex justify-center gap-2 sm:gap-3">
        {pets.map((up) => (
          <PetCard key={up.id} up={up} owned={ownsKind(up)} />
        ))}
      </div>
    )}
  </SectionCard>
)

export default PetShelf
