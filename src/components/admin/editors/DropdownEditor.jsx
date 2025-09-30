import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Music
} from 'lucide-react'
import RichTextRenderer from '../../ui/RichTextRenderer'

const DropdownEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState(questions || [])
  const [urlModal, setUrlModal] = useState({ isOpen: false, type: '', questionIndex: -1 })
  const [urlInput, setUrlInput] = useState('')
  const [linkText, setLinkText] = useState('')
  const [imageSize, setImageSize] = useState('medium')
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')
  const [audioControls, setAudioControls] = useState(true)
  const [audioAutoplay, setAudioAutoplay] = useState(false)
  const [audioLoop, setAudioLoop] = useState(false)
  const questionTextareasRef = useRef({})

  useEffect(() => {
    setLocalQuestions(questions || [])
  }, [questions])

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      dropdowns: [{ correct_answer: '', options: [''] }],
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

  const appendToField = (index, field, snippet) => {
    const current = localQuestions[index]?.[field] || ''
    updateQuestion(index, field, (current + (current ? '\n' : '') + snippet).trim())
  }

  const insertAtCursor = (index, field, snippet) => {
    const textarea = questionTextareasRef.current[index]
    const current = localQuestions[index]?.[field] || ''

    if (textarea && typeof textarea.selectionStart === 'number' && typeof textarea.selectionEnd === 'number') {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = current.slice(0, start)
      const after = current.slice(end)
      const newValue = `${before}${snippet}${after}`
      updateQuestion(index, field, newValue)
      // Restore caret after update
      setTimeout(() => {
        try {
          const pos = start + snippet.length
          const ta = questionTextareasRef.current[index]
          if (ta) {
            ta.focus()
            ta.setSelectionRange(pos, pos)
          }
        } catch {}
      }, 0)
    } else {
      // Fallback to append when we cannot detect caret
      appendToField(index, field, snippet)
    }
  }

  const handlePasteImageUrl = (index) => {
    setUrlModal({ isOpen: true, type: 'image', questionIndex: index })
    setUrlInput('')
    setLinkText('')
    setImageSize('medium')
    setCustomWidth('')
    setCustomHeight('')
  }

  const handleInsertAudio = (index) => {
    setUrlModal({ isOpen: true, type: 'audio', questionIndex: index })
    setUrlInput('')
    setLinkText('')
    setImageSize('medium')
    setCustomWidth('')
    setCustomHeight('')
    setAudioControls(true)
    setAudioAutoplay(false)
    setAudioLoop(false)
  }

  const handleInsertLink = (index) => {
    setUrlModal({ isOpen: true, type: 'link', questionIndex: index })
    setUrlInput('')
    setLinkText('Reference')
  }

  const getImageSizeStyle = () => {
    if (imageSize === 'custom') {
      const width = customWidth ? `width="${customWidth}"` : ''
      const height = customHeight ? `height="${customHeight}"` : ''
      return `${width} ${height}`.trim()
    }
    const sizeMap = { small: 'width="200"', medium: 'width="400"', large: 'width="600"', full: 'width="100%"' }
    return sizeMap[imageSize] || sizeMap['medium']
  }

  const getAudioAttributes = () => {
    const attributes = []
    if (audioControls) attributes.push('controls')
    if (audioAutoplay) attributes.push('autoplay')
    if (audioLoop) attributes.push('loop')
    return attributes.join(' ')
  }

  const handleUrlSubmit = () => {
    const { type, questionIndex } = urlModal
    if (!urlInput.trim()) return

    let snippet = ''
    if (type === 'image') {
      const sizeStyle = getImageSizeStyle()
      snippet = `<img src="${urlInput}" ${sizeStyle} />`
    } else if (type === 'link') {
      snippet = `[${linkText || 'link'}](${urlInput})`
    } else if (type === 'audio') {
      const attributes = getAudioAttributes()
      snippet = `<audio src="${urlInput}" ${attributes}></audio>`
    }

    insertAtCursor(questionIndex, 'question', snippet)
    setUrlModal({ isOpen: false, type: '', questionIndex: -1 })
    setUrlInput('')
    setLinkText('')
  }

  const addDropdown = (questionIndex) => {
    const question = localQuestions[questionIndex]
    const updatedDropdowns = [...question.dropdowns, { correct_answer: '', options: [''] }]
    updateQuestion(questionIndex, 'dropdowns', updatedDropdowns)
  }

  const removeDropdown = (questionIndex, dropdownIndex) => {
    const question = localQuestions[questionIndex]
    const updatedDropdowns = question.dropdowns.filter((_, i) => i !== dropdownIndex)
    updateQuestion(questionIndex, 'dropdowns', updatedDropdowns)
  }

  const updateDropdown = (questionIndex, dropdownIndex, field, value) => {
    const question = localQuestions[questionIndex]
    const updatedDropdowns = question.dropdowns.map((dropdown, i) =>
      i === dropdownIndex ? { ...dropdown, [field]: value } : dropdown
    )
    updateQuestion(questionIndex, 'dropdowns', updatedDropdowns)
  }

  const addOption = (questionIndex, dropdownIndex) => {
    const question = localQuestions[questionIndex]
    const dropdown = question.dropdowns[dropdownIndex]
    const updatedOptions = [...dropdown.options, '']
    updateDropdown(questionIndex, dropdownIndex, 'options', updatedOptions)
  }

  const removeOption = (questionIndex, dropdownIndex, optionIndex) => {
    const question = localQuestions[questionIndex]
    const dropdown = question.dropdowns[dropdownIndex]
    const updatedOptions = dropdown.options.filter((_, i) => i !== optionIndex)
    updateDropdown(questionIndex, dropdownIndex, 'options', updatedOptions)
  }

  const updateOption = (questionIndex, dropdownIndex, optionIndex, value) => {
    const question = localQuestions[questionIndex]
    const dropdown = question.dropdowns[dropdownIndex]
    const updatedOptions = dropdown.options.map((opt, i) =>
      i === optionIndex ? value : opt
    )
    updateDropdown(questionIndex, dropdownIndex, 'options', updatedOptions)
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

  const insertDropdownPlaceholder = (questionIndex) => {
    insertAtCursor(questionIndex, 'question', '[dropdown]')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Dropdown Questions</h3>
          <p className="text-sm text-gray-500 mt-1">
            Use [dropdown] placeholder in the question text where you want the dropdown to appear
          </p>
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
              <div className="space-y-2">
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => insertDropdownPlaceholder(qIndex)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Insert [dropdown]
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePasteImageUrl(qIndex)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 text-sm rounded hover:bg-gray-100 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Image
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertAudio(qIndex)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 text-sm rounded hover:bg-gray-100 transition-colors"
                  >
                    <Music className="w-3.5 h-3.5" />
                    Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertLink(qIndex)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 text-sm rounded hover:bg-gray-100 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Link
                  </button>
                </div>
                <textarea
                  ref={(el) => (questionTextareasRef.current[qIndex] = el)}
                  value={question.question}
                  onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter question text with [dropdown] placeholders..."
                />
              </div>
              {question.question && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Preview:</p>
                  <RichTextRenderer content={question.question} allowImages allowLinks className="prose max-w-none" />
                </div>
              )}
            </div>

            {/* Dropdowns */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Dropdowns ({question.dropdowns.length})
                </label>
                <button
                  type="button"
                  onClick={() => addDropdown(qIndex)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded hover:bg-green-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Dropdown
                </button>
              </div>

              <div className="space-y-3">
                {question.dropdowns.map((dropdown, dIndex) => (
                  <div key={dIndex} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Dropdown {dIndex + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeDropdown(qIndex, dIndex)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Remove dropdown"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Correct Answer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Correct Answer
                      </label>
                      <input
                        type="text"
                        value={dropdown.correct_answer}
                        onChange={(e) => updateDropdown(qIndex, dIndex, 'correct_answer', e.target.value)}
                        className="w-full px-3 py-2 border border-green-300 bg-green-50 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter correct answer..."
                      />
                    </div>

                    {/* Options */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Options
                        </label>
                        <button
                          type="button"
                          onClick={() => addOption(qIndex, dIndex)}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Add Option
                        </button>
                      </div>
                      <div className="space-y-2">
                        {dropdown.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(qIndex, dIndex, oIndex, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                              placeholder={`Option ${oIndex + 1}...`}
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(qIndex, dIndex, oIndex)}
                              disabled={dropdown.options.length <= 1}
                              className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Remove option"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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

      {/* URL Modal */}
      {urlModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {urlModal.type === 'image' && 'Insert Image'}
              {urlModal.type === 'audio' && 'Insert Audio'}
              {urlModal.type === 'link' && 'Insert Link'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/file"
                />
              </div>

              {urlModal.type === 'link' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link Text
                  </label>
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Click here"
                  />
                </div>
              )}

              {urlModal.type === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Size
                  </label>
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="small">Small (200px)</option>
                    <option value="medium">Medium (400px)</option>
                    <option value="large">Large (600px)</option>
                    <option value="full">Full Width (100%)</option>
                    <option value="custom">Custom</option>
                  </select>
                  {imageSize === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input
                        type="text"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Width (e.g., 300)"
                      />
                      <input
                        type="text"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Height (e.g., 200)"
                      />
                    </div>
                  )}
                </div>
              )}

              {urlModal.type === 'audio' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={audioControls}
                      onChange={(e) => setAudioControls(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Show Controls</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={audioAutoplay}
                      onChange={(e) => setAudioAutoplay(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Autoplay</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={audioLoop}
                      onChange={(e) => setAudioLoop(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Loop</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setUrlModal({ isOpen: false, type: '', questionIndex: -1 })}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DropdownEditor