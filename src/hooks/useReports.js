import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './useAuth'

export const useReports = () => {
  const { user, isAdmin } = useAuth()
  const [reports, setReports] = useState([])
  const [myReports, setMyReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch user's own reports
  const fetchMyReports = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setMyReports(data || [])
    } catch (err) {
      console.error('Error fetching my reports:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Fetch all reports (admin only)
  const fetchAllReports = useCallback(async (statusFilter = null) => {
    if (!user || !isAdmin()) return
    try {
      setLoading(true)
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      // Fetch reporter info from public.users
      const userIds = [...new Set((data || []).map(r => r.user_id))]
      let usersMap = {}
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, display_name, avatar_url, email')
          .in('id', userIds)
        if (usersData) {
          usersMap = Object.fromEntries(usersData.map(u => [u.id, u]))
        }
      }

      const reportsWithUser = (data || []).map(r => ({
        ...r,
        reporter: usersMap[r.user_id] || null
      }))

      setReports(reportsWithUser)
    } catch (err) {
      console.error('Error fetching all reports:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, isAdmin])

  // Submit a new report
  const submitReport = async ({ category, subject, message, screenshotUrl }) => {
    if (!user) return null
    try {
      const { data, error: insertError } = await supabase
        .from('reports')
        .insert([{
          user_id: user.id,
          category,
          subject,
          message,
          screenshot_url: screenshotUrl || null
        }])
        .select()
        .single()

      if (insertError) throw insertError
      setMyReports(prev => [data, ...prev])
      return data
    } catch (err) {
      console.error('Error submitting report:', err)
      throw err
    }
  }

  // Admin: reply to a report
  const replyToReport = async (reportId, adminReply, newStatus = 'resolved') => {
    if (!user || !isAdmin()) return
    try {
      const { data, error: updateError } = await supabase
        .from('reports')
        .update({
          admin_reply: adminReply,
          status: newStatus,
          replied_by: user.id,
          replied_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select()
        .single()

      if (updateError) throw updateError
      setReports(prev => prev.map(r => r.id === reportId ? data : r))
      return data
    } catch (err) {
      console.error('Error replying to report:', err)
      throw err
    }
  }

  // Admin: update report status
  const updateReportStatus = async (reportId, status) => {
    if (!user || !isAdmin()) return
    try {
      const { data, error: updateError } = await supabase
        .from('reports')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', reportId)
        .select()
        .single()

      if (updateError) throw updateError
      setReports(prev => prev.map(r => r.id === reportId ? data : r))
      return data
    } catch (err) {
      console.error('Error updating report status:', err)
      throw err
    }
  }

  // Admin: delete a report
  const deleteReport = async (reportId) => {
    if (!user || !isAdmin()) return
    try {
      const { error: deleteError } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId)

      if (deleteError) throw deleteError
      setReports(prev => prev.filter(r => r.id !== reportId))
    } catch (err) {
      console.error('Error deleting report:', err)
      throw err
    }
  }

  // Get pending count for admin badge
  const pendingCount = reports.filter(r => r.status === 'pending').length

  return {
    reports,
    myReports,
    loading,
    error,
    pendingCount,
    fetchMyReports,
    fetchAllReports,
    submitReport,
    replyToReport,
    updateReportStatus,
    deleteReport
  }
}
