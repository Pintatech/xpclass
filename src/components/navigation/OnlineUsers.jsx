import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Swords } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import PvPChallengeModal from '../pvp/PvPChallengeModal'

const OnlineUsers = () => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState([])
  const [offlineUsers, setOfflineUsers] = useState([])
  const [challengeTarget, setChallengeTarget] = useState(null)
  const [pendingChallengeUserIds, setPendingChallengeUserIds] = useState({})

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, last_seen_at')
          .gte('last_seen_at', twentyFourHoursAgo)
          .order('last_seen_at', { ascending: false })
          .limit(40)
        if (!error && data) {
          const online = []
          const offline = []
          data.forEach(u => {
            if (u.last_seen_at >= fiveMinutesAgo) {
              online.push(u)
            } else {
              offline.push(u)
            }
          })
          setOnlineUsers(online)
          setOfflineUsers(offline)
        }
      } catch (err) {
        console.error('Error fetching online users:', err)
      }
    }
    fetchUsers()
    const interval = setInterval(fetchUsers, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const fetchPending = async () => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('pvp_challenges')
        .select('challenger_id, opponent_id')
        .eq('status', 'pending')
        .gte('created_at', since)
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      if (data) {
        const map = {}
        data.forEach(c => {
          if (c.challenger_id === user.id) {
            map[c.opponent_id] = 'sent'
          } else {
            map[c.challenger_id] = 'received'
          }
        })
        setPendingChallengeUserIds(map)
      }
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  if (onlineUsers.length === 0 && offlineUsers.length === 0) return null

  return (
    <>
      <div className="hidden xl:block fixed top-0 right-0 h-full w-56 bg-white border-l border-gray-200 z-30 overflow-y-auto">
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
                    className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${pendingChallengeUserIds[u.id] ? (pendingChallengeUserIds[u.id] === 'received' ? 'opacity-100 animate-pulse text-red-500 hover:bg-red-50' : 'opacity-100 text-gray-400 hover:bg-gray-100') : 'opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50'}`}
                    title={pendingChallengeUserIds[u.id] === 'received' ? 'Pending challenge!' : pendingChallengeUserIds[u.id] === 'sent' ? 'Challenge sent' : 'Challenge to PvP!'}
                  >
                    <Swords size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {offlineUsers.length > 0 && (
            <>
              <div className="mt-4 mb-2">
                <span className="text-xs font-semibold text-gray-400">Recently Online</span>
              </div>
              <div className="space-y-1">
                {offlineUsers.map((u) => (
                  <div key={u.id} className="flex items-center hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors group opacity-60">
                    <Link to={`/profile/${u.id}`} className="flex items-center space-x-2.5 flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover grayscale" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-bold">
                            {u.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-gray-400 rounded-full border-2 border-white" />
                      </div>
                      <span className="text-sm text-gray-500 truncate">{u.full_name || 'An danh'}</span>
                    </Link>
                    {u.id !== user?.id && pendingChallengeUserIds[u.id] && (
                      <button
                        onClick={() => setChallengeTarget(u)}
                        className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${pendingChallengeUserIds[u.id] === 'received' ? 'opacity-100 animate-pulse text-red-500 hover:bg-red-50' : 'opacity-100 text-gray-400 hover:bg-gray-100'}`}
                        title={pendingChallengeUserIds[u.id] === 'received' ? 'Pending challenge!' : 'Challenge sent'}
                      >
                        <Swords size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
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
