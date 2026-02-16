import { useState, useRef, useEffect } from 'react'
import { Link, useLocation} from 'react-router-dom'
import { TrendingUp, User, Package, Bell } from 'lucide-react'
import { useInventory } from '../../hooks/useInventory'
import { useNotifications } from '../../hooks/useNotifications'
import NotificationPanel from '../notifications/NotificationPanel'
import Button from '../ui/Button'

const BottomNavigation = () => {
  const location = useLocation()
  const { newItemCount } = useInventory()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const notifRef = useRef(null)

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifPanel(false)
      }
    }
    if (showNotifPanel) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifPanel])

  const navItems = [
    { path: '/', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/home.svg', label: 'Home' },
    { path: '/leaderboard', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/leaderboard.svg', label: 'BXH' },
    { path: '/pets', label: 'Pet',imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/pet.svg' },
    { path: '/inventory',  imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/inventory.svg', label: 'Kho đồ', badge: newItemCount },
    { path: '/shop', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/shop.svg', label: 'Shop'},
    { id: 'notifications', label: 'TB', isNotification: true, badge: unreadCount },
    { path: '/profile', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/account.svg', label: 'Account' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
      {/* Notification Panel - opens above bottom nav */}
      {showNotifPanel && (
        <div ref={notifRef} className="absolute bottom-full left-0 right-0 mb-0">
          <div className="mx-2 mb-2">
            <NotificationPanel
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onClose={() => setShowNotifPanel(false)}
              className="w-full max-h-[70vh]"
            />
          </div>
        </div>
      )}

      <nav className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ path, icon: Icon, imageSrc, emoji, label, badge, id, isNotification }) => {
          if (isNotification) {
            return (
              <button
                key="notifications"
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className={`flex flex-col items-center justify-center min-w-0 flex-1 px-2 py-2 rounded-lg transition-colors ${
                  showNotifPanel
                    ? 'text-primary-600'
                    : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                <div className="relative">
                  <Bell size={20} className="mb-1" />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium truncate w-full text-center">{label}</span>
              </button>
            )
          }

          const isActive = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path + '/'))

          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 px-2 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
              }`}
            >
              <div className="relative">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt=""
                    width={20}
                    height={20}
                    className={`mb-1 transition ${isActive ? '' : 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                  />
                ) : emoji ? (
                  <span className="text-xl mb-1">{emoji}</span>
                ) : (
                  <Icon size={20} className="mb-1" />
                )}
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              {label && (
                <span className="text-xs font-medium truncate w-full text-center">
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default BottomNavigation
