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

// Theme-based background images for exercise map
const getThemeBackgroundImage = (colorTheme) => {
  const themeBackgrounds = {
    blue: "https://xpclass.vn/xpclass/image/bg.jpg",
    green: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop&q=60",
    purple: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&auto=format&fit=crop&q=60",
    orange: "https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=800&auto=format&fit=crop&q=60",
    red: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&auto=format&fit=crop&q=60",
    yellow: "https://xpclass.vn/xpclass/image/bh_test.jpg",
  };
  return themeBackgrounds[colorTheme] || themeBackgrounds.blue;
};
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

// All 11 positions along the path (from bottom to top)
const allPositions = [
  { x: 23, y: 95 },  // 1
  { x: 65, y:90 },  // 2
  { x: 82, y: 74 },  // 3
  { x: 53, y: 68 },  // 4
  { x: 20, y: 57 },  // 5
  { x: 60, y: 50 },  // 6
  { x: 78, y: 38 },  // 7
  { x: 40, y: 34 },  // 8
  { x: 22, y: 22 },  // 9
  { x: 59, y: 16 },  // 10
  { x: 82, y: 6 },   // 11
]

// Pick evenly spaced positions (always include first and last)
function getSpreadPositions(count) {
  if (count <= 1) return [allPositions[0]]
  if (count >= allPositions.length) return allPositions

  const positions = []
  for (let i = 0; i < count; i++) {
    // Map i from [0, count-1] to [0, allPositions.length-1]
    const index = Math.round((i / (count - 1)) * (allPositions.length - 1))
    positions.push(allPositions[index])
  }
  return positions
}

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
  const [courseLevels, setCourseLevels] = useState([])
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

      setCourseLevels([])
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

  // Generate levels from exercises
  const generateLevels = () => {
    const positions = getSpreadPositions(exercises.length)

    return exercises.map((exercise, i) => {
      const progress = userProgress.find(p => p.exercise_id === exercise.id)
      const stars = progress?.status === 'completed' ? getStarCount(progress?.score, progress?.status) : 0
      const currentIndex = exercises.findIndex(ex => {
        const p = userProgress.find(pr => pr.exercise_id === ex.id)
        return !p || p.status !== 'completed'
      })

      return {
        id: exercise.id,
        exerciseNumber: i + 1,
        title: exercise.title,
        x: positions[i]?.x || 50,
        y: positions[i]?.y || 50,
        stars,
        unlocked: true, // All exercises are unlocked
        current: i === currentIndex,
        completed: progress?.status === 'completed',
        exercise
      }
    })
  }

  const levels = exercises.length > 0 ? generateLevels() : []

  // Level Node Component
  const LevelNode = ({ level }) => {
    const { exerciseNumber, x, y, stars, unlocked, current, completed, exercise } = level

    const handleClick = () => {
      if (unlocked) {
        navigate(`${getExercisePath(exercise)}?exerciseId=${exercise.id}&sessionId=${sessionId}&levelId=${levelId}&unitId=${unitId}`)
      }
    }

    return (
      <div
        className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${current ? 'z-20' : 'z-10'}`}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        {current && (
          <div className="absolute bottom-full left-0 right-0 mx-auto w-8 h-10 md:w-10 md:h-[50px] animate-bounce">
            <svg viewBox="0 0 40 50" className="w-full h-full drop-shadow-lg">
              <defs>
                <linearGradient id="pinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4CAF50"/>
                  <stop offset="100%" stopColor="#2E7D32"/>
                </linearGradient>
              </defs>
              <path d="M20,0 C31,0 40,9 40,20 C40,35 20,50 20,50 C20,50 0,35 0,20 C0,9 9,0 20,0 Z" fill="url(#pinGradient)"/>
              <circle cx="20" cy="18" r="8" fill="white"/>
            </svg>
          </div>
        )}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-full border-4 flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl ${
              !unlocked
                ? 'bg-gradient-to-b from-gray-300 to-gray-400 border-gray-500 cursor-not-allowed'
                : completed || current
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 border-emerald-600'
                : 'bg-gradient-to-b from-amber-400 to-amber-500 border-amber-600 cursor-pointer'
            } ${current ? 'animate-pulse shadow-emerald-400/40' : ''}`}
            onClick={handleClick}
          >
            <span className={`text-xl md:text-2xl font-bold ${completed || current ? 'text-white' : 'text-gray-800'}`}>
              {exerciseNumber}
            </span>
          </div>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 flex gap-0.5 mt-1">
          {[1, 2, 3].map((star) => (
            <span
              key={star}
              className={`text-base leading-none ${star <= stars ? 'text-amber-400 drop-shadow-sm' : 'text-gray-300'}`}
            >
              ★
            </span>
          ))}
        </div>

        {/* Admin/Teacher action buttons */}
        {canCreateContent() && (
          <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity z-20">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setEditingExercise(exercise)
              }}
              className="p-1 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
              title="Edit exercise"
            >
              <Edit className="w-3 h-3 text-gray-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteExercise(exercise)
              }}
              className="p-1 bg-white rounded-full shadow-lg hover:bg-red-100 transition-colors"
              title="Remove exercise"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative w-full h-[100vh] md:h-[100vh] overflow-hidden md:mx-0"
      style={{
        margin: '-1.5rem -1rem',
        width: 'calc(100% + 2rem)'
      }}
    >
      {/* Blurred background layer */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed blur-lg"
        style={{
          backgroundImage: `url('https://xpclass.vn/xpclass/image/bg_blur.jpg')`,
          zIndex: 0
        }}
      />
      <div className="relative z-[1] w-full md:w-[90%] md:max-w-[500px] h-full md:h-full mx-auto overflow-hidden md:shadow-2xl bg-gray-100">
        {/* Background */}
        <img
          src={getThemeBackgroundImage(session?.color_theme || unit?.color_theme || level?.color_theme)}
          alt="Map"
          className="w-full h-full object-cover absolute top-0 left-0 z-0"
        />

        {/* Level nodes */}
        <div className="absolute inset-0 w-full h-full z-10">
          {levels.map((level) => (
            <LevelNode key={level.id} level={level} />
          ))}
        </div>

        {/* Back button overlay */}
        <button
          onClick={() => navigate(`/study/course/${currentId}`)}
          className="absolute top-4 left-4 p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors z-50"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>

        {/* Session title overlay */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-6 py-3 z-50">
          <h2 className="text-xl font-bold text-gray-900">{session.title}</h2>
          <p className="text-sm text-gray-600">{unit.title}</p>
        </div>

        {/* Chest Card - Always visible for students */}
        {!canCreateContent() && (
          <div
            onClick={() => {
              if (isSessionComplete() && !sessionRewards[sessionId]?.claimed) {
                handleClaimReward()
              }
            }}
            className={`absolute top-4 right-4 z-[100] ${
              isSessionComplete() && !sessionRewards[sessionId]?.claimed ? "cursor-pointer" : "cursor-default"
            }`}
            style={{ width: "60px", height: "60px" }}
          >
            <img
              src="https://xpclass.vn/xpclass/image/chest_cropped_once1.gif"
              alt="Chest"
              className="w-full h-full object-contain drop-shadow-lg"
              style={{
                filter: sessionRewards[sessionId]?.claimed ? 'grayscale(100%)' : 'none'
              }}
            />
          </div>
        )}

        {/* Add Exercise Button - Only for admins/teachers */}
        {canCreateContent() && (
          <button
            onClick={() => setShowAssignExerciseModal(true)}
            className="absolute bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Exercise</span>
          </button>
        )}
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