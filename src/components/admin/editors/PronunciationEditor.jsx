import React, { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Volume2,
  HelpCircle,
  Upload,
  FileAudio
} from 'lucide-react'
import { supabase } from '../../../supabase/client'

const PronunciationEditor = ({ questions, onQuestionsChange }) => {
  const normalizeQuestion = (q, idx = 0) => ({
    id: q?.id || `q${Date.now()}_${idx}`,
    text: q?.text || '',
    phonetic: q?.phonetic || '',
    audio_url: q?.audio_url || '',
    explanation: q?.explanation || '',
    difficulty: q?.difficulty || 'medium',
    max_audio_plays: q?.max_audio_plays || 0
  })

  const [localQuestions, setLocalQuestions] = useState((questions || []).map((q, i) => normalizeQuestion(q, i)))
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [uploadingAudio, setUploadingAudio] = useState({})
  const [collapsedQuestions, setCollapsedQuestions] = useState({})

  useEffect(() => {
    setLocalQuestions((questions || []).map((q, i) => normalizeQuestion(q, i)))
  }, [questions])

  const addQuestion = () => {
    const newQuestion = normalizeQuestion({}, localQuestions.length)
    const updatedQuestions = [...localQuestions, newQuestion]
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const duplicateQuestion = (index) => {
    const questionToDuplicate = { ...localQuestions[index] }
    questionToDuplicate.id = `q${Date.now()}`
    questionToDuplicate.text = `${questionToDuplicate.text} (Copy)`
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
      const allCollapsed = {}
      localQuestions.forEach((_, index) => {
        allCollapsed[index] = true
      })
      setCollapsedQuestions(allCollapsed)
    } else {
      setCollapsedQuestions({})
    }
  }

  const handleAudioUpload = async (index, file) => {
    if (!file) return

    try {
      setUploadingAudio(prev => ({ ...prev, [index]: true }))

      const path = `pronunciation/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('exercise-audio')
        .upload(path, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('exercise-audio')
        .getPublicUrl(path)

      const publicUrl = publicData?.publicUrl
      if (!publicUrl) throw new Error('Cannot get public URL')

      updateQuestion(index, 'audio_url', publicUrl)
      alert('Audio uploaded successfully!')
    } catch (error) {
      console.error('Audio upload failed:', error)
      alert('Audio upload failed. Please ensure the bucket "exercise-audio" exists and RLS allows uploads.')
    } finally {
      setUploadingAudio(prev => ({ ...prev, [index]: false }))
    }
  }

  const playAudio = (url) => {
    if (url) {
      const audio = new Audio(url)
      audio.play()
    }
  }

  const processBulkImport = () => {
    try {
      const lines = bulkText.split('\n').filter(line => line.trim())
      const newQuestions = []

      lines.forEach((line, index) => {
        const trimmed = line.trim()

        // Format: text | phonetic | difficulty | audio_url
        // Example: Hello | həˈloʊ | easy | https://example.com/audio.mp3
        const parts = trimmed.split('|').map(p => p.trim())

        if (parts.length >= 1 && parts[0]) {
          newQuestions.push({
            id: `q${Date.now()}_${index}`,
            text: parts[0] || '',
            phonetic: parts[1] || '',
            difficulty: parts[2] || 'medium',
            audio_url: parts[3] || '',
            explanation: ''
          })
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
      console.error('Bulk import error:', error)
      alert('Error processing bulk import. Please check your format.')
    }
  }

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Pronunciation Questions</h3>
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
              onClick={toggleAllQuestions}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              {localQuestions.some((_, index) => !collapsedQuestions[index]) ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Expand All
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
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
            Format: <code className="bg-blue-100 px-2 py-1 rounded">text | phonetic | difficulty | audio_url</code>
            <br />
            Example: <code className="bg-blue-100 px-2 py-1 rounded">Hello | həˈloʊ | easy | https://example.com/audio.mp3</code>
            <br />
            One question per line. Phonetic, difficulty, and audio_url are optional.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg h-40 font-mono text-sm"
            placeholder="Hello | həˈloʊ | easy
World | wɜːrld | medium
Pronunciation | prəˌnʌnsiˈeɪʃən | hard"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                setBulkImportMode(false)
                setBulkText('')
              }}
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
                    {isCollapsed && question.text && (
                      <span className="ml-2 text-xs text-gray-500 truncate max-w-md inline-block">
                        - {question.text.substring(0, 50)}{question.text.length > 50 ? '...' : ''}
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
                <div className="space-y-4">
                  {/* Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Text/Word/Phrase <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={question.text || ''}
                      onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter word or phrase to pronounce..."
                    />
                  </div>

                  {/* Phonetic */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phonetic (IPA) - Optional
                    </label>
                    <input
                      type="text"
                      value={question.phonetic || ''}
                      onChange={(e) => updateQuestion(index, 'phonetic', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="e.g., həˈloʊ for 'hello'"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use IPA notation. You can use tools like{' '}
                      <a
                        href="https://tophonetics.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        tophonetics.com
                      </a>
                    </p>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty Level
                    </label>
                    <select
                      value={question.difficulty || 'medium'}
                      onChange={(e) => updateQuestion(index, 'difficulty', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  {/* Audio Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference Audio - Optional
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => handleAudioUpload(index, e.target.files?.[0])}
                        className="hidden"
                        id={`audio-upload-${index}`}
                      />
                      <label
                        htmlFor={`audio-upload-${index}`}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingAudio[index] ? 'Uploading...' : 'Upload Audio'}
                      </label>
                      {question.audio_url && (
                        <button
                          type="button"
                          onClick={() => playAudio(question.audio_url)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                        >
                          <Volume2 className="w-4 h-4" />
                          Play Audio
                        </button>
                      )}
                    </div>
                    {question.audio_url && (
                      <input
                        type="text"
                        value={question.audio_url}
                        onChange={(e) => updateQuestion(index, 'audio_url', e.target.value)}
                        className="w-full p-2 mt-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Or paste audio URL..."
                      />
                    )}
                  </div>

                  {/* Max Audio Plays */}
                  {question.audio_url && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Audio Play Limit
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={question.max_audio_plays || 0}
                          onChange={(e) => updateQuestion(index, 'max_audio_plays', parseInt(e.target.value) || 0)}
                          className="w-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">
                          {question.max_audio_plays === 0 ? 'Unlimited plays' : `Max ${question.max_audio_plays} play${question.max_audio_plays !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Set to 0 for unlimited plays, or limit how many times students can listen
                      </p>
                    </div>
                  )}

                  {/* Explanation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Explanation/Tips - Optional
                    </label>
                    <textarea
                      value={question.explanation || ''}
                      onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Add pronunciation tips or explanation..."
                    />
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
    </div>
  )
}

export default PronunciationEditor
