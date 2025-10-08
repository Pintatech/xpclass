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

  // Disable page scrolling on desktop unless explanation is shown; allow on mobile.
  useEffect(() => {
    const applyOverflow = () => {
      const isDesktop = window.matchMedia('(min-width: 768px)').matches
      document.body.style.overflow = isDesktop && !showExplanation ? 'hidden' : ''
    }
    const previousOverflow = document.body.style.overflow
    applyOverflow()
    window.addEventListener('resize', applyOverflow)
    return () => {
      window.removeEventListener('resize', applyOverflow)
      document.body.style.overflow = previousOverflow
    }
  }, [showExplanation])

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

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'multiple_choice')
        .single()

      if (error) throw error

      if (data && data.content && data.content.questions) {
        setExercise(data)

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

          return {
            ...q,
            options: shuffledOptions,
            correct_answer: newCorrectIndex,
            _originalOptions: q.options, // Keep original for reference
            _originalCorrectAnswer: q.correct_answer
          }
        })

        setQuestions(processedQuestions)

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
    <div className={`quiz-question-bg quiz-desktop-reset bg-blue-100${showExplanation ? '' : ' md:overflow-hidden'}`} style={{backgroundImage: 'url(https://xpclass.vn/xpclass/mobile_bg7.jpg)', backgroundSize: '100% auto', backgroundPosition: 'center', backgroundRepeat: 'repeat'}}>
      <div className="max-w-4xl mx-auto px-3 pt-4 lg:pt-20 space-y-2">
      {/* Header */}
      <div className="mb-2">
        <div className="bg-blue-500 text-white px-3 py-2 rounded-lg border-2 border-gray-600">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-100 truncate">
                {isRetryMode ? 'Ôn lại câu sai' : exercise?.title}
              </p>
              <h1 className="text-base md:text-xl font-bold">Trắc nghiệm</h1>
              <p className="text-xs text-blue-200 hidden md:block">
                🎯 Cần đạt ≥ 75% để hoàn thành
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-base md:text-xl font-bold">
                {currentQuestionNumber}/{totalQuestions}
              </div>
              <div className="text-xs text-blue-100">
                Câu hỏi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentQuestionNumber / totalQuestions) * 100}%` }}
        ></div>
      </div>


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
        <Card className="p-4 md:p-8 text-center">
          <div className="mb-4">
            {(() => {
              const correctAnswers = questionResults.filter(r => r.isCorrect).length
              const totalQuestions = questionResults.length
              const score = Math.round((correctAnswers / totalQuestions) * 100)
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
                    {passed
                      ? (isRetryMode ? 'Đã hoàn thành ôn lại!' : 'Hoàn thành bài quiz!')
                      : 'Cần cải thiện!'
                    }
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
        </Card>
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

      {/* Current Question */}
      {!isQuizComplete && (
        <div className="max-w-4xl mx-auto md:rounded-lg md:p-6 bg-transparent md:shadow-lg md:overflow-y-auto quiz-content-scroll md:max-h-[70vh] md:mb-0 md:mt-[50px] pb-6">
          <div className="space-y-2 md:space-y-4">
            {/* Mobile: show question text */}
            <div className="mb-3 md:hidden">
              <RichTextRenderer
                content={currentQuestion.question}
                className="text-base text-gray-800 question-text"
                allowImages={true}
                allowLinks={false}
              />
            </div>

            {/* Desktop only: flexible height based on content */}
            <div className="hidden md:block mb-3 md:mb-4 p-0">
              <RichTextRenderer
                content={currentQuestion.question}
                className="md:text-xl lg:text-2xl md:text-white question-text"
                allowImages={true}
                allowLinks={false}
              />
            </div>

            <div className="flex items-start gap-2 md:gap-3">
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {currentQuestion.options.map((option, index) => {
                    let buttonClass = "w-full p-2 md:p-3 text-left border-2 rounded-lg transition-all duration-200 text-xs md:text-sm "

                    // Hover color sets per index: pink, orange, yellow, green
                    const hoverStylesByIndex = [
                      "hover:border-pink-400 hover:bg-pink-300",
                      "hover:border-orange-400 hover:bg-orange-300",
                      "hover:border-yellow-400 hover:bg-yellow-300 ",
                      "hover:border-green-400 hover:bg-green-300",
                    ]
                    const hoverStyles = hoverStylesByIndex[index % hoverStylesByIndex.length]

                    if (selectedAnswer === null) {
                      buttonClass += `border-gray-300 ${hoverStyles} cursor-pointer`
                    } else {
                      if (index === selectedAnswer) {
                        // Show only the selected answer - green if correct, red if wrong
                        const isCorrect = index === currentQuestion.correct_answer
                        if (isCorrect) {
                          buttonClass += "border-green-500 bg-green-100 text-green-800"
                        } else {
                          buttonClass += "border-red-500 bg-red-100 text-red-800"
                        }
                      } else {
                        // Other options remain neutral
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
                            {selectedAnswer !== null && index === selectedAnswer && (
                              <>
                                {index === currentQuestion.correct_answer ? (
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
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
              </div>
              {showExplanation && (
                <div className="flex-shrink-0 hidden md:block">
                  <Button
                    onClick={handleNextQuestion}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2"
                  >
                    {currentQuestionIndex < questions.length - 1 ? (
                      <>
                        Câu tiếp theo
                        <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-2" />
                      </>
                    ) : (
                      'Hoàn thành'
                    )}
                  </Button>
                </div>
              )}
            </div>


            {/* Explanation block below */}
            {showExplanation && selectedAnswer !== null && (
              <div className="mt-3 md:mt-4 p-2 md:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-1 text-xs md:text-sm">Giải thích:</h3>
                <RichTextRenderer
                  content={currentQuestion.option_explanations?.[selectedAnswer] || currentQuestion.explanation || 'No explanation available.'}
                  className="text-blue-700 text-xs md:text-sm"
                  allowImages={true}
                  allowLinks={false}
                />
              </div>
            )}

            {/* Mobile-only Next Button below (like before) */}
            {showExplanation && (
              <div className="md:hidden mt-3 md:mt-4 flex justify-end">
                <Button
                  onClick={handleNextQuestion}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2"
                >
                  {currentQuestionIndex < questions.length - 1 ? (
                    <>
                      Câu tiếp theo
                      <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-2" />
                    </>
                  ) : (
                    'Hoàn thành'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default MultipleChoiceExercise