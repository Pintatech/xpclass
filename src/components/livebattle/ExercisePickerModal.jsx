import React, { useState, useEffect } from 'react'
import { X, Search, FolderOpen, BookOpen } from 'lucide-react'
import { useExerciseBank } from '../../hooks/useExerciseBank'

const typeEmoji = {
  multiple_choice: '🔘',
  fill_blank: '✏️',
  dropdown: '📋',
  flashcard: '🃏',
}

const supportedTypes = ['multiple_choice', 'fill_blank', 'dropdown', 'flashcard']

const getPreview = (ex) => {
  const q = ex.content?.questions?.[0]
  if (!q) return null
  const text = q.question || q.front || ''
  // Strip HTML tags for preview
  const clean = text.replace(/<[^>]*>/g, '').trim()
  return clean.length > 80 ? clean.slice(0, 80) + '...' : clean
}

const ExercisePickerModal = ({ onSelect, onClose }) => {
  const { folders, exercises, loading, fetchFolders, fetchExercises } = useExerciseBank()
  const [search, setSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState(null)

  useEffect(() => {
    fetchFolders()
    fetchExercises()
  }, [])

  useEffect(() => {
    fetchExercises({
      folderId: selectedFolder,
      searchTerm: search || undefined,
    })
  }, [selectedFolder, search])

  const filteredExercises = exercises.filter(ex => {
    if (!supportedTypes.includes(ex.exercise_type)) return false
    const questions = ex.content?.questions
    return questions && questions.length > 0
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
        {/* Header with search */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">Pick an Exercise</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
          </div>
        </div>

        {/* Folder tabs */}
        {folders.length > 0 && (
          <div className="px-5 pb-2 flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${!selectedFolder ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFolder(prev => prev === f.id ? null : f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${selectedFolder === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <FolderOpen className="w-3 h-3" />
                {f.name}
              </button>
            ))}
          </div>
        )}

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
          {loading ? (
            <div className="text-center text-gray-400 py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-3" />
              Loading...
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="text-center text-gray-400 py-16">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No exercises found</p>
              <p className="text-xs mt-1">Try a different search or folder</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredExercises.map(ex => {
                const preview = getPreview(ex)
                const qCount = ex.content?.questions?.length || 0
                return (
                  <button
                    key={ex.id}
                    onClick={() => onSelect(ex)}
                    className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-0.5">{typeEmoji[ex.exercise_type] || '📝'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-800 group-hover:text-indigo-700 leading-tight">{ex.title}</div>
                        {preview && (
                          <div className="text-xs text-gray-400 mt-1 leading-relaxed">{preview}</div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-semibold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                            {qCount} Q{qCount !== 1 ? 's' : ''}
                          </span>
                          {ex.exercise_folders?.name && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              {ex.exercise_folders.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExercisePickerModal
