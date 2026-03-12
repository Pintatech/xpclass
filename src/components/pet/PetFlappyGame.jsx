import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Clock } from 'lucide-react'

import { assetUrl } from '../../hooks/useBranding';
import WORD_BANK_FALLBACK from './wordBank';

// Physics
const GRAVITY = 0.4
const JUMP_VELOCITY = -7
const MAX_FALL_SPEED = 9

// Fruit
const FRUIT_SIZE = 48
const FRUIT_SPEED_START = 2.0
const FRUIT_SPEED_MAX = 3.5
const FRUIT_SPAWN_DISTANCE = 260 // px between fruit waves
const FRUITS_PER_WAVE = 3

// Pet
const PET_SIZE = 56
const PET_X_PERCENT = 0.18

// Game
const GAME_DURATION = 61 // seconds
const PASS_SCORE = 10

const FRUIT_EMOJIS = ['🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🍅', '🍆', '🌽', '🥑', '🍕', '🍔', '🌭', '🥨', '🥐', '🍞', '🌮', '🥪', '🥠', '🥩', '🍗', '🍖', '🍘', '🍤', '🍩', '🍰', '🧁']

function pickWrongWords(wordBank, correctWord, count) {
  const pool = wordBank.filter(w => w.word !== correctWord)
  const shuffled = pool.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map(w => w.word)
}

function pickWord(wordBank, usedWords) {
  const unused = wordBank.filter(w => !usedWords.has(w.word))
  const pool = unused.length > 0 ? unused : wordBank
  return pool[Math.floor(Math.random() * pool.length)]
}

const PetFlappyGame = ({ petImageUrl, petName, wordBank: wordBankProp, onGameEnd, onClose, leaderboard = [] }) => {
  const [phase, setPhase] = useState('ready') // 'ready' | 'playing' | 'results'
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [streak, setStreak] = useState(0)

  const wordBank = (wordBankProp && wordBankProp.length > 0) ? wordBankProp : WORD_BANK_FALLBACK

  const gameAreaRef = useRef(null)
  const animFrameRef = useRef(null)
  const lastFrameTimeRef = useRef(0)
  const timerRef = useRef(null)
  const bgMusicRef = useRef(null)

  // DOM refs for direct manipulation
  const petElRef = useRef(null)
  const fruitsContainerRef = useRef(null)
  const floatsContainerRef = useRef(null)
  const hintTextRef = useRef(null)
  const flashElRef = useRef(null)

  // Game state refs
  const petYRef = useRef(0)
  const petVelocityRef = useRef(0)
  const petRotationRef = useRef(0)
  const fruitsRef = useRef([])
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const gameOverRef = useRef(false)
  const nextWaveIdRef = useRef(0)
  const distanceSinceLastWaveRef = useRef(0)
  const gameStartTimeRef = useRef(0)
  const currentWordRef = useRef(null)
  const usedWordsRef = useRef(new Set())
  const currentHintRef = useRef('')
  const nextFloatIdRef = useRef(0)
  const floatingTextsRef = useRef([])

  // Flap / jump
  const flap = useCallback(() => {
    if (gameOverRef.current) return
    petVelocityRef.current = JUMP_VELOCITY
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

  // Set a new target word
  const setNewWord = useCallback(() => {
    const entry = pickWord(wordBank, usedWordsRef.current)
    usedWordsRef.current.add(entry.word)
    currentWordRef.current = entry
    currentHintRef.current = entry.hint
  }, [wordBank])

  // Spawn a wave of fruits
  const spawnWave = useCallback((gameHeight) => {
    const currentWord = currentWordRef.current
    if (!currentWord) return null

    const groundY = gameHeight - 60
    const minY = 60
    const usableHeight = groundY - minY
    const correctIndex = Math.floor(Math.random() * FRUITS_PER_WAVE)
    const wrongWords = pickWrongWords(wordBank, currentWord.word, FRUITS_PER_WAVE - 1)

    let wrongIdx = 0
    const fruits = []
    for (let i = 0; i < FRUITS_PER_WAVE; i++) {
      const yNorm = (minY + (usableHeight / (FRUITS_PER_WAVE + 1)) * (i + 1)) / gameHeight
      const emoji = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)]
      fruits.push({
        y: yNorm,
        word: i === correctIndex ? currentWord.word : wrongWords[wrongIdx++],
        isCorrect: i === correctIndex,
        eaten: false,
        emoji,
        el: null, // DOM element reference
      })
    }

    return {
      id: nextWaveIdRef.current++,
      x: 1.1,
      fruits,
      resolved: false,
    }
  }, [wordBank])

  // Stop background music
  const stopMusic = useCallback(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.pause()
      bgMusicRef.current = null
    }
  }, [])

  // Stop music on results
  useEffect(() => {
    if (phase === 'results') stopMusic()
  }, [phase, stopMusic])

  // Cleanup music on unmount
  useEffect(() => {
    return () => stopMusic()
  }, [stopMusic])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing') return
    setDisplayTime(GAME_DURATION)
    timerRef.current = setInterval(() => {
      setDisplayTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          gameOverRef.current = true
          setPhase('results')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  // Create a fruit DOM element
  const createFruitEl = useCallback((fruit) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'absolute pointer-events-none'
    wrapper.style.cssText = 'left:0;top:0;will-change:transform;'

    const label = document.createElement('div')
    label.className = 'text-center'
    label.style.marginBottom = '2px'
    const span = document.createElement('span')
    span.className = 'inline-block bg-white text-gray-800 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md border border-gray-200 whitespace-nowrap'
    span.style.cssText = 'max-width:120px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;'
    span.textContent = fruit.word
    label.appendChild(span)
    wrapper.appendChild(label)

    const emojiDiv = document.createElement('div')
    emojiDiv.className = 'text-center'
    emojiDiv.style.cssText = `font-size:${FRUIT_SIZE - 8}px;line-height:1;`
    emojiDiv.textContent = fruit.emoji
    wrapper.appendChild(emojiDiv)

    return wrapper
  }, [])

  // Create a floating text DOM element
  const createFloatEl = useCallback((text, x, y, color) => {
    const el = document.createElement('div')
    el.className = 'absolute pointer-events-none z-50 font-black text-lg'
    el.style.cssText = `left:${x}px;top:${y}px;color:${color};opacity:1;transform:translateX(-50%);text-shadow:0 1px 2px rgba(0,0,0,0.2);`
    el.textContent = text
    return el
  }, [])

  // Main game loop
  useEffect(() => {
    if (phase !== 'playing') return

    const gameArea = gameAreaRef.current
    if (!gameArea) return

    const gameWidth = gameArea.clientWidth
    const gameHeight = gameArea.clientHeight

    // Clear containers
    if (fruitsContainerRef.current) fruitsContainerRef.current.innerHTML = ''
    if (floatsContainerRef.current) floatsContainerRef.current.innerHTML = ''

    // Initialize
    petYRef.current = 0.45
    petVelocityRef.current = JUMP_VELOCITY * 0.6
    petRotationRef.current = 0
    scoreRef.current = 0
    streakRef.current = 0
    gameOverRef.current = false
    usedWordsRef.current = new Set()
    nextFloatIdRef.current = 0
    floatingTextsRef.current = []

    // Pick first word
    setNewWord()
    // Update hint immediately
    if (hintTextRef.current) hintTextRef.current.textContent = currentHintRef.current

    // Pre-spawn first wave
    const firstWave = spawnWave(gameHeight)
    if (firstWave) {
      firstWave.fruits.forEach(fruit => {
        const el = createFruitEl(fruit)
        fruit.el = el
        fruitsContainerRef.current?.appendChild(el)
      })
      fruitsRef.current = [firstWave]
    } else {
      fruitsRef.current = []
    }

    distanceSinceLastWaveRef.current = 0
    gameStartTimeRef.current = performance.now()
    setDisplayScore(0)
    setStreak(0)

    lastFrameTimeRef.current = performance.now()

    // Start background music
    try {
      const music = new Audio(assetUrl('/sound/pet-word-scamble.mp3'))
      music.loop = true
      music.volume = 0.3
      bgMusicRef.current = music
      music.play().catch(() => {})
    } catch {}

    const gameLoop = (timestamp) => {
      if (gameOverRef.current) return

      const deltaMs = timestamp - lastFrameTimeRef.current
      lastFrameTimeRef.current = timestamp
      const dt = Math.min(deltaMs / 16.67, 3)

      const groundY = 1 - 60 / gameHeight

      const elapsed = (timestamp - gameStartTimeRef.current) / 1000
      const progress = Math.min(elapsed / 90, 1)
      const fruitSpeed = FRUIT_SPEED_START + (FRUIT_SPEED_MAX - FRUIT_SPEED_START) * progress

      // --- Update pet physics ---
      petVelocityRef.current += GRAVITY * dt
      petVelocityRef.current = Math.min(petVelocityRef.current, MAX_FALL_SPEED)
      petYRef.current += (petVelocityRef.current / gameHeight) * dt
      petRotationRef.current = Math.max(-25, Math.min(70, petVelocityRef.current * 5))

      // --- Ceiling & ground: bounce back instead of death ---
      if (petYRef.current >= groundY) {
        petYRef.current = groundY - 0.01
        petVelocityRef.current = JUMP_VELOCITY * 0.4 // bounce up
      }
      if (petYRef.current <= 0.02) {
        petYRef.current = 0.02
        petVelocityRef.current = 0.5
      }

      // --- Direct DOM update for pet ---
      if (petElRef.current) {
        petElRef.current.style.top = petYRef.current * 100 + '%'
        petElRef.current.style.transform = `translate(-50%, -50%) rotate(${petRotationRef.current}deg)`
      }

      // --- Move fruits & check collisions ---
      const fruitSpeedNorm = (fruitSpeed / gameWidth) * dt
      const petPixelX = PET_X_PERCENT * gameWidth
      const petPixelY = petYRef.current * gameHeight
      const petRadius = PET_SIZE / 2 - 4

      fruitsRef.current.forEach(wave => {
        wave.x -= fruitSpeedNorm

        // Direct DOM update for each fruit in wave
        const wavePixelX = wave.x * gameWidth
        wave.fruits.forEach(fruit => {
          if (fruit.eaten || !fruit.el) return
          const fruitPixelY = fruit.y * gameHeight
          fruit.el.style.transform = `translate3d(${Math.round(wavePixelX - FRUIT_SIZE / 2)}px, ${Math.round(fruitPixelY - FRUIT_SIZE / 2 - 12)}px, 0)`
        })

        if (wave.resolved) return

        wave.fruits.forEach(fruit => {
          if (fruit.eaten) return

          const fruitPixelX = wave.x * gameWidth
          const fruitPixelY = fruit.y * gameHeight
          const dx = petPixelX - fruitPixelX
          const dy = petPixelY - fruitPixelY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const hitRadius = petRadius + FRUIT_SIZE / 2 - 6

          if (dist < hitRadius) {
            fruit.eaten = true
            wave.resolved = true

            // Hide fruit DOM element
            if (fruit.el) fruit.el.style.display = 'none'

            if (fruit.isCorrect) {
              // Correct fruit!
              streakRef.current += 1
              setStreak(streakRef.current)
              const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
              const points = streakRef.current >= 3 ? rand(16, 18) : streakRef.current >= 2 ? rand(13, 15) : rand(10, 12)
              scoreRef.current += points
              setDisplayScore(scoreRef.current)

              // Add floating text via DOM
              const floatText = streakRef.current >= 2 ? `+${points} 🔥` : `+${points}`
              const floatColor = streakRef.current >= 2 ? '#f59e0b' : '#22c55e'
              const floatEl = createFloatEl(floatText, fruitPixelX, fruitPixelY, floatColor)
              floatsContainerRef.current?.appendChild(floatEl)
              floatingTextsRef.current.push({ el: floatEl, y: fruitPixelY, opacity: 1 })

              try {
                const sound = new Audio(assetUrl('/sound/flappy-point.mp3'))
                sound.volume = 0.4
                sound.play().catch(() => {})
              } catch {}
              // Pick new word
              setNewWord()
              if (hintTextRef.current) hintTextRef.current.textContent = currentHintRef.current
            } else {
              // Wrong fruit — streak reset, brief flash, no death
              streakRef.current = 0
              setStreak(0)

              const floatEl = createFloatEl('Wrong!', fruitPixelX, fruitPixelY, '#ef4444')
              floatsContainerRef.current?.appendChild(floatEl)
              floatingTextsRef.current.push({ el: floatEl, y: fruitPixelY, opacity: 1 })

              if (flashElRef.current) {
                flashElRef.current.style.display = ''
                flashElRef.current.style.animation = 'none'
                // force reflow
                flashElRef.current.offsetHeight
                flashElRef.current.style.animation = 'flappyFlash 0.15s ease-out forwards'
                setTimeout(() => {
                  if (flashElRef.current) flashElRef.current.style.display = 'none'
                }, 150)
              }

              try {
                const sound = new Audio(assetUrl('/sound/flappy-hit.mp3'))
                sound.volume = 0.4
                sound.play().catch(() => {})
              } catch {}
            }
          }
        })
      })

      // Check for missed waves (scrolled off-screen without eating correct fruit)
      for (const wave of fruitsRef.current) {
        if (!wave.resolved && wave.x < -0.05) {
          wave.resolved = true
          streakRef.current = 0
          setStreak(0)
          setNewWord()
          if (hintTextRef.current) hintTextRef.current.textContent = currentHintRef.current
        }
      }

      // Remove off-screen waves and their DOM elements
      fruitsRef.current = fruitsRef.current.filter(w => {
        if (w.x <= -0.15) {
          w.fruits.forEach(f => { if (f.el && f.el.parentNode) f.el.parentNode.removeChild(f.el) })
          return false
        }
        return true
      })

      // --- Spawn next wave only after current is resolved ---
      const allResolved = fruitsRef.current.length === 0 || fruitsRef.current.every(w => w.resolved)
      distanceSinceLastWaveRef.current += fruitSpeedNorm * gameWidth
      if (allResolved && distanceSinceLastWaveRef.current >= FRUIT_SPAWN_DISTANCE) {
        const wave = spawnWave(gameHeight)
        if (wave) {
          wave.fruits.forEach(fruit => {
            const el = createFruitEl(fruit)
            fruit.el = el
            fruitsContainerRef.current?.appendChild(el)
          })
          fruitsRef.current.push(wave)
        }
        distanceSinceLastWaveRef.current = 0
      }

      // --- Animate floating texts via DOM ---
      floatingTextsRef.current = floatingTextsRef.current.filter(ft => {
        ft.y -= 1.5
        ft.opacity -= 0.025
        if (ft.opacity <= 0) {
          if (ft.el && ft.el.parentNode) ft.el.parentNode.removeChild(ft.el)
          return false
        }
        ft.el.style.top = ft.y + 'px'
        ft.el.style.opacity = ft.opacity
        return true
      })

      animFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animFrameRef.current = requestAnimationFrame(gameLoop)
    return () => {
      gameOverRef.current = true
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [phase, spawnWave, setNewWord, createFruitEl, createFloatEl])

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes flappyResultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes flappyScorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
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
            onClick={() => { stopMusic(); onClose(); }}
            className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-colors"
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* HUD - Score + Timer + Streak */}
        {phase === 'playing' && (
          <div className="absolute top-4 left-0 right-0 z-40 px-4">
            <div className="flex items-center justify-between">
              {/* Timer */}
              <div className="flex items-center gap-1.5 bg-white/90 rounded-full px-3 py-1.5 shadow-md">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className={`text-lg font-black ${displayTime <= 10 ? 'text-red-500' : 'text-gray-800'}`}>
                  {displayTime}s
                </span>
              </div>
              {/* Score */}
              <div className="bg-white/90 rounded-full px-4 py-1.5 shadow-md">
                <span className="text-lg font-black text-sky-600">{displayScore} pts</span>
              </div>
              {/* Streak */}
              {streak >= 2 && (
                <div className="bg-amber-400/90 rounded-full px-3 py-1.5 shadow-md">
                  <span className="text-lg font-black text-white">🔥 {streak}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Word hint */}
        {phase === 'playing' && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border-2 border-amber-300">
              <p className="text-xs font-bold text-amber-600 text-center leading-none mb-0.5">Find the meaning:</p>
              <p ref={hintTextRef} className="text-lg font-black text-gray-800 text-center leading-tight">{currentHintRef.current}</p>
            </div>
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
            <div style={{ animation: 'flappyFloat 1.5s ease-in-out infinite' }}>
              {petImageUrl ? (
                <img src={petImageUrl} alt={petName} className="w-20 h-20 object-contain drop-shadow-lg"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = ''; }}
                />
              ) : null}
              <img src="https://xpclass.vn/xpclass/image/dashboard/flap.png" alt="Flappy Pet" className="w-20 h-20 object-contain drop-shadow-lg" style={{ display: petImageUrl ? 'none' : '' }} />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-white mb-2"
                style={{ textShadow: '0 2px 0 rgba(0,0,0,0.15)' }}
              >
                Flappy {petName}
              </h2>
              <p className="text-base font-bold text-white/90 mb-1"
                style={{ textShadow: '0 1px 0 rgba(0,0,0,0.1)' }}
              >
                Tap to fly!
              </p>
              <p className="text-sm text-white/70 max-w-[260px]"
                style={{ textShadow: '0 1px 0 rgba(0,0,0,0.1)' }}
              >
                Eat the fruit with the correct English meaning!
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-white/60" />
                <span className="text-sm text-white/60">{GAME_DURATION} seconds</span>
              </div>
            </div>
            {leaderboard.length > 0 && (
              <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 w-full max-w-xs">
                <p className="text-xs font-bold text-yellow-300 mb-2">🏆 Top 10</p>
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-white/90 py-0.5">
                    <span>{i + 1}. {entry.name}</span>
                    <span className="font-bold">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Playing Phase - Fruits container (DOM-managed) */}
        {phase === 'playing' && <div ref={fruitsContainerRef} />}

        {/* Floating texts container (DOM-managed) */}
        {phase === 'playing' && <div ref={floatsContainerRef} />}

        {/* Playing Phase - Pet */}
        {phase === 'playing' && (
          <div
            ref={petElRef}
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
            <img src="https://xpclass.vn/xpclass/image/dashboard/flap.png" alt="Flappy Pet" className="w-full h-full object-contain drop-shadow-lg" style={{ display: petImageUrl ? 'none' : '' }} />
          </div>
        )}

        {/* Death flash */}
        <div
          ref={flashElRef}
          className="absolute inset-0 bg-red-500 z-40 pointer-events-none"
          style={{ display: 'none' }}
        />
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
              {displayScore >= PASS_SCORE ? 'Time\'s Up!' : 'Not Enough Points!'}
            </h2>
            <p className="text-gray-500 mb-5">
              {displayScore >= PASS_SCORE
                ? `${petName} scored ${displayScore} points!`
                : `${petName} only scored ${displayScore}/${PASS_SCORE} points`}
            </p>

            <div
              className={`rounded-2xl p-5 mb-5 border ${displayScore >= PASS_SCORE ? 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
              style={{ animation: 'flappyScorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className={`text-5xl font-black ${displayScore >= PASS_SCORE ? 'text-sky-600' : 'text-gray-400'}`}>{displayScore}</p>
              <p className={`text-sm font-semibold mt-1 ${displayScore >= PASS_SCORE ? 'text-sky-400' : 'text-gray-400'}`}>points</p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {displayScore >= 200
                ? 'Vocabulary master! 🏆'
                : displayScore >= PASS_SCORE
                  ? 'Great word skills! 🌟'
                  : `Need at least ${PASS_SCORE} points to earn XP. Try again! 💪`}
            </p>

            {displayScore >= PASS_SCORE ? (
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
                    setStreak(0)
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
