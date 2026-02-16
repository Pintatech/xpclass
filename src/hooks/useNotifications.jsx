import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './useAuth'

export const useNotifications = () => {
  const { user, profile } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const pollInterval = useRef(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    try {
      // 1. Fetch user-specific notifications
      const { data: userNotifs, error: userError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (userError) throw userError

      // 2. Fetch broadcast notifications (user_id IS NULL, no cohort)
      const { data: broadcastNotifs, error: broadcastError } = await supabase
        .from('notifications')
        .select('*')
        .is('user_id', null)
        .is('cohort_id', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (broadcastError) throw broadcastError

      // 3. Fetch cohort-targeted notifications
      let cohortNotifs = []
      if (profile?.id) {
        const { data: memberships } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .eq('student_id', profile.id)
          .eq('is_active', true)

        if (memberships && memberships.length > 0) {
          const cohortIds = memberships.map(m => m.cohort_id)
          const { data: cNotifs } = await supabase
            .from('notifications')
            .select('*')
            .is('user_id', null)
            .in('cohort_id', cohortIds)
            .order('created_at', { ascending: false })
            .limit(20)

          cohortNotifs = cNotifs || []
        }
      }

      // 4. Fetch read status for broadcast/cohort notifications
      const broadcastAndCohortIds = [...(broadcastNotifs || []), ...cohortNotifs].map(n => n.id)
      let readNotifIds = new Set()

      if (broadcastAndCohortIds.length > 0) {
        const { data: reads } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('user_id', user.id)
          .in('notification_id', broadcastAndCohortIds)

        if (reads) {
          readNotifIds = new Set(reads.map(r => r.notification_id))
        }
      }

      // 5. Merge and mark read status
      const allNotifs = [
        ...(userNotifs || []),
        ...(broadcastNotifs || []).map(n => ({
          ...n,
          is_read: readNotifIds.has(n.id)
        })),
        ...cohortNotifs.map(n => ({
          ...n,
          is_read: readNotifIds.has(n.id)
        }))
      ]

      // Sort by created_at DESC and deduplicate
      const seen = new Set()
      const merged = allNotifs
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .filter(n => {
          if (seen.has(n.id)) return false
          seen.add(n.id)
          return true
        })
        .slice(0, 50)

      setNotifications(merged)
      setUnreadCount(merged.filter(n => !n.is_read).length)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, profile])

  const markAsRead = async (notificationId) => {
    if (!user) return

    const notif = notifications.find(n => n.id === notificationId)
    if (!notif || notif.is_read) return

    try {
      if (notif.user_id === user.id) {
        // User-specific notification: update is_read directly
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
      } else {
        // Broadcast/cohort notification: insert into notification_reads
        await supabase
          .from('notification_reads')
          .upsert({ notification_id: notificationId, user_id: user.id })
      }

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const unreadNotifs = notifications.filter(n => !n.is_read)

      // Mark user-specific ones
      const userSpecific = unreadNotifs.filter(n => n.user_id === user.id)
      if (userSpecific.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
      }

      // Mark broadcast/cohort ones
      const broadcastOnes = unreadNotifs.filter(n => n.user_id !== user.id)
      if (broadcastOnes.length > 0) {
        const inserts = broadcastOnes.map(n => ({
          notification_id: n.id,
          user_id: user.id
        }))
        await supabase
          .from('notification_reads')
          .upsert(inserts)
      }

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  // Admin: create announcement
  const createAdminAnnouncement = async (title, message, cohortId = null) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          user_id: null,
          type: 'admin_announcement',
          title,
          message,
          icon: 'Megaphone',
          cohort_id: cohortId || null
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Error creating announcement:', err)
      throw err
    }
  }

  // Fetch admin announcements list
  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'admin_announcement')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching announcements:', err)
      return []
    }
  }

  // Delete notification (admin)
  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (err) {
      console.error('Error deleting notification:', err)
      throw err
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications()
      // Poll every 60 seconds
      pollInterval.current = setInterval(fetchNotifications, 60000)
    }

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current)
      }
    }
  }, [user, fetchNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    createAdminAnnouncement,
    fetchAnnouncements,
    deleteNotification
  }
}
