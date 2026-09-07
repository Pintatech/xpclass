import { Children, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Slides between panels inside the hero banner. The banner's own background,
 * brackets and clip stay put — only the content moves, so the frame reads as
 * one surface with tabs rather than several separate cards.
 *
 * Controls sit bottom-right because the hero's other corners are taken: stats
 * along the top, greeting and character bottom-left.
 */
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
    setIndex((i) => (i + step + count) % count)
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
            {panel}
          </div>
        ))}
      </div>

      <div className="absolute bottom-2 right-3 z-30 flex items-center gap-1.5 md:right-4">
        <button
          onClick={() => go(-1)}
          aria-label="Xem trước"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {panels.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Trang ${i + 1}`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}

        <button
          onClick={() => go(1)}
          aria-label="Xem tiếp"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default HeroCarousel
