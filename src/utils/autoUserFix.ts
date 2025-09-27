/**
 * Automatic User Profile Fix
 * Prevents "User User" profiles from appearing and ensures Super User roles are maintained
 */

const ALLOWED_USERS = [
  {
    email: 'pierre@phaetonai.com',
    role: 'super_user',
    name: 'Pierre PhaetonAI',
    id: 'pierre-user-789'
  },
  {
    email: 'elmfarrell@yahoo.com',
    role: 'super_user',
    name: 'Elmer Farrell',
    id: 'super-user-456'
  },
  {
    email: 'guest@email.com',
    role: 'user',
    name: 'Guest User',
    id: 'demo-user-123'
  }
]

export class AutoUserFix {
  private static fixRunning = false

  static async runAutoFix(): Promise<void> {
    if (this.fixRunning) return
    this.fixRunning = true

    try {
      console.log('🔧 AutoUserFix: Running automatic user profile fix...')

      // 1. Fix users array
      this.fixUsersArray()

      // 2. Fix current user
      this.fixCurrentUser()

      // 3. Clean up problematic keys
      this.cleanupProblematicKeys()

      console.log('✅ AutoUserFix: User profiles fixed automatically')
    } catch (error) {
      console.error('❌ AutoUserFix error:', error)
    } finally {
      this.fixRunning = false
    }
  }

  private static fixUsersArray(): void {
    try {
      const usersData = localStorage.getItem('users')
      if (!usersData) return

      const users = JSON.parse(usersData)
      const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())

      const cleanUsers = users.filter((user: any) => {
        const email = user.email?.toLowerCase()
        return email && allowedEmails.includes(email)
      })

      // Ensure correct data for remaining users
      cleanUsers.forEach((user: any) => {
        const allowedUser = ALLOWED_USERS.find(u =>
          u.email.toLowerCase() === user.email?.toLowerCase()
        )
        if (allowedUser) {
          user.role = allowedUser.role
          user.name = allowedUser.name
          user.id = allowedUser.id
        }
      })

      localStorage.setItem('users', JSON.stringify(cleanUsers))
    } catch (error) {
      console.warn('Failed to fix users array:', error)
    }
  }

  private static fixCurrentUser(): void {
    try {
      const currentUserData = localStorage.getItem('currentUser')
      if (!currentUserData) return

      const currentUser = JSON.parse(currentUserData)
      const email = currentUser.email?.toLowerCase()
      const allowedUser = ALLOWED_USERS.find(u => u.email.toLowerCase() === email)

      if (allowedUser) {
        // Fix the current user data
        currentUser.role = allowedUser.role
        currentUser.name = allowedUser.name
        currentUser.id = allowedUser.id
        localStorage.setItem('currentUser', JSON.stringify(currentUser))
        console.log(`🔧 Fixed current user: ${currentUser.name} (${currentUser.role})`)
      } else {
        // Remove unauthorized current user
        localStorage.removeItem('currentUser')
        console.log('🗑️ Removed unauthorized current user')
      }
    } catch (error) {
      console.warn('Failed to fix current user:', error)
    }
  }

  private static cleanupProblematicKeys(): void {
    try {
      const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // Check for user-related keys
        if (key.startsWith('settings_') || key.startsWith('user_') || key.startsWith('profile_')) {
          try {
            const data = localStorage.getItem(key)
            if (!data) continue

            const parsed = JSON.parse(data)

            // Check for problematic "User User" or unauthorized users
            if (parsed.name === 'User' || parsed.name === 'User User' ||
                (parsed.email && !allowedEmails.includes(parsed.email.toLowerCase()))) {
              localStorage.removeItem(key)
              console.log(`🗑️ Removed problematic key: ${key}`)
            }
          } catch (e) {
            // Skip non-JSON data
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup problematic keys:', error)
    }
  }

  static schedulePeriodicFix(): void {
    // Run fix every 30 seconds to prevent "User User" from reappearing
    setInterval(() => {
      this.runAutoFix()
    }, 30000)

    // Also run on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => this.runAutoFix(), 1000)
      }
    })
  }

  static initialize(): void {
    // Run immediately
    this.runAutoFix()

    // Schedule periodic fixes
    this.schedulePeriodicFix()

    console.log('🛡️ AutoUserFix initialized - will prevent "User User" profiles')
  }
}

// Auto-initialize when imported - TEMPORARILY DISABLED for MFA debugging
if (typeof window !== 'undefined') {
  // Make available globally for debugging
  (window as any).autoUserFix = AutoUserFix

  // Initialize on next tick - DISABLED for MFA debugging
  // setTimeout(() => {
  //   AutoUserFix.initialize()
  // }, 100)

  console.log('🔧 AutoUserFix available but auto-initialization disabled for MFA debugging')
}