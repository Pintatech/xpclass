import { useEffect, useReducer, useRef, useState } from 'react'
import { getSheetDims, hasSheetDims, setSheetDims } from './spriteSheetCache'

// Read straight from the cache during render rather than mirroring it into
// state. State would lag by a render on every src change, and that render
// would scale the new sheet using the old sheet's dimensions — painting a
// mangled slice of the new image for a frame.
const useSheetDims = (src) => {
  const [, bump] = useReducer((n) => n + 1, 0)

  useEffect(() => {
    if (!src || hasSheetDims(src)) return
    let cancelled = false
    const settle = (d) => {
      setSheetDims(src, d)
      if (!cancelled) bump()
    }
    const img = new Image()
    img.onload = () => settle({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => settle({ width: 0, height: 0, error: true })
    img.src = src
    return () => { cancelled = true }
  }, [src])

  return getSheetDims(src)
}

/**
 * Plays a sprite sheet by stepping the background position with rAF.
 * Frames are read left→right then top→bottom, so a single horizontal strip
 * and a multi-row grid both work. frameCount is optional — when omitted it
 * comes from the sheet's own dimensions.
 *
 * With loop={false} the last frame is held and onComplete fires once, which
 * is what lets a one-shot attack hand control back to the idle loop.
 *
 * reverse={true} walks the same frames backwards. A death sheet played that way
 * is an entrance: the monster assembles out of the empty frame it crumbled to,
 * and the held final frame is the one it stands up in.
 */
const SpriteAnimation = ({
  src,
  frameWidth,
  frameHeight,
  frameCount,
  fps = 12,
  loop = true,
  reverse = false,
  playing = true,
  scale = 1,
  flip = false,
  smooth = false,
  onComplete,
  className = '',
  style,
  ...rest
}) => {
  const dims = useSheetDims(src)
  const [frame, setFrame] = useState(0)
  const frameSrc = useRef(src)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  const cols = dims?.width ? Math.max(1, Math.floor(dims.width / frameWidth)) : 1
  const rows = dims?.height ? Math.max(1, Math.floor(dims.height / frameHeight)) : 1
  const total = Math.max(1, frameCount || cols * rows)

  useEffect(() => {
    frameSrc.current = src
    setFrame(0)
    if (!playing || !dims || dims.error || total <= 1) return

    let raf = 0
    let start = null
    let shown = -1

    const step = (now) => {
      if (start === null) start = now
      const i = Math.floor((now - start) / (1000 / fps))

      if (!loop && i >= total) {
        setFrame(total - 1)
        onCompleteRef.current?.()
        return
      }

      const next = loop ? i % total : i
      if (next !== shown) {
        shown = next
        setFrame(next)
      }
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [src, playing, loop, fps, total, dims])

  // The frame counter belongs to whichever sheet was playing when it was set.
  // On the render where src changes it is still the old sheet's index, which
  // would point at the wrong column of the new one.
  const safeFrame = frameSrc.current === src ? frame : 0

  const w = frameWidth * scale
  const h = frameHeight * scale
  // The counter always runs forwards; only the frame it points at is mirrored.
  const shownFrame = reverse ? total - 1 - safeFrame : safeFrame
  const col = shownFrame % cols
  const row = Math.floor(shownFrame / cols)
  const ready = dims && !dims.error

  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        backgroundImage: ready ? `url("${src}")` : undefined,
        backgroundSize: ready ? `${dims.width * scale}px ${dims.height * scale}px` : undefined,
        backgroundPosition: `${-col * w}px ${-row * h}px`,
        backgroundRepeat: 'no-repeat',
        // Nearest-neighbour keeps chunky sprites crisp when blown up, but it
        // drops whole rows unevenly when a sheet has to shrink — which shimmers
        // as the frames advance. Sheets drawn large opt into interpolation.
        imageRendering: smooth ? 'auto' : 'pixelated',
        transform: flip ? 'scaleX(-1)' : undefined,
        ...style
      }}
      {...rest}
    />
  )
}

export default SpriteAnimation
