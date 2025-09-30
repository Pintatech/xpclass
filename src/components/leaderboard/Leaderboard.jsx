import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import { getVietnamDate, utcToVietnamDate } from '../../utils/vietnamTime'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { Trophy, Medal, Award, Crown, Star, RefreshCw } from 'lucide-react'

const Leaderboard = () => {
  const [timeframe, setTimeframe] = useState('week')
  const [leaderboardData, setLeaderboardData] = useState([])
  const [currentUserRank, setCurrentUserRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const { studentLevels } = useStudentLevels()

  useEffect(() => {
    fetchLeaderboardData()
  }, [timeframe])

  // Function to get level and badge info based on XP
  const getUserLevelInfo = (userXp) => {
    if (!studentLevels || studentLevels.length === 0) {
      return { level: 1, badge: { name: 'Newcomer', icon: '👤', tier: 'default' } }
    }

    // Find current level (highest level where xp_required <= userXp)
    const currentLevel = studentLevels
      .filter(level => userXp >= level.xp_required)
      .sort((a, b) => b.level_number - a.level_number)[0]

    if (!currentLevel) {
      return { level: 1, badge: { name: 'Newcomer', icon: '👤', tier: 'default' } }
    }

    return {
      level: currentLevel.level_number,
      badge: {
        name: currentLevel.badge_name,
        icon: currentLevel.badge_icon,
        tier: currentLevel.badge_tier
      }
    }
  }

  // Function to get next level number
  const getNextLevelNumber = (userXp) => {
    if (!studentLevels || studentLevels.length === 0) {
      return 2
    }

    // Find next level (lowest level where xp_required > userXp)
    const nextLevel = studentLevels
      .filter(level => userXp < level.xp_required)
      .sort((a, b) => a.level_number - b.level_number)[0]

    return nextLevel ? nextLevel.level_number : studentLevels[studentLevels.length - 1].level_number + 1
  }

  // Function to get XP required for next level
  const getNextLevelXpRequired = (userXp) => {
    if (!studentLevels || studentLevels.length === 0) {
      return 1000 - userXp
    }

    // Find next level (lowest level where xp_required > userXp)
    const nextLevel = studentLevels
      .filter(level => userXp < level.xp_required)
      .sort((a, b) => a.level_number - b.level_number)[0]

    if (!nextLevel) {
      // User is at max level
      return 0
    }

    return nextLevel.xp_required - userXp
  }

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      let leaderboardQuery

      // Define date ranges for filtering
      const vietnamToday = getVietnamDate()
      const currentDate = new Date(vietnamToday)

      if (timeframe === 'today') {
        // Get users based on XP earned today (from completed exercises)
        console.log('Today leaderboard - Vietnam date:', vietnamToday)
        leaderboardQuery = await getTimeframeLeaderboard('today', vietnamToday)
      } else if (timeframe === 'week') {
        // Get last 7 days (including today)
        const weekStart = new Date(currentDate)
        weekStart.setDate(weekStart.getDate() - 6)
        leaderboardQuery = await getTimeframeLeaderboard('week', weekStart.toISOString().split('T')[0])
      } else if (timeframe === 'month') {
        // Get current month
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        leaderboardQuery = await getTimeframeLeaderboard('month', monthStart.toISOString().split('T')[0])
      } else {
        // All time - use existing logic
        leaderboardQuery = await getAllTimeLeaderboard()
      }

      const { users, userXpCounts, exerciseCounts } = leaderboardQuery

      // Format leaderboard data
      const formattedData = users.map((user, index) => {
        const levelInfo = getUserLevelInfo(user.xp || 0)
        const timeframeXp = userXpCounts[user.id] || 0

        return {
          id: user.id,
          rank: index + 1,
          name: user.full_name || user.email.split('@')[0],
          email: user.email,
          xp: timeframe === 'all' ? (user.xp || 0) : timeframeXp,
          totalXp: user.xp || 0, // Always show total XP for level calculation
          level: levelInfo.level,
          badge: levelInfo.badge,
          avatar: user.avatar_url,
          streak: user.streak_count || 0,
          completedExercises: exerciseCounts[user.id] || 0,
          isCurrentUser: user.id === user?.id
        }
      })

      setLeaderboardData(formattedData)

      // Find current user's rank
      if (user) {
        const userRank = formattedData.find(u => u.id === user.id)
        setCurrentUserRank(userRank)
      }

    } catch (err) {
      console.error('Error fetching leaderboard:', err)
      setError('Không thể tải dữ liệu bảng xếp hạng')
    } finally {
      setLoading(false)
    }
  }

  // Get all-time leaderboard (existing logic)
  const getAllTimeLeaderboard = async () => {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        xp,
        current_level,
        streak_count,
        avatar_url,
        created_at
      `)
      .order('xp', { ascending: false })
      .limit(50)

    if (usersError) throw usersError

    const userIds = users.map(u => u.id)
    const { data: progressData, error: progressError } = await supabase
      .from('user_progress')
      .select('user_id')
      .eq('status', 'completed')
      .in('user_id', userIds)

    if (progressError) throw progressError

    const exerciseCounts = progressData.reduce((acc, progress) => {
      acc[progress.user_id] = (acc[progress.user_id] || 0) + 1
      return acc
    }, {})

    const userXpCounts = users.reduce((acc, user) => {
      acc[user.id] = user.xp || 0
      return acc
    }, {})

    return { users, userXpCounts, exerciseCounts }
  }

  // Get timeframe-based leaderboard
  const getTimeframeLeaderboard = async (period, startDate) => {
    // First get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        xp,
        current_level,
        streak_count,
        avatar_url,
        created_at
      `)
      .limit(200) // Get more users for filtering

    if (usersError) throw usersError

    const userIds = users.map(u => u.id)

    // Get user progress in the timeframe with XP data
    let progressQuery = supabase
      .from('user_progress')
      .select('user_id, xp_earned, completed_at')
      .eq('status', 'completed')
      .in('user_id', userIds)
      .not('xp_earned', 'is', null)

    if (period === 'today') {
      // Filter by Vietnam date - need to handle timezone properly
      const startOfDay = new Date(startDate + 'T00:00:00+07:00').toISOString()
      const endOfDay = new Date(startDate + 'T23:59:59+07:00').toISOString()
      progressQuery = progressQuery.gte('completed_at', startOfDay)
                                  .lte('completed_at', endOfDay)
    } else {
      progressQuery = progressQuery.gte('completed_at', startDate + 'T00:00:00')
    }

    const { data: progressData, error: progressError } = await progressQuery

    if (progressError) throw progressError

    // Calculate XP earned in timeframe per user
    const userXpCounts = {}
    const exerciseCounts = {}

    progressData.forEach(progress => {
      const vietnamDate = utcToVietnamDate(progress.completed_at)

      // Double-check date filtering for accuracy
      let includeInTimeframe = false
      if (period === 'today') {
        includeInTimeframe = vietnamDate === startDate
      } else if (period === 'week') {
        includeInTimeframe = vietnamDate >= startDate.split('T')[0] // Compare just the date part
      } else if (period === 'month') {
        includeInTimeframe = vietnamDate >= startDate.split('T')[0] // Compare just the date part
      }

      if (includeInTimeframe) {
        userXpCounts[progress.user_id] = (userXpCounts[progress.user_id] || 0) + (progress.xp_earned || 0)
        exerciseCounts[progress.user_id] = (exerciseCounts[progress.user_id] || 0) + 1
      }
    })

    // Sort users by timeframe XP
    const filteredUsers = users
      .filter(user => userXpCounts[user.id] > 0) // Only show users with XP in timeframe
      .sort((a, b) => (userXpCounts[b.id] || 0) - (userXpCounts[a.id] || 0))
      .slice(0, 50)

    return { users: filteredUsers, userXpCounts, exerciseCounts }
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Award className="w-6 h-6 text-orange-400" />
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold">{rank}</span>
    }
  }

  const getRankColor = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300'
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
      case 3:
        return 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300'
      default:
        return 'bg-white border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bảng xếp hạng</h1>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
        <div className="flex justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-600" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bảng xếp hạng</h1>
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchLeaderboardData} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Thử lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Bảng xếp hạng</h1>
        <p className="text-gray-600">
          {timeframe === 'today' && 'XP kiếm được hôm nay'}
          {timeframe === 'week' && 'XP kiếm được tuần này'}
          {timeframe === 'month' && 'XP kiếm được tháng này'}
          {timeframe === 'all' && 'Tổng XP tích lũy'}
        </p>
      </div>

      {/* Timeframe Filter */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'today', label: 'Hôm nay' },
            { key: 'week', label: 'Tuần này' },
            { key: 'month', label: 'Tháng này' },
            { key: 'all', label: 'Tất cả' }
          ].map((option) => (
            <Button
              key={option.key}
              variant={timeframe === option.key ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTimeframe(option.key)}
              className="mx-1"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button
          onClick={fetchLeaderboardData}
          variant="ghost"
          size="sm"
          className="ml-4"
          title="Làm mới"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Top 3 Podium */}
      {leaderboardData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 2nd Place */}
          {leaderboardData[1] && (
            <div className="md:order-1 order-2">
              <Card className="text-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-gray-400 overflow-hidden">
                  {leaderboardData[1].avatar ? (
                    leaderboardData[1].avatar.startsWith('http') ? (
                      <img
                        src={leaderboardData[1].avatar}
                        alt={leaderboardData[1].name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'inline'
                        }}
                      />
                    ) : (
                      <span className="text-2xl">{leaderboardData[1].avatar}</span>
                    )
                  ) : (
                    <span className="text-2xl">{leaderboardData[1].name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="text-2xl hidden">{leaderboardData[1].name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="font-bold text-gray-900">{leaderboardData[1].name}</div>
                <div className="text-sm text-gray-600">Level {leaderboardData[1].level} • {leaderboardData[1].badge.name}</div>
                <div className="text-lg font-semibold text-gray-900 mt-2">
                  {leaderboardData[1].xp.toLocaleString()} XP
                </div>
              </Card>
            </div>
          )}

          {/* 1st Place */}
          {leaderboardData[0] && (
            <div className="md:order-2 order-1">
              <Card className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 transform scale-105">
                <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-yellow-500 overflow-hidden">
                  {leaderboardData[0].avatar ? (
                    leaderboardData[0].avatar.startsWith('http') ? (
                      <img
                        src={leaderboardData[0].avatar}
                        alt={leaderboardData[0].name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'inline'
                        }}
                      />
                    ) : (
                      <span className="text-3xl">{leaderboardData[0].avatar}</span>
                    )
                  ) : (
                    <span className="text-3xl">{leaderboardData[0].name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="text-3xl hidden">{leaderboardData[0].name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="font-bold text-gray-900 text-lg">{leaderboardData[0].name}</div>
                <div className="text-sm text-gray-600">Level {leaderboardData[0].level} • {leaderboardData[0].badge.name}</div>
                <div className="text-xl font-bold text-yellow-600 mt-2">
                  {leaderboardData[0].xp.toLocaleString()} XP
                </div>
                <div className="flex items-center justify-center mt-2 text-yellow-600">
                  <Star size={16} fill="currentColor" />
                  <span className="ml-1 text-sm">Vua học tập</span>
                </div>
              </Card>
            </div>
          )}

          {/* 3rd Place */}
          {leaderboardData[2] && (
            <div className="md:order-3 order-3">
              <Card className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-orange-400 overflow-hidden">
                  {leaderboardData[2].avatar ? (
                    leaderboardData[2].avatar.startsWith('http') ? (
                      <img
                        src={leaderboardData[2].avatar}
                        alt={leaderboardData[2].name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'inline'
                        }}
                      />
                    ) : (
                      <span className="text-2xl">{leaderboardData[2].avatar}</span>
                    )
                  ) : (
                    <span className="text-2xl">{leaderboardData[2].name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="text-2xl hidden">{leaderboardData[2].name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="font-bold text-gray-900">{leaderboardData[2].name}</div>
                <div className="text-sm text-gray-600">Level {leaderboardData[2].level} • {leaderboardData[2].badge.name}</div>
                <div className="text-lg font-semibold text-gray-900 mt-2">
                  {leaderboardData[2].xp.toLocaleString()} XP
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
            Bảng xếp hạng chi tiết
          </h3>
        </Card.Header>
        <Card.Content className="p-0">
          <div className="space-y-2">
            {leaderboardData.map((user) => (
              <div
                key={user.id}
                className={`p-4 border-l-4 ${getRankColor(user.rank)} flex items-center justify-between`}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-8 h-8">
                    {getRankIcon(user.rank)}
                  </div>

                  <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-gray-300 overflow-hidden">
                    {user.avatar ? (
                      user.avatar.startsWith('http') ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'inline'
                          }}
                        />
                      ) : (
                        <span className="text-lg">{user.avatar}</span>
                      )
                    ) : (
                      <span className="text-lg">{user.name.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="text-lg hidden">{user.name.charAt(0).toUpperCase()}</span>
                  </div>

                  <div>
                    <div className="font-semibold text-gray-900">{user.name}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-600">Level {user.level} • {user.badge.name}</span>
                      <span className="text-sm text-gray-600">• {user.completedExercises} bài tập</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-lg text-gray-900">
                    {user.xp.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">XP</div>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      {/* Your Rank */}
      {currentUserRank && (
        <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 border-primary-200">
          <Card.Content>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-primary-500 overflow-hidden">
                  {currentUserRank.avatar ? (
                    currentUserRank.avatar.startsWith('http') ? (
                      <img
                        src={currentUserRank.avatar}
                        alt={currentUserRank.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'inline'
                        }}
                      />
                    ) : (
                      <span className="text-lg">{currentUserRank.avatar}</span>
                    )
                  ) : (
                    <span className="text-lg">{currentUserRank.name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="text-lg hidden">{currentUserRank.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Bạn ({currentUserRank.name})</div>
                  <div className="text-sm text-gray-600">Hạng #{currentUserRank.rank} • Level {currentUserRank.level} • {currentUserRank.badge.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-gray-900">{currentUserRank.xp.toLocaleString()}</div>
                <div className="text-sm text-gray-600">XP</div>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Achievement Goals */}
      {currentUserRank && (
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Mục tiêu tiếp theo</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-4">
              {/* Next level goal */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Award className="w-5 h-5 text-orange-600" />
                  <span className="text-gray-900">Lên cấp {getNextLevelNumber(currentUserRank.xp)}</span>
                </div>
                <span className="text-sm text-gray-600">
                  Cần thêm {getNextLevelXpRequired(currentUserRank.xp).toLocaleString()} XP
                </span>
              </div>

              {/* Rank improvement goal */}
              {currentUserRank.rank > 1 && leaderboardData[currentUserRank.rank - 2] && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Medal className="w-5 h-5 text-gray-600" />
                    <span className="text-gray-900">
                      Vượt qua {leaderboardData[currentUserRank.rank - 2].name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    Cần thêm {(leaderboardData[currentUserRank.rank - 2].xp - currentUserRank.xp + 1).toLocaleString()} XP
                  </span>
                </div>
              )}

              {/* Top 10 goal */}
              {currentUserRank.rank > 10 && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    <span className="text-gray-900">Vào top 10</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {leaderboardData[9] ?
                      `Cần thêm ${Math.max(1, leaderboardData[9].xp - currentUserRank.xp + 1).toLocaleString()} XP` :
                      'Đang tính toán...'
                    }
                  </span>
                </div>
              )}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  )
}

export default Leaderboard