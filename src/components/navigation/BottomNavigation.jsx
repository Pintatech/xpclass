import { Link, useLocation} from 'react-router-dom'
import { TrendingUp, User } from 'lucide-react'
import Button from '../ui/Button'

const BottomNavigation = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/home.svg', label: 'Home' },
    { path: '/leaderboard', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/leaderboard.svg', label: 'Leaderboard' },
    { path: '/progress', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/progress.svg', label: 'Progress' },
    { path: '/profile', imageSrc: 'https://xpclass.vn/xpclass/icon/navigation/account.svg', label: 'Account' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
      <nav className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ path, icon: Icon, imageSrc, label }) => {
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
              {imageSrc ? (
                <img 
                  src={imageSrc} 
                  alt="" 
                  width={20} 
                  height={20} 
                  className={`mb-1 transition ${isActive ? '' : 'grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                />
              ) : (
                <Icon size={20} className="mb-1" />
              )}
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
