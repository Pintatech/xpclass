import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Swords } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import PvPChallengeModal from '../pvp/PvPChallengeModal'

const OnlineUsers = () => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState([])
  const [challengeTarget, setChallengeTarget] = useState(null)

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .gte('last_activity_date', fiveMinutesAgo)
          .order('last_activity_date', { ascending: false })
          .limit(30)
        if (!error && data) setOnlineUsers(data)
      } catch (err) {
        console.error('Error fetching online users:', err)
      }
    }
    fetchOnlineUsers()
    const interval = setInterval(fetchOnlineUsers, 60000)
    return () => clearInterval(interval)
  }, [])

  if (onlineUsers.length === 0) return null

  return (
    <>
      <div className="hidden xl:block fixed top-0 right-0 h-full w-56 bg-white border-l border-gray-200 z-30">
        <div className="p-4">
          <div className="mb-4">
            <span className="text-sm font-semibold text-gray-700">Online</span>
          </div>
          <div className="space-y-1">
            {onlineUsers.map((u) => (
              <div key={u.id} className="flex items-center hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors group">
                <Link to={`/profile/${u.id}`} className="flex items-center space-x-2.5 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                        {u.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <span className="text-sm text-gray-700 truncate">{u.full_name || 'An danh'}</span>
                </Link>
                {u.id !== user?.id && (
                  <button
                    onClick={() => setChallengeTarget(u)}
                    className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-500 transition-all"
                    title="Challenge to PvP!"
                  >
                    <Swords size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {challengeTarget && (
        <PvPChallengeModal
          opponent={challengeTarget}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </>
  )
}

export default OnlineUsers
