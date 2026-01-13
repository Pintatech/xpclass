import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Upload,
  Check,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  Music
} from 'lucide-react'
import RichTextRenderer from '../../ui/RichTextRenderer'
import { supabase } from '../../../supabase/client'

const FillBlankEditor = ({ questions, onQuestionsChange, settings, onSettingsChange, intro, onIntroChange }) => {
  const [localQuestions, setLocalQuestions] = useState(questions || [])
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
  const introTextareaRef = useRef(null)
  const introFileInputRef = useRef(null)

  useEffect(() => {
    setLocalQuestions(questions || [])
  }, [questions])

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      intro: '',
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

  const appendToField = (index, field, snippet) => {
    const current = localQuestions[index]?.[field] || ''
    updateQuestion(index, field, (current + (current ? '\n' : '') + snippet).trim())
  }

  const insertAtCursor = (index, field, snippet) => {
    // Handle intro (index === -1)
    if (index === -1) {
      const textarea = introTextareaRef.current
      const current = intro || ''

      if (textarea && typeof textarea.selectionStart === 'number' && typeof textarea.selectionEnd === 'number') {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const before = current.slice(0, start)
        const after = current.slice(end)
        const newValue = `${before}${snippet}${after}`
        onIntroChange && onIntroChange(newValue)
        setTimeout(() => {
          try {
            const pos = start + snippet.length
            if (textarea) {
              textarea.focus()
              textarea.setSelectionRange(pos, pos)
            }
          } catch {}
        }, 0)
      } else {
        onIntroChange && onIntroChange(current + (current ? '\n' : '') + snippet)
      }
      return
    }

    // Handle question field
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
      const idx = urlModal.questionIndex
      if (urlModal.type === 'image') {
        const sizeStyle = getImageSizeStyle()
        insertAtCursor(idx, 'question', `<img src="${trimmedUrl}" alt="" ${sizeStyle} />`)
      } else if (urlModal.type === 'link') {
        const text = linkText.trim() || 'Reference'
        insertAtCursor(idx, 'question', `[${text}](${trimmedUrl})`)
      } else if (urlModal.type === 'audio') {
        const audioAttrs = getAudioAttributes()
        insertAtCursor(idx, 'question', `<audio src="${trimmedUrl}" ${audioAttrs}></audio>`)
      }
      handleUrlCancel()
    } catch (e) {
      alert('Vui lòng nhập URL hợp lệ (http/https)')
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
        // Check if this line contains blanks with answers in brackets (with or without hint)
        else if (trimmedLine.includes('[') && trimmedLine.includes(']')) {
          const blanks = []
          let displayText = trimmedLine

          // With hint: [answer] (hint)
          const withHintMatches = [...trimmedLine.matchAll(/\[([^\]]+)\]\s*\(([^)]+)\)/g)]
          withHintMatches.forEach((m) => {
            const answer = m[1]
            const hint = m[2]
            const answers = answer.split(/[|/,]/).map(a => a.trim()).filter(a => a)
            const answerText = answers.length > 0 ? answers.join(', ') : answer
            blanks.push({ text: '', answer: answerText, case_sensitive: false })
          })
          // Replace with-hint occurrences with blank keeping hint text
          displayText = displayText.replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, (m, a, h) => `_____ (${h})`)

          // Without hint: [answer] not followed by (...)
          const noHintMatches = [...trimmedLine.matchAll(/\[([^\]]+)\](?!\s*\()/g)]
          noHintMatches.forEach((m) => {
            const answer = m[1]
            const answers = answer.split(/[|/,]/).map(a => a.trim()).filter(a => a)
            const answerText = answers.length > 0 ? answers.join(', ') : answer
            blanks.push({ text: '', answer: answerText, case_sensitive: false })
          })
          // Replace no-hint occurrences with blank only
          displayText = displayText.replace(/\[([^\]]+)\](?!\s*\()/g, '_____')

          if (blanks.length > 0) {
            const question = {
              id: `q${Date.now()}_${questionCounter++}`,
              question: currentInstruction ? `${currentInstruction}\n\n${displayText}` : displayText,
              blanks: blanks,
              explanation: ''
            }
            newQuestions.push(question)
          }
        }
      })

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
      // Simply export the question text as-is (already contains _____)
      let text = `${String.fromCharCode(65 + index)}. ${q.question}\n\n`

      // Note: The question text already has _____ blanks in it
      // We could optionally add answer key below for reference
      if (q.blanks && q.blanks.length > 0) {
        text += 'Answers:\n'
        q.blanks.forEach((blank, blankIndex) => {
          text += `${blankIndex + 1}. ${blank.answer}\n`
        })
        text += '\n'
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

  // Convert simple markdown/HTML to safe HTML for preview (align with MultipleChoice)
  const markdownToHtml = (text) => {
    if (!text) return ''
    let html = text
    // Highlight blank underscores (_____ exactly 5 underscores) with prominent blue styling
    html = html.replace(
      /(_{5})/g,
      '<span class="inline-block align-baseline text-blue-700 font-bold bg-blue-50 border border-blue-200 rounded px-1">_____</span>'
    )
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

  return (
    <>
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

      {/* Global Intro Section */}
      <div className="bg-white p-4 border border-gray-200 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Exercise Intro (Optional)
        </label>
        <textarea
          ref={introTextareaRef}
          value={intro || ''}
          onChange={(e) => onIntroChange && onIntroChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
              e.preventDefault()
              const textarea = introTextareaRef.current
              if (!textarea) return
              const start = textarea.selectionStart
              const end = textarea.selectionEnd
              const current = intro || ''
              const selectedText = current.slice(start, end)
              if (selectedText) {
                const newValue = current.slice(0, start) + `<b>${selectedText}</b>` + current.slice(end)
                onIntroChange && onIntroChange(newValue)
                setTimeout(() => {
                  textarea.focus()
                  textarea.setSelectionRange(start + 3, start + 3 + selectedText.length)
                }, 0)
              }
            }
          }}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder="Enter introductory text for the fill-in-the-blank exercise..."
        />

        {/* Insert Media Buttons for Intro */}
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            ref={introFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const path = `fill_blank/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`
                const { error: uploadError } = await supabase.storage
                  .from('exercise-images')
                  .upload(path, file, { cacheControl: '3600', upsert: true })
                if (uploadError) throw uploadError

                const { data: publicData } = supabase.storage
                  .from('exercise-images')
                  .getPublicUrl(path)

                const publicUrl = publicData?.publicUrl
                if (!publicUrl) throw new Error('Cannot get public URL')

                // Insert at cursor position in intro
                const textarea = introTextareaRef.current
                const current = intro || ''
                if (!textarea) {
                  onIntroChange && onIntroChange(current + (current ? '\n\n' : '') + `![](${publicUrl})`)
                  return
                }
                const start = textarea.selectionStart || 0
                const end = textarea.selectionEnd || 0
                const textToInsert = `\n![](${publicUrl})\n`
                const newValue = current.slice(0, start) + textToInsert + current.slice(end)
                onIntroChange && onIntroChange(newValue)
                setTimeout(() => {
                  textarea.focus()
                  const caret = start + textToInsert.length
                  textarea.setSelectionRange(caret, caret)
                }, 0)
                alert('Image uploaded and inserted into intro!')
              } catch (e) {
                console.error('Image upload failed:', e)
                alert('Image upload failed. Please ensure the bucket "exercise-images" exists and RLS allows uploads.')
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const input = introFileInputRef.current
              if (input) input.click()
            }}
            className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
          <button
            type="button"
            onClick={() => {
              setUrlModal({ isOpen: true, type: 'image', questionIndex: -1 })
              setUrlInput('')
              setLinkText('')
              setImageSize('medium')
              setCustomWidth('')
              setCustomHeight('')
            }}
            className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-2"
            title="Insert image"
          >
            <ImageIcon className="w-4 h-4" />
            Insert image
          </button>
          <button
            type="button"
            onClick={() => {
              setUrlModal({ isOpen: true, type: 'link', questionIndex: -1 })
              setUrlInput('')
              setLinkText('Reference')
            }}
            className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-2"
            title="Insert link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setUrlModal({ isOpen: true, type: 'audio', questionIndex: -1 })
              setUrlInput('')
              setLinkText('')
              setImageSize('medium')
              setCustomWidth('')
              setCustomHeight('')
              setAudioControls(true)
              setAudioAutoplay(false)
              setAudioLoop(false)
            }}
            className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 text-sm"
          >
            🎵 Insert audio
          </button>
        </div>

        {intro && intro.trim() && (
          <div className="mt-3 p-3 bg-white border rounded-lg">
            <div className="text-xs text-gray-500 mb-2">Intro Preview</div>
            <RichTextRenderer content={markdownToHtml(intro)} allowImages allowLinks className="prose max-w-none" />
          </div>
        )}
      </div>

      {/* Display Settings */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Display Settings</h4>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings?.show_all_questions || false}
            onChange={(e) => onSettingsChange?.({ ...settings, show_all_questions: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">Show all questions on one page</span>
            <p className="text-xs text-gray-600 mt-0.5">Students will see all questions at once and submit together (instead of one question at a time)</p>
          </div>
        </label>
      </div>

      {/* Bulk Import Mode */}
      {bulkImportMode && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Bulk Import Questions</h4>
          <p className="text-sm text-blue-700 mb-3">
            Format: Use [answer] for blanks, or [answer] (hint) for blanks with hints
            <br />
            Multiple answers: [answer1|answer2|answer3] or [answer1, answer2]
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

1. The capital of France is [Paris].

2. Water boils at [100] degrees Celsius.`}
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

            {/* Question Intro */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Intro (Optional)
              </label>
              <textarea
                value={question.intro || ''}
                onChange={(e) => updateQuestion(index, 'intro', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Enter introductory text for this specific question..."
              />
              {question.intro && question.intro.trim() && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Preview:</p>
                  <div className="prose max-w-none">
                    <RichTextRenderer content={markdownToHtml(question.intro)} allowImages allowLinks />
                  </div>
                </div>
              )}
            </div>

            {/* Question Text */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question
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
                value={question.question || ''}
                onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                    e.preventDefault()
                    const textarea = questionTextareasRef.current[index]
                    if (!textarea) return
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const current = question.question || ''
                    const selectedText = current.slice(start, end)
                    if (selectedText) {
                      const newValue = current.slice(0, start) + `<b>${selectedText}</b>` + current.slice(end)
                      updateQuestion(index, 'question', newValue)
                      setTimeout(() => {
                        textarea.focus()
                        textarea.setSelectionRange(start + 3, start + 3 + selectedText.length)
                      }, 0)
                    }
                  }
                }}
                ref={(el) => { questionTextareasRef.current[index] = el }}
                     className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                     rows={3}
                     placeholder="Enter your question with blanks (use exactly 5 underscores _____ for blanks)... Example: By the time I arrived, everyone _____ (leave)! Steve _____ (already / see) the film, so he _____ (not / come) with us."
              />
              {/* Preview */}
              {question.question && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Preview:</p>
                  <div className="prose max-w-none">
                    <RichTextRenderer content={markdownToHtml(question.question)} allowImages allowLinks />
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
                      {/* Hint input removed per request */}
                      <div className="hidden">
                        <input type="hidden" value={blank.text} readOnly />
                      </div>
                       <div className="md:col-span-2">
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
    {urlModal.isOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{urlModal.type === 'image' ? 'Thêm hình ảnh' : urlModal.type === 'audio' ? 'Thêm âm thanh' : 'Thêm liên kết'}</h3>
            <button onClick={handleUrlCancel} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder={urlModal.type === 'image' ? 'https://example.com/image.jpg' : urlModal.type === 'audio' ? 'https://example.com/audio.mp3' : 'https://example.com/link'} />
            </div>
            {urlModal.type === 'link' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text hiển thị (tùy chọn)</label>
                <input type="text" value={linkText} onChange={(e) => setLinkText(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Reference" />
              </div>
            )}
            {urlModal.type === 'image' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kích thước hình ảnh</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    { value: 'small', label: 'Nhỏ (200px)' },
                    { value: 'medium', label: 'Trung bình (400px)' },
                    { value: 'large', label: 'Lớn (600px)' },
                    { value: 'full', label: 'Toàn màn hình' }
                  ].map(s => (
                    <button key={s.value} type="button" onClick={() => setImageSize(s.value)} className={`p-2 rounded border text-sm ${imageSize === s.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400'}`}>{s.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Rộng (px)</label>
                    <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Cao (px)</label>
                    <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm" placeholder="300" />
                  </div>
                </div>
              </div>
            )}
            {urlModal.type === 'audio' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tùy chọn âm thanh</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={audioControls} onChange={(e) => setAudioControls(e.target.checked)} /> Hiển thị controls</label>
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
            <button type="button" onClick={handleUrlCancel} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Hủy</button>
            <button type="button" onClick={handleUrlSubmit} disabled={!urlInput.trim()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400">Chèn</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default FillBlankEditor
