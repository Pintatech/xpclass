import { Target, Trophy } from 'lucide-react'
import { fmt } from '../profileUtils'
import { EmptyNote } from './bits'
import { BadgeMedal } from './LevelRoad'
import Sheet, { SheetGroup } from './Sheet'

const Group = (props) => <SheetGroup grid="grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-5" {...props} />

const Item = ({ badge, locked }) => (
  <div className="flex min-w-0 flex-col items-center text-center" title={badge.badge_description || badge.badge_name} data-badge={badge.id} data-locked={locked}>
    <BadgeMedal level={badge} locked={locked} />
    <div className={`mt-1.5 w-full truncate px-0.5 text-sm font-extrabold ${locked ? 'text-slate-400' : 'text-slate-700'}`}>{badge.badge_name}</div>
    <div className={`text-xs font-bold tabular-nums ${locked ? 'text-slate-400' : 'text-amber-600'}`}>{fmt(badge.xp_required)} XP</div>
  </div>
)

/** Every badge: the earned ones, then the ones still ahead with the XP they need. */
const BadgeSheet = ({ earned, upcoming, onClose }) => (
  <Sheet title="Badges" count={`${earned.length}/${earned.length + upcoming.length}`} onClose={onClose}>
    {earned.length > 0 && (
      <Group icon={Trophy} tone="bg-amber-100 text-amber-600" title="Earned" n={earned.length}>
        {earned.map((badge) => (
          <Item key={badge.id} badge={badge} />
        ))}
      </Group>
    )}
    {upcoming.length > 0 && (
      <Group icon={Target} tone="bg-slate-100 text-slate-500" title="Upcoming" n={upcoming.length}>
        {upcoming.map((badge) => (
          <Item key={badge.id} badge={badge} locked />
        ))}
      </Group>
    )}
    {earned.length === 0 && upcoming.length === 0 && (
      <EmptyNote icon={Trophy} text="No badges available">
        <p className="mt-1 text-xs font-semibold text-slate-400">Badge system is not configured yet.</p>
      </EmptyNote>
    )}
  </Sheet>
)

export default BadgeSheet
