import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { saveRecentExercise } from '../../utils/recentExercise'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { supabase } from '../../supabase/client'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import RichTextRenderer from '../ui/RichTextRenderer'
import { CheckCircle, XCircle, ArrowRight, RotateCcw, Star } from 'lucide-react'
import AudioPlayer from '../ui/AudioPlayer'

const MultipleChoiceExercise = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { completeExerciseWithXP } = useProgress()

  // URL params
  const searchParams = new URLSearchParams(location.search)
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')

  // Exercise state
  const [exercise, setExercise] = useState(null)
  const [questions, setQuestions] = useState([])
  const [originalQuestions, setOriginalQuestions] = useState([]) // Store original questions for retry
  const [shuffledQuestions, setShuffledQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [questionResults, setQuestionResults] = useState([]) // Array of {questionId, isCorrect, selectedAnswer, correctAnswer}
  const [isQuizComplete, setIsQuizComplete] = useState(false)
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [isRetryMode, setIsRetryMode] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [showXpNotification, setShowXpNotification] = useState(false)
  const [isBatmanMoving, setIsBatmanMoving] = useState(false)

  // View mode state - read from exercise settings
  const [viewMode, setViewMode] = useState('one-by-one') // 'one-by-one' or 'all-at-once'
  const [allAnswers, setAllAnswers] = useState({}) // Object to store all answers: {questionIndex: selectedAnswerIndex}
  const [showAllResults, setShowAllResults] = useState(false)

  // Meme and sound state
  const [currentMeme, setCurrentMeme] = useState('')
  const [showMeme, setShowMeme] = useState(false)

  // Meme arrays - you can replace these URLs with your own memes
  const correctMemes = [
    'https://xpclass.vn/leaderboard/correct_image/plus12.png',
    'https://xpclass.vn/leaderboard/correct_image/plus13.png',
    'https://xpclass.vn/leaderboard/correct_image/plus14.png',
    'https://xpclass.vn/leaderboard/correct_image/plus32.png',
    'https://xpclass.vn/leaderboard/correct_image/plus34.png',
    'https://xpclass.vn/leaderboard/correct_image/drake%20yes.jpg',
    'https://xpclass.vn/leaderboard/correct_image/tapping%20head.jpg'
  
     // Celebration
  ]

  const wrongMemes = [

    'https://xpclass.vn/leaderboard/wrong_image/Black-Girl-Wat.png',
    'https://xpclass.vn/leaderboard/wrong_image/drake.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/leo%20laugh.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/nick%20young.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/tom.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/you-guys-are-getting-paid.jpg'// Try again
  ]

  // Sound URLs - you can replace these with your own sound files
  const correctSounds = [
    'https://xpclass.vn/leaderboard/sound/lingo.mp3',
  ]

  const wrongSounds = [
    'https://xpclass.vn/leaderboard/sound/Bruh.mp3'
  ]

  // Function to play sound and show meme
  const playFeedback = (isCorrect) => {
    // Select random meme
    const memes = isCorrect ? correctMemes : wrongMemes
    const randomMeme = memes[Math.floor(Math.random() * memes.length)]

    // Select random sound
    const sounds = isCorrect ? correctSounds : wrongSounds
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)]

    // Show meme
    setCurrentMeme(randomMeme)
    setShowMeme(true)

    // Play sound
    try {
      const audio = new Audio(randomSound)
      audio.volume = 0.5
      audio.play().catch(e => console.log('Could not play sound:', e))
    } catch (e) {
      console.log('Sound not supported:', e)
    }

    // Hide meme after 2 seconds
    setTimeout(() => {
      setShowMeme(false)
    }, 2000)
  }

  useEffect(() => {
    if (exerciseId) {
      fetchExercise()
      setStartTime(Date.now())
    } else {
      setLoading(false)
      setError('Không tìm thấy ID bài tập')
    }
  }, [exerciseId])

  // Allow scrolling on all devices
  useEffect(() => {
    document.body.style.overflow = 'auto'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (sessionId) {
      fetchSessionInfo()
    }
  }, [sessionId])

  // Handle quiz completion
  useEffect(() => {
    if (isQuizComplete && !isRetryMode && questionResults.length > 0) {
      markExerciseCompleted()
    }
  }, [isQuizComplete, isRetryMode, questionResults.length])

  const fetchSessionInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          units:unit_id (
            id,
            title,
            course_id
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

  const fetchExercise = async () => {
    try {
      setLoading(true)
      setError(null)

      // Reset quiz state when loading a new exercise to avoid stale data
      setQuestions([])
      setOriginalQuestions([])
      setCurrentQuestionIndex(0)
      setSelectedAnswer(null)
      setShowExplanation(false)
      setQuestionResults([])
      setIsQuizComplete(false)
      setWrongQuestions([])
      setIsRetryMode(false)
      setAllAnswers({})
      setShowAllResults(false)

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'multiple_choice')
        .single()

      if (error) throw error

      if (data && data.content && data.content.questions) {
        setExercise(data)

        // Set view mode from exercise settings
        const exerciseSettings = data.content.settings || {}
        const exerciseViewMode = exerciseSettings.view_mode || 'one-by-one'
        setViewMode(exerciseViewMode)

        // Shuffle options for each question if shuffle_options is enabled
        const processedQuestions = data.content.questions.map(q => {
          if (q.shuffle_options === false) {
            // Don't shuffle - keep original order
            return q
          }

          // Shuffle options
          const shuffledOptionsMap = q.options.map((opt, idx) => ({ option: opt, originalIndex: idx }))
          // Fisher-Yates shuffle
          for (let i = shuffledOptionsMap.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledOptionsMap[i], shuffledOptionsMap[j]] = [shuffledOptionsMap[j], shuffledOptionsMap[i]]
          }

          const shuffledOptions = shuffledOptionsMap.map(item => item.option)
          const newCorrectIndex = shuffledOptionsMap.findIndex(item => item.originalIndex === q.correct_answer)

          // Shuffle option_explanations in the same order as options
          const shuffledOptionExplanations = q.option_explanations
            ? shuffledOptionsMap.map(item => q.option_explanations[item.originalIndex])
            : undefined

          return {
            ...q,
            options: shuffledOptions,
            correct_answer: newCorrectIndex,
            option_explanations: shuffledOptionExplanations,
            _originalOptions: q.options, // Keep original for reference
            _originalCorrectAnswer: q.correct_answer
          }
        })

        setQuestions(processedQuestions)
        setOriginalQuestions(processedQuestions) // Store original questions for retry

        // Save recent exercise
        try {
          const continuePath = `/study/multiple-choice?exerciseId=${data.id}&sessionId=${sessionId}`
          saveRecentExercise({
            ...data,
            continuePath
          })
        } catch { }
      } else {
        setError('Không tìm thấy câu hỏi trong bài tập')
      }
    } catch (err) {
      console.error('Error fetching exercise:', err)
      setError('Không thể tải dữ liệu bài tập')
    } finally {
      setLoading(false)
    }
  }


  const currentQuestion = questions[currentQuestionIndex]
  const totalQuestions = questions.length
  const currentQuestionNumber = currentQuestionIndex + 1


  const handleAnswerSelect = async (answerIndex) => {
    if (selectedAnswer !== null || showExplanation) return

    const isCorrect = answerIndex === currentQuestion.correct_answer
    const responseTime = Date.now() - startTime

    setSelectedAnswer(answerIndex)
    setShowExplanation(true)

    // Play feedback (meme + sound)
    playFeedback(isCorrect)

    // Save question attempt to database (optional - for detailed analytics)
    if (user && exerciseId) {
      try {
        await supabase.from('question_attempts').insert({
          user_id: user.id,
          exercise_id: exerciseId,
          question_id: currentQuestion.id,
          selected_answer: currentQuestion.options[answerIndex],
          correct_answer: currentQuestion.options[currentQuestion.correct_answer],
          is_correct: isCorrect,
          attempt_number: isRetryMode ? 2 : 1,
          response_time: responseTime
        })
      } catch (err) {
        // This is optional analytics - don't break the exercise if it fails
        console.log('⚠️ Could not save question attempt (table may not exist):', err.message)
      }
    }

    // Update question results
    const newResult = {
      questionId: currentQuestion.id,
      questionIndex: currentQuestionIndex,
      question: currentQuestion.question,
      isCorrect,
      selectedAnswer: answerIndex,
      correctAnswer: currentQuestion.correct_answer,
      explanation: currentQuestion.explanation
    }

    const updatedResults = [...questionResults, newResult]
    setQuestionResults(updatedResults)

    // If wrong answer, add to wrong questions for retry
    if (!isCorrect) {
      setWrongQuestions(prev => [...prev, {
        ...currentQuestion,
        originalIndex: currentQuestionIndex
      }])
    }
  }

  // Handle answer selection in all-at-once mode
  const handleAllAtOnceAnswerSelect = (questionIndex, answerIndex) => {
    setAllAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }))
  }

  // Submit all answers in all-at-once mode
  const handleSubmitAllAnswers = async () => {
    const answeredQuestions = Object.keys(allAnswers).length
    if (answeredQuestions < questions.length) {
      alert(`Bạn cần trả lời tất cả ${questions.length} câu hỏi trước khi nộp bài!`)
      return
    }

    setShowAllResults(true)
    
    // Process all answers
    const results = []
    const wrongQuestionsList = []
    
    questions.forEach((question, index) => {
      const selectedAnswerIndex = allAnswers[index]
      const isCorrect = selectedAnswerIndex === question.correct_answer
      
      const result = {
        questionId: question.id,
        questionIndex: index,
        question: question.question,
        isCorrect,
        selectedAnswer: selectedAnswerIndex,
        correctAnswer: question.correct_answer,
        explanation: question.explanation
      }
      
      results.push(result)
      
      if (!isCorrect) {
        wrongQuestionsList.push({
          ...question,
          originalIndex: index
        })
      }
    })
    
    setQuestionResults(results)
    setWrongQuestions(wrongQuestionsList)
    setIsQuizComplete(true)
    
    // Save all question attempts to database
    if (user && exerciseId) {
      try {
        const attempts = results.map(result => ({
          user_id: user.id,
          exercise_id: exerciseId,
          question_id: result.questionId,
          selected_answer: questions[result.questionIndex].options[result.selectedAnswer],
          correct_answer: questions[result.questionIndex].options[result.correctAnswer],
          is_correct: result.isCorrect,
          attempt_number: isRetryMode ? 2 : 1,
          response_time: Date.now() - startTime
        }))
        
        await supabase.from('question_attempts').insert(attempts)
      } catch (err) {
        console.log('⚠️ Could not save question attempts (table may not exist):', err.message)
      }
    }
  }

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextQuestionIndex = currentQuestionIndex + 1

      // Trigger Batman movement
      setIsBatmanMoving(true)
      setTimeout(() => setIsBatmanMoving(false), 3000)

      setCurrentQuestionIndex(nextQuestionIndex)
      setSelectedAnswer(null)
      setShowExplanation(false)
      setStartTime(Date.now())
    } else {
      // Quiz completed
      setIsQuizComplete(true)
    }
  }


  const markExerciseCompleted = async () => {
    if (!user || !exerciseId) return

    console.log(`🔍 markExerciseCompleted called - isRetryMode: ${isRetryMode}, questionResults.length: ${questionResults.length}`)

    if (isRetryMode) {
      // For retry mode, we need to calculate score based on original questions
      // but only count the retry questions as completed
      const retryCorrectAnswers = questionResults.filter(r => r.isCorrect).length
      const retryTotalQuestions = questionResults.length
      const retryScore = Math.round((retryCorrectAnswers / retryTotalQuestions) * 100)
      
      console.log(`🔄 Retry completed: ${retryCorrectAnswers}/${retryTotalQuestions} retry questions correct (${retryScore}%)`)
      
      // For retry, we don't give XP or mark as completed, just show results
      return
    }

    // Normal mode - calculate score based on current questions count
    const correctAnswers = questionResults.filter(r => r.isCorrect).length
    const totalQuestions = questions.length || questionResults.length
    const score = Math.round((correctAnswers / totalQuestions) * 100)

    console.log(`🏁 Completing exercise: ${correctAnswers}/${totalQuestions} correct (${score}%)`)

    try {
      // Calculate XP
      const baseXP = exercise?.xp_reward || 10
      const bonusXP = score >= 80 ? Math.round(baseXP * 0.2) : 0 // 20% bonus for good performance
      const totalXP = baseXP + bonusXP

      console.log(`💰 Calculating XP: ${baseXP} base + ${bonusXP} bonus = ${totalXP} total`)

      // Use useProgress hook to complete exercise (this will also check daily quest)
      const result = await completeExerciseWithXP(exerciseId, totalXP, {
        score: score,
        max_score: 100,
        xp_earned: totalXP  // We'll calculate actual XP in the backend based on completion
      })

      if (result.error && result.error !== 'Exercise already completed') {
        console.log('⚠️ Exercise completion failed:', result.error)
        return
      }

      // If exercise was already completed, that's fine - daily quest still gets checked
      if (result.error === 'Exercise already completed') {
        console.log('ℹ️ Exercise was already completed, but daily quest was checked')
        return
      }

      // Show XP notification only if XP was actually awarded
      if (result.xpAwarded > 0) {
        setXpAwarded(result.xpAwarded)
        setShowXpNotification(true)

        // Hide notification after 4 seconds
        setTimeout(() => {
          setShowXpNotification(false)
        }, 4000)

        console.log(`✅ Exercise completed successfully! Awarded ${result.xpAwarded} XP`)
      } else {
        console.log(`📝 Exercise attempted but not completed (score: ${score}%, required: 75%)`)
      }

    } catch (err) {
      console.error('❌ Error marking exercise completed:', err)
    }
  }

  const handleRetryWrongQuestions = () => {
    if (wrongQuestions.length === 0) return

    // Set retry mode first
    setIsRetryMode(true)
    
    // Show only wrong questions for retry
    setQuestions(wrongQuestions)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setShowExplanation(false)
    setQuestionResults([])
    setIsQuizComplete(false)
    setWrongQuestions([])
    setStartTime(Date.now())
    
    // Reset all answers for all-at-once mode
    setAllAnswers({})
    setShowAllResults(false)
  }

  const goToNextExercise = async () => {
    console.log('🚀 Going to next exercise...', { sessionId, exerciseId })

    if (!sessionId) {
      console.log('❌ No sessionId, going back to study')
      navigate('/study')
      return
    }

    try {
      // Try different ordering methods since 'order_index' might not exist
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at')  // Use created_at instead of order_index

      if (error) throw error

      console.log('📚 Found exercises:', exercises?.length)
      console.log('🔍 Current exercise ID:', exerciseId)

      if (!exercises || exercises.length === 0) {
        console.log('❌ No exercises found, going back to session')
        if (session) {
          navigate(`/study/course/${session.units?.course_id}/unit/${session.unit_id}/session/${sessionId}`)
        } else {
          navigate('/study')
        }
        return
      }

      const currentIndex = exercises.findIndex(ex => ex.id === exerciseId)
      console.log('📍 Current exercise index:', currentIndex)

      if (currentIndex !== -1 && currentIndex < exercises.length - 1) {
        const nextExercise = exercises[currentIndex + 1]
        console.log('➡️ Next exercise:', nextExercise.title, nextExercise.exercise_type)

        const paths = {
          flashcard: '/study/flashcard',
          fill_blank: '/study/fill-blank',
          multiple_choice: '/study/multiple-choice',
          video: '/study/video',
          quiz: '/study/quiz',
          listening: '/study/listening',
          speaking: '/study/speaking',
          pronunciation: '/study/pronunciation'
        }

        const exercisePath = paths[nextExercise.exercise_type] || '/study/flashcard'
        const nextUrl = `${exercisePath}?exerciseId=${nextExercise.id}&sessionId=${sessionId}`

        console.log('🔗 Navigating to:', nextUrl)
        navigate(nextUrl)
      } else {
        // No more exercises, go back to session
        console.log('✅ No more exercises, going back to session')
        if (session && session.units) {
          const backUrl = `/study/course/${session.units.course_id}/unit/${session.unit_id}/session/${sessionId}`
          console.log('🔙 Going back to:', backUrl)
          navigate(backUrl)
        } else {
          console.log('❌ No session info, going to study dashboard')
          navigate('/study')
        }
      }
    } catch (err) {
      console.error('❌ Error fetching next exercise:', err)
      // Fallback navigation
      if (session && session.units) {
        navigate(`/study/course/${session.units.course_id}/unit/${session.unit_id}/session/${sessionId}`)
      } else {
        navigate('/study')
      }
    }
  }


  // Handle bottom nav back
  useEffect(() => {
    const handleBottomNavBack = () => {
      if (session && session.units) {
        const unitId = session.units.id
        navigate(`/study/course/${session.units.course_id}/unit/${unitId}/session/${sessionId}`)
      } else {
        navigate('/study')
      }
    }

    window.addEventListener('bottomNavBack', handleBottomNavBack)
    return () => window.removeEventListener('bottomNavBack', handleBottomNavBack)
  }, [session, sessionId, navigate])

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
        <Button onClick={fetchExercise} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không có câu hỏi nào</div>
        <Link to="/study">
          <Button variant="outline">Quay lại</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-12">
      <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-5 border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-gray-500 truncate mb-1">
              {isRetryMode ? 'Ôn lại câu sai' : exercise?.title}
            </p>
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">Trắc nghiệm</h1>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl md:text-3xl font-bold text-blue-600">
              {viewMode === 'one-by-one' ? `${currentQuestionNumber}/${totalQuestions}` : `${Object.keys(allAnswers).length}/${totalQuestions}`}
            </div>
            <div className="text-xs md:text-sm text-gray-500">
              Câu hỏi
            </div>
          </div>
        </div>


        {/* Progress Bar inside header */}
        <div className="mt-4 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs md:text-sm text-gray-600">Tiến độ</span>
            <span className="text-xs md:text-sm font-semibold text-blue-600">
              {viewMode === 'one-by-one' 
                ? `${Math.round((currentQuestionNumber / totalQuestions) * 100)}%`
                : `${Math.round((Object.keys(allAnswers).length / totalQuestions) * 100)}%`
              }
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-visible">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-[3000ms]"
              style={{ 
                width: viewMode === 'one-by-one' 
                  ? `${(currentQuestionNumber / totalQuestions) * 100}%`
                  : `${(Object.keys(allAnswers).length / totalQuestions) * 100}%`
              }}
            ></div>
            {/* Running Batman Animation - moves with and stays with progress bar */}
            {viewMode === 'one-by-one' && (
              <img
                src={isBatmanMoving ? "https://xpclass.vn/LMS_enhance/gif/Left%20running/batman.gif" : "https://xpclass.vn/xpclass/materials/batman_standing.gif"}
                alt="Running Batman"
                className="absolute -top-8 h-12 transition-all duration-[3000ms]"
                style={{
                  left: `calc(${(currentQuestionNumber / totalQuestions) * 100}% - 24px)`,
                  zIndex: 10
                }}
              />
            )}
          </div>
        </div>

        {/* Target info */}
        <div className="mt-3 flex items-center gap-2 text-xs md:text-sm text-gray-600">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
          <span>Cần đạt ≥ 75% để hoàn thành</span>
        </div>
      </div>

      {/* Global Intro (exercise.content.settings/intros) */}
      {exercise?.content?.intro && String(exercise.content.intro).trim() && (
        <div className="w-full max-w-4xl min-w-0 mx-auto rounded-lg p-4 md:p-6 bg-white shadow-sm border border-gray-200">
          <RichTextRenderer content={exercise.content.intro} allowImages={true} allowLinks={false} />
        </div>
      )}


      {/* XP Notification */}
      {showXpNotification && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4" />
            <span className="font-bold text-sm">+{xpAwarded} XP!</span>
          </div>
        </div>
      )}

      {/* Quiz Complete Screen */}
      {isQuizComplete && (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-8 text-center border border-gray-200">
          <div className="mb-4">
            {(() => {
              const correctAnswers = questionResults.filter(r => r.isCorrect).length
              const totalQuestions = questionResults.length
              const score = Math.round((correctAnswers / totalQuestions) * 100)
              
              if (isRetryMode) {
                // For retry mode, show different messaging
                const allCorrect = correctAnswers === totalQuestions
                return (
                  <>
                    <div className={`w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 ${allCorrect ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center`}>
                      {allCorrect ? (
                        <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-green-500" />
                      ) : (
                        <XCircle className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
                      )}
                    </div>
                    <h2 className={`text-lg md:text-2xl font-bold mb-2 ${allCorrect ? 'text-green-800' : 'text-orange-800'}`}>
                      {allCorrect ? 'Đã hoàn thành ôn lại!' : 'Cần cải thiện thêm!'}
                    </h2>
                    <p className="text-sm md:text-base text-gray-600 mb-2">
                      Bạn đã trả lời đúng {correctAnswers}/{totalQuestions} câu ôn lại ({score}%)
                    </p>
                    {!allCorrect && (
                      <p className="text-sm md:text-base text-orange-600 font-semibold mb-3">
                        Hãy tiếp tục luyện tập để cải thiện!
                      </p>
                    )}
                  </>
                )
              }

              // Normal mode
              const passed = score >= 75
              return (
                <>
                  <div className={`w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 ${passed ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center`}>
                    {passed ? (
                      <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-green-500" />
                    ) : (
                      <XCircle className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
                    )}
                  </div>
                  <h2 className={`text-lg md:text-2xl font-bold mb-2 ${passed ? 'text-green-800' : 'text-orange-800'}`}>
                    {passed ? 'Hoàn thành bài quiz!' : 'Cần cải thiện!'}
                  </h2>
                  <p className="text-sm md:text-base text-gray-600 mb-2">
                    Bạn đã trả lời đúng {correctAnswers}/{totalQuestions} câu ({score}%)
                  </p>
                  {!passed && (
                    <p className="text-sm md:text-base text-orange-600 font-semibold mb-3">
                      Cần đạt ít nhất 75% để hoàn thành bài tập
                    </p>
                  )}
                  {xpAwarded > 0 && (
                    <div className="flex items-center justify-center space-x-2 text-yellow-600 font-semibold text-sm md:text-base">
                      <Star className="w-4 h-4 md:w-5 md:h-5" />
                      <span>+{xpAwarded} XP earned!</span>
                    </div>
                  )}
                  {xpAwarded === 0 && !passed && (
                    <div className="flex items-center justify-center space-x-2 text-gray-500 text-sm md:text-base">
                      <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                      <span>Không nhận được XP (điểm quá thấp)</span>
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          <div className="space-y-4">
            {/* Show wrong questions retry button */}
            {!isRetryMode && wrongQuestions.length > 0 && (
              <Button
                onClick={handleRetryWrongQuestions}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Ôn lại {wrongQuestions.length} câu sai
              </Button>
            )}

            {/* Back to exercise list */}
            <Button
              onClick={() => {
                if (session && session.units) {
                  navigate(`/study/course/${session.units.course_id}/unit/${session.unit_id}/session/${sessionId}`)
                } else {
                  navigate('/study')
                }
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              Quay lại danh sách bài tập
            </Button>
          </div>
        </div>
      )}

      {/* Meme Overlay */}
      {showMeme && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <img
            src={currentMeme}
            alt="Reaction meme"
            className="rounded-lg shadow-2xl"
            style={{ width: '200px', height: 'auto' }}
          />
        </div>
      )}

      {/* Questions Display */}
      {!isQuizComplete && (
        <>
          {/* One-by-one mode */}
          {viewMode === 'one-by-one' && (
            <div className="w-full max-w-4xl min-w-0 mx-auto rounded-lg p-4 md:p-8 bg-white shadow-md mt-6 border border-gray-200">
              <div className="space-y-4 md:space-y-6">
                {/* Question - single unified version */}
                <div className="mb-6">
              {/* Intro above question (optional) */}
              {currentQuestion.intro && String(currentQuestion.intro).trim() && (
                <div className="mb-4">
                  <RichTextRenderer
                    content={currentQuestion.intro}
                    allowImages={true}
                    allowLinks={false}
                  />
                </div>
              )}
                  <RichTextRenderer
                    content={currentQuestion.question}
                    className="question-text"
                    allowImages={true}
                    allowLinks={false}
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: '400',
                      color: '#1f2937',
                      lineHeight: '1.75'
                    }}
                  />

                  {/* Audio Player */}
                  {currentQuestion.audio_url && (
                    <div className="mt-4">
                      <AudioPlayer
                        key={currentQuestionIndex}
                        audioUrl={currentQuestion.audio_url}
                        maxPlays={currentQuestion.max_audio_plays || 0}
                        variant="outline"
                      />
                    </div>
                  )}
                </div>

                {/* Options - responsive grid */}
                <div className="space-y-3 md:space-y-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {currentQuestion.options.map((option, index) => {
                        let buttonClass = "w-full p-3 md:p-4 text-left border-2 rounded-lg transition-all duration-200 text-sm md:text-base font-medium "

                        // Hover color sets per index: pink, orange, yellow, green
                        const hoverStylesByIndex = [
                          "hover:border-pink-400 hover:bg-pink-50",
                          "hover:border-orange-400 hover:bg-orange-50",
                          "hover:border-yellow-400 hover:bg-yellow-50",
                          "hover:border-green-400 hover:bg-green-50",
                        ]
                        const hoverStyles = hoverStylesByIndex[index % hoverStylesByIndex.length]

                        if (selectedAnswer === null) {
                          buttonClass += `border-gray-300 bg-white ${hoverStyles} cursor-pointer hover:shadow-sm`
                        } else {
                          if (index === selectedAnswer) {
                            // Show only the selected answer - green if correct, red if wrong
                            const isCorrect = index === currentQuestion.correct_answer
                            if (isCorrect) {
                              buttonClass += "border-green-500 bg-green-50 text-green-900 shadow-sm"
                            } else {
                              buttonClass += "border-red-500 bg-red-50 text-red-900 shadow-sm"
                            }
                          } else {
                            // Other options remain neutral
                            buttonClass += "border-gray-200 bg-gray-50 text-gray-500 opacity-60"
                          }
                        }

                        return (
                          <button
                            key={index}
                            onClick={() => handleAnswerSelect(index)}
                            disabled={selectedAnswer !== null}
                            className={buttonClass}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <RichTextRenderer
                                  content={option}
                                  allowImages={true}
                                  allowLinks={false}
                                />
                              </div>
                              <div className="flex-shrink-0">
                                {selectedAnswer !== null && index === selectedAnswer && (
                                  <>
                                    {index === currentQuestion.correct_answer ? (
                                      <CheckCircle className="w-6 h-6 text-green-600" />
                                    ) : (
                                      <XCircle className="w-6 h-6 text-red-600" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                </div>

                {/* Explanation and Next Button */}
                {showExplanation && selectedAnswer !== null && (
                  <div className="space-y-4">
                    <div className="p-4 md:p-5 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2 text-sm md:text-base">Giải thích:</h3>
                      <RichTextRenderer
                        content={currentQuestion.option_explanations?.[selectedAnswer] || currentQuestion.explanation || 'No explanation available.'}
                        className="text-blue-800 text-sm md:text-base leading-relaxed"
                        allowImages={true}
                        allowLinks={false}
                      />
                    </div>

                    {/* Next Button - full width on mobile, centered on desktop */}
                    <div className="flex justify-center md:justify-end">
                      <Button
                        onClick={handleNextQuestion}
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white text-base md:text-lg px-6 md:px-8 py-3 md:py-4 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all"
                      >
                        {currentQuestionIndex < questions.length - 1 ? (
                          <>
                            Câu tiếp theo
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        ) : (
                          'Hoàn thành'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All-at-once mode */}
          {viewMode === 'all-at-once' && (
            <div className="space-y-6">
              {questions.map((question, questionIndex) => (
                <div key={questionIndex} className="w-full max-w-4xl min-w-0 mx-auto rounded-lg p-4 md:p-8 bg-white shadow-md border border-gray-200">
                  <div className="space-y-4 md:space-y-6">

                    {/* Question */}
                    <div className="mb-6">
                      {/* Intro above question (optional) */}
                      {question.intro && String(question.intro).trim() && (
                        <div className="mb-4">
                          <RichTextRenderer
                            content={question.intro}
                            allowImages={true}
                            allowLinks={false}
                          />
                        </div>
                      )}
                      <RichTextRenderer
                        content={question.question}
                        className="question-text"
                        allowImages={true}
                        allowLinks={false}
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: '400',
                          color: '#1f2937',
                          lineHeight: '1.75'
                        }}
                      />

                      {/* Audio Player */}
                      {question.audio_url && (
                        <div className="mt-4">
                          <AudioPlayer
                            key={questionIndex}
                            audioUrl={question.audio_url}
                            maxPlays={question.max_audio_plays || 0}
                            variant="outline"
                          />
                        </div>
                      )}
                    </div>

                    {/* Options */}
                    <div className="space-y-3 md:space-y-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {question.options.map((option, optionIndex) => {
                          const isSelected = allAnswers[questionIndex] === optionIndex
                          const isCorrect = optionIndex === question.correct_answer

                          let buttonClass = "w-full p-3 md:p-4 text-left border-2 rounded-lg transition-all duration-200 text-sm md:text-base font-medium "

                          if (showAllResults) {
                            if (isSelected && isCorrect) {
                              // Selected and correct - bright green
                              buttonClass += "border-green-500 bg-green-100 text-green-900 shadow-md"
                            } else if (isSelected && !isCorrect) {
                              // Selected but wrong - bright red
                              buttonClass += "border-red-500 bg-red-100 text-red-900 shadow-md"
                            } else if (!isSelected && isCorrect) {
                              // Not selected but this is the correct answer - show it clearly
                              buttonClass += "border-green-400 bg-green-50 text-green-800 shadow-sm"
                            } else {
                              // Not selected and not correct - fade out
                              buttonClass += "border-gray-200 bg-gray-50 text-gray-500 opacity-50"
                            }
                          } else {
                            if (isSelected) {
                              buttonClass += "border-blue-500 bg-blue-50 text-blue-900 shadow-sm"
                            } else {
                              // Hover color sets per index: pink, orange, yellow, green
                              const hoverStylesByIndex = [
                                "hover:border-pink-400 hover:bg-pink-50",
                                "hover:border-orange-400 hover:bg-orange-50",
                                "hover:border-yellow-400 hover:bg-yellow-50",
                                "hover:border-green-400 hover:bg-green-50",
                              ]
                              const hoverStyles = hoverStylesByIndex[optionIndex % hoverStylesByIndex.length]
                              buttonClass += `border-gray-300 bg-white ${hoverStyles} cursor-pointer hover:shadow-sm`
                            }
                          }

                          return (
                            <button
                              key={optionIndex}
                              onClick={() => handleAllAtOnceAnswerSelect(questionIndex, optionIndex)}
                              disabled={showAllResults}
                              className={buttonClass}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <RichTextRenderer
                                    content={option}
                                    allowImages={true}
                                    allowLinks={false}
                                  />
                                </div>
                                <div className="flex-shrink-0">
                                  {showAllResults && (
                                    <>
                                      {isSelected && isCorrect && (
                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                      )}
                                      {isSelected && !isCorrect && (
                                        <XCircle className="w-6 h-6 text-red-600" />
                                      )}
                                      {!isSelected && isCorrect && (
                                        <CheckCircle className="w-6 h-6 text-green-500" />
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Explanation for this question */}
                    {showAllResults && allAnswers[questionIndex] !== undefined && (
                      <div className="mt-4 p-4 md:p-5 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold text-blue-900 mb-2 text-sm md:text-base">Giải thích:</h4>
                        <RichTextRenderer
                          content={question.option_explanations?.[allAnswers[questionIndex]] || question.explanation || 'No explanation available.'}
                          className="text-blue-800 text-sm md:text-base leading-relaxed"
                          allowImages={true}
                          allowLinks={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Submit Button */}
              {!showAllResults && (
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={handleSubmitAllAnswers}
                    className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-4 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all"
                    disabled={Object.keys(allAnswers).length < questions.length}
                  >
                    Nộp bài ({Object.keys(allAnswers).length}/{questions.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}

export default MultipleChoiceExercise