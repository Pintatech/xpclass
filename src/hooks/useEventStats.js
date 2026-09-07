import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase/client'
import {
  EMPTY_SPEND,
  MAX_LEVEL,
  battleXp,
  deriveStats,
  levelFromXp,
  pointsForLevel,
  pointsSpent
} from '../config/eventStats'

const EMPTY_ROW = { xp: 0, spent_hp: 0, spent_atk: 0, spent_def: 0, battles: 0, wins: 0 }

const toSpend = (row) => ({
  hp: row?.spent_hp || 0,
  atk: row?.spent_atk || 0,
  def: row?.spent_def || 0
})

/**
 * The stat sheet for one student's one character.
 *
 * Rows are created lazily: a student who has never fought a given character has
 * no row, and the level-1 defaults below stand in until the first battle writes
 * one. Every mutation goes through an RPC rather than an update, so the XP
 * arithmetic and the point budget are settled in the database — see
 * add_event_character_stats.sql.
 */
export const useEventStats = (userId, characterId) => {
  const [row, setRow] = useState(EMPTY_ROW)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // A battle can finish after the picker has moved on; a stale response must
  // not overwrite the character now on screen.
  const requestFor = useRef(null)

  useEffect(() => {
    requestFor.current = `${userId}:${characterId}`
    const key = requestFor.current

    if (!userId || !characterId) {
      setRow(EMPTY_ROW)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('event_character_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || requestFor.current !== key) return
        if (error) console.error('Error loading event character stats:', error)
        setRow(data || EMPTY_ROW)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId, characterId])

  const spend = useMemo(() => toSpend(row), [row])
  const level = useMemo(() => levelFromXp(row.xp), [row.xp])
  const stats = useMemo(() => deriveStats(characterId, spend), [characterId, spend])

  const totalPoints = pointsForLevel(level.level)
  const usedPoints = pointsSpent(spend)
  const availablePoints = Math.max(0, totalPoints - usedPoints)

  /** Pay out a finished battle. Returns how much XP it was worth. */
  const awardBattle = useCallback(async ({ won, correct, monster }) => {
    const amount = battleXp({ won, correct, monster })
    if (!userId || !characterId) return amount

    const key = `${userId}:${characterId}`
    const { data, error } = await supabase.rpc('award_event_character_xp', {
      p_character_id: characterId,
      p_xp: amount,
      p_won: Boolean(won)
    })

    if (error) console.error('Error awarding event xp:', error)
    else if (data && requestFor.current === key) setRow(Array.isArray(data) ? data[0] : data)

    return amount
  }, [userId, characterId])

  const spendPoint = useCallback(async (stat, amount = 1) => {
    if (!userId || !characterId || saving) return
    if (availablePoints < amount) return

    setSaving(true)
    // Show the point landing immediately; the RPC's row replaces it, and a
    // failure rolls it back.
    const optimistic = row
    setRow((r) => ({ ...r, [`spent_${stat}`]: (r[`spent_${stat}`] || 0) + amount }))

    const { data, error } = await supabase.rpc('spend_event_character_point', {
      p_character_id: characterId,
      p_stat: stat,
      p_amount: amount
    })

    if (error) {
      console.error('Error spending event stat point:', error)
      setRow(optimistic)
    } else if (data) {
      setRow(Array.isArray(data) ? data[0] : data)
    }
    setSaving(false)
  }, [userId, characterId, saving, availablePoints, row])

  const resetPoints = useCallback(async () => {
    if (!userId || !characterId || saving || usedPoints === 0) return
    setSaving(true)
    const { data, error } = await supabase.rpc('reset_event_character_points', {
      p_character_id: characterId
    })
    if (error) console.error('Error resetting event stat points:', error)
    else if (data) setRow(Array.isArray(data) ? data[0] : data)
    setSaving(false)
  }, [userId, characterId, saving, usedPoints])

  return {
    loading,
    saving,
    xp: row.xp || 0,
    battles: row.battles || 0,
    wins: row.wins || 0,
    spend,
    stats,
    ...level,
    isMaxLevel: level.level >= MAX_LEVEL,
    totalPoints,
    usedPoints,
    availablePoints,
    awardBattle,
    spendPoint,
    resetPoints
  }
}

export { EMPTY_SPEND }
export default useEventStats
