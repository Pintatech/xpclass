import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import Card from '../ui/Card'
import Button from '../ui/Button'
// Thay spinner bằng skeleton để tránh chớp màn hình khi điều hướng
import { 
  Star, 
  Lock, 
  CheckCircle, 
  BookOpen, 
  Trophy,
  ArrowRight,
  Target
} from 'lucide-react'

const LevelList = () => {
  const [levels, setLevels] = useState([])
  const [levelProgress, setLevelProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()

  // Skeletons
  const SkeletonCard = () => (
    <div className="relative overflow-hidden transition-all duration-300 border rounded-lg p-6 bg-white animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-gray-200" />
          <div>
            <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-24" />
          </div>
        </div>
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
      <div className="h-2 bg-gray-100 rounded w-full" />
    </div>
  )

  useEffect(() => {
    if (user) {
      fetchLevelsAndProgress()
    }
  }, [user])

  const fetchLevelsAndProgress = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all levels
      const { data: levelsData, error: levelsError } = await supabase
        .from('levels')
        .select('*')
        .eq('is_active', true)
        .order('level_number')

      if (levelsError) throw levelsError

      // Fetch user's level progress
      const { data: progressData, error: progressError } = await supabase
        .from('level_progress')
        .select('*')
        .eq('user_id', user.id)

      if (progressError) throw progressError

      // Create progress map
      const progressMap = {}
      progressData?.forEach(progress => {
        progressMap[progress.level_id] = progress
      })

      setLevels(levelsData || [])
      setLevelProgress(progressMap)
    } catch (err) {
      console.error('Error fetching levels:', err)
      setError('Không thể tải danh sách level')
    } finally {
      setLoading(false)
    }
  }

  const getThemeColors = (colorTheme) => {
    const themes = {
      green: {
        bg: 'from-green-400 to-emerald-500',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: 'bg-green-100 text-green-600'
      },
      blue: {
        bg: 'from-blue-400 to-indigo-500', 
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: 'bg-blue-100 text-blue-600'
      },
      purple: {
        bg: 'from-purple-400 to-pink-500',
        text: 'text-purple-700', 
        border: 'border-purple-200',
        icon: 'bg-purple-100 text-purple-600'
      },
      orange: {
        bg: 'from-orange-400 to-red-500',
        text: 'text-orange-700',
        border: 'border-orange-200', 
        icon: 'bg-orange-100 text-orange-600'
      }
    }
    return themes[colorTheme] || themes.blue
  }

  const getLevelStatus = (level) => {
    const progress = levelProgress[level.id]
    
    // All levels are now always available (unlocked)
    if (!progress) {
      return { status: 'available', canAccess: true }
    }

    return {
      status: progress.status,
      canAccess: true // Always allow access
    }
  }

  const renderLevelCard = (level, index) => {
    const { status, canAccess } = getLevelStatus(level)
    const progress = levelProgress[level.id]
    const theme = getThemeColors(level.color_theme)
    const isLocked = !canAccess

    return (
      <Card 
        key={level.id} 
        className={`relative overflow-hidden transition-all duration-300 ${
          isLocked 
            ? 'opacity-60 cursor-not-allowed' 
            : 'hover:shadow-lg hover:scale-105 cursor-pointer'
        } ${theme.border}`}
      >
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-10`} />
        
        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-full ${theme.icon} flex items-center justify-center`}>
                {isLocked ? (
                  <Lock className="w-6 h-6" />
                ) : status === 'completed' ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <BookOpen className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{level.title}</h3>
                <p className="text-sm text-gray-600">{level.difficulty_label}</p>
              </div>
            </div>
            
            {/* Level number badge */}
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
              <span className="text-sm font-bold text-gray-700">{level.level_number}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-700 mb-4 line-clamp-2">{level.description}</p>

          {/* Progress bar (if started) */}
          {progress && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Tiến độ</span>
                <span>{progress.progress_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`bg-gradient-to-r ${theme.bg} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${progress.progress_percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{progress.units_completed}/{progress.total_units} units</span>
                <span>{progress.xp_earned} XP</span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Target className="w-4 h-4 text-gray-500 mr-1" />
                <span className="text-sm text-gray-600">XP cần</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {level.unlock_requirement}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Trophy className="w-4 h-4 text-gray-500 mr-1" />
                <span className="text-sm text-gray-600">Phần thưởng</span>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {status === 'completed' ? 'Hoàn thành' : 'Chưa'}
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-center">
            <Link to={`/study/level/${level.id}`} className="w-full">
              <Button className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700">
                {status === 'completed' ? 'Xem lại' : 
                 status === 'in_progress' ? 'Tiếp tục' : 'Bắt đầu'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>


      </Card>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="h-8 bg-gray-200 rounded w-40 mx-auto mb-4 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-2/3 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={fetchLevelsAndProgress} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Chọn Level</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Bắt đầu hành trình học ngôn ngữ của bạn. Mỗi level được thiết kế để giúp bạn 
          phát triển từng bước một cách hiệu quả và vui vẻ.
        </p>
      </div>

      {/* Current user stats */}
      <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 border-primary-200">
        <Card.Content className="p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-primary-700">{user?.profile?.current_level || 1}</div>
              <div className="text-sm text-gray-600">Level hiện tại</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-secondary-700">{user?.profile?.xp || 0}</div>
              <div className="text-sm text-gray-600">Tổng XP</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{user?.profile?.streak_count || 0}</div>
              <div className="text-sm text-gray-600">Chuỗi ngày</div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Levels grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {levels.map((level, index) => renderLevelCard(level, index))}
      </div>

      {/* Empty state */}
      {levels.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có level nào</h3>
          <p className="text-gray-600">Các level học tập sẽ sớm được cập nhật!</p>
        </div>
      )}
    </div>
  )
}

export default LevelList
