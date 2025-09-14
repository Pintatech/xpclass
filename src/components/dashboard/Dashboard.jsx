import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Flame, 
  Star
} from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { getRecentExercise } from '../../utils/recentExercise'

const Dashboard = () => {
  const { profile } = useAuth()
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [recent, setRecent] = useState(null)
  const navigate = useNavigate()

  // Fetch levels data
  useEffect(() => {
    fetchLevels()
    setRecent(getRecentExercise())
  }, [])

  const fetchLevels = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('levels')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          level_number,
          difficulty_label,
          color_theme
        `)
        .eq('is_active', true)
        .order('level_number')

      if (error) throw error
      console.log('Fetched levels:', data)
      setLevels(data || [])
    } catch (error) {
      console.error('Error fetching levels:', error)
      setLevels([])
    } finally {
      setLoading(false)
    }
  }

  // Get greeting message based on current time (GMT+7)
  const getGreetingMessage = () => {
    const now = new Date()
    const vietnamTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)) // GMT+7
    const hour = vietnamTime.getHours()
    
    if (hour >= 5 && hour < 12) {
      return "Buổi sáng vui vẻ, học thôi nào! 🌅"
    } else if (hour >= 12 && hour < 18) {
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
                <Star className="w-5 h-5 text-blue-700 fill-blue-700" />
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

      {/* Levels List */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Chương trình học </h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Đang tải...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {levels.map((level) => (
              <Link 
                key={level.id} 
                to={`/study/level/${level.id}`}
                className="group"
              >
                <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden group-hover:scale-105">
                  {/* Level Image with Text Overlay */}
                  <div className="aspect-[1.8/1] bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center relative">
                    {level.thumbnail_url ? (
                      <img 
                        src={level.thumbnail_url} 
                        alt={level.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-4xl">
                        {level.level_number === 1 ? '🌱' : 
                         level.level_number === 2 ? '📚' : 
                         level.level_number === 3 ? '🏆' : '🎯'}
                      </div>
                    )}
                    
                    {/* Text Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-20 p-2">
                      <h3 className="font-semibold text-white text-sm mb-1 line-clamp-2">
                        {level.title}
                      </h3>
                      <p className="text-xs text-gray-200">
                        {level.difficulty_label}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
