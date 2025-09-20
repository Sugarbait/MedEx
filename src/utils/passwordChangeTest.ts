/**
 * Password Change Security Test
 * This test verifies that old passwords are completely invalidated after password changes
 */

import { userManagementService } from '@/services/userManagementService'

export interface PasswordChangeTestResult {
  success: boolean
  testName: string
  details: string[]
  errors: string[]
  userId?: string
  email?: string
}

export class PasswordChangeSecurityTester {

  /**
   * Test the critical password change security issue (Test #6)
   */
  static async testPasswordChangeInvalidation(): Promise<PasswordChangeTestResult> {
    const result: PasswordChangeTestResult = {
      testName: 'Password Change Security Test (Test #6)',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `pwsec.${Date.now()}@carexps.com`
      const oldPassword = 'OldPassword123!'
      const newPassword = 'NewPassword456!'

      result.details.push(`Testing password change security for: ${testEmail}`)

      // STEP 1: Create test user
      const userData = {
        email: testEmail,
        name: 'Password Security Test User',
        role: 'user' as const,
        mfa_enabled: false,
        settings: { theme: 'light', notifications: {} }
      }

      const credentials = {
        email: testEmail,
        password: oldPassword,
        tempPassword: false
      }

      const createResponse = await userManagementService.createSystemUser(userData, credentials)

      if (createResponse.status !== 'success' || !createResponse.data) {
        result.errors.push('Failed to create test user')
        return result
      }

      result.userId = createResponse.data.id
      result.email = testEmail
      result.details.push('✅ Test user created successfully')

      // STEP 2: Verify initial authentication with old password
      const auth1 = await userManagementService.authenticateUser(testEmail, oldPassword)
      if (auth1.status !== 'success' || !auth1.data) {
        result.errors.push('Initial authentication with old password failed')
        await PasswordChangeSecurityTester.cleanupTestUser(createResponse.data.id)
        return result
      }
      result.details.push('✅ Initial authentication with old password successful')

      // STEP 3: Change password
      const changeResult = await userManagementService.changeUserPassword(createResponse.data.id, newPassword)
      if (changeResult.status !== 'success') {
        result.errors.push(`Password change failed: ${changeResult.error}`)
        await PasswordChangeSecurityTester.cleanupTestUser(createResponse.data.id)
        return result
      }
      result.details.push('✅ Password changed successfully')

      // STEP 4: Verify authentication with new password works
      const auth2 = await userManagementService.authenticateUser(testEmail, newPassword)
      if (auth2.status !== 'success' || !auth2.data) {
        result.errors.push('Authentication with new password failed')
        await PasswordChangeSecurityTester.cleanupTestUser(createResponse.data.id)
        return result
      }
      result.details.push('✅ Authentication with new password successful')

      // STEP 5: CRITICAL TEST - Verify old password no longer works
      const auth3 = await userManagementService.authenticateUser(testEmail, oldPassword)
      if (auth3.status === 'success' && auth3.data) {
        result.errors.push('🚨 CRITICAL SECURITY ISSUE: Old password still works after password change!')
        result.details.push('❌ Old password authentication should have failed but succeeded')
        await PasswordChangeSecurityTester.cleanupTestUser(createResponse.data.id)
        return result
      } else {
        result.details.push('✅ SECURITY VERIFIED: Old password correctly rejected')
      }

      // STEP 6: Double-check with a slight delay to ensure async operations complete
      await new Promise(resolve => setTimeout(resolve, 100))
      const auth4 = await userManagementService.authenticateUser(testEmail, oldPassword)
      if (auth4.status === 'success' && auth4.data) {
        result.errors.push('🚨 CRITICAL SECURITY ISSUE: Old password still works after password change (delayed test)!')
        result.details.push('❌ Old password authentication should have failed but succeeded (delayed test)')
        await PasswordChangeSecurityTester.cleanupTestUser(createResponse.data.id)
        return result
      } else {
        result.details.push('✅ SECURITY VERIFIED: Old password correctly rejected (delayed test)')
      }

      // STEP 7: Final verification with new password still works
      const auth5 = await userManagementService.authenticateUser(testEmail, newPassword)
      if (auth5.status !== 'success' || !auth5.data) {
        result.errors.push('New password stopped working after delay')
        await PasswordChangeSecurityTester.cleanupTestUser(createResponse.data.id)
        return result
      }
      result.details.push('✅ New password still works correctly')

      // All tests passed
      result.success = true
      result.details.push('🎉 Password change security test PASSED - old passwords properly invalidated')

      // Cleanup
      await PasswordChangeSecurityTester.cleanupTestUser(createResponse.data.id)
      result.details.push('✅ Test user cleaned up')

    } catch (error: any) {
      result.errors.push(`Test failed with exception: ${error.message}`)
      if (result.userId) {
        await PasswordChangeSecurityTester.cleanupTestUser(result.userId)
      }
    }

    return result
  }

  /**
   * Run all password change security tests
   */
  static async runAllTests(): Promise<PasswordChangeTestResult[]> {
    console.log('🔐 Starting Password Change Security Tests...')

    const results: PasswordChangeTestResult[] = []

    // Test the main password change invalidation
    results.push(await this.testPasswordChangeInvalidation())

    return results
  }

  /**
   * Display test results
   */
  static displayResults(results: PasswordChangeTestResult[]): void {
    console.log('\n🔐 PASSWORD CHANGE SECURITY TEST RESULTS 🔐')
    console.log('='.repeat(60))

    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.testName}`)
      console.log(`   Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`)

      if (result.details.length > 0) {
        console.log('   Details:')
        result.details.forEach(detail => console.log(`     ${detail}`))
      }

      if (result.errors.length > 0) {
        console.log('   Errors:')
        result.errors.forEach(error => console.log(`     🚨 ${error}`))
      }
    })

    const passedTests = results.filter(r => r.success).length
    const failedTests = results.filter(r => !r.success).length

    console.log('\n' + '='.repeat(60))
    console.log(`SUMMARY: ${passedTests}/${results.length} tests passed`)

    if (failedTests === 0) {
      console.log('🎉 ALL PASSWORD SECURITY TESTS PASSED!')
    } else {
      console.log('🚨 SECURITY ISSUES FOUND - PLEASE FIX IMMEDIATELY!')
    }

    // Show alert
    const alertMessage = `Password Change Security Test Results:

${results.map(r => `${r.success ? '✅' : '❌'} ${r.testName}`).join('\n')}

Summary: ${passedTests}/${results.length} tests passed

${failedTests === 0 ? '🎉 All security tests passed!' : '🚨 Security issues found!'}

Check console for detailed results.`

    alert(alertMessage)
  }

  /**
   * Helper method to clean up test users
   */
  private static async cleanupTestUser(userId: string): Promise<void> {
    try {
      await userManagementService.deleteSystemUser(userId)
    } catch (error) {
      console.log(`Failed to cleanup test user ${userId}:`, error)
    }
  }
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).passwordChangeTest = {
    runTest: () => PasswordChangeSecurityTester.testPasswordChangeInvalidation(),
    runAllTests: () => PasswordChangeSecurityTester.runAllTests(),
    displayResults: (results: PasswordChangeTestResult[]) => PasswordChangeSecurityTester.displayResults(results)
  }

  console.log('🔐 Password Change Security Tester loaded!')
  console.log('Use window.passwordChangeTest.runTest() to test password change security')
}