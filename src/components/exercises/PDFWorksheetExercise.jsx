import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { supabase } from '../../supabase/client'
import { CheckCircle, XCircle, RotateCcw, ArrowLeft } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import Button3D from '../ui/Button3D'
import CelebrationScreen from '../ui/CelebrationScreen'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { useFeedback } from '../../hooks/useFeedback'
import ExerciseHeader from '../ui/ExerciseHeader'
import { usePermissions } from '../../hooks/usePermissions'
import { assetUrl } from '../../hooks/useBranding'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const themeSideImages = {
  blue: {
    left: assetUrl('/image/theme_question/ice_left.png'),
    right: assetUrl('/image/theme_question/ice_right.png'),
  },
  green: {
    left: assetUrl('/image/theme_question/forest_left.png'),
    right: assetUrl('/image/theme_question/forest_right.png')
  },
  purple: {
    left: assetUrl('/image/theme_question/pirate.png'),
    right: assetUrl('/image/theme_question/pirate.png')
  },
  orange: {
    left: assetUrl('/image/theme_question/ninja_left.png'),
    right: assetUrl('/image/theme_question/ninja_right.png')
  },
  red: {
    left: assetUrl('/image/theme_question/dino_left.png'),
    right: assetUrl('/image/theme_question/dino_right.png')
  },
  yellow: {
    left: assetUrl('/image/theme_question/desert_left.png'),
    right: assetUrl('/image/theme_question/desert_right.png')
  }
}

const PDFWorksheetExercise = ({ testMode = false, exerciseData = null, onAnswersCollected = null, initialAnswers = null }) => {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = new URLSearchParams(location.search)
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')
  const challengeId = searchParams.get('challengeId') || null
  const isChallenge = searchParams.get('isChallenge') === 'true'

  const { user } = useAuth()
  const { startExercise, completeExerciseWithXP } = useProgress()
  const { playFeedback, showMeme, currentMeme, playCelebration, passGif } = useFeedback()
  const { canCreateContent } = usePermissions()
  const isTeacherView = canCreateContent()

  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [teacherMode, setTeacherMode] = useState('review')
  const [userAnswers, setUserAnswers] = useState(() => (testMode && initialAnswers) ? initialAnswers : {})
  const [fieldFeedback, setFieldFeedback] = useState({})
  const [exerciseComplete, setExerciseComplete] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [challengeStartTime, setChallengeStartTime] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isBatmanMoving, setIsBatmanMoving] = useState(false)
  const [prevProgress, setPrevProgress] = useState(0)
  const [session, setSession] = useState(null)
  const [colorTheme, setColorTheme] = useState('blue')
  const [hasPlayedPassAudio, setHasPlayedPassAudio] = useState(false)
  const [hasEarnedXP, setHasEarnedXP] = useState(false)
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageWidth, setPageWidth] = useState(700)

  const containerRef = useRef(null)
  const pageContainerRef = useRef(null)

  const pdfFile = useMemo(() => exercise?.content?.pdf_url, [exercise?.content?.pdf_url])
  const imageUrls = useMemo(() => exercise?.content?.image_urls || [], [exercise?.content?.image_urls])
  const isImageMode = imageUrls.length > 0
  const onDocumentLoadSuccess = useCallback(({ numPages: n }) => setNumPages(n), [])

  // Set numPages for image mode
  useEffect(() => {
    if (isImageMode) setNumPages(imageUrls.length)
  }, [isImageMode, imageUrls.length])

  // Measure container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth - 8
        setPageWidth(Math.min(w, 900))
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [exercise])

  // Play celebration only on pass
  useEffect(() => {
    if (testMode) return
    if (exerciseComplete && !hasPlayedPassAudio) {
      const allF = exercise?.content?.pages?.flatMap(p => p.fields || []) || []
      const correctF = allF.filter(f => fieldFeedback[f.id]?.correct).length
      const score = allF.length > 0 ? Math.round((correctF / allF.length) * 100) : 0
      if (score >= 80) {
        playCelebration()
        setHasPlayedPassAudio(true)
      }
    }
  }, [exerciseComplete, hasPlayedPassAudio, playCelebration, testMode, fieldFeedback, exercise?.content?.pages])

  // testMode: load from props
  useEffect(() => {
    if (!testMode || !exerciseData) return
    setExercise(exerciseData)
    setLoading(false)
  }, [testMode, exerciseData])

  // testMode: notify parent
  const onAnswersCollectedRef = useRef(onAnswersCollected)
  onAnswersCollectedRef.current = onAnswersCollected
  useEffect(() => {
    if (testMode && onAnswersCollectedRef.current) {
      onAnswersCollectedRef.current(userAnswers)
    }
  }, [userAnswers, testMode])

  // Fetch exercise (standalone)
  useEffect(() => {
    if (testMode) return
    const initExercise = async () => {
      if (exerciseId && user) {
        await fetchExercise()
        setStartTime(Date.now())
        if (isChallenge && challengeId) {
          const { startedAt } = await startExercise(exerciseId)
          setChallengeStartTime(startedAt)
        } else {
          await startExercise(exerciseId)
        }
      }
    }
    initExercise()
  }, [exerciseId, user])

  // Fetch session info
  useEffect(() => {
    if (testMode) return
    const fetchSessionInfo = async () => {
      if (!sessionId) return
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*, units:unit_id (id, title, course_id, color_theme)')
          .eq('id', sessionId)
          .single()
        if (error) throw error
        setSession(data)
        setColorTheme(data?.color_theme || data?.units?.color_theme || 'blue')
      } catch (err) {
        console.error('Error fetching session info:', err)
      }
    }
    fetchSessionInfo()
  }, [sessionId])

  // Progress tracking
  useEffect(() => {
    const allFields = getAllFields()
    const totalFields = allFields.length
    const filledFields = allFields.filter(f => {
      const a = userAnswers[f.id]
      if (f.type === 'checkbox') return a !== undefined
      return a !== undefined && a !== '' && a !== null
    }).length
    const correctFields = allFields.filter(f => fieldFeedback[f.id]?.correct).length

    const currentProgress = isSubmitted
      ? (totalFields > 0 ? (correctFields / totalFields) * 100 : 0)
      : (totalFields > 0 ? (filledFields / totalFields) * 100 : 0)

    if (currentProgress > prevProgress) {
      setIsBatmanMoving(true)
      setTimeout(() => setIsBatmanMoving(false), 3000)
    }
    setPrevProgress(currentProgress)
  }, [userAnswers, fieldFeedback, isSubmitted, exercise])

  const fetchExercise = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'pdf_worksheet')
        .single()
      if (error) throw error
      if (!data) { setError('Exercise not found'); return }
      setExercise(data)
    } catch (err) {
      console.error('Error fetching exercise:', err)
      setError(err.message || 'Failed to load exercise')
    } finally {
      setLoading(false)
    }
  }

  const getAllFields = () => {
    if (!exercise?.content?.pages) return []
    return exercise.content.pages.flatMap(p => p.fields || [])
  }

  const getCurrentPageFields = () => {
    const page = exercise?.content?.pages?.find(p => p.page_number === currentPage)
    return page?.fields || []
  }

  const updateAnswer = (fieldId, value) => {
    if (exerciseComplete || isSubmitted) return
    setUserAnswers(prev => ({ ...prev, [fieldId]: value }))
  }

  const gradeField = (field) => {
    const answer = userAnswers[field.id]
    switch (field.type) {
      case 'text': {
        const typed = (answer || '').trim()
        const correct = (field.correct_answer || '').trim()
        if (!correct) return false
        return field.case_sensitive
          ? typed === correct
          : typed.toLowerCase() === correct.toLowerCase()
      }
      case 'dropdown':
        return answer === field.correct_option
      case 'checkbox': {
        const expected = field.correct_answer === 'true'
        return answer === expected
      }
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (isSubmitted || exerciseComplete) return

    const allFields = getAllFields()
    setIsSubmitted(true)

    const newFeedback = {}
    let correctCount = 0

    allFields.forEach(field => {
      const isCorrect = gradeField(field)
      if (isCorrect) correctCount++
      newFeedback[field.id] = { correct: isCorrect, showFeedback: true }
    })

    setFieldFeedback(newFeedback)

    const scorePercent = Math.round((correctCount / allFields.length) * 100)
    const passed = scorePercent >= 80
    playFeedback(passed)

    setExerciseComplete(true)
    const baseXP = exercise.xp_reward || 10
    const bonusXP = scorePercent >= 95 ? Math.round(baseXP * 0.5) : scorePercent >= 90 ? Math.round(baseXP * 0.3) : 0
    const totalXP = baseXP + bonusXP
    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0

    if (user && !hasEarnedXP && !isTeacherView) {
      const result = await completeExerciseWithXP(exerciseId, totalXP, {
        score: scorePercent,
        max_score: 100,
        time_spent: timeSpent,
        challengeId,
        challengeStartedAt: challengeStartTime
      })
      if (result?.xpAwarded > 0) {
        setXpEarned(result.xpAwarded)
        setHasEarnedXP(true)
      }
    } else {
      setXpEarned(0)
    }
  }

  const resetExercise = () => {
    setUserAnswers({})
    setFieldFeedback({})
    setExerciseComplete(false)
    setXpEarned(0)
    setStartTime(Date.now())
    setIsSubmitted(false)
  }

  const renderField = (field) => {
    const { x, y, width, height } = field.coordinates
    const feedback = fieldFeedback[field.id]
    const isCorrect = feedback?.correct

    let borderColor = 'rgba(156, 163, 175, 0.6)'
    if (isSubmitted && feedback) {
      borderColor = isCorrect ? '#22c55e' : '#ef4444'
    }

    const style = {
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: `${width}%`,
      height: `${height}%`,
      zIndex: 5
    }

    const inputClass = `w-full h-full text-sm rounded transition-colors`

    switch (field.type) {
      case 'text':
        return (
          <input
            key={field.id}
            type="text"
            style={{ ...style, border: `2px solid ${borderColor}`, padding: '0 4px' }}
            className={`${inputClass} bg-white/90 focus:ring-2 focus:ring-blue-400 focus:outline-none`}
            value={userAnswers[field.id] || ''}
            onChange={(e) => updateAnswer(field.id, e.target.value)}
            placeholder={field.label}
            disabled={isSubmitted}
          />
        )
      case 'dropdown':
        return (
          <select
            key={field.id}
            style={{ ...style, border: `2px solid ${borderColor}` }}
            className={`${inputClass} bg-white/90 focus:ring-2 focus:ring-blue-400 focus:outline-none`}
            value={userAnswers[field.id] ?? ''}
            onChange={(e) => updateAnswer(field.id, e.target.value === '' ? '' : parseInt(e.target.value))}
            disabled={isSubmitted}
          >
            <option value="">-- Select --</option>
            {(field.options || []).map((opt, i) => (
              <option key={i} value={i}>{opt}</option>
            ))}
          </select>
        )
      case 'checkbox':
        return (
          <div key={field.id} style={style} className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={userAnswers[field.id] || false}
              onChange={(e) => updateAnswer(field.id, e.target.checked)}
              className="w-5 h-5 rounded"
              style={{ accentColor: isSubmitted ? (isCorrect ? '#22c55e' : '#ef4444') : undefined }}
              disabled={isSubmitted}
            />
          </div>
        )
      default:
        return null
    }
  }

  // Loading / Error states
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
          <Button3D onClick={() => navigate(-1)} color="blue">Go Back</Button3D>
        </div>
      </div>
    )
  }

  if (!exercise || !exercise.content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Content</h2>
          <p className="text-gray-600 mb-4">This exercise has no content available.</p>
          <Button3D onClick={() => navigate(-1)} color="blue">Go Back</Button3D>
        </div>
      </div>
    )
  }

  const allFields = getAllFields()
  const totalFields = allFields.length
  const filledFields = allFields.filter(f => {
    const a = userAnswers[f.id]
    if (f.type === 'checkbox') return a !== undefined
    return a !== undefined && a !== '' && a !== null
  }).length
  const correctFields = allFields.filter(f => fieldFeedback[f.id]?.correct).length
  const progress = isSubmitted
    ? (totalFields > 0 ? (correctFields / totalFields) * 100 : 0)
    : (totalFields > 0 ? (filledFields / totalFields) * 100 : 0)

  // Page navigation component
  const PageNav = () => numPages > 1 ? (
    <div className="flex items-center justify-center gap-1 mb-3">
      {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => {
        const pageFields = exercise.content.pages?.find(p => p.page_number === pageNum)?.fields || []
        const pageFieldCount = pageFields.length
        return (
          <button
            key={pageNum}
            onClick={() => setCurrentPage(pageNum)}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              currentPage === pageNum
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {pageNum}
            {pageFieldCount > 0 && (
              <span className="ml-1 text-xs opacity-70">({pageFieldCount})</span>
            )}
          </button>
        )
      })}
    </div>
  ) : null

  // PDF page with field overlays
  const PDFPageWithFields = () => (
    <div ref={containerRef} className="bg-white rounded-lg shadow-md p-1 sm:p-4 border border-gray-200">
      {PageNav()}
      <div className="relative" ref={pageContainerRef}>
        {isImageMode ? (
          <img src={imageUrls[currentPage - 1]} alt={`Page ${currentPage}`} style={{ width: pageWidth }} className="block" />
        ) : (
          <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        )}
        {getCurrentPageFields().map(renderField)}
      </div>
    </div>
  )

  // Teacher review mode
  if (!testMode && isTeacherView && teacherMode === 'review') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{exercise.title || 'PDF Worksheet'}</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTeacherMode('review')}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-white shadow text-blue-700"
              >
                Review
              </button>
              <button
                onClick={() => { setTeacherMode('do'); resetExercise() }}
                className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 hover:text-gray-800"
              >
                Do
              </button>
            </div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border rounded-lg">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>

        {PDFPageWithFields()}

        {/* Answer key */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-3">Answer Key</h3>
          <div className="space-y-2">
            {allFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-xs">{index + 1}</span>
                <span className="text-sm font-medium text-gray-700">{field.label}:</span>
                <span className="font-medium text-green-800 bg-green-50 px-2 py-1 rounded text-sm">
                  {field.type === 'text' && field.correct_answer}
                  {field.type === 'dropdown' && (field.options?.[field.correct_option] || 'N/A')}
                  {field.type === 'checkbox' && (field.correct_answer === 'true' ? 'Checked' : 'Unchecked')}
                </span>
                <span className="text-xs text-gray-400 capitalize">({field.type})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // testMode rendering
  if (testMode) {
    return (
      <div className="space-y-4">
        {PDFPageWithFields()}
      </div>
    )
  }

  const sideImages = themeSideImages[colorTheme] || themeSideImages.blue

  return (
    <>
      {/* Side decorations */}
      <div className="hidden md:block fixed left-0 bottom-[0%] w-48 lg:w-64 xl:w-80 pointer-events-none z-10">
        <img src={sideImages.left} alt="" className="w-full h-auto object-contain" style={{ maxHeight: '80vh' }} />
      </div>
      <div className="hidden md:block fixed right-0 bottom-[0%] w-48 lg:w-64 xl:w-80 pointer-events-none z-10">
        <img src={sideImages.right} alt="" className="w-full h-auto object-contain" style={{ maxHeight: '80vh' }} />
      </div>

      <div className="relative px-0 sm:px-2 md:pt-2 pb-12">
        <div className="max-w-4xl mx-auto space-y-6 relative z-20">
          {/* Teacher Do Mode Banner */}
          {isTeacherView && teacherMode === 'do' && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <span className="text-sm text-amber-800 font-medium">Teacher Preview — No XP will be awarded</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setTeacherMode('review')} className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 hover:text-gray-800">Review</button>
                <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-white shadow text-blue-700">Do</button>
              </div>
            </div>
          )}

          {/* Header */}
          <ExerciseHeader
            title={exercise.title}
            progressPercentage={progress}
            isBatmanMoving={isBatmanMoving}
            showProgressLabel={false}
            showQuestionCounter={false}
            colorTheme={colorTheme}
          />

          {/* Meme Overlay */}
          {showMeme && currentMeme && (
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <img src={currentMeme} alt="Reaction meme" className="rounded-lg shadow-2xl" style={{ width: '200px', height: 'auto' }} />
            </div>
          )}

          {/* PDF with fields */}
          {PDFPageWithFields()}

          {/* Submit / Reset */}
          {!exerciseComplete && (
            <div className="flex gap-3 justify-center">
              {!isSubmitted && (
                <Button3D
                  onClick={handleSubmit}
                  color="blue"
                  size="md"
                  className="flex items-center gap-2"
                  disabled={filledFields < totalFields}
                >
                  <CheckCircle className="w-4 h-4" />
                  Submit
                </Button3D>
              )}
              <Button3D
                onClick={resetExercise}
                color="gray"
                size="md"
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button3D>
            </div>
          )}

          {isSubmitted && !exerciseComplete && (
            <p className="text-center text-sm text-red-600 font-medium">
              Some answers are incorrect. Click Reset to try again.
            </p>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {exerciseComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <CelebrationScreen
            score={Math.round((correctFields / totalFields) * 100)}
            correctAnswers={correctFields}
            totalQuestions={totalFields}
            passThreshold={80}
            xpAwarded={xpEarned}
            passGif={passGif}
            isRetryMode={false}
            wrongQuestionsCount={totalFields - correctFields}
            onBackToList={() => {
              const courseId = session?.units?.course_id
              const unitId = session?.unit_id
              if (sessionId && unitId && courseId) {
                navigate(`/study/course/${courseId}/unit/${unitId}/session/${sessionId}`)
              } else {
                navigate(-1)
              }
            }}
            exerciseId={exerciseId}
          />
        </div>
      )}
    </>
  )
}

export default PDFWorksheetExercise
