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

    // Check if exercise is already completed
    if (isExerciseCompleted(exerciseId)) {
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
        })
        .select()

      if (error) throw error

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
      return { data: null, error }
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
    fetchUserAchievements
  }

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  )
}
