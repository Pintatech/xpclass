import React from 'react'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import { usePvPRank } from '../../hooks/usePvPRank'

const TIER_GRADIENTS = {
  bronze: 'from-orange-400 to-orange-600 shadow-orange-200',
  silver: 'from-gray-300 to-gray-500 shadow-gray-200',
  gold: 'from-yellow-400 to-yellow-600 shadow-yellow-200',
  platinum: 'from-purple-400 to-purple-600 shadow-purple-200',
  diamond: 'from-blue-400 to-cyan-400 shadow-blue-200',
}

const SIZE_CLASSES = {
  small: { badge: 'w-8 h-8', name: 'text-xs', number: 'w-4 h-4 text-[10px]', bar: 'h-1' },
  medium: { badge: 'w-12 h-12', name: 'text-sm', number: 'w-5 h-5 text-xs', bar: 'h-1.5' },
  large: { badge: 'w-16 h-16', name: 'text-base', number: 'w-6 h-6 text-sm', bar: 'h-2' },
}

const PvPRankBadge = ({
  size = 'medium',
  showName = true,
  showLP = true,
  // Optional overrides (for leaderboard rows — pass level/points directly)
  level = null,
  points = null,
  className = '',
}) => {
  const { studentLevels } = useStudentLevels()
  const { rankLevel, rankPoints } = usePvPRank()

  const useLevel = level ?? rankLevel
  const usePoints = points ?? rankPoints

  const badge = studentLevels?.find(l => l.level_number === useLevel)
  if (!badge) {
    return (
      <div className={`inline-flex flex-col items-center ${className}`}>
        <div className={`${SIZE_CLASSES[size].badge} bg-gray-200 rounded-full animate-pulse`} />
      </div>
    )
  }

  const tier = badge.badge_tier || 'bronze'
  const classes = SIZE_CLASSES[size]

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative">
        <div className={`
          ${classes.badge}
          bg-gradient-to-br ${TIER_GRADIENTS[tier]}
          rounded-full flex items-center justify-center
          shadow-lg border-2 border-white relative
        `}>
          {badge.badge_icon?.startsWith('http') ? (
            <img src={badge.badge_icon} alt={badge.badge_name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="font-bold text-white drop-shadow-sm">{badge.badge_icon}</span>
          )}
        </div>
        <div className={`absolute -bottom-1 -right-1 ${classes.number} bg-white text-gray-800 font-bold rounded-full flex items-center justify-center border shadow-sm`}>
          {badge.level_number}
        </div>
      </div>

      {showName && (
        <div className={`text-center mt-1 ${classes.name} font-semibold text-gray-800`}>
          {badge.badge_name}
        </div>
      )}

      {showLP && (
        <div className="w-full mt-1">
          <div className={`w-full bg-gray-200 rounded-full ${classes.bar} overflow-hidden`} style={{ minWidth: '60px' }}>
            <div
              className={`${classes.bar} rounded-full bg-gradient-to-r ${TIER_GRADIENTS[tier].split(' shadow-')[0]}`}
              style={{ width: `${Math.min(100, Math.max(0, usePoints))}%` }}
            />
          </div>
          <div className="text-center text-[10px] text-gray-500 mt-0.5 font-medium">
            {usePoints} LP
          </div>
        </div>
      )}
    </div>
  )
}

export default PvPRankBadge
