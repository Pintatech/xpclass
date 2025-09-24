import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { saveRecentExercise } from '../../utils/recentExercise'
import LoadingSpinner from '../ui/LoadingSpinner'
import { Check, X, RotateCcw, HelpCircle, ArrowLeft } from 'lucide-react'

const FillBlankExercise = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { completeExerciseWithXP } = useProgress()
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [showExplanation, setShowExplanation] = useState(false)
  const [exerciseCompleted, setExerciseCompleted] = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [questionScores, setQuestionScores] = useState([])

  const questions = exercise?.content?.questions || []
  const currentQuestion = questions[currentQuestionIndex]

  useEffect(() => {
    loadExercise()
  }, [])

  useEffect(() => {
    // Initialize user answers when questions change
    if (questions.length > 0) {
      const initialAnswers = {}
      questions.forEach((question, qIndex) => {
        initialAnswers[qIndex] = question.blanks.map(() => '')
      })
      setUserAnswers(initialAnswers)
    }
  }, [questions])

  const loadExercise = async () => {
    try {
      setLoading(true)
      setError(null)

      const urlParams = new URLSearchParams(location.search)
      const exerciseId = urlParams.get('exerciseId')
      const sessionId = urlParams.get('sessionId')

      if (!exerciseId) {
        throw new Error('Exercise ID not found')
      }

      console.log('🔍 Loading fill blank exercise:', exerciseId)

      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'fill_blank')
        .single()

      if (exerciseError) {
        console.error('❌ Error loading exercise:', exerciseError)
        throw exerciseError
      }

      if (!exerciseData) {
        throw new Error('Exercise not found')
      }

      console.log('✅ Exercise loaded:', exerciseData.title)
      setExercise(exerciseData)

      // Save to recent exercises
      if (user) {
        await saveRecentExercise(user.id, exerciseData.id, exerciseData.title, 'fill_blank')
      }

    } catch (err) {
      console.error('❌ Error loading exercise:', err)
      setError(err.message || 'Failed to load exercise')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (blankIndex, value) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        ...prev[currentQuestionIndex],
        [blankIndex]: value
      }
    }))
  }

  const checkAnswer = (blankIndex) => {
    const userAnswer = userAnswers[currentQuestionIndex]?.[blankIndex] || ''
    const correctAnswers = currentQuestion.blanks[blankIndex].answer
      .split(',')
      .map(a => a.trim())
      .filter(a => a)
    const caseSensitive = currentQuestion.blanks[blankIndex].case_sensitive

    if (caseSensitive) {
      return correctAnswers.some(answer => userAnswer === answer)
    } else {
      return correctAnswers.some(answer => userAnswer.toLowerCase() === answer.toLowerCase())
    }
  }

  const getBlankStatus = (blankIndex) => {
    if (!showResults) return 'neutral'
    return checkAnswer(blankIndex) ? 'correct' : 'incorrect'
  }

  const handleSubmit = () => {
    setShowResults(true)
    setShowExplanation(true)
    
    // Calculate score for current question
    const correctAnswers = currentQuestion.blanks.filter((_, blankIndex) => 
      checkAnswer(blankIndex)
    ).length
    const questionScore = (correctAnswers / currentQuestion.blanks.length) * 100
    setScore(questionScore)
  }

  const handleNext = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      // Save current question score
      const currentScore = score
      setQuestionScores(prev => [...prev, currentScore])
      
      setCurrentQuestionIndex(prev => prev + 1)
      setShowResults(false)
      setShowExplanation(false)
    } else {
      // Exercise completed - show results screen
      const currentScore = score
      const finalScores = [...questionScores, currentScore]
      const averageScore = finalScores.reduce((sum, s) => sum + s, 0) / finalScores.length
      
      setQuestionScores(finalScores)
      setTotalScore(averageScore)
      setExerciseCompleted(true)
      setShowResults(false)
      setShowExplanation(false)

      // Mark exercise completed with XP
      try {
        const urlParams = new URLSearchParams(location.search)
        const exerciseId = urlParams.get('exerciseId')
        const roundedScore = Math.round(averageScore)
        const baseXP = exercise?.xp_reward || 10
        const bonusXP = roundedScore >= 80 ? Math.round(baseXP * 0.2) : 0
        const totalXP = baseXP + bonusXP

        if (exerciseId && user) {
          await completeExerciseWithXP(exerciseId, totalXP, {
            score: roundedScore,
            max_score: 100
          })
        }
      } catch (err) {
        console.error('Error marking fill_blank exercise completed:', err)
      }
    }
  }

  const handleRetry = () => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: currentQuestion.blanks.map(() => '')
    }))
    setShowResults(false)
    setShowExplanation(false)
  }

  const handleBackToSession = () => {
    const urlParams = new URLSearchParams(location.search)
    const sessionId = urlParams.get('sessionId')
    const courseId = urlParams.get('courseId')
    const unitId = urlParams.get('unitId')
    
    if (sessionId && unitId && courseId) {
      navigate(`/study/course/${courseId}/unit/${unitId}/session/${sessionId}`)
    } else {
      navigate(-1)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <LoadingSpinner />
          <p className="text-gray-500 mt-4">Loading exercise...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Exercise</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!exercise || questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">No questions available</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Show results screen when exercise is completed
  if (exerciseCompleted) {
    const getScoreColor = (score) => {
      if (score >= 80) return 'text-green-600'
      if (score >= 60) return 'text-yellow-600'
      return 'text-red-600'
    }

    const getScoreMessage = (score) => {
      if (score >= 90) return 'Excellent! 🎉'
      if (score >= 80) return 'Great job! 👏'
      if (score >= 70) return 'Good work! 👍'
      if (score >= 60) return 'Not bad! 💪'
      return 'Keep practicing! 📚'
    }

    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Exercise Completed!</h2>
            <p className="text-gray-600">{getScoreMessage(totalScore)}</p>
          </div>

          <div className="text-center mb-8">
            <div className={`text-6xl font-bold ${getScoreColor(totalScore)} mb-2`}>
              {Math.round(totalScore)}%
            </div>
            <p className="text-gray-600">Overall Score</p>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Question Breakdown</h3>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Question {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${getScoreColor(questionScores[index] || 0)}`}>
                      {Math.round(questionScores[index] || 0)}%
                    </span>
                    {questionScores[index] >= 80 ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <X className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleBackToSession}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Session
            </button>
            <button
              onClick={() => {
                setExerciseCompleted(false)
                setCurrentQuestionIndex(0)
                setUserAnswers({})
                setQuestionScores([])
                setTotalScore(0)
              }}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderQuestionText = () => {
    let text = currentQuestion.question
    let blankIndex = 0
    
    // Replace blanks with input fields - handle multiple blanks per question
    return text.split(/(_____|\[blank\])/gi).map((part, index) => {
      if (part.match(/^(_____|\[blank\])$/gi)) {
        const currentBlankIndex = blankIndex++
        const status = getBlankStatus(currentBlankIndex)
        const blank = currentQuestion.blanks[currentBlankIndex]
        
        // If we have more blanks than expected, create a placeholder
        if (!blank) {
          return (
            <span key={index} className="inline-block mx-1">
              <div className="relative">
                <input
                  type="text"
                  value=""
                  disabled
                  className="px-2 py-1 border-2 border-gray-200 bg-gray-100 text-center min-w-[100px] cursor-not-allowed"
                  placeholder="?"
                />
                <div className="absolute -bottom-6 left-0 text-xs text-red-500 whitespace-nowrap">
                  Missing blank data
                </div>
              </div>
            </span>
          )
        }
        
        return (
          <span key={index} className="inline-block mx-1">
            <div className="relative">
              <input
                type="text"
                value={userAnswers[currentQuestionIndex]?.[currentBlankIndex] || ''}
                onChange={(e) => handleAnswerChange(currentBlankIndex, e.target.value)}
                disabled={showResults}
                className={`px-2 py-1 border-2 rounded text-center min-w-[100px] ${
                  status === 'correct' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : status === 'incorrect'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 focus:border-blue-500'
                } ${showResults ? 'cursor-not-allowed' : 'focus:outline-none focus:ring-2 focus:ring-blue-500'}`}
                placeholder="?"
              />
              {blank?.text && (
                <div className="absolute -bottom-6 left-0 text-xs text-gray-500 whitespace-nowrap">
                  Hint: {blank.text}
                </div>
              )}
            </div>
          </span>
        )
      }
      // Handle line breaks in text parts
      return (
        <span key={index} className="whitespace-pre-line">
          {part}
        </span>
      )
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{exercise.title}</h1>
        <div className="w-20"></div> {/* Spacer for centering */}
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-sm text-gray-500">
            Fill in the Blank
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="text-lg leading-relaxed mb-4">
          {renderQuestionText()}
        </div>

        {/* Results */}
        {showResults && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className="text-lg font-medium text-gray-700">Score: </span>
                <span className={`text-xl font-bold ml-2 ${
                  score >= 80 ? 'text-green-600' : 
                  score >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {Math.round(score)}%
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Next' : 'Finish'}
                </button>
              </div>
            </div>

             {/* Correct Answers */}
             <div className="space-y-2">
               <h4 className="font-medium text-gray-700">Correct Answers:</h4>
               {currentQuestion.blanks.map((blank, blankIndex) => {
                 const correctAnswers = blank.answer
                   .split(',')
                   .map(a => a.trim())
                   .filter(a => a)
                 
                 return (
                   <div key={blankIndex} className="flex items-center gap-2 flex-wrap">
                     <span className="text-sm text-gray-600">Blank {blankIndex + 1}:</span>
                     <div className="flex gap-1 flex-wrap">
                       {correctAnswers.map((answer, answerIndex) => (
                         <span key={answerIndex} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                           {answer}
                         </span>
                       ))}
                     </div>
                     {blank.text && (
                       <span className="text-xs text-gray-500">(Hint: {blank.text})</span>
                     )}
                     {blank.case_sensitive && (
                       <span className="text-xs text-gray-500">(case sensitive)</span>
                     )}
                   </div>
                 )
               })}
             </div>
          </div>
        )}

        {/* Explanation */}
        {showExplanation && currentQuestion.explanation && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Explanation</h4>
                <p className="text-blue-800 text-sm">{currentQuestion.explanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      {!showResults && (
        <div className="text-center">
          <button
            onClick={handleSubmit}
            disabled={!userAnswers[currentQuestionIndex] || 
              Object.values(userAnswers[currentQuestionIndex] || {}).some(answer => !answer.trim())}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Check Answer
          </button>
        </div>
      )}
    </div>
  )
}

export default FillBlankExercise
