import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Swords, Trophy, Clock } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { usePet } from '../../hooks/usePet'
import PetWhackMole from '../pet/PetWhackMole'
import PetWordScramble from '../pet/PetWordScramble'
import PetAstroBlast from '../pet/PetAstroBlast'

import { assetUrl } from '../../hooks/useBranding'

const GAMES = [
  { id: 'scramble', name: 'Word Scramble', icon: assetUrl('/image/dashboard/pet-scramble.jpg'), description: 'Pop bubbles in order!' },
  { id: 'whackmole', name: 'Whack-a-Mole', icon: assetUrl('/pet-game/mole-normal.png'), description: 'Tap the correct word!' },
  { id: 'astroblast', name: 'Astro Blast', icon: 'https://xpclass.vn/xpclass/image/inventory/spaceship/phantom-voyager.png', description: 'Shoot the asteroids!' },
]

const PvPChallengeModal = ({ opponent, onClose }) => {
  const { user, profile } = useAuth()
  const { activePet } = usePet()
  const [step, setStep] = useState('pick-game') // pick-game | playing | result
  const [selectedGame, setSelectedGame] = useState(null)
  const [myScore, setMyScore] = useState(null)
  const [wordBank, setWordBank] = useState([])
  const [saving, setSaving] = useState(false)
  const [enabledGames, setEnabledGames] = useState(['scramble', 'whackmole', 'astroblast'])

  useEffect(() => {
    fetchWordBank()
    const fetchEnabledGames = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('setting_value')
        .eq('setting_key', 'pet_training_enabled_games')
        .single()
      if (data?.setting_value) {
        try { setEnabledGames(JSON.parse(data.setting_value)) } catch {}
      }
    }
    fetchEnabledGames()
  }, [])

  const fetchWordBank = async () => {
    const { data: words } = await supabase
      .from('pet_word_bank')
      .select('word, hint, image_url')
      .eq('is_active', true)
      .lte('min_level', profile?.current_level || 1)
    if (words && words.length >= 10) setWordBank(words)
  }

  const startGame = (gameId) => {
    setSelectedGame(gameId)
    setStep('playing')
  }

  const handleGameEnd = async (score) => {
    setMyScore(score)
    setStep('result')
    setSaving(true)

    try {
      // Save challenge to database
      await supabase.from('pvp_challenges').insert({
        challenger_id: user.id,
        opponent_id: opponent.id,
        game_type: selectedGame,
        challenger_score: score,
        status: 'pending',
      })
    } catch (err) {
      console.error('Error saving PvP challenge:', err)
    } finally {
      setSaving(false)
    }
  }

  const petImage = activePet?.image_url || assetUrl('/image/pet/default.png')
  const petName = activePet?.nickname || activePet?.name || 'Your Pet'

  // Render the selected game
  const renderGame = () => {
    const commonProps = {
      petImageUrl: petImage,
      petName,
      onClose: () => setStep('pick-game'),
    }

    switch (selectedGame) {
      case 'whackmole':
        return <PetWhackMole {...commonProps} onGameEnd={(s) => handleGameEnd(s)} wordBank={wordBank} />
      case 'scramble':
        return <PetWordScramble {...commonProps} onGameEnd={(s) => handleGameEnd(s)} wordBank={wordBank} />
      case 'astroblast':
        return <PetAstroBlast {...commonProps} onGameEnd={(s) => handleGameEnd(s)} wordBank={wordBank} />
      default:
        return null
    }
  }

  if (step === 'playing') {
    return renderGame()
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-4 text-white relative">
          <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full bg-white/20 hover:bg-white/30 transition">
            <X size={18} />
          </button>
          <div className="flex items-center justify-center gap-3">
            <Swords size={24} />
            <h2 className="text-xl font-bold">PvP Battle</h2>
          </div>
        </div>

        {step === 'pick-game' && (
          <div className="p-5">
            {/* VS Header */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {/* You */}
              <div className="flex flex-col items-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-blue-400" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
                    {profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-xs font-medium text-gray-600 mt-1 truncate max-w-[80px]">{profile?.full_name?.split(' ').pop() || 'You'}</span>
              </div>

              <div className="text-2xl font-black text-red-500">VS</div>

              {/* Opponent */}
              <div className="flex flex-col items-center">
                {opponent.avatar_url ? (
                  <img src={opponent.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-red-400" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-lg font-bold">
                    {opponent.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-xs font-medium text-gray-600 mt-1 truncate max-w-[80px]">{opponent.full_name?.split(' ').pop() || 'Opponent'}</span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-500 mb-4">Choose a game to battle!</p>

            {/* Game List */}
            <div className="space-y-2">
              {GAMES.filter((g) => enabledGames.includes(g.id)).map((game) => (
                <button
                  key={game.id}
                  onClick={() => startGame(game.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    <img src={game.icon} alt="" className="w-7 h-7" onError={(e) => { e.target.style.display = 'none' }} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-gray-800">{game.name}</div>
                    <div className="text-xs text-gray-500">{game.description}</div>
                  </div>
                  <Swords size={16} className="text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="p-6 text-center">
            <div className="mb-4">
              <Trophy size={48} className="mx-auto text-yellow-500 mb-2" />
              <h3 className="text-2xl font-bold text-gray-800">Battle Complete!</h3>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-orange-50 rounded-xl p-4 mb-4">
              <div className="text-sm text-gray-500 mb-1">Your Score</div>
              <div className="text-4xl font-black text-blue-600">{myScore}</div>
            </div>

            <div className="flex items-center gap-2 justify-center text-sm text-gray-500 mb-4">
              <Clock size={14} />
              <span>Waiting for {opponent.full_name?.split(' ').pop() || 'opponent'} to play...</span>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              {opponent.full_name || 'Your opponent'} will be notified to play their round. The winner will be announced when both have played!
            </p>

            <button
              onClick={onClose}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:from-red-600 hover:to-orange-600 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default PvPChallengeModal
