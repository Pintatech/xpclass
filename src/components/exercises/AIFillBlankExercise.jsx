import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { useFeedback } from '../../hooks/useFeedback'
import { ArrowLeft, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { callAIScoring as localAIScoring } from '../../utils/aiScoringService'
import RichTextRenderer from '../ui/RichTextRenderer'
import ExerciseHeader from '../ui/ExerciseHeader'
import CelebrationScreen from '../ui/CelebrationScreen'

// Theme-based side decoration images for PC
const themeSideImages = {
  blue: {
    left: "https://xpclass.vn/xpclass/image/theme_question/ice_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/ice_right.png",
  },
  green: {
    left: "https://xpclass.vn/xpclass/image/theme_question/forest_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/forest_right.png"
  },
  purple: {
    left: "https://xpclass.vn/xpclass/image/theme_question/pirate.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/pirate.png"
  },
  orange: {
    left: "https://xpclass.vn/xpclass/image/theme_question/ninja_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/ninja_right.png"
  },
  red: {
    left: "https://xpclass.vn/xpclass/image/theme_question/candy_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/candy_right.png"
  },
  yellow: {
    left: "https://xpclass.vn/xpclass/image/theme_question/desert_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/desert_right.png"
  }
}

const getThemeSideImages = (theme) => {
  return themeSideImages[theme] || themeSideImages.blue
}

const AIFillBlankExercise = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { completeExerciseWithXP } = useProgress()
  const { playCelebration, passGif } = useFeedback()

  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [aiScores, setAiScores] = useState({})
  const [isChecking, setIsChecking] = useState(false)
  const [showResults, setShowResults] = useState({})
  const [exerciseCompleted, setExerciseCompleted] = useState(false)
  const [language, setLanguage] = useState('en') // 'en' | 'vi'
  const [attempts, setAttempts] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [timeSpent, setTimeSpent] = useState(0)
  const [colorTheme, setColorTheme] = useState('blue')
  const [session, setSession] = useState(null)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [questionStartTimes, setQuestionStartTimes] = useState({})

  // Keep language in sync with exercise settings (must be before any early returns)
  const exerciseLanguage = exercise?.content?.settings?.language
  useEffect(() => {
    if (exerciseLanguage && (exerciseLanguage === 'en' || exerciseLanguage === 'vi')) {
      setLanguage(exerciseLanguage)
    }
  }, [exerciseLanguage])

  // Get exerciseId and sessionId from URL params
  const searchParams = new URLSearchParams(location.search)
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')

  useEffect(() => {
    if (exerciseId) {
      fetchExercise()
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
            id,
            title,
            course_id,
            color_theme
          )
        `)
        .eq('id', sessionId)
        .single()

      if (error) throw error
      setSession(data)

      // Set color theme from session or unit
      const theme = data?.color_theme || data?.units?.color_theme || 'blue'
      setColorTheme(theme)
    } catch (err) {
      console.error('Error fetching session info:', err)
    }
  }

  // Start time tracking when exercise loads
  useEffect(() => {
    if (exercise && !startTime) {
      setStartTime(Date.now())
    }
  }, [exercise, startTime])

  // Track when each question starts
  useEffect(() => {
    if (!questionStartTimes[currentQuestionIndex]) {
      setQuestionStartTimes(prev => ({
        ...prev,
        [currentQuestionIndex]: Date.now()
      }))
    }
  }, [currentQuestionIndex])

  const fetchExercise = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'ai_fill_blank')
        .single()

      if (error) throw error
      setExercise(data)
    } catch (error) {
      console.error('Error fetching exercise:', error)
      setError('Failed to load exercise')
    } finally {
      setLoading(false)
    }
  }

  const callAIScoreAPI = async (question, userAnswer, expectedAnswers) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch('/api/ai-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, userAnswer, expectedAnswers, context: 'educational assessment', language }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (!response.ok) throw new Error(`AI API ${response.status}`)
      const result = await response.json()
      return {
        score: result.score || 0,
        explanation: result.explanation || 'No explanation provided',
        confidence: result.confidence || 0
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  const checkAnswer = async (questionIndex) => {
    if (!exercise) return

    const question = exercise.content.questions[questionIndex]
    const userAnswer = userAnswers[questionIndex] || ''

    if (!userAnswer.trim()) {
      alert('Please enter an answer before checking')
      return
    }

    setIsChecking(true)
    setAttempts(prev => prev + 1)

    const questionStartTime = questionStartTimes[questionIndex] || Date.now()

    try {
      let aiResult
      try {
        // Try production API first
        aiResult = await callAIScoreAPI(
          question.question,
          userAnswer,
          question.expected_answers || []
        )
      } catch (err) {
        console.warn('AI API failed, using local scoring fallback:', err?.message || err)
        aiResult = await localAIScoring(
          question.question,
          userAnswer,
          question.expected_answers || [],
          'educational assessment',
          language
        )
      }

      setAiScores(prev => ({
        ...prev,
        [questionIndex]: aiResult
      }))

      setShowResults(prev => ({
        ...prev,
        [questionIndex]: true
      }))

      // Save question attempt to database
      if (user && exerciseId) {
        try {
          const responseTime = Date.now() - questionStartTime
          const expectedAnswers = (question.expected_answers || []).join(', ')

          await supabase.from('question_attempts').insert({
            user_id: user.id,
            exercise_id: exerciseId,
            exercise_type: 'ai_fill_blank',
            question_id: question.id || `q${questionIndex}`,
            selected_answer: userAnswer,
            correct_answer: expectedAnswers,
            is_correct: aiResult.score >= 70,
            attempt_number: 1,
            response_time: responseTime
          })
        } catch (err) {
          console.log('⚠️ Could not save question attempt:', err.message)
        }
      }

      // Save progress
      await saveProgress(questionIndex, aiResult.score >= 70) // 70% threshold for "correct"

    } catch (error) {
      console.error('Error checking answer:', error)
      alert('Error checking answer. Please try again.')
    } finally {
      setIsChecking(false)
    }
  }

  const saveProgress = async (questionIndex, isCorrect) => {
    if (!user || !exercise) return

    try {
      const currentTime = Date.now()
      const totalTimeSpent = startTime ? Math.floor((currentTime - startTime) / 1000) : 0
      setTimeSpent(totalTimeSpent)
      
      // Check if all questions are completed
      const allQuestionsCompleted = exercise.content.questions.every((_, index) => {
        const aiScore = aiScores[index]
        return aiScore && aiScore.score >= 70
      })

      // Calculate overall score
      const totalScore = Object.values(aiScores).reduce((sum, score) => sum + (score?.score || 0), 0)
      const maxScore = exercise.content.questions.length * 100
      const averageScore = totalScore / exercise.content.questions.length

      const { error } = await supabase.from('user_progress').upsert({
        user_id: user.id,
        exercise_id: exercise.id,
        question_index: questionIndex,
        status: allQuestionsCompleted ? 'completed' : 'in_progress',
        completed_at: allQuestionsCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        xp_earned: allQuestionsCompleted ? (exercise.xp_reward || 10) : 0,
        score: Math.round(averageScore),
        max_score: 100,
        attempts: attempts,
        time_spent: totalTimeSpent
      }, {
        onConflict: 'user_id,exercise_id'
      })

      if (error) {
        console.error('Error saving progress:', error)
      }

      if (allQuestionsCompleted) {
        setExerciseCompleted(true)
      }
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  const nextQuestion = async () => {
    if (currentQuestionIndex < exercise.content.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      // Last question - complete the exercise
      const allQuestionsCompleted = exercise.content.questions.every((_, index) => {
        const aiScore = aiScores[index]
        return aiScore && aiScore.score >= 70
      })

      if (allQuestionsCompleted && !exerciseCompleted) {
        // Calculate final score and complete
        const totalScore = Object.values(aiScores).reduce((sum, score) => sum + (score?.score || 0), 0)
        const averageScore = totalScore / exercise.content.questions.length
        const currentTime = Date.now()
        const totalTimeSpent = startTime ? Math.floor((currentTime - startTime) / 1000) : 0

        // Play celebration if passed
        if (averageScore >= 70) {
          playCelebration()
        }

        try {
          const roundedScore = Math.round(averageScore)
          const baseXP = exercise?.xp_reward || 10
          const bonusXP = roundedScore >= 95 ? Math.round(baseXP * 0.5) : roundedScore >= 90 ? Math.round(baseXP * 0.3) : 0
          const totalXP = baseXP + bonusXP

          const searchParams = new URLSearchParams(location.search)
          const exerciseId = searchParams.get('exerciseId')

          if (exerciseId && user) {
            await completeExerciseWithXP(exerciseId, totalXP, {
              score: roundedScore,
              max_score: 100,
              time_spent: totalTimeSpent
            })
            setXpAwarded(totalXP)
          }

          setExerciseCompleted(true)
        } catch (error) {
          console.error('Error completing exercise:', error)
        }
      }
    }
  }

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleBackToSession = () => {
    const searchParams = new URLSearchParams(location.search)
    const sessionId = searchParams.get('sessionId')
    const courseId = searchParams.get('courseId') || session?.units?.course_id
    const unitId = searchParams.get('unitId') || session?.unit_id

    if (sessionId && courseId && unitId) {
      navigate(`/study/course/${courseId}/unit/${unitId}/session/${sessionId}`)
    } else if (sessionId) {
      navigate(`/session?id=${sessionId}`)
    } else if (courseId && unitId) {
      navigate(`/course/${courseId}/unit/${unitId}`)
    } else if (courseId) {
      navigate(`/course/${courseId}`)
    } else {
      navigate('/dashboard')
    }
  }

  const resetQuestion = (questionIndex) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: ''
    }))
    setAiScores(prev => {
      const newScores = { ...prev }
      delete newScores[questionIndex]
      return newScores
    })
    setShowResults(prev => ({
      ...prev,
      [questionIndex]: false
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!exercise || !exercise.content.questions || exercise.content.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Questions</h2>
          <p className="text-gray-600 mb-4">This exercise has no questions available.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = exercise.content.questions[currentQuestionIndex]
  const userAnswer = userAnswers[currentQuestionIndex] || ''
  const aiScore = aiScores[currentQuestionIndex]
  const showResult = showResults[currentQuestionIndex]

  const sideImages = getThemeSideImages(colorTheme)

  return (
    <>
      {/* Left side image - only visible on desktop (md and up) - Fixed to viewport */}
      <div className="hidden md:block fixed left-0 bottom-[0%] w-48 lg:w-64 xl:w-80 pointer-events-none z-10">
        <img
          src={sideImages.left}
          alt="Theme decoration left"
          className="w-full h-auto object-contain"
          style={{ maxHeight: '80vh' }}
        />
      </div>

      {/* Right side image - only visible on desktop (md and up) - Fixed to viewport */}
      <div className="hidden md:block fixed right-0 bottom-[0%] w-48 lg:w-64 xl:w-80 pointer-events-none z-10">
        <img
          src={sideImages.right}
          alt="Theme decoration right"
          className="w-full h-auto object-contain"
          style={{ maxHeight: '80vh' }}
        />
      </div>

      <div className="relative min-h-screen bg-white">
        <div className="relative z-20">

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4">
        <ExerciseHeader
          title={exercise?.title}
          progressPercentage={
            (Object.values(aiScores).filter(s => s && s.score >= 70).length / exercise.content.questions.length) * 100
          }
          showBatman={true}
          showProgressLabel={false}
          showQuestionCounter={false}
          targetInfo="AI sẽ chấm điểm"
          colorTheme={colorTheme}
        />
        {/* Exercise Intro */}
        {exercise?.content?.intro && String(exercise.content.intro).trim() && (
          <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
            <RichTextRenderer
              content={exercise.content.intro}
              allowImages={true}
              allowLinks={false}
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 mt-8">
          {/* Question */}
          <div className="mb-8">
            <div className="text-lg font-semibold text-gray-800 mb-4 leading-relaxed">
              <RichTextRenderer
                content={currentQuestion.question}
                allowImages={true}
                allowLinks={true}
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
            
            {/* Answer Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Answer:
              </label>
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswers(prev => ({
                  ...prev,
                  [currentQuestionIndex]: e.target.value
                }))}
                placeholder="Type your answer here..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={3}
                disabled={showResult}
              />
            </div>

            {/* AI Score Result */}
            {showResult && aiScore && (
              <div className={`mb-4 p-4 rounded-lg border ${
                aiScore.score >= 70 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {aiScore.score >= 70 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${
                    aiScore.score >= 70 ? 'text-green-800' : 'text-red-800'
                  }`}>
                    AI Score: {Math.round(aiScore.score)}%
                  </span>

                </div>
                <p className="text-sm text-gray-700">
                  <strong>AI Explanation:</strong> {aiScore.explanation}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 items-center">
              <div className="ml-auto flex items-center gap-2">
                <label className="text-sm text-gray-600">Language:</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                </select>
              </div>
              {!showResult ? (
                <button
                  onClick={() => checkAnswer(currentQuestionIndex)}
                  disabled={isChecking || !userAnswer.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isChecking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      AI is checking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Check with AI
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => resetQuestion(currentQuestionIndex)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={prevQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <button
              onClick={nextQuestion}
              disabled={!showResult}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {currentQuestionIndex < exercise.content.questions.length - 1 ? 'Next' : 'Finish Exercise'}
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>

          {/* Celebration Screen */}
          {exerciseCompleted && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <CelebrationScreen
                score={Math.round(Object.values(aiScores).reduce((sum, score) => sum + (score?.score || 0), 0) / exercise.content.questions.length)}
                correctAnswers={Object.values(aiScores).filter(s => s && s.score >= 70).length}
                totalQuestions={exercise.content.questions.length}
                passThreshold={70}
                xpAwarded={xpAwarded}
                passGif={passGif}
                isRetryMode={false}
                wrongQuestionsCount={0}
                onRetryWrongQuestions={() => {}}
                onBackToList={handleBackToSession}
                exerciseId={new URLSearchParams(location.search).get('exerciseId')}
              />
            </div>
          )}
        </div>
      </div>
      </div>
      </div>
    </>
  )
}

export default AIFillBlankExercise
