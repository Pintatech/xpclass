import { useAuth } from './useAuth'

export const usePermissions = () => {
  const { user, isAdmin } = useAuth()

  const canCreateContent = () => {
    // Allow admins and authenticated users to create content
    // You can customize this logic based on your requirements
    return user && (isAdmin() || user.role === 'admin' || user.role === 'teacher')
  }

  const canEditContent = () => {
    // Similar to create, but you might have different rules
    return user && (isAdmin() || user.role === 'admin' || user.role === 'teacher')
  }

  const canDeleteContent = () => {
    // More restrictive - only admins can delete
    return isAdmin()
  }

  const canViewContent = () => {
    // All authenticated users can view content
    return !!user
  }

  return {
    canCreateContent,
    canEditContent,
    canDeleteContent,
    canViewContent,
    user,
    isAdmin: isAdmin()
  }
}

export default usePermissions