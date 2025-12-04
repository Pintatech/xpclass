import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame,
  ClipboardList
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
    }
    setRecent(getRecentExercise())
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
      } else {
        // Admin/Teacher: fetch all courses
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
    <div className="space-y-8">
      {/* Header with Blue Background */}
      <div className="relative -mx-4 md:-mx-6 lg:-mx-8 -mt-6 md:-mt-6 lg:-mt-6 -mb-4 md:-mb-6 lg:-mb-8">
        {/* Blue Background */}
        <div className="relative h-48 md:h-56 overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800">
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/20" />
          
          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            {/* XP and Streak stats */}
            <div className="flex justify-between">
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-3 flex items-center space-x-2">
                <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                <span className="font-bold text-gray-800">{profile?.streak_count || 0}</span>
              </div>
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-3 flex items-center space-x-2 border-2 border-blue-700">
                <img src="https://xpclass.vn/xpclass/icon/xp_small.svg" alt="XP" className="w-5 h-5" />
                <span className="font-bold text-gray-800">{profile?.xp || 0}</span>
              </div>
            </div>

            {/* Welcome text with avatar - moved closer to top */}
            <div className="text-white -mt-16">
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
                  <div className="text-sm opacity-75 mt-1">
                    🕒 {currentTime.toLocaleString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh'
                    })} (VN)
                  </div>
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
              <Button onClick={() => navigate(recent.continuePath)}>
                Tiếp tục
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* My Assignments Button - Only for students */}
      {profile?.role === 'user' && (
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
      )}

      {/* Recent Activities and Levels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-1">
          <RecentActivities />
        </div>

        {/* Courses List */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Chương trình học </h2>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Đang tải...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      
                      {/* Text Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-20 p-2">
                        <h3 className="font-semibold text-white text-sm mb-1 line-clamp-2">
                          {course.title}
                        </h3>
                        <p className="text-xs text-gray-200">
                          {course.difficulty_label}
                        </p>
                      </div>
                    </div>
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
