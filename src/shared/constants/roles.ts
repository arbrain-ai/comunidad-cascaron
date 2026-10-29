// Role constants for the application
export const USER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

// Tier constants - MUST match DB DEFAULT in profiles table
// DB DEFAULT is 'no-paid' (see supabase/migrations)
export const USER_TIERS = {
  NO_PAID: 'no-paid',    // Default for new signups (no payment yet)
  STANDARD: 'standard',  // Paid monthly/yearly subscription
  VIP: 'vip',            // Asignación manual (acceso completo)
} as const

export type UserTier = typeof USER_TIERS[keyof typeof USER_TIERS]

// Default tier for new users (must match DB DEFAULT)
export const DEFAULT_USER_TIER = USER_TIERS.NO_PAID

// Role permissions helpers

// Owner has the highest privileges
export const hasOwnerAccess = (role: string): boolean => {
  return role === USER_ROLES.OWNER
}

// Admin panel access - owners and admins
export const hasAdminAccess = (role: string): boolean => {
  return role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN
}

export const hasModeratorAccess = (role: string): boolean => {
  return hasAdminAccess(role) || role === USER_ROLES.MODERATOR
}

// Only owner can assign admin roles
export const canAssignAdminRole = (role: string): boolean => {
  return hasOwnerAccess(role)
}

// Check if a user can modify another user's role
export const canModifyUserRole = (
  currentUserRole: string,
  targetUserRole: string,
  newRole: string
): boolean => {
  // Owners can modify any role
  if (hasOwnerAccess(currentUserRole)) {
    return true
  }

  // Admins cannot modify owner roles
  if (targetUserRole === USER_ROLES.OWNER) {
    return false
  }

  // Admins cannot assign admin role
  if (newRole === USER_ROLES.ADMIN || newRole === USER_ROLES.OWNER) {
    return false
  }

  // Admins can modify member/moderator roles (but not to admin)
  return hasAdminAccess(currentUserRole)
}

// Check if a user can delete another user
export const canDeleteUser = (
  currentUserRole: string,
  targetUserRole: string
): boolean => {
  // Only owners can delete admins or other owners
  if (targetUserRole === USER_ROLES.OWNER || targetUserRole === USER_ROLES.ADMIN) {
    return hasOwnerAccess(currentUserRole)
  }

  // Admins and owners can delete members and moderators
  return hasAdminAccess(currentUserRole)
}

export const canManageCourses = (role: string): boolean => {
  return hasAdminAccess(role)
}

export const canManageEvents = (role: string): boolean => {
  return hasAdminAccess(role)
}

export const canManageCategories = (role: string): boolean => {
  return hasAdminAccess(role)
}

export const canDeletePosts = (role: string, isAuthor: boolean): boolean => {
  return hasAdminAccess(role) || isAuthor
}

export const canDeleteComments = (role: string, isAuthor: boolean): boolean => {
  return hasAdminAccess(role) || isAuthor
}
