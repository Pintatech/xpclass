import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { ArrowLeft, RotateCcw, CheckCircle, XCircle, Play, Pause } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'

// Convert simple markdown/HTML to safe HTML for preview
const markdownToHtml = (text) => {
  if (!text) return ''
  let html = text
  // Images markdown ![](url)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (m, alt, url) => `<img src="${url}" alt="${alt || ''}" class="max-w-full h-auto rounded-lg my-2" />`)
  // Preserve HTML <img> adding styling
  html = html.replace(/<img([^>]*?)>/g, (m, attrs) => `<img${attrs} class="max-w-full h-auto rounded-lg my-2" />`)
  // Preserve HTML <audio>
  html = html.replace(/<audio([^>]*?)>/g, (m, attrs) => `<audio${attrs} class="w-full my-2"></audio>`)
  // Links [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, (m, t, url) => `<a href="${url}" target="_blank" rel="noreferrer">${t || url}</a>`)
  return html
}

// Render question text with HTML content and drop zones
const renderQuestionWithDropZones = (questionText, dropZones, renderDropZone) => {
  const parts = questionText.split(/\[DROP_ZONE_(\w+)\]/)
  return parts.map((part, index) => {
    if (index % 2 === 0) {
      // This is regular text - render with HTML support
      const htmlContent = markdownToHtml(part)
      return (
        <span
          key={index}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )
    } else {
      // This is a drop zone ID
      const zoneId = part
      return renderDropZone(zoneId, index)
    }
  })
}

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
  const [xpEarnedThisSession, setXpEarnedThisSession] = useState(0)
  const [questionsChecked, setQuestionsChecked] = useState({})
  const [attempts, setAttempts] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [timeSpent, setTimeSpent] = useState(0)
  const [itemFeedback, setItemFeedback] = useState({}) // Track correct/incorrect for each item
  const [isBatmanMoving, setIsBatmanMoving] = useState(false)
  const [currentMeme, setCurrentMeme] = useState('')
  const [showMeme, setShowMeme] = useState(false)
  const [animatingItems, setAnimatingItems] = useState({}) // Track items being animated
  const { user } = useAuth()
  const { completeExerciseWithXP } = useProgress()

  // Meme arrays
  const correctMemes = [
    'https://xpclass.vn/leaderboard/correct_image/plus12.png',
    'https://xpclass.vn/leaderboard/correct_image/plus13.png',
    'https://xpclass.vn/leaderboard/correct_image/plus14.png',
    'https://xpclass.vn/leaderboard/correct_image/plus32.png',
    'https://xpclass.vn/leaderboard/correct_image/plus34.png',
    'https://xpclass.vn/leaderboard/correct_image/drake%20yes.jpg',
    'https://xpclass.vn/leaderboard/correct_image/tapping%20head.jpg'
  ]

  const wrongMemes = [
    'https://xpclass.vn/leaderboard/wrong_image/Black-Girl-Wat.png',
    'https://xpclass.vn/leaderboard/wrong_image/drake.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/leo%20laugh.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/nick%20young.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/tom.jpg',
    'https://xpclass.vn/leaderboard/wrong_image/you-guys-are-getting-paid.jpg'
  ]

  // Sound URLs
  const correctSounds = [
    'https://xpclass.vn/leaderboard/sound/lingo.mp3',
  ]

  const wrongSounds = [
    'https://xpclass.vn/leaderboard/sound/Bruh.mp3'
  ]

  // Function to play sound and show meme
  const playFeedback = (isCorrect) => {
    // Select random meme
    const memes = isCorrect ? correctMemes : wrongMemes
    const randomMeme = memes[Math.floor(Math.random() * memes.length)]

    // Select random sound
    const sounds = isCorrect ? correctSounds : wrongSounds
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)]

    // Show meme
    setCurrentMeme(randomMeme)
    setShowMeme(true)

    // Play sound
    try {
      const audio = new Audio(randomSound)
      audio.volume = 0.5
      audio.play().catch(e => console.log('Could not play sound:', e))
    } catch (e) {
      console.log('Sound not supported:', e)
    }

    // Hide meme after 2 seconds
    setTimeout(() => {
      setShowMeme(false)
    }, 2000)
  }

  useEffect(() => {
    fetchExercise()
  }, [exerciseId])

  // Start time tracking when exercise loads
  useEffect(() => {
    if (exercise && !startTime) {
      setStartTime(Date.now())
    }
  }, [exercise, startTime])

  // Randomize items when question changes
  useEffect(() => {
    if (exercise && exercise.content.questions && exercise.content.questions.length > 0) {
      const currentQuestion = exercise.content.questions[currentQuestionIndex]
      if (currentQuestion && currentQuestion.items) {
        // Create a shuffled copy of items
        const shuffled = [...currentQuestion.items].sort(() => Math.random() - 0.5)
        setRandomizedItems(shuffled)
      }
    }
  }, [exercise?.id, currentQuestionIndex])

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
      // If already placed, remove it from current zone (instant, no animation)
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
        // Play whoosh sound
        try {
          const audio = new Audio('https://xpclass.vn/xpclass/sound/whoosh_transition.mp3')
          audio.volume = 0.5
          audio.play().catch(e => console.log('Could not play sound:', e))
        } catch (e) {
          console.log('Sound not supported:', e)
        }

        // Get positions for animation
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`)
        const zoneElement = document.querySelector(`[data-zone-id="${availableZone.id}"]`)

        if (itemElement && zoneElement) {
          const itemRect = itemElement.getBoundingClientRect()
          const zoneRect = zoneElement.getBoundingClientRect()

          // Create flying clone
          const clone = itemElement.cloneNode(true)
          clone.style.position = 'fixed'
          clone.style.left = `${itemRect.left}px`
          clone.style.top = `${itemRect.top}px`
          clone.style.width = `${itemRect.width}px`
          clone.style.height = `${itemRect.height}px`
          clone.style.margin = '0'
          clone.style.zIndex = '1000'
          clone.style.pointerEvents = 'none'
          clone.style.transition = 'none'
          clone.style.willChange = 'transform, left, top'
          document.body.appendChild(clone)

          // Force reflow to ensure element is rendered
          clone.offsetHeight

          // Add transition after element is rendered
          clone.style.transition = 'all 0.5s ease-in-out'

          // Trigger animation
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              clone.style.left = `${zoneRect.left}px`
              clone.style.top = `${zoneRect.top}px`
              clone.style.transform = 'scale(0.9)'
              clone.style.opacity = '0.8'
            })
          })

          // Remove clone and place item after animation
          setTimeout(() => {
            document.body.removeChild(clone)

            // Place item in next available zone
            const newAnswers = { ...userAnswers }
            if (!newAnswers[questionIndex]) {
              newAnswers[questionIndex] = {}
            }

            newAnswers[questionIndex][availableZone.id] = itemId
            setUserAnswers(newAnswers)
          }, 520)
        } else {
          // Fallback: place immediately if elements not found
          const newAnswers = { ...userAnswers }
          if (!newAnswers[questionIndex]) {
            newAnswers[questionIndex] = {}
          }

          newAnswers[questionIndex][availableZone.id] = itemId
          setUserAnswers(newAnswers)
        }
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

    // Convert user answer to array with text values
    const userOrder = question.drop_zones.map(zone => {
      const itemId = userAnswer[zone.id]
      if (!itemId) return null
      const item = question.items.find(i => i.id === itemId)
      return item ? item.text : null
    })

    // Convert correct order to text values
    const correctOrder = question.correct_order.map(itemId => {
      if (!itemId) return null
      const item = question.items.find(i => i.id === itemId)
      return item ? item.text : null
    })

    const isAnswerCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder)
    setIsCorrect(isAnswerCorrect)
    setShowResult(true)

    // Play feedback (meme + sound)
    playFeedback(isAnswerCorrect)

    // Calculate feedback for each drop zone based on text values
    const feedback = {}
    question.drop_zones.forEach((zone, index) => {
      const userItemId = userAnswer[zone.id]
      const correctItemId = question.correct_order[index]

      if (userItemId) {
        const userItem = question.items.find(i => i.id === userItemId)
        const correctItem = question.items.find(i => i.id === correctItemId)

        // Compare by text content, not ID
        feedback[zone.id] = userItem?.text === correctItem?.text ? 'correct' : 'incorrect'
      }
    })

    setItemFeedback(prev => ({
      ...prev,
      [questionIndex]: feedback
    }))

    // Attempts will be incremented in saveProgress function

    // Mark question as checked
    setQuestionsChecked(prev => ({
      ...prev,
      [questionIndex]: true
    }))

    // Save progress on every question check, but don't increment attempts here
    if (user) {
      await saveProgress(questionIndex, isAnswerCorrect)
    }

    return isAnswerCorrect
  }

  const saveProgress = async (questionIndex, isCorrect) => {
    if (!user || !exercise) return

    try {
      const xpReward = exercise.xp_reward || 10

      // Calculate time spent
      const currentTime = Date.now()
      const totalTimeSpent = startTime ? Math.floor((currentTime - startTime) / 1000) : 0
      setTimeSpent(totalTimeSpent)

      // Check if all questions are completed (compare by text values)
      const allQuestionsCompleted = exercise.content.questions.every((_, index) => {
        const userAnswer = userAnswers[index] || {}
        const question = exercise.content.questions[index]
        const userOrder = question.drop_zones.map(zone => {
          const itemId = userAnswer[zone.id]
          if (!itemId) return null
          const item = question.items.find(i => i.id === itemId)
          return item ? item.text : null
        })
        const correctOrder = question.correct_order.map(itemId => {
          if (!itemId) return null
          const item = question.items.find(i => i.id === itemId)
          return item ? item.text : null
        })
        return JSON.stringify(userOrder) === JSON.stringify(correctOrder)
      })

      // Calculate score based on correct answers (compare by text values)
      const correctAnswers = exercise.content.questions.filter((_, index) => {
        const userAnswer = userAnswers[index] || {}
        const question = exercise.content.questions[index]
        const userOrder = question.drop_zones.map(zone => {
          const itemId = userAnswer[zone.id]
          if (!itemId) return null
          const item = question.items.find(i => i.id === itemId)
          return item ? item.text : null
        })
        const correctOrder = question.correct_order.map(itemId => {
          if (!itemId) return null
          const item = question.items.find(i => i.id === itemId)
          return item ? item.text : null
        })
        return JSON.stringify(userOrder) === JSON.stringify(correctOrder)
      }).length

      const maxScore = exercise.content.questions.length
      const scorePercentage = maxScore > 0 ? Math.round((correctAnswers / maxScore) * 100) : 0
      const score = allQuestionsCompleted ? scorePercentage : 0

      // If exercise is completed, use proper XP awarding system
      if (allQuestionsCompleted) {
        const result = await completeExerciseWithXP(
          exercise.id,
          xpReward,
          {
            score: scorePercentage,
            max_score: 100,
            time_spent: totalTimeSpent
          }
        )

        if (result.completed) {
          setExerciseCompleted(true)
          if (result.xpAwarded > 0) {
            setXpEarnedThisSession(result.xpAwarded)
          }
        }
      }
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  const handleFinishExercise = async () => {
    console.log('🏁 Finishing exercise');

    // Trigger final save progress to complete the exercise
    if (user && exercise) {
      await saveProgress(currentQuestionIndex, true)
    }

    // Navigate back
    navigate(-1)
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

    // Reset feedback
    setItemFeedback(prev => ({
      ...prev,
      [questionIndex]: {}
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

      // Trigger Batman movement
      setIsBatmanMoving(true)
      setTimeout(() => setIsBatmanMoving(false), 3000)

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

  // Debug logging
  console.log('DragDropExercise render:', {
    exercise: !!exercise,
    currentQuestion: !!currentQuestion,
    currentQuestionIndex,
    totalQuestions: exercise?.content?.questions?.length || 0
  })

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
              <h1 className="text-lg md:text-2xl font-bold text-gray-900">Drag & Drop</h1>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xl md:text-3xl font-bold text-blue-600">
                {currentQuestionIndex + 1}/{exercise?.content?.questions?.length || 0}
              </div>
              <div className="text-xs md:text-sm text-gray-500">
                Question
              </div>
            </div>
          </div>

          {/* Progress Bar inside header */}
          <div className="mt-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-gray-600">Progress</span>
              <span className="text-xs md:text-sm font-semibold text-blue-600">
                {Math.round(((currentQuestionIndex + 1) / (exercise?.content?.questions?.length || 1)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-visible">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-[3000ms]"
                style={{ width: `${((currentQuestionIndex + 1) / (exercise?.content?.questions?.length || 1)) * 100}%` }}
              />
              {/* Running Batman Animation - moves with and stays with progress bar */}
              <img
                src={isBatmanMoving ? "https://xpclass.vn/LMS_enhance/gif/Left%20running/batman.gif" : "https://xpclass.vn/xpclass/materials/batman_standing.gif"}
                alt="Running Batman"
                className="absolute -top-8 h-12 transition-all duration-[3000ms]"
                style={{
                  left: `calc(${((currentQuestionIndex + 1) / (exercise?.content?.questions?.length || 1)) * 100}% - 24px)`,
                  zIndex: 10
                }}
              />
            </div>
          </div>
        </div>

        {/* Meme Overlay */}
        {showMeme && (
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
        <div className="w-full max-w-4xl min-w-0 mx-auto rounded-lg p-4 md:p-8 bg-white shadow-md border border-gray-200 border-l-4 border-l-blue-400 relative" style={{ userSelect: 'none' }}>
          {/* Colored circles on top right */}
          <div className="absolute top-4 right-6 md:right-10 flex gap-2 z-20">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          {/* Question with inline drop zones */}
          <div className="mb-8 p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 leading-relaxed">
              {renderQuestionWithDropZones(
                currentQuestion.question,
                currentQuestion.drop_zones,
                (zoneId, index) => {
                  const zone = currentQuestion.drop_zones.find(z => z.id === zoneId)
                  const itemId = userAnswer[zoneId]
                  const item = currentQuestion.items.find(i => i.id === itemId)
                  const feedback = itemFeedback[currentQuestionIndex]?.[zoneId]

                  return (
                    <span
                      key={index}
                      onDragOver={!questionsChecked[currentQuestionIndex] ? handleDragOver : undefined}
                      onDrop={(e) => !questionsChecked[currentQuestionIndex] && handleDrop(e, zoneId, currentQuestionIndex)}
                      onTouchEnd={!questionsChecked[currentQuestionIndex] ? handleTouchEnd : undefined}
                      onClick={() => !questionsChecked[currentQuestionIndex] && handleDropZoneClick(zoneId, currentQuestionIndex)}
                      data-zone-id={zoneId}
                      data-question-index={currentQuestionIndex}
                      className={`inline-block relative mx-1 transition-all ${
                        questionsChecked[currentQuestionIndex]
                          ? 'cursor-default'
                          : 'cursor-pointer'
                      } ${
                        !questionsChecked[currentQuestionIndex] && itemId ? 'hover:bg-blue-50' :
                        !questionsChecked[currentQuestionIndex] && !itemId ? 'hover:bg-gray-50' : ''
                      }`}
                    >
                      {item ? (
                        <span className={`px-2 py-1 rounded text-m font-medium ${
                          feedback === 'correct'
                            ? 'bg-green-100 text-green-800 border-2 border-green-500'
                            : feedback === 'incorrect'
                              ? 'bg-red-100 text-red-800 border-2 border-red-500'
                              : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.text}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-lg min-w-[60px] inline-block">
                          ___
                        </span>
                      )}
                    </span>
                  )
                }
              )}
            </h2>
          </div>

          {/* Drag Items */}
          <div className="mb-8 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-700">Items to drag:</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {randomizedItems.map((item) => {
                const isUsed = Object.values(userAnswer).includes(item.id)
                const isDisabled = isUsed || questionsChecked[currentQuestionIndex]

                // Determine shadow color based on state
                let shadowColor = '#93c5fd' // blue-300 default
                if (isUsed) {
                  shadowColor = '#e5e7eb' // gray-200
                }

                return (
                  <div
                    key={item.id}
                    data-item-id={item.id}
                    draggable={!isUsed && !questionsChecked[currentQuestionIndex]}
                    onDragStart={(e) => !questionsChecked[currentQuestionIndex] && handleDragStart(e, item.id, currentQuestionIndex)}
                    onTouchStart={(e) => !questionsChecked[currentQuestionIndex] && handleTouchStart(e, item.id, currentQuestionIndex)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => !questionsChecked[currentQuestionIndex] && handleItemClick(item.id, currentQuestionIndex)}
                    className="border-none rounded-lg transition-all duration-100"
                    style={{
                      padding: 0,
                      borderRadius: '0.75em',
                      backgroundColor: shadowColor,
                      cursor: isUsed ? 'not-allowed' : questionsChecked[currentQuestionIndex] ? 'default' : 'pointer'
                    }}
                  >
                    <div
                      className={`select-none text-m rounded-lg ${
                        isUsed
                          ? 'bg-gray-100 text-gray-400'
                          : questionsChecked[currentQuestionIndex]
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                      style={{
                        display: 'block',
                        boxSizing: 'border-box',
                        transform: isDisabled ? 'translateY(0)' : 'translateY(-0.2em)',
                        transition: 'transform 0.1s ease',
                        padding: '0.5em 1em',
                        borderRadius: '0.75em'
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled) {
                          e.currentTarget.style.transform = 'translateY(-0.33em)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDisabled) {
                          e.currentTarget.style.transform = 'translateY(-0.2em)'
                        }
                      }}
                      onMouseDown={(e) => {
                        if (!isDisabled) {
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                      onMouseUp={(e) => {
                        if (!isDisabled) {
                          e.currentTarget.style.transform = 'translateY(-0.33em)'
                        }
                      }}
                    >
                      {item.text}
                    </div>
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
                {xpEarnedThisSession > 0 && (
                  <div className="text-sm text-green-600">
                    XP Earned: {xpEarnedThisSession}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 p-4">
            <button
              onClick={() => checkAnswer(currentQuestionIndex)}
              className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${
                questionsChecked[currentQuestionIndex]
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              style={{
                boxShadow: questionsChecked[currentQuestionIndex]
                  ? '0 4px 0 0 #282e37'
                  : '0 4px 0 0 #1c47a6'
              }}
            >
              <CheckCircle className="w-4 h-4" />
              {questionsChecked[currentQuestionIndex] ? 'Checked' : 'Check'}
            </button>

            <button
              onClick={() => resetQuestion(currentQuestionIndex)}
              className={`px-6 py-2 text-white rounded-lg flex items-center gap-2 transition-all ${
                showResult && !isCorrect
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
              style={{
                boxShadow: showResult && !isCorrect
                  ? '0 4px 0 0 #46a302'
                  : '0 4px 0 0 #282e37'
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>

            {currentQuestionIndex > 0 && (
              <button
                onClick={prevQuestion}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                style={{ boxShadow: '0 4px 0 0 #4b505b' }}
              >
                Previous
              </button>
            )}

            {currentQuestionIndex < exercise.content.questions.length - 1 ? (
              <button
                onClick={nextQuestion}
                disabled={!questionsChecked[currentQuestionIndex]}
                className={`px-6 py-2 rounded-lg transition-all ${
                  questionsChecked[currentQuestionIndex]
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                style={{
                  boxShadow: questionsChecked[currentQuestionIndex]
                    ? '0 4px 0 0 #46a302'
                    : '0 4px 0 0 #b7b7b7'
                }}
                title={!questionsChecked[currentQuestionIndex] ? 'Please check your answer first' : ''}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleFinishExercise}
                disabled={!questionsChecked[currentQuestionIndex]}
                className={`px-6 py-2 rounded-lg transition-all ${
                  questionsChecked[currentQuestionIndex]
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                style={{
                  boxShadow: questionsChecked[currentQuestionIndex]
                    ? '0 4px 0 0 #1c47a6'
                    : '0 4px 0 0 #b7b7b7'
                }}
                title={!questionsChecked[currentQuestionIndex] ? 'Please check your answer first' : ''}
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DragDropExercise
