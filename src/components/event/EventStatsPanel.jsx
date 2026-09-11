import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import EventCharacter from './EventCharacter'
import { HERO_ATK, HERO_LIVES, LADDER_DAYS, MAX_LEVEL, monsterHpFor } from '../../config/eventLadder'

/* Angular cuts, the same language the dashboard banner and the battle's
   question tray are cut with — this window is the third in that set, so it is
   built out of the same corners rather than a rounded card. */
const CLIP_PANEL = 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)'
const CLIP_CHIP = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)'

/**
 * An outer glow for something cut with a clip-path.
 *
 * clip-path clips the element's own box-shadow away along with everything else
 * outside the shape, so the glow has to be drawn by a parent that isn't
 * clipped. drop-shadow is what that parent uses: it follows the child's cut
 * silhouette, where box-shadow would trace a rectangle around it.
 */
const Glow = ({ color, className = '', children }) => (
  <span className={`inline-flex ${className}`} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
    {children}
  </span>
)

/** The cyan hairline corners that mark this as a system window. */
const Brackets = () => (
  <>
    <div className="pointer-events-none absolute left-[18px] top-0 h-[1px] w-8 bg-gradient-to-r from-cyan-300/70 to-transparent" />
    <div className="pointer-events-none absolute left-0 top-[18px] h-8 w-[1px] bg-gradient-to-b from-cyan-300/70 to-transparent" />
    <div className="pointer-events-none absolute bottom-0 right-[18px] h-[1px] w-8 bg-gradient-to-l from-cyan-300/70 to-transparent" />
    <div className="pointer-events-none absolute bottom-[18px] right-0 h-8 w-[1px] bg-gradient-to-t from-cyan-300/70 to-transparent" />
  </>
)

/**
 * The character window: who you are fighting as, how far up the ladder you are,
 * and the two rules of every fight.
 *
 * This was a stat sheet — three buyable numbers, a point budget, an XP bar. All
 * of it is gone. Every student fights with the same three lives and the same one
 * damage, and the only thing that changes across the week is how many right
 * answers the day's monster takes. So there is nothing here to spend and nothing
 * to optimise; what is left is a window that tells a student exactly what they
 * are walking into.
 */
const EventStatsPanel = ({ character, level = 1, clears = 0, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isMaxLevel = level >= MAX_LEVEL
  // The day the ladder is pointing at, which is the fight this window is
  // describing: the one after everything already beaten, or the last one once
  // the week is done.
  const nextDay = Math.min(LADDER_DAYS, clears + 1)

  // Portalled to the body like the pet modals: the dashboard hero sits inside
  // HeroCarousel's translateX track, and a transformed ancestor becomes the
  // containing block for position:fixed — so inset-0 would size the overlay to
  // the carousel panel instead of the viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* The pulsing halo sits on this wrapper rather than the panel: the
          panel's clip-path would clip its own glow away. */}
      <div className="sl-glow-drop w-full max-w-md">
        <div
          className="sl-card-enter relative w-full border border-cyan-400/30 bg-gradient-to-b from-slate-900 to-slate-950"
          style={{ clipPath: CLIP_PANEL }}
          onClick={(e) => e.stopPropagation()}
        >
          <Brackets />

          {/* A single line sweeping the window, the way a scanner would. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="sl-scan absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
          </div>

          {/* ── Header: who this window belongs to ── */}
          <div className="relative px-5 pt-5">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 80% at 80% 0%, rgba(34,211,238,0.18), transparent 60%)'
              }}
            />

            <div className="relative">
              <div className="sl-header-enter sl-flicker text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300">
                Nhân vật
              </div>

              <div className="mt-1 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black leading-tight tracking-wide text-white drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]">
                    {character.name}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Glow color="rgba(34,211,238,0.6)">
                      <span
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white"
                        style={{ clipPath: CLIP_CHIP }}
                      >
                        Cấp {level}
                        {isMaxLevel && ' · Tối đa'}
                      </span>
                    </Glow>
                  </div>
                </div>

                {/* The fighter, lit from below on a disc of its own light. */}
                <div className="relative flex h-24 w-28 shrink-0 items-end justify-center">
                  <div
                    className="pointer-events-none absolute bottom-0 h-8 w-24"
                    style={{
                      background:
                        'radial-gradient(ellipse at center, rgba(34,211,238,0.45), transparent 70%)'
                    }}
                  />
                  <EventCharacter config={character} scale={2} interactive={false} />
                </div>
              </div>
            </div>
          </div>

          {/* ── The monsters this level is made of ── */}
          <div className="relative px-5 pb-4 pt-3">
            <div className="mb-1 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-slate-400">Quái đã hạ</span>
              <span className="tabular-nums text-cyan-300">{clears} / {LADDER_DAYS}</span>
            </div>
            <div className="relative h-2.5 overflow-hidden bg-black/60 ring-1 ring-inset ring-cyan-400/25">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300 transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.min(100, Math.round((clears / LADDER_DAYS) * 100))}%`,
                  boxShadow: '0 0 14px rgba(56,189,248,0.8)'
                }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {isMaxLevel
                ? 'Đã hạ hết quái của sự kiện.'
                : `Hạ một quái mới để lên cấp ${level + 1}. Đánh lại quái cũ không lên cấp.`}
            </div>
          </div>

          {/* ── The two rules of every fight ──
              Not stats: nobody can change these, which is exactly the thing
              worth saying. They sit here so a student knows what they are
              walking into before the arena opens. */}
          <div className="relative mx-5 mb-4 grid grid-cols-2 gap-2">
            {[
              {
                icon: '/event/icon/heart.png',
                label: 'Mạng',
                value: HERO_LIVES,
                hint: 'Sai một câu mất một mạng'
              },
              {
                icon: '/event/icon/sword.png',
                label: 'Sát thương',
                value: HERO_ATK,
                hint: `Quái sắp tới cần ${monsterHpFor(nextDay)} câu đúng`
              }
            ].map((rule) => (
              <div
                key={rule.label}
                className="flex items-center gap-2.5 border border-white/10 bg-white/[0.04] px-3 py-2.5"
                style={{ clipPath: CLIP_CHIP }}
              >
                <img src={rule.icon} alt="" className="h-7 w-7 shrink-0 object-contain" />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black leading-none text-white">{rule.value}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      {rule.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{rule.hint}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="relative flex justify-end border-t border-white/10 px-5 py-3">
            <Glow color="rgba(34,211,238,0.55)">
              <button
                onClick={onClose}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2 text-sm font-black uppercase tracking-widest text-white transition-transform hover:scale-105 active:scale-95"
                style={{ clipPath: CLIP_CHIP }}
              >
                Xong
              </button>
            </Glow>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EventStatsPanel
