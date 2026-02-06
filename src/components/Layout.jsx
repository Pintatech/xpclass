import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LeftSidebar from './navigation/LeftSidebar'
import BottomNavigation from './navigation/BottomNavigation'
import ItemDropNotification from './inventory/ItemDropNotification'
import ChestDropNotification from './inventory/ChestDropNotification'
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
    '/study/image-hotspot',
    '/study/dropdown',
    '/study/ai-fill-blank'
  ]

  // Check if on session/exercise list page (e.g., /study/course/123/unit/456/session/789)
  const isSessionPage = /\/study\/(course|level)\/[^/]+\/unit\/[^/]+\/session\/[^/]+/.test(location.pathname)

  const hideBottomNav = exercisePaths.some(p => location.pathname.startsWith(p)) || isSessionPage
  const hideSidebar = exercisePaths.some(p => location.pathname.startsWith(p))

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Item Drop Notification (global) */}
      <ItemDropNotification />
      <ChestDropNotification />

      {/* Left Sidebar - Desktop and Mobile */}
      {!hideSidebar && <LeftSidebar />}

      {/* Main Content */}
      <main className={`${hideSidebar ? 'lg:pl-0' : 'lg:pl-64'} min-h-screen ${hideBottomNav ? 'pb-0' : 'pb-16 lg:pb-0'}`}>
        <div className={isSessionPage ? '' : 'container mx-auto px-4 py-6 max-w-7xl'}>
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
