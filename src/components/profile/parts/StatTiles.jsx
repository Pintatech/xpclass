import { assetUrl } from '../../../hooks/useBranding'
import { CountUp } from './bits'

// Drawn here in the flat style of the app's own stat icons (there is no clock among them).
const StopwatchIcon = ({ className = '' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <rect x="20" y="2" width="8" height="7" rx="2.5" fill="#0f766e" />
    <rect x="36.5" y="8.5" width="6" height="5" rx="2" transform="rotate(45 39.5 11)" fill="#0f766e" />
    <circle cx="24" cy="27" r="19" fill="#34d399" />
    <circle cx="24" cy="27" r="14.5" fill="#f0fdfa" />
    <path d="M24 17.5V27l6.5 4" fill="none" stroke="#0f766e" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="27" r="2.4" fill="#0f766e" />
  </svg>
)

/**
 * The four numbers under the hero card: finished exercises, day streak, average score, time spent learning.
 * The long labels of the old page stay as tooltips. A long value ("100h 59m") shrinks to fit its tile (--chars).
 */
const StatTiles = ({ stats, formatPracticeTime }) => {
  const tiles = [
    {
      key: 'exercises',
      icon: assetUrl('/icon/profile/paper.svg'),
      tint: '#e0f2fe',
      label: 'Bài tập',
      full: 'Bài tập hoàn thành',
      value: stats.exercisesCompleted,
      text: String(stats.exercisesCompleted),
    },
    {
      key: 'streak',
      icon: assetUrl('/icon/profile/streak.svg'),
      tint: '#ffedd5',
      label: 'Chuỗi ngày',
      full: 'Chuỗi ngày học',
      value: stats.streakCount,
      text: String(stats.streakCount),
    },
    {
      key: 'score',
      icon: assetUrl('/icon/profile/score%20metric.svg'),
      tint: '#ede9fe',
      label: 'Điểm TB',
      full: 'Điểm trung bình',
      value: stats.averageScore,
      format: (n) => `${n}%`,
      text: `${stats.averageScore}%`,
    },
    {
      key: 'time',
      tint: '#d1fae5',
      label: 'Đã học',
      full: 'Tổng thời gian luyện tập',
      value: stats.totalPracticeTime,
      format: formatPracticeTime,
      text: formatPracticeTime(stats.totalPracticeTime),
    },
  ]

  return (
    <div className="pf-tiles">
      {tiles.map((t, i) => (
        <div
          key={t.key}
          data-stat={t.key}
          className="pf-tile pf-rise"
          style={{ '--i': 1 + i * 0.6, '--pf-tint': t.tint, '--chars': Math.max(2, t.text.length) }}
          title={t.full}
          aria-label={`${t.full}: ${t.text}`}
        >
          <div className="pf-tile-in">
            <span className="pf-tile-icon">
              {t.icon ? (
                <img src={t.icon} alt="" className={`h-full w-full ${t.key === 'streak' && t.value > 0 ? 'pf-flame' : ''}`} />
              ) : (
                <StopwatchIcon className="h-full w-full" />
              )}
            </span>
            <div className="min-w-0" aria-hidden="true">
              <div className="pf-tile-value truncate font-black text-slate-800">
                <CountUp value={t.value} format={t.format} />
              </div>
              <div className="truncate text-xs font-bold text-slate-500">{t.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatTiles
