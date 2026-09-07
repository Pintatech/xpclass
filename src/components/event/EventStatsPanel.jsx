import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, RotateCcw, Swords } from 'lucide-react'
import EventCharacter from './EventCharacter'
import { MAX_LEVEL, STATS } from '../../config/eventStats'

const StatRow = ({ stat, base, total, spent, canBuy, onBuy, disabled }) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
    <span
      className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white"
      style={{ background: stat.color }}
    >
      {stat.short}
    </span>

    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-gray-700">{stat.label}</span>
        <span className="text-lg font-black tabular-nums text-gray-900">{total}</span>
        {spent > 0 && (
          <span className="text-xs font-semibold text-green-600">
            {base} +{total - base}
          </span>
        )}
      </div>
      <div className="text-[11px] text-gray-400">{stat.hint}</div>
    </div>

    <button
      onClick={() => onBuy(stat.key)}
      disabled={!canBuy || disabled}
      aria-label={`Tăng ${stat.label}`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
    >
      <Plus className="h-4 w-4" />
    </button>
  </div>
)

/**
 * The stat sheet: level, XP bar, and the three numbers with a button each to
 * pour an unspent point into. Character-specific — the title says whose sheet
 * this is, because switching in the picker switches builds, not skins.
 */
const EventStatsPanel = ({ character, stats, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { base } = stats.stats
  const totals = { hp: stats.stats.maxHp, atk: stats.stats.atk, def: stats.stats.def }
  const unspent = stats.availablePoints

  // Portalled to the body like the pet modals: the dashboard hero sits inside
  // HeroCarousel's translateX track, and a transformed ancestor becomes the
  // containing block for position:fixed — so inset-0 would size the overlay to
  // the carousel panel instead of the viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-r from-indigo-600 to-blue-500 px-5 pt-4 text-white">
          <div className="flex items-end justify-between gap-3">
            <div className="pb-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                Chỉ số nhân vật
              </div>
              <h2 className="text-xl font-bold leading-tight">{character.name}</h2>
              <div className="mt-1 flex items-center gap-2 text-xs opacity-90">
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold">
                  Cấp {stats.level}{stats.isMaxLevel && ' · Tối đa'}
                </span>
                {stats.battles > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Swords className="h-3 w-3" />
                    {stats.wins}/{stats.battles} trận thắng
                  </span>
                )}
              </div>
            </div>
            <EventCharacter config={character} scale={1.8} interactive={false} />
          </div>

          {/* XP toward the next level */}
          <div className="pb-4">
            <div className="h-2 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 transition-[width] duration-500"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] opacity-80">
              {stats.isMaxLevel
                ? `Đã đạt cấp tối đa (${MAX_LEVEL})`
                : `${stats.xpInLevel}/${stats.xpToNext} EXP tới cấp ${stats.level + 1}`}
            </div>
          </div>
        </div>

        <div className="space-y-2 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">
              {unspent > 0 ? (
                <span className="text-blue-600">Còn {unspent} điểm chưa dùng</span>
              ) : (
                'Đã dùng hết điểm'
              )}
            </span>
            {stats.usedPoints > 0 && (
              <button
                onClick={stats.resetPoints}
                disabled={stats.saving}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                Chia lại
              </button>
            )}
          </div>

          {STATS.map((stat) => (
            <StatRow
              key={stat.key}
              stat={stat}
              base={base[stat.key]}
              total={totals[stat.key]}
              spent={stats.spend[stat.key]}
              canBuy={unspent > 0}
              disabled={stats.saving || stats.loading}
              onBuy={stats.spendPoint}
            />
          ))}

          <p className="pt-1 text-center text-[11px] leading-relaxed text-gray-400">
            Mỗi cấp nhận 3 điểm. Thắng trận để lên cấp — mỗi nhân vật lên cấp riêng.
          </p>
        </div>

        <div className="flex justify-end border-t border-gray-100 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Xong
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EventStatsPanel
