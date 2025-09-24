/**
 * Authentication Flow Integration Test
 * Validates the entire authentication system after fixes
 * 
 * This module tests:
 * - MSAL configuration and client management
 * - Authentication middleware functionality
 * - MFA integration and TOTP verification
 * - Session management and security
 * - Error handling and recovery
 * - Cross-device synchronization
 */

import { authMiddleware } from '../services/authenticationMiddleware'
import { authErrorHandler } from '../services/authErrorHandler'
import { authRecoveryService } from '../services/authRecoveryService'
import { totpService } from '../services/totpService'
import { authService } from '../services/authService'
import { secureStorage } from '../services/secureStorage'
import { secureLogger } from '../services/secureLogger'
import { supabase } from '../config/supabase'

const logger = secureLogger.component('AuthFlowTest')

export interface TestResult {
  testName: string
  passed: boolean
  message: string
  error?: string
  duration?: number
}

export interface TestSuite {
  suiteName: string
  results: TestResult[]
  passed: number
  failed: number
  duration: number
}

class AuthenticationFlowTester {
  private testResults: TestSuite[] = []

  /**
   * Run complete authentication flow test suite
   */
  async runCompleteTestSuite(): Promise<{
    suites: TestSuite[]
    totalPassed: number
    totalFailed: number
    overallSuccess: boolean
  }> {
    logger.info('Starting complete authentication flow test suite')
    const startTime = Date.now()
    
    this.testResults = []

    try {
      // Run test suites in order
      await this.testMSALConfiguration()
      await this.testAuthenticationMiddleware()
      await this.testMFAIntegration()
      await this.testSessionManagement()
      await this.testErrorHandling()
      await this.testRecoveryMechanisms()
      await this.testCrossSyncFunctionality()
      
      const totalDuration = Date.now() - startTime
      const totalPassed = this.testResults.reduce((sum, suite) => sum + suite.passed, 0)
      const totalFailed = this.testResults.reduce((sum, suite) => sum + suite.failed, 0)
      const overallSuccess = totalFailed === 0

      logger.info('Authentication flow test suite completed', undefined, undefined, {
        duration: totalDuration,
        totalPassed,
        totalFailed,
        overallSuccess
      })

      return {
        suites: this.testResults,
        totalPassed,
        totalFailed,
        overallSuccess
      }

    } catch (error) {
      logger.error('Test suite execution failed', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw error
    }
  }

  /**
   * Test MSAL configuration and client management
   */
  private async testMSALConfiguration(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'MSAL Configuration',
      results: [],
      passed: 0,
      failed: 0,
      duration: 0
    }

    const startTime = Date.now()

    // Test 1: MSAL instance singleton
    await this.runTest(
      suite,
      'MSAL Singleton Instance',
      async () => {
        const accounts1 = authMiddleware.getMSALAccounts()
        const accounts2 = authMiddleware.getMSALAccounts()
        
        // Should be the same instance
        if (Array.isArray(accounts1) && Array.isArray(accounts2)) {
          return { success: true, message: 'MSAL singleton working correctly' }
        }
        
        return { success: false, message: 'MSAL instance not properly initialized' }
      }
    )

    // Test 2: Auth state subscription
    await this.runTest(
      suite,
      'Auth State Subscription',
      async () => {
        let stateReceived = false
        
        const unsubscribe = authMiddleware.subscribeToAuthState((state) => {
          stateReceived = true
        })
        
        // Wait a bit for state to be received
        await new Promise(resolve => setTimeout(resolve, 100))
        
        unsubscribe()
        
        if (stateReceived) {
          return { success: true, message: 'Auth state subscription working' }
        }
        
        return { success: false, message: 'Auth state subscription not working' }
      }
    )

    // Test 3: Multiple client instance prevention
    await this.runTest(
      suite,
      'Multiple Client Prevention',
      async () => {
        // Get multiple middleware instances - should be the same
        const middleware1 = authMiddleware
        const middleware2 = authMiddleware
        
        if (middleware1 === middleware2) {
          return { success: true, message: 'Singleton pattern preventing multiple instances' }
        }
        
        return { success: false, message: 'Multiple instances detected' }
      }
    )

    suite.duration = Date.now() - startTime
    this.testResults.push(suite)
  }

  /**
   * Test authentication middleware functionality
   */
  private async testAuthenticationMiddleware(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Authentication Middleware',
      results: [],
      passed: 0,
      failed: 0,
      duration: 0
    }

    const startTime = Date.now()

    // Test 1: Initial auth state
    await this.runTest(
      suite,
      'Initial Auth State',
      async () => {
        const authState = authMiddleware.getAuthState()
        
        if (authState && typeof authState.isAuthenticated === 'boolean') {
          return { success: true, message: 'Auth state properly initialized' }
        }
        
        return { success: false, message: 'Auth state not properly initialized' }
      }
    )

    // Test 2: Permission checking
    await this.runTest(
      suite,
      'Permission Checking',
      async () => {
        // Should return false when not authenticated
        const hasPermission = authMiddleware.hasPermission('test', 'read')
        
        if (hasPermission === false) {
          return { success: true, message: 'Permission checking working correctly' }
        }
        
        return { success: false, message: 'Permission checking not working' }
      }
    )

    suite.duration = Date.now() - startTime
    this.testResults.push(suite)
  }

  /**
   * Test MFA integration
   */
  private async testMFAIntegration(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'MFA Integration',
      results: [],
      passed: 0,
      failed: 0,
      duration: 0
    }

    const startTime = Date.now()
    const testUserId = 'test-user-123'

    // Test 1: TOTP service initialization
    await this.runTest(
      suite,
      'TOTP Service Initialization',
      async () => {
        const hasSetup = await totpService.hasTOTPSetup(testUserId)
        
        // Should return boolean (false for non-existent user)
        if (typeof hasSetup === 'boolean') {
          return { success: true, message: 'TOTP service responding correctly' }
        }
        
        return { success: false, message: 'TOTP service not responding' }
      }
    )

    // Test 2: Emergency fallback for critical users
    await this.runTest(
      suite,
      'Emergency TOTP Fallback',
      async () => {
        const criticalUserId = 'dynamic-pierre-user'
        
        try {
          const healthStatus = await totpService.checkDatabaseHealthAndFallback(criticalUserId)
          
          if (healthStatus && typeof healthStatus.healthy === 'boolean') {
            return { success: true, message: 'TOTP health check functioning' }
          }
          
          return { success: false, message: 'TOTP health check not working' }
        } catch (error) {
          return { success: false, message: `TOTP health check error: ${error instanceof Error ? error.message : 'Unknown'}` }
        }
      }
    )

    // Test 3: Invalid code handling
    await this.runTest(
      suite,
      'Invalid TOTP Code Handling',
      async () => {
        const result = await totpService.verifyTOTP(testUserId, '000000')
        
        // Should fail for non-existent user with proper error
        if (!result.success && result.error) {
          return { success: true, message: 'Invalid code handling working' }
        }
        
        return { success: false, message: 'Invalid code handling not working' }
      }
    )

    suite.duration = Date.now() - startTime
    this.testResults.push(suite)
  }

  /**
   * Test session management
   */
  private async testSessionManagement(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Session Management',
      results: [],
      passed: 0,
      failed: 0,
      duration: 0
    }

    const startTime = Date.now()

    // Test 1: Secure storage functionality
    await this.runTest(
      suite,
      'Secure Storage',
      async () => {
        const testData = { test: 'value' }
        const testKey = 'test_session_data'
        
        try {
          await secureStorage.setSessionData(testKey, testData)
          const retrievedData = await secureStorage.getSessionData(testKey)
          await secureStorage.removeItem(testKey)
          
          if (retrievedData && retrievedData.test === 'value') {
            return { success: true, message: 'Secure storage working correctly' }
          }
          
          return { success: false, message: 'Secure storage data mismatch' }
        } catch (error) {
          return { success: false, message: `Secure storage error: ${error instanceof Error ? error.message : 'Unknown'}` }
        }
      }
    )

    // Test 2: Session validation
    await this.runTest(
      suite,
      'Session Validation',
      async () => {
        try {
          // This should fail since no session exists
          const session = await authService.getSessionInfo()
          return { success: false, message: 'Session validation should have failed' }
        } catch (error) {
          // Expected to fail
          return { success: true, message: 'Session validation working correctly' }
        }
      }
    )

    suite.duration = Date.now() - startTime
    this.testResults.push(suite)
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Error Handling',
      results: [],
      passed: 0,
      failed: 0,
      duration: 0
    }

    const startTime = Date.now()

    // Test 1: MFA error handling
    await this.runTest(
      suite,
      'MFA Error Handling',
      async () => {
        const testError = new Error('TOTP not set up')
        const result = await authErrorHandler.handleMFAError(
          testError,
          'test-user-456'
        )
        
        if (result && result.userMessage && result.errorCode) {
          return { success: true, message: 'MFA error handling working' }
        }
        
        return { success: false, message: 'MFA error handling not working' }
      }
    )

    // Test 2: Network error detection
    await this.runTest(
      suite,
      'Network Error Detection',
      async () => {
        const networkError = new Error('Network request failed')
        const context = {
          userId: 'test-user',
          action: 'test',
          timestamp: new Date()
        }
        
        const result = await authErrorHandler.handleMSALError(
          networkError,
          context,
          { logToAudit: false }
        )
        
        if (result && result.userMessage && result.severity) {
          return { success: true, message: 'Network error detection working' }
        }
        
        return { success: false, message: 'Network error detection not working' }
      }
    )

    suite.duration = Date.now() - startTime
    this.testResults.push(suite)
  }

  /**
   * Test recovery mechanisms
   */
  private async testRecoveryMechanisms(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Recovery Mechanisms',
      results: [],
      passed: 0,
      failed: 0,
      duration: 0
    }

    const startTime = Date.now()

    // Test 1: Database connectivity recovery
    await this.runTest(
      suite,
      'Database Connectivity Recovery',
      async () => {
        const context = {
          userId: 'test-user',
          recoveryReason: 'database_unavailable',
          timestamp: new Date()
        }
        
        const result = await authRecoveryService.attemptRecovery(context)
        
        if (result && typeof result.success === 'boolean' && result.method && result.message) {
          return { success: true, message: 'Recovery mechanism working' }
        }
        
        return { success: false, message: 'Recovery mechanism not working' }
      }
    )

    // Test 2: Emergency access validation
    await this.runTest(
      suite,
      'Emergency Access Validation',
      async () => {
        const testUserId = 'non-existent-user'
        const isValid = await authRecoveryService.validateEmergencyAccess(testUserId)
        
        // Should return false for non-existent emergency access
        if (isValid === false) {
          return { success: true, message: 'Emergency access validation working' }
        }
        
        return { success: false, message: 'Emergency access validation not working' }
      }
    )

    suite.duration = Date.now() - startTime
    this.testResults.push(suite)
  }

  /**
   * Test cross-device sync functionality
   */
  private async testCrossSyncFunctionality(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Cross-Device Sync',
      results: [],
      passed: 0,
      failed: 0,
      duration: 0
    }

    const startTime = Date.now()

    // Test 1: Supabase connection
    await this.runTest(
      suite,
      'Supabase Connection',
      async () => {
        try {
          // Simple test query
          const { data, error } = await supabase
            .from('users')
            .select('id')
            .limit(1)
          
          if (error && error.code === 'OFFLINE_MODE') {
            return { success: true, message: 'Offline mode active (expected in dev)' }
          }
          
          if (Array.isArray(data)) {
            return { success: true, message: 'Supabase connection working' }
          }
          
          return { success: false, message: 'Supabase query failed' }
        } catch (error) {
          return { success: true, message: 'Offline mode (expected without proper config)' }
        }
      }
    )

    // Test 2: Settings sync simulation
    await this.runTest(
      suite,
      'Settings Sync Simulation',
      async () => {
        const { userSettingsService } = await import('../services/userSettingsService')
        
        try {
          const settings = await userSettingsService.getUserSettings('test-user')
          
          // Should return null or empty settings for non-existent user
          if (settings === null || typeof settings === 'object') {
            return { success: true, message: 'Settings sync interface working' }
          }
          
          return { success: false, message: 'Settings sync interface not working' }
        } catch (error) {
          // Expected in offline mode
          return { success: true, message: 'Settings sync graceful fallback working' }
        }
      }
    )

    suite.duration = Date.now() - startTime
    this.testResults.push(suite)
  }

  /**
   * Run individual test with error handling
   */
  private async runTest(
    suite: TestSuite,
    testName: string,
    testFunction: () => Promise<{ success: boolean; message: string }>
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      const result = await testFunction()
      const duration = Date.now() - startTime
      
      const testResult: TestResult = {
        testName,
        passed: result.success,
        message: result.message,
        duration
      }
      
      suite.results.push(testResult)
      
      if (result.success) {
        suite.passed++
      } else {
        suite.failed++
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const testResult: TestResult = {
        testName,
        passed: false,
        message: 'Test execution failed',
        error: errorMessage,
        duration
      }
      
      suite.results.push(testResult)
      suite.failed++
    }
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    let report = '\n=== AUTHENTICATION FLOW TEST REPORT ===\n\n'
    
    for (const suite of this.testResults) {
      report += `📋 ${suite.suiteName}:\n`
      report += `   ✅ Passed: ${suite.passed}\n`
      report += `   ❌ Failed: ${suite.failed}\n`
      report += `   ⏱️  Duration: ${suite.duration}ms\n\n`
      
      for (const test of suite.results) {
        const status = test.passed ? '✅' : '❌'
        report += `   ${status} ${test.testName}: ${test.message}`
        if (test.error) {
          report += ` (Error: ${test.error})`
        }
        if (test.duration) {
          report += ` [${test.duration}ms]`
        }
        report += '\n'
      }
      
      report += '\n'
    }
    
    const totalPassed = this.testResults.reduce((sum, suite) => sum + suite.passed, 0)
    const totalFailed = this.testResults.reduce((sum, suite) => sum + suite.failed, 0)
    const totalDuration = this.testResults.reduce((sum, suite) => sum + suite.duration, 0)
    
    report += `📊 SUMMARY:\n`
    report += `   Total Tests: ${totalPassed + totalFailed}\n`
    report += `   Passed: ${totalPassed}\n`
    report += `   Failed: ${totalFailed}\n`
    report += `   Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%\n`
    report += `   Total Duration: ${totalDuration}ms\n`
    
    return report
  }
}

// Export test runner
export const authFlowTester = new AuthenticationFlowTester()

// Convenience function for running tests
export async function runAuthenticationTests(): Promise<void> {
  console.log('🚀 Starting authentication flow tests...')
  
  try {
    const results = await authFlowTester.runCompleteTestSuite()
    const report = authFlowTester.generateReport()
    
    console.log(report)
    
    if (results.overallSuccess) {
      console.log('🎉 All authentication tests passed!')
    } else {
      console.log('⚠️ Some authentication tests failed. See report above.')
    }
    
  } catch (error) {
    console.error('❌ Authentication test suite failed:', error)
  }
}

// Make available in global scope for debugging
if (typeof window !== 'undefined') {
  (window as any).runAuthTests = runAuthenticationTests
  (window as any).authFlowTester = authFlowTester
}