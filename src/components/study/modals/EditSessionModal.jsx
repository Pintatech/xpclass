import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabase/client'
import { X, Save, User, FileText } from 'lucide-react'

const EditSessionModal = ({ session, courseId, onClose, onUpdated }) => {
  const [formData, setFormData] = useState({
    title: '',
    session_number: 1,
    is_test: false,
    assigned_student_id: null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  useEffect(() => {
    if (session) {
      setFormData({
        title: session.title || '',
        session_number: session.session_number || 1,
        is_test: session.is_test || false,
        assigned_student_id: session.assigned_student_id || null
      })
    }
  }, [session])

  useEffect(() => {
    if (courseId) fetchEnrolledStudents()
  }, [courseId])

  const fetchEnrolledStudents = async () => {
    setLoadingStudents(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('course_enrollments')
        .select('student_id, student:users!student_id(id, full_name)')
        .eq('course_id', courseId)
        .eq('is_active', true)
      if (fetchError) throw fetchError
      setStudents((data || []).map(e => ({
        id: e.student?.id || e.student_id,
        name: e.student?.full_name || 'Unknown'
      })))
    } catch (err) {
      console.error('Error fetching students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const newNumber = parseInt(formData.session_number) || 1
      const oldNumber = session.session_number

      // If session_number changed, shift others to avoid unique constraint violation
      if (newNumber !== oldNumber) {
        // Get all sessions in this unit, ordered
        const { data: allSessions, error: sibErr } = await supabase
          .from('sessions')
          .select('id, session_number')
          .eq('unit_id', session.unit_id)
          .order('session_number')
        if (sibErr) throw sibErr

        // Set ALL sessions to negative temp values first to clear all constraints
        for (let i = 0; i < allSessions.length; i++) {
          const { error: tmpErr } = await supabase
            .from('sessions')
            .update({ session_number: -(i + 1) })
            .eq('id', allSessions[i].id)
          if (tmpErr) throw tmpErr
        }

        // Build new order: remove current session, insert at new position
        const others = allSessions.filter(s => s.id !== session.id)
        const insertIdx = Math.min(newNumber - 1, others.length)
        others.splice(insertIdx, 0, { id: session.id })

        // Assign final numbers
        for (let i = 0; i < others.length; i++) {
          const { error: updateErr } = await supabase
            .from('sessions')
            .update({ session_number: i + 1 })
            .eq('id', others[i].id)
          if (updateErr) throw updateErr
        }
      }

      // Now update the other fields (session_number already set by reorder above)
      const updateFields = {
        title: formData.title.trim(),
        is_test: formData.is_test,
        assigned_student_id: formData.assigned_student_id || null
      }
      // If number didn't change, still set it
      if (newNumber === oldNumber) {
        updateFields.session_number = newNumber
      }

      const { data, error } = await supabase
        .from('sessions')
        .update(updateFields)
        .eq('id', session.id)
        .select()
        .single()

      if (error) throw error

      onUpdated(data)
    } catch (err) {
      console.error('Error updating session:', err)
      setError(err.message || 'Failed to update session')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Edit Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Session Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Family Vocabulary"
              required
              autoFocus
            />
          </div>

          {/* Session Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order #
            </label>
            <input
              type="number"
              value={formData.session_number}
              onChange={(e) => handleChange('session_number', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
            />
          </div>

          {/* Assign to Student */}
          {courseId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Assign to Student
              </label>
              {loadingStudents ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              ) : (
                <select
                  value={formData.assigned_student_id || ''}
                  onChange={(e) => handleChange('assigned_student_id', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  <option value="">Shared (no specific student)</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Test Mode Toggle */}
          <div className="flex items-center justify-between p-2 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Test Mode</span>
            </div>
            <button
              type="button"
              onClick={() => handleChange('is_test', !formData.is_test)}
              className={`relative w-11 h-6 rounded-full transition-colors ${formData.is_test ? 'bg-orange-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${formData.is_test ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{loading ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditSessionModal