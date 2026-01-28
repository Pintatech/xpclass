import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Wand2, Eye, EyeOff, HelpCircle, Brain, Image as ImageIcon, Music, Link as LinkIcon, X } from 'lucide-react'
import RichTextRenderer from '../../ui/RichTextRenderer'

const AIFillBlankEditor = ({ questions, onQuestionsChange, intro, onIntroChange }) => {
  const [localQuestions, setLocalQuestions] = useState([])
  const [previewMode, setPreviewMode] = useState({})
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [urlModal, setUrlModal] = useState({ isOpen: false, type: '', questionIndex: -1 })
  const [urlInput, setUrlInput] = useState('')
  const [linkText, setLinkText] = useState('')
  const [imageSize, setImageSize] = useState('medium')
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')
  const [audioControls, setAudioControls] = useState(true)
  const [audioAutoplay, setAudioAutoplay] = useState(false)
  const [audioLoop, setAudioLoop] = useState(false)

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

  const openUrlModal = (index, type) => {
    setUrlModal({ isOpen: true, type, questionIndex: index })
    setUrlInput('')
    setLinkText('')
    setImageSize('medium')
    setCustomWidth('')
    setCustomHeight('')
    setAudioControls(true)
    setAudioAutoplay(false)
    setAudioLoop(false)
  }

  const handleInsertImage = (index) => openUrlModal(index, 'image')
  const handleInsertAudio = (index) => openUrlModal(index, 'audio')
  const handleInsertLink = (index) => openUrlModal(index, 'link')

  const getImageSizeStyle = () => {
    if (imageSize === 'custom') {
      const w = customWidth ? `width="${customWidth}"` : ''
      const h = customHeight ? `height="${customHeight}"` : ''
      return `${w} ${h}`.trim()
    }
    const sizeMap = { small: 'width="200"', medium: 'width="400"', large: 'width="600"', full: 'width="100%"' }
    return sizeMap[imageSize] || sizeMap.medium
  }

  const getAudioAttributes = () => {
    const attrs = []
    if (audioControls) attrs.push('controls')
    if (audioAutoplay) attrs.push('autoplay')
    if (audioLoop) attrs.push('loop')
    return attrs.join(' ')
  }

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return
    try {
      new URL(urlInput.trim())
      const trimmedUrl = urlInput.trim()
      if (urlModal.type === 'image') {
        const sizeStyle = getImageSizeStyle()
        appendToField(urlModal.questionIndex, 'question', `<img src="${trimmedUrl}" alt="" ${sizeStyle} />`)
      } else if (urlModal.type === 'audio') {
        const audioAttrs = getAudioAttributes()
        appendToField(urlModal.questionIndex, 'question', `<audio src="${trimmedUrl}" ${audioAttrs}></audio>`)
      } else if (urlModal.type === 'link') {
        const text = linkText.trim() || trimmedUrl
        appendToField(urlModal.questionIndex, 'question', `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`)
      }
      handleUrlCancel()
    } catch {
      // invalid URL — do nothing, user can fix the input
    }
  }

  const handleUrlCancel = () => {
    setUrlModal({ isOpen: false, type: '', questionIndex: -1 })
    setUrlInput('')
    setLinkText('')
    setImageSize('medium')
    setCustomWidth('')
    setCustomHeight('')
    setAudioControls(true)
    setAudioAutoplay(false)
    setAudioLoop(false)
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
    const prompt = `Đánh giá câu trả lời điền vào chỗ trống cho câu hỏi: "${question.question}"

Đáp án mong đợi: ${question.expected_answers.join(', ')}

Yêu cầu đánh giá:
1. Điểm số từ 0-100 dựa trên độ chính xác và sự hiểu biết
2. Mức độ tin cậy từ 0-100
3. Giải thích CHI TIẾT (2-4 câu) bao gồm:
   - Tại sao câu trả lời đúng/sai
   - So sánh với đáp án đúng
   - Điểm mạnh hoặc điểm cần cải thiện
   - Gợi ý học tập (nếu câu trả lời không hoàn hảo)

Tiêu chí chấm điểm:
- Khớp chính xác: 100 điểm
- Khớp một phần: 50-90 điểm (dựa vào mức độ tương đồng)
- Hiểu khái niệm đúng: được khen thưởng
- Lỗi chính tả/ngữ pháp nhỏ: không bị phạt nặng
- Hoàn toàn sai: 0-30 điểm

Trả lời bằng tiếng Việt với giải thích chi tiết, khuyến khích học sinh.`

    updateQuestion(questionIndex, 'ai_prompt', prompt)
  }

  const processBulkImport = () => {
    try {
      const lines = bulkText.split('\n').filter(line => line.trim())
      const newQuestions = []

      let questionCounter = 0
      let currentInstruction = ''
      let accumulatedText = []

      const processAccumulatedQuestion = () => {
        if (accumulatedText.length === 0) return

        const fullText = accumulatedText.join('\n')

        // Look for expected answers in [answer1|answer2|answer3] format
        const answerMatches = [...fullText.matchAll(/\[([^\]]+)\]/g)]

        if (answerMatches.length === 0) {
          accumulatedText = []
          return
        }

        // Extract all answers (the brackets contain ONLY the expected answers)
        const expectedAnswers = []
        answerMatches.forEach((m) => {
          const answer = m[1]
          const answers = answer.split(/[|/]/).map(a => a.trim()).filter(a => a)
          expectedAnswers.push(...answers)
        })

        // Remove brackets and their content to get the question text
        const displayText = fullText.replace(/\[([^\]]+)\]/g, '')

        if (expectedAnswers.length > 0) {
          const question = {
            id: `q${Date.now()}_${questionCounter++}`,
            question: currentInstruction ? `${currentInstruction}\n\n${displayText}` : displayText,
            expected_answers: expectedAnswers,
            ai_prompt: '',
            explanation: '',
            settings: {
              min_score: 70,
              allow_partial_credit: true,
              max_attempts: 3
            }
          }
          newQuestions.push(question)
        }

        accumulatedText = []
      }

      lines.forEach((line) => {
        const trimmedLine = line.trim()

        // Check if this is an instruction line (starts with letter and period)
        if (trimmedLine.match(/^[A-Z]\.\s+/)) {
          processAccumulatedQuestion()
          currentInstruction = trimmedLine
        }
        // Check if this line looks like a new numbered question
        else if (trimmedLine.match(/^\d+\.\s+/)) {
          processAccumulatedQuestion()
          accumulatedText.push(trimmedLine)
        }
        // Regular line - add to accumulated text
        else {
          accumulatedText.push(trimmedLine)
        }
      })

      // Process the last accumulated question
      processAccumulatedQuestion()

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkImportMode(!bulkImportMode)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Bulk Import
          </button>
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>
      </div>

      {/* Exercise Intro Section */}
      <div className="bg-white p-4 border border-gray-200 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Exercise Intro (Optional)
        </label>
        <textarea
          value={intro || ''}
          onChange={(e) => onIntroChange && onIntroChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          rows={2}
          placeholder="Enter introductory text for the AI fill-in-the-blank exercise..."
        />

        {intro && intro.trim() && (
          <div className="mt-3 p-3 bg-white border rounded-lg">
            <div className="text-xs text-gray-500 mb-2">Intro Preview</div>
            <RichTextRenderer
              content={intro}
              allowImages
              allowLinks
              className="prose max-w-none"
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        )}
      </div>

      {/* Bulk Import Mode */}
      {bulkImportMode && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Bulk Import AI Fill-in-the-Blank Questions</h4>
          <p className="text-sm text-blue-700 mb-3">
            Format: Place expected answers in brackets [answer1|answer2|answer3]
            <br />
            The brackets contain ONLY the expected answers. They will be removed from the question text shown to students.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg h-40 font-mono text-sm"
            placeholder={`A. Write about your weekend activities.

1. Describe what you did last Saturday. [went to the beach|visited the beach|was at the beach]

2. What food did you enjoy? [ate seafood|had seafood|enjoyed seafood]

B. Combine these sentences using a relative clause.

1. Friendly People is a comedy. It's my favourite programme. [Friendly People, which is my favourite programme, is a comedy.|Friendly People, which is a comedy, is my favourite programme.]`}
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
        {localQuestions.length === 0 && !bulkImportMode ? (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No AI fill-in-the-blank questions yet. Click "Bulk Import" or "Add Question" to start!</p>
          </div>
        ) : localQuestions.length > 0 ? (
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
        ) : null}
      </div>

      {/* URL Insert Modal */}
      {urlModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {urlModal.type === 'image' ? 'Thêm hình ảnh' :
                 urlModal.type === 'audio' ? 'Thêm âm thanh' : 'Thêm liên kết'}
              </h3>
              <button onClick={handleUrlCancel} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder={
                    urlModal.type === 'image' ? 'https://example.com/image.jpg' :
                    urlModal.type === 'audio' ? 'https://example.com/audio.mp3' :
                    'https://example.com/link'
                  }
                  autoFocus
                />
              </div>

              {urlModal.type === 'link' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text hiển thị (tùy chọn)</label>
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Link text"
                  />
                </div>
              )}

              {urlModal.type === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kích thước hình ảnh</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'small', label: 'Nhỏ (200px)' },
                      { value: 'medium', label: 'Trung bình (400px)' },
                      { value: 'large', label: 'Lớn (600px)' },
                      { value: 'full', label: 'Toàn màn hình' }
                    ].map((size) => (
                      <button
                        key={size.value}
                        type="button"
                        onClick={() => setImageSize(size.value)}
                        className={`p-2 rounded-lg border text-sm transition-colors ${
                          imageSize === size.value
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="aiCustomSize"
                      checked={imageSize === 'custom'}
                      onChange={(e) => setImageSize(e.target.checked ? 'custom' : 'medium')}
                      className="rounded"
                    />
                    <label htmlFor="aiCustomSize" className="text-sm text-gray-700">Kích thước tùy chỉnh</label>
                  </div>
                  {imageSize === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Chiều rộng (px)</label>
                        <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="400" min="50" max="1200" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Chiều cao (px)</label>
                        <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="300" min="50" max="800" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {urlModal.type === 'audio' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tùy chọn âm thanh</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={audioControls} onChange={(e) => setAudioControls(e.target.checked)} className="rounded" />
                      <span className="text-sm text-gray-700">Hiển thị controls (play/pause/volume)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={audioAutoplay} onChange={(e) => setAudioAutoplay(e.target.checked)} className="rounded" />
                      <span className="text-sm text-gray-700">Tự động phát (autoplay)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={audioLoop} onChange={(e) => setAudioLoop(e.target.checked)} className="rounded" />
                      <span className="text-sm text-gray-700">Lặp lại (loop)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview */}
              {urlInput && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Preview:</p>
                  {urlModal.type === 'image' ? (
                    <div>
                      <img src={urlInput} alt="Preview"
                        className="max-w-full object-contain rounded border"
                        style={{
                          width: imageSize === 'custom' && customWidth ? `${customWidth}px` :
                                 imageSize === 'small' ? '200px' :
                                 imageSize === 'large' ? '600px' :
                                 imageSize === 'full' ? '100%' : '400px',
                          height: imageSize === 'custom' && customHeight ? `${customHeight}px` : 'auto',
                          maxHeight: '200px'
                        }}
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    </div>
                  ) : urlModal.type === 'audio' ? (
                    <audio src={urlInput} controls={audioControls} loop={audioLoop} className="w-full"
                      onError={(e) => { e.target.style.display = 'none' }} />
                  ) : (
                    <a href={urlInput} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                      {linkText || urlInput}
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={handleUrlCancel}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                Hủy
              </button>
              <button type="button" onClick={handleUrlSubmit} disabled={!urlInput.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400">
                {urlModal.type === 'image' ? 'Thêm hình ảnh' :
                 urlModal.type === 'audio' ? 'Thêm âm thanh' : 'Thêm liên kết'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AIFillBlankEditor
