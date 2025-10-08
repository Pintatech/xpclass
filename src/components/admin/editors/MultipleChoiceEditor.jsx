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
  X,
  Table
} from 'lucide-react'
import { supabase } from '../../../supabase/client'
import RichTextRenderer from '../../ui/RichTextRenderer'

const MultipleChoiceEditor = ({ questions, onQuestionsChange }) => {
  const normalizeQuestion = (q, idx = 0) => {
    const safeOptions = Array.isArray(q?.options) ? q.options : ['', '', '', '']
    const baseOptionExplanations = Array.isArray(q?.option_explanations)
      ? q.option_explanations
      : Array(safeOptions.length).fill('')
    // Ensure option_explanations length matches options
    const safeOptionExplanations = safeOptions.map((_, i) => baseOptionExplanations[i] || '')
    const safeCorrect = Number.isInteger(q?.correct_answer) ? q.correct_answer : 0
    return {
      id: q?.id || `q${Date.now()}_${idx}`,
      question: q?.question || '',
      options: safeOptions,
      correct_answer: Math.min(Math.max(0, safeCorrect), Math.max(0, safeOptions.length - 1)),
      explanation: q?.explanation || '',
      option_explanations: safeOptionExplanations,
      original_text: q?.original_text || '',
      image_url: q?.image_url || '',
      reference_url: q?.reference_url || '',
      shuffle_options: q?.shuffle_options !== undefined ? q.shuffle_options : true
    }
  }

  const [localQuestions, setLocalQuestions] = useState((questions || []).map((q, i) => normalizeQuestion(q, i)))
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [lastBulkText, setLastBulkText] = useState('')

  // Load lastBulkText from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xpclass_last_bulk_text')
      if (saved) setLastBulkText(saved)
    } catch {}
  }, [])
  const fileInputRefs = useRef({})
  const questionInputRefs = useRef({})
  const explanationInputRefs = useRef({})
  const [previewOpen, setPreviewOpen] = useState({})
  const [urlModal, setUrlModal] = useState({ isOpen: false, type: '', questionIndex: -1 })
  const [urlInput, setUrlInput] = useState('')
  const [linkText, setLinkText] = useState('Reference')
  const [imageSize, setImageSize] = useState('medium')
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')
  const [audioControls, setAudioControls] = useState(true)
  const [audioAutoplay, setAudioAutoplay] = useState(false)
  const [audioLoop, setAudioLoop] = useState(false)
  const [collapsedQuestions, setCollapsedQuestions] = useState({})
  const [undoHistory, setUndoHistory] = useState({})
  const [redoHistory, setRedoHistory] = useState({})
  const [tableModal, setTableModal] = useState({ isOpen: false, questionIndex: -1 })
  const [tableRows, setTableRows] = useState(2)
  const [tableColumns, setTableColumns] = useState(2)
  const [tableWidth, setTableWidth] = useState('100%') // '100%' or 'auto'
  const [tableBorder, setTableBorder] = useState(true) // true or false

  useEffect(() => {
    setLocalQuestions((questions || []).map((q, i) => normalizeQuestion(q, i)))
  }, [questions])

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      explanation: '',
      shuffle_options: true
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

  const updateQuestion = (index, field, value, saveToHistory = true) => {
    // Save to undo history before updating
    if (saveToHistory && (field === 'question' || field === 'explanation')) {
      const historyKey = `${index}_${field}`
      setUndoHistory(prev => ({
        ...prev,
        [historyKey]: [...(prev[historyKey] || []), localQuestions[index]?.[field] || '']
      }))
      // Clear redo history when new change is made
      setRedoHistory(prev => ({
        ...prev,
        [historyKey]: []
      }))
    }

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

  const handleKeyboardShortcut = (e, index, field = 'question') => {
    // Only handle Ctrl/Cmd key combinations
    if (!e.ctrlKey && !e.metaKey) return

    const textarea = field === 'question'
      ? questionInputRefs.current[index]
      : explanationInputRefs.current[index]
    if (!textarea) return

    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const value = localQuestions[index]?.[field] || ''
    const selectedText = value.substring(start, end)
    const historyKey = `${index}_${field}`

    // Ctrl+B - Bold
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault()
      if (selectedText) {
        // Check if text is already bold by looking at surrounding characters
        const beforeHtml = value.slice(Math.max(0, start - 3), start)
        const afterHtml = value.slice(end, Math.min(value.length, end + 4))

        let newValue
        let newSelectionStart, newSelectionEnd

        // Check HTML bold
        if (beforeHtml === '<b>' && afterHtml === '</b>') {
          // Remove HTML bold
          newValue = value.slice(0, start - 3) + selectedText + value.slice(end + 4)
          newSelectionStart = start - 3
          newSelectionEnd = start - 3 + selectedText.length
        }
        // Add bold
        else {
          newValue = value.slice(0, start) + `<b>${selectedText}</b>` + value.slice(end)
          newSelectionStart = start + 3
          newSelectionEnd = start + 3 + selectedText.length
        }

        updateQuestion(index, field, newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
        }, 0)
      } else {
        const newValue = value.slice(0, start) + '<b></b>' + value.slice(end)
        updateQuestion(index, field, newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + 3, start + 3)
        }, 0)
      }
      return
    }

    // Ctrl+I - Italic
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault()
      if (selectedText) {
        // Check if text is already italic by looking at surrounding characters
        const beforeHtml = value.slice(Math.max(0, start - 3), start)
        const afterHtml = value.slice(end, Math.min(value.length, end + 4))

        let newValue
        let newSelectionStart, newSelectionEnd

        // Check HTML italic
        if (beforeHtml === '<i>' && afterHtml === '</i>') {
          // Remove HTML italic
          newValue = value.slice(0, start - 3) + selectedText + value.slice(end + 4)
          newSelectionStart = start - 3
          newSelectionEnd = start - 3 + selectedText.length
        }
        // Add italic
        else {
          newValue = value.slice(0, start) + `<i>${selectedText}</i>` + value.slice(end)
          newSelectionStart = start + 3
          newSelectionEnd = start + 3 + selectedText.length
        }

        updateQuestion(index, field, newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
        }, 0)
      } else {
        const newValue = value.slice(0, start) + '<i></i>' + value.slice(end)
        updateQuestion(index, field, newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + 3, start + 3)
        }, 0)
      }
      return
    }

    // Ctrl+U - Underline
    if (e.key === 'u' || e.key === 'U') {
      e.preventDefault()
      if (selectedText) {
        // Check if text is already underlined by looking at surrounding characters
        const beforeHtml = value.slice(Math.max(0, start - 3), start)
        const afterHtml = value.slice(end, Math.min(value.length, end + 4))

        let newValue
        let newSelectionStart, newSelectionEnd

        // Check HTML underline
        if (beforeHtml === '<u>' && afterHtml === '</u>') {
          // Remove underline
          newValue = value.slice(0, start - 3) + selectedText + value.slice(end + 4)
          newSelectionStart = start - 3
          newSelectionEnd = start - 3 + selectedText.length
        }
        // Add underline
        else {
          newValue = value.slice(0, start) + `<u>${selectedText}</u>` + value.slice(end)
          newSelectionStart = start + 3
          newSelectionEnd = start + 3 + selectedText.length
        }

        updateQuestion(index, field, newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(newSelectionStart, newSelectionEnd)
        }, 0)
      } else {
        const newValue = value.slice(0, start) + '<u></u>' + value.slice(end)
        updateQuestion(index, field, newValue)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + 3, start + 3)
        }, 0)
      }
      return
    }

    // Ctrl+Z - Undo
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault()
      const history = undoHistory[historyKey] || []
      if (history.length > 0) {
        const previousValue = history[history.length - 1]
        const currentValue = localQuestions[index]?.[field] || ''

        // Save current state to redo
        setRedoHistory(prev => ({
          ...prev,
          [historyKey]: [...(prev[historyKey] || []), currentValue]
        }))

        // Remove from undo history
        setUndoHistory(prev => ({
          ...prev,
          [historyKey]: history.slice(0, -1)
        }))

        // Restore previous value
        updateQuestion(index, field, previousValue, false)

        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(previousValue.length, previousValue.length)
        }, 0)
      }
      return
    }

    // Ctrl+Y or Ctrl+Shift+Z - Redo
    if ((e.key === 'y' || e.key === 'Y') || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
      e.preventDefault()
      const history = redoHistory[historyKey] || []
      if (history.length > 0) {
        const nextValue = history[history.length - 1]
        const currentValue = localQuestions[index]?.[field] || ''

        // Save current state to undo
        setUndoHistory(prev => ({
          ...prev,
          [historyKey]: [...(prev[historyKey] || []), currentValue]
        }))

        // Remove from redo history
        setRedoHistory(prev => ({
          ...prev,
          [historyKey]: history.slice(0, -1)
        }))

        // Restore next value
        updateQuestion(index, field, nextValue, false)

        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(nextValue.length, nextValue.length)
        }, 0)
      }
      return
    }
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

      insertAtCursor(index, `\n![](${publicUrl})\n`)
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

  const handleInsertTable = (index) => {
    setTableModal({ isOpen: true, questionIndex: index })
    setTableRows(2)
    setTableColumns(2)
    setTableWidth('100%')
    setTableBorder(true)
  }

  const handleTableSubmit = () => {
    const rows = parseInt(tableRows) || 2
    const cols = parseInt(tableColumns) || 2

    // Determine table layout based on width setting
    const isFlexible = tableWidth === 'auto'
    const tableLayout = isFlexible ? 'auto' : 'fixed'
    const widthStyle = tableWidth

    // Determine border style
    const borderStyle = tableBorder ? 'border: 1px solid #ddd;' : 'border: none;'

    let tableHTML = `<table style="width: ${widthStyle}; border-collapse: collapse; margin: 10px 0; table-layout: ${tableLayout};">\n`

    for (let i = 0; i < rows; i++) {
      tableHTML += '  <tr>\n'
      for (let j = 0; j < cols; j++) {
        const cellNumber = i * cols + j + 1
        // Only add width for fixed layout tables
        const cellWidth = isFlexible ? '' : ` width: ${Math.floor(100 / cols)}%;`
        tableHTML += `    <td style="${borderStyle} padding: 8px;${cellWidth} vertical-align: top;">Cell ${cellNumber}</td>\n`
      }
      tableHTML += '  </tr>\n'
    }

    tableHTML += '</table>'

    insertAtCursor(tableModal.questionIndex, tableHTML)
    setTableModal({ isOpen: false, questionIndex: -1 })
  }

  const handleTableCancel = () => {
    setTableModal({ isOpen: false, questionIndex: -1 })
    setTableRows(2)
    setTableColumns(2)
    setTableWidth('100%')
    setTableBorder(true)
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
        insertAtCursor(urlModal.questionIndex, `\n<img src="${trimmedUrl}" alt="" ${sizeStyle} />\n`)
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
            options: q.options.map((opt, oi) => oi === optionIndex ? value : opt),
            option_explanations: (q.option_explanations || Array(q.options.length).fill(''))
              .map((exp, oi) => oi === optionIndex ? (q.option_explanations?.[oi] || '') : exp)
          }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const addOption = (questionIndex) => {
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, options: [...q.options, ''], option_explanations: [...(q.option_explanations || []), ''] }
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
            option_explanations: (q.option_explanations || []).filter((_, oi) => oi !== optionIndex),
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

  const toggleCollapse = (index) => {
    setCollapsedQuestions(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const toggleAllQuestions = () => {
    const anyExpanded = localQuestions.some((_, index) => !collapsedQuestions[index])

    if (anyExpanded) {
      // Collapse all
      const allCollapsed = {}
      localQuestions.forEach((_, index) => {
        allCollapsed[index] = true
      })
      setCollapsedQuestions(allCollapsed)
    } else {
      // Expand all
      setCollapsedQuestions({})
    }
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
        // Explanation line starting with #
        else if (currentQuestion && /^#/.test(trimmedLine)) {
          const expl = trimmedLine.replace(/^#\s*/, '')
          currentQuestion.explanation = currentQuestion.explanation
            ? currentQuestion.explanation + '\n' + expl
            : expl
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
        setLastBulkText(bulkText)
        try { localStorage.setItem('xpclass_last_bulk_text', bulkText) } catch {}
        // Attach original_text to every imported question
        const updatedQuestions = [...localQuestions, ...newQuestions.map(q => ({ ...q, original_text: bulkText }))]
        setLocalQuestions(updatedQuestions)
        onQuestionsChange(updatedQuestions)
        // Keep modal open and keep the text visible
        alert(`Successfully imported ${newQuestions.length} questions!`)
      }
    } catch (error) {
      alert('Error processing bulk import. Please check your format.')
    }
  }

  const processMoodleCloze = () => {
    try {
      const newQuestions = []

      // First, merge multi-line cloze patterns into single lines
      let processedText = bulkText

      // Replace newlines within cloze patterns with spaces
      // Match opening brace until closing brace, even across newlines
      processedText = processedText.replace(/\{1:(MCV|MC|MULTICHOICE):([^}]*)\}/gs, (match) => {
        // Remove newlines but preserve the structure
        // Keep ~ separators intact by adding space before them if needed
        return match.replace(/\s*\n\s*~/g, '~').replace(/\s*\n\s*/g, ' ')
      })

      const lines = processedText.split('\n')

      let questionCounter = 0
      let currentQuestionText = ''
      let explanationText = ''

      lines.forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed) return

        // Check if this line starts a new question (Question 1, Question 2, etc.)
        if (/^Question\s+\d+/i.test(trimmed)) {
          // Save any accumulated question text and start fresh
          currentQuestionText = ''
          explanationText = ''
          return
        }

        // Explanation lines starting with #
        if (/^#/.test(trimmed)) {
          const expl = trimmed.replace(/^#\s*/, '')
          explanationText = explanationText ? `${explanationText}\n${expl}` : expl
          return
        }

        // Check if line contains a cloze pattern
        const clozeMatches = [
          ...trimmed.matchAll(/\{1:MCV:([^}]+)\}/g),
          ...trimmed.matchAll(/\{1:MC:([^}]+)\}/g),
          ...trimmed.matchAll(/\{1:MULTICHOICE:([^}]+)\}/g)
        ]

        // If no cloze pattern, accumulate this line as part of question text
        if (clozeMatches.length === 0) {
          if (currentQuestionText) {
            currentQuestionText += '\n' + trimmed
          } else {
            currentQuestionText = trimmed
          }
          return
        }

        // Process each cloze pattern on this line
        clozeMatches.forEach((match) => {
          const optionsContent = match[1]
          const rawOptions = optionsContent.split('~').filter(opt => opt.trim())

        const options = []
        const optionExplanations = []
          let correctIndex = 0

          rawOptions.forEach((opt) => {
            if (!opt.trim()) return
            const isCorrect = opt.trim().startsWith('=')
            const clean = opt.replace(/^=/, '').trim()
          // Capture optional inline explanations after # per option
          let optionText = clean
          if (clean.includes('#')) {
            const [before, after] = clean.split('#')
            optionText = before.trim()
            const perOptionExplanation = (after || '').trim()
            // Temporarily push placeholder; set explanation after pushing option
            // We'll align indices with options
            // Note: we don't merge per-option explanation into global explanationText
            // so that UI can show explanation specific to the selected option
            if (perOptionExplanation) {
              optionExplanations.push(perOptionExplanation)
            } else {
              optionExplanations.push('')
            }
          } else {
            optionText = optionText.trim()
            optionExplanations.push('')
          }
            // Remove A., B., C., D. prefixes (or any letter followed by dot/parenthesis)
            optionText = optionText.replace(/^[A-Za-z][\.)]\s*/, '')
            if (!optionText) return
            options.push(optionText)
            if (isCorrect) correctIndex = options.length - 1
          })

          if (options.length >= 2) {
            // Combine accumulated question text with current line
            let fullQuestion = currentQuestionText ? currentQuestionText + '\n' + trimmed : trimmed
            // Replace the cloze pattern with ______
            const displayText = fullQuestion.replace(match[0], '______')

            newQuestions.push({
              id: `q${Date.now()}_${questionCounter++}`,
              question: displayText,
              options,
              correct_answer: correctIndex,
            explanation: explanationText,
            option_explanations: optionExplanations,
              shuffle_options: false
            })

            // Reset accumulated text after creating question
            currentQuestionText = ''
            explanationText = ''
          }
        })
      })

      if (newQuestions.length > 0) {
        setLastBulkText(bulkText)
        try { localStorage.setItem('xpclass_last_bulk_text', bulkText) } catch {}
        // Attach original_text to every imported question
        const updatedQuestions = [...localQuestions, ...newQuestions.map(q => ({ ...q, original_text: bulkText }))]
        setLocalQuestions(updatedQuestions)
        onQuestionsChange(updatedQuestions)
        // Keep modal open and keep the text visible
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
            Bulk
          </button>
          {localQuestions.length > 0 && (
            <button
              type="button"
              onClick={toggleAllQuestions}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              {localQuestions.some((_, index) => !collapsedQuestions[index]) ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Expand
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add 1
          </button>
        </div>
      </div>

      {/* Bulk Import Mode */}
      {bulkImportMode && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Bulk Import Questions</h4>
          <p className="text-sm text-blue-700 mb-3">
            <strong>Simple format:</strong> Q1: Question text / A: Option 1 * / B: Option 2 / C: Option 3 / D: Option 4
            <br />
            - Đáp án đúng: đánh dấu <code>*</code> sau option
            <br />
            - Giải thích cho câu hỏi: bắt đầu dòng bằng <code>#</code> hoặc dùng <code>Explanation:</code>
            <br />
            <strong>Moodle Cloze:</strong> ví dụ {`{1:MC:=Option A#Giải thích A~Option B#Giải thích B~Option C}`}
            <br />
            - Phần sau dấu <code>#</code> trong mỗi option sẽ hiển thị khi người học chọn option đó
            <br />
            - Có thể thêm nhiều dòng giải thích cho cả câu hỏi với <code>#</code>
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
# Hello means Xin chào in Vietnamese.

Question 2
Good morning in Vietnamese is {1:MC:=Chào buổi sáng#Correct explanation~Chào buổi chiều#Afternoon greeting~Tạm biệt#Means goodbye}
# Extra note for the whole question`}
          />
          <div className="flex justify-between items-center mt-2">
            <button
              type="button"
              onClick={() => setBulkText(lastBulkText)}
              disabled={!lastBulkText}
              className={`px-3 py-2 rounded-lg text-sm ${lastBulkText ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              title={lastBulkText ? 'Restore last imported text' : 'No previous import yet'}
            >
              Restore last import
            </button>
            <span className="text-xs text-gray-500">Văn bản cuối: {lastBulkText ? `${Math.min(lastBulkText.length, 60)} chars` : 'none'}</span>
          </div>
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
        {localQuestions.map((question, index) => {
          const isCollapsed = collapsedQuestions[index]
          return (
          <div key={question.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCollapse(index)}
                  className="p-1 text-gray-600 hover:text-gray-900"
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>
                <span className="text-sm font-medium text-gray-700">
                  Question {index + 1}
                  {isCollapsed && question.question && (
                    <span className="ml-2 text-xs text-gray-500 truncate max-w-md inline-block">
                      - {question.question.substring(0, 50)}{question.question.length > 50 ? '...' : ''}
                    </span>
                  )}
                </span>
              </div>
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

            {!isCollapsed && (
              <div>

            {/* Question Text */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question
                <span className="ml-2 text-xs text-gray-500">
                  (Ctrl+B: Bold, Ctrl+I: Italic, Ctrl+U: Underline, Ctrl+Z: Undo)
                </span>
              </label>
              <textarea
                ref={(el) => (questionInputRefs.current[index] = el)}
                value={question.question || ''}
                onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                onKeyDown={(e) => handleKeyboardShortcut(e, index)}
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
                <Upload className="w-4 h-4" /> Upload
              </button>
              <button
                type="button"
                onClick={() => handlePasteImageUrl(index)}
                className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm"
              >
                Paste URL
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
              <button
                type="button"
                onClick={() => handleInsertTable(index)}
                className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm flex items-center gap-2"
              >
                <Table className="w-4 h-4" /> Insert table
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
                  <div key={optionIndex} className="flex items-start gap-2">
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
                    <input
                      type="text"
                      value={(question.option_explanations && question.option_explanations[optionIndex]) || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        const updated = localQuestions.map((q, qi) =>
                          qi === index
                            ? {
                                ...q,
                                option_explanations: (q.option_explanations || Array(q.options.length).fill('')).map((exp, ei) =>
                                  ei === optionIndex ? value : exp
                                )
                              }
                            : q
                        )
                        setLocalQuestions(updated)
                        onQuestionsChange(updated)
                      }}
                      className="w-64 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={`Explanation ${String.fromCharCode(65 + optionIndex)}`}
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

            {/* Shuffle Options Toggle */}
            <div className="mb-4 flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
              <input
                type="checkbox"
                id={`shuffle-${index}`}
                checked={question.shuffle_options !== false}
                onChange={(e) => updateQuestion(index, 'shuffle_options', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor={`shuffle-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                Randomize answer order (shuffle options when displayed to students)
              </label>
            </div>

            {/* Explanation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Explanation (Optional)
                <span className="ml-2 text-xs text-gray-500">
                  (Ctrl+B: Bold, Ctrl+I: Italic, Ctrl+U: Underline, Ctrl+Z: Undo)
                </span>
              </label>
              <textarea
                ref={(el) => (explanationInputRefs.current[index] = el)}
                value={question.explanation || ''}
                onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                onKeyDown={(e) => handleKeyboardShortcut(e, index, 'explanation')}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Explain why this is the correct answer..."
              />
              {question.original_text && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-600 cursor-pointer">Original import text</summary>
                  <pre className="mt-1 p-2 bg-gray-50 border rounded text-xs whitespace-pre-wrap">{question.original_text}</pre>
                </details>
              )}
            </div>
              </div>
            )}
          </div>
        )
        })}

        {localQuestions.length === 0 && !bulkImportMode && (
          <div className="text-center py-8 text-gray-500">
            <HelpCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No questions yet. Click "Add Question" or "Bulk Import" to start.</p>
          </div>
        )}
      </div>

      {/* Table Input Modal */}
      {tableModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Insert Table</h3>
              <button
                onClick={handleTableCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Rows
                </label>
                <input
                  type="number"
                  value={tableRows}
                  onChange={(e) => setTableRows(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Columns
                </label>
                <input
                  type="number"
                  value={tableColumns}
                  onChange={(e) => setTableColumns(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Table Width
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTableWidth('100%')}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm transition-colors ${
                      tableWidth === '100%'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Full Width (100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableWidth('auto')}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm transition-colors ${
                      tableWidth === 'auto'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Flexible (Auto)
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {tableWidth === '100%'
                    ? 'Table stretches to full width with equal columns'
                    : 'Table shrinks to fit content size'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Border Style
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTableBorder(true)}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm transition-colors ${
                      tableBorder
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    With Borders
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableBorder(false)}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm transition-colors ${
                      !tableBorder
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    No Borders
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {tableBorder
                    ? 'Cells will have visible borders'
                    : 'Borderless table for cleaner layout'}
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Preview: {tableRows || 0} rows × {tableColumns || 0} columns ({tableWidth === '100%' ? 'Full width' : 'Flexible'}, {tableBorder ? 'With borders' : 'No borders'})
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={handleTableCancel}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTableSubmit}
                disabled={!tableRows || !tableColumns || tableRows < 1 || tableColumns < 1}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Table className="w-4 h-4" />
                Insert Table
              </button>
            </div>
          </div>
        </div>
      )}

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