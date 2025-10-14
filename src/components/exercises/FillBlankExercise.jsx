import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { saveRecentExercise } from '../../utils/recentExercise'
import LoadingSpinner from '../ui/LoadingSpinner'
import { Check, X, RotateCcw, HelpCircle, ArrowLeft } from 'lucide-react'
import RichTextRenderer from '../ui/RichTextRenderer'

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
  const [hasEdited, setHasEdited] = useState(false)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false)
  const [retryMode, setRetryMode] = useState(false)
  const [retryQuestions, setRetryQuestions] = useState([])

  const questions = exercise?.content?.questions || []
  const currentQuestion = questions[currentQuestionIndex]
  const showAllQuestions = exercise?.content?.settings?.show_all_questions || false

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

    // If results are shown and user changes answer, mark as edited
    if (showResults) {
      setHasEdited(true)
    }
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

  const calculateBlankWidth = (blankIndex) => {
    const blank = currentQuestion?.blanks?.[blankIndex]
    if (!blank) return 64 // Default 64px (w-16)

    // Get all possible answers and find the longest one
    const answers = blank.answer
      .split(',')
      .map(a => a.trim())
      .filter(a => a)

    const longestAnswer = answers.reduce((longest, current) =>
      current.length > longest.length ? current : longest, ''
    )

    // Calculate width: 16px per character + 32px padding
    const calculatedWidth = Math.max(64, Math.min(400, longestAnswer.length * 16 + 32))

    return calculatedWidth
  }

  const handleSubmit = () => {
    setShowResults(true)
    setHasEdited(false)
    setShowCorrectAnswers(false)

    // Calculate score for current question
    const correctAnswers = currentQuestion.blanks.filter((_, blankIndex) =>
      checkAnswer(blankIndex)
    ).length
    const questionScore = (correctAnswers / currentQuestion.blanks.length) * 100
    setScore(questionScore)
  }

  const handleSubmitAll = async () => {
    setShowResults(true)
    setHasEdited(false)
    setShowCorrectAnswers(false)

    // Calculate scores for all questions
    const scores = questions.map((question, qIndex) => {
      const correctAnswers = question.blanks.filter((_, blankIndex) => {
        const userAnswer = userAnswers[qIndex]?.[blankIndex] || ''
        const correctAnswers = question.blanks[blankIndex].answer
          .split(',')
          .map(a => a.trim())
          .filter(a => a)
        const caseSensitive = question.blanks[blankIndex].case_sensitive

        if (caseSensitive) {
          return correctAnswers.some(answer => userAnswer === answer)
        } else {
          return correctAnswers.some(answer => userAnswer.toLowerCase() === answer.toLowerCase())
        }
      }).length
      return (correctAnswers / question.blanks.length) * 100
    })

    setQuestionScores(scores)
    const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
    setTotalScore(averageScore)
    setExerciseCompleted(true)

    // Save progress
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

  const handleRecheck = () => {
    setHasEdited(false)

    // Recalculate score - only show feedback, not answers
    const correctAnswers = currentQuestion.blanks.filter((_, blankIndex) =>
      checkAnswer(blankIndex)
    ).length
    const questionScore = (correctAnswers / currentQuestion.blanks.length) * 100
    setScore(questionScore)
  }

  const handleShowAnswers = () => {
    setShowCorrectAnswers(true)
    setShowExplanation(true)
  }

  const handleNext = async () => {
    // Save current question score
    const currentScore = score

    if (retryMode) {
      // In retry mode, update the specific question score
      const newScores = [...questionScores]
      newScores[currentQuestionIndex] = currentScore
      setQuestionScores(newScores)

      // Find next retry question
      const currentRetryIndex = retryQuestions.indexOf(currentQuestionIndex)
      if (currentRetryIndex < retryQuestions.length - 1) {
        // Move to next retry question
        setCurrentQuestionIndex(retryQuestions[currentRetryIndex + 1])
        setShowResults(false)
        setShowExplanation(false)
        setHasEdited(false)
        setShowCorrectAnswers(false)
        return
      } else {
        // Finished all retry questions, calculate final score
        const finalScores = newScores
        const averageScore = finalScores.reduce((sum, s) => sum + s, 0) / finalScores.length
        setTotalScore(averageScore)
        setExerciseCompleted(true)
        setRetryMode(false)
        setRetryQuestions([])
        return
      }
    }

    // Normal mode navigation
    if (currentQuestionIndex < questions.length - 1) {
      setQuestionScores(prev => [...prev, currentScore])

      setCurrentQuestionIndex(prev => prev + 1)
      setShowResults(false)
      setShowExplanation(false)
      setHasEdited(false)
      setShowCorrectAnswers(false)
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

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <button
              onClick={handleBackToSession}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Back to Session</span>
            </button>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  // Find questions with score < 80% (wrong questions)
                  const wrongQuestions = questionScores
                    .map((score, index) => ({ score, index }))
                    .filter(q => q.score < 80)
                    .map(q => q.index)

                  if (wrongQuestions.length > 0) {
                    // Reset scores for fresh calculation
                    const newScores = [...questionScores]
                    wrongQuestions.forEach(qIndex => {
                      newScores[qIndex] = 0 // Reset wrong question scores
                    })
                    setQuestionScores(newScores)

                    // Set retry mode
                    setRetryMode(true)
                    setRetryQuestions(wrongQuestions)

                    // Start from first wrong question
                    setExerciseCompleted(false)
                    setCurrentQuestionIndex(wrongQuestions[0])
                    setShowResults(false)
                    setShowExplanation(false)
                    setShowCorrectAnswers(false)
                    setHasEdited(false)
                    setTotalScore(0) // Reset total score
                  } else {
                    // No wrong questions, just restart all
                    setExerciseCompleted(false)
                    setCurrentQuestionIndex(0)
                    setUserAnswers({})
                    setQuestionScores([])
                    setTotalScore(0)
                  }
                }}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Retry Wrong</span>
              </button>
              <button
                onClick={() => {
                  setExerciseCompleted(false)
                  setCurrentQuestionIndex(0)
                  setUserAnswers({})
                  setQuestionScores([])
                  setTotalScore(0)
                }}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Try All Again</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderQuestionText = (questionIndex = currentQuestionIndex) => {
    const question = questions[questionIndex]
    let text = question.question || ''
    let blankIndex = 0

    // Replace blanks with input fields - handle multiple blanks per question
    return text.split(/(_____|\[blank\])/gi).map((part, index) => {
      if (part.match(/^(_____|\[blank\])$/gi)) {
        const currentBlankIndex = blankIndex++
        const status = showResults ? (checkAnswerForQuestion(questionIndex, currentBlankIndex) ? 'correct' : 'incorrect') : 'neutral'
        const blank = question.blanks[currentBlankIndex]

        // If we have more blanks than expected, create a placeholder
        if (!blank) {
          return (
            <span key={index} className="inline-block mx-1">
              <div className="relative">
                <input
                  type="text"
                  value=""
                  disabled
                  style={{ width: '64px' }}
                  className="px-1 py-1 border-0 border-b-2 border-b-gray-300 bg-transparent text-center cursor-not-allowed"
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
                value={userAnswers[questionIndex]?.[currentBlankIndex] || ''}
                onChange={(e) => {
                  setUserAnswers(prev => ({
                    ...prev,
                    [questionIndex]: {
                      ...prev[questionIndex],
                      [currentBlankIndex]: e.target.value
                    }
                  }))
                }}
                disabled={showResults}
                style={{ width: `${calculateBlankWidthForQuestion(questionIndex, currentBlankIndex)}px` }}
                className={`px-1 py-1 border-0 border-b-2 bg-transparent text-center focus:outline-none ${
                  status === 'correct'
                    ? 'border-b-green-500 text-green-700'
                    : status === 'incorrect'
                    ? 'border-b-red-500 text-red-700'
                    : 'border-b-gray-400 focus:border-b-blue-500'
                } ${showResults ? 'cursor-not-allowed opacity-75' : ''}`}
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
      // Non-blank parts: render rich text (images/audio/html/link)
      const html = markdownToHtml(part)
      return (
        <span key={index} className="inline">
          <RichTextRenderer content={html} allowImages allowLinks className="prose inline max-w-none" />
        </span>
      )
    })
  }

  const checkAnswerForQuestion = (questionIndex, blankIndex) => {
    const question = questions[questionIndex]
    const userAnswer = userAnswers[questionIndex]?.[blankIndex] || ''
    const correctAnswers = question.blanks[blankIndex].answer
      .split(',')
      .map(a => a.trim())
      .filter(a => a)
    const caseSensitive = question.blanks[blankIndex].case_sensitive

    if (caseSensitive) {
      return correctAnswers.some(answer => userAnswer === answer)
    } else {
      return correctAnswers.some(answer => userAnswer.toLowerCase() === answer.toLowerCase())
    }
  }

  const calculateBlankWidthForQuestion = (questionIndex, blankIndex) => {
    const question = questions[questionIndex]
    const blank = question?.blanks?.[blankIndex]
    if (!blank) return 64

    const answers = blank.answer
      .split(',')
      .map(a => a.trim())
      .filter(a => a)

    const longestAnswer = answers.reduce((longest, current) =>
      current.length > longest.length ? current : longest, ''
    )

    return Math.max(64, Math.min(400, longestAnswer.length * 16 + 32))
  }

  // Convert simple markdown/HTML to safe HTML similar to editors
  const markdownToHtml = (text) => {
    if (!text) return ''
    let html = text
    // Images markdown ![](url)
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (m, alt, url) => `<img src="${url}" alt="${alt || ''}" class="max-w-full h-auto align-middle" />`)
    // HTML <img>
    html = html.replace(/<img([^>]*?)>/g, (m, attrs) => `<img${attrs} class="max-w-full h-auto align-middle" />`)
    // HTML <audio>
    html = html.replace(/<audio([^>]*?)>/g, (m, attrs) => `<audio${attrs} class="w-full align-middle"></audio>`)
    // Links [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, (m, t, url) => `<a href="${url}" target="_blank" rel="noreferrer">${t || url}</a>`)
    // Preserve line breaks
    html = html.replace(/\n/g, '<br/>')
    return html
  }

  // Render all questions on one page
  if (showAllQuestions && !exerciseCompleted) {
    const allAnswersFilled = questions.every((question, qIndex) =>
      question.blanks.every((_, blankIndex) =>
        (userAnswers[qIndex]?.[blankIndex] || '').trim() !== ''
      )
    )

    return (
      <div className="px-4 pt-6 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-5 border border-gray-200 mb-6">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">{exercise.title}</h1>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
            </div>
          </div>

          {/* All Questions */}
          <div className="space-y-8">
            {questions.map((question, qIndex) => (
              <div key={qIndex} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-semibold text-blue-600">Question {qIndex + 1}</span>
                  {showResults && questionScores[qIndex] !== undefined && (
                    <span className={`text-sm font-medium ${
                      questionScores[qIndex] >= 80 ? 'text-green-600' :
                      questionScores[qIndex] >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      ({Math.round(questionScores[qIndex])}%)
                    </span>
                  )}
                </div>
                <div className="text-lg leading-relaxed">
                  {renderQuestionText(qIndex)}
                </div>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          {!showResults && (
            <div className="text-center mt-8">
              <button
                onClick={handleSubmitAll}
                disabled={!allAnswersFilled}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
              >
                Submit All Answers
              </button>
              <p className="text-sm text-gray-500 mt-2">
                {allAnswersFilled ? 'All blanks filled!' : 'Please fill in all blanks before submitting'}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-12">
      <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-5 border border-gray-200">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-gray-500 truncate mb-1">
              {retryMode ? 'Retry Wrong Questions' : exercise?.title}
            </p>
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">Fill in the Blank</h1>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xl md:text-3xl font-bold text-blue-600">
              {currentQuestionIndex + 1}/{questions.length}
            </div>
            <div className="text-xs md:text-sm text-gray-500">
              Question
            </div>
          </div>
        </div>

        {/* Progress Bar inside header */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs md:text-sm text-gray-600">Progress</span>
            <span className="text-xs md:text-sm font-semibold text-blue-600">
              {retryMode
                ? Math.round(((retryQuestions.indexOf(currentQuestionIndex) + 1) / retryQuestions.length) * 100)
                : Math.round(((currentQuestionIndex + 1) / questions.length) * 100)
              }%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${retryMode ? 'bg-yellow-600' : 'bg-blue-600'}`}
              style={{
                width: retryMode
                  ? `${((retryQuestions.indexOf(currentQuestionIndex) + 1) / retryQuestions.length) * 100}%`
                  : `${((currentQuestionIndex + 1) / questions.length) * 100}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="w-full max-w-4xl min-w-0 mx-auto rounded-lg p-4 md:p-8 bg-white shadow-md border border-gray-200">
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
                {hasEdited && !showCorrectAnswers && (
                  <button
                    onClick={handleRecheck}
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Check className="w-4 h-4" />
                    Check Answer
                  </button>
                )}
                {showResults && !showCorrectAnswers && (
                  <button
                    onClick={handleShowAnswers}
                    className="flex items-center gap-1 px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Show Answers
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Exercise'}
                </button>
              </div>
            </div>

             {/* Correct Answers - only show when answers are revealed */}
             {showCorrectAnswers && (
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
             )}
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
    </div>
  )
}

export default FillBlankExercise
