import { memo, useMemo, useState } from 'react'
import { Award, Check, Gift, Loader2 } from 'lucide-react'
import { assetUrl } from '../../../hooks/useBranding'
import { claimableFirst, hasReward, rewardLabel, winCountFor } from '../profileUtils'
import { EmptyNote, SectionCard, Skel } from './bits'

/** The achievement's medal picture, or a trophy when it has none (or the picture does not load). */
export const AchievementArt = memo(function AchievementArt({ a, locked = false, emojiClass = 'text-4xl' }) {
  const [failed, setFailed] = useState(null)
  if (a.badge_image_url && failed !== a.badge_image_url) {
    return (
      <img
        src={a.badge_image_url}
        alt={a.title}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={`relative h-full w-full object-contain ${locked ? 'opacity-40 grayscale' : ''}`}
        onError={() => setFailed(a.badge_image_url)}
      />
    )
  }
  return (
    <span role="img" aria-label={a.title} className={`relative flex h-full w-full items-center justify-center leading-none ${emojiClass} ${locked ? 'opacity-40 grayscale' : ''}`}>
      🏆
    </span>
  )
})

/** What an achievement gives: "+100 XP", "+10 gems" as small icon labels. `muted` is for the ones still locked. */
export const RewardChips = ({ a, muted = false, className = '' }) =>
  hasReward(a) ? (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-black leading-4 tabular-nums ${muted ? 'text-slate-400' : ''} ${className}`}>
      {a.xp_reward > 0 && (
        <span className={`inline-flex items-center gap-0.5 ${muted ? '' : 'text-amber-600'}`}>
          +{a.xp_reward}
          <img src={assetUrl('/image/study/xp.png')} alt="XP" className={`h-3.5 w-3.5 ${muted ? 'opacity-60 grayscale' : ''}`} />
        </span>
      )}
      {a.gem_reward > 0 && (
        <span className={`inline-flex items-center gap-0.5 ${muted ? '' : 'text-violet-600'}`}>
          +{a.gem_reward}
          <img src={assetUrl('/image/study/gem.png')} alt="gems" className={`h-3.5 w-3.5 ${muted ? 'opacity-60 grayscale' : ''}`} />
        </span>
      )}
    </div>
  ) : null

/** "Collect the reward". Screen readers and the tooltip get the old button's full words ("Nhận 100 XP + 10 💎"). */
export const ClaimButton = ({ a, busy, onClaim, className = '' }) => (
  <button
    type="button"
    onClick={() => onClaim(a.id)}
    disabled={busy}
    aria-label={rewardLabel(a)}
    title={rewardLabel(a)}
    data-claim={a.id}
    className={`pf-press inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 px-3.5 text-xs font-black text-white shadow-md shadow-emerald-600/30 disabled:opacity-60 ${
      busy ? '' : 'pf-claim'
    } ${className}`}
  >
    {busy ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <>
        <Gift className="pf-wiggle h-4 w-4 shrink-0" />
        Nhận
      </>
    )}
  </button>
)

export const ClaimedMark = ({ className = '' }) => (
  <span
    className={`flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white ${className}`}
    title="Đã nhận"
    aria-label="Đã nhận"
    role="img"
  >
    <Check className="h-3 w-3" strokeWidth={4} />
  </span>
)

export const WinCount = ({ n, className = '' }) => (
  <span className={`rounded-full bg-amber-400 px-1.5 text-[10px] font-black leading-4 text-amber-950 ring-2 ring-white ${className}`} aria-label={`${n} lần`}>
    ×{n}
  </span>
)

const Tile = ({ a, isOwn, busy, onClaim, wins }) => {
  const canClaim = !a.isClaimed && isOwn && hasReward(a)
  return (
    <div
      data-achievement={a.id}
      title={a.description || a.title}
      className={`relative flex flex-col items-center rounded-2xl px-1.5 pb-2 pt-3 text-center ${
        canClaim ? 'pf-ready' : 'justify-center bg-slate-50 ring-1 ring-inset ring-slate-100'
      }`}
    >
      <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
        <span className="pf-medal-glow" />
        <AchievementArt a={a} />
        {a.isClaimed && <ClaimedMark className="absolute -bottom-0.5 -right-0.5" />}
        {wins > 0 && <WinCount n={wins} className="absolute -right-2.5 -top-1" />}
      </div>
      {/* Two lines kept for every title, so the rewards and the buttons of a row line up. */}
      <div className="mt-1.5 flex min-h-[2rem] w-full items-center justify-center">
        <span className="line-clamp-2 break-words text-xs font-extrabold leading-4 text-slate-700">{a.title}</span>
      </div>
      {canClaim && (
        <>
          <RewardChips a={a} className="mt-1 justify-center" />
          <div className="mt-auto w-full pt-1.5">
            <ClaimButton a={a} busy={busy} onClaim={onClaim} className="w-full" />
          </div>
        </>
      )}
    </div>
  )
}

const MAX_TILES = 6

/**
 * Unlocked achievements, rewards still waiting first. Shows up to six; the "+N" tile and the count in the corner
 * open the full list.
 */
const AchievementShelf = ({ unlocked, total, isOwn, claiming, onClaim, winCounts, ready, onOpenAll, index, className = '' }) => {
  const ordered = useMemo(() => claimableFirst(unlocked, isOwn), [unlocked, isOwn])
  const waiting = isOwn ? unlocked.filter((a) => !a.isClaimed && hasReward(a)).length : 0
  const shown = ordered.length > MAX_TILES ? ordered.slice(0, MAX_TILES - 1) : ordered
  const more = ordered.length - shown.length

  return (
    <SectionCard
      id="achievements"
      icon={Award}
      tone="violet"
      title="Achievements"
      count={ready ? `${unlocked.length}/${total}` : null}
      onMore={onOpenAll}
      index={index}
      className={className}
      extra={
        waiting > 0 && (
          <span
            className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-emerald-500 pl-1.5 pr-2 text-xs font-black tabular-nums text-white shadow-sm shadow-emerald-600/30"
            title="Phần thưởng chưa nhận"
            aria-label={`${waiting} phần thưởng chưa nhận`}
          >
            <Gift className="h-3.5 w-3.5" />
            {waiting}
          </span>
        )
      }
    >
      {!ready ? (
        <div className="pf-ach-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <Skel key={i} className="h-[104px] rounded-2xl sm:h-[116px]" />
          ))}
        </div>
      ) : unlocked.length === 0 ? (
        <EmptyNote icon={Award} tone="bg-violet-50 text-violet-300" text="No achievements unlocked yet" />
      ) : (
        <div className="pf-ach-grid">
          {shown.map((a) => (
            <Tile key={a.id} a={a} isOwn={isOwn} busy={!!claiming[a.id]} onClaim={onClaim} wins={isOwn ? winCountFor(a, winCounts) : 0} />
          ))}
          {more > 0 && (
            <button
              type="button"
              onClick={onOpenAll}
              aria-label={`View All (+${more})`}
              title="View All"
              className="pf-press flex min-h-[104px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-500"
            >
              <span className="text-xl font-black tabular-nums">+{more}</span>
            </button>
          )}
        </div>
      )}
    </SectionCard>
  )
}

export default AchievementShelf
