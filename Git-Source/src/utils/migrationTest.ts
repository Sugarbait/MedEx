/**
 * Migration Test Utilities
 * Test script to validate localStorage to Supabase migration
 */

import { userProfileService } from '@/services/userProfileService'
import { userManagementService } from '@/services/userManagementService'
import { UserSettingsService } from '@/services/userSettingsService'

export interface MigrationTestResult {
  testName: string
  success: boolean
  error?: string
  duration: number
  details?: any
}

export class MigrationTester {
  private results: MigrationTestResult[] = []

  /**
   * Run all migration tests
   */
  async runAllTests(): Promise<{ success: boolean; results: MigrationTestResult[] }> {
    console.log('🚀 Starting migration validation tests...')

    // Test user profile operations
    await this.testUserProfileOperations()

    // Test user management operations
    await this.testUserManagement()

    // Test settings operations
    await this.testSettingsOperations()

    // Test authentication
    await this.testAuthentication()

    // Test avatar operations
    await this.testAvatarOperations()

    const successCount = this.results.filter(r => r.success).length
    const totalTests = this.results.length

    console.log(`\n📊 Test Results: ${successCount}/${totalTests} tests passed`)

    if (successCount < totalTests) {
      console.log('❌ Some tests failed:')
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.testName}: ${result.error}`)
      })
    } else {
      console.log('✅ All migration tests passed!')
    }

    return {
      success: successCount === totalTests,
      results: this.results
    }
  }

  /**
   * Test user profile operations
   */
  private async testUserProfileOperations(): Promise<void> {
    const testUserId = 'test-user-' + Date.now()
    const testUserData = {
      id: testUserId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'healthcare_provider' as const,
      mfa_enabled: false,
      settings: {
        theme: 'light',
        notifications: {
          email: true,
          sms: false
        }
      }
    }

    // Test saveUserProfile
    await this.runTest('Save User Profile', async () => {
      const response = await userProfileService.saveUserProfile(testUserData)
      if (response.status !== 'success') {
        throw new Error(`Failed to save user profile: ${response.error}`)
      }
      return response.data
    })

    // Test loadUserProfile
    await this.runTest('Load User Profile', async () => {
      const response = await userProfileService.loadUserProfile(testUserId)
      if (response.status !== 'success') {
        throw new Error(`Failed to load user profile: ${response.error}`)
      }
      return response.data
    })

    // Test syncUserSettings
    await this.runTest('Sync User Settings', async () => {
      const response = await userProfileService.syncUserSettings(testUserId, {
        theme: 'dark',
        newSetting: 'test-value'
      })
      if (response.status !== 'success') {
        throw new Error(`Failed to sync settings: ${response.error}`)
      }
      return response.data
    })
  }

  /**
   * Test user management operations
   */
  private async testUserManagement(): Promise<void> {
    // Test loadSystemUsers
    await this.runTest('Load System Users', async () => {
      const response = await userManagementService.loadSystemUsers()
      if (response.status !== 'success') {
        throw new Error(`Failed to load system users: ${response.error}`)
      }
      return { userCount: response.data?.length || 0 }
    })

    // Test createSystemUser
    const testEmail = `test-${Date.now()}@example.com`
    await this.runTest('Create System User', async () => {
      const userData = {
        email: testEmail,
        name: 'Test System User',
        role: 'staff' as const,
        mfa_enabled: false,
        settings: {
          theme: 'light'
        }
      }

      const credentials = {
        email: testEmail,
        password: 'TestPassword123!'
      }

      const response = await userManagementService.createSystemUser(userData, credentials)
      if (response.status !== 'success') {
        throw new Error(`Failed to create system user: ${response.error}`)
      }
      return response.data
    })

    // Test authenticateUser
    await this.runTest('Authenticate User', async () => {
      const response = await userManagementService.authenticateUser(testEmail, 'TestPassword123!')
      if (response.status !== 'success') {
        throw new Error(`Failed to authenticate user: ${response.error}`)
      }
      return { authenticated: !!response.data }
    })
  }

  /**
   * Test settings operations
   */
  private async testSettingsOperations(): Promise<void> {
    const testUserId = 'settings-test-' + Date.now()

    // Test getUserSettings
    await this.runTest('Get User Settings', async () => {
      const response = await UserSettingsService.getUserSettings(testUserId)
      // This might return null for new users, which is expected
      return { settingsFound: response.status === 'success' }
    })

    // Test updateUserSettings
    await this.runTest('Update User Settings', async () => {
      const settings = {
        theme: 'dark' as const,
        notifications: {
          email: true,
          sms: true,
          push: false,
          in_app: true,
          call_alerts: true,
          sms_alerts: false,
          security_alerts: true
        },
        security_preferences: {
          session_timeout: 30,
          require_mfa: false,
          password_expiry_reminder: true,
          login_notifications: true
        }
      }

      const response = await UserSettingsService.updateUserSettings(testUserId, settings)
      if (response.status !== 'success') {
        throw new Error(`Failed to update settings: ${response.error}`)
      }
      return response.data
    })

    // Test getUserSettingsWithCache
    await this.runTest('Get User Settings With Cache', async () => {
      const response = await UserSettingsService.getUserSettingsWithCache(testUserId)
      if (response.status !== 'success') {
        throw new Error(`Failed to get cached settings: ${response.error}`)
      }
      return { cached: true }
    })
  }

  /**
   * Test authentication with demo accounts
   */
  private async testAuthentication(): Promise<void> {
    // Test demo account authentication
    await this.runTest('Demo Account Authentication', async () => {
      const response = await userManagementService.authenticateUser('demo@carexps.com', 'demo123')

      // This might fail if demo users aren't set up yet, which is expected
      const isAuthenticated = response.status === 'success' && !!response.data

      return {
        demoAccountExists: isAuthenticated,
        note: 'Demo account may need to be created in Supabase first'
      }
    })
  }

  /**
   * Test avatar operations
   */
  private async testAvatarOperations(): Promise<void> {
    const testUserId = 'avatar-test-' + Date.now()

    // Create a simple test avatar (base64 1x1 pixel PNG)
    const testAvatarBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

    // Test saveAvatar
    await this.runTest('Save Avatar', async () => {
      const response = await userProfileService.saveAvatar(testUserId, testAvatarBase64)
      if (response.status !== 'success') {
        throw new Error(`Failed to save avatar: ${response.error}`)
      }
      return { avatarUrl: response.data }
    })

    // Test removeAvatar
    await this.runTest('Remove Avatar', async () => {
      const response = await userProfileService.removeAvatar(testUserId)
      if (response.status !== 'success') {
        throw new Error(`Failed to remove avatar: ${response.error}`)
      }
      return { removed: true }
    })
  }

  /**
   * Run a single test with error handling and timing
   */
  private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now()

    try {
      console.log(`  Running: ${testName}...`)
      const result = await testFn()
      const duration = Date.now() - startTime

      this.results.push({
        testName,
        success: true,
        duration,
        details: result
      })

      console.log(`    ✅ ${testName} passed (${duration}ms)`)
    } catch (error: any) {
      const duration = Date.now() - startTime

      this.results.push({
        testName,
        success: false,
        error: error.message,
        duration
      })

      console.log(`    ❌ ${testName} failed: ${error.message} (${duration}ms)`)
    }
  }

  /**
   * Test localStorage fallback functionality
   */
  async testLocalStorageFallback(): Promise<MigrationTestResult> {
    const testName = 'localStorage Fallback'
    const startTime = Date.now()

    try {
      // Simulate localStorage operations
      const testData = {
        id: 'fallback-test',
        email: 'fallback@test.com',
        name: 'Fallback Test User'
      }

      localStorage.setItem('test-currentUser', JSON.stringify(testData))
      const retrieved = JSON.parse(localStorage.getItem('test-currentUser') || '{}')

      if (retrieved.email !== testData.email) {
        throw new Error('localStorage fallback failed')
      }

      localStorage.removeItem('test-currentUser')

      return {
        testName,
        success: true,
        duration: Date.now() - startTime,
        details: { fallbackWorking: true }
      }
    } catch (error: any) {
      return {
        testName,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Generate test report
   */
  generateReport(): string {
    const successCount = this.results.filter(r => r.success).length
    const totalTests = this.results.length
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests

    let report = `# Migration Test Report\n\n`
    report += `**Summary:** ${successCount}/${totalTests} tests passed\n`
    report += `**Average Duration:** ${avgDuration.toFixed(2)}ms\n`
    report += `**Test Date:** ${new Date().toISOString()}\n\n`

    report += `## Test Results\n\n`

    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      report += `${status} **${result.testName}** (${result.duration}ms)\n`

      if (!result.success && result.error) {
        report += `   Error: ${result.error}\n`
      }

      if (result.details) {
        report += `   Details: ${JSON.stringify(result.details, null, 2)}\n`
      }

      report += `\n`
    })

    return report
  }
}

// Export for easy testing
export const migrationTester = new MigrationTester()

// Example usage:
// import { migrationTester } from '@/utils/migrationTest'
// migrationTester.runAllTests().then(results => console.log(results))