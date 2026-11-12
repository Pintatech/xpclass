import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from './useAuth'

// One notification list for the whole app. The sidebar, the bottom bar and the popup all read this provider, so there
// is one fetch every 2 minutes instead of one per component, and marking a notification read in one place updates the
// badge everywhere at once. Sending announcements lives on the admin page (admin/NotificationManagement.jsx).
//
// Server side (src/supabase/migrations/add_notification_targets.sql):
//   get_my_notifications()        the signed-in user's list (personal, whole site, teachers, students, classes, people)
//   mark_notifications_read(ids)  marks read for the signed-in user
// Until that SQL is live (or after its undo) the server answers PGRST202 "function not found", and this falls back to
// the old get_notifications / direct writes, so the app keeps working in either order of deploy.

const NotificationsContext = createContext(null)

// Poll every 2 minutes, and only while the tab is visible. Idle background tabs used to be a top source of PostgREST
// egress; a fetch on becoming visible again catches up.
const POLL_MS = 120000

const isMissingFunction = (error) => error?.code === 'PGRST202'

// ---- Old server path, used only while the new functions are missing.
const legacyMarkRead = async (userId, items) => {
  const ownIds = items.filter(n => n.user_id === userId).map(n => n.id)
  const sharedIds = items.filter(n => n.user_id !== userId).map(n => n.id)
  if (ownIds.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ownIds)
      .eq('user_id', userId)
    if (error) throw error
  }
  if (sharedIds.length > 0) {
    const { error } = await supabase
      .from('notification_reads')
      .upsert(sharedIds.map(id => ({ notification_id: id, user_id: userId })),
        { onConflict: 'notification_id,user_id', ignoreDuplicates: true })
    if (error) throw error
  }
}

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Ids marked read in this session. A fetch that left before the mark reached the server must not show them unread.
  const readIdsRef = useRef(new Set())
  // Each fetch takes a number; only the newest one may write the list, so a slow old answer (or one for the account
  // that just signed out) is dropped.
  const fetchSeqRef = useRef(0)
  // Set once the server says the new functions are missing; then the old ones are used directly.
  const legacyRef = useRef(false)
  const notificationsRef = useRef(notifications)
  notificationsRef.current = notifications

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    const seq = ++fetchSeqRef.current
    try {
      let result = legacyRef.current ? null : await supabase.rpc('get_my_notifications')
      if (!result || isMissingFunction(result.error)) {
        legacyRef.current = true
        result = await supabase.rpc('get_notifications', { p_user_id: userId })
      }
      if (result.error) throw result.error
      if (seq !== fetchSeqRef.current) return
      const read = readIdsRef.current
      setNotifications((result.data || []).map(n => (!n.is_read && read.has(n.id) ? { ...n, is_read: true } : n)))
      setError(null)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      if (seq === fetchSeqRef.current) setError(err.message)
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
  }, [userId])

  // Shows the ids as read at once, then saves. If saving fails, the list is fetched again to show the real state.
  const markIdsRead = useCallback(async (ids) => {
    if (!userId || ids.length === 0) return
    const items = notificationsRef.current.filter(n => ids.includes(n.id))
    ids.forEach(id => readIdsRef.current.add(id))
    setNotifications(prev => prev.map(n => (ids.includes(n.id) && !n.is_read ? { ...n, is_read: true } : n)))
    try {
      if (!legacyRef.current) {
        const { error: rpcError } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
        if (!rpcError) return
        if (!isMissingFunction(rpcError)) throw rpcError
        legacyRef.current = true
      }
      await legacyMarkRead(userId, items)
    } catch (err) {
      console.error('Error marking notifications as read:', err)
      ids.forEach(id => readIdsRef.current.delete(id))
      fetchNotifications()
    }
  }, [userId, fetchNotifications])

  const markAsRead = useCallback((notificationId) => {
    const notif = notificationsRef.current.find(n => n.id === notificationId)
    if (!notif || notif.is_read) return Promise.resolve()
    return markIdsRead([notificationId])
  }, [markIdsRead])

  const markAllAsRead = useCallback(() => {
    return markIdsRead(notificationsRef.current.filter(n => !n.is_read).map(n => n.id))
  }, [markIdsRead])


  // New account or signed out: start clean, so nothing of the previous account shows, then poll for this one.
  useEffect(() => {
    fetchSeqRef.current += 1
    readIdsRef.current = new Set()
    setNotifications([])
    setError(null)
    setLoading(Boolean(userId))
    if (!userId) return undefined

    let timer = null
    const stopPolling = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    const startPolling = () => {
      stopPolling()
      timer = setInterval(fetchNotifications, POLL_MS)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
        startPolling()
      } else {
        stopPolling()
      }
    }

    fetchNotifications()
    if (document.visibilityState === 'visible') startPolling()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [userId, fetchNotifications])

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  }), [notifications, unreadCount, loading, error, fetchNotifications, markAsRead, markAllAsRead])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
