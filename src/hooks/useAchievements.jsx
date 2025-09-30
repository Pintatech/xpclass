import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './useAuth'

export const useAchievements = () => {
  const { user, fetchUserProfile } = useAuth()
  const [achievements, setAchievements] = useState([])
  const [userAchievements, setUserAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch all available achievements
  const fetchAchievements = async () => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('criteria_value', { ascending: true })

      if (error) throw error
      setAchievements(data || [])
    } catch (err) {
      console.error('Error fetching achievements:', err)
      setError(err.message)
      // Set empty array as fallback
      setAchievements([])
    }
  }

  // Fetch user's earned achievements
  const fetchUserAchievements = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievements (
            id,
            title,
            description,
            icon,
            badge_color,
            badge_image_url,
            badge_image_alt,
            xp_reward
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error
      setUserAchievements(data || [])
    } catch (err) {
      console.error('Error fetching user achievements:', err)
      setError(err.message)
      // Set empty array as fallback
      setUserAchievements([])
    }
  }

  // Check and award new achievements
  const checkAndAwardAchievements = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase.rpc('check_and_award_achievements', {
        user_id_param: user.id
      })

      if (error) throw error
      
      // If new achievements were awarded, refresh the list
      if (data && data.length > 0) {
        await fetchUserAchievements()
        return data // Return newly earned achievements for notifications
      }
      
      return []
    } catch (err) {
      console.error('Error checking achievements:', err)
      setError(err.message)
      return []
    }
  }

  // Claim achievement XP
  const claimAchievementXP = async (achievementId) => {
    if (!user) return { success: false, message: 'No user logged in' }

    try {
      const { data, error } = await supabase.rpc('claim_achievement_xp', {
        user_id_param: user.id,
        achievement_id_param: achievementId
      })

      if (error) throw error
      
      if (data && data.length > 0) {
        const result = data[0]
        if (result.success) {
          // Refresh user achievements and profile
          await fetchUserAchievements()
          // Refresh user profile to show updated XP
          await fetchUserProfile(user.id)
          return { success: true, xpAwarded: result.xp_awarded, message: result.message }
        } else {
          return { success: false, message: result.message }
        }
      }
      
      return { success: false, message: 'Unknown error' }
    } catch (err) {
      console.error('Error claiming achievement XP:', err)
      setError(err.message)
      return { success: false, message: err.message }
    }
  }

  // Get achievement progress for a specific achievement
  const getAchievementProgress = (achievement) => {
    if (!user) return { progress: 0, unlocked: false, claimed: false }

    const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id)
    
    if (userAchievement) {
      return { 
        progress: 100, 
        unlocked: true, 
        claimed: userAchievement.claimed_at !== null,
        earnedAt: userAchievement.earned_at,
        xpToClaim: userAchievement.xp_claimed || 0
      }
    }

    // Calculate progress based on criteria type
    // This would need to be implemented based on your user stats
    // For now, return basic progress
    return { progress: 0, unlocked: false, claimed: false }
  }

  // Get all achievements with progress
  const getAchievementsWithProgress = () => {
    return achievements.map(achievement => ({
      ...achievement,
      ...getAchievementProgress(achievement)
    }))
  }

  // Create new achievement (admin only)
  const createAchievement = async (achievementData) => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .insert([achievementData])
        .select()
        .single()

      if (error) throw error
      
      // Refresh achievements list
      await fetchAchievements()
      return data
    } catch (err) {
      console.error('Error creating achievement:', err)
      setError(err.message)
      throw err
    }
  }

  // Update achievement (admin only)
  const updateAchievement = async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      
      // Refresh achievements list
      await fetchAchievements()
      return data
    } catch (err) {
      console.error('Error updating achievement:', err)
      setError(err.message)
      throw err
    }
  }

  // Delete achievement (admin only)
  const deleteAchievement = async (id) => {
    try {
      const { error } = await supabase
        .from('achievements')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      // Refresh achievements list
      await fetchAchievements()
    } catch (err) {
      console.error('Error deleting achievement:', err)
      setError(err.message)
      throw err
    }
  }

  // Toggle achievement active status (admin only)
  const toggleAchievementStatus = async (id, isActive) => {
    try {
      const { data, error } = await supabase
        .from('achievements')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      
      // Refresh achievements list
      await fetchAchievements()
      return data
    } catch (err) {
      console.error('Error toggling achievement status:', err)
      setError(err.message)
      throw err
    }
  }

  useEffect(() => {
    if (user) {
      fetchAchievements()
      fetchUserAchievements()
    }
  }, [user])

  useEffect(() => {
    // Set loading to false after a short delay to ensure data is loaded
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [achievements, userAchievements])

  return {
    achievements,
    userAchievements,
    loading,
    error,
    fetchAchievements,
    fetchUserAchievements,
    checkAndAwardAchievements,
    claimAchievementXP,
    getAchievementProgress,
    getAchievementsWithProgress,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    toggleAchievementStatus
  }
}
