import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, MoreHorizontal } from 'lucide-react'
import { useInventory } from '../../hooks/useInventory'
import { useNotifications } from '../../hooks/useNotifications'
import NotificationPanel from '../notifications/NotificationPanel'

const BottomNavigation = () => {
  const location = useLocation()
  const { newItemCount } = useInventory()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const notifRef = useRef(null)
  const moreRef = useRef(null)

  // Close panels on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifPanel(false)
      }
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMoreMenu(false)
      }
    }
    if (showNotifPanel || showMoreMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifPanel, showMoreMenu])

  const mainItems = [
    { path: '/', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/home.svg', label: 'Home' },
    { path: '/pets', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/pet.svg', label: 'Pet' },
    { path: '/shop', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/shop.svg', label: 'Shop' },
  ]

  const moreItems = [
    { path: '/leaderboard', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/leaderboard.svg', label: 'BXH' },
    { path: '/inventory', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/inventory.svg', label: 'Kho đồ', badge: newItemCount },
    { id: 'notifications', label: 'Thông báo', isNotification: true, badge: unreadCount },
    { path: '/profile', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/account.svg', label: 'Account' },
  ]

  const isMoreActive = ['/leaderboard', '/inventory', '/profile'].some(
    p => location.pathname === p || location.pathname.startsWith(p + '/')
  )

  const moreBadgeCount = (newItemCount || 0) + (unreadCount || 0)

  const isActive = (path) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'))

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
      {/* Notification Panel */}
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
        {/* Main nav items */}
        {mainItems.map(({ path, imageSrc, label }) => {
          const active = isActive(path)
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 px-2 py-2 rounded-lg transition-colors ${
                active
                  ? 'text-primary-600'
                  : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
              }`}
            >
              <img
                src={imageSrc}
                alt=""
                width={20}
                height={20}
                className={`mb-1 transition ${active ? '' : 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
              />
              <span className="text-xs font-medium truncate w-full text-center">{label}</span>
            </Link>
          )
        })}

        {/* More button + menu wrapper */}
        <div ref={moreRef} className="relative min-w-0 flex-1">
          {showMoreMenu && (
            <div className="absolute bottom-full right-0 mb-2 -mr-2">
              <div className="bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[180px]">
                {moreItems.map((item) => {
                  if (item.isNotification) {
                    return (
                      <button
                        key="notifications"
                        onClick={() => {
                          setShowMoreMenu(false)
                          setShowNotifPanel(!showNotifPanel)
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Bell size={20} />
                        <span className="text-sm font-medium flex-1">{item.label}</span>
                        {item.badge > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </button>
                    )
                  }

                  const active = isActive(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setShowMoreMenu(false)}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        active ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.imageSrc && (
                        <img
                          src={item.imageSrc}
                          alt=""
                          width={20}
                          height={20}
                          className={`transition ${active ? '' : 'grayscale opacity-60'}`}
                        />
                      )}
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {item.badge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              setShowMoreMenu(!showMoreMenu)
              setShowNotifPanel(false)
            }}
            className={`flex flex-col items-center justify-center w-full px-2 py-2 rounded-lg transition-colors ${
              isMoreActive || showMoreMenu
                ? 'text-primary-600'
                : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
            }`}
          >
            <div className="relative">
              <MoreHorizontal size={20} className="mb-1" />
              {moreBadgeCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {moreBadgeCount > 99 ? '99+' : moreBadgeCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium truncate w-full text-center">More</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default BottomNavigation
