import { Children, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PanelContext } from './panelContext'

/**
 * Slides between panels inside the hero banner. The banner's own background,
 * brackets and clip stay put — only the content moves, so the frame reads as
 * one surface with tabs rather than several separate cards.
 *
 * An arrow halfway down each side, and they stop at the ends rather than
 * wrapping: the whole ladder is a panel per day now, and coming off the last
 * one by wrapping would sweep the entire strip past in one slide. The corners
 * are all taken anyway — stats along the top, greeting and character
 * bottom-left, the event monster bottom-right.
 */
// Faded rather than hidden at the ends, so the pair stays put instead of one
// of them vanishing and the other appearing to move.
const ARROW =
  'absolute top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full ' +
  'bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/60 ' +
  'disabled:pointer-events-none disabled:opacity-25'

const HeroCarousel = ({ children, className = '' }) => {
  const panels = Children.toArray(children).filter(Boolean)
  const [index, setIndex] = useState(0)
  const count = panels.length

  // A panel can disappear (a character gets removed, an event ends) while a
  // later one is showing.
  useEffect(() => {
    if (index > count - 1) setIndex(0)
  }, [index, count])

  const go = useCallback((step) => {
    setIndex((i) => Math.min(count - 1, Math.max(0, i + step)))
  }, [count])

  if (count === 0) return null
  if (count === 1) return <div className={`absolute inset-0 ${className}`}>{panels[0]}</div>

  return (
    <div className={`absolute inset-0 ${className}`}>
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          width: `${count * 100}%`,
          transform: `translateX(-${index * (100 / count)}%)`
        }}
      >
        {panels.map((panel, i) => (
          <div
            key={i}
            className="relative h-full"
            style={{ width: `${100 / count}%` }}
            // Panels that have scrolled away shouldn't be tabbable or clickable.
            aria-hidden={i !== index}
            inert={i !== index ? '' : undefined}
          >
            <PanelBoundary active={i === index} near={Math.abs(i - index) <= 1}>
              {panel}
            </PanelBoundary>
          </div>
        ))}
      </div>

      <button
        onClick={() => go(-1)}
        disabled={index === 0}
        aria-label={`Xem trước (${index + 1}/${count})`}
        className={`${ARROW} left-3 md:left-4`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        onClick={() => go(1)}
        disabled={index === count - 1}
        aria-label={`Xem tiếp (${index + 1}/${count})`}
        className={`${ARROW} right-3 md:right-4`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

/** Holds one panel's visibility in context, memoised so it only changes on a slide. */
const PanelBoundary = ({ active, near, children }) => {
  const value = useMemo(() => ({ active, near }), [active, near])
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
}

export default HeroCarousel
