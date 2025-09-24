import React, { useState, useEffect } from 'react'
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
  GripVertical,
  Target
} from 'lucide-react'

const DragDropEditor = ({ questions, onQuestionsChange }) => {
  const normalizeQuestion = (q, idx = 0) => {
    const safeItems = Array.isArray(q?.items) ? q.items : []
    const safeCorrectOrder = Array.isArray(q?.correct_order) ? q.correct_order : []
    const safeDropZones = Array.isArray(q?.drop_zones) ? q.drop_zones : []
    
    return {
      id: q?.id || `q${Date.now()}_${idx}`,
      question: q?.question || '',
      items: safeItems,
      correct_order: safeCorrectOrder,
      drop_zones: safeDropZones,
      explanation: q?.explanation || '',
      settings: q?.settings || {
        allow_undo: true,
        show_hints: true,
        max_attempts: 3,
        time_limit: 300
      }
    }
  }

  const [localQuestions, setLocalQuestions] = useState((questions || []).map((q, i) => normalizeQuestion(q, i)))
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [previewOpen, setPreviewOpen] = useState({})
  const [draggedItem, setDraggedItem] = useState(null)

  useEffect(() => {
    setLocalQuestions((questions || []).map((q, i) => normalizeQuestion(q, i)))
  }, [questions])

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      items: [],
      correct_order: [],
      drop_zones: [],
      explanation: '',
      settings: {
        allow_undo: true,
        show_hints: true,
        max_attempts: 3,
        time_limit: 300
      }
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

  const addItem = (questionIndex) => {
    const newItem = {
      id: `item_${Date.now()}`,
      text: '',
      type: 'word',
      image: ''
    }
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, items: [...q.items, newItem] }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeItem = (questionIndex, itemIndex) => {
    const question = localQuestions[questionIndex]
    const updatedItems = question.items.filter((_, i) => i !== itemIndex)
    const updatedCorrectOrder = question.correct_order.filter(id => 
      question.items[itemIndex]?.id !== id
    )
    
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { 
            ...q, 
            items: updatedItems,
            correct_order: updatedCorrectOrder
          }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateItem = (questionIndex, itemIndex, field, value) => {
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? {
            ...q,
            items: q.items.map((item, ii) =>
              ii === itemIndex ? { ...item, [field]: value } : item
            )
          }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const addDropZone = (questionIndex) => {
    const newDropZone = {
      id: `zone_${Date.now()}`,
      position: localQuestions[questionIndex].drop_zones.length + 1,
      label: `Position ${localQuestions[questionIndex].drop_zones.length + 1}`
    }
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, drop_zones: [...q.drop_zones, newDropZone] }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeDropZone = (questionIndex, zoneIndex) => {
    const question = localQuestions[questionIndex]
    const updatedDropZones = question.drop_zones.filter((_, i) => i !== zoneIndex)
    
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, drop_zones: updatedDropZones }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateDropZone = (questionIndex, zoneIndex, field, value) => {
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? {
            ...q,
            drop_zones: q.drop_zones.map((zone, zi) =>
              zi === zoneIndex ? { ...zone, [field]: value } : zone
            )
          }
        : q
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const setCorrectOrder = (questionIndex) => {
    const question = localQuestions[questionIndex]
    const correctOrder = question.drop_zones.map(zone => zone.itemId).filter(Boolean)
    
    const updatedQuestions = localQuestions.map((q, i) =>
      i === questionIndex
        ? { ...q, correct_order: correctOrder }
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

      let currentQuestion = null
      let questionCounter = 0

      lines.forEach((line, index) => {
        const trimmedLine = line.trim()

        // Question line (starts with Q: or number.)
        if (trimmedLine.match(/^(Q:|Question|\d+[\.):])/i)) {
          if (currentQuestion) {
            newQuestions.push(currentQuestion)
          }
          currentQuestion = {
            id: `q${Date.now()}_${questionCounter++}`,
            question: trimmedLine.replace(/^(Q:|Question|\d+[\.):])\s*/i, ''),
            items: [],
            correct_order: [],
            drop_zones: [],
            explanation: '',
            settings: {
              allow_undo: true,
              show_hints: true,
              max_attempts: 3,
              time_limit: 300
            }
          }
        }
        // Items line (starts with Items:)
        else if (trimmedLine.match(/^Items:/i)) {
          if (currentQuestion) {
            const itemsText = trimmedLine.replace(/^Items:\s*/i, '')
            const items = itemsText.split(',').map((item, idx) => ({
              id: `item_${Date.now()}_${idx}`,
              text: item.trim(),
              type: 'word',
              image: ''
            }))
            currentQuestion.items = items
          }
        }
        // Correct order line (starts with Order:)
        else if (trimmedLine.match(/^Order:/i)) {
          if (currentQuestion) {
            const orderText = trimmedLine.replace(/^Order:\s*/i, '')
            const order = orderText.split(',').map(item => item.trim())
            currentQuestion.correct_order = order
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

  const exportQuestions = () => {
    if (localQuestions.length === 0) {
      alert('No questions to export')
      return
    }

    const exportText = localQuestions.map((q, index) => {
      let text = `Q${index + 1}: ${q.question}\n`
      text += `Items: ${q.items.map(item => item.text).join(', ')}\n`
      text += `Order: ${q.correct_order.join(', ')}\n`
      if (q.explanation) {
        text += `Explanation: ${q.explanation}\n`
      }
      return text
    }).join('\n\n')

    navigator.clipboard.writeText(exportText).then(() => {
      alert('Questions exported to clipboard!')
    }).catch(() => {
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
        <h3 className="text-lg font-medium text-gray-900">Drag & Drop Questions</h3>
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
            Format: Q1: Question text / Items: item1, item2, item3 / Order: item1, item2, item3 / Explanation: Text
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg h-40 font-mono text-sm"
            placeholder={`Q1: Sắp xếp các từ để tạo thành câu hoàn chỉnh
Items: I, am, a, student
Order: I, am, a, student
Explanation: Câu hoàn chỉnh là "I am a student".

Q2: Sắp xếp các từ theo thứ tự đúng
Items: The, cat, is, sleeping
Order: The, cat, is, sleeping
Explanation: Thứ tự đúng là "The cat is sleeping".`}
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
                rows={2}
                placeholder="Enter your question here..."
              />
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Items to Drag
                </label>
                <button
                  type="button"
                  onClick={() => addItem(index)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Add Item
                </button>
              </div>
              <div className="space-y-2">
                {question.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-2 p-2 bg-white rounded border">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => updateItem(index, itemIndex, 'text', e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Item text"
                    />
                    <select
                      value={item.type}
                      onChange={(e) => updateItem(index, itemIndex, 'type', e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="word">Word</option>
                      <option value="phrase">Phrase</option>
                      <option value="image">Image</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeItem(index, itemIndex)}
                      className="p-2 text-red-600 hover:text-red-800"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop Zones */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Drop Zones
                </label>
                <button
                  type="button"
                  onClick={() => addDropZone(index)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Add Drop Zone
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {question.drop_zones.map((zone, zoneIndex) => (
                  <div key={zoneIndex} className="p-3 bg-white rounded border border-dashed border-gray-300">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={zone.label}
                        onChange={(e) => updateDropZone(index, zoneIndex, 'label', e.target.value)}
                        className="flex-1 p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Zone label"
                      />
                      <button
                        type="button"
                        onClick={() => removeDropZone(index, zoneIndex)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Remove zone"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Position: {zone.position}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Correct Order */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Correct Order
                </label>
                <button
                  type="button"
                  onClick={() => setCorrectOrder(index)}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  <Check className="w-4 h-4 inline mr-1" />
                  Set Current Order
                </button>
              </div>
              <div className="p-3 bg-green-50 rounded border">
                <div className="text-sm text-gray-600 mb-1">Correct sequence:</div>
                <div className="flex flex-wrap gap-1">
                  {question.correct_order.map((itemId, orderIndex) => {
                    const item = question.items.find(i => i.id === itemId)
                    return (
                      <span key={orderIndex} className="px-2 py-1 bg-green-200 text-green-800 rounded text-sm">
                        {item?.text || itemId}
                      </span>
                    )
                  })}
                </div>
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
                placeholder="Explain the correct answer..."
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

export default DragDropEditor
