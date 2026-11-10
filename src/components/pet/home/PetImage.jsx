import React, { memo, useState } from 'react'
import { thumbUrl } from './petHomeUtils'

const block = (e) => e.preventDefault()

/**
 * A pet picture that asks Supabase Storage for a smaller copy (`size` px box) and falls back to the original file
 * if that copy fails (other host, plan without image resizing, odd format).
 */
const PetImage = memo(function PetImage({ src, size, alt = '', className = '', style, eager = false, silhouette = false }) {
  const [failedSrc, setFailedSrc] = useState(null)
  if (!src) return null
  const url = failedSrc === src || !size ? src : thumbUrl(src, size)
  return (
    <img
      src={url}
      alt={alt}
      className={`select-none ${className}`}
      style={silhouette ? { ...style, filter: 'brightness(0)', opacity: 0.55 } : style}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onContextMenu={block}
      onError={() => {
        if (failedSrc !== src && url !== src) setFailedSrc(src)
      }}
    />
  )
})

export default PetImage
