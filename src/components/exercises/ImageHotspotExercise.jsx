import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import Button3D from '../ui/Button3D'
import AudioPlayer from '../ui/AudioPlayer'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { useFeedback } from '../../hooks/useFeedback'
import ExerciseHeader from './ExerciseHeader'

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

const ImageHotspotExercise = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = new URLSearchParams(location.search)
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')

  const { user } = useAuth()
  const { startExercise, completeExerciseWithXP } = useProgress()
  const { playFeedback, showMeme, currentMeme } = useFeedback()

  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedLabel, setSelectedLabel] = useState(null)
  const [userAnswers, setUserAnswers] = useState({}) // { hotspot_id: label_id }
  const [hotspotFeedback, setHotspotFeedback] = useState({}) // { hotspot_id: { correct, attempts, showFeedback } }
  const [shuffledLabels, setShuffledLabels] = useState([])
  const [exerciseComplete, setExerciseComplete] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [imageScale, setImageScale] = useState(1)
  const [isBatmanMoving, setIsBatmanMoving] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [prevProgress, setPrevProgress] = useState(0)
  const [session, setSession] = useState(null)
  const [colorTheme, setColorTheme] = useState('blue')

  const imageRef = useRef(null)
  const containerRef = useRef(null)

  // Extract media elements from question HTML
  const extractMediaFromQuestion = (questionHtml) => {
    if (!questionHtml) return { textOnly: '', imageHtml: '', audioUrls: [] }

    const parser = new DOMParser()
    const doc = parser.parseFromString(questionHtml, 'text/html')

    // Find all img elements
    const imgElements = doc.querySelectorAll('img')
    let imageHtml = ''
    imgElements.forEach(el => {
      imageHtml += el.outerHTML
      el.remove()
    })

    // Find all audio elements and extract src
    const audioElements = doc.querySelectorAll('audio')
    const audioUrls = []
    audioElements.forEach(el => {
      const src = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src')
      if (src) {
        audioUrls.push(src)
      }
      el.remove()
    })

    // Get remaining text content
    const textOnly = doc.body.innerHTML.trim()

    return { textOnly, imageHtml, audioUrls }
  }

  const { textOnly: questionText, imageHtml: questionImages, audioUrls: questionAudio } = exercise
    ? extractMediaFromQuestion(exercise.content.question)
    : { textOnly: '', imageHtml: '', audioUrls: [] }

  // Fetch exercise
  useEffect(() => {
    if (exerciseId && user) {
      fetchExercise()
      startExercise(exerciseId)
      setStartTime(Date.now())
    }
  }, [exerciseId, user])

  useEffect(() => {
    const fetchSessionInfo = async () => {
      if (!sessionId) return

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

    fetchSessionInfo()
  }, [sessionId])

  // Calculate responsive scale
  useEffect(() => {
    if (imageRef.current && containerRef.current) {
      const updateScale = () => {
        if (imageRef.current.complete && imageRef.current.naturalWidth > 0) {
          const containerWidth = containerRef.current.clientWidth
          const naturalWidth = imageRef.current.naturalWidth
          const scale = containerWidth / naturalWidth
          setImageScale(scale)
        }
      }

      imageRef.current.addEventListener('load', updateScale)
      window.addEventListener('resize', updateScale)
      updateScale()

      return () => {
        window.removeEventListener('resize', updateScale)
      }
    }
  }, [exercise])

  // Shuffle labels on load
  useEffect(() => {
    if (exercise?.content?.labels) {
      const labels = exercise.content.labels
      if (exercise.content.settings?.shuffle_labels !== false) {
        const shuffled = [...labels].sort(() => Math.random() - 0.5)
        setShuffledLabels(shuffled)
      } else {
        setShuffledLabels(labels)
      }
    }
  }, [exercise])

  // Trigger Batman movement when progress increases
  useEffect(() => {
    const totalHotspots = exercise?.content?.hotspots?.length || 0
    const filledHotspots = Object.keys(userAnswers).length
    const completedHotspots = Object.keys(userAnswers).filter(
      hsId => hotspotFeedback[hsId]?.correct
    ).length

    const currentProgress = isSubmitted
      ? (totalHotspots > 0 ? (completedHotspots / totalHotspots) * 100 : 0)
      : (totalHotspots > 0 ? (filledHotspots / totalHotspots) * 100 : 0)

    if (currentProgress > prevProgress) {
      setIsBatmanMoving(true)
      setTimeout(() => setIsBatmanMoving(false), 3000)
    }

    setPrevProgress(currentProgress)
  }, [userAnswers, hotspotFeedback, isSubmitted, exercise, prevProgress])

  const fetchExercise = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'image_hotspot')
        .single()

      if (error) throw error

      if (!data) {
        setError('Exercise not found')
        return
      }

      setExercise(data)
    } catch (err) {
      console.error('Error fetching exercise:', err)
      setError(err.message || 'Failed to load exercise')
    } finally {
      setLoading(false)
    }
  }

  const handleLabelClick = (label) => {
    if (exerciseComplete) return

    // Check if this label is already placed
    const hotspotId = Object.keys(userAnswers).find(hsId => userAnswers[hsId] === label.id)

    if (hotspotId) {
      // Remove from hotspot (undo placement)
      const newAnswers = { ...userAnswers }
      delete newAnswers[hotspotId]
      setUserAnswers(newAnswers)

      // Clear feedback for that hotspot
      const newFeedback = { ...hotspotFeedback }
      delete newFeedback[hotspotId]
      setHotspotFeedback(newFeedback)

      setSelectedLabel(null)
      return
    }

    // Toggle selection (including distractors)
    setSelectedLabel(selectedLabel?.id === label.id ? null : label)
  }

  const handleHotspotClick = (hotspot) => {
    if (exerciseComplete || isSubmitted) return

    if (!selectedLabel) {
      // No label selected - maybe show hint or do nothing
      return
    }

    // Play whoosh sound
    try {
      const audio = new Audio('https://xpclass.vn/xpclass/sound/pop.mp3')
      audio.volume = 0.5
      audio.play().catch(e => console.log('Could not play sound:', e))
    } catch (e) {
      console.log('Sound not supported:', e)
    }

    // Update answers
    const newAnswers = { ...userAnswers, [hotspot.id]: selectedLabel.id }
    setUserAnswers(newAnswers)

    // Clear selection
    setSelectedLabel(null)
  }

  const handleSubmit = async () => {
    if (isSubmitted || exerciseComplete) return

    const hotspots = exercise.content.hotspots

    // Check if all hotspots are filled
    const allFilled = hotspots.every(hs => userAnswers[hs.id])
    if (!allFilled) {
      alert('Please fill all hotspots before submitting!')
      return
    }

    setIsSubmitted(true)

    // Grade all answers
    const newFeedback = {}
    let correctCount = 0
    let totalAttempts = 0

    hotspots.forEach(hotspot => {
      const selectedLabelId = userAnswers[hotspot.id]
      const selectedLabel = exercise.content.labels.find(l => l.id === selectedLabelId)
      const isDistractor = selectedLabel?.type === 'distractor'
      const isCorrect = !isDistractor && selectedLabel?.hotspot_id === hotspot.id

      if (isCorrect) correctCount++
      totalAttempts++

      newFeedback[hotspot.id] = {
        correct: isCorrect,
        attempts: 1,
        showFeedback: true
      }
    })

    setHotspotFeedback(newFeedback)

    // Play feedback
    const allCorrect = correctCount === hotspots.length
    playFeedback(allCorrect)

    if (allCorrect) {
      setExerciseComplete(true)

      // Calculate XP
      const baseXP = exercise.xp_reward || 10
      const earnedXP = Math.round(baseXP)

      setXpEarned(earnedXP)

      // Complete exercise
      const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0

      if (user) {
        await completeExerciseWithXP(exerciseId, earnedXP, {
          score: 100,
          max_score: 100,
          attempts: totalAttempts,
          time_spent: timeSpent
        })
      }
    }
  }

  const resetExercise = () => {
    setUserAnswers({})
    setHotspotFeedback({})
    setSelectedLabel(null)
    setExerciseComplete(false)
    setXpEarned(0)
    setStartTime(Date.now())
    setIsSubmitted(false)

    // Re-shuffle labels if needed
    if (exercise?.content?.labels && exercise.content.settings?.shuffle_labels !== false) {
      const shuffled = [...exercise.content.labels].sort(() => Math.random() - 0.5)
      setShuffledLabels(shuffled)
    }
  }

  const renderHotspots = () => {
    if (!exercise?.content?.hotspots) return null

    return exercise.content.hotspots.map(hotspot => {
      const { x, y, width, height } = hotspot.coordinates
      const scaledX = x * imageScale
      const scaledY = y * imageScale
      const scaledWidth = width * imageScale
      const scaledHeight = height * imageScale

      const answer = userAnswers[hotspot.id]
      const feedback = hotspotFeedback[hotspot.id]
      const isAnswered = !!answer
      const isCorrect = feedback?.correct

      let fillColor = 'rgba(243, 242, 242, 0.1)'
      let strokeColor = '#1522368f'
      let strokeWidth = 2

      if (selectedLabel && !isSubmitted) {
        fillColor = 'rgba(59, 130, 246, 0.15)'
        strokeColor = '#3b82f6'
      }

      if (isAnswered && !isSubmitted) {
        fillColor = 'rgba(13, 81, 197, 0.47)'
        strokeColor = '#0e59f0ff'
        strokeWidth = 2
      }

      if (isSubmitted && isAnswered && isCorrect) {
        fillColor = 'rgba(34, 197, 94, 0.2)'
        strokeColor = '#22c55e'
        strokeWidth = 3
      } else if (isSubmitted && isAnswered && !isCorrect) {
        fillColor = 'rgba(239, 68, 68, 0.2)'
        strokeColor = '#ef4444'
        strokeWidth = 3
      }

      return (
        <g key={hotspot.id}>
          <rect
            x={scaledX}
            y={scaledY}
            width={scaledWidth}
            height={scaledHeight}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            onClick={() => handleHotspotClick(hotspot)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            style={{ pointerEvents: 'all' }}
          />

          {/* Label text if answered */}
          {isAnswered && (
            <text
              x={scaledX + scaledWidth / 2}
              y={scaledY + scaledHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="14"
              fontWeight="bold"
              className="pointer-events-none select-none"
              style={{ textShadow: '0 0 3px rgba(0,0,0,0.8)' }}
            >
              {shuffledLabels.find(l => l.id === answer)?.text}
            </text>
          )}

          {/* Feedback icon */}
          {isSubmitted && feedback?.showFeedback && (
            <g>
              <circle
                cx={scaledX + scaledWidth - 15}
                cy={scaledY + 15}
                r="12"
                fill={isCorrect ? '#22c55e' : '#ef4444'}
              />
              <text
                x={scaledX + scaledWidth - 15}
                y={scaledY + 15}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="16"
                fontWeight="bold"
              >
                {isCorrect ? '✓' : '✗'}
              </text>
            </g>
          )}
        </g>
      )
    })
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
          <Button3D onClick={() => navigate(-1)} color="blue">
            Go Back
          </Button3D>
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
          <Button3D onClick={() => navigate(-1)} color="blue">
            Go Back
          </Button3D>
        </div>
      </div>
    )
  }

  const totalHotspots = exercise.content.hotspots?.length || 0
  const filledHotspots = Object.keys(userAnswers).length
  const completedHotspots = Object.keys(userAnswers).filter(
    hsId => hotspotFeedback[hsId]?.correct
  ).length
  const progress = isSubmitted
    ? (totalHotspots > 0 ? (completedHotspots / totalHotspots) * 100 : 0)
    : (totalHotspots > 0 ? (filledHotspots / totalHotspots) * 100 : 0)

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

      <div className="relative px-2 md:pt-2 pb-12">
        <div className="max-w-6xl mx-auto space-y-6 relative z-20">
        {/* Header */}
        <ExerciseHeader
          title={exercise.title}
          progressPercentage={progress}
          isBatmanMoving={isBatmanMoving}
          showProgressLabel={false}
          showQuestionCounter={false}
          customContent={
            questionText && (
              <div
                className="text-sm text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: questionText }}
              />
            )
          }
        />

        {/* Meme Overlay */}
        {showMeme && currentMeme && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <img
              src={currentMeme}
              alt="Reaction meme"
              className="rounded-lg shadow-2xl"
              style={{ width: '200px', height: 'auto' }}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Image with hotspots */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 space-y-4">
              {/* Question Images from question HTML */}
              {questionImages && (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: questionImages }}
                />
              )}

              {/* Question Audio using AudioPlayer component */}
              {questionAudio && questionAudio.length > 0 && (
                <div className="space-y-2">
                  {questionAudio.map((audioUrl, index) => (
                    <AudioPlayer
                      key={index}
                      audioUrl={audioUrl}
                      variant="outline"
                      className="w-full"
                    />
                  ))}
                </div>
              )}

              <div ref={containerRef} className="relative">
                <img
                  ref={imageRef}
                  src={exercise.content.image_url.replace('https://xpclass.vn', '/proxy-image')}
                  alt="Exercise"
                  className="w-full h-auto rounded"
                />
                <svg
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                >
                  <g style={{ pointerEvents: 'all' }}>
                    {renderHotspots()}
                  </g>
                </svg>
              </div>
              {selectedLabel && !isSubmitted && (
                <p className="mt-4 text-sm text-blue-600 font-medium text-center">
                  Click on the image to place "{selectedLabel.text}"
                </p>
              )}
              {isSubmitted && !exerciseComplete && (
                <p className="mt-4 text-sm text-red-600 font-medium text-center">
                  Some answers are incorrect. Click Reset to try again.
                </p>
              )}
            </div>
          </div>

          {/* Labels sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <h2 className="text-lg font-semibold mb-4">
                {selectedLabel ? `Selected: ${selectedLabel.text}` : 'Select a label'}
              </h2>
              <div className="grid grid-cols-4 lg:grid-cols-1 gap-2">
                {shuffledLabels.map(label => {
                  const isUsed = Object.values(userAnswers).includes(label.id)
                  const isSelected = selectedLabel?.id === label.id
                  const isDistractor = label.type === 'distractor'

                  return (
                    <button
                      key={label.id}
                      onClick={() => handleLabelClick(label)}
                      disabled={exerciseComplete}
                      className={`
                        w-full px-4 py-3 rounded-lg font-medium transition-all
                        ${isSelected ? 'bg-blue-500 text-white scale-105 shadow-lg' : ''}
                        ${isUsed && !isSelected ? 'bg-green-100 text-green-800 opacity-50' : ''}
                        ${
                          !isSelected && !isUsed && !isDistractor
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                            : ''
                        }
                        ${isDistractor && !isSelected && !isUsed ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' : ''}
                        ${!exerciseComplete ? 'cursor-pointer' : ''}
                      `}
                    >
                      {label.text}
                      {isUsed && !isSelected}
                    </button>
                  )
                })}
              </div>

              {/* Submit and Reset Buttons */}
              <div className="mt-4 flex gap-3">
                {!isSubmitted && (
                  <Button3D
                    onClick={handleSubmit}
                    color="blue"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2"
                    disabled={Object.keys(userAnswers).length !== (exercise.content.hotspots?.length || 0)}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Submit
                  </Button3D>
                )}
                <Button3D
                  onClick={resetExercise}
                  color="gray"
                  size="sm"
                  className={`${isSubmitted ? 'w-full' : 'flex-1'} flex items-center justify-center gap-2`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button3D>
              </div>
            </div>
          </div>
        </div>

        {/* Completion Modal */}
        {exerciseComplete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-green-600 mb-2">Excellent Work!</h2>
                <p className="text-gray-700 mb-4">
                  You've successfully completed all hotspots!
                </p>
                {xpEarned > 0 && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-xl font-bold text-blue-600">+{xpEarned} XP</p>
                  </div>
                )}
                {exercise.content.explanation && (
                  <p className="text-sm text-gray-600 mb-6 p-3 bg-gray-50 rounded">
                    {exercise.content.explanation}
                  </p>
                )}
                <Button3D onClick={() => navigate(`/study?sessionId=${sessionId}`)} color="blue" className="w-full">
                  Continue
                </Button3D>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  )
}

export default ImageHotspotExercise
