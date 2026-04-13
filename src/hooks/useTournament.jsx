import { useState, useCallback } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './useAuth'

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function useTournament() {
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [tournament, setTournament] = useState(null)
  const [participants, setParticipants] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)

  // Fetch all tournaments (admin list)
  const fetchTournaments = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*, creator:users!tournaments_created_by_fkey(full_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setTournaments(data || [])
    } catch (err) {
      console.error('fetchTournaments error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch single tournament with participants + matches
  const fetchTournament = useCallback(async (id) => {
    setLoading(true)
    try {
      const [tRes, pRes, mRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase
          .from('tournament_participants')
          .select('*, user:users!tournament_participants_user_fkey(id, full_name, avatar_url, xp, level)')
          .eq('tournament_id', id)
          .order('seed'),
        supabase
          .from('tournament_matches')
          .select('*')
          .eq('tournament_id', id)
          .order('round')
          .order('match_position'),
      ])
      if (tRes.error) throw tRes.error
      setTournament(tRes.data)
      setParticipants(pRes.data || [])
      setMatches(mRes.data || [])
      return { tournament: tRes.data, participants: pRes.data || [], matches: mRes.data || [] }
    } catch (err) {
      console.error('fetchTournament error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Create tournament with bracket
  const createTournament = useCallback(async ({ name, bracket_size, game_type, studentIds, round_rewards = {}, entry_fee = 0 }) => {
    const total_rounds = Math.log2(bracket_size)
    // Use the order as provided (admin arranges matchups)
    const shuffled = studentIds

    // 0. Deduct entry fee (XP) from all participants
    if (entry_fee > 0) {
      for (const uid of shuffled) {
        const { data: u } = await supabase.from('users').select('xp, full_name').eq('id', uid).single()
        if (!u || (u.xp || 0) < entry_fee) {
          throw new Error(`${u?.full_name || 'Học sinh'} không đủ ${entry_fee} XP (hiện có ${u?.xp || 0})`)
        }
      }
      for (const uid of shuffled) {
        const { data: u } = await supabase.from('users').select('xp').eq('id', uid).single()
        await supabase.from('users').update({ xp: (u.xp || 0) - entry_fee }).eq('id', uid)
      }
    }

    // 1. Insert tournament
    const { data: t, error: tErr } = await supabase.from('tournaments').insert({
      name,
      bracket_size,
      game_type,
      total_rounds,
      current_round: 1,
      status: 'active',
      created_by: user.id,
      round_rewards,
      entry_fee,
    }).select().single()
    if (tErr) throw tErr

    // 2. Insert participants with seeds
    const participantRows = shuffled.map((uid, i) => ({
      tournament_id: t.id,
      user_id: uid,
      seed: i + 1,
    }))
    const { error: pErr } = await supabase.from('tournament_participants').insert(participantRows)
    if (pErr) throw pErr

    // 3. Generate all match slots
    const allMatches = []

    // Round 1: pair up adjacent seeds
    const r1Count = bracket_size / 2
    for (let i = 0; i < r1Count; i++) {
      allMatches.push({
        tournament_id: t.id,
        round: 1,
        match_position: i,
        player1_id: shuffled[i * 2],
        player2_id: shuffled[i * 2 + 1],
        status: 'ready',
      })
    }

    // Rounds 2..total_rounds: empty placeholder matches
    for (let r = 2; r <= total_rounds; r++) {
      const matchCount = bracket_size / Math.pow(2, r)
      for (let i = 0; i < matchCount; i++) {
        allMatches.push({
          tournament_id: t.id,
          round: r,
          match_position: i,
          status: 'pending',
        })
      }
    }

    const { error: mErr } = await supabase.from('tournament_matches').insert(allMatches)
    if (mErr) throw mErr

    return t
  }, [user])

  // Record a match result
  const recordMatchResult = useCallback(async (matchId, { player1_score, player2_score, winner_id }) => {
    // Update match
    const { error: mErr } = await supabase.from('tournament_matches').update({
      player1_score,
      player2_score,
      winner_id,
      status: 'completed',
      updated_at: new Date().toISOString(),
    }).eq('id', matchId)
    if (mErr) throw mErr

    // Find the match to get loser
    const { data: match } = await supabase.from('tournament_matches')
      .select('tournament_id, round, player1_id, player2_id')
      .eq('id', matchId)
      .single()

    if (match) {
      const loserId = match.player1_id === winner_id ? match.player2_id : match.player1_id
      // Mark loser as eliminated
      await supabase.from('tournament_participants')
        .update({ eliminated_in_round: match.round })
        .eq('tournament_id', match.tournament_id)
        .eq('user_id', loserId)
    }
  }, [])

  // Advance to next round
  const advanceRound = useCallback(async (tournamentId) => {
    // Fetch tournament
    const { data: t } = await supabase.from('tournaments')
      .select('*').eq('id', tournamentId).single()
    if (!t) throw new Error('Tournament not found')

    const currentRound = t.current_round

    // Check all matches in current round are completed
    const { data: currentMatches } = await supabase.from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentRound)
      .order('match_position')

    const allCompleted = currentMatches?.every(m => m.status === 'completed')
    if (!allCompleted) throw new Error('Not all matches in current round are completed')

    // If this was the final round, complete the tournament
    if (currentRound >= t.total_rounds) {
      const finalMatch = currentMatches[0]
      // Award rewards
      await distributeTournamentRewards(tournamentId, finalMatch.winner_id, t)
      // Update tournament
      await supabase.from('tournaments').update({
        status: 'completed',
        winner_id: finalMatch.winner_id,
        current_round: currentRound,
        updated_at: new Date().toISOString(),
      }).eq('id', tournamentId)
      return { completed: true, winner_id: finalMatch.winner_id }
    }

    // Feed winners into next round
    const nextRound = currentRound + 1
    for (const match of currentMatches) {
      const nextPos = Math.floor(match.match_position / 2)
      const isPlayer1 = match.match_position % 2 === 0

      const updateField = isPlayer1 ? 'player1_id' : 'player2_id'
      await supabase.from('tournament_matches')
        .update({
          [updateField]: match.winner_id,
          updated_at: new Date().toISOString(),
        })
        .eq('tournament_id', tournamentId)
        .eq('round', nextRound)
        .eq('match_position', nextPos)
    }

    // Check if next round matches now have both players → set to 'ready'
    const { data: nextMatches } = await supabase.from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound)

    for (const nm of (nextMatches || [])) {
      if (nm.player1_id && nm.player2_id) {
        await supabase.from('tournament_matches')
          .update({ status: 'ready', updated_at: new Date().toISOString() })
          .eq('id', nm.id)
      }
    }

    // Increment current round
    await supabase.from('tournaments').update({
      current_round: nextRound,
      updated_at: new Date().toISOString(),
    }).eq('id', tournamentId)

    return { completed: false, nextRound }
  }, [])

  // Distribute rewards based on round_rewards JSON
  // Format: { "1": { "xp": 10, "gems": 2, "item_id": "...", "item_quantity": 1, "chest_id": "..." }, ... , "winner": { ... } }
  // Key = eliminated_in_round, "winner" = champion
  const distributeTournamentRewards = async (tournamentId, winnerId, tournament) => {
    const rewards = tournament.round_rewards || {}

    const { data: allParticipants } = await supabase.from('tournament_participants')
      .select('user_id, eliminated_in_round')
      .eq('tournament_id', tournamentId)

    for (const p of (allParticipants || [])) {
      const key = p.user_id === winnerId ? 'winner' : String(p.eliminated_in_round || 1)
      const r = rewards[key] || {}
      const xpReward = r.xp || 0
      const gemReward = r.gems || 0

      // Grant XP + Gems
      if (xpReward > 0 || gemReward > 0) {
        const { data: u } = await supabase.from('users').select('xp, gems').eq('id', p.user_id).single()
        if (u) {
          await supabase.from('users').update({
            xp: (u.xp || 0) + xpReward,
            gems: (u.gems || 0) + gemReward,
          }).eq('id', p.user_id)
        }
      }

      // Grant collectible item
      if (r.item_id) {
        const qty = r.item_quantity || 1
        const { data: uName } = await supabase.from('users').select('full_name').eq('id', p.user_id).single()
        const { data: itemInfo } = await supabase.from('collectible_items').select('name').eq('id', r.item_id).single()
        const { data: existing } = await supabase.from('user_inventory')
          .select('id, quantity')
          .eq('user_id', p.user_id)
          .eq('item_id', r.item_id)
          .single()
        if (existing) {
          await supabase.from('user_inventory')
            .update({ quantity: existing.quantity + qty, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase.from('user_inventory').insert({
            user_id: p.user_id,
            user_name: uName?.full_name,
            item_id: r.item_id,
            item_name: itemInfo?.name,
            quantity: qty,
          })
        }
      }

      // Grant chest
      if (r.chest_id) {
        await supabase.from('user_chests').insert({
          user_id: p.user_id,
          chest_id: r.chest_id,
          source: 'tournament',
          source_ref: tournamentId,
        })
      }
    }
  }

  // Check training_scores to auto-resolve ready matches
  const checkMatchScores = useCallback(async (tournamentId) => {
    // Fetch tournament + its ready matches
    const { data: t } = await supabase.from('tournaments')
      .select('*').eq('id', tournamentId).single()
    if (!t || t.status !== 'active') return { updated: 0 }

    const { data: readyMatches } = await supabase.from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'ready')

    if (!readyMatches?.length) return { updated: 0 }

    let updated = 0

    for (const match of readyMatches) {
      if (!match.player1_id || !match.player2_id) continue

      // Get best score for each player for this game_type, played after the match became ready
      const since = match.updated_at || match.created_at

      const [p1Res, p2Res] = await Promise.all([
        supabase.from('training_scores')
          .select('score')
          .eq('user_id', match.player1_id)
          .eq('game_type', t.game_type)
          .gte('played_at', since)
          .gt('score', 0)
          .order('score', { ascending: false })
          .limit(1),
        supabase.from('training_scores')
          .select('score')
          .eq('user_id', match.player2_id)
          .eq('game_type', t.game_type)
          .gte('played_at', since)
          .gt('score', 0)
          .order('score', { ascending: false })
          .limit(1),
      ])

      const p1Best = p1Res.data?.[0]?.score
      const p2Best = p2Res.data?.[0]?.score

      // Both must have played
      if (p1Best == null || p2Best == null) continue

      const winnerId = p1Best >= p2Best ? match.player1_id : match.player2_id
      await recordMatchResult(match.id, {
        player1_score: p1Best,
        player2_score: p2Best,
        winner_id: winnerId,
      })
      updated++
    }

    return { updated }
  }, [recordMatchResult])

  // Delete tournament
  const deleteTournament = useCallback(async (id) => {
    const { error } = await supabase.from('tournaments').delete().eq('id', id)
    if (error) throw error
  }, [])

  // Fetch tournaments for a student
  const fetchMyTournaments = useCallback(async (userId) => {
    const { data: myEntries } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', userId)

    if (!myEntries?.length) return []

    const ids = myEntries.map(e => e.tournament_id)
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .in('id', ids)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    return data || []
  }, [])

  return {
    tournaments,
    tournament,
    participants,
    matches,
    loading,
    fetchTournaments,
    fetchTournament,
    createTournament,
    recordMatchResult,
    advanceRound,
    deleteTournament,
    fetchMyTournaments,
    checkMatchScores,
  }
}
