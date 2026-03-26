import { useState, useEffect } from 'react'
import { useMissions } from '../../hooks/useMissions'
import { useAuth } from '../../hooks/useAuth'
import { assetUrl } from '../../hooks/useBranding'
import {
  CheckCircle, Clock,
  ChevronRight, Sparkles, Flame, Star, Crown
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
    rank: 'E',
    color: 'from-blue-600 to-blue-400',
    glowColor: 'rgba(59,130,246,0.5)',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgAccent: 'bg-blue-500/10',
    icon: Flame,
    emptyText: 'Không có nhiệm vụ hàng ngày',
    emptyDesc: 'Quay lại vào ngày mai!',
  },
  weekly: {
    label: 'Hàng tuần',
    rank: 'A',
    color: 'from-purple-600 to-purple-400',
    glowColor: 'rgba(147,51,234,0.5)',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgAccent: 'bg-purple-500/10',
    icon: Star,
    emptyText: 'Không có nhiệm vụ hàng tuần',
    emptyDesc: 'Quay lại vào tuần sau!',
  },
  special: {
    label: 'Đặc biệt',
    rank: 'S',
    color: 'from-amber-500 to-yellow-400',
    glowColor: 'rgba(245,158,11,0.5)',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgAccent: 'bg-amber-500/10',
    icon: Crown,
    emptyText: 'Không có nhiệm vụ đặc biệt',
    emptyDesc: 'Hãy chờ sự kiện tiếp theo!',
  },
}

/* Floating particles background */
const SystemParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 bg-blue-400/60 rounded-full"
        style={{
          left: `${15 + i * 15}%`,
          bottom: '10%',
          animation: `sl-particle-float ${3 + i * 0.7}s ease-out infinite`,
          animationDelay: `${i * 0.8}s`,
        }}
      />
    ))}
  </div>
)

/* Scan line overlay */
const ScanLine = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
    <div
      className="absolute left-0 w-full h-[2px] bg-blue-400"
      style={{ animation: 'sl-scan-line 4s linear infinite' }}
    />
  </div>
)

const MissionBoard = () => {
  const { profile } = useAuth()
  const { missions, loading, unclaimedCount, fetchMissions, claimReward, claimAllRewards } = useMissions()
  const [activeTab, setActiveTab] = useState('daily')
  const [claimingId, setClaimingId] = useState(null)
  const [claimingAll, setClaimingAll] = useState(false)
  const [claimResult, setClaimResult] = useState(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  // Trigger entrance after mount
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 100)
    return () => clearTimeout(t)
  }, [])

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

  const totalMissions = currentMissions.length
  const completedMissions = currentMissions.filter(m => m.status === 'completed' || m.status === 'claimed').length

  if (loading && currentMissions.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-t-blue-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-blue-400/70 mt-6 text-sm tracking-[0.2em] uppercase sl-flicker">
            Đang tải nhiệm vụ...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-8 md:pt-4 relative">
      {/* Dark overlay background */}
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950 via-slate-900 to-gray-950 -z-10" />
      <SystemParticles />
      <ScanLine />

      {/* System Header */}
      <div className={`text-center mb-6 transition-all duration-700 ${entered ? 'sl-header-enter' : 'opacity-0'}`}>
        <div className="inline-flex items-center gap-2 text-blue-400/50 text-[10px] tracking-[0.3em] uppercase mb-1">
          <span className="w-8 h-[1px] bg-blue-400/30" />
          SYSTEM
          <span className="w-8 h-[1px] bg-blue-400/30" />
        </div>
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 tracking-[0.15em] uppercase">
          Nhiệm vụ
        </h1>
      </div>

      {/* Reward Toast */}
      {claimResult && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-amber-500/90 to-yellow-500/90 text-white px-6 py-3 rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.5)] backdrop-blur flex items-center gap-3 font-medium border border-amber-400/50">
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

      {/* Tab Switcher — System Style */}
      <div className={`flex gap-2 mb-5 transition-all duration-500 ${entered ? 'sl-slide-right' : 'opacity-0'}`}
           style={{ animationDelay: '0.2s' }}>
        {Object.entries(TAB_CONFIG).map(([key, config]) => {
          const isActive = activeTab === key
          const missionList = missions[key] || []
          const unclaimed = missionList.filter(m => m.status === 'completed').length
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 relative py-3 px-3 font-semibold text-sm transition-all duration-300 border ${
                isActive
                  ? `bg-gradient-to-b from-slate-800/80 to-slate-900/80 ${config.borderColor} ${config.textColor} shadow-lg`
                  : 'bg-slate-900/40 border-slate-700/30 text-slate-500 hover:text-slate-300 hover:border-slate-600/50'
              }`}
              style={{
                clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                boxShadow: isActive ? `0 0 20px ${config.glowColor.replace('0.5', '0.15')}` : 'none',
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] font-bold opacity-50">[{config.rank}]</span>
                {config.label}
              </span>
              {unclaimed > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                  {unclaimed}
                </span>
              )}
              {/* Active indicator line */}
              {isActive && (
                <div className={`absolute bottom-0 left-[10%] right-[10%] h-[2px] bg-gradient-to-r ${config.color}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Progress Bar */}
      {totalMissions > 0 && (
        <div className={`mb-5 px-1 transition-all duration-500 ${entered ? 'sl-slide-right' : 'opacity-0'}`}
             style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 tracking-wider uppercase">
            <span className="sl-flicker">Tiến độ {tabConfig.label.toLowerCase()}</span>
            <span className={`font-mono font-bold ${tabConfig.textColor}`}>{completedMissions}/{totalMissions}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${tabConfig.color} transition-all duration-700 relative`}
              style={{ width: `${totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
            </div>
          </div>
        </div>
      )}

      {/* Mission Cards */}
      <div className="space-y-3">
        {currentMissions.length === 0 ? (
          <div className={`text-center py-16 border ${tabConfig.borderColor} bg-slate-900/50 backdrop-blur transition-all duration-500 ${entered ? 'sl-card-enter' : 'opacity-0'}`}
               style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}>
            <tabConfig.icon className={`w-16 h-16 ${tabConfig.textColor} opacity-30 mx-auto mb-4`} />
            <h3 className="text-lg font-semibold text-slate-400">{tabConfig.emptyText}</h3>
            <p className="text-slate-600 text-sm mt-1">{tabConfig.emptyDesc}</p>
          </div>
        ) : (
          currentMissions.map((mission, index) => (
            <MissionCard
              key={mission.user_mission_id}
              mission={mission}
              tabConfig={tabConfig}
              onClaim={handleClaim}
              claiming={claimingId === mission.user_mission_id}
              index={index}
              entered={entered}
            />
          ))
        )}
      </div>

      {/* Reset timer */}
      <ResetTimer activeTab={activeTab} entered={entered} />
    </div>
  )
}

const MissionCard = ({ mission, tabConfig, onClaim, claiming, index, entered }) => {
  const missionImage = MISSION_IMAGE_MAP[mission.icon] || DEFAULT_MISSION_IMAGE
  const progress = mission.progress || 0
  const goal = mission.goal_value || 1
  const percentage = Math.min((progress / goal) * 100, 100)
  const isClaimed = mission.status === 'claimed'
  const isCompleted = mission.status === 'completed'
  const isActive = mission.status === 'active'

  return (
    <div
      className={`relative overflow-hidden border transition-all duration-300 ${
        entered ? 'sl-card-enter' : 'opacity-0'
      } ${
        isClaimed
          ? 'bg-slate-900/30 border-slate-700/20 opacity-50'
          : isCompleted
            ? `bg-slate-800/60 ${tabConfig.borderColor} backdrop-blur`
            : 'bg-slate-900/50 border-slate-700/30 hover:border-slate-600/50 backdrop-blur'
      }`}
      style={{
        animationDelay: `${0.3 + index * 0.1}s`,
        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
        ...(isCompleted ? { animation: `sl-complete-pulse 2.5s ease-in-out infinite, sl-fade-in 0.5s ease-out ${0.3 + index * 0.1}s both` } : {}),
      }}
    >
      {/* Completed glow top border */}
      {isCompleted && (
        <div className={`absolute top-0 left-[10px] right-0 h-[1px] bg-gradient-to-r ${tabConfig.color} opacity-60`} />
      )}

      {/* Scan line overlay for active cards */}
      {!isClaimed && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.02]">
          <div className="absolute left-0 w-full h-[1px] bg-blue-400"
               style={{ animation: 'sl-scan-line 6s linear infinite', animationDelay: `${index * 0.5}s` }} />
        </div>
      )}

      <div className="p-4 relative">
        <div className="flex items-start gap-4">
          {/* Icon with glow */}
          <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center border ${
            isClaimed
              ? 'bg-slate-800/50 border-slate-700/30'
              : isCompleted
                ? `bg-gradient-to-br ${tabConfig.color} border-transparent shadow-lg`
                : `bg-slate-800/80 ${tabConfig.borderColor}`
          }`}
               style={{
                 clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                 ...(isCompleted ? { boxShadow: `0 0 15px ${tabConfig.glowColor}` } : {}),
               }}
          >
            {isClaimed ? (
              <CheckCircle className="w-6 h-6 text-slate-600" />
            ) : missionImage.startsWith('/') ? (
              <img src={assetUrl(missionImage)} alt="" className="w-9 h-9 object-contain" />
            ) : (
              <span className="text-2xl">{missionImage}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className={`font-semibold truncate ${
                isClaimed ? 'text-slate-600 line-through' : 'text-slate-200'
              }`}>
                {mission.title}
              </h3>
              {/* Rewards */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {mission.reward_xp > 0 && (
                  <div className={`flex flex-col items-center ${isClaimed ? 'opacity-30' : ''}`}>
                    <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-6 h-6" />
                    <span className={`text-[10px] font-bold ${isClaimed ? 'text-slate-600' : 'text-amber-400'}`}
                          style={!isClaimed ? { animation: 'sl-reward-glow 3s ease-in-out infinite' } : {}}>
                      {mission.reward_xp}
                    </span>
                  </div>
                )}
                {mission.reward_gems > 0 && (
                  <div className={`flex flex-col items-center ${isClaimed ? 'opacity-30' : ''}`}>
                    <img src={assetUrl('/image/study/gem.png')} alt="Gems" className="w-6 h-6" />
                    <span className={`text-[10px] font-bold ${isClaimed ? 'text-slate-600' : 'text-purple-400'}`}
                          style={!isClaimed ? { animation: 'sl-reward-glow 3s ease-in-out infinite 0.5s' } : {}}>
                      {mission.reward_gems}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <p className={`text-sm mt-0.5 ${isClaimed ? 'text-slate-700' : 'text-slate-400'}`}>
              {mission.description}
            </p>

            {/* Progress bar */}
            {!isCompleted && (
              <div className="mt-3">
                <div className={`relative h-5 overflow-hidden ${isClaimed ? 'bg-slate-800/30' : 'bg-slate-800'} border ${isClaimed ? 'border-slate-700/20' : 'border-slate-700/50'}`}
                     style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}>
                  <div
                    className={`h-full transition-all duration-700 ${
                      isClaimed ? 'bg-slate-700' : `bg-gradient-to-r ${tabConfig.color}`
                    }`}
                    style={{ width: `${percentage}%` }}
                  >
                    {!isClaimed && percentage > 0 && (
                      <div className="absolute inset-0 bg-white/10 animate-[shimmer_2s_infinite]" />
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs">
                    <span className={`font-mono font-bold ${isClaimed ? 'text-slate-600' : 'text-slate-300'}`}>
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
            className={`mt-3 w-full py-2.5 font-bold text-sm transition-all
              bg-gradient-to-r ${tabConfig.color} text-white
              hover:brightness-110 active:brightness-90
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 tracking-wider uppercase`}
            style={{
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
              boxShadow: `0 0 20px ${tabConfig.glowColor}`,
            }}
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
          <div className="mt-3 w-full py-2 text-center text-xs text-slate-600 font-medium flex items-center justify-center gap-1.5 tracking-wider uppercase">
            <CheckCircle className="w-3.5 h-3.5" />
            Đã nhận thưởng
          </div>
        )}
      </div>
    </div>
  )
}

const ResetTimer = ({ activeTab, entered }) => {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))

      let target
      if (activeTab === 'daily') {
        target = new Date(vnNow)
        target.setDate(target.getDate() + 1)
        target.setHours(0, 0, 0, 0)
      } else if (activeTab === 'weekly') {
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
    <div className={`mt-6 text-center transition-all duration-500 ${entered ? 'sl-card-enter' : 'opacity-0'}`}
         style={{ animationDelay: '0.8s' }}>
      <div className="inline-flex items-center gap-3 border border-slate-700/50 bg-slate-900/60 backdrop-blur px-5 py-2.5"
           style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}>
        <Clock className="w-4 h-4 text-blue-400/60" />
        <span className="text-xs text-slate-500 tracking-wider uppercase">Làm mới sau</span>
        <span className="font-mono font-bold text-blue-400 text-sm tracking-widest sl-flicker">{timeLeft}</span>
      </div>
    </div>
  )
}

export default MissionBoard
