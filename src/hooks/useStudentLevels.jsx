import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../supabase/client'
import { levelInfoFor } from '../utils/levelInfo'

const StudentLevelsContext = createContext({})

export const useStudentLevels = () => {
  const context = useContext(StudentLevelsContext)
  if (!context) {
    throw new Error('useStudentLevels must be used within a StudentLevelsProvider')
  }
  return context
}

export const StudentLevelsProvider = ({ children }) => {
  const { profile } = useAuth()
  const [studentLevels, setStudentLevels] = useState([])
  const [currentLevel, setCurrentLevel] = useState(null)
  const [nextLevel, setNextLevel] = useState(null)
  const [levelProgress, setLevelProgress] = useState({
    xpNeeded: 0,
    progressPercentage: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStudentLevels()
  }, [])

  useEffect(() => {
    if (profile && studentLevels.length > 0) {
      calculateUserLevel(profile.xp || 0)
    }
  }, [profile, studentLevels])

  const fetchStudentLevels = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('student_levels')
        .select('*')
        .eq('is_active', true)
        .order('level_number', { ascending: true })

      if (error) throw error
      setStudentLevels(data || [])
    } catch (error) {
      console.error('Error fetching student levels:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateUserLevel = (userXp) => {
    if (studentLevels.length === 0) return

    // Same rules as every other screen (utils/levelInfo.js): current = highest level reached, next = the nearest
    // higher level_number (a level switched off by the admin is skipped instead of showing "Max").
    const info = levelInfoFor(userXp, studentLevels)
    setCurrentLevel(info.current)
    setNextLevel(info.next)
    setLevelProgress({ xpNeeded: info.xpNeeded, progressPercentage: info.percent })
  }

  // Get level info using database function (alternative method)
  const getUserLevelInfo = async (userXp) => {
    try {
      const { data, error } = await supabase.rpc('get_next_level_info', {
        user_xp: userXp
      })

      if (error) throw error
      return data[0] || null
    } catch (error) {
      console.error('Error getting user level info:', error)
      return null
    }
  }

  // Get badge component data
  const getBadgeData = (level = currentLevel) => {
    if (!level) return null

    return {
      name: level.badge_name,
      tier: level.badge_tier,
      icon: level.badge_icon,
      color: level.badge_color,
      description: level.badge_description,
      title: level.title_unlocked,
      levelNumber: level.level_number
    }
  }

  // Get all levels for leaderboard or admin purposes
  const getAllLevels = () => {
    return studentLevels
  }

  // Get levels by tier
  const getLevelsByTier = (tier) => {
    return studentLevels.filter(level => level.badge_tier === tier)
  }

  // Check if user has specific perk
  const hasUnlockedPerk = (perkName, level = currentLevel) => {
    if (!level || !level.perks_unlocked) return false
    return level.perks_unlocked.includes(perkName)
  }

  // Get XP needed for specific level
  const getXpForLevel = (levelNumber) => {
    const level = studentLevels.find(l => l.level_number === levelNumber)
    return level ? level.xp_required : 0
  }

  // Check if level exists
  const levelExists = (levelNumber) => {
    return studentLevels.some(l => l.level_number === levelNumber)
  }

  const value = {
    // Data
    studentLevels,
    currentLevel,
    nextLevel,
    levelProgress,
    loading,

    // Functions
    fetchStudentLevels,
    calculateUserLevel,
    getUserLevelInfo,
    getBadgeData,
    getAllLevels,
    getLevelsByTier,
    hasUnlockedPerk,
    getXpForLevel,
    levelExists,

    // Helpers
    isMaxLevel: !nextLevel,
    currentLevelNumber: currentLevel?.level_number || 1,
    nextLevelNumber: nextLevel?.level_number || null,
    currentBadge: getBadgeData(currentLevel),
    nextBadge: getBadgeData(nextLevel)
  }

  return (
    <StudentLevelsContext.Provider value={value}>
      {children}
    </StudentLevelsContext.Provider>
  )
}