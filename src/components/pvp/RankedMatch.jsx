import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Trophy, Swords, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { usePet } from '../../hooks/usePet'
import { assetUrl } from '../../hooks/useBranding'
import { usePvPRank } from '../../hooks/usePvPRank'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import PvPRankBadge from './PvPRankBadge'
import PetWhackMole from '../pet/games/PetWhackMole'
import PetWordScramble from '../pet/games/PetWordScramble'
import PetAstroBlast from '../pet/games/PetAstroBlast'
import PetMatchGame from '../pet/games/PetMatchGame'
import PetFlappyGame from '../pet/games/PetFlappyGame'
import PetWordType from '../pet/games/PetWordType'
import PetSayItRight from '../pet/games/PetSayItRight'
import PetQuizRush from '../pet/games/PetQuizRush'
import PetAngryPet from '../pet/games/PetAngryPet'
import PetFishingGame from '../pet/games/PetFishingGame'

const GAME_LABELS = {
  wordtype: 'Word Type',
  scramble: 'Word Scramble',
  matchgame: 'Match Up',
  whackmole: 'Whack-a-Mole',
  astroblast: 'Astro Blast',
  flappy: 'Flappy Pet',
  sayitright: 'Say It Right',
  quizrush: 'Quiz Rush',
  angrypet: 'Angry Pet',
  fishing: 'Fishing',
}

const RankedMatch = ({ onClose }) => {
  const { user, profile } = useAuth()
  const { activePet, drainPetEnergy, userEnergy } = usePet()
  const { studentLevels } = useStudentLevels()
  const {
    rankLevel,
    rankPoints,
    currentBadge,
    claimRankedMatch,
    postRankedScore,
    completeRankedMatch,
  } = usePvPRank()

  const [phase, setPhase] = useState('loading') // loading | intro | playing | posted | result | error
  const [gameType, setGameType] = useState('wordtype')
  const [wordBank, setWordBank] = useState([])
  const [questionBank, setQuestionBank] = useState([])
  const [claimedRow, setClaimedRow] = useState(null) // row returned by claim_ranked_match
  const [opponent, setOpponent] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [myScore, setMyScore] = useState(null)

  const petImage = activePet?.image_url || assetUrl('/image/pet/default.png')
  const petName = activePet?.nickname || activePet?.name || 'Your Pet'

  // Initial flow: load game type, word bank, try to claim
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // Fetch configured game type
        const { data: setting } = await supabase.from('site_settings')
          .select('setting_value')
          .eq('setting_key', 'quickmatch_game_type')
          .single()
        const gt = setting?.setting_value || 'wordtype'
        if (cancelled) return
        setGameType(gt)

        // Fetch banks
        const [{ data: words }, { data: questions }] = await Promise.all([
          supabase.from('pet_word_bank')
            .select('word, hint, image_url, min_level')
            .eq('is_active', true)
            .lte('min_level', profile?.current_level || 1),
          supabase.from('pet_question_bank')
            .select('question, choices, answer_index, image_url, min_level')
            .eq('is_active', true)
            .lte('min_level', profile?.current_level || 1),
        ])
        if (cancelled) return
        setWordBank(words || [])
        setQuestionBank(questions || [])

        // Try to claim an existing waiting score
        const row = await claimRankedMatch(gt)
        if (cancelled) return

        if (row) {
          // Fetch opponent profile for display
          const { data: opp } = await supabase
            .from('users')
            .select('id, full_name, avatar_url, pvp_rank_level, pvp_rank_points')
            .eq('id', row.player1_id)
            .single()
          setClaimedRow(row)
          setOpponent(opp)
          setPhase('intro')
        } else {
          // No opponent — user will post a score
          setPhase('intro')
        }
      } catch (err) {
        console.error('Ranked init error:', err)
        setError(err.message || 'Failed to start ranked match')
        setPhase('error')
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const startGame = async () => {
    if ((userEnergy ?? 100) < 10) {
      alert('Your pet is too tired to battle! Feed your pet first.')
      return
    }
    await drainPetEnergy(10)
    setPhase('playing')
  }

  const handleGameEnd = async (score) => {
    setMyScore(score)
    try {
      if (claimedRow) {
        // We were claiming an existing row
        const res = await completeRankedMatch(claimedRow.id, score)
        setResult(res)
      } else {
        // We're posting a new score
        await postRankedScore(gameType, score)
      }
      setPhase(claimedRow ? 'result' : 'posted')
    } catch (err) {
      console.error('Error finalizing ranked match:', err)
      setError(err.message || 'Failed to save result')
      setPhase('error')
    }
  }

  // Render game (playing phase)
  const renderGame = () => {
    const scoreToBeat = claimedRow
      ? { score: claimedRow.player1_score, name: opponent?.full_name?.split(' ').pop() || 'Opponent' }
      : null
    const commonProps = {
      petImageUrl: petImage,
      petName,
      onClose: () => onClose(),
      hideClose: true,
      scoreToBeat,
    }
    switch (gameType) {
      case 'whackmole':
        return <PetWhackMole {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} leaderboard={scoreToBeat ? [scoreToBeat] : []} />
      case 'scramble':
        return <PetWordScramble {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} />
      case 'astroblast':
        return <PetAstroBlast {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} shipSkinUrl={profile?.active_spaceship_url} shipLaserColor={profile?.active_spaceship_laser} asteroidSkinUrls={[
          assetUrl('/pet-game/astro/alien1.png'),
          assetUrl('/pet-game/astro/alien2.png'),
          assetUrl('/pet-game/astro/alien3.png'),
          assetUrl('/pet-game/astro/alien4.png'),
          assetUrl('/pet-game/astro/alien5.png'),
          assetUrl('/pet-game/astro/alien6.png'),
        ]} />
      case 'matchgame':
        return <PetMatchGame {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} />
      case 'flappy':
        return <PetFlappyGame {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} isPvP />
      case 'wordtype':
        return <PetWordType {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} />
      case 'sayitright':
        return <PetSayItRight {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} />
      case 'quizrush':
        return <PetQuizRush {...commonProps} onGameEnd={handleGameEnd} questionBank={questionBank} />
      case 'angrypet':
        return <PetAngryPet {...commonProps} onGameEnd={handleGameEnd} questionBank={questionBank} />
      case 'fishing':
        return <PetFishingGame {...commonProps} onGameEnd={handleGameEnd} wordBank={wordBank} boatSkinUrl={profile?.active_boat_url} />
      default:
        return null
    }
  }

  if (phase === 'playing') return renderGame()

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 hover:bg-white shadow z-20">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Swords className="w-5 h-5" />
            <h2 className="text-xl font-bold">Ranked Match</h2>
          </div>
          <p className="text-xs text-white/70">{GAME_LABELS[gameType] || gameType}</p>
        </div>

        <div className="p-5 space-y-4">
          {phase === 'loading' && (
            <div className="text-center py-8">
              <div className="inline-block w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 mt-3">Finding opponents nearby...</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">😵</div>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button onClick={onClose} className="px-5 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold">Close</button>
            </div>
          )}

          {phase === 'intro' && claimedRow && opponent && (
            <IntroVsOpponent
              opponent={opponent}
              targetScore={claimedRow.player1_score}
              myLevel={rankLevel}
              myPoints={rankPoints}
              gameType={gameType}
              lpMultiplier={claimedRow.lp_multiplier}
              windowPenalty={claimedRow.window_penalty}
              onStart={startGame}
            />
          )}

          {phase === 'intro' && !claimedRow && (
            <IntroPostScore
              myLevel={rankLevel}
              myPoints={rankPoints}
              gameType={gameType}
              onStart={startGame}
            />
          )}

          {phase === 'posted' && (
            <PostedResult
              score={myScore}
              gameType={gameType}
              onClose={onClose}
            />
          )}

          {phase === 'result' && result && (
            <MatchResult
              result={result}
              myScore={myScore}
              opponent={opponent}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const IntroVsOpponent = ({ opponent, targetScore, myLevel, myPoints, gameType, lpMultiplier, windowPenalty, onStart }) => {
  const oppName = opponent?.full_name?.split(' ').pop() || 'Opponent'
  return (
    <>
      <div className="flex items-center justify-around gap-2">
        <div className="flex flex-col items-center">
          <PvPRankBadge size="medium" showName showLP level={myLevel} points={myPoints} />
          <span className="text-xs text-gray-500 mt-1">You</span>
        </div>
        <div className="text-3xl font-black text-red-500">VS</div>
        <div className="flex flex-col items-center">
          <PvPRankBadge
            size="medium"
            showName
            showLP
            level={opponent?.pvp_rank_level ?? 1}
            points={opponent?.pvp_rank_points ?? 0}
          />
          <span className="text-xs text-gray-500 mt-1 truncate max-w-[80px]">{oppName}</span>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-amber-800">
          <Trophy className="w-4 h-4" />
          <span className="text-sm font-bold">Beat this score: {targetScore}</span>
        </div>
        <p className="text-xs text-amber-700 mt-1">
          Score higher than {oppName} to win LP and climb the ranked ladder.
        </p>
      </div>

      {(lpMultiplier != null && lpMultiplier < 1) && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
          <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-orange-700">
            <strong>{Math.round(lpMultiplier * 100)}% LP on this match.</strong>
            {' '}
            {lpMultiplier === 0
              ? 'You already played this opponent too many times recently.'
              : windowPenalty
                ? 'This score has been waiting a long time — reduced LP.'
                : 'Pair cooldown active (you played this opponent recently).'}
          </div>
        </div>
      )}

      <button
        onClick={onStart}
        className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-bold text-sm hover:from-red-600 hover:to-orange-600 shadow-lg"
      >
        Start Ranked Match ⚔️
      </button>
    </>
  )
}

const IntroPostScore = ({ myLevel, myPoints, gameType, onStart }) => (
  <>
    <div className="flex justify-center">
      <PvPRankBadge size="large" showName showLP level={myLevel} points={myPoints} />
    </div>
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
      <p className="text-sm font-bold text-blue-800">No opponents nearby right now</p>
      <p className="text-xs text-blue-700 mt-1">
        Post your best score! When someone plays ranked near your level, they'll have to beat it.
        LP is applied when they finish.
      </p>
    </div>
    <button
      onClick={onStart}
      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-bold text-sm hover:from-indigo-600 hover:to-purple-600 shadow-lg"
    >
      Play Ranked ({GAME_LABELS[gameType] || gameType})
    </button>
  </>
)

const PostedResult = ({ score, gameType, onClose }) => (
  <div className="text-center space-y-3">
    <div className="text-4xl">📤</div>
    <p className="text-lg font-bold text-gray-800">Score Posted!</p>
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 inline-block">
      <div className="text-xs text-indigo-700">Your score</div>
      <div className="text-3xl font-black text-indigo-900">{score}</div>
    </div>
    <p className="text-xs text-gray-500 max-w-sm mx-auto">
      When another player at your rank queues for {GAME_LABELS[gameType] || gameType}, they'll play against your score. We'll notify you with the result.
    </p>
    <button onClick={onClose} className="mt-3 px-5 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold">Close</button>
  </div>
)

const MatchResult = ({ result, myScore, opponent, onClose }) => {
  const { studentLevels } = useStudentLevels()
  const won = result.winner_id && result.winner_id !== opponent?.id
  const tie = !result.winner_id
  const delta = result.my_delta ?? 0
  const newLevel = result.my_new_level ?? 1
  const newPoints = result.my_new_points ?? 0
  const prevBadge = studentLevels?.find(l => l.level_number === newLevel - 1)
  const newBadge = studentLevels?.find(l => l.level_number === newLevel)
  const promoted = delta > 0 && newBadge && prevBadge && result.my_new_level > (result.my_old_level ?? newLevel)

  return (
    <div className="text-center space-y-3">
      <div className="text-5xl">
        {won ? '🏆' : tie ? '🤝' : '😔'}
      </div>
      <p className="text-xl font-black">
        {won ? 'Victory!' : tie ? 'Draw' : 'Defeat'}
      </p>

      <div className="flex justify-around items-center bg-gray-50 rounded-lg p-3">
        <div>
          <div className="text-xs text-gray-500">You</div>
          <div className="text-2xl font-bold text-gray-900">{myScore}</div>
        </div>
        <div className="text-xl font-black text-red-400">VS</div>
        <div>
          <div className="text-xs text-gray-500">{opponent?.full_name?.split(' ').pop() || 'Opponent'}</div>
          <div className="text-2xl font-bold text-gray-900">{result.player1_score}</div>
        </div>
      </div>

      {!tie && (
        <div className={`rounded-lg p-3 border ${delta > 0 ? 'bg-green-50 border-green-200' : delta < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-center gap-2">
            {delta > 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : delta < 0 ? <TrendingDown className="w-5 h-5 text-red-600" /> : null}
            <span className={`text-lg font-black ${delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-gray-700'}`}>
              {delta > 0 ? '+' : ''}{delta} LP
            </span>
          </div>
          {result.lp_multiplier != null && result.lp_multiplier < 1 && delta !== 0 && (
            <p className="text-[11px] text-gray-500 mt-1">
              LP reduced: {Math.round(result.lp_multiplier * 100)}% multiplier
            </p>
          )}
          {promoted && (
            <p className="text-sm text-yellow-700 font-bold mt-2">
              🎉 Promoted to {newBadge.badge_name}!
            </p>
          )}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <PvPRankBadge size="medium" showName showLP level={newLevel} points={newPoints} />
      </div>

      <button onClick={onClose} className="mt-3 px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold">
        Done
      </button>
    </div>
  )
}

export default RankedMatch
