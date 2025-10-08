import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import TopNavigation from './navigation/TopNavigation'
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
    '/study/drag-drop'
  ]

  const hideBottomNav = exercisePaths.some(p => location.pathname.startsWith(p))

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
      <main className="md:pt-16 pb-16 md:pb-0">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation - Mobile (hidden on exercise/question UIs) */}
      {!hideBottomNav && (
        <div className="md:hidden">
          <BottomNavigation />
        </div>
      )}
    </div>
  )
}

export default Layout
