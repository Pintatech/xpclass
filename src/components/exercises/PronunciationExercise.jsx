import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { supabase } from '../../supabase/client'
import { saveRecentExercise } from '../../utils/recentExercise'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import RichTextRenderer from '../ui/RichTextRenderer'
import { Mic, Square, CheckCircle, XCircle, ArrowRight, Star } from 'lucide-react'
import AudioPlayer from '../ui/AudioPlayer'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

const PronunciationExercise = () => {
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
  const [questionResults, setQuestionResults] = useState([])
  const [isQuizComplete, setIsQuizComplete] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [showXpNotification, setShowXpNotification] = useState(false)

  // Pronunciation state
  const [isRecording, setIsRecording] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [pronunciationScore, setPronunciationScore] = useState(null)
  const [accuracyScore, setAccuracyScore] = useState(null)
  const [fluencyScore, setFluencyScore] = useState(null)
  const [completenessScore, setCompletenessScore] = useState(null)
  const [wordScores, setWordScores] = useState([])
  const [audioUrl, setAudioUrl] = useState(null)
  const [showExplanation, setShowExplanation] = useState(false)

  // Azure Speech SDK refs
  const recognizerRef = useRef(null)
  const audioConfigRef = useRef(null)

  // Azure Speech Service configuration (should be in environment variables)
  const AZURE_SPEECH_KEY = import.meta.env.VITE_AZURE_SPEECH_KEY || ''
  const AZURE_SPEECH_REGION = import.meta.env.VITE_AZURE_SPEECH_REGION || 'southeastasia'

  useEffect(() => {
    if (exerciseId) {
      fetchExercise()
      setStartTime(Date.now())
    } else {
      setLoading(false)
      setError('Exercise ID not found')
    }
  }, [exerciseId])

  useEffect(() => {
    if (sessionId) {
      fetchSessionInfo()
    }
  }, [sessionId])

  useEffect(() => {
    if (isQuizComplete && questionResults.length > 0) {
      markExerciseCompleted()
    }
  }, [isQuizComplete, questionResults.length])

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
        .eq('exercise_type', 'pronunciation')
        .single()

      if (error) throw error

      if (data && data.content && data.content.questions) {
        setExercise(data)
        setQuestions(data.content.questions)

        // Save recent exercise
        try {
          const continuePath = `/study/pronunciation?exerciseId=${data.id}&sessionId=${sessionId}`
          saveRecentExercise({
            ...data,
            continuePath
          })
        } catch { }
      } else {
        setError('No questions found in this exercise')
      }
    } catch (err) {
      console.error('Error fetching exercise:', err)
      setError('Unable to load exercise data')
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]
  const totalQuestions = questions.length
  const currentQuestionNumber = currentQuestionIndex + 1

  const startPronunciationAssessment = async () => {
    if (!AZURE_SPEECH_KEY) {
      console.error('Azure Speech API key not configured')
      alert('Azure Speech Service not configured. Please add VITE_AZURE_SPEECH_KEY to your .env file')
      return
    }

    try {
      setIsRecording(true)
      setPronunciationScore(null)
      setAccuracyScore(null)
      setFluencyScore(null)
      setCompletenessScore(null)
      setWordScores([])
      setTranscription('')

      const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)
      speechConfig.speechRecognitionLanguage = 'en-US'

      audioConfigRef.current = sdk.AudioConfig.fromDefaultMicrophoneInput()

      // Configure pronunciation assessment
      const referenceText = currentQuestion.text
      const pronunciationAssessmentConfig = new sdk.PronunciationAssessmentConfig(
        referenceText,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      )

      // Create speech recognizer
      recognizerRef.current = new sdk.SpeechRecognizer(speechConfig, audioConfigRef.current)

      // Apply pronunciation assessment config
      pronunciationAssessmentConfig.applyTo(recognizerRef.current)

      // Handle recognition results
      recognizerRef.current.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          const pronunciationResult = sdk.PronunciationAssessmentResult.fromResult(e.result)

          setTranscription(e.result.text)
          setPronunciationScore(pronunciationResult.pronunciationScore)
          setAccuracyScore(pronunciationResult.accuracyScore)
          setFluencyScore(pronunciationResult.fluencyScore)
          setCompletenessScore(pronunciationResult.completenessScore)

          // Get word-level scores
          const words = e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult)
          if (words) {
            const parsedWords = JSON.parse(words)
            if (parsedWords.NBest && parsedWords.NBest[0] && parsedWords.NBest[0].Words) {
              setWordScores(parsedWords.NBest[0].Words)
            }
          }

          setShowExplanation(true)
          stopRecording()
        } else if (e.result.reason === sdk.ResultReason.NoMatch) {
          setTranscription('Could not understand speech. Please try again.')
          stopRecording()
        }
      }

      // Handle errors
      recognizerRef.current.canceled = (s, e) => {
        console.error('Recognition canceled:', e.errorDetails)
        setTranscription('Error: ' + e.errorDetails)
        stopRecording()
      }

      // Start continuous recognition
      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          console.log('Recognition started')
        },
        (err) => {
          console.error('Failed to start recognition:', err)
          setIsRecording(false)
        }
      )

    } catch (error) {
      console.error('Error starting pronunciation assessment:', error)
      alert('Failed to start pronunciation assessment: ' + error.message)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          console.log('Recognition stopped')
          setIsRecording(false)
        },
        (err) => {
          console.error('Failed to stop recognition:', err)
          setIsRecording(false)
        }
      )
    }
  }

  // Removed playAudio function - now using AudioPlayer component

  const handleNextQuestion = () => {
    // Save current question result
    const result = {
      questionId: currentQuestion.id,
      questionIndex: currentQuestionIndex,
      pronunciationScore: pronunciationScore || 0,
      accuracyScore: accuracyScore || 0,
      fluencyScore: fluencyScore || 0,
      completenessScore: completenessScore || 0,
      transcription: transcription
    }

    setQuestionResults([...questionResults, result])

    // Reset pronunciation state
    setPronunciationScore(null)
    setAccuracyScore(null)
    setFluencyScore(null)
    setCompletenessScore(null)
    setWordScores([])
    setTranscription('')
    setShowExplanation(false)

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setStartTime(Date.now())
    } else {
      setIsQuizComplete(true)
    }
  }

  const markExerciseCompleted = async () => {
    if (!user || !exerciseId) return

    // Calculate average pronunciation score
    const avgScore = questionResults.reduce((sum, r) => sum + (r.pronunciationScore || 0), 0) / questionResults.length
    const score = Math.round(avgScore)

    console.log(`Completing pronunciation exercise: ${score}% average`)

    try {
      const baseXP = exercise?.xp_reward || 15
      const bonusXP = score >= 80 ? Math.round(baseXP * 0.2) : 0
      const totalXP = baseXP + bonusXP

      const result = await completeExerciseWithXP(exerciseId, totalXP, {
        score: score,
        max_score: 100,
        xp_earned: totalXP
      })

      if (result.error && result.error !== 'Exercise already completed') {
        console.log('Exercise completion failed:', result.error)
        return
      }

      if (result.error === 'Exercise already completed') {
        console.log('Exercise was already completed')
        return
      }

      if (result.xpAwarded > 0) {
        setXpAwarded(result.xpAwarded)
        setShowXpNotification(true)
        setTimeout(() => setShowXpNotification(false), 4000)
      }
    } catch (err) {
      console.error('Error marking exercise completed:', err)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreMessage = (score) => {
    if (score >= 90) return 'Excellent!'
    if (score >= 80) return 'Great!'
    if (score >= 70) return 'Good!'
    if (score >= 60) return 'Fair'
    return 'Keep practicing!'
  }

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
          Try Again
        </Button>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">No questions available</div>
        <Link to="/study">
          <Button variant="outline">Back to Study</Button>
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
                {exercise?.title}
              </p>
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">Pronunciation Practice</h1>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xl md:text-3xl font-bold text-blue-600">
                {currentQuestionNumber}/{totalQuestions}
              </div>
              <div className="text-xs md:text-sm text-gray-500">
                Questions
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-gray-600">Progress</span>
              <span className="text-xs md:text-sm font-semibold text-blue-600">
                {Math.round((currentQuestionNumber / totalQuestions) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${(currentQuestionNumber / totalQuestions) * 100}%` }}
              ></div>
            </div>
          </div>
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
          <div className="bg-white rounded-lg shadow-md p-4 md:p-8 text-center border border-gray-200">
            <div className="mb-4">
              {(() => {
                const avgScore = questionResults.reduce((sum, r) => sum + (r.pronunciationScore || 0), 0) / questionResults.length
                const score = Math.round(avgScore)
                const passed = score >= 70

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
                      {passed ? 'Great Job!' : 'Keep Practicing!'}
                    </h2>
                    <p className="text-sm md:text-base text-gray-600 mb-2">
                      Average Pronunciation Score: {score}%
                    </p>
                    {xpAwarded > 0 && (
                      <div className="flex items-center justify-center space-x-2 text-yellow-600 font-semibold text-sm md:text-base">
                        <Star className="w-4 h-4 md:w-5 md:h-5" />
                        <span>+{xpAwarded} XP earned!</span>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="space-y-4">
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
                Back to Exercise List
              </Button>
            </div>
          </div>
        )}

        {/* Question Display */}
        {!isQuizComplete && (
          <div className="w-full max-w-4xl mx-auto rounded-lg p-4 md:p-8 bg-white shadow-md border border-gray-200">
            <div className="space-y-4 md:space-y-6">
              {/* Question Text */}
              <div className="mb-6">
                <div className="text-center">
                  <h3 className="text-xl md:text-3xl font-bold text-gray-900 mb-4">
                    {currentQuestion.text}
                  </h3>
                  {currentQuestion.phonetic && (
                    <p className="text-lg md:text-xl text-gray-600 mb-4">
                      /{currentQuestion.phonetic}/
                    </p>
                  )}
                  {currentQuestion.audio_url && (
                    <AudioPlayer
                      audioUrl={currentQuestion.audio_url}
                      maxPlays={currentQuestion.max_audio_plays || 0}
                      className="mb-4"
                      variant="outline"
                    />
                  )}
                </div>
              </div>

              {/* Recording Controls */}
              <div className="flex flex-col items-center space-y-4">
                <button
                  onClick={isRecording ? stopRecording : startPronunciationAssessment}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                    isRecording
                      ? 'bg-red-500 animate-pulse shadow-lg'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-md'
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-8 h-8 text-white" />
                  ) : (
                    <Mic className="w-8 h-8 text-white" />
                  )}
                </button>
                <p className="text-center text-gray-600 font-medium">
                  {isRecording ? 'Recording... Speak now!' : 'Tap to start recording'}
                </p>
              </div>

              {/* Pronunciation Results */}
              {showExplanation && pronunciationScore !== null && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-3">Your Pronunciation:</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Overall Score:</span>
                        <span className={`text-2xl font-bold ${getScoreColor(pronunciationScore)}`}>
                          {Math.round(pronunciationScore)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Accuracy:</span>
                        <span className={`font-semibold ${getScoreColor(accuracyScore)}`}>
                          {Math.round(accuracyScore)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Fluency:</span>
                        <span className={`font-semibold ${getScoreColor(fluencyScore)}`}>
                          {Math.round(fluencyScore)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Completeness:</span>
                        <span className={`font-semibold ${getScoreColor(completenessScore)}`}>
                          {Math.round(completenessScore)}%
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-blue-800">{getScoreMessage(pronunciationScore)}</p>
                  </div>

                  {/* Next Button */}
                  <div className="flex justify-center md:justify-end">
                    <Button
                      onClick={handleNextQuestion}
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white text-base md:text-lg px-6 md:px-8 py-3 md:py-4"
                    >
                      {currentQuestionIndex < questions.length - 1 ? (
                        <>
                          Next Question
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      ) : (
                        'Finish'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PronunciationExercise
