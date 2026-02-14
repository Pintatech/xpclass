import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Trophy } from 'lucide-react'

const GAME_DURATION = 60
const MOLE_SHOW_MIN = 1500
const MOLE_SHOW_MAX = 2500
const GRID_COLS = 3
const GRID_ROWS = 3
const HOLES = GRID_COLS * GRID_ROWS

// Word pairs: English word + Vietnamese hint
const WORD_PAIRS = [
  { en: 'cat', vi: 'Con m\u00e8o' },
  { en: 'dog', vi: 'Con ch\u00f3' },
  { en: 'sun', vi: 'M\u1eb7t tr\u1eddi' },
  { en: 'book', vi: 'Quy\u1ec3n s\u00e1ch' },
  { en: 'fish', vi: 'Con c\u00e1' },
  { en: 'bird', vi: 'Con chim' },
  { en: 'tree', vi: 'C\u00e1i c\u00e2y' },
  { en: 'rain', vi: 'M\u01b0a' },
  { en: 'star', vi: 'Ng\u00f4i sao' },
  { en: 'cake', vi: 'B\u00e1nh' },
  { en: 'door', vi: 'C\u00e1i c\u1eeda' },
  { en: 'hand', vi: 'B\u00e0n tay' },
  { en: 'moon', vi: 'M\u1eb7t tr\u0103ng' },
  { en: 'frog', vi: 'Con \u1ebfch' },
  { en: 'apple', vi: 'Qu\u1ea3 t\u00e1o' },
  { en: 'house', vi: 'Ng\u00f4i nh\u00e0' },
  { en: 'water', vi: 'N\u01b0\u1edbc' },
  { en: 'smile', vi: 'N\u1ee5 c\u01b0\u1eddi' },
  { en: 'table', vi: 'C\u00e1i b\u00e0n' },
  { en: 'chair', vi: 'C\u00e1i gh\u1ebf' },
  { en: 'sleep', vi: 'Ng\u1ee7' },
  { en: 'happy', vi: 'Vui v\u1ebb' },
  { en: 'music', vi: '\u00c2m nh\u1ea1c' },
  { en: 'dance', vi: 'Nh\u1ea3y m\u00faa' },
  { en: 'green', vi: 'M\u00e0u xanh l\u00e1' },
  { en: 'bread', vi: 'B\u00e1nh m\u00ec' },
  { en: 'tiger', vi: 'Con h\u1ed5' },
  { en: 'cloud', vi: '\u0110\u00e1m m\u00e2y' },
  { en: 'light', vi: '\u00c1nh s\u00e1ng' },
  { en: 'flower', vi: 'B\u00f4ng hoa' },
  { en: 'school', vi: 'Tr\u01b0\u1eddng h\u1ecdc' },
  { en: 'friend', vi: 'B\u1ea1n b\u00e8' },
  { en: 'family', vi: 'Gia \u0111\u00ecnh' },
  { en: 'orange', vi: 'Qu\u1ea3 cam' },
  { en: 'monkey', vi: 'Con kh\u1ec9' },
  { en: 'rabbit', vi: 'Con th\u1ecf' },
  { en: 'mother', vi: 'M\u1eb9' },
  { en: 'father', vi: 'B\u1ed1' },
  { en: 'garden', vi: 'Khu v\u01b0\u1eddn' },
  { en: 'winter', vi: 'M\u00f9a \u0111\u00f4ng' },
  { en: 'summer', vi: 'M\u00f9a h\u00e8' },
  { en: 'banana', vi: 'Qu\u1ea3 chu\u1ed1i' },
  { en: 'kitchen', vi: 'Nh\u00e0 b\u1ebfp' },
  { en: 'teacher', vi: 'Gi\u00e1o vi\u00ean' },
  { en: 'picture', vi: 'B\u1ee9c tranh' },
  { en: 'chicken', vi: 'Con g\u00e0' },
  { en: 'student', vi: 'H\u1ecdc sinh' },
  { en: 'rainbow', vi: 'C\u1ea7u v\u1ed3ng' },
  { en: 'morning', vi: 'Bu\u1ed5i s\u00e1ng' },
  { en: 'dolphin', vi: 'C\u00e1 heo' },
]

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PetWhackMole = ({ petImageUrl, petName, onGameEnd, onClose }) => {
  const [phase, setPhase] = useState('ready')
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [targetWord, setTargetWord] = useState(null)
  // Each hole: { id, word, visible, hit, wrong, hiding }
  const [holes, setHoles] = useState(Array.from({ length: HOLES }, (_, i) => ({
    id: i, word: null, visible: false, hit: false, wrong: false, hiding: false,
  })))
  const [screenShake, setScreenShake] = useState(0)
  const [floatingTexts, setFloatingTexts] = useState([])
  const [hammerPos, setHammerPos] = useState({ x: -100, y: -100 })
  const [hammerSwing, setHammerSwing] = useState(false)

  const timerRef = useRef(null)
  const moleTimersRef = useRef([])
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const targetRef = useRef(null)
  const animFrameRef = useRef(null)
  const gameContainerRef = useRef(null)

  // Pick a new target word and spawn moles
  const spawnRound = useCallback(() => {
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)]
    setTargetWord(pair)
    targetRef.current = pair

    // Pick 2-4 moles to show (one correct, rest wrong)
    const moleCount = Math.min(HOLES, 2 + Math.floor(Math.random() * 3))
    const positions = shuffle(Array.from({ length: HOLES }, (_, i) => i)).slice(0, moleCount)
    const correctPos = positions[Math.floor(Math.random() * positions.length)]

    // Pick distractor words (different from target)
    const distractors = shuffle(WORD_PAIRS.filter(w => w.en !== pair.en))

    const newHoles = Array.from({ length: HOLES }, (_, i) => {
      const posIndex = positions.indexOf(i)
      if (posIndex === -1) {
        return { id: i, word: null, visible: false, hit: false, wrong: false, hiding: false }
      }
      const word = i === correctPos ? pair.en : distractors[posIndex % distractors.length].en
      return { id: i, word, visible: true, hit: false, wrong: false, hiding: false }
    })

    setHoles(newHoles)

    // Auto-hide moles after a delay
    const showTime = MOLE_SHOW_MIN + Math.random() * (MOLE_SHOW_MAX - MOLE_SHOW_MIN)
    const hideTimer = setTimeout(() => {
      // Start hide animation
      setHoles(prev => prev.map(h => h.visible && !h.hit ? { ...h, hiding: true } : h))
      // If player missed the correct one, break streak
      streakRef.current = 0
      setStreak(0)
      // After animation finishes, fully remove and spawn next
      const removeTimer = setTimeout(() => {
        setHoles(prev => prev.map(h => h.hiding ? { ...h, visible: false, hiding: false, word: null } : h))
        const nextTimer = setTimeout(() => spawnRound(), 200)
        moleTimersRef.current.push(nextTimer)
      }, 300)
      moleTimersRef.current.push(removeTimer)
    }, showTime)
    moleTimersRef.current.push(hideTimer)
  }, [])

  const startGame = useCallback(() => {
    scoreRef.current = 0
    streakRef.current = 0
    setScore(0)
    setStreak(0)
    setDisplayTime(GAME_DURATION)
    setFloatingTexts([])
    setPhase('playing')
  }, [])

  // Start spawning when playing begins
  useEffect(() => {
    if (phase !== 'playing') return
    const startTimer = setTimeout(() => spawnRound(), 500)
    moleTimersRef.current.push(startTimer)
    return () => {
      moleTimersRef.current.forEach(t => clearTimeout(t))
      moleTimersRef.current = []
    }
  }, [phase, spawnRound])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setInterval(() => {
      setDisplayTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          moleTimersRef.current.forEach(t => clearTimeout(t))
          moleTimersRef.current = []
          setPhase('results')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  // Hammer cursor tracking
  useEffect(() => {
    if (phase !== 'playing') return
    const container = gameContainerRef.current
    if (!container) return
    const handleMove = (e) => {
      const rect = container.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      setHammerPos({ x: clientX - rect.left, y: clientY - rect.top })
    }
    container.addEventListener('mousemove', handleMove)
    container.addEventListener('touchmove', handleMove, { passive: true })
    return () => {
      container.removeEventListener('mousemove', handleMove)
      container.removeEventListener('touchmove', handleMove)
    }
  }, [phase])

  // Screen shake decay
  useEffect(() => {
    if (phase !== 'playing') return
    const animate = () => {
      setScreenShake(prev => Math.max(0, prev - 1))
      setFloatingTexts(prev => prev.map(ft => ({
        ...ft,
        y: ft.y - 1.5,
        opacity: ft.opacity - 0.025,
      })).filter(ft => ft.opacity > 0))
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [phase])

  // Handle whacking a mole
  const handleWhack = useCallback((holeIndex) => {
    if (phase !== 'playing') return
    const hole = holes[holeIndex]
    if (!hole.visible || hole.hit || hole.hiding) return

    const target = targetRef.current
    if (!target) return

    // Trigger hammer swing
    setHammerSwing(true)
    setTimeout(() => setHammerSwing(false), 200)

    if (hole.word === target.en) {
      // CORRECT!
      const newStreak = streakRef.current + 1
      streakRef.current = newStreak
      setStreak(newStreak)
      const points = newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1
      scoreRef.current += points
      setScore(scoreRef.current)

      setHoles(prev => prev.map((h, i) =>
        i === holeIndex ? { ...h, hit: true } : h.visible ? { ...h, hiding: true } : h
      ))
      // Clean up hiding moles after animation
      setTimeout(() => {
        setHoles(prev => prev.map(h => h.hiding ? { ...h, visible: false, hiding: false, word: null } : h))
      }, 300)

      // Floating +points text
      setFloatingTexts(prev => [...prev, {
        id: Date.now(),
        text: newStreak >= 3 ? `+${points} ${newStreak}x` : `+${points}`,
        x: 50,
        y: 50,
        opacity: 1,
        color: newStreak >= 5 ? '#f59e0b' : newStreak >= 3 ? '#8b5cf6' : '#22c55e',
      }])

      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/pop2.mp3')
        sound.volume = 0.4
        sound.play().catch(() => {})
      } catch {}

      // Clear mole timers and spawn next round
      moleTimersRef.current.forEach(t => clearTimeout(t))
      moleTimersRef.current = []
      const nextTimer = setTimeout(() => spawnRound(), 600)
      moleTimersRef.current.push(nextTimer)

    } else {
      // WRONG!
      streakRef.current = 0
      setStreak(0)
      setScreenShake(10)
      setHoles(prev => prev.map((h, i) =>
        i === holeIndex ? { ...h, wrong: true } : h
      ))
      // Time penalty
      setDisplayTime(prev => Math.max(1, prev - 2))

      setFloatingTexts(prev => [...prev, {
        id: Date.now(),
        text: '-2s',
        x: 50,
        y: 50,
        opacity: 1,
        color: '#ef4444',
      }])

      try {
        const sound = new Audio('https://xpclass.vn/xpclass/sound/flappy-hit.mp3')
        sound.volume = 0.4
        sound.play().catch(() => {})
      } catch {}

      setTimeout(() => {
        setHoles(prev => prev.map((h, i) =>
          i === holeIndex ? { ...h, wrong: false } : h
        ))
      }, 300)
    }
  }, [phase, holes, spawnRound])

  const timerPct = displayTime / GAME_DURATION
  const timerRadius = 22
  const timerCircumference = 2 * Math.PI * timerRadius
  const timerOffset = timerCircumference * (1 - timerPct)
  const timerColor = displayTime <= 5 ? '#ef4444' : displayTime <= 10 ? '#f97316' : displayTime <= 20 ? '#eab308' : '#22c55e'

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes molePopUp {
          0% { transform: translateY(100%) scale(0.8); opacity: 0; }
          60% { transform: translateY(-10%) scale(1.05); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes moleHide {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(100%) scale(0.8); opacity: 0; }
        }
        @keyframes moleWhacked {
          0% { transform: scale(1) rotate(0deg); }
          30% { transform: scale(1.3) rotate(-10deg); }
          60% { transform: scale(0.5) rotate(15deg); opacity: 0.5; }
          100% { transform: scale(0) rotate(30deg); opacity: 0; }
        }
        @keyframes moleWrong {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes moleFloat {
          0%, 100% { transform: translateY(-5px); }
          50% { transform: translateY(5px); }
        }
        @keyframes moleResultsFadeIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes moleScorePopIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes timerUrgentMole {
          0%, 100% { transform: scale(1) rotate(0deg); }
          15% { transform: scale(1.1) rotate(-3deg); }
          30% { transform: scale(1) rotate(3deg); }
          45% { transform: scale(1.05) rotate(-2deg); }
          60% { transform: scale(1) rotate(0deg); }
        }
        @keyframes hintPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        .whack-game-playing, .whack-game-playing * {
          cursor: none !important;
        }
        @keyframes hammerSwing {
          0% { transform: translate(-30%, -70%) rotate(-15deg); }
          40% { transform: translate(-30%, -70%) rotate(40deg) scale(1.1); }
          100% { transform: translate(-30%, -70%) rotate(-15deg); }
        }
      `}</style>

      {/* Narrow portrait game container */}
      <div
        ref={gameContainerRef}
        className={`relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl ${phase === 'playing' ? 'whack-game-playing' : ''}`}
        style={{
          background: 'linear-gradient(to bottom, #86efac, #22c55e 40%, #65a30d 80%, #4d7c0f)',
          transform: screenShake > 0 ? `translate(${Math.sin(screenShake) * 4}px, ${Math.cos(screenShake) * 4}px)` : 'none',
          cursor: phase === 'playing' ? 'none' : 'default',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute top-[5%] left-[10%] text-4xl opacity-20 pointer-events-none">🌿</div>
        <div className="absolute top-[8%] right-[12%] text-3xl opacity-15 pointer-events-none">🌱</div>
        <div className="absolute bottom-[15%] left-[5%] text-3xl opacity-15 pointer-events-none">🍃</div>

        {/* Close Button */}
        {phase !== 'results' && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-colors"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Ready Phase */}
        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center">
            <div style={{ animation: 'moleFloat 1.5s ease-in-out infinite' }}>
              {petImageUrl ? (
                <img src={petImageUrl} alt={petName} className="w-24 h-24 object-contain drop-shadow-lg"
                  onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = ''; }}
                />
              ) : null}
              <span className="text-7xl" style={{ display: petImageUrl ? 'none' : '' }}>🐹</span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white mb-2"
                style={{ textShadow: '0 2px 0 rgba(0,0,0,0.2)' }}
              >
                Whack-a-Mole
              </h2>
              <p className="text-lg text-white/80 mb-1">
                Whack the correct word!
              </p>
              <p className="text-sm text-white/60">
                Train {petName}&apos;s reflexes!
              </p>
            </div>

            <button
              onClick={startGame}
              className="px-10 py-4 bg-white text-green-700 rounded-full font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-b-4 border-green-200"
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
              <div className="flex items-center justify-between mb-3">
                {/* Score */}
                <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2">
                  <span className="text-xl font-black text-white">{score}</span>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-2">
                  {streak >= 3 && (
                    <div className="bg-yellow-400 text-yellow-900 rounded-full px-3 py-1 text-sm font-bold shadow-lg"
                      style={{ animation: 'hintPulse 0.6s ease-in-out' }}
                    >
                      {streak}x
                    </div>
                  )}
                  {petImageUrl && (
                    <img src={petImageUrl} alt={petName}
                      className="w-10 h-10 object-contain drop-shadow-md"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  )}
                </div>

                {/* Timer ring */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    animation: displayTime <= 5
                      ? 'timerUrgentMole 0.5s ease-in-out infinite'
                      : displayTime <= 10
                        ? 'timerUrgentMole 1s ease-in-out infinite'
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

              {/* Target hint */}
              {targetWord && (
                <div
                  className="bg-white/90 backdrop-blur rounded-2xl px-5 py-3 text-center shadow-lg border-2 border-yellow-300"
                  style={{ animation: 'hintPulse 2s ease-in-out infinite' }}
                >
                  <p className="text-xs text-gray-500 font-semibold mb-0.5">Find the word for:</p>
                  <p className="text-2xl font-black text-gray-800">{targetWord.vi}</p>
                </div>
              )}
            </div>

            {/* Mole Grid */}
            <div className="flex-1 flex items-center justify-center px-4 pb-6">
              <div
                className="grid gap-3 w-full max-w-[340px]"
                style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
              >
                {holes.map((hole, i) => (
                  <button
                    key={i}
                    onClick={() => handleWhack(i)}
                    disabled={!hole.visible || hole.hit || hole.hiding}
                    className="relative aspect-square rounded-2xl overflow-hidden transition-transform active:scale-95 cursor-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, #5b3a1a 0%, #3d2610 60%, #2a1a0a 100%)',
                      boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* Hole rim */}
                    <div className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{
                        border: '3px solid #8B6914',
                        boxShadow: 'inset 0 0 15px rgba(0,0,0,0.4)',
                      }}
                    />

                    {/* Mole content */}
                    {hole.visible && !hole.hit && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          animation: hole.hiding
                            ? 'moleHide 0.3s ease-in forwards'
                            : hole.wrong
                              ? 'moleWrong 0.3s ease-out'
                              : 'molePopUp 0.3s ease-out forwards',
                        }}
                      >
                        <div className={`w-full h-full flex flex-col items-center justify-center rounded-2xl px-1 ${
                          hole.wrong
                            ? 'bg-red-400/90'
                            : 'bg-gradient-to-b from-amber-300 to-amber-500'
                        }`}
                          style={{
                            boxShadow: hole.wrong
                              ? '0 0 15px rgba(239,68,68,0.5)'
                              : '0 4px 12px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.3)',
                          }}
                        >
                          <span className="text-2xl mb-0.5">🐹</span>
                          <span className="text-xs font-black text-gray-800 uppercase tracking-wide leading-tight text-center break-all">
                            {hole.word}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Whacked animation */}
                    {hole.hit && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ animation: 'moleWhacked 0.4s ease-out forwards' }}
                      >
                        <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl bg-green-400/90">
                          <span className="text-3xl">⭐</span>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Hammer cursor */}
            {hammerPos.x > 0 && (
              <img
                src="https://static.vecteezy.com/system/resources/thumbnails/054/196/132/small/3d-render-wooden-hammer-illustration-png.png"
                alt="hammer"
                className="absolute pointer-events-none z-30"
                style={{
                  width: 64,
                  height: 64,
                  left: hammerPos.x,
                  top: hammerPos.y,
                  transformOrigin: '50% 50%',
                  transform: hammerSwing
                    ? 'translate(-50%, -50%) rotate(-5deg) scale(1.1)'
                    : 'translate(-50%, -50%) rotate(25deg)',
                  transition: hammerSwing ? 'transform 0.08s ease-in' : 'transform 0.15s ease-out',
                  filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))',
                }}
              />
            )}

            {/* Floating texts */}
            {floatingTexts.map(ft => (
              <div
                key={ft.id}
                className="absolute left-1/2 -translate-x-1/2 font-black text-2xl pointer-events-none z-20"
                style={{
                  top: `${ft.y}%`,
                  color: ft.color,
                  opacity: ft.opacity,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {ft.text}
              </div>
            ))}
          </div>
        )}

        {/* Results Phase */}
        {phase === 'results' && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-50">
            <div
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
              style={{ animation: 'moleResultsFadeIn 0.5s ease-out' }}
            >
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4"
                style={{ animation: 'moleScorePopIn 0.6s ease-out 0.3s both' }}
              >
                <Trophy className="w-10 h-10 text-green-500" />
              </div>

              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {score >= 20 ? 'Training Complete!' : 'Not Enough Whacks!'}
              </h2>
              <p className="text-gray-500 mb-5">
                {score >= 20
                  ? `${petName} whacked ${score} moles!`
                  : `${petName} only whacked ${score}/20 moles`}
              </p>

              <div
                className={`rounded-2xl p-5 mb-5 border ${score >= 20 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
                style={{ animation: 'moleScorePopIn 0.6s ease-out 0.5s both' }}
              >
                <p className={`text-5xl font-black ${score >= 20 ? 'text-green-600' : 'text-gray-400'}`}>{score}</p>
                <p className={`text-sm font-semibold mt-1 ${score >= 20 ? 'text-green-400' : 'text-gray-400'}`}>moles whacked</p>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                {score >= 20
                  ? 'Whack master! 🏆'
                  : score >= 20
                    ? 'Amazing reflexes! 🌟'
                    : 'Need at least 20 whacks to earn XP. Try again! 💪'}
              </p>

              {score >= 20 ? (
                <button
                  onClick={() => onGameEnd(score)}
                  className="w-full py-3.5 bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-green-700 active:border-b-0 active:mt-1 transition-all"
                >
                  Collect Rewards ✨
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setPhase('ready')
                      setScore(0)
                      setStreak(0)
                    }}
                    className="w-full py-3.5 bg-gradient-to-b from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-green-700 active:border-b-0 active:mt-1 transition-all"
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

export default PetWhackMole
