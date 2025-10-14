import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Wand2, Eye, EyeOff, HelpCircle, Brain, Image as ImageIcon, Music, Link as LinkIcon } from 'lucide-react'

const AIFillBlankEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState([])
  const [previewMode, setPreviewMode] = useState({})

  useEffect(() => {
    setLocalQuestions(questions || [])
  }, [questions])

  const normalizeQuestion = (q, idx = 0) => {
    return {
      id: q?.id || `q${Date.now()}_${idx}`,
      question: q?.question || '',
      expected_answers: q?.expected_answers || [],
      ai_prompt: q?.ai_prompt || '',
      explanation: q?.explanation || '',
      settings: q?.settings || {
        min_score: 70,
        allow_partial_credit: true,
        max_attempts: 3
      }
    }
  }

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      expected_answers: [],
      ai_prompt: '',
      explanation: '',
      settings: {
        min_score: 70,
        allow_partial_credit: true,
        max_attempts: 3
      }
    }
    const updatedQuestions = [...localQuestions, newQuestion]
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateQuestion = (index, field, value) => {
    const updatedQuestions = [...localQuestions]
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    }
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const appendToField = (index, field, snippet) => {
    const current = (localQuestions[index]?.[field]) || ''
    updateQuestion(index, field, (current + (current ? '\n' : '') + snippet).trim())
  }

  const handleInsertImage = (index) => {
    const url = window.prompt('Enter image URL')
    if (!url) return
    appendToField(index, 'question', `<img src="${url}" alt="" style="max-width:100%" />`)
  }

  const handleInsertAudio = (index) => {
    const url = window.prompt('Enter audio URL')
    if (!url) return
    appendToField(index, 'question', `<audio src="${url}" controls preload="none"></audio>`)
  }

  const handleInsertLink = (index) => {
    const url = window.prompt('Enter link URL')
    if (!url) return
    const text = window.prompt('Link text (optional)') || url
    appendToField(index, 'question', `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`)
  }

  const addExpectedAnswer = (questionIndex) => {
    const updatedQuestions = [...localQuestions]
    if (!updatedQuestions[questionIndex].expected_answers) {
      updatedQuestions[questionIndex].expected_answers = []
    }
    updatedQuestions[questionIndex].expected_answers.push('')
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateExpectedAnswer = (questionIndex, answerIndex, value) => {
    const updatedQuestions = [...localQuestions]
    updatedQuestions[questionIndex].expected_answers[answerIndex] = value
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeExpectedAnswer = (questionIndex, answerIndex) => {
    const updatedQuestions = [...localQuestions]
    updatedQuestions[questionIndex].expected_answers.splice(answerIndex, 1)
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeQuestion = (index) => {
    const updatedQuestions = localQuestions.filter((_, i) => i !== index)
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const togglePreview = (index) => {
    setPreviewMode(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const generateAIPrompt = (questionIndex) => {
    const question = localQuestions[questionIndex]
    const prompt = `Score this fill-in-the-blank answer for the question: "${question.question}"

Expected answers: ${question.expected_answers.join(', ')}

Consider:
- Exact matches should score 100
- Partial matches should score 50-90 based on similarity
- Conceptual understanding should be rewarded
- Minor spelling/grammar errors should not heavily penalize
- Completely wrong answers should score 0-30

Provide a score (0-100), confidence level (0-100), and brief explanation.`
    
    updateQuestion(questionIndex, 'ai_prompt', prompt)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Fill-in-the-Blank Questions</h3>
            <p className="text-sm text-gray-600">Create questions that use AI to score student answers</p>
          </div>
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {localQuestions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No AI fill-in-the-blank questions yet. Add your first question above!</p>
          </div>
        ) : (
          localQuestions.map((question, index) => (
            <div key={question.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">
                  Question {index + 1}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePreview(index)}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    {previewMode[index] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {previewMode[index] ? 'Hide Preview' : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="p-1 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {previewMode[index] ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Preview:</h5>
                  <div className="space-y-3">
                    <p className="text-gray-700">{question.question}</p>
                    <div className="bg-white p-3 border rounded">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your Answer:
                      </label>
                      <textarea
                        placeholder="Type your answer here..."
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                        rows={2}
                        disabled
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Expected answers:</strong> {question.expected_answers.join(', ')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Question Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question Text
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                    <button type="button" onClick={() => handleInsertImage(index)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded inline-flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Image
                      </button>
                      <button type="button" onClick={() => handleInsertAudio(index)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded inline-flex items-center gap-1">
                        <Music className="w-3 h-3" /> Audio
                      </button>
                      <button type="button" onClick={() => handleInsertLink(index)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded inline-flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> Link
                      </button>
                    </div>
                    <textarea
                      value={question.question}
                      onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                      placeholder="Enter your fill-in-the-blank question here..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      rows={3}
                    />
                  </div>

                  {/* Expected Answers */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Expected Answers
                      </label>
                      <button
                        type="button"
                        onClick={() => addExpectedAnswer(index)}
                        className="flex items-center gap-1 px-2 py-1 text-sm text-purple-600 hover:text-purple-800"
                      >
                        <Plus className="w-3 h-3" />
                        Add Answer
                      </button>
                    </div>
                    <div className="space-y-2">
                      {question.expected_answers.map((answer, answerIndex) => (
                        <div key={answerIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={answer}
                            onChange={(e) => updateExpectedAnswer(index, answerIndex, e.target.value)}
                            placeholder="Expected answer..."
                            className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeExpectedAnswer(index, answerIndex)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Add multiple expected answers to give students more ways to be correct
                    </p>
                  </div>

                  {/* AI Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        AI Scoring Prompt
                      </label>
                      <button
                        type="button"
                        onClick={() => generateAIPrompt(index)}
                        className="flex items-center gap-1 px-2 py-1 text-sm text-purple-600 hover:text-purple-800"
                      >
                        <Wand2 className="w-3 h-3" />
                        Generate
                      </button>
                    </div>
                    <textarea
                      value={question.ai_prompt}
                      onChange={(e) => updateQuestion(index, 'ai_prompt', e.target.value)}
                      placeholder="Custom AI prompt for scoring this question..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Customize how AI should score this question. Leave empty for default behavior.
                    </p>
                  </div>

                  {/* Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Score (0-100)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={question.settings.min_score}
                        onChange={(e) => updateQuestion(index, 'settings', {
                          ...question.settings,
                          min_score: parseInt(e.target.value) || 70
                        })}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Attempts
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={question.settings.max_attempts}
                        onChange={(e) => updateQuestion(index, 'settings', {
                          ...question.settings,
                          max_attempts: parseInt(e.target.value) || 3
                        })}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={question.settings.allow_partial_credit}
                          onChange={(e) => updateQuestion(index, 'settings', {
                            ...question.settings,
                            allow_partial_credit: e.target.checked
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Allow Partial Credit</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">AI Fill-in-the-Blank Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Provide multiple expected answers to account for different ways students might respond</li>
              <li>• Use clear, specific questions that have definitive answers</li>
              <li>• Set appropriate minimum scores (70% is usually good for "correct")</li>
              <li>• Customize AI prompts for subject-specific scoring criteria</li>
              <li>• Test your questions with sample answers before publishing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIFillBlankEditor
