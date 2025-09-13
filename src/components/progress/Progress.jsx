import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
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
  const { profile } = useAuth()
  const { getCompletedExercises, getTotalStudyTime, getProgressPercentage, getXPForNextLevel } = useProgress()
  const [selectedPeriod, setSelectedPeriod] = useState('week')

  const completedExercises = getCompletedExercises()
  const totalStudyTime = getTotalStudyTime()
  const progressPercentage = getProgressPercentage()
  const xpForNextLevel = getXPForNextLevel()

  const weeklyData = [
    { day: 'T2', xp: 250, exercises: 3, time: 45 },
    { day: 'T3', xp: 180, exercises: 2, time: 30 },
    { day: 'T4', xp: 320, exercises: 4, time: 60 },
    { day: 'T5', xp: 0, exercises: 0, time: 0 },
    { day: 'T6', xp: 420, exercises: 5, time: 75 },
    { day: 'T7', xp: 280, exercises: 3, time: 50 },
    { day: 'CN', xp: 150, exercises: 2, time: 25 }
  ]

  const achievements = [
    {
      id: 1,
      title: 'Người mới bắt đầu',
      description: 'Hoàn thành 5 bài tập đầu tiên',
      icon: Star,
      color: 'bg-yellow-500',
      unlocked: true,
      date: '2024-01-15'
    },
    {
      id: 2,
      title: 'Học viên chăm chỉ',
      description: 'Học 7 ngày liên tiếp',
      icon: Flame,
      color: 'bg-red-500',
      unlocked: true,
      date: '2024-01-20'
    },
    {
      id: 3,
      title: 'Bậc thầy phát âm',
      description: 'Đạt 90% độ chính xác trong phát âm',
      icon: Trophy,
      color: 'bg-blue-500',
      unlocked: false,
      progress: 75
    },
    {
      id: 4,
      title: 'Kỷ lục gia',
      description: 'Học 100 bài tập',
      icon: Target,
      color: 'bg-green-500',
      unlocked: false,
      progress: 45
    }
  ]

  const maxXP = Math.max(...weeklyData.map(d => d.xp))

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
              <div className="text-lg font-bold text-gray-900">{profile?.level || 1}</div>
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
                  {profile?.level || 1}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Cấp {profile?.level || 1}</div>
                  <div className="text-sm text-gray-600">{profile?.xp || 0} XP</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">Cấp {(profile?.level || 1) + 1}</div>
                <div className="text-sm text-gray-600">Còn {xpForNextLevel} XP</div>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-gradient-to-r from-primary-600 to-secondary-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${progressPercentage}%` }}
              >
                <span className="text-xs text-white font-medium">
                  {Math.round(progressPercentage)}%
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
                  <span className="font-medium">45 phút</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tuần này:</span>
                  <span className="font-medium">4.5 giờ</span>
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
              {[...Array(30)].map((_, index) => {
                const hasActivity = Math.random() > 0.3
                const intensity = Math.random()
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-sm ${
                      hasActivity
                        ? intensity > 0.7
                          ? 'bg-green-600'
                          : intensity > 0.4
                          ? 'bg-green-400'
                          : 'bg-green-200'
                        : 'bg-gray-100'
                    }`}
                    title={hasActivity ? `${Math.floor(intensity * 100)} XP` : 'Không có hoạt động'}
                  />
                )
              })}
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
            {achievements.map((achievement) => (
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
                    <achievement.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{achievement.title}</div>
                    <div className="text-sm text-gray-600">{achievement.description}</div>
                    
                    {achievement.unlocked ? (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ Đã mở khóa • {achievement.date}
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
                          {achievement.progress}% hoàn thành
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    </div>
  )
}

export default Progress
