import { useState, useEffect, useCallback } from 'react'
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
  AlertCircle,
  Gift,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import BulkUserImport from './BulkUserImport'

const PAGE_SIZE = 50

// Only the columns the table actually renders. select('*') pulled every column
// of every user on mount.
const USER_COLUMNS =
  'id, email, full_name, real_name, username, role, current_level, xp, gems, is_banned, streak_count, last_activity_date, total_practice_time, created_at'

const UserManagement = () => {
  const { user: currentUser } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterCohort, setFilterCohort] = useState('all') // a cohort id, or 'all'
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [cohortOptions, setCohortOptions] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, admins: 0, teachers: 0, newThisMonth: 0 })
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [notification, setNotification] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [giftUser, setGiftUser] = useState(null)
  const [giftXP, setGiftXP] = useState('')
  const [giftGems, setGiftGems] = useState('')
  const [giftLoading, setGiftLoading] = useState(false)
  const [shopItems, setShopItems] = useState([])
  const [collectibleItems, setCollectibleItems] = useState([])
  const [selectedShopItem, setSelectedShopItem] = useState('')
  const [selectedCollectibleItem, setSelectedCollectibleItem] = useState('')
  const [collectibleQty, setCollectibleQty] = useState(1)
  const [chests, setChests] = useState([])
  const [selectedChest, setSelectedChest] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [userInventory, setUserInventory] = useState([])
  const [userPurchases, setUserPurchases] = useState([])
  const [userChests, setUserChests] = useState([])
  const [pets, setPets] = useState([])
  const [selectedPet, setSelectedPet] = useState('')
  const [userPets, setUserPets] = useState([])
  const [giftTab, setGiftTab] = useState('gift') // 'gift' | 'inventory'

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const fetchUsers = useCallback(async () => {
    setRefreshing(true)
    setError(null)

    try {
      // The cohort filter runs server-side: resolve the cohort to its members
      // first, which is a far smaller id list than every user in the system.
      let cohortStudentIds = null
      if (filterCohort !== 'all') {
        const { data: members, error: membersError } = await supabase
          .from('cohort_members')
          .select('student_id')
          .eq('cohort_id', filterCohort)
          .eq('is_active', true)

        if (membersError) throw membersError

        cohortStudentIds = (members || []).map(m => m.student_id)
        if (cohortStudentIds.length === 0) {
          setUsers([])
          setTotalCount(0)
          return
        }
      }

      let query = supabase
        .from('users')
        .select(USER_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (filterRole !== 'all') query = query.eq('role', filterRole)
      if (cohortStudentIds) query = query.in('id', cohortStudentIds)

      if (debouncedSearch) {
        // Strip the characters PostgREST uses to delimit an `or` filter.
        const term = debouncedSearch.replace(/[,()%*]/g, ' ').trim()
        if (term) {
          query = query.or(
            `full_name.ilike.%${term}%,email.ilike.%${term}%,username.ilike.%${term}%,real_name.ilike.%${term}%`
          )
        }
      }

      const { data, error, count } = await query

      if (error) throw error

      // Fall back to page 0 if this page ran off the end (e.g. after a delete).
      if ((data || []).length === 0 && page > 0) {
        setPage(0)
        return
      }

      // Cohort memberships for this page only, not for every user in the table.
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
      const formattedUsers = (data || []).map(user => {
        const lastActivityDate = user.last_activity_date || new Date(user.created_at).toISOString().split('T')[0]
        const daysSinceActivity = Math.floor((new Date() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24))

        return {
          id: user.id,
          name: user.full_name || 'No Name',
          realName: user.real_name || '',
          username: user.username || '',
          email: user.email,
          role: user.role || 'user',
          level: user.current_level || 1,
          xp: user.xp || 0,
          gems: user.gems || 0,
          is_banned: user.is_banned || false,
          status: user.is_banned ? 'banned' : daysSinceActivity > 7 ? 'inactive' : 'active',
          lastActive: lastActivityDate,
          joinDate: new Date(user.created_at).toISOString().split('T')[0],
          streakCount: user.streak_count || 0,
          totalPracticeTime: user.total_practice_time || 0,
          cohorts: membershipsMap[user.id] || []
        }
      })

      setUsers(formattedUsers)
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to load users: ' + err.message)
      showNotification('Error loading users: ' + err.message, 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, debouncedSearch, filterRole, filterCohort])

  // Totals come from count-only queries so the cards stay accurate across pages.
  const fetchStats = useCallback(async () => {
    const activeCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const countOf = build => build(supabase.from('users').select('id', { count: 'exact', head: true }))

    try {
      const [total, active, admins, teachers, newThisMonth] = await Promise.all([
        countOf(q => q),
        countOf(q => q.gte('last_activity_date', activeCutoff).eq('is_banned', false)),
        countOf(q => q.eq('role', 'admin')),
        countOf(q => q.eq('role', 'teacher')),
        countOf(q => q.gte('created_at', monthStart.toISOString()))
      ])

      setStats({
        total: total.count || 0,
        active: active.count || 0,
        admins: admins.count || 0,
        teachers: teachers.count || 0,
        newThisMonth: newThisMonth.count || 0
      })
    } catch (err) {
      console.error('Error fetching user stats:', err)
    }
  }, [])

  const refresh = useCallback(() => {
    fetchUsers()
    fetchStats()
  }, [fetchUsers, fetchStats])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    fetchStats()

    supabase
      .from('cohorts')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error: cohortError }) => {
        if (cohortError) console.error('Error fetching cohorts:', cohortError)
        else setCohortOptions(data || [])
      })
  }, [fetchStats])

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
      refresh() // Refresh the list
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
      refresh() // Refresh the list
    } catch (err) {
      console.error('Error deleting user:', err)
      showNotification('Error deleting user: ' + err.message, 'error')
    }
  }

  const handleUpdateRealName = async (userId, realName) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ real_name: realName || null })
        .eq('id', userId)

      if (error) throw error
      showNotification('Real name updated')
      // Patch the row in place; refetching the page for one field is wasteful.
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, realName: realName || '' } : u)))
    } catch (err) {
      console.error('Error updating real name:', err)
      showNotification('Error updating real name: ' + err.message, 'error')
    }
  }

  const handleToggleBan = async (userId, userName, currentlyBanned) => {
    if (userId === currentUser?.id) {
      showNotification('Cannot ban your own account', 'error')
      return
    }

    const action = currentlyBanned ? 'unban' : 'ban'
    if (!confirm(`Are you sure you want to ${action} "${userName}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: !currentlyBanned })
        .eq('id', userId)

      if (error) throw error

      showNotification(`User "${userName}" ${currentlyBanned ? 'unbanned' : 'banned'} successfully`)
      refresh()
    } catch (err) {
      console.error('Error toggling ban:', err)
      showNotification('Error updating ban status: ' + err.message, 'error')
    }
  }

  const openGiftModal = async (user) => {
    setGiftUser(user)
    const [{ data: shop }, { data: collectibles }, { data: chestData }, { data: petData }] = await Promise.all([
      supabase.from('shop_items').select('id, name, category').eq('is_active', true).order('category').order('name'),
      supabase.from('collectible_items').select('id, name, item_type, rarity').eq('is_active', true).order('item_type').order('name'),
      supabase.from('chests').select('id, name, chest_type').eq('is_active', true).order('chest_type').order('name'),
      supabase.from('pets').select('id, name, rarity, image_url').eq('is_active', true).order('rarity').order('name'),
    ])
    setShopItems(shop || [])
    setCollectibleItems(collectibles || [])
    setChests(chestData || [])
    setPets(petData || [])
    // Also fetch user's current items
    fetchUserItems(user.id)
  }

  const closeGiftModal = () => {
    setGiftUser(null)
    setGiftXP('')
    setGiftGems('')
    setSelectedShopItem('')
    setSelectedCollectibleItem('')
    setCollectibleQty(1)
    setSelectedChest('')
    setSelectedPet('')
    setGiftMessage('')
    setGiftTab('gift')
    setUserInventory([])
    setUserPurchases([])
    setUserChests([])
    setUserPets([])
  }

  const fetchUserItems = async (userId) => {
    const [{ data: inv }, { data: purch }, { data: uchests }, { data: upets }] = await Promise.all([
      supabase.from('user_inventory').select('quantity, collectible_items(name, rarity, image_url)').eq('user_id', userId).gt('quantity', 0),
      supabase.from('user_purchases').select('shop_items(name, category, image_url)').eq('user_id', userId),
      supabase.from('user_chests').select('chests(name, chest_type, image_url), earned_at, opened_at').eq('user_id', userId).is('opened_at', null),
      supabase.from('user_pets').select('pet_id, is_active, pets(name, rarity, image_url)').eq('user_id', userId),
    ])
    setUserInventory(inv || [])
    setUserPurchases(purch || [])
    setUserChests(uchests || [])
    setUserPets(upets || [])
  }

  const handleGift = async () => {
    const xp = parseInt(giftXP) || 0
    const gems = parseInt(giftGems) || 0
    if (xp === 0 && gems === 0 && !selectedShopItem && !selectedCollectibleItem && !selectedChest && !selectedPet) {
      showNotification('Nhập số XP, Gems hoặc chọn item/chest', 'error')
      return
    }
    try {
      setGiftLoading(true)
      const parts = []

      // Update XP/Gems
      if (xp !== 0 || gems !== 0) {
        const updates = { updated_at: new Date().toISOString() }
        if (xp !== 0) updates.xp = (giftUser.xp || 0) + xp
        if (gems !== 0) updates.gems = (giftUser.gems || 0) + gems
        const { error } = await supabase.from('users').update(updates).eq('id', giftUser.id)
        if (error) throw error
        if (xp !== 0) parts.push(`${xp > 0 ? '+' : ''}${xp} XP`)
        if (gems !== 0) parts.push(`${gems > 0 ? '+' : ''}${gems} Gems`)
      }

      // Grant shop item
      if (selectedShopItem) {
        const { error } = await supabase.from('user_purchases').upsert({
          user_id: giftUser.id,
          item_id: selectedShopItem,
          purchased_at: new Date().toISOString()
        }, { onConflict: 'user_id,item_id' })
        if (error) throw error
        const item = shopItems.find(i => i.id === selectedShopItem)
        parts.push(`Shop: ${item?.name}`)
      }

      // Grant collectible item
      if (selectedCollectibleItem) {
        const qty = parseInt(collectibleQty) || 1
        const { data: existing } = await supabase
          .from('user_inventory')
          .select('id, quantity')
          .eq('user_id', giftUser.id)
          .eq('item_id', selectedCollectibleItem)
          .single()

        if (existing) {
          const { error } = await supabase.from('user_inventory')
            .update({ quantity: existing.quantity + qty, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('user_inventory')
            .insert({ user_id: giftUser.id, item_id: selectedCollectibleItem, quantity: qty })
          if (error) throw error
        }
        const item = collectibleItems.find(i => i.id === selectedCollectibleItem)
        parts.push(`${item?.name} x${qty}`)
      }

      // Grant chest
      if (selectedChest) {
        const { error } = await supabase.from('user_chests').insert({
          user_id: giftUser.id,
          chest_id: selectedChest,
          source: 'admin_gift',
        })
        if (error) throw error
        const chest = chests.find(c => c.id === selectedChest)
        parts.push(`Chest: ${chest?.name}`)
      }

      // Grant pet
      if (selectedPet) {
        const { count } = await supabase.from('user_pets').select('id', { count: 'exact', head: true }).eq('user_id', giftUser.id)
        const { error } = await supabase.from('user_pets').insert({
          user_id: giftUser.id,
          pet_id: selectedPet,
          is_active: count === 0,
        })
        if (error) throw error
        const pet = pets.find(p => p.id === selectedPet)
        parts.push(`Pet: ${pet?.name}`)
      }

      // Send notification to user
      if (parts.length > 0) {
        await supabase.from('notifications').insert({
          user_id: giftUser.id,
          type: 'admin_announcement',
          title: giftMessage || 'Bạn nhận được quà!',
          message: parts.join(', '),
          icon: 'Gift',
        })
      }

      showNotification(`${parts.join(', ')} cho ${giftUser.name}`)
      closeGiftModal()
      fetchUsers()
    } catch (err) {
      console.error('Error gifting:', err)
      showNotification('Lỗi: ' + err.message, 'error')
    } finally {
      setGiftLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-300'
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

  const getRelativeTime = (dateString) => {
    const now = new Date()
    const past = new Date(dateString)
    const diffMs = now - past
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffWeeks = Math.floor(diffDays / 7)
    const diffMonths = Math.floor(diffDays / 30)

    if (diffSeconds < 60) {
      return 'vừa xong'
    } else if (diffMinutes < 60) {
      return `${diffMinutes} phút trước`
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`
    } else if (diffDays < 7) {
      return `${diffDays} ngày trước`
    } else if (diffWeeks < 4) {
      return `${diffWeeks} tuần trước`
    } else if (diffMonths < 12) {
      return `${diffMonths} tháng trước`
    } else {
      return dateString // Show actual date if > 1 year
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
              User ({totalCount})
            </h3>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 bottom-[5%] transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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
                onChange={(e) => { setFilterRole(e.target.value); setPage(0) }}
                className="input min-w-[120px]"
              >
                <option value="all">Tất cả</option>
                <option value="user">Học viên</option>
                <option value="teacher">Giáo viên</option>
                <option value="admin">Quản trị</option>
              </select>
            </div>

            {/* Cohort Filter */}
            <select
              value={filterCohort}
              onChange={(e) => { setFilterCohort(e.target.value); setPage(0) }}
              className="input min-w-[120px]"
            >
              <option value="all">Tất cả Cohort</option>
              {cohortOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="ml-auto">
              <Button onClick={() => setShowBulkImport(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Content className="p-0">
          <div className={`overflow-x-auto transition-opacity ${refreshing ? 'opacity-50' : ''}`}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Người dùng</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Tên thật</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Username</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Cohorts</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-500">Hoạt động cuối</th>
                  <th className="text-center py-3 px-6 font-medium text-gray-500">Vai trò</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-600">{user.email.split("@")[0]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <input
                        type="text"
                        defaultValue={user.realName}
                        placeholder="—"
                        className="text-sm text-gray-700 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 w-32 bg-transparent"
                        onBlur={(e) => {
                          if (e.target.value !== user.realName) {
                            handleUpdateRealName(user.id, e.target.value)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur()
                        }}
                      />
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
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {getRelativeTime(user.lastActive)}
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
                          onClick={() => openGiftModal(user)}
                          className="text-amber-600 hover:text-amber-800"
                          title="Tặng XP/Gems"
                        >
                          <Gift className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleBan(user.id, user.name, user.is_banned)}
                          disabled={user.id === currentUser?.id}
                          className={`${user.is_banned ? 'text-green-600 hover:text-green-800' : 'text-orange-600 hover:text-orange-800'} ${
                            user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title={user.is_banned ? 'Unban user' : 'Ban user'}
                        >
                          {user.is_banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </Button>
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
            {users.length === 0 && !refreshing && (
              <div className="py-12 text-center text-gray-500">
                Không tìm thấy người dùng nào
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-3">
              <div className="text-sm text-gray-600">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(prev => Math.max(0, prev - 1))}
                  disabled={page === 0 || refreshing}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  Trang {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                  disabled={page >= totalPages - 1 || refreshing}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Tổng người dùng</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.active}
            </div>
            <div className="text-sm text-gray-600">Đang hoạt động</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats.admins}
            </div>
            <div className="text-sm text-gray-600">Quản trị viên</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.teachers}
            </div>
            <div className="text-sm text-gray-600">Giáo viên</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.newThisMonth}
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

      {/* Gift Modal */}
      {giftUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Tặng cho {giftUser.name}</h3>
              <button onClick={closeGiftModal}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setGiftTab('gift')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  giftTab === 'gift' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Tặng
              </button>
              <button
                onClick={() => setGiftTab('inventory')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  giftTab === 'inventory' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Xem đồ ({userPurchases.length + userInventory.length + userChests.length + userPets.length})
              </button>
            </div>

            {giftTab === 'inventory' ? (
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                <div className="text-sm text-gray-500">
                  {giftUser.xp.toLocaleString()} XP, {giftUser.gems.toLocaleString()} Gems
                </div>
                {userPurchases.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Shop Items</div>
                    <div className="grid grid-cols-3 gap-2">
                      {userPurchases.map((p, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 bg-gray-50 border rounded-lg p-2">
                          {p.shop_items?.image_url ? (
                            <img src={p.shop_items.image_url} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">?</div>
                          )}
                          <span className="text-xs text-center text-gray-700 leading-tight">{p.shop_items?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {userInventory.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Collectibles</div>
                    <div className="grid grid-cols-3 gap-2">
                      {userInventory.map((inv, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 bg-gray-50 border rounded-lg p-2 relative">
                          {inv.collectible_items?.image_url ? (
                            <img src={inv.collectible_items.image_url} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">?</div>
                          )}
                          <span className="text-xs text-center text-gray-700 leading-tight">{inv.collectible_items?.name}</span>
                          <span className="absolute top-1 right-1 bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{inv.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {userChests.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Chests (chưa mở)</div>
                    <div className="grid grid-cols-3 gap-2">
                      {userChests.map((c, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 bg-gray-50 border rounded-lg p-2">
                          {c.chests?.image_url ? (
                            <img src={c.chests.image_url} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">?</div>
                          )}
                          <span className="text-xs text-center text-gray-700 leading-tight">{c.chests?.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {userPets.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">Pets</div>
                    <div className="grid grid-cols-3 gap-2">
                      {userPets.map((up, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 bg-gray-50 border rounded-lg p-2 relative">
                          {up.pets?.image_url ? (
                            <img src={up.pets.image_url} alt="" className="w-10 h-10 object-contain" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">?</div>
                          )}
                          <span className="text-xs text-center text-gray-700 leading-tight">{up.pets?.name}</span>
                          {up.is_active && (
                            <span className="absolute top-1 right-1 bg-green-500 text-white text-[10px] rounded-full px-1.5">active</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {userPurchases.length === 0 && userInventory.length === 0 && userChests.length === 0 && userPets.length === 0 && (
                  <div className="text-center text-gray-400 py-8">Không có gì</div>
                )}
              </div>
            ) : (
            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-500">
                Hiện tại: {giftUser.xp.toLocaleString()} XP, {giftUser.gems.toLocaleString()} Gems
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">XP</label>
                  <input
                    type="number"
                    value={giftXP}
                    onChange={(e) => setGiftXP(e.target.value)}
                    placeholder="VD: 100 hoặc -50"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gems</label>
                  <input
                    type="number"
                    value={giftGems}
                    onChange={(e) => setGiftGems(e.target.value)}
                    placeholder="VD: 10 hoặc -5"
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Item</label>
                <select
                  value={selectedShopItem}
                  onChange={(e) => setSelectedShopItem(e.target.value)}
                  className="input w-full"
                >
                  <option value="">-- Không chọn --</option>
                  {shopItems.map(item => (
                    <option key={item.id} value={item.id}>[{item.category}] {item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collectible Item</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCollectibleItem}
                    onChange={(e) => setSelectedCollectibleItem(e.target.value)}
                    className="input flex-1"
                  >
                    <option value="">-- Không chọn --</option>
                    {collectibleItems.map(item => (
                      <option key={item.id} value={item.id}>[{item.rarity}] {item.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={collectibleQty}
                    onChange={(e) => setCollectibleQty(e.target.value)}
                    className="input w-16 text-center"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chest</label>
                <select
                  value={selectedChest}
                  onChange={(e) => setSelectedChest(e.target.value)}
                  className="input w-full"
                >
                  <option value="">-- Không chọn --</option>
                  {chests.map(chest => (
                    <option key={chest.id} value={chest.id}>[{chest.chest_type}] {chest.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pet</label>
                <select
                  value={selectedPet}
                  onChange={(e) => setSelectedPet(e.target.value)}
                  className="input w-full"
                >
                  <option value="">-- Không chọn --</option>
                  {pets.map(pet => (
                    <option key={pet.id} value={pet.id}>[{pet.rarity}] {pet.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lời nhắn</label>
                <input
                  type="text"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="Mặc định: Bạn nhận được quà!"
                  className="input w-full"
                />
              </div>
            </div>
            )}
            {giftTab === 'gift' && (
              <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="ghost" onClick={closeGiftModal}>
                  Hủy
                </Button>
                <Button onClick={handleGift} disabled={giftLoading}>
                  {giftLoading ? 'Đang xử lý...' : 'Xác nhận'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkUserImport
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            refresh()
            showNotification('Users imported successfully!')
          }}
        />
      )}
    </div>
  )
}

export default UserManagement
