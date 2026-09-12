import confetti from 'canvas-confetti'

import { assetUrl } from '../hooks/useBranding'

// Over everything. The canvas is fixed, pointer-events: none and appended to the body, so
// nothing is occluded or blocked by putting it on top -- and anything lower is a burst that
// fires correctly and is never seen: the event overlays are z-[9999] and the pet catch screen
// is z-[99999]. A number that merely clears today's modals is a trap for whoever adds one.
const Z_INDEX = 100000

const SOUND_URL = assetUrl('/sound/pet-caught.mp3')
// Under the top: this lands over a screen that may already be making noise, and a fanfare
// that makes a child reach for the volume is one they turn off for good.
const VOLUME = 0.6

// One element for the whole session, so a second celebration restarts the clip rather than
// layering another copy over the first, and the file is only fetched once.
let sound = null

const load = () => {
  if (!sound) {
    sound = new Audio(SOUND_URL)
    sound.volume = VOLUME
  }
  return sound
}

/**
 * Warms the clip so the first celebration of a session does not open with a fetch.
 *
 * Worth calling wherever a win is foreseeable -- a battle knows at its first frame that it
 * might be won -- and harmless everywhere else.
 */
export function primeCelebration() {
  try {
    load().preload = 'auto'
  } catch {
    // No audio support at all -- nothing to warm.
  }
}

// Never a reason to interrupt anything: a browser that refuses to play unprompted, or a file
// that will not load, leaves the celebration silent rather than throwing into the caller.
function playSound() {
  try {
    const audio = load()
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {
    // No audio support at all -- nothing to do about it.
  }
}

/**
 * What answers finishing something: the sound, and a layered volley of confetti -- a wide
 * spray, two side cannons half a second later, then one heavy fall from the top.
 *
 * Called straight from the moment of finishing rather than rendered from state: there is
 * nothing to mount, nothing to unmount, and no component that has to stay on screen for the
 * paper to keep falling.
 *
 * A learner who asked for less motion still hears it. Motion is what they turned down, and a
 * silent finish would leave them with no sign they had finished at all.
 */
export function celebrate() {
  playSound()
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const count = 400
  const defaults = { origin: { y: 0.7 }, zIndex: Z_INDEX }

  // opts LAST. Each call below is a different shape of throw -- a tight fast jet, a slow fat
  // puff -- and the variety between them is the whole reason this reads as confetti rather
  // than one pop. Pinning spread or startVelocity after the spread here would flatten every
  // call onto the same numbers and quietly undo that.
  const fire = (particleRatio, opts) => {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    })
  }

  fire(0.25, { spread: 26, startVelocity: 55 })
  fire(0.2, { spread: 60 })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  fire(0.1, { spread: 120, startVelocity: 45 })

  setTimeout(() => {
    confetti({ particleCount: 100, angle: 60, spread: 55, origin: { x: 0, y: 0.6 }, zIndex: Z_INDEX })
    confetti({ particleCount: 100, angle: 120, spread: 55, origin: { x: 1, y: 0.6 }, zIndex: Z_INDEX })
  }, 500)

  setTimeout(() => {
    confetti({ particleCount: 150, spread: 180, origin: { y: 0.3 }, zIndex: Z_INDEX, startVelocity: 45, gravity: 1.5 })
  }, 1000)
}
