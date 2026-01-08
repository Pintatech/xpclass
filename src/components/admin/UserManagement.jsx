import { useState, useEffect } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import {
  ArrowLeft,
  Search,
  Filter,
  UserPlus,
  Shield,
  Ban,
  CheckCircle,
  Users,
  Trash2,
  AlertCircle
} from 'lucide-react'
import BulkUserImport from './BulkUserImport'

const UserManagement = () => {
  const { user: currentUser } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notification, setNotification] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch cohort memberships for all users
      const userIds = (data || []).map(u => u.id)
      let membershipsMap = {}
      if (userIds.length > 0) {
        const { data: memberships } = await supabase
          .from('cohort_members')
          .select('student_id, cohort_id, cohorts(name)')
          .in('student_id', userIds)
          .eq('is_active', true)

        membershipsMap = (memberships || []).reduce((acc, row) => {
          const sid = row.student_id
          const cname = row.cohorts?.name || ''
          if (!acc[sid]) acc[sid] = []
          if (cname) acc[sid].push(cname)
          return acc
        }, {})
      }

      // Format user data
      const formattedUsers = data.map(user => ({
        id: user.id,
        name: user.full_name || 'No Name',
        username: user.username || '',
        email: user.email,
        role: user.role || 'user',
        level: user.current_level || 1,
        xp: user.xp || 0,
        status: 'active', // Can be enhanced to track actual status
        lastActive: user.last_activity_date || new Date(user.created_at).toISOString().split('T')[0],
        joinDate: new Date(user.created_at).toISOString().split('T')[0],
        streakCount: user.streak_count || 0,
        totalPracticeTime: user.total_practice_time || 0,
        cohorts: membershipsMap[user.id] || []
      }))

      setUsers(formattedUsers)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to load users: ' + err.message)
      showNotification('Error loading users: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUserRole = async (userId, newRole) => {
    // Prevent changing own role
    if (userId === currentUser?.id) {
      showNotification('Cannot change your own role', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      showNotification(`User role updated to ${getRoleLabel(newRole)}`)
      fetchUsers() // Refresh the list
    } catch (err) {
      console.error('Error updating user role:', err)
      showNotification('Error updating user role: ' + err.message, 'error')
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    // Prevent deleting own account
    if (userId === currentUser?.id) {
      showNotification('Cannot delete your own account', 'error')
      return
    }

    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      showNotification(`User "${userName}" deleted successfully`)
      fetchUsers() // Refresh the list
    } catch (err) {
      console.error('Error deleting user:', err)
      showNotification('Error deleting user: ' + err.message, 'error')
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || user.role === filterRole
    return matchesSearch && matchesRole
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'inactive':
        return 'text-gray-600 bg-gray-100'
      case 'banned':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return 'text-purple-600 bg-purple-100'
      case 'teacher':
        return 'text-green-600 bg-green-100'
      case 'user':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Quản trị'
      case 'teacher':
        return 'Giáo viên'
      case 'user':
        return 'Học viên'
      default:
        return 'Không xác định'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3">Đang tải danh sách người dùng...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={fetchUsers}
                className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Users Table */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
              Danh sách người dùng ({filteredUsers.length})
            </h3>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="input min-w-[120px]"
              >
                <option value="all">Tất cả</option>
                <option value="user">Học viên</option>
                <option value="teacher">Giáo viên</option>
                <option value="admin">Quản trị</option>
              </select>
            </div>

            <div className="ml-auto">
              <Button onClick={() => setShowBulkImport(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Thêm người dùng
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Content className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Người dùng</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Username</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Cohorts</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Tiến độ</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Trạng thái</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Hoạt động cuối</th>
                  <th className="text-center py-3 px-6 font-medium text-gray-500">Vai trò</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center text-white font-medium">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-mono text-gray-700">
                        {user.username || <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-sm text-gray-700">
                      {user.cohorts.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.cohorts.map((cname) => (
                            <span key={cname} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{cname}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">Cấp {user.level}</div>
                        <div className="text-gray-600">{user.xp.toLocaleString()} XP</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(user.status)}`}>
                        {user.status === 'active' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {user.status === 'banned' && <Ban className="w-3 h-3 mr-1" />}
                        {user.status === 'active' ? 'Hoạt động' : 
                         user.status === 'banned' ? 'Bị khóa' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {user.lastActive}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                          disabled={user.id === currentUser?.id}
                          className={`text-xs px-2 py-1 border border-gray-300 rounded ${
                            user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="user">Học viên</option>
                          <option value="teacher">Giáo viên</option>
                          <option value="admin">Quản trị</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          disabled={user.id === currentUser?.id}
                          className={`text-red-600 hover:text-red-800 ${
                            user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{users.length}</div>
            <div className="text-sm text-gray-600">Tổng người dùng</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600">Đang hoạt động</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {users.filter(u => u.role === 'admin').length}
            </div>
            <div className="text-sm text-gray-600">Quản trị viên</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.role === 'teacher').length}
            </div>
            <div className="text-sm text-gray-600">Giáo viên</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {users.filter(u => {
                const joinDate = new Date(u.joinDate);
                const thisMonth = new Date();
                thisMonth.setDate(1);
                return joinDate >= thisMonth;
              }).length}
            </div>
            <div className="text-sm text-gray-600">Mới tháng này</div>
          </div>
        </Card>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          notification.type === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-green-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkUserImport
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            fetchUsers()
            showNotification('Users imported successfully!')
          }}
        />
      )}
    </div>
  )
}

export default UserManagement
