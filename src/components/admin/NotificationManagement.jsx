import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Megaphone, Trash2, Users, Globe, GraduationCap, BookOpen, UserCheck, Search, X, RefreshCw, Check
} from 'lucide-react'
import { supabase } from '../../supabase/client'

// Admin page: send an announcement to the whole site, all teachers, all students, some classes or some people,
// and see what was sent with how many have read it.
// Server side: src/supabase/migrations/add_notification_targets.sql (send_announcement, get_announcement_history,
// delete_announcement). The server decides who receives it; this page only picks the target and shows the count.

const TARGETS = [
  { id: 'all', label: 'Toàn web', icon: Globe, hint: 'Mọi học sinh và giáo viên' },
  { id: 'teachers', label: 'Giáo viên', icon: GraduationCap, hint: 'Tất cả giáo viên' },
  { id: 'students', label: 'Học sinh', icon: Users, hint: 'Tất cả học sinh' },
  { id: 'courses', label: 'Lớp', icon: BookOpen, hint: 'Học sinh đang học và giáo viên của các lớp đã chọn' },
  { id: 'users', label: 'Từng người', icon: UserCheck, hint: 'Những người đã chọn' },
]
// History also shows announcements sent to a cohort before this page changed.
const HISTORY_TARGETS = { ...Object.fromEntries(TARGETS.map(t => [t.id, t])), cohort: { label: 'Cohort', icon: Users } }

const TITLE_MAX = 200
const MESSAGE_MAX = 5000
const ROLE_LABELS = { teacher: 'GV', user: 'HS' }

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const displayName = (u) => u.full_name || u.username || u.email || '?'

const shortList = (names, max = 3) => {
  if (!names || names.length === 0) return ''
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `${shown} +${names.length - max}` : shown
}

// ---- Target choice --------------------------------------------------------------------------------------------

const TargetPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {TARGETS.map(({ id, label, icon: Icon }) => {
      const active = value === id
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      )
    })}
  </div>
)

const CoursePicker = ({ courses, loading, selectedIds, onChange }) => {
  const [filter, setFilter] = useState('')
  const term = filter.trim().toLowerCase()
  const shown = term ? courses.filter(c => (c.title || '').toLowerCase().includes(term)) : courses

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="border rounded-lg">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Tìm lớp..."
          className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
        />
        {selectedIds.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">
            Bỏ chọn ({selectedIds.length})
          </button>
        )}
      </div>
      <div className="max-h-60 overflow-y-auto divide-y">
        {loading ? (
          <p className="px-3 py-4 text-sm text-gray-400 text-center">Đang tải lớp...</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-400 text-center">Không có lớp nào</p>
        ) : shown.map(c => {
          const checked = selectedIds.includes(c.id)
          return (
            <label key={c.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} className="h-4 w-4 accent-blue-600" />
              <span className={`flex-1 min-w-0 truncate ${c.is_active === false ? 'text-gray-400' : 'text-gray-800'}`}>
                {c.title}
              </span>
              {c.is_active === false && <span className="text-xs text-gray-400">đã tắt</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}

const PeoplePicker = ({ selected, onChange, onError }) => {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    // Strip the characters PostgREST uses to delimit an `or` filter.
    const term = search.replace(/[,()%*]/g, ' ').trim()
    if (!term) {
      setResults([])
      setSearching(false)
      return undefined
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, username, email, role')
        .or('role.is.null,role.neq.admin')
        .or(`full_name.ilike.%${term}%,username.ilike.%${term}%,email.ilike.%${term}%,real_name.ilike.%${term}%`)
        .order('full_name')
        .limit(20)
      if (cancelled) return
      setSearching(false)
      if (error) {
        setResults([])
        onError('Lỗi tìm người dùng: ' + error.message)
        return
      }
      setResults(data || [])
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, onError])

  const selectedIds = selected.map(u => u.id)
  const add = (u) => {
    if (!selectedIds.includes(u.id)) onChange([...selected, u])
  }
  const remove = (id) => onChange(selected.filter(u => u.id !== id))

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(u => (
            <span key={u.id} className="flex items-center gap-1 pl-2.5 pr-1 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-sm">
              {displayName(u)}
              <button type="button" onClick={() => remove(u.id)} className="p-0.5 rounded-full hover:bg-blue-100" aria-label={`Bỏ ${displayName(u)}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="border rounded-lg">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, username hoặc email..."
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <div className="max-h-60 overflow-y-auto divide-y">
          {!search.trim() ? (
            <p className="px-3 py-4 text-sm text-gray-400 text-center">Gõ để tìm người cần gửi</p>
          ) : searching ? (
            <p className="px-3 py-4 text-sm text-gray-400 text-center">Đang tìm...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-400 text-center">Không tìm thấy ai</p>
          ) : results.map(u => {
            const picked = selectedIds.includes(u.id)
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => (picked ? remove(u.id) : add(u))}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm ${picked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <span className={`w-4 h-4 flex items-center justify-center rounded border ${picked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                  {picked && <Check size={12} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-gray-800">{displayName(u)}</span>
                  <span className="block truncate text-xs text-gray-400">{u.username || u.email}</span>
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{ROLE_LABELS[u.role] || 'HS'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---- History --------------------------------------------------------------------------------------------------

const HistoryItem = ({ item, onDelete, deleting }) => {
  const target = HISTORY_TARGETS[item.target_type] || HISTORY_TARGETS.all
  const Icon = target.icon
  const names = shortList(item.target_names)
  const percent = item.recipient_count > 0 ? Math.round((item.read_count / item.recipient_count) * 100) : 0

  return (
    <div className="flex items-start justify-between gap-3 p-4 bg-gray-50 rounded-lg border">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h4 className="font-semibold text-gray-800 break-words">{item.title}</h4>
          <span
            className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md inline-flex items-start gap-1 max-w-full"
            title={item.target_names?.length ? item.target_names.join(', ') : target.label}
          >
            <Icon size={11} className="flex-shrink-0 mt-0.5" />
            <span className="break-words min-w-0">{target.label}{names ? `: ${names}` : ''}</span>
          </span>
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-wrap break-words line-clamp-3">{item.message}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
          <span>{formatDate(item.created_at)}</span>
          <span className="flex items-center gap-2">
            <span className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <span className="block h-full bg-green-500" style={{ width: `${percent}%` }} />
            </span>
            Đã đọc {item.read_count}/{item.recipient_count}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDelete(item)}
        disabled={deleting}
        className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50"
        title="Xoá thông báo này"
        aria-label="Xoá thông báo này"
      >
        <Trash2 size={16} className="text-red-400" />
      </button>
    </div>
  )
}

// ---- Page -----------------------------------------------------------------------------------------------------

const NotificationManagement = () => {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState('all')
  const [selectedCourseIds, setSelectedCourseIds] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success' | 'error', text }

  const [courses, setCourses] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(false)
  const coursesLoadedRef = useRef(false)

  const [preview, setPreview] = useState({ count: null, loading: false, error: null })
  const previewSeqRef = useRef(0)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  const flash = useCallback((type, text) => setStatus({ type, text }), [])
  const showError = useCallback((text) => flash('error', text), [flash])

  useEffect(() => {
    if (!status) return undefined
    const timer = setTimeout(() => setStatus(null), 6000)
    return () => clearTimeout(timer)
  }, [status])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data, error } = await supabase.rpc('get_announcement_history', { p_limit: 50 })
    setHistoryLoading(false)
    if (error) {
      showError('Lỗi tải lịch sử: ' + error.message)
      return
    }
    setHistory(data || [])
  }, [showError])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Classes are loaded the first time "Lớp" is picked.
  useEffect(() => {
    if (target !== 'courses' || coursesLoadedRef.current) return
    coursesLoadedRef.current = true
    setCoursesLoading(true)
    supabase
      .from('courses')
      .select('id, title, level_number, is_active')
      .order('level_number')
      .then(({ data, error }) => {
        setCoursesLoading(false)
        if (error) {
          coursesLoadedRef.current = false
          showError('Lỗi tải danh sách lớp: ' + error.message)
          return
        }
        setCourses(data || [])
      })
  }, [target, showError])

  // How many people the current choice reaches, counted by the server (send_announcement with p_dry_run).
  const courseKey = selectedCourseIds.join(',')
  const userKey = selectedUsers.map(u => u.id).join(',')
  useEffect(() => {
    const seq = ++previewSeqRef.current
    const courseIds = courseKey ? courseKey.split(',') : []
    const userIds = userKey ? userKey.split(',') : []
    if ((target === 'courses' && courseIds.length === 0) || (target === 'users' && userIds.length === 0)) {
      setPreview({ count: 0, loading: false, error: null })
      return undefined
    }
    setPreview(p => ({ ...p, loading: true, error: null }))
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('send_announcement', {
        p_title: '',
        p_message: '',
        p_target: target,
        p_course_ids: target === 'courses' ? courseIds : null,
        p_user_ids: target === 'users' ? userIds : null,
        p_dry_run: true
      })
      if (seq !== previewSeqRef.current) return
      if (error) setPreview({ count: null, loading: false, error: error.message })
      else setPreview({ count: data?.recipients ?? 0, loading: false, error: null })
    }, 250)
    return () => clearTimeout(timer)
  }, [target, courseKey, userKey])

  const targetInfo = TARGETS.find(t => t.id === target)
  const needsPick = (target === 'courses' && selectedCourseIds.length === 0) || (target === 'users' && selectedUsers.length === 0)
  const canSend = !sending && title.trim() && message.trim() && !preview.loading && preview.count > 0

  const handleSend = async (e) => {
    e.preventDefault()
    if (!canSend) return
    const who = target === 'all' ? 'TOÀN WEB' : targetInfo.label.toLowerCase()
    if (!window.confirm(`Gửi "${title.trim()}" tới ${preview.count} người (${who})?`)) return

    setSending(true)
    const { data, error } = await supabase.rpc('send_announcement', {
      p_title: title.trim(),
      p_message: message.trim(),
      p_target: target,
      p_course_ids: target === 'courses' ? selectedCourseIds : null,
      p_user_ids: target === 'users' ? selectedUsers.map(u => u.id) : null,
      p_dry_run: false
    })
    setSending(false)
    if (error) {
      showError('Lỗi: ' + error.message)
      return
    }
    flash('success', `Đã gửi tới ${data?.recipients ?? 0} người`)
    setTitle('')
    setMessage('')
    setSelectedCourseIds([])
    setSelectedUsers([])
    loadHistory()
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Xoá "${item.title}"? ${item.recipient_count} người nhận sẽ không thấy thông báo này nữa.`)) return
    setDeletingId(item.batch_id)
    const { error } = await supabase.rpc('delete_announcement', { p_batch_id: item.batch_id })
    setDeletingId(null)
    if (error) {
      showError('Lỗi xoá: ' + error.message)
      return
    }
    setHistory(prev => prev.filter(h => h.batch_id !== item.batch_id))
    flash('success', 'Đã xoá thông báo')
  }

  return (
    <div className="space-y-6">
      {status && (
        <div
          role={status.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg border text-sm ${
            status.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          <span className="break-words">{status.text}</span>
          <button onClick={() => setStatus(null)} className="flex-shrink-0" aria-label="Đóng"><X size={16} /></button>
        </div>
      )}

      {/* Send */}
      <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={20} className="text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Gửi thông báo</h3>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="VD: Bảo trì hệ thống"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MESSAGE_MAX}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              rows={3}
              placeholder="Nội dung thông báo..."
              required
            />
            {message.length > MESSAGE_MAX - 500 && (
              <p className="text-xs text-gray-400 text-right mt-1">{message.length}/{MESSAGE_MAX}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Gửi đến</label>
            <TargetPicker value={target} onChange={setTarget} />
            <p className="text-xs text-gray-500">{targetInfo.hint}. Người vào lớp hoặc có tài khoản sau lúc gửi sẽ không thấy. Admin không nhận.</p>
            {target === 'courses' && (
              <CoursePicker courses={courses} loading={coursesLoading} selectedIds={selectedCourseIds} onChange={setSelectedCourseIds} />
            )}
            {target === 'users' && (
              <PeoplePicker selected={selectedUsers} onChange={setSelectedUsers} onError={showError} />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={!canSend}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
              {sending ? 'Đang gửi...' : 'Gửi thông báo'}
            </button>
            <span className="text-sm text-gray-600" aria-live="polite">
              {needsPick
                ? (target === 'courses' ? 'Chọn ít nhất một lớp' : 'Chọn ít nhất một người')
                : preview.loading
                  ? 'Đang đếm người nhận...'
                  : preview.error
                    ? <span className="text-red-600">Không đếm được: {preview.error}</span>
                    : <>Sẽ gửi tới <b>{preview.count}</b> người</>}
            </span>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Lịch sử thông báo</h3>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            title="Tải lại"
            aria-label="Tải lại lịch sử"
          >
            <RefreshCw size={16} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {historyLoading && history.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Megaphone size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Chưa có thông báo nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(item => (
              <HistoryItem key={item.batch_id} item={item} onDelete={handleDelete} deleting={deletingId === item.batch_id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationManagement
