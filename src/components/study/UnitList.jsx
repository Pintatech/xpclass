import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import Card from '../ui/Card'
import Button from '../ui/Button'
// Thay spinner bằng skeleton để điều hướng mượt hơn
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
  Flame,
  Crown
} from 'lucide-react'

const UnitList = () => {
  const { levelId } = useParams()
  const navigate = useNavigate()
  const [level, setLevel] = useState(null)
  const [units, setUnits] = useState([])
  const [sessions, setSessions] = useState([])
  const [unitProgress, setUnitProgress] = useState({})
  const [sessionProgress, setSessionProgress] = useState({})
  const [userStats, setUserStats] = useState({ xp: 0, streak: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [levels, setLevels] = useState([])
  const [allUnits, setAllUnits] = useState([])
  const { user } = useAuth()

  // Skeletons
  const SkeletonSidebarItem = ({ withChildren = false }) => (
    <div className="border-b border-gray-100 animate-pulse">
      <div className="p-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gray-200" />
          <div className="flex-1 min-w-0">
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-1" />
            <div className="h-2 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      </div>
      {withChildren && (
        <div className="ml-6 space-y-1 pb-3">
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="px-2">
              <div className="h-7 bg-gray-50 rounded-lg flex items-center px-2">
                <div className="w-4 h-4 bg-gray-200 rounded mr-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const SkeletonCard = () => (
    <div className="relative overflow-hidden bg-white border rounded-lg p-6 animate-pulse">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-1/4" />
        </div>
      </div>
      <div className="h-3 bg-gray-100 rounded w-2/3 mt-2" />
    </div>
  )

  useEffect(() => {
    if (user && levelId) {
      fetchLevelAndUnits()
    }
  }, [user, levelId])

  const fetchLevelAndUnits = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [levelResult, allLevelsResult, allUnitsResult] = await Promise.all([
        supabase.from('levels').select('*').eq('id', levelId).single(),
        supabase.from('levels').select('*').order('level_number'),
        supabase.from('units').select('*').order('unit_number')
      ])

      if (levelResult.error) throw levelResult.error
      if (allLevelsResult.error) throw allLevelsResult.error
      if (allUnitsResult.error) throw allUnitsResult.error

      const levelData = levelResult.data

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
        .order('session_number')

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
        setSessions([])
        setSessionProgress({})
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

      // Calculate session progress
      const sessionProgressMap = {}

      // Fetch user's session progress (explicit session_progress rows)
      const { data: sessionProgressData, error: sessionProgressError } = await supabase
        .from('session_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('session_id', sessionIds)

      if (sessionProgressError) {
        console.error('Error fetching session progress:', sessionProgressError)
      }

      // Fetch all exercises for these sessions
      const { data: allExercises, error: exercisesErr } = await supabase
        .from('exercises')
        .select('id, session_id, xp_reward, is_active')
        .in('session_id', sessionIds)
        .eq('is_active', true)

      if (exercisesErr) {
        console.error('Error fetching exercises:', exercisesErr)
      }

      const exerciseIds = allExercises?.map(e => e.id) || []

      // Fetch user's completed exercises among these
      const { data: userCompleted, error: userProgErr } = await supabase
        .from('user_progress')
        .select('exercise_id, status')
        .eq('user_id', user.id)
        .in('exercise_id', exerciseIds)

      if (userProgErr) {
        console.error('Error fetching user progress:', userProgErr)
      }

      // Build maps
      const sessionIdToExercises = {}
      allExercises?.forEach(ex => {
        if (!sessionIdToExercises[ex.session_id]) sessionIdToExercises[ex.session_id] = []
        sessionIdToExercises[ex.session_id].push(ex)
      })

      const completedSet = new Set(
        (userCompleted || []).filter(p => p.status === 'completed').map(p => p.exercise_id)
      )

      // Seed with DB rows first
      sessionProgressData?.forEach(progress => {
        sessionProgressMap[progress.session_id] = progress
      })

      // Fill/override computed fields
      sessionsData?.forEach(s => {
        const list = sessionIdToExercises[s.id] || []
        const total = list.length
        const completedCount = list.filter(ex => completedSet.has(ex.id)).length
        const xpEarned = list
          .filter(ex => completedSet.has(ex.id))
          .reduce((sum, ex) => sum + (ex.xp_reward || 0), 0)
        const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0

        const existing = sessionProgressMap[s.id]
        if (existing) {
          sessionProgressMap[s.id] = {
            ...existing,
            xp_earned: Math.max(existing.xp_earned || 0, xpEarned),
            progress_percentage: Math.max(existing.progress_percentage || 0, percentage)
          }
        } else {
          sessionProgressMap[s.id] = {
            user_id: user.id,
            session_id: s.id,
            status: total > 0 && completedCount === total ? 'completed' : 'in_progress',
            xp_earned: xpEarned,
            progress_percentage: percentage
          }
        }
      })

      setLevel(levelData)
      setUnits(unitsData || [])
      setSessions(sessionsData || [])
      setUnitProgress(progressMap)
      setSessionProgress(sessionProgressMap)
      setLevels(allLevelsResult.data || [])
      setAllUnits(allUnitsResult.data || [])
    } catch (err) {
      console.error('Error fetching units:', err)
      setError('Không thể tải danh sách unit')
    } finally {
      setLoading(false)
    }
  }

  const getSessionStatusColor = (status, progress) => {
    if (status === 'completed') {
      return 'bg-green-500' // Green for completed
    }

    const progressPercentage = progress?.progress_percentage || 0

    if (progressPercentage > 0) {
      return 'bg-blue-500' // Blue for in progress
    }

    return 'bg-gray-300' // Gray for not started
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

  const getSessionStatus = (session, index) => {
    const progress = sessionProgress[session.id]

    // All sessions are now always available (unlocked)
    if (!progress) {
      return { status: 'available', canAccess: true }
    }

    return {
      status: progress.status,
      canAccess: true // Always allow access
    }
  }

  const handleSessionClick = async (session) => {
    try {
      // Check how many exercises this session has
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('session_id', session.id)
        .eq('is_active', true)
        .order('order_index')

      if (error) throw error

      if (exercises && exercises.length === 1) {
        // If only one exercise, navigate directly to the exercise
        const exercise = exercises[0]
        const paths = {
          flashcard: '/study/flashcard',
          audio_flashcard: '/study/audio-flashcard',
          snake_ladder: '/study/snake-ladder',
          two_player: '/study/two-player-game',
          multiple_choice: '/study/multiple-choice'
        }
        const exercisePath = paths[exercise.exercise_type] || '/study/flashcard'
        navigate(`${exercisePath}?exerciseId=${exercise.id}&sessionId=${session.id}`)
      } else if (exercises && exercises.length > 1) {
        // If multiple exercises, go to exercise list
        navigate(`/study/level/${levelId}/unit/${session.unit_id}/session/${session.id}`)
      } else {
        // If no exercises, go to exercise list
        navigate(`/study/level/${levelId}/unit/${session.unit_id}/session/${session.id}`)
      }
    } catch (err) {
      console.error('Error checking exercises:', err)
      // Fallback to exercise list
      navigate(`/study/level/${levelId}/unit/${session.unit_id}/session/${session.id}`)
    }
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

  const renderSessionCard = (session, index) => {
    const { status, canAccess } = getSessionStatus(session, index)
    const progress = sessionProgress[session.id]
    const isLocked = !canAccess
    const progressPercentage = progress?.progress_percentage || 0

    return (
      <div
        key={session.id}
        onClick={() => !isLocked && handleSessionClick(session)}
        className={`block ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} w-full h-full group relative`}
      >
        <div
          className={`relative overflow-hidden rounded border border-gray-400 transition-all duration-300 ${
            isLocked
              ? 'opacity-60'
              : 'hover:shadow-md hover:scale-105 hover:border-gray-500'
          } w-full h-full bg-gray-200`}
          style={{ aspectRatio: '1' }}
        >
          {/* Progress bar from bottom */}
          {progressPercentage > 0 && status !== 'completed' && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-orange-300 transition-all duration-300"
              style={{ height: `${progressPercentage}%` }}
            />
          )}

          {/* Completed overlay */}
          {status === 'completed' && (
            <div className="absolute inset-0 bg-green-500" />
          )}

          {/* Crown icon for completed sessions */}
          {status === 'completed' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Crown className="w-3 h-3 text-white" />
            </div>
          )}

          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute top-0 right-0">
              <div className="w-2 h-2 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Lock className="w-1 h-1 text-gray-600" />
              </div>
            </div>
          )}
        </div>

        {/* Hover tooltip with session name and progress */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
            <div className="font-medium">{session.title}</div>
            {progress && (
              <div className="text-gray-300">
                {progress.progress_percentage || 0}% • {progress.xp_earned || 0} XP
              </div>
            )}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      </div>
    )
  }

  if (loading && units.length === 0) {
    return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar skeleton */}
        <div className="w-80 transition-all duration-300 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonSidebarItem key={i} withChildren />
            ))}
          </div>
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        </div>
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-16'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <ArrowLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-0' : 'rotate-180'}`} />
            </Button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {levels.map((levelItem) => (
            <div key={levelItem.id} className="border-b border-gray-100">
              <div className="p-3">
                <Link
                  to={`/study/level/${levelItem.id}`}
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                    levelItem.id === levelId
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    levelItem.id === levelId
                      ? 'bg-blue-200'
                      : 'bg-gray-200'
                  }`}>
                    {levelItem.level_number}
                  </div>
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{levelItem.title}</div>
                      <div className="text-xs text-gray-500 truncate">{levelItem.difficulty_label}</div>
                    </div>
                  )}
                </Link>
              </div>

              {/* Sessions for this level */}
              {levelItem.id === levelId && sidebarOpen && (
                <div className="ml-6 space-y-1 pb-3">
                  {sessions
                    .sort((a, b) => (a.session_number || 0) - (b.session_number || 0))
                    .map((sessionItem) => {
                      const progress = sessionProgress[sessionItem.id]
                      const isCompleted = progress?.status === 'completed'
                      return (
                        <div
                          key={sessionItem.id}
                          onClick={() => handleSessionClick(sessionItem)}
                          className={`flex items-center space-x-3 p-2 rounded-lg transition-colors hover:bg-gray-50 cursor-pointer`}
                        >
                          <div className={`w-3 h-3 rounded ${
                            progress?.status === 'completed' ? 'bg-green-500' :
                            (progress?.progress_percentage || 0) > 0 ? 'bg-orange-300' :
                            'bg-gray-300'
                          }`}>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-sm">{sessionItem.title}</div>
                            {progress && (
                              <div className="text-xs text-gray-500 truncate">
                                {progress.progress_percentage || 0}% • {progress.xp_earned || 0} XP
                              </div>
                            )}
                          </div>
                          {isCompleted && (
                            <Crown className="w-3 h-3 text-yellow-600" />
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/study')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{level?.title}</h1>
                <p className="text-gray-600">Chọn session để bắt đầu học - Hover để xem tên session</p>
              </div>
            </div>

            {/* XP and Streak stats */}
            <div className="flex items-center space-x-4">
              <div className="bg-orange-100 rounded-full px-4 py-2 flex items-center space-x-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="font-bold text-gray-800">{userStats.streak}</span>
              </div>
              <div className="bg-yellow-100 rounded-full px-4 py-2 flex items-center space-x-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-gray-800">{userStats.xp}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Hero Image Section */}
          {level?.thumbnail_url && (
            <div className="mb-6 relative h-48 rounded-xl overflow-hidden">
              <img
                src={level.thumbnail_url}
                alt={level.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <h2 className="text-3xl font-bold drop-shadow-lg">{level.title}</h2>
                  <p className="text-lg opacity-90 drop-shadow-md">{level.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Level progress summary */}
          <Card className={`mb-6 bg-gradient-to-r from-${level.color_theme}-50 to-${level.color_theme}-100 border-${level.color_theme}-200`}>
            <Card.Content className="p-6">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className={`text-2xl font-bold ${theme.text}`}>
                    {Object.values(sessionProgress).filter(p => p.status === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-600">Sessions hoàn thành</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${theme.text}`}>
                    {Object.values(sessionProgress).reduce((total, p) => total + (p.xp_earned || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">XP đã kiếm</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${theme.text}`}>
                    {Math.round(Object.values(sessionProgress).reduce((total, p) => total + (p.progress_percentage || 0), 0) / Math.max(sessions.length, 1))}%
                  </div>
                  <div className="text-sm text-gray-600">Tổng tiến độ</div>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Units with Sessions */}
          <div className="space-y-8">
            {units.map((unit) => {
              const unitSessions = sessions
                .filter(session => session.unit_id === unit.id)
                .sort((a, b) => (a.session_number || 0) - (b.session_number || 0))

              if (unitSessions.length === 0) return null

              const progress = unitProgress[unit.id]

              return (
                <div key={unit.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  {/* Unit Header */}
                  <div className="mb-3">
                    <h2 className="text-lg font-bold text-gray-900">{unit.title}</h2>
                  </div>

                  {/* Sessions Grid for this Unit */}
                  <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 xl:grid-cols-16 gap-2">
                    {unitSessions.map((session, index) => (
                      <div key={session.id} className="w-10 h-10">
                        {renderSessionCard(session, index)}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
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
      </div>
    </div>
  )
}

export default UnitList
