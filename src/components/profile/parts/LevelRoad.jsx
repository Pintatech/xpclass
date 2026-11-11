import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Trophy } from 'lucide-react'
import { TIERS, fmt, prefersReducedMotion, roadFraction } from '../profileUtils'
import { BadgeIcon, EmptyNote, MiniAvatar, SectionCard, Skel } from './bits'

/** One level badge: a tier-coloured rim around the icon, grey with a lock while it is still ahead. */
export const BadgeMedal = memo(function BadgeMedal({ level, locked = false, size = 'md', now = false }) {
  const t = TIERS[level.badge_tier]
  const box = size === 'lg' ? 'h-[68px] w-[68px] p-[5px]' : 'h-14 w-14 p-1'
  return (
    <span
      className={`pf-medal ${box} ${locked ? 'bg-slate-200' : `bg-gradient-to-b shadow-md ${t?.solid || 'from-sky-300 to-blue-500'}`} ${now ? 'pf-medal-now' : ''}`}
    >
      <span
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full p-1.5 ${
          locked ? 'bg-slate-50' : `bg-gradient-to-b ${t?.plate || 'from-sky-50 to-sky-100'}`
        }`}
      >
        <BadgeIcon icon={level.badge_icon} alt={level.badge_name} locked={locked} emojiClass={size === 'lg' ? 'text-3xl' : 'text-2xl'} />
      </span>
      {locked && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-white ring-2 ring-white">
          <Lock className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}
    </span>
  )
})

/**
 * Badges as a road: every level in order, the earned ones in colour, the student's picture standing on the current
 * one, and the road filled up to where their XP has taken them. Swipe (or drag, or use the arrows) to look ahead.
 */
const LevelRoad = ({ earned, upcoming, xp, avatar, fallback, ready, onOpenAll, index, className = '' }) => {
  const levels = useMemo(() => [...earned, ...upcoming], [earned, upcoming])
  const scroller = useRef(null)
  const nowRef = useRef(null)
  const drag = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const current = earned[earned.length - 1] || null
  const next = upcoming[0] || null
  const fraction = roadFraction(xp, current, next)

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }))
  }, [])

  // Open with the current level in the middle. Only the road moves, never the page.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const node = nowRef.current || el.querySelector('[data-next="true"]')
    if (node) el.scrollLeft = node.offsetLeft - el.clientWidth / 2 + node.offsetWidth / 2
    measure()
  }, [levels.length, earned.length, ready, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const nudge = (dir) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(184, el.clientWidth * 0.7), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  // Mouse: grab the road and pull it sideways (touch screens scroll it natively).
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { x: e.clientX, left: scroller.current.scrollLeft, id: e.pointerId, moved: false }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    const el = scroller.current
    if (!d || !el || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true
      el.dataset.drag = 'true'
      el.setPointerCapture?.(e.pointerId)
    }
    if (d.moved) el.scrollLeft = d.left - dx
  }
  const endDrag = () => {
    drag.current = null
    if (scroller.current) delete scroller.current.dataset.drag
  }

  return (
    <SectionCard
      id="badges"
      icon={Trophy}
      tone="amber"
      title="Badges"
      count={ready ? `${earned.length}/${levels.length}` : null}
      onMore={onOpenAll}
      index={index}
      className={className}
      bodyClass="flex flex-col justify-center !pt-1"
    >
      {!ready ? (
        <div className="flex gap-5 overflow-hidden px-2 pb-1 pt-8">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex shrink-0 flex-col items-center gap-2">
              <Skel className="h-14 w-14 rounded-full" />
              <Skel className="h-3 w-14 rounded-full" />
            </div>
          ))}
        </div>
      ) : levels.length === 0 ? (
        <EmptyNote icon={Trophy} text="No badges available" />
      ) : (
        <div className="relative -mx-4 sm:-mx-5">
          <div
            ref={scroller}
            className="pf-road pf-noselect relative cursor-grab"
            onScroll={measure}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <ol className="flex w-max px-5 pb-1 pt-8">
              {levels.map((lv, i) => {
                const isEarned = i < earned.length
                const isNow = i === earned.length - 1
                const isNext = i === earned.length
                return (
                  <li
                    key={lv.id}
                    ref={isNow ? nowRef : undefined}
                    data-next={isNext || undefined}
                    data-state={isNow ? 'now' : isEarned ? 'earned' : 'locked'}
                    className="pf-node"
                    title={lv.badge_description || lv.badge_name}
                  >
                    {i > 0 && <span className="pf-link" data-full={isEarned || undefined} style={{ '--fill': isEarned ? 1 : isNext ? fraction : 0 }} />}
                    <div className="pf-node-top">
                      {isNow && (
                        <span className="pf-pin">
                          <MiniAvatar avatar={avatar} fallback={fallback} className="h-7 w-7 text-sm shadow-md ring-2 ring-white" />
                        </span>
                      )}
                      <BadgeMedal level={lv} locked={!isEarned} size={isNow ? 'lg' : 'md'} now={isNow} />
                    </div>
                    <div className={`mt-1 w-full truncate px-1 text-xs font-extrabold ${isEarned ? 'text-slate-700' : 'text-slate-400'}`}>{lv.badge_name}</div>
                    <div className={`text-[11px] font-bold tabular-nums ${isEarned ? 'text-amber-600' : 'text-slate-400'}`}>{fmt(lv.xp_required)} XP</div>
                  </li>
                )
              })}
            </ol>
          </div>
          <button type="button" className="pf-road-arrow left-2" onClick={() => nudge(-1)} disabled={!edges.left} aria-label="Previous badges" tabIndex={edges.left ? 0 : -1}>
            <ChevronLeft className="h-5 w-5" strokeWidth={3} />
          </button>
          <button type="button" className="pf-road-arrow right-2" onClick={() => nudge(1)} disabled={!edges.right} aria-label="Next badges" tabIndex={edges.right ? 0 : -1}>
            <ChevronRight className="h-5 w-5" strokeWidth={3} />
          </button>
        </div>
      )}
    </SectionCard>
  )
}

export default LevelRoad
