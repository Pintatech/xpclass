import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { Clock, Star, Trophy, BookOpen, Edit3, HelpCircle, Award, Crown } from 'lucide-react'
import AvatarWithFrame from '../ui/AvatarWithFrame'

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
            avatar_url,
            active_title,
            active_frame_ratio
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

      // Process achievement claims
      const achievementActivities = (achievementData || [])
        .filter(achievement => achievement.users && achievement.achievements)
        .map(achievement => ({
          ...achievement,
          type: 'achievement',
          activity_date: achievement.claimed_at
        }))

      setActivities(achievementActivities)
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      setActivities([])
    } finally {
      setLoading(false)
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
        {activities.map((activity) => (
          <div key={`achievement-${activity.id}`} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-yellow-50 transition-colors">
            {/* User Avatar with Frame */}
            <AvatarWithFrame
              avatarUrl={activity.users.avatar_url}
              frameUrl={activity.users.active_title}
              frameRatio={activity.users.active_frame_ratio}
              size={32}
              fallback={activity.users.full_name?.charAt(0) || 'U'}
              onClick={() => handleUserClick(activity.users.id)}
              className="cursor-pointer hover:ring-2 hover:ring-yellow-400 rounded-full transition-all"
            />

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <img src="https://xpclass.vn/xpclass/icon/profile/achievement.svg" alt="achievement" className="w-4 h-4 flex-shrink-0" />
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
        ))}
      </div>

    </div>
  )
}

export default RecentActivities
