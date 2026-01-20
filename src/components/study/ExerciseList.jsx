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
  Star
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
  // Session reward states
  const [sessionRewards, setSessionRewards] = useState({})
  const [claimingReward, setClaimingReward] = useState(null)
  const [rewardAmount, setRewardAmount] = useState(0)
  const [showChestSelection, setShowChestSelection] = useState(false)
  const [selectedChest, setSelectedChest] = useState(null)
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
      image_hotspot: (props) => (
        <IconImg src="https://xpclass.vn/xpclass/icon/hotspot.svg" {...props} />
      )
    }
    return icons[exerciseType] || ((props) => <BookOpen {...props} />)
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

  // Get star count based on score: 95-100 = 3 stars, 90-95 = 2 stars, passed (<90) = 1 star, not passed = 0 stars
  const getStarCount = (score, status) => {
    if (status !== 'completed') return 0
    if (score >= 95) return 3
    if (score >= 90) return 2
    if (score > 0) return 1
    return 0
  }

  // Render stars component
  const renderStars = (score, status) => {
    const starCount = getStarCount(score, status)
    if (starCount === 0) return null

    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3].map((i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i <= starCount
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
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

  // Check if all exercises in the session are completed
  const isSessionComplete = () => {
    if (exercises.length === 0) return false
    return exercises.every((exercise) => {
      const progress = userProgress.find(p => p.exercise_id === exercise.id)
      return progress?.status === 'completed'
    })
  }

  // Fetch session rewards
  const fetchSessionRewards = async () => {
    if (!user || !sessionId) return

    try {
      const { data, error } = await supabase
        .from('session_reward_claims')
        .select('session_id, xp_awarded, claimed_at')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching session rewards:', error)
        return
      }

      if (data) {
        setSessionRewards({
          [sessionId]: {
            claimed: true,
            xp: data.xp_awarded,
            claimed_at: data.claimed_at
          }
        })
      }
    } catch (err) {
      console.error('Error fetching session rewards:', err)
    }
  }

  // Handle claiming session reward
  const handleClaimReward = async () => {
    if (!user || claimingReward || sessionRewards[sessionId]?.claimed) return
    if (!isSessionComplete()) return

    // Show chest selection modal
    setShowChestSelection(true)
  }

  const handleChestSelect = async (chestNumber) => {
    if (selectedChest !== null) return

    setSelectedChest(chestNumber)
    setClaimingReward(sessionId)

    // Play chest opening sound
    const audio = new Audio('https://xpclass.vn/xpclass/sound/chest_sound.mp3')
    audio.play().catch((err) => console.error('Error playing sound:', err))

    try {
      // Generate random XP between 5 and 20
      const xp = Math.floor(Math.random() * 16) + 5

      // Insert claim record
      const { error: claimError } = await supabase
        .from('session_reward_claims')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          full_name: profile?.full_name || null,
          xp_awarded: xp
        })

      if (claimError) throw claimError

      // Update user's total XP
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('xp')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

      const { error: updateError } = await supabase
        .from('users')
        .update({
          xp: (currentUser?.xp || 0) + xp,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Wait for GIF to complete before showing XP
      setTimeout(() => {
        setRewardAmount(xp)

        // Show XP for 1.5 seconds then close
        setTimeout(() => {
          setSessionRewards((prev) => ({
            ...prev,
            [sessionId]: {
              claimed: true,
              xp: xp,
              claimed_at: new Date().toISOString()
            }
          }))

          setShowChestSelection(false)
          setClaimingReward(null)
          setSelectedChest(null)
          setRewardAmount(0)
        }, 1500)
      }, 2000)
    } catch (err) {
      console.error('Error claiming reward:', err)
      alert('Không thể nhận phần thưởng. Vui lòng thử lại!')
      setClaimingReward(null)
      setSelectedChest(null)
      setShowChestSelection(false)
    }
  }

  // Fetch session rewards on mount
  useEffect(() => {
    if (user && sessionId) {
      fetchSessionRewards()
    }
  }, [user, sessionId])

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
      <div className="relative">
        {/* Connecting line - positioned outside the card */}
        {index < exercises.length - 1 && (
          <div
            className={`absolute w-1 ${
              status === 'completed' && getExerciseStatus(exercises[index + 1], index + 1).status === 'completed'
                ? 'bg-green-400'
                : 'bg-gray-300'
            }`}
            style={{
              left: canCreateContent() ? '77px' : '46px',
              top: '80px',
              height: 'calc(100% - 30px)',
              zIndex: 1
            }}
          />
        )}
        <div
          ref={setNodeRef}
          style={{
            ...style
          }}
          className={`relative flex items-center p-4 rounded-2xl transition-all duration-200 overflow-hidden ${
            isLocked
              ? 'opacity-60 cursor-not-allowed bg-gray-50'
              : 'bg-white'
          }`}
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
        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
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
          className={`relative flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center cursor-pointer border-4 z-10 ${
              isLocked ? 'bg-gray-100 border-gray-300' :
              status === 'completed' ? 'bg-green-100 border-green-400' :
              getExerciseColor(exercise.exercise_type) + ' border-gray-300'
            }`}
            onClick={handleExerciseClick}
          >
            <ExerciseIcon className={`w-8 h-8 ${
              isLocked ? 'text-gray-400' :
              status === 'completed' ? 'text-green-600' :
              'text-current'
            }`} />
        </div>
        <div className="mr-4" />

        {/* Exercise Title and Status */}
        <div className={`flex-1 flex items-center justify-between border-2 border-b-4 rounded-xl px-6 py-4 ${
          status === 'completed' ? 'bg-green-100 border-green-400' : 'border-gray-300'
        }`}>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={handleExerciseClick}>
            <h3 className="text-base font-medium text-gray-800">
              {exercise.title}
            </h3>
          </div>

          {/* Stars on the right */}
          {!canCreateContent() && renderStars(progress?.score, status)}

          {/* Action Buttons */}
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

          {isLocked && <Lock className="w-4 h-4 text-gray-400 ml-2" />}
        </div>
        </div>
      </div>
    )
  }

  if (loading && exercises.length === 0) {
    return (
      <div className="flex bg-white">
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

            {/* Session Progress Circle */}
            {exercises.length > 0 && (
              <div className="flex-shrink-0">
                {(() => {
                  const completedCount = exercises.filter(ex => {
                    const progress = userProgress.find(p => p.exercise_id === ex.id)
                    return progress?.status === 'completed'
                  }).length
                  const totalCount = exercises.length
                  const percentage = Math.round((completedCount / totalCount) * 100)

                  return (
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 transform -rotate-90">
                        {/* Background circle */}
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="#e5e7eb"
                          strokeWidth="5"
                          fill="transparent"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke={percentage === 100 ? '#22c55e' : '#f6c43b'}
                          strokeWidth="5"
                          fill="transparent"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 26}
                          strokeDashoffset={2 * Math.PI * 26 - (percentage / 100) * 2 * Math.PI * 26}
                          className="transition-all duration-500"
                        />
                      </svg>
                      {/* Percentage text */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-sm font-bold ${percentage === 100 ? 'text-green-600' : 'text-gray-600'}`}>
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
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

          {/* Session Reward Chest - after last exercise, matching exercise layout */}
          {!canCreateContent() && exercises.length > 0 && (
            <div className="relative mt-4">
              <div className="relative flex items-center p-4 rounded-2xl bg-white">
                {/* Chest Icon - positioned like exercise icons */}
                <div className="relative flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center z-10">
                  {(() => {
                    const sessionComplete = isSessionComplete()
                    const rewardClaimed = sessionRewards[sessionId]?.claimed
                    const isClaiming = claimingReward === sessionId

                    if (rewardClaimed) {
                      // Already claimed - show empty/opened chest
                      return (
                        <div
                          className="w-16 h-16 cursor-not-allowed"
                          title="Reward claimed"
                        >
                          <img
                            src="https://xpclass.vn/xpclass/icon/chest_opened.png"
                            alt="Reward claimed"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )
                    } else if (isClaiming) {
                      // Claiming - show GIF animation
                      return (
                        <div className="w-16 h-16">
                          <img
                            src="https://xpclass.vn/xpclass/icon/chest_opening.gif"
                            alt="Opening chest"
                            className="w-full h-full object-contain animate-bounce"
                          />
                        </div>
                      )
                    } else if (sessionComplete) {
                      // Complete but not claimed - show unlocked chest
                      return (
                        <button
                          onClick={handleClaimReward}
                          className="w-16 h-16 hover:scale-110 transition-transform cursor-pointer"
                          title="Click to claim reward!"
                        >
                          <img
                            src="https://xpclass.vn/xpclass/icon/chest_ready.png"
                            alt="Claim reward"
                            className="w-full h-full object-contain animate-pulse"
                          />
                        </button>
                      )
                    } else {
                      // Not complete - show locked chest
                      return (
                        <div
                          className="w-16 h-16 cursor-not-allowed"
                          title="Hoàn thành tất cả các bài tập để mở khóa!"
                        >
                          <img
                            src="https://xpclass.vn/xpclass/icon/chest_locked.png"
                            alt="Locked reward"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

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

      {/* Chest Selection Modal */}
      {showChestSelection && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (selectedChest === null) {
              setShowChestSelection(false)
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl p-4 sm:p-8 max-w-2xl w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Choose Your Reward!
            </h2>
            <p className="text-sm sm:text-lg text-gray-600 mb-4 sm:mb-8">
              Pick one chest to reveal your XP reward
            </p>

            <div className="flex justify-center items-center gap-2 sm:gap-8">
              {[1, 2, 3].map((chestNum) => (
                <button
                  key={chestNum}
                  onClick={() => handleChestSelect(chestNum)}
                  disabled={selectedChest !== null}
                  className="relative group flex-shrink-0"
                >
                  <div className="w-20 h-20 sm:w-32 sm:h-32 transition-transform transform group-hover:scale-110">
                    <img
                      src={
                        selectedChest === chestNum
                          ? "https://xpclass.vn/xpclass/icon/chest_cropped_once.gif"
                          : "https://xpclass.vn/xpclass/image/chest_cropped_once1.gif"
                      }
                      alt={`Chest ${chestNum}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {selectedChest === chestNum && rewardAmount > 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg py-2 px-4 text-xl font-bold shadow-lg animate-bounce">
                        +{rewardAmount} XP
                      </div>
                    </div>
                  ) : (
                    selectedChest === null && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-yellow-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl font-bold">
                          ?
                        </div>
                      </div>
                    )
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExerciseList