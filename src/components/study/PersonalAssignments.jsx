import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useIndividualAssignments } from '../../hooks/useIndividualAssignments'
import {
  Calendar,
  Clock,
  FileText,
  BookOpen,
  Mic,
  Edit3,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  Play,
  Flag
} from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import Button from '../ui/Button'

const PersonalAssignments = () => {
  const navigate = useNavigate()
  const { assignments, loading, error, fetchMyAssignments } = useIndividualAssignments()
  const [filter, setFilter] = useState('all') // all, assigned, in_progress, completed

  useEffect(() => {
    fetchMyAssignments()
  }, [])

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
        return FileText
    }
  }

  const getTypeLabel = (type) => {
    const labels = {
      flashcard: 'Flashcard',
      pronunciation: 'Pronunciation',
      fill_blank: 'Fill in the Blank',
      multiple_choice: 'Multiple Choice',
      drag_drop: 'Drag & Drop',
      dropdown: 'Dropdown',
      ai_fill_blank: 'AI Fill Blank'
    }
    return labels[type] || 'Exercise'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-orange-100 text-orange-800'
      case 'low':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDueDate = (dueDate) => {
    if (!dueDate) return null
    const date = new Date(dueDate)
    const now = new Date()
    const diffMs = date - now
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffMs < 0) {
      return { text: 'Overdue', color: 'text-red-600', urgent: true }
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'text-orange-600', urgent: true }
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: 'text-orange-600', urgent: false }
    } else if (diffDays <= 3) {
      return { text: `Due in ${diffDays} days`, color: 'text-yellow-600', urgent: false }
    } else {
      return { text: date.toLocaleDateString(), color: 'text-gray-600', urgent: false }
    }
  }

  const handleStartExercise = (assignment) => {
    const paths = {
      flashcard: '/study/flashcard',
      fill_blank: '/study/fill-blank',
      multiple_choice: '/study/multiple-choice',
      drag_drop: '/study/drag-drop',
      dropdown: '/study/dropdown',
      ai_fill_blank: '/study/ai-fill-blank',
      pronunciation: '/study/pronunciation'
    }

    const basePath = paths[assignment.exercise_type] || '/study/flashcard'
    navigate(`${basePath}?exerciseId=${assignment.exercise_id}&assignmentId=${assignment.id}`)
  }

  const filteredAssignments = assignments.filter(assignment => {
    if (filter === 'all') return true
    return assignment.status === filter
  })

  const stats = {
    assigned: assignments.filter(a => a.status === 'assigned').length,
    inProgress: assignments.filter(a => a.status === 'in_progress').length,
    completed: assignments.filter(a => a.status === 'completed').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchMyAssignments} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          My Personal Assignments
        </h1>
        <p className="text-gray-600">
          Exercises assigned specifically to you by your teacher
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{stats.assigned}</div>
          <div className="text-sm text-blue-700">New</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-900">{stats.inProgress}</div>
          <div className="text-sm text-yellow-700">In Progress</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">{stats.completed}</div>
          <div className="text-sm text-green-700">Completed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({assignments.length})
        </button>
        <button
          onClick={() => setFilter('assigned')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            filter === 'assigned'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          New ({stats.assigned})
        </button>
        <button
          onClick={() => setFilter('in_progress')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            filter === 'in_progress'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          In Progress ({stats.inProgress})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            filter === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Completed ({stats.completed})
        </button>
      </div>

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {filter === 'all'
              ? 'No assignments yet'
              : `No ${filter.replace('_', ' ')} assignments`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => {
            const TypeIcon = getTypeIcon(assignment.exercise_type)
            const dueInfo = formatDueDate(assignment.due_date)

            return (
              <div
                key={assignment.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Left Section */}
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <TypeIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {assignment.exercise_title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            {getTypeLabel(assignment.exercise_type)}
                          </span>
                          <span className={`px-2 py-1 rounded ${getStatusColor(assignment.status)}`}>
                            {assignment.status.replace('_', ' ')}
                          </span>
                          {assignment.priority !== 'medium' && (
                            <span className={`px-2 py-1 rounded flex items-center gap-1 ${getPriorityColor(assignment.priority)}`}>
                              <Flag className="w-3 h-3" />
                              {assignment.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Due Date */}
                    {dueInfo && (
                      <div className={`flex items-center gap-2 mb-2 ${dueInfo.color}`}>
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">{dueInfo.text}</span>
                        {dueInfo.urgent && <AlertCircle className="w-4 h-4" />}
                      </div>
                    )}

                    {/* Teacher Notes */}
                    {assignment.notes && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-900">
                          <strong>Teacher's note:</strong> {assignment.notes}
                        </p>
                      </div>
                    )}

                    {/* Completion Info */}
                    {assignment.status === 'completed' && (
                      <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Completed
                        </div>
                        {assignment.score !== null && (
                          <div className="font-semibold text-green-700">
                            Score: {assignment.score}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Section - Action Button */}
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => handleStartExercise(assignment)}
                      className={`${
                        assignment.status === 'completed'
                          ? 'bg-gray-600 hover:bg-gray-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      } text-white`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {assignment.status === 'completed' ? 'Review' : 'Start'}
                    </Button>
                    {assignment.estimated_duration && (
                      <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        ~{assignment.estimated_duration} min
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PersonalAssignments
