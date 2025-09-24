import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Wand2, Eye, EyeOff, HelpCircle } from 'lucide-react'

const SmartDragDropEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState([])
  const [phraseInput, setPhraseInput] = useState('')
  const [distractors, setDistractors] = useState('')
  const [previewMode, setPreviewMode] = useState(false)

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
        <button
          onClick={togglePreview}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {previewMode ? 'Edit Mode' : 'Preview Mode'}
        </button>
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
            onClick={addQuestionFromPhrase}
            disabled={!phraseInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Wand2 className="w-4 h-4" />
            Generate Question
          </button>
        </div>
      </div>

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
                                  className="inline-block min-w-[60px] h-8 mx-1 border-2 border-blue-400 rounded bg-blue-50 text-center text-blue-600 text-sm leading-8"
                                >
                                  {zone?.word || ''}
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
                                onClick={() => removeItem(question.id, item.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
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
