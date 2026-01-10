import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import Button3D from '../ui/Button3D'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { useFeedback } from '../../hooks/useFeedback'

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

  const imageRef = useRef(null)
  const containerRef = useRef(null)

  // Fetch exercise
  useEffect(() => {
    if (exerciseId && user) {
      fetchExercise()
      startExercise(exerciseId)
      setStartTime(Date.now())
    }
  }, [exerciseId, user])

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
      const audio = new Audio('https://xpclass.vn/xpclass/sound/whoosh_transition.mp3')
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

      let fillColor = 'rgba(104, 72, 72, 0.1)'
      let strokeColor = '#152236ff'
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

  return (
    <div className="px-2 md:pt-2 pb-12">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-5 border border-gray-200">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-500 truncate mb-1">
                {exercise.title}
              </p>
              {exercise.content.question && (
                <p className="text-sm text-gray-700">
                  {exercise.content.question}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-visible">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
              {/* Running Batman Animation */}
              <img
                src={
                  isBatmanMoving
                    ? 'https://xpclass.vn/LMS_enhance/gif/Left%20running/batman.gif'
                    : 'https://xpclass.vn/xpclass/materials/batman_standing.gif'
                }
                alt="Progress Batman"
                className="absolute -top-8 h-12 transition-all duration-1000"
                style={{
                  left: `calc(${progress}% - 24px)`,
                  zIndex: 10
                }}
              />
            </div>
          </div>
        </div>

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
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
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
  )
}

export default ImageHotspotExercise
