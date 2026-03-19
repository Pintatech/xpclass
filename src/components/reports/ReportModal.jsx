import { useState } from 'react'
import { X, Send, Bug, HelpCircle, MessageSquare, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useReports } from '../../hooks/useReports'

const CATEGORIES = [
  { value: 'bug', label: 'Lỗi / Bug', icon: Bug, color: 'text-red-500' },
  { value: 'question', label: 'Câu hỏi', icon: HelpCircle, color: 'text-blue-500' },
  { value: 'suggestion', label: 'Góp ý', icon: MessageSquare, color: 'text-green-500' },
  { value: 'other', label: 'Khác', icon: AlertTriangle, color: 'text-yellow-500' }
]

const STATUS_LABELS = {
  pending: { label: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  in_progress: { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700', icon: Clock },
  resolved: { label: 'Đã giải quyết', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Đã đóng', color: 'bg-gray-100 text-gray-700', icon: X }
}

const ReportModal = ({ isOpen, onClose }) => {
  const { myReports, submitReport, fetchMyReports, loading } = useReports()
  const [tab, setTab] = useState('new') // 'new' | 'history'
  const [category, setCategory] = useState('bug')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [expandedReport, setExpandedReport] = useState(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return

    try {
      setSubmitting(true)
      await submitReport({ category, subject: subject.trim(), message: message.trim() })
      setSuccess(true)
      setSubject('')
      setMessage('')
      setCategory('bug')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      alert('Gửi báo cáo thất bại: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTabSwitch = (newTab) => {
    setTab(newTab)
    if (newTab === 'history' && !historyLoaded) {
      fetchMyReports()
      setHistoryLoaded(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-orange-50 border-b border-orange-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <MessageSquare size={16} />
            </div>
            <span className="font-semibold text-orange-800 text-sm">Gửi báo cáo / Hỏi đáp</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-orange-100 text-orange-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabSwitch('new')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'new'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Gửi mới
          </button>
          <button
            onClick={() => handleTabSwitch('history')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === 'history'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Lịch sử
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'new' ? (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <CheckCircle size={16} />
                  Gửi báo cáo thành công! Admin sẽ phản hồi sớm.
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Loại báo cáo</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          category === cat.value
                            ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={16} className={cat.color} />
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Mô tả ngắn gọn vấn đề..."
                  maxLength={200}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung chi tiết</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                  rows={4}
                  required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !subject.trim() || !message.trim()}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
            </form>
          ) : (
            <div className="p-5">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : myReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Bạn chưa gửi báo cáo nào.
                </div>
              ) : (
                <div className="space-y-3">
                  {myReports.map(report => {
                    const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.pending
                    const StatusIcon = statusInfo.icon
                    const catInfo = CATEGORIES.find(c => c.value === report.category) || CATEGORIES[3]
                    const CatIcon = catInfo.icon
                    const isExpanded = expandedReport === report.id

                    return (
                      <div key={report.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          <CatIcon size={16} className={catInfo.color} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{report.subject}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(report.created_at).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            <StatusIcon size={12} />
                            {statusInfo.label}
                          </span>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                            <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{report.message}</p>
                            {report.admin_reply && (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                <div className="text-xs font-medium text-blue-700 mb-1">Phản hồi từ Admin:</div>
                                <p className="text-sm text-blue-800 whitespace-pre-wrap">{report.admin_reply}</p>
                                {report.replied_at && (
                                  <div className="text-xs text-blue-500 mt-1">
                                    {new Date(report.replied_at).toLocaleDateString('vi-VN')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportModal
