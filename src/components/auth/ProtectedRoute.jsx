import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LoadingSpinner from '../ui/LoadingSpinner'

// requireTeacher: teachers and admins only (RK-10). A UI check, not a lock: the database decides what the
// /teacher pages can read. It only stops a student who types the address from seeing the teacher screens.
const ProtectedRoute = ({ children, requireAdmin = false, requireTeacher = false }) => {
  const { user, profile, loading, isAdmin, isTeacher } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <div className="mt-4 text-gray-600">Đang xác thực...</div>
          <div className="mt-2 text-sm text-gray-500">
            Nếu mất quá lâu, hãy thử refresh trang
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // For admin routes, wait for profile to load before checking admin status
  if (requireAdmin) {
    // If profile is still loading (null but user exists), show loading
    if (profile === null && user) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-white">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <div className="mt-4 text-gray-600">Đang kiểm tra quyền admin...</div>
          </div>
        </div>
      )
    }
    
    // If profile loaded but user is not admin
    if (profile && !isAdmin()) {
      return <Navigate to="/" replace />
    }
  }

  // For teacher routes, the same wait for the profile, then teachers and admins only
  if (requireTeacher) {
    if (profile === null && user) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-white">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <div className="mt-4 text-gray-600">Đang kiểm tra quyền giáo viên...</div>
          </div>
        </div>
      )
    }

    if (profile && !isTeacher() && !isAdmin()) {
      return <Navigate to="/" replace />
    }
  }

  return children
}

export default ProtectedRoute
