import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import PetCatchGame from './PetCatchGame'
import PetFlappyGame from './PetFlappyGame'
import PetWordScramble from './PetWordScramble'
import PetWhackMole from './PetWhackMole'
import PetAstroBlast from './PetAstroBlast'
import PetMatchGame from './PetMatchGame'
import PetWordType from './PetWordType'
import PetQuizRush from './PetQuizRush'
import PetAngryPet from './PetAngryPet'

/* ---- Constants ---- */
const RARITY_CONFIG = {
  common:    { stops: 2 },
  uncommon:  { stops: 2 },
  rare:      { stops: 3 },
  epic:      { stops: 4 },
  legendary: { stops: 5 },
}

const GAME_POOL = [
  { key: 'scramble',   name: 'Word Scramble', img: 'https://xpclass.vn/xpclass/image/dashboard/pet-scramble.jpg', usesWords: true },
  { key: 'whackmole',  name: 'Whack-a-Mole',  img: 'https://xpclass.vn/xpclass/pet-game/whack/mole-normal.png', usesWords: true },
  { key: 'astroblast', name: 'Astro Blast',    img: 'https://xpclass.vn/xpclass/image/inventory/spaceship/phantom-voyager.png', usesWords: true },
  { key: 'flappy',     name: 'Flappy Pet',     img: 'https://xpclass.vn/xpclass/image/dashboard/flap.png', usesWords: true },
  { key: 'matchgame',  name: 'Match Up',       img: 'https://xpclass.vn/xpclass/image/dashboard/match1.png', usesWords: true },
  { key: 'wordtype',   name: 'Word Type',      img: 'https://xpclass.vn/xpclass/image/dashboard/pet-type.webp', usesWords: true },
  { key: 'quizrush',   name: 'Quiz Rush',      img: 'https://xpclass.vn/xpclass/pet-display/game-logo/quiz.png', usesWords: false },
  { key: 'angrypet',   name: 'Angry Pet',      img: 'https://xpclass.vn/xpclass/pet-game/angry/Slingshot.png', usesWords: false },
]

const RC = {
  common:    { solid: '#9CA3AF', light: 'rgba(156,163,175,0.5)', glow: 'rgba(156,163,175,0.25)', gradient: 'from-gray-300 to-gray-400', trail: '#4B5563' },
  uncommon:  { solid: '#4ADE80', light: 'rgba(74,222,128,0.5)',  glow: 'rgba(74,222,128,0.25)',  gradient: 'from-green-300 to-green-500', trail: '#166534' },
  rare:      { solid: '#60A5FA', light: 'rgba(96,165,250,0.5)',  glow: 'rgba(96,165,250,0.25)',  gradient: 'from-blue-300 to-blue-500', trail: '#1e3a5f' },
  epic:      { solid: '#C084FC', light: 'rgba(192,132,252,0.5)', glow: 'rgba(192,132,252,0.25)', gradient: 'from-purple-400 to-purple-600', trail: '#3b1f6e' },
  legendary: { solid: '#FACC15', light: 'rgba(250,204,21,0.5)',  glow: 'rgba(250,204,21,0.25)',  gradient: 'from-yellow-300 to-amber-500', trail: '#713f12' },
}

const BIOMES = [
  { name: 'Enchanted Forest',  bg: 'from-emerald-950 via-green-950 to-slate-950', emoji: '🌿', accent: '#22c55e', bgMobile: 'https://xpclass.vn/xpclass/image/biome/enchanted-forest-mobile.jpg', bgDesktop: 'https://t3.ftcdn.net/jpg/06/31/00/94/360_F_631009499_iQtNkPoZQK7Z3QffB38iUYd5L7kHZC92.jpg' },
  { name: 'Crystal Caves',     bg: 'from-blue-950 via-indigo-950 to-slate-950',   emoji: '💎', accent: '#6366f1', bgMobile: 'https://xpclass.vn/xpclass/image/biome/crystal-caves-mobile.jpg', bgDesktop: 'https://img.freepik.com/free-vector/dark-cave-with-blue-pink-shining-crystal-clusters-stone-walls-cartoon-vector-diamond-mine-dungeon-game-path-level-rocky-tunnel-with-glittering-treasure-mineral-resources-from-inside_107791-24532.jpg' },
  { name: 'Volcanic Ridge',    bg: 'from-red-950 via-orange-950 to-slate-950',    emoji: '🌋', accent: '#ef4444', bgMobile: 'https://xpclass.vn/xpclass/image/biome/volcanic-ridge-mobile.jpg', bgDesktop: 'https://cdn.vectorstock.com/i/1000v/73/95/vibrant-cartoon-volcano-eruption-vector-58527395.jpg' },
  { name: 'Mystic Swamp',      bg: 'from-teal-950 via-emerald-950 to-slate-950',  emoji: '🍄', accent: '#14b8a6', bgMobile: 'https://xpclass.vn/xpclass/image/biome/mystic-swamp-mobile.jpg', bgDesktop: 'https://thumbs.dreamstime.com/b/dark-swamp-landscape-dead-trees-fog-around-plants-terrible-mystical-place-swamp-bulrush-plants-twilight-disgusting-144587556.jpg' },
  { name: 'Frozen Peaks',      bg: 'from-cyan-950 via-sky-950 to-slate-950',      emoji: '❄️', accent: '#22d3ee', bgMobile: 'https://xpclass.vn/xpclass/image/biome/frozen-peaks-mobile.jpg', bgDesktop: 'https://thumbs.dreamstime.com/b/frozen-lake-scenery-cartoon-illustration-icy-winter-landscape-snow-covered-ice-scenic-view-wilderness-cold-environment-wonderland-331693799.jpg' },
  { name: 'Shadow Ruins',      bg: 'from-violet-950 via-purple-950 to-slate-950', emoji: '🏚️', accent: '#a78bfa', bgMobile: 'https://xpclass.vn/xpclass/image/biome/shadow-ruins-mobile.jpg', bgDesktop: 'https://thumbs.dreamstime.com/b/destroyed-abandoned-city-ruins-destroyed-abandoned-city-ruins-haunting-melancholy-sight-filled-broken-buildings-274793810.jpg' },
]

/* ---- Generate adventure path ---- */
function buildAdventure(stopCount) {
  const pool = [...GAME_POOL]
  const stops = []
  for (let i = 0; i < stopCount; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    const biome = BIOMES[i % BIOMES.length]
    stops.push({
      id: i,
      game: pool[idx],
      biome,
      bossImage: BOSS_IMAGES[Math.floor(Math.random() * BOSS_IMAGES.length)],
      completed: false,
      score: 0,
    })
  }
  return stops
}

const BOSS_IMAGES = [
  'https://xpclass.vn/xpclass/pet-game/boss/boss1.png',
  'https://xpclass.vn/xpclass/pet-game/boss/boss2.png',
  'https://xpclass.vn/xpclass/pet-game/boss/boss3.png',
  'https://xpclass.vn/xpclass/pet-game/boss/boss4.png',
  'https://xpclass.vn/xpclass/pet-game/boss/boss5.png',
]

/* ---- Main Component ---- */
const PetMazeAdventure = ({
  mode = 'standalone',
  encounterPet = null,
  rarity = 'common',
  activePet,
  wordBank,
  questionBank,
  currentLevel = 1,
  chestEnabled = false,
  profile,
  onGameEnd,
  onMazeComplete,
  onClose,
}) => {
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.common
  const rc = RC[rarity] || RC.common

  // Build adventure once
  const [stops, setStops] = useState(() => buildAdventure(config.stops))
  const [currentStop, setCurrentStop] = useState(0)
  const [phase, setPhase] = useState('entrance') // entrance | map | playing | victory | complete | failed
  const [entranceStep, setEntranceStep] = useState(0) // 0=wipe, 1=biome, 2=pet, 3=boss, 4=ready
  const [totalScore, setTotalScore] = useState(0)
  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const [victoryScore, setVictoryScore] = useState(0)
  const entranceAudioRef = useRef(null)

  const completedCount = stops.filter(s => s.completed).length
  const currentBiome = stops[currentStop]?.biome || BIOMES[0]

  // Entrance cinematic sequence
  useEffect(() => {
    if (phase !== 'entrance') return
    const timers = [
      setTimeout(() => setEntranceStep(1), 400),   // biome name
      setTimeout(() => setEntranceStep(2), 1200),   // pet slides in
      setTimeout(() => setEntranceStep(3), 2000),   // boss appears
      setTimeout(() => setEntranceStep(4), 2800),   // ready text
      setTimeout(() => { setPhase('map'); setEntranceStep(0) }, 3500), // go to map
    ]
    try {
      entranceAudioRef.current = new Audio('https://xpclass.vn/xpclass/sound/adventure-start.mp3')
      entranceAudioRef.current.volume = 0.4
      entranceAudioRef.current.play().catch(() => {})
    } catch { /* audio autoplay may be blocked */ }
    return () => timers.forEach(clearTimeout)
  }, [phase])

  // Victory phase after winning a game
  useEffect(() => {
    if (phase !== 'victory') return
    // Play laser sound at 1.7s (when laser fires)
    const laserTimer = setTimeout(() => {
      try {
        const s = new Audio('https://xpclass.vn/xpclass/sound/laser.mp3')
        s.volume = 0.3
        s.play().catch(() => {})
      } catch {}
    }, 1700)
    const timer = setTimeout(() => {
      if (currentStop >= stops.length - 1) {
        setPhase('complete')
      } else {
        setCurrentStop(prev => prev + 1)
        setPhase('entrance')
      }
    }, 7000)
    return () => { clearTimeout(laserTimer); clearTimeout(timer) }
  }, [phase, currentStop, stops.length])

  // Pet image for games
  const petImageUrl = useMemo(() => {
    if (!activePet) return ''
    let img = activePet.image_url
    if (activePet.evolution_stages && activePet.evolution_stage > 0) {
      const s = activePet.evolution_stages.find(s => s.stage === activePet.evolution_stage)
      if (s?.image_url) img = s.image_url
    }
    return img
  }, [activePet])

  const petName = activePet?.nickname || activePet?.name || 'Pet'

  const handleGameComplete = useCallback((score, extra) => {
    const game = stops[currentStop]?.game
    setTotalScore(prev => prev + score)
    setVictoryScore(score)
    setStops(prev => prev.map((s, i) =>
      i === currentStop ? { ...s, completed: true, score } : s
    ))

    if (onGameEnd && game) onGameEnd(score, game.key, extra)

    // Go to victory phase — it will auto-advance
    setPhase('victory')
  }, [currentStop, stops, onGameEnd])

  const [showQuitWarning, setShowQuitWarning] = useState(false)

  const handleGameClose = useCallback(() => {
    // Show warning before quitting during maze
    setShowQuitWarning(true)
  }, [])

  // Stars
  const stars = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      size: 1 + Math.random() * 2,
      left: `${5 + (i * 6.2) % 90}%`,
      top: `${2 + (i * 5.3) % 20}%`,
      dur: 1.5 + Math.random() * 2,
      delay: i * 0.2,
    }))
  , [])

  // Render active game
  const renderGame = () => {
    const game = stops[currentStop]?.game
    if (!game || phase !== 'playing') return null
    const commonProps = {
      petImageUrl,
      petName,
      chestEnabled,
      currentLevel,
      onGameEnd: handleGameComplete,
      onClose: handleGameClose,
      noRetry: true,
    }
    switch (game.key) {
      case 'scramble':    return <PetWordScramble {...commonProps} wordBank={wordBank} leaderboard={[]} />
      case 'whackmole':   return <PetWhackMole {...commonProps} wordBank={wordBank} hammerSkinUrl={profile?.active_hammer_url} leaderboard={[]} />
      case 'astroblast':  return <PetAstroBlast {...commonProps} wordBank={wordBank} shipSkinUrl={profile?.active_spaceship_url} shipLaserColor={profile?.active_spaceship_laser} asteroidSkinUrls={['https://xpclass.vn/xpclass/pet-game/astro/alien1.png','https://xpclass.vn/xpclass/pet-game/astro/alien2.png','https://xpclass.vn/xpclass/pet-game/astro/alien3.png','https://xpclass.vn/xpclass/pet-game/astro/alien4.png','https://xpclass.vn/xpclass/pet-game/astro/alien5.png','https://xpclass.vn/xpclass/pet-game/astro/alien6.png']} leaderboard={[]} />
      case 'flappy':      return <PetFlappyGame {...commonProps} wordBank={wordBank} leaderboard={[]} />
      case 'matchgame':   return <PetMatchGame {...commonProps} wordBank={wordBank} leaderboard={[]} />
      case 'wordtype':    return <PetWordType {...commonProps} wordBank={wordBank} leaderboard={[]} />
      case 'quizrush':    return <PetQuizRush {...commonProps} questionBank={questionBank} leaderboard={[]} />
      case 'angrypet':    return <PetAngryPet {...commonProps} questionBank={questionBank} leaderboard={[]} />
      case 'catch':       return <PetCatchGame {...commonProps} questionBank={questionBank} leaderboard={[]} />
      default: return null
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const biomeBg = isMobile ? currentBiome.bgMobile : currentBiome.bgDesktop

  const portal = createPortal(
    <div
      className={`fixed inset-0 z-50 select-none overflow-hidden bg-gradient-to-b ${currentBiome.bg}`}
      style={{
        touchAction: 'none',
        backgroundImage: biomeBg ? `url(${biomeBg})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {stars.map(s => (
          <div key={s.id} className="absolute rounded-full"
            style={{
              width: s.size, height: s.size,
              background: 'rgba(255,255,255,0.4)',
              left: s.left, top: s.top,
              animation: `advtwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              background: `${currentBiome.accent}40`,
              left: `${10 + i * 11}%`,
              top: `${20 + (i * 17) % 60}%`,
              animation: `advfloat ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* HUD */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3" style={{ opacity: phase === 'entrance' || phase === 'victory' ? 0 : 1, transition: 'opacity 0.3s' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-white font-bold text-lg">
            {mode === 'encounter' ? '🗺️ Wild Adventure' : '🗺️ Adventure'}
          </h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: rc.light, color: rc.solid }}>
            {rarity}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-gray-400 text-sm">
            <span className="text-white font-bold">{completedCount}</span>
            <span className="text-gray-600">/{config.stops}</span>
          </div>
          <button onClick={() => setShowConfirmClose(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-colors text-sm">
            ✕
          </button>
        </div>
      </div>

      {/* Entrance cinematic */}
      {phase === 'entrance' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden">
          {/* Dark overlay with fade */}
          <div className="absolute inset-0 bg-black" style={{
            animation: 'advFadeOut 3.5s ease-out forwards',
            opacity: 0.7,
          }} />

          {/* Biome name reveal */}
          <div className="relative z-10 flex flex-col items-center" style={{
            opacity: entranceStep >= 1 ? 1 : 0,
            transform: entranceStep >= 1 ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.6s ease-out',
          }}>
            <p className="text-white/40 text-xs uppercase tracking-[0.3em] mb-2">
              Stage {currentStop + 1}
            </p>
            <h2 className="text-white text-3xl sm:text-4xl font-black mb-1" style={{
              textShadow: `0 0 40px ${currentBiome.accent}80`,
            }}>
              {currentBiome.emoji} {currentBiome.name}
            </h2>
            <div className="h-0.5 rounded-full mt-3" style={{
              width: entranceStep >= 1 ? 120 : 0,
              background: `linear-gradient(90deg, transparent, ${currentBiome.accent}, transparent)`,
              transition: 'width 0.8s ease-out 0.2s',
            }} />
          </div>

          {/* Pet slides in from left */}
          <div className="absolute bottom-32 left-1/4 sm:left-1/3" style={{
            transform: entranceStep >= 2 ? 'translateX(0)' : 'translateX(-200px)',
            opacity: entranceStep >= 2 ? 1 : 0,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <img src={petImageUrl} alt={petName}
              className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
              style={{ filter: `drop-shadow(0 0 15px ${rc.light})` }}
            />
          </div>

          {/* Boss appears from right */}
          <div className="absolute bottom-32 right-1/4 sm:right-1/3" style={{
            transform: entranceStep >= 3 ? 'translateX(0) scale(1)' : 'translateX(200px) scale(0.5)',
            opacity: entranceStep >= 3 ? 1 : 0,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <img src={stops[currentStop]?.bossImage} alt="Boss"
              className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
              style={{ filter: `drop-shadow(0 0 15px ${currentBiome.accent})` }}
            />
          </div>

          {/* READY text */}
          {entranceStep >= 4 && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <h1 className="text-white text-5xl sm:text-7xl font-black uppercase tracking-widest"
                style={{
                  animation: 'advReadyPulse 0.6s ease-out',
                  textShadow: `0 0 60px ${rc.solid}, 0 0 120px ${rc.light}`,
                }}>
                READY!
              </h1>
            </div>
          )}
        </div>
      )}

      {/* Victory phase */}
      {phase === 'victory' && (
        <div className="absolute inset-0 z-30">

          {/* Impact flash — delayed to sync with hit */}
          <div className="absolute inset-0 bg-white" style={{ opacity: 0, animation: 'advVictoryFlash 0.5s ease-out 1.7s forwards' }} />

          {/* Pet charges from left toward monster */}
          <div className="absolute bottom-32 left-1/4 sm:left-1/3" style={{
            animation: 'advPetCharge 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.5s both',
          }}>
            <img src={petImageUrl} alt={petName}
              className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
              style={{ filter: `drop-shadow(0 0 15px ${rc.light})` }}
            />
          </div>

          {/* Laser beam — fires at peak of charge */}
          <div className="absolute pointer-events-none z-30"
            style={{
              bottom: 'calc(8rem + 2.5rem)',
              left: 'calc(25% + 15vw + 5rem)',
              width: 'calc(50% - 15vw - 5rem)',
              height: 10,
              transformOrigin: '0 50%',
              background: `linear-gradient(90deg, ${rc.solid}, white 40%, white 60%, ${rc.solid})`,
              boxShadow: `0 0 20px 6px ${rc.light}, 0 0 50px 12px ${rc.glow}`,
              borderRadius: 5,
              opacity: 0,
              animation: 'advLaserFire 0.4s ease-out 1.7s forwards',
            }}
          />

          {/* Monster gets hit and flies off screen */}
          <div className="absolute bottom-32 right-1/4 sm:right-1/3" style={{
            animation: 'advMonsterKnockback 1s cubic-bezier(0.22, 1, 0.36, 1) 1.7s both',
          }}>
            <img src={stops[currentStop]?.bossImage} alt="Boss"
              className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            />
          </div>

          {/* Impact sparks at hit point */}
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 pointer-events-none" style={{ animation: 'advScaleIn 0.3s ease-out 1.7s both' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute text-yellow-400"
                style={{
                  animation: `advStarBurst 1s ease-out ${1.7 + i * 0.05}s both`,
                  '--star-x': `${Math.cos(i * 45 * Math.PI / 180) * 60}px`,
                  '--star-y': `${Math.sin(i * 45 * Math.PI / 180) * 60}px`,
                  opacity: 0,
                  fontSize: '1.2rem',
                }}>
                ✦
              </div>
            ))}
          </div>

          {/* Celebration — appears after hit */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="relative z-10 flex flex-col items-center" style={{ animation: 'advScaleIn 0.8s ease-out 2.8s both' }}>
              {/* Pet celebrating */}
              <div className="relative mb-4">
                <div className="absolute -inset-12 rounded-full blur-2xl" style={{
                  background: `radial-gradient(circle, ${rc.light}, transparent 60%)`,
                  animation: 'advGlowPulse 1.5s ease-in-out 2.8s infinite',
                }} />
                <img src={petImageUrl} alt={petName}
                  className="w-28 h-28 sm:w-36 sm:h-36 object-contain relative z-10"
                  style={{
                    animation: 'advVictoryBounce 0.8s ease-out 2.8s both',
                    filter: `drop-shadow(0 0 20px ${rc.light})`,
                  }}
                />
              </div>

              {/* Victory stars burst */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="absolute left-1/2 top-1/2 text-yellow-400"
                    style={{
                      animation: `advStarBurst 1.2s ease-out ${3.0 + i * 0.08}s forwards`,
                      '--star-x': `${Math.cos(i * 30 * Math.PI / 180) * (80 + Math.random() * 40)}px`,
                      '--star-y': `${Math.sin(i * 30 * Math.PI / 180) * (80 + Math.random() * 40)}px`,
                      opacity: 0,
                    }}>
                    ✦
                  </div>
                ))}
              </div>

              <h2 className="text-white text-3xl font-black" style={{
                animation: 'advScaleIn 0.6s ease-out 3.2s both',
                textShadow: `0 0 30px ${rc.light}`,
              }}>
                Victory!
              </h2>
              <p className="text-white/60 text-sm mt-2" style={{ animation: 'advScaleIn 0.6s ease-out 3.6s both' }}>
                +{victoryScore} points
              </p>

              {currentStop < stops.length - 1 && (
                <p className="text-white/30 text-xs mt-4" style={{ animation: 'advScaleIn 0.6s ease-out 4.0s both' }}>
                  Moving to next stage...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map phase — single encounter view */}
      {phase === 'map' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center px-6 pt-16" style={{ animation: 'advMapSlideIn 0.5s ease-out' }}>

          {/* Biome name */}
          <div className="text-center mt-6 mb-4">
            <p className="text-white/50 text-xs uppercase tracking-widest">
              {currentBiome.emoji} {currentBiome.name}
            </p>
            <p className="text-white/30 text-[10px] mt-1">
              Stage {currentStop + 1} of {stops.length}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mb-6">
            {stops.map((s, i) => (
              <div key={s.id} className="w-3 h-3 rounded-full transition-all duration-300"
                style={{
                  background: s.completed ? rc.solid : i === currentStop ? `${rc.solid}80` : '#374151',
                  boxShadow: i === currentStop ? `0 0 8px ${rc.light}` : 'none',
                }}
              />
            ))}
          </div>

          {/* spacer to push button down */}
          <div className="flex-1" />

          {/* Battle button */}
          <div className="flex flex-col items-center mb-12">
            <button onClick={() => setPhase('playing')}
              className={`px-10 py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r ${rc.gradient} hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3`}
              style={{ boxShadow: `0 0 30px ${rc.glow}` }}
            >
              ⚔️ Battle!
            </button>

            {/* Completed all — encounter button */}
            {completedCount >= config.stops && (
              <button onClick={() => setPhase('complete')}
                className={`mt-4 px-10 py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r ${rc.gradient} hover:scale-105 active:scale-95 transition-all shadow-xl animate-pulse`}
                style={{ boxShadow: `0 0 30px ${rc.glow}` }}
              >
                {mode === 'encounter' ? '✨ Encounter Pet!' : '🏆 Claim Reward!'}
              </button>
            )}
          </div>

          {/* Pet & boss — same absolute positions as entrance */}
          <div className="absolute bottom-32 left-1/4 sm:left-1/3 flex flex-col items-center z-10">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full blur-xl animate-pulse" style={{ background: `${rc.glow}` }} />
              <img src={petImageUrl} alt={petName}
                className="w-20 h-20 sm:w-28 sm:h-28 object-contain relative z-10"
                style={{ animation: 'advPetIdle 2s ease-in-out infinite', filter: `drop-shadow(0 0 15px ${rc.light})` }}
              />
            </div>
            <p className="text-white text-sm font-bold mt-2">{petName}</p>
          </div>

          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 text-2xl sm:text-3xl font-black text-white/30 z-10" style={{ textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>
            VS
          </div>

          <div className="absolute bottom-32 right-1/4 sm:right-1/3 flex flex-col items-center z-10">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full blur-xl animate-pulse" style={{ background: `${currentBiome.accent}30` }} />
              <img src={stops[currentStop]?.bossImage} alt={stops[currentStop]?.game?.name}
                className="w-20 h-20 sm:w-28 sm:h-28 object-contain relative z-10"
                style={{ animation: 'advMonsterIdle 1.5s ease-in-out infinite' }}
              />
            </div>
            <p className="text-white/70 text-sm font-bold mt-2">{stops[currentStop]?.game?.name}</p>
          </div>
        </div>
      )}

      {/* Active mini-game */}
      {renderGame()}

      {/* Completion */}
      {phase === 'complete' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="flex flex-col items-center text-center px-6 animate-[advScaleIn_0.5s_ease-out]">
            <div className="relative mb-6">
              <div className="absolute -inset-16 rounded-full blur-3xl animate-pulse"
                style={{ background: `radial-gradient(circle, ${rc.light}, transparent 60%)` }} />

            </div>

            <h2 className="text-white text-3xl font-black mb-3">
              {mode === 'encounter' ? 'Pet Found!' : 'Adventure Complete!'}
            </h2>

            {mode === 'encounter' && encounterPet && (
              <div className="my-3">
                <img src={encounterPet.image_url} alt="?"
                  className="w-28 h-28 object-contain mx-auto mb-2"
                  style={{ filter: 'brightness(0) drop-shadow(0 0 20px rgba(255,255,255,0.3))' }} />
                <p className="text-gray-400 text-sm">A wild pet awaits...</p>
              </div>
            )}

            <div className="mt-4 flex gap-8 text-center">
              <div>
                <p className="text-3xl font-bold text-white">{totalScore}</p>
                <p className="text-gray-500 text-xs">Total Score</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{completedCount}</p>
                <p className="text-gray-500 text-xs">Games Won</p>
              </div>
            </div>

            <button onClick={onMazeComplete}
              className={`mt-8 px-12 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r ${rc.gradient} hover:scale-105 active:scale-95 transition-all shadow-xl text-lg`}>
              {mode === 'encounter' ? 'Encounter Pet!' : 'Collect Rewards!'}
            </button>
          </div>
        </div>
      )}

      {/* Failed — lost a game */}
      {phase === 'failed' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="flex flex-col items-center text-center px-6 animate-[advScaleIn_0.5s_ease-out]">
            <div className="text-7xl mb-6">💀</div>
            <h2 className="text-white text-3xl font-black mb-3">Adventure Failed!</h2>
            <p className="text-gray-400 text-sm mb-6">You were defeated and sent back home.</p>

            <div className="mt-2 flex gap-8 text-center">
              <div>
                <p className="text-3xl font-bold text-white">{totalScore}</p>
                <p className="text-gray-500 text-xs">Total Score</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{completedCount}/{stops.length}</p>
                <p className="text-gray-500 text-xs">Games Won</p>
              </div>
            </div>

            <button onClick={onClose}
              className="mt-8 px-12 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-gray-600 to-gray-700 hover:scale-105 active:scale-95 transition-all shadow-xl text-lg">
              Go Home
            </button>
          </div>
        </div>
      )}

      {/* Confirm close */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-xs mx-4 text-center">
            <h3 className="text-white font-bold text-lg mb-2">Leave Adventure?</h3>
            <p className="text-gray-400 text-sm mb-6">Your progress will be lost.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmClose(false)}
                className="flex-1 py-2.5 rounded-xl font-medium text-white bg-gray-700 hover:bg-gray-600 transition-colors">
                Stay
              </button>
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-500 transition-colors">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes advtwinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }
        @keyframes advfloat {
          0% { transform: translateY(0); opacity: 0.3; }
          100% { transform: translateY(-20px); opacity: 0.6; }
        }
        @keyframes advScaleIn {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes advPetIdle {
          0%, 100% { transform: translateY(0) scaleX(1); }
          50% { transform: translateY(-8px) scaleX(1); }
        }
        @keyframes advMonsterIdle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes advFadeOut {
          0% { opacity: 0.9; }
          70% { opacity: 0.6; }
          100% { opacity: 0; }
        }
        @keyframes advReadyPulse {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes advPetCharge {
          0% { transform: translateX(0); }
          40% { transform: translateX(15vw); }
          100% { transform: translateX(0); }
        }
        @keyframes advFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes advLaserFire {
          0% { opacity: 1; filter: brightness(2); }
          30% { opacity: 0.9; filter: brightness(1.5); }
          100% { opacity: 0; filter: brightness(1); }
        }
        @keyframes advMonsterKnockback {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          8% { transform: translate(-10px, 5px) rotate(-10deg) scale(1.05); opacity: 1; }
          100% { transform: translate(80vw, -80vh) rotate(1440deg) scale(0.2); opacity: 0; }
        }
        @keyframes advVictoryFlash {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes advVictoryBounce {
          0% { transform: scale(0.5) translateY(40px); }
          50% { transform: scale(1.15) translateY(-20px); }
          70% { transform: scale(0.95) translateY(0); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes advGlowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        @keyframes advStarBurst {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--star-x)), calc(-50% + var(--star-y))) scale(1); opacity: 0; }
        }
        @keyframes advMapSlideIn {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  )

  return (
    <>
      {portal}
      {showQuitWarning && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-white text-lg font-bold mb-2">Quit Adventure?</h3>
            <p className="text-gray-400 text-sm mb-5">
              You will lose all progress and the wild pet will escape!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowQuitWarning(false)}
                className="flex-1 py-2.5 rounded-xl font-medium text-white bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                Continue
              </button>
              <button
                onClick={() => { setShowQuitWarning(false); setPhase('failed'); }}
                className="flex-1 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Quit
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default PetMazeAdventure
