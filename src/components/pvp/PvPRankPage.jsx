import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Swords,
  Trophy,
  TrendingUp,
  TrendingDown,
  Clock,
  Gift,
  Zap,
  Flame,
  Loader2,
} from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import {
  usePvPRank,
  useActiveSeason,
  useMyRankedHistory,
  useMyWaitingRow,
} from '../../hooks/usePvPRank'
import PvPRankBadge from './PvPRankBadge'
import RankedMatch from './RankedMatch'

const REASON_LABELS = {
  win: 'Win',
  loss: 'Loss',
  pair_cooldown: 'Pair cooldown',
  daily_cap: 'Daily cap',
  window_penalty: 'Window penalty',
  season_reset: 'Season reset',
}

const timeAgo = (iso) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const timeUntil = (iso) => {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m left`
  const h = Math.floor(m / 60)
  return `${h}h left`
}

const PvPRankPage = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { studentLevels } = useStudentLevels()
  const { rankLevel, rankPoints, wins, losses, currentBadge, nextBadge } = usePvPRank()
  const { season, loading: seasonLoading } = useActiveSeason()
  const { history, loading: historyLoading, refresh: refreshHistory } = useMyRankedHistory(10)
  const { row: waitingRow, loading: waitingLoading, refresh: refreshWaiting } = useMyWaitingRow()

  const [showRanked, setShowRanked] = useState(false)
  const [seasonRewards, setSeasonRewards] = useState([])
  const [rewardsLoading, setRewardsLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [finalRank, setFinalRank] = useState(null)

  const totalGames = wins + losses
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

  // Fetch reward bands for active season
  React.useEffect(() => {
    if (!season?.id) return
    let cancelled = false
    ;(async () => {
      setRewardsLoading(true)
      const { data } = await supabase
        .from('pvp_season_rewards')
        .select('*')
        .eq('season_id', season.id)
        .order('min_level', { ascending: false })
      if (!cancelled) {
        setSeasonRewards(data || [])
        setRewardsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [season?.id])

  // Check for unclaimed final ranks from previous seasons
  React.useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('pvp_season_final_ranks')
        .select('*, pvp_seasons(name)')
        .eq('user_id', user.id)
        .eq('rewards_claimed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) setFinalRank(data || null)
    })()
  }, [user?.id])

  const claimRewards = async () => {
    if (!finalRank || claiming) return
    setClaiming(true)
    try {
      const { error } = await supabase.rpc('claim_pvp_season_rewards', {
        p_season_id: finalRank.season_id,
        p_user_id: user.id,
      })
      if (error) throw error
      setFinalRank(null)
    } catch (e) {
      console.error('Failed to claim rewards:', e)
    } finally {
      setClaiming(false)
    }
  }

  const onMatchClose = () => {
    setShowRanked(false)
    refreshHistory()
    refreshWaiting()
  }

  const rankName = currentBadge?.badge_name || 'Unranked'
  const nextRankName = nextBadge?.badge_name || null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-gray-900 to-purple-900 border-b border-white/10 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Swords className="w-5 h-5 text-yellow-400" />
              Ranked Ladder
            </h1>
            {season && (
              <p className="text-xs text-white/60">
                {season.name} · Active since {new Date(season.started_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Unclaimed season rewards */}
        {finalRank && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/40 rounded-2xl p-4 flex items-center gap-3">
            <Gift className="w-8 h-8 text-yellow-300 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-yellow-100">
                Rewards waiting from {finalRank.pvp_seasons?.name}
              </div>
              <div className="text-xs text-yellow-100/80">
                You finished Level {finalRank.final_level} — {finalRank.wins}W / {finalRank.losses}L
              </div>
            </div>
            <button
              onClick={claimRewards}
              disabled={claiming}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 rounded-lg font-bold text-sm disabled:opacity-50"
            >
              {claiming ? 'Claiming…' : 'Claim'}
            </button>
          </div>
        )}

        {/* Current rank card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-6">
            <PvPRankBadge size="large" showName={false} showLP={false} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/60 uppercase tracking-wider mb-1">
                Current Rank
              </div>
              <div className="text-2xl font-bold truncate">{rankName}</div>
              <div className="text-sm text-white/70 mt-1">
                Level {rankLevel} · {rankPoints} LP
              </div>
              <div className="mt-3">
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, rankPoints))}%` }}
                  />
                </div>
                <div className="text-[11px] text-white/60 mt-1">
                  {nextRankName
                    ? `${100 - rankPoints} LP to ${nextRankName}`
                    : 'Max rank reached'}
                </div>
              </div>
            </div>
          </div>

          {/* W/L stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-green-400 text-xl font-bold">{wins}</div>
              <div className="text-[11px] text-white/60 uppercase">Wins</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-red-400 text-xl font-bold">{losses}</div>
              <div className="text-[11px] text-white/60 uppercase">Losses</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-yellow-400 text-xl font-bold">{winRate}%</div>
              <div className="text-[11px] text-white/60 uppercase">Win Rate</div>
            </div>
          </div>

          {/* Play button */}
          <button
            onClick={() => setShowRanked(true)}
            className="mt-6 w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-gray-900 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
          >
            <Swords className="w-5 h-5" />
            Play Ranked Match
          </button>
        </div>

        {/* Pending waiting row */}
        {waitingRow && !waitingLoading && (
          <div className="bg-blue-500/10 border border-blue-400/30 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-blue-100">
                  Waiting for an opponent
                </div>
                <div className="text-xs text-blue-100/80">
                  Your score of {waitingRow.player1_score} is posted · {timeUntil(waitingRow.expires_at)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Season rewards preview */}
        {season && seasonRewards.length > 0 && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h2 className="text-base font-bold">Season Rewards</h2>
            </div>
            <div className="space-y-2">
              {seasonRewards.map(reward => {
                const eligible = rankLevel >= reward.min_level && rankLevel <= reward.max_level
                return (
                  <div
                    key={reward.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      eligible
                        ? 'bg-yellow-400/10 border-yellow-400/40'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-white/80 w-16">
                      L{reward.min_level}–{reward.max_level}
                    </div>
                    <div className="flex-1 flex flex-wrap gap-3 text-xs">
                      {reward.xp_reward > 0 && (
                        <span className="flex items-center gap-1 text-blue-300">
                          <Zap className="w-3 h-3" /> {reward.xp_reward} XP
                        </span>
                      )}
                      {reward.gem_reward > 0 && (
                        <span className="flex items-center gap-1 text-purple-300">
                          💎 {reward.gem_reward}
                        </span>
                      )}
                      {reward.title_reward && (
                        <span className="text-yellow-200 font-semibold">
                          "{reward.title_reward}"
                        </span>
                      )}
                    </div>
                    {eligible && (
                      <div className="text-[10px] text-yellow-300 font-bold uppercase">
                        Eligible
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent matches */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-base font-bold">Recent Matches</h2>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-white/50" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-6 text-white/50 text-sm">
              No ranked matches yet. Play one to start climbing!
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(h => {
                const isWin = h.delta > 0
                const isDraw = h.delta === 0
                const match = h.ranked_match
                const iAmP1 = match?.player1_id === user?.id
                const opp = match ? (iAmP1 ? match.player2 : match.player1) : null
                const myScore = match ? (iAmP1 ? match.player1_score : match.player2_score) : null
                const oppScore = match ? (iAmP1 ? match.player2_score : match.player1_score) : null
                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      isWin
                        ? 'bg-green-500/10 border-green-400/20'
                        : isDraw
                        ? 'bg-gray-500/10 border-gray-400/20'
                        : 'bg-red-500/10 border-red-400/20'
                    }`}
                  >
                    {opp?.avatar_url ? (
                      <img
                        src={opp.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-white/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm">
                        {opp?.full_name?.[0] || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        vs {opp?.full_name || 'Opponent'}
                      </div>
                      <div className="text-[11px] text-white/60">
                        {myScore !== null && oppScore !== null
                          ? `${myScore} – ${oppScore} · `
                          : ''}
                        {REASON_LABELS[h.reason] || h.reason} · {timeAgo(h.created_at)}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1 font-bold text-sm ${
                        isWin
                          ? 'text-green-300'
                          : isDraw
                          ? 'text-gray-300'
                          : 'text-red-300'
                      }`}
                    >
                      {isWin ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : isDraw ? null : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {h.delta > 0 ? `+${h.delta}` : h.delta} LP
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showRanked && <RankedMatch onClose={onMatchClose} />}
    </div>
  )
}

export default PvPRankPage
