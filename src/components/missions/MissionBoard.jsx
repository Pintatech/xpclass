import { useState, useEffect } from 'react'
import { useMissions } from '../../hooks/useMissions'
import { useAuth } from '../../hooks/useAuth'
import { assetUrl } from '../../hooks/useBranding'
import {
  CheckCircle, Clock,
  ChevronRight, Sparkles, Flame, Star
} from 'lucide-react'

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

const TAB_CONFIG = {
  daily: {
    label: 'Hàng ngày',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    activeRing: 'ring-blue-400',
    icon: Flame,
    emptyText: 'Không có nhiệm vụ hàng ngày',
    emptyDesc: 'Quay lại vào ngày mai!',
  },
  weekly: {
    label: 'Hàng tuần',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    activeRing: 'ring-purple-400',
    icon: Star,
    emptyText: 'Không có nhiệm vụ hàng tuần',
    emptyDesc: 'Quay lại vào tuần sau!',
  },
  special: {
    label: 'Đặc biệt',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    activeRing: 'ring-orange-400',
    icon: Sparkles,
    emptyText: 'Không có nhiệm vụ đặc biệt',
    emptyDesc: 'Hãy chờ sự kiện tiếp theo!',
  },
}

const MissionBoard = () => {
  const { profile } = useAuth()
  const { missions, loading, unclaimedCount, fetchMissions, claimReward, claimAllRewards } = useMissions()
  const [activeTab, setActiveTab] = useState('daily')
  const [claimingId, setClaimingId] = useState(null)
  const [claimingAll, setClaimingAll] = useState(false)
  const [claimResult, setClaimResult] = useState(null)

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  const handleClaim = async (userMissionId) => {
    setClaimingId(userMissionId)
    try {
      const result = await claimReward(userMissionId)
      if (result?.success) {
        setClaimResult({
          xp: result.xp_earned,
          gems: result.gems_earned,
          title: result.mission_title
        })
        setTimeout(() => setClaimResult(null), 3000)
      }
    } finally {
      setClaimingId(null)
    }
  }

  const handleClaimAll = async () => {
    setClaimingAll(true)
    try {
      const result = await claimAllRewards()
      if (result?.success && result.claimed_count > 0) {
        setClaimResult({
          xp: result.total_xp,
          gems: result.total_gems,
          title: `${result.claimed_count} nhiệm vụ`
        })
        setTimeout(() => setClaimResult(null), 3000)
      }
    } finally {
      setClaimingAll(false)
    }
  }

  const currentMissions = [...(missions[activeTab] || [])].sort((a, b) => {
    const order = { active: 0, completed: 1, claimed: 2 }
    return (order[a.status] ?? 0) - (order[b.status] ?? 0)
  })
  const tabConfig = TAB_CONFIG[activeTab]

  // Count stats
  const totalMissions = currentMissions.length
  const completedMissions = currentMissions.filter(m => m.status === 'completed' || m.status === 'claimed').length
  const claimedMissions = currentMissions.filter(m => m.status === 'claimed').length

  if (loading && currentMissions.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Đang tải nhiệm vụ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-8 md:pt-8">


      {/* Reward Toast */}
      {claimResult && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-medium">
            <Sparkles className="w-5 h-5" />
            <span>{claimResult.title}:</span>
            {claimResult.xp > 0 && (
              <span className="flex items-center gap-1">
                +{claimResult.xp} <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-4 h-4" />
              </span>
            )}
            {claimResult.gems > 0 && (
              <span className="flex items-center gap-1">
                +{claimResult.gems} <img src={assetUrl('/image/study/gem.png')} alt="Gems" className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 rounded-2xl p-1.5 mb-6 gap-1">
        {Object.entries(TAB_CONFIG).map(([key, config]) => {
          const isActive = activeTab === key
          const missionList = missions[key] || []
          const unclaimed = missionList.filter(m => m.status === 'completed').length
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-sm transition-all relative ${
                isActive
                  ? `${config.color} text-white shadow-lg`
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <config.icon className="w-4 h-4" />
                {config.label}
              </span>
              {unclaimed > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unclaimed}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Progress Bar for current tab */}
      {totalMissions > 0 && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-1.5">
            <span>Tiến độ {tabConfig.label.toLowerCase()}</span>
            <span className="font-semibold text-gray-700">{completedMissions}/{totalMissions}</span>
          </div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${tabConfig.color} transition-all duration-500`}
              style={{ width: `${totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Mission Cards */}
      <div className="space-y-3">
        {currentMissions.length === 0 ? (
          <div className={`text-center py-16 ${tabConfig.bgColor} rounded-2xl border ${tabConfig.borderColor}`}>
            <tabConfig.icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-500">{tabConfig.emptyText}</h3>
            <p className="text-gray-400 text-sm mt-1">{tabConfig.emptyDesc}</p>
          </div>
        ) : (
          currentMissions.map((mission) => (
            <MissionCard
              key={mission.user_mission_id}
              mission={mission}
              tabConfig={tabConfig}
              onClaim={handleClaim}
              claiming={claimingId === mission.user_mission_id}
            />
          ))
        )}
      </div>

      {/* Reset timer */}
      <ResetTimer activeTab={activeTab} />
    </div>
  )
}

const MissionCard = ({ mission, tabConfig, onClaim, claiming }) => {
  const missionImage = MISSION_IMAGE_MAP[mission.icon] || DEFAULT_MISSION_IMAGE
  const progress = mission.progress || 0
  const goal = mission.goal_value || 1
  const percentage = Math.min((progress / goal) * 100, 100)
  const isClaimed = mission.status === 'claimed'
  const isCompleted = mission.status === 'completed'
  const isActive = mission.status === 'active'

  return (
    <div className={`relative overflow-hidden rounded-2xl border transition-all ${
      isClaimed
        ? 'bg-gray-50 border-gray-200 opacity-60'
        : isCompleted
          ? `${tabConfig.bgColor} ${tabConfig.borderColor} shadow-md ring-2 ${tabConfig.activeRing} ring-opacity-50`
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}>
      {/* Completed shimmer effect */}
      {isCompleted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -inset-full animate-[shimmer_3s_infinite] bg-white/30" />
        </div>
      )}

      <div className="p-4 relative">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
            isClaimed
              ? 'bg-gray-200'
              : isCompleted
                ? `${tabConfig.color} shadow-lg`
                : 'bg-gray-100'
          }`}>
            {isClaimed ? (
              <CheckCircle className="w-6 h-6 text-gray-400" />
            ) : missionImage.startsWith('/') ? (
              <img src={assetUrl(missionImage)} alt="" className="w-10 h-10 object-contain" />
            ) : (
              <span className="text-2xl">{missionImage}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className={`font-semibold truncate ${isClaimed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {mission.title}
              </h3>
              {/* Rewards */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {mission.reward_xp > 0 && (
                  <div className={`flex flex-col items-center ${isClaimed ? 'opacity-40' : ''}`}>
                    <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-6 h-6" />
                    <span className="text-[10px] font-bold text-amber-700">{mission.reward_xp}</span>
                  </div>
                )}
                {mission.reward_gems > 0 && (
                  <div className={`flex flex-col items-center ${isClaimed ? 'opacity-40' : ''}`}>
                    <img src={assetUrl('/image/study/gem.png')} alt="Gems" className="w-6 h-6" />
                    <span className="text-[10px] font-bold text-purple-700">{mission.reward_gems}</span>
                  </div>
                )}
              </div>
            </div>

            <p className={`text-sm mt-0.5 ${isClaimed ? 'text-gray-300' : 'text-gray-500'}`}>
              {mission.description}
            </p>

            {/* Progress bar - hide when ready to claim */}
            {!isCompleted && (
              <div className="mt-3">
                <div className={`relative h-5 rounded-full overflow-hidden ${isClaimed ? 'bg-gray-100' : 'bg-gray-200'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isClaimed ? 'bg-gray-300' : tabConfig.color}`}
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs">
                    <span className={`font-semibold ${isClaimed ? 'text-gray-400' : 'text-gray-700'}`}>
                      {progress}/{goal}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Claim button */}
        {isCompleted && (
          <button
            onClick={() => onClaim(mission.user_mission_id)}
            disabled={claiming}
            className={`mt-3 w-full py-2.5 rounded-xl font-semibold text-sm transition-all
              ${tabConfig.color} text-white shadow-md
              hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2`}
          >
            {claiming ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Đang nhận...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Nhận thưởng
              </>
            )}
          </button>
        )}

        {isClaimed && (
          <div className="mt-3 w-full py-2 text-center text-sm text-gray-400 font-medium flex items-center justify-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            Đã nhận thưởng
          </div>
        )}
      </div>
    </div>
  )
}

const ResetTimer = ({ activeTab }) => {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      // Vietnam timezone offset (UTC+7)
      const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))

      let target
      if (activeTab === 'daily') {
        // Next midnight Vietnam time
        target = new Date(vnNow)
        target.setDate(target.getDate() + 1)
        target.setHours(0, 0, 0, 0)
      } else if (activeTab === 'weekly') {
        // Next Monday midnight Vietnam time
        target = new Date(vnNow)
        const daysUntilMonday = (8 - target.getDay()) % 7 || 7
        target.setDate(target.getDate() + daysUntilMonday)
        target.setHours(0, 0, 0, 0)
      } else {
        setTimeLeft('')
        return
      }

      const diff = target - vnNow
      if (diff <= 0) {
        setTimeLeft('Đang làm mới...')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [activeTab])

  if (!timeLeft || activeTab === 'special') return null

  return (
    <div className="mt-6 text-center">
      <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        <span>Làm mới sau: <span className="font-mono font-semibold text-gray-700">{timeLeft}</span></span>
      </div>
    </div>
  )
}

export default MissionBoard
