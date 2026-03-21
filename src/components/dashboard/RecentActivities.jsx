import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { Clock, Trophy } from 'lucide-react'
import AvatarWithFrame from '../ui/AvatarWithFrame'

import { assetUrl } from '../../hooks/useBranding';

const MISSION_IMAGE_MAP = {
  'target': '/icon/dashboard/wow.svg',
  'star': '/image/3_star.png',
  'trophy': '/icon/profile/paper.svg',
  'flame': '/icon/profile/streak.svg',
  'swords': '/icon/dashboard/pvp.png',
  'gamepad-2': '/image/dashboard/pet-type.webp',
  'book-open': '/image/dashboard/match1.png',
  'graduation-cap': '/pet-game/mole-whacked.png',
  'zap': '/image/chest/legendary-chest.png',
  'gem': '/pet-game/astro/alien1.png',
  'medal': '/image/dashboard/pet-train.svg',
  'gift': '/image/dashboard/pet-scramble.jpg',
  'package-open': '/image/inventory/spaceship/phantom-voyager.png',
  'joystick': '/image/pet/game-win.png',
}
const DEFAULT_MISSION_IMAGE = '/icon/dashboard/wow.svg'
const getMissionImage = (iconName) => MISSION_IMAGE_MAP[iconName] || DEFAULT_MISSION_IMAGE

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
            active_frame_ratio,
            hide_frame
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

      // Fetch claimed missions with user and mission data
      const { data: missionData, error: missionError } = await supabase
        .from('user_missions')
        .select(`
          id,
          user_id,
          mission_id,
          updated_at,
          users:user_id (
            id,
            full_name,
            avatar_url,
            active_title,
            active_frame_ratio,
            hide_frame,
            role
          ),
          missions:mission_id (
            id,
            title,
            reward_xp,
            reward_gems,
            mission_type,
            icon
          )
        `)
        .eq('status', 'claimed')
        .order('updated_at', { ascending: false })
        .limit(20)

      if (missionError) throw missionError

      // Fetch all gem missions claimed today (so none are missed)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data: gemMissionData } = await supabase
        .from('user_missions')
        .select(`
          id,
          user_id,
          mission_id,
          updated_at,
          users:user_id (
            id,
            full_name,
            avatar_url,
            active_title,
            active_frame_ratio,
            hide_frame,
            role
          ),
          missions:mission_id (
            id,
            title,
            reward_xp,
            reward_gems,
            mission_type,
            icon
          )
        `)
        .eq('status', 'claimed')
        .gt('missions.reward_gems', 0)
        .gte('updated_at', todayStart.toISOString())
        .order('updated_at', { ascending: false })

      // Merge gem missions into missionData, avoiding duplicates
      const missionIds = new Set((missionData || []).map(m => m.id))
      const extraGemMissions = (gemMissionData || []).filter(m => m.missions && !missionIds.has(m.id))
      const allMissionData = [...(missionData || []), ...extraGemMissions]

      // Process achievement claims
      const achievementActivities = (achievementData || [])
        .filter(achievement => achievement.users && achievement.achievements)
        .map(achievement => ({
          ...achievement,
          type: 'achievement',
          activity_date: achievement.claimed_at
        }))

      // Process mission claims (exclude admins)
      const missionActivities = (allMissionData || [])
        .filter(mission => mission.users && mission.missions && mission.users.role !== 'admin')
        .map(mission => ({
          ...mission,
          type: 'mission',
          activity_date: mission.updated_at
        }))

      // Merge and sort by date, gem missions stick to top for their day
      const allActivities = [...achievementActivities, ...missionActivities]
        .sort((a, b) => {
          const dateA = new Date(a.activity_date)
          const dateB = new Date(b.activity_date)
          const dayA = dateA.toDateString()
          const dayB = dateB.toDateString()

          // Different days: sort by date descending
          if (dayA !== dayB) return dateB - dateA

          // Same day: gem missions go first
          const aHasGems = a.type === 'mission' && a.missions?.reward_gems > 0
          const bHasGems = b.type === 'mission' && b.missions?.reward_gems > 0
          if (aHasGems && !bHasGems) return -1
          if (!aHasGems && bHasGems) return 1

          // Same priority: sort by date descending
          return dateB - dateA
        })
        .slice(0, 20)

      setActivities(allActivities)
    } catch (error) {
      console.error('Error fetching recent activities:', error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }


  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6 h-full">
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
      <div className="bg-white rounded-lg border p-6 h-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hoạt động gần đây</h3>
        <div className="text-center py-8 text-gray-500">
          <Trophy className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Chưa có hoạt động nào gần đây</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h3>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="w-4 h-4 mr-1" />
          Cập nhật liên tục
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => (
          <div key={`${activity.type}-${activity.id}`} className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${activity.type === 'mission' ? (activity.missions?.reward_gems > 0 ? 'border border-purple-200 hover:bg-purple-100' : 'hover:bg-blue-50') : 'hover:bg-yellow-50'}`} style={activity.type === 'mission' && activity.missions?.reward_gems > 0 ? { animation: 'gem-shine 3s ease-in-out infinite' } : undefined}>
            {/* User Avatar with Frame */}
            <AvatarWithFrame
              avatarUrl={activity.users.avatar_url}
              frameUrl={activity.users.hide_frame ? null : activity.users.active_title}
              frameRatio={activity.users.active_frame_ratio}
              size={40}
              fallback={activity.users.full_name?.charAt(0) || 'U'}
              onClick={() => handleUserClick(activity.users.id)}
              className="cursor-pointer hover:ring-2 hover:ring-yellow-400 rounded-full transition-all"
            />

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                {activity.type === 'mission' ? (
                  <img src={getMissionImage(activity.missions.icon).startsWith('http') ? getMissionImage(activity.missions.icon) : assetUrl(getMissionImage(activity.missions.icon))} alt="mission" className="w-4 h-4 flex-shrink-0 object-contain" />
                ) : (
                  <img src={assetUrl('/icon/profile/achievement.svg')} alt="achievement" className="w-4 h-4 flex-shrink-0" />
                )}
                <span
                  className="text-sm font-medium text-gray-900 truncate cursor-pointer hover:text-yellow-600 transition-colors"
                  onClick={() => handleUserClick(activity.users.id)}
                >
                  {activity.users.full_name || 'Người dùng'}
                </span>
              </div>
              {activity.type === 'mission' ? (
                <p className="text-sm text-gray-600">
                  hoàn thành nhiệm vụ <span className="font-medium text-blue-700">{activity.missions.title}</span>
                  {' '}<span className="inline-flex items-center text-yellow-600 font-medium whitespace-nowrap"><img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-3 h-3 inline mr-0.5" />+{activity.missions.reward_xp || 0}</span>
                  {activity.missions.reward_gems > 0 && (
                    <>{' '}<span className="inline-flex items-center text-purple-600 font-medium whitespace-nowrap"><img src={assetUrl('/image/study/gem.png')} alt="Gem" className="w-3 h-3 inline mr-0.5" />+{activity.missions.reward_gems}</span></>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  đạt thành tích <span className="font-medium text-yellow-700">{activity.achievements.title}</span>
                  {' '}<span className="inline-flex items-center text-yellow-600 font-medium whitespace-nowrap"><img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-3 h-3 inline mr-0.5" />+{activity.achievements.xp_reward || 0}</span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

export default RecentActivities
