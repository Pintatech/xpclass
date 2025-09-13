import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Trophy, TrendingUp, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../ui/Button'

const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const isStudy = location.pathname === '/study' || location.pathname.startsWith('/study/')

  const handleBack = () => {
    if (location.pathname === '/study') {
      navigate('/')
    } else {
      navigate(-1)
    }
  }

  const navItems = [
    { path: '/', imageSrc: 'https://xpclass.vn/momtek/svg%20icon/home.svg' },
    { path: '/leaderboard', imageSrc: 'https://xpclass.vn/momtek/svg%20icon/leaderboard.svg' },
    { path: '/progress', icon: TrendingUp },
  ]

  if (isStudy) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <nav className="flex items-center gap-3 px-3 py-2">
          <Button variant="ghost" className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400" onClick={() => {
            // Dispatch custom event for exercise components to listen
            window.dispatchEvent(new CustomEvent('bottomNavBack'));
            // Don't call handleBack() here, let the exercise component handle it
          }}>
            <div className="flex items-center justify-center gap-2">
              <ChevronLeft size={18} />
              <span> Back</span>
            </div>
          </Button>
          <Button className="flex-[2] bg-blue-800 hover:bg-blue-900 text-white" onClick={() => {
            // Dispatch custom event for exercise components to listen
            window.dispatchEvent(new CustomEvent('bottomNavHocTiep'));
            // Also try navigate forward as fallback
            navigate(1);
          }}>
            <div className="flex items-center justify-center gap-2">
              <span>Học tiếp</span>
              <ChevronRight size={18} />
            </div>
          </Button>
        </nav>
      </div>
    )
  }

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
