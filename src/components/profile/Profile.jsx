import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import {
  User,
  Star,
  Trophy,
  Target,
  BookOpen,
  Clock,
  Flame,
  Calendar,
  Mail,
  Edit3,
  Settings,
  Award,
  TrendingUp,
  Activity,
  CheckCircle,
  PlayCircle
} from 'lucide-react'

const Profile = () => {
  const { user, profile, updateProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    full_name: ''
  })

  // Stats state
  const [stats, setStats] = useState({
    totalXP: 0,
    currentLevel: 1,
    exercisesCompleted: 0,
    streakCount: 0,
    totalPracticeTime: 0,
    averageScore: 0,
    levelsCompleted: 0,
    unitsCompleted: 0,
    sessionsCompleted: 0
  })

  // Recent activity state
  const [recentActivity, setRecentActivity] = useState([])

  // Avatar state
  const [availableAvatars, setAvailableAvatars] = useState([])
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState('')

  useEffect(() => {
    if (profile) {
      setEditData({
        full_name: profile.full_name || ''
      })
      setSelectedAvatar(profile.avatar_url || '👤')
      fetchUserStats()
      fetchRecentActivity()
      fetchAvailableAvatars()
    }
  }, [profile])

  const fetchUserStats = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch user progress data
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select(`
          *,
          exercises (
            id,
            title,
            exercise_type,
            xp_reward
          )
        `)
        .eq('user_id', user.id)

      if (progressError) throw progressError

      // Calculate stats from progress data
      const completed = progressData?.filter(p => p.status === 'completed') || []
      const totalXP = profile?.xp || 0
      const exercisesCompleted = completed.length
      const averageScore = completed.length > 0
        ? Math.round(completed.reduce((sum, p) => sum + (p.score || 0), 0) / completed.length)
        : 0

      // Fetch additional user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (userError) throw userError

      setStats({
        totalXP,
        currentLevel: userData?.level || 1,
        exercisesCompleted,
        streakCount: userData?.streak_count || 0,
        totalPracticeTime: userData?.total_practice_time || 0,
        averageScore,
        levelsCompleted: 0, // We can calculate this if needed
        unitsCompleted: 0,  // We can calculate this if needed
        sessionsCompleted: 0 // We can calculate this if needed
      })

    } catch (error) {
      console.error('Error fetching user stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentActivity = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select(`
          *,
          exercises (
            title,
            exercise_type
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10)

      if (error) throw error

      setRecentActivity(data || [])
    } catch (error) {
      console.error('Error fetching recent activity:', error)
    }
  }

  const fetchAvailableAvatars = async () => {
    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('is_active', true)
        .order('unlock_xp', { ascending: true })

      if (error) throw error

      setAvailableAvatars(data || [])
    } catch (error) {
      console.error('Error fetching avatars:', error)
    }
  }

  const handleAvatarSelect = async (avatar) => {
    if (stats.totalXP < avatar.unlock_xp) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: avatar.image_url })
        .eq('id', user.id)

      if (error) throw error

      setSelectedAvatar(avatar.image_url)
      setShowAvatarSelector(false)
    } catch (error) {
      console.error('Error updating avatar:', error)
    }
  }

  const handleEditToggle = () => {
    setIsEditing(!isEditing)
    if (!isEditing) {
      setEditData({
        full_name: profile?.full_name || ''
      })
    }
  }

  const handleSaveProfile = async () => {
    try {
      await updateProfile(editData)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  const getExerciseTypeIcon = (type) => {
    const icons = {
      multiple_choice: Target,
      flashcard: BookOpen,
      audio_flashcard: Activity
    }
    return icons[type] || BookOpen
  }

  const getExerciseTypeLabel = (type) => {
    const labels = {
      multiple_choice: 'Multiple Choice',
      flashcard: 'Flashcard',
      audio_flashcard: 'Audio Flashcard'
    }
    return labels[type] || type
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))

    if (diffInMinutes < 1) return 'Vừa xong'
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} giờ trước`
    return `${Math.floor(diffInMinutes / 1440)} ngày trước`
  }

  const formatPracticeTime = (minutes) => {
    if (minutes < 60) return `${minutes} phút`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} giờ`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <Card.Content className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div
                className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-white/30 transition-colors overflow-hidden"
                onClick={() => setShowAvatarSelector(true)}
                title="Click to change avatar"
              >
                {selectedAvatar ? (
                  selectedAvatar.startsWith('http') ? (
                    <img src={selectedAvatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    selectedAvatar
                  )
                ) : (
                  profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <div>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Tên đầy đủ"
                      value={editData.full_name}
                      onChange={(e) => setEditData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="px-3 py-1 rounded-lg text-gray-900 text-xl font-bold"
                    />
                    <p className="text-blue-100 flex items-center space-x-2">
                      <Mail className="w-4 h-4" />
                      <span>{profile?.email}</span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <h1 className="text-3xl font-bold">
                      {profile?.full_name || 'Người dùng'}
                    </h1>
                    <p className="text-blue-100 flex items-center space-x-2 mt-1">
                      <Mail className="w-4 h-4" />
                      <span>{profile?.email}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              {isEditing ? (
                <div className="space-x-2">
                  <Button onClick={handleSaveProfile} variant="outline" className="text-white border-white">
                    Lưu
                  </Button>
                  <Button onClick={handleEditToggle} variant="ghost" className="text-white">
                    Hủy
                  </Button>
                </div>
              ) : (
                <Button onClick={handleEditToggle} variant="ghost" className="text-white">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Chỉnh sửa
                </Button>
              )}
            </div>
          </div>

          {/* Level and XP Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Cấp {stats.currentLevel}</span>
              <span>{stats.totalXP} XP</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white h-3 rounded-full transition-all duration-300"
                style={{ width: `${((stats.totalXP % 1000) / 1000) * 100}%` }}
              />
            </div>
            <div className="text-xs text-blue-100 mt-1 text-center">
              {1000 - (stats.totalXP % 1000)} XP đến cấp tiếp theo
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <Card.Content className="p-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalXP}</div>
            <div className="text-sm text-gray-600">Tổng XP</div>
          </Card.Content>
        </Card>

        <Card className="text-center">
          <Card.Content className="p-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.exercisesCompleted}</div>
            <div className="text-sm text-gray-600">Bài tập hoàn thành</div>
          </Card.Content>
        </Card>

        <Card className="text-center">
          <Card.Content className="p-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Flame className="w-6 h-6 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.streakCount}</div>
            <div className="text-sm text-gray-600">Chuỗi ngày học</div>
          </Card.Content>
        </Card>

        <Card className="text-center">
          <Card.Content className="p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.averageScore}%</div>
            <div className="text-sm text-gray-600">Điểm trung bình</div>
          </Card.Content>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Hoạt động gần đây</span>
          </h2>
        </Card.Header>
        <Card.Content>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => {
                const IconComponent = getExerciseTypeIcon(activity.exercises?.exercise_type)
                return (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        Hoàn thành: {activity.exercises?.title}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {getExerciseTypeLabel(activity.exercises?.exercise_type)} • Điểm: {activity.score}% • {formatTimeAgo(activity.completed_at)}
                      </p>
                    </div>
                    <div className="text-green-600 font-semibold">
                      +{activity.score || 0} XP
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Chưa có hoạt động nào. Hãy bắt đầu học thôi!</p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Thời gian học tập</span>
            </h3>
          </Card.Header>
          <Card.Content>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {formatPracticeTime(stats.totalPracticeTime)}
            </div>
            <p className="text-gray-600">Tổng thời gian luyện tập</p>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Tham gia từ</span>
            </h3>
          </Card.Header>
          <Card.Content>
            <div className="text-lg font-medium text-gray-900 mb-2">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'N/A'}
            </div>
            <p className="text-gray-600">Ngày đăng ký tài khoản</p>
          </Card.Content>
        </Card>
      </div>

      {/* Avatar Selector Modal */}
      {showAvatarSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Chọn Avatar</h3>
              <button
                onClick={() => setShowAvatarSelector(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-8">
              {availableAvatars.map((avatar) => {
                const isUnlocked = stats.totalXP >= avatar.unlock_xp
                const isSelected = selectedAvatar === avatar.image_url

                return (
                  <div key={avatar.id} className="text-center">
                    <div
                      className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl cursor-pointer transition-all overflow-hidden ${
                        isUnlocked
                          ? isSelected
                            ? 'bg-blue-500 text-white ring-4 ring-blue-300'
                            : 'bg-gray-100 hover:bg-gray-200'
                          : 'bg-gray-300 cursor-not-allowed opacity-50'
                      }`}
                      onClick={() => isUnlocked && handleAvatarSelect(avatar)}
                      title={
                        isUnlocked
                          ? `${avatar.name} - ${avatar.description}`
                          : `${avatar.name} - Cần ${avatar.unlock_xp} XP để mở khóa`
                      }
                    >
                      {avatar.image_url.startsWith('http') ? (
                        <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                      ) : (
                        avatar.image_url
                      )}
                    </div>
                    <div className="text-xs mt-1">
                      {!isUnlocked && (
                        <div className="text-red-500 font-medium">
                          {avatar.unlock_xp} XP
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              
              <div className="mt-3 text-center">
                <span className="text-lg font-bold text-blue-900">
                  XP hiện tại: {stats.totalXP}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile