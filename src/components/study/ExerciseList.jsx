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
  Image
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
      const [levelResult, unitResult, sessionResult, exercisesResult, progressResult] = await Promise.all([
        supabase.from('levels').select('*').eq('id', levelId).single(),
        supabase.from('units').select('*').eq('id', unitId).single(),
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('exercises').select('*').eq('session_id', sessionId).eq('is_active', true).order('order_index'),
        supabase.from('user_progress').select('*').eq('user_id', user.id)
      ])

      if (levelResult.error) throw levelResult.error
      if (unitResult.error) throw unitResult.error
      if (sessionResult.error) throw sessionResult.error
      if (exercisesResult.error) throw exercisesResult.error
      if (progressResult.error) throw progressResult.error

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
      exercisesResult.data?.forEach(ex => {
        if (ex.id === '921d5b91-de0a-4093-81e9-8e661b7fabfe') {
          console.log('🎯 Target exercise in database:', ex)
        }
      })
      setExerciseProgress(progressMap)
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
    }
    return icons[exerciseType] || BookOpen
  }

  const getExerciseColor = (exerciseType) => {
    const colors = {
      combined_learning: 'text-violet-600 bg-violet-100',
      flashcard: 'text-blue-600 bg-blue-100',
      audio_flashcard: 'text-green-600 bg-green-100',
      sentence_pronunciation: 'text-emerald-600 bg-emerald-100',
    }
    return colors[exerciseType] || 'text-gray-600 bg-gray-100'
  }

  const getExerciseTypeLabel = (exerciseType) => {
    const labels = {
      combined_learning: 'Word Pronunciation',
      flashcard: 'Flashcard',
      audio_flashcard: 'Audio Flashcard',
      sentence_pronunciation: 'Sentence Pronunciation',
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
    }
    
    console.log('🔍 Exercise type:', exercise.exercise_type, 'Path:', paths[exercise.exercise_type] || '/study/flashcard')
    return paths[exercise.exercise_type] || '/study/flashcard'
  }

  const renderExerciseCard = (exercise, index) => {
    const { status, canAccess } = getExerciseStatus(exercise, index)
    const progress = exerciseProgress[exercise.id]
    const theme = getThemeColors(session?.color_theme || unit?.color_theme || level?.color_theme)
    const isLocked = !canAccess
    const ExerciseIcon = getExerciseIcon(exercise.exercise_type)
    
    // Debug logging for specific exercise
    if (exercise.id === '921d5b91-de0a-4093-81e9-8e661b7fabfe') {
      console.log('🎯 Found target exercise:', exercise)
      console.log('🎯 Exercise type:', exercise.exercise_type)
      console.log('🎯 Path will be:', getExercisePath(exercise))
    }

    return (
      <Link 
        key={exercise.id}
        to={`${getExercisePath(exercise)}?exerciseId=${exercise.id}&sessionId=${sessionId}`} 
        className={`block ${isLocked ? 'pointer-events-none' : ''}`}
      >
        <div 
          className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
            isLocked 
              ? 'opacity-60 cursor-not-allowed' 
              : 'hover:shadow-lg hover:scale-105 cursor-pointer'
          }`}
          style={{ aspectRatio: '1' }}
        >
          {/* Exercise Image */}
          {exercise.image_url ? (
            <>
              <img 
                src={exercise.image_url} 
                alt={exercise.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient background if image fails
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'block'
                }}
              />
              {/* Fallback gradient background */}
              <div 
                className={`absolute inset-0 bg-gradient-to-br ${theme.bg} flex items-center justify-center`}
                style={{ display: 'none' }}
              >
                <ExerciseIcon className="w-12 h-12 text-white opacity-80" />
              </div>
            </>
          ) : (
            /* Fallback to gradient if no image */
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} flex items-center justify-center`}>
              <ExerciseIcon className="w-12 h-12 text-white opacity-80" />
            </div>
          )}
          
          {/* Overlay with status icon */}
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              {isLocked ? (
                <Lock className="w-3 h-3 text-gray-600" />
              ) : status === 'completed' ? (
                <CheckCircle className="w-3 h-3 text-green-600" />
              ) : (
                <PlayCircle className="w-3 h-3 text-blue-600" />
              )}
            </div>
          </div>
          
          {/* Title overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <h3 className="text-white font-medium text-xs truncate">{exercise.title}</h3>
          </div>
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
    <div className="space-y-8">
      {/* Header */}
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
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Link to="/study" className="hover:text-primary-600">{level.title}</Link>
        <ArrowRight className="w-4 h-4" />
        <Link to={`/study/level/${levelId}`} className="hover:text-primary-600">{unit.title}</Link>
        <ArrowRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">{session.title}</span>
      </div>

      {/* Session progress summary */}
      <Card className={`bg-gradient-to-r from-${session.color_theme || unit.color_theme || level.color_theme}-50 to-${session.color_theme || unit.color_theme || level.color_theme}-100 border-${session.color_theme || unit.color_theme || level.color_theme}-200`}>
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

      {/* Exercises grid */}
      <div className="grid grid-cols-2 gap-3">
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
  )
}

export default ExerciseList
