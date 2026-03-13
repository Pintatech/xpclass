import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Volume2, VolumeX, Mic, Square, ChevronLeft, ChevronRight } from 'lucide-react'
import WORD_BANK from './wordBank'

import { assetUrl } from '../../hooks/useBranding'

const WORDS_PER_GAME = 10
const GAME_DURATION = 90

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pickGameWords = (source) => shuffle(source).slice(0, WORDS_PER_GAME)

const isWordMatch = (expectedWord, transcribedText) => {
  if (!transcribedText) return false
  const expected = expectedWord.toLowerCase().trim()
  const spoken = transcribedText.toLowerCase().trim().replace(/[.,!?]/g, '')

  // Exact match
  if (spoken === expected) return true

  // The expected word appears as one of the spoken words
  const spokenWords = spoken.split(/\s+/)
  if (spokenWords.some(w => w === expected)) return true

  return false
}

const PetSayItRight = ({ petImageUrl, petName, onGameEnd, onClose, wordBank: wordBankProp = [], hideClose = false, scoreToBeat = null, leaderboard = [] }) => {
  const [phase, setPhase] = useState('ready')
  const [words, setWords] = useState([])
  const [wordIndex, setWordIndex] = useState(0)
  const [displayTime, setDisplayTime] = useState(GAME_DURATION)
  const [displayScore, setDisplayScore] = useState(0)
  const [muted, setMuted] = useState(false)

  // Per-word status: { passed: bool }
  const [wordStatus, setWordStatus] = useState([])

  // Current attempt state
  const [isRecording, setIsRecording] = useState(false)
  const [lastPassed, setLastPassed] = useState(null) // true/false/null
  const [transcription, setTranscription] = useState('')
  const [showResult, setShowResult] = useState(false)

  // Animation
  const [screenShake, setScreenShake] = useState(0)
  const [particles, setParticles] = useState([])
  const containerRef = useRef(null)
  const bgMusicRef = useRef(null)
  const animFrameRef = useRef(null)
  const shakeRef = useRef(0)
  const recognitionRef = useRef(null)
  const timerRef = useRef(null)
  const timeRef = useRef(GAME_DURATION)

  const currentWord = words[wordIndex]
  const wordsCorrect = wordStatus.filter(s => s.passed).length
  const allPassed = wordsCorrect === words.length && words.length > 0

  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
  }, [])

  const resetCurrentAttempt = useCallback(() => {
    cleanupRecognition()
    setIsRecording(false)
    setLastPassed(null)
    setTranscription('')
    setShowResult(false)
  }, [cleanupRecognition])

  const startRecording = useCallback(async () => {
    if (!currentWord) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setTranscription('Speech recognition not supported on this browser')
      setLastPassed(false)
      setShowResult(true)
      return
    }

    // Request mic permission first (needed on mobile)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setTranscription('Microphone access denied')
      setLastPassed(false)
      setShowResult(true)
      return
    }

    cleanupRecognition()
    setIsRecording(true)
    setLastPassed(null)
    setTranscription('')
    setShowResult(false)

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    let alreadyPassed = false

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1][0]
      const isFinal = event.results[event.results.length - 1].isFinal
      const transcribedText = result.transcript || ''

      setTranscription(transcribedText)

      const matched = isWordMatch(currentWord.word, transcribedText)

      if (matched && !alreadyPassed) {
        alreadyPassed = true
        setLastPassed(true)
        setShowResult(true)
        setIsRecording(false)
        try { recognition.abort() } catch {}

        setWordStatus(prev => {
          const updated = [...prev]
          if (!updated[wordIndex]?.passed) {
            updated[wordIndex] = { passed: true }
          }
          return updated
        })
        return
      }

      if (isFinal && !alreadyPassed) {
        setLastPassed(false)
        setShowResult(true)
        setIsRecording(false)
      }
    }

    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        setTranscription('')
        setLastPassed(false)
        setShowResult(true)
      } else if (event.error === 'not-allowed') {
        setTranscription('Microphone access denied')
        setLastPassed(false)
        setShowResult(true)
      } else {
        setTranscription(`Error: ${event.error}`)
        setLastPassed(false)
        setShowResult(true)
      }
      setIsRecording(false)
    }

    recognition.onend = () => setIsRecording(false)

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      console.log('Speech recognition start failed:', err)
      setTranscription('Could not start speech recognition')
      setLastPassed(false)
      setShowResult(true)
      setIsRecording(false)
    }
  }, [currentWord, wordIndex, cleanupRecognition])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop()
  }, [])

  const goToWord = useCallback((idx) => {
    if (idx < 0 || idx >= words.length) return
    resetCurrentAttempt()
    setWordIndex(idx)
  }, [words.length, resetCurrentAttempt])

  // Check if all words passed → end game
  useEffect(() => {
    if (phase !== 'playing') return
    const allDone = wordStatus.length === words.length && words.length > 0 && wordStatus.every(s => s.passed)
    if (allDone) {
      clearInterval(timerRef.current)
      const finalScore = timeRef.current
      setDisplayScore(finalScore)

      try {
        const sound = new Audio(assetUrl('/sound/scram-correct.mp3'))
        sound.volume = 0.5
        if (!muted) sound.play().catch(() => {})
      } catch {}

      setTimeout(() => setPhase('results'), 1000)
    }
  }, [wordStatus, words.length, phase, muted])

  const startGame = useCallback(() => {
    const source = wordBankProp.length > 0 ? wordBankProp : WORD_BANK
    const gameWords = pickGameWords(source)
    setWords(gameWords)
    setWordIndex(0)
    setWordStatus(gameWords.map(() => ({ passed: false })))
    setDisplayTime(GAME_DURATION)
    setDisplayScore(0)
    timeRef.current = GAME_DURATION
    resetCurrentAttempt()
    shakeRef.current = 0
    setPhase('playing')

    try {
      const music = new Audio(assetUrl('/sound/pet-word-scamble-2-faster.mp3'))
      music.loop = true
      music.volume = 0.2
      bgMusicRef.current = music
      music.play().catch(() => {})
    } catch {}
  }, [wordBankProp, resetCurrentAttempt])

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setInterval(() => {
      timeRef.current -= 1
      setDisplayTime(timeRef.current)
      if (timeRef.current <= 0) {
        clearInterval(timerRef.current)
        setDisplayScore(0)
        setTimeout(() => setPhase('results'), 500)
      }
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
      cleanupRecognition()
      clearInterval(timerRef.current)
      if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current = null }
    }
  }, [cleanupRecognition])

  // Particle + shake animation
  useEffect(() => {
    if (phase !== 'playing') return
    const animate = () => {
      shakeRef.current = Math.max(0, shakeRef.current - 0.5)
      setScreenShake(shakeRef.current)
      setParticles(prev => prev
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, opacity: p.opacity - 0.02 }))
        .filter(p => p.opacity > 0)
      )
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [phase])

  // Auto-advance to next unpassed word after passing
  useEffect(() => {
    if (!showResult || !lastPassed) return
    if (phase !== 'playing') return

    const allDone = wordStatus.every(s => s.passed)
    if (allDone) return

    const timer = setTimeout(() => {
      for (let i = 1; i <= words.length; i++) {
        const idx = (wordIndex + i) % words.length
        if (!wordStatus[idx]?.passed) {
          goToWord(idx)
          return
        }
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [showResult, lastPassed, wordIndex, wordStatus, words.length, phase, goToWord])

  // Celebration particles on pass
  useEffect(() => {
    if (!showResult || !lastPassed) return
    const colors = ['#22c55e', '#86efac', '#facc15', '#34d399', '#60a5fa']
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
  }, [showResult, lastPassed, muted])

  return createPortal(
    <div className="fixed inset-0 z-50 select-none overflow-hidden bg-black/70 flex items-center justify-center">
      <style>{`
        @keyframes sayPopIn { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes sayFloat { 0%, 100% { transform: translateY(-4px); } 50% { transform: translateY(4px); } }
        @keyframes sayResultsFadeIn { 0% { opacity: 0; transform: translateY(30px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes sayScorePopIn { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes micPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 20px rgba(239,68,68,0); } }
        @keyframes hintPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes timerUrgent { 0%, 100% { transform: scale(1) rotate(0deg); } 15% { transform: scale(1.1) rotate(-3deg); } 30% { transform: scale(1) rotate(3deg); } 60% { transform: scale(1) rotate(0deg); } }
      `}</style>

      <div
        ref={containerRef}
        className="relative w-full max-w-[400px] h-full max-h-[100dvh] overflow-hidden rounded-none sm:rounded-2xl sm:max-h-[90vh] sm:shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #ec4899 100%)',
          transform: screenShake > 0 ? `translate(${Math.sin(screenShake * 2) * 3}px, ${Math.cos(screenShake * 2) * 3}px)` : 'none',
        }}
      >

      <div className="absolute top-[-10%] right-[-5%] w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-80 h-80 rounded-full bg-white/5 pointer-events-none" />

      {phase !== 'results' && !hideClose && (
        <button onClick={onClose} className="absolute top-4 left-4 z-50 bg-white/80 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-colors">
          <X className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Ready */}
      {phase === 'ready' && (
        <div className="flex flex-col items-center gap-6 p-8 text-center h-full justify-center">
          <div style={{ animation: 'sayFloat 1.5s ease-in-out infinite' }}>
            {petImageUrl ? (
              <img src={petImageUrl} alt={petName} className="w-24 h-24 object-contain drop-shadow-lg"
                onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = '' }}
              />
            ) : null}
            <span className="text-7xl" style={{ display: petImageUrl ? 'none' : '' }}>🎤</span>
          </div>

          <div>
            <h2 className="text-3xl font-black text-white mb-2" style={{ textShadow: '0 2px 0 rgba(0,0,0,0.2)' }}>
              Say It Right
            </h2>
            <p className="text-lg text-white/80 mb-1">Pronounce all {WORDS_PER_GAME} words correctly!</p>
            <p className="text-sm text-white/60">Faster = higher score &bull; {GAME_DURATION}s time limit</p>
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

          <button onClick={startGame}
            className="px-10 py-4 bg-white text-orange-600 rounded-full font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-b-4 border-orange-200">
            Start!
          </button>
        </div>
      )}

      {/* Playing */}
      {phase === 'playing' && currentWord && (
        <div className="w-full h-full relative flex flex-col">

          {/* Particles */}
          {particles.map(particle => (
            <div key={particle.id} className="absolute w-3 h-3 rounded-full pointer-events-none z-30"
              style={{ left: `${particle.x}px`, top: `${particle.y}px`, backgroundColor: particle.color, opacity: particle.opacity, transform: 'translate(-50%, -50%)' }}
            />
          ))}

          {/* TOP HUD */}
          <div className="px-4 pt-3 pb-1 z-10">
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2">
              <div className="w-full flex items-center justify-between">
                {/* Words passed counter */}
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white/20 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2">
                    <span className="text-xl font-black text-white">{wordsCorrect}/{words.length}</span>
                  </div>
                  {/* Score-to-beat bar */}
                  {(() => {
                    const nextToBeat = leaderboard.length > 0
                      ? [...leaderboard].reverse().find(e => e.score > displayTime) || null
                      : scoreToBeat
                    if (!nextToBeat) return null
                    const gap = nextToBeat.score - displayTime
                    const isClose = gap > 0 && gap <= 10
                    const pct = Math.min(100, Math.round((displayTime / nextToBeat.score) * 100))
                    return (
                      <div className="w-28 ml-1" style={{ animation: isClose ? 'hintPulse 0.6s ease-in-out infinite' : 'none' }}>
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px]">&#x2694;&#xFE0F;</span>
                            <span className="text-white font-bold text-[10px] truncate max-w-[50px]">{nextToBeat.name}</span>
                          </div>
                          <span className={`font-black text-[10px] ${isClose ? 'text-orange-300' : 'text-yellow-300'}`}>
                            {gap > 0 ? `${gap}s faster` : 'Beating!'}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: isClose ? 'linear-gradient(90deg, #f97316, #ef4444)' : 'linear-gradient(90deg, #22c55e, #86efac)' }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {petImageUrl && (
                  <img src={petImageUrl} alt={petName} className="w-10 h-10 object-contain drop-shadow-md"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                )}

                {/* Timer */}
                {(() => {
                  const pct = displayTime / GAME_DURATION
                  const radius = 22
                  const circumference = 2 * Math.PI * radius
                  const offset = circumference * (1 - pct)
                  const color = displayTime <= 10 ? '#ef4444' : displayTime <= 20 ? '#f97316' : displayTime <= 30 ? '#eab308' : '#22c55e'
                  return (
                    <div className="relative flex items-center justify-center"
                      style={{ animation: displayTime <= 10 ? 'timerUrgent 0.5s ease-in-out infinite' : displayTime <= 20 ? 'timerUrgent 1s ease-in-out infinite' : 'none' }}
                    >
                      <svg width="56" height="56" className="drop-shadow-lg" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="28" cy="28" r={radius} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                        <circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
                          strokeDasharray={circumference} strokeDashoffset={offset}
                          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                        />
                      </svg>
                      <span className="absolute font-black text-white"
                        style={{ fontSize: displayTime < 10 ? '18px' : '16px', textShadow: `0 0 8px ${color}80, 0 1px 2px rgba(0,0,0,0.3)` }}>
                        {displayTime}
                      </span>
                    </div>
                  )
                })()}

                {/* Mute */}
                <button
                  onClick={() => { setMuted(prev => { const next = !prev; if (bgMusicRef.current) bgMusicRef.current.muted = next; return next }) }}
                  className="bg-white/20 backdrop-blur rounded-full p-1.5"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>
              </div>

              {/* Progress dots — clickable */}
              <div className="w-full flex items-center justify-center gap-1.5">
                {words.map((_, i) => (
                  <button key={i} onClick={() => goToWord(i)} style={{ width: 24, height: 24 }}
                    className="relative transition-transform hover:scale-110"
                  >
                    {wordStatus[i]?.passed ? (
                      <div className="w-full h-full rounded-full flex items-center justify-center text-xs"
                        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }}>
                        <span className="text-white font-bold text-[10px]">{'\u2713'}</span>
                      </div>
                    ) : i === wordIndex ? (
                      <div className="w-full h-full rounded-full border-2 border-white/60 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.15)', animation: 'hintPulse 1.5s ease-in-out infinite' }}>
                        <span className="text-white/80 font-bold text-[9px]">{i + 1}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-full border border-white/20 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <span className="text-white/30 text-[9px]">{i + 1}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 relative">

            {/* Already passed badge */}
            {wordStatus[wordIndex]?.passed && (
              <div className="bg-green-500/30 backdrop-blur rounded-full px-4 py-1">
                <span className="text-xs text-green-200 font-bold uppercase tracking-wider">{'\u2713'} Passed</span>
              </div>
            )}

            {/* Word to pronounce */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 w-full max-w-xs text-center border border-white/20">
              <p className="text-xs text-white/50 uppercase tracking-wider mb-1 font-semibold">Say this word</p>
              <p className="text-4xl font-black text-white leading-snug" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                {currentWord.word}
              </p>
              <p className="text-sm text-white/60 mt-2">{currentWord.hint}</p>
            </div>

            {/* Mic button */}
            {!showResult && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                  isRecording ? 'bg-red-500 shadow-lg' : 'bg-white/90 hover:bg-white shadow-md'
                }`}
                style={isRecording ? { animation: 'micPulse 1.5s ease-in-out infinite' } : {}}
              >
                {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-orange-600" />}
              </button>
            )}

            {isRecording && (
              <>
                <p className="text-sm text-white/70 animate-pulse">Listening...</p>
                {transcription && (
                  <p className="text-sm text-white/50 italic">&ldquo;{transcription}&rdquo;</p>
                )}
              </>
            )}

            {/* Result */}
            {showResult && lastPassed !== null && (
              <div className="bg-white/15 backdrop-blur-md rounded-2xl px-5 py-4 w-full max-w-xs text-center border border-white/20"
                style={{ animation: 'sayPopIn 0.3s ease-out' }}>
                <div className="flex justify-center mb-3">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center ${lastPassed ? 'bg-green-500/30' : 'bg-red-500/30'}`}>
                    <span className="text-4xl">{lastPassed ? '\u2713' : '\u2717'}</span>
                  </div>
                </div>

                <p className="text-lg font-bold text-white mb-1">{lastPassed ? 'Correct!' : 'Try again!'}</p>

                {transcription && <p className="text-xs text-white/50 mb-2">You said: &ldquo;{transcription}&rdquo;</p>}
                {!transcription && !lastPassed && <p className="text-xs text-white/50 mb-2">Could not hear you. Try again.</p>}

                {!lastPassed && (
                  <button onClick={() => { setLastPassed(null); setTranscription(''); setShowResult(false) }}
                    className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl font-bold text-white transition-colors">
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>

          {/* BOTTOM: Nav arrows */}
          <div className="pb-8 pt-4 px-6 z-10 flex justify-between items-center"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 100%)' }}>
            <button onClick={() => goToWord(wordIndex - 1)} disabled={wordIndex === 0}
              className="bg-white/20 backdrop-blur rounded-full p-2 disabled:opacity-30 hover:bg-white/30 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <span className="text-xs text-white/50">{wordIndex + 1} / {words.length}</span>
            <button onClick={() => goToWord(wordIndex + 1)} disabled={wordIndex === words.length - 1}
              className="bg-white/20 backdrop-blur rounded-full p-2 disabled:opacity-30 hover:bg-white/30 transition-colors">
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {phase === 'results' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto p-6 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center my-auto"
            style={{ animation: 'sayResultsFadeIn 0.5s ease-out' }}>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-4"
              style={{ animation: 'sayScorePopIn 0.6s ease-out 0.3s both' }}>
              <Trophy className="w-10 h-10 text-orange-500" />
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              {allPassed ? 'All Words Cleared!' : 'Time\'s Up!'}
            </h2>
            <p className="text-gray-500 mb-5">
              {wordsCorrect}/{words.length} words pronounced correctly
            </p>

            <div className={`rounded-2xl p-5 mb-5 border ${allPassed ? 'bg-gradient-to-br from-orange-50 to-red-50 border-orange-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}
              style={{ animation: 'sayScorePopIn 0.6s ease-out 0.5s both' }}>
              <p className={`text-5xl font-black ${allPassed ? 'text-orange-600' : 'text-gray-400'}`}>{displayScore}</p>
              <p className={`text-sm font-semibold mt-1 ${allPassed ? 'text-orange-400' : 'text-gray-400'}`}>
                {allPassed ? 'seconds remaining' : 'points'}
              </p>
            </div>

            {/* Word breakdown */}
            <div className="mb-5 text-left">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 text-center">Word Breakdown</p>
              <div className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                {words.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${wordStatus[i]?.passed ? 'bg-green-500' : 'bg-red-400'}`}>
                      {wordStatus[i]?.passed ? '\u2713' : '\u2717'}
                    </span>
                    <span className="font-bold text-sm text-gray-800">{w.word}</span>
                  </div>
                ))}
              </div>
            </div>

            {allPassed ? (
              <button onClick={() => onGameEnd(displayScore)}
                className="w-full py-3.5 bg-gradient-to-b from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-red-700 active:border-b-0 active:mt-1 transition-all">
                Collect Rewards
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button onClick={() => { setPhase('ready'); setDisplayScore(0) }}
                  className="w-full py-3.5 bg-gradient-to-b from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full font-bold text-lg shadow-lg border-b-4 border-red-700 active:border-b-0 active:mt-1 transition-all">
                  Try Again
                </button>
                <button onClick={onClose} className="w-full py-2.5 text-gray-400 hover:text-gray-600 font-medium transition-colors">
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

export default PetSayItRight
