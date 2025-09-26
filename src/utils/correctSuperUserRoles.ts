/**
 * Utility to ensure super users have the correct role assigned
 * This fixes issues where elmfarrell@yahoo.com and pierre@phaetonai.com show "Staff" instead of "Super User"
 */

export interface User {
  id: string
  email: string
  name: string
  role: string
  [key: string]: any
}

const SUPER_USER_EMAILS = [
  'elmfarrell@yahoo.com',
  'pierre@phaetonai.com'
]

/**
 * Corrects the role for known super users
 * This ensures they always show "Super User" instead of "Staff"
 */
export function correctUserRole(user: User | null): User | null {
  if (!user || !user.email) {
    return user
  }

  const email = user.email.toLowerCase()
  const isSuperUser = SUPER_USER_EMAILS.includes(email)

  if (isSuperUser && user.role !== 'super_user') {
    console.log(`🔧 ROLE CORRECTION: Fixing role for ${email} from ${user.role} to super_user`)
    return {
      ...user,
      role: 'super_user'
    }
  }

  return user
}

/**
 * Applies role correction and updates localStorage if needed
 */
export function correctAndStoreUserRole(user: User | null): User | null {
  const correctedUser = correctUserRole(user)

  if (correctedUser && correctedUser !== user) {
    // Update localStorage with corrected user data
    try {
      localStorage.setItem('currentUser', JSON.stringify(correctedUser))
      console.log(`✅ ROLE CORRECTION: Updated localStorage for ${correctedUser.email}`)
    } catch (error) {
      console.warn('❌ ROLE CORRECTION: Failed to update localStorage:', error)
    }
  }

  return correctedUser
}

/**
 * Checks if current localStorage user needs role correction
 */
export function checkAndFixStoredUser(): void {
  try {
    const storedUserStr = localStorage.getItem('currentUser')
    if (!storedUserStr) return

    const storedUser = JSON.parse(storedUserStr)
    const correctedUser = correctUserRole(storedUser)

    if (correctedUser && correctedUser !== storedUser) {
      localStorage.setItem('currentUser', JSON.stringify(correctedUser))
      console.log(`🔧 STARTUP CORRECTION: Fixed stored user role for ${correctedUser.email}`)
    }
  } catch (error) {
    console.warn('❌ STARTUP CORRECTION: Failed to check stored user:', error)
  }
}

export default {
  correctUserRole,
  correctAndStoreUserRole,
  checkAndFixStoredUser,
  SUPER_USER_EMAILS
}