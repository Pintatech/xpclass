import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import { supabase } from '../../supabase/client'
import Card from '../ui/Card'
import Button from '../ui/Button'
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

const Progress = () => {
  const { user, profile } = useAuth()
  const { getCompletedExercises, getTotalStudyTime, userProgress } = useProgress()
  const { currentLevel, nextLevel, levelProgress, loading: levelsLoading } = useStudentLevels()
  const [selectedPeriod, setSelectedPeriod] = useState('week')
  const [weeklyData, setWeeklyData] = useState([])
  const [activityCalendar, setActivityCalendar] = useState([])
  const [realAchievements, setRealAchievements] = useState([])
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
      fetchActivityCalendar()
      fetchRealAchievements()
    }
  }, [user, userProgress])

  // Debug logging for level system
  useEffect(() => {
    console.log('Progress Component Debug:', {
      currentLevel,
      nextLevel,
      levelProgress,
      profileXp: profile?.xp,
      levelsLoading,
      fallbackLevel,
      displayLevel,
      displayXpNeeded,
      displayProgress
    })
  }, [currentLevel, nextLevel, levelProgress, profile, levelsLoading, fallbackLevel, displayLevel, displayXpNeeded, displayProgress])

  const fetchWeeklyData = async () => {
    try {
      const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
      const weekData = []

      // Get last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
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
          time: dayTime
        })
      }

      setWeeklyData(weekData)
    } catch (error) {
      console.error('Error fetching weekly data:', error)
      // Fallback to empty data
      setWeeklyData([
        { day: 'T2', xp: 0, exercises: 0, time: 0 },
        { day: 'T3', xp: 0, exercises: 0, time: 0 },
        { day: 'T4', xp: 0, exercises: 0, time: 0 },
        { day: 'T5', xp: 0, exercises: 0, time: 0 },
        { day: 'T6', xp: 0, exercises: 0, time: 0 },
        { day: 'T7', xp: 0, exercises: 0, time: 0 },
        { day: 'CN', xp: 0, exercises: 0, time: 0 }
      ])
    }
  }

  const fetchActivityCalendar = async () => {
    try {
      // Get last 30 days activity
      const calendar = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]

        const dayProgress = userProgress.filter(p =>
          p.completed_at && p.completed_at.startsWith(dateStr)
        )

        const dayXp = dayProgress.reduce((total, p) => total + (p.xp_earned || 0), 0)
        const hasActivity = dayXp > 0
        const intensity = Math.min(dayXp / 100, 1) // Normalize XP to 0-1 scale

        calendar.push({
          date: dateStr,
          hasActivity,
          intensity,
          xp: dayXp
        })
      }

      setActivityCalendar(calendar)
    } catch (error) {
      console.error('Error fetching activity calendar:', error)
      setActivityCalendar([])
    }
  }

  const fetchRealAchievements = async () => {
    try {
      const completedCount = completedExercises
      const currentStreak = profile?.streak_count || 0
      const totalXp = profile?.xp || 0

      // Calculate real achievements based on user data
      const achievements = [
        {
          id: 1,
          title: 'Người mới bắt đầu',
          description: 'Hoàn thành 5 bài tập đầu tiên',
          icon: 'Star',
          color: 'bg-yellow-500',
          unlocked: completedCount >= 5,
          progress: Math.min((completedCount / 5) * 100, 100),
          date: completedCount >= 5 ? 'Đã mở khóa' : null
        },
        {
          id: 2,
          title: 'Học viên chăm chỉ',
          description: 'Học 7 ngày liên tiếp',
          icon: 'Flame',
          color: 'bg-red-500',
          unlocked: currentStreak >= 7,
          progress: Math.min((currentStreak / 7) * 100, 100),
          date: currentStreak >= 7 ? 'Đã mở khóa' : null
        },
        {
          id: 3,
          title: 'Chiến binh XP',
          description: 'Đạt 1000 XP',
          icon: 'Trophy',
          color: 'bg-blue-500',
          unlocked: totalXp >= 1000,
          progress: Math.min((totalXp / 1000) * 100, 100),
          date: totalXp >= 1000 ? 'Đã mở khóa' : null
        },
        {
          id: 4,
          title: 'Kỷ lục gia',
          description: 'Hoàn thành 100 bài tập',
          icon: 'Target',
          color: 'bg-green-500',
          unlocked: completedCount >= 100,
          progress: Math.min((completedCount / 100) * 100, 100),
          date: completedCount >= 100 ? 'Đã mở khóa' : null
        }
      ]

      setRealAchievements(achievements)
    } catch (error) {
      console.error('Error fetching achievements:', error)
      setRealAchievements([])
    } finally {
      setLoading(false)
    }
  }

  // Helper function to get icon component from string
  const getIconComponent = (iconName) => {
    const icons = {
      Star,
      Flame,
      Trophy,
      Target
    }
    return icons[iconName] || Star
  }

  const maxXP = Math.max(...weeklyData.map(d => d.xp), 1) // Prevent division by 0

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tiến độ học tập</h1>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
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
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{displayLevel}</div>
              <div className="text-sm text-gray-600">Cấp độ</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{profile?.xp || 0}</div>
              <div className="text-sm text-gray-600">Tổng XP</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Flame className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{profile?.streak_count || 0}</div>
              <div className="text-sm text-gray-600">Chuỗi ngày</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{completedExercises}</div>
              <div className="text-sm text-gray-600">Bài tập</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Level Progress */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold text-gray-900">Tiến độ cấp độ</h3>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white font-bold">
                  {displayLevel}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{displayLevelName}</div>
                  <div className="text-sm text-gray-600">{profile?.xp || 0} XP</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{displayNextLevelName}</div>
                <div className="text-sm text-gray-600">Còn {Math.max(0, displayXpNeeded)} XP</div>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-primary-600 to-secondary-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
              >
                <span className="text-xs text-white font-medium">
                  {Math.round(Math.min(100, Math.max(0, displayProgress)))}%
                </span>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

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
            {/* XP Chart */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Điểm XP hàng ngày</h4>
              <div className="flex items-end space-x-2 h-32">
                {weeklyData.map((day, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-sm transition-all duration-300 hover:from-primary-700 hover:to-primary-500 min-h-[4px]"
                      style={{ height: `${(day.xp / maxXP) * 100}%` }}
                      title={`${day.xp} XP`}
                    />
                    <div className="text-xs text-gray-600 mt-2">{day.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Summary */}
            <div className="grid grid-cols-7 gap-2">
              {weeklyData.map((day, index) => (
                <div key={index} className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-600">{day.day}</div>
                  <div className="text-sm font-semibold text-gray-900">{day.xp}</div>
                  <div className="text-xs text-gray-500">{day.exercises} bài</div>
                </div>
              ))}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Study Time */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-orange-600" />
              Thời gian học tập
            </h3>
          </Card.Header>
          <Card.Content>
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-gray-900">
                {Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m
              </div>
              <div className="text-gray-600">Tổng thời gian học</div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Trung bình/ngày:</span>
                  <span className="font-medium">
                    {totalStudyTime > 0 ? Math.round(totalStudyTime / 30) : 0} phút
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tuần này:</span>
                  <span className="font-medium">
                    {weeklyData.reduce((total, day) => total + day.time, 0)} phút
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

        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-green-600" />
              Lịch học tập
            </h3>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-7 gap-1">
              {activityCalendar.map((day, index) => (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-sm ${
                    day.hasActivity
                      ? day.intensity > 0.7
                        ? 'bg-green-600'
                        : day.intensity > 0.4
                        ? 'bg-green-400'
                        : 'bg-green-200'
                      : 'bg-gray-100'
                  }`}
                  title={day.hasActivity ? `${day.xp} XP - ${day.date}` : `Không có hoạt động - ${day.date}`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Ít</span>
              <span>Nhiều</span>
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
            Thành tích
          </h3>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {realAchievements.map((achievement) => {
              const IconComponent = getIconComponent(achievement.icon)
              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border ${
                    achievement.unlocked
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${achievement.color}`}>
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{achievement.title}</div>
                      <div className="text-sm text-gray-600">{achievement.description}</div>

                      {achievement.unlocked ? (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ {achievement.date}
                        </div>
                      ) : (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{ width: `${achievement.progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {Math.round(achievement.progress)}% hoàn thành
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card.Content>
      </Card>
    </div>
  )
}

export default Progress
