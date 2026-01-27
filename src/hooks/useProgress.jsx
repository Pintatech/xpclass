import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../supabase/client'
import { getVietnamDate, daysDifferenceVietnam } from '../utils/vietnamTime'

const ProgressContext = createContext({})

export const useProgress = () => {
  const context = useContext(ProgressContext)
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider')
  }
  return context
}

export const ProgressProvider = ({ children }) => {
  const { user, profile, fetchUserProfile } = useAuth()
  const [userProgress, setUserProgress] = useState([])
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchUserProgress()
      fetchUserAchievements()
    }
  }, [user])

  const fetchUserProgress = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_progress')
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq('user_id', user.id)

      if (error) throw error
      setUserProgress(data || [])
    } catch (error) {
      console.error('Error fetching user progress:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserAchievements = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', user.id)

      if (error) throw error
      setAchievements(data || [])
    } catch (error) {
      console.error('Error fetching user achievements:', error)
    }
  }

  const startExercise = async (exerciseId) => {
    if (!user) return { error: 'No user logged in' }

    try {
      // Check if exercise progress already exists
      const { data: existingProgress } = await supabase
        .from('user_progress')
        .select('id, first_attempt_at, status')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .maybeSingle()

      // Only create/update if no first_attempt_at exists
      if (!existingProgress?.first_attempt_at) {
        const { data, error } = await supabase
          .from('user_progress')
          .upsert({
            user_id: user.id,
            exercise_id: exerciseId,
            status: 'in_progress',
            first_attempt_at: new Date().toISOString(),
            attempts: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,exercise_id'
          })
          .select()

        if (error) throw error

        console.log('📝 Exercise started, tracking entry time:', exerciseId)
        return { data, error: null }
      } else {
        console.log('📝 Exercise already has entry time, skipping:', exerciseId)
        return { data: existingProgress, error: null }
      }
    } catch (error) {
      console.error('Error starting exercise:', error)
      return { data: null, error }
    }
  }

  const updateExerciseProgress = async (exerciseId, progressData) => {
    if (!user) return { error: 'No user logged in' }

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          exercise_id: exerciseId,
          ...progressData,
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) throw error

      // Update local state
      await fetchUserProgress()

      // Check for achievements
      await checkAndAwardAchievements(progressData)

      return { data, error: null }
    } catch (error) {
      console.error('Error updating exercise progress:', error)
      return { data: null, error }
    }
  }

  const isExerciseCompleted = (exerciseId) => {
    return userProgress.some(progress => 
      progress.exercise_id === exerciseId && progress.status === 'completed'
    )
  }

  const addXP = async (xpAmount) => {
    if (!user || !profile) return

    try {
      const newXP = (profile.xp || 0) + xpAmount
      const newLevel = calculateLevel(newXP)

      // Try update xp + level; if 'level' column is missing, retry with only xp
      let { error } = await supabase
        .from('users')
        .update({
          xp: newXP,
          level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        console.warn('Primary users update failed, retrying without level:', error?.message)
        const retry = await supabase
          .from('users')
          .update({
            xp: newXP,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
        if (retry.error) throw retry.error
      }

      // Refresh profile
      await fetchUserProfile(user.id)

      return { xp: newXP, level: newLevel }
    } catch (error) {
      console.error('Error adding XP:', error)
      return null
    }
  }

  const completeExerciseWithXP = async (exerciseId, xpReward, progressData = {}) => {
    if (!user) return { error: 'No user logged in' }

    console.log('🎯 completeExerciseWithXP called for exercise:', exerciseId)

    const isAlreadyCompleted = isExerciseCompleted(exerciseId)
    console.log('Exercise already completed:', isAlreadyCompleted)

    // Always check daily quest first, regardless of completion status
    await checkDailyQuestCompletion(exerciseId)

    // Allow retries - don't block if already completed
    // We'll still track attempts and update progress
    if (isAlreadyCompleted) {
      console.log('Exercise already completed, but allowing retry for attempts tracking')
    }

    // Check if score meets minimum requirement (75%)
    const score = progressData.score || 0
    const meetingRequirement = score >= 75

    console.log(`📊 Score: ${score}% - ${meetingRequirement ? 'PASSED' : 'FAILED'} (requirement: 75%)`)

    try {
      // Determine status based on score
      const currentStatus = meetingRequirement ? 'completed' : 'attempted'

      // Get existing progress from database to calculate attempts accurately
      console.log(`🔍 Fetching existing progress for user ${user.id}, exercise ${exerciseId}`)
      const { data: existingProgressData, error: fetchError } = await supabase
        .from('user_progress')
        .select('attempts, first_attempt_at, status, completed_at, score, max_score')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .maybeSingle()

      console.log('📋 Existing progress data:', existingProgressData)
      console.log('📋 Fetch error:', fetchError)

      const currentAttempts = existingProgressData?.attempts || 0
      const newAttempts = currentAttempts + 1
      console.log(`🔄 Attempt tracking: current=${currentAttempts}, new=${newAttempts}`)

      // Determine best score and status
      let finalStatus = currentStatus
      let finalCompletedAt = meetingRequirement ? new Date().toISOString() : null
      let finalScore = progressData.score || 0
      let finalMaxScore = progressData.max_score || 0

      // If already completed, keep completed status unless new score is better
      if (existingProgressData?.status === 'completed') {
        const existingScorePercent = existingProgressData.max_score ?
          (existingProgressData.score / existingProgressData.max_score) * 100 : 0
        const newScorePercent = finalMaxScore ? (finalScore / finalMaxScore) * 100 : 0

        // Keep completed status and best score
        if (existingScorePercent >= newScorePercent) {
          finalStatus = 'completed'
          finalCompletedAt = existingProgressData.completed_at
          finalScore = existingProgressData.score
          finalMaxScore = existingProgressData.max_score
          console.log('📊 Keeping existing better score and completed status')
        } else {
          console.log('📊 New score is better, updating to new score')
        }
      }

      // Sanitize client-provided progress data (remove columns not present in DB)
      const { xp_earned: _omitXpEarned, attempts: _omitAttempts, score: _omitScore, max_score: _omitMaxScore, ...safeProgressData } = progressData || {}

      // Calculate time_spent from timestamps (server-side calculation)
      const firstAttempt = existingProgressData?.first_attempt_at || new Date().toISOString()
      let calculatedTimeSpent = 0
      if (finalCompletedAt && firstAttempt) {
        calculatedTimeSpent = Math.floor((new Date(finalCompletedAt) - new Date(firstAttempt)) / 1000)
        // Cap at 30 minutes (1800 seconds) to avoid counting idle time
        calculatedTimeSpent = Math.min(calculatedTimeSpent, 1800)
      }

      // Save progress with best score logic
      console.log(`💾 Upserting progress with attempts: ${newAttempts}, status: ${finalStatus}, time_spent: ${calculatedTimeSpent}s`)
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          exercise_id: exerciseId,
          status: finalStatus,
          completed_at: finalCompletedAt,
          score: finalScore,
          max_score: finalMaxScore,
          attempts: newAttempts,
          first_attempt_at: firstAttempt,
          time_spent: calculatedTimeSpent,
          ...safeProgressData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,exercise_id'
        })
        .select()
      
      console.log('💾 Upsert result:', { data, error })

      if (error) {
        console.log('⚠️ Upsert failed, trying UPDATE instead:', error.message)
        // Fallback to UPDATE if upsert fails
        console.log(`🔄 Fallback UPDATE with attempts: ${newAttempts}`)
        const { error: updateError } = await supabase
          .from('user_progress')
          .update({
            status: finalStatus,
            completed_at: finalCompletedAt,
            score: finalScore,
            max_score: finalMaxScore,
            attempts: newAttempts,
            first_attempt_at: firstAttempt,
            time_spent: calculatedTimeSpent,
            ...safeProgressData,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('exercise_id', exerciseId)

        console.log('🔄 UPDATE result:', { updateError })
        if (updateError) {
          console.log('⚠️ UPDATE also failed:', updateError.message)
        }
      }

      // Calculate bonus tier based on score: +50% if >=95%, +30% if >=90%, 0% otherwise
      const getBonusTier = (scorePercent) => {
        if (scorePercent >= 95) return 0.5
        if (scorePercent >= 90) return 0.3
        return 0
      }

      // Only award XP if score requirement is met
      let actualXpAwarded = 0
      if (meetingRequirement && xpReward && xpReward > 0) {
        if (!isAlreadyCompleted) {
          // First completion - award full XP (base + bonus already calculated by component)
          await addXP(xpReward)
          actualXpAwarded = xpReward
          console.log('💎 Awarded XP for first completion:', xpReward)
        } else {
          // Already completed - check if new score earns a higher bonus tier
          const oldScorePercent = existingProgressData?.max_score
            ? (existingProgressData.score / existingProgressData.max_score) * 100
            : existingProgressData?.score || 0
          const newScorePercent = progressData.score || 0

          const oldBonusTier = getBonusTier(oldScorePercent)
          const newBonusTier = getBonusTier(newScorePercent)

          if (newBonusTier > oldBonusTier) {
            // Calculate base XP from the xpReward (remove bonus component)
            const currentBonusMultiplier = 1 + newBonusTier
            const baseXP = Math.round(xpReward / currentBonusMultiplier)

            // Award only the bonus difference
            const bonusDifference = Math.round(baseXP * (newBonusTier - oldBonusTier))
            if (bonusDifference > 0) {
              await addXP(bonusDifference)
              actualXpAwarded = bonusDifference
              console.log(`💎 Awarded bonus XP difference: ${bonusDifference} (old tier: ${oldBonusTier * 100}%, new tier: ${newBonusTier * 100}%)`)
            }
          } else {
            console.log('🔄 No additional XP - score did not reach higher bonus tier')
          }
        }
      } else if (!meetingRequirement) {
        console.log('❌ No XP awarded - score below 75% requirement')
      }

      // Update local state
      await fetchUserProgress()
      
      // Debug: Log the updated attempts
      console.log(`✅ Exercise completed with ${newAttempts} attempts`)

      // Update streak if exercise was completed successfully
      if (meetingRequirement && !isAlreadyCompleted) {
        console.log('🔥 Updating streak counter...')
        await updateStreak()
      }

      // Check for achievements only if completed
      if (meetingRequirement) {
        await checkAndAwardAchievements(progressData)
      }

      return {
        data,
        error: null,
        xpAwarded: actualXpAwarded,
        completed: meetingRequirement,
        score: score,
        attempts: newAttempts
      }
    } catch (error) {
      console.error('Error completing exercise:', error)
      return { data: null, error: null, xpAwarded: 0, completed: false }
    }
  }

  const updateStreak = async () => {
    if (!user || !profile) return

    try {
      // Get today's date in Vietnam timezone
      const vietnamToday = getVietnamDate()
      const lastActivity = profile.last_activity_date

      console.log('🔥 Streak update:', { vietnamToday, lastActivity })

      let newStreakCount = profile.streak_count || 0

      // Only increment if this is a new day (not consecutive)
      if (lastActivity) {
        const daysDiff = daysDifferenceVietnam(vietnamToday, lastActivity)
        console.log('🔥 Days difference (Vietnam time):', daysDiff)

        if (daysDiff > 0) {
          // New day - increment total days count
          newStreakCount += 1
        }
        // If daysDiff === 0, it's the same day, no change
      } else {
        // First time
        newStreakCount = 1
      }

      const { error } = await supabase
        .from('users')
        .update({
          streak_count: newStreakCount,
          last_activity_date: vietnamToday,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      return newStreakCount
    } catch (error) {
      console.error('Error updating streak:', error)
      return null
    }
  }

  const calculateLevel = (xp) => {
    // Simple level calculation: every 1000 XP = 1 level
    return Math.floor(xp / 1000) + 1
  }

  const getXPForNextLevel = () => {
    if (!profile) return 0
    const currentLevel = profile.level || 1
    const nextLevelXP = currentLevel * 1000
    return nextLevelXP - (profile.xp || 0)
  }

  const getProgressPercentage = () => {
    if (!profile) return 0
    const currentLevel = profile.level || 1
    const currentLevelXP = (currentLevel - 1) * 1000
    const nextLevelXP = currentLevel * 1000
    const progressXP = (profile.xp || 0) - currentLevelXP
    return (progressXP / 1000) * 100
  }

  const checkAndAwardAchievements = async (progressData) => {
    if (!user) return

    try {
      // Call the database function to check and award achievements
      const { data, error } = await supabase.rpc('check_and_award_achievements', {
        user_id_param: user.id
      })

      if (error) {
        console.error('Error checking achievements:', error)
        return
      }

      // If new achievements were awarded, refresh achievements and profile
      if (data && data.length > 0) {
        console.log('🎉 New achievements earned:', data)
        await fetchUserAchievements()
        await fetchUserProfile(user.id)
        
        // You could show a notification here
        // showAchievementNotification(data)
      }
    } catch (error) {
      console.error('Error in checkAndAwardAchievements:', error)
    }
  }

  const addGems = async (gemAmount) => {
    if (!user || !profile) return null

    try {
      const newGems = (profile.gems || 0) + gemAmount

      const { error } = await supabase
        .from('users')
        .update({
          gems: newGems,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await fetchUserProfile(user.id)
      return newGems
    } catch (error) {
      console.error('Error adding gems:', error)
      return null
    }
  }

  const spendGems = async (gemAmount) => {
    if (!user || !profile) return { success: false, error: 'No user logged in' }

    const currentGems = profile.gems || 0
    if (currentGems < gemAmount) {
      return { success: false, error: 'Not enough gems' }
    }

    try {
      const newGems = currentGems - gemAmount

      const { error } = await supabase
        .from('users')
        .update({
          gems: newGems,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await fetchUserProfile(user.id)
      return { success: true, gems: newGems }
    } catch (error) {
      console.error('Error spending gems:', error)
      return { success: false, error: error.message }
    }
  }

  const spendXP = async (xpAmount) => {
    if (!user || !profile) return { success: false, error: 'No user logged in' }

    const currentXP = profile.xp || 0
    if (currentXP < xpAmount) {
      return { success: false, error: 'Not enough XP' }
    }

    try {
      const newXP = currentXP - xpAmount

      const { error } = await supabase
        .from('users')
        .update({
          xp: newXP,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await fetchUserProfile(user.id)
      return { success: true, xp: newXP }
    } catch (error) {
      console.error('Error spending XP:', error)
      return { success: false, error: error.message }
    }
  }

  const getCompletedExercises = () => {
    return userProgress.filter(p => p.status === 'completed').length
  }

  const getTotalStudyTime = () => {
    return userProgress.reduce((total, p) => total + (p.time_spent || 0), 0)
  }

  // Daily Quest functions
  const checkDailyQuestCompletion = async (exerciseId) => {
    if (!user) return

    try {
      console.log('🔍 Checking daily quest completion for exercise:', exerciseId)
      
      // Check if this exercise is a daily quest (using Vietnam date)
      const vietnamToday = getVietnamDate()
      const { data: questData, error: questError } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .eq('quest_date', vietnamToday) // Use Vietnam date for quest logic
        .eq('status', 'available')
        .maybeSingle()

      console.log('Quest data:', questData)
      console.log('Quest error:', questError)

      if (questError) {
        // Gracefully ignore if table is missing
        if (questError.message?.includes("Could not find the table") || questError.code === 'PGRST205') {
          console.warn('daily_quests table not found, skipping quest check')
          return
        }
        console.log('Error checking daily quest:', questError.message)
        return
      }

      if (!questData) {
        console.log('No available quest found for this exercise')
        return
      }

      console.log('🎯 Found daily quest, marking as completed...')

      // Chỉ đánh dấu quest là completed, KHÔNG trao XP ngay
      const { error } = await supabase
        .from('daily_quests')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', questData.id)

      if (error) {
        console.error('Error marking daily quest as completed:', error)
      } else {
        console.log('🎯 Daily quest marked as completed! User needs to claim reward.')
      }
    } catch (error) {
      console.error('Error checking daily quest completion:', error)
    }
  }

  const getDailyQuest = async () => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .rpc('get_today_daily_quest_simple', { user_uuid: user.id })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching daily quest:', error)
      return null
    }
  }

  const claimDailyQuestReward = async (questId) => {
    if (!user) return { success: false, error: 'No user logged in' }

    try {
      const { data, error } = await supabase
        .rpc('claim_daily_quest_reward_simple', { quest_uuid: questId })

      if (error) throw error

      if (data.success) {
        // Refresh user profile to get updated XP
        await fetchUserProfile(user.id)
        return { success: true, xpEarned: data.xp_earned }
      }

      return { success: false, error: data.error }
    } catch (error) {
      console.error('Error claiming daily quest reward:', error)
      return { success: false, error: error.message }
    }
  }

  const value = {
    userProgress,
    achievements,
    loading,
    startExercise,
    updateExerciseProgress,
    addXP,
    addGems,
    spendGems,
    spendXP,
    completeExerciseWithXP,
    isExerciseCompleted,
    updateStreak,
    getXPForNextLevel,
    getProgressPercentage,
    getCompletedExercises,
    getTotalStudyTime,
    fetchUserProgress,
    fetchUserAchievements,
    checkDailyQuestCompletion,
    getDailyQuest,
    claimDailyQuestReward
  }

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  )
}
