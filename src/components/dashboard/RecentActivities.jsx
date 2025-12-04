import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { Clock, Star, Trophy, BookOpen, Edit3, HelpCircle, Award, Crown } from 'lucide-react'

const RecentActivities = () => {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentActivities()
  }, [])

  const handleUserClick = (userId) => {
    navigate(`/profile/${userId}`)
  }


  const fetchRecentActivities = async () => {
    try {
      setLoading(true)

      // Fetch exercise completions with user and exercise data in one query
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('user_progress')
        .select(`
          id,
          completed_at,
          user_id,
          exercise_id,
          users:user_id (
            id,
            full_name,
            avatar_url
          ),
          exercises:exercise_id (
            id,
            title,
            exercise_type,
            xp_reward
          )
        `)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20)

      if (exerciseError) throw exerciseError

      // Fetch achievement claims with user and achievement data in one query
      const { data: achievementData, error: achievementError } = await supabase
        .from('user_achievements')
        .select(`
          id,
          user_id,
          achievement_id,
          claimed_at,
          users:user_id (
            id,
            full_name,
            avatar_url
          ),
          achievements:achievement_id (
            id,
            title,
            xp_reward
          )
        `)
        .not('claimed_at', 'is', null)
        .order('claimed_at', { ascending: false })
        .limit(20)

      if (achievementError) throw achievementError

      // Process exercise completions
      const exerciseActivities = (exerciseData || [])
        .filter(progress => progress.users && progress.exercises)
        .map(progress => ({
          ...progress,
          type: 'exercise',
          activity_date: progress.completed_at
        }))

      // Process achievement claims
      const achievementActivities = (achievementData || [])
        .filter(achievement => achievement.users && achievement.achievements)
        .map(achievement => ({
          ...achievement,
          type: 'achievement',
          activity_date: achievement.claimed_at
        }))

      // Combine and sort all activities by date, limit to 20
      const allActivities = [...exerciseActivities, ...achievementActivities]
        .sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date))
        .slice(0, 20)

      setActivities(allActivities)
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  const getExerciseIcon = (exerciseType) => {
    const IconImg = ({ src, className = '' }) => (
      <img src={src} alt="" className={className} />
    )
    switch (exerciseType) {
      case 'flashcard':
        return BookOpen
      case 'fill_blank':
        return (props) => <IconImg src="https://xpclass.vn/xpclass/icon/fill_blank.svg" {...props} />
      case 'ai_fill_blank':
        return (props) => <IconImg src="https://xpclass.vn/xpclass/icon/fill_blank.svg" {...props} />
      case 'drag_drop':
        return (props) => <IconImg src="https://xpclass.vn/xpclass/icon/drag_drop.svg" {...props} />
      case 'multiple_choice':
        return (props) => <IconImg src="https://xpclass.vn/xpclass/icon/multiple_choice.svg" {...props} />
      case 'dropdown':
        return (props) => <IconImg src="https://xpclass.vn/xpclass/icon/drop_down.svg" {...props} />
      default:
        return BookOpen
    }
  }

  const getExerciseTypeLabel = (exerciseType) => {
    switch (exerciseType) {
      case 'flashcard':
        return 'Flashcard'
      case 'fill_blank':
        return 'Fill in the Blank'
      case 'multiple_choice':
        return 'Multiple Choice'
      default:
        return 'Exercise'
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInSeconds = Math.floor((now - time) / 1000)

    if (diffInSeconds < 60) {
      return 'Vừa xong'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} phút trước`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} giờ trước`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} ngày trước`
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hoạt động gần đây</h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="w-12 h-6 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hoạt động gần đây</h3>
        <div className="text-center py-8 text-gray-500">
          <Trophy className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Chưa có hoạt động nào gần đây</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h3>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="w-4 h-4 mr-1" />
          Cập nhật liên tục
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => {
          if (activity.type === 'achievement') {
            return (
              <div key={`achievement-${activity.id}`} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-yellow-50 transition-colors border-l-4 border-yellow-400">
                {/* User Avatar */}
                <div
                  className="flex-shrink-0 cursor-pointer"
                  onClick={() => handleUserClick(activity.users.id)}
                >
                  {activity.users.avatar_url ? (
                    <img
                      src={activity.users.avatar_url}
                      alt={activity.users.full_name}
                      className="w-8 h-8 rounded-full object-cover hover:ring-2 hover:ring-yellow-400 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center hover:ring-2 hover:ring-yellow-400 transition-all">
                      <span className="text-sm font-medium text-yellow-600">
                        {activity.users.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Activity Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <img src="https://xpclass.vn/xpclass/icon/achievement.svg" alt="achievement" className="w-4 h-4 flex-shrink-0" />
                    <span
                      className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-yellow-600 transition-colors"
                      onClick={() => handleUserClick(activity.users.id)}
                    >
                      {activity.users.full_name || 'Người dùng'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    đạt thành tích <span className="font-medium text-yellow-700">{activity.achievements.title}</span>
                  </p>
                </div>

                {/* XP Reward */}
                <div className="flex items-center space-x-1 text-yellow-600 font-medium">
                  <Star className="w-4 h-4" />
                  <span className="text-sm">+{activity.achievements.xp_reward || 0}</span>
                </div>
              </div>
            )
          } else {
            const IconComponent = getExerciseIcon(activity.exercises.exercise_type)

            return (
              <div key={`exercise-${activity.id}`} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                {/* User Avatar */}
                <div
                  className="flex-shrink-0 cursor-pointer"
                  onClick={() => handleUserClick(activity.users.id)}
                >
                  {activity.users.avatar_url ? (
                    <img
                      src={activity.users.avatar_url}
                      alt={activity.users.full_name}
                      className="w-8 h-8 rounded-full object-cover hover:ring-2 hover:ring-blue-400 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition-all">
                      <span className="text-sm font-medium text-blue-600">
                        {activity.users.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Activity Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span
                      className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => handleUserClick(activity.users.id)}
                    >
                      {activity.users.full_name || 'Người dùng'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    hoàn thành <span className="font-medium">{activity.exercises.title}</span>
                  </p>
                </div>

                {/* XP Reward */}
                <div className="flex items-center space-x-1 text-green-600 font-medium">
                  <Star className="w-4 h-4" />
                  <span className="text-sm">+{activity.exercises.xp_reward || 0}</span>
                </div>
              </div>
            )
          }
        })}
      </div>

    </div>
  )
}

export default RecentActivities
