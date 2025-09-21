import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { Trophy, Medal, Award, Crown, Star, RefreshCw } from 'lucide-react'

const Leaderboard = () => {
  const [timeframe, setTimeframe] = useState('all')
  const [leaderboardData, setLeaderboardData] = useState([])
  const [currentUserRank, setCurrentUserRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    fetchLeaderboardData()
  }, [timeframe])

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get users with their progress data
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          xp,
          level,
          streak_count,
          created_at
        `)
        .order('xp', { ascending: false })
        .limit(50)

      if (usersError) throw usersError

      // Get exercise completion counts for each user
      const userIds = users.map(u => u.id)
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('user_id')
        .eq('status', 'completed')
        .in('user_id', userIds)

      if (progressError) throw progressError

      // Count completed exercises per user
      const exerciseCounts = progressData.reduce((acc, progress) => {
        acc[progress.user_id] = (acc[progress.user_id] || 0) + 1
        return acc
      }, {})

      // Format leaderboard data
      const formattedData = users.map((user, index) => ({
        id: user.id,
        rank: index + 1,
        name: user.full_name || user.email.split('@')[0],
        email: user.email,
        xp: user.xp || 0,
        level: user.level || 1,
        streak: user.streak_count || 0,
        completedExercises: exerciseCounts[user.id] || 0,
        isCurrentUser: user.id === user?.id
      }))

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
        <p className="text-gray-600">Thành tích của các học viên xuất sắc</p>
      </div>

      {/* Timeframe Filter */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'month', label: 'Tháng này' },
            { key: 'week', label: 'Tuần này' }
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
                <div className="w-16 h-16 bg-gray-400 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl">
                  2
                </div>
                <div className="font-bold text-gray-900">{leaderboardData[1].name}</div>
                <div className="text-sm text-gray-600">Level {Math.floor(leaderboardData[1].xp / 1000) + 1}</div>
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
                <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl">
                  1
                </div>
                <div className="font-bold text-gray-900 text-lg">{leaderboardData[0].name}</div>
                <div className="text-sm text-gray-600">Level {Math.floor(leaderboardData[0].xp / 1000) + 1}</div>
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
                <div className="w-16 h-16 bg-orange-400 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl">
                  3
                </div>
                <div className="font-bold text-gray-900">{leaderboardData[2].name}</div>
                <div className="text-sm text-gray-600">Level {Math.floor(leaderboardData[2].xp / 1000) + 1}</div>
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
                  
                  <div className="w-12 h-12 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white font-bold">
                    {user.name.charAt(0)}
                  </div>

                  <div>
                    <div className="font-semibold text-gray-900">{user.name}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-600">Level {Math.floor(user.xp / 1000) + 1}</span>
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
                <div className="w-12 h-12 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white font-bold">
                  {currentUserRank.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Bạn ({currentUserRank.name})</div>
                  <div className="text-sm text-gray-600">Hạng #{currentUserRank.rank}</div>
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
                  <span className="text-gray-900">Lên cấp {currentUserRank.level + 1}</span>
                </div>
                <span className="text-sm text-gray-600">
                  Cần thêm {((currentUserRank.level + 1) * 1000 - currentUserRank.xp).toLocaleString()} XP
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
                      `Cần thêm ${(leaderboardData[9].xp - currentUserRank.xp + 1).toLocaleString()} XP` :
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
