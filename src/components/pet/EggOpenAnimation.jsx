import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'

const rarityColors = {
  common: 'from-gray-300 to-gray-400',
  uncommon: 'from-green-300 to-green-500',
  rare: 'from-blue-300 to-blue-500',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-yellow-300 to-amber-500',
}

const rarityGlow = {
  common: 'shadow-gray-300',
  uncommon: 'shadow-green-400',
  rare: 'shadow-blue-400',
  epic: 'shadow-purple-500',
  legendary: 'shadow-yellow-400',
}

const rarityText = {
  common: 'text-gray-600',
  uncommon: 'text-green-500',
  rare: 'text-blue-500',
  epic: 'text-purple-500',
  legendary: 'text-yellow-500',
}

const rarityBadge = {
  common: 'bg-gray-200 text-gray-700',
  uncommon: 'bg-green-200 text-green-800',
  rare: 'bg-blue-200 text-blue-800',
  epic: 'bg-purple-200 text-purple-800',
  legendary: 'bg-yellow-200 text-yellow-800',
}

const EggOpenAnimation = ({ result, eggRarity, onClose, onNickname }) => {
  // phases: wobbling -> cracking -> hatching -> reveal -> done
  const [phase, setPhase] = useState('wobbling')
  const [nickname, setNickname] = useState('')

  const isDuplicate = result?.result_type === 'duplicate_gems'
  const pet = result?.pet
  const rarity = eggRarity || pet?.rarity || 'common'

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('cracking'), 1200)
    return () => clearTimeout(timer1)
  }, [])

  useEffect(() => {
    if (phase === 'cracking') {
      const timer = setTimeout(() => setPhase('hatching'), 1000)
      return () => clearTimeout(timer)
    }
  }, [phase])

  useEffect(() => {
    if (phase === 'hatching') {
      const timer = setTimeout(() => setPhase('reveal'), 800)
      return () => clearTimeout(timer)
    }
  }, [phase])

  useEffect(() => {
    if (phase === 'reveal') {
      const timer = setTimeout(() => setPhase('done'), 600)
      return () => clearTimeout(timer)
    }
  }, [phase])

  const handleCollect = () => {
    if (!isDuplicate && nickname && onNickname) {
      onNickname(nickname)
    }
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl max-w-sm w-full p-8 text-center">

        {/* Egg Animation Phases */}
        {(phase === 'wobbling' || phase === 'cracking') && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className={`w-28 h-36 rounded-[50%] bg-gradient-to-br ${rarityColors[rarity]} flex items-center justify-center transition-all shadow-2xl ${rarityGlow[rarity]} ${
              phase === 'wobbling' ? 'animate-egg-wobble' : 'animate-egg-crack'
            }`}>
              <span className="text-4xl">{phase === 'cracking' ? '💥' : '🥚'}</span>
            </div>
            <p className="text-gray-400 text-sm mt-4">
              {phase === 'wobbling' ? 'Something is moving inside...' : 'The egg is cracking!'}
            </p>
          </div>
        )}

        {/* Hatching - bright flash */}
        {phase === 'hatching' && (
          <div className="flex items-center justify-center py-8">
            <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${rarityColors[rarity]} animate-egg-burst flex items-center justify-center shadow-2xl ${rarityGlow[rarity]}`}>
              <Sparkles className="w-16 h-16 text-white animate-spin" />
            </div>
          </div>
        )}

        {/* Reveal & Done */}
        {(phase === 'reveal' || phase === 'done') && (
          <div className="space-y-4 animate-fade-in">
            {isDuplicate ? (
              <>
                <div className="flex items-center justify-center gap-1 text-yellow-400 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium">Duplicate!</span>
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center shadow-xl ${
                  result.refund_type === 'xp'
                    ? 'bg-gradient-to-br from-blue-400 to-cyan-400 shadow-blue-500/30'
                    : 'bg-gradient-to-br from-purple-400 to-pink-400 shadow-purple-500/30'
                }`}>
                  <img
                    src={result.refund_type === 'xp'
                      ? 'https://xpclass.vn/xpclass/image/study/xp2.png'
                      : 'https://xpclass.vn/xpclass/image/study/gem.png'
                    }
                    alt={result.refund_type === 'xp' ? 'XP' : 'Gems'}
                    className="w-14 h-14"
                  />
                </div>
                <p className="text-white text-lg font-bold">
                  +{result.refund_type === 'xp' ? result.xp_awarded : result.gems_awarded} {result.refund_type === 'xp' ? 'XP' : 'Gems'}
                </p>
                <p className="text-gray-400 text-sm">{result.message}</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-1 text-yellow-400 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium">New Pet!</span>
                  <Sparkles className="w-5 h-5" />
                </div>

                {/* Pet Image */}
                <div className={`w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br ${rarityColors[rarity]} flex items-center justify-center shadow-2xl ${rarityGlow[rarity]} overflow-hidden`}>
                  {pet?.image_url ? (
                    <img src={pet.image_url} alt={pet.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-6xl">
                      {rarity === 'legendary' ? '🐉' :
                       rarity === 'epic' ? '🦅' :
                       rarity === 'rare' ? '🦊' :
                       rarity === 'uncommon' ? '🐱' : '🐶'}
                    </span>
                  )}
                </div>

                {/* Pet Info */}
                <h3 className="text-white text-xl font-bold">{pet?.name}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${rarityBadge[rarity]}`}>
                  {rarity?.toUpperCase()}
                </span>
                {pet?.description && (
                  <p className="text-gray-400 text-sm">{pet.description}</p>
                )}

                {/* Nickname Input */}
                {phase === 'done' && onNickname && (
                  <div className="mt-2">
                    <label className="block text-sm text-gray-400 mb-1">Give a nickname (optional)</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder={pet?.name}
                      maxLength={20}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-center"
                    />
                  </div>
                )}
              </>
            )}

            {/* Collect Button */}
            {phase === 'done' && (
              <button
                onClick={handleCollect}
                className={`mt-4 px-8 py-2.5 rounded-lg font-medium transition-colors ${
                  isDuplicate
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white'
                }`}
              >
                {isDuplicate ? (result.refund_type === 'xp' ? 'Collect XP' : 'Collect Gems') : 'Collect'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes eggWobble {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-8deg); }
          30% { transform: rotate(8deg); }
          45% { transform: rotate(-10deg); }
          60% { transform: rotate(10deg); }
          75% { transform: rotate(-6deg); }
          90% { transform: rotate(6deg); }
        }
        .animate-egg-wobble {
          animation: eggWobble 0.6s ease-in-out infinite;
        }
        @keyframes eggCrack {
          0% { transform: scale(1) rotate(0deg); }
          20% { transform: scale(1.05) rotate(-3deg); }
          40% { transform: scale(1.08) rotate(3deg); }
          60% { transform: scale(1.12) rotate(-5deg); }
          80% { transform: scale(1.15) rotate(5deg); }
          100% { transform: scale(1.2) rotate(0deg); }
        }
        .animate-egg-crack {
          animation: eggCrack 1s ease-out forwards;
        }
        @keyframes eggBurst {
          0% { transform: scale(0.5); opacity: 0.5; }
          50% { transform: scale(1.5); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }
        .animate-egg-burst {
          animation: eggBurst 0.8s ease-out forwards;
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>,
    document.body
  )
}

export default EggOpenAnimation
