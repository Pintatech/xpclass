import { useRef, useState, useEffect } from 'react'
import { Trophy, User, Minus } from 'lucide-react'

// ─── Countdown to 10 PM ─────────────────────────────────────
const useCountdownTo10PM = () => {
  const getRemaining = () => {
    const now = new Date()
    const target = new Date(now)
    target.setHours(22, 0, 0, 0)
    if (now >= target) target.setDate(target.getDate() + 1)
    return Math.max(0, Math.floor((target - now) / 1000))
  }

  const [seconds, setSeconds] = useState(getRemaining)

  useEffect(() => {
    const id = setInterval(() => setSeconds(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [])

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const ROUND_LABELS = {
  1: { 1: 'Chung kết', 2: 'Bán kết', 3: 'Tứ kết', 4: 'Vòng 1' },
}

function getRoundLabel(round, totalRounds) {
  const fromFinal = totalRounds - round
  if (fromFinal === 0) return 'Chung kết'
  if (fromFinal === 1) return 'Bán kết'
  if (fromFinal === 2) return 'Tứ kết'
  return `Vòng ${round}`
}

const shortName = (fullName) => fullName?.split(' ').pop() || fullName

const PlayerRow = ({ player, score, isWinner, participants, currentUserId }) => {
  const p = participants?.find(pp => pp.user_id === player)
  const name = shortName(p?.user?.full_name) || 'TBD'
  const avatar = p?.user?.avatar_url
  const seed = p?.seed
  const isCurrentUser = currentUserId && player === currentUserId

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 ${isWinner ? 'bg-green-50' : isCurrentUser ? 'bg-purple-50' : ''}`}>
      {avatar ? (
        <img src={avatar} alt="" className={`w-6 h-6 rounded-full object-cover flex-shrink-0 ${isCurrentUser ? 'ring-2 ring-purple-400' : ''}`} />
      ) : (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isCurrentUser ? 'bg-purple-200 ring-2 ring-purple-400' : 'bg-gray-200'}`}>
          {player ? <User className={`w-3 h-3 ${isCurrentUser ? 'text-purple-500' : 'text-gray-400'}`} /> : <Minus className="w-3 h-3 text-gray-300" />}
        </div>
      )}
      <span className={`text-xs truncate flex-1 ${isWinner ? 'font-bold text-green-700' : isCurrentUser ? 'font-bold text-purple-700' : player ? 'text-gray-700' : 'text-gray-400 italic'}`}>
        {player ? name : 'TBD'}
        {seed && <span className="text-[10px] text-gray-400 ml-1">#{seed}</span>}
      </span>
      {score != null && (
        <span className={`text-xs font-mono font-bold ${isWinner ? 'text-green-600' : 'text-gray-500'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

const MatchCard = ({ match, participants, onRecordScore, compact, currentUserId }) => {
  const statusColors = {
    pending: 'border-gray-200 bg-gray-50',
    ready: 'border-amber-300 bg-amber-50',
    completed: 'border-green-300 bg-white',
  }

  return (
    <div className={`border-2 rounded-lg overflow-hidden ${statusColors[match.status] || statusColors.pending} ${compact ? 'w-36' : 'w-44'}`}>
      <PlayerRow
        player={match.player1_id}
        score={match.player1_score}
        isWinner={match.winner_id && match.winner_id === match.player1_id}
        participants={participants}
        currentUserId={currentUserId}
      />
      <div className="border-t border-gray-200" />
      <PlayerRow
        player={match.player2_id}
        score={match.player2_score}
        isWinner={match.winner_id && match.winner_id === match.player2_id}
        participants={participants}
        currentUserId={currentUserId}
      />
      {onRecordScore && (match.status === 'ready' || match.status === 'completed') && (
        <button
          onClick={() => onRecordScore(match)}
          className="w-full text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 py-1 transition-colors"
        >
          {match.status === 'completed' ? 'Sửa điểm' : 'Nhập điểm'}
        </button>
      )}
    </div>
  )
}

const TournamentBracket = ({ matches, participants, totalRounds, currentRound, onRecordScore, compact, currentUserId }) => {
  const countdown = useCountdownTo10PM()
  const roundRefs = useRef({})
  const scrollToRound = (roundNum) => {
    roundRefs.current[roundNum]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  // Group matches by round
  const rounds = []
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push(
      matches
        .filter(m => m.round === r)
        .sort((a, b) => a.match_position - b.match_position)
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      {/* Desktop: horizontal bracket */}
      <div className="hidden md:flex gap-4 items-stretch min-w-max p-4">
        {rounds.map((roundMatches, rIdx) => {
          const roundNum = rIdx + 1
          const matchSpacing = Math.pow(2, rIdx)
          return (
            <div key={roundNum} ref={el => roundRefs.current[roundNum] = el} className="flex flex-col items-center">
              <button
                onClick={() => scrollToRound(roundNum)}
                className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 hover:text-purple-600 transition-colors cursor-pointer"
              >
                {getRoundLabel(roundNum, totalRounds)}
                {roundNum === currentRound && (
                  <span className="ml-1.5 text-[10px] font-mono font-semibold text-red-500 normal-case">
                    ⏳ {countdown}
                  </span>
                )}
              </button>
              <div className="flex flex-col justify-around flex-1" style={{ gap: `${matchSpacing * 16}px` }}>
                {roundMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    participants={participants}
                    onRecordScore={onRecordScore}
                    compact={compact}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Winner display */}
        {matches.some(m => m.round === totalRounds && m.winner_id) && (() => {
          const finalMatch = matches.find(m => m.round === totalRounds)
          const winner = participants.find(p => p.user_id === finalMatch?.winner_id)
          return (
            <div className="flex flex-col items-center justify-center ml-2">
              <div className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-3">
                Nhà vô địch
              </div>
              <div className="bg-gradient-to-br from-yellow-100 to-amber-100 border-2 border-yellow-400 rounded-xl p-3 text-center shadow-sm">
                <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-1" />
                {winner?.user?.avatar_url && (
                  <img src={winner.user.avatar_url} alt="" className="w-10 h-10 rounded-full mx-auto mb-1 border-2 border-yellow-400" />
                )}
                <div className="text-sm font-bold text-yellow-800">
                  {shortName(winner?.user?.full_name) || 'Winner'}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Mobile: stacked rounds */}
      <div className="md:hidden space-y-4 p-2">
        {rounds.map((roundMatches, rIdx) => {
          const roundNum = rIdx + 1
          return (
            <div key={roundNum} ref={el => roundRefs.current[`m${roundNum}`] = el}>
              <button
                onClick={() => roundRefs.current[`m${roundNum}`]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className={`text-xs font-bold uppercase tracking-wider mb-2 px-1 ${roundNum === currentRound ? 'text-blue-600' : 'text-gray-400'} hover:text-purple-600 transition-colors cursor-pointer`}
              >
                {getRoundLabel(roundNum, totalRounds)}
                {roundNum === currentRound && (
                  <>
                    <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium normal-case">
                      Đang diễn ra
                    </span>
                    <span className="ml-1.5 text-[10px] font-mono font-semibold text-red-500">
                      ⏳ {countdown}
                    </span>
                  </>
                )}
              </button>
              <div className="space-y-2">
                {roundMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    participants={participants}
                    onRecordScore={onRecordScore}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TournamentBracket
