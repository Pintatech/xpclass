import { useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { Trophy, Medal, Award, Crown, Star } from 'lucide-react'

const Leaderboard = () => {
  const [timeframe, setTimeframe] = useState('week')

  const leaderboardData = [
    {
      id: 1,
      rank: 1,
      name: 'Nguyễn Văn A',
      avatar: '/avatars/user1.jpg',
      xp: 12450,
      level: 15,
      streak: 25,
      completedExercises: 120
    },
    {
      id: 2,
      rank: 2,
      name: 'Trần Thị B',
      avatar: '/avatars/user2.jpg',
      xp: 11800,
      level: 14,
      streak: 18,
      completedExercises: 115
    },
    {
      id: 3,
      rank: 3,
      name: 'Lê Minh C',
      avatar: '/avatars/user3.jpg',
      xp: 10900,
      level: 13,
      streak: 22,
      completedExercises: 98
    },
    {
      id: 4,
      rank: 4,
      name: 'Phạm Thị D',
      avatar: '/avatars/user4.jpg',
      xp: 9850,
      level: 12,
      streak: 15,
      completedExercises: 89
    },
    {
      id: 5,
      rank: 5,
      name: 'Hoàng Văn E',
      avatar: '/avatars/user5.jpg',
      xp: 8900,
      level: 11,
      streak: 12,
      completedExercises: 76
    }
  ]

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
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* 2nd Place */}
        <div className="md:order-1 order-2">
          <Card className="text-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300">
            <div className="w-16 h-16 bg-gray-400 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl">
              2
            </div>
            <div className="font-bold text-gray-900">{leaderboardData[1].name}</div>
            <div className="text-gray-600 text-sm">Cấp {leaderboardData[1].level}</div>
            <div className="text-lg font-semibold text-gray-900 mt-2">
              {leaderboardData[1].xp.toLocaleString()} XP
            </div>
          </Card>
        </div>

        {/* 1st Place */}
        <div className="md:order-2 order-1">
          <Card className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 transform scale-105">
            <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl">
              1
            </div>
            <div className="font-bold text-gray-900 text-lg">{leaderboardData[0].name}</div>
            <div className="text-gray-600">Cấp {leaderboardData[0].level}</div>
            <div className="text-xl font-bold text-yellow-600 mt-2">
              {leaderboardData[0].xp.toLocaleString()} XP
            </div>
            <div className="flex items-center justify-center mt-2 text-yellow-600">
              <Star size={16} fill="currentColor" />
              <span className="ml-1 text-sm">Vua học tập</span>
            </div>
          </Card>
        </div>

        {/* 3rd Place */}
        <div className="md:order-3 order-3">
          <Card className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300">
            <div className="w-16 h-16 bg-orange-400 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl">
              3
            </div>
            <div className="font-bold text-gray-900">{leaderboardData[2].name}</div>
            <div className="text-gray-600 text-sm">Cấp {leaderboardData[2].level}</div>
            <div className="text-lg font-semibold text-gray-900 mt-2">
              {leaderboardData[2].xp.toLocaleString()} XP
            </div>
          </Card>
        </div>
      </div>

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
                    <div className="text-sm text-gray-600">
                      Cấp {user.level} • {user.completedExercises} bài tập
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
      <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 border-primary-200">
        <Card.Content>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white font-bold">
                B
              </div>
              <div>
                <div className="font-semibold text-gray-900">Bạn</div>
                <div className="text-sm text-gray-600">Hạng #15</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg text-gray-900">5,230</div>
              <div className="text-sm text-gray-600">XP</div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Achievement Goals */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-semibold text-gray-900">Mục tiêu tiếp theo</h3>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Medal className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Vào top 10</span>
              </div>
              <span className="text-sm text-gray-600">Cần thêm 2,340 XP</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Award className="w-5 h-5 text-orange-600" />
                <span className="text-gray-900">Lên cấp 12</span>
              </div>
              <span className="text-sm text-gray-600">Cần thêm 770 XP</span>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  )
}

export default Leaderboard
