import { useState, useEffect } from 'react'
import { Swords, X } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import PvPChallengeModal from './PvPChallengeModal'

const PvPIncomingBanner = () => {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [acceptedChallenge, setAcceptedChallenge] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pvp_dismissed_challenges') || '[]')
      const now = Date.now()
      const valid = saved.filter(e => now - e.t < 30 * 60 * 1000)
      if (valid.length !== saved.length) localStorage.setItem('pvp_dismissed_challenges', JSON.stringify(valid))
      return new Set(valid.map(e => e.id))
    } catch { return new Set() }
  })
  const [results, setResults] = useState([])
  const [dismissedResults, setDismissedResults] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pvp_dismissed_results') || '[]')
      return new Set(saved)
    } catch { return new Set() }
  })

  useEffect(() => {
    if (!user?.id) return

    const fetchChallenges = async () => {
      const { data, error } = await supabase
        .from('pvp_challenges')
        .select(`
          id,
          challenger_id,
          game_type,
          challenger_score,
          status,
          created_at,
          challenger:users!pvp_challenges_challenger_id_fkey(id, full_name, avatar_url)
        `)
        .eq('opponent_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(2)

      if (!error && data) {
        setChallenges(data.filter(c => !dismissed.has(c.id)))
      }
    }

    // Fetch completed challenges where this user was the challenger (last 24h)
    const fetchResults = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('pvp_challenges')
        .select(`
          id,
          challenger_id,
          opponent_id,
          game_type,
          challenger_score,
          opponent_score,
          winner_id,
          status,
          created_at,
          opponent:users!pvp_challenges_opponent_id_fkey(id, full_name, avatar_url)
        `)
        .eq('challenger_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!error && data) {
        setResults(data.filter(r => !dismissedResults.has(r.id)))
      }
    }

    fetchChallenges()
    fetchResults()
    const interval = setInterval(() => {
      fetchChallenges()
      fetchResults()
    }, 30000)

    // Realtime subscription for instant notifications
    const channel = supabase
      .channel('pvp-challenges')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pvp_challenges',
        filter: `opponent_id=eq.${user.id}`,
      }, (payload) => {
        fetchChallenges()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pvp_challenges',
        filter: `challenger_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new?.status === 'completed') {
          fetchResults()
        }
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user?.id, dismissed, dismissedResults])

  const handleAccept = (challenge) => {
    setAcceptedChallenge(challenge)
  }

  const handleDismiss = (challengeId) => {
    setDismissed(prev => {
      const next = new Set([...prev, challengeId])
      const saved = JSON.parse(localStorage.getItem('pvp_dismissed_challenges') || '[]')
      saved.push({ id: challengeId, t: Date.now() })
      localStorage.setItem('pvp_dismissed_challenges', JSON.stringify(saved))
      return next
    })
  }

  const handleDismissResult = (resultId) => {
    setDismissedResults(prev => {
      const next = new Set([...prev, resultId])
      localStorage.setItem('pvp_dismissed_results', JSON.stringify([...next]))
      return next
    })
  }

  const handleBattleClose = async () => {
    if (acceptedChallenge) {
      setDismissed(prev => new Set([...prev, acceptedChallenge.id]))
    }
    setAcceptedChallenge(null)
  }

  const visibleChallenges = challenges.filter(c => !dismissed.has(c.id))
  const visibleResults = results.filter(r => !dismissedResults.has(r.id))

  if (visibleChallenges.length === 0 && visibleResults.length === 0 && !acceptedChallenge) return null

  return (
    <>
      {/* Incoming challenge banners + result banners */}
      <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-full max-w-sm px-4">
        {/* Results for challenges you sent */}
        {visibleResults.map((result) => {
          const won = result.winner_id === user.id
          const draw = !result.winner_id
          const opponentName = result.opponent?.full_name || 'Opponent'
          return (
            <div
              key={result.id}
              className={`bg-white rounded-xl shadow-lg border-2 p-3 animate-bounce-in ${won ? 'border-green-200' : draw ? 'border-yellow-200' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  {result.opponent?.avatar_url ? (
                    <img src={result.opponent.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold">
                      {opponentName[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <Swords size={14} className="absolute -bottom-1 -right-1 text-red-500 bg-white rounded-full p-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold truncate ${won ? 'text-green-600' : draw ? 'text-yellow-600' : 'text-red-600'}`}>
                    {won ? 'You won!' : draw ? "It's a draw!" : 'You lost!'} vs {opponentName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {result.game_type} - <span className="font-bold text-blue-500">{result.challenger_score}</span> vs <span className="font-bold text-red-500">{result.opponent_score}</span>
                    {won && <span className="ml-1 text-green-500 font-bold">+10 XP</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDismissResult(result.id)}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 transition flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Incoming challenges */}
        {visibleChallenges.map((challenge) => (
          <div
            key={challenge.id}
            className="bg-white rounded-xl shadow-lg border-2 border-red-200 p-3 animate-bounce-in"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                {challenge.challenger?.avatar_url ? (
                  <img src={challenge.challenger.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold">
                    {challenge.challenger?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <Swords size={14} className="absolute -bottom-1 -right-1 text-red-500 bg-white rounded-full p-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-800 truncate">
                  {challenge.challenger?.full_name || 'Someone'} challenged you!
                </div>
                <div className="text-xs text-gray-500">
                  {challenge.game_type} - Score to beat: <span className="font-bold text-red-500">{challenge.challenger_score}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleAccept(challenge)}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold hover:from-red-600 hover:to-orange-600 transition"
                >
                  Fight!
                </button>
                <button
                  onClick={() => handleDismiss(challenge.id)}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 transition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Accepted challenge - open the game modal as respondent */}
      {acceptedChallenge && (
        <PvPResponseModal
          challenge={acceptedChallenge}
          onClose={handleBattleClose}
        />
      )}
    </>
  )
}

// Separate component for responding to a challenge
import { usePet as usePetHook } from '../../hooks/usePet'
import PetWhackMole from '../pet/PetWhackMole'
import PetWordScramble from '../pet/PetWordScramble'
import PetAstroBlast from '../pet/PetAstroBlast'
import { createPortal } from 'react-dom'
import { Trophy } from 'lucide-react'

import { assetUrl } from '../../hooks/useBranding'

const PvPResponseModal = ({ challenge, onClose }) => {
  const { user, profile } = useAuth()
  const { activePet } = usePetHook()
  const [step, setStep] = useState('ready') // ready | playing | result
  const [myScore, setMyScore] = useState(null)
  const [wordBank, setWordBank] = useState([])
  const [saving, setSaving] = useState(false)

  const opponentScore = challenge.challenger_score
  const opponentName = challenge.challenger?.full_name || 'Opponent'
  const gameType = challenge.game_type

  useEffect(() => {
    const fetchWords = async () => {
      const { data } = await supabase
        .from('pet_word_bank')
        .select('word, hint, image_url')
        .eq('is_active', true)
        .lte('min_level', profile?.current_level || 1)
      if (data && data.length >= 10) setWordBank(data)
    }
    fetchWords()
  }, [])

  const handleGameEnd = async (score) => {
    setMyScore(score)
    setStep('result')
    setSaving(true)

    try {
      const won = score > opponentScore
      if (won) {
        new Audio('https://xpclass.vn/xpclass/sound/victory.mp3').play().catch(() => {})
      }
      const draw = score === opponentScore

      await supabase.from('pvp_challenges')
        .update({
          opponent_score: score,
          status: 'completed',
          winner_id: draw ? null : won ? user.id : challenge.challenger_id,
        })
        .eq('id', challenge.id)

      // Award 10 XP to the winner
      const winnerId = draw ? null : won ? user.id : challenge.challenger_id
      if (winnerId) {
        const { data: winner } = await supabase
          .from('users')
          .select('xp')
          .eq('id', winnerId)
          .single()
        if (winner) {
          await supabase.from('users')
            .update({ xp: (winner.xp || 0) + 10 })
            .eq('id', winnerId)
        }
      }
    } catch (err) {
      console.error('Error updating PvP result:', err)
    } finally {
      setSaving(false)
    }
  }

  const petImage = activePet?.image_url || assetUrl('/image/pet/default.png')
  const petName = activePet?.nickname || activePet?.name || 'Your Pet'
  const won = myScore > opponentScore
  const draw = myScore === opponentScore

  const renderGame = () => {
    const commonProps = {
      petImageUrl: petImage,
      petName,
      onClose: () => onClose(),
    }
    switch (gameType) {
      case 'whackmole':
        return <PetWhackMole {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} />
      case 'scramble':
        return <PetWordScramble {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} />
      case 'astroblast':
        return <PetAstroBlast {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} />
      default:
        return null
    }
  }

  if (step === 'playing') return renderGame()

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

        {step === 'ready' && (
          <div className="p-6 text-center">
            {/* VS Display */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex flex-col items-center">
                {challenge.challenger?.avatar_url ? (
                  <img src={challenge.challenger.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-red-400" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-lg font-bold">
                    {opponentName[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-gray-600 mt-1">{opponentName.split(' ').pop()}</span>
                <span className="text-lg font-black text-red-500">{opponentScore}</span>
              </div>

              <div className="text-2xl font-black text-red-500">VS</div>

              <div className="flex flex-col items-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-blue-400" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
                    {profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-xs font-medium text-gray-600 mt-1">You</span>
                <span className="text-lg font-black text-blue-500">?</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              <span className="font-bold">{opponentName}</span> scored <span className="font-bold text-red-500">{opponentScore}</span> in <span className="font-bold capitalize">{gameType}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">Can you beat their score?</p>

            <button
              onClick={() => setStep('playing')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold text-lg hover:from-red-600 hover:to-orange-600 transition active:scale-[0.98]"
            >
              Accept Challenge!
            </button>
          </div>
        )}

        {step === 'result' && (
          <div className="p-6 text-center">
            <div className="mb-4">
              {draw ? (
                <div className="text-5xl mb-2">🤝</div>
              ) : won ? (
                <Trophy size={48} className="mx-auto text-yellow-500 mb-2" />
              ) : (
                <div className="text-5xl mb-2">😢</div>
              )}
              <h3 className="text-2xl font-bold text-gray-800">
                {draw ? "It's a Draw!" : won ? 'You Won!' : 'You Lost!'}
              </h3>
              {won && <p className="text-sm font-bold text-green-500 mt-1">+10 XP</p>}
            </div>

            {/* Score comparison with avatars */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-center">
                {challenge.challenger?.avatar_url ? (
                  <img src={challenge.challenger.avatar_url} alt="" className={`w-12 h-12 rounded-full object-cover mx-auto mb-1 ${won ? 'opacity-50 grayscale' : 'ring-2 ring-red-400'}`} />
                ) : (
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold mx-auto mb-1 ${won ? 'opacity-50 grayscale' : 'ring-2 ring-red-400'}`}>
                    {opponentName[0]?.toUpperCase()}
                  </div>
                )}
                <div className="text-xs text-gray-500">{opponentName.split(' ').pop()}</div>
                <div className={`text-3xl font-black ${won ? 'text-gray-400' : 'text-red-500'}`}>{opponentScore}</div>
              </div>
              <div className="text-lg font-bold text-gray-300">vs</div>
              <div className="text-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className={`w-12 h-12 rounded-full object-cover mx-auto mb-1 ${!won && !draw ? 'opacity-50 grayscale' : 'ring-2 ring-green-400'}`} />
                ) : (
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold mx-auto mb-1 ${!won && !draw ? 'opacity-50 grayscale' : 'ring-2 ring-green-400'}`}>
                    {profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="text-xs text-gray-500">You</div>
                <div className={`text-3xl font-black ${won ? 'text-green-500' : draw ? 'text-yellow-500' : 'text-gray-400'}`}>{myScore}</div>
              </div>
            </div>

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

export default PvPIncomingBanner
