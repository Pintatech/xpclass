import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SkipForward } from 'lucide-react'

/**
 * The clip that plays before a fight, if the monster brings one.
 *
 * It is a doorway, not a gate: the whole thing can be skipped, and it hands over
 * to the battle either way. Nothing about the fight is decided here, so there is
 * nothing to gain by sitting through it and nothing to lose by cutting it short
 * — see monsterIntro in eventMonsters.js for where the file comes from.
 *
 * Skipping is the BUTTON and nothing else: not a tap on the screen, not a key.
 * A child watching a cutscene on a phone rests their thumb on it, and a clip
 * that vanished at the first stray touch would be missed rather than skipped.
 *
 * It is mounted BEFORE EventBattle rather than over it, which is the point of
 * the extra component: the battle starts both fighters' entrance animations on
 * mount, on timers, so a clip playing over the arena would eat the arrival it
 * was meant to introduce.
 */

/**
 * How long the clip gets to start before the fight opens without it.
 *
 * A cutscene that never loads must not be a locked door — a black screen with
 * a skip button is still a black screen, and the student came here to fight.
 * This is "something has gone wrong" rather than "long enough": once a frame
 * has played the watchdog is off, and a long clip runs as long as it likes.
 */
const START_TIMEOUT = 6000

const EventCutscene = ({ src, poster, onDone }) => {
  const videoRef = useRef(null)
  // Guards against handing over twice — ended firing after a skip, the watchdog
  // firing on a clip that was already skipped — which would open a battle the
  // dashboard has already closed the cutscene for.
  const doneRef = useRef(false)
  // Set when the browser refuses to play with sound. The clip still plays; the
  // student is told why it is silent, and one tap gets the sound back.
  const [muted, setMuted] = useState(false)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }, [onDone])

  // Autoplay policies turn on whether the browser counts a gesture recently
  // enough, and the fight button was several awaited queries ago. So: ask for
  // sound, and settle for a muted clip rather than no clip if that is refused.
  // If even muted playback is refused there is nothing to watch, so go to the
  // fight.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.play().catch(() => {
      el.muted = true
      setMuted(true)
      el.play().catch(finish)
    })
  }, [finish])

  useEffect(() => {
    const t = setTimeout(() => {
      // Only a clip that has not managed a single frame is given up on.
      if (!videoRef.current || videoRef.current.currentTime === 0) finish()
    }, START_TIMEOUT)
    return () => clearTimeout(t)
  }, [finish])

  const unmute = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = false
    setMuted(false)
    el.play().catch(() => {})
  }

  return createPortal(
    <div className="animate-scene-fade fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      {/* Contained rather than cropped: a cutscene is composed, and filling a
          phone's screen with it would cut the composition in half. */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        autoPlay
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="max-h-full max-w-full"
      />

      {muted && (
        <button
          onClick={unmute}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/25"
        >
          🔇 Bật tiếng
        </button>
      )}

      {/* Deliberately plain and always there, not a control that fades in on
          hover: a child who wants to get on with the fight should not have to
          find it. */}
      <button
        onClick={finish}
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-black/70"
      >
        Bỏ qua
        <SkipForward className="h-4 w-4" />
      </button>
    </div>,
    document.body
  )
}

export default EventCutscene
