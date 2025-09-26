/**
 * Final User Cleanup Utility
 * Removes all unauthorized user profiles and data from all storage locations
 * Keeps only: pierre@phaetonai.com, elmfarrell@yahoo.com, guest@email.com
 */

import { userManagementService } from '../services/userManagementService'
import { secureStorage } from '../services/secureStorage'

interface AllowedUser {
  email: string
  role: 'super_user' | 'user'
  name: string
}

const ALLOWED_USERS: AllowedUser[] = [
  {
    email: 'pierre@phaetonai.com',
    role: 'super_user',
    name: 'Pierre PhaetonAI'
  },
  {
    email: 'elmfarrell@yahoo.com',
    role: 'super_user',
    name: 'Elmer Farrell'
  },
  {
    email: 'guest@email.com',
    role: 'user',
    name: 'Guest User'
  }
]

export class FinalUserCleanup {

  static async performCompleteCleanup(): Promise<void> {
    console.log('🧹 PERFORMING COMPLETE USER CLEANUP')
    console.log('=' * 60)

    try {
      // 1. Clean localStorage users
      await this.cleanLocalStorageUsers()

      // 2. Clean secure storage
      await this.cleanSecureStorage()

      // 3. Clean user settings
      await this.cleanUserSettings()

      // 4. Clean current user if unauthorized
      await this.cleanCurrentUser()

      // 5. Reset to authorized users only
      await this.resetToAuthorizedUsers()

      console.log('✅ Complete user cleanup finished!')
      console.log('🔄 Please refresh the page to see changes')

    } catch (error) {
      console.error('❌ Error during complete cleanup:', error)
    }
  }

  private static async cleanLocalStorageUsers(): Promise<void> {
    console.log('📁 Cleaning localStorage users...')

    try {
      const usersData = localStorage.getItem('users')
      if (!usersData) return

      const users = JSON.parse(usersData)
      const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())

      const filteredUsers = users.filter((user: any) => {
        const email = user.email?.toLowerCase()
        const isAllowed = allowedEmails.includes(email)

        if (!isAllowed) {
          console.log('🗑️ Removing user:', user.email, user.name)
        }

        return isAllowed
      })

      // Ensure correct roles
      filteredUsers.forEach((user: any) => {
        const allowedUser = ALLOWED_USERS.find(u =>
          u.email.toLowerCase() === user.email?.toLowerCase()
        )
        if (allowedUser) {
          user.role = allowedUser.role
          user.name = allowedUser.name
        }
      })

      localStorage.setItem('users', JSON.stringify(filteredUsers))
      console.log('✅ localStorage users cleaned')

    } catch (error) {
      console.error('❌ Error cleaning localStorage users:', error)
    }
  }

  private static async cleanSecureStorage(): Promise<void> {
    console.log('🔐 Cleaning secure storage...')

    try {
      const allKeys = Object.keys(localStorage)
      const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())

      allKeys.forEach(key => {
        if (key.startsWith('settings_') ||
            key.startsWith('profile_') ||
            key.startsWith('user_') ||
            key.startsWith('secure_')) {
          try {
            const data = localStorage.getItem(key)
            if (!data) return

            const parsed = JSON.parse(data)
            if (parsed.email || parsed.user_email) {
              const email = (parsed.email || parsed.user_email)?.toLowerCase()
              if (email && !allowedEmails.includes(email)) {
                console.log('🗑️ Removing secure data for:', email, key)
                localStorage.removeItem(key)
              }
            }
          } catch (e) {
            // Skip non-JSON data
          }
        }
      })

      console.log('✅ Secure storage cleaned')

    } catch (error) {
      console.error('❌ Error cleaning secure storage:', error)
    }
  }

  private static async cleanUserSettings(): Promise<void> {
    console.log('⚙️ Cleaning user settings...')

    try {
      const allKeys = Object.keys(localStorage)
      const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())

      allKeys.forEach(key => {
        if (key.includes('settings') || key.includes('config')) {
          try {
            const data = localStorage.getItem(key)
            if (!data) return

            const parsed = JSON.parse(data)

            // Check for email in various possible locations
            const possibleEmails = [
              parsed.email,
              parsed.userEmail,
              parsed.user?.email,
              parsed.currentUser?.email
            ].filter(Boolean)

            const hasUnauthorizedEmail = possibleEmails.some(email =>
              email && !allowedEmails.includes(email.toLowerCase())
            )

            if (hasUnauthorizedEmail) {
              console.log('🗑️ Removing settings:', key)
              localStorage.removeItem(key)
            }
          } catch (e) {
            // Skip non-JSON data
          }
        }
      })

      console.log('✅ User settings cleaned')

    } catch (error) {
      console.error('❌ Error cleaning user settings:', error)
    }
  }

  private static async cleanCurrentUser(): Promise<void> {
    console.log('👤 Cleaning current user...')

    try {
      const currentUserData = localStorage.getItem('currentUser')
      if (!currentUserData) return

      const currentUser = JSON.parse(currentUserData)
      const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())
      const currentEmail = currentUser.email?.toLowerCase()

      if (!currentEmail || !allowedEmails.includes(currentEmail)) {
        console.log('🗑️ Removing unauthorized current user:', currentUser.email)
        localStorage.removeItem('currentUser')
      } else {
        // Ensure correct role for current user
        const allowedUser = ALLOWED_USERS.find(u =>
          u.email.toLowerCase() === currentEmail
        )
        if (allowedUser) {
          currentUser.role = allowedUser.role
          currentUser.name = allowedUser.name
          localStorage.setItem('currentUser', JSON.stringify(currentUser))
        }
      }

      console.log('✅ Current user cleaned')

    } catch (error) {
      console.error('❌ Error cleaning current user:', error)
    }
  }

  private static async resetToAuthorizedUsers(): Promise<void> {
    console.log('🔄 Resetting to authorized users only...')

    try {
      // Ensure we have the correct authorized users
      const users = ALLOWED_USERS.map(user => ({
        id: this.generateUserId(user.email),
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      }))

      localStorage.setItem('users', JSON.stringify(users))
      console.log('✅ Reset to authorized users complete')

    } catch (error) {
      console.error('❌ Error resetting users:', error)
    }
  }

  private static generateUserId(email: string): string {
    if (email === 'pierre@phaetonai.com') return 'pierre-user-789'
    if (email === 'elmfarrell@yahoo.com') return 'super-user-456'
    if (email === 'guest@email.com') return 'demo-user-123'
    return `user-${Date.now()}`
  }

  static async quickCleanup(): Promise<void> {
    console.log('⚡ Quick user profile cleanup...')

    const allowedEmails = ALLOWED_USERS.map(u => u.email.toLowerCase())

    try {
      // Quick localStorage cleanup
      const usersData = localStorage.getItem('users')
      if (usersData) {
        const users = JSON.parse(usersData)
        const filtered = users.filter((u: any) =>
          u.email && allowedEmails.includes(u.email.toLowerCase())
        )
        localStorage.setItem('users', JSON.stringify(filtered))
      }

      console.log('✅ Quick cleanup done')
    } catch (error) {
      console.error('❌ Quick cleanup error:', error)
    }
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).finalUserCleanup = FinalUserCleanup
}