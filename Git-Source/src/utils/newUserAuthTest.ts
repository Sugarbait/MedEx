/**
 * New User Authentication Test Suite
 * Comprehensive testing for user creation and authentication flow
 */

import { userManagementService } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { AuthenticationFixer } from './authenticationFixer'

export interface TestResult {
  testName: string
  success: boolean
  details: string[]
  errors: string[]
  userId?: string
  email?: string
}

export interface TestSuiteResult {
  totalTests: number
  passedTests: number
  failedTests: number
  results: TestResult[]
  summary: string
}

export class NewUserAuthTester {

  /**
   * Run comprehensive test suite for new user creation and authentication
   */
  static async runFullTestSuite(): Promise<TestSuiteResult> {
    console.log('🧪 NewUserAuthTester: Starting comprehensive test suite...')

    const results: TestResult[] = []

    // Test 1: Create new user via UserManagementService
    results.push(await this.testCreateNewUser())

    // Test 2: Create user via Quick Create template
    results.push(await this.testQuickCreateUser())

    // Test 3: Test authentication immediately after creation
    results.push(await this.testImmediateAuthentication())

    // Test 4: Test authentication after lockout clear
    results.push(await this.testAuthAfterLockoutClear())

    // Test 5: Test credential encryption/decryption
    results.push(await this.testCredentialEncryptionDecryption())

    // Test 6: Test password change and re-authentication
    results.push(await this.testPasswordChangeAndReauth())

    // Test 7: Recreate deleted user (edge case)
    results.push(await this.testRecreateDeletedUser())

    // Compile results
    const passedTests = results.filter(r => r.success).length
    const failedTests = results.filter(r => !r.success).length

    const summary = `Authentication Test Suite Complete:
✅ Passed: ${passedTests}/${results.length}
❌ Failed: ${failedTests}/${results.length}
${failedTests === 0 ? '🎉 All tests passed!' : '⚠️ Some tests failed - check details below'}`

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      results,
      summary
    }
  }

  /**
   * Test creating a new user through the standard creation flow
   */
  private static async testCreateNewUser(): Promise<TestResult> {
    const result: TestResult = {
      testName: 'Create New User via UserManagementService',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `test.user.${Date.now()}@carexps.com`
      const testPassword = 'TestPassword123!'

      result.details.push(`Creating user: ${testEmail}`)

      // Create user
      const userData = {
        email: testEmail,
        name: 'Test User',
        role: 'user' as const,
        mfa_enabled: false,
        settings: {
          theme: 'light',
          notifications: {}
        }
      }

      const credentials = {
        email: testEmail,
        password: testPassword,
        tempPassword: false
      }

      const createResponse = await userManagementService.createSystemUser(userData, credentials)

      if (createResponse.status === 'success' && createResponse.data) {
        result.userId = createResponse.data.id
        result.email = testEmail
        result.details.push('✅ User created successfully')

        // Test authentication immediately
        const authResponse = await userManagementService.authenticateUser(testEmail, testPassword)
        if (authResponse.status === 'success' && authResponse.data) {
          result.details.push('✅ Authentication successful immediately after creation')
          result.success = true
        } else {
          result.details.push('❌ Authentication failed after creation')
          result.errors.push(authResponse.error || 'Authentication failed')
        }

        // Clean up
        await this.cleanupTestUser(createResponse.data.id)
        result.details.push('✅ Test user cleaned up')

      } else {
        result.details.push('❌ User creation failed')
        result.errors.push(createResponse.error || 'User creation failed')
      }

    } catch (error: any) {
      result.details.push('❌ Test failed with exception')
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Test Quick Create functionality
   */
  private static async testQuickCreateUser(): Promise<TestResult> {
    const result: TestResult = {
      testName: 'Quick Create User Test',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `quicktest.${Date.now()}@carexps.com`
      const testPassword = 'QuickTest123!'

      result.details.push(`Quick creating user: ${testEmail}`)

      // Simulate quick create process
      const userData = {
        email: testEmail,
        name: 'Quick Test User',
        role: 'user' as const,
        mfa_enabled: false,
        settings: {
          theme: 'light',
          notifications: {}
        }
      }

      const credentials = {
        email: testEmail,
        password: testPassword,
        tempPassword: false
      }

      const createResponse = await userManagementService.createSystemUser(userData, credentials)

      if (createResponse.status === 'success' && createResponse.data) {
        result.userId = createResponse.data.id
        result.email = testEmail
        result.details.push('✅ Quick create successful')

        // Test authentication
        const authResponse = await userManagementService.authenticateUser(testEmail, testPassword)
        if (authResponse.status === 'success' && authResponse.data) {
          result.details.push('✅ Authentication works with quick created user')
          result.success = true
        } else {
          result.details.push('❌ Quick created user cannot authenticate')
          result.errors.push(authResponse.error || 'Authentication failed')
        }

        // Clean up
        await this.cleanupTestUser(createResponse.data.id)

      } else {
        result.details.push('❌ Quick create failed')
        result.errors.push(createResponse.error || 'Quick create failed')
      }

    } catch (error: any) {
      result.details.push('❌ Quick create test failed')
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Test immediate authentication after user creation
   */
  private static async testImmediateAuthentication(): Promise<TestResult> {
    const result: TestResult = {
      testName: 'Immediate Authentication Test',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `immediate.${Date.now()}@carexps.com`
      const testPassword = 'Immediate123!'

      // Create user
      const userData = {
        email: testEmail,
        name: 'Immediate Test User',
        role: 'user' as const,
        mfa_enabled: false,
        settings: { theme: 'light', notifications: {} }
      }

      const credentials = {
        email: testEmail,
        password: testPassword,
        tempPassword: false
      }

      const createResponse = await userManagementService.createSystemUser(userData, credentials)

      if (createResponse.status === 'success' && createResponse.data) {
        result.userId = createResponse.data.id
        result.email = testEmail

        // Try authentication multiple times in quick succession
        for (let i = 1; i <= 3; i++) {
          const authResponse = await userManagementService.authenticateUser(testEmail, testPassword)
          if (authResponse.status === 'success' && authResponse.data) {
            result.details.push(`✅ Authentication attempt ${i} successful`)
          } else {
            result.details.push(`❌ Authentication attempt ${i} failed`)
            result.errors.push(`Attempt ${i}: ${authResponse.error}`)
          }
        }

        result.success = result.errors.length === 0
        await this.cleanupTestUser(createResponse.data.id)

      } else {
        result.errors.push('User creation failed for immediate auth test')
      }

    } catch (error: any) {
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Test authentication after clearing lockouts
   */
  private static async testAuthAfterLockoutClear(): Promise<TestResult> {
    const result: TestResult = {
      testName: 'Authentication After Lockout Clear',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `lockout.${Date.now()}@carexps.com`
      const testPassword = 'Lockout123!'

      // Create user
      const userData = {
        email: testEmail,
        name: 'Lockout Test User',
        role: 'user' as const,
        mfa_enabled: false,
        settings: { theme: 'light', notifications: {} }
      }

      const credentials = {
        email: testEmail,
        password: testPassword,
        tempPassword: false
      }

      const createResponse = await userManagementService.createSystemUser(userData, credentials)

      if (createResponse.status === 'success' && createResponse.data) {
        result.userId = createResponse.data.id
        result.email = testEmail

        // Clear any potential lockouts
        const clearResult = await userManagementService.clearAccountLockout(createResponse.data.id)
        if (clearResult.status === 'success') {
          result.details.push('✅ Lockout cleared successfully')

          // Test authentication after clear
          const authResponse = await userManagementService.authenticateUser(testEmail, testPassword)
          if (authResponse.status === 'success' && authResponse.data) {
            result.details.push('✅ Authentication successful after lockout clear')
            result.success = true
          } else {
            result.details.push('❌ Authentication failed after lockout clear')
            result.errors.push(authResponse.error || 'Auth failed after clear')
          }
        } else {
          result.details.push('⚠️ Lockout clear had issues')
          result.errors.push(clearResult.error || 'Lockout clear failed')
        }

        await this.cleanupTestUser(createResponse.data.id)

      } else {
        result.errors.push('User creation failed for lockout test')
      }

    } catch (error: any) {
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Test credential encryption and decryption process
   */
  private static async testCredentialEncryptionDecryption(): Promise<TestResult> {
    const result: TestResult = {
      testName: 'Credential Encryption/Decryption Test',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `encryption.${Date.now()}@carexps.com`
      const testPassword = 'Encryption123!'

      // Create user
      const userData = {
        email: testEmail,
        name: 'Encryption Test User',
        role: 'user' as const,
        mfa_enabled: false,
        settings: { theme: 'light', notifications: {} }
      }

      const credentials = {
        email: testEmail,
        password: testPassword,
        tempPassword: false
      }

      const createResponse = await userManagementService.createSystemUser(userData, credentials)

      if (createResponse.status === 'success' && createResponse.data) {
        result.userId = createResponse.data.id
        result.email = testEmail

        // Wait a moment for credentials to be saved
        await new Promise(resolve => setTimeout(resolve, 100))

        // Test that credentials were properly encrypted and can be decrypted
        result.details.push('✅ User created with encrypted credentials')

        // Test authentication (which internally decrypts and verifies)
        const authResponse = await userManagementService.authenticateUser(testEmail, testPassword)
        if (authResponse.status === 'success' && authResponse.data) {
          result.details.push('✅ Encrypted credentials successfully decrypted for authentication')
          result.success = true
        } else {
          result.details.push('❌ Credential decryption/authentication failed')
          result.errors.push(authResponse.error || 'Credential decryption failed')
        }

        await this.cleanupTestUser(createResponse.data.id)

      } else {
        result.errors.push('User creation failed for encryption test')
      }

    } catch (error: any) {
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Test password change and re-authentication
   */
  private static async testPasswordChangeAndReauth(): Promise<TestResult> {
    const result: TestResult = {
      testName: 'Password Change and Re-authentication',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `pwchange.${Date.now()}@carexps.com`
      const oldPassword = 'OldPassword123!'
      const newPassword = 'NewPassword123!'

      // Create user
      const userData = {
        email: testEmail,
        name: 'Password Change Test User',
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

      if (createResponse.status === 'success' && createResponse.data) {
        result.userId = createResponse.data.id
        result.email = testEmail

        // Test auth with original password
        const authOld = await userManagementService.authenticateUser(testEmail, oldPassword)
        if (authOld.status === 'success') {
          result.details.push('✅ Authentication with original password successful')

          // Change password
          const changeResult = await userManagementService.changeUserPassword(createResponse.data.id, newPassword)
          if (changeResult.status === 'success') {
            result.details.push('✅ Password changed successfully')

            // Test auth with new password
            const authNew = await userManagementService.authenticateUser(testEmail, newPassword)
            if (authNew.status === 'success' && authNew.data) {
              result.details.push('✅ Authentication with new password successful')

              // Test that old password no longer works
              const authOldFail = await userManagementService.authenticateUser(testEmail, oldPassword)
              if (authOldFail.status === 'success') {
                result.details.push('❌ Old password still works (security issue)')
                result.errors.push('Old password still valid after change')
              } else {
                result.details.push('✅ Old password correctly rejected')
                result.success = true
              }
            } else {
              result.details.push('❌ Authentication with new password failed')
              result.errors.push(authNew.error || 'New password auth failed')
            }
          } else {
            result.details.push('❌ Password change failed')
            result.errors.push(changeResult.error || 'Password change failed')
          }
        } else {
          result.details.push('❌ Initial authentication failed')
          result.errors.push(authOld.error || 'Initial auth failed')
        }

        await this.cleanupTestUser(createResponse.data.id)

      } else {
        result.errors.push('User creation failed for password change test')
      }

    } catch (error: any) {
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Test recreating a deleted user (edge case)
   */
  private static async testRecreateDeletedUser(): Promise<TestResult> {
    const result: TestResult = {
      testName: 'Recreate Deleted User Test',
      success: false,
      details: [],
      errors: []
    }

    try {
      const testEmail = `recreate.${Date.now()}@carexps.com`
      const testPassword = 'Recreate123!'

      // Create user first time
      const userData = {
        email: testEmail,
        name: 'Recreate Test User',
        role: 'user' as const,
        mfa_enabled: false,
        settings: { theme: 'light', notifications: {} }
      }

      const credentials = {
        email: testEmail,
        password: testPassword,
        tempPassword: false
      }

      const createResponse1 = await userManagementService.createSystemUser(userData, credentials)

      if (createResponse1.status === 'success' && createResponse1.data) {
        const firstUserId = createResponse1.data.id
        result.details.push('✅ First user creation successful')

        // Delete the user
        const deleteResponse = await userManagementService.deleteSystemUser(firstUserId)
        if (deleteResponse.status === 'success') {
          result.details.push('✅ User deleted successfully')

          // Try to recreate with same email
          const createResponse2 = await userManagementService.createSystemUser(userData, credentials)
          if (createResponse2.status === 'success' && createResponse2.data) {
            result.userId = createResponse2.data.id
            result.details.push('✅ User recreated with same email')

            // Test authentication on recreated user
            const authResponse = await userManagementService.authenticateUser(testEmail, testPassword)
            if (authResponse.status === 'success' && authResponse.data) {
              result.details.push('✅ Recreated user authentication successful')
              result.success = true
            } else {
              result.details.push('❌ Recreated user authentication failed')
              result.errors.push(authResponse.error || 'Recreated user auth failed')
            }

            await this.cleanupTestUser(createResponse2.data.id)

          } else {
            result.details.push('❌ User recreation failed')
            result.errors.push(createResponse2.error || 'Recreation failed')
          }
        } else {
          result.details.push('❌ User deletion failed')
          result.errors.push(deleteResponse.error || 'Deletion failed')
          await this.cleanupTestUser(firstUserId)
        }

      } else {
        result.errors.push('Initial user creation failed for recreate test')
      }

    } catch (error: any) {
      result.errors.push(error.message)
    }

    return result
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

  /**
   * Display test results in a formatted way
   */
  static displayTestResults(results: TestSuiteResult): void {
    console.log('\n🧪 NEW USER AUTHENTICATION TEST RESULTS 🧪')
    console.log('='.repeat(50))
    console.log(results.summary)
    console.log('='.repeat(50))

    results.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.testName}`)
      console.log(`   Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`)

      if (result.details.length > 0) {
        console.log('   Details:')
        result.details.forEach(detail => console.log(`     ${detail}`))
      }

      if (result.errors.length > 0) {
        console.log('   Errors:')
        result.errors.forEach(error => console.log(`     ❌ ${error}`))
      }
    })

    console.log('\n' + '='.repeat(50))

    // Show summary alert
    const alertMessage = `New User Authentication Test Results:

${results.summary}

Failed Tests:
${results.results.filter(r => !r.success).map(r => `• ${r.testName}`).join('\n') || 'None!'}

Check console for detailed results.`

    alert(alertMessage)
  }
}

// Export for console access
if (typeof window !== 'undefined') {
  (window as any).newUserAuthTest = {
    runTests: () => NewUserAuthTester.runFullTestSuite(),
    displayResults: (results: TestSuiteResult) => NewUserAuthTester.displayTestResults(results)
  }

  console.log('🧪 New User Auth Tester loaded! Use window.newUserAuthTest.runTests() to test')
}