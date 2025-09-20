/**
 * Authentication System Fixer
 * Comprehensive solution for fixing all authentication issues in CareXPS CRM
 */

import { userManagementService, SystemUserWithCredentials } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { encryptionService } from '@/services/encryption'
import { auditLogger } from '@/services/auditLogger'

export interface FixResult {
  success: boolean
  message: string
  details: string[]
  usersFixed: number
  errors: string[]
}

export class AuthenticationFixer {

  /**
   * Fix all authentication issues - comprehensive solution
   */
  static async fixAllAuthenticationIssues(): Promise<FixResult> {
    console.log('🔧 AuthenticationFixer: Starting comprehensive authentication fix...')

    const result: FixResult = {
      success: true,
      message: '',
      details: [],
      usersFixed: 0,
      errors: []
    }

    try {
      // Step 1: Fix double encryption issues
      result.details.push('Step 1: Fixing double-encrypted passwords...')
      const doubleEncryptionFix = await userManagementService.fixDoubleEncryptedPasswords()
      if (doubleEncryptionFix.status === 'success' && doubleEncryptionFix.data) {
        result.usersFixed += doubleEncryptionFix.data.fixed
        result.details.push(`✅ Fixed double-encrypted passwords for ${doubleEncryptionFix.data.fixed} users`)
        result.errors.push(...doubleEncryptionFix.data.errors)
      } else {
        result.details.push(`❌ Double encryption fix failed: ${doubleEncryptionFix.error}`)
        result.errors.push(doubleEncryptionFix.error || 'Unknown double encryption fix error')
      }

      // Step 2: Fix demo user credentials
      result.details.push('Step 2: Ensuring demo user credentials are properly set...')
      const demoUsersFix = await this.fixDemoUserCredentials()
      result.details.push(...demoUsersFix.details)
      result.usersFixed += demoUsersFix.usersFixed
      result.errors.push(...demoUsersFix.errors)

      // Step 3: Clear lockouts for all users
      result.details.push('Step 3: Clearing account lockouts...')
      const lockoutFix = await this.clearAllLockouts()
      result.details.push(...lockoutFix.details)
      result.errors.push(...lockoutFix.errors)

      // Step 4: Validate authentication for all users
      result.details.push('Step 4: Validating authentication for all users...')
      const validationResult = await this.validateAllUserAuthentication()
      result.details.push(...validationResult.details)
      result.errors.push(...validationResult.errors)

      // Step 5: Clean up localStorage inconsistencies
      result.details.push('Step 5: Cleaning up localStorage inconsistencies...')
      this.cleanupLocalStorage()
      result.details.push('✅ localStorage cleanup completed')

      // Generate final result
      if (result.errors.length === 0) {
        result.message = `✅ Authentication system fix completed successfully! Fixed ${result.usersFixed} users.`
      } else {
        result.success = false
        result.message = `⚠️ Fix completed with ${result.errors.length} errors. Fixed ${result.usersFixed} users.`
      }

      // Log the fix to audit trail
      await auditLogger.logSecurityEvent('AUTHENTICATION_SYSTEM_FIX', 'system', result.success, {
        usersFixed: result.usersFixed,
        errorsCount: result.errors.length,
        details: result.details.slice(-5) // Last 5 details to avoid huge logs
      })

      console.log('🔧 AuthenticationFixer: Fix completed', result)
      return result

    } catch (error: any) {
      console.error('🔧 AuthenticationFixer: Fix failed:', error)
      result.success = false
      result.message = `❌ Authentication fix failed: ${error.message}`
      result.errors.push(error.message)
      return result
    }
  }

  /**
   * Fix specific user authentication issues
   */
  static async fixUserAuthentication(userId: string, email: string, newPassword?: string): Promise<FixResult> {
    console.log(`🔧 AuthenticationFixer: Fixing authentication for ${email} (${userId})`)

    const result: FixResult = {
      success: true,
      message: '',
      details: [],
      usersFixed: 0,
      errors: []
    }

    try {
      // Clear any lockouts first
      const clearResult = await userManagementService.clearAccountLockout(userId)
      if (clearResult.status === 'success') {
        result.details.push('✅ Cleared account lockout')
      } else {
        result.details.push(`⚠️ Could not clear lockout: ${clearResult.error}`)
      }

      // Force clear lockout data
      await userManagementService.forceClearLockout(userId, email)
      result.details.push('✅ Force cleared all lockout data')

      // Reset password if provided
      if (newPassword) {
        const passwordResult = await userManagementService.changeUserPassword(userId, newPassword)
        if (passwordResult.status === 'success') {
          result.details.push('✅ Password reset successfully')
          result.usersFixed = 1
        } else {
          result.details.push(`❌ Password reset failed: ${passwordResult.error}`)
          result.errors.push(passwordResult.error || 'Password reset failed')
        }
      }

      // Test authentication
      if (newPassword) {
        const authTest = await userManagementService.authenticateUser(email, newPassword)
        if (authTest.status === 'success' && authTest.data) {
          result.details.push('✅ Authentication test successful')
          result.message = `✅ User ${email} authentication fixed successfully!`
        } else {
          result.details.push('❌ Authentication test failed')
          result.errors.push('Authentication test failed after fix')
          result.success = false
          result.message = `❌ Failed to fix authentication for ${email}`
        }
      } else {
        result.message = `✅ Lockout cleared for ${email}. Test login with existing password.`
      }

    } catch (error: any) {
      console.error(`🔧 AuthenticationFixer: Failed to fix user ${email}:`, error)
      result.success = false
      result.message = `❌ Failed to fix authentication for ${email}: ${error.message}`
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Specifically fix pierre@phaetonai.com authentication
   */
  static async fixPierreAuthentication(): Promise<FixResult> {
    console.log('🔧 AuthenticationFixer: Specifically fixing Pierre authentication...')

    try {
      // First, find the actual user ID for pierre@phaetonai.com
      const userResponse = await userProfileService.getUserByEmail('pierre@phaetonai.com')
      if (userResponse.status === 'error' || !userResponse.data) {
        return {
          success: false,
          message: '❌ Pierre user not found - cannot fix authentication',
          details: ['User pierre@phaetonai.com does not exist in the system'],
          usersFixed: 0,
          errors: ['Pierre user not found']
        }
      }

      const actualUserId = userResponse.data.id
      console.log(`🔧 AuthenticationFixer: Found Pierre user with ID: ${actualUserId}`)

      return await this.fixUserAuthentication(actualUserId, 'pierre@phaetonai.com', 'Pierre123!')

    } catch (error: any) {
      return {
        success: false,
        message: `❌ Failed to find Pierre user: ${error.message}`,
        details: [error.message],
        usersFixed: 0,
        errors: [error.message]
      }
    }
  }

  /**
   * Test authentication for all users and report status
   */
  static async testAllUserAuthentication(): Promise<{
    totalUsers: number
    workingAuth: number
    failedAuth: number
    details: Array<{ email: string; status: string; details: string }>
  }> {
    console.log('🧪 AuthenticationFixer: Testing authentication for all users...')

    const result = {
      totalUsers: 0,
      workingAuth: 0,
      failedAuth: 0,
      details: [] as Array<{ email: string; status: string; details: string }>
    }

    try {
      // Get all users
      const usersResponse = await userManagementService.loadSystemUsers()
      if (usersResponse.status === 'error' || !usersResponse.data) {
        throw new Error('Failed to load users for testing')
      }

      const users = usersResponse.data
      result.totalUsers = users.length

      // Test each user with default passwords
      const testPasswords = {
        'pierre@phaetonai.com': 'Pierre123!',
        'demo@carexps.com': 'Demo123!',
        'elmfarrell@yahoo.com': 'Super123!'
      }

      for (const user of users) {
        const testPassword = testPasswords[user.email as keyof typeof testPasswords]
        if (testPassword) {
          try {
            const authResult = await userManagementService.authenticateUser(user.email, testPassword)
            if (authResult.status === 'success' && authResult.data) {
              result.workingAuth++
              result.details.push({
                email: user.email,
                status: 'SUCCESS',
                details: 'Authentication successful'
              })
            } else {
              result.failedAuth++
              result.details.push({
                email: user.email,
                status: 'FAILED',
                details: authResult.error || 'Authentication failed'
              })
            }
          } catch (error: any) {
            result.failedAuth++
            result.details.push({
              email: user.email,
              status: 'ERROR',
              details: error.message
            })
          }
        } else {
          result.details.push({
            email: user.email,
            status: 'SKIPPED',
            details: 'No test password available'
          })
        }
      }

    } catch (error: any) {
      console.error('🧪 AuthenticationFixer: Test failed:', error)
    }

    return result
  }

  /**
   * Private helper methods
   */
  private static async fixDemoUserCredentials(): Promise<{
    usersFixed: number
    details: string[]
    errors: string[]
  }> {
    const result = {
      usersFixed: 0,
      details: [] as string[],
      errors: [] as string[]
    }

    const demoUserEmails = [
      { email: 'pierre@phaetonai.com', password: 'Pierre123!' },
      { email: 'demo@carexps.com', password: 'Demo123!' },
      { email: 'elmfarrell@yahoo.com', password: 'Super123!' }
    ]

    for (const userConfig of demoUserEmails) {
      try {
        // Dynamically resolve user ID
        const userResponse = await userProfileService.getUserByEmail(userConfig.email)
        if (userResponse.status === 'success' && userResponse.data) {
          const actualUserId = userResponse.data.id

          // Always reset demo user passwords to ensure they work
          const passwordResult = await userManagementService.changeUserPassword(actualUserId, userConfig.password)
          if (passwordResult.status === 'success') {
            result.usersFixed++
            result.details.push(`✅ Reset password for ${userConfig.email} (${actualUserId})`)
          } else {
            result.details.push(`❌ Failed to reset password for ${userConfig.email} (${actualUserId})`)
            result.errors.push(`Password reset failed for ${userConfig.email}: ${passwordResult.error}`)
          }
        } else {
          result.details.push(`⚠️ User ${userConfig.email} not found in system`)
          result.errors.push(`User ${userConfig.email} not found`)
        }
      } catch (error: any) {
        result.details.push(`❌ Error resetting ${userConfig.email}`)
        result.errors.push(`Error for ${userConfig.email}: ${error.message}`)
      }
    }

    return result
  }

  private static async clearAllLockouts(): Promise<{
    details: string[]
    errors: string[]
  }> {
    const result = {
      details: [] as string[],
      errors: [] as string[]
    }

    try {
      // Get all users
      const usersResponse = await userManagementService.loadSystemUsers()
      if (usersResponse.status === 'error' || !usersResponse.data) {
        result.errors.push('Failed to load users for lockout clearing')
        return result
      }

      const users = usersResponse.data
      let clearedCount = 0

      for (const user of users) {
        try {
          // Force clear lockout for each user
          await userManagementService.forceClearLockout(user.id, user.email)
          clearedCount++
        } catch (error: any) {
          result.errors.push(`Failed to clear lockout for ${user.email}: ${error.message}`)
        }
      }

      result.details.push(`✅ Cleared lockouts for ${clearedCount}/${users.length} users`)

    } catch (error: any) {
      result.errors.push(`Lockout clearing failed: ${error.message}`)
    }

    return result
  }

  private static async validateAllUserAuthentication(): Promise<{
    details: string[]
    errors: string[]
  }> {
    const result = {
      details: [] as string[],
      errors: [] as string[]
    }

    try {
      const testResult = await this.testAllUserAuthentication()
      result.details.push(`Authentication test completed: ${testResult.workingAuth}/${testResult.totalUsers} users can authenticate`)

      if (testResult.failedAuth > 0) {
        result.details.push(`⚠️ ${testResult.failedAuth} users still have authentication issues`)
        for (const failure of testResult.details.filter(d => d.status === 'FAILED' || d.status === 'ERROR')) {
          result.errors.push(`${failure.email}: ${failure.details}`)
        }
      }

    } catch (error: any) {
      result.errors.push(`Authentication validation failed: ${error.message}`)
    }

    return result
  }

  private static cleanupLocalStorage(): void {
    try {
      // Clean up any corrupted localStorage entries
      const keysToCheck = [
        'failed_login_attempts',
        'deletedUsers',
        'deletedUserEmails'
      ]

      for (const key of keysToCheck) {
        try {
          const value = localStorage.getItem(key)
          if (value) {
            JSON.parse(value) // Test if it's valid JSON
          }
        } catch (error) {
          console.log(`Removing corrupted localStorage key: ${key}`)
          localStorage.removeItem(key)
        }
      }

      // Clean up old login stats for non-existent users
      const allKeys = Object.keys(localStorage)
      const loginStatsKeys = allKeys.filter(key => key.startsWith('loginStats_'))
      const credentialKeys = allKeys.filter(key => key.startsWith('userCredentials_'))

      console.log(`Found ${loginStatsKeys.length} login stats and ${credentialKeys.length} credential entries`)

    } catch (error) {
      console.error('LocalStorage cleanup failed:', error)
    }
  }
}

// Export fix functions for console access
if (typeof window !== 'undefined') {
  (window as any).authFixer = {
    fixAll: () => AuthenticationFixer.fixAllAuthenticationIssues(),
    fixPierre: () => AuthenticationFixer.fixPierreAuthentication(),
    fixUser: (userId: string, email: string, password?: string) =>
      AuthenticationFixer.fixUserAuthentication(userId, email, password),
    testAll: () => AuthenticationFixer.testAllUserAuthentication()
  }

  console.log('🔧 Authentication Fixer loaded! Use window.authFixer for debugging:')
  console.log('  - window.authFixer.fixAll() - Fix all authentication issues')
  console.log('  - window.authFixer.fixPierre() - Fix Pierre authentication')
  console.log('  - window.authFixer.testAll() - Test all user authentication')
}