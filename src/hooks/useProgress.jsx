import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../supabase/client'

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

      const { error } = await supabase
        .from('users')
        .update({
          xp: newXP,
          level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

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

    // If already completed, don't process further
    if (isAlreadyCompleted) {
      console.log('Exercise already completed, no XP awarded')
      return { data: null, error: 'Exercise already completed' }
    }

    try {
      // Mark exercise as completed
      const { data, error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          exercise_id: exerciseId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          ...progressData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,exercise_id'
        })
        .select()

      if (error) {
        console.log('⚠️ Upsert failed, trying UPDATE instead:', error.message)
        // Fallback to UPDATE if upsert fails
        const { error: updateError } = await supabase
          .from('user_progress')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            ...progressData,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('exercise_id', exerciseId)

        if (updateError) {
          console.log('⚠️ UPDATE also failed:', updateError.message)
          // Don't throw error, just log it
        }
      }

      // Award XP for first completion
      if (xpReward && xpReward > 0) {
        await addXP(xpReward)
        console.log('💎 Awarded XP for first completion:', xpReward)
      }

      // Update local state
      await fetchUserProgress()

      // Check for achievements
      await checkAndAwardAchievements(progressData)

      return { data, error: null, xpAwarded: xpReward }
    } catch (error) {
      console.error('Error completing exercise:', error)
      // Don't return error for user_progress issues, daily quest still works
      return { data: null, error: null, xpAwarded: 0 }
    }
  }

  const updateStreak = async () => {
    if (!user || !profile) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const lastActivity = profile.last_activity_date

      let newStreakCount = profile.streak_count || 0

      if (lastActivity) {
        const lastActivityDate = new Date(lastActivity)
        const todayDate = new Date(today)
        const daysDiff = Math.floor((todayDate - lastActivityDate) / (1000 * 60 * 60 * 24))

        if (daysDiff === 1) {
          // Consecutive day
          newStreakCount += 1
        } else if (daysDiff > 1) {
          // Streak broken
          newStreakCount = 1
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
          last_activity_date: today,
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
    // This would check various achievement criteria
    // For now, just a placeholder
    console.log('Checking achievements for progress:', progressData)
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
      
      // Kiểm tra xem exercise này có phải là daily quest không
      const { data: questData, error: questError } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .eq('quest_date', new Date().toISOString().split('T')[0])
        .eq('status', 'available')
        .maybeSingle()

      console.log('Quest data:', questData)
      console.log('Quest error:', questError)

      if (questError) {
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
    updateExerciseProgress,
    addXP,
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
