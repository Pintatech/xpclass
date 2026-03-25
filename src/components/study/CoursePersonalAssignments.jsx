import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useIndividualAssignments } from '../../hooks/useIndividualAssignments'
import {
  BookOpen,
  Mic,
  Edit3,
  HelpCircle,
  FileText,
  Calendar,
  AlertCircle,
  Play,
  Flag,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  UserPlus
} from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

const getTypeIcon = (type) => {
  switch (type) {
    case 'flashcard': return BookOpen
    case 'pronunciation': return Mic
    case 'fill_blank': return Edit3
    case 'multiple_choice': return HelpCircle
    default: return FileText
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
    case 'assigned': return 'bg-blue-100 text-blue-800'
    case 'in_progress': return 'bg-yellow-100 text-yellow-800'
    case 'completed': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const formatDueDate = (dueDate) => {
  if (!dueDate) return null
  const date = new Date(dueDate)
  const now = new Date()
  const diffMs = date - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffMs < 0) return { text: 'Overdue', color: 'text-red-600', urgent: true }
  if (diffDays === 0) return { text: 'Due today', color: 'text-orange-600', urgent: true }
  if (diffDays === 1) return { text: 'Due tomorrow', color: 'text-orange-600', urgent: false }
  if (diffDays <= 3) return { text: `Due in ${diffDays} days`, color: 'text-yellow-600', urgent: false }
  return { text: date.toLocaleDateString(), color: 'text-gray-600', urgent: false }
}

const exercisePaths = {
  flashcard: '/study/flashcard',
  fill_blank: '/study/fill-blank',
  multiple_choice: '/study/multiple-choice',
  drag_drop: '/study/drag-drop',
  dropdown: '/study/dropdown',
  ai_fill_blank: '/study/ai-fill-blank',
  pronunciation: '/study/pronunciation',
  video_upload: '/study/video-upload'
}

const CoursePersonalAssignments = ({ courseExerciseIds }) => {
  const navigate = useNavigate()
  const { assignments, loading } = useIndividualAssignments()
  const [collapsed, setCollapsed] = useState(false)

  // Filter to only this course's exercises and only pending ones
  const courseAssignments = assignments.filter(
    a => courseExerciseIds.has(a.exercise_id) && a.status !== 'completed'
  )

  if (loading) {
    return (
      <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-center">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  if (courseAssignments.length === 0) return null

  const handleStart = (assignment) => {
    const basePath = exercisePaths[assignment.exercise_type] || '/study/flashcard'
    navigate(`${basePath}?exerciseId=${assignment.exercise_id}&assignmentId=${assignment.id}`)
  }

  return (
    <div className="mb-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-600 rounded-lg">
            <UserPlus className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-purple-900">Your Assignments</span>
          <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {courseAssignments.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/study/my-assignments"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            View All <ArrowRight className="w-3 h-3" />
          </Link>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-purple-600" />
          ) : (
            <ChevronUp className="w-4 h-4 text-purple-600" />
          )}
        </div>
      </button>

      {/* Assignment Cards */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {courseAssignments.map((assignment) => {
            const TypeIcon = getTypeIcon(assignment.exercise_type)
            const dueInfo = formatDueDate(assignment.due_date)

            return (
              <div
                key={assignment.id}
                className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow"
              >
                {/* Left: icon + title + badges */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                    <TypeIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {assignment.exercise_title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {getTypeLabel(assignment.exercise_type)}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(assignment.status)}`}>
                        {assignment.status === 'assigned' ? 'New' : 'In Progress'}
                      </span>
                      {assignment.priority === 'high' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-800 flex items-center gap-0.5">
                          <Flag className="w-2.5 h-2.5" /> High
                        </span>
                      )}
                      {dueInfo && (
                        <span className={`text-xs flex items-center gap-0.5 ${dueInfo.color}`}>
                          <Calendar className="w-2.5 h-2.5" />
                          {dueInfo.text}
                          {dueInfo.urgent && <AlertCircle className="w-2.5 h-2.5" />}
                        </span>
                      )}
                    </div>
                    {assignment.notes && (
                      <p className="text-xs text-amber-700 mt-1 truncate">
                        Teacher: {assignment.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Start button */}
                <button
                  onClick={() => handleStart(assignment)}
                  className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CoursePersonalAssignments
