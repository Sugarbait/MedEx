import { userProfileService } from '@/services/userProfileService'
import { userManagementService } from '@/services/userManagementService'
import { avatarStorageService } from '@/services/avatarStorageService'

export interface FixResult {
  userRecreationFixed: boolean
  profileImageFixed: boolean
  issues: string[]
  fixes: string[]
}

/**
 * Comprehensive utility to fix both user recreation and profile image persistence issues
 */
export class UserIssuesFixer {

  /**
   * Fix all known user management issues
   */
  static async fixAllUserIssues(): Promise<FixResult> {
    const result: FixResult = {
      userRecreationFixed: false,
      profileImageFixed: false,
      issues: [],
      fixes: []
    }

    console.log('🔧 Starting comprehensive user issues fix...')

    try {
      // 1. Fix user recreation issues
      const recreationFix = await this.fixUserRecreationIssues()
      result.userRecreationFixed = recreationFix.success
      result.issues.push(...recreationFix.issues)
      result.fixes.push(...recreationFix.fixes)

      // 2. Fix profile image persistence issues
      const imageFix = await this.fixProfileImageIssues()
      result.profileImageFixed = imageFix.success
      result.issues.push(...imageFix.issues)
      result.fixes.push(...imageFix.fixes)

      // 3. Clean up duplicate users
      try {
        const duplicateCleanup = await userManagementService.cleanupDuplicateUsers()
        if (duplicateCleanup.status === 'success') {
          const { removed, remaining } = duplicateCleanup.data || { removed: 0, remaining: 0 }
          if (removed > 0) {
            result.fixes.push(`Removed ${removed} duplicate users, ${remaining} remain`)
          }
        }
      } catch (error) {
        result.issues.push(`Duplicate cleanup failed: ${error}`)
      }

      console.log('🔧 User issues fix completed:', result)
      return result

    } catch (error: any) {
      result.issues.push(`Global fix error: ${error.message}`)
      return result
    }
  }

  /**
   * Fix user recreation issues
   */
  private static async fixUserRecreationIssues(): Promise<{ success: boolean; issues: string[]; fixes: string[] }> {
    const issues: string[] = []
    const fixes: string[] = []

    try {
      // Check if deleted users tracking is working
      const deletedUsers = localStorage.getItem('deletedUsers')
      const deletedEmails = localStorage.getItem('deletedUserEmails')

      if (!deletedUsers) {
        localStorage.setItem('deletedUsers', JSON.stringify([]))
        fixes.push('Initialized deleted users tracking')
      }

      if (!deletedEmails) {
        localStorage.setItem('deletedUserEmails', JSON.stringify([]))
        fixes.push('Initialized deleted emails tracking')
      }

      // Check for duplicate demo users
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers)
          const emailCounts = new Map<string, number>()

          users.forEach((user: any) => {
            const email = user.email.toLowerCase()
            emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
          })

          const duplicates = Array.from(emailCounts.entries()).filter(([_, count]) => count > 1)
          if (duplicates.length > 0) {
            issues.push(`Found ${duplicates.length} email addresses with multiple users`)
            fixes.push('Flagged duplicate emails for cleanup')
          }
        } catch (error) {
          issues.push('Failed to parse stored users for duplicate check')
        }
      }

      return { success: issues.length === 0, issues, fixes }

    } catch (error: any) {
      issues.push(`User recreation fix error: ${error.message}`)
      return { success: false, issues, fixes }
    }
  }

  /**
   * Fix profile image persistence issues
   */
  private static async fixProfileImageIssues(): Promise<{ success: boolean; issues: string[]; fixes: string[] }> {
    const issues: string[] = []
    const fixes: string[] = []

    try {
      // Get all users and check their avatar status
      const usersResponse = await userProfileService.loadSystemUsers()
      if (usersResponse.status !== 'success') {
        issues.push('Failed to load users for avatar check')
        return { success: false, issues, fixes }
      }

      const users = usersResponse.data || []
      let avatarsFixed = 0

      for (const user of users) {
        try {
          // Check if user has avatar data but it's not showing
          const storedAvatar = await avatarStorageService.getAvatarUrl(user.id)
          const userHasAvatarInProfile = !!user.avatar

          if (storedAvatar && !userHasAvatarInProfile) {
            // Avatar exists in storage but not in profile - fix it
            const fixResult = await userProfileService.fixProfileImagePersistence(user.id)
            if (fixResult.status === 'success' && fixResult.data) {
              avatarsFixed++
              fixes.push(`Fixed avatar persistence for ${user.name}`)
            }
          } else if (!storedAvatar && userHasAvatarInProfile) {
            // Profile has avatar reference but storage doesn't - clean it up
            try {
              const userProfile = localStorage.getItem(`userProfile_${user.id}`)
              if (userProfile) {
                const profile = JSON.parse(userProfile)
                delete profile.avatar
                localStorage.setItem(`userProfile_${user.id}`, JSON.stringify(profile))
                fixes.push(`Cleaned up invalid avatar reference for ${user.name}`)
              }
            } catch (error) {
              issues.push(`Failed to clean avatar reference for ${user.name}`)
            }
          }

          // Also check localStorage avatar cache consistency
          const localAvatarInfo = localStorage.getItem(`avatar_${user.id}`)
          const localAvatarData = localStorage.getItem(`avatar_data_${user.id}`)

          if (localAvatarData && !localAvatarInfo) {
            // Has avatar data but no info cache
            try {
              const avatarInfo = {
                url: localAvatarData,
                storagePath: `avatar_data_${user.id}`,
                uploadedAt: new Date().toISOString(),
                synchronized: true
              }
              localStorage.setItem(`avatar_${user.id}`, JSON.stringify(avatarInfo))
              fixes.push(`Restored avatar cache for ${user.name}`)
            } catch (error) {
              issues.push(`Failed to restore avatar cache for ${user.name}`)
            }
          }

        } catch (error) {
          issues.push(`Error checking avatar for ${user.name}: ${error}`)
        }
      }

      if (avatarsFixed > 0) {
        fixes.push(`Fixed avatar persistence for ${avatarsFixed} users`)
      }

      return { success: issues.length === 0, issues, fixes }

    } catch (error: any) {
      issues.push(`Profile image fix error: ${error.message}`)
      return { success: false, issues, fixes }
    }
  }

  /**
   * Diagnostic method to check current state
   */
  static async diagnosePotentialIssues(): Promise<{
    userRecreationRisk: boolean
    profileImageIssues: boolean
    details: string[]
  }> {
    const details: string[] = []
    let userRecreationRisk = false
    let profileImageIssues = false

    try {
      // Check deletion tracking
      const deletedUsers = localStorage.getItem('deletedUsers')
      const deletedEmails = localStorage.getItem('deletedUserEmails')

      if (!deletedUsers || !deletedEmails) {
        userRecreationRisk = true
        details.push('Deletion tracking not properly initialized')
      }

      // Check for duplicate users
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers)
          const emailSet = new Set()
          const duplicateEmails: string[] = []

          users.forEach((user: any) => {
            const email = user.email.toLowerCase()
            if (emailSet.has(email)) {
              duplicateEmails.push(email)
            }
            emailSet.add(email)
          })

          if (duplicateEmails.length > 0) {
            userRecreationRisk = true
            details.push(`Found duplicate emails: ${duplicateEmails.join(', ')}`)
          }
        } catch (error) {
          details.push('Unable to parse user data for duplicate check')
        }
      }

      // Check avatar consistency
      try {
        const usersResponse = await userProfileService.loadSystemUsers()
        if (usersResponse.status === 'success') {
          const users = usersResponse.data || []

          for (const user of users.slice(0, 5)) { // Check first 5 users to avoid performance issues
            const storedAvatar = await avatarStorageService.getAvatarUrl(user.id)
            const profileAvatar = user.avatar

            if ((storedAvatar && !profileAvatar) || (!storedAvatar && profileAvatar)) {
              profileImageIssues = true
              details.push(`Avatar mismatch for ${user.name}: storage=${!!storedAvatar}, profile=${!!profileAvatar}`)
            }
          }
        }
      } catch (error) {
        details.push(`Avatar consistency check failed: ${error}`)
      }

      return { userRecreationRisk, profileImageIssues, details }

    } catch (error: any) {
      details.push(`Diagnostic error: ${error.message}`)
      return { userRecreationRisk: true, profileImageIssues: true, details }
    }
  }

  /**
   * Force refresh all user data (emergency fix)
   */
  static async forceRefreshAllUserData(): Promise<boolean> {
    try {
      console.log('🔄 Force refreshing all user data...')

      // Clear caches
      userProfileService.clearCache()

      // Reload users
      const usersResponse = await userProfileService.loadSystemUsers()
      if (usersResponse.status !== 'success') {
        return false
      }

      // Force avatar sync for all users
      const users = usersResponse.data || []
      for (const user of users) {
        try {
          await avatarStorageService.syncAvatarAcrossDevices(user.id)
        } catch (error) {
          console.warn(`Failed to sync avatar for user [REDACTED]:`, error)
        }
      }

      // Trigger UI refresh
      window.dispatchEvent(new Event('userDataUpdated'))

      console.log('🔄 Force refresh completed')
      return true

    } catch (error) {
      console.error('🔄 Force refresh failed:', error)
      return false
    }
  }
}

// Export singleton instance for easy use
export const fixUserIssues = UserIssuesFixer

// Add global window access for debugging
if (typeof window !== 'undefined') {
  (window as any).fixUserIssues = fixUserIssues
}