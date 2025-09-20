import { userProfileService } from '@/services/userProfileService'
import { userManagementService } from '@/services/userManagementService'
import { fixUserIssues } from './fixUserIssues'

export interface TestResult {
  testName: string
  passed: boolean
  details: string
}

/**
 * Test suite to validate user recreation and profile image fixes
 */
export class UserFixesTestSuite {

  /**
   * Run all tests
   */
  static async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = []

    console.log('🧪 Starting User Fixes Test Suite...')

    // Test 1: Deletion tracking
    results.push(await this.testDeletionTracking())

    // Test 2: Demo user recreation prevention
    results.push(await this.testDemoUserRecreationPrevention())

    // Test 3: Profile image persistence
    results.push(await this.testProfileImagePersistence())

    // Test 4: Comprehensive fix utility
    results.push(await this.testComprehensiveFix())

    const passedTests = results.filter(r => r.passed).length
    const totalTests = results.length

    console.log(`🧪 Test Suite Complete: ${passedTests}/${totalTests} tests passed`)

    return results
  }

  /**
   * Test deletion tracking works properly
   */
  private static async testDeletionTracking(): Promise<TestResult> {
    try {
      // Clear existing tracking
      localStorage.removeItem('deletedUsers')
      localStorage.removeItem('deletedUserEmails')

      // Create a test user
      const testUser = {
        email: 'test-deletion@carexps.com',
        name: 'Test Deletion User',
        role: 'staff' as const,
        mfa_enabled: false,
        settings: {}
      }

      const createResponse = await userManagementService.createSystemUser(testUser, {
        email: testUser.email,
        password: 'testpass123',
        tempPassword: false
      })

      if (createResponse.status !== 'success') {
        return {
          testName: 'Deletion Tracking',
          passed: false,
          details: `Failed to create test user: ${createResponse.error}`
        }
      }

      const userId = createResponse.data!.id

      // Delete the user
      const deleteResponse = await userManagementService.deleteSystemUser(userId)

      if (deleteResponse.status !== 'success') {
        return {
          testName: 'Deletion Tracking',
          passed: false,
          details: `Failed to delete test user: ${deleteResponse.error}`
        }
      }

      // Check tracking
      const deletedUsers = localStorage.getItem('deletedUsers')
      const deletedEmails = localStorage.getItem('deletedUserEmails')

      const userIdTracked = deletedUsers ? JSON.parse(deletedUsers).includes(userId) : false
      const emailTracked = deletedEmails ? JSON.parse(deletedEmails).includes(testUser.email.toLowerCase()) : false

      // Load users and ensure deleted user doesn't appear
      const usersResponse = await userProfileService.loadSystemUsers()
      const userStillExists = usersResponse.status === 'success' &&
        usersResponse.data?.some(u => u.id === userId || u.email.toLowerCase() === testUser.email.toLowerCase())

      const passed = userIdTracked && emailTracked && !userStillExists

      return {
        testName: 'Deletion Tracking',
        passed,
        details: `ID tracked: ${userIdTracked}, Email tracked: ${emailTracked}, Still exists: ${userStillExists}`
      }

    } catch (error: any) {
      return {
        testName: 'Deletion Tracking',
        passed: false,
        details: `Test error: ${error.message}`
      }
    }
  }

  /**
   * Test demo user recreation prevention
   */
  private static async testDemoUserRecreationPrevention(): Promise<TestResult> {
    try {
      // Mark demo user as deleted
      const demoUserId = 'demo-user-123'
      const demoEmail = 'demo@carexps.com'

      const deletedUsers = JSON.parse(localStorage.getItem('deletedUsers') || '[]')
      const deletedEmails = JSON.parse(localStorage.getItem('deletedUserEmails') || '[]')

      if (!deletedUsers.includes(demoUserId)) {
        deletedUsers.push(demoUserId)
      }
      if (!deletedEmails.includes(demoEmail.toLowerCase())) {
        deletedEmails.push(demoEmail.toLowerCase())
      }

      localStorage.setItem('deletedUsers', JSON.stringify(deletedUsers))
      localStorage.setItem('deletedUserEmails', JSON.stringify(deletedEmails))

      // Remove demo user from systemUsers if exists
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        const users = JSON.parse(storedUsers)
        const filteredUsers = users.filter((u: any) => u.id !== demoUserId && u.email.toLowerCase() !== demoEmail.toLowerCase())
        localStorage.setItem('systemUsers', JSON.stringify(filteredUsers))
      }

      // Load users and check demo user doesn't get re-added
      const usersResponse = await userProfileService.loadSystemUsers()

      if (usersResponse.status !== 'success') {
        return {
          testName: 'Demo User Recreation Prevention',
          passed: false,
          details: `Failed to load users: ${usersResponse.error}`
        }
      }

      const demoUserRecreated = usersResponse.data?.some(u =>
        u.id === demoUserId || u.email.toLowerCase() === demoEmail.toLowerCase()
      )

      return {
        testName: 'Demo User Recreation Prevention',
        passed: !demoUserRecreated,
        details: demoUserRecreated ? 'Demo user was recreated despite deletion tracking' : 'Demo user correctly stayed deleted'
      }

    } catch (error: any) {
      return {
        testName: 'Demo User Recreation Prevention',
        passed: false,
        details: `Test error: ${error.message}`
      }
    }
  }

  /**
   * Test profile image persistence
   */
  private static async testProfileImagePersistence(): Promise<TestResult> {
    try {
      // Create a test user
      const testUser = {
        email: 'test-avatar@carexps.com',
        name: 'Test Avatar User',
        role: 'staff' as const,
        mfa_enabled: false,
        settings: {}
      }

      const createResponse = await userManagementService.createSystemUser(testUser, {
        email: testUser.email,
        password: 'testpass123',
        tempPassword: false
      })

      if (createResponse.status !== 'success') {
        return {
          testName: 'Profile Image Persistence',
          passed: false,
          details: `Failed to create test user: ${createResponse.error}`
        }
      }

      const userId = createResponse.data!.id

      // Create a small test avatar (1x1 pixel red PNG)
      const testAvatarBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

      // Update user profile with avatar
      const profileData = {
        id: userId,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        mfa_enabled: false,
        settings: {},
        avatar: testAvatarBase64
      }

      const saveResponse = await userProfileService.saveUserProfile(profileData)

      if (saveResponse.status !== 'success') {
        return {
          testName: 'Profile Image Persistence',
          passed: false,
          details: `Failed to save profile with avatar: ${saveResponse.error}`
        }
      }

      // Reload users and check avatar persists
      const usersResponse = await userProfileService.loadSystemUsers()

      if (usersResponse.status !== 'success') {
        return {
          testName: 'Profile Image Persistence',
          passed: false,
          details: `Failed to reload users: ${usersResponse.error}`
        }
      }

      const userWithAvatar = usersResponse.data?.find(u => u.id === userId)
      const avatarPersisted = !!userWithAvatar?.avatar

      // Clean up test user
      await userManagementService.deleteSystemUser(userId)

      return {
        testName: 'Profile Image Persistence',
        passed: avatarPersisted,
        details: avatarPersisted ? 'Avatar correctly persisted after save/reload' : 'Avatar was lost after save/reload'
      }

    } catch (error: any) {
      return {
        testName: 'Profile Image Persistence',
        passed: false,
        details: `Test error: ${error.message}`
      }
    }
  }

  /**
   * Test comprehensive fix utility
   */
  private static async testComprehensiveFix(): Promise<TestResult> {
    try {
      // Run diagnostic first
      const diagnostic = await fixUserIssues.diagnosePotentialIssues()

      // Run the comprehensive fix
      const fixResult = await fixUserIssues.fixAllUserIssues()

      const hasIssues = diagnostic.userRecreationRisk || diagnostic.profileImageIssues
      const appliedFixes = fixResult.fixes.length > 0
      const hasErrors = fixResult.issues.length > 0

      return {
        testName: 'Comprehensive Fix Utility',
        passed: !hasErrors && (appliedFixes || !hasIssues),
        details: `Issues detected: ${hasIssues}, Fixes applied: ${appliedFixes}, Errors: ${hasErrors}. Details: ${fixResult.fixes.join('; ')}`
      }

    } catch (error: any) {
      return {
        testName: 'Comprehensive Fix Utility',
        passed: false,
        details: `Test error: ${error.message}`
      }
    }
  }

  /**
   * Display test results in a user-friendly format
   */
  static displayResults(results: TestResult[]): void {
    console.log('\n🧪 User Fixes Test Results:')
    console.log('='.repeat(50))

    results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL'
      console.log(`${index + 1}. ${result.testName}: ${status}`)
      console.log(`   Details: ${result.details}`)
      console.log('')
    })

    const passedCount = results.filter(r => r.passed).length
    const totalCount = results.length
    const allPassed = passedCount === totalCount

    console.log(`Summary: ${passedCount}/${totalCount} tests passed`)

    if (allPassed) {
      console.log('🎉 All tests passed! User fixes are working correctly.')
    } else {
      console.log('⚠️ Some tests failed. Please review the fixes.')
    }

    // Also show as alert for easy access
    const summaryMessage = `User Fixes Test Results:\n\n${results.map((r, i) =>
      `${i + 1}. ${r.testName}: ${r.passed ? 'PASS' : 'FAIL'}\n   ${r.details}`
    ).join('\n\n')}\n\nSummary: ${passedCount}/${totalCount} tests passed`

    alert(summaryMessage)
  }
}

// Export for easy use
export const testUserFixes = UserFixesTestSuite

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).testUserFixes = testUserFixes
}