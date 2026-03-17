import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Volume2, VolumeX } from 'lucide-react'
import WORD_BANK from './wordBank'

import { assetUrl } from '../../hooks/useBranding';
const GAME_DURATION = 76
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
const pickGameWords = (source) => {
  const short = shuffle(source.filter(w => w.word.length <= 4)).slice(0, 5)
  const medium = shuffle(source.filter(w => w.word.length === 5)).slice(0, 5)
  const long = shuffle(source.filter(w => w.word.length === 6)).slice(0, 5)
  const longer = shuffle(source.filter(w => w.word.length >= 7)).slice(0, 5)
  // Interleave: one from each bucket per round
  const buckets = [short, medium, long, longer]
  const picked = []
  const maxLen = Math.max(...buckets.map(b => b.length))
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length) picked.push(bucket[i])
    }
  }
  // If not enough words, fill from remaining pool
  if (picked.length < 20) {
    const pickedWords = new Set(picked.map(w => w.word))
    const remaining = shuffle(source.filter(w => !pickedWords.has(w.word)))
    picked.push(...remaining.slice(0, 20 - picked.length))
  }
  return picked
}

const PetWordScramble = ({ petImageUrl, petName, onGameEnd, onClose, wordBank: wordBankProp = [], hideClose = false, scoreToBeat = null, leaderboard = [], chestEnabled = false, pvpOpponentPetUrl = null, initialWords = null, onProgressUpdate = null, opponentProgress = null, isRealtimePvP = false }) => {
  const [phase, setPhase] = useState('ready') // 'ready' | 'playing' | 'results'
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [words, setWords] = useState([])
  const [wordIndex, setWordIndex] = useState(0)
  const [bubbles, setBubbles] = useState([]) // { id, letter, x, y, vx, vy, popping, captured }
  const [placedLetters, setPlacedLetters] = useState([]) // { id, letter }
  const [combo, setCombo] = useState(0)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong' | null
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [particles, setParticles] = useState([]) // explosion particles
  const [screenShake, setScreenShake] = useState(0)
  const [skippedWords, setSkippedWords] = useState([])
  const [muted, setMuted] = useState(false)
  const [wordPopup, setWordPopup] = useState(null) // { points, streak, combo }
  const [chestCollected, setChestCollected] = useState(false)
  const [chestPopup, setChestPopup] = useState(false)
  const [chestMissed, setChestMissed] = useState(false)
  const [chestTimer, setChestTimer] = useState(0)

  const scoreRef = useRef(0)
  const timerRef = useRef(null)
  const streakRef = useRef(0)
  const scoredWordIndexRef = useRef(-1)
  const animationFrameRef = useRef(null)
  const gameAreaRef = useRef(null)
  const containerRef = useRef(null)
  const bgMusicRef = useRef(null)
  const audioCache = useRef({})
  const chestSpawnedRef = useRef(false)
  const chestWordRef = useRef(0)
  const [chestWordIndex, setChestWordIndex] = useState(-1)

  const playSound = useCallback((url, volume = 0.5, rate = 1) => {
    try {
      if (!audioCache.current[url]) {
        audioCache.current[url] = new Audio(url)
      }
      const sound = audioCache.current[url]
      sound.volume = volume
      sound.playbackRate = rate
      sound.currentTime = 0
      sound.play().catch(() => {})
    } catch {}
  }, [])

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
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
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
    return true
  }, [createBubbles])

  // Start the game
  const startGame = useCallback(() => {
    const gameWords = initialWords || pickGameWords(wordBankProp.length > 0 ? wordBankProp : WORD_BANK)
    setWords(gameWords)
    setWordIndex(0)
    setDisplayScore(0)
    setDisplayTime(GAME_DURATION)
    setWordsCompleted(0)
    setSkippedWords([])

    scoreRef.current = 0
    streakRef.current = 0
    scoredWordIndexRef.current = -1
    setCombo(0)
    chestSpawnedRef.current = false
    // Pick a long word (6+ letters) for chest, fallback to random 3-7
    const longWordIndices = gameWords
      .map((w, i) => ({ i, len: w.word.length }))
      .filter(w => w.len >= 6 && w.i >= 3 && w.i <= 9)
    const chestIdx = longWordIndices.length > 0
      ? longWordIndices[Math.floor(Math.random() * longWordIndices.length)].i + 1
      : 3 + Math.floor(Math.random() * 5)
    chestWordRef.current = chestIdx
    setChestWordIndex(chestEnabled ? chestIdx : -1)
    setChestCollected(false)
    setChestPopup(false)
    setChestMissed(false)

    // Use container dimensions for initial setup
    const width = containerRef.current?.clientWidth || 400
    const height = containerRef.current?.clientHeight || 700
    setupWord(gameWords, 0, width, height)
    setPhase('playing')

    // Start background music
    try {
      const music = new Audio(assetUrl('/sound/pet-word-scamble-2-faster.mp3'))
      music.loop = true
      music.volume = 0.3
      bgMusicRef.current = music
      music.play().catch(() => {})
    } catch {}
  }, [setupWord])

  // Auto-start for realtime PvP (skip the ready screen)
  useEffect(() => {
    if (isRealtimePvP && phase === 'ready') {
      startGame()
    }
  }, [isRealtimePvP])

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

  // Start chest timer when reaching the chest word
  useEffect(() => {
    if (phase === 'playing' && chestWordIndex >= 0 && !chestSpawnedRef.current && wordsCompleted === chestWordIndex - 1) {
      setChestTimer(10)
    }
  }, [phase, wordsCompleted, chestWordIndex])

  // Chest word countdown
  useEffect(() => {
    if (chestTimer <= 0) return
    const interval = setInterval(() => {
      setChestTimer(prev => {
        if (prev <= 1) {
          if (!chestSpawnedRef.current) {
            chestSpawnedRef.current = true
            setChestMissed(true)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [chestTimer])

  // Stop background music when game ends
  useEffect(() => {
    if (phase === 'results' && bgMusicRef.current) {
      bgMusicRef.current.pause()
      bgMusicRef.current = null
    }
  }, [phase])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause()
        bgMusicRef.current = null
      }
    }
  }, [])

  // Bubble physics animation loop
  useEffect(() => {
    if (phase !== 'playing') return

    const animate = () => {
      setBubbles(prev => {
        const width = containerRef.current?.clientWidth || 400
        const height = containerRef.current?.clientHeight || 700
        const safeLeft = 30
        const safeRight = width - 30
        const safeTop = 140
        const safeBottom = height - 220

        // First pass: update positions and wall bounces
        const updated = prev.map(bubble => {
          if (bubble.captured || bubble.popping) return bubble

          let { x, y, vx, vy } = bubble
          x += vx
          y += vy

          if (x <= safeLeft || x >= safeRight) {
            vx = -vx
            x = x <= safeLeft ? safeLeft : safeRight
          }
          if (y <= safeTop || y >= safeBottom) {
            vy = -vy
            y = y <= safeTop ? safeTop : safeBottom
          }

          return { ...bubble, x, y, vx, vy }
        })

        // Second pass: bubble-to-bubble collisions
        const minDist = 88 // bubble diameter (radius 44 * 2)
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].captured || updated[i].popping) continue
          for (let j = i + 1; j < updated.length; j++) {
            if (updated[j].captured || updated[j].popping) continue

            const dx = updated[j].x - updated[i].x
            const dy = updated[j].y - updated[i].y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist < minDist && dist > 0.01) {
              const nx = dx / dist
              const ny = dy / dist

              // Relative velocity along collision normal
              const dvn = (updated[i].vx - updated[j].vx) * nx + (updated[i].vy - updated[j].vy) * ny
              if (dvn <= 0) continue // already moving apart

              // Elastic collision (equal mass): swap velocity components along normal
              updated[i] = { ...updated[i], vx: updated[i].vx - dvn * nx, vy: updated[i].vy - dvn * ny }
              updated[j] = { ...updated[j], vx: updated[j].vx + dvn * nx, vy: updated[j].vy + dvn * ny }

              // Push apart to resolve overlap
              const overlap = (minDist - dist) / 2
              updated[i] = { ...updated[i], x: updated[i].x - overlap * nx, y: updated[i].y - overlap * ny }
              updated[j] = { ...updated[j], x: updated[j].x + overlap * nx, y: updated[j].y + overlap * ny }
            }
          }
        }

        return updated
      })

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
      playSound(assetUrl('/sound/pop2.mp3'), 0.3, 1)

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

      // Wrong letter on chest word = chest lost
      if (chestEnabled && !chestSpawnedRef.current && wordsCompleted === chestWordRef.current - 1) {
        chestSpawnedRef.current = true
        setChestMissed(true)
        setChestTimer(0)
      }

      // Wrong sound
      playSound(assetUrl('/sound/flappy-hit.mp3'), 0.3)

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
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
              }
            : b
        ))
      }, 300)
    }
  }, [phase, feedback, placedLetters, chestEnabled, wordsCompleted, playSound])

  // Skip current word
  const handleSkip = useCallback(() => {
    if (phase !== 'playing' || feedback === 'correct') return
    streakRef.current = Math.max(0, streakRef.current - 1)

    // If skipping the chest word, chest is lost
    if (chestEnabled && !chestSpawnedRef.current && wordsCompleted === chestWordRef.current - 1) {
      chestSpawnedRef.current = true
      setChestMissed(true)
      setChestTimer(0)
    }

    setCombo(0)
    setSkippedWords(prev => [...prev, words[wordIndex]])
    const nextIdx = wordIndex + 1
    if (nextIdx < words.length) {
      setWordIndex(nextIdx)
      const width = containerRef.current?.clientWidth || 400
      const height = containerRef.current?.clientHeight || 700
      setupWord(words, nextIdx, width, height)
    } else {
      const source = wordBankProp.length > 0 ? wordBankProp : WORD_BANK
      const moreWords = pickGameWords(source)
      setWords(moreWords)
      setWordIndex(0)
      scoredWordIndexRef.current = -1
      const width = containerRef.current?.clientWidth || 400
      const height = containerRef.current?.clientHeight || 700
      setupWord(moreWords, 0, width, height)
    }
  }, [phase, feedback, wordIndex, words, setupWord, wordBankProp, chestEnabled, wordsCompleted])

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
      // Guard: don't score the same word twice
      if (scoredWordIndexRef.current === wordIndex) return
      scoredWordIndexRef.current = wordIndex

      // Correct! Word complete!
      const newStreak = streakRef.current + 1
      streakRef.current = newStreak

      const lengthBonus = Math.max(0, currentWord.length - 4) * 5
      const bonus = newStreak > 1 ? STREAK_BONUS * (newStreak - 1) : 0
      const points = POINTS_PER_WORD + lengthBonus + bonus
      scoreRef.current += points
      setDisplayScore(scoreRef.current)
      setWordsCompleted(prev => prev + 1)

      // Broadcast progress for realtime PvP
      if (onProgressUpdate) {
        onProgressUpdate({ score: scoreRef.current, wordsCompleted: wordsCompleted + 1, wordIndex: wordIndex + 1 })
      }

      setFeedback('correct')
      setScreenShake(15)
      setWordPopup({ points, streak: newStreak, combo })
      setTimeout(() => setWordPopup(null), 1200)

      // Victory sound
      playSound(assetUrl('/sound/scram-correct.mp3'), 0.5, 1.2)

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

      // Chest check
      if (chestEnabled && !chestSpawnedRef.current && wordsCompleted === chestWordRef.current - 1) {
        chestSpawnedRef.current = true
        setChestCollected(true)
        setChestTimer(0)
        setChestPopup(true)
        setTimeout(() => setChestPopup(false), 1500)
      }

      // Advance to next word after brief delay
      setTimeout(() => {
        const nextIdx = wordIndex + 1
        if (nextIdx < words.length) {
          setWordIndex(nextIdx)
          const width = containerRef.current?.clientWidth || 400
          const height = containerRef.current?.clientHeight || 700
          setupWord(words, nextIdx, width, height)
        } else {
          // Pick more words and continue — replace array to avoid unbounded growth
          const source = wordBankProp.length > 0 ? wordBankProp : WORD_BANK
          const moreWords = pickGameWords(source)
          setWords(moreWords)
          setWordIndex(0)
          scoredWordIndexRef.current = -1
          const width = containerRef.current?.clientWidth || 400
          const height = containerRef.current?.clientHeight || 700
          setupWord(moreWords, 0, width, height)
        }
      }, 800)
    }
  }, [placedLetters, phase, words, wordIndex, setupWord, combo, wordBankProp])

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
        @keyframes wordPopupAnim {
          0% { transform: scale(0.5) translateY(0); opacity: 0; }
          15% { transform: scale(1.1) translateY(0); opacity: 1; }
          30% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(-60px); opacity: 0; }
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
        @keyframes chestPopupAnim {
          0% { transform: scale(0) translateY(0); opacity: 0; }
          20% { transform: scale(1.2) translateY(0); opacity: 1; }
          40% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(-80px); opacity: 0; }
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
      {phase !== 'results' && !hideClose && (
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
          <div className="flex items-center gap-4" style={{ animation: 'scrambleFloat 1.5s ease-in-out infinite' }}>
            {petImageUrl ? (
              <img src={petImageUrl} alt={petName} className="w-24 h-24 object-contain drop-shadow-lg"
                onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = ''; }}
              />
            ) : null}
            <span className="text-7xl" style={{ display: petImageUrl ? 'none' : '' }}>🔤</span>
            {pvpOpponentPetUrl && (
              <>
                <span className="text-2xl font-black text-red-400" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>VS</span>
                <img src={pvpOpponentPetUrl} alt="Opponent" className="w-24 h-24 object-contain drop-shadow-lg" style={{ transform: 'scaleX(-1)' }} />
              </>
            )}
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
          {bubbles.map(bubble => {
            const nextLetter = currentWord?.word?.[placedLetters.length]
            const isNext = !bubble.captured && !bubble.popping && bubble.letter === nextLetter
            return (
            <button
              key={bubble.id}
              onPointerDown={(e) => { e.preventDefault(); handleBubblePop(bubble, currentWord) }}
              disabled={bubble.captured || bubble.popping}
              className={`absolute rounded-full font-bold text-3xl uppercase flex items-center justify-center cursor-pointer touch-none ${
                bubble.captured
                  ? 'opacity-0 scale-0'
                  : bubble.popping
                    ? 'scale-150 opacity-0'
                    : 'bg-gradient-to-br from-yellow-300 to-orange-400 text-white shadow-2xl border-4 border-white/50 hover:scale-110 active:scale-90'
              }`}
              style={{
                left: `${bubble.x - 44}px`,
                top: `${bubble.y - 44}px`,
                width: '88px',
                height: '88px',
                zIndex: isNext ? 5 : 1,
                transition: bubble.popping ? 'all 0.3s ease-out' : 'transform 0.15s ease-out',
                boxShadow: bubble.captured || bubble.popping ? 'none' : '0 8px 20px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.2)',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {!bubble.popping && bubble.letter}
            </button>
            )
          })}

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
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2">
                    <span className="text-xl font-black text-white">{displayScore}</span>
                  </div>
                  {(() => {
                    const nextToBeat = leaderboard.length > 0
                      ? [...leaderboard].reverse().find(e => e.score > displayScore) || null
                      : scoreToBeat
                    if (!nextToBeat) return null
                    const gap = nextToBeat.score - displayScore
                    const isClose = gap > 0 && gap <= 3
                    const pct = Math.min(100, Math.round((displayScore / nextToBeat.score) * 100))
                    return (
                      <div className="w-28 ml-1" style={{ animation: isClose ? 'hintPulse 0.6s ease-in-out infinite' : 'none' }}>
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px]">⚔️</span>
                            <span className="text-white font-bold text-[10px] truncate max-w-[50px]">{nextToBeat.name}</span>
                          </div>
                          <span className={`font-black text-[10px] ${isClose ? 'text-orange-300' : 'text-yellow-300'}`}>
                            {isClose ? `${gap} more!` : `+${gap}pts`}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: isClose ? 'linear-gradient(90deg, #f97316, #ef4444)' : 'linear-gradient(90deg, #22c55e, #86efac)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {petImageUrl && (
                  <img src={petImageUrl} alt={petName}
                    className="w-10 h-10 object-contain drop-shadow-md"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                )}

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

                {/* Mute Button */}
                <button
                  onClick={() => {
                    setMuted(prev => {
                      const next = !prev
                      if (bgMusicRef.current) bgMusicRef.current.muted = next
                      return next
                    })
                  }}
                  className="bg-white/20 backdrop-blur rounded-full p-1.5"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>
              </div>

              {/* Realtime PvP scoreboard */}
              {isRealtimePvP && opponentProgress && (
                <div className="flex items-center justify-center gap-3 w-full max-w-xs mx-auto">
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    {petImageUrl && <img src={petImageUrl} alt={petName} className="w-10 h-10 object-contain drop-shadow-lg" />}
                    <span className={`text-2xl font-black ${displayScore > opponentProgress.score ? 'text-green-300' : displayScore < opponentProgress.score ? 'text-white/60' : 'text-white'}`}
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{displayScore}</span>
                  </div>
                  <span className="text-white/30 font-black text-sm">vs</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-2xl font-black ${opponentProgress.score > displayScore ? 'text-red-300' : opponentProgress.score < displayScore ? 'text-white/60' : 'text-white'}`}
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{opponentProgress.score}</span>
                    {pvpOpponentPetUrl && <img src={pvpOpponentPetUrl} alt="Opponent" className="w-10 h-10 object-contain drop-shadow-lg" style={{ transform: 'scaleX(-1)' }} />}
                  </div>
                </div>
              )}

              {/* Hint + Streak/Combo */}
              <div className="w-full flex items-center gap-2">
                <div className={`rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1 shrink-0 ${
                  streakRef.current >= 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white/70'
                }`}>
                  <img src={assetUrl('/icon/profile/streak.svg')} alt="streak" className="w-3.5 h-3.5" />{streakRef.current}x
                </div>
                <div className="flex-1 bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center min-w-0">
                  <span className="text-sm text-white/60 mr-2">Hint:</span>
                  <span className="text-xl font-bold text-white">{currentWord.hint}</span>
                </div>
                <div className={`rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${
                  combo > 5 ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/20 text-white/70'
                }`}>
                  {combo}x
                </div>
              </div>

            </div>

            {/* Progress dots - outside pointer-events-auto wrapper */}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="relative"
                  style={{
                    width: 24,
                    height: 24,
                    transition: 'transform 0.3s ease',
                    transform: i === wordsCompleted ? 'scale(1.3)' : 'scale(1)',
                  }}
                >
                  {i < wordsCompleted ? (
                    <div className="w-full h-full rounded-full flex items-center justify-center text-xs"
                      style={{
                        background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                        boxShadow: '0 0 8px rgba(139,92,246,0.5)',
                        animation: 'streakPulse 0.4s ease-out',
                      }}
                    >
                      <span className="text-white font-bold">✓</span>
                    </div>
                  ) : i === wordsCompleted ? (
                    <div className="w-full h-full rounded-full border-2 border-white/60 flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.15)', animation: 'hintPulse 1.5s ease-in-out infinite' }}
                    >
                      <span className="text-white/80 font-bold text-[10px]">{i + 1}</span>
                    </div>
                  ) : (
                    <div className="w-full h-full rounded-full border border-white/20 flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <span className="text-white/30 text-[10px]">{i + 1}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Chest indicator - only show on the chest word */}
            {chestWordIndex >= 0 && !chestCollected && !chestMissed && wordsCompleted === chestWordIndex - 1 && chestTimer > 0 && (
              <div className="flex flex-col items-center mt-2 gap-1">
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${chestTimer <= 3 ? 'bg-red-500/40' : 'bg-amber-500/30'}`} style={{ animation: chestTimer <= 3 ? 'hintPulse 0.5s ease-in-out infinite' : 'hintPulse 1s ease-in-out infinite' }}>
                  <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-6 h-6 object-contain" />
                  <span className={`text-xs font-bold ${chestTimer <= 3 ? 'text-red-300' : 'text-amber-300'}`}>{chestTimer}s</span>
                </div>
                <div className="w-24 h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${chestTimer <= 3 ? 'bg-red-400' : 'bg-amber-400'}`}
                    style={{ width: `${(chestTimer / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* === CHEST POPUP === */}
          {chestPopup && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2" style={{ animation: 'chestPopupAnim 1.5s ease-out forwards' }}>
                <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-16 h-16 object-contain" />
                <div className="bg-amber-500 text-white rounded-full px-4 py-1.5 font-bold text-sm shadow-lg">
                  Chest Found!
                </div>
              </div>
            </div>
          )}

          {/* === CHEST MISSED POPUP === */}
          {chestMissed && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2" style={{ animation: 'chestPopupAnim 1.5s ease-out forwards' }}
                onAnimationEnd={() => setChestMissed(false)}
              >
                <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-16 h-16 object-contain opacity-50 grayscale" />
                <div className="bg-red-500 text-white rounded-full px-4 py-1.5 font-bold text-sm shadow-lg">
                  Chest Lost!
                </div>
              </div>
            </div>
          )}

          {/* === WORD COMPLETE POPUP === */}
          {wordPopup && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-1" style={{ animation: 'wordPopupAnim 1.2s ease-out forwards' }}>
                <div className="text-3xl font-black text-white drop-shadow-lg">+{wordPopup.points}</div>
                {wordPopup.streak > 1 && (
                  <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 rounded-full px-3 py-1 text-sm font-bold">
                    <img src={assetUrl('/icon/profile/streak.svg')} alt="streak" className="w-4 h-4" />{wordPopup.streak}x streak
                  </div>
                )}
                {wordPopup.combo > 5 && (
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-3 py-1 text-sm font-bold">
                    {wordPopup.combo}x combo
                  </div>
                )}
              </div>
            </div>
          )}

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
                  Skip
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

            {isRealtimePvP && opponentProgress ? (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {displayScore > opponentProgress.score ? 'You Win!' : displayScore < opponentProgress.score ? 'You Lose!' : "It's a Tie!"}
                </h2>
                <p className="text-gray-500 mb-5">
                  {displayScore > opponentProgress.score ? 'Great scrambling skills!' : displayScore < opponentProgress.score ? 'Better luck next time!' : 'Evenly matched!'}
                </p>
                <div className="flex items-center justify-center gap-4 mb-5">
                  <div className={`rounded-2xl p-4 border flex-1 ${displayScore >= opponentProgress.score ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
                    style={{ animation: 'scrambleScorePopIn 0.6s ease-out 0.5s both' }}>
                    <p className="text-xs font-semibold text-gray-400 mb-1">You</p>
                    <p className={`text-3xl font-black ${displayScore >= opponentProgress.score ? 'text-green-600' : 'text-gray-400'}`}>{displayScore}</p>
                    <p className="text-xs text-gray-400 mt-1">{wordsCompleted} words</p>
                  </div>
                  <span className="text-gray-300 font-bold text-lg">VS</span>
                  <div className={`rounded-2xl p-4 border flex-1 ${opponentProgress.score >= displayScore ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
                    style={{ animation: 'scrambleScorePopIn 0.6s ease-out 0.7s both' }}>
                    <p className="text-xs font-semibold text-gray-400 mb-1">Opponent</p>
                    <p className={`text-3xl font-black ${opponentProgress.score >= displayScore ? 'text-red-600' : 'text-gray-400'}`}>{opponentProgress.score}</p>
                    <p className="text-xs text-gray-400 mt-1">{opponentProgress.wordsCompleted} words</p>
                  </div>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}

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

            {!isRealtimePvP && (
              <p className="text-sm text-gray-600 mb-6">
                {wordsCompleted >= 15
                  ? 'Vocabulary master! 🏆'
                  : wordsCompleted >= 10
                    ? 'Amazing speller! 🌟'
                    : 'Need at least 10 words to earn XP. Try again! 💪'}
              </p>
            )}

            {chestCollected && (
              <div className="mb-4 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-8 h-8 object-contain" />
                <span className="font-bold text-amber-700">Chest collected!</span>
              </div>
            )}

            {isRealtimePvP || wordsCompleted >= 10 ? (
              <button
                onClick={() => onGameEnd(displayScore, { chestCollected, wordsCompleted })}
                className="w-full py-3.5 bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-purple-700 active:border-b-0 active:mt-1 transition-all"
              >
                {isRealtimePvP ? 'Done' : 'Collect Rewards ✨'}
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
