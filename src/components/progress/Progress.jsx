import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import { useAchievements } from '../../hooks/useAchievements'
import { supabase } from '../../supabase/client'
import AchievementBadgeBar from './AchievementBadgeBar'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import {
  TrendingUp,
  Target,
  Clock,
  Flame,
  Star,
  BookOpen,
  Trophy,
  Calendar,
  BarChart3
} from 'lucide-react'
import { LevelProgressBar } from '../ui/StudentBadge'

const Progress = () => {
  const { user, profile, fetchUserProfile } = useAuth()
  const { getCompletedExercises, getTotalStudyTime, userProgress } = useProgress()
  const { currentLevel, nextLevel, levelProgress, loading: levelsLoading } = useStudentLevels()
  const { getAchievementsWithProgress, checkAndAwardAchievements, claimAchievementXP, userAchievements, challengeWinCounts, loading: achievementsLoading } = useAchievements()
  const [selectedPeriod, setSelectedPeriod] = useState('week')
  const [weeklyData, setWeeklyData] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [loading, setLoading] = useState(true)

  const completedExercises = getCompletedExercises()
  const totalStudyTime = getTotalStudyTime()

  // Fallback level calculations if student levels system is not available
  const fallbackLevel = Math.floor((profile?.xp || 0) / 1000) + 1
  const fallbackXpForNext = 1000 - ((profile?.xp || 0) % 1000)
  const fallbackProgress = ((profile?.xp || 0) % 1000) / 1000 * 100

  // Use either the new level system or fallback
  const displayLevel = currentLevel?.level_number || fallbackLevel
  const displayLevelName = currentLevel?.level_name || `Cấp ${displayLevel}`
  const displayNextLevelName = nextLevel?.level_name || `Cấp ${displayLevel + 1}`
  const displayXpNeeded = levelProgress?.xpNeeded || fallbackXpForNext
  const displayProgress = levelProgress?.progressPercentage || fallbackProgress

  useEffect(() => {
    if (user && userProgress) {
      fetchWeeklyData()
      fetchMonthlyData()
      // checkAndAwardAchievements() // Disabled until SQL functions are fixed
    }
  }, [user, userProgress])

  // Set loading to false after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 2000) // 2 second timeout

    return () => clearTimeout(timer)
  }, [])

  // Calculate achievement progress based on user stats
  const calculateAchievementProgress = (achievement) => {
    const completedCount = completedExercises
    const currentStreak = profile?.streak_count || 0
    const totalXp = profile?.xp || 0

    let progress = 0
    let unlocked = false

    // Check if this is a daily challenge achievement (manually awarded)
    if (achievement.criteria_type && achievement.criteria_type.startsWith('daily_challenge_rank_')) {
      // Check if user has this achievement in their earned achievements
      unlocked = userAchievements.some(ua => ua.achievement_id === achievement.id)
      progress = unlocked ? 100 : 0
    } else {
      // Regular achievements based on stats
      switch (achievement.criteria_type) {
        case 'exercise_completed':
          progress = Math.min((completedCount / achievement.criteria_value) * 100, 100)
          unlocked = completedCount >= achievement.criteria_value
          break
        case 'daily_streak':
          progress = Math.min((currentStreak / achievement.criteria_value) * 100, 100)
          unlocked = currentStreak >= achievement.criteria_value
          break
        case 'total_xp':
          progress = Math.min((totalXp / achievement.criteria_value) * 100, 100)
          unlocked = totalXp >= achievement.criteria_value
          break
        case 'daily_exercises':
          // This would need daily exercise count calculation
          progress = 0
          unlocked = false
          break
        default:
          progress = 0
          unlocked = false
      }
    }

    return {
      progress: Math.round(progress),
      unlocked,
      date: unlocked ? 'Đã mở khóa' : null
    }
  }

  // Get achievements with progress and calculate their status
  const achievementsWithProgress = getAchievementsWithProgress()
  
  // Fallback achievements if database is not ready
  const fallbackAchievements = [
    {
      id: '1',
      title: 'Người mới bắt đầu',
      description: 'Hoàn thành 5 bài tập đầu tiên',
      icon: 'Star',
      badge_color: 'yellow',
      criteria_type: 'exercise_completed',
      criteria_value: 5,
      xp_reward: 50,
      badge_image_url: '',
      badge_image_alt: 'Người mới bắt đầu badge'
    },
    {
      id: '2',
      title: 'Học viên chăm chỉ',
      description: 'Học 7 ngày liên tiếp',
      icon: 'Flame',
      badge_color: 'red',
      criteria_type: 'daily_streak',
      criteria_value: 7,
      xp_reward: 100,
      badge_image_url: '',
      badge_image_alt: 'Học viên chăm chỉ badge'
    },
    {
      id: '3',
      title: 'Chiến binh 🪙',
      description: 'Đạt 1000 🪙',
      icon: 'Trophy',
      badge_color: 'blue',
      criteria_type: 'total_xp',
      criteria_value: 1000,
      xp_reward: 200,
      badge_image_url: '',
      badge_image_alt: 'Chiến binh 🪙 badge'
    },
    {
      id: '4',
      title: 'Kỷ lục gia',
      description: 'Hoàn thành 100 bài tập',
      icon: 'Target',
      badge_color: 'green',
      criteria_type: 'exercise_completed',
      criteria_value: 100,
      xp_reward: 500,
      badge_image_url: '',
      badge_image_alt: 'Kỷ lục gia badge'
    }
  ]

  const allAchievements = achievementsWithProgress.length > 0 ? achievementsWithProgress : fallbackAchievements

  // User stats for achievement calculations
  const userStats = {
    completedExercises,
    currentStreak: profile?.streak_count || 0,
    totalXp: profile?.xp || 0
  }

  // Local state for claimed fallback achievements
  const [claimedFallbackAchievements, setClaimedFallbackAchievements] = useState(new Set())

  // Custom claim function for fallback achievements
  const handleClaimXP = async (achievementId) => {
    // Check if this is a fallback achievement (string ID)
    if (typeof achievementId === 'string' && achievementId.length < 10) {
      const achievement = fallbackAchievements.find(a => a.id === achievementId)
      if (achievement && !claimedFallbackAchievements.has(achievementId)) {
        try {
          // Update user XP directly in the database
          const { error } = await supabase
            .from('users')
            .update({ xp: (profile?.xp || 0) + achievement.xp_reward })
            .eq('id', user.id)

          if (error) throw error

          // Mark as claimed locally
          setClaimedFallbackAchievements(prev => new Set([...prev, achievementId]))

          // Refresh user profile
          fetchUserProfile(user.id)

          return { success: true, xpAwarded: achievement.xp_reward, message: '🪙 đã được cộng!' }
        } catch (error) {
          console.error('Error claiming fallback achievement XP:', error)
          return { success: false, message: 'Có lỗi xảy ra' }
        }
      }
      return { success: false, message: 'Achievement already claimed' }
    } else {
      // Use regular claim function for database achievements
      return await claimAchievementXP(achievementId)
    }
  }


  const fetchWeeklyData = async () => {
    try {
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
      const weekData = []

      // Get current week (Sunday to Saturday)
      const today = new Date()
      const currentDayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.

      // Calculate days from Sunday to today + remaining days of week
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        // Go back to Sunday (subtract current day of week), then add i days
        date.setDate(date.getDate() - currentDayOfWeek + i)
        const dateStr = date.toISOString().split('T')[0]

        // Get progress data for this day
        const dayProgress = userProgress.filter(p =>
          p.completed_at && p.completed_at.startsWith(dateStr)
        )

        const dayXp = dayProgress.reduce((total, p) => total + (p.xp_earned || 0), 0)
        const dayExercises = dayProgress.filter(p => p.status === 'completed').length
        const dayTime = dayProgress.reduce((total, p) => total + (p.time_spent || 0), 0)

        weekData.push({
          day: days[i],
          xp: dayXp,
          exercises: dayExercises,
          time: dayTime,
          date: dateStr
        })
      }

      // If no data found, use sample data for visualization
      if (weekData.every(day => day.exercises === 0 && day.xp === 0)) {
        setWeeklyData([
          { day: 'CN', xp: 0, exercises: 0, time: 0 },
          { day: 'T2', xp: 50, exercises: 2, time: 120 },
          { day: 'T3', xp: 100, exercises: 4, time: 240 },
          { day: 'T4', xp: 0, exercises: 0, time: 0 },
          { day: 'T5', xp: 75, exercises: 3, time: 180 },
          { day: 'T6', xp: 125, exercises: 5, time: 300 },
          { day: 'T7', xp: 25, exercises: 1, time: 60 }
        ])
      } else {
        setWeeklyData(weekData)
      }
    } catch (error) {
      console.error('Error fetching weekly data:', error)
      // Fallback to sample data for visualization
      setWeeklyData([
        { day: 'CN', xp: 0, exercises: 0, time: 0 },
        { day: 'T2', xp: 50, exercises: 2, time: 120 },
        { day: 'T3', xp: 100, exercises: 4, time: 240 },
        { day: 'T4', xp: 0, exercises: 0, time: 0 },
        { day: 'T5', xp: 75, exercises: 3, time: 180 },
        { day: 'T6', xp: 125, exercises: 5, time: 300 },
        { day: 'T7', xp: 25, exercises: 1, time: 60 }
      ])
    }
  }

  const fetchMonthlyData = async () => {
    try {
      const monthData = []
      const today = new Date()
      const currentMonth = today.getMonth()
      const currentYear = today.getFullYear()

      // Get last 4 weeks of current month
      for (let week = 0; week < 4; week++) {
        // Calculate start and end dates for each week
        const weekStart = new Date(currentYear, currentMonth, 1 + (week * 7))
        const weekEnd = new Date(currentYear, currentMonth, Math.min(7 + (week * 7), new Date(currentYear, currentMonth + 1, 0).getDate()))

        // Get progress data for this week
        const weekProgress = userProgress.filter(p => {
          if (!p.completed_at) return false
          const completedDate = new Date(p.completed_at)
          return completedDate >= weekStart && completedDate <= weekEnd
        })

        const weekXp = weekProgress.reduce((total, p) => total + (p.xp_earned || 0), 0)
        const weekExercises = weekProgress.filter(p => p.status === 'completed').length
        const weekTime = weekProgress.reduce((total, p) => total + (p.time_spent || 0), 0)

        monthData.push({
          week: `T${week + 1}`,
          xp: weekXp,
          exercises: weekExercises,
          time: weekTime,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0]
        })
      }

      // If no data found, use sample data for visualization
      if (monthData.every(week => week.exercises === 0 && week.xp === 0)) {
        setMonthlyData([
          { week: 'T1', xp: 150, exercises: 8, time: 480 },
          { week: 'T2', xp: 200, exercises: 12, time: 720 },
          { week: 'T3', xp: 100, exercises: 6, time: 360 },
          { week: 'T4', xp: 175, exercises: 10, time: 600 }
        ])
      } else {
        setMonthlyData(monthData)
      }
    } catch (error) {
      console.error('Error fetching monthly data:', error)
      // Fallback to sample data for visualization
      setMonthlyData([
        { week: 'T1', xp: 150, exercises: 8, time: 480 },
        { week: 'T2', xp: 200, exercises: 12, time: 720 },
        { week: 'T3', xp: 100, exercises: 6, time: 360 },
        { week: 'T4', xp: 175, exercises: 10, time: 600 }
      ])
    }
  }

  // Get current data based on selected period
  const currentData = selectedPeriod === 'week' ? weeklyData : monthlyData
  const maxExercises = Math.max(...currentData.map(d => d.exercises), 5) // Prevent division by 0, minimum 5 for better scaling

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tiến độ học tập</h1>
        <p className="text-gray-600">Theo dõi quá trình học tập của bạn</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <img src="https://xpclass.vn/xpclass/icon/profile/level.svg" alt="Level" className="w-10 h-10" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{displayLevel}</div>
              <div className="text-sm text-gray-600">Cấp độ</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <img src="https://xpclass.vn/xpclass/icon/profile/XP.svg" alt="XP" className="w-10 h-10" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {profile?.xp || 0}
                <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-5 h-5" />
              </div>
              <div className="text-sm text-gray-600">Tổng</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <img src="https://xpclass.vn/xpclass/icon/profile/streak.svg" alt="Streak" className="w-10 h-10" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{profile?.streak_count || 0}</div>
              <div className="text-sm text-gray-600">Chuỗi ngày</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <img src="https://xpclass.vn/xpclass/icon/profile/paper.svg" alt="Exercises" className="w-10 h-10" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{completedExercises}</div>
              <div className="text-sm text-gray-600">Bài tập</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Level Progress */}
      <LevelProgressBar showNextBadge={true} />

      {/* Weekly Activity and Exercise Progress in same row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card>
          <Card.Header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
              Hoạt động tuần này
            </h3>
            <div className="flex space-x-2">
              {['week', 'month'].map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                >
                  {period === 'week' ? 'Tuần' : 'Tháng'}
                </Button>
              ))}
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              {/* Exercise Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  {selectedPeriod === 'week' ? 'Bài tập hoàn thành hàng ngày' : 'Bài tập hoàn thành theo tuần'}
                </h4>
                <div className="flex items-end justify-between h-32 bg-gray-50 rounded-lg p-3">
                  {currentData.map((item, index) => {
                    const heightPercentage = item.exercises > 0 ? Math.max((item.exercises / maxExercises) * 100, 10) : 5
                    const itemCount = currentData.length
                    return (
                      <div key={index} className="flex flex-col items-center justify-end h-full" style={{ width: `calc(100% / ${itemCount} - 8px)` }}>
                        <div
                          className={`w-full rounded-t transition-all duration-300 ${
                            item.exercises > 0
                              ? 'bg-blue-500 hover:bg-blue-600'
                              : 'bg-gray-300'
                          }`}
                          style={{
                            height: `${heightPercentage}%`,
                            minHeight: item.exercises > 0 ? '12px' : '4px'
                          }}
                          title={`${item.exercises} bài tập - ${item.xp} 🪙`}
                        />
                        <div className="text-xs text-gray-600 mt-1 font-medium">
                          {selectedPeriod === 'week' ? item.day : item.week}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className={`grid gap-2 ${selectedPeriod === 'week' ? 'grid-cols-7' : 'grid-cols-4'}`}>
                {currentData.map((item, index) => (
                  <div key={index} className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-xs font-medium text-gray-600">
                      {selectedPeriod === 'week' ? item.day : item.week}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{item.exercises}</div>
                    <div className="text-xs text-gray-500">bài tập</div>
                  </div>
                ))}
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Exercise Progress */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Target className="w-5 h-5 mr-2 text-green-600" />
              Bài tập đã hoàn thành
            </h3>
          </Card.Header>
          <Card.Content>
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-gray-900">
                {completedExercises}
              </div>
              <div className="text-gray-600">Tổng bài tập hoàn thành</div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tuần này:</span>
                  <span className="font-medium">
                    {weeklyData.reduce((total, day) => total + day.exercises, 0)} bài
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Trung bình/ngày:</span>
                  <span className="font-medium">
                    {completedExercises > 0 ? Math.round(completedExercises / 30) : 0} bài
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Chuỗi ngày hiện tại:</span>
                  <span className="font-medium text-green-600">
                    {profile?.streak_count || 0} ngày
                  </span>
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* Achievements */}
      <AchievementBadgeBar
        achievements={allAchievements}
        userStats={userStats}
        onClaimXP={handleClaimXP}
        userAchievements={userAchievements}
        claimedFallbackAchievements={claimedFallbackAchievements}
        challengeWinCounts={challengeWinCounts}
      />
    </div>
  )
}

export default Progress

