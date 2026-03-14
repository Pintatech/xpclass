import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Volume2, VolumeX } from 'lucide-react'
import WORD_BANK from './wordBank'
import { assetUrl } from '../../hooks/useBranding'

const GAME_DURATION = 76
// Streak tier scoring (like Whack-a-Mole): streak>=5 → 3, >=3 → 2, else 1
const WORDS_PER_ROUND = 4 // how many words fall per round
const GRAVITY = 0 // no acceleration, constant fall speed

// Jagged asteroid clip-path shapes (irregular polygons)
const ASTEROID_CLIPS = [
  'polygon(15% 0%, 40% 5%, 70% 0%, 90% 10%, 100% 35%, 95% 60%, 100% 80%, 80% 100%, 55% 95%, 30% 100%, 10% 85%, 0% 60%, 5% 30%)',
  'polygon(20% 0%, 50% 3%, 80% 0%, 100% 20%, 95% 50%, 100% 75%, 85% 100%, 50% 95%, 20% 100%, 0% 75%, 5% 45%, 0% 15%)',
  'polygon(10% 5%, 35% 0%, 65% 5%, 85% 0%, 100% 25%, 98% 55%, 100% 85%, 75% 100%, 45% 92%, 15% 100%, 0% 70%, 3% 40%, 0% 15%)',
  'polygon(25% 0%, 55% 2%, 75% 0%, 100% 15%, 95% 45%, 100% 70%, 90% 100%, 60% 95%, 35% 100%, 5% 80%, 0% 50%, 8% 20%)',
]

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PetAstroBlast = ({ petImageUrl, petName, onGameEnd, onClose, shipSkinUrl, shipLaserColor, asteroidSkinUrls, wordBank: wordBankProp = [], hideClose = false, scoreToBeat = null, leaderboard = [], chestEnabled = false, pvpOpponentPetUrl = null }) => {
  const [phase, setPhase] = useState('ready')
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [currentHint, setCurrentHint] = useState(null)
  const [flyingWords, setFlyingWords] = useState([])
  const [particles, setParticles] = useState([])
  const [screenShake, setScreenShake] = useState(0)
  const [feedback, setFeedback] = useState(null) // { type: 'correct'|'wrong', word, x, y }
  const [streak, setStreak] = useState(0)

  const [slashTrail, setSlashTrail] = useState([])
  const [muted, setMuted] = useState(false)
  const [missedWords, setMissedWords] = useState([])
  const [wordPopup, setWordPopup] = useState(null)
  const [shipX, setShipX] = useState(200) // spaceship horizontal position
  const [laser, setLaser] = useState(null) // { fromX, fromY, toX, toY, type: 'correct'|'wrong' }
  const [shipRecoil, setShipRecoil] = useState(false)
  const [chestCollected, setChestCollected] = useState(false)
  const [chestPopup, setChestPopup] = useState(false)

  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const timerRef = useRef(null)
  const spawnTimerRef = useRef(null)
  const animFrameRef = useRef(null)
  const containerRef = useRef(null)
  const bgMusicRef = useRef(null)
  const currentTargetRef = useRef(null)
  const roundIndexRef = useRef(0)
  const chestSpawnedRef = useRef(false)
  const chestRoundRef = useRef(0)

  // Generate a round: pick a target word and distractors
  const spawnRound = useCallback(() => {
    const containerW = containerRef.current?.clientWidth || 400

    // Pick target
    const words = wordBankProp.length > 0 ? wordBankProp : WORD_BANK
    const target = words[Math.floor(Math.random() * words.length)]
    currentTargetRef.current = target
    setCurrentHint(target.hint)

    // Pick distractors (different words)
    const distractors = shuffle(words.filter(w => w.word !== target.word)).slice(0, WORDS_PER_ROUND - 1)
    const allWords = shuffle([target, ...distractors])

    // Spawn words from the top — they fall downward like asteroids
    const roundId = Date.now()
    roundIndexRef.current += 1

    // Shuffle skin indices so no duplicates per round
    const skinCount = asteroidSkinUrls?.length || 1
    const skinIndices = shuffle(Array.from({ length: skinCount }, (_, idx) => idx))

    allWords.forEach((w, i) => {
      const delay = i * 100 // 100ms between each word drop
      setTimeout(() => {
        // Each word drops from a different horizontal zone
        const zoneWidth = containerW / allWords.length
        const launchX = zoneWidth * i + zoneWidth / 2 + (Math.random() - 0.5) * 20
        // Slow downward speed
        const vy = 2.5 + Math.random() * 1.0
        // Slight horizontal drift
        const vx = (Math.random() - 0.5) * 1.2

        const newWord = {
          id: `${w.word}-${roundId}-${i}`,
          word: w.word,
          hint: w.hint,
          isCorrect: w.word === target.word,
          x: launchX,
          y: -50,
          vx,
          vy,
          slashed: false,
          wrong: false,
          opacity: 1,
          scale: 1,
          rotation: (Math.random() - 0.5) * 10,
          rotationSpeed: (Math.random() - 0.5) * 0.6,
          clipIdx: Math.floor(Math.random() * ASTEROID_CLIPS.length),
          skinIdx: skinIndices[i % skinIndices.length],
        }
        setFlyingWords(prev => [...prev, newWord])
      }, delay)
    })

    // Spawn chest once per game at the chosen round (only if chestEnabled)
    if (chestEnabled && !chestSpawnedRef.current && roundIndexRef.current === chestRoundRef.current) {
      chestSpawnedRef.current = true
      const chestDelay = allWords.length * 100 + 50
      setTimeout(() => {
        const zoneWidth = containerW / (allWords.length + 1)
        const launchX = zoneWidth * allWords.length + zoneWidth / 2 + (Math.random() - 0.5) * 20
        const vy = 2.0 + Math.random() * 0.8
        const vx = (Math.random() - 0.5) * 1.0
        const chestWord = {
          id: `chest-${roundId}`,
          word: '📦',
          hint: '',
          isCorrect: false,
          isChest: true,
          x: launchX,
          y: -50,
          vx,
          vy,
          slashed: false,
          wrong: false,
          opacity: 1,
          scale: 1,
          rotation: (Math.random() - 0.5) * 10,
          rotationSpeed: (Math.random() - 0.5) * 0.6,
          clipIdx: Math.floor(Math.random() * ASTEROID_CLIPS.length),
          skinIdx: 0,
        }
        setFlyingWords(prev => [...prev, chestWord])
      }, chestDelay)
    }
  }, [wordBankProp])

  // Start game
  const startGame = useCallback(() => {
    setDisplayScore(0)
    setDisplayTime(GAME_DURATION)
    setWordsCompleted(0)
    setMissedWords([])
    setStreak(0)

    setFlyingWords([])
    setParticles([])
    setFeedback(null)
    setCurrentHint(null)
    scoreRef.current = 0
    streakRef.current = 0
    roundIndexRef.current = 0
    chestSpawnedRef.current = false
    chestRoundRef.current = 5 + Math.floor(Math.random() * 10)
    setChestCollected(false)
    setChestPopup(false)
    setPhase('playing')

    try {
      const music = new Audio('https://xpclass.vn/xpclass/sound/pet-asteroid.mp3')
      music.loop = true
      music.volume = 0.3
      bgMusicRef.current = music
      music.play().catch(() => {})
    } catch {}
  }, [])

  // Spawn first round when game starts
  useEffect(() => {
    if (phase !== 'playing') return
    const firstTimer = setTimeout(() => spawnRound(), 600)
    return () => {
      clearTimeout(firstTimer)
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current)
    }
  }, [phase, spawnRound])

  // Spawn next round after correct slash
  const scheduleNextRound = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current)
    spawnTimerRef.current = setTimeout(() => spawnRound(), 100)
  }, [spawnRound])

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

  // Animation loop: move words upward, update particles (delta-time based)
  useEffect(() => {
    if (phase !== 'playing') return

    const containerH = containerRef.current?.clientHeight || 700
    let lastTime = performance.now()

    const animate = (now) => {
      const rawDt = (now - lastTime) / 16.667 // normalize to 60fps (1.0 = one 60fps frame)
      const dt = Math.min(rawDt, 3) // cap to prevent huge jumps on tab switch
      lastTime = now

      setFlyingWords(prev => {
        const updated = prev.map(w => {
          if (w.slashed || w.wrong) {
            // Slashed/wrong: split apart and fade
            return {
              ...w,
              opacity: Math.max(0, w.opacity - 0.04 * dt),
              scale: w.slashed ? w.scale + 0.02 * dt : w.scale ** (1 - 0.05 * dt),
              y: w.y + 3 * dt,
              rotation: w.rotation + (w.slashed ? 5 : -3) * dt,
            }
          }
          // Falling physics: apply gravity to vy, clamp x within screen
          const containerW = containerRef.current?.clientWidth || 400
          let newX = w.x + w.vx * dt
          let newVx = w.vx
          // Bounce off edges
          if (newX < 50) { newX = 50; newVx = Math.abs(newVx) * 0.5 }
          if (newX > containerW - 50) { newX = containerW - 50; newVx = -Math.abs(newVx) * 0.5 }
          return {
            ...w,
            x: newX,
            vx: newVx,
            y: w.y + w.vy * dt,
            vy: w.vy + GRAVITY * dt,
            rotation: w.rotation + w.rotationSpeed * dt,
          }
        })
        // Bounce asteroids off each other
        const ASTEROID_R = 45
        const active = updated.filter(w => !w.slashed && !w.wrong)
        for (let i = 0; i < active.length; i++) {
          for (let j = i + 1; j < active.length; j++) {
            const a = active[i], b = active[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const minDist = ASTEROID_R * 2
            if (dist < minDist && dist > 0) {
              const nx = dx / dist, ny = dy / dist
              const overlap = (minDist - dist) / 2
              a.x -= nx * overlap
              a.y -= ny * overlap
              b.x += nx * overlap
              b.y += ny * overlap
              // Swap velocity components along collision normal
              const dvx = a.vx - b.vx
              const dvy = a.vy - b.vy
              const dot = dvx * nx + dvy * ny
              if (dot > 0) {
                a.vx -= dot * nx * 0.8
                a.vy -= dot * ny * 0.8
                b.vx += dot * nx * 0.8
                b.vy += dot * ny * 0.8
              }
            }
          }
        }
        // Remove fully faded or fallen below screen
        return updated.filter(w => {
          if (w.opacity <= 0) return false
          // Word fell back below screen after its arc
          if (!w.slashed && !w.wrong && w.y > containerH + 80) {
            if (w.isChest) return false // chest silently removed
            if (w.isCorrect) {
              setMissedWords(p => {
                if (p.some(m => m.word === w.word)) return p
                return [...p, { word: w.word, hint: w.hint }]
              })
              streakRef.current = 0
              setStreak(0)
              // Correct word missed — spawn next round
              scheduleNextRound()
            }
            return false
          }
          return true
        })
      })

      // Particles
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
        vy: p.vy + 0.3 * dt,
        opacity: p.opacity - 0.025 * dt,
      })).filter(p => p.opacity > 0))

      setScreenShake(prev => Math.max(0, prev - 1 * dt))

      // Decay slash trail
      setSlashTrail(prev => prev.map(s => ({ ...s, opacity: s.opacity - 0.08 * dt })).filter(s => s.opacity > 0))

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [phase, scheduleNextRound])

  // Fire laser from ship to target position
  const fireLaser = useCallback((toX, toY, type) => {
    const containerH = containerRef.current?.clientHeight || 700
    const shipY = containerH - 60
    setLaser({ fromX: shipX, fromY: shipY, toX, toY, type })
    setShipRecoil(true)
    setTimeout(() => setShipRecoil(false), 300)
    setTimeout(() => setLaser(null), 300)
  }, [shipX])

  // Handle tapping empty space — fire laser but no word hit
  const handleMissShot = useCallback((e) => {
    if (phase !== 'playing') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const toX = e.clientX - rect.left
    const toY = e.clientY - rect.top
    fireLaser(toX, toY, 'miss')
  }, [phase, fireLaser])

  // Handle slashing a word
  const handleSlash = useCallback((wordObj) => {
    if (phase !== 'playing' || wordObj.slashed || wordObj.wrong) return

    // Chest hit — collect it without affecting score or round
    if (wordObj.isChest) {
      fireLaser(wordObj.x, wordObj.y, 'correct')
      setChestCollected(true)
      setChestPopup(true)
      setTimeout(() => setChestPopup(false), 1500)
      setFlyingWords(prev => prev.map(w =>
        w.id === wordObj.id ? { ...w, slashed: true } : w
      ))
      setFeedback({ type: 'correct', word: '+\uD83D\uDCE6 Chest!', x: wordObj.x, y: wordObj.y })
      setTimeout(() => setFeedback(null), 600)
      // Chest particles
      const colors = ['#f59e0b', '#fbbf24', '#d97706', '#b45309']
      const chestParticles = Array.from({ length: 12 }, (_, i) => ({
        id: `chest-p-${Date.now()}-${i}`,
        x: wordObj.x,
        y: wordObj.y,
        vx: Math.cos(i * Math.PI / 6) * (4 + Math.random() * 3),
        vy: Math.sin(i * Math.PI / 6) * (4 + Math.random() * 3),
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...chestParticles])
      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/laser.mp3')
        sound.volume = 0.3
        sound.play().catch(() => {})
      } catch {}
      setScreenShake(8)
      return
    }

    fireLaser(wordObj.x, wordObj.y, wordObj.isCorrect ? 'correct' : 'wrong')

    if (wordObj.isCorrect) {
      // CORRECT slash
      const newStreak = streakRef.current + 1
      streakRef.current = newStreak
      setStreak(newStreak)


      const containerH = containerRef.current?.clientHeight || 700
      const speedBonus = Math.round(Math.max(0, 1 - wordObj.y / containerH) * 15)
      const streakTier = newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1
      const points = speedBonus + streakTier
      scoreRef.current += points
      setDisplayScore(scoreRef.current)
      setWordsCompleted(prev => prev + 1)

      setWordPopup({ points, streak: newStreak })
      setTimeout(() => setWordPopup(null), 1000)

      // Mark correct word as slashed, remove all words from this round
      setFlyingWords(prev => prev.map(w => {
        if (w.id === wordObj.id) return { ...w, slashed: true }
        // Also dismiss other words in same round (same timestamp prefix)
        const roundId = wordObj.id.split('-').slice(1, 2)[0]
        const thisRoundId = w.id.split('-').slice(1, 2)[0]
        if (roundId === thisRoundId && !w.slashed) return { ...w, opacity: 0.5, wrong: true }
        return w
      }))

      // Slash particles
      const colors = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981']
      const slashParticles = Array.from({ length: 15 }, (_, i) => ({
        id: `slash-${Date.now()}-${i}`,
        x: wordObj.x,
        y: wordObj.y,
        vx: Math.cos(i * Math.PI / 7.5) * (4 + Math.random() * 3),
        vy: Math.sin(i * Math.PI / 7.5) * (4 + Math.random() * 3),
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...slashParticles])

      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/laser.mp3')
        sound.volume = 0.3
        sound.play().catch(() => {})
      } catch {}

      setScreenShake(12)
      setFeedback({ type: 'correct', word: wordObj.word, x: wordObj.x, y: wordObj.y })
      setTimeout(() => setFeedback(null), 600)

      // Spawn next round shortly after correct slash
      scheduleNextRound()

    } else {
      // WRONG slash
      streakRef.current = 0
      setStreak(0)
  
      setScreenShake(10)

      // Mark tapped word as wrong, dismiss all other words in same round
      const roundId = wordObj.id.split('-').slice(1, 2)[0]
      setFlyingWords(prev => prev.map(w => {
        if (w.id === wordObj.id) return { ...w, wrong: true }
        const thisRoundId = w.id.split('-').slice(1, 2)[0]
        if (roundId === thisRoundId && !w.slashed) return { ...w, opacity: 0.5, wrong: true }
        return w
      }))

      // Red explosion
      const explosionParticles = Array.from({ length: 10 }, (_, i) => ({
        id: `wrong-${Date.now()}-${i}`,
        x: wordObj.x,
        y: wordObj.y,
        vx: Math.cos(i * Math.PI / 5) * 4,
        vy: Math.sin(i * Math.PI / 5) * 4,
        color: '#ef4444',
        opacity: 1,
      }))
      setParticles(prev => [...prev, ...explosionParticles])

      try {
        const sound = new Audio(assetUrl('/sound/flappy-hit.mp3'))
        sound.volume = 0.3
        sound.play().catch(() => {})
      } catch {}

      setFeedback({ type: 'wrong', word: wordObj.word, x: wordObj.x, y: wordObj.y })
      setTimeout(() => setFeedback(null), 600)

      // Wrong hit ends the turn — move to next round
      scheduleNextRound()
    }
  }, [phase, scheduleNextRound, fireLaser])

  // Track pointer for slash trail visual + ship position
  const handlePointerMove = useCallback((e) => {
    if (phase !== 'playing') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setSlashTrail(prev => [...prev.slice(-12), { x, y, opacity: 1, id: Date.now() }])
    setShipX(Math.max(30, Math.min(x, (containerRef.current?.clientWidth || 400) - 30)))
  }, [phase])

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes starfall {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes slasherFloat {
          0%, 100% { transform: translateY(-4px); }
          50% { transform: translateY(4px); }
        }
        @keyframes slasherPopIn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slasherResultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slasherScorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes wordFlyUp {
          0% { opacity: 0; transform: scale(0.5); }
          20% { opacity: 1; transform: scale(1); }
        }
        @keyframes slashFeedback {
          0% { transform: scale(0.5); opacity: 0; }
          20% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1) translateY(-40px); opacity: 0; }
        }
@keyframes wordPopupAnim {
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
        @keyframes hintPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes laserFire {
          0% { opacity: 1; filter: brightness(2); }
          30% { opacity: 0.9; filter: brightness(1.5); }
          100% { opacity: 0; filter: brightness(1); }
        }
        @keyframes shipRecoil {
          0% { transform: translateX(-50%) translateY(0); }
          20% { transform: translateX(-50%) translateY(8px) scale(0.95); }
          60% { transform: translateX(-50%) translateY(-3px) scale(1.02); }
          100% { transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes shipIdle {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }
        @keyframes timerUrgent {
          0%, 100% { transform: scale(1) rotate(0deg); }
          15% { transform: scale(1.1) rotate(-3deg); }
          30% { transform: scale(1) rotate(3deg); }
          45% { transform: scale(1.05) rotate(-2deg); }
          60% { transform: scale(1) rotate(0deg); }
        }
      `}</style>

      <div
        ref={containerRef}
        className="relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
        onPointerMove={handlePointerMove}
      >


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
        <div className="flex flex-col items-center gap-6 p-8 text-center h-full justify-center">
          <div className="flex items-center gap-4" style={{ animation: 'slasherFloat 1.5s ease-in-out infinite' }}>
            {petImageUrl ? (
              <img src={petImageUrl} alt={petName} className="w-24 h-24 object-contain drop-shadow-lg"
                onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = ''; }}
              />
            ) : null}
            <span className="text-7xl" style={{ display: petImageUrl ? 'none' : '' }}>⚔️</span>
            {pvpOpponentPetUrl && (
              <>
                <span className="text-2xl font-black text-red-400" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>VS</span>
                <img src={pvpOpponentPetUrl} alt="Opponent" className="w-24 h-24 object-contain drop-shadow-lg" style={{ transform: 'scaleX(-1)' }} />
              </>
            )}
          </div>

          <div>
            <h2 className="text-3xl font-black text-white mb-2"
              style={{ textShadow: '0 2px 0 rgba(0,0,0,0.3)' }}
            >
              Astro Blast
            </h2>
            <p className="text-lg text-white/80 mb-1">
              Blast the correct asteroid as it falls!
            </p>
            <p className="text-sm text-white/60">
              Train {petName}&apos;s reflexes!
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
            className="px-10 py-4 bg-gradient-to-b from-red-500 to-red-600 text-white rounded-full font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-b-4 border-red-700"
          >
            Start!
          </button>
        </div>
      )}

      {/* Playing Phase */}
      {phase === 'playing' && (
        <div
          className="w-full h-full relative"
          onPointerDown={handleMissShot}
          style={{
            transform: screenShake > 0 ? `translate(${Math.sin(screenShake) * 4}px, ${Math.cos(screenShake) * 4}px)` : 'none'
          }}
        >
          {/* Scrolling stars — parallax downward motion */}
          {Array.from({ length: 15 }, (_, i) => {
            const size = 1 + (i % 3) // 1px, 2px, 3px — variety
            const speed = 4 + (i % 3) * 3 // 4s, 7s, 10s — farther = slower
            return (
              <div key={`star-${i}`} className="absolute rounded-full bg-white pointer-events-none"
                style={{
                  width: size,
                  height: size,
                  left: `${(i * 7.3 + 3) % 100}%`,
                  opacity: size === 1 ? 0.25 : size === 2 ? 0.4 : 0.6,
                  animation: `starfall ${speed}s linear infinite`,
                  animationDelay: `${(i * 0.8) % speed}s`,
                }}
              />
            )
          })}

          {/* Slash trail */}
          {slashTrail.map(s => (
            <div
              key={s.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: s.x,
                top: s.y,
                width: 6,
                height: 6,
                background: `rgba(255, 255, 255, ${s.opacity * 0.6})`,
                boxShadow: `0 0 8px rgba(255, 200, 50, ${s.opacity * 0.5})`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}

          {/* Flying Words */}
          {flyingWords.map(w => (
            <button
              key={w.id}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSlash(w) }}
              disabled={w.slashed || w.wrong}
              className="absolute touch-none cursor-pointer"
              style={{
                left: `${w.x - 50}px`,
                top: `${w.y - 24}px`,
                opacity: w.opacity,
                transform: `scale(${w.scale}) rotate(${w.rotation}deg)`,
                transition: w.slashed || w.wrong ? 'transform 0.3s ease-out' : 'none',
                zIndex: w.isChest ? 6 : w.isCorrect ? 5 : 1,
              }}
            >
              {w.isChest ? (
                /* Chest asteroid */
                <div className="relative flex flex-col items-center"
                  style={{
                    animation: !w.slashed ? 'wordFlyUp 0.4s ease-out' : 'none',
                    minWidth: '90px',
                    filter: w.slashed ? 'brightness(1.5)' : 'drop-shadow(0 0 12px rgba(245,158,11,0.6))',
                  }}
                >
                  <span className="text-5xl">{'\uD83D\uDCE6'}</span>
                </div>
              ) : asteroidSkinUrls?.length > 0 ? (
                /* Image-based asteroid skin */
                <div className="relative flex flex-col items-center"
                  style={{
                    animation: !w.slashed && !w.wrong ? 'wordFlyUp 0.4s ease-out' : 'none',
                    minWidth: '90px',
                  }}
                >
                  <img
                    src={asteroidSkinUrls[w.skinIdx % asteroidSkinUrls.length]}
                    alt=""
                    className="w-16 h-16 object-contain pointer-events-none"
                    style={{
                      filter: w.slashed
                        ? 'brightness(1.5) hue-rotate(90deg)'
                        : w.wrong
                          ? 'brightness(0.5) saturate(2) hue-rotate(-30deg)'
                          : 'drop-shadow(0 0 8px rgba(251,146,60,0.3))',
                    }}
                  />
                  <div className={`px-3 py-1 font-bold text-lg uppercase tracking-wide whitespace-nowrap text-center ${
                    w.slashed
                      ? 'text-green-200'
                      : w.wrong
                        ? 'text-red-300/50 line-through'
                        : 'text-white'
                  }`}
                    style={{
                      textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)',
                    }}
                  >
                    {w.y > 130 ? w.word : '???'}
                  </div>
                </div>
              ) : (
                /* Default CSS rock asteroid */
                <div className="relative"
                  style={{
                    clipPath: ASTEROID_CLIPS[w.clipIdx],
                    animation: !w.slashed && !w.wrong ? 'wordFlyUp 0.4s ease-out' : 'none',
                    minWidth: '90px',
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: w.slashed
                      ? 'radial-gradient(ellipse at 35% 30%, #4ade80 0%, #166534 100%)'
                      : w.wrong
                        ? 'radial-gradient(ellipse at 35% 30%, #7f1d1d 0%, #450a0a 100%)'
                        : 'radial-gradient(ellipse at 25% 20%, #a8a29e 0%, #78716c 20%, #57534e 45%, #44403c 70%, #1c1917 100%)',
                  }} />
                  {!w.slashed && !w.wrong && (
                    <>
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'radial-gradient(circle at 20% 25%, rgba(255,255,255,0.15) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.08) 0%, transparent 30%)',
                      }} />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'radial-gradient(circle 8px at 30% 55%, rgba(0,0,0,0.4) 0%, transparent 100%), radial-gradient(circle 6px at 65% 35%, rgba(0,0,0,0.35) 0%, transparent 100%), radial-gradient(circle 5px at 50% 75%, rgba(0,0,0,0.3) 0%, transparent 100%)',
                      }} />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'radial-gradient(circle 9px at 28% 52%, rgba(255,255,255,0.1) 0%, transparent 100%), radial-gradient(circle 7px at 63% 32%, rgba(255,255,255,0.08) 0%, transparent 100%)',
                      }} />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%)',
                      }} />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(315deg, rgba(0,0,0,0.25) 0%, transparent 40%)',
                      }} />
                    </>
                  )}
                  {!w.slashed && !w.wrong && (
                    <div style={{
                      position: 'absolute', inset: -2,
                      clipPath: ASTEROID_CLIPS[w.clipIdx],
                      boxShadow: 'inset 0 0 12px 2px rgba(251,146,60,0.25), 0 0 20px 4px rgba(251,146,60,0.2), 0 0 40px 8px rgba(251,146,60,0.08)',
                      pointerEvents: 'none',
                    }} />
                  )}
                  <div className={`relative px-6 py-4 font-bold text-lg uppercase tracking-wide whitespace-nowrap text-center ${
                    w.slashed
                      ? 'text-green-200'
                      : w.wrong
                        ? 'text-red-300/50 line-through'
                        : 'text-white'
                  }`}
                    style={{
                      textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)',
                    }}
                  >
                    {w.y > 130 ? w.word : '???'}
                  </div>
                </div>
              )}
            </button>
          ))}

          {/* Particles */}
          {particles.map(p => (
            <div
              key={p.id}
              className="absolute w-3 h-3 rounded-full pointer-events-none"
              style={{
                left: p.x,
                top: p.y,
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}

          {/* Feedback text */}
          {feedback && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                left: feedback.x,
                top: feedback.y - 30,
                animation: 'slashFeedback 0.6s ease-out forwards',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className={`text-2xl font-black ${feedback.type === 'correct' ? 'text-green-400' : 'text-red-400'}`}
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
              >
                {feedback.type === 'correct' ? 'BLAST!' : 'MISS!'}
              </span>
            </div>
          )}

          {/* TOP HUD */}
          <div className="absolute top-0 left-0 right-0 p-4 z-10 pointer-events-none">
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2 pointer-events-auto">
              {/* Score / Pet / Timer row */}
              <div className="w-full flex items-center justify-between pl-12">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2">
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

                {/* Timer */}
                {(() => {
                  const pct = displayTime / GAME_DURATION
                  const radius = 22
                  const circumference = 2 * Math.PI * radius
                  const offset = circumference * (1 - pct)
                  const color = displayTime <= 5 ? '#ef4444' : displayTime <= 10 ? '#f97316' : displayTime <= 20 ? '#eab308' : '#22c55e'
                  return (
                    <div className="relative flex items-center justify-center"
                      style={{
                        animation: displayTime <= 5 ? 'timerUrgent 0.5s ease-in-out infinite'
                          : displayTime <= 10 ? 'timerUrgent 1s ease-in-out infinite' : 'none'
                      }}
                    >
                      <svg width="56" height="56" className="drop-shadow-lg" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="28" cy="28" r={radius} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                        <circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
                          strokeDasharray={circumference} strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                        />
                      </svg>
                      <span className="absolute font-black text-white"
                        style={{ fontSize: displayTime < 10 ? '18px' : '16px', textShadow: `0 0 8px ${color}80, 0 1px 2px rgba(0,0,0,0.3)` }}
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
                  className="bg-white/15 backdrop-blur rounded-full p-1.5"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>
              </div>

              {/* Hint + Streak */}
              <div className="w-full flex items-center gap-2">
                <div className={`rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1 shrink-0 ${
                  streak >= 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/15 text-white/70'
                }`}>
                  <img src={assetUrl('/icon/profile/streak.svg')} alt="streak" className="w-3.5 h-3.5" />{streak}x
                </div>
                <div className="flex-1 bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center min-w-0"
                  style={{ animation: currentHint ? 'hintPulse 2s ease-in-out infinite' : 'none' }}
                >
                  <span className="text-xs text-white/50 mr-1">Blast:</span>
                  <span className="text-base font-bold text-white">{currentHint || '...'}</span>
                </div>
              </div>

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="relative"
                    style={{
                      width: 14,
                      height: 14,
                      transition: 'transform 0.3s ease',
                      transform: i === wordsCompleted ? 'scale(1.3)' : 'scale(1)',
                    }}
                  >
                    {i < wordsCompleted ? (
                      <div className="w-full h-full rounded-full flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #22d3ee, #0891b2)',
                          boxShadow: '0 0 8px rgba(34,211,238,0.5)',
                        }}
                      >
                        <span className="text-white font-bold text-[8px]">✓</span>
                      </div>
                    ) : i === wordsCompleted ? (
                      <div className="w-full h-full rounded-full border-2 border-white/60 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.15)', animation: 'hintPulse 1.5s ease-in-out infinite' }}
                      >
                        <span className="text-white/80 font-bold text-[7px]">{i + 1}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-full border border-white/20 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                      >
                        <span className="text-white/30 text-[7px]">{i + 1}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Word Popup */}
          {wordPopup && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-1" style={{ animation: 'wordPopupAnim 1s ease-out forwards' }}>
                <div className="text-3xl font-black text-white drop-shadow-lg">+{wordPopup.points}</div>
                {wordPopup.streak > 1 && (
                  <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 rounded-full px-3 py-1 text-sm font-bold">
                    <img src={assetUrl('/icon/profile/streak.svg')} alt="streak" className="w-4 h-4" />{wordPopup.streak}x streak
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chest collected popup */}
          {chestPopup && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2" style={{ animation: 'chestPopupAnim 1.5s ease-out forwards' }}>
                <span className="text-5xl">{'\uD83D\uDCE6'}</span>
                <div className="bg-amber-500 text-white rounded-full px-4 py-1.5 font-bold text-sm shadow-lg">
                  Chest Found!
                </div>
              </div>
            </div>
          )}

          {/* Laser beam */}
          {laser && (() => {
            const dx = laser.toX - laser.fromX
            const dy = laser.toY - laser.fromY
            const length = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx) * (180 / Math.PI)
            const correctColor = shipLaserColor || '#22d3ee'
            const color = laser.type === 'correct' ? correctColor : laser.type === 'wrong' ? '#ef4444' : '#94a3b8'
            const correctGlow = (shipLaserColor ? shipLaserColor + '99' : 'rgba(34,211,238,0.6)')
            const glow = laser.type === 'correct' ? correctGlow : laser.type === 'wrong' ? 'rgba(239,68,68,0.6)' : 'rgba(148,163,184,0.3)'
            return (
              <div
                className="absolute pointer-events-none z-30"
                style={{
                  left: laser.fromX,
                  top: laser.fromY,
                  width: length,
                  height: 4,
                  transformOrigin: '0 50%',
                  transform: `rotate(${angle}deg)`,
                  background: `linear-gradient(90deg, ${color}, white 50%, ${color})`,
                  boxShadow: `0 0 12px 4px ${glow}, 0 0 30px 8px ${glow}`,
                  borderRadius: 2,
                  animation: 'laserFire 0.3s ease-out forwards',
                }}
              />
            )
          })()}

          {/* Spaceship */}
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: shipX,
              bottom: 30,
              animation: shipRecoil ? 'shipRecoil 0.3s ease-out' : 'shipIdle 2s ease-in-out infinite',
            }}
          >
            {shipSkinUrl ? (
              <img src={shipSkinUrl} alt="ship" className="w-[72px] h-[84px] object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.4))' }} />
            ) : (
              <svg width="72" height="84" viewBox="0 0 48 56" style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.4))' }}>
                <path d="M24 2 L32 20 L34 40 L28 48 L20 48 L14 40 L16 20 Z" fill="url(#shipHull)" stroke="#94a3b8" strokeWidth="1" />
                <path d="M14 30 L2 44 L8 44 L16 38 Z" fill="#475569" stroke="#64748b" strokeWidth="0.5" />
                <path d="M34 30 L46 44 L40 44 L32 38 Z" fill="#475569" stroke="#64748b" strokeWidth="0.5" />
                <ellipse cx="24" cy="16" rx="4" ry="6" fill="url(#cockpit)" />
                <ellipse cx="24" cy="50" rx="5" ry="4" fill="url(#engineGlow)" opacity="0.9" />
                <defs>
                  <linearGradient id="shipHull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#cbd5e1" />
                    <stop offset="50%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                  <radialGradient id="cockpit">
                    <stop offset="0%" stopColor="#67e8f9" />
                    <stop offset="100%" stopColor="#0891b2" />
                  </radialGradient>
                  <radialGradient id="engineGlow">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="50%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                </defs>
              </svg>
            )}
          </div>

          {/* Bottom instruction */}
          <div className="absolute bottom-2 left-0 right-0 z-10 pointer-events-none">
            <p className="text-center text-white/30 text-xs">Tap the correct asteroid!</p>
          </div>
        </div>
      )}

      {/* Results Phase */}
      {phase === 'results' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto p-6 z-50">
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center my-auto"
            style={{ animation: 'slasherResultsFadeIn 0.5s ease-out' }}
          >
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-4"
              style={{ animation: 'slasherScorePopIn 0.6s ease-out 0.3s both' }}
            >
              <Trophy className="w-10 h-10 text-red-500" />
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {wordsCompleted >= 20 ? 'Training Complete!' : 'Not Enough Words!'}
            </h2>
            <p className="text-gray-500 mb-5">
              {wordsCompleted >= 20
                ? `${petName} blasted ${wordsCompleted} words!`
                : `${petName} only blasted ${wordsCompleted}/20 words`}
            </p>

            <div
              className={`rounded-2xl p-5 mb-5 border ${wordsCompleted >= 20 ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
              style={{ animation: 'slasherScorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className={`text-5xl font-black ${wordsCompleted >= 20 ? 'text-red-600' : 'text-gray-400'}`}>{wordsCompleted}</p>
              <p className={`text-sm font-semibold mt-1 ${wordsCompleted >= 20 ? 'text-red-400' : 'text-gray-400'}`}>words blasted</p>
            </div>

            {/* Missed Words */}
            {missedWords.length > 0 && (
              <div className="mb-5 text-left">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">Words to Practice</p>
                <div className="max-h-[180px] overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {missedWords.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                      <span className="font-bold text-sm text-gray-800">{w.word}</span>
                      <span className="text-xs text-gray-400 ml-auto">{w.hint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chest result */}
            {chestCollected && (
              <div className="mb-4 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5"
                style={{ animation: 'slasherScorePopIn 0.6s ease-out 0.7s both' }}
              >
                <span className="text-2xl">{'\uD83D\uDCE6'}</span>
                <span className="font-bold text-amber-700 text-sm">Chest collected!</span>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-6">
              {wordsCompleted >= 25
                ? 'Blast master! 🏆'
                : wordsCompleted >= 20
                  ? 'Amazing reflexes! 🚀'
                  : 'Need at least 20 words to earn XP. Try again! 💪'}
            </p>

            {wordsCompleted >= 20 ? (
              <button
                onClick={() => onGameEnd(displayScore, { chestCollected, wordsCompleted })}
                className="w-full py-3.5 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-red-700 active:border-b-0 active:mt-1 transition-all"
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
                  className="w-full py-3.5 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-red-700 active:border-b-0 active:mt-1 transition-all"
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

export default PetAstroBlast
