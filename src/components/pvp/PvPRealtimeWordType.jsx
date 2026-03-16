import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { usePet } from '../../hooks/usePet'
import { assetUrl } from '../../hooks/useBranding'
import { seededPickGameWords } from '../../utils/seededRandom'
import PetWordType from '../pet/PetWordType'
import WORD_BANK from '../pet/wordBank'

const PvPRealtimeWordType = ({
  challengeId,
  wordSeed,
  wordBank = [],
  opponent,
  isChallenger,
  onClose,
  onComplete,
  petImageUrl,
  petName,
  pvpOpponentPetUrl = null,
}) => {
  const { user } = useAuth()
  const { activePet, playWithPet } = usePet()

  const [phase, setPhase] = useState('lobby') // lobby | countdown | playing | done
  const [myReady, setMyReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [opponentProgress, setOpponentProgress] = useState({ score: 0, wordsCompleted: 0, wordIndex: 0 })
  const [opponentFinished, setOpponentFinished] = useState(false)
  const [myScore, setMyScore] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  const channelRef = useRef(null)
  const opponentProgressRef = useRef({ score: 0, wordsCompleted: 0, wordIndex: 0 })
  const myScoreRef = useRef(null)

  // Generate the same word list for both players using the shared seed
  const source = wordBank.length >= 10 ? wordBank : WORD_BANK
  const gameWords = useRef(seededPickGameWords(source, wordSeed)).current

  // Set up Supabase broadcast channel
  useEffect(() => {
    const channelName = `pvp-live-${challengeId}`
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'player_ready' }, (payload) => {
        if (payload.payload?.userId !== user.id) {
          setOpponentReady(true)
        }
      })
      .on('broadcast', { event: 'game_start' }, () => {
        setPhase('countdown')
      })
      .on('broadcast', { event: 'progress' }, (payload) => {
        if (payload.payload?.userId !== user.id) {
          const p = { score: payload.payload.score, wordsCompleted: payload.payload.wordsCompleted, wordIndex: payload.payload.wordIndex }
          opponentProgressRef.current = p
          setOpponentProgress(p)
        }
      })
      .on('broadcast', { event: 'game_end' }, (payload) => {
        if (payload.payload?.userId !== user.id) {
          const p = { score: payload.payload.score, wordsCompleted: payload.payload.wordsCompleted }
          opponentProgressRef.current = p
          setOpponentProgress(p)
          setOpponentFinished(true)
        }
      })
      .subscribe((status) => {
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting')
      })

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [challengeId, user.id])

  // When both players ready, challenger sends game_start
  useEffect(() => {
    if (myReady && opponentReady && isChallenger && phase === 'lobby') {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_start',
        payload: {},
      })
      setPhase('countdown')
    }
  }, [myReady, opponentReady, isChallenger, phase])

  // When opponent sends game_start (non-challenger receives it)
  // Already handled in the channel listener above

  // Countdown timer
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('playing')
      return
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, countdown])

  const handleReady = useCallback(() => {
    setMyReady(true)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'player_ready',
      payload: { userId: user.id },
    })
  }, [user.id])

  const handleProgressUpdate = useCallback((progress) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'progress',
      payload: { userId: user.id, ...progress },
    })
  }, [user.id])

  const handleGameEnd = useCallback(async (score, extras) => {
    myScoreRef.current = score
    setMyScore(score)

    // Broadcast final score
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_end',
      payload: { userId: user.id, score, wordsCompleted: extras?.wordsCompleted || 0 },
    })

    // Save to DB
    try {
      const opScore = opponentProgressRef.current.score
      if (isChallenger) {
        // Challenger writes their score
        await supabase.from('pvp_challenges').update({
          challenger_score: score,
          status: opponentFinished ? 'completed' : 'in_progress',
          ...(opponentFinished ? {
            opponent_score: opScore,
            winner_id: score > opScore ? user.id : score < opScore ? null : null,
          } : {}),
        }).eq('id', challengeId)
      } else {
        // Opponent writes their score and determines winner
        const { data: fresh } = await supabase.from('pvp_challenges')
          .select('challenger_score').eq('id', challengeId).single()
        const challengerScore = fresh?.challenger_score ?? opScore
        const winner = score > challengerScore ? user.id : score < challengerScore ? null : null
        // Need challenger_id if they lost
        const { data: challengeData } = await supabase.from('pvp_challenges')
          .select('challenger_id').eq('id', challengeId).single()

        const winnerId = score > challengerScore ? user.id
          : score < challengerScore ? challengeData?.challenger_id
          : null

        await supabase.from('pvp_challenges').update({
          opponent_score: score,
          winner_id: winnerId,
          status: 'completed',
        }).eq('id', challengeId)
      }

      // Award pet XP
      if (activePet?.id) {
        playWithPet(activePet.id).catch(() => {})
      }
    } catch (err) {
      console.error('Error saving realtime PvP result:', err)
    }

    setPhase('done')
    if (onComplete) onComplete(score)
  }, [user.id, isChallenger, challengeId, opponentFinished, activePet, playWithPet, onComplete])

  const opponentName = opponent?.full_name?.split(' ').pop() || 'Opponent'

  // Lobby phase
  if (phase === 'lobby') {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-8 text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 rounded-full p-2 hover:bg-white/30 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>

          <h2 className="text-2xl font-black text-white mb-2" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Live Word Type Battle
          </h2>
          <p className="text-white/60 text-sm mb-6">Both players type the same words at the same time!</p>

          {/* Connection status */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {connectionStatus === 'connected'
              ? <><Wifi className="w-4 h-4 text-green-400" /><span className="text-green-400 text-xs font-bold">Connected</span></>
              : <><WifiOff className="w-4 h-4 text-yellow-400 animate-pulse" /><span className="text-yellow-400 text-xs font-bold">Connecting...</span></>
            }
          </div>

          {/* Player avatars */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="flex flex-col items-center gap-2">
              {petImageUrl && <img src={petImageUrl} alt={petName} className="w-16 h-16 object-contain drop-shadow-lg" />}
              <span className="text-white font-bold text-sm">{petName}</span>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${myReady ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                {myReady ? 'Ready!' : 'Not Ready'}
              </div>
            </div>

            <span className="text-3xl font-black text-white/30">VS</span>

            <div className="flex flex-col items-center gap-2">
              {pvpOpponentPetUrl
                ? <img src={pvpOpponentPetUrl} alt={opponentName} className="w-16 h-16 object-contain drop-shadow-lg" style={{ transform: 'scaleX(-1)' }} />
                : <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl">?</div>
              }
              <span className="text-white font-bold text-sm">{opponentName}</span>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${opponentReady ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                {opponentReady ? 'Ready!' : 'Waiting...'}
              </div>
            </div>
          </div>

          {!myReady ? (
            <button
              onClick={handleReady}
              disabled={connectionStatus !== 'connected'}
              className="w-full py-4 bg-white text-indigo-700 rounded-full font-bold text-xl shadow-xl hover:scale-105 active:scale-95 transition-transform border-b-4 border-indigo-200 disabled:opacity-50 disabled:hover:scale-100"
            >
              Ready!
            </button>
          ) : (
            <div className="text-white/60 text-sm animate-pulse">
              Waiting for {opponentName} to be ready...
            </div>
          )}
        </div>
      </div>,
      document.body
    )
  }

  // Countdown phase
  if (phase === 'countdown') {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 text-lg mb-4">Battle starts in...</p>
          <div
            className="text-9xl font-black text-white drop-shadow-2xl"
            key={countdown}
            style={{ animation: 'typeScorePopIn 0.8s ease-out' }}
          >
            {countdown > 0 ? countdown : 'GO!'}
          </div>
          <style>{`
            @keyframes typeScorePopIn {
              0% { transform: scale(0); opacity: 0; }
              70% { transform: scale(1.15); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      </div>,
      document.body
    )
  }

  // Playing phase - render PetWordType with realtime props
  if (phase === 'playing') {
    return (
      <PetWordType
        petImageUrl={petImageUrl}
        petName={petName}
        onGameEnd={handleGameEnd}
        onClose={onClose}
        hideClose={true}
        initialWords={gameWords}
        onProgressUpdate={handleProgressUpdate}
        opponentProgress={opponentProgress}
        isRealtimePvP={true}
        pvpOpponentPetUrl={pvpOpponentPetUrl}
        chestEnabled={false}
      />
    )
  }

  // Done phase - handled by PetWordType results screen via onGameEnd
  return null
}

export default PvPRealtimeWordType
