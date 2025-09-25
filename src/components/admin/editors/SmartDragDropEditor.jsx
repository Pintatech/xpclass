import React, { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Wand2, Eye, EyeOff, HelpCircle, Upload, Copy, Image as ImageIcon, Link as LinkIcon, Music } from 'lucide-react'
import RichTextRenderer from '../../ui/RichTextRenderer'

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

const SmartDragDropEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState([])
  const [phraseInput, setPhraseInput] = useState('')
  const [distractors, setDistractors] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
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
  const questionTextareasRef = useRef({})

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
    if (!urlInput.trim()) return
    try {
      new URL(urlInput.trim())
      const trimmedUrl = urlInput.trim()
      const questionIndex = urlModal.questionIndex
      const questionId = localQuestions[questionIndex]?.id

      if (!questionId) {
        alert('Question not found')
        return
      }

      let snippet = ''
      if (urlModal.type === 'image') {
        const sizeStyle = getImageSizeStyle()
        snippet = `<img src="${trimmedUrl}" alt="" ${sizeStyle} />`
      } else if (urlModal.type === 'link') {
        const text = linkText.trim() || 'Reference'
        snippet = `[${text}](${trimmedUrl})`
      } else if (urlModal.type === 'audio') {
        const audioAttrs = getAudioAttributes()
        snippet = `<audio src="${trimmedUrl}" ${audioAttrs}></audio>`
      }

      // Update question directly
      const currentQuestion = localQuestions[questionIndex]
      const textarea = questionTextareasRef.current[questionIndex]

      if (textarea && typeof textarea.selectionStart === 'number') {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const current = currentQuestion.question || ''
        const before = current.slice(0, start)
        const after = current.slice(end)
        const newValue = `${before}${snippet}${after}`

        updateQuestion(questionId, 'question', newValue)

        // Restore cursor position
        setTimeout(() => {
          try {
            const pos = start + snippet.length
            textarea.focus()
            textarea.setSelectionRange(pos, pos)
          } catch {}
        }, 0)
      } else {
        // Fallback: append to end
        const current = currentQuestion.question || ''
        const newValue = current + (current ? '\n' : '') + snippet
        updateQuestion(questionId, 'question', newValue)
      }

      handleUrlCancel()
    } catch (e) {
      alert('Please enter a valid URL (http/https)')
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
                          {renderQuestionWithDropZones(
                            question.question,
                            question.drop_zones,
                            (zoneId, index) => {
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
                          )}
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
                        <div className="flex items-center gap-2 mb-2">
                          <button type="button" onClick={() => handlePasteImageUrl(index)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded inline-flex items-center gap-1">
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
                          onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                          ref={(el) => { questionTextareasRef.current[index] = el }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder="Enter question text with [words] in brackets for dragable items..."
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

      {/* URL Modal */}
      {urlModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {urlModal.type === 'image' ? 'Add Image' : urlModal.type === 'audio' ? 'Add Audio' : 'Add Link'}
              </h3>
              <button onClick={handleUrlCancel} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder={urlModal.type === 'image' ? 'https://example.com/image.jpg' : urlModal.type === 'audio' ? 'https://example.com/audio.mp3' : 'https://example.com/link'} />
              </div>
              {urlModal.type === 'link' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Text (optional)</label>
                  <input type="text" value={linkText} onChange={(e) => setLinkText(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Reference" />
                </div>
              )}
              {urlModal.type === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Image Size</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[
                      { value: 'small', label: 'Small (200px)' },
                      { value: 'medium', label: 'Medium (400px)' },
                      { value: 'large', label: 'Large (600px)' },
                      { value: 'full', label: 'Full Width' }
                    ].map(s => (
                      <button key={s.value} type="button" onClick={() => setImageSize(s.value)} className={`p-2 rounded border text-sm ${imageSize === s.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400'}`}>{s.label}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Width (px)</label>
                      <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Height (px)</label>
                      <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="300" />
                    </div>
                  </div>
                </div>
              )}
              {urlModal.type === 'audio' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Audio Options</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audioControls} onChange={(e) => setAudioControls(e.target.checked)} /> Show controls</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audioAutoplay} onChange={(e) => setAudioAutoplay(e.target.checked)} /> Autoplay</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audioLoop} onChange={(e) => setAudioLoop(e.target.checked)} /> Loop</label>
                </div>
              )}
              {urlInput && (
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-600 mb-2">Preview:</div>
                  {urlModal.type === 'image' ? (
                    <img src={urlInput} alt="Preview" className="max-w-full rounded border" />
                  ) : urlModal.type === 'audio' ? (
                    <audio src={urlInput} controls={audioControls} autoPlay={audioAutoplay} loop={audioLoop} className="w-full" />
                  ) : (
                    <a href={urlInput} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{linkText || urlInput}</a>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={handleUrlCancel} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
              <button type="button" onClick={handleUrlSubmit} disabled={!urlInput.trim()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400">Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SmartDragDropEditor
