import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import { useAchievements } from '../../hooks/useAchievements'
import { usePet } from '../../hooks/usePet'
import { supabase } from '../../supabase/client'
import { LogOut } from 'lucide-react'
import ClaimCelebration from '../ui/ClaimCelebration'
import { levelInfoFor } from '../../utils/levelInfo'
import { tierKey } from './profileUtils'
import { Skel, Toast } from './parts/bits'
import ProfileHero from './parts/ProfileHero'
import StatTiles from './parts/StatTiles'
import LevelRoad from './parts/LevelRoad'
import AchievementShelf from './parts/AchievementShelf'
import PetShelf from './parts/PetShelf'
import AvatarPicker from './parts/AvatarPicker'
import BadgeSheet from './parts/BadgeSheet'
import AchievementSheet from './parts/AchievementSheet'
import './Profile.css'

// What the page looks like while a profile loads for the first time.
const ProfileSkeleton = () => (
  <div className="pf-root mx-auto max-w-5xl space-y-4 sm:space-y-5" aria-busy="true" aria-label="Loading" data-profile="loading">
    <Skel className="h-[332px] rounded-[28px] md:h-[232px]" />
    <div className="pf-tiles">
      {[0, 1, 2, 3].map((i) => (
        <Skel key={i} className="h-[72px] rounded-[22px] sm:h-20" />
      ))}
    </div>
    <div className="pf-main">
      <Skel className="pf-area-road h-[232px] rounded-3xl" />
      <Skel className="pf-area-pets h-[232px] rounded-3xl" />
      <Skel className="pf-area-ach h-[220px] rounded-3xl" />
    </div>
  </div>
)

const ProfileView = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, updateProfile, signOut } = useAuth()
  const {
    currentLevel,
    nextLevel,
    levelProgress,
    currentBadge,
    isMaxLevel,
    studentLevels,
    loading: levelsLoading
  } = useStudentLevels()
  const { userAchievements, challengeWinCounts, claimAchievementXP, checkAndAwardAchievements } = useAchievements()
  const { userPets, loading: petsLoading } = usePet()

  // State for profile being viewed
  const [viewedProfile, setViewedProfile] = useState(null)
  const [viewedUser, setViewedUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    full_name: ''
  })

  // Check if viewing own profile or someone else's
  const isOwnProfile = !userId || userId === user?.id
  const currentProfile = isOwnProfile ? profile : viewedProfile
  const currentUser = isOwnProfile ? user : viewedUser
  // Admins and teachers also see the email of the profile they open.
  const viewerIsStaff = profile?.role === 'admin' || profile?.role === 'teacher'

  // Stats state
  const [stats, setStats] = useState({
    totalXP: 0,
    exercisesCompleted: 0,
    streakCount: 0,
    totalPracticeTime: 0,
    averageScore: 0,
    levelsCompleted: 0,
    unitsCompleted: 0,
    sessionsCompleted: 0
  })

  // Avatar state
  const [availableAvatars, setAvailableAvatars] = useState([])
  const [purchasedAvatars, setPurchasedAvatars] = useState([])
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [customAvatars, setCustomAvatars] = useState([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Badge state
  const [earnedBadges, setEarnedBadges] = useState([])
  const [upcomingBadges, setUpcomingBadges] = useState([])
  const [showBadgeModal, setShowBadgeModal] = useState(false)

  // Achievement state
  const [achievements, setAchievements] = useState([])
  const [showAchievementModal, setShowAchievementModal] = useState(false)
  const [claimingAchievement, setClaimingAchievement] = useState({})
  const [toastMessage, setToastMessage] = useState('')
  const [claimResult, setClaimResult] = useState(null)
  const toastTimer = useRef(0)
  // Only the newest load of stats / achievements may fill the page: several can be in flight at once (a claim
  // refreshes the profile and the achievement rows), and an older one finishing last would show stale rows.
  const statsRequest = useRef(0)
  const achievementsRequest = useRef(0)

  // A short message at the bottom of the screen (claim errors, a name or avatar that did not save).
  const showToast = (message) => {
    clearTimeout(toastTimer.current)
    setToastMessage(message)
    toastTimer.current = setTimeout(() => setToastMessage(''), 3000)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // Pet state for viewed user
  const [viewedUserPets, setViewedUserPets] = useState([])

  // Display only: which parts have arrived, so a part still loading shows a placeholder instead of "nothing yet".
  // The first load shows a placeholder page; later refreshes (after a claim, a new name) leave the page on screen.
  const [everLoaded, setEverLoaded] = useState(false)
  const [badgesReady, setBadgesReady] = useState(false)
  const [achievementsReady, setAchievementsReady] = useState(false)
  const [viewedPetsReady, setViewedPetsReady] = useState(false)

  useEffect(() => {
    if (!loading) setEverLoaded(true)
  }, [loading])

  // Own profile: name box and avatar follow the logged-in profile.
  useEffect(() => {
    if (isOwnProfile && profile) {
      setEditData({
        full_name: profile.full_name || ''
      })
      setSelectedAvatar(profile.avatar_url || '👤')
    }
  }, [profile, isOwnProfile])

  // Own profile: the numbers reload when the XP or the streak changes (a claim, a finished exercise), not on every
  // profile change, so a new name or avatar does not reload stats and achievements. XP and streak come from the
  // profile the whole app shows.
  useEffect(() => {
    if (isOwnProfile && profile) fetchUserStats(null, profile)
  }, [isOwnProfile, profile?.id, profile?.xp, profile?.streak_count])

  // Own profile: the avatar picker's lists, once per visit.
  useEffect(() => {
    if (isOwnProfile && user?.id) {
      fetchAvailableAvatars()
      fetchCustomAvatars()
    }
  }, [isOwnProfile, user?.id])

  // Another student's profile. Loaded again only if the viewer turns out to be staff after all (their own profile
  // arrived late), so the email can be added.
  useEffect(() => {
    if (!isOwnProfile && userId) fetchOtherUserProfile()
  }, [isOwnProfile, userId, viewerIsStaff])

  // Separate effect to fetch achievements after stats are loaded
  useEffect(() => {
    const userIdToCheck = isOwnProfile ? user?.id : userId
    if (userIdToCheck && !loading && (stats.exercisesCompleted !== undefined || stats.totalXP !== undefined)) {
      fetchAchievements(isOwnProfile ? null : userId)
    }
  }, [userAchievements, user?.id, userId, isOwnProfile, stats, loading])

  const fetchOtherUserProfile = async () => {
    try {
      setLoading(true)

      // Fetch the other user's profile: only what the page shows. The email is shown to staff only, so a student's
      // browser does not receive classmates' emails (or any other column) at all.
      const columns = `id, full_name, avatar_url, xp, streak_count, created_at${viewerIsStaff ? ', email' : ''}`
      const [{ data: userData, error: userError }, { data: equipData }] = await Promise.all([
        supabase.from('users').select(columns).eq('id', userId).single(),
        supabase.from('user_equipment').select('*').eq('user_id', userId).single()
      ])

      if (userError) {
        console.error('User not found:', userError)
        navigate('/leaderboard')
        return
      }

      const merged = { ...userData, ...(equipData || {}) }
      setViewedUser(merged)
      setViewedProfile(merged)
      setSelectedAvatar(userData.avatar_url || '👤')

      // Fetch stats, badges and pets for the viewed user side by side (the avatar picker is only on one's own profile).
      // processBadges also runs here with the XP just loaded, so the badges (which the page waits for) are right even
      // if the stats fail. The user row is handed on, so the stats do not ask for it again.
      await Promise.all([
        fetchUserStats(userId, userData),
        processBadges(userData?.xp || 0),
        fetchUserPets(userId)
      ])
      // fetchAchievements will be called automatically via useEffect after stats are loaded

    } catch (error) {
      console.error('Error fetching user profile:', error)
      navigate('/leaderboard')
    }
  }

  // Auto-open avatar selector from query param
  useEffect(() => {
    if (!loading && isOwnProfile && searchParams.get('avatarSelector') === 'true') {
      setShowAvatarSelector(true)
      searchParams.delete('avatarSelector')
      setSearchParams(searchParams, { replace: true })
    }
  }, [loading, isOwnProfile, searchParams])

  const fetchUserPets = async (targetUserId) => {
    try {
      const { data, error } = await supabase
        .from('user_pets')
        .select(`
          *,
          pet:pets(*)
        `)
        .eq('user_id', targetUserId)
        .order('obtained_at', { ascending: false })

      if (error) throw error
      setViewedUserPets(data || [])
    } catch (error) {
      console.error('Error fetching user pets:', error)
      setViewedUserPets([])
    } finally {
      setViewedPetsReady(true)
    }
  }

  // Every finished exercise of a student, with only the two numbers the tiles use. Supabase hands out at most 1000
  // rows per request, so the rest is read in further pages (ordered by id, so no row is skipped or read twice).
  const fetchCompletedProgress = async (targetUserId) => {
    const rows = []
    let total = null
    while (total === null || rows.length < total) {
      const { data, count, error } = await supabase
        .from('user_progress')
        .select('score, time_spent', total === null ? { count: 'exact' } : undefined)
        .eq('user_id', targetUserId)
        .eq('status', 'completed')
        .order('id', { ascending: true })
        .range(rows.length, rows.length + 999)
      if (error) throw error
      if (total === null) total = count ?? 0
      if (!data?.length) break
      rows.push(...data)
    }
    return rows
  }

  const fetchUserStats = async (targetUserId = null, knownUser = null) => {
    const userIdToFetch = targetUserId || user?.id
    if (!userIdToFetch) return
    const request = ++statsRequest.current

    try {
      setLoading(true)

      // The finished exercises and the student's XP and streak, side by side (the user row is skipped when the
      // caller already has it).
      const [completed, { data: userData, error: userError }] = await Promise.all([
        fetchCompletedProgress(userIdToFetch),
        knownUser
          ? { data: knownUser, error: null }
          : supabase.from('users').select('xp, streak_count').eq('id', userIdToFetch).single()
      ])

      if (userError) throw userError
      if (request !== statsRequest.current) return

      const totalXP = userData?.xp || 0
      const exercisesCompleted = completed.length
      const averageScore = completed.length > 0
        ? Math.round(completed.reduce((sum, p) => sum + (p.score || 0), 0) / completed.length)
        : 0

      // Calculate total practice time from all completed exercises (in seconds, convert to minutes)
      const totalPracticeTimeMinutes = Math.floor(
        completed.reduce((sum, p) => sum + (p.time_spent || 0), 0) / 60
      )

      const newStats = {
        totalXP,
        exercisesCompleted,
        streakCount: userData?.streak_count || 0,
        totalPracticeTime: totalPracticeTimeMinutes,
        averageScore,
        levelsCompleted: 0, // We can calculate this if needed
        unitsCompleted: 0,  // We can calculate this if needed
        sessionsCompleted: 0 // We can calculate this if needed
      }

      setStats(newStats)

      // Process badges after stats are updated - always pass totalXP explicitly
      // since React state (stats.totalXP) may still hold stale value from another user's profile
      processBadges(totalXP)

    } catch (error) {
      console.error('Error fetching user stats:', error)
      // Still lay out the badges (from the XP already known), or the badge card would wait forever.
      if (request === statsRequest.current) processBadges()
    } finally {
      if (request === statsRequest.current) setLoading(false)
    }
  }

  const fetchAvailableAvatars = async () => {
    try {
      // Fetch ALL avatars, not just unlocked ones
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('is_active', true)
        .order('unlock_xp', { ascending: true })

      if (error) throw error

      setAvailableAvatars(data || [])
    } catch (error) {
      console.error('Error fetching avatars:', error)
      // Fallback to default avatars if function fails
      setAvailableAvatars([
        { id: '1', name: 'Default', image_url: '👤', unlock_xp: 0, description: 'Default avatar', tier: 'default' },
        { id: '2', name: 'Smiley', image_url: '😊', unlock_xp: 0, description: 'Happy face', tier: 'default' },
        { id: '3', name: 'Rookie', image_url: '🌱', unlock_xp: 500, description: 'Rookie learner', tier: 'bronze' },
        { id: '4', name: 'Scholar', image_url: '🎓', unlock_xp: 2000, description: 'Academic scholar', tier: 'silver' },
        { id: '5', name: 'Expert', image_url: '⚡', unlock_xp: 8000, description: 'Expert level', tier: 'gold' }
      ])
    }

    // Fetch purchased shop avatars
    if (user?.id) {
      try {
        const { data: purchases, error: purchasesError } = await supabase
          .from('user_purchases')
          .select('item_id')
          .eq('user_id', user.id)

        if (purchasesError) throw purchasesError

        if (purchases?.length > 0) {
          const purchasedIds = purchases.map(p => p.item_id)
          const { data: shopAvatars, error: shopError } = await supabase
            .from('shop_items')
            .select('*')
            .eq('is_active', true)
            .eq('category', 'avatar')
            .in('id', purchasedIds)

          if (shopError) throw shopError
          setPurchasedAvatars(shopAvatars || [])
        }
      } catch (error) {
        console.error('Error fetching purchased avatars:', error)
      }
    }
  }

  const fetchCustomAvatars = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('avatar_uploads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomAvatars(data || [])
    } catch (error) {
      console.error('Error fetching custom avatars:', error)
    }
  }

  const getUploadCooldownDays = () => {
    if (customAvatars.length === 0) return 0
    const mostRecent = customAvatars.reduce((latest, a) =>
      new Date(a.created_at) > new Date(latest.created_at) ? a : latest
    )
    const uploadedAt = new Date(mostRecent.created_at)
    const unlockAt = new Date(uploadedAt.getTime() + 3 * 24 * 60 * 60 * 1000)
    const now = new Date()
    if (now >= unlockAt) return 0
    return Math.ceil((unlockAt - now) / (24 * 60 * 60 * 1000))
  }

  const uploadCooldownDays = getUploadCooldownDays()

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh (JPG, PNG, GIF)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('File ảnh không được vượt quá 2MB')
      return
    }
    if (customAvatars.length >= 20) {
      alert('Bạn chỉ được tải tối đa 20 avatar. Vui lòng xóa avatar cũ trước khi tải ảnh mới.')
      return
    }
    if (uploadCooldownDays > 0) {
      alert(`Bạn chỉ được tải avatar 1 lần trong 3 ngày. Vui lòng chờ thêm ${uploadCooldownDays} ngày.`)
      return
    }

    try {
      setUploadingAvatar(true)

      // Upload to Supabase Storage
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(path)

      // Create avatar_uploads record
      const { error: insertError } = await supabase
        .from('avatar_uploads')
        .insert({
          user_id: user.id,
          image_url: publicData.publicUrl,
          status: 'pending'
        })

      if (insertError) throw insertError

      await fetchCustomAvatars()
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Lỗi tải ảnh lên. Vui lòng thử lại.')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  // Wear an avatar. Saved through useAuth, so the rest of the app (the dashboard, the top bar) shows it at once
  // instead of after a reload, and a save the database refused (0 rows) is reported instead of looking done.
  const applyAvatar = async (avatarUrl) => {
    const { error } = await updateProfile({ avatar_url: avatarUrl })
    if (error) {
      console.error('Error updating avatar:', error)
      showToast('Chưa đổi được avatar. Vui lòng thử lại.')
      return
    }
    setSelectedAvatar(avatarUrl)
    setShowAvatarSelector(false)
  }

  const handleCustomAvatarSelect = async (upload) => {
    if (upload.status !== 'approved') return
    await applyAvatar(upload.image_url)
  }

  const handleDeleteCustomAvatar = async (uploadId) => {
    if (!window.confirm('Xóa avatar này?')) return
    try {
      // Find the avatar to get its image_url for storage deletion
      const avatarToDelete = customAvatars.find(a => a.id === uploadId)

      const { error } = await supabase
        .from('avatar_uploads')
        .delete()
        .eq('id', uploadId)
        .eq('user_id', user.id)

      if (error) throw error

      // Delete from storage bucket
      if (avatarToDelete?.image_url) {
        const url = avatarToDelete.image_url
        const storagePath = url.split('/user-avatars/').pop()
        if (storagePath) {
          await supabase.storage.from('user-avatars').remove([decodeURIComponent(storagePath)])
        }
      }

      await fetchCustomAvatars()
    } catch (error) {
      console.error('Error deleting custom avatar:', error)
    }
  }

  const processBadges = async (userXP = null) => {
    try {
      // Get user's current XP
      const currentXP = userXP !== null ? userXP : (stats.totalXP || currentProfile?.xp || 0)

      // The app already holds the active levels (useStudentLevels, same query); ask the server only when it has none.
      let levels = studentLevels
      if (!levels?.length) {
        const { data, error } = await supabase
          .from('student_levels')
          .select('*')
          .eq('is_active', true)
          .order('level_number', { ascending: true })

        if (error) throw error
        levels = data || []
      }

      // Convert student levels to badge format and separate earned vs upcoming
      const earned = levels.filter(level => currentXP >= level.xp_required)
      const upcoming = levels.filter(level => currentXP < level.xp_required)

      setEarnedBadges(earned)
      setUpcomingBadges(upcoming)
    } catch (error) {
      console.error('Error processing badges:', error)
    } finally {
      setBadgesReady(true)
    }
  }

  const fetchAchievements = async (targetUserId = null) => {
    const userIdToFetch = targetUserId || user?.id
    if (!userIdToFetch) return
    const request = ++achievementsRequest.current

    try {
      // All achievements, the student's own rows, and the counts the pet/shop/wild-catch criteria need, side by side.
      const [
        { data: allAchievements, error: achievementsError },
        { data: userAchievements, error },
        { count: petCount },
        { count: petEvolvedCount },
        { count: wildCatchCount },
        { data: shopItemsOwned }
      ] = await Promise.all([
        supabase
          .from('achievements')
          .select('*')
          .eq('is_active', true)
          .order('criteria_value', { ascending: true }),
        supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', userIdToFetch),
        supabase
          .from('user_pets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userIdToFetch),
        supabase
          .from('user_pets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userIdToFetch)
          .eq('evolution_stage', 2),
        supabase
          .from('wild_area_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userIdToFetch)
          .eq('action', 'catch_success'),
        supabase
          .from('user_purchases')
          .select('shop_items(category)')
          .eq('user_id', userIdToFetch)
      ])

      if (achievementsError) throw achievementsError
      if (error) throw error
      // A newer load started meanwhile: let that one fill the list.
      if (request !== achievementsRequest.current) return

      const shopCounts = { avatar: 0, frame: 0, spaceship: 0, hammer: 0, boat: 0 }
      ;(shopItemsOwned || []).forEach(p => {
        const cat = p.shop_items?.category
        if (cat && Object.prototype.hasOwnProperty.call(shopCounts, cat)) shopCounts[cat]++
      })

      // Get user stats for progress calculation
      const targetProfile = targetUserId ? viewedProfile : profile
      const userStats = {
        completedExercises: stats.exercisesCompleted || 0,
        currentStreak: stats.streakCount || 0,
        totalXp: stats.totalXP || targetProfile?.xp || 0,
        petCount: petCount || 0,
        petEvolvedCount: petEvolvedCount || 0,
        wildCatchCount: wildCatchCount || 0,
        shopCounts
      }

      // Process achievements with proper unlock calculation
      const processedAchievements = allAchievements.map(achievement => {
        // Prefer a claimed row in case duplicates exist
        const matches = userAchievements?.filter(ua => ua.achievement_id === achievement.id) || []
        const userAchievement = matches.find(ua => ua.claimed_at) || matches[0]

        // Calculate if achievement should be unlocked based on criteria (same logic as AchievementBadgeBar)
        let calculatedUnlocked = false

        // Check if this is a daily challenge achievement (manually awarded)
        if (achievement.criteria_type && achievement.criteria_type.startsWith('daily_challenge_rank_')) {
          // Daily challenge achievements are unlocked if user has earned them
          calculatedUnlocked = !!userAchievement
        } else {
          // Regular achievements based on stats
          switch (achievement.criteria_type) {
            case 'exercise_completed':
              calculatedUnlocked = userStats.completedExercises >= achievement.criteria_value
              break
            case 'daily_streak':
              calculatedUnlocked = userStats.currentStreak >= achievement.criteria_value
              break
            case 'total_xp':
              calculatedUnlocked = userStats.totalXp >= achievement.criteria_value
              break
            case 'daily_exercises':
              calculatedUnlocked = false // This criteria is not implemented yet
              break
            case 'pet_owned':
              calculatedUnlocked = userStats.petCount >= achievement.criteria_value
              break
            case 'pet_evolved':
              calculatedUnlocked = userStats.petEvolvedCount >= achievement.criteria_value
              break
            case 'wild_catch_success':
              calculatedUnlocked = userStats.wildCatchCount >= achievement.criteria_value
              break
            case 'avatar_owned':
            case 'frame_owned':
            case 'spaceship_owned':
            case 'hammer_owned':
            case 'boat_owned': {
              const cat = achievement.criteria_type.replace('_owned', '')
              calculatedUnlocked = (userStats.shopCounts[cat] || 0) >= achievement.criteria_value
              break
            }
            default:
              calculatedUnlocked = false
          }
        }

        // Use database record if it exists (earned_at), otherwise use calculated value
        const isUnlocked = !!userAchievement?.earned_at || calculatedUnlocked
        const isClaimed = !!userAchievement?.claimed_at

        return {
          ...achievement,
          isUnlocked,
          isClaimed,
          unlockedDate: isUnlocked && userAchievement?.earned_at
            ? new Date(userAchievement.earned_at).toLocaleDateString('vi-VN')
            : (calculatedUnlocked ? 'Đã mở khóa' : null),
          claimedDate: isClaimed ? new Date(userAchievement.claimed_at).toLocaleDateString('vi-VN') : null
        }
      })

      setAchievements(processedAchievements)
    } catch (error) {
      console.error('Error fetching achievements:', error)
    } finally {
      // Only the newest load ends the placeholder, so an older one cannot show an empty list for a moment.
      if (request === achievementsRequest.current) setAchievementsReady(true)
    }
  }

  const handleAvatarSelect = async (avatar) => {
    if (stats.totalXP < avatar.unlock_xp) return
    await applyAvatar(avatar.image_url)
  }

  const handleShopAvatarSelect = async (item) => {
    await applyAvatar(item.item_data?.avatar_url || item.image_url)
  }

  const handleEditToggle = () => {
    setIsEditing(!isEditing)
    if (!isEditing) {
      setEditData({
        full_name: profile?.full_name || ''
      })
    }
  }

  const handleClaimAchievementXP = async (achievementId) => {
    // Verify the achievement is actually unlocked before claiming
    const achievement = achievements.find(a => a.id === achievementId)
    if (!achievement?.isUnlocked || achievement?.isClaimed) {
      return
    }

    setClaimingAchievement(prev => ({ ...prev, [achievementId]: true }))
    setToastMessage('')
    try {
      // Ensure achievement is awarded in DB before claiming
      await checkAndAwardAchievements()
      const result = await claimAchievementXP(achievementId)
      if (result.success) {
        // Shown as collected at once, so the button cannot come back for a second press while the list reloads.
        const claimedDate = new Date().toLocaleDateString('vi-VN')
        setAchievements(prev => prev.map(a => (a.id === achievementId ? { ...a, isClaimed: true, claimedDate } : a)))
        setClaimResult({
          xp: result.xpAwarded || 0,
          gems: result.gemsAwarded || 0,
          title: achievement.title
        })
        // Refresh achievements list using Profile's own fetch
        await fetchAchievements()
      } else {
        showToast(result.message)
      }
    } catch (error) {
      console.error('Error claiming achievement:', error)
      showToast('Có lỗi xảy ra khi nhận XP')
    } finally {
      setClaimingAchievement(prev => ({ ...prev, [achievementId]: false }))
    }
  }

  const NAME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

  const getNameCooldownRemaining = () => {
    if (!profile?.name_changed_at) return 0
    const elapsed = Date.now() - new Date(profile.name_changed_at).getTime()
    return Math.max(0, NAME_COOLDOWN_MS - elapsed)
  }

  const formatCooldown = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (days > 0) return `${days} ngày ${remainingHours} giờ`
    return `${remainingHours} giờ`
  }

  const handleSaveProfile = async () => {
    try {
      const trimmedName = (editData.full_name || '').trim()
      if (!trimmedName) {
        alert('Tên không được để trống.')
        return
      }
      const nameChanged = trimmedName !== profile?.full_name
      if (nameChanged) {
        const remaining = getNameCooldownRemaining()
        if (remaining > 0) {
          alert(`Bạn chỉ có thể đổi tên sau ${formatCooldown(remaining)} nữa.`)
          return
        }
      }
      const updates = { ...editData, full_name: trimmedName }
      if (nameChanged) {
        updates.name_changed_at = new Date().toISOString()
      }
      // updateProfile reports a failed save in its result (it does not throw): keep the box open and say so.
      const { error } = await updateProfile(updates)
      if (error) throw error
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      showToast('Chưa lưu được tên. Vui lòng thử lại.')
    }
  }

  const formatPracticeTime = (minutes) => {
    if (minutes < 60) return `${minutes} phút`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} giờ`
  }

  // ---- What the page shows. Nothing below loads or changes data. ----

  // Pets: the active one first, then two more (as before).
  const allUserPets = isOwnProfile ? userPets : viewedUserPets
  const activePet = allUserPets.find(p => p.is_active)
  const otherPets = allUserPets.filter(p => !p.is_active).slice(0, 2)
  const displayPets = activePet ? [activePet, ...otherPets] : allUserPets.slice(0, 3)
  // A pet whose kind the viewer does not own yet is shown as a mystery.
  const viewerOwnsPet = (userPet) => isOwnProfile || userPets?.some(p => p.pet?.id === userPet.pet?.id)
  // Another student's pets also wait for the viewer's own, or every pet shows as a mystery for a moment.
  const viewerPetsReady = !petsLoading || userPets.length > 0
  const petsReady = isOwnProfile ? viewerPetsReady : viewedPetsReady && viewerPetsReady

  // Own profile: the level the whole app shows (useStudentLevels, which only knows the logged-in student).
  // Another student's profile: that student's level, worked out from their XP with the same rules.
  const level = isOwnProfile
    ? { current: currentLevel, next: nextLevel || null, xpNeeded: levelProgress.xpNeeded, percent: levelProgress.progressPercentage, isMax: isMaxLevel }
    : levelInfoFor(stats.totalXP, [...earnedBadges, ...upcomingBadges])

  const avatarFallback = currentProfile?.full_name?.[0]?.toUpperCase() || currentProfile?.email?.[0]?.toUpperCase() || 'U'
  const frameUrl = currentProfile?.hide_frame ? null : currentProfile?.active_title
  // The logged-in profile carries no created_at; the sign-in account does.
  const joinedAt = currentProfile?.created_at || currentUser?.created_at
  const unlockedAchievements = achievements.filter(a => a.isUnlocked)
  const nameCooldown = getNameCooldownRemaining()

  // Wait for the level too, so the top card does not change colour a moment after it appears.
  // useStudentLevels works out currentLevel in an effect after the levels arrive, so wait for that as well.
  const ownLevelPending = levelsLoading || (studentLevels.length > 0 && !currentLevel)
  if (!everLoaded || !currentProfile || (isOwnProfile ? ownLevelPending : !badgesReady)) {
    return <ProfileSkeleton />
  }

  return (
    <div className="pf-root mx-auto max-w-5xl space-y-4 sm:space-y-5" data-tier={tierKey(level.current) || undefined} data-profile="ready">
      <ProfileHero
        isOwn={isOwnProfile}
        name={currentProfile?.full_name || 'Người dùng'}
        email={viewerIsStaff ? currentProfile?.email : null}
        avatarUrl={selectedAvatar}
        frameUrl={frameUrl}
        frameRatio={currentProfile?.active_frame_ratio}
        fallback={avatarFallback}
        onAvatarClick={isOwnProfile ? () => setShowAvatarSelector(true) : undefined}
        level={level}
        totalXP={stats.totalXP}
        joined={joinedAt ? new Date(joinedAt).toLocaleDateString('vi-VN') : null}
        isEditing={isEditing}
        editName={editData.full_name}
        onEditName={(value) => setEditData(prev => ({ ...prev, full_name: value }))}
        onSave={handleSaveProfile}
        onToggleEdit={handleEditToggle}
        nameLocked={nameCooldown > 0}
        cooldownText={nameCooldown > 0 ? formatCooldown(nameCooldown) : null}
        companion={petsReady && activePet ? { up: activePet, owned: viewerOwnsPet(activePet) } : null}
        onCompanionClick={isOwnProfile ? () => navigate('/pets') : undefined}
      />

      <StatTiles stats={stats} formatPracticeTime={formatPracticeTime} />

      <div className="pf-main">
        <LevelRoad
          earned={earnedBadges}
          upcoming={upcomingBadges}
          xp={stats.totalXP}
          avatar={selectedAvatar}
          fallback={avatarFallback}
          ready={badgesReady}
          onOpenAll={() => setShowBadgeModal(true)}
          index={3}
          className="pf-area-road"
        />
        <PetShelf
          pets={displayPets}
          count={allUserPets.length}
          isOwn={isOwnProfile}
          ownsKind={viewerOwnsPet}
          ready={petsReady}
          onViewAll={() => navigate('/pets')}
          onEggShop={() => navigate('/shop?tab=egg')}
          index={4}
          className="pf-area-pets"
        />
        <AchievementShelf
          unlocked={unlockedAchievements}
          total={achievements.length}
          isOwn={isOwnProfile}
          claiming={claimingAchievement}
          onClaim={handleClaimAchievementXP}
          winCounts={challengeWinCounts}
          ready={achievementsReady}
          onOpenAll={() => setShowAchievementModal(true)}
          index={5}
          className="pf-area-ach"
        />
      </div>

      {/* Log Out Button */}
      {isOwnProfile && (
        <div className="flex justify-center pb-6 pt-2">
          <button
            onClick={async () => { await signOut(); navigate('/login'); }}
            className="pf-press inline-flex items-center gap-2 rounded-full bg-rose-50 px-6 py-3 text-sm font-black text-rose-600 ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-100"
          >
            <LogOut className="h-5 w-5" />
            Log Out
          </button>
        </div>
      )}

      {/* Avatar Selector */}
      {showAvatarSelector && isOwnProfile && (
        <AvatarPicker
          onClose={() => setShowAvatarSelector(false)}
          selectedAvatar={selectedAvatar}
          frameUrl={frameUrl}
          frameRatio={currentProfile?.active_frame_ratio}
          fallback={avatarFallback}
          totalXP={stats.totalXP}
          levelText={currentLevel ? `Cấp ${currentLevel.level_number} • ${currentBadge?.name}` : null}
          avatars={availableAvatars}
          onPickAvatar={handleAvatarSelect}
          purchased={purchasedAvatars}
          onPickPurchased={handleShopAvatarSelect}
          uploads={customAvatars}
          onPickUpload={handleCustomAvatarSelect}
          onDeleteUpload={handleDeleteCustomAvatar}
          onUpload={handleAvatarUpload}
          uploading={uploadingAvatar}
          cooldownDays={uploadCooldownDays}
        />
      )}

      {showBadgeModal && (
        <BadgeSheet earned={earnedBadges} upcoming={upcomingBadges} onClose={() => setShowBadgeModal(false)} />
      )}

      {showAchievementModal && (
        <AchievementSheet
          achievements={achievements}
          isOwn={isOwnProfile}
          claiming={claimingAchievement}
          onClaim={handleClaimAchievementXP}
          winCounts={challengeWinCounts}
          // Esc still reaches the sheet while the claim celebration covers it: close the celebration, not the list.
          onClose={() => (claimResult ? setClaimResult(null) : setShowAchievementModal(false))}
        />
      )}

      {toastMessage && <Toast message={toastMessage} good={toastMessage.includes('+')} />}

      {claimResult && (
        <ClaimCelebration
          result={claimResult}
          onClose={() => setClaimResult(null)}
        />
      )}
    </div>
  )
}

// Each student gets a fresh page, so nothing of the profile shown before is left on screen while the next one loads:
// going from one profile to another loads it exactly as opening that profile directly does.
const Profile = () => {
  const { userId } = useParams()
  const { user } = useAuth()
  // Logging out clears the user a moment before the page leaves; the last known id keeps "my profile" in place.
  const myId = useRef(user?.id)
  if (user?.id) myId.current = user.id
  return <ProfileView key={!userId || userId === myId.current ? 'me' : userId} />
}

export default Profile
