import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy } from 'lucide-react'
import WORD_BANK from './wordBank'

const GAME_DURATION = 60
const POINTS_PER_WORD = 10
const STREAK_BONUS = 5


// Shuffle array (Fisher-Yates)
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Pick words for a game session, ordered by difficulty
const pickGameWords = () => {
  const short = shuffle(WORD_BANK.filter(w => w.word.length <= 4)).slice(0, 5)
  const medium = shuffle(WORD_BANK.filter(w => w.word.length === 5)).slice(0, 5)
  const long = shuffle(WORD_BANK.filter(w => w.word.length === 6)).slice(0, 5)
  const longer = shuffle(WORD_BANK.filter(w => w.word.length >= 7)).slice(0, 5)
  return [...short, ...medium, ...long, ...longer]
}

const PetWordScramble = ({ petImageUrl, petName, onGameEnd, onClose }) => {
  const [phase, setPhase] = useState('ready') // 'ready' | 'playing' | 'results'
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [words, setWords] = useState([])
  const [wordIndex, setWordIndex] = useState(0)
  const [bubbles, setBubbles] = useState([]) // { id, letter, x, y, vx, vy, popping, captured }
  const [placedLetters, setPlacedLetters] = useState([]) // { id, letter }
  const [streak, setStreak] = useState(0)
  const [combo, setCombo] = useState(0)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong' | null
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [particles, setParticles] = useState([]) // explosion particles
  const [screenShake, setScreenShake] = useState(0)
  const [skippedWords, setSkippedWords] = useState([])

  const scoreRef = useRef(0)
  const timerRef = useRef(null)
  const streakRef = useRef(0)
  const animationFrameRef = useRef(null)
  const gameAreaRef = useRef(null)
  const containerRef = useRef(null)

  // Create floating bubbles for a word, spread out in a grid-ish layout
  const createBubbles = useCallback((word, containerWidth, containerHeight) => {
    const letters = word.split('')
    let scrambled
    let attempts = 0
    do {
      scrambled = shuffle(letters)
      attempts++
    } while (scrambled.join('') === word && attempts < 10)

    const bubbleSize = 70
    const padding = 30
    const safeTop = 140
    const safeBottom = containerHeight - 220
    const safeLeft = padding
    const safeRight = containerWidth - padding
    const availableW = safeRight - safeLeft
    const availableH = safeBottom - safeTop

    const total = scrambled.length
    const cols = Math.min(total, Math.floor(availableW / (bubbleSize + 20)))
    const rows = Math.ceil(total / cols)
    const cellW = availableW / cols
    const cellH = availableH / Math.max(rows, 1)

    return scrambled.map((letter, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      return {
        id: `${letter}-${i}-${Date.now()}`,
        letter,
        x: safeLeft + col * cellW + cellW / 2 + (Math.random() - 0.5) * 30,
        y: safeTop + row * cellH + cellH / 2 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2.5,
        vy: (Math.random() - 0.5) * 2.5,
        popping: false,
        captured: false,
      }
    })
  }, [])

  // Setup a new word
  const setupWord = useCallback((gameWords, index, width, height) => {
    if (index >= gameWords.length) return false
    const w = gameWords[index]
    setBubbles(createBubbles(w.word, width, height))
    setPlacedLetters([])
    setFeedback(null)
    setCombo(0)
    return true
  }, [createBubbles])

  // Start the game
  const startGame = useCallback(() => {
    const gameWords = pickGameWords()
    setWords(gameWords)
    setWordIndex(0)
    setDisplayScore(0)
    setDisplayTime(GAME_DURATION)
    setWordsCompleted(0)
    setSkippedWords([])
    setStreak(0)
    scoreRef.current = 0
    streakRef.current = 0

    // Use container dimensions for initial setup
    const width = containerRef.current?.clientWidth || 400
    const height = containerRef.current?.clientHeight || 700
    setupWord(gameWords, 0, width, height)
    setPhase('playing')
  }, [setupWord])

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return

    timerRef.current = setInterval(() => {
      setDisplayTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setPhase('results')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [phase])

  // Bubble physics animation loop
  useEffect(() => {
    if (phase !== 'playing') return

    const animate = () => {
      setBubbles(prev => prev.map(bubble => {
        if (bubble.captured || bubble.popping) return bubble

        let { x, y, vx, vy } = bubble
        const width = containerRef.current?.clientWidth || 400
        const height = containerRef.current?.clientHeight || 700
        const safeLeft = 30
        const safeRight = width - 30
        const safeTop = 140
        const safeBottom = height - 220

        // Update position
        x += vx
        y += vy

        // Bounce off safe zone walls
        if (x <= safeLeft || x >= safeRight) {
          vx = -vx
          x = x <= safeLeft ? safeLeft : safeRight
        }
        if (y <= safeTop || y >= safeBottom) {
          vy = -vy
          y = y <= safeTop ? safeTop : safeBottom
        }

        return { ...bubble, x, y, vx, vy }
      }))

      // Update particles
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.3, // gravity
        opacity: p.opacity - 0.02
      })).filter(p => p.opacity > 0))

      // Decay screen shake
      setScreenShake(prev => Math.max(0, prev - 1))

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [phase])

  // Handle bubble pop
  const handleBubblePop = useCallback((bubble, currentWordObj) => {
    if (phase !== 'playing' || bubble.captured || bubble.popping || feedback === 'correct') return

    const currentWord = currentWordObj.word
    const nextIndex = placedLetters.length

    // Check if this is the correct next letter
    if (bubble.letter === currentWord[nextIndex]) {
      // CORRECT! Pop and capture
      setBubbles(prev => prev.map(b =>
        b.id === bubble.id ? { ...b, popping: true, captured: true } : b
      ))
      setPlacedLetters(prev => [...prev, { id: bubble.id, letter: bubble.letter }])
      setCombo(prev => prev + 1)

      // Pop sound
      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/pop2.mp3')
        sound.volume = 0.3
        sound.playbackRate = 1 + (combo * 0.1)
        sound.play().catch(() => {})
      } catch {
        // Ignore audio errors
      }

      // Create pop particles
      const colors = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6']
      const newParticles = Array.from({ length: 8 }, (_, i) => ({
        id: `${bubble.id}-particle-${i}`,
        x: bubble.x,
        y: bubble.y,
        vx: Math.cos(i * Math.PI / 4) * 3,
        vy: Math.sin(i * Math.PI / 4) * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...newParticles])

    } else {
      // WRONG! Explode and respawn
      setBubbles(prev => prev.map(b =>
        b.id === bubble.id ? { ...b, popping: true } : b
      ))
      setCombo(0)
      setScreenShake(10)

      // Wrong sound
      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/flappy-hit.mp3')
        sound.volume = 0.3
        sound.play().catch(() => {})
      } catch {
        // Ignore audio errors
      }

      // Red explosion particles
      const explosionParticles = Array.from({ length: 12 }, (_, i) => ({
        id: `${bubble.id}-explosion-${i}`,
        x: bubble.x,
        y: bubble.y,
        vx: Math.cos(i * Math.PI / 6) * 5,
        vy: Math.sin(i * Math.PI / 6) * 5,
        color: '#ef4444',
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...explosionParticles])

      // Respawn bubble after delay in safe zone
      setTimeout(() => {
        const w = containerRef.current?.clientWidth || 400
        const h = containerRef.current?.clientHeight || 700
        setBubbles(prev => prev.map(b =>
          b.id === bubble.id
            ? {
                ...b,
                popping: false,
                x: Math.random() * (w - 60) + 30,
                y: Math.random() * (h - 400) + 140,
                vx: (Math.random() - 0.5) * 2.5,
                vy: (Math.random() - 0.5) * 2.5,
              }
            : b
        ))
      }, 300)
    }
  }, [phase, feedback, placedLetters, combo])

  // Skip current word
  const handleSkip = useCallback(() => {
    if (phase !== 'playing' || feedback === 'correct') return
    streakRef.current = 0
    setStreak(0)
    setSkippedWords(prev => [...prev, words[wordIndex]])
    setDisplayTime(prev => Math.max(1, prev - 2))
    const nextIdx = wordIndex + 1
    if (nextIdx < words.length) {
      setWordIndex(nextIdx)
      const width = containerRef.current?.clientWidth || 400
      const height = containerRef.current?.clientHeight || 700
      setupWord(words, nextIdx, width, height)
    } else {
      setPhase('results')
    }
  }, [phase, feedback, wordIndex, words, setupWord])

  // Handle tapping a placed letter to remove it
  const handlePlacedTap = useCallback((letterObj) => {
    if (phase !== 'playing' || feedback === 'correct') return

    // Remove from placed
    setPlacedLetters(prev => prev.filter(l => l.id !== letterObj.id))
    // Un-capture bubble
    setBubbles(prev => prev.map(b =>
      b.id === letterObj.id ? { ...b, captured: false, popping: false } : b
    ))
  }, [phase, feedback])

  // Check if word is complete
  useEffect(() => {
    if (phase !== 'playing' || !words[wordIndex]) return

    const currentWord = words[wordIndex].word
    if (placedLetters.length !== currentWord.length) return

    const attempt = placedLetters.map(l => l.letter).join('')

    if (attempt === currentWord) {
      // Correct! Word complete!
      const newStreak = streakRef.current + 1
      streakRef.current = newStreak
      setStreak(newStreak)
      const bonus = newStreak > 1 ? STREAK_BONUS * (newStreak - 1) : 0
      const comboBonus = combo > 5 ? combo * 2 : 0
      const points = POINTS_PER_WORD + bonus + comboBonus
      scoreRef.current += points
      setDisplayScore(scoreRef.current)
      setWordsCompleted(prev => prev + 1)
      setFeedback('correct')
      setScreenShake(15)

      // Victory sound
      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/scram-correct.mp3')
        sound.volume = 0.5
        sound.playbackRate = 1.2
        sound.play().catch(() => {})
      } catch {
        // Ignore audio errors
      }

      // Big celebration particles
      const colors = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981']
      const celebrationParticles = Array.from({ length: 30 }, (_, i) => ({
        id: `celebration-${Date.now()}-${i}`,
        x: (containerRef.current?.clientWidth || 400) / 2,
        y: (containerRef.current?.clientHeight || 700) / 2,
        vx: Math.cos(i * Math.PI / 15) * (5 + Math.random() * 3),
        vy: Math.sin(i * Math.PI / 15) * (5 + Math.random() * 3),
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...celebrationParticles])

      // Advance to next word after brief delay
      setTimeout(() => {
        const nextIdx = wordIndex + 1
        if (nextIdx < words.length) {
          setWordIndex(nextIdx)
          const width = containerRef.current?.clientWidth || 400
          const height = containerRef.current?.clientHeight || 700
          setupWord(words, nextIdx, width, height)
        } else {
          // All words done
          setPhase('results')
        }
      }, 800)
    }
  }, [placedLetters, phase, words, wordIndex, setupWord, combo])

  const currentWord = words[wordIndex]

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes scramblePopIn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes scrambleCorrect {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes scrambleShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes scrambleFloat {
          0%, 100% { transform: translateY(-4px); }
          50% { transform: translateY(4px); }
        }
        @keyframes scrambleResultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scrambleScorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes streakPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes timerUrgent {
          0%, 100% { transform: scale(1) rotate(0deg); }
          15% { transform: scale(1.1) rotate(-3deg); }
          30% { transform: scale(1) rotate(3deg); }
          45% { transform: scale(1.05) rotate(-2deg); }
          60% { transform: scale(1) rotate(0deg); }
        }
        @keyframes timerRingSpin {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        @keyframes letterBounceIn {
          0% { transform: scale(0) rotate(-10deg); }
          60% { transform: scale(1.15) rotate(3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>

      {/* Narrow portrait game container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >

      {/* Decorative circles */}
      <div className="absolute top-[-10%] right-[-5%] w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-80 h-80 rounded-full bg-white/5 pointer-events-none" />

      {/* Close Button */}
      {phase !== 'results' && (
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-colors"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Ready Phase */}
      {phase === 'ready' && (
        <div className="flex flex-col items-center gap-6 p-8 text-center">
          {/* Pet */}
          <div style={{ animation: 'scrambleFloat 1.5s ease-in-out infinite' }}>
            {petImageUrl ? (
              <img src={petImageUrl} alt={petName} className="w-24 h-24 object-contain drop-shadow-lg"
                onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = ''; }}
              />
            ) : null}
            <span className="text-7xl" style={{ display: petImageUrl ? 'none' : '' }}>🔤</span>
          </div>

          <div>
            <h2 className="text-3xl font-black text-white mb-2"
              style={{ textShadow: '0 2px 0 rgba(0,0,0,0.2)' }}
            >
              Word Scramble
            </h2>
            <p className="text-lg text-white/80 mb-1">
              Pop the bubbles in the right order!
            </p>
            <p className="text-sm text-white/60">
              Train {petName}&apos;s brain!
            </p>
          </div>

          <button
            onClick={startGame}
            className="px-10 py-4 bg-white text-purple-700 rounded-full font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-b-4 border-purple-200"
          >
            Start!
          </button>
        </div>
      )}

      {/* Playing Phase */}
      {phase === 'playing' && currentWord && (
        <div
          ref={gameAreaRef}
          className="w-full h-full relative"
          style={{
            transform: screenShake > 0 ? `translate(${Math.sin(screenShake) * 5}px, ${Math.cos(screenShake) * 5}px)` : 'none'
          }}
        >
          {/* Floating Bubbles */}
          {bubbles.map(bubble => (
            <button
              key={bubble.id}
              onClick={() => handleBubblePop(bubble, currentWord)}
              disabled={bubble.captured || bubble.popping}
              className={`absolute w-[72px] h-[72px] rounded-full font-bold text-3xl uppercase flex items-center justify-center cursor-pointer ${
                bubble.captured
                  ? 'opacity-0 scale-0'
                  : bubble.popping
                    ? 'scale-150 opacity-0'
                    : 'bg-gradient-to-br from-yellow-300 to-orange-400 text-white shadow-2xl border-4 border-white/50 hover:scale-110 active:scale-90'
              }`}
              style={{
                left: `${bubble.x}px`,
                top: `${bubble.y}px`,
                transform: 'translate(-50%, -50%)',
                transition: bubble.popping ? 'all 0.3s ease-out' : 'transform 0.15s ease-out',
                boxShadow: bubble.captured || bubble.popping ? 'none' : '0 8px 20px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.2)',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {!bubble.popping && bubble.letter}
            </button>
          ))}

          {/* Particles */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute w-3 h-3 rounded-full pointer-events-none"
              style={{
                left: `${particle.x}px`,
                top: `${particle.y}px`,
                backgroundColor: particle.color,
                opacity: particle.opacity,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}

          {/* === TOP HUD === */}
          <div className="absolute top-0 left-0 right-0 p-4 z-10 pointer-events-none">
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2 pointer-events-auto">
              {/* Score / Pet / Timer row */}
              <div className="w-full flex items-center justify-between pl-12">
                <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2">
                  <span className="text-xl font-black text-white">{displayScore}</span>
                </div>

                <div className="flex items-center gap-2">
                  {streak > 1 && (
                    <div className="bg-yellow-400 text-yellow-900 rounded-full px-3 py-1 text-sm font-bold"
                      style={{ animation: 'streakPulse 0.6s ease-in-out' }}
                    >
                      {streak}x
                    </div>
                  )}
                  {combo > 3 && (
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-3 py-1 text-sm font-bold shadow-lg"
                      style={{ animation: 'streakPulse 0.6s ease-in-out' }}
                    >
                      🔥{combo}x
                    </div>
                  )}
                  {petImageUrl && (
                    <img src={petImageUrl} alt={petName}
                      className="w-10 h-10 object-contain drop-shadow-md"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  )}
                </div>

                {(() => {
                  const pct = displayTime / GAME_DURATION
                  const radius = 22
                  const circumference = 2 * Math.PI * radius
                  const offset = circumference * (1 - pct)
                  const color = displayTime <= 5 ? '#ef4444' : displayTime <= 10 ? '#f97316' : displayTime <= 20 ? '#eab308' : '#22c55e'
                  return (
                    <div
                      className="relative flex items-center justify-center"
                      style={{
                        animation: displayTime <= 5
                          ? 'timerUrgent 0.5s ease-in-out infinite'
                          : displayTime <= 10
                            ? 'timerUrgent 1s ease-in-out infinite'
                            : 'none'
                      }}
                    >
                      <svg width="56" height="56" className="drop-shadow-lg" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="28" cy="28" r={radius} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                        <circle
                          cx="28" cy="28" r={radius}
                          fill="none"
                          stroke={color}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                        />
                      </svg>
                      <span
                        className="absolute font-black text-white"
                        style={{
                          fontSize: displayTime < 10 ? '18px' : '16px',
                          textShadow: `0 0 8px ${color}80, 0 1px 2px rgba(0,0,0,0.3)`,
                        }}
                      >
                        {displayTime}
                      </span>
                    </div>
                  )
                })()}
              </div>

              {/* Hint */}
              <div className="bg-white/10 backdrop-blur rounded-xl px-6 py-2 text-center">
                <span className="text-sm text-white/60 mr-2">Hint:</span>
                <span className="text-xl font-bold text-white">{currentWord.hint}</span>
              </div>
            </div>
          </div>

          {/* === BOTTOM: Answer Slots === */}
          <div className="absolute bottom-0 left-0 right-0 pb-8 pt-4 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%)' }}
          >
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-3 pointer-events-auto">
              {/* Answer slots */}
              <div
                className="flex gap-2 justify-center flex-wrap"
                style={{
                  animation: feedback === 'correct'
                    ? 'scrambleCorrect 0.4s ease-out'
                    : 'none'
                }}
              >
                {currentWord.word.split('').map((_, i) => {
                  const placed = placedLetters[i]
                  return (
                    <button
                      key={i}
                      onClick={() => placed && handlePlacedTap(placed)}
                      className={`w-11 h-12 rounded-xl font-bold text-xl uppercase flex items-center justify-center transition-all ${
                        placed
                          ? feedback === 'correct'
                            ? 'bg-green-400 text-white border-2 border-green-500 shadow-lg'
                            : 'bg-white text-purple-800 border-2 border-purple-200 shadow-md cursor-pointer hover:scale-105 active:scale-95'
                          : 'bg-white/20 border-2 border-dashed border-white/40'
                      }`}
                      disabled={!placed || feedback === 'correct'}
                      style={placed ? { animation: 'letterBounceIn 0.25s ease-out' } : {}}
                    >
                      {placed?.letter || ''}
                    </button>
                  )
                })}
              </div>

              {/* Skip + Instruction */}
              <div className="flex items-center gap-3">

                <button
                  onClick={handleSkip}
                  className="text-xs text-white/50 hover:text-white/80 underline transition-colors"
                >
                  Skip (-2s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Phase */}
      {phase === 'results' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto p-6 z-50">
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center my-auto"
            style={{ animation: 'scrambleResultsFadeIn 0.5s ease-out' }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-100 mb-4"
              style={{ animation: 'scrambleScorePopIn 0.6s ease-out 0.3s both' }}
            >
              <Trophy className="w-10 h-10 text-purple-500" />
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {wordsCompleted >= 10 ? 'Training Complete!' : 'Not Enough Words!'}
            </h2>
            <p className="text-gray-500 mb-5">
              {wordsCompleted >= 10
                ? `${petName} learned ${wordsCompleted} words!`
                : `${petName} only learned ${wordsCompleted}/10 words`}
            </p>

            <div
              className={`rounded-2xl p-5 mb-5 border ${wordsCompleted >= 10 ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
              style={{ animation: 'scrambleScorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className={`text-5xl font-black ${wordsCompleted >= 10 ? 'text-purple-600' : 'text-gray-400'}`}>{wordsCompleted}</p>
              <p className={`text-sm font-semibold mt-1 ${wordsCompleted >= 10 ? 'text-purple-400' : 'text-gray-400'}`}>words completed</p>
            </div>

            {/* Skipped Words */}
            {skippedWords.length > 0 && (
              <div className="mb-5 text-left">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">Words to Practice</p>
                <div className="max-h-[180px] overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {skippedWords.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                      <span className="font-bold text-sm text-gray-800">{w.word}</span>
                      <span className="text-xs text-gray-400 ml-auto">{w.hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-6">
              {wordsCompleted >= 15
                ? 'Vocabulary master! 🏆'
                : wordsCompleted >= 10
                  ? 'Amazing speller! 🌟'
                  : 'Need at least 10 words to earn XP. Try again! 💪'}
            </p>

            {wordsCompleted >= 10 ? (
              <button
                onClick={() => onGameEnd(displayScore, wordsCompleted)}
                className="w-full py-3.5 bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-purple-700 active:border-b-0 active:mt-1 transition-all"
              >
                Collect Rewards ✨
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setPhase('ready')
                    setDisplayScore(0)
                    setWordsCompleted(0)
                  }}
                  className="w-full py-3.5 bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-purple-700 active:border-b-0 active:mt-1 transition-all"
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

export default PetWordScramble
