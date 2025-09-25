import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Wand2, Eye, EyeOff, HelpCircle, Upload, Copy } from 'lucide-react'

const SmartDragDropEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState([])
  const [phraseInput, setPhraseInput] = useState('')
  const [distractors, setDistractors] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')

  useEffect(() => {
    setLocalQuestions(questions || [])
  }, [questions])

  // Parse phrase and extract dragable words
  const parsePhrase = (phrase) => {
    const regex = /\[([^\]]+)\]/g
    const matches = []
    let match
    
    while ((match = regex.exec(phrase)) !== null) {
      matches.push({
        word: match[1],
        position: match.index,
        placeholder: `[${match[1]}]`
      })
    }
    
    return matches
  }

  // Generate question from phrase
  const generateQuestion = (phrase, distractorWords = []) => {
    const dragableWords = parsePhrase(phrase)
    
    if (dragableWords.length === 0) {
      return null
    }

    // Create items (dragable words + distractors)
    const items = [
      ...dragableWords.map((word, index) => ({
        id: `item_${index + 1}`,
        text: word.word,
        type: 'correct'
      })),
      ...distractorWords.map((word, index) => ({
        id: `distractor_${index + 1}`,
        text: word,
        type: 'distractor'
      }))
    ]

    // Create inline drop zones - replace [word] with drop zone
    const createInlineQuestion = (phrase) => {
      let questionText = phrase
      const dropZones = []
      let zoneIndex = 1
      
      // Replace each [word] with a drop zone placeholder
      questionText = questionText.replace(/\[([^\]]+)\]/g, (match, word) => {
        const zoneId = `zone_${zoneIndex}`
        dropZones.push({
          id: zoneId,
          label: `Drop ${word} here`,
          word: word,
          position: zoneIndex - 1
        })
        zoneIndex++
        return `[DROP_ZONE_${zoneId}]`
      })
      
      return { questionText, dropZones }
    }

    const { questionText, dropZones } = createInlineQuestion(phrase)

    // Create correct order - map each drop zone to its correct item
    const correctOrder = dropZones.map(zone => 
      items.find(item => item.text === zone.word)?.id
    ).filter(Boolean)

    return {
      id: `q${Date.now()}`,
      question: questionText,
      items: items,
      drop_zones: dropZones,
      correct_order: correctOrder,
      explanation: '',
      settings: {
        allow_undo: true,
        show_hints: true,
        max_attempts: 3,
        time_limit: 300
      }
    }
  }

  const addQuestionFromPhrase = () => {
    if (!phraseInput.trim()) return

    const distractorWords = distractors
      .split(',')
      .map(word => word.trim())
      .filter(word => word.length > 0)

    const newQuestion = generateQuestion(phraseInput, distractorWords)
    
    if (newQuestion) {
      const updatedQuestions = [...localQuestions, newQuestion]
      setLocalQuestions(updatedQuestions)
      onQuestionsChange(updatedQuestions)
      
      // Clear inputs
      setPhraseInput('')
      setDistractors('')
    }
  }

  const removeQuestion = (questionId) => {
    const updatedQuestions = localQuestions.filter(q => q.id !== questionId)
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateQuestion = (questionId, field, value) => {
    const updatedQuestions = localQuestions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const addDistractor = (questionId) => {
    const question = localQuestions.find(q => q.id === questionId)
    if (!question) return

    const newDistractor = {
      id: `distractor_${Date.now()}`,
      text: 'New distractor',
      type: 'distractor'
    }

    const updatedQuestion = {
      ...question,
      items: [...question.items, newDistractor]
    }

    updateQuestion(questionId, 'items', updatedQuestion.items)
  }

  const removeItem = (questionId, itemId) => {
    const question = localQuestions.find(q => q.id === questionId)
    if (!question) return

    const updatedItems = question.items.filter(item => item.id !== itemId)
    const updatedCorrectOrder = question.correct_order.filter(id => id !== itemId)

    updateQuestion(questionId, 'items', updatedItems)
    updateQuestion(questionId, 'correct_order', updatedCorrectOrder)
  }

  const handleRemoveItem = (e, questionId, itemId) => {
    e.preventDefault()
    e.stopPropagation()
    removeItem(questionId, itemId)
  }

  const updateItemText = (questionId, itemId, newText) => {
    const question = localQuestions.find(q => q.id === questionId)
    if (!question) return

    const updatedItems = question.items.map(item =>
      item.id === itemId ? { ...item, text: newText } : item
    )

    updateQuestion(questionId, 'items', updatedItems)
  }

  const togglePreview = () => {
    setPreviewMode(!previewMode)
  }

  const processBulkImport = () => {
    try {
      const lines = bulkText.split('\n').filter(line => line.trim())
      const newQuestions = []

      let questionCounter = 0
      let currentQuestion = null
      let currentDistractors = []

      lines.forEach((line) => {
        const trimmedLine = line.trim()

        // Check if this is a new question (starts with Q: or number.)
        if (trimmedLine.match(/^(Q:|Question|\d+[\.):])/i)) {
          // Save previous question if exists
          if (currentQuestion) {
            newQuestions.push(currentQuestion)
          }

          // Start new question - extract the question title
          const questionTitle = trimmedLine.replace(/^(Q:|Question|\d+[\.):])\s*/i, '')
          currentQuestion = {
            id: `q${Date.now()}_${questionCounter++}`,
            question: '',
            items: [],
            drop_zones: [],
            correct_order: [],
            explanation: questionTitle,
            settings: {
              allow_undo: true,
              show_hints: true,
              max_attempts: 3,
              time_limit: 300
            }
          }
          currentDistractors = []
        }
        // Check if this line contains dragable words in [brackets]
        else if (trimmedLine.includes('[') && trimmedLine.includes(']') && currentQuestion) {
          const distractorWords = currentDistractors
          const newQuestionData = generateQuestion(trimmedLine, distractorWords)

          if (newQuestionData) {
            // Update current question with the generated data
            currentQuestion.question = newQuestionData.question
            currentQuestion.items = newQuestionData.items
            currentQuestion.drop_zones = newQuestionData.drop_zones
            currentQuestion.correct_order = newQuestionData.correct_order
          }
        }
        // Check if this is a distractors line
        else if (trimmedLine.match(/^Distractors?:\s*/i) && currentQuestion) {
          const distractorText = trimmedLine.replace(/^Distractors?:\s*/i, '')
          currentDistractors = distractorText
            .split(',')
            .map(word => word.trim())
            .filter(word => word.length > 0)
        }
        // Regular line (no special format) - add to current question explanation if exists
        else if (trimmedLine && currentQuestion && !trimmedLine.includes('[')) {
          if (currentQuestion.explanation) {
            currentQuestion.explanation += '\n' + trimmedLine
          } else {
            currentQuestion.explanation = trimmedLine
          }
        }
      })

      // Save the last question
      if (currentQuestion && currentQuestion.items.length > 0) {
        newQuestions.push(currentQuestion)
      }

      if (newQuestions.length > 0) {
        const updatedQuestions = [...localQuestions, ...newQuestions]
        setLocalQuestions(updatedQuestions)
        onQuestionsChange(updatedQuestions)
        setBulkText('')
        setBulkImportMode(false)
        alert(`Successfully imported ${newQuestions.length} drag & drop questions!`)
      } else {
        alert('No valid questions found. Please check your format.')
      }
    } catch (error) {
      console.error('Bulk import error:', error)
      alert('Error processing bulk import. Please check your format.')
    }
  }

  const exportQuestions = () => {
    if (localQuestions.length === 0) {
      alert('No questions to export')
      return
    }

    const exportText = localQuestions.map((q, index) => {
      let text = `${index + 1}. ${q.explanation || 'Drag & Drop Question'}\n`

      // Extract the original phrase with [brackets] from the question
      let phrase = q.question
      q.drop_zones.forEach((zone, idx) => {
        const placeholder = `[DROP_ZONE_${zone.id}]`
        phrase = phrase.replace(placeholder, `[${zone.word}]`)
      })

      text += `${phrase}\n`

      // Add distractors if any
      const distractors = q.items.filter(item => item.type === 'distractor')
      if (distractors.length > 0) {
        const distractorWords = distractors.map(d => d.text).join(', ')
        text += `Distractors: ${distractorWords}\n`
      }

      return text
    }).join('\n')

    navigator.clipboard.writeText(exportText).then(() => {
      alert('Questions exported to clipboard!')
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = exportText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Questions copied to clipboard!')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Smart Drag & Drop Editor</h3>
          <p className="text-sm text-gray-600">
            Enter a phrase with words in [brackets] to make them dragable
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkImportMode(!bulkImportMode)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
          {localQuestions.length > 0 && (
            <button
              type="button"
              onClick={exportQuestions}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg"
            >
              <Copy className="w-4 h-4" />
              Export
            </button>
          )}
          <button
            type="button"
            onClick={togglePreview}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Edit Mode' : 'Preview Mode'}
          </button>
        </div>
      </div>

      {/* Quick Add Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-3">Quick Add Question</h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phrase with dragable words
            </label>
            <input
              type="text"
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              placeholder="Hello [my] [name] [is] John"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Put words you want to be dragable in [brackets]
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Distractors (optional)
            </label>
            <input
              type="text"
              value={distractors}
              onChange={(e) => setDistractors(e.target.value)}
              placeholder="wrong, incorrect, false"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Separate multiple distractors with commas
            </p>
          </div>

          <button
            type="button"
            onClick={addQuestionFromPhrase}
            disabled={!phraseInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Wand2 className="w-4 h-4" />
            Generate Question
          </button>
        </div>
      </div>

      {/* Bulk Import Mode */}
      {bulkImportMode && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Bulk Import Drag & Drop Questions</h4>
          <p className="text-sm text-blue-700 mb-3">
            Format: Start with "Q:" or "1." followed by question title, then phrase with [words] in brackets
            <br />
            Add "Distractors: word1, word2" line for incorrect options
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg h-40 font-mono text-sm"
            placeholder={`Q: Complete the sentence by dragging the correct words
Hello [my] [name] [is] John
Distractors: wrong, incorrect, false

1. Fill in the missing words in order
The capital of [France] [is] [Paris]
Distractors: Germany, London, Italy

2: Put the words in the correct sequence
She [has] [been] [studying] English for 3 years`}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setBulkImportMode(false)}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={processBulkImport}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Import Questions
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {localQuestions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No questions yet. Add your first question above!</p>
          </div>
        ) : (
          localQuestions.map((question, index) => (
            <div key={question.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800 mb-2">
                    Question {index + 1}
                  </h4>
                  
                  {previewMode ? (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      {/* Inline question with drop zones */}
                      <div className="mb-4">
                        <div className="text-gray-700 text-lg leading-relaxed">
                          {question.question.split(/\[DROP_ZONE_(\w+)\]/).map((part, index) => {
                            if (index % 2 === 0) {
                              return <span key={index}>{part}</span>
                            } else {
                              const zoneId = part
                              const zone = question.drop_zones.find(z => z.id === zoneId)
                              return (
                                <span
                                  key={index}
                                  className="inline-block relative mx-1"
                                >
                                  <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded border-2 border-dashed border-gray-400 text-sm font-medium min-w-[60px] text-center">
                                    ___
                                  </span>
                                </span>
                              )
                            }
                          })}
                        </div>
                      </div>
                      
                      {/* Dragable items */}
                      <div className="flex flex-wrap gap-2">
                        {question.items.map((item) => (
                          <span
                            key={item.id}
                            className={`px-3 py-1 rounded-full text-sm cursor-move ${
                              item.type === 'correct'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-red-100 text-red-800 border border-red-300'
                            }`}
                          >
                            {item.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Question Text
                        </label>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dragable Items
                        </label>
                        <div className="space-y-2">
                          {question.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  item.type === 'correct'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {item.type}
                              </span>
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) => updateItemText(question.id, item.id, e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedQuestions = localQuestions.map(q =>
                                    q.id === question.id
                                      ? {
                                          ...q,
                                          items: q.items.filter(i => i.id !== item.id),
                                          correct_order: q.correct_order.filter(id => id !== item.id)
                                        }
                                      : q
                                  )
                                  setLocalQuestions(updatedQuestions)
                                  onQuestionsChange(updatedQuestions)
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addDistractor(question.id)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                          >
                            <Plus className="w-4 h-4" />
                            Add Distractor
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Explanation (optional)
                        </label>
                        <textarea
                          value={question.explanation}
                          onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Explain the correct answer..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeQuestion(question.id)}
                  className="ml-4 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SmartDragDropEditor
