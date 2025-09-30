import React, { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Info
} from 'lucide-react'
import RichTextRenderer from '../../ui/RichTextRenderer'

const SimpleDropdownEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState(questions || [])

  useEffect(() => {
    setLocalQuestions(questions || [])
  }, [questions])

  // Parse inline syntax [option1, =option2, option3] into dropdown data
  const parseInlineDropdowns = (text) => {
    const dropdowns = []
    const regex = /\[([^\]]+)\]/g
    let match

    while ((match = regex.exec(text)) !== null) {
      const content = match[1]
      const options = content.split(',').map(opt => opt.trim())

      // Find the correct answer (marked with =)
      let correctAnswer = ''
      const cleanOptions = []

      options.forEach(opt => {
        if (opt.startsWith('=')) {
          correctAnswer = opt.substring(1).trim()
          cleanOptions.push(correctAnswer)
        } else {
          cleanOptions.push(opt)
        }
      })

      if (cleanOptions.length > 0) {
        dropdowns.push({
          correct_answer: correctAnswer || cleanOptions[0],
          options: cleanOptions
        })
      }
    }

    return dropdowns
  }

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      dropdowns: [],
      explanation: ''
    }
    const updatedQuestions = [...localQuestions, newQuestion]
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const duplicateQuestion = (index) => {
    const questionToDuplicate = { ...localQuestions[index] }
    questionToDuplicate.id = `q${Date.now()}`
    questionToDuplicate.question = `${questionToDuplicate.question} (Copy)`
    const updatedQuestions = [...localQuestions]
    updatedQuestions.splice(index + 1, 0, questionToDuplicate)
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeQuestion = (index) => {
    const updatedQuestions = localQuestions.filter((_, i) => i !== index)
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateQuestion = (index, field, value) => {
    const updatedQuestions = localQuestions.map((q, i) => {
      if (i === index) {
        if (field === 'question') {
          // Auto-parse dropdowns from the question text
          const dropdowns = parseInlineDropdowns(value)
          return { ...q, question: value, dropdowns }
        }
        return { ...q, [field]: value }
      }
      return q
    })
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const moveQuestion = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === localQuestions.length - 1)
    )
      return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updatedQuestions = [...localQuestions]
    const temp = updatedQuestions[index]
    updatedQuestions[index] = updatedQuestions[newIndex]
    updatedQuestions[newIndex] = temp

    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  return (
    <div className="space-y-6">
      {/* Header with Instructions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Dropdown Questions</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How to create dropdown questions:</p>
                <p className="mb-2">Use square brackets with comma-separated options. Mark the correct answer with <code className="bg-blue-100 px-1 rounded">=</code></p>
                <p className="font-mono text-xs bg-white p-2 rounded border border-blue-200 mb-1">
                  The cat [sat, =sits, sitting] on the mat.
                </p>
                <p className="text-xs text-blue-600">The option with = will be the correct answer</p>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {/* Questions */}
      {localQuestions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">No questions yet. Click "Add Question" to create one.</p>
        </div>
      ) : (
        localQuestions.map((question, qIndex) => (
          <div key={question.id} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            {/* Question Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-800">Question {qIndex + 1}</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveQuestion(qIndex, 'up')}
                  disabled={qIndex === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(qIndex, 'down')}
                  disabled={qIndex === localQuestions.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateQuestion(qIndex)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Duplicate question"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete question"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question Text
              </label>
              <textarea
                value={question.question}
                onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={4}
                placeholder="Example: The cat [sat, =sits, sitting] on the mat."
              />
              <p className="text-xs text-gray-500 mt-1">
                Use [option1, =correctOption, option3] format. The = marks the correct answer.
              </p>
            </div>

            {/* Preview Detected Dropdowns */}
            {question.dropdowns && question.dropdowns.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800 mb-2">
                  ✓ Detected {question.dropdowns.length} dropdown{question.dropdowns.length !== 1 ? 's' : ''}:
                </p>
                <div className="space-y-2">
                  {question.dropdowns.map((dropdown, dIndex) => (
                    <div key={dIndex} className="text-xs bg-white rounded p-2 border border-green-200">
                      <span className="font-medium text-green-700">Dropdown {dIndex + 1}:</span>
                      <div className="mt-1">
                        <span className="text-gray-600">Options: </span>
                        {dropdown.options.map((opt, oIndex) => (
                          <span
                            key={oIndex}
                            className={`inline-block px-2 py-0.5 rounded mr-1 ${
                              opt === dropdown.correct_answer
                                ? 'bg-green-100 text-green-800 font-semibold'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {opt === dropdown.correct_answer ? `✓ ${opt}` : opt}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Explanation (Optional)
              </label>
              <textarea
                value={question.explanation}
                onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="Explain the correct answer..."
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default SimpleDropdownEditor