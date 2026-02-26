import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './useAuth'

export const useIndividualAssignments = () => {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch assignments for current user
  const fetchMyAssignments = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('individual_assignments_with_details')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setAssignments(data || [])
    } catch (err) {
      console.error('Error fetching individual assignments:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch all assignments (for teachers/admins)
  const fetchAllAssignments = async (filters = {}) => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('individual_assignments_with_details')
        .select('*')

      // Apply filters
      if (filters.studentId) {
        query = query.eq('user_id', filters.studentId)
      }
      if (filters.exerciseId) {
        query = query.eq('exercise_id', filters.exerciseId)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.assignedBy) {
        query = query.eq('assigned_by', filters.assignedBy)
      }

      query = query.order('due_date', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false })

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      setAssignments(data || [])
      return data || []
    } catch (err) {
      console.error('Error fetching all assignments:', err)
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  // Create a new assignment
  const createAssignment = async (assignmentData) => {
    try {
      const { data, error: createError } = await supabase
        .from('individual_exercise_assignments')
        .insert({
          user_id: assignmentData.userId,
          exercise_id: assignmentData.exerciseId,
          assigned_by: user.id,
          due_date: assignmentData.dueDate || null,
          notes: assignmentData.notes || null,
          priority: assignmentData.priority || 'medium',
          status: 'assigned'
        })
        .select()
        .single()

      if (createError) throw createError

      // Refresh assignments
      await fetchMyAssignments()

      return { success: true, data }
    } catch (err) {
      console.error('Error creating assignment:', err)
      return { success: false, error: err.message }
    }
  }

  // Update assignment status
  const updateAssignmentStatus = async (assignmentId, status, score = null) => {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString()
        if (score !== null) {
          updateData.score = score
        }
      }

      const { data, error: updateError } = await supabase
        .from('individual_exercise_assignments')
        .update(updateData)
        .eq('id', assignmentId)
        .select()
        .single()

      if (updateError) throw updateError

      // Refresh assignments
      await fetchMyAssignments()

      return { success: true, data }
    } catch (err) {
      console.error('Error updating assignment status:', err)
      return { success: false, error: err.message }
    }
  }

  // Update assignment (for teachers)
  const updateAssignment = async (assignmentId, updates) => {
    try {
      const { data, error: updateError } = await supabase
        .from('individual_exercise_assignments')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .select()
        .single()

      if (updateError) throw updateError

      // Refresh assignments
      await fetchMyAssignments()

      return { success: true, data }
    } catch (err) {
      console.error('Error updating assignment:', err)
      return { success: false, error: err.message }
    }
  }

  // Delete assignment
  const deleteAssignment = async (assignmentId) => {
    try {
      const { error: deleteError } = await supabase
        .from('individual_exercise_assignments')
        .delete()
        .eq('id', assignmentId)

      if (deleteError) throw deleteError

      // Refresh assignments
      await fetchMyAssignments()

      return { success: true }
    } catch (err) {
      console.error('Error deleting assignment:', err)
      return { success: false, error: err.message }
    }
  }

  // Get assignment by exercise ID (to check if already assigned)
  const getAssignmentByExercise = async (exerciseId, userId = null) => {
    try {
      const targetUserId = userId || user?.id
      if (!targetUserId) return null

      const { data, error: fetchError } = await supabase
        .from('individual_exercise_assignments')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('exercise_id', exerciseId)
        .maybeSingle()

      if (fetchError) throw fetchError

      return data
    } catch (err) {
      console.error('Error fetching assignment by exercise:', err)
      return null
    }
  }

  // Get statistics
  const getAssignmentStats = async (userId = null) => {
    try {
      const targetUserId = userId || user?.id
      if (!targetUserId) return null

      const { data, error: fetchError } = await supabase
        .from('individual_exercise_assignments')
        .select('status')
        .eq('user_id', targetUserId)

      if (fetchError) throw fetchError

      const stats = {
        total: data.length,
        assigned: data.filter(a => a.status === 'assigned').length,
        inProgress: data.filter(a => a.status === 'in_progress').length,
        completed: data.filter(a => a.status === 'completed').length
      }

      return stats
    } catch (err) {
      console.error('Error fetching assignment stats:', err)
      return null
    }
  }

  // Fetch assignments for all students in a course (for teachers)
  const fetchAssignmentsByCourse = async (courseId) => {
    try {
      setLoading(true)
      setError(null)

      // First, get all students enrolled in the course
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('is_active', true)

      if (enrollError) throw enrollError

      const studentIds = enrollments.map(e => e.student_id)

      if (studentIds.length === 0) {
        setAssignments([])
        return []
      }

      // Fetch assignments for these students
      const { data, error: fetchError } = await supabase
        .from('individual_assignments_with_details')
        .select('*')
        .in('user_id', studentIds)
        .order('due_date', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setAssignments(data || [])
      return data || []
    } catch (err) {
      console.error('Error fetching assignments by course:', err)
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchMyAssignments()
    }
  }, [user])

  return {
    assignments,
    loading,
    error,
    fetchMyAssignments,
    fetchAllAssignments,
    fetchAssignmentsByCourse,
    createAssignment,
    updateAssignmentStatus,
    updateAssignment,
    deleteAssignment,
    getAssignmentByExercise,
    getAssignmentStats
  }
}
