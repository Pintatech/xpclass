import React, { useState } from 'react'
import { supabase } from '../../../supabase/client'
import {
  BookOpen,
  Edit3,
  Mic,
  HelpCircle,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Move,
  Eye,
  Star,
  Clock,
  Tag,
  FolderOpen
} from 'lucide-react'

const ExerciseBankCard = ({ exercise, viewMode, onUpdate, onEdit }) => {
  const [showMenu, setShowMenu] = useState(false)

  const getTypeIcon = (type) => {
    switch (type) {
      case 'flashcard':
        return BookOpen
      case 'pronunciation':
        return Mic
      case 'fill_blank':
        return Edit3
      case 'multiple_choice':
        return HelpCircle
      default:
        return BookOpen
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'flashcard':
        return 'Flashcard'
      case 'pronunciation':
        return 'Pronunciation'
      case 'fill_blank':
        return 'Fill in the Blank'
      case 'multiple_choice':
        return 'Multiple Choice'
      default:
        return 'Exercise'
    }
  }

  const getDifficultyColor = (level) => {
    switch (level) {
      case 1:
        return 'bg-green-100 text-green-800'
      case 2:
        return 'bg-yellow-100 text-yellow-800'
      case 3:
        return 'bg-orange-100 text-orange-800'
      case 4:
        return 'bg-red-100 text-red-800'
      case 5:
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(exercise)
    }
    setShowMenu(false)
  }

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${exercise.title}"? This action cannot be undone.`)) {
      try {
        // First check if exercise is assigned to any sessions
        const { data: assignments, error: assignmentError } = await supabase
          .from('exercise_assignments')
          .select('id')
          .eq('exercise_id', exercise.id)

        if (assignmentError) throw assignmentError

        if (assignments && assignments.length > 0) {
          alert('Cannot delete exercise that is assigned to sessions. Remove assignments first.')
          setShowMenu(false)
          return
        }

        // Delete the exercise
        const { error } = await supabase
          .from('exercises')
          .delete()
          .eq('id', exercise.id)

        if (error) throw error

        // Refresh the list
        onUpdate()

        // Show success message
        alert('Exercise deleted successfully!')
      } catch (error) {
        console.error('Error deleting exercise:', error)
        alert('Failed to delete exercise: ' + error.message)
      }
    }
    setShowMenu(false)
  }

  const handleDuplicate = async () => {
    try {
      // Create duplicate with modified title
      const duplicate = {
        ...exercise,
        id: undefined, // Let Supabase generate new ID
        title: `${exercise.title} (Copy)`,
        created_at: undefined,
        updated_at: undefined
      }

      const { error } = await supabase
        .from('exercises')
        .insert(duplicate)

      if (error) throw error

      // Refresh the list
      onUpdate()

      alert('Exercise duplicated successfully!')
    } catch (error) {
      console.error('Error duplicating exercise:', error)
      alert('Failed to duplicate exercise: ' + error.message)
    }
    setShowMenu(false)
  }

  const handleMove = () => {
    // TODO: Implement move exercise to different folder
    setShowMenu(false)
  }

  const TypeIcon = getTypeIcon(exercise.exercise_type)

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg border hover:border-blue-200 transition-colors">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              {/* Type Icon */}
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <TypeIcon className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              {/* Exercise Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {exercise.title}
                </h3>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-xs text-gray-500">
                    {getTypeLabel(exercise.exercise_type)}
                  </span>
                  {exercise.exercise_folders && (
                    <div className="flex items-center space-x-1">
                      <FolderOpen className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {exercise.exercise_folders.name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Star className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-gray-500">
                      {exercise.xp_reward || 0} XP
                    </span>
                  </div>
                </div>
              </div>

              {/* Difficulty */}
              <div className="flex-shrink-0">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(exercise.difficulty_level)}`}>
                  Level {exercise.difficulty_level || 1}
                </span>
              </div>

              {/* Tags */}
              {exercise.tags && exercise.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Tag className="w-3 h-3 text-gray-400" />
                  <div className="flex space-x-1">
                    {exercise.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        {tag}
                      </span>
                    ))}
                    {exercise.tags.length > 2 && (
                      <span className="text-xs text-gray-500">+{exercise.tags.length - 2}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[160px]">
                  <button
                    onClick={handleEdit}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={handleDuplicate}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    onClick={handleMove}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Move className="w-3 h-3" />
                    <span>Move</span>
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div className="bg-white rounded-lg border hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <TypeIcon className="w-4 h-4 text-blue-600" />
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(exercise.difficulty_level)}`}>
              Level {exercise.difficulty_level || 1}
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-6 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                <button
                  onClick={handleEdit}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleDuplicate}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Copy className="w-3 h-3" />
                  <span>Duplicate</span>
                </button>
                <button
                  onClick={handleMove}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Move className="w-3 h-3" />
                  <span>Move</span>
                </button>
                <hr className="my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center space-x-2"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
          {exercise.title}
        </h3>

        {/* Type */}
        <p className="text-sm text-gray-500 mb-3">
          {getTypeLabel(exercise.exercise_type)}
        </p>

        {/* Content Preview */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3 min-h-[60px]">
          <p className="text-xs text-gray-600 line-clamp-3">
            {/* Simple content preview */}
            {exercise.content && typeof exercise.content === 'object'
              ? JSON.stringify(exercise.content).substring(0, 100) + '...'
              : 'Exercise content'
            }
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            {exercise.exercise_folders && (
              <div className="flex items-center space-x-1">
                <FolderOpen className="w-3 h-3" />
                <span>{exercise.exercise_folders.name}</span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              <Star className="w-3 h-3 text-orange-400" />
              <span>{exercise.xp_reward || 0} XP</span>
            </div>
          </div>

          {exercise.estimated_duration && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{exercise.estimated_duration}m</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {exercise.tags && exercise.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {exercise.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded">
                {tag}
              </span>
            ))}
            {exercise.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{exercise.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExerciseBankCard