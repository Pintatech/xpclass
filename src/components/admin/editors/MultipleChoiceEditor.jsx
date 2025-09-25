import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Upload,
  Check,
  HelpCircle,
  X
} from 'lucide-react'
import { supabase } from '../../../supabase/client'
import RichTextRenderer from '../../ui/RichTextRenderer'

const MultipleChoiceEditor = ({ questions, onQuestionsChange }) => {
  const normalizeQuestion = (q, idx = 0) => {
    const safeOptions = Array.isArray(q?.options) ? q.options : ['', '', '', '']
    const safeCorrect = Number.isInteger(q?.correct_answer) ? q.correct_answer : 0
    return {
      id: q?.id || `q${Date.now()}_${idx}`,
      question: q?.question || '',
      options: safeOptions,
      correct_answer: Math.min(Math.max(0, safeCorrect), Math.max(0, safeOptions.length - 1)),
      explanation: q?.explanation || '',
      image_url: q?.image_url || '',
      reference_url: q?.reference_url || ''
    }
  }

  const [localQuestions, setLocalQuestions] = useState((questions || []).map((q, i) => normalizeQuestion(q, i)))
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const fileInputRefs = useRef({})
  const questionInputRefs = useRef({})
  const [previewOpen, setPreviewOpen] = useState({})
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
    setLocalQuestions((questions || []).map((q, i) => normalizeQuestion(q, i)))
  }, [questions])

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      options: ['', '', '', ''],
      correct_answer: 0,
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

  const insertAtCursor = (index, textToInsert) => {
    const textarea = questionInputRefs.current[index]
    const current = localQuestions[index]
    if (!textarea) {
      updateQuestion(index, 'question', (current.question || '') + (current.question ? '\n\n' : '') + textToInsert)
      return
    }
    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const value = current.question || ''
    const newValue = value.slice(0, start) + textToInsert + value.slice(end)
    updateQuestion(index, 'question', newValue)
    setTimeout(() => {
      textarea.focus()
      const caret = start + textToInsert.length
      textarea.setSelectionRange(caret, caret)
    }, 0)
  }

  const handleSelectFile = (index) => {
    if (!fileInputRefs.current[index]) return
    fileInputRefs.current[index].click()
  }

  const handleImageUpload = async (index, file) => {
    if (!file) return
    try {
      const path = `multiple_choice/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('exercise-images')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('exercise-images')
        .getPublicUrl(path)

      const publicUrl = publicData?.publicUrl
      if (!publicUrl) throw new Error('Cannot get public URL')

      insertAtCursor(index, `![](${publicUrl})`)
      alert('Image uploaded and inserted into question!')
    } catch (e) {
      console.error('Image upload failed:', e)
      alert('Image upload failed. Please ensure the bucket "exercise-images" exists and RLS allows uploads.')
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

  const handleInsertLink = (index) => {
    setUrlModal({ isOpen: true, type: 'link', questionIndex: index })
    setUrlInput('')
    setLinkText('Reference')
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

  const getImageSizeStyle = () => {
    if (imageSize === 'custom') {
      const width = customWidth ? `width="${customWidth}"` : ''
      const height = customHeight ? `height="${customHeight}"` : ''
      return `${width} ${height}`.trim()
    }
    
    const sizeMap = {
      'small': 'width="200"',
      'medium': 'width="400"',
      'large': 'width="600"',
      'full': 'width="100%"'
    }
    
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
    if (!urlInput.trim()) return
    
    try {
      new URL(urlInput.trim())
      const trimmedUrl = urlInput.trim()
      
      if (urlModal.type === 'image') {
        const sizeStyle = getImageSizeStyle()
        insertAtCursor(urlModal.questionIndex, `<img src="${trimmedUrl}" alt="" ${sizeStyle} />`)
      } else if (urlModal.type === 'link') {
        const text = linkText.trim() || 'Reference'
        insertAtCursor(urlModal.questionIndex, `[${text}](${trimmedUrl})`)
      } else if (urlModal.type === 'audio') {
        const audioAttrs = getAudioAttributes()
        insertAtCursor(urlModal.questionIndex, `<audio src="${trimmedUrl}" ${audioAttrs}></audio>`)
      }
      
      setUrlModal({ isOpen: false, type: '', questionIndex: -1 })
      setUrlInput('')
      setLinkText('')
      setImageSize('medium')
      setCustomWidth('')
      setCustomHeight('')
      setAudioControls(true)
      setAudioAutoplay(false)
      setAudioLoop(false)
    } catch (error) {
      alert('Vui lòng nhập URL hợp lệ (bắt đầu bằng http:// hoặc https://)')
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

  const markdownToHtml = (text) => {
    if (!text) return ''
    let html = text
    // Images ![alt](url) - markdown format
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (m, alt, url) => `<img src="${url}" alt="${alt || ''}" class="max-w-full h-auto rounded-lg my-2" />`)
    // HTML img tags - preserve existing attributes
    html = html.replace(/<img([^>]*?)>/g, (m, attrs) => `<img${attrs} class="max-w-full h-auto rounded-lg my-2" />`)
    // HTML audio tags - preserve existing attributes
    html = html.replace(/<audio([^>]*?)>/g, (m, attrs) => `<audio${attrs} class="w-full my-2"></audio>`)
    // Links [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, (m, text1, url) => `<a href="${url}" target="_blank" rel="noreferrer">${text1 || url}</a>`)
    return html
  }

  const updateOption = (questionIndex, optionIndex, value) => {
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? {
            ...q,
            options: q.options.map((opt, oi) => oi === optionIndex ? value : opt)
          }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const addOption = (questionIndex) => {
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, options: [...q.options, ''] }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeOption = (questionIndex, optionIndex) => {
    const question = localQuestions[questionIndex]
    if (question.options.length <= 2) return // Keep at least 2 options

    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? {
            ...q,
            options: q.options.filter((_, oi) => oi !== optionIndex),
            // Adjust correct_answer if needed
            correct_answer: q.correct_answer >= optionIndex ? Math.max(0, q.correct_answer - 1) : q.correct_answer
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
      // First, try to detect if this is Moodle Cloze format
      if (bulkText.includes('{1:MCV:') || bulkText.includes('{1:MC:') || bulkText.includes('{1:MULTICHOICE:') || bulkText.includes('{=')) {
        processMoodleCloze()
        return
      }

      // Original simple format processing
      const lines = bulkText.split('\n').filter(line => line.trim())
      const newQuestions = []

      let currentQuestion = null
      let optionCounter = 0

      lines.forEach((line, index) => {
        const trimmedLine = line.trim()

        // Question line (starts with Q: or number.)
        if (trimmedLine.match(/^(Q:|Question|\d+[\.):])/i)) {
          if (currentQuestion) {
            newQuestions.push(currentQuestion)
          }
          currentQuestion = {
            id: `q${Date.now()}_${index}`,
            question: trimmedLine.replace(/^(Q:|Question|\d+[\.):])\s*/i, ''),
            options: [],
            correct_answer: 0,
            explanation: ''
          }
          optionCounter = 0
        }
        // Continue question text (if not an option or explanation)
        else if (currentQuestion && !trimmedLine.match(/^[A-Za-z][\.):]|^\d+[\.)]|^(Explanation|Answer):/i) && trimmedLine) {
          // Add line break if question already has content
          if (currentQuestion.question) {
            currentQuestion.question += '\n' + line
          } else {
            currentQuestion.question = line
          }
        }
        // Answer options (A:, B:, C:, D: or 1., 2., 3., 4.)
        else if (trimmedLine.match(/^[A-Za-z][\.):]|^\d+[\.)]/)) {
          if (currentQuestion) {
            const optionText = trimmedLine.replace(/^[A-Za-z\d][\.):]?\s*/, '')
            // Check if this is marked as correct (contains *)
            if (optionText.includes('*') || trimmedLine.includes('*')) {
              currentQuestion.correct_answer = optionCounter
              currentQuestion.options.push(optionText.replace('*', '').trim())
            } else {
            currentQuestion.options.push(optionText)
            }
            optionCounter++
          }
        }
        // Explanation line (starts with Explanation:)
        else if (trimmedLine.match(/^(Explanation|Answer):/i)) {
          if (currentQuestion) {
            currentQuestion.explanation = trimmedLine.replace(/^(Explanation|Answer):\s*/i, '')
          }
        }
      })

      if (currentQuestion) {
        newQuestions.push(currentQuestion)
      }

      if (newQuestions.length > 0) {
      const updatedQuestions = [...localQuestions, ...newQuestions]
      setLocalQuestions(updatedQuestions)
      onQuestionsChange(updatedQuestions)
        setBulkText('')
        setBulkImportMode(false)
        alert(`Successfully imported ${newQuestions.length} questions!`)
      }
    } catch (error) {
      alert('Error processing bulk import. Please check your format.')
    }
  }

  const processMoodleCloze = () => {
    try {
      const newQuestions = []
      const lines = bulkText.split('\n')

      let currentInstruction = ''
      let questionCounter = 0

      lines.forEach((line) => {
          const trimmed = line.trim()
        if (!trimmed) return

        // Capture instruction lines like "E. Circle the correct ..."
        if (/^[A-Z]\.\s+/.test(trimmed)) {
          currentInstruction = trimmed
          return
        }

        // Each cloze occurrence on a line becomes a separate question
        const clozeMatches = [
          ...trimmed.matchAll(/\{1:MCV:([^}]+)\}/g),
          ...trimmed.matchAll(/\{1:MC:([^}]+)\}/g),
          ...trimmed.matchAll(/\{1:MULTICHOICE:([^}]+)\}/g)
        ]
        if (clozeMatches.length === 0) return

        clozeMatches.forEach((match) => {
          const optionsContent = match[1]
        const rawOptions = optionsContent.split('~').filter(opt => opt.trim())

          const options = []
          let correctIndex = 0

          rawOptions.forEach((opt) => {
            if (!opt.trim()) return
            const isCorrect = opt.trim().startsWith('=')
            const clean = opt.replace(/^=/, '').trim()
            // Remove optional inline explanations after # if any
            const optionText = clean.split('#')[0].trim()
            if (!optionText) return
            options.push(optionText)
            if (isCorrect) correctIndex = options.length - 1
          })

          if (options.length >= 2) {
            const displayText = trimmed.replace(match[0], '______')
            const questionText = currentInstruction
              ? `${currentInstruction}\n\n${displayText}`
              : displayText

          newQuestions.push({
              id: `q${Date.now()}_${questionCounter++}`,
            question: questionText,
              options,
              correct_answer: correctIndex,
              explanation: ''
            })
          }
        })
      })

      if (newQuestions.length > 0) {
        const updatedQuestions = [...localQuestions, ...newQuestions]
        setLocalQuestions(updatedQuestions)
        onQuestionsChange(updatedQuestions)
      setBulkText('')
      setBulkImportMode(false)
        alert(`Successfully imported ${newQuestions.length} Moodle Cloze questions!`)
      } else {
        alert('No valid Moodle Cloze questions found. Please check the format.')
      }
    } catch (error) {
      console.error('Moodle Cloze parsing error:', error)
      alert('Error parsing Moodle Cloze format. Please check your format or try the simple format instead.')
    }
  }

  const exportQuestions = () => {
    if (localQuestions.length === 0) {
      alert('No questions to export')
      return
    }

    const exportText = localQuestions.map((q, index) => {
      let text = `Q${index + 1}: ${q.question}\n`
      q.options.forEach((option, optIndex) => {
        const letter = String.fromCharCode(65 + optIndex)
        const marker = q.correct_answer === optIndex ? ' *' : ''
        text += `${letter}: ${option}${marker}\n`
      })
      if (q.explanation) {
        text += `Explanation: ${q.explanation}\n`
      }
      return text
    }).join('\n\n')

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
        <h3 className="text-lg font-medium text-gray-900">Multiple Choice Questions</h3>
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
            Format: Q1: Question text / A: Option 1 * / B: Option 2 / C: Option 3 / D: Option 4 / Explanation: Text
            <br />
            (Add * after correct answer)
            <br />
            <strong>Also supports Moodle Cloze format!</strong>
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg h-40 font-mono text-sm"
            placeholder={`Q1: What does "Hello" mean in Vietnamese?
A: Xin chào *
B: Tạm biệt
C: Cảm ơn
D: Xin lỗi
Explanation: Hello means Xin chào in Vietnamese.

Q2: How do you say "Good morning"?
A: Chào buổi tối
B: Chào buổi sáng *
C: Chào buổi chiều
D: Tạm biệt
Explanation: Good morning is Chào buổi sáng.`}
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
                ref={(el) => (questionInputRefs.current[index] = el)}
                value={question.question || ''}
                onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Enter your question here..."
              />
            </div>

            {/* Insert Image/Link Buttons */}
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                ref={(el) => (fileInputRefs.current[index] = el)}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(index, e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => handleSelectFile(index)}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Upload & insert image
              </button>
              <button
                type="button"
                onClick={() => handlePasteImageUrl(index)}
                className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm"
              >
                Paste image URL → insert
              </button>
              <button
                type="button"
                onClick={() => handleInsertLink(index)}
                className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm"
              >
                Insert link
              </button>
              <button
                type="button"
                onClick={() => handleInsertAudio(index)}
                className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 text-sm"
              >
                🎵 Insert audio
              </button>
              <span className="text-xs text-gray-500 self-center">Mẹo: dùng cú pháp Markdown ![](url) hoặc [text](url)</span>
            </div>

            {/* Preview toggle */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setPreviewOpen(prev => ({ ...prev, [index]: !prev[index] }))}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                {previewOpen[index] ? 'Hide Preview' : 'Preview'}
              </button>
              {previewOpen[index] && (
                <div className="mt-3 p-3 bg-white border rounded-lg">
                  <div className="text-xs text-gray-500 mb-2">Preview</div>
                  <RichTextRenderer content={markdownToHtml(question.question || '')} allowImages allowLinks className="prose max-w-none" />
                </div>
              )}
            </div>

            {/* Options */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Options
                </label>
                <button
                  type="button"
                  onClick={() => addOption(index)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Add Option
                </button>
              </div>
              <div className="space-y-2">
                {(question.options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuestion(index, 'correct_answer', optionIndex)}
                      className={`p-2 rounded border-2 transition-colors ${
                        question.correct_answer === optionIndex
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-300 hover:border-green-300'
                      }`}
                      title={question.correct_answer === optionIndex ? 'Correct answer' : 'Click to mark as correct'}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-500 w-8">
                      {String.fromCharCode(65 + optionIndex)}:
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                    />
                    {question.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index, optionIndex)}
                        className="p-2 text-red-600 hover:text-red-800"
                        title="Remove option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
                placeholder="Explain why this is the correct answer..."
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

      {/* URL Input Modal */}
      {urlModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {urlModal.type === 'image' ? 'Thêm hình ảnh' : 
                 urlModal.type === 'audio' ? 'Thêm âm thanh' : 'Thêm liên kết'}
              </h3>
              <button
                onClick={handleUrlCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text hiển thị (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Reference"
                  />
                </div>
              )}

              {urlModal.type === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kích thước hình ảnh
                  </label>
                  <div className="space-y-3">
                    {/* Size Presets */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'small', label: 'Nhỏ (200px)', icon: '📏' },
                        { value: 'medium', label: 'Trung bình (400px)', icon: '📐' },
                        { value: 'large', label: 'Lớn (600px)', icon: '📊' },
                        { value: 'full', label: 'Toàn màn hình', icon: '🖥️' }
                      ].map((size) => (
                        <button
                          key={size.value}
                          type="button"
                          onClick={() => setImageSize(size.value)}
                          className={`p-2 rounded-lg border text-sm transition-colors ${
                            imageSize === size.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <span className="mr-1">{size.icon}</span>
                          {size.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom Size */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="customSize"
                        checked={imageSize === 'custom'}
                        onChange={(e) => setImageSize(e.target.checked ? 'custom' : 'medium')}
                        className="rounded"
                      />
                      <label htmlFor="customSize" className="text-sm text-gray-700">
                        Kích thước tùy chỉnh
                      </label>
                    </div>

                    {imageSize === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Chiều rộng (px)</label>
                          <input
                            type="number"
                            value={customWidth}
                            onChange={(e) => setCustomWidth(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="400"
                            min="50"
                            max="1200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Chiều cao (px)</label>
                          <input
                            type="number"
                            value={customHeight}
                            onChange={(e) => setCustomHeight(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="300"
                            min="50"
                            max="800"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {urlModal.type === 'audio' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tùy chọn âm thanh
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="audioControls"
                        checked={audioControls}
                        onChange={(e) => setAudioControls(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="audioControls" className="text-sm text-gray-700">
                        Hiển thị controls (play/pause/volume)
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="audioAutoplay"
                        checked={audioAutoplay}
                        onChange={(e) => setAudioAutoplay(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="audioAutoplay" className="text-sm text-gray-700">
                        Tự động phát (autoplay)
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="audioLoop"
                        checked={audioLoop}
                        onChange={(e) => setAudioLoop(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="audioLoop" className="text-sm text-gray-700">
                        Lặp lại (loop)
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {urlInput && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Preview:</p>
                  {urlModal.type === 'image' ? (
                    <div>
                      <img 
                        src={urlInput} 
                        alt="Preview" 
                        className="max-w-full object-contain rounded border"
                        style={{
                          width: imageSize === 'custom' && customWidth ? `${customWidth}px` : 
                                 imageSize === 'small' ? '200px' :
                                 imageSize === 'medium' ? '400px' :
                                 imageSize === 'large' ? '600px' : '100%',
                          height: imageSize === 'custom' && customHeight ? `${customHeight}px` : 'auto',
                          maxHeight: '200px'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'block'
                        }}
                      />
                      <div className="text-sm text-red-500" style={{display: 'none'}}>
                        Không thể tải hình ảnh
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Kích thước: {imageSize === 'custom' ? 
                          `${customWidth || 'auto'} x ${customHeight || 'auto'}px` :
                          imageSize === 'small' ? '200px' :
                          imageSize === 'medium' ? '400px' :
                          imageSize === 'large' ? '600px' : '100%'}
                      </div>
                    </div>
                  ) : urlModal.type === 'audio' ? (
                    <div>
                      <audio 
                        src={urlInput} 
                        controls={audioControls}
                        autoPlay={audioAutoplay}
                        loop={audioLoop}
                        className="w-full"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'block'
                        }}
                      />
                      <div className="text-sm text-red-500" style={{display: 'none'}}>
                        Không thể tải âm thanh
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Tùy chọn: {audioControls ? 'Controls' : 'Không controls'} | 
                        {audioAutoplay ? ' Autoplay' : ' Không autoplay'} | 
                        {audioLoop ? ' Loop' : ' Không loop'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <a href={urlInput} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {linkText || urlInput}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={handleUrlCancel}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
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

export default MultipleChoiceEditor