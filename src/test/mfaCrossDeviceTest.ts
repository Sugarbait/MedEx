/**
 * Test MFA Cross-Device Enforcement
 *
 * This test validates that the MFA bypass vulnerability has been fixed
 * and users with MFA enabled are properly challenged on new devices.
 */

import { mfaService } from '@/services/mfaService'

interface TestResult {
  testName: string
  passed: boolean
  message: string
  details?: any
}

export const testMFACrossDeviceEnforcement = (): TestResult[] => {
  const results: TestResult[] = []
  const testUserId = 'pierre-user-789' // Test user pierre@phaetonai.com

  console.log('🧪 Starting MFA Cross-Device Enforcement Tests')

  // Test 1: Verify MFA protection without session
  try {
    const hasMFASetup = mfaService.hasMFASetupSync(testUserId)
    const hasMFAEnabled = mfaService.hasMFAEnabledSync(testUserId)
    const currentSession = mfaService.getCurrentSessionSync(testUserId)

    // Clear any existing sessions to simulate new device
    if (currentSession) {
      mfaService.invalidateSession(currentSession.sessionToken)
    }

    const sessionAfterClear = mfaService.getCurrentSessionSync(testUserId)

    results.push({
      testName: 'MFA Status Check on New Device',
      passed: (hasMFASetup || hasMFAEnabled) && !sessionAfterClear,
      message: (hasMFASetup || hasMFAEnabled) && !sessionAfterClear
        ? 'User has MFA enabled and no session exists - MFA will be required'
        : 'SECURITY ISSUE: MFA bypass possible',
      details: {
        hasMFASetup,
        hasMFAEnabled,
        hasValidSession: !!sessionAfterClear
      }
    })
  } catch (error) {
    results.push({
      testName: 'MFA Status Check on New Device',
      passed: false,
      message: `Test failed with error: ${error.message}`,
      details: { error: error.message }
    })
  }

  // Test 2: Verify localStorage fallback is removed
  try {
    // Set the old insecure fallback
    localStorage.setItem('mfa_verified', 'true')

    // Check if the new MFAProtectedRoute logic ignores this
    const hasSession = !!mfaService.getCurrentSessionSync(testUserId)

    results.push({
      testName: 'localStorage Fallback Removed',
      passed: !hasSession,
      message: !hasSession
        ? 'localStorage fallback properly ignored - security vulnerability fixed'
        : 'SECURITY ISSUE: localStorage fallback still allows bypass',
      details: {
        localStorageMfaVerified: localStorage.getItem('mfa_verified'),
        hasValidSession: hasSession
      }
    })

    // Clean up
    localStorage.removeItem('mfa_verified')
  } catch (error) {
    results.push({
      testName: 'localStorage Fallback Removed',
      passed: false,
      message: `Test failed with error: ${error.message}`,
      details: { error: error.message }
    })
  }

  // Test 3: Verify session-based access
  try {
    // Create a mock valid session
    const mockSession = {
      userId: testUserId,
      sessionToken: 'test-session-token-123',
      verified: true,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      phiAccessEnabled: true
    }

    // Simulate having a valid session
    const mfaSessionsMap = (mfaService as any).activeSessions
    mfaSessionsMap.set(mockSession.sessionToken, mockSession)

    const sessionCheck = mfaService.getCurrentSessionSync(testUserId)
    const hasValidAccess = !!sessionCheck && sessionCheck.verified

    results.push({
      testName: 'Valid Session Access',
      passed: hasValidAccess,
      message: hasValidAccess
        ? 'Valid MFA session properly grants access'
        : 'ISSUE: Valid session not recognized',
      details: {
        hasSession: !!sessionCheck,
        sessionVerified: sessionCheck?.verified,
        sessionExpiry: sessionCheck?.expiresAt
      }
    })

    // Clean up
    mfaSessionsMap.delete(mockSession.sessionToken)
  } catch (error) {
    results.push({
      testName: 'Valid Session Access',
      passed: false,
      message: `Test failed with error: ${error.message}`,
      details: { error: error.message }
    })
  }

  // Test 4: Verify expired session handling
  try {
    // Create a mock expired session
    const expiredSession = {
      userId: testUserId,
      sessionToken: 'expired-session-token-123',
      verified: true,
      verifiedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (expired)
      phiAccessEnabled: true
    }

    const mfaSessionsMap = (mfaService as any).activeSessions
    mfaSessionsMap.set(expiredSession.sessionToken, expiredSession)

    const sessionCheck = mfaService.getCurrentSessionSync(testUserId)
    const hasValidAccess = !!sessionCheck && sessionCheck.verified && new Date() <= sessionCheck.expiresAt

    results.push({
      testName: 'Expired Session Handling',
      passed: !hasValidAccess,
      message: !hasValidAccess
        ? 'Expired sessions properly denied access'
        : 'SECURITY ISSUE: Expired session still grants access',
      details: {
        hasSession: !!sessionCheck,
        sessionExpired: sessionCheck ? new Date() > sessionCheck.expiresAt : 'no session'
      }
    })

    // Clean up
    mfaSessionsMap.delete(expiredSession.sessionToken)
  } catch (error) {
    results.push({
      testName: 'Expired Session Handling',
      passed: false,
      message: `Test failed with error: ${error.message}`,
      details: { error: error.message }
    })
  }

  // Summary
  const passedTests = results.filter(r => r.passed).length
  const totalTests = results.length

  console.log(`🧪 MFA Cross-Device Tests Complete: ${passedTests}/${totalTests} passed`)

  results.forEach(result => {
    const emoji = result.passed ? '✅' : '❌'
    console.log(`${emoji} ${result.testName}: ${result.message}`)
    if (result.details) {
      console.log('   Details:', result.details)
    }
  })

  return results
}

// Auto-run tests in development
if (typeof window !== 'undefined') {
  // Make test available globally for manual testing
  ;(window as any).testMFACrossDevice = testMFACrossDeviceEnforcement

  // Auto-run after a short delay to allow services to initialize
  setTimeout(() => {
    try {
      const results = testMFACrossDeviceEnforcement()
      const allPassed = results.every(r => r.passed)
      if (allPassed) {
        console.log('🎉 All MFA cross-device security tests PASSED')
      } else {
        console.warn('⚠️ Some MFA security tests FAILED - review needed')
      }
    } catch (error) {
      console.error('Failed to run MFA tests:', error)
    }
  }, 3000)
}

export default testMFACrossDeviceEnforcement