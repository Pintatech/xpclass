import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame,
} from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { getRecentExercise } from '../../utils/recentExercise'
import RecentActivities from './RecentActivities'

const Dashboard = () => {
  const { profile } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [recent, setRecent] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [courseProgress, setCourseProgress] = useState({})
  const navigate = useNavigate()

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Fetch courses data
  useEffect(() => {
    if (profile) {
      fetchCourses()
      if (profile.role === 'user') {
        fetchMostRecentExercise()
        fetchCourseProgress()
      } else {
        setRecent(getRecentExercise())
      }
    }
  }, [profile])

  const fetchCourses = async () => {
    try {
      setLoading(true)

      // For students, only show enrolled courses. For admins/teachers, show all courses.
      if (profile?.role === 'user') {
        // Student: fetch only enrolled courses
        const { data, error } = await supabase
          .from('course_enrollments')
          .select(`
            courses (
              id,
              title,
              description,
              thumbnail_url,
              level_number,
              difficulty_label,
              color_theme,
              is_active
            )
          `)
          .eq('student_id', profile.id)
          .eq('is_active', true)
          .eq('courses.is_active', true)
          .order('level_number', { foreignTable: 'courses' })

        if (error) throw error

        // Extract courses from the enrollment data
        const enrolledCourses = data?.map(enrollment => enrollment.courses).filter(Boolean) || []
        console.log('Fetched enrolled courses:', enrolledCourses)
        setCourses(enrolledCourses)
      } else if (profile?.role === 'teacher') {
        // Teacher: fetch only assigned courses
        const { data, error } = await supabase
          .from('course_teachers')
          .select(`
            courses (
              id,
              title,
              description,
              thumbnail_url,
              level_number,
              difficulty_label,
              color_theme,
              is_active
            )
          `)
          .eq('teacher_id', profile.id)
          .eq('courses.is_active', true)
          .order('level_number', { foreignTable: 'courses' })

        if (error) throw error

        // Extract courses from the teacher assignments
        const assignedCourses = data?.map(assignment => assignment.courses).filter(Boolean) || []
        console.log('Fetched assigned courses for teacher:', assignedCourses)
        setCourses(assignedCourses)
      } else {
        // Admin: fetch all courses
        let { data, error } = await supabase
          .from('courses')
          .select(`
            id,
            title,
            description,
            thumbnail_url,
            level_number,
            difficulty_label,
            color_theme,
            is_active
          `)
          .eq('is_active', true)
          .order('level_number')

        // If courses table doesn't exist, try levels table as fallback
        if (error && error.code === 'PGRST205') {
          console.log('Courses table not found, trying levels table...')
          const fallback = await supabase
            .from('levels')
            .select(`
              id,
              title,
              description,
              thumbnail_url,
              level_number,
              difficulty_label,
              color_theme,
              is_active
            `)
            .eq('is_active', true)
            .order('level_number')

          data = fallback.data
          error = fallback.error
        }

        if (error) throw error
        console.log('Fetched all courses:', data)
        setCourses(data || [])
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  const fetchMostRecentExercise = async () => {
    try {
      // 1. Get student's enrolled courses
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('is_active', true)

      if (enrollError) throw enrollError
      if (!enrollments || enrollments.length === 0) return

      const courseIds = enrollments.map(e => e.course_id)

      // 2. Get all units from these courses, ordered by unit_number DESC
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, course_id, unit_number, title')
        .in('course_id', courseIds)
        .eq('is_active', true)
        .order('unit_number', { ascending: false })

      if (unitsError) throw unitsError
      if (!units || units.length === 0) return

      // 3. Get all sessions from ALL units, ordered by unit_number DESC, session_number DESC
      const unitIds = units.map(u => u.id)
      const { data: allSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, unit_id, session_number, title')
        .in('unit_id', unitIds)
        .eq('is_active', true)
        .order('session_number', { ascending: false })

      if (sessionsError) throw sessionsError
      if (!allSessions || allSessions.length === 0) return

      // Sort sessions by unit order first, then session number
      const unitOrderMap = new Map(units.map((u, idx) => [u.id, idx]))
      const sortedSessions = allSessions.sort((a, b) => {
        const unitOrderA = unitOrderMap.get(a.unit_id)
        const unitOrderB = unitOrderMap.get(b.unit_id)
        if (unitOrderA !== unitOrderB) return unitOrderA - unitOrderB
        return b.session_number - a.session_number
      })

      // 4. Get student's progress for all exercises
      const { data: userProgress, error: progressError } = await supabase
        .from('user_progress')
        .select('exercise_id, status')
        .eq('user_id', profile.id)

      if (progressError) throw progressError

      const completedExercises = new Set(
        (userProgress || [])
          .filter(p => p.status === 'completed')
          .map(p => p.exercise_id)
      )

      // 5. Find first session with incomplete exercises
      let targetSession = null
      let targetUnit = null

      for (const session of sortedSessions) {
        // Get exercises from this session
        const { data: assignments, error: assignmentsError } = await supabase
          .from('exercise_assignments')
          .select(`
            exercise_id,
            exercises (
              id,
              title,
              exercise_type,
              content
            )
          `)
          .eq('session_id', session.id)
          .order('order_index', { ascending: true })

        if (assignmentsError) continue
        if (!assignments || assignments.length === 0) continue

        // Check if there are any incomplete exercises
        const hasIncomplete = assignments.some(a => !completedExercises.has(a.exercise_id))

        if (hasIncomplete) {
          targetSession = session
          targetUnit = units.find(u => u.id === session.unit_id)
          break
        }
      }

      // If no incomplete session found, default to the latest session
      if (!targetSession) {
        targetSession = sortedSessions[0]
        targetUnit = units.find(u => u.id === targetSession.unit_id)
      }

      if (!targetSession || !targetUnit) return

      // 6. Build the navigation path
      const continuePath = `/study/course/${targetUnit.course_id}/unit/${targetUnit.id}/session/${targetSession.id}`

      setRecent({
        id: targetSession.id,
        title: `${targetUnit.title} - ${targetSession.title}`,
        imageUrl: null,
        continuePath
      })

    } catch (error) {
      console.error('Error fetching most recent exercise:', error)
    }
  }

  const fetchCourseProgress = async () => {
    try {
      if (!profile?.id) return

      // Get all user progress
      const { data: userProgress, error: progressError } = await supabase
        .from('user_progress')
        .select('exercise_id, status')
        .eq('user_id', profile.id)

      if (progressError) throw progressError

      const completedExerciseIds = new Set(
        (userProgress || [])
          .filter(p => p.status === 'completed')
          .map(p => p.exercise_id)
      )

      // Get all courses
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('is_active', true)

      if (enrollError) throw enrollError

      const courseIds = enrollments?.map(e => e.course_id) || []
      if (courseIds.length === 0) return

      // For each course, get total exercises and calculate progress
      const progressData = {}

      for (const courseId of courseIds) {
        // Get all units for this course
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('id')
          .eq('course_id', courseId)
          .eq('is_active', true)

        if (unitsError) continue
        if (!units || units.length === 0) continue

        const unitIds = units.map(u => u.id)

        // Get all sessions for these units
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id')
          .in('unit_id', unitIds)
          .eq('is_active', true)

        if (sessionsError) continue
        if (!sessions || sessions.length === 0) continue

        const sessionIds = sessions.map(s => s.id)

        // Get all exercises for these sessions
        const { data: assignments, error: assignError } = await supabase
          .from('exercise_assignments')
          .select('exercise_id')
          .in('session_id', sessionIds)

        if (assignError) continue
        if (!assignments || assignments.length === 0) continue

        const totalExercises = assignments.length
        const completedCount = assignments.filter(a =>
          completedExerciseIds.has(a.exercise_id)
        ).length

        progressData[courseId] = {
          total: totalExercises,
          completed: completedCount,
          percentage: totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0
        }
      }

      setCourseProgress(progressData)

    } catch (error) {
      console.error('Error fetching course progress:', error)
    }
  }

  // Get greeting message based on Vietnam time
  const getGreetingMessage = () => {
    // Get Vietnam hour
    const vietnamHour = parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hour12: false
    }))

    if (vietnamHour >= 5 && vietnamHour < 12) {
      return "Buổi sáng vui vẻ, học thôi nào! 🌅"
    } else if (vietnamHour >= 12 && vietnamHour < 18) {
      return "Buổi chiều vui vẻ, học thôi nào! ☀️"
    } else {
      return "Buổi tối vui vẻ, học thôi nào! 🌙"
    }
  }

  return (
    <div className="space-y-8 md:pt-8">
      {/* Header with Blue Background */}
      <div className="relative -mx-4 md:-mx-6 lg:mx-0 -mt-6 md:-mt-6 lg:-mt-6 -mb-4 md:-mb-6 lg:mb-0">
        {/* Blue Background */}
        <div className="relative h-48 md:h-56 overflow-hidden bg-blue-600 lg:rounded-lg">
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/20" />
          
          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            {/* XP and Streak stats */}
            <div className="flex justify-between">
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 flex items-center space-x-2">
                <Flame className="w-5 h-5 text-red-500 fill-red-500" />
                <span className="font-bold text-red-500">{profile?.streak_count || 0}</span>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-3 flex items-center space-x-2 border-2 border-blue-700">
                <img src="https://xpclass.vn/xpclass/icon/xp_small.svg" alt="XP" className="w-5 h-5" />
                <span className="font-bold text-gray-800">{profile?.xp || 0}</span>
              </div>
            </div>

            {/* Welcome text with avatar - moved closer to top */}
            <div className="text-white mt-5">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden border-2 border-white/30">
                  {profile?.avatar_url ? (
                    profile.avatar_url.startsWith('http') ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      profile.avatar_url
                    )
                  ) : (
                    profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div>
                  <h5 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                    Chào {profile?.full_name || 'Học viên'}! 👋
                  </h5>
                  <p className="text-base md:text-lg opacity-90 drop-shadow-md max-w-2xl">
                    {getGreetingMessage()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Recent Exercise (Above Levels List) */}
      {recent && (
        <Card className="bg-white">
          <Card.Content className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-blue-100 overflow-hidden flex items-center justify-center">
                  {recent.imageUrl ? (
                    <img src={recent.imageUrl} alt={recent.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">📘</span>
                  )}
                </div>
                <div>
                  <div className="text-sm text-blue-600 font-bold">Bài gần nhất</div>
                  <div className="font-semibold text-gray-500">{recent.title}</div>
                </div>
              </div>
              <Button
                className="!bg-blue-600 hover:!bg-blue-700 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl transition-transform will-change-transform"
                style={{
                  animation: 'scalePulse 2s ease-in-out infinite',
                  backfaceVisibility: 'hidden',
                  WebkitFontSmoothing: 'antialiased'
                }}
                onMouseEnter={(e) => e.currentTarget.style.animation = 'none'}
                onMouseLeave={(e) => e.currentTarget.style.animation = 'scalePulse 2s ease-in-out infinite'}
                onClick={() => navigate(recent.continuePath)}
              >
                Tiếp tục✨
              </Button>
              <style>{`
                @keyframes scalePulse {
                  0%, 100% { transform: scale(1) translateZ(0); }
                  50% { transform: scale(1.05) translateZ(0); }
                }
              `}</style>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* My Assignments Button - Only for students */}
      {/* {profile?.role === 'user' && (
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all cursor-pointer" onClick={() => navigate('/study/my-assignments')}>
          <Card.Content className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <ClipboardList className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold opacity-90">Bài tập được giao</div>
                  <div className="font-bold text-lg">My Assignments</div>
                </div>
              </div>
              <Button className="bg-white text-blue-600 hover:bg-blue-50">
                Xem ngay
              </Button>
            </div>
          </Card.Content>
        </Card>
      )} */}

      {/* Recent Activities and Levels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-1">
          <RecentActivities />
        </div>

        {/* Courses List */}
        <div className="lg:col-span-2">
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Đang tải...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {courses.map((course) => {
                const isLocked = !course.is_active

                const CourseCard = () => (
                  <div className={`bg-white rounded-lg shadow-md transition-all duration-200 overflow-hidden ${
                    isLocked 
                      ? 'opacity-60 cursor-not-allowed' 
                      : 'hover:shadow-lg group-hover:scale-105'
                  }`}>
                    {/* Course Image with Text Overlay */}
                    <div className="aspect-[1.8/1] bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center relative">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-4xl">
                          {course.level_number === 1 ? '🌱' :
                           course.level_number === 2 ? '📚' :
                           course.level_number === 3 ? '🏆' : '🎯'}
                        </div>
                      )}
                      
                      {/* Lock Overlay */}
                      {isLocked && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="text-center text-white">
                            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                           
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Progress Bar */}
                    {!isLocked && profile?.role === 'user' && courseProgress[course.id] && (
                      <div className="px-3 py-2 bg-gray-50 mb-1">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Tiến độ</span>
                          <span className="font-semibold">{courseProgress[course.id].percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              courseProgress[course.id].percentage < 30
                                ? 'bg-red-500'
                                : courseProgress[course.id].percentage < 70
                                ? 'bg-yellow-500'
                                : 'bg-blue-700'
                            }`}
                            style={{ width: `${courseProgress[course.id].percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )

                if (isLocked) {
                  return (
                    <div key={course.id} className="group">
                      <CourseCard />
                    </div>
                  )
                }

                return (
                  <Link
                    key={course.id}
                    to={`/study/course/${course.id}`}
                    className="group"
                  >
                    <CourseCard />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
