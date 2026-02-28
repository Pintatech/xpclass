import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabase/client'
import { X, Search, BookOpen, Mic, Edit3, HelpCircle, Plus, Check, Copy, Brain, Image } from 'lucide-react'

const AssignExerciseModal = ({ sessionId, onClose, onAssigned }) => {
  const [exercises, setExercises] = useState([])
  const [filteredExercises, setFilteredExercises] = useState([])
  const [assignedExercises, setAssignedExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedFolder, setSelectedFolder] = useState('all')
  const [folders, setFolders] = useState([])
  const [selectedExercises, setSelectedExercises] = useState(new Set())

  const exerciseTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'flashcard', label: 'Flashcard', icon: BookOpen },
    { value: 'multiple_choice', label: 'Multiple Choice', icon: HelpCircle },
    { value: 'pronunciation', label: 'Pronunciation', icon: Mic },
    { value: 'fill_blank', label: 'Fill in the Blank', icon: Edit3 },
    { value: 'drag_drop', label: 'Drag & Drop', icon: Copy },
    { value: 'ai_fill_blank', label: 'Fill in AI Score', icon: Brain },
    { value: 'image_hotspot', label: 'Image Hotspot', icon: Image }
  ]

  useEffect(() => {
    fetchFolders()
    fetchExercises()
    fetchAssignedExercises()
  }, [sessionId])

  useEffect(() => {
    filterExercises()
  }, [exercises, searchTerm, selectedType, selectedFolder, assignedExercises])


  const fetchExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select(`
          *,
          folder:exercise_folders(id, name, color)
        `)
        .eq('is_in_bank', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setExercises(data || [])
    } catch (err) {
      console.error('Error fetching exercises:', err)
      setError('Failed to load exercises from bank')
    } finally {
      setLoading(false)
    }
  }

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('exercise_folders')
        .select('*')
        .order('sort_order')

      if (error) throw error

      // Build folder hierarchy for display
      const folderMap = {}
      data?.forEach(folder => {
        folderMap[folder.id] = folder
      })

      // Add display_name with hierarchy
      const foldersWithHierarchy = data?.map(folder => {
        const hierarchy = []
        let current = folder

        // Build path from current folder to root
        while (current) {
          hierarchy.unshift(current.name)
          current = current.parent_folder_id ? folderMap[current.parent_folder_id] : null
        }

        return {
          ...folder,
          display_name: hierarchy.join(' > '),
          indent_level: hierarchy.length - 1,
          full_path: hierarchy.join(' > ')
        }
      })

      // Sort by full path to keep parent-child folders together
      const sortedFolders = foldersWithHierarchy?.sort((a, b) => {
        return a.full_path.localeCompare(b.full_path, undefined, { numeric: true, sensitivity: 'base' })
      })

      setFolders(sortedFolders || [])
    } catch (err) {
      console.error('Error fetching folders:', err)
    }
  }

  const fetchAssignedExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercise_assignments')
        .select('exercise_id')
        .eq('session_id', sessionId)

      if (error) throw error
      setAssignedExercises(data?.map(a => a.exercise_id) || [])
    } catch (err) {
      console.error('Error fetching assigned exercises:', err)
    }
  }

  const filterExercises = () => {
    let filtered = exercises.filter(exercise =>
      !assignedExercises.includes(exercise.id) // Exclude already assigned exercises
    )

    if (searchTerm) {
      filtered = filtered.filter(exercise =>
        exercise.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(exercise => exercise.exercise_type === selectedType)
    }

    if (selectedFolder !== 'all') {
      filtered = filtered.filter(exercise => exercise.folder_id === selectedFolder)
    }

    setFilteredExercises(filtered)
  }

  const toggleExerciseSelection = (exerciseId) => {
    const newSelected = new Set(selectedExercises)
    if (newSelected.has(exerciseId)) {
      newSelected.delete(exerciseId)
    } else {
      newSelected.add(exerciseId)
    }
    setSelectedExercises(newSelected)
  }

  const handleAssignExercises = async () => {
    if (selectedExercises.size === 0) {
      alert('Please select at least one exercise to assign')
      return
    }

    setAssigning(true)
    setError('')

    try {
      // Get the current max order index for this session
      const { data: existingAssignments, error: countError } = await supabase
        .from('exercise_assignments')
        .select('order_index')
        .eq('session_id', sessionId)
        .order('order_index', { ascending: false })
        .limit(1)

      if (countError) throw countError

      let nextOrderIndex = existingAssignments.length > 0 ? existingAssignments[0].order_index + 1 : 1

      // Create assignments by linking exercises to the session (no duplication)
      const assignmentsToCreate = Array.from(selectedExercises).map(exerciseId => ({
        exercise_id: exerciseId,
        session_id: sessionId,
        order_index: nextOrderIndex++
      }))

      const { data, error } = await supabase
        .from('exercise_assignments')
        .insert(assignmentsToCreate)
        .select(`
          *,
          exercises (*)
        `)

      if (error) throw error

      onAssigned(data)
    } catch (err) {
      console.error('Error assigning exercises:', err)
      setError(err.message || 'Failed to assign exercises')
    } finally {
      setAssigning(false)
    }
  }

  const getExerciseIcon = (type) => {
    const typeObj = exerciseTypes.find(t => t.value === type)
    return typeObj?.icon || BookOpen
  }

  const getExerciseTypeLabel = (type) => {
    const typeObj = exerciseTypes.find(t => t.value === type)
    return typeObj?.label || type
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Assign Exercises from Bank
              </h2>
              <p className="text-sm text-gray-600">
                Select exercises from the Exercise Bank to add to this session
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 bottom-[5%] transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search exercises by title or category..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Folder Filter */}
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[240px]"
            >
              <option value="all">📁 All Folders</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {'  '.repeat(folder.indent_level)}
                  {folder.indent_level > 0 ? '└─ ' : ''}
                  {folder.display_name}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[180px]"
            >
              {exerciseTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center p-4 border border-gray-200 rounded-lg">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg mr-4"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No exercises found</h3>
              <p className="text-gray-600">
                {searchTerm || selectedType !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'No exercises available in the Exercise Bank'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExercises.map((exercise) => {
                const IconComponent = getExerciseIcon(exercise.exercise_type)
                const isSelected = selectedExercises.has(exercise.id)

                return (
                  <div
                    key={exercise.id}
                    onClick={() => toggleExerciseSelection(exercise.id)}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <div className={`w-5 h-5 rounded border-2 mr-4 flex items-center justify-center ${
                      isSelected
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>

                    {/* Exercise Icon */}
                    <div className="flex-shrink-0 w-12 h-12 mr-4">
                      <div className="w-full h-full rounded-lg bg-blue-100 flex items-center justify-center">
                        <IconComponent className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>

                    {/* Exercise Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-medium text-gray-900 truncate">
                        {exercise.title}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getExerciseTypeLabel(exercise.exercise_type)}
                        </span>
                        {exercise.folder_id && folders.find(f => f.id === exercise.folder_id) && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            📁 {folders.find(f => f.id === exercise.folder_id)?.display_name}
                          </span>
                        )}
                        <span>{exercise.xp_reward} XP</span>
                        <span>{exercise.estimated_duration} min</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {selectedExercises.size} exercise{selectedExercises.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignExercises}
              disabled={assigning || selectedExercises.size === 0}
              className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300 rounded-lg transition-colors flex items-center space-x-2"
            >
              {assigning ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>
                {assigning
                  ? 'Assigning...'
                  : `Assign ${selectedExercises.size} Exercise${selectedExercises.size !== 1 ? 's' : ''}`
                }
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssignExerciseModal