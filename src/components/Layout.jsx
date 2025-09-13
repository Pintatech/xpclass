import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import TopNavigation from './navigation/TopNavigation'
import BottomNavigation from './navigation/BottomNavigation'
import LoadingSpinner from './ui/LoadingSpinner'

const Layout = () => {
  const { loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Top Navigation - Desktop */}
      <div className="hidden md:block">
        <TopNavigation />
      </div>

      {/* Main Content */}
      <main className="pb-16 md:pb-0 md:pt-16">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation - Mobile */}
      <div className="md:hidden">
        <BottomNavigation />
      </div>
    </div>
  )
}

export default Layout
