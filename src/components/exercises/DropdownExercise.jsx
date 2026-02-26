import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { useFeedback } from '../../hooks/useFeedback'
import { saveRecentExercise } from '../../utils/recentExercise'
import LoadingSpinner from '../ui/LoadingSpinner'
import { Check, X, RotateCcw, HelpCircle, ArrowLeft, ChevronDown } from 'lucide-react'
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
    left: "https://xpclass.vn/xpclass/image/theme_question/dino_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/dino_right.png"
  },
  yellow: {
    left: "https://xpclass.vn/xpclass/image/theme_question/desert_left.png",
    right: "https://xpclass.vn/xpclass/image/theme_question/desert_right.png"
  }
}

const getThemeSideImages = (theme) => {
  return themeSideImages[theme] || themeSideImages.blue
}

const DropdownExercise = ({ testMode = false, exerciseData = null, onAnswersCollected = null, initialAnswers = null }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { startExercise, completeExerciseWithXP } = useProgress()
  const exerciseId = new URLSearchParams(location.search).get('exerciseId')
  const challengeId = new URLSearchParams(location.search).get('challengeId') || null
  const isChallenge = new URLSearchParams(location.search).get('isChallenge') === 'true'
  const { playCelebration, passGif } = useFeedback()
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState(() => (testMode && initialAnswers) ? initialAnswers : {})
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
  const [isBatmanMoving, setIsBatmanMoving] = useState(false)
  const [colorTheme, setColorTheme] = useState('blue')
  const [session, setSession] = useState(null)
  const [hasPlayedPassAudio, setHasPlayedPassAudio] = useState(false)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [challengeStartTime, setChallengeStartTime] = useState(null)

  const questions = exercise?.content?.questions || []
  const currentQuestion = questions[currentQuestionIndex]

  // Play celebration when exercise is completed and passed
  useEffect(() => {
    if (testMode) return
    if (exerciseCompleted && !hasPlayedPassAudio && totalScore >= 80) {
      playCelebration()
      setHasPlayedPassAudio(true)
    }
  }, [exerciseCompleted, hasPlayedPassAudio, totalScore, playCelebration, testMode])

  // testMode: load exercise data from props
  useEffect(() => {
    if (!testMode || !exerciseData) return
    setExercise(exerciseData)
    setLoading(false)
  }, [testMode, exerciseData])

  // testMode: notify parent of answer changes (use ref to avoid infinite loops)
  const onAnswersCollectedRef = useRef(onAnswersCollected)
  onAnswersCollectedRef.current = onAnswersCollected
  useEffect(() => {
    if (testMode && onAnswersCollectedRef.current) {
      onAnswersCollectedRef.current(userAnswers)
    }
  }, [userAnswers, testMode])

  useEffect(() => {
    if (testMode) return
    loadExercise()
  }, [])

  useEffect(() => {
    if (testMode) return
    const urlParams = new URLSearchParams(location.search)
    const sessionId = urlParams.get('sessionId')
    if (sessionId) {
      fetchSessionInfo(sessionId)
    }
  }, [location])

  const fetchSessionInfo = async (sessionId) => {
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

  useEffect(() => {
    if (testMode) return
    // Track when student enters the exercise
    const initExercise = async () => {
      const urlParams = new URLSearchParams(location.search)
      const exerciseId = urlParams.get('exerciseId')
      if (exerciseId && user) {
        // For challenges, capture exact start time
        if (isChallenge && challengeId) {
          const { startedAt } = await startExercise(exerciseId)
          setChallengeStartTime(startedAt)
          console.log('🏆 Challenge attempt started at:', startedAt)
        } else {
          await startExercise(exerciseId)
        }
      }
    }

    initExercise()
  }, [user])

  useEffect(() => {
    // Initialize user answers when questions change
    if (questions.length > 0) {
      const initialAnswers = {}
      questions.forEach((question, qIndex) => {
        initialAnswers[qIndex] = question.dropdowns.map(() => '')
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

      console.log('🔍 Loading dropdown exercise:', exerciseId)

      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'dropdown')
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
        await saveRecentExercise(user.id, exerciseData.id, exerciseData.title, 'dropdown')
      }

    } catch (err) {
      console.error('❌ Error loading exercise:', err)
      setError(err.message || 'Failed to load exercise')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (dropdownIndex, value) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        ...prev[currentQuestionIndex],
        [dropdownIndex]: value
      }
    }))

    // If results are shown and user changes answer, mark as edited
    if (showResults) {
      setHasEdited(true)
    }
  }

  const checkAnswer = (dropdownIndex) => {
    const userAnswer = (userAnswers[currentQuestionIndex]?.[dropdownIndex] || '').trim()
    const correctAnswer = (currentQuestion.dropdowns[dropdownIndex].correct_answer || '').trim()
    return userAnswer === correctAnswer
  }

  const getDropdownStatus = (dropdownIndex) => {
    if (!showResults) return 'neutral'
    return checkAnswer(dropdownIndex) ? 'correct' : 'incorrect'
  }

  const handleSubmit = () => {
    setShowResults(true)
    setHasEdited(false)
    setShowCorrectAnswers(false)

    // Calculate score for current question
    const correctAnswers = currentQuestion.dropdowns.filter((_, dropdownIndex) =>
      checkAnswer(dropdownIndex)
    ).length
    const questionScore = (correctAnswers / currentQuestion.dropdowns.length) * 100
    setScore(questionScore)
  }

  const handleRecheck = () => {
    setHasEdited(false)

    // Recalculate score - only show feedback, not answers
    const correctAnswers = currentQuestion.dropdowns.filter((_, dropdownIndex) =>
      checkAnswer(dropdownIndex)
    ).length
    const questionScore = (correctAnswers / currentQuestion.dropdowns.length) * 100
    setScore(questionScore)
  }

  const handleShowAnswers = () => {
    setShowCorrectAnswers(true)
    setShowExplanation(true)
  }

  const handleNext = async () => {
    // Save current question score
    const currentScore = score

    // Animate batman moving only if answer was correct (score === 100)
    if (currentScore === 100) {
      setIsBatmanMoving(true)
      setTimeout(() => setIsBatmanMoving(false), 3000)
    }

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
        const bonusXP = roundedScore >= 95 ? Math.round(baseXP * 0.5) : roundedScore >= 90 ? Math.round(baseXP * 0.3) : 0
        const totalXP = baseXP + bonusXP

        if (exerciseId && user && roundedScore >= 80) {
          const result = await completeExerciseWithXP(exerciseId, totalXP, {
            score: roundedScore,
            max_score: 100,
            challengeId: challengeId,  // Pass for daily challenge tracking
            challengeStartedAt: challengeStartTime  // Pass challenge start time for accurate timing
          })
          if (result?.xpAwarded > 0) {
            setXpAwarded(result.xpAwarded)
          }
        }
      } catch (err) {
        console.error('Error marking dropdown exercise completed:', err)
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

  // testMode: render all questions without gamification
  if (testMode) {
    const renderTestQuestionText = (questionIndex) => {
      const question = questions[questionIndex]
      let text = question.question || ''
      let dropdownIndex = 0

      return text.split(/(\[[^\]]+\])/g).map((part, index) => {
        if (part.match(/^\[.+\]$/)) {
          const currentDropdownIndex = dropdownIndex++
          const dropdown = question.dropdowns?.[currentDropdownIndex]
          if (!dropdown) return null

          const selectedValue = userAnswers[questionIndex]?.[currentDropdownIndex] || ''
          const allOptions = [...new Set([...(dropdown.options || []), dropdown.correct_answer])].filter(opt => opt && opt.trim())

          return (
            <span key={index} className="inline-block mx-1">
              <div className="relative inline-block">
                <select
                  value={selectedValue}
                  onChange={(e) => {
                    setUserAnswers(prev => ({
                      ...prev,
                      [questionIndex]: { ...prev[questionIndex], [currentDropdownIndex]: e.target.value }
                    }))
                  }}
                  className={`px-2 py-0 border-0 border-b-2 appearance-none pr-6 cursor-pointer focus:outline-none bg-transparent ${
                    selectedValue ? 'font-bold border-b-blue-500' : 'border-b-gray-400 hover:border-b-blue-500'
                  }`}
                >
                  <option value="" disabled hidden></option>
                  {allOptions.map((option, oi) => (
                    <option key={oi} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 bottom-[5%] -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-500" />
              </div>
            </span>
          )
        }
        const html = markdownToHtml(part)
        return (
          <span key={index} className="inline">
            <RichTextRenderer content={html} allowImages allowLinks className="prose inline max-w-none" />
          </span>
        )
      })
    }

    return (
      <div className="space-y-8">
        {questions.map((question, qIndex) => (
          <div key={qIndex} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="text-lg leading-relaxed">
              {renderTestQuestionText(qIndex)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Show results screen when exercise is completed
  if (exerciseCompleted) {
    // Calculate correct answers and wrong questions
    const correctAnswersCount = questionScores.filter(s => s >= 80).length
    const wrongQuestionsForRetry = questionScores
      .map((score, index) => ({ score, index }))
      .filter(q => q.score < 80)
      .map(q => q.index)

    const handleRetryWrongQuestions = () => {
      if (wrongQuestionsForRetry.length > 0) {
        const newScores = [...questionScores]
        wrongQuestionsForRetry.forEach(qIndex => {
          newScores[qIndex] = 0
        })
        setQuestionScores(newScores)

        setRetryMode(true)
        setRetryQuestions(wrongQuestionsForRetry)

        setExerciseCompleted(false)
        setCurrentQuestionIndex(wrongQuestionsForRetry[0])
        setShowResults(false)
        setShowExplanation(false)
        setShowCorrectAnswers(false)
        setHasEdited(false)
        setTotalScore(0)
        setHasPlayedPassAudio(false)
      }
    }

    return (
      <div className="max-w-4xl mx-auto p-6">
        <CelebrationScreen
          score={Math.round(totalScore)}
          correctAnswers={correctAnswersCount}
          totalQuestions={questions.length}
          passThreshold={80}
          xpAwarded={xpAwarded}
          passGif={passGif}
          isRetryMode={retryMode}
          wrongQuestionsCount={retryMode ? 0 : wrongQuestionsForRetry.length}
          onRetryWrongQuestions={handleRetryWrongQuestions}
          onBackToList={handleBackToSession}
          exerciseId={exerciseId}
        />
      </div>
    )
  }

  const renderQuestionText = () => {
    let text = currentQuestion.question || ''
    let dropdownIndex = 0

    // Replace dropdowns with select elements - supports both [dropdown] and [option1, =option2, option3]
    return text.split(/(\[[^\]]+\])/g).map((part, index) => {
      // Check if this is a dropdown (anything in square brackets)
      if (part.match(/^\[.+\]$/)) {
        const currentDropdownIndex = dropdownIndex++
        const status = getDropdownStatus(currentDropdownIndex)
        const dropdown = currentQuestion.dropdowns?.[currentDropdownIndex]

        // If we have more dropdowns than expected, create a placeholder
        if (!dropdown) {
          return (
            <span key={index} className="inline-block mx-1">
              <div className="relative inline-block">
                <select
                  disabled
                  className="px-3 py-1 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed appearance-none pr-8"
                >
                  <option>?</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-[5%] -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <div className="absolute -bottom-6 left-0 text-xs text-red-500 whitespace-nowrap">
                  Missing dropdown data
                </div>
              </div>
            </span>
          )
        }

        const selectedValue = userAnswers[currentQuestionIndex]?.[currentDropdownIndex] || ''

        // Ensure correct answer is in options, and create combined unique list
        const allOptions = [...new Set([...(dropdown.options || []), dropdown.correct_answer])].filter(opt => opt && opt.trim())

        return (
          <span key={index} className="inline-block mx-1">
            <div className="relative inline-block">
              <select
                value={selectedValue}
                onChange={(e) => handleAnswerChange(currentDropdownIndex, e.target.value)}
                disabled={showCorrectAnswers}
                className={`px-2 py-0 border-0 border-b-2 appearance-none pr-6 cursor-pointer focus:outline-none bg-transparent ${
                  status === 'correct'
                    ? 'border-b-green-500 text-green-700 font-bold'
                    : status === 'incorrect'
                    ? 'border-b-red-500 text-red-700 font-bold'
                    : 'border-b-gray-400 hover:border-b-blue-500'
                } ${selectedValue ? 'font-bold' : ''} ${showCorrectAnswers ? 'cursor-not-allowed opacity-75' : ''}`}
              >
                <option value="" disabled hidden></option>
                {allOptions.map((option, optionIndex) => (
                  <option key={optionIndex} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className={`absolute right-0 bottom-[5%] -translate-y-1/2 w-4 h-4 pointer-events-none ${
                status === 'correct' ? 'text-green-600' :
                status === 'incorrect' ? 'text-red-600' :
                'text-gray-500'
              }`} />
              {status === 'correct' && (
                <Check className="absolute -right-6 bottom-[5%] -translate-y-1/2 w-5 h-5 text-green-600" />
              )}
              {status === 'incorrect' && (
                <X className="absolute -right-6 bottom-[5%] -translate-y-1/2 w-5 h-5 text-red-600" />
              )}
            </div>
          </span>
        )
      }
      // Non-dropdown parts: render rich text (images/audio/html/link)
      const html = markdownToHtml(part)
      return (
        <span key={index} className="inline">
          <RichTextRenderer content={html} allowImages allowLinks className="prose inline max-w-none" />
        </span>
      )
    })
  }

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

      <div className="relative px-4 pt-6 pb-12">
        <div className="max-w-4xl mx-auto space-y-6 relative z-20">
      {/* Header with Batman */}
      <ExerciseHeader
        title={exercise?.title}
        currentQuestion={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        progressPercentage={
          retryMode
            ? ((retryQuestions.indexOf(currentQuestionIndex) + 1) / retryQuestions.length) * 100
            : ((currentQuestionIndex + 1) / questions.length) * 100
        }
        isBatmanMoving={isBatmanMoving}
        isRetryMode={retryMode}
        retryModeText={
          retryMode
            ? `Retry ${retryQuestions.indexOf(currentQuestionIndex) + 1} of ${retryQuestions.length} (Question ${currentQuestionIndex + 1})`
            : ''
        }
        showBatman={true}
        colorTheme={colorTheme}
        showQuestionCounter={true}
        showProgressLabel={false}
      />

      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      {/* Question */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
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
                 {currentQuestion.dropdowns.map((dropdown, dropdownIndex) => (
                   <div key={dropdownIndex} className="flex items-center gap-2 flex-wrap">
                     <span className="text-sm text-gray-600">Dropdown {dropdownIndex + 1}:</span>
                     <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                       {dropdown.correct_answer}
                     </span>
                   </div>
                 ))}
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
              Object.values(userAnswers[currentQuestionIndex] || {}).some(answer => !answer)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Check Answer
          </button>
        </div>
      )}
        </div>
      </div>
    </>
  )
}

export default DropdownExercise