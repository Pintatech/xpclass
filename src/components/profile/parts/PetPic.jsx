import { memo, useState } from 'react'
import { petImage, thumbUrl } from '../../pet/home/petHomeUtils'

// The old page's stand-in when a pet has no picture.
const EMOJI = { legendary: '🐉', epic: '🦅', rare: '🦊', uncommon: '🐱' }

/**
 * A pet picture (its evolved form when it has one). Asks Supabase Storage for a small copy first, then the original
 * file, then falls back to an emoji. `mystery` hides a pet the viewer does not own yet: only its outline shows.
 */
const PetPic = memo(function PetPic({ up, size, alt = '', className = '', style, emojiClass = 'text-3xl', mystery = false, mysteryStyle }) {
  const src = petImage(up)
  const [tried, setTried] = useState({ src, step: 0 }) // step 0 = small copy, 1 = original file, 2 = no picture
  const step = tried.src === src ? tried.step : 0
  const small = thumbUrl(src, size)

  if (!src || step === 2) {
    return (
      <span className={`select-none leading-none ${emojiClass} ${mystery ? 'brightness-50 grayscale filter' : ''}`}>
        {EMOJI[up?.pet?.rarity] || '🐶'}
      </span>
    )
  }
  return (
    <img
      src={step === 0 ? small : src}
      alt={alt}
      draggable={false}
      decoding="async"
      className={`pointer-events-none select-none ${className}`}
      style={mystery ? { ...style, ...(mysteryStyle || { filter: 'brightness(0)' }) } : style}
      onError={() => setTried({ src, step: step === 0 && small !== src ? 1 : 2 })}
    />
  )
})

export default PetPic
