import { useState, useEffect } from 'react'
import { X, User, Calendar, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useIndividualAssignments } from '../../hooks/useIndividualAssignments'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'

const AssignToStudentModal = ({ isOpen, onClose, exercise }) => {
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { createAssignment } = useIndividualAssignments()

  useEffect(() => {
    if (isOpen) {
      fetchStudents()
      // Reset form
      setSelectedStudent('')
      setDueDate('')
      setPriority('medium')
      setNotes('')
      setError('')
      setSuccess(false)
    }
  }, [isOpen])

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true)
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('role', 'user')
        .order('full_name', { ascending: true })

      if (fetchError) throw fetchError

      if (!data || data.length === 0) {
        setError('No students found in the system')
      }

      setStudents(data || [])
    } catch (err) {
      console.error('Error fetching students:', err)
      setError('Failed to load students: ' + err.message)
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedStudent) {
      setError('Please select a student')
      return
    }

    setLoading(true)
    setError('')

    const result = await createAssignment({
      userId: selectedStudent,
      exerciseId: exercise.id,
      dueDate: dueDate || null,
      priority,
      notes: notes.trim() || null
    })

    setLoading(false)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } else {
      if (result.error?.includes('duplicate') || result.error?.includes('unique')) {
        setError('This exercise is already assigned to this student')
      } else {
        setError(result.error || 'Failed to create assignment')
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Assign to Student</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Exercise Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-1">{exercise?.title}</h3>
            <p className="text-sm text-blue-700">
              Type: {exercise?.exercise_type} • Difficulty: {exercise?.difficulty_level} • XP: {exercise?.xp_reward}
            </p>
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-lg font-medium text-green-900">Assignment Created!</p>
              <p className="text-sm text-gray-600 mt-2">The student will see this in their assignments</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Student Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Select Student *
                </label>
                {loadingStudents ? (
                  <div className="flex items-center justify-center p-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : (
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose a student...</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name} ({student.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Due Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Notes for Student (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Add any instructions or comments for the student..."
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={loading || loadingStudents}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Assigning...
                    </>
                  ) : (
                    'Assign Exercise'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default AssignToStudentModal
