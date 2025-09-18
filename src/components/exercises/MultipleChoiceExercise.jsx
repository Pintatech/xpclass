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
    'https://xpclass.vn/leaderboard/sound/lingo.mp3'
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

  const fetchExercise = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'multiple_choice')
        .single()

      if (error) throw error

      if (data && data.content && data.content.questions) {
        setExercise(data)
        setQuestions(data.content.questions)


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

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextQuestionIndex = currentQuestionIndex + 1

      setCurrentQuestionIndex(nextQuestionIndex)
      setSelectedAnswer(null)
      setShowExplanation(false)
      setStartTime(Date.now())
    } else {
      // Quiz completed
      setIsQuizComplete(true)
      await markExerciseCompleted()
    }
  }


  const markExerciseCompleted = async () => {
    if (!user || !exerciseId) return

    const correctAnswers = questionResults.filter(r => r.isCorrect).length
    const totalQuestions = questionResults.length
    const score = Math.round((correctAnswers / totalQuestions) * 100)

    console.log(`🏁 Completing exercise: ${correctAnswers}/${totalQuestions} correct (${score}%)`)

    try {
      // Calculate XP
      const baseXP = exercise?.xp_reward || 10
      const bonusXP = score >= 80 ? Math.round(baseXP * 0.2) : 0 // 20% bonus for good performance
      const totalXP = baseXP + bonusXP

      console.log(`💰 Awarding XP: ${baseXP} base + ${bonusXP} bonus = ${totalXP} total`)

      // Use useProgress hook to complete exercise (this will also check daily quest)
      const result = await completeExerciseWithXP(exerciseId, totalXP, {
        score: score,
        max_score: 100,
        attempts: isRetryMode ? 2 : 1,
        xp_earned: totalXP
      })

      if (result.error && result.error !== 'Exercise already completed') {
        console.log('⚠️ Exercise completion failed:', result.error)
        return
      }

      // If exercise was already completed, that's fine - daily quest still gets checked
      if (result.error === 'Exercise already completed') {
        console.log('ℹ️ Exercise was already completed, but daily quest was checked')
        // Don't show XP notification for already completed exercises
        return
      }

      // Show XP notification
      setXpAwarded(totalXP)
      setShowXpNotification(true)

      // Hide notification after 4 seconds
      setTimeout(() => {
        setShowXpNotification(false)
      }, 4000)

      console.log(`✅ Exercise completed successfully! Awarded ${totalXP} XP`)

    } catch (err) {
      console.error('❌ Error marking exercise completed:', err)
    }
  }

  const handleRetryWrongQuestions = () => {
    if (wrongQuestions.length === 0) return

    setQuestions(wrongQuestions)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setShowExplanation(false)
    setQuestionResults([])
    setIsQuizComplete(false)
    setIsRetryMode(true)
    setWrongQuestions([])
    setStartTime(Date.now())
  }

  const goToNextExercise = async () => {
    if (!sessionId) return

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
        const nextExercise = exercises[currentIndex + 1]
        const paths = {
          flashcard: '/study/flashcard',
          audio_flashcard: '/study/audio-flashcard',
          multiple_choice: '/study/multiple-choice'
        }
        const exercisePath = paths[nextExercise.exercise_type] || '/study/flashcard'
        navigate(`${exercisePath}?exerciseId=${nextExercise.id}&sessionId=${sessionId}`)
      } else {
        // No more exercises, go back to session
        navigate(`/study/level/${session?.units?.level_id}/unit/${session?.unit_id}/session/${sessionId}`)
      }
    } catch (err) {
      console.error('Error fetching next exercise:', err)
      navigate(`/study/level/${session?.units?.level_id}/unit/${session?.unit_id}/session/${sessionId}`)
    }
  }


  // Handle bottom nav back
  useEffect(() => {
    const handleBottomNavBack = () => {
      if (session && session.units && session.units.levels) {
        const levelId = session.units.levels.id
        const unitId = session.units.id
        navigate(`/study/level/${levelId}/unit/${unitId}/session/${sessionId}`)
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-blue-500 text-white px-6 py-4 rounded-lg border-2 border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">
                {isRetryMode ? 'Ôn lại câu sai' : exercise?.title}
              </p>
              <h1 className="text-2xl font-bold">Trắc nghiệm</h1>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {currentQuestionNumber}/{totalQuestions}
              </div>
              <div className="text-sm text-blue-100">
                Câu hỏi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-blue-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${(currentQuestionNumber / totalQuestions) * 100}%` }}
        ></div>
      </div>


      {/* XP Notification */}
      {showXpNotification && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce">
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5" />
            <span className="font-bold">+{xpAwarded} XP!</span>
          </div>
        </div>
      )}

      {/* Quiz Complete Screen */}
      {isQuizComplete && (
        <Card className="p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {isRetryMode ? 'Đã hoàn thành ôn lại!' : 'Hoàn thành bài quiz!'}
            </h2>
            <p className="text-gray-600 mb-2">
              Bạn đã trả lời đúng {questionResults.filter(r => r.isCorrect).length}/{questionResults.length} câu
            </p>
            {xpAwarded > 0 && (
              <div className="flex items-center justify-center space-x-2 text-yellow-600 font-semibold">
                <Star className="w-5 h-5" />
                <span>+{xpAwarded} XP earned!</span>
              </div>
            )}
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

            {/* Continue to next exercise */}
            <Button
              onClick={goToNextExercise}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Tiếp tục
            </Button>
          </div>
        </Card>
      )}

      {/* Meme Overlay */}
      {showMeme && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <img
            src={currentMeme}
            alt="Reaction meme"
            className="max-w-sm max-h-96 rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* Current Question */}
      {!isQuizComplete && (
        <div className="space-y-6">
          <Card className="p-6 relative">
            <div className="mb-6">
              <RichTextRenderer
                content={currentQuestion.question}
                className="text-xl text-gray-800"
                allowImages={true}
                allowLinks={false}
              />
            </div>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                let buttonClass = "w-full p-4 text-left border-2 rounded-lg transition-all duration-200 "

                if (selectedAnswer === null) {
                  buttonClass += "border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
                } else {
                  if (index === currentQuestion.correct_answer) {
                    buttonClass += "border-green-500 bg-green-100 text-green-800"
                  } else if (index === selectedAnswer) {
                    buttonClass += "border-red-500 bg-red-100 text-red-800"
                  } else {
                    buttonClass += "border-gray-300 bg-gray-50 text-gray-500"
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={selectedAnswer !== null}
                    className={buttonClass}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <RichTextRenderer
                          content={option}
                          
                          allowImages={true}
                          allowLinks={false}
                        />
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {selectedAnswer !== null && (
                          <>
                            {index === currentQuestion.correct_answer && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            {index === selectedAnswer && index !== currentQuestion.correct_answer && (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>


            {/* Explanation */}
            {showExplanation && selectedAnswer !== null && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Giải thích:</h3>
                <RichTextRenderer
                  content={currentQuestion.option_explanations?.[selectedAnswer] || currentQuestion.explanation || 'No explanation available.'}
                  className="text-blue-700"
                  allowImages={true}
                  allowLinks={false}
                />
              </div>
            )}

            {/* Next Button */}
            {showExplanation && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleNextQuestion}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {currentQuestionIndex < questions.length - 1 ? (
                    <>
                      Câu tiếp theo
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    'Hoàn thành'
                  )}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default MultipleChoiceExercise