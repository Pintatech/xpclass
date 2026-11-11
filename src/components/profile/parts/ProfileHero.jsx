import { useEffect, useState } from 'react'
import { ArrowRight, Calendar, Camera, Check, Clock, Crown, Lock, Mail, Pencil, X, Zap } from 'lucide-react'
import AvatarWithFrame from '../../ui/AvatarWithFrame'
import { assetUrl } from '../../../hooks/useBranding'
import { petName, rarityOf } from '../../pet/home/petHomeUtils'
import { TIERS, fmt } from '../profileUtils'
import { BadgeIcon, CountUp } from './bits'
import PetPic from './PetPic'
import { useMedia } from './useMedia'

// Kept to the edges of the card, clear of the name and the XP bar on phones and on wide screens.
const SPARKS = [
  { left: '4%', top: '10%', size: 14, d: '3.4s', delay: '0s' },
  { left: '27%', top: '6%', size: 9, d: '2.8s', delay: '0.6s' },
  { left: '47%', top: '4%', size: 10, d: '3.8s', delay: '1.1s' },
  { left: '79%', top: '8%', size: 16, d: '3.1s', delay: '0.3s' },
  { left: '95.5%', top: '44%', size: 10, d: '2.6s', delay: '1.5s' },
  { left: '1.6%', top: '58%', size: 9, d: '3.6s', delay: '0.9s' },
  { left: '60%', top: '93%', size: 8, d: '3s', delay: '1.8s' },
]

const Spark = ({ s }) => (
  <svg className="pf-spark" viewBox="0 0 24 24" width={s.size} height={s.size} style={{ left: s.left, top: s.top, '--d': s.d, '--delay': s.delay }}>
    <path fill="currentColor" d="M12 0c.9 6.6 4.5 10.2 12 12-7.5 1.8-11.1 5.4-12 12-.9-6.6-4.5-10.2-12-12 7.5-1.8 11.1-5.4 12-12z" />
  </svg>
)

// The companion pet standing next to the avatar. A pet the viewer does not own yet shows as a pale outline.
const Companion = ({ companion, onClick, size, className = '' }) => {
  const { up, owned } = companion
  const r = rarityOf(up)
  const name = owned ? petName(up) : '???'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-label': `${name} · Pets` } : { role: 'img', 'aria-label': name })}
      title={name}
      onContextMenu={(e) => e.preventDefault()}
      className={`pf-noselect relative flex shrink-0 items-center justify-center ${onClick ? 'pf-press cursor-pointer' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="pf-pet-stage" />
      <span className="pf-pet-floor" />
      <PetPic
        up={up}
        size={256}
        alt=""
        emojiClass="text-5xl"
        mystery={!owned}
        mysteryStyle={{ filter: 'brightness(0) invert(1)', opacity: 0.5 }}
        className="pf-pet-bob relative h-full w-full object-contain"
        style={{ filter: r.glow ? `drop-shadow(0 0 10px ${r.glow})` : 'drop-shadow(0 8px 8px rgba(2,6,23,0.35))' }}
      />
    </Tag>
  )
}

/**
 * The top card: avatar (with its frame), name, badge tier, XP and the way to the next level, and the companion pet.
 * Its colours follow the badge tier (set on .pf-root by the page).
 */
const ProfileHero = ({
  isOwn,
  name,
  email,
  avatarUrl,
  frameUrl,
  frameRatio,
  fallback,
  onAvatarClick,
  level,
  totalXP,
  joined,
  isEditing,
  editName,
  onEditName,
  onSave,
  onToggleEdit,
  nameLocked,
  cooldownText,
  companion,
  onCompanionClick,
}) => {
  // Side by side from 768px: with the app's side bars the page then has 736px of room or more.
  const wide = useMedia('(min-width: 768px)')
  // The bar grows from empty once the card is on screen.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const { current, next, isMax } = level
  const pct = isMax ? 100 : level.percent
  const tier = current ? TIERS[current.badge_tier] : null
  const hasFrame = !!frameUrl && frameUrl.startsWith('http')
  const hasPicture = !!avatarUrl && avatarUrl.startsWith('http')

  return (
    <section className="pf-hero pf-rise" style={{ '--i': 0 }}>
      <div className="pf-hero-bg" aria-hidden="true">
        <span className="pf-hero-sheen" />
        {SPARKS.map((s) => (
          <Spark key={s.left} s={s} />
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-4 px-5 pb-5 pt-7 md:flex-row md:gap-7 md:px-8 md:py-8">
        {/* Avatar, with the companion beside it on phones */}
        <div className="flex shrink-0 items-end justify-center gap-1">
          <div className="pf-avatar-wrap" style={{ '--pf-avatar-glyph': wide ? '3.75rem' : '3.25rem' }}>
            <span className="pf-avatar-halo" />
            {!hasFrame && !hasPicture && <span className="pf-avatar-plate" />}
            <AvatarWithFrame
              avatarUrl={avatarUrl}
              frameUrl={frameUrl}
              frameRatio={frameRatio}
              size={wide ? 136 : 112}
              fallback={fallback}
              onClick={onAvatarClick}
              className={!hasFrame && hasPicture ? 'pf-avatar-ring' : ''}
            />
            {onAvatarClick && (
              <button
                type="button"
                onClick={onAvatarClick}
                aria-label="Chọn Avatar"
                title="Chọn Avatar"
                className="pf-press absolute bottom-0 right-0 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-2 ring-white/60 hover:text-sky-600"
              >
                <Camera className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
          {companion && <Companion companion={companion} onClick={onCompanionClick} size={76} className="-ml-1 md:hidden" />}
        </div>

        {/* Name, badge, XP */}
        <div className="w-full min-w-0 flex-1 text-center md:text-left">
          {isEditing && isOwn ? (
            <div>
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <input
                  type="text"
                  placeholder="Tên đầy đủ"
                  aria-label="Tên đầy đủ"
                  value={editName}
                  onChange={(e) => onEditName(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter that only finishes a typed Vietnamese letter (IME composition) must not save half a name.
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return
                    if (e.key === 'Enter') onSave()
                    else if (e.key === 'Escape') onToggleEdit()
                  }}
                  disabled={nameLocked}
                  autoFocus
                  className="w-full min-w-0 max-w-xs rounded-xl border-2 border-white/70 bg-white px-3 py-2 text-lg font-black text-slate-800 shadow-inner focus:border-white focus:outline-none focus:ring-4 focus:ring-white/30 disabled:bg-white/75 disabled:text-slate-500"
                />
                <button
                  type="button"
                  onClick={onSave}
                  aria-label="Lưu"
                  title="Lưu"
                  className="pf-press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-400"
                >
                  <Check className="h-5 w-5" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  onClick={onToggleEdit}
                  aria-label="Hủy"
                  title="Hủy"
                  className="pf-glass-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                >
                  <X className="h-5 w-5" strokeWidth={3} />
                </button>
              </div>
              {cooldownText && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-bold text-yellow-200">
                  <Clock className="h-3.5 w-3.5" />
                  Đổi tên sau {cooldownText}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-center gap-2 md:justify-start">
              <h1 className="pf-hero-name line-clamp-3 min-w-0 text-[26px] font-black leading-tight tracking-tight md:line-clamp-2 md:text-4xl" title={name}>
                {name}
              </h1>
              {isOwn && (
                <button
                  type="button"
                  onClick={onToggleEdit}
                  aria-label="Edit"
                  title="Edit"
                  className="pf-glass-btn mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white md:mt-1.5"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 md:justify-start">
            {tier && <span className="pf-tier-tag rounded-full px-2.5 py-1 text-[11px] font-black uppercase leading-none tracking-wider">{tier.label}</span>}
            {current && (
              <span className="pf-chip max-w-full py-1 pl-1 pr-3 text-sm font-extrabold" title={current.badge_description || current.badge_name}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/95 p-0.5">
                  <BadgeIcon icon={current.badge_icon} emojiClass="text-sm" />
                </span>
                <span className="shrink-0">Lv {current.level_number}</span>
                <span className="opacity-60">·</span>
                <span className="truncate">{current.badge_name}</span>
              </span>
            )}
            {joined && (
              <span className="pf-chip px-2.5 py-1 text-xs font-bold text-white/90" title="Tham gia từ" aria-label={`Tham gia từ ${joined}`}>
                <Calendar className="h-3.5 w-3.5" />
                {joined}
              </span>
            )}
          </div>
          {email && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-white/85 md:justify-start">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{email}</span>
            </p>
          )}

          {/* XP and the way to the next level */}
          <div className="mt-4 text-left">
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <div className="flex shrink-0 items-center gap-1.5" aria-label={`${totalXP} XP`}>
                <img src={assetUrl('/icon/profile/XP.svg')} alt="" className="h-6 w-6 drop-shadow" />
                <span className="text-2xl font-black leading-none md:text-[28px]">
                  <CountUp value={totalXP} />
                </span>
                <span className="text-sm font-black text-white/80">XP</span>
              </div>
              {current && isMax && (
                <span className="pf-tier-tag inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase leading-none tracking-wider" title="You've reached the highest level!">
                  <Crown className="h-3.5 w-3.5" />
                  Max
                </span>
              )}
              {!isMax && next && (
                <div
                  className="flex min-w-0 items-center gap-1 text-xs font-extrabold text-white/90"
                  title={`${level.xpNeeded} XP to unlock ${next.badge_name}`}
                  aria-label={`${level.xpNeeded} XP to unlock ${next.badge_name}`}
                >
                  <Zap className="h-3.5 w-3.5 shrink-0 fill-current" />
                  <span className="shrink-0 tabular-nums">{fmt(level.xpNeeded)} XP</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{next.badge_name}</span>
                </div>
              )}
            </div>
            {current && (
              <div className="flex items-center gap-2">
                <span className="pf-xp-medal h-9 w-9 p-1.5" title={current.badge_name}>
                  <BadgeIcon icon={current.badge_icon} alt={current.badge_name} emojiClass="text-lg" />
                </span>
                <div className="pf-xp-track min-w-0 flex-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="pf-xp-fill" style={{ '--pct': armed ? `${pct}%` : '0%' }} />
                </div>
                {!isMax && next && (
                  <span className="pf-xp-medal h-9 w-9 p-1.5" data-next="true" title={next.badge_name}>
                    <BadgeIcon icon={next.badge_icon} alt={next.badge_name} emojiClass="text-lg" locked />
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-500 shadow">
                      <Lock className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {companion && <Companion companion={companion} onClick={onCompanionClick} size={132} className="hidden md:flex" />}
      </div>
    </section>
  )
}

export default ProfileHero
