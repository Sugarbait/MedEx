/**
 * Test utility to verify duplicate user prevention is working correctly
 */

import { userManagementService } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'

export interface DuplicateTestResult {
  success: boolean
  message: string
  details: {
    initialUserCount: number
    finalUserCount: number
    duplicatesRemoved: number
    testsPassed: number
    testsFailed: number
  }
}

/**
 * Run comprehensive duplicate prevention tests
 */
export async function runDuplicatePreventionTests(): Promise<DuplicateTestResult> {
  console.log('🧪 Starting duplicate user prevention tests...')

  let testsPassed = 0
  let testsFailed = 0
  const results: string[] = []

  try {
    // Get initial user count
    const initialUsersResponse = await userManagementService.loadSystemUsers()
    const initialUserCount = initialUsersResponse.data?.length || 0

    console.log(`📊 Initial user count: ${initialUserCount}`)

    // Test 1: Try to create a user with existing email
    console.log('🔍 Test 1: Attempting to create user with existing email...')
    try {
      const testUserData = {
        email: 'demo@carexps.com', // This should already exist
        name: 'Duplicate Test User',
        role: 'staff' as const,
        mfa_enabled: false,
        settings: { theme: 'light', notifications: {} }
      }

      const testCredentials = {
        email: 'demo@carexps.com',
        password: 'TestPassword123!',
        tempPassword: false
      }

      const createResponse = await userManagementService.createSystemUser(testUserData, testCredentials)

      if (createResponse.status === 'error' && createResponse.error?.includes('already exists')) {
        console.log('✅ Test 1 PASSED: Duplicate email correctly rejected')
        results.push('✅ Test 1: Duplicate email prevention works')
        testsPassed++
      } else {
        console.log('❌ Test 1 FAILED: Duplicate email was not rejected')
        results.push('❌ Test 1: Duplicate email was allowed!')
        testsFailed++
      }
    } catch (error) {
      console.log('❌ Test 1 ERROR:', error)
      results.push(`❌ Test 1: Error occurred - ${error}`)
      testsFailed++
    }

    // Test 2: Check userExistsByEmail function
    console.log('🔍 Test 2: Testing userExistsByEmail function...')
    try {
      const existsResponse = await userProfileService.userExistsByEmail('demo@carexps.com')

      if (existsResponse.status === 'success' && existsResponse.data === true) {
        console.log('✅ Test 2 PASSED: userExistsByEmail correctly identifies existing user')
        results.push('✅ Test 2: userExistsByEmail function works')
        testsPassed++
      } else {
        console.log('❌ Test 2 FAILED: userExistsByEmail did not find existing user')
        results.push('❌ Test 2: userExistsByEmail function failed')
        testsFailed++
      }
    } catch (error) {
      console.log('❌ Test 2 ERROR:', error)
      results.push(`❌ Test 2: Error occurred - ${error}`)
      testsFailed++
    }

    // Test 3: Check for false positive with non-existing email
    console.log('🔍 Test 3: Testing userExistsByEmail with non-existing email...')
    try {
      const nonExistentEmail = `test-${Date.now()}@nonexistent.com`
      const existsResponse = await userProfileService.userExistsByEmail(nonExistentEmail)

      if (existsResponse.status === 'success' && existsResponse.data === false) {
        console.log('✅ Test 3 PASSED: userExistsByEmail correctly identifies non-existing user')
        results.push('✅ Test 3: userExistsByEmail correctly handles non-existing emails')
        testsPassed++
      } else {
        console.log('❌ Test 3 FAILED: userExistsByEmail gave false positive')
        results.push('❌ Test 3: userExistsByEmail gave false positive')
        testsFailed++
      }
    } catch (error) {
      console.log('❌ Test 3 ERROR:', error)
      results.push(`❌ Test 3: Error occurred - ${error}`)
      testsFailed++
    }

    // Test 4: Run duplicate cleanup and verify it works
    console.log('🔍 Test 4: Testing duplicate cleanup function...')
    try {
      const cleanupResponse = await userManagementService.cleanupDuplicateUsers()

      if (cleanupResponse.status === 'success') {
        const { removed, remaining } = cleanupResponse.data || { removed: 0, remaining: 0 }
        console.log(`✅ Test 4 PASSED: Cleanup completed - removed ${removed}, remaining ${remaining}`)
        results.push(`✅ Test 4: Cleanup function works (removed ${removed} duplicates)`)
        testsPassed++

        // Verify final user count
        const finalUsersResponse = await userManagementService.loadSystemUsers()
        const finalUserCount = finalUsersResponse.data?.length || 0

        console.log(`📊 Final user count: ${finalUserCount}`)

        return {
          success: testsFailed === 0,
          message: testsFailed === 0 ? 'All duplicate prevention tests passed!' : `${testsFailed} tests failed`,
          details: {
            initialUserCount,
            finalUserCount,
            duplicatesRemoved: removed || 0,
            testsPassed,
            testsFailed
          }
        }
      } else {
        console.log('❌ Test 4 FAILED: Cleanup function failed')
        results.push(`❌ Test 4: Cleanup failed - ${cleanupResponse.error}`)
        testsFailed++
      }
    } catch (error) {
      console.log('❌ Test 4 ERROR:', error)
      results.push(`❌ Test 4: Error occurred - ${error}`)
      testsFailed++
    }

    // Get final user count
    const finalUsersResponse = await userManagementService.loadSystemUsers()
    const finalUserCount = finalUsersResponse.data?.length || 0

    return {
      success: testsFailed === 0,
      message: testsFailed === 0 ? 'All duplicate prevention tests passed!' : `${testsFailed} tests failed`,
      details: {
        initialUserCount,
        finalUserCount,
        duplicatesRemoved: 0,
        testsPassed,
        testsFailed
      }
    }

  } catch (error: any) {
    console.error('🚨 Test suite error:', error)
    return {
      success: false,
      message: `Test suite failed: ${error.message}`,
      details: {
        initialUserCount: 0,
        finalUserCount: 0,
        duplicatesRemoved: 0,
        testsPassed,
        testsFailed: testsFailed + 1
      }
    }
  }
}

/**
 * Display test results in a user-friendly format
 */
export function displayTestResults(result: DuplicateTestResult): void {
  const { success, message, details } = result

  console.log('\n🧪 DUPLICATE PREVENTION TEST RESULTS')
  console.log('=====================================')
  console.log(`Status: ${success ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`Message: ${message}`)
  console.log('\nDetails:')
  console.log(`- Initial Users: ${details.initialUserCount}`)
  console.log(`- Final Users: ${details.finalUserCount}`)
  console.log(`- Duplicates Removed: ${details.duplicatesRemoved}`)
  console.log(`- Tests Passed: ${details.testsPassed}`)
  console.log(`- Tests Failed: ${details.testsFailed}`)

  // Show alert with results
  const alertMessage = success
    ? `✅ All tests passed!\n\nDuplicate prevention is working correctly.\n\nInitial users: ${details.initialUserCount}\nFinal users: ${details.finalUserCount}\nDuplicates removed: ${details.duplicatesRemoved}`
    : `❌ ${details.testsFailed} tests failed!\n\nDuplicate prevention may not be working correctly.\n\nTests passed: ${details.testsPassed}\nTests failed: ${details.testsFailed}`

  alert(alertMessage)
}

// Export a convenience function for running tests from browser console
if (typeof window !== 'undefined') {
  (window as any).runDuplicateTests = async () => {
    const result = await runDuplicatePreventionTests()
    displayTestResults(result)
    return result
  }
}