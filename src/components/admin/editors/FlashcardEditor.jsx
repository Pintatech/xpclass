import React, { useState, useEffect } from 'react'
import { parseFlashcardsFromCSV, generateCSVTemplate } from '../../../utils/csvParser'
import {
  Plus,
  Trash2,
  Upload,
  Download,
  X,
  Video,
} from 'lucide-react'

const FlashcardEditor = ({ cards, onCardsChange }) => {
  const [localCards, setLocalCards] = useState(cards || [])
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvErrors, setCsvErrors] = useState([])
  const [csvPreview, setCsvPreview] = useState(null)
  const [isProcessingCSV, setIsProcessingCSV] = useState(false)

  useEffect(() => {
    setLocalCards(cards || [])
  }, [cards])

  const addCard = () => {
    const newCard = {
      id: Date.now(),
      front: '',
      back: '',
      image: '',
      videoUrls: [] // Keep for backwards compatibility
    }
    const updatedCards = [...localCards, newCard]
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  const updateCard = (index, field, value) => {
    const updatedCards = localCards.map((card, i) => {
      if (i === index) {
        // Preserve all existing fields including videoUrls if they exist
        return { ...card, [field]: value }
      }
      return card
    })
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  const removeCard = (index) => {
    const updatedCards = localCards.filter((_, i) => i !== index)
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  const addVideoUrl = (cardIndex) => {
    const updatedCards = localCards.map((card, i) => {
      if (i === cardIndex) {
        const videoUrls = card.videoUrls || []
        return { ...card, videoUrls: [...videoUrls, ''] }
      }
      return card
    })
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  const updateVideoUrl = (cardIndex, videoIndex, value) => {
    const updatedCards = localCards.map((card, i) => {
      if (i === cardIndex) {
        const videoUrls = [...(card.videoUrls || [])]
        videoUrls[videoIndex] = value
        return { ...card, videoUrls }
      }
      return card
    })
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  const removeVideoUrl = (cardIndex, videoIndex) => {
    const updatedCards = localCards.map((card, i) => {
      if (i === cardIndex) {
        const videoUrls = (card.videoUrls || []).filter((_, vi) => vi !== videoIndex)
        return { ...card, videoUrls }
      }
      return card
    })
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }


  const handleCSVTextChange = (text) => {
    setCsvText(text)
    setCsvErrors([])
    setCsvPreview(null)

    if (text.trim()) {
      setTimeout(() => {
        try {
          const result = parseFlashcardsFromCSV(text)
          setCsvPreview(result)
          if (result.errors.length > 0) {
            setCsvErrors(result.errors)
          }
        } catch (error) {
          setCsvErrors([error.message])
          setCsvPreview(null)
        }
      }, 500)
    }
  }

  const handleCSVImport = () => {
    if (!csvPreview || csvPreview.flashcards.length === 0) {
      alert('No valid flashcards to import')
      return
    }

    setIsProcessingCSV(true)

    try {
      const importedCards = csvPreview.flashcards.map(card => ({
        ...card,
        id: card.id || `imported_${Date.now()}_${Math.random()}`
      }))

      const updatedCards = [...localCards, ...importedCards]
      setLocalCards(updatedCards)
      onCardsChange(updatedCards)

      alert(`Successfully imported ${importedCards.length} flashcard(s)!`)

      setCsvText('')
      setCsvErrors([])
      setCsvPreview(null)
      setShowCSVImport(false)
    } catch (error) {
      alert('Error importing CSV: ' + error.message)
    } finally {
      setIsProcessingCSV(false)
    }
  }

  const downloadCSVTemplate = () => {
    const template = generateCSVTemplate()
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'flashcard_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type === 'text/csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target.result
        setCsvText(text)
        handleCSVTextChange(text)
      }
      reader.readAsText(file)
    } else {
      alert('Please select a valid CSV file')
    }
    event.target.value = ''
  }

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Flashcard Cards</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadCSVTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            title="Download CSV template"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
          <button
            type="button"
            onClick={() => setShowCSVImport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={addCard}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Card
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {localCards.map((card, index) => (
          <div key={card.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Card {index + 1}</span>
              <button
                type="button"
                onClick={() => removeCard(index)}
                className="text-red-600 hover:text-red-800"
                title="Remove card"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Front */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Front
                </label>
                <textarea
                  value={card.front || ''}
                  onChange={(e) => updateCard(index, 'front', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={1}
                  placeholder="Front of the card"
                />
              </div>

              {/* Back */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Back
                </label>
                <textarea
                  value={card.back || ''}
                  onChange={(e) => updateCard(index, 'back', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={1}
                  placeholder="Back of the card"
                />
              </div>
            </div>

            {/* Image URL */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={card.image || ''}
                  onChange={(e) => updateCard(index, 'image', e.target.value)}
                  className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/image.jpg"
                />
                {card.image && (
                  <img
                    src={card.image}
                    alt="Card"
                    className="w-12 h-12 object-cover rounded border"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
              </div>
            </div>

            {/* Audio URL */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Audio URL (optional - will use TTS if empty)
              </label>
              <input
                type="url"
                value={card.audioUrl || ''}
                onChange={(e) => updateCard(index, 'audioUrl', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/audio.mp3"
              />
              {card.audioUrl && (
                <audio src={card.audioUrl} controls className="mt-2 w-full" />
              )}
            </div>

            {/* Video URLs */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Video URLs {card.videoUrls && card.videoUrls.length > 0 && `(${card.videoUrls.length})`}
                </label>
                <button
                  type="button"
                  onClick={() => addVideoUrl(index)}
                  className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                >
                  <Plus className="w-3 h-3" />
                  Add Video
                </button>
              </div>

              {card.videoUrls && card.videoUrls.length > 0 ? (
                <div className="space-y-2">
                  {card.videoUrls.map((videoUrl, videoIndex) => (
                    <div key={videoIndex} className="flex gap-2 items-start">
                      {/* Video Thumbnail */}
                      {videoUrl && (
                        <div className="flex-shrink-0">
                          <video
                            src={videoUrl}
                            className="w-20 h-20 rounded border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.target.requestFullscreen?.() || e.target.webkitRequestFullscreen?.()
                            }}
                            onError={(e) => e.target.style.display = 'none'}
                            title="Click to view fullscreen"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="url"
                          value={videoUrl || ''}
                          onChange={(e) => updateVideoUrl(index, videoIndex, e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                          placeholder="https://example.com/video.mp4"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVideoUrl(index, videoIndex)}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Remove video"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic flex items-center gap-2 p-3 bg-gray-50 rounded border border-gray-200">
                  <Video className="w-4 h-4" />
                  No videos added. Click &quot;Add Video&quot; to add video URLs.
                </div>
              )}
            </div>

          </div>
        ))}

        {localCards.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No cards yet. Click "Add Card" to start creating flashcards.</p>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Import Flashcards from CSV</h3>
                <button
                  onClick={() => setShowCSVImport(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload CSV File or Paste CSV Text
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="mb-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <textarea
                    value={csvText}
                    onChange={(e) => handleCSVTextChange(e.target.value)}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Paste CSV content here..."
                  />
                </div>

                {csvErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <h4 className="text-red-800 font-medium mb-2">Errors:</h4>
                    <ul className="text-red-700 text-sm space-y-1">
                      {csvErrors.map((error, i) => (
                        <li key={i}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {csvPreview && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                    <h4 className="text-green-800 font-medium mb-2">Preview ({csvPreview.flashcards.length} cards):</h4>
                    <div className="max-h-40 overflow-y-auto">
                      {csvPreview.flashcards.slice(0, 3).map((card, i) => (
                        <div key={i} className="text-sm text-green-700 mb-1">
                          <strong>Card {i + 1}:</strong> {card.front} → {card.back}
                        </div>
                      ))}
                      {csvPreview.flashcards.length > 3 && (
                        <div className="text-sm text-green-600">
                          ... and {csvPreview.flashcards.length - 3} more cards
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCSVImport(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCSVImport}
                    disabled={!csvPreview || isProcessingCSV}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {isProcessingCSV ? 'Importing...' : 'Import Cards'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FlashcardEditor