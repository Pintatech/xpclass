import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { saveRecentExercise } from '../../utils/recentExercise'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import { ArrowLeft, Play, Volume2 } from 'lucide-react'

const FlashcardExercise = () => {
  const location = useLocation()
  const [currentCard, setCurrentCard] = useState(0)
  const [flashcards, setFlashcards] = useState([])
  const [displayedCards, setDisplayedCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentAudio, setCurrentAudio] = useState(null)
  const [mode, setMode] = useState('4') // '4' or '8'
  const [session, setSession] = useState(null)

  // Get exerciseId and sessionId from URL search params
  const searchParams = new URLSearchParams(location.search)
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (exerciseId) {
      fetchFlashcards()
    } else {
      setLoading(false)
      setError('Không tìm thấy ID bài tập')
    }
  }, [exerciseId])

  // Fetch session info for navigation
  useEffect(() => {
    if (sessionId) {
      fetchSessionInfo()
    }
  }, [sessionId])

  const fetchSessionInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          units:unit_id (
            *,
            levels:level_id (*)
          )
        `)
        .eq('id', sessionId)
        .single()

      if (error) throw error
      setSession(data)
    } catch (err) {
      console.error('Error fetching session info:', err)
    }
  }

  const fetchFlashcards = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'flashcard')
        .single()

      if (error) throw error

      if (data && data.content && data.content.cards) {
        setFlashcards(data.content.cards)
        // Initialize with random cards based on mode
        selectRandomCards(data.content.cards, mode)

        // Save recent exercise for Home page card
        try {
          const continuePath = `/study/flashcard?exerciseId=${data.id}&sessionId=${sessionId}`
          saveRecentExercise({
            ...data,
            continuePath
          })
        } catch { }
      } else {
        setFlashcards([])
        setDisplayedCards([])
      }
    } catch (err) {
      console.error('Error fetching flashcards:', err)
      setError('Không thể tải dữ liệu flashcard')
    } finally {
      setLoading(false)
    }
  }

  const currentFlashcard = displayedCards[currentCard]

  // Function to get next exercise in session
  const getNextExercise = async () => {
    if (!sessionId) return null

    try {
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('session_id', sessionId)
        .eq('is_active', true)
        .order('order_index')

      if (error) throw error

      const currentIndex = exercises.findIndex(ex => ex.id === exerciseId)
      if (currentIndex !== -1 && currentIndex < exercises.length - 1) {
        return exercises[currentIndex + 1]
      }
      return null
    } catch (err) {
      console.error('Error fetching next exercise:', err)
      return null
    }
  }

  // Function to navigate to next exercise
  const goToNextExercise = async () => {
    // Mark current exercise as completed for progress tracking
    try {
      if (user && exerciseId) {
        await supabase.from('user_progress').upsert({
          user_id: user.id,
          exercise_id: exerciseId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    } catch (e) {
      console.error('Failed to mark exercise completed:', e)
    }

    const nextExercise = await getNextExercise()

    if (nextExercise) {
      const paths = {
        combined_learning: '/study/combined-learning',
        flashcard: '/study/flashcard',
        audio_flashcard: '/study/audio-flashcard',
        sentence_pronunciation: '/study/sentence-pronunciation'
      }
      const exercisePath = paths[nextExercise.exercise_type] || '/study/flashcard'
      navigate(`${exercisePath}?exerciseId=${nextExercise.id}&sessionId=${sessionId}`)
    } else {
      // No more exercises, mark session as completed then go back to session
      try {
        if (user && sessionId) {
          await supabase.from('session_progress').upsert({
            user_id: user.id,
            session_id: sessionId,
            status: 'completed',
            progress_percentage: 100,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      } catch (e) {
        console.error('Failed to mark session completed:', e)
      } finally {
        navigate(`/study/level/${session?.units?.level_id}/unit/${session?.unit_id}/session/${sessionId}`)
      }
    }
  }

  // Function to select random cards
  const selectRandomCards = (allCards, cardMode) => {
    const numCards = parseInt(cardMode)
    const shuffled = [...allCards].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, Math.min(numCards, allCards.length))
    setDisplayedCards(selected)
    setCurrentCard(0) // Reset to first card
  }

  // Handle mode change
  const handleModeChange = (newMode) => {
    setMode(newMode)
    selectRandomCards(flashcards, newMode)
  }

  const handleCardSelect = (index) => {
    // Stop current audio when switching cards
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
    }
    setCurrentCard(index)
  }

  const playAudio = () => {
    // If same audio is playing, stop it
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
      return
    }

    // Stop any current audio first
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
    }

    if (currentFlashcard && currentFlashcard.audio) {
      const audio = new Audio(currentFlashcard.audio)
      setCurrentAudio(audio)

      audio.play().catch(err => {
        console.error('Error playing audio:', err)
        alert(`Không thể phát âm thanh: ${currentFlashcard.front} - ${currentFlashcard.back}`)
        setCurrentAudio(null)
      })

      // Clear audio reference when it ends
      audio.onended = () => {
        setCurrentAudio(null)
      }
    } else {
      alert(`Không có âm thanh: ${currentFlashcard?.front} - ${currentFlashcard?.back}`)
    }
  }

  // When user navigates away (next exercise or finish), also mark current exercise completed if there are cards
  useEffect(() => {
    if (!exerciseId) return
    // No-op here; marking is handled on user action
  }, [exerciseId])

  // Bottom nav Back: go back to session view
  useEffect(() => {
    const handleBottomNavBack = () => {
      console.log('🎯 Bottom nav "Back" clicked in FlashcardExercise');
      // Stop any playing audio when going back
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        setCurrentAudio(null)
      }
      // Navigate back to session view
      if (session && session.units && session.units.levels) {
        const levelId = session.units.levels.id
        const unitId = session.units.id
        navigate(`/study/level/${levelId}/unit/${unitId}/session/${sessionId}`)
      } else if (sessionId) {
        // Fallback: try to navigate to session without full path
        navigate(`/study/level/1/unit/1/session/${sessionId}`)
      } else {
        // Final fallback to study page
        navigate('/study')
      }
    };

    window.addEventListener('bottomNavBack', handleBottomNavBack);
    return () => window.removeEventListener('bottomNavBack', handleBottomNavBack);
  }, [session, sessionId, navigate, currentAudio])

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
        <Button onClick={fetchFlashcards} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không có flashcard nào</div>
        <Link to="/study">
          <Button variant="outline">Quay lại</Button>
        </Link>
      </div>
    )
  }

  if (displayedCards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không có card nào để hiển thị</div>
        <Link to="/study">
          <Button variant="outline">Quay lại</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="mb-6 text-center">
        <div className="bg-orange-500 text-white px-6 py-3 rounded-lg inline-block w-full text-left border-2 border-gray-600 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Sesson 2</p>
            <h1 className="text-2xl font-bold">Flashcards</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-0.5 h-16 bg-gray-600"></div>
            <Card className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      </div>


      {/* Mode Selector */}
      <div className="flex justify-center">
        <div className="flex bg-gray-100 rounded-full p-1 shadow-sm">
          <button
            onClick={() => handleModeChange('4')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${mode === '4'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            4 thẻ
          </button>
          <button
            onClick={() => handleModeChange('8')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${mode === '8'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
              }`}
          >
            8 thẻ
          </button>
        </div>
      </div>

      {/* Main Card Display */}
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <Card className="overflow-hidden shadow-lg">
            <div className="relative">
              {/* Card Image */}
              <div className="aspect-[4/3] relative">
                <img
                  src={currentFlashcard?.image}
                  alt={currentFlashcard?.front}
                  className="w-full h-full object-cover"
                />
                {/* Overlay with text */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="text-center text-white">
                    <h2 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">
                      {currentFlashcard?.front}
                    </h2>
                    <p className="text-xl md:text-2xl opacity-90 drop-shadow-md">
                      {currentFlashcard?.back}
                    </p>
                  </div>
                </div>
              </div>

              {/* Audio Button */}
              <div className="p-6 bg-white flex justify-center">
                <button
                  onClick={playAudio}
                  className="w-16 h-16 bg-blue-700 hover:bg-blue-800 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl"
                >
                  <Volume2 className="w-6 h-6" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Thumbnail Navigation */}
      <div className="space-y-4">

        <div className={`grid gap-3 ${mode === '4' ? 'grid-cols-4' : 'grid-cols-4 md:grid-cols-8'}`}>
          {displayedCards.map((card, index) => (
            <button
              key={card.id}
              onClick={() => handleCardSelect(index)}
              className={`relative aspect-[4/3] rounded-lg overflow-hidden transition-all duration-200 ${currentCard === index
                  ? 'ring-4 ring-blue-500 scale-105'
                  : 'hover:scale-105 hover:shadow-lg'
                }`}
            >
              <img
                src={card.image}
                alt={card.front}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-center text-white">
                  <p className="text-sm font-bold">{card.front}</p>
                </div>
              </div>
              {currentCard === index && (
                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Play className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Next Exercise Button */}
      {sessionId && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={goToNextExercise}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            Bài tiếp theo
          </Button>
        </div>
      )}
    </div>
  )
}

export default FlashcardExercise
