import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { ArrowLeft, RotateCcw, CheckCircle, XCircle, Play, Pause } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'

const DragDropExercise = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Get exerciseId and sessionId from URL search params
  const searchParams = new URLSearchParams(location.search)
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [isCorrect, setIsCorrect] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [draggedItem, setDraggedItem] = useState(null)
  const [dropZones, setDropZones] = useState({})
  const [randomizedItems, setRandomizedItems] = useState([])
  const [touchStartPos, setTouchStartPos] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [exerciseCompleted, setExerciseCompleted] = useState(false)
  const [questionsChecked, setQuestionsChecked] = useState({})
  const { user } = useAuth()

  useEffect(() => {
    fetchExercise()
  }, [exerciseId])

  // Randomize items when exercise or question changes
  useEffect(() => {
    if (exercise && exercise.content.questions && exercise.content.questions.length > 0) {
      const currentQuestion = exercise.content.questions[currentQuestionIndex]
      if (currentQuestion && currentQuestion.items) {
        // Create a shuffled copy of items
        const shuffled = [...currentQuestion.items].sort(() => Math.random() - 0.5)
        setRandomizedItems(shuffled)
      }
    }
  }, [exercise, currentQuestionIndex])

  const fetchExercise = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .eq('exercise_type', 'drag_drop')
        .single()

      if (error) throw error

      if (!data) {
        setError('Exercise not found')
        return
      }

      setExercise(data)
      
      // Initialize user answers
      const initialAnswers = {}
      if (data.content.questions) {
        data.content.questions.forEach((question, index) => {
          initialAnswers[index] = {}
        })
      }
      setUserAnswers(initialAnswers)
    } catch (err) {
      console.error('Error fetching exercise:', err)
      setError(err.message || 'Failed to load exercise')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e, itemId, questionIndex) => {
    setDraggedItem({ itemId, questionIndex })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, zoneId, questionIndex) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem.questionIndex !== questionIndex) return

    const newAnswers = { ...userAnswers }
    if (!newAnswers[questionIndex]) {
      newAnswers[questionIndex] = {}
    }
    
    // Remove item from previous zone if exists
    Object.keys(newAnswers[questionIndex]).forEach(zone => {
      if (newAnswers[questionIndex][zone] === draggedItem.itemId) {
        delete newAnswers[questionIndex][zone]
      }
    })
    
    // Add item to new zone
    newAnswers[questionIndex][zoneId] = draggedItem.itemId
    setUserAnswers(newAnswers)
    setDraggedItem(null)
  }

  // Touch event handlers for mobile
  const handleTouchStart = (e, itemId, questionIndex) => {
    e.preventDefault()
    const touch = e.touches[0]
    setTouchStartPos({ x: touch.clientX, y: touch.clientY })
    setDraggedItem({ itemId, questionIndex })
    setIsDragging(true)
  }

  const handleTouchMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
  }

  const handleTouchEnd = (e) => {
    if (!isDragging || !draggedItem) return
    
    const touch = e.changedTouches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    
    if (element && element.dataset.zoneId) {
      const zoneId = element.dataset.zoneId
      const questionIndex = parseInt(element.dataset.questionIndex)
      
      if (draggedItem.questionIndex === questionIndex) {
        const newAnswers = { ...userAnswers }
        if (!newAnswers[questionIndex]) {
          newAnswers[questionIndex] = {}
        }
        
        // Remove item from previous zone if exists
        Object.keys(newAnswers[questionIndex]).forEach(zone => {
          if (newAnswers[questionIndex][zone] === draggedItem.itemId) {
            delete newAnswers[questionIndex][zone]
          }
        })
        
        // Add item to new zone
        newAnswers[questionIndex][zoneId] = draggedItem.itemId
        setUserAnswers(newAnswers)
      }
    }
    
    setDraggedItem(null)
    setIsDragging(false)
    setTouchStartPos(null)
  }

  // Handle click on item - automatically place in next available zone
  const handleItemClick = (itemId, questionIndex) => {
    const userAnswer = userAnswers[questionIndex] || {}
    const question = exercise.content.questions[questionIndex]
    
    // Check if item is already placed
    const isAlreadyPlaced = Object.values(userAnswer).includes(itemId)
    
    if (isAlreadyPlaced) {
      // If already placed, remove it from current zone
      const newAnswers = { ...userAnswers }
      if (!newAnswers[questionIndex]) {
        newAnswers[questionIndex] = {}
      }
      
      // Find and remove from current zone
      Object.keys(newAnswers[questionIndex]).forEach(zone => {
        if (newAnswers[questionIndex][zone] === itemId) {
          delete newAnswers[questionIndex][zone]
        }
      })
      setUserAnswers(newAnswers)
    } else {
      // Find next available drop zone
      const availableZone = question.drop_zones.find(zone => !userAnswer[zone.id])
      
      if (availableZone) {
        // Place item in next available zone
        const newAnswers = { ...userAnswers }
        if (!newAnswers[questionIndex]) {
          newAnswers[questionIndex] = {}
        }
        
        newAnswers[questionIndex][availableZone.id] = itemId
        setUserAnswers(newAnswers)
      }
    }
  }

  // Handle click on drop zone - return item to list
  const handleDropZoneClick = (zoneId, questionIndex) => {
    const userAnswer = userAnswers[questionIndex] || {}
    const itemId = userAnswer[zoneId]
    
    if (itemId) {
      // Return item to list
      const newAnswers = { ...userAnswers }
      if (!newAnswers[questionIndex]) {
        newAnswers[questionIndex] = {}
      }
      
      // Remove item from zone
      delete newAnswers[questionIndex][zoneId]
      setUserAnswers(newAnswers)
    }
  }

  const checkAnswer = async (questionIndex) => {
    const question = exercise.content.questions[questionIndex]
    const userAnswer = userAnswers[questionIndex] || {}
    
    // Convert user answer to array in correct order
    const userOrder = question.drop_zones.map(zone => userAnswer[zone.id] || null)
    const correctOrder = question.correct_order
    
    const isAnswerCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder)
    setIsCorrect(isAnswerCorrect)
    setShowResult(true)
    
    // Mark question as checked
    setQuestionsChecked(prev => ({
      ...prev,
      [questionIndex]: true
    }))
    
    // Save progress if answer is correct
    if (isAnswerCorrect && user) {
      await saveProgress(questionIndex, true)
    }
    
    return isAnswerCorrect
  }

  const saveProgress = async (questionIndex, isCorrect) => {
    if (!user || !exercise) return

    try {
      const xpReward = exercise.xp_reward || 10
      
      // Check if all questions are completed
      const allQuestionsCompleted = exercise.content.questions.every((_, index) => {
        const userAnswer = userAnswers[index] || {}
        const question = exercise.content.questions[index]
        const userOrder = question.drop_zones.map(zone => userAnswer[zone.id] || null)
        const correctOrder = question.correct_order
        return JSON.stringify(userOrder) === JSON.stringify(correctOrder)
      })

      // Save exercise progress (not individual questions)
      const { error } = await supabase.from('user_progress').upsert({
        user_id: user.id,
        exercise_id: exercise.id,
        question_index: questionIndex,
        status: allQuestionsCompleted ? 'completed' : 'in_progress',
        completed_at: allQuestionsCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        xp_earned: allQuestionsCompleted ? (xpReward * exercise.content.questions.length) : 0
      }, {
        onConflict: 'user_id,exercise_id'
      })

      if (error) {
        console.error('Error saving progress:', error)
        // Try to update existing record instead
        const { error: updateError } = await supabase
          .from('user_progress')
          .update({
            question_index: questionIndex,
            status: allQuestionsCompleted ? 'completed' : 'in_progress',
            completed_at: allQuestionsCompleted ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
            xp_earned: allQuestionsCompleted ? (xpReward * exercise.content.questions.length) : 0
          })
          .eq('user_id', user.id)
          .eq('exercise_id', exercise.id)

        if (updateError) {
          console.error('Error updating progress:', updateError)
        }
      }

      if (allQuestionsCompleted) {
        setExerciseCompleted(true)
      }
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  const resetQuestion = (questionIndex) => {
    const newAnswers = { ...userAnswers }
    newAnswers[questionIndex] = {}
    setUserAnswers(newAnswers)
    setIsCorrect(null)
    setShowResult(false)
    
    // Reset checked status
    setQuestionsChecked(prev => ({
      ...prev,
      [questionIndex]: false
    }))
    
    // Re-randomize items
    if (exercise && exercise.content.questions && exercise.content.questions[questionIndex]) {
      const question = exercise.content.questions[questionIndex]
      if (question && question.items) {
        const shuffled = [...question.items].sort(() => Math.random() - 0.5)
        setRandomizedItems(shuffled)
      }
    }
  }

  const nextQuestion = () => {
    if (currentQuestionIndex < exercise.content.questions.length - 1) {
      // Check if current question has been checked
      if (!questionsChecked[currentQuestionIndex]) {
        alert('Please check your answer before moving to the next question.')
        return
      }
      
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setIsCorrect(null)
      setShowResult(false)
    }
  }

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      setIsCorrect(null)
      setShowResult(false)
    }
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
  const userAnswer = userAnswers[currentQuestionIndex] || {}

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
        <div className="bg-white rounded-lg shadow-sm p-6" style={{ userSelect: 'none' }}>
          {/* Question with inline drop zones */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {currentQuestion.question.split(/\[DROP_ZONE_(\w+)\]/).map((part, index) => {
                if (index % 2 === 0) {
                  return <span key={index}>{part}</span>
                } else {
                  const zoneId = part
                  const zone = currentQuestion.drop_zones.find(z => z.id === zoneId)
                  const itemId = userAnswer[zoneId]
                  const item = currentQuestion.items.find(i => i.id === itemId)
                  
                  return (
                    <span
                      key={index}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, zoneId, currentQuestionIndex)}
                      onTouchEnd={handleTouchEnd}
                      onClick={() => handleDropZoneClick(zoneId, currentQuestionIndex)}
                      data-zone-id={zoneId}
                      data-question-index={currentQuestionIndex}
                      className={`inline-block min-w-[80px] h-10 mx-2 border-2 rounded-lg text-center leading-10 transition-all cursor-pointer ${
                        itemId
                          ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                          : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      {item ? item.text : ''}
                    </span>
                  )
                }
              })}
            </h2>
          </div>

          {/* Drag Items */}
          <div className="mb-8">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-700">Items to drag:</h3>
              <p className="text-sm text-gray-500 mt-1">
                Click items in order - they'll automatically go to the next available drop zone. Or drag and drop.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {randomizedItems.map((item) => {
                const isUsed = Object.values(userAnswer).includes(item.id)
                return (
                  <div
                    key={item.id}
                    draggable={!isUsed}
                    onDragStart={(e) => handleDragStart(e, item.id, currentQuestionIndex)}
                    onTouchStart={(e) => handleTouchStart(e, item.id, currentQuestionIndex)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => handleItemClick(item.id, currentQuestionIndex)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all select-none ${
                      isUsed
                        ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-50 border-blue-300 text-blue-700 cursor-pointer hover:bg-blue-100 active:bg-blue-200'
                    }`}
                  >
                    {item.text}
                  </div>
                )
              })}
            </div>
          </div>


          {/* Result */}
          {showResult && (
            <div className={`mb-6 p-4 rounded-lg ${
              isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-medium ${
                  isCorrect ? 'text-green-800' : 'text-red-800'
                }`}>
                  {isCorrect ? 'Correct!' : 'Incorrect. Try again.'}
                </span>
              </div>
              {currentQuestion.explanation && (
                <p className={`text-sm ${
                  isCorrect ? 'text-green-700' : 'text-red-700'
                }`}>
                  {currentQuestion.explanation}
                </p>
              )}
            </div>
          )}

          {/* Exercise Completed */}
          {exerciseCompleted && (
            <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-800 mb-2">
                  🎉 Exercise Completed!
                </h3>
                <p className="text-green-700 mb-4">
                  Great job! You've successfully completed all questions.
                </p>
                <div className="text-sm text-green-600">
                  XP Earned: {exercise?.xp_reward * exercise?.content?.questions?.length || 0}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => checkAnswer(currentQuestionIndex)}
              className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${
                questionsChecked[currentQuestionIndex]
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {questionsChecked[currentQuestionIndex] ? 'Answer Checked ✓' : 'Check Answer'}
            </button>
            
            <button
              onClick={() => resetQuestion(currentQuestionIndex)}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>

            {currentQuestionIndex > 0 && (
              <button
                onClick={prevQuestion}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Previous
              </button>
            )}

            {currentQuestionIndex < exercise.content.questions.length - 1 && (
              <button
                onClick={nextQuestion}
                disabled={!questionsChecked[currentQuestionIndex]}
                className={`px-6 py-2 rounded-lg transition-all ${
                  questionsChecked[currentQuestionIndex]
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={!questionsChecked[currentQuestionIndex] ? 'Please check your answer first' : ''}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DragDropExercise
