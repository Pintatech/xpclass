import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import Card from '../ui/Card'
import Button from '../ui/Button'
import AddSessionModal from './AddSessionModal'
import EditSessionModal from './EditSessionModal'
// Dùng skeleton thay cho spinner khi tải dữ liệu
import {
  ArrowLeft,
  Star,
  Lock,
  CheckCircle,
  BookOpen,
  Clock,
  ArrowRight,
  Target,
  PlayCircle,
  Mic,
  Volume2,
  PenTool,
  Brain,
  MessageSquare,
  CreditCard,
  Music2,
  Brush,
  Globe,
  Dice6,
  Dumbbell,
  MessageCircle,
  ChevronRight,
  List,
  Grid,
  Crown,
  Plus,
  Edit,
  MoreVertical,
  Trash2
} from 'lucide-react'

const SessionList = () => {
  const { levelId: rawLevelId, courseId: rawCourseId, unitId } = useParams()
  const sanitizeId = (v) => (v && v !== 'undefined' && v !== 'null') ? v : null
  const levelId = sanitizeId(rawLevelId)
  const courseId = sanitizeId(rawCourseId)
  // Support both level and course routes for backward compatibility
  const currentId = courseId || levelId
  const navigate = useNavigate()
  const location = useLocation()
  const [level, setLevel] = useState(null)
  const [unit, setUnit] = useState(null)
  const [sessions, setSessions] = useState([])
  const [allLevelSessions, setAllLevelSessions] = useState([])
  const [sessionProgress, setSessionProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [levels, setLevels] = useState([])
  const [units, setUnits] = useState([])
  const [showAddSessionModal, setShowAddSessionModal] = useState(false)
  const [showEditSessionModal, setShowEditSessionModal] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const { user, profile } = useAuth()
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

  const SkeletonListItem = () => (
    <div className="flex items-center p-4 rounded-lg border border-gray-200 bg-white animate-pulse">
      <div className="flex-shrink-0 w-12 h-12 mr-4">
        <div className="w-full h-full rounded-lg bg-gray-200" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="flex items-center space-x-4">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-100 rounded w-16" />
        </div>
        <div className="h-2 bg-gray-100 rounded w-full mt-2" />
      </div>
      <div className="w-5 h-5 bg-gray-200 rounded ml-4" />
    </div>
  )

  useEffect(() => {
    if (user && currentId && unitId) {
      fetchData()
    }
  }, [user, currentId, unitId, location.key])

  const handleSessionCreated = (newSession) => {
    setSessions(prev => [...prev, newSession])
    setShowAddSessionModal(false)
    // Show success message
    alert('Session created successfully!')
  }

  const handleSessionUpdated = (updatedSession) => {
    setSessions(prev => prev.map(session => session.id === updatedSession.id ? updatedSession : session))
    setShowEditSessionModal(false)
    setEditingSession(null)
    // Show success message
    alert('Session updated successfully!')
  }

  const handleEditSession = (session) => {
    setEditingSession(session)
    setShowEditSessionModal(true)
  }

  const handleDeleteSession = async (session) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the session "${session.title}"?\n\nThis will also delete all exercises in this session. This action cannot be undone.`
    )

    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', session.id)

      if (error) throw error

      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== session.id))
      setAllLevelSessions(prev => prev.filter(s => s.id !== session.id))

      alert('Session deleted successfully!')
    } catch (err) {
      console.error('Error deleting session:', err)
      alert('Failed to delete session: ' + (err.message || 'Unknown error'))
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all courses for sidebar
      const { data: allCourses, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('level_number')

      if (coursesError) throw coursesError

      // Fetch all units for sidebar
      const { data: allUnits, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .order('unit_number')

      if (unitsError) throw unitsError

      // Fetch current course info
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', currentId)
        .maybeSingle()

      if (courseError) throw courseError
      if (!courseData) {
        setLoading(false)
        return
      }

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

      // Fetch current unit info
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single()

      if (unitError) throw unitError

      // Fetch sessions for this unit
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('session_number')

      if (sessionsError) throw sessionsError

      // Get unit IDs for this level
      const levelUnitIds = allUnits?.filter(u => u.level_id === levelId).map(u => u.id) || []

      // Fetch all sessions for this level (for sidebar)
      const { data: allLevelSessions, error: allSessionsError } = await supabase
        .from('sessions')
        .select('*')
        .in('unit_id', levelUnitIds)
        .eq('is_active', true)
        .order('session_number')

      if (allSessionsError) throw allSessionsError


      // Fetch user's session progress (explicit session_progress rows)
      const { data: progressData, error: progressError } = await supabase
        .from('session_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('session_id', sessionsData?.map(s => s.id) || [])

      if (progressError) throw progressError

      // Fetch all assigned exercises for these sessions via linking table
      const sessionIds = sessionsData?.map(s => s.id) || []
      const { data: allAssignments, error: assignmentsErr } = await supabase
        .from('exercise_assignments')
        .select(`
          id,
          session_id,
          exercise:exercises(id, xp_reward, is_active)
        `)
        .in('session_id', sessionIds)

      if (assignmentsErr) throw assignmentsErr

      const exerciseIds = (allAssignments || [])
        .map(a => a.exercise?.id)
        .filter(Boolean)

      // Fetch user's completed exercises among these
      const { data: userCompleted, error: userProgErr } = await supabase
        .from('user_progress')
        .select('exercise_id, status')
        .eq('user_id', user.id)
        .in('exercise_id', exerciseIds)

      if (userProgErr) throw userProgErr

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

      // Create progress map, merging DB session_progress with computed from exercise completions
      const progressMap = {}

      // Seed with DB rows first
      progressData?.forEach(progress => {
        progressMap[progress.session_id] = progress
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

        const existing = progressMap[s.id]
        if (existing) {
          // Merge: prefer explicit completed status, but update xp/progress if higher
          progressMap[s.id] = {
            ...existing,
            xp_earned: Math.max(existing.xp_earned || 0, xpEarned),
            progress_percentage: Math.max(existing.progress_percentage || 0, percentage)
          }
        } else {
          progressMap[s.id] = {
            user_id: user.id,
            session_id: s.id,
            status: total > 0 && completedCount === total ? 'completed' : 'in_progress',
            xp_earned: xpEarned,
            progress_percentage: percentage
          }
        }
      })

      console.log('Setting allLevelSessions:', allLevelSessions)
      setLevel(courseData)
      setUnit(unitData)
      setSessions(sessionsData || [])
      setAllLevelSessions(allLevelSessions || [])
      setSessionProgress(progressMap)
      setLevels(allCourses || [])
      setUnits(allUnits || [])
    } catch (err) {
      console.error('Error fetching sessions:', err)
      setError('Không thể tải danh sách session')
    } finally {
      setLoading(false)
    }
  }

  const getSessionImageUrl = (sessionNumber) => {
    const images = {
      1: 'https://xpclass.vn/momtek/svg%20icon/Vocab.svg',
      2: 'https://xpclass.vn/momtek/svg%20icon/Flashcard.svg',
      3: 'https://xpclass.vn/momtek/svg%20icon/Flashcard.svg',
      4: 'https://xpclass.vn/momtek/svg%20icon/Creativity.svg',
      5: 'https://xpclass.vn/momtek/svg%20icon/Quiz.svg',
      6: 'https://xpclass.vn/momtek/svg%20icon/Games.svg',
      7: 'https://xpclass.vn/momtek/svg%20icon/Practice.svg',
      8: 'https://xpclass.vn/momtek/svg%20icon/Test.svg'
    }
    return images[sessionNumber] || images[1]
  }

  const getSessionGrayImageUrl = (sessionNumber) => {
    const images = {
      1: 'https://xpclass.vn/momtek/svg%20icon/gray%20vocab.svg',
      2: 'https://xpclass.vn/momtek/svg%20icon/gray%20flashcard.svg',
      3: 'https://xpclass.vn/momtek/svg%20icon/gray%20flashcard.svg',
      4: 'https://xpclass.vn/momtek/svg%20icon/gray%20creativity.svg',
      5: 'https://xpclass.vn/momtek/svg%20icon/gray%20quiz.svg',
      6: 'https://xpclass.vn/momtek/svg%20icon/gray%20game.svg',
      7: 'https://xpclass.vn/momtek/svg%20icon/gray%20practice.svg',
      8: 'https://xpclass.vn/momtek/svg%20icon/gray%20test.svg'
    }
    return images[sessionNumber] || images[1]
  }

  const getSessionTypeIcon = (sessionType) => {
    const icons = {
      vocabulary: BookOpen,
      grammar: PenTool,
      pronunciation: Mic,
      listening: Volume2,
      mixed: Brain
    }
    return icons[sessionType] || MessageSquare
  }

  const getSessionTypeColor = (sessionType) => {
    const colors = {
      vocabulary: 'text-blue-600 bg-blue-100',
      grammar: 'text-green-600 bg-green-100',
      pronunciation: 'text-red-600 bg-red-100',
      listening: 'text-purple-600 bg-purple-100',
      mixed: 'text-orange-600 bg-orange-100'
    }
    return colors[sessionType] || 'text-gray-600 bg-gray-100'
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

      // Since we removed combined_learning, check if this is session 1 for vocab
      const isVocabSession = session.session_number === 1 && exercises && exercises.length > 0

      if (false) { // Disabled vocab session wrapper since combined_learning is removed
        // Navigate to vocab session wrapper (no specific exerciseId since we handle multiple pairs)
        navigate(`/study/vocab-session?sessionId=${session.id}`)
        return
      }

      if (exercises && exercises.length === 1) {
        // If only one exercise, navigate directly to the exercise
        const exercise = exercises[0]
        const paths = {
          flashcard: '/study/flashcard',
          fill_blank: '/study/fill-blank',
          snake_ladder: '/study/snake-ladder',
          two_player: '/study/two-player-game',
          multiple_choice: '/study/multiple-choice'
        }
        const exercisePath = paths[exercise.exercise_type] || '/study/flashcard'
        navigate(`${exercisePath}?exerciseId=${exercise.id}&sessionId=${session.id}`)
      } else if (exercises && exercises.length > 1) {
        // If multiple exercises, go to exercise list
        const base = levelId ? `/study/level/${levelId}` : `/study/course/${unit?.course_id || level?.id}`
        navigate(`${base}/unit/${unitId}/session/${session.id}`)
      } else {
        // If no exercises, go to exercise list
        const base = levelId ? `/study/level/${levelId}` : `/study/course/${unit?.course_id || level?.id}`
        navigate(`${base}/unit/${unitId}/session/${session.id}`)
      }
    } catch (err) {
      console.error('Error checking exercises:', err)
      // Fallback to exercise list
      const base = levelId ? `/study/level/${levelId}` : `/study/course/${unit?.course_id || level?.id}`
      navigate(`${base}/unit/${unitId}/session/${session.id}`)
    }
  }

  const renderSessionCard = (session, index) => {
    const { status, canAccess } = getSessionStatus(session, index)
    const isCompleted = status === 'completed'
    const progress = sessionProgress[session.id]
    const theme = getThemeColors(unit?.color_theme || level?.color_theme)
    const isLocked = !canAccess
    const sessionNumber = session.session_number || index + 1
    const sessionImageUrl = getSessionImageUrl(sessionNumber)
    const sessionGrayImageUrl = getSessionGrayImageUrl(sessionNumber)
    const isFirstItem = index === 0
    const progressPercentage = progress?.progress_percentage || 0

    return (
      <div
        key={session.id}
        onClick={() => !isLocked && handleSessionClick(session)}
        className={`block ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} w-full h-full`}
      >
        <div
          className={`relative overflow-hidden rounded-xl border border-black transition-all duration-300 ${isLocked
              ? 'opacity-60'
              : 'hover:shadow-lg hover:scale-105'
            } w-full h-full`}
          style={{ aspectRatio: '1' }}
        >
          {/* Session Image */}
          {session.image_url ? (
            <>
              <img 
                src={session.image_url} 
                alt={session.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient background if image fails
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'block'
                }}
              />
              {/* Overlay icon */}
              <div className={`absolute inset-0 flex items-center justify-center ${isCompleted ? 'bg-blue-700' : 'bg-gray-100'}`}>
                <img src={isCompleted ? sessionImageUrl : sessionGrayImageUrl} alt="" className="w-12 h-12" />
              </div>
              {/* Fallback background */}
              <div 
                className={`absolute inset-0 flex items-center justify-center ${isCompleted ? 'bg-blue-500' : 'bg-gray-200'}`}
                style={{ display: 'none' }}
              >
                <img src={isCompleted ? sessionImageUrl : sessionGrayImageUrl} alt="" className="w-12 h-12" />
              </div>
            </>
          ) : (
            /* Fallback when no image */
            <div className={`absolute inset-0 flex items-center justify-center ${isCompleted ? 'bg-blue-700' : 'bg-gray-100'}`}>
              <img src={isCompleted ? sessionImageUrl : sessionGrayImageUrl} alt="" className="w-12 h-12" />
            </div>
          )}

          {/* Progress bar fill from bottom when in progress */}
          {progressPercentage > 0 && !isCompleted && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-orange-300/80 transition-all duration-300 z-10"
              style={{ height: `${progressPercentage}%` }}
            />
          )}

          {/* Completed overlay */}
          {isCompleted && (
            <div className="absolute inset-0 bg-green-500/80 z-10" />
          )}

          {/* Crown icon for completed */}
          {isCompleted && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              <Crown className="w-12 h-12 text-yellow-300" />
            </div>
          )}

          {/* Progress badge */}
          {!isCompleted && progressPercentage > 0 && (
            <div className="absolute top-2 left-2 z-40 px-2 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-800 shadow">
              {progressPercentage}%
            </div>
          )}

          {/* Small lock dot */}
          {isLocked && (
            <div className="absolute top-2 right-2 z-40">
              <div className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow">
                <Lock className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          )}

          {/* Session Title on the square - Always on top */}
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-sm px-3 py-3">
            <h3 className="text-white font-bold text-base text-center leading-tight line-clamp-2">
              {session.title}
            </h3>
          </div>

        </div>
      </div>
    )
  }

  const renderSessionListItem = (session, index) => {
    const { status, canAccess } = getSessionStatus(session, index)
    const isCompleted = status === 'completed'
    const progress = sessionProgress[session.id]
    const theme = getThemeColors(unit?.color_theme || level?.color_theme)
    const isLocked = !canAccess
    const sessionNumber = session.session_number || index + 1
    const sessionImageUrl = getSessionImageUrl(sessionNumber)
    const sessionGrayImageUrl = getSessionGrayImageUrl(sessionNumber)

    return (
      <div
        key={session.id}
        onClick={() => !isLocked && handleSessionClick(session)}
        className={`flex items-center p-4 rounded-lg border transition-all duration-200 ${
          isLocked 
            ? 'opacity-60 cursor-not-allowed bg-gray-50' 
            : 'cursor-pointer hover:shadow-md hover:bg-gray-50'
        } ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}
      >
        {/* Session Icon */}
        <div className="flex-shrink-0 w-12 h-12 mr-4">
          <div className={`w-full h-full rounded-lg flex items-center justify-center ${
            isCompleted ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <img 
              src={isCompleted ? sessionImageUrl : sessionGrayImageUrl} 
              alt="" 
              className="w-8 h-8" 
            />
          </div>
        </div>

        {/* Session Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {session.title}
            </h3>
            <div className="flex items-center space-x-2">
              {canCreateContent() && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditSession(session)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Edit session"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(session)
                    }}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {isCompleted && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              {isLocked && (
                <Lock className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
          
          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
            <span>Session {sessionNumber}</span>
            {progress && (
              <>
                <span>{progress.progress_percentage || 0}% hoàn thành</span>
                <span>{progress.xp_earned || 0} XP</span>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {progress && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress_percentage || 0}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Arrow */}
        {!isLocked && (
          <ChevronRight className="w-5 h-5 text-gray-400 ml-4" />
        )}
      </div>
    )
  }

  if (loading && sessions.length === 0) {
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
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonListItem key={idx} />
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
        <Button onClick={fetchData} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!unit || !level) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không tìm thấy thông tin</div>
        <Button onClick={() => navigate(`/study/level/${levelId}`)} variant="outline">
          Quay lại
        </Button>
      </div>
    )
  }

  const theme = getThemeColors(unit.color_theme || level.color_theme)

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
              {console.log('Rendering SessionList sidebar for level:', levelId, 'allLevelSessions:', allLevelSessions)}
              {levelItem.id === levelId && sidebarOpen && (
                <div className="ml-6 space-y-1 pb-3">
                  {allLevelSessions && allLevelSessions.length > 0 ? allLevelSessions
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
                    }) : (
                    <div className="p-2 text-sm text-gray-500">No sessions found</div>
                  )}
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
                onClick={() => {
                  const base = levelId ? `/study/level/${levelId}` : `/study/course/${level?.id}`
                  navigate(base)
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{unit?.title}</h1>
                <p className="text-gray-600">{unit?.description}</p>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
            <Link
              to={levelId ? `/study/level/${levelId}` : `/study/course/${level?.id}`}
              className="hover:text-primary-600"
            >
              {level?.title}
            </Link>
            <ArrowRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">{unit?.title}</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Unit progress summary */}
          <Card className={`mb-6 bg-gradient-to-r from-${unit?.color_theme || level?.color_theme}-50 to-${unit?.color_theme || level?.color_theme}-100 border-${unit?.color_theme || level?.color_theme}-200`}>
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

          {/* Sessions List/Grid */}
          {viewMode === 'list' ? (
            <div className="space-y-4">
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
                .map((session, index) => renderSessionListItem(session, index))
              }

              {/* Add Session Button for List View */}
              {canCreateContent() && (
                <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-green-400 transition-colors">
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Plus className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-medium text-gray-900">Add New Session</h4>
                      <p className="text-sm text-gray-600">Create a learning session for this unit</p>
                    </div>
                    <Button
                      onClick={() => setShowAddSessionModal(true)}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Session
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                .map((session, index) => (
                  <div key={session.id} className="w-48 h-48">
                    {renderSessionCard(session, index)}
                  </div>
                ))
              }

              {/* Add Session Button for Grid View */}
              {canCreateContent() && (
                <div className="w-48 h-48">
                  <div
                    onClick={() => setShowAddSessionModal(true)}
                    className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-green-400 hover:bg-green-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <Plus className="w-6 h-6 text-green-600" />
                    </div>
                    <span className="text-sm text-gray-600 mt-2 text-center px-2">Add Session</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {sessions.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có session nào</h3>
              <p className="text-gray-600">Các session học tập sẽ sớm được cập nhật!</p>
              {canCreateContent() && (
                <Button
                  onClick={() => setShowAddSessionModal(true)}
                  className="mt-4 bg-green-600 text-white hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Session
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <AddSessionModal
          unitId={unitId}
          onClose={() => setShowAddSessionModal(false)}
          onCreated={handleSessionCreated}
        />
      )}

      {/* Edit Session Modal */}
      {showEditSessionModal && editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => {
            setShowEditSessionModal(false)
            setEditingSession(null)
          }}
          onUpdated={handleSessionUpdated}
        />
      )}
    </div>
  )
}

export default SessionList
