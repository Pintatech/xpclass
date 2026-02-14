import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy } from 'lucide-react'

const FOOD_ITEMS = [
  { emoji: '🍎', points: 10, weight: 30, color: '#ef4444' },
  { emoji: '🍕', points: 15, weight: 25, color: '#f97316' },
  { emoji: '🍖', points: 20, weight: 20, color: '#a16207' },
  { emoji: '🍪', points: 25, weight: 15, color: '#d97706' },
  { emoji: '🌟', points: 50, weight: 10, color: '#eab308', golden: true },
]

const GAME_DURATION = 30
const SPAWN_INTERVAL_START = 800
const SPAWN_INTERVAL_END = 350
const FALL_SPEED_START = 120
const FALL_SPEED_END = 280
const BASKET_WIDTH = 80
const ITEM_SIZE = 40
const CATCH_ZONE_HEIGHT = 110

const PetCatchGame = ({ bowlImageUrl, petName, onGameEnd, onClose }) => {
  const [phase, setPhase] = useState('countdown')
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [countdownNumber, setCountdownNumber] = useState(3)
  const [catchEffects, setCatchEffects] = useState([])
  const [renderTick, setRenderTick] = useState(0)

  const gameAreaRef = useRef(null)
  const basketXRef = useRef(0.5)
  const itemsRef = useRef([])
  const scoreRef = useRef(0)
  const timeRef = useRef(GAME_DURATION)
  const lastSpawnRef = useRef(0)
  const animFrameRef = useRef(null)
  const lastFrameTimeRef = useRef(0)
  const gameStartTimeRef = useRef(0)
  const nextItemIdRef = useRef(0)
  const gameEndedRef = useRef(false)
  const frameCountRef = useRef(0)
  const catchSoundRef = useRef(null)

  // Pre-load catch sound
  useEffect(() => {
    catchSoundRef.current = new Audio('https://xpclass.vn/xpclass/sound/chomp.mp3')
    catchSoundRef.current.volume = 0.5
  }, [])

  // Weighted random food selection
  const pickRandomFood = useCallback(() => {
    const totalWeight = FOOD_ITEMS.reduce((sum, f) => sum + f.weight, 0)
    let random = Math.random() * totalWeight
    for (const food of FOOD_ITEMS) {
      random -= food.weight
      if (random <= 0) return food
    }
    return FOOD_ITEMS[0]
  }, [])

  // Spawn a new falling item
  const spawnItem = useCallback(() => {
    const type = pickRandomFood()
    itemsRef.current.push({
      id: nextItemIdRef.current++,
      x: 0.1 + Math.random() * 0.8,
      y: -ITEM_SIZE,
      type,
      caught: false,
    })
  }, [pickRandomFood])

  // Trigger floating +points effect
  const triggerCatchEffect = useCallback((x, y, foodType) => {
    const effectId = Date.now() + Math.random()
    setCatchEffects(prev => [...prev, {
      id: effectId,
      x,
      y,
      points: foodType.points,
      color: foodType.color,
      golden: foodType.golden,
    }])
    // Play sound
    try {
      const sound = catchSoundRef.current?.cloneNode()
      if (sound) {
        sound.volume = 0.4
        sound.play().catch(() => {})
      }
    } catch {}
    setTimeout(() => {
      setCatchEffects(prev => prev.filter(e => e.id !== effectId))
    }, 800)
  }, [])

  // Countdown phase
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdownNumber > 0) {
      const timer = setTimeout(() => setCountdownNumber(prev => prev - 1), 600)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => setPhase('playing'), 400)
      return () => clearTimeout(timer)
    }
  }, [phase, countdownNumber])

  // Input handling
  useEffect(() => {
    if (phase !== 'playing') return
    const gameArea = gameAreaRef.current
    if (!gameArea) return

    const updateBasketX = (clientX) => {
      const rect = gameArea.getBoundingClientRect()
      const relativeX = (clientX - rect.left) / rect.width
      basketXRef.current = Math.max(0.05, Math.min(0.95, relativeX))
    }

    const handleMouseMove = (e) => updateBasketX(e.clientX)
    const handleTouchMove = (e) => {
      e.preventDefault()
      if (e.touches.length > 0) updateBasketX(e.touches[0].clientX)
    }
    const handleTouchStart = (e) => {
      if (e.touches.length > 0) updateBasketX(e.touches[0].clientX)
    }

    gameArea.addEventListener('mousemove', handleMouseMove)
    gameArea.addEventListener('touchmove', handleTouchMove, { passive: false })
    gameArea.addEventListener('touchstart', handleTouchStart, { passive: true })

    return () => {
      gameArea.removeEventListener('mousemove', handleMouseMove)
      gameArea.removeEventListener('touchmove', handleTouchMove)
      gameArea.removeEventListener('touchstart', handleTouchStart)
    }
  }, [phase])

  // Main game loop
  useEffect(() => {
    if (phase !== 'playing') return

    gameStartTimeRef.current = performance.now()
    lastFrameTimeRef.current = performance.now()
    lastSpawnRef.current = performance.now()
    timeRef.current = GAME_DURATION
    scoreRef.current = 0
    itemsRef.current = []
    gameEndedRef.current = false
    frameCountRef.current = 0

    const gameLoop = (timestamp) => {
      if (gameEndedRef.current) return

      const deltaMs = timestamp - lastFrameTimeRef.current
      lastFrameTimeRef.current = timestamp
      const deltaSec = Math.min(deltaMs / 1000, 0.1) // cap delta to prevent jumps
      const elapsed = (timestamp - gameStartTimeRef.current) / 1000
      const progress = Math.min(elapsed / GAME_DURATION, 1)

      // Update timer
      timeRef.current = Math.max(0, GAME_DURATION - elapsed)
      setDisplayTime(Math.ceil(timeRef.current))

      // Check game over
      if (timeRef.current <= 0) {
        gameEndedRef.current = true
        setDisplayScore(scoreRef.current)
        setPhase('results')
        return
      }

      // Spawn new items
      const spawnInterval = SPAWN_INTERVAL_START +
        (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * progress
      if (timestamp - lastSpawnRef.current >= spawnInterval) {
        spawnItem()
        lastSpawnRef.current = timestamp
      }

      // Cap items
      if (itemsRef.current.length > 30) {
        itemsRef.current = itemsRef.current.slice(-25)
      }

      // Update item positions & check catches
      const fallSpeed = FALL_SPEED_START +
        (FALL_SPEED_END - FALL_SPEED_START) * progress
      const gameWidth = gameAreaRef.current?.clientWidth || 300
      const gameHeight = gameAreaRef.current?.clientHeight || 600

      itemsRef.current = itemsRef.current.filter(item => {
        item.y += fallSpeed * deltaSec

        // Check catch
        if (!item.caught && item.y >= gameHeight - CATCH_ZONE_HEIGHT && item.y < gameHeight) {
          const basketPixelX = basketXRef.current * gameWidth
          const itemPixelX = item.x * gameWidth
          const distance = Math.abs(basketPixelX - itemPixelX)

          if (distance < BASKET_WIDTH * 0.65) {
            item.caught = true
            scoreRef.current += item.type.points
            setDisplayScore(scoreRef.current)
            triggerCatchEffect(itemPixelX, gameHeight - CATCH_ZONE_HEIGHT, item.type)
            return false
          }
        }

        // Remove if fallen off screen
        return item.y < gameHeight + ITEM_SIZE
      })

      // Throttle re-renders to ~30fps for item positions
      frameCountRef.current++
      if (frameCountRef.current % 2 === 0) {
        setRenderTick(prev => prev + 1)
      }

      animFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animFrameRef.current = requestAnimationFrame(gameLoop)
    return () => {
      gameEndedRef.current = true
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [phase, spawnItem, triggerCatchEffect])

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #7dd3fc, #bae6fd, #d9f99d)' }}
    >
      <style>{`
        @keyframes catchFloat {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(1.4); opacity: 0; }
        }
        @keyframes countdownPulse {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes goldenGlow {
          0%, 100% { filter: drop-shadow(0 0 6px #eab308); }
          50% { filter: drop-shadow(0 0 14px #fbbf24); }
        }
        @keyframes resultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes itemWobble {
          0%, 100% { transform: translateX(-50%) rotate(-5deg); }
          50% { transform: translateX(-50%) rotate(5deg); }
        }
      `}</style>

      {/* Close Button */}
      {phase !== 'results' && (
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-colors"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* HUD - Score and Timer */}
      {phase === 'playing' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4">
          <div className="bg-white/85 backdrop-blur rounded-2xl px-5 py-2 shadow-lg flex items-center gap-2">
            <span className="text-2xl">🍖</span>
            <span className="text-2xl font-black text-orange-600">{displayScore}</span>
          </div>
          <div className={`bg-white/85 backdrop-blur rounded-2xl px-5 py-2 shadow-lg ${
            displayTime <= 5 ? 'animate-pulse' : ''
          }`}>
            <span className={`text-2xl font-black ${displayTime <= 5 ? 'text-red-500' : 'text-gray-800'}`}>
              {displayTime}
            </span>
            <span className="text-sm text-gray-500 ml-1">s</span>
          </div>
        </div>
      )}

      {/* Countdown Phase */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            key={countdownNumber}
            className="text-9xl font-black text-white"
            style={{
              animation: 'countdownPulse 0.5s ease-out',
              textShadow: '0 4px 20px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {countdownNumber === 0 ? 'GO!' : countdownNumber}
          </div>
        </div>
      )}

      {/* Game Area */}
      {phase === 'playing' && (
        <div
          ref={gameAreaRef}
          className="absolute inset-0"
          style={{ cursor: 'none' }}
        >
          {/* Ground decoration */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-400/50 to-transparent" />

          {/* Falling Items */}
          {itemsRef.current.map(item => (
            <div
              key={item.id}
              className="absolute pointer-events-none"
              style={{
                left: `${item.x * 100}%`,
                top: item.y,
                transform: 'translateX(-50%)',
                fontSize: '2rem',
                animation: item.type.golden ? 'goldenGlow 0.8s ease-in-out infinite, itemWobble 1.2s ease-in-out infinite' : 'itemWobble 1.5s ease-in-out infinite',
                willChange: 'top',
              }}
            >
              {item.type.emoji}
            </div>
          ))}

          {/* Catch Effects */}
          {catchEffects.map(effect => (
            <div
              key={effect.id}
              className="absolute pointer-events-none font-black text-xl z-30"
              style={{
                left: effect.x,
                top: effect.y,
                transform: 'translateX(-50%)',
                color: effect.color,
                animation: 'catchFloat 0.8s ease-out forwards',
                textShadow: '0 0 8px rgba(255,255,255,0.9), 1px 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              +{effect.points}{effect.golden ? ' ✨' : ''}
            </div>
          ))}

          {/* Basket */}
          <div
            className="absolute z-20"
            style={{
              bottom: 24,
              left: `${basketXRef.current * 100}%`,
              transform: 'translateX(-50%)',
              width: BASKET_WIDTH,
              height: BASKET_WIDTH,
              transition: 'left 0.03s linear',
            }}
          >
            <img
              src={bowlImageUrl}
              alt="basket"
              className="w-full h-full object-contain drop-shadow-lg"
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* Results Phase */}
      {phase === 'results' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
            style={{ animation: 'resultsFadeIn 0.5s ease-out' }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 mb-4"
              style={{ animation: 'scorePopIn 0.6s ease-out 0.3s both' }}
            >
              <Trophy className="w-10 h-10 text-yellow-500" />
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-1">Training Complete!</h2>
            <p className="text-gray-500 mb-5">{petName} had a great workout!</p>

            <div
              className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-5 mb-5 border border-orange-100"
              style={{ animation: 'scorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className="text-5xl font-black text-orange-600">{displayScore}</p>
              <p className="text-sm text-orange-400 font-semibold mt-1">points scored</p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {displayScore >= 500
                ? 'Amazing reflexes! 🏆'
                : displayScore >= 300
                  ? 'Great training session! 💪'
                  : displayScore >= 100
                    ? 'Good effort, keep it up! 👍'
                    : 'Practice makes perfect! 🌱'}
            </p>

            <button
              onClick={() => onGameEnd(displayScore)}
              className="w-full py-3.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-cyan-600 active:border-b-0 active:mt-1 transition-all"
            >
              Collect Rewards ✨
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

export default PetCatchGame
