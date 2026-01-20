import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LeftSidebar from './navigation/LeftSidebar'
import BottomNavigation from './navigation/BottomNavigation'
import LoadingSpinner from './ui/LoadingSpinner'

const Layout = () => {
  const { loading } = useAuth()
  const location = useLocation()

  const exercisePaths = [
    '/study/flashcard',
    '/study/fill-blank',
    '/study/multiple-choice',
    '/study/video',
    '/study/quiz',
    '/study/listening',
    '/study/speaking',
    '/study/pronunciation',
    '/study/drag-drop',
    '/study/hotspot'
  ]

  const hideBottomNav = exercisePaths.some(p => location.pathname.startsWith(p))
  const hideSidebar = exercisePaths.some(p => location.pathname.startsWith(p))

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Left Sidebar - Desktop and Mobile */}
      {!hideSidebar && <LeftSidebar />}

      {/* Main Content */}
      <main className={`${hideSidebar ? 'lg:pl-0' : 'lg:pl-64'} min-h-screen pb-16 lg:pb-0`}>
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation - Mobile (hidden on exercise/question UIs) */}
      {!hideBottomNav && (
        <div className="lg:hidden">
          <BottomNavigation />
        </div>
      )}
    </div>
  )
}

export default Layout
