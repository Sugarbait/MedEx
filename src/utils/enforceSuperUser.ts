/**
 * CRITICAL: Hard-coded Super User Enforcement
 *
 * pierre@phaetonai.com and elmfarrell@yahoo.com must ALWAYS be Super Users
 * This utility ensures their role is always 'super_user' no matter what
 */

export const SUPER_USER_EMAILS = [
  'pierre@phaetonai.com',
  'elmfarrell@yahoo.com',
  'admin@phaetonai.com'  // MedEX Super User
] as const

/**
 * Check if an email is a hard-coded Super User
 */
export function isSuperUserEmail(email: string | undefined): boolean {
  if (!email) return false
  return SUPER_USER_EMAILS.includes(email.toLowerCase() as any)
}

/**
 * Enforce Super User role for specific emails
 * Returns the user object with role corrected if needed
 */
export function enforceSuperUserRole<T extends { email: string; role?: string }>(user: T): T {
  if (isSuperUserEmail(user.email)) {
    if (user.role !== 'super_user') {
      console.log(`🔐 HARD-CODED SUPER USER: Enforcing super_user role for ${user.email}`)
      user.role = 'super_user'
    }
  }
  return user
}

/**
 * Enforce Super User role for an array of users
 */
export function enforceSuperUserRoles<T extends { email: string; role?: string }>(users: T[]): T[] {
  return users.map(user => enforceSuperUserRole(user))
}

/**
 * Force Super User role in localStorage for specific emails
 */
export function enforceSuperUserInLocalStorage(): void {
  try {
    // Enforce in currentUser
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      const userData = JSON.parse(currentUser)
      if (isSuperUserEmail(userData.email)) {
        userData.role = 'super_user'
        localStorage.setItem('currentUser', JSON.stringify(userData))
        console.log(`🔐 HARD-CODED SUPER USER: Enforced in currentUser for ${userData.email}`)
      }
    }

    // Enforce in systemUsers
    const systemUsers = localStorage.getItem('systemUsers')
    if (systemUsers) {
      const users = JSON.parse(systemUsers)
      let updated = false
      users.forEach((user: any) => {
        if (isSuperUserEmail(user.email) && user.role !== 'super_user') {
          user.role = 'super_user'
          updated = true
          console.log(`🔐 HARD-CODED SUPER USER: Enforced in systemUsers for ${user.email}`)
        }
      })
      if (updated) {
        localStorage.setItem('systemUsers', JSON.stringify(users))
      }
    }

    // Enforce in individual userProfile entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('userProfile_')) {
        const userProfile = localStorage.getItem(key)
        if (userProfile) {
          const profile = JSON.parse(userProfile)
          // Only check if profile has an email field
          if (profile.email && isSuperUserEmail(profile.email) && profile.role !== 'super_user') {
            profile.role = 'super_user'
            localStorage.setItem(key, JSON.stringify(profile))
            console.log(`🔐 HARD-CODED SUPER USER: Enforced in ${key} for ${profile.email}`)
          }
        }
      }
    }

  } catch (error) {
    console.error('Error enforcing Super User in localStorage:', error)
  }
}

// Auto-enforce on module load
if (typeof window !== 'undefined') {
  // Run enforcement when module is loaded
  enforceSuperUserInLocalStorage()

  // Also run enforcement every 5 seconds to catch any changes
  setInterval(() => {
    enforceSuperUserInLocalStorage()
  }, 5000)

  console.log('🔐 HARD-CODED SUPER USER: Enforcement utility initialized')
}