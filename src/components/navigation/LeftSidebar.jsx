import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useStudentLevels } from '../../hooks/useStudentLevels'
import {
  LogOut,
  User,
  Shield,
  GraduationCap
} from 'lucide-react'

const LeftSidebar = () => {
  const { profile, signOut, isAdmin, isTeacher } = useAuth()
  const { currentBadge } = useStudentLevels()
  const location = useLocation()

  const navItems = [
    { path: '/', imageSrc: 'https://xpclass.vn/xpclass/icon/home.svg', label: 'Trang chủ' },
    { path: '/leaderboard', imageSrc: 'https://xpclass.vn/xpclass/icon/leaderboard.svg', label: 'Xếp hạng' },
    { path: '/progress', imageSrc: 'https://xpclass.vn/xpclass/icon/progress.svg', label: 'Tiến độ' },
  ]

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <>
      {/* Sidebar - Desktop only */}
      <aside className="hidden lg:block fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center p-4 border-b border-gray-200">
            <Link to="/" className="flex items-center space-x-2">
              <img src="https://xpclass.vn/xpclass/Asset%205.png" alt="Logo" className="h-10 w-auto" />
              <span className="text-lg font-bold text-gray-900">Pinta English</span>
            </Link>
          </div>

          {/* User Badge & XP */}
          {profile && currentBadge && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-r from-primary-50 to-purple-50">
                <div className="flex items-center justify-center">
                  {currentBadge.icon.startsWith('http') ? (
                    <img
                      src={currentBadge.icon}
                      alt={currentBadge.name}
                      className="w-10 h-10 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'inline'
                      }}
                    />
                  ) : null}
                  <span className="text-2xl" style={{ display: currentBadge.icon.startsWith('http') ? 'none' : 'inline' }}>
                    {currentBadge.icon}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {currentBadge.name}
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-1">
                    {profile.xp || 0}
                    <img src="https://xpclass.vn/xpclass/icon/xp_small.svg" alt="XP" className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map(({ path, imageSrc, label }) => {
              const isActive = location.pathname === path || location.pathname.startsWith(path + '/')
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 font-medium shadow-sm'
                      : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'
                  }`}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt=""
                      width={22}
                      height={22}
                      className={`${isActive ? '' : 'grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0'}`}
                    />
                  ) : null}
                  <span className="font-medium">{label}</span>
                </Link>
              )
            })}

            {/* Admin Panel Link */}
            {isAdmin() && (
              <Link
                to="/admin"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-purple-100 text-purple-700 font-medium shadow-sm'
                    : 'text-purple-600 hover:bg-purple-50'
                }`}
              >
                <Shield size={22} />
                <span className="font-medium">Admin</span>
              </Link>
            )}

            {/* Teacher Dashboard Link */}
            {(isTeacher() || isAdmin()) && (
              <Link
                to="/teacher"
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  location.pathname.startsWith('/teacher')
                    ? 'bg-blue-100 text-blue-700 font-medium shadow-sm'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                <GraduationCap size={22} />
                <span className="font-medium">Teacher</span>
              </Link>
            )}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-200 space-y-1">
            <Link
              to="/profile"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                location.pathname.startsWith('/profile')
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <User size={22} />
              <span className="font-medium">Hồ sơ</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut size={22} />
              <span className="font-medium">Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default LeftSidebar
