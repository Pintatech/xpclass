import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { saveRecentExercise } from '../../utils/recentExercise'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import { ArrowLeft, CheckCircle, XCircle, ArrowRight, RotateCcw, Star } from 'lucide-react'

const MultipleChoiceExercise = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

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
  const [isResuming, setIsResuming] = useState(false)
  const [exerciseProgressId, setExerciseProgressId] = useState(null)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [showXpNotification, setShowXpNotification] = useState(false)

  // Meme and sound state
  const [currentMeme, setCurrentMeme] = useState('')
  const [showMeme, setShowMeme] = useState(false)

  // Meme arrays - you can replace these URLs with your own memes
  const correctMemes = [
    'https://i.imgflip.com/1g8my4.jpg', // Success Kid
    'https://i.imgflip.com/30b1gx.jpg', // Drake pointing yes
    'https://i.imgflip.com/4/1bij.jpg', // Success Baby
    'https://i.imgflip.com/1otk96.jpg', // Celebration
    'https://i.imgflip.com/1g7qu4.jpg', // Winning
  ]

  const wrongMemes = [
    'https://i.imgflip.com/1g8my4.jpg', // Disappointed face
    'https://i.imgflip.com/30b1gx.jpg', // Drake pointing no
    'https://i.imgflip.com/4/1bij.jpg', // Sad face
    'https://i.imgflip.com/1otk96.jpg', // Facepalm
    'https://i.imgflip.com/1g7qu4.jpg', // Try again
  ]

  // Sound URLs - you can replace these with your own sound files
  const correctSounds = [
    'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    'https://www.soundjay.com/misc/sounds/success-sound-effect.wav'
  ]

  const wrongSounds = [
    'https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav',
    'https://www.soundjay.com/misc/sounds/wrong-answer-sound.wav'
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

        // Load existing progress if user is logged in
        if (user) {
          await loadExistingProgress()
        }

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

  const loadExistingProgress = async () => {
    if (!user || !exerciseId) return

    try {
      let progressData = null

      // First try to load from database
      try {
        const { data: userProgress, error } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('exercise_id', exerciseId)
          .single()

        if (!error && userProgress && userProgress.progress_data) {
          // If exercise is completed, don't resume
          if (userProgress.status === 'completed') {
            return
          }
          progressData = userProgress.progress_data
          console.log('📊 Loaded progress from database:', progressData)
        }
      } catch (dbError) {
        console.log('⚠️ Database load failed, trying localStorage fallback')
      }

      // Fallback to localStorage if database doesn't work
      if (!progressData) {
        const localStorageKey = `exercise_progress_${user.id}_${exerciseId}`
        const savedProgress = localStorage.getItem(localStorageKey)
        if (savedProgress) {
          progressData = JSON.parse(savedProgress)
          console.log('📊 Loaded progress from localStorage:', progressData)
        }
      }

      // If we found progress data, resume from it
      if (progressData) {
        const {
          current_question_index,
          question_results,
          questions_answered
        } = progressData

        // If there's progress and it's meaningful, resume
        if (current_question_index > 0 || questions_answered > 0) {
          setCurrentQuestionIndex(current_question_index || 0)
          setQuestionResults(question_results || [])
          setIsResuming(true)

          console.log(`🔄 Resuming exercise from question ${(current_question_index || 0) + 1}`)
        }
      }
    } catch (err) {
      console.error('❌ Error loading existing progress:', err)
      // Don't block the exercise if progress loading fails
    }
  }

  const currentQuestion = questions[currentQuestionIndex]
  const totalQuestions = questions.length
  const currentQuestionNumber = currentQuestionIndex + 1

  const saveProgress = async (questionIndex, results) => {
    if (!user || !exerciseId) {
      console.log('❌ Cannot save progress: missing user or exerciseId')
      return
    }

    try {
      const questionsAnswered = results.length
      const questionsCorrect = results.filter(r => r.isCorrect).length

      console.log(`🔄 Saving progress: Question ${questionIndex + 1}/${totalQuestions}, Answered: ${questionsAnswered}`)

      // Create progress data
      const progressData = {
        current_question_index: questionIndex,
        total_questions: totalQuestions,
        questions_answered: questionsAnswered,
        questions_correct: questionsCorrect,
        question_results: results,
        last_resumed_at: new Date().toISOString()
      }

      // Try saving to database first (without progress_data if column doesn't exist)
      try {
        // First try with progress_data column
        const { error: upsertError } = await supabase
          .from('user_progress')
          .upsert({
            user_id: user.id,
            exercise_id: exerciseId,
            status: 'in_progress',
            score: questionsCorrect,
            max_score: totalQuestions,
            attempts: 1,
            updated_at: new Date().toISOString(),
            progress_data: progressData
          }, {
            onConflict: 'user_id,exercise_id'
          })

        if (upsertError) {
          // If upsert failed, try without progress_data column
          console.log('⚠️ Upsert with progress_data failed, trying without it:', upsertError.message)

          await supabase
            .from('user_progress')
            .upsert({
              user_id: user.id,
              exercise_id: exerciseId,
              status: 'in_progress',
              score: questionsCorrect,
              max_score: totalQuestions,
              attempts: 1,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,exercise_id'
            })
        }

        console.log(`✅ Progress saved to database: Question ${questionIndex + 1}/${totalQuestions}`)
      } catch (dbError) {
        console.log('⚠️ Database save completely failed, using localStorage fallback:', dbError.message)
      }

      // Always save to localStorage as backup
      const localStorageKey = `exercise_progress_${user.id}_${exerciseId}`
      localStorage.setItem(localStorageKey, JSON.stringify(progressData))
      console.log(`💾 Progress saved to localStorage: Question ${questionIndex + 1}/${totalQuestions}`)

    } catch (err) {
      console.error('❌ Error saving progress:', err)
      // Don't block the exercise if saving fails
    }
  }

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

    // Save progress after answering question
    await saveProgress(currentQuestionIndex, updatedResults)

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

      // Save progress with the next question index
      await saveProgress(nextQuestionIndex, questionResults)

      setCurrentQuestionIndex(nextQuestionIndex)
      setSelectedAnswer(null)
      setShowExplanation(false)
      setStartTime(Date.now())
    } else {
      // Quiz completed
      setIsQuizComplete(true)
      await markExerciseCompleted()
      await clearProgress() // Clear progress when exercise is completed
    }
  }

  const clearProgress = async () => {
    if (!user || !exerciseId) return

    try {
      // Clear from database (optional - may fail if progress_data column doesn't exist)
      try {
        const { error } = await supabase
          .from('user_progress')
          .update({ progress_data: null })
          .eq('user_id', user.id)
          .eq('exercise_id', exerciseId)

        if (error) {
          console.log('⚠️ Could not clear progress_data from database (column may not exist):', error.message)
        }
      } catch (dbError) {
        console.log('⚠️ Database clear failed:', dbError.message)
      }

      // Always clear from localStorage
      const localStorageKey = `exercise_progress_${user.id}_${exerciseId}`
      localStorage.removeItem(localStorageKey)

      console.log('🗑️ Progress cleared from localStorage (and database if available)')
    } catch (err) {
      console.error('❌ Error clearing progress:', err)
    }
  }

  const markExerciseCompleted = async () => {
    if (!user || !exerciseId) return

    const correctAnswers = questionResults.filter(r => r.isCorrect).length
    const totalQuestions = questionResults.length
    const score = Math.round((correctAnswers / totalQuestions) * 100)

    console.log(`🏁 Completing exercise: ${correctAnswers}/${totalQuestions} correct (${score}%)`)

    try {
      // 1. Mark exercise as completed in user_progress
      const { error: progressError } = await supabase.from('user_progress').upsert({
        user_id: user.id,
        exercise_id: exerciseId,
        status: 'completed',
        score: score,
        max_score: 100,
        attempts: isRetryMode ? 2 : 1,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,exercise_id'
      })

      if (progressError) {
        console.log('⚠️ Progress update failed, trying UPDATE instead:', progressError.message)
        // Fallback to UPDATE instead of upsert
        const { error: updateError } = await supabase
          .from('user_progress')
          .update({
            status: 'completed',
            score: score,
            max_score: 100,
            attempts: isRetryMode ? 2 : 1,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('exercise_id', exerciseId)

        if (updateError) {
          console.log('⚠️ UPDATE also failed, trying INSERT:', updateError.message)
          // Last resort: try INSERT
          await supabase.from('user_progress').insert({
            user_id: user.id,
            exercise_id: exerciseId,
            status: 'completed',
            score: score,
            max_score: 100,
            attempts: isRetryMode ? 2 : 1,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      }

      // 2. Calculate and award XP
      const baseXP = exercise?.xp_reward || 10
      const bonusXP = score >= 80 ? Math.round(baseXP * 0.2) : 0 // 20% bonus for good performance
      const totalXP = baseXP + bonusXP

      console.log(`💰 Awarding XP: ${baseXP} base + ${bonusXP} bonus = ${totalXP} total`)

      // 3. Update user's total XP
      const { error: xpError } = await supabase.rpc('add_user_xp', {
        user_id: user.id,
        xp_to_add: totalXP
      })

      if (xpError) {
        console.log('⚠️ XP function failed, trying direct update:', xpError.message)
        // Fallback: direct update
        const { data: currentUser, error: getUserError } = await supabase
          .from('users')
          .select('xp')
          .eq('id', user.id)
          .single()

        if (!getUserError && currentUser) {
          await supabase
            .from('users')
            .update({ xp: (currentUser.xp || 0) + totalXP })
            .eq('id', user.id)
        }
      }

      // 4. Show XP notification
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
          combined_learning: '/study/combined-learning',
          flashcard: '/study/flashcard',
          audio_flashcard: '/study/audio-flashcard',
          sentence_pronunciation: '/study/sentence-pronunciation',
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

  // Hide resume indicator after 5 seconds
  useEffect(() => {
    if (isResuming) {
      const timer = setTimeout(() => {
        setIsResuming(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isResuming])

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

      {/* Resume Indicator */}
      {isResuming && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              Đã tiếp tục từ câu hỏi {currentQuestionNumber}
              {questionResults.length > 0 && (
                <span className="text-sm ml-1">
                  (Đã trả lời {questionResults.length} câu)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

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

      {/* Current Question */}
      {!isQuizComplete && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question}
            </h2>

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
                      <span className="font-medium">{option}</span>
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
                  </button>
                )
              })}
            </div>

            {/* Meme Display */}
            {showMeme && (
              <div className="mt-6 flex justify-center">
                <div className="relative">
                  <img
                    src={currentMeme}
                    alt="Reaction meme"
                    className="max-w-xs max-h-48 rounded-lg shadow-lg animate-bounce"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg" />
                </div>
              </div>
            )}

            {/* Explanation */}
            {showExplanation && selectedAnswer !== null && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Giải thích:</h3>
                <p className="text-blue-700">
                  {currentQuestion.option_explanations?.[selectedAnswer] || currentQuestion.explanation || 'No explanation available.'}
                </p>
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