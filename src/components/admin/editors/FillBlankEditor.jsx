import React, { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Upload,
  Check,
  HelpCircle
} from 'lucide-react'

const FillBlankEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState(questions || [])
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')

  useEffect(() => {
    setLocalQuestions(questions || [])
  }, [questions])

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      blanks: [{ text: '', answer: '', case_sensitive: false }],
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
    const updatedQuestions = localQuestions.map((q, i) =>
      i === index ? { ...q, [field]: value } : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const addBlank = (questionIndex) => {
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, blanks: [...q.blanks, { text: '', answer: '', case_sensitive: false }] }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeBlank = (questionIndex, blankIndex) => {
    const question = localQuestions[questionIndex]
    if (question.blanks.length <= 1) return // Keep at least 1 blank

    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, blanks: q.blanks.filter((_, bi) => bi !== blankIndex) }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateBlank = (questionIndex, blankIndex, field, value) => {
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? {
            ...q,
            blanks: q.blanks.map((blank, bi) =>
              bi === blankIndex ? { ...blank, [field]: value } : blank
            )
          }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const moveQuestion = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= localQuestions.length) return

    const updatedQuestions = [...localQuestions]
    const temp = updatedQuestions[index]
    updatedQuestions[index] = updatedQuestions[newIndex]
    updatedQuestions[newIndex] = temp

    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const processBulkImport = () => {
    try {
      const lines = bulkText.split('\n').filter(line => line.trim())
      const newQuestions = []

      let questionCounter = 0
      let currentInstruction = ''

      lines.forEach((line, index) => {
        const trimmedLine = line.trim()

        // Check if this is an instruction line (starts with letter and period)
        if (trimmedLine.match(/^[A-Z]\.\s+/)) {
          currentInstruction = trimmedLine
        }
        // Check if this line contains blanks with answers in brackets
        else if (trimmedLine.includes('[') && trimmedLine.includes(']') && trimmedLine.includes('(') && trimmedLine.includes(')')) {
          // Parse the line to extract blanks and answers
          const blankMatches = trimmedLine.match(/\[([^\]]+)\]\s*\(([^)]+)\)/g)
          
          if (blankMatches) {
            const blanks = []
            let displayText = trimmedLine
            
            blankMatches.forEach(match => {
              const blankMatch = match.match(/\[([^\]]+)\]\s*\(([^)]+)\)/)
              if (blankMatch) {
                const answer = blankMatch[1]
                const hint = blankMatch[2]
                
                 // Support multiple answers separated by |, /, or ,
                 const answers = answer.split(/[|/,]/).map(a => a.trim()).filter(a => a)
                 const answerText = answers.length > 0 ? answers.join(', ') : answer
                 
                 blanks.push({
                   text: hint,
                   answer: answerText,
                   case_sensitive: false
                 })
              }
            })

            // Replace blanks in the text with _____ for display
            displayText = displayText.replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, '_____')
            
            // Create a new question for this line
            const question = {
              id: `q${Date.now()}_${questionCounter++}`,
              question: currentInstruction ? `${currentInstruction}\n\n${displayText}` : displayText,
              blanks: blanks,
              explanation: ''
            }
            
            newQuestions.push(question)
          }
        }
        // Check if this is a traditional format (Blank:/Answer:)
        else if (trimmedLine.match(/^Blank:/i)) {
          // This is handled by the traditional format logic below
        }
        // Answer line (starts with Answer:)
        else if (trimmedLine.match(/^Answer:/i)) {
          // This is handled by the traditional format logic below
        }
        // Explanation line (starts with Explanation:)
        else if (trimmedLine.match(/^(Explanation|Answer):/i)) {
          // This is handled by the traditional format logic below
        }
      })

      // If no questions were created with the new format, try traditional format
      if (newQuestions.length === 0) {
        let currentQuestion = null
        let questionText = ''
        let blanks = []

        lines.forEach((line, index) => {
          const trimmedLine = line.trim()

          // Check if this is a new question (starts with Q: or number.)
          if (trimmedLine.match(/^(Q:|Question|\d+[\.):])/i)) {
            // Save previous question if exists
            if (currentQuestion && questionText && blanks.length > 0) {
              currentQuestion.question = questionText
              currentQuestion.blanks = blanks
              newQuestions.push(currentQuestion)
            }

            // Start new question
            currentQuestion = {
              id: `q${Date.now()}_${questionCounter++}`,
              question: '',
              blanks: [],
              explanation: ''
            }
            questionText = trimmedLine.replace(/^(Q:|Question|\d+[\.):])\s*/i, '')
            blanks = []
          }
          // Blank line (starts with Blank:)
          else if (trimmedLine.match(/^Blank:/i)) {
            if (currentQuestion) {
              const blankText = trimmedLine.replace(/^Blank:\s*/i, '')
              blanks.push({
                text: blankText,
                answer: '',
                case_sensitive: false
              })
            }
          }
           // Answer line (starts with Answer:)
           else if (trimmedLine.match(/^Answer:/i)) {
             if (currentQuestion && blanks.length > 0) {
               const answerText = trimmedLine.replace(/^Answer:\s*/i, '')
               const lastBlank = blanks[blanks.length - 1]
               // Support multiple answers separated by |, /, or ,
               const answers = answerText.split(/[|/,]/).map(a => a.trim()).filter(a => a)
               lastBlank.answer = answers.length > 0 ? answers.join(', ') : answerText
             }
           }
          // Explanation line (starts with Explanation:)
          else if (trimmedLine.match(/^(Explanation|Answer):/i)) {
            if (currentQuestion) {
              currentQuestion.explanation = trimmedLine.replace(/^(Explanation|Answer):\s*/i, '')
            }
          }
          // Regular line (no blanks) - add to current question
          else if (trimmedLine && !trimmedLine.match(/^Blank|^Answer|^Explanation/i)) {
            if (currentQuestion) {
              if (questionText) {
                questionText += '\n' + line
              } else {
                questionText = line
              }
            }
          }
        })

        // Save the last question
        if (currentQuestion && questionText && blanks.length > 0) {
          currentQuestion.question = questionText
          currentQuestion.blanks = blanks
          newQuestions.push(currentQuestion)
        }
      }

      if (newQuestions.length > 0) {
        const updatedQuestions = [...localQuestions, ...newQuestions]
        setLocalQuestions(updatedQuestions)
        onQuestionsChange(updatedQuestions)
        setBulkText('')
        setBulkImportMode(false)
        alert(`Successfully imported ${newQuestions.length} questions!`)
      } else {
        alert('No valid questions found. Please check your format.')
      }
    } catch (error) {
      alert('Error processing bulk import. Please check your format.')
    }
  }

  const exportQuestions = () => {
    if (localQuestions.length === 0) {
      alert('No questions to export')
      return
    }

    const exportText = localQuestions.map((q, index) => {
      let text = `${String.fromCharCode(65 + index)}. ${q.question}\n\n`
      
      // Check if question has blanks with hints (new format)
      const hasHints = q.blanks.some(blank => blank.text && blank.text !== '')
      
      if (hasHints) {
        // Export in new format with [answer] (hint)
        q.blanks.forEach((blank, blankIndex) => {
          if (blank.text) {
            text += `${blankIndex + 1}. [${blank.answer}] (${blank.text})\n\n`
          }
        })
      } else {
        // Export in traditional format
        q.blanks.forEach((blank, blankIndex) => {
          text += `Blank: ${blank.text}\n`
          text += `Answer: ${blank.answer}\n`
        })
      }
      
      if (q.explanation) {
        text += `Explanation: ${q.explanation}\n`
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
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Fill in the Blank Questions</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkImportMode(!bulkImportMode)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Bulk Import
          </button>
          {localQuestions.length > 0 && (
            <button
              type="button"
              onClick={exportQuestions}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Copy className="w-4 h-4" />
              Export
            </button>
          )}
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>
      </div>

      {/* Bulk Import Mode */}
      {bulkImportMode && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Bulk Import Questions</h4>
          <p className="text-sm text-blue-700 mb-3">
            Format: A. Question text with [answer] (hint) blanks
            <br />
            Supports both formats: [answer] (hint) or traditional Blank:/Answer: format
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg h-40 font-mono text-sm"
                   placeholder={`A. Complete using the correct past perfect simple form of the verbs in brackets.
    
    1. By the time I arrived, everyone [had left] (leave)!
    
    2. Steve [had already seen] (already / see) the film, so he [hadn't come] (not / come) with us to the cinema.
    
    3. Tina [hadn't finished] (not / finish) doing the housework by seven o'clock, so she [had called] (call) Andrea to tell her she would be late.
    
    B. Fill in the blanks with the correct form.
    
    1. The capital of France is _____.
    Blank: _____
    Answer: Paris, Paris city
    Explanation: Paris is the capital and largest city of France.`}
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
      <div className="space-y-6">
        {localQuestions.map((question, index) => (
          <div key={question.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Question {index + 1}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 'down')}
                  disabled={index === localQuestions.length - 1}
                  className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateQuestion(index)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question
              </label>
              <textarea
                value={question.question || ''}
                onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                     className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                     rows={3}
                     placeholder="Enter your question with blanks (use _____ for blanks)... Example: By the time I arrived, everyone _____ (leave)! Steve _____ (already / see) the film, so he _____ (not / come) with us."
              />
              {/* Preview */}
              {question.question && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Preview:</p>
                  <div className="text-sm whitespace-pre-line">
                    {question.question.split(/(_____|\[blank\])/gi).map((part, partIndex) => {
                      if (part.match(/^(_____|\[blank\])$/gi)) {
                        return (
                          <span key={partIndex} className="inline-block mx-1 px-2 py-1 bg-blue-100 text-blue-800 rounded border border-blue-300">
                            _____
                          </span>
                        )
                      }
                      return <span key={partIndex}>{part}</span>
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Blanks */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Blanks
                </label>
                <button
                  type="button"
                  onClick={() => addBlank(index)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Add Blank
                </button>
              </div>
              <div className="space-y-3">
                {question.blanks.map((blank, blankIndex) => (
                  <div key={blankIndex} className="border border-gray-300 rounded-lg p-3 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hint Text (Optional)
                        </label>
                        <input
                          type="text"
                          value={blank.text}
                          onChange={(e) => updateBlank(index, blankIndex, 'text', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., leave, already / see"
                        />
                        <p className="text-xs text-gray-500 mt-1">This will appear as a hint below the input field</p>
                      </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">
                           Correct Answers
                         </label>
                         <input
                           type="text"
                           value={blank.answer}
                           onChange={(e) => updateBlank(index, blankIndex, 'answer', e.target.value)}
                           className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                           placeholder="I'm, I am, I have been"
                         />
                         <p className="text-xs text-gray-500 mt-1">Separate multiple correct answers with commas</p>
                       </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={blank.case_sensitive}
                          onChange={(e) => updateBlank(index, blankIndex, 'case_sensitive', e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Case sensitive</span>
                      </label>
                      {question.blanks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBlank(index, blankIndex)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Explanation (Optional)
              </label>
              <textarea
                value={question.explanation || ''}
                onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Explain the answer or provide additional context..."
              />
            </div>
          </div>
        ))}

        {localQuestions.length === 0 && !bulkImportMode && (
          <div className="text-center py-8 text-gray-500">
            <HelpCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No questions yet. Click "Add Question" or "Bulk Import" to start.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FillBlankEditor
