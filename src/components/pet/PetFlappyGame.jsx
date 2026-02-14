import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy } from 'lucide-react'

// Physics
const GRAVITY = 0.45
const JUMP_VELOCITY = -7.5
const MAX_FALL_SPEED = 10

// Pipes
const PIPE_WIDTH = 56
const PIPE_GAP = 140
const PIPE_SPEED_START = 2.5
const PIPE_SPEED_MAX = 4.5
const PIPE_SPAWN_DISTANCE = 155

// Pet
const PET_SIZE = 40
const PET_X_PERCENT = 0.22

const PetFlappyGame = ({ petImageUrl, petName, onGameEnd, onClose }) => {
  const [phase, setPhase] = useState('ready') // 'ready' | 'playing' | 'results'
  const [displayScore, setDisplayScore] = useState(0)
  const [renderTick, setRenderTick] = useState(0)

  const gameAreaRef = useRef(null)
  const animFrameRef = useRef(null)
  const lastFrameTimeRef = useRef(0)
  const frameCountRef = useRef(0)

  // Game state refs
  const petYRef = useRef(0)
  const petVelocityRef = useRef(0)
  const petRotationRef = useRef(0)
  const pipesRef = useRef([])
  const scoreRef = useRef(0)
  const gameOverRef = useRef(false)
  const nextPipeIdRef = useRef(0)
  const distanceSinceLastPipeRef = useRef(0)
  const lastGapYRef = useRef(0.5) // normalized, tracks previous pipe gap for smooth transitions
  const gameStartTimeRef = useRef(0)
  const flashRef = useRef(false)
  const dyingRef = useRef(false)

  // Flap / jump
  const flap = useCallback(() => {
    if (gameOverRef.current || dyingRef.current) return
    petVelocityRef.current = JUMP_VELOCITY
    // Play flap sound
    try {
      const sound = new Audio('https://xpclass.vn/xpclass/sound/flappy-wing.mp3')
      sound.volume = 0.3
      sound.play().catch(() => {})
    } catch {}
  }, [])

  // Handle tap/click
  const handleInteraction = useCallback((e) => {
    e.preventDefault()
    if (phase === 'ready') {
      setPhase('playing')
      return
    }
    if (phase === 'playing') {
      flap()
    }
  }, [phase, flap])

  // Spawn a pipe - constrained so consecutive gaps are always reachable
  const spawnPipe = useCallback((gameHeight) => {
    const minGapY = (PIPE_GAP / 2 + 40) / gameHeight // normalized min
    const maxGapY = (gameHeight - PIPE_GAP / 2 - 60) / gameHeight // normalized max
    const maxShift = 0.18 // max vertical shift between consecutive pipes (~18% of screen)

    const lastGap = lastGapYRef.current
    const lo = Math.max(minGapY, lastGap - maxShift)
    const hi = Math.min(maxGapY, lastGap + maxShift)
    const gapYNorm = lo + Math.random() * (hi - lo)

    lastGapYRef.current = gapYNorm

    return {
      id: nextPipeIdRef.current++,
      x: 1.05, // normalized, starts just off right edge
      gapY: gapYNorm,
      passed: false,
    }
  }, [])

  // Main game loop
  useEffect(() => {
    if (phase !== 'playing') return

    const gameArea = gameAreaRef.current
    if (!gameArea) return

    const gameWidth = gameArea.clientWidth
    const gameHeight = gameArea.clientHeight

    // Initialize
    petYRef.current = 0.45 // normalized center-ish
    petVelocityRef.current = JUMP_VELOCITY * 0.6 // small initial jump
    petRotationRef.current = 0
    scoreRef.current = 0
    gameOverRef.current = false
    dyingRef.current = false
    lastGapYRef.current = 0.45 // start gaps near center
    // Pre-spawn pipes across the screen so action starts immediately
    const spacing = PIPE_SPAWN_DISTANCE / gameWidth
    const startX = 0.85
    const preSpawned = []
    for (let x = startX; x < 1.15; x += spacing) {
      const pipe = spawnPipe(gameHeight)
      pipe.x = x
      preSpawned.push(pipe)
    }
    pipesRef.current = preSpawned
    distanceSinceLastPipeRef.current = 0
    gameStartTimeRef.current = performance.now()
    flashRef.current = false
    setDisplayScore(0)

    lastFrameTimeRef.current = performance.now()
    frameCountRef.current = 0

    const gameLoop = (timestamp) => {
      if (gameOverRef.current) return

      const deltaMs = timestamp - lastFrameTimeRef.current
      lastFrameTimeRef.current = timestamp
      // Cap delta to prevent physics jumps on tab switch
      const dt = Math.min(deltaMs / 16.67, 3) // normalize to ~60fps, cap at 3 frames

      const groundY = 1 - 60 / gameHeight // ground zone

      // --- Dying: pet falls to ground, pipes frozen ---
      if (dyingRef.current) {
        petVelocityRef.current += GRAVITY * 1.2 * dt // faster gravity when dying
        petVelocityRef.current = Math.min(petVelocityRef.current, MAX_FALL_SPEED * 1.5)
        petYRef.current += (petVelocityRef.current / gameHeight) * dt
        petRotationRef.current = Math.min(petRotationRef.current + 6 * dt, 90) // nosedive to 90°

        if (petYRef.current >= groundY) {
          petYRef.current = groundY
          petRotationRef.current = 90
          gameOverRef.current = true
          // Ground hit sound
          try {
            const sound = new Audio('https://xpclass.vn/xpclass/sound/flappy-die.mp3')
            sound.volume = 0.5
            sound.play().catch(() => {})
          } catch {}
          setRenderTick(prev => prev + 1)
          setTimeout(() => {
            setPhase('results')
          }, 600)
          return
        }

        frameCountRef.current++
        if (frameCountRef.current % 2 === 0) {
          setRenderTick(prev => prev + 1)
        }
        animFrameRef.current = requestAnimationFrame(gameLoop)
        return
      }

      const elapsed = (timestamp - gameStartTimeRef.current) / 1000
      // Difficulty ramp: speed increases over 60 seconds
      const progress = Math.min(elapsed / 60, 1)
      const pipeSpeed = PIPE_SPEED_START + (PIPE_SPEED_MAX - PIPE_SPEED_START) * progress

      // --- Update pet physics ---
      petVelocityRef.current += GRAVITY * dt
      petVelocityRef.current = Math.min(petVelocityRef.current, MAX_FALL_SPEED)
      petYRef.current += (petVelocityRef.current / gameHeight) * dt

      // Pet rotation based on velocity
      petRotationRef.current = Math.max(-25, Math.min(70, petVelocityRef.current * 5))

      // --- Ceiling & ground collision ---
      if (petYRef.current >= groundY) {
        triggerDeath()
        animFrameRef.current = requestAnimationFrame(gameLoop)
        return
      }
      if (petYRef.current <= 0) {
        petYRef.current = 0
        petVelocityRef.current = 0.5
      }

      // --- Move pipes & check collisions ---
      const pipeSpeedNorm = (pipeSpeed / gameWidth) * dt
      const petPixelX = PET_X_PERCENT * gameWidth
      const petPixelY = petYRef.current * gameHeight
      const petLeft = petPixelX - PET_SIZE / 2 + 6 // slight hitbox shrink
      const petRight = petPixelX + PET_SIZE / 2 - 6
      const petTop = petPixelY - PET_SIZE / 2 + 6
      const petBottom = petPixelY + PET_SIZE / 2 - 6

      pipesRef.current.forEach(pipe => {
        pipe.x -= pipeSpeedNorm

        // Collision detection
        const pipePixelX = pipe.x * gameWidth
        const pipeLeft = pipePixelX - PIPE_WIDTH / 2
        const pipeRight = pipePixelX + PIPE_WIDTH / 2
        const gapPixelY = pipe.gapY * gameHeight
        const gapTop = gapPixelY - PIPE_GAP / 2
        const gapBottom = gapPixelY + PIPE_GAP / 2

        // Check if pet overlaps pipe horizontally
        if (petRight > pipeLeft && petLeft < pipeRight) {
          // Check if pet is outside the gap
          if (petTop < gapTop || petBottom > gapBottom) {
            triggerDeath()
            return
          }
        }

        // Score: passed pipe
        if (!pipe.passed && pipePixelX + PIPE_WIDTH / 2 < petPixelX) {
          pipe.passed = true
          scoreRef.current += 1
          setDisplayScore(scoreRef.current)
          // Score sound
          try {
            const sound = new Audio('https://xpclass.vn/xpclass/sound/flappy-point.mp3')
            sound.volume = 0.4
            sound.play().catch(() => {})
          } catch {}
        }
      })

      if (dyingRef.current || gameOverRef.current) {
        if (dyingRef.current) animFrameRef.current = requestAnimationFrame(gameLoop)
        return
      }

      // Remove off-screen pipes
      pipesRef.current = pipesRef.current.filter(p => p.x > -0.1)

      // --- Spawn new pipes ---
      distanceSinceLastPipeRef.current += pipeSpeedNorm * gameWidth
      if (distanceSinceLastPipeRef.current >= PIPE_SPAWN_DISTANCE) {
        pipesRef.current.push(spawnPipe(gameHeight))
        distanceSinceLastPipeRef.current = 0
      }

      // --- Render update (throttle to ~30fps) ---
      frameCountRef.current++
      if (frameCountRef.current % 2 === 0) {
        setRenderTick(prev => prev + 1)
      }

      animFrameRef.current = requestAnimationFrame(gameLoop)
    }

    const triggerDeath = () => {
      if (dyingRef.current) return
      dyingRef.current = true
      flashRef.current = true
      petVelocityRef.current = JUMP_VELOCITY * 0.5 // small upward bump on hit
      // Hit sound
      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/flappy-hit.mp3')
        sound.volume = 0.5
        sound.play().catch(() => {})
      } catch {}
      setDisplayScore(scoreRef.current)
      // Brief flash
      setTimeout(() => {
        flashRef.current = false
        setRenderTick(prev => prev + 1)
      }, 150)
    }

    animFrameRef.current = requestAnimationFrame(gameLoop)
    return () => {
      gameOverRef.current = true
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [phase, spawnPipe])

  // Get game dimensions for rendering
  const gameArea = gameAreaRef.current
  const gameWidth = gameArea?.clientWidth || 400
  const gameHeight = gameArea?.clientHeight || 700

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes flappyCountdownPulse {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 0.95; }
        }
        @keyframes flappyResultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes flappyScorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes flappyPetBob {
          0%, 100% { transform: translateY(-4px); }
          50% { transform: translateY(4px); }
        }
        @keyframes flappyFlash {
          0% { opacity: 0.8; }
          100% { opacity: 0; }
        }
        @keyframes flappyCloudDrift {
          0% { transform: translateX(400px); }
          100% { transform: translateX(-200px); }
        }
        @keyframes flappyFloat {
          0%, 100% { transform: translateY(-6px); }
          50% { transform: translateY(6px); }
        }
      `}</style>

      {/* Narrow portrait game container */}
      <div className="relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl">

        {/* Sky background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, #38bdf8, #7dd3fc 40%, #bae6fd 70%, #e0f2fe)'
        }} />

        {/* Clouds (decorative) */}
        <div className="absolute top-[15%] text-6xl opacity-30 pointer-events-none"
          style={{ animation: 'flappyCloudDrift 12s linear infinite' }}>
          ☁️
        </div>
        <div className="absolute top-[35%] text-4xl opacity-20 pointer-events-none"
          style={{ animation: 'flappyCloudDrift 18s linear 4s infinite' }}>
          ☁️
        </div>
        <div className="absolute top-[8%] text-5xl opacity-25 pointer-events-none"
          style={{ animation: 'flappyCloudDrift 15s linear 8s infinite' }}>
          ☁️
        </div>

        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-[60px] z-10"
          style={{
            background: 'linear-gradient(to bottom, #65a30d, #4d7c0f 30%, #3f6212)',
            borderTop: '4px solid #84cc16',
          }}
        />

        {/* Close Button */}
        {phase !== 'results' && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-colors"
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Score HUD */}
        {phase === 'playing' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40">
            <span className="text-6xl font-black text-white"
              style={{ textShadow: '0 3px 0 rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.1)' }}
            >
              {displayScore}
            </span>
          </div>
        )}

        {/* Game Area (tap target) */}
        <div
          ref={gameAreaRef}
          className="absolute inset-0 z-20"
          onMouseDown={handleInteraction}
          onTouchStart={handleInteraction}
          style={{ cursor: phase === 'ready' ? 'pointer' : 'default' }}
        >
        {/* Ready Phase */}
        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            {/* Pet preview */}
            <div style={{ animation: 'flappyFloat 1.5s ease-in-out infinite' }}>
              {petImageUrl ? (
                <img src={petImageUrl} alt={petName} className="w-20 h-20 object-contain drop-shadow-lg"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = ''; }}
                />
              ) : null}
              <span className="text-6xl" style={{ display: petImageUrl ? 'none' : '' }}>🐦</span>
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-white mb-2"
                style={{ textShadow: '0 2px 0 rgba(0,0,0,0.15)' }}
              >
                Flappy {petName}
              </h2>
              <p className="text-lg font-bold text-white/80"
                style={{ textShadow: '0 1px 0 rgba(0,0,0,0.1)' }}
              >
                Tap to fly!
              </p>
            </div>
          </div>
        )}

        {/* Playing Phase - Pipes */}
        {phase === 'playing' && pipesRef.current.map(pipe => {
          const pipePixelX = pipe.x * gameWidth
          const gapPixelY = pipe.gapY * gameHeight
          const gapTop = gapPixelY - PIPE_GAP / 2
          const gapBottom = gapPixelY + PIPE_GAP / 2
          const groundTop = gameHeight - 60

          return (
            <React.Fragment key={pipe.id}>
              {/* Top pipe */}
              <div
                className="absolute"
                style={{
                  left: pipePixelX - PIPE_WIDTH / 2,
                  top: 0,
                  width: PIPE_WIDTH,
                  height: Math.max(0, gapTop),
                  willChange: 'left',
                }}
              >
                {/* Pipe body */}
                <div className="absolute inset-0 rounded-b-lg"
                  style={{
                    background: 'linear-gradient(to right, #16a34a, #22c55e 30%, #4ade80 50%, #22c55e 70%, #16a34a)',
                    boxShadow: 'inset -3px 0 0 rgba(0,0,0,0.15), inset 3px 0 0 rgba(255,255,255,0.1)',
                  }}
                />
                {/* Pipe cap */}
                <div className="absolute -left-1 bottom-0 rounded-b-md"
                  style={{
                    width: PIPE_WIDTH + 8,
                    height: 26,
                    background: 'linear-gradient(to right, #15803d, #16a34a 20%, #22c55e 50%, #16a34a 80%, #15803d)',
                    boxShadow: '0 3px 0 rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.15)',
                  }}
                />
              </div>
              {/* Bottom pipe */}
              <div
                className="absolute"
                style={{
                  left: pipePixelX - PIPE_WIDTH / 2,
                  top: gapBottom,
                  width: PIPE_WIDTH,
                  height: Math.max(0, groundTop - gapBottom),
                  willChange: 'left',
                }}
              >
                {/* Pipe body */}
                <div className="absolute inset-0 rounded-t-lg"
                  style={{
                    background: 'linear-gradient(to right, #16a34a, #22c55e 30%, #4ade80 50%, #22c55e 70%, #16a34a)',
                    boxShadow: 'inset -3px 0 0 rgba(0,0,0,0.15), inset 3px 0 0 rgba(255,255,255,0.1)',
                  }}
                />
                {/* Pipe cap */}
                <div className="absolute -left-1 top-0 rounded-t-md"
                  style={{
                    width: PIPE_WIDTH + 8,
                    height: 26,
                    background: 'linear-gradient(to right, #15803d, #16a34a 20%, #22c55e 50%, #16a34a 80%, #15803d)',
                    boxShadow: '0 -3px 0 rgba(0,0,0,0.2), inset 0 -2px 0 rgba(255,255,255,0.15)',
                  }}
                />
              </div>
            </React.Fragment>
          )
        })}

        {/* Playing Phase - Pet */}
        {phase === 'playing' && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{
              left: PET_X_PERCENT * 100 + '%',
              top: petYRef.current * 100 + '%',
              transform: `translate(-50%, -50%) rotate(${petRotationRef.current}deg)`,
              width: PET_SIZE,
              height: PET_SIZE,
              transition: 'none',
              willChange: 'top, transform',
            }}
          >
            {petImageUrl ? (
              <img
                src={petImageUrl}
                alt={petName}
                className="w-full h-full object-contain drop-shadow-lg"
                draggable={false}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = ''; }}
              />
            ) : null}
            <span className="text-4xl block text-center" style={{ display: petImageUrl ? 'none' : '' }}>🐦</span>
          </div>
        )}

        {/* Death flash */}
        {flashRef.current && (
          <div className="absolute inset-0 bg-white z-40 pointer-events-none"
            style={{ animation: 'flappyFlash 0.15s ease-out forwards' }}
          />
        )}
      </div>

      {/* Results Phase */}
      {phase === 'results' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-50">
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
            style={{ animation: 'flappyResultsFadeIn 0.5s ease-out' }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 mb-4"
              style={{ animation: 'flappyScorePopIn 0.6s ease-out 0.3s both' }}
            >
              <Trophy className="w-10 h-10 text-yellow-500" />
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {displayScore >= 10 ? 'Game Over!' : 'Not Enough Pipes!'}
            </h2>
            <p className="text-gray-500 mb-5">
              {displayScore >= 10
                ? `${petName} flew through ${displayScore} pipes!`
                : `${petName} only cleared ${displayScore}/10 pipes`}
            </p>

            <div
              className={`rounded-2xl p-5 mb-5 border ${displayScore >= 10 ? 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
              style={{ animation: 'flappyScorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className={`text-5xl font-black ${displayScore >= 10 ? 'text-sky-600' : 'text-gray-400'}`}>{displayScore}</p>
              <p className={`text-sm font-semibold mt-1 ${displayScore >= 10 ? 'text-sky-400' : 'text-gray-400'}`}>pipes cleared</p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {displayScore >= 20
                ? 'Legendary flyer! 🏆'
                : displayScore >= 10
                  ? 'Amazing skills! 🌟'
                  : 'Need at least 10 pipes to earn XP. Try again! 💪'}
            </p>

            {displayScore >= 10 ? (
              <button
                onClick={() => onGameEnd(displayScore)}
                className="w-full py-3.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-cyan-600 active:border-b-0 active:mt-1 transition-all"
              >
                Collect Rewards ✨
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setPhase('ready')
                    setDisplayScore(0)
                  }}
                  className="w-full py-3.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-cyan-600 active:border-b-0 active:mt-1 transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>,
    document.body
  )
}

export default PetFlappyGame
