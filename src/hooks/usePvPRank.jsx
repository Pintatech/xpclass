import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './useAuth'
import { useStudentLevels } from './useStudentLevels'

export const usePvPRank = () => {
  const { user, profile, fetchUserProfile } = useAuth()
  const { studentLevels } = useStudentLevels()

  const rankLevel = profile?.pvp_rank_level ?? 1
  const rankPoints = profile?.pvp_rank_points ?? 0
  const wins = profile?.pvp_wins ?? 0
  const losses = profile?.pvp_losses ?? 0

  const currentBadge = studentLevels?.find(l => l.level_number === rankLevel) || null
  const nextBadge = studentLevels?.find(l => l.level_number === rankLevel + 1) || null

  const claimRankedMatch = useCallback(async (gameType) => {
    const { data, error } = await supabase.rpc('claim_ranked_match', {
      p_user_id: user.id,
      p_game_type: gameType,
    })
    if (error) throw error
    return data && data.length > 0 ? data[0] : null
  }, [user?.id])

  const postRankedScore = useCallback(async (gameType, score) => {
    const { data, error } = await supabase.rpc('post_ranked_score', {
      p_user_id: user.id,
      p_game_type: gameType,
      p_score: score,
    })
    if (error) throw error
    return data
  }, [user?.id])

  const completeRankedMatch = useCallback(async (rankedMatchId, score) => {
    const { data, error } = await supabase.rpc('complete_ranked_match', {
      p_ranked_match_id: rankedMatchId,
      p_user_id: user.id,
      p_score: score,
    })
    if (error) throw error
    // Refresh profile so LP/level update on UI
    if (fetchUserProfile) fetchUserProfile(user.id).catch(() => {})
    return data && data.length > 0 ? data[0] : null
  }, [user?.id, fetchUserProfile])

  const forfeitRankedMatch = useCallback(async (rankedMatchId) => {
    const { data, error } = await supabase.rpc('forfeit_ranked_match', {
      p_ranked_match_id: rankedMatchId,
      p_user_id: user.id,
    })
    if (error) throw error
    if (fetchUserProfile) fetchUserProfile(user.id).catch(() => {})
    return data && data.length > 0 ? data[0] : null
  }, [user?.id, fetchUserProfile])

  return {
    rankLevel,
    rankPoints,
    wins,
    losses,
    currentBadge,
    nextBadge,
    claimRankedMatch,
    postRankedScore,
    completeRankedMatch,
    forfeitRankedMatch,
  }
}

export const useActiveSeason = () => {
  const [season, setSeason] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pvp_seasons')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    setSeason(data || null)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { season, loading, refresh }
}

export const useMyRankedHistory = (limit = 10) => {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('pvp_rank_history')
      .select(`
        id, delta, reason, old_level, new_level, old_points, new_points, created_at,
        ranked_match_id,
        ranked_match:ranked_matches!pvp_rank_history_ranked_match_id_fkey(
          player1_id, player2_id, winner_id, player1_score, player2_score, game_type,
          player1:users!ranked_matches_player1_id_fkey(id, full_name, avatar_url),
          player2:users!ranked_matches_player2_id_fkey(id, full_name, avatar_url)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    setHistory(data || [])
    setLoading(false)
  }, [user?.id, limit])

  useEffect(() => { refresh() }, [refresh])

  return { history, loading, refresh }
}

export const useMyWaitingRow = (gameType = null) => {
  const { user } = useAuth()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    let q = supabase
      .from('ranked_matches')
      .select('id, game_type, player1_score, created_at, expires_at')
      .eq('player1_id', user.id)
      .eq('status', 'waiting')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
    if (gameType) q = q.eq('game_type', gameType)
    const { data } = await q.maybeSingle()
    setRow(data || null)
    setLoading(false)
  }, [user?.id, gameType])

  useEffect(() => { refresh() }, [refresh])

  return { row, loading, refresh }
}
