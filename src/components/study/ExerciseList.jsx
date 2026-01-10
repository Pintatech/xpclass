import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import { useProgress } from '../../hooks/useProgress'
import Button from '../ui/Button'
import AssignExerciseModal from './AssignExerciseModal'
import AssignToStudentModal from '../admin/AssignToStudentModal'
import EditExerciseModal from '../admin/ExerciseBank/EditExerciseModal'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
// Skeleton loading sẽ thay cho spinner
import {
  ArrowLeft,
  Lock,
  BookOpen,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  UserPlus,
  Image
} from 'lucide-react'

const ExerciseList = () => {
  const { levelId: rawLevelId, courseId: rawCourseId, unitId, sessionId } = useParams()
  const sanitizeId = (v) => (v && v !== 'undefined' && v !== 'null') ? v : null
  const levelId = sanitizeId(rawLevelId)
  const courseId = sanitizeId(rawCourseId)
  // Support both level and course routes for backward compatibility
  const currentId = courseId || levelId
  const navigate = useNavigate()
  const [level, setLevel] = useState(null)
  const [unit, setUnit] = useState(null)
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [allLevelSessions, setAllLevelSessions] = useState([])
  const [sessionProgress, setSessionProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [levels, setLevels] = useState([])
  const [units, setUnits] = useState([])
  const [showAssignExerciseModal, setShowAssignExerciseModal] = useState(false)
  const [assignToStudentExercise, setAssignToStudentExercise] = useState(null)
  const [editingExercise, setEditingExercise] = useState(null)
  const { user, profile } = useAuth()
  const { canCreateContent } = usePermissions()
  const { userProgress, fetchUserProgress } = useProgress()

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Skeleton card cho trạng thái loading
  const SkeletonCard = () => (
    <div className="flex items-center p-4 rounded-lg border border-gray-200 bg-white animate-pulse">
      <div className="flex-shrink-0 w-12 h-12 mr-4">
        <div className="w-full h-full rounded-lg bg-gray-200" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="flex items-center space-x-4">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-3 bg-gray-100 rounded w-16" />
          <div className="h-3 bg-gray-100 rounded w-14" />
        </div>
      </div>
      <div className="w-5 h-5 bg-gray-200 rounded ml-4" />
    </div>
  )

  const SkeletonSidebarItem = ({ wide = false }) => (
    <div className="p-3">
      <div className="flex items-center space-x-3">
        <div className={`rounded-lg bg-gray-200 ${wide ? 'w-8 h-8' : 'w-6 h-6'}`} />
        <div className="flex-1 min-w-0">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-1" />
          <div className="h-2 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
    </div>
  )

  const handleExercisesAssigned = async () => {
    setShowAssignExerciseModal(false)
    // Refetch data to get the proper structure with assignment IDs
    await fetchData()
  }

  const handleDeleteExercise = async (exercise) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to remove the exercise "${exercise.title}" from this session?\n\nThis will only remove it from the session, not delete the exercise from the bank.`
    )

    if (!confirmDelete) return

    try {
      // Remove assignment instead of deleting exercise
      const { error } = await supabase
        .from('exercise_assignments')
        .delete()
        .eq('id', exercise.assignment_id)

      if (error) throw error

      // Remove from local state
      setExercises(prev => prev.filter(e => e.id !== exercise.id))
    } catch (err) {
      console.error('Error removing exercise:', err)
      alert('Failed to remove exercise: ' + (err.message || 'Unknown error'))
    }
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = exercises.findIndex(ex => ex.id === active.id)
    const newIndex = exercises.findIndex(ex => ex.id === over.id)

    const newExercises = arrayMove(exercises, oldIndex, newIndex)

    // Update local state immediately for smooth UX
    setExercises(newExercises)

    // Update order_index in database
    try {
      // Step 1: Set all order_index to negative temporary values to avoid conflicts
      for (let i = 0; i < newExercises.length; i++) {
        const { error } = await supabase
          .from('exercise_assignments')
          .update({ order_index: -(i + 1000) })
          .eq('id', newExercises[i].assignment_id)

        if (error) throw error
      }

      // Step 2: Set to actual order_index values
      for (let i = 0; i < newExercises.length; i++) {
        const { error } = await supabase
          .from('exercise_assignments')
          .update({ order_index: i + 1 })
          .eq('id', newExercises[i].assignment_id)

        if (error) throw error
      }

      // Update local state with new order_index values
      setExercises(newExercises.map((ex, idx) => ({
        ...ex,
        order_index: idx + 1
      })))

      console.log('✅ Exercise order updated successfully')
    } catch (err) {
      console.error('Error updating exercise order:', err)
      // Revert on error
      setExercises(exercises)
      alert('Failed to update exercise order: ' + (err.message || 'Unknown error'))
    }
  }

  const fetchData = useCallback(async () => {
    // Derive effective course id if missing
    try {
      setLoading(true)
      setError(null)

      // Step 1: ensure we have a course id
      let effectiveCourseId = currentId
      let unitData = null
      let sessionData = null

      // Try to derive from unitId if courseId missing
      if (!effectiveCourseId && unitId) {
        const { data: uData, error: uErr } = await supabase.from('units').select('*').eq('id', unitId).maybeSingle()
        if (uErr) throw uErr
        unitData = uData
        effectiveCourseId = uData?.course_id || null
      }

      // Try to derive via session -> unit if still missing
      if (!effectiveCourseId && sessionId) {
        const { data: sData, error: sErr } = await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle()
        if (sErr) throw sErr
        sessionData = sData
        if (sData?.unit_id && !unitData) {
          const { data: u2Data, error: u2Err } = await supabase.from('units').select('*').eq('id', sData.unit_id).maybeSingle()
          if (u2Err) throw u2Err
          unitData = u2Data
          effectiveCourseId = u2Data?.course_id || null
        }
      }

      if (!effectiveCourseId) {
        setLoading(false)
        setError('Không xác định được khóa học từ URL. Vui lòng quay lại chọn đúng lộ trình.')
        return
      }

      // Step 2: fetch remaining data in parallel
      const [levelResult, unitResult, sessionResult, exercisesResult, allUnitsResult] = await Promise.all([
        supabase.from('courses').select('*').eq('id', effectiveCourseId).single(),
        unitData ? Promise.resolve({ data: unitData, error: null }) : supabase.from('units').select('*').eq('id', unitId).single(),
        sessionData ? Promise.resolve({ data: sessionData, error: null }) : supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('exercise_assignments').select(`
          *,
          exercises (*)
        `).eq('session_id', sessionId).order('order_index'),
        supabase.from('units').select('*').order('unit_number')
      ])

      if (levelResult.error) throw levelResult.error
      if (unitResult.error) throw unitResult.error
      if (sessionResult.error) throw sessionResult.error
      if (exercisesResult.error) throw exercisesResult.error
      if (allUnitsResult.error) throw allUnitsResult.error

      // For students, verify they are enrolled in this course
      if (profile?.role === 'user') {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('student_id', user.id)
          .eq('course_id', levelResult.data.id)
          .eq('is_active', true)
          .single()

        if (enrollmentError || !enrollmentData) {
          console.error('Student not enrolled in this course:', enrollmentError)
          setError('Bạn chưa được ghi danh vào khóa học này')
          navigate('/study')
          return
        }
      }

      setLevel(levelResult.data)
      setUnit(unitResult.data)
      setSession(sessionResult.data)
      
      // Extract exercises from assignments
      const assignments = exercisesResult.data || []
      const exercises = assignments.map(assignment => ({
        ...assignment.exercises,
        assignment_id: assignment.id,
        order_index: assignment.order_index
      }))
      setExercises(exercises)
      
      // Debug logging for exercises
      console.log('📋 All exercise assignments loaded:', assignments)
      console.log('📋 Extracted exercises:', exercises)

      // Fetch all sessions for this level (for sidebar)
      // Build unit ids for this course
      const levelUnitIds = allUnitsResult.data?.filter(u => (u.course_id === levelResult.data.id) || (u.level_id === levelId)).map(u => u.id) || []
      const { data: allLevelSessions, error: allSessionsError } = await supabase
        .from('sessions')
        .select('*')
        .in('unit_id', levelUnitIds)
        .eq('is_active', true)
        .order('session_number')

      if (allSessionsError) {
        console.error('Error fetching all level sessions:', allSessionsError)
      }

      // Fetch session progress for sidebar
      const { data: sessionProgressData, error: sessionProgressError } = await supabase
        .from('session_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('session_id', allLevelSessions?.map(s => s.id) || [])

      if (sessionProgressError) {
        console.error('Error fetching session progress:', sessionProgressError)
      }

      // Fetch all exercises for these sessions to calculate detailed progress
      const { data: allExercises, error: exercisesErr } = await supabase
        .from('exercises')
        .select('id, session_id, xp_reward, is_active')
        .in('session_id', allLevelSessions?.map(s => s.id) || [])
        .eq('is_active', true)

      if (exercisesErr) {
        console.error('Error fetching exercises for progress:', exercisesErr)
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

      // Build maps for progress calculation
      const sessionIdToExercises = {}
      allExercises?.forEach(ex => {
        if (!sessionIdToExercises[ex.session_id]) sessionIdToExercises[ex.session_id] = []
        sessionIdToExercises[ex.session_id].push(ex)
      })

      const completedSet = new Set(
        (userCompleted || []).filter(p => p.status === 'completed').map(p => p.exercise_id)
      )

      // Build session progress map with calculated values
      const sessionProgressMap = {}

      // Seed with DB rows first
      sessionProgressData?.forEach(progress => {
        sessionProgressMap[progress.session_id] = progress
      })

      // Fill/override computed fields
      allLevelSessions?.forEach(s => {
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
            status: total > 0 && completedCount === total ? 'completed' :
                   completedCount > 0 ? 'in_progress' : 'not_started',
            xp_earned: xpEarned,
            progress_percentage: percentage
          }
        }
      })

      setLevels([])
      setUnits(allUnitsResult.data || [])
      setAllLevelSessions(allLevelSessions || [])
      setSessionProgress(sessionProgressMap)
    } catch (err) {
      console.error('Error fetching exercises:', err)
      setError('Không thể tải danh sách exercise')
    } finally {
      setLoading(false)
    }
  }, [levelId, unitId, sessionId])

  useEffect(() => {
    if (user && unitId && sessionId) {
      fetchData()
    }
  }, [fetchData])


  // Refresh progress when userProgress changes
  useEffect(() => {
    if (userProgress.length > 0) {
      console.log('📊 Progress updated in ExerciseList:', userProgress)
    }
  }, [userProgress])

  // Bottom nav Back: go back to unit view (session list)
  useEffect(() => {
    const handleBottomNavBack = () => {
      console.log('🎯 Bottom nav "Back" clicked in ExerciseList');
      const base = levelId ? `/study/level/${levelId}` : `/study/course/${unit?.course_id || level?.id}`
      navigate(`${base}/unit/${unitId}`)
    };

    window.addEventListener('bottomNavBack', handleBottomNavBack);
    return () => window.removeEventListener('bottomNavBack', handleBottomNavBack);
  }, [levelId, unitId, navigate])

  const getExerciseIcon = (exerciseType) => {
    const IconImg = ({ src, className = '' }) => (
      <img src={src} alt="" className={className} />
    )

    const icons = {
      fill_blank: (props) => (
        <IconImg src="https://xpclass.vn/xpclass/icon/fill_blank.svg" {...props} />
      ),
      drag_drop: (props) => (
        <IconImg src="https://xpclass.vn/xpclass/icon/drag_drop.svg" {...props} />
      ),
      multiple_choice: (props) => (
        <IconImg src="https://xpclass.vn/xpclass/icon/multiple_choice.svg" {...props} />
      ),
      dropdown: (props) => (
        <IconImg src="https://xpclass.vn/xpclass/icon/drop_down.svg" {...props} />
      ),
      ai_fill_blank: (props) => (
        <IconImg src="https://xpclass.vn/xpclass/icon/fill_blank.svg" {...props} />
      ),
      flashcard: (props) => (
        <IconImg src={"https://xpclass.vn/xpclass/icon/flashcard.svg"} {...props} />
      ),
      image_hotspot: () => Image
    }
    return icons[exerciseType] || BookOpen
  }

  const getExerciseColor = (exerciseType) => {
    const colors = {
      flashcard: 'text-blue-600 bg-blue-100',
      fill_blank: 'text-purple-600 bg-purple-100',
      multiple_choice: 'text-orange-600 bg-orange-100',
      dropdown: 'text-indigo-600 bg-indigo-100',
      image_hotspot: 'text-cyan-600 bg-cyan-100',
    }
    return colors[exerciseType] || 'text-gray-600 bg-gray-100'
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

  const getExerciseStatus = (exercise, index) => {
    const progress = userProgress.find(p => p.exercise_id === exercise.id)
    
    // All exercises are now always available (unlocked)
    if (!progress) {
      return { status: 'available', canAccess: true }
    }

    return {
      status: progress.status,
      canAccess: true // Always allow access
    }
  }

  const getExercisePath = (exercise) => {
    // Map exercise types to their corresponding paths
    const paths = {
      flashcard: '/study/flashcard',
      fill_blank: '/study/fill-blank',
      multiple_choice: '/study/multiple-choice',
      drag_drop: '/study/drag-drop',
      dropdown: '/study/dropdown',
      ai_fill_blank: '/study/ai-fill-blank',
      pronunciation: '/study/pronunciation',
      image_hotspot: '/study/image-hotspot',
    }

    const basePath = paths[exercise.exercise_type] || '/study/flashcard'
    console.log('🔍 Exercise type:', exercise.exercise_type, 'Available paths:', Object.keys(paths), 'Selected path:', basePath)
    return basePath
  }

  // Sortable Exercise Card Component
  const SortableExerciseCard = ({ exercise, index }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: exercise.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const { status, canAccess } = getExerciseStatus(exercise, index)
    const progress = userProgress.find(p => p.exercise_id === exercise.id)
    const theme = getThemeColors(session?.color_theme || unit?.color_theme || level?.color_theme)
    const isLocked = !canAccess
    const ExerciseIcon = getExerciseIcon(exercise.exercise_type)

    // Check if this is the first incomplete exercise
    const isFirstIncomplete = !isLocked && status !== 'completed' &&
      exercises.slice(0, index).every((ex, i) => {
        const exStatus = getExerciseStatus(ex, i).status
        return exStatus === 'completed' || !getExerciseStatus(ex, i).canAccess
      })

    const handleExerciseClick = () => {
      if (!isLocked) {
        navigate(`${getExercisePath(exercise)}?exerciseId=${exercise.id}&sessionId=${sessionId}&levelId=${levelId}&unitId=${unitId}`)
      }
    }

    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          animation: isFirstIncomplete ? 'scalePulse 2s ease-in-out infinite' : undefined
        }}
        className={`relative flex items-center p-4 rounded-lg border transition-all duration-200 overflow-hidden shadow-md ${
          isLocked
            ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200'
            : 'bg-white border-gray-300'
        } ${status === 'completed' ? 'border-green-400 bg-green-300' : ''}`}
      >
        {/* Shining effect - only for completed exercises */}
        {status === 'completed' && (
          <div
            className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{
              animation: 'shimmer 4s infinite'
            }}
          />
        )}
        {/* Right-aligned check mark for completed exercises */}
        {status === 'completed' && (
          <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
            <img src="https://xpclass.vn/xpclass/icon/green_check.svg" alt="Completed" className="w-16 h-16 opacity-30" />
          </div>
        )}
        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes scalePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
          }
        `}</style>
        {/* Drag Handle - Only show for admins/teachers */}
        {canCreateContent() && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mr-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5" />
          </div>
        )}

        {/* Exercise Icon */}
        <div
          className="flex-shrink-0 w-12 h-12 mr-4 cursor-pointer"
          onClick={handleExerciseClick}
        >
          <div className={`w-full h-full rounded-lg flex items-center justify-center ${
            isLocked ? 'bg-gray-100' :
            status === 'completed' ? 'bg-green-100' :
            getExerciseColor(exercise.exercise_type)
          }`}>
            <ExerciseIcon className={`w-6 h-6 ${
              isLocked ? 'text-gray-400' :
              status === 'completed' ? 'text-green-600' :
              'text-current'
            }`} />
          </div>
        </div>

        {/* Exercise Info */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={handleExerciseClick}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {exercise.title}
            </h3>
            <div className="flex items-center space-x-2">
              {canCreateContent() && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setAssignToStudentExercise(exercise)
                    }}
                    className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="Assign to individual student"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  {profile?.role === 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingExercise(exercise)
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Edit exercise"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteExercise(exercise)
                    }}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Delete exercise"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {isLocked && (
                <Lock className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-s ${
              status === 'completed'
                ? 'bg-amber-100 text-amber-800 font-bold'
                : 'bg-gray-100 text-gray-600 font-medium'
            }`}>
              <img
                src="https://xpclass.vn/xpclass/icon/xp_small.svg"
                alt="XP"
                className={`w-4 h-4 ${status === 'completed' ? '' : 'grayscale'}`}
              />
              {exercise.xp_reward || 10} XP
            </span>
            {progress && progress.score && (
              <span>Score: {progress.score}%</span>
            )}
          </div>
        </div>

        {/* Arrow */}
        {!isLocked && (
          <ChevronRight
            className="w-5 h-5 text-gray-400 ml-4 cursor-pointer"
            onClick={handleExerciseClick}
          />
        )}
      </div>
    )
  }

  if (loading && exercises.length === 0) {
    return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar skeleton */}
        <div className="w-80 transition-all duration-300 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-b border-gray-100 animate-pulse">
                <SkeletonSidebarItem wide />
                <div className="ml-6 space-y-1 pb-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="px-2">
                      <div className="h-7 bg-gray-50 hover:bg-gray-50 rounded-lg flex items-center px-2">
                        <div className="w-4 h-4 bg-gray-200 rounded mr-3" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
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
        <Button onClick={fetchData} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!session || !unit || !level) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không tìm thấy thông tin</div>
        <Button onClick={() => navigate(`/study/level/${levelId}/unit/${unitId}`)} variant="outline">
          Quay lại
        </Button>
      </div>
    )
  }

  const theme = getThemeColors(session.color_theme || unit.color_theme || level.color_theme)

  return (
    <div className="flex bg-white -mx-4 -my-6">
      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/study/course/${currentId}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{session.title}</h2>
                <p className="text-gray-600 font-bold">{unit.title}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">


          {/* Add Exercise Button */}
          {canCreateContent() && (
            <div className="mb-6">
              <Button
                onClick={() => setShowAssignExerciseModal(true)}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Assign Exercises
              </Button>
            </div>
          )}

          {/* Exercises list with Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={exercises.map(ex => ex.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {exercises.map((exercise, index) => (
                  <SortableExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Empty state */}
          {exercises.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có exercise nào</h3>
              <p className="text-gray-600">Các exercise sẽ sớm được cập nhật!</p>
              {canCreateContent() && (
                <Button
                  onClick={() => setShowAssignExerciseModal(true)}
                  className="mt-4 bg-green-600 text-white hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Assign First Exercise
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Assign Exercise Modal */}
      {showAssignExerciseModal && (
        <AssignExerciseModal
          sessionId={sessionId}
          onClose={() => setShowAssignExerciseModal(false)}
          onAssigned={handleExercisesAssigned}
        />
      )}

      {/* Assign to Student Modal */}
      <AssignToStudentModal
        isOpen={!!assignToStudentExercise}
        onClose={() => setAssignToStudentExercise(null)}
        exercise={assignToStudentExercise}
      />

      {/* Edit Exercise Modal */}
      <EditExerciseModal
        isOpen={!!editingExercise}
        onClose={() => setEditingExercise(null)}
        exercise={editingExercise}
        onUpdate={fetchData}
      />
    </div>
  )
}

export default ExerciseList