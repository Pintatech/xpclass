import { useState, useEffect } from 'react'
import { Trophy, Gamepad2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTournament } from '../../hooks/useTournament'
import TournamentBracket from '../admin/TournamentBracket'

const CLIP_CARD = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'

const CornerBrackets = () => (
  <>
    <div className="absolute top-0 left-[10px] w-5 h-[1px] bg-gradient-to-r from-purple-300/40 to-transparent" />
    <div className="absolute top-0 left-[10px] w-[1px] h-5 bg-gradient-to-b from-purple-300/40 to-transparent" />
    <div className="absolute bottom-0 right-[10px] w-5 h-[1px] bg-gradient-to-l from-purple-300/40 to-transparent" />
    <div className="absolute bottom-0 right-[10px] w-[1px] h-5 bg-gradient-to-t from-purple-300/40 to-transparent" />
  </>
)

const GAME_TYPE_LABELS = {
  wordtype: 'Word Type',
  scramble: 'Word Scramble',
  matchgame: 'Match Game',
  whackmole: 'Whack-a-Mole',
  astroblast: 'Astro Blast',
  flappy: 'Flappy',
  sayitright: 'Say It Right',
  quizrush: 'Quiz Rush',
}

const InlineBracket = ({ tournamentId }) => {
  const { tournament, participants, matches, fetchTournament, loading } = useTournament()

  useEffect(() => {
    if (tournamentId) fetchTournament(tournamentId)
  }, [tournamentId, fetchTournament])

  if (loading && !tournament) {
    return <div className="text-center text-gray-400 py-6 text-sm">Đang tải...</div>
  }

  if (!tournament) return null

  return (
    <div className="bg-white border border-purple-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-gray-800">{tournament.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-purple-600 font-medium">
            <Gamepad2 className="w-3 h-3 inline mr-0.5" />
            {GAME_TYPE_LABELS[tournament.game_type] || tournament.game_type}
          </span>
          <span className="text-[10px] text-gray-500">
            Vòng {tournament.current_round}/{tournament.total_rounds}
          </span>
        </div>
      </div>

      {/* Bracket */}
      <div className="overflow-x-auto">
        <TournamentBracket
          matches={matches}
          participants={participants}
          totalRounds={tournament.total_rounds}
          currentRound={tournament.current_round}
          compact
        />
      </div>
    </div>
  )
}

const TournamentWidget = () => {
  const { user } = useAuth()
  const { fetchMyTournaments } = useTournament()
  const [activeTournaments, setActiveTournaments] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetchMyTournaments(user.id).then(data => {
      if (!cancelled) {
        setActiveTournaments(data || [])
        setLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [user?.id, fetchMyTournaments])

  if (!loaded) return null

  if (activeTournaments.length === 0) {
    return (
      <div className="relative bg-white border border-gray-200 p-6 h-full overflow-hidden shadow-sm"
        style={{ clipPath: CLIP_CARD }}
      >
        <CornerBrackets />
        <h3 className="text-lg font-semibold text-gray-900 mb-1 uppercase tracking-wide">Giải đấu</h3>
        <div className="h-[2px] w-16 bg-gradient-to-r from-purple-400 to-transparent mb-4" />
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 mx-auto mb-2 text-purple-300" />
          <div className="text-sm font-bold text-purple-700">Giải đấu mới sắp bắt đầu!</div>
          <div className="text-xs text-gray-500 mt-1">Hãy luyện tập thật nhiều để sẵn sàng nhé</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-white border border-gray-200 p-6 h-full overflow-hidden shadow-sm"
      style={{ clipPath: CLIP_CARD }}
    >
      <CornerBrackets />
      <h3 className="text-lg font-semibold text-gray-900 mb-1 uppercase tracking-wide">Giải đấu</h3>
      <div className="h-[2px] w-16 bg-gradient-to-r from-purple-400 to-transparent mb-4" />
      <div className="space-y-4">
        {activeTournaments.map(t => (
          <InlineBracket key={t.id} tournamentId={t.id} />
        ))}
      </div>
    </div>
  )
}

export default TournamentWidget
