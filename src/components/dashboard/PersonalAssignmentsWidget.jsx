import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, ArrowRight, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { useIndividualAssignments } from '../../hooks/useIndividualAssignments'
import LoadingSpinner from '../ui/LoadingSpinner'

const PersonalAssignmentsWidget = () => {
  const { assignments, loading } = useIndividualAssignments()
  const [stats, setStats] = useState({ assigned: 0, inProgress: 0, completed: 0, overdue: 0 })

  useEffect(() => {
    if (assignments.length > 0) {
      const now = new Date()
      const newStats = {
        assigned: assignments.filter(a => a.status === 'assigned').length,
        inProgress: assignments.filter(a => a.status === 'in_progress').length,
        completed: assignments.filter(a => a.status === 'completed').length,
        overdue: assignments.filter(a => {
          if (!a.due_date) return false
          return new Date(a.due_date) < now && a.status !== 'completed'
        }).length
      }
      setStats(newStats)
    }
  }, [assignments])

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    )
  }

  const totalActive = stats.assigned + stats.inProgress

  if (totalActive === 0 && stats.overdue === 0) {
    return null // Don't show widget if no assignments
  }

  return (
    <Link
      to="/study/my-assignments"
      className="block bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200 p-6 hover:shadow-lg transition-all hover:scale-105"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-600 rounded-lg">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-purple-900">
              Personal Assignments
            </h3>
            <p className="text-sm text-purple-700">
              From your teacher
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-purple-600" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.overdue > 0 && (
          <div className="bg-red-100 rounded-lg p-3 text-center border border-red-200">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <div className="text-xl font-bold text-red-900">{stats.overdue}</div>
            </div>
            <div className="text-xs text-red-700">Overdue</div>
          </div>
        )}

        <div className="bg-blue-100 rounded-lg p-3 text-center border border-blue-200">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-blue-600" />
            <div className="text-xl font-bold text-blue-900">{stats.assigned}</div>
          </div>
          <div className="text-xs text-blue-700">New</div>
        </div>

        <div className="bg-yellow-100 rounded-lg p-3 text-center border border-yellow-200">
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-4 h-4 flex items-center justify-center">
              <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
            </div>
            <div className="text-xl font-bold text-yellow-900">{stats.inProgress}</div>
          </div>
          <div className="text-xs text-yellow-700">In Progress</div>
        </div>

        <div className="bg-green-100 rounded-lg p-3 text-center border border-green-200">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <div className="text-xl font-bold text-green-900">{stats.completed}</div>
          </div>
          <div className="text-xs text-green-700">Done</div>
        </div>
      </div>

      {totalActive > 0 && (
        <div className="mt-4 text-center">
          <span className="text-sm font-medium text-purple-900">
            {totalActive} assignment{totalActive !== 1 ? 's' : ''} to complete
          </span>
        </div>
      )}
    </Link>
  )
}

export default PersonalAssignmentsWidget
