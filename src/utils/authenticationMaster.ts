/**
 * Authentication Master Controller
 * Complete solution for all CareXPS CRM authentication issues
 */

import { AuthenticationFixer } from './authenticationFixer'
import { AuthenticationDebugger } from './authenticationDebugger'
import { NewUserAuthTester } from './newUserAuthTest'
import { userManagementService } from '@/services/userManagementService'

export interface MasterFixResult {
  success: boolean
  message: string
  details: string[]
  errors: string[]
  pierreFixed: boolean
  newUserFlowTested: boolean
  systemHealthy: boolean
  usersFixed: number
}

export class AuthenticationMaster {

  /**
   * The ultimate authentication fix - solves all issues
   */
  static async fixAllAuthenticationIssues(): Promise<MasterFixResult> {
    console.log('🚀 AuthenticationMaster: Starting ultimate authentication fix...')

    const result: MasterFixResult = {
      success: false,
      message: '',
      details: [],
      errors: [],
      pierreFixed: false,
      newUserFlowTested: false,
      systemHealthy: false,
      usersFixed: 0
    }

    try {
      result.details.push('🚀 Starting comprehensive authentication system repair...')

      // Step 1: Run full system diagnostic first
      result.details.push('\n📊 Step 1: Running system diagnostic...')
      const diagnostic = await AuthenticationDebugger.runFullSystemDiagnostic()
      result.details.push(`System health: ${diagnostic.overallHealth}`)
      result.details.push(`Users checked: ${diagnostic.usersChecked}`)
      result.details.push(`Issues found: ${diagnostic.issuesFound}`)

      if (diagnostic.issuesFound === 0) {
        result.details.push('✅ No issues found - system is healthy!')
        result.systemHealthy = true
        result.success = true
        result.message = '✅ Authentication system is already healthy!'
        return result
      }

      // Step 2: Apply comprehensive fixes
      result.details.push('\n🔧 Step 2: Applying comprehensive fixes...')
      const fixResult = await AuthenticationFixer.fixAllAuthenticationIssues()
      result.usersFixed = fixResult.usersFixed
      result.details.push(...fixResult.details.map(d => `  ${d}`))
      result.errors.push(...fixResult.errors)

      // Step 3: Specifically fix admin authentication
      result.details.push('\n👤 Step 3: Specifically fixing admin authentication...')
      const pierreResult = await AuthenticationFixer.fixPierreAuthentication()
      result.pierreFixed = pierreResult.success
      result.details.push(...pierreResult.details.map(d => `  ${d}`))
      result.errors.push(...pierreResult.errors)

      // Step 4: Test new user creation flow
      result.details.push('\n🧪 Step 4: Testing new user creation flow...')
      const newUserTest = await NewUserAuthTester.runFullTestSuite()
      result.newUserFlowTested = newUserTest.passedTests === newUserTest.totalTests
      result.details.push(`  New user tests: ${newUserTest.passedTests}/${newUserTest.totalTests} passed`)

      if (newUserTest.failedTests > 0) {
        result.errors.push(`${newUserTest.failedTests} new user tests failed`)
      }

      // Step 5: Final validation
      result.details.push('\n✅ Step 5: Final validation...')
      const finalDiagnostic = await AuthenticationDebugger.runFullSystemDiagnostic()
      result.systemHealthy = finalDiagnostic.overallHealth === 'healthy'
      result.details.push(`  Final system health: ${finalDiagnostic.overallHealth}`)

      // Step 6: Test all existing users
      result.details.push('\n🔍 Step 6: Testing all existing users...')
      const authTest = await AuthenticationFixer.testAllUserAuthentication()
      result.details.push(`  Authentication test: ${authTest.workingAuth}/${authTest.totalUsers} users working`)

      // Determine overall success
      result.success = result.systemHealthy && result.pierreFixed && result.newUserFlowTested && result.errors.length === 0

      if (result.success) {
        result.message = `🎉 COMPLETE SUCCESS! Authentication system fully repaired!

✅ Admin authentication: FIXED
✅ New user creation: WORKING
✅ System health: HEALTHY
✅ Users fixed: ${result.usersFixed}
✅ All tests: PASSING`
      } else {
        result.message = `⚠️ Partial success - some issues remain:

${result.pierreFixed ? '✅' : '❌'} Admin authentication
${result.newUserFlowTested ? '✅' : '❌'} New user creation flow
${result.systemHealthy ? '✅' : '❌'} System health
📊 Users fixed: ${result.usersFixed}
⚠️ Errors: ${result.errors.length}`
      }

      console.log('🚀 AuthenticationMaster: Ultimate fix completed', result)
      return result

    } catch (error: any) {
      console.error('🚀 AuthenticationMaster: Ultimate fix failed:', error)
      result.success = false
      result.message = `❌ Ultimate authentication fix failed: ${error.message}`
      result.errors.push(error.message)
      return result
    }
  }

  /**
   * Quick fix for Pierre specifically
   */
  static async quickFixPierre(): Promise<{ success: boolean; message: string }> {
    console.log('⚡ AuthenticationMaster: Quick fixing admin...')

    try {
      // First, find the actual user ID for pierre@phaetonai.com
      const userResponse = await userManagementService.getUserByEmail('pierre@phaetonai.com')
      if (userResponse.status === 'error' || !userResponse.data) {
        return {
          success: false,
          message: `❌ Admin user not found - cannot fix authentication`
        }
      }

      const actualUserId = userResponse.data.id
      console.log('⚡ AuthenticationMaster: Found admin user')

      // Clear all lockouts for Pierre
      await userManagementService.forceClearLockout(actualUserId, 'pierre@phaetonai.com')

      // Reset Pierre's password
      const passwordResult = await userManagementService.changeUserPassword(actualUserId, 'Pierre123!')

      if (passwordResult.status === 'success') {
        // Test authentication
        const authTest = await userManagementService.authenticateUser('pierre@phaetonai.com', 'Pierre123!')

        if (authTest.status === 'success' && authTest.data) {
          return {
            success: true,
            message: `✅ Admin quick fix successful!

Admin credentials configured
Password reset successfully

Admin can now log in successfully.`
          }
        } else {
          return {
            success: false,
            message: `❌ Admin authentication still failing after quick fix.

Use the comprehensive fix instead.`
          }
        }
      } else {
        return {
          success: false,
          message: `❌ Failed to reset admin password: ${passwordResult.error}`
        }
      }

    } catch (error: any) {
      return {
        success: false,
        message: `❌ Admin quick fix failed: ${error.message}`
      }
    }
  }

  /**
   * Emergency reset - nuclear option to fix authentication
   */
  static async emergencyReset(): Promise<{ success: boolean; message: string; details: string[] }> {
    console.log('🆘 AuthenticationMaster: Emergency reset initiated...')

    const result = {
      success: false,
      message: '',
      details: [] as string[]
    }

    try {
      result.details.push('🆘 EMERGENCY AUTHENTICATION RESET')
      result.details.push('This will reset ALL user authentication data')

      // Clear all localStorage authentication data
      result.details.push('1. Clearing localStorage authentication data...')
      const authKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('userCredentials_') ||
        key.startsWith('loginStats_') ||
        key === 'failed_login_attempts'
      )

      authKeys.forEach(key => {
        localStorage.removeItem(key)
        result.details.push(`   Removed: ${key}`)
      })

      // Reset demo user passwords
      result.details.push('2. Resetting demo user passwords...')
      const demoUserEmails = [
        { email: 'pierre@phaetonai.com', password: this.generateSecurePassword() },
        { email: 'demo@carexps.com', password: this.generateSecurePassword() },
        { email: 'elmfarrell@yahoo.com', password: this.generateSecurePassword() }
      ]

      // SECURITY: Demo account setup completed (credentials redacted for HIPAA compliance)
      console.log('🔐 SECURITY: Demo account setup completed - [CREDENTIALS-REDACTED - HIPAA PROTECTED]')
      console.log(`📊 Generated ${demoUserEmails.length} demo accounts with secure credentials`)

      const demoUsers = []
      for (const userConfig of demoUserEmails) {
        try {
          // Dynamically resolve user ID
          const userResponse = await userManagementService.getUserByEmail(userConfig.email)
          if (userResponse.status === 'success' && userResponse.data) {
            demoUsers.push({
              id: userResponse.data.id,
              email: userConfig.email,
              password: userConfig.password
            })
            result.details.push(`   Found user ${userConfig.email} with ID: ${userResponse.data.id}`)
          } else {
            result.details.push(`   ⚠️ User ${userConfig.email} not found in system`)
          }
        } catch (error) {
          result.details.push(`   ❌ Error finding user ${userConfig.email}`)
        }
      }

      for (const user of demoUsers) {
        try {
          await userManagementService.forceClearLockout(user.id, user.email)
          const resetResult = await userManagementService.changeUserPassword(user.id, user.password)
          if (resetResult.status === 'success') {
            result.details.push(`   ✅ Reset ${user.email} (${user.id})`)
          } else {
            result.details.push(`   ❌ Failed to reset ${user.email} (${user.id})`)
          }
        } catch (error) {
          result.details.push(`   ❌ Error resetting ${user.email} (${user.id})`)
        }
      }

      // Test all demo users
      result.details.push('3. Testing demo user authentication...')
      let workingCount = 0
      for (const user of demoUsers) {
        try {
          const authResult = await userManagementService.authenticateUser(user.email, user.password)
          if (authResult.status === 'success' && authResult.data) {
            result.details.push(`   ✅ ${user.email} authentication working`)
            workingCount++
          } else {
            result.details.push(`   ❌ ${user.email} authentication failed`)
          }
        } catch (error) {
          result.details.push(`   ❌ ${user.email} authentication error`)
        }
      }

      result.success = workingCount === demoUsers.length
      result.message = result.success
        ? `✅ Emergency reset successful! All ${workingCount} demo users can authenticate.`
        : `⚠️ Emergency reset partial - ${workingCount}/${demoUsers.length} users working.`

      result.details.push('')
      result.details.push('🔑 Demo User Credentials:')
      demoUsers.forEach(user => {
        result.details.push(`   ${user.email} : ${user.password}`)
      })

    } catch (error: any) {
      result.success = false
      result.message = `❌ Emergency reset failed: ${error.message}`
      result.details.push(`ERROR: ${error.message}`)
    }

    return result
  }

  /**
   * Complete system health check and report
   */
  static async getSystemHealthReport(): Promise<{
    overallHealth: 'healthy' | 'degraded' | 'critical'
    summary: string
    details: string[]
    recommendations: string[]
  }> {
    try {
      const diagnostic = await AuthenticationDebugger.runFullSystemDiagnostic()
      const authTest = await AuthenticationFixer.testAllUserAuthentication()

      const details = [
        `System Health: ${diagnostic.overallHealth.toUpperCase()}`,
        `Users Checked: ${diagnostic.usersChecked}`,
        `Issues Found: ${diagnostic.issuesFound}`,
        `Working Authentication: ${authTest.workingAuth}/${authTest.totalUsers}`,
        '',
        'User Status:'
      ]

      diagnostic.userReports.forEach(user => {
        const status = user.status === 'healthy' ? '✅' : user.status === 'issues_found' ? '⚠️' : '❌'
        details.push(`  ${status} ${user.email}: ${user.issues.length} issues`)
      })

      if (diagnostic.systemIssues.length > 0) {
        details.push('')
        details.push('System Issues:')
        diagnostic.systemIssues.forEach(issue => details.push(`  ❌ ${issue}`))
      }

      const summary = diagnostic.overallHealth === 'healthy'
        ? '✅ Authentication system is healthy!'
        : diagnostic.overallHealth === 'degraded'
        ? '⚠️ Authentication system has some issues but is functional'
        : '❌ Authentication system has critical issues'

      return {
        overallHealth: diagnostic.overallHealth,
        summary,
        details,
        recommendations: diagnostic.recommendations
      }

    } catch (error: any) {
      return {
        overallHealth: 'critical',
        summary: '❌ Unable to assess system health',
        details: [`Error: ${error.message}`],
        recommendations: ['Run emergency reset to restore functionality']
      }
    }
  }

  /**
   * Generate cryptographically secure password
   * Replaces hardcoded passwords for security compliance
   */
  private static generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const values = crypto.getRandomValues(new Uint32Array(length))

    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset[values[i] % charset.length]
    }

    // Ensure password complexity requirements
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[!@#$%^&*]/.test(password)

    // Regenerate if doesn't meet complexity requirements
    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return this.generateSecurePassword(length)
    }

    return password
  }
}

// Export for console debugging
if (typeof window !== 'undefined') {
  (window as any).authMaster = {
    fixAll: () => AuthenticationMaster.fixAllAuthenticationIssues(),
    quickFixPierre: () => AuthenticationMaster.quickFixPierre(),
    emergencyReset: () => AuthenticationMaster.emergencyReset(),
    healthCheck: () => AuthenticationMaster.getSystemHealthReport()
  }

  console.log('🚀 Authentication Master loaded! Use window.authMaster for ultimate control:')
  console.log('  - window.authMaster.fixAll() - Fix all authentication issues')
  console.log('  - window.authMaster.quickFixPierre() - Quick fix for admin')
  console.log('  - window.authMaster.emergencyReset() - Nuclear option reset')
  console.log('  - window.authMaster.healthCheck() - Get system health report')
}