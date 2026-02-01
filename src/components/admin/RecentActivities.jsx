import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import { Search, Clock, CheckCircle, Circle, Loader2 } from 'lucide-react'

const PAGE_SIZE = 50

const statusConfig = {
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
  attempted: { label: 'Attempted', className: 'bg-orange-100 text-orange-800', icon: Circle },
  not_started: { label: 'Not Started', className: 'bg-gray-100 text-gray-600', icon: Circle }
}

const RecentActivities = () => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    fetchActivities(true)
  }, [])

  const fetchActivities = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const offset = reset ? 0 : activities.length

      let query = supabase
        .from('user_progress')
        .select('user_id, full_name, exercise_title, exercise_id, status, score, attempts, time_spent, completed_at, updated_at')
        .order('updated_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (searchQuery.trim()) {
        query = query.ilike('full_name', `%${searchQuery.trim()}%`)
      }

      const { data, error } = await query

      if (error) throw error

      const newData = data || []
      setHasMore(newData.length === PAGE_SIZE)

      if (reset) {
        setActivities(newData)
      } else {
        setActivities(prev => [...prev, ...newData])
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchActivities(true)
  }

  const formatTime = (seconds) => {
    if (!seconds) return '-'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const config = statusConfig[status] || statusConfig.not_started
    const Icon = config.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading activities...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Student</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Exercise</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Score</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Attempts</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Time</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    No activities found.
                  </td>
                </tr>
              ) : (
                activities.map((activity, index) => (
                  <tr key={`${activity.user_id}-${activity.exercise_id}-${index}`} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{activity.full_name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{activity.exercise_title || '-'}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(activity.status)}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">
                      {activity.score != null ? `${activity.score}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{activity.attempts || 0}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{formatTime(activity.time_spent)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{formatDate(activity.updated_at || activity.completed_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      {hasMore && activities.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchActivities(false)}
            disabled={loadingMore}
            className="px-6 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}

export default RecentActivities
