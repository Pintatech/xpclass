import { Award, Check, Lock, Target, Trophy } from 'lucide-react'
import { claimableFirst, hasReward, winCountFor } from '../profileUtils'
import { EmptyNote } from './bits'
import { AchievementArt, ClaimButton, RewardChips, WinCount } from './AchievementShelf'
import Sheet, { SheetGroup } from './Sheet'

const Group = (props) => <SheetGroup grid="grid-cols-1 gap-2 sm:grid-cols-2" {...props} />

const Row = ({ a, locked, isOwn, busy, onClaim, wins }) => {
  const canClaim = !locked && !a.isClaimed && isOwn && hasReward(a)
  return (
    <div
      data-achievement={a.id}
      data-locked={locked || undefined}
      className={`flex items-center gap-3 rounded-2xl p-2.5 ${canClaim ? 'pf-ready' : locked ? 'bg-slate-50 ring-1 ring-inset ring-slate-100' : 'bg-white ring-1 ring-inset ring-slate-200'}`}
    >
      <div className="relative h-14 w-14 shrink-0">
        {!locked && <span className="pf-medal-glow" />}
        <AchievementArt a={a} locked={locked} emojiClass="text-3xl" />
        {locked && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-white ring-2 ring-white">
            <Lock className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
        {!locked && wins > 0 && <WinCount n={wins} className="absolute -right-1.5 -top-1" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-extrabold ${locked ? 'text-slate-500' : 'text-slate-800'}`}>{a.title}</div>
        {a.description && <div className={`line-clamp-2 text-xs font-semibold leading-4 ${locked ? 'text-slate-400' : 'text-slate-500'}`}>{a.description}</div>}
        {(locked || canClaim) && <RewardChips a={a} muted={locked} className="mt-1" />}
        {!locked && a.isClaimed && (
          <div className="mt-1 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600">
            <Check className="h-3.5 w-3.5" strokeWidth={4} />
            Đã nhận
          </div>
        )}
      </div>
      {canClaim && <ClaimButton a={a} busy={busy} onClaim={onClaim} className="shrink-0" />}
    </div>
  )
}

/**
 * Every achievement: the unlocked ones (rewards still waiting first), then the ones not reached yet. The win
 * counts of daily challenge medals belong to the logged-in student, so they only show on their own profile.
 */
const AchievementSheet = ({ achievements, isOwn, claiming, onClaim, winCounts, onClose }) => {
  const unlocked = claimableFirst(
    achievements.filter((a) => a.isUnlocked),
    isOwn
  )
  const locked = achievements.filter((a) => !a.isUnlocked)

  return (
    <Sheet title="Achievements" count={`${unlocked.length}/${achievements.length}`} size="lg" onClose={onClose}>
      {unlocked.length > 0 ? (
        <Group icon={Trophy} tone="bg-violet-100 text-violet-600" title="Đã đạt được" n={unlocked.length}>
          {unlocked.map((a) => (
            <Row key={a.id} a={a} isOwn={isOwn} busy={!!claiming[a.id]} onClaim={onClaim} wins={isOwn ? winCountFor(a, winCounts) : 0} />
          ))}
        </Group>
      ) : (
        <EmptyNote icon={Award} tone="bg-violet-50 text-violet-300" text="No achievements unlocked yet">
          <p className="mt-1 text-xs font-semibold text-slate-400">Keep learning to unlock your first achievement!</p>
        </EmptyNote>
      )}
      {locked.length > 0 && (
        <Group icon={Target} tone="bg-slate-100 text-slate-500" title="Chưa đạt được" n={locked.length}>
          {locked.map((a) => (
            <Row key={a.id} a={a} locked />
          ))}
        </Group>
      )}
    </Sheet>
  )
}

export default AchievementSheet
