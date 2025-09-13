import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import { 
  ArrowLeft,
  Star, 
  Lock, 
  CheckCircle, 
  BookOpen, 
  ArrowRight,
  Target,
  PlayCircle,
  Play,
  Circle,
  Flame
} from 'lucide-react'

const UnitList = () => {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const [level, setLevel] = useState(null)
  const [units, setUnits] = useState([])
  const [unitProgress, setUnitProgress] = useState({})
  const [userStats, setUserStats] = useState({ xp: 0, streak: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user && levelId) {
      fetchLevelAndUnits()
    }
  }, [user, levelId])

  const fetchLevelAndUnits = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch level info
      const { data: levelData, error: levelError } = await supabase
        .from('levels')
        .select('*')
        .eq('id', levelId)
        .single()

      if (levelError) throw levelError

      // Fetch user stats (XP and streak)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('xp, streak_count')
        .eq('id', user.id)
        .single()

      if (userError) {
        console.error('Error fetching user stats:', userError)
      } else {
        setUserStats({
          xp: userData?.xp || 0,
          streak: userData?.streak_count || 0
        })
      }

      // Fetch units for this level
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('level_id', levelId)
        .eq('is_active', true)
        .order('unit_number')

      if (unitsError) throw unitsError

      // Fetch sessions for these units to calculate progress
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .in('unit_id', unitsData?.map(u => u.id) || [])
        .eq('is_active', true)

      if (sessionsError) throw sessionsError

      // Get all session IDs for these units
      const sessionIds = sessionsData?.map(s => s.id) || []
      
      // Fetch user's progress for exercises in these sessions
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select(`
          *,
          exercises!inner(
            id,
            session_id,
            sessions!inner(
              id,
              unit_id
            )
          )
        `)
        .eq('user_id', user.id)
        .in('exercises.session_id', sessionIds)

      if (progressError) {
        console.error('Progress fetch error:', progressError)
        // If the complex query fails, try a simpler approach
        const { data: simpleProgressData, error: simpleError } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id)
        
        if (simpleError) throw simpleError
        
        // Calculate progress for each unit with simple data
        const progressMap = {}
        unitsData?.forEach(unit => {
          const unitSessions = sessionsData?.filter(s => s.unit_id === unit.id) || []
          const totalSessions = unitSessions.length
          
          progressMap[unit.id] = {
            unit_id: unit.id,
            total_sessions: totalSessions,
            sessions_completed: 0,
            progress_percentage: 0,
            status: 'not_started',
            xp_earned: 0
          }
        })
        setUnitProgress(progressMap)
        return
      }

      // Calculate progress for each unit
      const progressMap = {}
      unitsData?.forEach(unit => {
        const unitSessions = sessionsData?.filter(s => s.unit_id === unit.id) || []
        const completedExercisesInUnit = progressData?.filter(p => 
          p.exercises?.sessions?.unit_id === unit.id && 
          p.status === 'completed'
        ) || []
        
        const totalSessions = unitSessions.length
        // Count unique sessions that have completed exercises
        const completedSessionIds = new Set(completedExercisesInUnit.map(p => p.exercises.session_id))
        const sessionsCompleted = completedSessionIds.size
        const progressPercentage = totalSessions > 0 ? Math.round((sessionsCompleted / totalSessions) * 100) : 0
        
        progressMap[unit.id] = {
          unit_id: unit.id,
          total_sessions: totalSessions,
          sessions_completed: sessionsCompleted,
          progress_percentage: progressPercentage,
          status: sessionsCompleted === totalSessions && totalSessions > 0 ? 'completed' : 
                 sessionsCompleted > 0 ? 'in_progress' : 'not_started',
          xp_earned: completedExercisesInUnit.reduce((total, p) => total + (p.score || 0), 0)
        }
      })

      setLevel(levelData)
      setUnits(unitsData || [])
      setUnitProgress(progressMap)
    } catch (err) {
      console.error('Error fetching units:', err)
      setError('Không thể tải danh sách unit')
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

  const getUnitStatus = (unit, index) => {
    const progress = unitProgress[unit.id]
    
    // All units are now always available (unlocked)
    if (!progress) {
      return { status: 'available', canAccess: true }
    }

    return {
      status: progress.status,
      canAccess: true // Always allow access
    }
  }

  const renderUnitCard = (unit, index) => {
    const { status, canAccess } = getUnitStatus(unit, index)
    const progress = unitProgress[unit.id]
    const theme = getThemeColors(unit.color_theme || level?.color_theme)
    const isLocked = !canAccess

    return (
      <Card 
        key={unit.id} 
        className={`relative overflow-hidden transition-all duration-300 bg-white border-2 border-blue-800 ${
          isLocked 
            ? 'opacity-60 cursor-not-allowed' 
            : 'hover:shadow-lg hover:scale-105 cursor-pointer'
        }`}
      >
        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isLocked ? 'bg-gray-100 text-gray-600' :
                status === 'completed' ? 'bg-green-100 text-green-600' :
                status === 'in_progress' ? 'bg-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {isLocked ? (
                  <Lock className="w-6 h-6" />
                ) : status === 'completed' ? (
                  <CheckCircle className="w-6 h-6" />
                ) : status === 'in_progress' ? (
                  <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <Play className="w-2 h-2 text-white fill-white" />
                  </div>
                ) : (
                  <Circle className="w-4 h-4 fill-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{unit.title}</h3>
               
              </div>
            </div>
            
            
          </div>

          
          {/* Sessions info (if started) */}
          {progress && (
            <div className="mb-4 ml-16 -mt-2">
              <div className="text-sm">
                <span className={`font-bold ${
                  progress.sessions_completed === progress.total_sessions 
                    ? 'text-green-600' 
                    : 'text-blue-600'
                }`}>
                  {progress.sessions_completed}/{progress.total_sessions} sessions
                </span>
              </div>
            </div>
          )}

          

          {/* Action button */}
          <div className="flex justify-start ml-16">
            {isLocked ? (
              <Button disabled>
                <Lock className="w-4 h-4 mr-2" />
                Hoàn thành unit trước
              </Button>
            ) : (
              <Link to={`/study/level/${levelId}/unit/${unit.id}`}>
                <Button className="bg-blue-800 hover:bg-green-700 text-white rounded-full px-4 py-2">
                  {status === 'completed' ? 'Xem lại' : 
                   status === 'in_progress' ? 'Tiếp tục' : 'Bắt đầu'}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-10 flex items-center justify-center">
            <div className="text-center">
              <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Hoàn thành unit trước</p>
            </div>
          </div>
        )}
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={fetchLevelAndUnits} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!level) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không tìm thấy level</div>
        <Button onClick={() => navigate('/study')} variant="outline">
          Quay lại
        </Button>
      </div>
    )
  }

  const theme = getThemeColors(level.color_theme)

  return (
    <div className="space-y-8">
      {/* Header with Level Image */}
      <div className="relative -mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-6 lg:-mt-6 -mb-4 md:-mb-6 lg:-mb-8">
        {/* Level Image */}
        <div className="relative h-64 md:h-80 overflow-hidden">
          {level.thumbnail_url ? (
            <img 
              src={level.thumbnail_url} 
              alt={level.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${theme.bg} flex items-center justify-center`}>
              <div className="text-center text-white">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-80" />
                <h1 className="text-4xl font-bold">{level.title}</h1>
              </div>
            </div>
          )}
          
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/30" />
          
          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            {/* XP and Streak stats */}
            <div className="flex justify-between">
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-3 flex items-center space-x-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="font-bold text-gray-800">{userStats.streak} </span>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-3 flex items-center space-x-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-gray-800">{userStats.xp}</span>
              </div>
            </div>

            {/* Level title and description */}
            <div className="text-white">
              <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">
                {level.title}
              </h1>
              <p className="text-lg md:text-xl opacity-90 drop-shadow-md max-w-2xl">
                {level.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Level progress summary */}
      <Card className={`bg-gradient-to-r from-${level.color_theme}-50 to-${level.color_theme}-100 border-${level.color_theme}-200`}>
        <Card.Content className="p-6">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className={`text-2xl font-bold ${theme.text}`}>
                {Object.values(unitProgress).filter(p => p.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Units hoàn thành</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${theme.text}`}>
                {Math.round(Object.values(unitProgress).reduce((total, p) => total + (p.progress_percentage || 0), 0) / Math.max(units.length, 1))}%
              </div>
              <div className="text-sm text-gray-600">Tổng tiến độ</div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Units grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map((unit, index) => renderUnitCard(unit, index))}
      </div>

      {/* Empty state */}
      {units.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có unit nào</h3>
          <p className="text-gray-600">Các unit học tập sẽ sớm được cập nhật!</p>
        </div>
      )}
    </div>
  )
}

export default UnitList
