import { memo, useEffect, useRef, useState } from 'react'
import { AlertCircle, Award, CheckCircle, ChevronRight } from 'lucide-react'
import { createPortal } from 'react-dom'
import { fmt, isImageLike, prefersReducedMotion } from '../profileUtils'

/** A number that counts up to its value (and on to a new value when it changes). */
export const CountUp = memo(function CountUp({ value, format = fmt, duration = 900 }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0))
  const shownRef = useRef(shown)

  useEffect(() => {
    const from = shownRef.current
    if (from === target) return undefined
    if (prefersReducedMotion()) {
      shownRef.current = target
      setShown(target)
      return undefined
    }
    let raf = 0
    const t0 = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)))
      shownRef.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return <span className="tabular-nums">{format(shown)}</span>
})

/** A level badge icon: a picture link or an emoji. A broken picture falls back to a plain medal. */
export const BadgeIcon = memo(function BadgeIcon({ icon, alt = '', locked = false, emojiClass = 'text-2xl' }) {
  const [failed, setFailed] = useState(null)
  const dim = locked ? 'opacity-40 grayscale' : ''
  if (icon && isImageLike(icon) && failed !== icon) {
    return (
      <img
        src={icon}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-contain ${dim}`}
        onError={() => setFailed(icon)}
      />
    )
  }
  if (icon && !isImageLike(icon)) {
    return (
      <span role="img" aria-label={alt} className={`leading-none ${emojiClass} ${dim}`}>
        {icon}
      </span>
    )
  }
  return <Award aria-label={alt} className={`h-[55%] w-[55%] ${locked ? 'text-slate-300' : 'text-amber-500'}`} />
})

/** A small round picture of the student (picture link, emoji or first letter), without the frame. */
export const MiniAvatar = memo(function MiniAvatar({ avatar, fallback = 'U', className = '' }) {
  const [failed, setFailed] = useState(null)
  const isUrl = typeof avatar === 'string' && avatar.startsWith('http') && failed !== avatar
  return (
    <span className={`flex items-center justify-center overflow-hidden rounded-full bg-sky-100 font-black text-sky-700 ${className}`}>
      {isUrl ? (
        <img src={avatar} alt="" draggable={false} className="h-full w-full object-cover" onError={() => setFailed(avatar)} />
      ) : (
        <span className="leading-none">{avatar && !String(avatar).startsWith('http') ? avatar : fallback}</span>
      )}
    </span>
  )
})

const TONES = {
  amber: 'from-amber-300 to-orange-400 shadow-orange-500/25',
  violet: 'from-violet-400 to-fuchsia-500 shadow-fuchsia-500/25',
  sky: 'from-sky-400 to-blue-500 shadow-blue-500/25',
  emerald: 'from-emerald-400 to-teal-500 shadow-teal-500/25',
}

/** A white card with an icon, a title and (optionally) a "count ›" button that opens the full list. */
export const SectionCard = ({ id, icon: Icon, tone = 'sky', title, count, extra, onMore, moreLabel = 'View All', index = 0, className = '', bodyClass = '', children }) => (
  <section className={`pf-card pf-rise ${className}`} style={{ '--i': index }} data-section={id}>
    <header className="flex items-center gap-2.5 px-4 pt-4 sm:px-5 sm:pt-5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-white shadow-md ${TONES[tone] || TONES.sky}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <h2 className="min-w-0 truncate text-[17px] font-black tracking-tight text-slate-800">{title}</h2>
      {extra}
      {onMore ? (
        <button
          type="button"
          onClick={onMore}
          aria-label={count != null ? `${moreLabel} (${count})` : moreLabel}
          title={moreLabel}
          data-more
          className="pf-press ml-auto flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-slate-100 pl-3 pr-1.5 text-sm font-black tabular-nums text-slate-600 hover:bg-slate-200"
        >
          {count}
          <ChevronRight className="h-4 w-4 text-slate-400" strokeWidth={3} />
        </button>
      ) : (
        count != null && <span className="ml-auto rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black tabular-nums text-slate-600">{count}</span>
      )}
    </header>
    <div className={`min-h-0 flex-1 p-4 sm:p-5 ${bodyClass}`}>{children}</div>
  </section>
)

export const EmptyNote = ({ icon: Icon, tone = 'bg-slate-100 text-slate-400', text, children }) => (
  <div className="flex flex-col items-center px-4 py-3 text-center">
    <div className={`mb-2.5 flex h-14 w-14 items-center justify-center rounded-3xl ${tone}`}>
      <Icon className="h-7 w-7" />
    </div>
    {text && <p className="text-sm font-extrabold text-slate-500">{text}</p>}
    {children}
  </div>
)

export const Skel = ({ className = '', style }) => <div aria-hidden="true" className={`pf-skel ${className}`} style={style} />

/** A short message near the bottom of the screen (claim errors). Sits above the open sheet and the phone bar. */
export const Toast = ({ message, good = false }) =>
  createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 lg:bottom-8" role="status" aria-live="polite">
      <div
        className={`pf-toast flex max-w-sm items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold text-white shadow-xl ${
          good ? 'bg-emerald-600 shadow-emerald-900/30' : 'bg-rose-600 shadow-rose-900/30'
        }`}
      >
        {good ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
        <span>{message}</span>
      </div>
    </div>,
    document.body
  )
