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
  'elmfarrell@yahoo.com'
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
 * Ensures extended profile fields are preserved
 */
export function correctAndStoreUserRole(user: User | null): User | null {
  const correctedUser = correctUserRole(user)

  if (correctedUser) {
    // Always update localStorage with user data to ensure extended profile fields are preserved
    try {
      // Ensure we preserve ALL fields including extended profile fields
      const userToStore = {
        ...correctedUser,
        // Explicitly preserve extended profile fields that might be missing
        department: correctedUser.department || '',
        phone: correctedUser.phone || '',
        bio: correctedUser.bio || '',
        location: correctedUser.location || '',
        display_name: correctedUser.display_name || correctedUser.name || '',
        updated_at: new Date().toISOString()
      }

      localStorage.setItem('currentUser', JSON.stringify(userToStore))
      console.log(`✅ ROLE CORRECTION: Updated localStorage with extended profile fields for ${correctedUser.email}`)

      // Also update systemUsers to ensure consistency
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          const userIndex = users.findIndex((u: any) => u.id === correctedUser.id)
          if (userIndex >= 0) {
            users[userIndex] = { ...users[userIndex], ...userToStore }
            localStorage.setItem('systemUsers', JSON.stringify(users))
            console.log(`✅ ROLE CORRECTION: Updated systemUsers with extended profile fields`)
          }
        } catch (systemUsersError) {
          console.warn('Failed to update systemUsers:', systemUsersError)
        }
      }

      return userToStore
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