import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { saveRecentExercise } from '../../utils/recentExercise'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import { ArrowLeft, Play, Volume2, ChevronLeft, ChevronRight } from 'lucide-react'

const FlashcardExercise = () => {
  const location = useLocation()
  const [currentCard, setCurrentCard] = useState(0)
  const [flashcards, setFlashcards] = useState([])
  const [displayedCards, setDisplayedCards] = useState([])
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentAudio, setCurrentAudio] = useState(null)
  const [session, setSession] = useState(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [speechSynth] = useState(window.speechSynthesis)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [videoThumbnails, setVideoThumbnails] = useState({})
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState(null)
  const [practiceMode, setPracticeMode] = useState(false)
  const [practiceQuestion, setPracticeQuestion] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [practiceScore, setPracticeScore] = useState({ correct: 0, total: 0 })

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

      if (data) {
        setExercise(data)
      }

      if (data && data.content && data.content.cards) {
        setFlashcards(data.content.cards)
        // Show all cards
        setDisplayedCards(data.content.cards)

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
        const xpReward = exercise?.xp_reward || 10
        await supabase.from('user_progress').upsert({
          user_id: user.id,
          exercise_id: exerciseId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          xp_earned: xpReward
        })
      }
    } catch (e) {
      console.error('Failed to mark exercise completed:', e)
    }

    const nextExercise = await getNextExercise()

    if (nextExercise) {
      const paths = {
        flashcard: '/study/flashcard',
        audio_flashcard: '/study/audio-flashcard',
        multiple_choice: '/study/multiple-choice'
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


  const handleCardSelect = (index) => {
    // Stop current audio when switching cards
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
    }
    // Stop any speech synthesis
    speechSynth.cancel()
    // Reset flip state and video index
    setIsFlipped(false)
    setCurrentVideoIndex(0)
    setVideoError(null)
    setCurrentCard(index)
  }

  const speakText = (text, lang = 'en-US') => {
    // Stop any current speech
    speechSynth.cancel()

    if (text) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 0.8
      utterance.pitch = 1
      utterance.volume = 0.8

      // Try to find a native voice for the language
      const voices = speechSynth.getVoices()
      const voice = voices.find(v => v.lang.startsWith(lang.split('-')[0])) || voices[0]
      if (voice) {
        utterance.voice = voice
      }

      speechSynth.speak(utterance)
    }
  }

  const playAudio = () => {
    // Stop current speech if speaking
    if (speechSynth.speaking) {
      speechSynth.cancel()
      return
    }

    if (currentFlashcard) {
      // Always speak the front text (English) regardless of flip state
      const textToSpeak = currentFlashcard.front
      const language = 'en-US'
      
      speakText(textToSpeak, language)
    }
  }

  const flipCard = () => {
    setIsFlipped(!isFlipped)
    setCurrentVideoIndex(0) // Reset video index when flipping
  }

  const goToNextCard = () => {
    const nextIndex = (currentCard + 1) % displayedCards.length
    handleCardSelect(nextIndex)
  }

  const goToPreviousCard = () => {
    const prevIndex = (currentCard - 1 + displayedCards.length) % displayedCards.length
    handleCardSelect(prevIndex)
  }

  const getVideoUrls = (card) => {
    if (!card) return []

    // Support multiple video formats and structures
    const videoSources = []
    
    // Check for videoUrls array (new format)
    if (card.videoUrls && Array.isArray(card.videoUrls)) {
      videoSources.push(...card.videoUrls)
    }
    
    // Check for single videoUrl
    if (card.videoUrl) {
      videoSources.push(card.videoUrl)
    }
    
    // Check for video_url (legacy format)
    if (card.video_url) {
      videoSources.push(card.video_url)
    }
    
    // Check for videos array (alternative format)
    if (card.videos && Array.isArray(card.videos)) {
      videoSources.push(...card.videos)
    }
    
    // Check for video object with multiple sources
    if (card.video && typeof card.video === 'object') {
      if (card.video.sources && Array.isArray(card.video.sources)) {
        videoSources.push(...card.video.sources)
      } else if (card.video.url) {
        videoSources.push(card.video.url)
      }
    }
    
    // Filter out empty or invalid URLs
    return videoSources.filter(url => {
      if (typeof url === 'string') {
        return url.trim() && (url.startsWith('http') || url.startsWith('/') || url.startsWith('./'))
      }
      if (typeof url === 'object' && url.src) {
        return url.src.trim() && (url.src.startsWith('http') || url.src.startsWith('/') || url.src.startsWith('./'))
      }
      return false
    }).map(url => typeof url === 'string' ? url : url.src)
  }

  const nextVideo = (e) => {
    e.stopPropagation() // Prevent card flip
    const videos = getVideoUrls(currentFlashcard)
    if (videos.length > 1) {
      setCurrentVideoIndex((prev) => (prev + 1) % videos.length)
    }
  }

  const previousVideo = (e) => {
    e.stopPropagation() // Prevent card flip
    const videos = getVideoUrls(currentFlashcard)
    if (videos.length > 1) {
      setCurrentVideoIndex((prev) => (prev - 1 + videos.length) % videos.length)
    }
  }

  // Generate video thumbnail
  const generateVideoThumbnail = (videoUrl, index) => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        video.currentTime = 1 // Seek to 1 second for thumbnail
      }
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
        resolve(thumbnail)
      }
      
      video.onerror = (e) => {
        console.log(`⚠️ Video thumbnail generation failed for: ${videoUrl}`, e)
        resolve(null) // Return null if thumbnail generation fails
      }
      
      video.onloadstart = () => {
        console.log(`🎬 Loading video thumbnail: ${videoUrl}`)
      }
      
      video.crossOrigin = 'anonymous' // Try to handle CORS
      video.src = videoUrl
    })
  }

  // Load video thumbnails for current card
  const loadVideoThumbnails = async (card) => {
    if (!card) return
    
    const videos = getVideoUrls(card)
    const cardId = card.id || `${currentCard}`
    
    if (videos.length === 0) return
    
    // Check if thumbnails already exist
    if (videoThumbnails[cardId]) return
    
    setVideoLoading(true)
    const thumbnails = []
    
    for (let i = 0; i < videos.length; i++) {
      try {
        const thumbnail = await generateVideoThumbnail(videos[i], i)
        thumbnails.push(thumbnail)
      } catch (error) {
        console.warn(`Failed to generate thumbnail for video ${i}:`, error)
        thumbnails.push(null)
      }
    }
    
    setVideoThumbnails(prev => ({
      ...prev,
      [cardId]: thumbnails
    }))
    setVideoLoading(false)
  }

  // Load thumbnails when card changes
  useEffect(() => {
    if (currentFlashcard && isFlipped) {
      loadVideoThumbnails(currentFlashcard)
    }
  }, [currentFlashcard, isFlipped])

  // Handle video loading states
  const handleVideoLoadStart = () => {
    setVideoLoading(true)
    setVideoError(null)
  }

  const handleVideoLoadedData = () => {
    setVideoLoading(false)
    setVideoError(null)
  }

  const handleVideoError = () => {
    setVideoLoading(false)
    setVideoError('Không thể tải video')
  }

  // Handle video ended event
  const handleVideoEnded = () => {
    // If there are multiple videos, go to next video
    const videos = getVideoUrls(currentFlashcard)
    if (videos.length > 1) {
      nextVideo()
    }
  }

  // Practice mode functions
  const generatePracticeQuestion = () => {
    if (displayedCards.length < 4) {
      alert('Cần ít nhất 4 cards để thực hành')
      return
    }

    // Select a random card as the correct answer
    const correctCard = displayedCards[Math.floor(Math.random() * displayedCards.length)]
    
    // Get 3 other random cards as wrong options
    const otherCards = displayedCards.filter(card => card.id !== correctCard.id)
    const shuffledOthers = otherCards.sort(() => 0.5 - Math.random()).slice(0, 3)
    
    // Create options array
    const options = [
      { ...correctCard, isCorrect: true },
      ...shuffledOthers.map(card => ({ ...card, isCorrect: false }))
    ].sort(() => 0.5 - Math.random()) // Shuffle options

    setPracticeQuestion({
      correctAnswer: correctCard,
      options: options,
      question: correctCard.back // Show the meaning
    })
    setSelectedAnswer(null)
    setShowResult(false)
  }

  const handleAnswerSelect = (option) => {
    if (showResult) return
    
    setSelectedAnswer(option)
    setShowResult(true)
    
    // Update score
    setPracticeScore(prev => ({
      correct: prev.correct + (option.isCorrect ? 1 : 0),
      total: prev.total + 1
    }))
  }

  const nextPracticeQuestion = () => {
    generatePracticeQuestion()
  }

  const togglePracticeMode = () => {
    setPracticeMode(!practiceMode)
    if (!practiceMode) {
      generatePracticeQuestion()
    }
    setSelectedAnswer(null)
    setShowResult(false)
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
      // Stop any playing audio and speech when going back
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        setCurrentAudio(null)
      }
      speechSynth.cancel()
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




      {/* Practice Mode Toggle */}
      <div className="flex justify-center">
        <button
          onClick={togglePracticeMode}
          className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 ${
            practiceMode 
              ? 'bg-green-600 text-white shadow-lg' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {practiceMode ? '📚 Thoát Thực hành' : '🎯 Thực hành'}
        </button>
      </div>

      {/* Practice Mode UI */}
      {practiceMode && practiceQuestion && (
        <div className="max-w-2xl mx-auto">
          <Card className="p-6">
            {/* Score */}
            <div className="text-center mb-6">
              <div className="text-2xl font-bold text-blue-600">
                {practiceScore.correct} / {practiceScore.total}
              </div>
              <p className="text-gray-600">Điểm số</p>
            </div>

            {/* Question */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Nghĩa của từ này là gì?
              </h2>
              <div className="bg-blue-100 p-6 rounded-lg">
                <p className="text-2xl font-bold text-blue-800">
                  {practiceQuestion.question}
                </p>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {practiceQuestion.options.map((option, index) => {
                let buttonClass = "p-4 rounded-lg font-bold text-lg transition-all duration-200 "
                
                if (showResult) {
                  if (option.isCorrect) {
                    buttonClass += "bg-green-500 text-white"
                  } else if (selectedAnswer?.id === option.id) {
                    buttonClass += "bg-red-500 text-white"
                  } else {
                    buttonClass += "bg-gray-200 text-gray-600"
                  }
                } else {
                  buttonClass += "bg-blue-100 text-blue-800 hover:bg-blue-200"
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => handleAnswerSelect(option)}
                    className={buttonClass}
                    disabled={showResult}
                  >
                    {option.front}
                  </button>
                )
              })}
            </div>

            {/* Result */}
            {showResult && (
              <div className="text-center">
                <div className={`text-2xl font-bold mb-4 ${
                  selectedAnswer?.isCorrect ? 'text-green-600' : 'text-red-600'
                }`}>
                  {selectedAnswer?.isCorrect ? '✅ Đúng!' : '❌ Sai!'}
                </div>
                <button
                  onClick={nextPracticeQuestion}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  Câu tiếp theo
                </button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Main Card Display with Right Side Thumbnails */}
      {!practiceMode && (
        <div className="flex gap-4 max-w-full mx-auto px-4">
          {/* Main Card */}
          <div className="flex-1 max-w-2xl mx-auto">
            <Card className="overflow-hidden shadow-lg">
              <div className="relative">
                {/* Card Content - Front or Back */}
                <div className="aspect-square relative">
                {!isFlipped ? (
                  // Front side - Image with front text
                  <>
                    <img
                      src={currentFlashcard?.image}
                      alt={currentFlashcard?.front}
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay with front text */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="text-center text-white">
                        <h2 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">
                          {currentFlashcard?.front}
                        </h2>
                        {/* Show back text under front text on front card */}
                        <h3 className="text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg">
                          {currentFlashcard?.back}
                        </h3>
                        {(() => {
                          const videos = getVideoUrls(currentFlashcard)
                          return videos.length > 1
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  // Back side - Videos (if available) or image with back text
                  <>
                    {(() => {
                      const videos = getVideoUrls(currentFlashcard)
                      return videos.length > 0 ? (
                        <div className="relative w-full h-full">
                          {/* Video Loading State */}
                          {videoLoading && (
                            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
                              <div className="text-center text-white">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                                <p className="text-sm">Đang tải video...</p>
                              </div>
                            </div>
                          )}

                          {/* Video Error State */}
                          {videoError && (
                            <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-10">
                              <div className="text-center text-white">
                                <div className="text-red-400 mb-2">⚠️</div>
                                <p className="text-sm">{videoError}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setVideoError(null)
                                    setVideoLoading(true)
                                  }}
                                  className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
                                >
                                  Thử lại
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Video Element */}
                          <video
                            src={videos[currentVideoIndex]}
                            className="w-full h-full object-cover"
                            controls                          
                            playsInline
                            autoPlay
                            key={`${currentCard}-${currentVideoIndex}`}
                            onLoadStart={handleVideoLoadStart}
                            onLoadedData={handleVideoLoadedData}
                            onError={handleVideoError}
                            onEnded={handleVideoEnded}
                            poster={(() => {
                              const cardId = currentFlashcard?.id || `${currentCard}`
                              const thumbnails = videoThumbnails[cardId]
                              return thumbnails && thumbnails[currentVideoIndex] ? thumbnails[currentVideoIndex] : undefined
                            })()}
                          />


                          {/* Video navigation controls */}
                          {videos.length > 1 && (
                            <>
                              {/* Video counter */}
                              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-bold">
                                {currentVideoIndex + 1} / {videos.length}
                              </div>

                              {/* Video thumbnails strip */}
                              <div className="absolute top-4 left-4 right-20 flex gap-1">
                                {videos.map((_, index) => {
                                  const cardId = currentFlashcard?.id || `${currentCard}`
                                  const thumbnails = videoThumbnails[cardId]
                                  const thumbnail = thumbnails && thumbnails[index]
                                  
                                  return (
                                    <button
                                      key={index}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setCurrentVideoIndex(index)
                                      }}
                                      className={`w-8 h-6 rounded overflow-hidden border-2 transition-all ${
                                        index === currentVideoIndex 
                                          ? 'border-blue-400 scale-110' 
                                          : 'border-white/50 hover:border-white/80'
                                      }`}
                                      title={`Video ${index + 1}`}
                                    >
                                      {thumbnail ? (
                                        <img 
                                          src={thumbnail} 
                                          alt={`Video ${index + 1} thumbnail`}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                                          <Play className="w-3 h-3 text-white" />
                                        </div>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>

                              {/* Previous video button */}
                              <button
                                onClick={previousVideo}
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-2 rounded-full hover:bg-black/90 transition-colors z-20"
                                title="Video trước"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>

                              {/* Next video button */}
                              <button
                                onClick={nextVideo}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/70 text-white p-2 rounded-full hover:bg-black/90 transition-colors z-20"
                                title="Video tiếp theo"
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </>
                          )}


                        </div>
                      ) : (
                        <>
                          <img
                            src={currentFlashcard?.image}
                            alt={currentFlashcard?.back}
                            className="w-full h-full object-cover"
                          />
                          {/* Overlay with back text */}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="text-center text-white">
                              <h2 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">
                                {currentFlashcard?.back}
                              </h2>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* Controls */}
              <div className="p-6 bg-white flex justify-center items-center space-x-4">
                <button
                  onClick={goToPreviousCard}
                  className="w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl"
                  title="Previous Card"
                  disabled={displayedCards.length <= 1}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  onClick={playAudio}
                  className={`w-16 h-16 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl ${
                    speechSynth.speaking ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
                  }`}
                  title={speechSynth.speaking ? 'Stop Speech' : 'Speak Text'}
                >
                  <Volume2 className="w-6 h-6" />
                </button>

                <button
                  onClick={flipCard}
                  className="w-16 h-16 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl"
                  title="Flip Card"
                >
                  <div className="text-xs font-bold">FLIP</div>
                </button>

                <button
                  onClick={goToNextCard}
                  className="w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg hover:shadow-xl"
                  title="Next Card"
                  disabled={displayedCards.length <= 1}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </Card>
          </div>

          {/* Right Side Thumbnails - 3-4 Columns Grid */}
          <div className="hidden lg:block w-80 flex-shrink-0 overflow-hidden">
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 max-h-screen overflow-y-auto p-2">
              {displayedCards.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => handleCardSelect(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden transition-all duration-200 ${currentCard === index
                      ? 'ring-4 ring-blue-500 scale-100 z-10'
                      : 'hover:scale-102 hover:shadow-lg'
                    }`}
                >
                  <img
                    src={card.image}
                    alt={card.front}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <p className="text-xs font-bold">{card.front}</p>
                    </div>
                  </div>
                  {currentCard === index && (
                    <div className="absolute top-1 right-1">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <Play className="w-2 h-2 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail Navigation - Mobile/Tablet fallback */}
      {!practiceMode && (
        <div className="lg:hidden space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {displayedCards.map((card, index) => (
              <button
                key={card.id}
                onClick={() => handleCardSelect(index)}
                className={`relative aspect-square rounded-lg overflow-hidden transition-all duration-200 ${currentCard === index
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
      )}

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
