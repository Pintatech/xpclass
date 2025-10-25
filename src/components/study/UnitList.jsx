import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import Card from '../ui/Card'
import Button from '../ui/Button'
import AddUnitModal from './AddUnitModal'
import EditUnitModal from './EditUnitModal'
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
  Crown,
  Plus,
  Edit,
  MoreVertical,
  List,
  Trash2,
  Users,
  BarChart3
} from 'lucide-react'

const UnitList = () => {
  const { levelId: rawLevelId, courseId: rawCourseId } = useParams()
  const sanitizeId = (v) => (v && v !== 'undefined' && v !== 'null') ? v : null
  const levelId = sanitizeId(rawLevelId)
  const courseId = sanitizeId(rawCourseId)
  // Support both level and course routes for backward compatibility
  const currentId = courseId || levelId
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
  const [showAddUnitModal, setShowAddUnitModal] = useState(false)
  const [showEditUnitModal, setShowEditUnitModal] = useState(false)
  const [editingUnit, setEditingUnit] = useState(null)
  const [showTeacherView, setShowTeacherView] = useState(false)
  const [courseStudents, setCourseStudents] = useState([])
  const [studentProgress, setStudentProgress] = useState([])
  const { user, profile, isTeacher, isAdmin } = useAuth()
  const { canCreateContent } = usePermissions()

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
    if (user && currentId) {
      fetchLevelAndUnits()
    }
  }, [user, currentId])

  useEffect(() => {
    if (showTeacherView && sessions.length > 0) {
      fetchTeacherViewData()
    }
  }, [showTeacherView, sessions])

  const fetchLevelAndUnits = async () => {
    if (!currentId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [levelResult, allLevelsResult, allUnitsResult] = await Promise.all([
        supabase.from('courses').select('*').eq('id', currentId).single(),
        supabase.from('courses').select('*').order('level_number'),
        supabase.from('units').select('*').order('unit_number')
      ])

      if (levelResult.error) throw levelResult.error
      if (allLevelsResult.error) throw allLevelsResult.error
      if (allUnitsResult.error) throw allUnitsResult.error

      const levelData = levelResult.data

      // For students, verify they are enrolled in this course
      if (profile?.role === 'user') {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('student_id', user.id)
          .eq('course_id', currentId)
          .eq('is_active', true)
          .single()

        if (enrollmentError || !enrollmentData) {
          console.error('Student not enrolled in this course:', enrollmentError)
          setError('Bạn chưa được ghi danh vào khóa học này')
          navigate('/study')
          return
        }
      }

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
        .eq('course_id', currentId)
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

      // Fetch all assigned exercises for these sessions via linking table
      const { data: allAssignments, error: assignmentsErr } = await supabase
        .from('exercise_assignments')
        .select(`
          id,
          session_id,
          exercise:exercises(id, xp_reward, is_active)
        `)
        .in('session_id', sessionIds)

      if (assignmentsErr) {
        console.error('Error fetching exercise assignments:', assignmentsErr)
      }

      const exerciseIds = (allAssignments || [])
        .map(a => a.exercise?.id)
        .filter(Boolean)

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
      ;(allAssignments || []).forEach(a => {
        const ex = a.exercise
        if (!ex) return
        if (!sessionIdToExercises[a.session_id]) sessionIdToExercises[a.session_id] = []
        sessionIdToExercises[a.session_id].push({
          id: ex.id,
          session_id: a.session_id,
          xp_reward: ex.xp_reward,
          is_active: ex.is_active
        })
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

  const handleUnitCreated = (newUnit) => {
    setUnits(prev => [...prev, newUnit])
    setShowAddUnitModal(false)
    // Show success message
    alert('Unit created successfully!')
  }

  const handleUnitUpdated = (updatedUnit) => {
    setUnits(prev => prev.map(unit => unit.id === updatedUnit.id ? updatedUnit : unit))
    setShowEditUnitModal(false)
    setEditingUnit(null)
    // Show success message
    alert('Unit updated successfully!')
  }

  const handleEditUnit = (unit) => {
    setEditingUnit(unit)
    setShowEditUnitModal(true)
  }

  const fetchTeacherViewData = async () => {
    if (!currentId || (!isTeacher() && !isAdmin())) return

    try {
      // Fetch students enrolled in this course
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          student:users!student_id(
            id,
            full_name,
            email
          )
        `)
        .eq('course_id', currentId)
        .eq('is_active', true)

      if (enrollError) throw enrollError

      // Get exercise IDs for this course
      const { data: exerciseAssignments, error: exError } = await supabase
        .from('exercise_assignments')
        .select('exercise_id')
        .in('session_id', sessions.map(s => s.id))

      if (exError) throw exError

      const exerciseIds = [...new Set(exerciseAssignments.map(a => a.exercise_id))]

      // Fetch progress for all students
      const studentIds = enrollments.map(e => e.student_id)
      const { data: progress, error: progError } = await supabase
        .from('user_progress')
        .select('*')
        .in('user_id', studentIds)
        .in('exercise_id', exerciseIds)

      if (progError) throw progError

      setCourseStudents(enrollments || [])
      setStudentProgress(progress || [])
    } catch (error) {
      console.error('Error fetching teacher view data:', error)
    }
  }

  const handleDeleteUnit = async (unit) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the unit "${unit.title}"?\n\nThis will also delete all sessions and exercises in this unit. This action cannot be undone.`
    )

    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unit.id)

      if (error) throw error

      // Remove from local state
      setUnits(prev => prev.filter(u => u.id !== unit.id))
      // Remove sessions for this unit
      setSessions(prev => prev.filter(s => s.unit_id !== unit.id))

      alert('Unit deleted successfully!')
    } catch (err) {
      console.error('Error deleting unit:', err)
      alert('Failed to delete unit: ' + (err.message || 'Unknown error'))
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
      // Check how many exercises this session has using the exercise_assignments table
      const { data: assignments, error: assignmentsError } = await supabase
        .from('exercise_assignments')
        .select(`
          id,
          exercise:exercises!inner(
            id,
            exercise_type,
            is_active
          )
        `)
        .eq('session_id', session.id)
        .eq('exercise.is_active', true)

      if (assignmentsError) throw assignmentsError

      const exercises = (assignments || [])
        .map(a => a.exercise)
        .filter(Boolean)

      if (exercises && exercises.length === 1) {
        // If only one exercise, navigate directly to the exercise
        const exercise = exercises[0]
        const paths = {
          flashcard: '/study/flashcard',
          fill_blank: '/study/fill-blank',
          snake_ladder: '/study/snake-ladder',
          two_player: '/study/two-player-game',
          multiple_choice: '/study/multiple-choice',
          drag_drop: '/study/drag-drop',
          ai_fill_blank: '/study/ai-fill-blank',
          dropdown: '/study/dropdown',
          pronunciation: '/study/pronunciation'
        }
        const exercisePath = paths[exercise.exercise_type] || '/study/flashcard'
        // Use course route
        const base = levelId ? `/study/level/${levelId}` : `/study/course/${currentId}`
        navigate(`${exercisePath}?exerciseId=${exercise.id}&sessionId=${session.id}`)
      } else if (exercises && exercises.length > 1) {
        // If multiple exercises, go to exercise list
        const base = levelId ? `/study/level/${levelId}` : `/study/course/${currentId}`
        navigate(`${base}/unit/${session.unit_id}/session/${session.id}`)
      } else {
        // If no exercises, go to exercise list
        const base = levelId ? `/study/level/${levelId}` : `/study/course/${currentId}`
        navigate(`${base}/unit/${session.unit_id}/session/${session.id}`)
      }
    } catch (err) {
      console.error('Error checking exercises:', err)
      // Fallback to exercise list
      const base = levelId ? `/study/level/${levelId}` : `/study/course/${currentId}`
      navigate(`${base}/unit/${session.unit_id}/session/${session.id}`)
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

    // Determine shadow color based on status
    const getShadowColor = () => {
      if (status === 'completed') return '0 4px 0 0 #46a302' // Green shadow
      if (progressPercentage > 0) return '0 4px 0 0 #cc7800' // Orange shadow
      return '0 4px 0 0 rgba(0, 0, 0, 0.4)' // Darker gray shadow
    }

    return (
      <div
        key={session.id}
        onClick={() => !isLocked && handleSessionClick(session)}
        className={`block ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} w-full h-full`}
      >
        <div
          className={`relative overflow-hidden rounded-lg transition-all duration-300 ${
            isLocked
              ? 'opacity-60'
              : 'hover:scale-105'
          } w-full h-full bg-gray-200`}
          style={{
            aspectRatio: '1',
            boxShadow: getShadowColor()
          }}
        >
          {/* Progress bar from bottom */}
          {progressPercentage > 0 && status !== 'completed' && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-orange-300 transition-all duration-300 z-10"
              style={{ height: `${progressPercentage}%` }}
            />
          )}

          {/* Completed overlay */}
          {status === 'completed' && (
            <div className="absolute inset-0 z-10" style={{ backgroundColor: '#58cc02' }} />
          )}

          {/* Crown icon for completed sessions */}
          {status === 'completed' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              <Crown className="w-6 h-6 text-yellow-300" />
            </div>
          )}

          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute top-1 right-1 z-40">
              <div className="w-4 h-4 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Lock className="w-2 h-2 text-gray-600" />
              </div>
            </div>
          )}

          {/* Progress badge */}
          {!status === 'completed' && progressPercentage > 0 && (
            <div className="absolute top-1 left-1 z-40 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 text-gray-800 shadow">
              {progressPercentage}%
            </div>
          )}

          {/* Session Title on the square - Always visible */}
          <div className="absolute bottom-0 left-0 right-0 z-50 px-2 py-1.5">
            <h3 className="text-white font-bold text-[11px] text-center leading-tight line-clamp-2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              {session.title}
            </h3>
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
      {/* Left Sidebar - Hidden on mobile */}
      <div className={`hidden md:flex ${sidebarOpen ? 'w-80' : 'w-16'} transition-all duration-300 bg-white border-r border-gray-200 flex-col order-first`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <ArrowLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : 'rotate-0'}`} />
            </Button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {levels.map((levelItem) => (
            <div key={levelItem.id} className="border-b border-gray-100">
              <div className="p-3">
                <Link
                  to={`/study/course/${levelItem.id}`}
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                    levelItem.id === currentId
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    levelItem.id === currentId
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
              {levelItem.id === currentId && sidebarOpen && (
                <div className="ml-6 space-y-1 pb-3">
                  {sessions
                    .sort((a, b) => {
                      // Create unit map for sorting
                      const unitMap = {}
                      units.forEach(unit => {
                        unitMap[unit.id] = unit.unit_number || 0
                      })

                      // First sort by unit number, then by session number
                      const unitNumA = unitMap[a.unit_id] || 0
                      const unitNumB = unitMap[b.unit_id] || 0
                      const unitDiff = unitNumA - unitNumB
                      if (unitDiff !== 0) return unitDiff
                      return (a.session_number || 0) - (b.session_number || 0)
                    })
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
      <div className="flex-1 flex flex-col overflow-hidden w-full md:w-auto">
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

              {/* Teacher View Toggle */}
              {(isTeacher() || isAdmin()) && (
                <Button
                  variant={showTeacherView ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setShowTeacherView(!showTeacherView)}
                  className="flex items-center gap-2"
                >
                  {showTeacherView ? <Users className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
                  {showTeacherView ? 'Student View' : 'Teacher View'}
                </Button>
              )}
            </div>

            {/* XP and Streak stats */}
            {!showTeacherView && (
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
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Teacher View */}
          {showTeacherView ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Teacher Dashboard - {level?.title}
                </h2>
                <p className="text-gray-600 mb-6">Viewing student progress for this course</p>

                {/* Course Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Users className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="text-sm text-gray-600">Enrolled Students</p>
                        <p className="text-2xl font-bold text-gray-900">{courseStudents.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="text-sm text-gray-600">Avg Completion</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {courseStudents.length > 0
                            ? Math.round(studentProgress.filter(p => p.status === 'completed').length / courseStudents.length)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Star className="w-8 h-8 text-yellow-600" />
                      <div>
                        <p className="text-sm text-gray-600">Avg Score</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {studentProgress.length > 0
                            ? Math.round(studentProgress.reduce((sum, p) => sum + ((p.score / p.max_score) * 100 || 0), 0) / studentProgress.length)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Student List */}
                <div className="border-t border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900 p-6 border-b border-gray-200">Student Progress</h3>
                  {courseStudents.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Enrolled</h3>
                      <p className="text-gray-600">No students are currently enrolled in this course.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {courseStudents.map(({ student_id, student }) => {
                        const studentProgressData = studentProgress.filter(p => p.user_id === student_id)
                        const completed = studentProgressData.filter(p => p.status === 'completed').length
                        const total = studentProgressData.length
                        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

                        const scores = studentProgressData
                          .filter(p => p.score !== null && (p.max_score || 0) > 0)
                          .map(p => (p.score / p.max_score) * 100)

                        const averageScore = scores.length > 0
                          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
                          : 0

                        const totalTime = studentProgressData.reduce((sum, p) => sum + (p.time_spent || 0), 0)

                        const getScoreColor = (score) => {
                          if (score >= 90) return 'text-green-600 bg-green-100'
                          if (score >= 75) return 'text-blue-600 bg-blue-100'
                          if (score >= 60) return 'text-yellow-600 bg-yellow-100'
                          return 'text-red-600 bg-red-100'
                        }

                        return (
                          <div key={student_id} className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 font-semibold">
                                      {student.full_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900">{student.full_name}</h3>
                                  <p className="text-sm text-gray-600">{student.email}</p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-6">
                                <div className="text-center">
                                  <div className="text-sm font-medium text-gray-900">{completed}/{total}</div>
                                  <div className="text-xs text-gray-500">Completed</div>
                                </div>
                                <div className="text-center">
                                  <div className={`text-sm font-medium px-2 py-1 rounded-full ${getScoreColor(averageScore)}`}>
                                    {averageScore}%
                                  </div>
                                  <div className="text-xs text-gray-500">Avg Score</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-medium text-gray-900">{Math.round(totalTime / 60)}m</div>
                                  <div className="text-xs text-gray-500">Study Time</div>
                                </div>
                                <div className="text-center">
                                  <div className={`text-sm font-medium px-2 py-1 rounded-full ${getScoreColor(completionRate)}`}>
                                    {completionRate}%
                                  </div>
                                  <div className="text-xs text-gray-500">Progress</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Hero Image Section */}
              {level?.thumbnail_url && (
            <div className="mb-6 relative h-48 rounded-xl overflow-hidden">
              <img
                src={level.thumbnail_url}
                alt={level.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30" />
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

              const progress = unitProgress[unit.id]

              return (
                <div key={unit.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  {/* Unit Header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <h2 className="text-lg font-bold text-gray-900">{unit.title}</h2>
                      {canCreateContent() && (
                        <button
                          onClick={() => {
                            const base = levelId ? `/study/level/${levelId}` : `/study/course/${currentId}`
                            navigate(`${base}/unit/${unit.id}`)
                          }}
                          className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Manage sessions"
                        >
                          <List className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {canCreateContent() && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEditUnit(unit)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit unit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUnit(unit)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete unit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sessions Grid for this Unit */}
                  {unitSessions.length > 0 ? (
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                      {unitSessions.map((session, index) => (
                        <div key={session.id} style={{ width: '60px', height: '60px' }}>
                          {renderSessionCard(session, index)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">        
                      {canCreateContent() ? (
                        <Button
                          onClick={() => {
                            const base = levelId ? `/study/level/${levelId}` : `/study/course/${currentId}`
                            navigate(`${base}/unit/${unit.id}`)
                          }}
                          className="bg-green-600 text-white hover:bg-green-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Sessions
                        </Button>
                      ) : (
                        <p className="text-sm text-gray-500">Sessions will be available soon</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {/* Add Unit Button */}
            {canCreateContent() && (
              <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-400 transition-colors">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Plus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-gray-600">Create a new learning unit for this level</p>
                  </div>
                  <Button
                    onClick={() => setShowAddUnitModal(true)}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Unit
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Empty state */}
          {units.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có unit nào</h3>
              <p className="text-gray-600">Các unit học tập sẽ sớm được cập nhật!</p>
              {canCreateContent() && (
                <Button
                  onClick={() => setShowAddUnitModal(true)}
                  className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Unit
                </Button>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Add Unit Modal */}
      {showAddUnitModal && (
        <AddUnitModal
          levelId={currentId}
          onClose={() => setShowAddUnitModal(false)}
          onCreated={handleUnitCreated}
        />
      )}

      {/* Edit Unit Modal */}
      {showEditUnitModal && editingUnit && (
        <EditUnitModal
          unit={editingUnit}
          onClose={() => {
            setShowEditUnitModal(false)
            setEditingUnit(null)
          }}
          onUpdated={handleUnitUpdated}
        />
      )}
    </div>
  )
}

export default UnitList
