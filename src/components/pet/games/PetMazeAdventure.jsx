import { useState, useMemo, useCallback, memo } from 'react'
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
  { key: 'scramble',   name: 'Word Scramble', icon: '🔤', usesWords: true },
  { key: 'whackmole',  name: 'Whack-a-Mole',  icon: '🔨', usesWords: true },
  { key: 'astroblast', name: 'Astro Blast',    icon: '🚀', usesWords: true },
  { key: 'flappy',     name: 'Flappy Pet',     icon: '🐦', usesWords: true },
  { key: 'matchgame',  name: 'Match Up',       icon: '🃏', usesWords: true },
  { key: 'wordtype',   name: 'Word Type',      icon: '⌨️', usesWords: true },
  { key: 'quizrush',   name: 'Quiz Rush',      icon: '⚡', usesWords: false },
  { key: 'angrypet',   name: 'Angry Pet',      icon: '😡', usesWords: false },
]

const RC = {
  common:    { solid: '#9CA3AF', light: 'rgba(156,163,175,0.5)', glow: 'rgba(156,163,175,0.25)', gradient: 'from-gray-300 to-gray-400', trail: '#4B5563' },
  uncommon:  { solid: '#4ADE80', light: 'rgba(74,222,128,0.5)',  glow: 'rgba(74,222,128,0.25)',  gradient: 'from-green-300 to-green-500', trail: '#166534' },
  rare:      { solid: '#60A5FA', light: 'rgba(96,165,250,0.5)',  glow: 'rgba(96,165,250,0.25)',  gradient: 'from-blue-300 to-blue-500', trail: '#1e3a5f' },
  epic:      { solid: '#C084FC', light: 'rgba(192,132,252,0.5)', glow: 'rgba(192,132,252,0.25)', gradient: 'from-purple-400 to-purple-600', trail: '#3b1f6e' },
  legendary: { solid: '#FACC15', light: 'rgba(250,204,21,0.5)',  glow: 'rgba(250,204,21,0.25)',  gradient: 'from-yellow-300 to-amber-500', trail: '#713f12' },
}

const BIOMES = [
  { name: 'Enchanted Forest',  bg: 'from-emerald-950 via-green-950 to-slate-950', emoji: '🌿', accent: '#22c55e' },
  { name: 'Crystal Caves',     bg: 'from-blue-950 via-indigo-950 to-slate-950',   emoji: '💎', accent: '#6366f1' },
  { name: 'Volcanic Ridge',    bg: 'from-red-950 via-orange-950 to-slate-950',    emoji: '🌋', accent: '#ef4444' },
  { name: 'Mystic Swamp',      bg: 'from-teal-950 via-emerald-950 to-slate-950',  emoji: '🍄', accent: '#14b8a6' },
  { name: 'Frozen Peaks',      bg: 'from-cyan-950 via-sky-950 to-slate-950',      emoji: '❄️', accent: '#22d3ee' },
  { name: 'Shadow Ruins',      bg: 'from-violet-950 via-purple-950 to-slate-950', emoji: '🏚️', accent: '#a78bfa' },
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
      completed: false,
      score: 0,
    })
  }
  return stops
}

/* ---- Path Node ---- */
const PathNode = memo(({ stop, index, current, completed, isLast, rarity, onClick }) => {
  const rc = RC[rarity] || RC.common
  const isCurrent = index === current
  const isDone = completed
  const isLocked = index > current

  return (
    <div className="flex flex-col items-center relative">
      {/* Connector line to next node */}
      {!isLast && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 w-1 h-12"
          style={{
            background: isDone
              ? `linear-gradient(to bottom, ${rc.solid}, ${rc.solid}80)`
              : 'linear-gradient(to bottom, #374151, #1f2937)',
          }}
        />
      )}

      <button
        onClick={() => !isLocked && onClick(index)}
        disabled={isLocked}
        className={`relative w-20 h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 ${
          isCurrent
            ? 'scale-110 shadow-2xl'
            : isDone
              ? 'scale-100 opacity-90'
              : 'scale-90 opacity-40 cursor-not-allowed'
        }`}
        style={{
          background: isDone
            ? `linear-gradient(135deg, ${rc.trail}, #111827)`
            : isCurrent
              ? `linear-gradient(135deg, ${stop.biome.accent}30, #111827)`
              : '#111827',
          borderColor: isCurrent ? rc.solid : isDone ? `${rc.solid}60` : '#374151',
          boxShadow: isCurrent ? `0 0 25px ${rc.glow}, 0 0 50px ${rc.glow}` : 'none',
        }}
      >
        {/* Done checkmark */}
        {isDone && (
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background: rc.solid, color: '#000' }}>
            ✓
          </div>
        )}

        {/* Game icon */}
        <span className={`text-2xl ${isCurrent ? 'animate-bounce' : ''}`} style={{ animationDuration: '2s' }}>
          {isDone ? '✅' : stop.game.icon}
        </span>

        {/* Score */}
        {isDone && stop.score > 0 && (
          <span className="text-[10px] font-bold mt-0.5" style={{ color: rc.solid }}>{stop.score}</span>
        )}
      </button>

      {/* Label */}
      <div className="mt-1 text-center">
        <p className={`text-[11px] font-medium ${isCurrent ? 'text-white' : isDone ? 'text-gray-400' : 'text-gray-600'}`}>
          {stop.game.name}
        </p>
        <p className="text-[9px] text-gray-600">{stop.biome.emoji} {stop.biome.name}</p>
      </div>
    </div>
  )
})

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
  const [phase, setPhase] = useState('map') // map | playing | complete
  const [totalScore, setTotalScore] = useState(0)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const completedCount = stops.filter(s => s.completed).length
  const currentBiome = stops[currentStop]?.biome || BIOMES[0]

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

  const handleNodeClick = useCallback((index) => {
    if (index !== currentStop) return
    setPhase('playing')
  }, [currentStop])

  const handleGameComplete = useCallback((score, extra) => {
    const game = stops[currentStop]?.game
    setTotalScore(prev => prev + score)
    setStops(prev => prev.map((s, i) =>
      i === currentStop ? { ...s, completed: true, score } : s
    ))

    if (onGameEnd && game) onGameEnd(score, game.key, extra)

    // Check if all done
    if (currentStop >= stops.length - 1) {
      setPhase('complete')
    } else {
      setCurrentStop(prev => prev + 1)
      setPhase('map')
    }
  }, [currentStop, stops, onGameEnd])

  const handleGameClose = useCallback(() => {
    setPhase('map')
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

  return createPortal(
    <div
      className={`fixed inset-0 z-50 select-none overflow-hidden bg-gradient-to-b ${currentBiome.bg}`}
      style={{ touchAction: 'none' }}
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
      <div className="relative z-20 flex items-center justify-between px-4 py-3">
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

      {/* Progress bar */}
      {phase === 'map' && (
        <div className="relative z-10 mx-6 mb-2">
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(completedCount / config.stops) * 100}%`,
                background: `linear-gradient(90deg, ${rc.solid}, ${rc.solid}cc)`,
                boxShadow: `0 0 10px ${rc.light}`,
              }}
            />
          </div>
        </div>
      )}

      {/* Adventure path */}
      {phase === 'map' && (
        <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-24"
          style={{ height: 'calc(100vh - 100px)' }}>

          {/* Biome title */}
          <div className="text-center mt-4 mb-8">
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">
              {currentBiome.emoji} {currentBiome.name}
            </p>
            <p className="text-white/60 text-sm">
              Stop {currentStop + 1} of {stops.length}
            </p>
          </div>

          {/* Path nodes */}
          <div className="flex flex-col items-center gap-14">
            {stops.map((stop, i) => (
              <PathNode
                key={stop.id}
                stop={stop}
                index={i}
                current={currentStop}
                completed={stop.completed}
                isLast={i === stops.length - 1}
                rarity={rarity}
                onClick={handleNodeClick}
              />
            ))}

            {/* Final destination */}
            <div className="flex flex-col items-center mt-2">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center border-3 transition-all duration-500 ${
                  completedCount >= config.stops
                    ? 'animate-pulse scale-110'
                    : 'opacity-30 scale-90'
                }`}
                style={{
                  background: completedCount >= config.stops
                    ? `radial-gradient(circle, ${rc.glow}, #111827)`
                    : '#111827',
                  borderColor: completedCount >= config.stops ? rc.solid : '#374151',
                  borderWidth: 3,
                  borderStyle: 'solid',
                  boxShadow: completedCount >= config.stops ? `0 0 30px ${rc.glow}, 0 0 60px ${rc.glow}` : 'none',
                }}
              >
                {mode === 'encounter' && encounterPet ? (
                  <img src={encounterPet.image_url} alt="?" className="w-14 h-14 object-contain"
                    style={{ filter: completedCount >= config.stops ? 'none' : 'brightness(0)' }} />
                ) : (
                  <span className="text-4xl">{completedCount >= config.stops ? '🏆' : '🔒'}</span>
                )}
              </div>
              <p className={`mt-2 text-sm font-bold ${completedCount >= config.stops ? 'text-white' : 'text-gray-600'}`}>
                {mode === 'encounter' ? 'Wild Pet!' : 'Treasure!'}
              </p>
              {completedCount >= config.stops && (
                <button onClick={() => setPhase('complete')}
                  className={`mt-4 px-8 py-3 rounded-2xl font-bold text-white bg-gradient-to-r ${rc.gradient} hover:scale-105 active:scale-95 transition-all shadow-xl`}>
                  {mode === 'encounter' ? 'Encounter Pet!' : 'Claim Reward!'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current stop prompt — big CTA when on map */}
      {phase === 'map' && !stops[currentStop]?.completed && currentStop < stops.length && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }}>
          <button onClick={() => setPhase('playing')}
            className={`w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r ${rc.gradient} hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3`}>
            <span className="text-2xl">{stops[currentStop].game.icon}</span>
            Play {stops[currentStop].game.name}
          </button>
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
              <div className="text-7xl relative z-10">
                {mode === 'encounter' ? '🎯' : '🏆'}
              </div>
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
      `}</style>
    </div>,
    document.body
  )
}

export default PetMazeAdventure
