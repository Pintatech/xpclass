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

const TAUNT_GIF_BASE = assetUrl('/gif/taunt')

const PVP_TAUNTS = {
  messages: [
    'Better luck next time! 😏',
    'Too easy! 💪',
    'GG EZ 😎',
    'Get rekt! 💀',
    'Not even close! 🔥',
    'You need more practice! 📚',
    'Is that all you got? 🥱',
    'Bow to the champion! 👑',
  ],
  emojis: ['😎', '💪', '🏆', '😂', '🔥', '👑', '💀', '🫡', '🥱', '😤', '🤡', '👋'],
  gifs: [
    { value: `${TAUNT_GIF_BASE}/1.gif`, label: 'Deal with it' },
    { value: `${TAUNT_GIF_BASE}/2.gif`, label: 'Victory dance' },
    { value: `${TAUNT_GIF_BASE}/3.gif`, label: 'Bye bye' },
    { value: `${TAUNT_GIF_BASE}/4.gif`, label: 'Too easy' },
    { value: `${TAUNT_GIF_BASE}/5.gif`, label: 'Loser' },
    { value: `${TAUNT_GIF_BASE}/6.gif`, label: 'Cry' },
  ],
}

const TauntPicker = ({ challengeId, onSent }) => {
  const [tab, setTab] = useState('emojis')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const sendTaunt = async (type, value) => {
    setSending(true)
    try {
      const taunt = JSON.stringify({ type, value })
      await supabase.from('pvp_challenges')
        .update({ winner_taunt: taunt })
        .eq('id', challengeId)
      setSent(true)
      onSent?.(taunt)
    } catch (e) {
      console.error('Failed to send taunt:', e)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-2">
        <span className="text-sm font-bold text-green-500 animate-bounce inline-block">Taunt sent! 😈</span>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-gray-500 mb-2 text-center">Send a taunt! 😈</p>
      <div className="flex gap-1 mb-2 justify-center">
        {[
          { key: 'emojis', icon: '😎', label: 'Emoji' },
          { key: 'messages', icon: '💬', label: 'Message' },
          { key: 'gifs', icon: '🎬', label: 'Sticker' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition ${
              tab === t.key ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="max-h-32 overflow-y-auto">
        {tab === 'emojis' && (
          <div className="grid grid-cols-6 gap-1">
            {PVP_TAUNTS.emojis.map((emoji, i) => (
              <button
                key={i}
                onClick={() => sendTaunt('emoji', emoji)}
                disabled={sending}
                className="text-2xl p-1 rounded-lg hover:bg-yellow-50 active:scale-90 transition disabled:opacity-50"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {tab === 'messages' && (
          <div className="space-y-1">
            {PVP_TAUNTS.messages.map((msg, i) => (
              <button
                key={i}
                onClick={() => sendTaunt('message', msg)}
                disabled={sending}
                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition disabled:opacity-50"
              >
                {msg}
              </button>
            ))}
          </div>
        )}
        {tab === 'gifs' && (
          <div className="grid grid-cols-3 gap-1">
            {PVP_TAUNTS.gifs.map((gif, i) => (
              <button
                key={i}
                onClick={() => sendTaunt('gif', gif.value)}
                disabled={sending}
                className="flex flex-col items-center p-2 rounded-lg hover:bg-purple-50 transition disabled:opacity-50"
              >
                {gif.value.startsWith('http') ? (
                  <img src={gif.value} alt={gif.label} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <span className="text-2xl">{gif.value}</span>
                )}
                <span className="text-[10px] text-gray-400 mt-0.5">{gif.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const GAMES = [
  { id: 'scramble', name: 'Word Scramble', icon: assetUrl('/image/dashboard/pet-scramble.jpg'), description: 'Pop bubbles in order!' },
  { id: 'whackmole', name: 'Whack-a-Mole', icon: assetUrl('/pet-game/mole-normal.png'), description: 'Tap the correct word!' },
  { id: 'astroblast', name: 'Astro Blast', icon: 'https://xpclass.vn/xpclass/image/inventory/spaceship/phantom-voyager.png', description: 'Shoot the asteroids!' },
]

const PvPChallengeModal = ({ opponent, onClose }) => {
  const { user, profile } = useAuth()
  const { activePet, playWithPet } = usePet()
  const [step, setStep] = useState('pick-game') // pick-game | playing | result
  const [selectedGame, setSelectedGame] = useState(null)
  const [myScore, setMyScore] = useState(null)
  const [wordBank, setWordBank] = useState([])
  const [saving, setSaving] = useState(false)
  const [enabledGames, setEnabledGames] = useState(['scramble', 'whackmole', 'astroblast'])
  const [hasPending, setHasPending] = useState(null)
  const [checkingPending, setCheckingPending] = useState(true)

  useEffect(() => {
    fetchWordBank()
    // Check if there's already a pending challenge with this opponent
    const checkPending = async () => {
      const { data } = await supabase
        .from('pvp_challenges')
        .select('id, challenger_id, challenger_score, game_type, created_at')
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .or(`and(challenger_id.eq.${user.id},opponent_id.eq.${opponent.id}),and(challenger_id.eq.${opponent.id},opponent_id.eq.${user.id})`)
        .limit(1)
      if (data && data.length > 0) {
        setHasPending(data[0])
      }
      setCheckingPending(false)
    }
    checkPending()
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
      if (hasPending && hasPending.challenger_id !== user.id) {
        // Accepting an existing challenge — save opponent score and determine winner
        const challengerScore = hasPending.challenger_score
        const winner = score > challengerScore ? user.id : score < challengerScore ? hasPending.challenger_id : null
        if (score > challengerScore) {
          new Audio('https://xpclass.vn/xpclass/sound/victory.mp3').play().catch(() => {})
        } else if (score < challengerScore) {
          new Audio('https://xpclass.vn/xpclass/sound/craft_fail.mp3').play().catch(() => {})
        }
        await supabase.from('pvp_challenges').update({
          opponent_score: score,
          winner_id: winner,
          status: 'completed',
        }).eq('id', hasPending.id)
      } else {
        // Creating a new challenge
        await supabase.from('pvp_challenges').insert({
          challenger_id: user.id,
          opponent_id: opponent.id,
          game_type: selectedGame,
          challenger_score: score,
          status: 'pending',
        })
      }
      // Award pet XP
      if (activePet?.id) {
        playWithPet(activePet.id).catch(() => {})
      }
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
      hideClose: true,
    }

    switch (selectedGame) {
      case 'whackmole':
        return <PetWhackMole {...commonProps} onGameEnd={(s) => handleGameEnd(s)} wordBank={wordBank} />
      case 'scramble':
        return <PetWordScramble {...commonProps} onGameEnd={(s) => handleGameEnd(s)} wordBank={wordBank} />
      case 'astroblast':
        return <PetAstroBlast {...commonProps} onGameEnd={(s) => handleGameEnd(s)} wordBank={wordBank} shipSkinUrl={profile?.active_spaceship_url} shipLaserColor={profile?.active_spaceship_laser} asteroidSkinUrls={[
          'https://xpclass.vn/xpclass/pet-game/astro/alien1.png',
          'https://xpclass.vn/xpclass/pet-game/astro/alien2.png',
          'https://xpclass.vn/xpclass/pet-game/astro/alien3.png',
          'https://xpclass.vn/xpclass/pet-game/astro/alien4.png',
          'https://xpclass.vn/xpclass/pet-game/astro/alien5.png',
          'https://xpclass.vn/xpclass/pet-game/astro/alien6.png',
        ]} />
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

            {checkingPending ? (
              <p className="text-center text-sm text-gray-400 mb-4">Checking...</p>
            ) : hasPending ? (
              <div className="text-center py-6">
                <p className="text-sm text-orange-600 font-medium mb-2">You already have a pending challenge with this player!</p>
                <div className="bg-orange-50 rounded-xl p-3 mb-2">
                  <div className="text-xs text-gray-500 capitalize">{hasPending.game_type}</div>
                  <div className="text-2xl font-black text-orange-500">{hasPending.challenger_score}</div>
                  <div className="text-xs text-gray-400">{hasPending.challenger_id === user.id ? 'Your score' : 'Their score'}</div>
                </div>
                {hasPending.challenger_id !== user.id ? (
                  <button
                    onClick={() => {
                      setSelectedGame(hasPending.game_type)
                      setStep('playing')
                    }}
                    className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:from-red-600 hover:to-orange-600 transition"
                  >
                    Accept Challenge
                  </button>
                ) : (
                  <p className="text-xs text-gray-500">Wait for them to finish before challenging again.</p>
                )}
              </div>
            ) : (
            <>
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
            </>
            )}
          </div>
        )}

        {step === 'result' && (
          <div className="p-6 text-center">
            <div className="mb-4">
              <Trophy size={48} className="mx-auto text-yellow-500 mb-2" />
              <h3 className="text-2xl font-bold text-gray-800">Battle Complete!</h3>
            </div>

            {/* VS with avatars */}
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover mx-auto mb-1 ring-2 ring-blue-400" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold mx-auto mb-1 ring-2 ring-blue-400">
                    {profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="text-xs text-gray-500">You</div>
                <div className="text-3xl font-black text-blue-600">{myScore}</div>
              </div>
              <div className="text-lg font-bold text-gray-300">vs</div>
              <div className="text-center">
                {opponent.avatar_url ? (
                  <img src={opponent.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover mx-auto mb-1 ring-2 ring-gray-300" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold mx-auto mb-1 ring-2 ring-gray-300">
                    {opponent.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="text-xs text-gray-500">{opponent.full_name?.split(' ').pop()}</div>
                <div className="text-3xl font-black text-gray-400">{hasPending && hasPending.challenger_id !== user.id ? hasPending.challenger_score : '?'}</div>
              </div>
            </div>

            {hasPending && hasPending.challenger_id !== user.id ? (
              <div className="mb-4">
                {myScore > hasPending.challenger_score ? (
                  <>
                    <p className="text-lg font-bold text-green-600">You Win!</p>
                    {!saving && (
                      <TauntPicker challengeId={hasPending.id} />
                    )}
                  </>
                ) : myScore < hasPending.challenger_score ? (
                  <p className="text-lg font-bold text-red-500">You Lose!</p>
                ) : (
                  <p className="text-lg font-bold text-orange-500">It&apos;s a Tie!</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 justify-center text-sm text-gray-500 mb-4">
                  <Clock size={14} />
                  <span>Waiting for {opponent.full_name?.split(' ').pop() || 'opponent'} to play...</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  {opponent.full_name || 'Your opponent'} will be notified to play their round. The winner will be announced when both have played!
                </p>
              </>
            )}

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
