import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { 
  Trophy, 
  TrendingUp, 
  HelpCircle, 
  Settings,
  LogOut,
  User,
  Shield
} from 'lucide-react'

const TopNavigation = () => {
  const { profile, signOut, isAdmin } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/', imageSrc: 'https://xpclass.vn/momtek/svg%20icon/home.svg', label: 'Trang chủ' },
    { path: '/leaderboard', imageSrc: 'https://xpclass.vn/momtek/svg%20icon/leaderboard.svg', label: 'Xếp hạng' },
    { path: '/progress', icon: TrendingUp, label: 'Tiến độ' },
  ]

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img src="https://xpclass.vn/kevhocsat/general%20materials/logo.png" alt="Logo" className="h-10 w-auto" />
            <span className="text-xl font-bold text-gray-900">SAT Leveling</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map(({ path, icon: Icon, imageSrc, label }) => {
              const isActive = location.pathname === path || location.pathname.startsWith(path + '/')
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'text-primary-700'
                      : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'
                  }`}
                >
                  {imageSrc ? (
                    <img 
                      src={imageSrc} 
                      alt="" 
                      width={20} 
                      height={20}
                      className={`${isActive ? '' : 'grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0'}`}
                    />
                  ) : (
                    <Icon size={20} />
                  )}
                  <span className="font-medium">{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* User Level & XP */}
            {profile && (
              <div className="hidden md:flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    Cấp {profile.level || 1}
                  </div>
                  <div className="text-xs text-gray-500">
                    {profile.xp || 0} XP
                  </div>
                </div>
                <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {profile.level || 1}
                </div>
              </div>
            )}

            {/* Admin Panel Link */}
            {isAdmin() && (
              <Link
                to="/admin"
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-purple-600 hover:bg-purple-100 transition-colors"
                title="Quản trị"
              >
                <Shield size={20} />
                <span className="hidden lg:inline font-medium">Admin</span>
              </Link>
            )}

            {/* Profile & Settings */}
            <div className="flex items-center space-x-2">
              <Link to="/profile" className="p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-gray-100 transition-colors">
                <User size={20} />
              </Link>
              <button className="p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-gray-100 transition-colors">
                <Settings size={20} />
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                title="Đăng xuất"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopNavigation
