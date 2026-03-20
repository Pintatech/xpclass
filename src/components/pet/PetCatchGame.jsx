import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Heart } from 'lucide-react'

import { assetUrl } from '../../hooks/useBranding';

const GAME_DURATION = 76
const PET_SIZE = 64
const FRUIT_SIZE = 48
const CATCH_RADIUS = 44
const POINTS_CORRECT = 20
const POINTS_WRONG = -5
const QUESTION_DELAY = 1000
const PET_MAX_HP = 5
const PASS_THRESHOLDS = { 1: 20, 2: 23, 3: 25, 4: 28 }

const FRUIT_EMOJIS = ['🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🍅', '🍆', '🌽', '🥑', '🍕', '🍔', '🌭', '🥨', '🍞', '🌮', '🥪', '🍗', '🍖', '🍩', '🍰', '🧁']

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PetCatchGame = ({ petImageUrl, petName, onGameEnd, onClose, questionBank: questionBankProp = [], chestEnabled = false, currentLevel = 1 }) => {
  const passGoal = PASS_THRESHOLDS[currentLevel] || 20
  const [phase, setPhase] = useState('countdown')
  const [displayScore, setDisplayScore] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [countdownNumber, setCountdownNumber] = useState(3)
  const [catchEffects, setCatchEffects] = useState([])
  const [, setRenderTick] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [questionsCorrect, setQuestionsCorrect] = useState(0)
  const [questionsTotal, setQuestionsTotal] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [streak, setStreak] = useState(0)
  const [petHp, setPetHp] = useState(PET_MAX_HP)
  const [fruits, setFruits] = useState([]) // displayed fruit choices

  const [chestCollected, setChestCollected] = useState(false)
  const [chestPopup, setChestPopup] = useState(false)

  const gameAreaRef = useRef(null)
  const petPosRef = useRef({ x: 0.5, y: 0.85 })
  const scoreRef = useRef(0)
  const timeRef = useRef(GAME_DURATION)
  const animFrameRef = useRef(null)
  const lastFrameTimeRef = useRef(0)
  const gameStartTimeRef = useRef(0)
  const gameEndedRef = useRef(false)
  const frameCountRef = useRef(0)
  const catchSoundRef = useRef(null)
  const wrongSoundRef = useRef(null)
  const questionsRef = useRef([])
  const qIndexRef = useRef(0)
  const currentQuestionRef = useRef(null)
  const waitingNextRef = useRef(false)
  const streakRef = useRef(0)
  const petHpRef = useRef(PET_MAX_HP)
  const chestSpawnedRef = useRef(false)
  const chestQRef = useRef(0)
  const questionsCorrectRef = useRef(0)
  const questionsTotalRef = useRef(0)
  const fruitsRef = useRef([])
  const bgMusicRef = useRef(null)

  // Pre-load sounds
  useEffect(() => {
    catchSoundRef.current = new Audio(assetUrl('/sound/chomp.mp3'))
    catchSoundRef.current.volume = 0.5
    wrongSoundRef.current = new Audio(assetUrl('/sound/chomp.mp3'))
    wrongSoundRef.current.volume = 0.3
  }, [])

  // Prepare questions
  useEffect(() => {
    if (questionBankProp.length > 0) {
      questionsRef.current = shuffle(questionBankProp).slice(0, 30)
      chestQRef.current = 3 + Math.floor(Math.random() * 8) // chest on question 3-10
    }
  }, [questionBankProp])

  // Place fruits at fixed positions for current question
  const spawnQuestion = useCallback(() => {
    if (qIndexRef.current >= questionsRef.current.length) {
      questionsRef.current = shuffle(questionsRef.current)
      qIndexRef.current = 0
    }
    const q = questionsRef.current[qIndexRef.current]
    qIndexRef.current++
    currentQuestionRef.current = q
    setCurrentQuestion(q)
    setFeedback(null)
    waitingNextRef.current = false

    // Place choices as fruits at spread-out positions
    const count = q.choices.length
    const shuffledChoices = shuffle(q.choices.map((text, i) => ({ text, index: i })))
    const usedEmojis = shuffle([...FRUIT_EMOJIS]).slice(0, count)

    // Check if this question should have a chest
    const isChestQ = chestEnabled && !chestSpawnedRef.current && qIndexRef.current === chestQRef.current

    // Distribute fruits in a grid-like pattern across the play area
    // Avoid top area (question) and very bottom (pet start)
    const positions = []
    if (count <= 2) {
      positions.push({ x: 0.25, y: 0.45 }, { x: 0.75, y: 0.45 })
    } else if (count <= 4) {
      positions.push(
        { x: 0.25, y: 0.35 }, { x: 0.75, y: 0.35 },
        { x: 0.25, y: 0.58 }, { x: 0.75, y: 0.58 },
      )
    } else {
      // 5-6 choices
      positions.push(
        { x: 0.2, y: 0.32 }, { x: 0.5, y: 0.32 }, { x: 0.8, y: 0.32 },
        { x: 0.2, y: 0.55 }, { x: 0.5, y: 0.55 }, { x: 0.8, y: 0.55 },
      )
    }

    // Add slight randomness to positions
    const newFruits = shuffledChoices.map((choice, i) => {
      const pos = positions[i] || { x: 0.5, y: 0.45 }
      return {
        id: `${qIndexRef.current}-${i}`,
        x: pos.x + (Math.random() - 0.5) * 0.08,
        y: pos.y + (Math.random() - 0.5) * 0.06,
        text: choice.text,
        choiceIndex: choice.index,
        isCorrect: choice.index === q.answer_index,
        isChest: isChestQ && choice.index === q.answer_index,
        emoji: usedEmojis[i],
        eaten: false,
        scale: 1,
      }
    })

    fruitsRef.current = newFruits
    setFruits(newFruits)
  }, [chestEnabled])

  // Trigger floating effect
  const triggerCatchEffect = useCallback((x, y, text, color, isCorrect) => {
    const effectId = Date.now() + Math.random()
    setCatchEffects(prev => [...prev, { id: effectId, x, y, text, color, isCorrect }])
    try {
      const sound = (isCorrect ? catchSoundRef.current : wrongSoundRef.current)?.cloneNode()
      if (sound) {
        sound.volume = isCorrect ? 0.4 : 0.25
        sound.play().catch(() => {})
      }
    } catch { /* ignore */ }
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

  // Input handling - free movement
  useEffect(() => {
    if (phase !== 'playing') return
    const gameArea = gameAreaRef.current
    if (!gameArea) return

    const FINGER_OFFSET = 300 // px above touch point so finger doesn't cover pet
    const updatePetPos = (clientX, clientY) => {
      const rect = gameArea.getBoundingClientRect()
      petPosRef.current = {
        x: Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width)),
        y: Math.max(0.1, Math.min(0.95, (clientY - FINGER_OFFSET - rect.top) / rect.height)),
      }
    }

    const handleMouseMove = (e) => updatePetPos(e.clientX, e.clientY)
    const handleTouchMove = (e) => {
      e.preventDefault()
      if (e.touches.length > 0) updatePetPos(e.touches[0].clientX, e.touches[0].clientY)
    }
    const handleTouchStart = (e) => {
      if (e.touches.length > 0) updatePetPos(e.touches[0].clientX, e.touches[0].clientY)
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

  // Main game loop — only handles timer + collision detection
  useEffect(() => {
    if (phase !== 'playing') return
    if (questionsRef.current.length === 0) return

    gameStartTimeRef.current = performance.now()
    lastFrameTimeRef.current = performance.now()
    timeRef.current = GAME_DURATION
    scoreRef.current = 0
    gameEndedRef.current = false
    frameCountRef.current = 0
    streakRef.current = 0
    questionsCorrectRef.current = 0
    questionsTotalRef.current = 0
    chestSpawnedRef.current = false
    qIndexRef.current = 0
    petHpRef.current = PET_MAX_HP
    setPetHp(PET_MAX_HP)

    try {
      const music = new Audio(assetUrl('/sound/pet-word-scamble-2-faster.mp3'))
      music.loop = true
      music.volume = 0.3
      bgMusicRef.current = music
      music.play().catch(() => {})
    } catch {}

    spawnQuestion()

    const gameLoop = (timestamp) => {
      if (gameEndedRef.current) return

      lastFrameTimeRef.current = timestamp
      const elapsed = (timestamp - gameStartTimeRef.current) / 1000

      timeRef.current = Math.max(0, GAME_DURATION - elapsed)
      setDisplayTime(Math.ceil(timeRef.current))

      if (timeRef.current <= 0) {
        gameEndedRef.current = true
        if (bgMusicRef.current) {
          bgMusicRef.current.pause()
          bgMusicRef.current = null
        }
        setDisplayScore(scoreRef.current)
        setPhase('results')
        return
      }

      // Check collision with fruits
      if (!waitingNextRef.current) {
        const gameWidth = gameAreaRef.current?.clientWidth || 300
        const gameHeight = gameAreaRef.current?.clientHeight || 600
        const petPixelX = petPosRef.current.x * gameWidth
        const petPixelY = petPosRef.current.y * gameHeight

        for (const fruit of fruitsRef.current) {
          if (fruit.eaten) continue
          const fruitPixelX = fruit.x * gameWidth
          const fruitPixelY = fruit.y * gameHeight
          const dist = Math.sqrt(
            Math.pow(petPixelX - fruitPixelX, 2) +
            Math.pow(petPixelY - fruitPixelY, 2)
          )

          if (dist < CATCH_RADIUS + FRUIT_SIZE / 2) {
            fruit.eaten = true
            fruit.scale = 0

            // Chest check
            if (fruit.isChest) {
              chestSpawnedRef.current = true
              setChestCollected(true)
              setChestPopup(true)
              setTimeout(() => setChestPopup(false), 1500)
            }

            if (fruit.isCorrect) {
              streakRef.current++
              const bonus = streakRef.current >= 3 ? 10 : 0
              const points = POINTS_CORRECT + bonus
              scoreRef.current = Math.max(0, scoreRef.current + points)
              questionsCorrectRef.current++
              questionsTotalRef.current++
              setDisplayScore(scoreRef.current)
              setQuestionsCorrect(questionsCorrectRef.current)
              setQuestionsTotal(questionsTotalRef.current)
              setStreak(streakRef.current)
              triggerCatchEffect(fruitPixelX, fruitPixelY, `+${points}`, '#22c55e', true)
              setFeedback({ type: 'correct', text: fruit.text })

              // Next question after delay
              waitingNextRef.current = true
              setTimeout(() => {
                if (!gameEndedRef.current) spawnQuestion()
              }, QUESTION_DELAY)
            } else {
              streakRef.current = 0
              scoreRef.current = Math.max(0, scoreRef.current + POINTS_WRONG)
              questionsTotalRef.current++
              setDisplayScore(scoreRef.current)
              setQuestionsTotal(questionsTotalRef.current)
              setStreak(0)
              triggerCatchEffect(fruitPixelX, fruitPixelY, `${POINTS_WRONG}`, '#ef4444', false)
              setFeedback({ type: 'wrong', text: fruit.text })

              const newPetHp = petHpRef.current - 1
              petHpRef.current = newPetHp
              setPetHp(newPetHp)
              if (newPetHp <= 0) {
                setTimeout(() => {
                  gameEndedRef.current = true
                  cancelAnimationFrame(animFrameRef.current)
                  if (bgMusicRef.current) {
                    bgMusicRef.current.pause()
                    bgMusicRef.current = null
                  }
                  setPhase('defeated')
                }, 800)
                return
              }
            }

            // Update visual
            setFruits([...fruitsRef.current])
            break // only one collision per frame
          }
        }
      }

      // Re-render pet position ~30fps
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
      if (bgMusicRef.current) {
        bgMusicRef.current.pause()
        bgMusicRef.current = null
      }
    }
  }, [phase, spawnQuestion, triggerCatchEffect])

  // Play end-of-game sounds
  useEffect(() => {
    try {
      if (phase === 'results') {
        if (questionsCorrectRef.current >= passGoal) {
          const sound = new Audio('https://xpclass.vn/xpclass/pet-game/angry/angry-birds-level-complete.mp3')
          sound.volume = 0.5
          sound.play().catch(() => {})
        } else {
          const sound = new Audio('https://xpclass.vn/xpclass/sound/craft_fail.mp3')
          sound.volume = 0.5
          sound.play().catch(() => {})
        }
      }
      if (phase === 'defeated') {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/craft_fail.mp3')
        sound.volume = 0.5
        sound.play().catch(() => {})
      }
    } catch {}
  }, [phase, passGoal])

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <div
        className="relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl"
      >
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img src="https://xpclass.vn/xpclass/image/pet/pet-catch-bg.jpg" alt="" className="w-full h-full object-cover blur-sm" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
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
        @keyframes resultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes fruitBob {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes fruitAppear {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          60% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes chestPopupAnim {
          0% { transform: scale(0) translateY(0); opacity: 0; }
          20% { transform: scale(1.2) translateY(0); opacity: 1; }
          40% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(-80px); opacity: 0; }
        }
        @keyframes wrongShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes streakPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes bbHeartLose {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes hintPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes timerUrgent {
          0%, 100% { transform: scale(1) rotate(0deg); }
          15% { transform: scale(1.1) rotate(-3deg); }
          30% { transform: scale(1) rotate(3deg); }
          45% { transform: scale(1.05) rotate(-2deg); }
          60% { transform: scale(1) rotate(0deg); }
        }
      `}</style>

      {/* Close Button */}
      {phase !== 'results' && phase !== 'defeated' && (
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-colors"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* HUD */}
      {phase === 'playing' && (
        <div className="absolute top-4 left-0 right-0 z-40 pl-14 pr-4">
          <div className="flex items-center justify-between">
            {/* Score */}
            <div className="bg-white/15 backdrop-blur rounded-2xl px-4 py-2">
              <span className="text-xl font-black text-white">{displayScore}</span>
            </div>
            {/* HP Hearts */}
            <div className="flex gap-0.5 items-center">
              {Array.from({ length: PET_MAX_HP }).map((_, i) => (
                <Heart key={i} className={`w-4 h-4 transition-all ${i < petHp ? 'text-red-400 fill-red-400' : 'text-gray-400/40'}`}
                  style={i === petHp ? { animation: 'bbHeartLose 0.5s ease-out' } : {}}
                />
              ))}
            </div>
            {/* Circular Timer */}
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
                  <svg width="48" height="48" className="drop-shadow-lg" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="24" cy="24" r={radius} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                    <circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={circumference} strokeDashoffset={offset}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                    />
                  </svg>
                  <span className="absolute font-black text-white"
                    style={{ fontSize: displayTime < 10 ? '16px' : '14px', textShadow: `0 0 8px ${color}80, 0 1px 2px rgba(0,0,0,0.3)` }}
                  >
                    {displayTime}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Question + Streak + Progress */}
      {phase === 'playing' && currentQuestion && (
        <div className="absolute top-16 left-0 right-0 z-40 pointer-events-none px-4">
          <div className="w-full flex items-center gap-2">
            <div className={`rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1 shrink-0 ${
              streak >= 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-white/15 text-white/70'
            }`}>
              <img src={assetUrl('/icon/profile/streak.svg')} alt="streak" className="w-3.5 h-3.5" />{streak}x
            </div>
            <div className={`flex-1 bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center min-w-0 ${
              feedback?.type === 'wrong' ? '' : ''
            }`}
              style={{
                animation: feedback?.type === 'wrong' ? 'wrongShake 0.4s ease-out' : currentQuestion ? 'hintPulse 2s ease-in-out infinite' : 'none'
              }}
            >
              {currentQuestion.image_url && (
                <img src={currentQuestion.image_url} alt="" className="w-10 h-10 object-contain mx-auto mb-1 rounded-lg" />
              )}
              <span className="text-xs text-white/50 mr-1">Catch:</span>
              <span className="text-base font-bold text-white">{currentQuestion.question}</span>
              {feedback && (
                <p className={`text-xs font-semibold mt-0.5 ${feedback.type === 'correct' ? 'text-green-300' : 'text-red-300'}`}>
                  {feedback.type === 'correct' ? '✓ Correct!' : `✗ "${feedback.text}" is wrong`}
                </p>
              )}
            </div>
          </div>
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1 mt-2">
            {Array.from({ length: passGoal }, (_, i) => (
              <div
                key={i}
                className="relative"
                style={{
                  width: 14,
                  height: 14,
                  transition: 'transform 0.3s ease',
                  transform: i === questionsCorrect ? 'scale(1.3)' : 'scale(1)',
                }}
              >
                {i < questionsCorrect ? (
                  <div className="w-full h-full rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #22d3ee, #0891b2)',
                      boxShadow: '0 0 8px rgba(34,211,238,0.5)',
                    }}
                  >
                    <span className="text-white font-bold text-[8px]">✓</span>
                  </div>
                ) : i === questionsCorrect ? (
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

          {/* Fruit choices */}
          {fruits.map(fruit => (
            <div
              key={fruit.id}
              className="absolute pointer-events-none flex flex-col items-center"
              style={{
                left: `${fruit.x * 100}%`,
                top: `${fruit.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                opacity: fruit.eaten ? 0 : 1,
                transition: fruit.eaten ? 'opacity 0.2s, transform 0.2s' : 'none',
                animation: fruit.eaten ? 'none' : 'fruitAppear 0.4s ease-out forwards',
              }}
            >
              {/* Word label above fruit */}
              <div className="mb-1">
                <span className="inline-block bg-white/95 text-gray-800 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md border border-gray-200 whitespace-nowrap"
                  style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {fruit.text}
                </span>
              </div>
              {/* Fruit emoji */}
              <div style={{
                fontSize: FRUIT_SIZE - 8,
                lineHeight: 1,
                animation: 'none',
                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.15))',
              }}>
                {fruit.isChest ? '📦' : fruit.emoji}
              </div>
            </div>
          ))}

          {/* Chest collected popup */}
          {chestPopup && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2" style={{ animation: 'chestPopupAnim 1.5s ease-out forwards' }}>
                <span className="text-5xl">📦</span>
                <div className="bg-amber-500 text-white rounded-full px-4 py-1.5 font-bold text-sm shadow-lg">
                  Chest Found!
                </div>
              </div>
            </div>
          )}

          {/* Catch Effects */}
          {catchEffects.map(effect => (
            <div
              key={effect.id}
              className="absolute pointer-events-none font-black text-xl z-30"
              style={{
                left: effect.x,
                top: effect.y,
                transform: 'translateX(-50%)',
                color: effect.isCorrect ? '#22c55e' : '#ef4444',
                animation: 'catchFloat 0.8s ease-out forwards',
                textShadow: '0 0 8px rgba(255,255,255,0.9), 1px 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              {effect.text}
            </div>
          ))}

          {/* Pet (player character) */}
          <div
            className="absolute z-20"
            style={{
              left: `${petPosRef.current.x * 100}%`,
              top: `${petPosRef.current.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: PET_SIZE,
              height: PET_SIZE,
              transition: 'left 0.03s linear, top 0.03s linear',
            }}
          >
            <img
              src={petImageUrl}
              alt={petName}
              className="w-full h-full object-contain drop-shadow-lg"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>
      )}

      {/* Defeated Phase */}
      {phase === 'defeated' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto p-6 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center my-auto"
            style={{ animation: 'resultsFadeIn 0.5s ease-out' }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-4"
              style={{ animation: 'scorePopIn 0.6s ease-out 0.3s both' }}
            >
              <Heart className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Defeated!</h2>
            <p className="text-gray-500 mb-5">{petName} ran out of lives!</p>

            <div
              className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 mb-4 border border-gray-200"
              style={{ animation: 'scorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className="text-5xl font-black text-gray-500">{displayScore}</p>
              <p className="text-sm text-gray-400 font-semibold mt-1">points scored</p>
            </div>

            <p className="text-sm text-gray-600 mb-6">Try to keep your lives! Wrong catches cost a heart.</p>

            <button
              onClick={() => {
                setPhase('countdown')
                setCountdownNumber(3)
              }}
              className="w-full py-3.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-cyan-600 active:border-b-0 active:mt-1 transition-all mb-3"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-bold text-base transition-all"
            >
              Close
            </button>
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

            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {questionsCorrect >= passGoal ? 'Training Complete!' : 'Not Enough Catches!'}
            </h2>
            <p className="text-gray-500 mb-5">
              {questionsCorrect >= passGoal
                ? `${petName} caught ${questionsCorrect} correct!`
                : `${petName} only caught ${questionsCorrect}/${passGoal} correct`}
            </p>

            <div
              className={`rounded-2xl p-5 mb-4 border ${questionsCorrect >= passGoal ? 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
              style={{ animation: 'scorePopIn 0.6s ease-out 0.5s both' }}
            >
              <p className={`text-5xl font-black ${questionsCorrect >= passGoal ? 'text-orange-600' : 'text-gray-400'}`}>{questionsCorrect}</p>
              <p className={`text-sm font-semibold mt-1 ${questionsCorrect >= passGoal ? 'text-orange-400' : 'text-gray-400'}`}>correct catches</p>
            </div>

            <div className="flex justify-center gap-4 mb-5 text-sm"
              style={{ animation: 'scorePopIn 0.6s ease-out 0.6s both' }}
            >
              <div className="bg-green-50 rounded-xl px-4 py-2 border border-green-100">
                <p className="text-2xl font-bold text-green-600">{questionsCorrect}</p>
                <p className="text-green-500">correct</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-2 border border-gray-100">
                <p className="text-2xl font-bold text-gray-600">{questionsTotal}</p>
                <p className="text-gray-400">total</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {questionsCorrect >= passGoal + 5
                ? 'Amazing reflexes! 🏆'
                : questionsCorrect >= passGoal
                  ? 'Great catching! 💪'
                  : `Need at least ${passGoal} correct catches to earn XP. Try again! 💪`}
            </p>

            {chestCollected && (
              <div className="mb-4 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5"
                style={{ animation: 'scorePopIn 0.6s ease-out 0.7s both' }}
              >
                <span className="text-2xl">📦</span>
                <span className="font-bold text-amber-700">Chest collected!</span>
              </div>
            )}

            {questionsCorrect >= passGoal ? (
              <button
                onClick={() => onGameEnd(displayScore, { chestCollected })}
                className="w-full py-3.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-cyan-600 active:border-b-0 active:mt-1 transition-all"
              >
                Collect Rewards ✨
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setPhase('countdown'); setDisplayScore(0); setQuestionsCorrect(0); setQuestionsTotal(0) }}
                  className="w-full py-3.5 bg-gradient-to-b from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-cyan-600 active:border-b-0 active:mt-1 transition-all"
                >
                  Try Again
                </button>
                <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  Exit
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

export default PetCatchGame
