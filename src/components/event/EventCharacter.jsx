import { useCallback, useEffect, useRef, useState } from 'react'
import SpriteAnimation from '../ui/SpriteAnimation'
import { preloadSheets } from '../ui/spriteSheetCache'
import { DEFAULT_CHARACTER_ID, animationSrc, getCharacter, spriteMetrics } from '../../config/eventCharacter'

const HIT_WORDS = ['Chém!', 'Bùm!', 'Vút!', 'Chát!']

/**
 * Clickable event character: loops its idle sheet, and a click plays one
 * attack from the chain before handing control back to idle. Clicks during a
 * swing are ignored so the animation is never cut off mid-frame.
 */
const EventCharacter = ({
  config = getCharacter(DEFAULT_CHARACTER_ID),
  idleAnimation = 'idle',
  scale = 2,
  flip = false,
  interactive = true,
  onAttack,
  className = ''
}) => {
  const [action, setAction] = useState(idleAnimation)
  const [sparks, setSparks] = useState([])
  const chainRef = useRef(0)

  const attacking = action !== idleAnimation
  const { anim, src, renderScale, footPad, headTop, shiftX, shiftY } =
    spriteMetrics(config, action, scale, flip)

  // Fetch the sheets a click can switch to before it happens, so the swap is a
  // cache hit rather than a network round trip mid-swing.
  useEffect(() => {
    const chain = config.attackChain?.length ? config.attackChain : []
    preloadSheets([idleAnimation, ...chain].map((n) => animationSrc(config, n)))
  }, [config, idleAnimation])

  const strike = useCallback(() => {
    if (!interactive || attacking) return

    const chain = config.attackChain?.length ? config.attackChain : ['attack1']
    const next = chain[chainRef.current % chain.length]
    chainRef.current += 1
    setAction(next)

    const spark = { id: Date.now(), word: HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)] }
    setSparks((prev) => [...prev, spark])
    setTimeout(() => setSparks((prev) => prev.filter((s) => s.id !== spark.id)), 800)

    onAttack?.(next)
  }, [interactive, attacking, config, onAttack])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      strike()
    }
  }

  return (
    <div className={`relative inline-block select-none ${className}`}>
      {sparks.map((spark) => (
        <span
          key={spark.id}
          style={{ top: headTop - 18 }}
          className="animate-float-up pointer-events-none absolute left-1/2 z-10 whitespace-nowrap text-sm font-bold text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
        >
          {spark.word}
        </span>
      ))}

      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `${config.name} — bấm để tấn công` : config.name}
        onClick={strike}
        onKeyDown={handleKeyDown}
        style={{ marginBottom: -footPad }}
        className={`rounded transition-transform duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
          interactive ? 'cursor-pointer active:scale-95' : ''
        }`}
      >
        <div style={{ transform: shiftX || shiftY ? `translate(${shiftX}px, ${shiftY}px)` : undefined }}>
          <SpriteAnimation
            src={src}
            frameWidth={config.frameWidth}
            frameHeight={config.frameHeight}
            frameCount={anim?.frames}
            fps={anim?.fps || 10}
            loop={!attacking}
            scale={renderScale}
            flip={flip}
            smooth={config.smooth}
            onComplete={attacking ? () => setAction(idleAnimation) : undefined}
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}
          />
        </div>
      </div>
    </div>
  )
}

export default EventCharacter
