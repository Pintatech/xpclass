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
  Clock,
  ArrowRight,
  Target,
  PlayCircle,
  Mic,
  Volume2,
  Music,
  Video,
  Image,
  HelpCircle,
  ChevronRight
} from 'lucide-react'

const ExerciseList = () => {
  const { levelId, unitId, sessionId } = useParams()
  const navigate = useNavigate()
  const [level, setLevel] = useState(null)
  const [unit, setUnit] = useState(null)
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [exerciseProgress, setExerciseProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [levels, setLevels] = useState([])
  const [units, setUnits] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    if (user && levelId && unitId && sessionId) {
      fetchData()
    }
  }, [user, levelId, unitId, sessionId])

  // Bottom nav Back: go back to unit view (session list)
  useEffect(() => {
    const handleBottomNavBack = () => {
      console.log('🎯 Bottom nav "Back" clicked in ExerciseList');
      navigate(`/study/level/${levelId}/unit/${unitId}`)
    };

    window.addEventListener('bottomNavBack', handleBottomNavBack);
    return () => window.removeEventListener('bottomNavBack', handleBottomNavBack);
  }, [levelId, unitId, navigate])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [levelResult, unitResult, sessionResult, exercisesResult, progressResult, allLevelsResult, allUnitsResult] = await Promise.all([
        supabase.from('levels').select('*').eq('id', levelId).single(),
        supabase.from('units').select('*').eq('id', unitId).single(),
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('exercises').select('*').eq('session_id', sessionId).eq('is_active', true).order('order_index'),
        supabase.from('user_progress').select('*').eq('user_id', user.id),
        supabase.from('levels').select('*').order('level_number'),
        supabase.from('units').select('*').order('unit_number')
      ])

      if (levelResult.error) throw levelResult.error
      if (unitResult.error) throw unitResult.error
      if (sessionResult.error) throw sessionResult.error
      if (exercisesResult.error) throw exercisesResult.error
      if (progressResult.error) throw progressResult.error
      if (allLevelsResult.error) throw allLevelsResult.error
      if (allUnitsResult.error) throw allUnitsResult.error

      // Create progress map
      const progressMap = {}
      progressResult.data?.forEach(progress => {
        progressMap[progress.exercise_id] = progress
      })

      setLevel(levelResult.data)
      setUnit(unitResult.data)
      setSession(sessionResult.data)
      setExercises(exercisesResult.data || [])
      
      // Debug logging for exercises
      console.log('📋 All exercises loaded:', exercisesResult.data)
      console.log('📋 Looking for exercise ID:', 'afbeb98b-5ebf-4c82-b982-9cb172d49155')
      exercisesResult.data?.forEach(ex => {
        console.log('📋 Exercise:', ex.id, 'Type:', ex.exercise_type, 'Title:', ex.title)
        if (ex.id === '921d5b91-de0a-4093-81e9-8e661b7fabfe' || ex.id === 'afbeb98b-5ebf-4c82-b982-9cb172d49155') {
          console.log('🎯 Target exercise in database:', ex)
        }
      })
      setExerciseProgress(progressMap)
      setLevels(allLevelsResult.data || [])
      setUnits(allUnitsResult.data || [])
    } catch (err) {
      console.error('Error fetching exercises:', err)
      setError('Không thể tải danh sách exercise')
    } finally {
      setLoading(false)
    }
  }

  const getExerciseIcon = (exerciseType) => {
    const icons = {
      combined_learning: Image,
      flashcard: BookOpen,
      audio_flashcard: Volume2,
      sentence_pronunciation: Mic,
      multiple_choice: HelpCircle,
    }
    return icons[exerciseType] || BookOpen
  }

  const getExerciseColor = (exerciseType) => {
    const colors = {
      combined_learning: 'text-violet-600 bg-violet-100',
      flashcard: 'text-blue-600 bg-blue-100',
      audio_flashcard: 'text-green-600 bg-green-100',
      sentence_pronunciation: 'text-emerald-600 bg-emerald-100',
      multiple_choice: 'text-orange-600 bg-orange-100',
    }
    return colors[exerciseType] || 'text-gray-600 bg-gray-100'
  }

  const getExerciseTypeLabel = (exerciseType) => {
    const labels = {
      combined_learning: 'Word Pronunciation',
      flashcard: 'Flashcard',
      audio_flashcard: 'Audio Flashcard',
      sentence_pronunciation: 'Sentence Pronunciation',
      multiple_choice: 'Multiple Choice',
    }
    return labels[exerciseType] || exerciseType
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
    const progress = exerciseProgress[exercise.id]
    
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
      combined_learning: '/study/combined-learning',
      flashcard: '/study/flashcard',
      audio_flashcard: '/study/audio-flashcard',
      sentence_pronunciation: '/study/sentence-pronunciation',
      multiple_choice: '/study/multiple-choice',
    }

    const selectedPath = paths[exercise.exercise_type] || '/study/flashcard'
    console.log('🔍 Exercise type:', exercise.exercise_type, 'Available paths:', Object.keys(paths), 'Selected path:', selectedPath)
    return selectedPath
  }

  const renderExerciseCard = (exercise, index) => {
    const { status, canAccess } = getExerciseStatus(exercise, index)
    const progress = exerciseProgress[exercise.id]
    const theme = getThemeColors(session?.color_theme || unit?.color_theme || level?.color_theme)
    const isLocked = !canAccess
    const ExerciseIcon = getExerciseIcon(exercise.exercise_type)

    return (
      <Link
        key={exercise.id}
        to={`${getExercisePath(exercise)}?exerciseId=${exercise.id}&sessionId=${sessionId}`}
        className={`block ${isLocked ? 'pointer-events-none' : ''}`}
      >
        <div
          className={`flex items-center p-4 rounded-lg border transition-all duration-200 ${
            isLocked
              ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200'
              : 'cursor-pointer hover:shadow-md hover:bg-gray-50 border-gray-300'
          } ${status === 'completed' ? 'border-green-200 bg-green-50' : ''}`}
        >
          {/* Exercise Icon */}
          <div className="flex-shrink-0 w-12 h-12 mr-4">
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
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {exercise.title}
              </h3>
              <div className="flex items-center space-x-2">
                {status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                {isLocked && (
                  <Lock className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>

            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {getExerciseTypeLabel(exercise.exercise_type)}
              </span>
              {progress && progress.score && (
                <span>Score: {progress.score}%</span>
              )}
              <span>Exercise {index + 1}</span>
            </div>
          </div>

          {/* Arrow */}
          {!isLocked && (
            <ChevronRight className="w-5 h-5 text-gray-400 ml-4" />
          )}
        </div>
      </Link>
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-16'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h2 className="text-lg font-semibold text-gray-900">Nội dung học</h2>
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

              {/* Units for this level */}
              {levelItem.id === levelId && sidebarOpen && (
                <div className="ml-6 space-y-1 pb-3">
                  {units
                    .filter(unitItem => unitItem.level_id === levelItem.id)
                    .map((unitItem) => (
                      <Link
                        key={unitItem.id}
                        to={`/study/level/${levelItem.id}/unit/${unitItem.id}`}
                        className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                          unitItem.id === unitId
                            ? 'bg-green-100 text-green-700'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                          unitItem.id === unitId
                            ? 'bg-green-200'
                            : 'bg-gray-200'
                        }`}>
                          {unitItem.unit_number}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{unitItem.title}</div>
                          <div className="text-xs text-gray-500 truncate">{unitItem.description}</div>
                        </div>
                      </Link>
                    ))}
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
                onClick={() => navigate(`/study/level/${levelId}/unit/${unitId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{session.title}</h1>
                <p className="text-gray-600">{session.description}</p>
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
            <Link to="/study" className="hover:text-primary-600">{level.title}</Link>
            <ArrowRight className="w-4 h-4" />
            <Link to={`/study/level/${levelId}`} className="hover:text-primary-600">{unit.title}</Link>
            <ArrowRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium">{session.title}</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Session progress summary */}
          <Card className={`mb-6 bg-gradient-to-r from-${session.color_theme || unit.color_theme || level.color_theme}-50 to-${session.color_theme || unit.color_theme || level.color_theme}-100 border-${session.color_theme || unit.color_theme || level.color_theme}-200`}>
            <Card.Content className="p-6">
              <div className="grid grid-cols-4 gap-6 text-center">
                <div>
                  <div className={`text-2xl font-bold ${theme.text}`}>
                    {Object.values(exerciseProgress).filter(p => p.status === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-600">Exercises hoàn thành</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${theme.text}`}>
                    {exercises.length}
                  </div>
                  <div className="text-sm text-gray-600">Tổng exercises</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${theme.text}`}>
                    {Object.values(exerciseProgress).reduce((total, p) => total + (p.score || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Điểm số</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${theme.text}`}>
                    {session.xp_reward || 50}
                  </div>
                  <div className="text-sm text-gray-600">XP thưởng</div>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Exercises list */}
          <div className="space-y-4">
            {exercises.map((exercise, index) => renderExerciseCard(exercise, index))}
          </div>

          {/* Empty state */}
          {exercises.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có exercise nào</h3>
              <p className="text-gray-600">Các exercise sẽ sớm được cập nhật!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExerciseList
