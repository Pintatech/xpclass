import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { ArrowLeft, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

const AIFillBlankExercise = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [aiScores, setAiScores] = useState({})
  const [isChecking, setIsChecking] = useState(false)
  const [showResults, setShowResults] = useState({})
  const [exerciseCompleted, setExerciseCompleted] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [timeSpent, setTimeSpent] = useState(0)

  // Get exerciseId and sessionId from URL params
  const searchParams = new URLSearchParams(location.search)
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')

  useEffect(() => {
    if (exerciseId) {
      fetchExercise()
    }
  }, [exerciseId])

  // Start time tracking when exercise loads
  useEffect(() => {
    if (exercise && !startTime) {
      setStartTime(Date.now())
    }
  }, [exercise, startTime])

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

  const callAIScoring = async (question, userAnswer, expectedAnswers) => {
    try {
      const response = await fetch('/api/ai-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          userAnswer: userAnswer,
          expectedAnswers: expectedAnswers,
          context: 'educational assessment'
        })
      })

      if (!response.ok) {
        throw new Error('AI scoring service unavailable')
      }

      const result = await response.json()
      return {
        score: result.score || 0,
        explanation: result.explanation || 'No explanation provided',
        confidence: result.confidence || 0
      }
    } catch (error) {
      console.error('AI scoring error:', error)
      // Fallback to simple text matching
      const isExactMatch = expectedAnswers.some(expected => 
        expected.toLowerCase().trim() === userAnswer.toLowerCase().trim()
      )
      return {
        score: isExactMatch ? 100 : 0,
        explanation: isExactMatch ? 'Exact match found' : 'No exact match found',
        confidence: isExactMatch ? 100 : 0
      }
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

    try {
      const aiResult = await callAIScoring(
        question.question,
        userAnswer,
        question.expected_answers || []
      )

      setAiScores(prev => ({
        ...prev,
        [questionIndex]: aiResult
      }))

      setShowResults(prev => ({
        ...prev,
        [questionIndex]: true
      }))

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

  const nextQuestion = () => {
    if (currentQuestionIndex < exercise.content.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div className="text-sm text-gray-500">
              Question {currentQuestionIndex + 1} of {exercise.content.questions.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Question */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 leading-relaxed">
              {currentQuestion.question}
            </h2>
            
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
                  <span className="text-sm text-gray-600">
                    (Confidence: {Math.round(aiScore.confidence)}%)
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  <strong>AI Explanation:</strong> {aiScore.explanation}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
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
              disabled={currentQuestionIndex === exercise.content.questions.length - 1 || !showResult}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Next
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>

          {/* Exercise Completed */}
          {exerciseCompleted && (
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Exercise Completed! 🎉
              </h3>
              <p className="text-green-700">
                Great job! You've completed all questions with AI scoring.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIFillBlankExercise
