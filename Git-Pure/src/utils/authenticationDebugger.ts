/**
 * Authentication Debugger and Fixer
 * Comprehensive tool to diagnose and fix authentication issues in CareXPS CRM
 */

import { userManagementService, SystemUserWithCredentials } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { encryptionService } from '@/services/encryption'
import { auditLogger } from '@/services/auditLogger'

export interface AuthDebugReport {
  userId: string
  email: string
  issues: string[]
  fixes: string[]
  status: 'healthy' | 'issues_found' | 'critical'
  passwordStatus: 'working' | 'double_encrypted' | 'corrupted' | 'missing'
  credentialsFound: boolean
  lockoutStatus: {
    isLocked: boolean
    attempts: number
    canClearLockout: boolean
  }
}

export interface AuthSystemReport {
  timestamp: string
  overallHealth: 'healthy' | 'degraded' | 'critical'
  usersChecked: number
  issuesFound: number
  fixesApplied: number
  userReports: AuthDebugReport[]
  systemIssues: string[]
  recommendations: string[]
}

export class AuthenticationDebugger {

  /**
   * Comprehensive authentication system health check
   */
  static async runFullSystemDiagnostic(): Promise<AuthSystemReport> {
    console.log('🔍 AuthenticationDebugger: Starting full system diagnostic...')

    const report: AuthSystemReport = {
      timestamp: new Date().toISOString(),
      overallHealth: 'healthy',
      usersChecked: 0,
      issuesFound: 0,
      fixesApplied: 0,
      userReports: [],
      systemIssues: [],
      recommendations: []
    }

    try {
      // Load all system users
      const usersResponse = await userManagementService.loadSystemUsers()
      if (usersResponse.status === 'error') {
        report.systemIssues.push(`Failed to load users: ${usersResponse.error}`)
        report.overallHealth = 'critical'
        return report
      }

      const users = usersResponse.data || []
      report.usersChecked = users.length

      // Check each user
      for (const user of users) {
        const userReport = await this.diagnoseUser(user.id, user.email)
        report.userReports.push(userReport)

        if (userReport.issues.length > 0) {
          report.issuesFound += userReport.issues.length
        }

        if (userReport.status === 'critical') {
          report.overallHealth = 'critical'
        } else if (userReport.status === 'issues_found' && report.overallHealth === 'healthy') {
          report.overallHealth = 'degraded'
        }
      }

      // Check system-wide issues
      await this.checkSystemWideIssues(report)

      // Generate recommendations
      this.generateRecommendations(report)

      console.log('🔍 AuthenticationDebugger: Diagnostic complete', report)
      return report

    } catch (error: any) {
      console.error('🔍 AuthenticationDebugger: Diagnostic failed:', error)
      report.systemIssues.push(`Diagnostic failed: ${error.message}`)
      report.overallHealth = 'critical'
      return report
    }
  }

  /**
   * Diagnose specific user authentication issues
   */
  static async diagnoseUser(userId: string, email: string): Promise<AuthDebugReport> {
    console.log(`🔍 AuthenticationDebugger: Diagnosing user ${email} (${userId})`)

    const report: AuthDebugReport = {
      userId,
      email,
      issues: [],
      fixes: [],
      status: 'healthy',
      passwordStatus: 'missing',
      credentialsFound: false,
      lockoutStatus: {
        isLocked: false,
        attempts: 0,
        canClearLockout: false
      }
    }

    try {
      // Check if credentials exist
      const credentials = await this.getStoredCredentials(userId)
      report.credentialsFound = !!credentials

      if (!credentials) {
        report.issues.push('No credentials found in storage')
        report.status = 'critical'
        return report
      }

      // Check password encryption status
      await this.checkPasswordEncryption(credentials.password, report)

      // Check lockout status
      const lockoutInfo = await userManagementService.debugLockoutStatus(userId)
      report.lockoutStatus = {
        isLocked: lockoutInfo.isCurrentlyLocked,
        attempts: lockoutInfo.loginStats.loginAttempts || 0,
        canClearLockout: lockoutInfo.isCurrentlyLocked
      }

      if (report.lockoutStatus.isLocked) {
        report.issues.push('Account is locked out')
        report.status = 'issues_found'
      }

      // Test authentication
      const testPassword = await this.tryDecryptPassword(credentials.password)
      if (testPassword) {
        const authResult = await userManagementService.authenticateUser(email, testPassword)
        if (authResult.status === 'success' && authResult.data) {
          // Authentication works
          if (report.issues.length === 0) {
            report.status = 'healthy'
          }
        } else {
          report.issues.push('Authentication test failed')
          report.status = 'critical'
        }
      }

    } catch (error: any) {
      report.issues.push(`Diagnosis failed: ${error.message}`)
      report.status = 'critical'
    }

    return report
  }

  /**
   * Fix all detected authentication issues
   */
  static async fixAllAuthenticationIssues(): Promise<{
    usersFixed: number
    issuesFixed: string[]
    errors: string[]
  }> {
    console.log('🔧 AuthenticationDebugger: Starting comprehensive fix...')

    const result = {
      usersFixed: 0,
      issuesFixed: [] as string[],
      errors: [] as string[]
    }

    try {
      // Run diagnostic first
      const diagnostic = await this.runFullSystemDiagnostic()

      // Fix double encryption issues
      const doubleEncryptionFix = await userManagementService.fixDoubleEncryptedPasswords()
      if (doubleEncryptionFix.status === 'success') {
        result.usersFixed += doubleEncryptionFix.data?.fixed || 0
        if (doubleEncryptionFix.data?.fixed) {
          result.issuesFixed.push(`Fixed double-encrypted passwords for ${doubleEncryptionFix.data.fixed} users`)
        }
        result.errors.push(...(doubleEncryptionFix.data?.errors || []))
      }

      // Fix lockout issues for critical users
      for (const userReport of diagnostic.userReports) {
        if (userReport.lockoutStatus.isLocked && userReport.lockoutStatus.canClearLockout) {
          const clearResult = await userManagementService.clearAccountLockout(userReport.userId)
          if (clearResult.status === 'success') {
            result.issuesFixed.push(`Cleared lockout for ${userReport.email}`)
          } else {
            result.errors.push(`Failed to clear lockout for ${userReport.email}: ${clearResult.error}`)
          }
        }
      }

      // Fix missing credentials for demo users
      await this.fixDemoUserCredentials(result)

      console.log('🔧 AuthenticationDebugger: Fix complete', result)
      return result

    } catch (error: any) {
      console.error('🔧 AuthenticationDebugger: Fix failed:', error)
      result.errors.push(`Fix process failed: ${error.message}`)
      return result
    }
  }

  /**
   * Test authentication for specific user with detailed logging
   */
  static async testUserAuthentication(email: string, password: string): Promise<{
    success: boolean
    details: string[]
    recommendations: string[]
  }> {
    console.log(`🧪 AuthenticationDebugger: Testing authentication for ${email}`)

    const result = {
      success: false,
      details: [] as string[],
      recommendations: [] as string[]
    }

    try {
      // Step 1: Check if user exists
      const userResponse = await userProfileService.getUserByEmail(email)
      if (userResponse.status === 'error' || !userResponse.data) {
        result.details.push(`❌ User not found: ${email}`)
        result.recommendations.push('Create the user account first')
        return result
      }

      const user = userResponse.data
      result.details.push(`✅ User found: ${user.name} (${user.id})`)

      // Step 2: Check lockout status
      const lockoutInfo = await userManagementService.debugLockoutStatus(user.id)
      result.details.push(`Lockout status: ${lockoutInfo.isCurrentlyLocked ? 'LOCKED' : 'UNLOCKED'}`)
      result.details.push(`Login attempts: ${lockoutInfo.loginStats.loginAttempts || 0}`)

      if (lockoutInfo.isCurrentlyLocked) {
        result.details.push('❌ Account is locked')
        result.recommendations.push('Clear account lockout before testing')
      }

      // Step 3: Check stored credentials
      const credentials = await this.getStoredCredentials(user.id)
      if (!credentials) {
        result.details.push('❌ No credentials found in storage')
        result.recommendations.push('Reset user password to create new credentials')
        return result
      }

      result.details.push('✅ Credentials found in storage')

      // Step 4: Test password decryption
      const decryptedPassword = await this.tryDecryptPassword(credentials.password)
      if (!decryptedPassword) {
        result.details.push('❌ Failed to decrypt stored password')
        result.recommendations.push('Password may be corrupted - reset password')
        return result
      }

      result.details.push('✅ Password decryption successful')
      result.details.push(`Stored password matches input: ${decryptedPassword === password}`)

      // Step 5: Attempt authentication
      const authResult = await userManagementService.authenticateUser(email, password)
      if (authResult.status === 'success' && authResult.data) {
        result.success = true
        result.details.push('✅ Authentication successful!')
      } else {
        result.details.push(`❌ Authentication failed: ${authResult.error || 'Unknown error'}`)
        result.recommendations.push('Check password and clear any lockouts')
      }

    } catch (error: any) {
      result.details.push(`❌ Test failed: ${error.message}`)
      result.recommendations.push('Check system logs for detailed error information')
    }

    return result
  }

  /**
   * Reset user password with comprehensive validation
   */
  static async resetUserPassword(userId: string, newPassword: string): Promise<{
    success: boolean
    details: string[]
  }> {
    console.log(`🔄 AuthenticationDebugger: Resetting password for user ${userId}`)

    const result = {
      success: false,
      details: [] as string[]
    }

    try {
      // Validate password strength
      if (newPassword.length < 8) {
        result.details.push('❌ Password must be at least 8 characters long')
        return result
      }

      // Clear any existing lockouts first
      const clearResult = await userManagementService.clearAccountLockout(userId)
      if (clearResult.status === 'success') {
        result.details.push('✅ Cleared existing lockouts')
      }

      // Change the password
      const changeResult = await userManagementService.changeUserPassword(userId, newPassword)
      if (changeResult.status === 'success') {
        result.success = true
        result.details.push('✅ Password reset successful')
        result.details.push('✅ New credentials saved and encrypted')
      } else {
        result.details.push(`❌ Password reset failed: ${changeResult.error}`)
      }

    } catch (error: any) {
      result.details.push(`❌ Password reset failed: ${error.message}`)
    }

    return result
  }

  /**
   * Private helper methods
   */
  private static async getStoredCredentials(userId: string): Promise<any> {
    try {
      // Import supabase directly since it's not exposed on userManagementService
      const { supabase } = await import('@/config/supabase')

      const { data } = await supabase
        .from('user_profiles')
        .select('encrypted_retell_api_key')
        .eq('user_id', userId)
        .single()

      if (data?.encrypted_retell_api_key) {
        const decrypted = await encryptionService.decryptString(data.encrypted_retell_api_key)
        return JSON.parse(decrypted)
      }
    } catch (error) {
      console.log('Supabase lookup failed, trying localStorage...')
    }

    // Fallback to localStorage
    try {
      const encryptedCredentials = localStorage.getItem(`userCredentials_${userId}`)
      if (encryptedCredentials) {
        const decrypted = await encryptionService.decryptString(encryptedCredentials)
        return JSON.parse(decrypted)
      }
    } catch (error) {
      console.error('Failed to get stored credentials:', error)
    }

    return null
  }

  private static async tryDecryptPassword(encryptedPassword: string): Promise<string | null> {
    try {
      return await encryptionService.decryptString(encryptedPassword)
    } catch (error) {
      console.error('Failed to decrypt password:', error)
      return null
    }
  }

  private static async checkPasswordEncryption(encryptedPassword: string, report: AuthDebugReport): Promise<void> {
    try {
      // Try to decrypt once
      const onceDecrypted = await encryptionService.decryptString(encryptedPassword)

      try {
        // Try to decrypt again to check for double encryption
        await encryptionService.decryptString(onceDecrypted)
        report.issues.push('Password is double-encrypted')
        report.passwordStatus = 'double_encrypted'
        report.status = 'issues_found'
      } catch {
        // Single encryption is correct
        report.passwordStatus = 'working'
      }
    } catch (error) {
      report.issues.push('Password decryption failed - may be corrupted')
      report.passwordStatus = 'corrupted'
      report.status = 'critical'
    }
  }

  private static async checkSystemWideIssues(report: AuthSystemReport): Promise<void> {
    // Check for encryption service health
    try {
      const encryptionTest = await encryptionService.testEncryption()
      if (!encryptionTest) {
        report.systemIssues.push('Encryption service is not working properly')
      }
    } catch (error) {
      report.systemIssues.push('Failed to test encryption service')
    }

    // Check for localStorage health
    try {
      localStorage.setItem('auth_test', 'test')
      localStorage.removeItem('auth_test')
    } catch (error) {
      report.systemIssues.push('localStorage is not accessible')
    }
  }

  private static generateRecommendations(report: AuthSystemReport): void {
    if (report.issuesFound === 0) {
      report.recommendations.push('Authentication system is healthy!')
      return
    }

    report.recommendations.push('Run the comprehensive fix to resolve identified issues')

    const criticalUsers = report.userReports.filter(u => u.status === 'critical')
    if (criticalUsers.length > 0) {
      report.recommendations.push(`${criticalUsers.length} users have critical authentication issues and need immediate attention`)
    }

    const lockedUsers = report.userReports.filter(u => u.lockoutStatus.isLocked)
    if (lockedUsers.length > 0) {
      report.recommendations.push(`${lockedUsers.length} users are locked out and need lockout clearance`)
    }

    const doubleEncryptedUsers = report.userReports.filter(u => u.passwordStatus === 'double_encrypted')
    if (doubleEncryptedUsers.length > 0) {
      report.recommendations.push(`${doubleEncryptedUsers.length} users have double-encrypted passwords that need fixing`)
    }
  }

  private static async fixDemoUserCredentials(result: any): Promise<void> {
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
          const credentials = await this.getStoredCredentials(actualUserId)
          if (!credentials) {
            console.log(`🔧 Creating missing credentials for ${userConfig.email} (${actualUserId})`)
            const resetResult = await this.resetUserPassword(actualUserId, userConfig.password)
            if (resetResult.success) {
              result.issuesFixed.push(`Created missing credentials for ${userConfig.email} (${actualUserId})`)
            } else {
              result.errors.push(`Failed to create credentials for ${userConfig.email} (${actualUserId})`)
            }
          }
        } else {
          result.errors.push(`User ${userConfig.email} not found in system`)
        }
      } catch (error: any) {
        result.errors.push(`Error fixing demo user ${userConfig.email}: ${error.message}`)
      }
    }
  }
}

// Export debugging functions for console access
if (typeof window !== 'undefined') {
  (window as any).authDebugger = {
    runDiagnostic: () => AuthenticationDebugger.runFullSystemDiagnostic(),
    fixAll: () => AuthenticationDebugger.fixAllAuthenticationIssues(),
    testUser: (email: string, password: string) =>
      AuthenticationDebugger.testUserAuthentication(email, password),
    resetPassword: (userId: string, password: string) =>
      AuthenticationDebugger.resetUserPassword(userId, password),
    diagnosePierre: () =>
      AuthenticationDebugger.testUserAuthentication('pierre@phaetonai.com', 'Pierre123!'),
    resetPierre: async () => {
      // Dynamically resolve Pierre's user ID
      const userResponse = await userProfileService.getUserByEmail('pierre@phaetonai.com')
      if (userResponse.status === 'success' && userResponse.data) {
        return AuthenticationDebugger.resetUserPassword(userResponse.data.id, 'Pierre123!')
      } else {
        return { success: false, details: ['Pierre user not found'] }
      }
    }
  }
}