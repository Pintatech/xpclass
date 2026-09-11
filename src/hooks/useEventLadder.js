import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase/client'
import { LADDER_DAYS, eventDay, ladderState, stageFor, stageMonster } from '../config/eventLadder'

/**
 * One student's climb through the seven-day ladder.
 *
 * The rules of the ladder are in src/config/eventLadder.js; all this hook does
 * is hold which stages that student has cleared and hand the dashboard the
 * derived state. A cleared stage is remembered forever, so the week can be
 * paused, resumed, or finished late without losing anyone's place.
 *
 * Staff pass both overrides: they need to reach any day of the week to check it,
 * not just the one the calendar and their own progress allow.
 */
export const useEventLadder = (userId, { ignoreCalendar = false, ignoreOrder = false } = {}) => {
  const [cleared, setCleared] = useState([]) // day numbers, in no order
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setCleared([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('event_stage_clears')
      .select('stage, clears')
      .eq('user_id', userId)
      .gt('clears', 0)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Error loading event ladder:', error)
        setCleared((data || []).map((row) => row.stage))
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  const day = eventDay()
  const stages = useMemo(
    () => ladderState(cleared, new Date(), undefined, { ignoreCalendar, ignoreOrder }),
    [cleared, ignoreCalendar, ignoreOrder]
  )
  // The stage the ladder is pointing at: the first uncleared one, if its day has
  // come. Null once the week is finished, or before day 1.
  const current = useMemo(() => stages.find((s) => s.current) || null, [stages])
  const clearedCount = cleared.length

  /**
   * Bank a won stage. Returns whether it was the first clear, which is what
   * decides the size of the reward — the database settles that, not the caller,
   * so two devices cannot both claim the first.
   */
  const recordClear = useCallback(async (stage) => {
    if (!userId || !stage) return { first_clear: false, clears: 0 }

    const { data, error } = await supabase.rpc('record_event_stage_clear', { p_stage: stage })

    if (error) {
      console.error('Error recording event stage clear:', error)
      // The fight was won even if the write failed; treat it as a repeat so a
      // failure cannot hand out the first-clear reward twice.
      return { first_clear: false, clears: 0 }
    }

    setCleared((prev) => (prev.includes(stage) ? prev : [...prev, stage]))
    return data || { first_clear: false, clears: 0 }
  }, [userId])

  return {
    loading,
    day,
    ignoreCalendar,
    ignoreOrder,
    stages,
    current,
    clearedCount,
    totalDays: LADDER_DAYS,
    finished: clearedCount >= LADDER_DAYS,
    stageFor,
    stageMonster,
    recordClear
  }
}

export default useEventLadder
