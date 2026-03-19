import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Trophy, Volume2, VolumeX, Heart } from 'lucide-react'
import WORD_BANK from './wordBank'
import { assetUrl } from '../../hooks/useBranding'

const GAME_DURATION = 76
const PAIRS_PER_ROUND = 6 // 6 pairs = 12 tiles in a 4x3 grid
const POINTS_PER_MATCH = 10
const STREAK_BONUS = 5
const PET_MAX_HP = 5
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const EMPTY_ARRAY = []
const PetMatchGame = ({ petImageUrl, petName, onGameEnd, onClose, wordBank: wordBankProp = EMPTY_ARRAY, hideClose = false, scoreToBeat = null, leaderboard = EMPTY_ARRAY, chestEnabled = false, pvpOpponentPetUrl = null, initialRounds = null, onProgressUpdate = null, opponentProgress = null, isRealtimePvP = false }) => {
  const [phase, setPhase] = useState('ready')
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [tiles, setTiles] = useState([])
  const [selected, setSelected] = useState(null) // index of first selected tile
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [totalMatched, setTotalMatched] = useState(0)
  const [screenShake, setScreenShake] = useState(0)
  const [particles, setParticles] = useState([])
  const [wordPopup, setWordPopup] = useState(null)
  const [wordHistory, setWordHistory] = useState([])
  const [roundNum, setRoundNum] = useState(0)
  const [muted, setMuted] = useState(false)
  const [wrongPair, setWrongPair] = useState(null) // [idx1, idx2]
  const [locked, setLocked] = useState(false) // lock input during wrong animation
  const [chestCollected, setChestCollected] = useState(false)
  const [chestPopup, setChestPopup] = useState(false)
  const [chestMissed, setChestMissed] = useState(false)
  const [chestRoundIndex, setChestRoundIndex] = useState(-1)
  const [chestTimer, setChestTimer] = useState(0)
  const [petHp, setPetHp] = useState(PET_MAX_HP)

  const timerRef = useRef(null)
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const animFrameRef = useRef(null)
  const bgMusicRef = useRef(null)
  const mutedRef = useRef(false)
  const audioCache = useRef({})
  const starsRef = useRef(Array.from({ length: 20 }, () => {
    const size = Math.random() * 3 + 1
    return {
      width: size,
      height: size,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      opacity: Math.random() * 0.5 + 0.2,
    }
  }))

  const playSound = useCallback((url, volume = 0.5) => {
    try {
      if (!audioCache.current[url]) audioCache.current[url] = new Audio(url)
      const sound = audioCache.current[url]
      sound.volume = volume
      sound.currentTime = 0
      sound.play().catch(() => {})
    } catch {}
  }, [])
  const chestSpawnedRef = useRef(false)
  const chestRoundRef = useRef(0)

  const roundNumRef = useRef(0)

  // Build a round of tiles
  const buildRound = useCallback(() => {
    const roundIdx = roundNumRef.current
    const picked = initialRounds && initialRounds[roundIdx]
      ? initialRounds[roundIdx]
      : shuffle(wordBankProp.length > 0 ? wordBankProp : WORD_BANK).slice(0, PAIRS_PER_ROUND)
    const wordTiles = picked.map((pair, i) => ({ id: `w-${i}`, pairId: i, text: pair.word, type: 'word', matched: false }))
    const hintTiles = picked.map((pair, i) => ({ id: `h-${i}`, pairId: i, text: pair.hint, type: 'hint', matched: false }))
    setTiles([...shuffle(wordTiles), ...shuffle(hintTiles)])
    setSelected(null)
    setMatchedPairs(0)
    setWrongPair(null)
    setLocked(false)
    // Track words for results
    setWordHistory(prev => [...prev, ...picked.map(p => ({ word: p.word, hint: p.hint, correct: false }))])
  }, [wordBankProp])

  const startGame = useCallback(() => {
    scoreRef.current = 0
    streakRef.current = 0
    setScore(0)
    setStreak(0)
    setDisplayTime(GAME_DURATION)
    setWordPopup(null)
    setWordHistory([])
    setTotalMatched(0)
    setRoundNum(1)
    roundNumRef.current = 1
    chestSpawnedRef.current = false
    const chestRound = 2 + Math.floor(Math.random() * 3)
    chestRoundRef.current = chestRound
    setChestRoundIndex(chestEnabled ? chestRound : -1)
    setChestCollected(false)
    setChestPopup(false)
    setChestMissed(false)
    setPetHp(PET_MAX_HP)
    setPhase('playing')

    // Background music
    if (!mutedRef.current) {
      try {
        const music = new Audio(assetUrl('/sound/pet-word-scamble-2-faster.mp3'))
        music.loop = true
        music.volume = 0.3
        bgMusicRef.current = music
        music.play().catch(() => {})
      } catch {}
    }
  }, [])

  // Auto-start for realtime PvP (skip the ready screen)
  useEffect(() => {
    if (isRealtimePvP && phase === 'ready') {
      startGame()
    }
  }, [isRealtimePvP])

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !mutedRef.current
    mutedRef.current = newMuted
    setMuted(newMuted)
    if (bgMusicRef.current) {
      bgMusicRef.current.volume = newMuted ? 0 : 0.3
    }
  }, [])

  // Stop music on results
  useEffect(() => {
    if ((phase === 'results' || phase === 'defeated') && bgMusicRef.current) {
      bgMusicRef.current.pause()
      bgMusicRef.current = null
    }
  }, [phase])

  // Cleanup music on unmount
  useEffect(() => {
    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause()
        bgMusicRef.current = null
      }
    }
  }, [])

  // Build first round when playing starts
  useEffect(() => {
    if (phase === 'playing' && roundNum > 0) {
      buildRound()
      // Start chest timer when entering chest round
      if (chestEnabled && !chestSpawnedRef.current && roundNum === chestRoundRef.current) {
        setChestTimer(10)
      }
    }
  }, [phase, roundNum, buildRound, chestEnabled])

  // Chest round countdown
  useEffect(() => {
    if (chestTimer <= 0) return
    const interval = setInterval(() => {
      setChestTimer(prev => {
        if (prev <= 1) {
          // Time's up — chest lost
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

  // Timer countdown
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

  // Screen shake + particle decay
  useEffect(() => {
    if (phase !== 'playing') return
    const animate = () => {
      setScreenShake(prev => prev <= 0 ? prev : Math.max(0, prev - 1))
      setParticles(prev => {
        if (prev.length === 0) return prev
        const next = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.3,
          opacity: p.opacity - 0.02,
        })).filter(p => p.opacity > 0)
        return next
      })
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [phase])

  // Handle tile tap
  const handleTileTap = useCallback((index) => {
    if (phase !== 'playing' || locked) return
    const tile = tiles[index]
    if (!tile || tile.matched) return
    if (selected === index) { setSelected(null); return } // deselect

    if (selected === null) {
      // First selection
      setSelected(index)
      return
    }

    // Second selection — check match
    const firstTile = tiles[selected]
    if (firstTile.pairId === tile.pairId && firstTile.type !== tile.type) {
      // CORRECT MATCH
      const newStreak = streakRef.current + 1
      streakRef.current = newStreak
      setStreak(newStreak)
      const points = POINTS_PER_MATCH + (newStreak >= 5 ? STREAK_BONUS * 2 : newStreak >= 3 ? STREAK_BONUS : 0)
      scoreRef.current += points
      setScore(scoreRef.current)

      // Broadcast progress for realtime PvP
      if (onProgressUpdate) {
        onProgressUpdate({ score: scoreRef.current, wordsCompleted: totalMatched + 1 })
      }

      // Mark matched
      setTiles(prev => prev.map((t, i) =>
        (i === selected || i === index) ? { ...t, matched: true } : t
      ))
      setSelected(null)
      const newMatched = matchedPairs + 1
      setMatchedPairs(newMatched)
      setTotalMatched(prev => prev + 1)

      // Mark in word history
      setWordHistory(prev => prev.map(w =>
        w.word === firstTile.text || w.word === tile.text ? { ...w, correct: true } : w
      ))

      // Point popup + screen shake
      setWordPopup({ points, streak: newStreak })
      setTimeout(() => setWordPopup(null), 1200)

      // Celebration particles
      const colors = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981']
      const celebrationParticles = Array.from({ length: 20 }, (_, i) => ({
        id: `match-${Date.now()}-${i}`,
        x: 200,
        y: 300,
        vx: Math.cos(i * Math.PI / 10) * (4 + Math.random() * 3),
        vy: Math.sin(i * Math.PI / 10) * (4 + Math.random() * 3),
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...celebrationParticles])

      // Sound
      if (!mutedRef.current) playSound(assetUrl('/sound/scram-correct.mp3'), 0.4)

      // Check if round complete
      if (newMatched >= PAIRS_PER_ROUND) {
        if (chestEnabled && !chestSpawnedRef.current && roundNum === chestRoundRef.current) {
          chestSpawnedRef.current = true
          setChestCollected(true)
          setChestPopup(true)
          setChestTimer(0)
          setTimeout(() => setChestPopup(false), 1500)
        }
        setTimeout(() => {
          setRoundNum(prev => {
            roundNumRef.current = prev + 1
            return prev + 1
          })
        }, 600)
      }
    } else {
      // WRONG MATCH
      streakRef.current = 0
      setStreak(0)
      setScreenShake(12)
      setWrongPair([selected, index])
      setLocked(true)

      // Wrong match on chest round = chest lost
      if (chestEnabled && !chestSpawnedRef.current && roundNum === chestRoundRef.current) {
        chestSpawnedRef.current = true
        setChestMissed(true)
        setChestTimer(0)
      }

      if (!mutedRef.current) {
        playSound(assetUrl('/sound/flappy-hit.mp3'), 0.4)
      }

      const newPetHp = petHp - 1
      setPetHp(newPetHp)

      if (newPetHp <= 0) {
        setTimeout(() => {
          clearInterval(timerRef.current)
          setPhase('defeated')
        }, 800)
        return
      }

      setTimeout(() => {
        setWrongPair(null)
        setSelected(null)
        setLocked(false)
      }, 500)
    }
  }, [phase, locked, tiles, selected, matchedPairs])

  const timerPct = displayTime / GAME_DURATION
  const timerRadius = 22
  const timerCircumference = 2 * Math.PI * timerRadius
  const timerOffset = timerCircumference * (1 - timerPct)
  const timerColor = displayTime <= 5 ? '#ef4444' : displayTime <= 10 ? '#f97316' : displayTime <= 20 ? '#eab308' : '#22c55e'

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes matchTileIn {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.1) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes matchTileMatched {
          0% { transform: scale(1); }
          30% { transform: scale(1.2); }
          60% { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(0) rotate(15deg); opacity: 0; }
        }
        @keyframes matchTileWrong {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes matchFloat {
          0%, 100% { transform: translateY(-4px); }
          50% { transform: translateY(4px); }
        }
        @keyframes matchResultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes matchScorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes matchTimerUrgent {
          0%, 100% { transform: scale(1) rotate(0deg); }
          15% { transform: scale(1.1) rotate(-3deg); }
          30% { transform: scale(1) rotate(3deg); }
          45% { transform: scale(1.05) rotate(-2deg); }
          60% { transform: scale(1) rotate(0deg); }
        }
        @keyframes matchHintPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        @keyframes matchStreakPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes matchWordPopup {
          0% { transform: scale(0.5) translateY(0); opacity: 0; }
          15% { transform: scale(1.1) translateY(0); opacity: 1; }
          30% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(-60px); opacity: 0; }
        }
        @keyframes chestPopupAnim {
          0% { transform: scale(0) translateY(0); opacity: 0; }
          20% { transform: scale(1.2) translateY(0); opacity: 1; }
          40% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(-80px); opacity: 0; }
        }
        @keyframes matchTileSelected {
          0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.5), 0 0 15px rgba(59,130,246,0.3); }
          50% { box-shadow: 0 0 0 3px rgba(59,130,246,0.8), 0 0 20px rgba(59,130,246,0.5); }
        }
        @keyframes bbHeartLose {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
          100% { transform: scale(0); opacity: 0; }
        }
        .match-tile-3d {
          transition: transform 0.08s ease, box-shadow 0.08s ease;
          transform-style: preserve-3d;
        }
        .match-tile-3d:active {
          transform: translateY(4px) !important;
          box-shadow: 0 2px 0 #1e40af, 0 3px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2) !important;
        }
        .match-tile-3d.tile-selected:active {
          transform: translateY(4px) !important;
          box-shadow: 0 2px 0 #92400e, 0 0 12px rgba(250,204,21,0.3), inset 0 1px 0 rgba(255,255,255,0.3) !important;
        }
      `}</style>

      {/* Game container */}
      <div
        className="relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
          transform: screenShake > 0 ? `translate(${Math.sin(screenShake) * 3}px, ${Math.cos(screenShake) * 3}px)` : 'none',
        }}
      >
        {/* Decorative stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {starsRef.current.map((star, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={star}
            />
          ))}
        </div>

        {/* Close & Mute buttons */}
        {phase !== 'results' && phase !== 'defeated' && (
          <div className="absolute top-4 left-4 z-50 flex gap-2">
            {!hideClose && (
              <button
                onClick={onClose}
                className="bg-white/20 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white/30 transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              onClick={toggleMute}
              className="bg-white/20 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white/30 transition-colors"
            >
              {muted
                ? <VolumeX className="w-5 h-5 text-white/70" />
                : <Volume2 className="w-5 h-5 text-white" />
              }
            </button>
          </div>
        )}

        {/* Ready Phase */}
        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="flex items-center gap-4" style={{ animation: 'matchFloat 1.5s ease-in-out infinite' }}>
              {petImageUrl ? (
                <img src={petImageUrl} alt={petName} className="w-24 h-24 object-contain drop-shadow-lg"
                  onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = '' }}
                />
              ) : null}
              <span className="text-7xl" style={{ display: petImageUrl ? 'none' : '' }}>🧩</span>
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
                Match Up!
              </h2>
              <p className="text-lg text-white/80 mb-1">
                Match words with their meanings!
              </p>
              <p className="text-sm text-white/60">
                Train {petName}&apos;s memory!
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
              className="px-10 py-4 bg-white text-indigo-700 rounded-full font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-b-4 border-indigo-200"
            >
              Start!
            </button>
          </div>
        )}

        {/* Playing Phase */}
        {phase === 'playing' && (
          <div className="absolute inset-0 flex flex-col">
            {/* Top HUD */}
            <div className="p-4 z-10">
              <div className="flex items-center justify-between mb-3 pl-12">
                {/* Score */}
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2">
                    <span className="text-xl font-black text-white">{score}</span>
                  </div>
                  {(() => {
                    const nextToBeat = leaderboard.length > 0
                      ? [...leaderboard].reverse().find(e => e.score > score) || null
                      : scoreToBeat
                    if (!nextToBeat) return null
                    const gap = nextToBeat.score - score
                    const isClose = gap > 0 && gap <= 3
                    const pct = Math.min(100, Math.round((score / nextToBeat.score) * 100))
                    return (
                      <div className="w-28 ml-1" style={{ animation: isClose ? 'matchHintPulse 0.6s ease-in-out infinite' : 'none' }}>
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

                {/* Streak */}
                <div className="flex items-center gap-2">
                  {streak >= 3 && (
                    <div className="bg-yellow-400 text-yellow-900 rounded-full px-3 py-1 text-sm font-bold shadow-lg"
                      style={{ animation: 'matchHintPulse 0.6s ease-in-out' }}
                    >
                      {streak}x
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-0.5">
                    {petImageUrl && (
                      <img src={petImageUrl} alt={petName}
                        className="w-10 h-10 object-contain drop-shadow-md"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    )}
                    <div className="flex gap-0.5">
                      {Array.from({ length: PET_MAX_HP }).map((_, i) => (
                        <Heart key={i} className={`w-3.5 h-3.5 transition-all ${i < petHp ? 'text-red-400 fill-red-400' : 'text-gray-600/40'}`}
                          style={i === petHp ? { animation: 'bbHeartLose 0.5s ease-out' } : {}}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Timer ring */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    animation: displayTime <= 5
                      ? 'matchTimerUrgent 0.5s ease-in-out infinite'
                      : displayTime <= 10
                        ? 'matchTimerUrgent 1s ease-in-out infinite'
                        : 'none'
                  }}
                >
                  <svg width="56" height="56" className="drop-shadow-lg" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="28" cy="28" r={timerRadius} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                    <circle
                      cx="28" cy="28" r={timerRadius}
                      fill="none"
                      stroke={timerColor}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={timerCircumference}
                      strokeDashoffset={timerOffset}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                    />
                  </svg>
                  <span
                    className="absolute font-black text-white"
                    style={{
                      fontSize: displayTime < 10 ? '18px' : '16px',
                      textShadow: `0 0 8px ${timerColor}80, 0 1px 2px rgba(0,0,0,0.3)`,
                    }}
                  >
                    {displayTime}
                  </span>
                </div>
              </div>

              {/* Realtime PvP scoreboard */}
              {isRealtimePvP && opponentProgress && (
                <div className="flex items-center justify-center gap-3 w-full max-w-xs mx-auto mb-2">
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    {petImageUrl && <img src={petImageUrl} alt={petName} className="w-10 h-10 object-contain drop-shadow-lg" />}
                    <span className={`text-2xl font-black ${score > opponentProgress.score ? 'text-green-300' : score < opponentProgress.score ? 'text-white/60' : 'text-white'}`}
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{score}</span>
                  </div>
                  <span className="text-white/30 font-black text-sm">vs</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-2xl font-black ${opponentProgress.score > score ? 'text-red-300' : opponentProgress.score < score ? 'text-white/60' : 'text-white'}`}
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{opponentProgress.score}</span>
                    {pvpOpponentPetUrl && <img src={pvpOpponentPetUrl} alt="Opponent" className="w-10 h-10 object-contain drop-shadow-lg" style={{ transform: 'scaleX(-1)' }} />}
                  </div>
                </div>
              )}

              {/* Round indicator */}
              <div className="text-center">
                <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                  Round {roundNum}
                </span>
              </div>

              {/* Progress dots — 5 rounds needed */}
              <div className="flex items-center justify-center gap-2.5 mt-2">
                {Array.from({ length: 5 }, (_, i) => {
                  const completed = roundNum > i + 1 || (roundNum === i + 1 && matchedPairs >= PAIRS_PER_ROUND)
                  const current = roundNum === i + 1 && matchedPairs < PAIRS_PER_ROUND
                  return (
                    <div
                      key={i}
                      className="relative"
                      style={{
                        width: 28,
                        height: 28,
                        transition: 'transform 0.3s ease',
                        transform: current ? 'scale(1.3)' : 'scale(1)',
                      }}
                    >
                      {completed ? (
                        <div className="w-full h-full rounded-full flex items-center justify-center text-xs"
                          style={{
                            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                            boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                            animation: 'matchStreakPulse 0.4s ease-out',
                          }}
                        >
                          <span className="text-white font-bold">✓</span>
                        </div>
                      ) : current ? (
                        <div className="w-full h-full rounded-full border-2 border-white/60 flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.15)', animation: 'matchHintPulse 1.5s ease-in-out infinite' }}
                        >
                          <span className="text-white/80 font-bold text-[10px]">{matchedPairs}/{PAIRS_PER_ROUND}</span>
                        </div>
                      ) : (
                        <div className="w-full h-full rounded-full border border-white/20 flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.08)' }}
                        >
                          <span className="text-white/30 text-[10px]">{i + 1}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Chest indicator - only on chest round, hide when time runs out */}
              {chestRoundIndex >= 0 && !chestCollected && !chestMissed && roundNum === chestRoundIndex && chestTimer > 0 && (
                <div className="flex flex-col items-center mt-2 gap-1">
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${chestTimer <= 3 ? 'bg-red-500/40' : 'bg-amber-500/30'}`} style={{ animation: chestTimer <= 3 ? 'matchHintPulse 0.5s ease-in-out infinite' : 'matchHintPulse 1s ease-in-out infinite' }}>
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

            {/* Tile Grid */}
            <div className="flex-1 flex items-center justify-center px-3 pb-4">
              <div className="w-full max-w-[380px] flex flex-col gap-2">
                {/* Words */}
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {tiles.slice(0, PAIRS_PER_ROUND).map((tile, i) => {
                    const isSelected = selected === i
                    const isWrong = wrongPair && (wrongPair[0] === i || wrongPair[1] === i)
                    const isMatched = tile.matched

                    if (isMatched) {
                      return (
                        <div key={tile.id} className="rounded-2xl" style={{ height: 72, animation: 'matchTileMatched 0.5s ease-out forwards' }} />
                      )
                    }

                    return (
                      <button
                        key={tile.id}
                        onPointerDown={() => handleTileTap(i)}
                        className={`match-tile-3d ${isSelected ? 'tile-selected' : ''} rounded-2xl px-2 py-2 text-center font-bold`}
                        style={{
                          height: 72,
                          animation: isWrong ? 'matchTileWrong 0.4s ease-out' : `matchTileIn 0.3s ease-out ${i * 0.03}s both`,
                          background: isSelected
                            ? 'linear-gradient(to bottom, #fde047 0%, #facc15 40%, #eab308 100%)'
                            : 'linear-gradient(to bottom, #60a5fa 0%, #3b82f6 40%, #2563eb 100%)',
                          boxShadow: isSelected
                            ? '0 6px 0 #92400e, 0 0 20px rgba(250,204,21,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
                            : '0 6px 0 #1e40af, 0 8px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
                          borderTop: isSelected ? '2px solid #fef08a' : '2px solid rgba(255,255,255,0.15)',
                          borderLeft: isSelected ? '2px solid #fef08a' : '2px solid rgba(255,255,255,0.15)',
                          borderRight: isSelected ? '2px solid #fef08a' : '2px solid rgba(255,255,255,0.15)',
                          borderBottom: 'none',
                          transform: 'none',
                        }}
                      >
                        <span className={`text-white leading-tight ${tile.text.length > 12 ? 'text-[11px]' : tile.text.length > 8 ? 'text-xs' : 'text-sm'}`}
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                        >
                          {tile.text}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 px-2">
                  <div className="flex-1 h-px bg-white/20" />
                  <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">match</span>
                  <div className="flex-1 h-px bg-white/20" />
                </div>

                {/* Meanings */}
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {tiles.slice(PAIRS_PER_ROUND).map((tile, rawI) => {
                    const i = rawI + PAIRS_PER_ROUND
                    const isSelected = selected === i
                    const isWrong = wrongPair && (wrongPair[0] === i || wrongPair[1] === i)
                    const isMatched = tile.matched

                    if (isMatched) {
                      return (
                        <div key={tile.id} className="rounded-2xl" style={{ height: 72, animation: 'matchTileMatched 0.5s ease-out forwards' }} />
                      )
                    }

                    return (
                      <button
                        key={tile.id}
                        onPointerDown={() => handleTileTap(i)}
                        className={`match-tile-3d ${isSelected ? 'tile-selected' : ''} rounded-2xl px-2 py-2 text-center font-bold`}
                        style={{
                          height: 72,
                          animation: isWrong ? 'matchTileWrong 0.4s ease-out' : `matchTileIn 0.3s ease-out ${rawI * 0.03}s both`,
                          background: isSelected
                            ? 'linear-gradient(to bottom, #fde047 0%, #facc15 40%, #eab308 100%)'
                            : 'linear-gradient(to bottom, #60a5fa 0%, #3b82f6 40%, #2563eb 100%)',
                          boxShadow: isSelected
                            ? '0 6px 0 #92400e, 0 0 20px rgba(250,204,21,0.4), inset 0 1px 0 rgba(255,255,255,0.4)'
                            : '0 6px 0 #1e40af, 0 8px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
                          borderTop: isSelected ? '2px solid #fef08a' : '2px solid rgba(255,255,255,0.15)',
                          borderLeft: isSelected ? '2px solid #fef08a' : '2px solid rgba(255,255,255,0.15)',
                          borderRight: isSelected ? '2px solid #fef08a' : '2px solid rgba(255,255,255,0.15)',
                          borderBottom: 'none',
                          transform: 'none',
                        }}
                      >
                        <span className={`text-white leading-tight ${tile.text.length > 12 ? 'text-[11px]' : tile.text.length > 8 ? 'text-xs' : 'text-sm'}`}
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                        >
                          {tile.text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Particles */}
            {particles.map(p => (
              <div
                key={p.id}
                className="absolute w-3 h-3 rounded-full pointer-events-none z-30"
                style={{
                  left: `${p.x}px`,
                  top: `${p.y}px`,
                  backgroundColor: p.color,
                  opacity: p.opacity,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}

            {/* Point popup */}
            {wordPopup && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-1" style={{ animation: 'matchWordPopup 1.2s ease-out forwards' }}>
                  <div className="text-3xl font-black text-white drop-shadow-lg">+{wordPopup.points}</div>
                  {wordPopup.streak >= 3 && (
                    <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 rounded-full px-3 py-1 text-sm font-bold"
                      style={{ animation: 'matchStreakPulse 0.4s ease-out' }}
                    >
                      <img src={assetUrl('/icon/profile/streak.svg')} alt="streak" className="w-4 h-4" />
                      {wordPopup.streak}x streak
                    </div>
                  )}
                </div>
              </div>
            )}

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
          </div>
        )}

        {/* Defeated Phase */}
        {phase === 'defeated' && (
          <div className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto p-6 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center my-auto"
              style={{ animation: 'matchResultsFadeIn 0.5s ease-out' }}
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-4"
                style={{ animation: 'matchScorePopIn 0.6s ease-out 0.3s both' }}
              >
                <Heart className="w-10 h-10 text-red-400" />
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-1">Defeated!</h2>
              <p className="text-gray-500 mb-5">{petName} ran out of lives!</p>

              <div className="rounded-2xl p-5 mb-5 border bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
                style={{ animation: 'matchScorePopIn 0.6s ease-out 0.5s both' }}
              >
                <p className="text-5xl font-black text-gray-400">{totalMatched}</p>
                <p className="text-sm font-semibold mt-1 text-gray-400">pairs matched</p>
              </div>

              <p className="text-sm text-gray-600 mb-6">Try to keep your lives! Wrong matches cost a heart.</p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setPhase('ready'); setScore(0); setStreak(0) }}
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
            </div>
          </div>
        )}

        {/* Results Phase */}
        {phase === 'results' && (
          <div className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto p-6 z-50">
            <div
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center my-auto"
              style={{ animation: 'matchResultsFadeIn 0.5s ease-out' }}
            >
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 mb-4"
                style={{ animation: 'matchScorePopIn 0.6s ease-out 0.3s both' }}
              >
                <Trophy className="w-10 h-10 text-indigo-500" />
              </div>

              {isRealtimePvP && opponentProgress ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 mb-1">
                    {score > opponentProgress.score ? 'You Win!' : score < opponentProgress.score ? 'You Lose!' : "It's a Tie!"}
                  </h2>
                  <p className="text-gray-500 mb-5">
                    {score > opponentProgress.score ? 'Great matching skills!' : score < opponentProgress.score ? 'Better luck next time!' : 'Evenly matched!'}
                  </p>
                  <div className="flex items-center justify-center gap-4 mb-5">
                    <div className={`rounded-2xl p-4 border flex-1 ${score >= opponentProgress.score ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
                      style={{ animation: 'matchScorePopIn 0.6s ease-out 0.5s both' }}>
                      <p className="text-xs font-semibold text-gray-400 mb-1">You</p>
                      <p className={`text-3xl font-black ${score >= opponentProgress.score ? 'text-green-600' : 'text-gray-400'}`}>{score}</p>
                      <p className="text-xs text-gray-400 mt-1">{totalMatched} pairs</p>
                    </div>
                    <span className="text-gray-300 font-bold text-lg">VS</span>
                    <div className={`rounded-2xl p-4 border flex-1 ${opponentProgress.score >= score ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
                      style={{ animation: 'matchScorePopIn 0.6s ease-out 0.7s both' }}>
                      <p className="text-xs font-semibold text-gray-400 mb-1">Opponent</p>
                      <p className={`text-3xl font-black ${opponentProgress.score >= score ? 'text-red-600' : 'text-gray-400'}`}>{opponentProgress.score}</p>
                      <p className="text-xs text-gray-400 mt-1">{opponentProgress.wordsCompleted} pairs</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-800 mb-1">
                    {totalMatched >= 30 ? 'Great Matching!' : 'Keep Practicing!'}
                  </h2>
                  <p className="text-gray-500 mb-5">
                    {petName} matched {totalMatched} pairs across {roundNum} round{roundNum > 1 ? 's' : ''}!
                  </p>

                  <div
                    className={`rounded-2xl p-5 mb-5 border ${totalMatched >= 30 ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
                    style={{ animation: 'matchScorePopIn 0.6s ease-out 0.5s both' }}
                  >
                    <p className={`text-5xl font-black ${totalMatched >= 30 ? 'text-indigo-600' : 'text-gray-400'}`}>{score}</p>
                    <p className={`text-sm font-semibold mt-1 ${totalMatched >= 30 ? 'text-indigo-400' : 'text-gray-400'}`}>points</p>
                  </div>
                </>
              )}

              {/* Missed Words */}
              {wordHistory.some(w => !w.correct) && (
                <div className="mb-5 text-left">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">Words to Practice</p>
                  <div className="max-h-[180px] overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                    {wordHistory.filter(w => !w.correct).map((w, i) => (
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
                  {totalMatched >= 30
                    ? 'Awesome memory!'
                    : 'Need at least 30 matched pairs to earn XP. Try again!'}
                </p>
              )}

              {chestCollected && (
                <div className="mb-4 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <img src={assetUrl('/image/chest/legendary-chest.png')} alt="Chest" className="w-8 h-8 object-contain" />
                  <span className="font-bold text-amber-700">Chest collected!</span>
                </div>
              )}

              {isRealtimePvP || totalMatched >= 30 ? (
                <button
                  onClick={() => onGameEnd(score, { chestCollected, pairsMatched: totalMatched })}
                  className="w-full py-3.5 bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-indigo-700 active:border-b-0 active:mt-1 transition-all"
                >
                  {isRealtimePvP ? 'Done' : 'Collect Rewards'}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setPhase('ready')
                      setScore(0)
                      setStreak(0)
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

export default PetMatchGame
