import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Volume2, VolumeX } from 'lucide-react'
import WORD_BANK from './wordBank'

import { assetUrl } from '../../hooks/useBranding';

const GAME_DURATION = 76
const POINTS_PER_WORD = 10
const STREAK_BONUS = 5

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pickGameWords = (source) => {
  const short = shuffle(source.filter(w => w.word.length <= 4)).slice(0, 6)
  const medium = shuffle(source.filter(w => w.word.length === 5)).slice(0, 5)
  const long = shuffle(source.filter(w => w.word.length === 6)).slice(0, 5)
  const longer = shuffle(source.filter(w => w.word.length >= 7)).slice(0, 4)
  const buckets = [short, medium, long, longer]
  const picked = []
  const maxLen = Math.max(...buckets.map(b => b.length))
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      if (i < bucket.length) picked.push(bucket[i])
    }
  }
  if (picked.length < 20) {
    const pickedWords = new Set(picked.map(w => w.word))
    const remaining = shuffle(source.filter(w => !pickedWords.has(w.word)))
    picked.push(...remaining.slice(0, 20 - picked.length))
  }
  return picked
}

const PetWordType = ({ petImageUrl, petName, onGameEnd, onClose, wordBank: wordBankProp = [], hideClose = false, scoreToBeat = null, leaderboard = [], chestEnabled = false, pvpOpponentPetUrl = null }) => {
  const [phase, setPhase] = useState('ready')
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [words, setWords] = useState([])
  const [wordIndex, setWordIndex] = useState(0)
  const [typedValue, setTypedValue] = useState('')
  const [streak, setStreak] = useState(0)
  const [combo, setCombo] = useState(0)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong' | null
  const [wrongFlash, setWrongFlash] = useState(false) // briefly flash cursor box red
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [skippedWords, setSkippedWords] = useState([])
  const [muted, setMuted] = useState(false)
  const [wordPopup, setWordPopup] = useState(null)
  const [screenShake, setScreenShake] = useState(0)
  const [particles, setParticles] = useState([])
  const [hintRevealed, setHintRevealed] = useState(0) // number of letters revealed
  const [chestCollected, setChestCollected] = useState(false)
  const [chestPopup, setChestPopup] = useState(false)
  const [isChestWord, setIsChestWord] = useState(false)
  const [chestTimer, setChestTimer] = useState(0)

  const scoreRef = useRef(0)
  const timerRef = useRef(null)
  const streakRef = useRef(0)
  const comboRef = useRef(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const bgMusicRef = useRef(null)
  const animFrameRef = useRef(null)
  const shakeRef = useRef(0)
  const chestSpawnedRef = useRef(false)
  const chestWordRef = useRef(0)

  const currentWord = words[wordIndex]

  const advanceWord = useCallback(() => {
    setTypedValue('')
    setFeedback(null)
    setHintRevealed(0)
    const nextIdx = wordIndex + 1
    if (nextIdx < words.length) {
      setWordIndex(nextIdx)
    } else {
      const source = wordBankProp.length > 0 ? wordBankProp : WORD_BANK
      const moreWords = pickGameWords(source)
      setWords(prev => [...prev, ...moreWords])
      setWordIndex(nextIdx)
    }
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [wordIndex, wordBankProp])

  const handleCheck = useCallback(() => {
    if (phase !== 'playing' || !currentWord) return

    const answer = typedValue.trim().toLowerCase()
    const correct = currentWord.word.toLowerCase()

    if (answer === correct) {
      // CORRECT
      const newStreak = streakRef.current + 1
      streakRef.current = newStreak
      setStreak(newStreak)

      const newCombo = comboRef.current + 1
      comboRef.current = newCombo
      setCombo(newCombo)

      // Points: base + streak bonus + combo bonus
      let points = POINTS_PER_WORD
      if (newStreak >= 3) points += STREAK_BONUS
      if (newCombo >= 5) points += Math.floor(newCombo / 5) * 2

      // Bonus for no hints used
      if (hintRevealed === 0) points += 5

      scoreRef.current += points
      setDisplayScore(scoreRef.current)
      setWordsCompleted(prev => prev + 1)

      if (chestEnabled && !chestSpawnedRef.current && wordsCompleted + 1 === chestWordRef.current) {
        chestSpawnedRef.current = true
        setChestCollected(true)
        setIsChestWord(false)
        setChestTimer(0)
        setChestPopup(true)
        setTimeout(() => setChestPopup(false), 1500)
      }

      setFeedback('correct')

      setWordPopup({ points, streak: newStreak, combo: newCombo })
      setTimeout(() => setWordPopup(null), 1200)

      // Celebration particles
      const colors = ['#a78bfa', '#f472b6', '#facc15', '#34d399', '#60a5fa']
      const celebrationParticles = Array.from({ length: 12 }, (_, i) => ({
        id: `p-${Date.now()}-${i}`,
        x: (containerRef.current?.clientWidth || 400) / 2 + (Math.random() - 0.5) * 100,
        y: (containerRef.current?.clientHeight || 700) / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 6 - 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...celebrationParticles])

      try {
        const sound = new Audio(assetUrl('/sound/scram-correct.mp3'))
        sound.volume = 0.4
        if (!muted) sound.play().catch(() => {})
      } catch {}

      setTimeout(() => advanceWord(), 600)
    } else {
      // WRONG
      streakRef.current = 0
      setStreak(0)
      setFeedback('wrong')
      shakeRef.current = 10
      setScreenShake(10)

      try {
        const sound = new Audio(assetUrl('/sound/flappy-hit.mp3'))
        sound.volume = 0.4
        if (!muted) sound.play().catch(() => {})
      } catch {}

      setTimeout(() => {
        // Reset to just the revealed prefix
        setTypedValue(currentWord.word.slice(0, hintRevealed))
        setFeedback(null)
        inputRef.current?.focus()
      }, 600)
    }
  }, [phase, currentWord, typedValue, hintRevealed, advanceWord, muted])

  // Auto-submit when all letters are typed
  useEffect(() => {
    if (phase !== 'playing' || !currentWord || feedback) return
    if (typedValue.length === currentWord.word.length) {
      handleCheck()
    }
  }, [typedValue, phase, currentWord, feedback, handleCheck])

  const handleSkip = useCallback(() => {
    if (!currentWord) return
    // Skipping chest word = chest lost
    if (chestEnabled && !chestSpawnedRef.current && wordsCompleted === chestWordRef.current - 1) {
      chestSpawnedRef.current = true
      setIsChestWord(false)
      setChestTimer(0)
    }
    streakRef.current = 0
    setStreak(0)
    comboRef.current = 0
    setCombo(0)
    setSkippedWords(prev => [...prev, currentWord])
    advanceWord()
  }, [currentWord, advanceWord])

  const handleRevealHint = useCallback(() => {
    if (!currentWord) return
    const maxReveal = Math.max(1, currentWord.word.length - 1)
    const newRevealed = Math.min(hintRevealed + 1, maxReveal)
    setHintRevealed(newRevealed)
    // Pre-fill typed value with revealed letters
    const revealed = currentWord.word.slice(0, newRevealed)
    setTypedValue(prev => {
      const after = prev.slice(newRevealed)
      return revealed + after
    })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [currentWord, hintRevealed])

  const startGame = useCallback(() => {
    const gameWords = pickGameWords(wordBankProp.length > 0 ? wordBankProp : WORD_BANK)
    setWords(gameWords)
    setWordIndex(0)
    setDisplayScore(0)
    setDisplayTime(GAME_DURATION)
    setWordsCompleted(0)
    setSkippedWords([])
    setTypedValue('')
    setHintRevealed(0)
    setFeedback(null)

    scoreRef.current = 0
    streakRef.current = 0
    comboRef.current = 0
    setStreak(0)
    setCombo(0)
    chestSpawnedRef.current = false
    chestWordRef.current = 3 + Math.floor(Math.random() * 5)
    setChestCollected(false)
    setChestPopup(false)
    setIsChestWord(false)
    setChestTimer(0)
    setPhase('playing')

    try {
      const music = new Audio(assetUrl('/sound/pet-word-scamble-2-faster.mp3'))
      music.loop = true
      music.volume = 0.3
      bgMusicRef.current = music
      music.play().catch(() => {})
    } catch {}

    setTimeout(() => inputRef.current?.focus(), 200)
  }, [wordBankProp])

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

  // Start chest timer when reaching chest word
  useEffect(() => {
    if (phase === 'playing' && chestEnabled && !chestSpawnedRef.current && wordsCompleted === chestWordRef.current - 1) {
      setIsChestWord(true)
      setChestTimer(5)
    }
  }, [phase, wordsCompleted, chestEnabled])

  // Chest timer countdown
  useEffect(() => {
    if (chestTimer <= 0) return
    const interval = setInterval(() => {
      setChestTimer(prev => {
        if (prev <= 1) {
          chestSpawnedRef.current = true
          setIsChestWord(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [chestTimer])

  // Stop music on results
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

  // Particle + shake animation
  useEffect(() => {
    if (phase !== 'playing') return
    const animate = () => {
      shakeRef.current = Math.max(0, shakeRef.current - 0.5)
      setScreenShake(shakeRef.current)
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15,
          opacity: p.opacity - 0.02,
        }))
        .filter(p => p.opacity > 0)
      )
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [phase])

  // Focus input when playing starts
  useEffect(() => {
    if (phase === 'playing') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [phase])

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes typePopIn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes typeCorrect {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes typeShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes typeFloat {
          0%, 100% { transform: translateY(-4px); }
          50% { transform: translateY(4px); }
        }
        @keyframes typeResultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typeScorePopIn {
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
        @keyframes hintPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes letterReveal {
          0% { transform: scale(0) rotateY(90deg); }
          60% { transform: scale(1.1) rotateY(-10deg); }
          100% { transform: scale(1) rotateY(0deg); }
        }
        @keyframes chestPopupAnim {
          0% { transform: scale(0) translateY(0); opacity: 0; }
          20% { transform: scale(1.2) translateY(0); opacity: 1; }
          40% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(-80px); opacity: 0; }
        }
      `}</style>

      <div
        ref={containerRef}
        className="relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #a855f7 100%)',
          transform: screenShake > 0 ? `translate(${Math.sin(screenShake * 2) * 3}px, ${Math.cos(screenShake * 2) * 3}px)` : 'none',
        }}
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
          <div className="flex items-center gap-4" style={{ animation: 'typeFloat 1.5s ease-in-out infinite' }}>
            {petImageUrl ? (
              <img src={petImageUrl} alt={petName} className="w-24 h-24 object-contain drop-shadow-lg"
                onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = ''; }}
              />
            ) : null}
            <span className="text-7xl" style={{ display: petImageUrl ? 'none' : '' }}>⌨️</span>
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
              Word Type
            </h2>
            <p className="text-lg text-white/80 mb-1">
              See the meaning, type the word!
            </p>
            <p className="text-sm text-white/60">
              Train {petName}&apos;s vocabulary!
            </p>
          </div>

          {leaderboard.length > 0 && (
            <div className="bg-white/15 backdrop-blur rounded-xl px-4 py-3 w-full max-w-xs">
              <p className="text-xs font-bold text-yellow-300 mb-2">Top 10</p>
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
            className="px-10 py-4 bg-white text-indigo-700 rounded-full font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-b-4 border-indigo-200"
          >
            Start!
          </button>
        </div>
      )}

      {/* Playing Phase */}
      {phase === 'playing' && currentWord && (
        <div className="w-full h-full relative flex flex-col">

          {/* Particles */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute w-3 h-3 rounded-full pointer-events-none z-30"
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
          <div className="px-4 pt-3 pb-1 z-10">
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2">
              {/* Score / Pet / Timer row */}
              <div className="w-full flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2">
                    <span className="text-xl font-black text-white">{displayScore}</span>
                  </div>
                  {/* Score-to-beat progress bar */}
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
                            <span className="text-[11px]">&#x2694;&#xFE0F;</span>
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

                {/* Timer */}
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

                {/* Mute */}
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

              {/* Streak + Combo */}
              <div className="w-full flex items-center gap-2">
                <div className={`rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1 shrink-0 ${
                  streak >= 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white/70'
                }`}>
                  <img src={assetUrl('/icon/profile/streak.svg')} alt="streak" className="w-3.5 h-3.5" />{streak}x
                </div>
                <div className="flex-1" />
                <div className={`rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${
                  combo > 5 ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/20 text-white/70'
                }`}>
                  {combo}x combo
                </div>
              </div>
            </div>
          </div>

          {/* === CENTER: Hint & Word === */}
          <div className="flex-1 flex flex-col items-center justify-start pt-4 px-6 gap-4 relative">

            {/* Word complete popup */}
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

            {chestPopup && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2" style={{ animation: 'chestPopupAnim 1.5s ease-out forwards' }}>
                  <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-16 h-16 object-contain" />
                  <div className="bg-amber-500 text-white rounded-full px-4 py-1.5 font-bold text-sm shadow-lg">Chest Found!</div>
                </div>
              </div>
            )}

            {/* Meaning/Hint display */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 w-full max-w-xs text-center border border-white/20">
              <p className="text-xs text-white/50 uppercase tracking-wider mb-1 font-semibold">Meaning</p>
              <p className="text-2xl font-bold text-white leading-snug" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                {currentWord.hint}
              </p>
              {currentWord.image_url && (
                <img src={currentWord.image_url} alt="" className="w-12 h-12 object-contain mx-auto mt-2 rounded-lg" />
              )}
            </div>

            {/* Letter blanks - typed letters appear here */}
            <div
              className="flex items-center gap-1.5 justify-center flex-wrap cursor-text"
              onClick={() => inputRef.current?.focus()}
              style={feedback === 'wrong' ? { animation: 'typeShake 0.4s ease-out' } : feedback === 'correct' ? { animation: 'typeCorrect 0.4s ease-out' } : {}}
            >
              {currentWord.word.split('').map((letter, i) => {
                const isRevealed = i < hintRevealed
                const typedLetter = typedValue[i]
                const isCursor = i === typedValue.length
                return (
                  <div
                    key={i}
                    className={`w-10 h-12 rounded-xl flex items-center justify-center font-bold text-xl uppercase transition-all ${
                      feedback === 'correct'
                        ? 'bg-green-400 text-white border-2 border-green-500 shadow-lg'
                        : wrongFlash && isCursor
                          ? 'bg-red-400/80 text-white border-2 border-red-500'
                          : isRevealed
                            ? 'bg-yellow-400/80 text-yellow-900 border-2 border-yellow-500'
                            : typedLetter
                              ? 'bg-white text-indigo-800 border-2 border-indigo-200 shadow-md'
                              : isCursor
                                ? 'bg-white/25 border-2 border-white/60'
                                : 'bg-white/10 border-2 border-dashed border-white/30'
                    }`}
                    style={typedLetter && !isRevealed ? { animation: 'letterReveal 0.15s ease-out' } : {}}
                  >
                    {typedLetter ? typedLetter.toUpperCase() : isCursor ? <span className="w-0.5 h-5 bg-white/80 rounded-full" style={{ animation: 'hintPulse 1s ease-in-out infinite' }} /> : ''}
                  </div>
                )
              })}
            </div>
            <span className="text-white/30 text-xs">({currentWord.word.length} letters)</span>

            {/* Hidden input to capture keyboard */}
            <input
              ref={inputRef}
              type="text"
              value={typedValue}
              onChange={(e) => {
                if (feedback) return
                const val = e.target.value.replace(/\s/g, '')
                // Don't allow editing revealed letters
                if (val.length < hintRevealed) return
                // Preserve revealed prefix
                const prefix = currentWord.word.slice(0, hintRevealed)
                const userPart = val.slice(hintRevealed)
                const newVal = prefix + userPart
                if (newVal.length > currentWord.word.length) return
                // Validate all new characters one by one
                if (newVal.length > typedValue.length) {
                  let accepted = typedValue
                  for (let ci = typedValue.length; ci < newVal.length; ci++) {
                    const expected = currentWord.word[ci].toLowerCase()
                    const typed = newVal[ci].toLowerCase()
                    if (typed !== expected) {
                      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                      if (isMobile) {
                        // Mobile: skip the word on wrong letter
                        shakeRef.current = 10
                        setScreenShake(10)
                        try {
                          const sound = new Audio(assetUrl('/sound/flappy-hit.mp3'))
                          sound.volume = 0.4
                          if (!muted) sound.play().catch(() => {})
                        } catch {}
                        setFeedback('wrong')
                        setTypedValue(newVal.slice(0, ci + 1))
                        setTimeout(() => {
                          setTypedValue('')
                          setFeedback(null)
                          setHintRevealed(0)
                          inputRef.current?.focus()
                        }, 400)
                        return
                      }
                      // Desktop: reject wrong letter, flash cursor box red
                      if (inputRef.current) inputRef.current.value = accepted
                      shakeRef.current = 6
                      setScreenShake(6)
                      setWrongFlash(true)
                      setTimeout(() => setWrongFlash(false), 150)
                      try {
                        const sound = new Audio(assetUrl('/sound/flappy-hit.mp3'))
                        sound.volume = 0.3
                        if (!muted) sound.play().catch(() => {})
                      } catch {}
                      if (accepted !== typedValue) setTypedValue(accepted)
                      return
                    }
                    accepted += newVal[ci]
                  }
                  setTypedValue(accepted)
                } else {
                  setTypedValue(newVal)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault()
                  handleSkip()
                }
                // Prevent backspacing into revealed letters
                if (e.key === 'Backspace' && typedValue.length <= hintRevealed) e.preventDefault()
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              style={{ position: 'absolute', left: '-9999px' }}
            />

            {/* Reveal hint button */}
            <button
              onClick={handleRevealHint}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
              disabled={hintRevealed >= currentWord.word.length - 1}
            >
              Reveal letter ({hintRevealed}/{currentWord.word.length - 1})
            </button>
          </div>

          {/* === BOTTOM: Skip === */}
          <div className="pb-8 pt-4 px-6 z-10 flex justify-center"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)' }}
          >
            <button
              onClick={handleSkip}
              className="text-xs text-white/50 hover:text-white/80 underline transition-colors"
            >
              Skip
            </button>
          </div>

          {/* Progress dots */}
          <div className="absolute top-[76px] left-0 right-0 flex items-center justify-center gap-1.5 z-10 pointer-events-none">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="relative"
                style={{
                  width: 20,
                  height: 20,
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
                    <span className="text-white font-bold text-[10px]">&#x2713;</span>
                  </div>
                ) : i === wordsCompleted ? (
                  <div className="w-full h-full rounded-full border-2 border-white/60 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.15)', animation: 'hintPulse 1.5s ease-in-out infinite' }}
                  >
                    <span className="text-white/80 font-bold text-[9px]">{i + 1}</span>
                  </div>
                ) : (
                  <div className="w-full h-full rounded-full border border-white/20 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-white/30 text-[9px]">{i + 1}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chest indicator under progress dots */}
          {isChestWord && !chestCollected && chestTimer > 0 && (
            <div className="absolute top-[100px] left-0 right-0 flex flex-col items-center gap-1 z-10 pointer-events-none">
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${chestTimer <= 3 ? 'bg-red-500/40' : 'bg-amber-500/30'}`} style={{ animation: chestTimer <= 3 ? 'hintPulse 0.5s ease-in-out infinite' : 'hintPulse 1s ease-in-out infinite' }}>
                <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-6 h-6 object-contain" />
                <span className={`text-xs font-bold ${chestTimer <= 3 ? 'text-red-300' : 'text-amber-300'}`}>{chestTimer}s</span>
              </div>
              <div className="w-24 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${chestTimer <= 3 ? 'bg-red-400' : 'bg-amber-400'}`}
                  style={{ width: `${(chestTimer / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Phase */}
      {phase === 'results' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto p-6 z-50">
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center my-auto"
            style={{ animation: 'typeResultsFadeIn 0.5s ease-out' }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 mb-4"
              style={{ animation: 'typeScorePopIn 0.6s ease-out 0.3s both' }}
            >
              <Trophy className="w-10 h-10 text-indigo-500" />
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
              className={`rounded-2xl p-5 mb-5 border ${wordsCompleted >= 10 ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
              style={{ animation: 'typeScorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className={`text-5xl font-black ${wordsCompleted >= 10 ? 'text-indigo-600' : 'text-gray-400'}`}>{wordsCompleted}</p>
              <p className={`text-sm font-semibold mt-1 ${wordsCompleted >= 10 ? 'text-indigo-400' : 'text-gray-400'}`}>words completed</p>
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
                ? 'Typing master!'
                : wordsCompleted >= 10
                  ? 'Great vocabulary!'
                  : 'Need at least 10 words to earn XP. Try again!'}
            </p>

            {chestCollected && (
              <div className="mb-4 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-8 h-8 object-contain" />
                <span className="font-bold text-amber-700">Chest collected!</span>
              </div>
            )}

            {wordsCompleted >= 10 ? (
              <button
                onClick={() => onGameEnd(displayScore, { chestCollected, wordsCompleted })}
                className="w-full py-3.5 bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-indigo-700 active:border-b-0 active:mt-1 transition-all"
              >
                Collect Rewards
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setPhase('ready')
                    setDisplayScore(0)
                    setWordsCompleted(0)
                  }}
                  className="w-full py-3.5 bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-indigo-700 active:border-b-0 active:mt-1 transition-all"
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

export default PetWordType
