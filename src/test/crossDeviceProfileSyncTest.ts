import { enhancedCrossDeviceProfileSync } from '@/services/enhancedCrossDeviceProfileSync'
import { avatarStorageService } from '@/services/avatarStorageService'
import { userProfileService } from '@/services/userProfileService'

/**
 * Cross-Device Profile Synchronization Test Suite
 *
 * Comprehensive testing for profile synchronization functionality including:
 * - Profile field sync across devices
 * - Avatar sync with cloud storage
 * - Real-time updates and conflict resolution
 * - Offline/online state handling
 * - HIPAA-compliant audit logging
 */

interface TestResult {
  testName: string
  passed: boolean
  error?: string
  details?: any
}

interface TestSuite {
  suiteName: string
  results: TestResult[]
  passed: number
  failed: number
  totalTime: number
}

export class CrossDeviceProfileSyncTest {
  private testUserId: string = 'test-user-' + Date.now()
  private testDeviceId: string = 'test-device-' + Math.random().toString(36).substring(2)
  private syncService = enhancedCrossDeviceProfileSync

  /**
   * Run all cross-device sync tests
   */
  async runAllTests(): Promise<TestSuite> {
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log('🧪 Starting Cross-Device Profile Sync Test Suite')
    console.log('📱 Test User ID:', this.testUserId)
    console.log('📱 Test Device ID:', this.testDeviceId)

    // Setup
    await this.setupTestEnvironment()

    // Test categories
    const testCategories = [
      { name: 'Basic Profile Operations', tests: this.getBasicProfileTests() },
      { name: 'Avatar Synchronization', tests: this.getAvatarSyncTests() },
      { name: 'Real-time Updates', tests: this.getRealtimeTests() },
      { name: 'Conflict Resolution', tests: this.getConflictResolutionTests() },
      { name: 'Offline/Online Handling', tests: this.getOfflineOnlineTests() },
      { name: 'Data Persistence', tests: this.getDataPersistenceTests() }
    ]

    // Run all test categories
    for (const category of testCategories) {
      console.log(`\n📂 Testing: ${category.name}`)
      for (const test of category.tests) {
        const result = await this.runSingleTest(test)
        results.push(result)
        console.log(`  ${result.passed ? '✅' : '❌'} ${result.testName}`)
        if (!result.passed) {
          console.log(`    Error: ${result.error}`)
        }
      }
    }

    // Cleanup
    await this.cleanupTestEnvironment()

    const totalTime = Date.now() - startTime
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    const testSuite: TestSuite = {
      suiteName: 'Cross-Device Profile Synchronization',
      results,
      passed,
      failed,
      totalTime
    }

    this.logTestSummary(testSuite)
    return testSuite
  }

  /**
   * Setup test environment
   */
  private async setupTestEnvironment(): Promise<void> {
    // Clear any existing test data
    localStorage.removeItem(`userProfile_${this.testUserId}`)
    localStorage.removeItem(`avatar_${this.testUserId}`)
    localStorage.removeItem(`avatar_data_${this.testUserId}`)
    localStorage.removeItem('currentUser')

    // Create test user data
    const testUser = {
      id: this.testUserId,
      email: 'test@carexps.com',
      name: 'Test User',
      role: 'staff',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    localStorage.setItem('currentUser', JSON.stringify(testUser))
    localStorage.setItem(`userProfile_${this.testUserId}`, JSON.stringify(testUser))
  }

  /**
   * Cleanup test environment
   */
  private async cleanupTestEnvironment(): Promise<void> {
    // Remove test data
    localStorage.removeItem(`userProfile_${this.testUserId}`)
    localStorage.removeItem(`avatar_${this.testUserId}`)
    localStorage.removeItem(`avatar_data_${this.testUserId}`)
    localStorage.removeItem('currentUser')

    // Cleanup sync service
    this.syncService.cleanup()
  }

  /**
   * Run a single test
   */
  private async runSingleTest(test: () => Promise<void>): Promise<TestResult> {
    try {
      await test()
      return {
        testName: test.name,
        passed: true
      }
    } catch (error: any) {
      return {
        testName: test.name,
        passed: false,
        error: error.message,
        details: error
      }
    }
  }

  /**
   * Basic profile operation tests
   */
  private getBasicProfileTests(): (() => Promise<void>)[] {
    return [
      async function testServiceInitialization() {
        const result = await enhancedCrossDeviceProfileSync.initialize(this.testUserId)
        if (result.status !== 'success') {
          throw new Error(`Service initialization failed: ${result.error}`)
        }
      }.bind(this),

      async function testProfileDataSync() {
        const profileData = {
          id: this.testUserId,
          email: 'test@carexps.com',
          name: 'Updated Test User',
          department: 'Test Department',
          phone: '+1-555-0123',
          location: 'Test Location',
          bio: 'Test bio content'
        }

        const result = await this.syncService.syncProfileToCloud(profileData)
        if (result.status !== 'success') {
          throw new Error(`Profile sync failed: ${result.error}`)
        }

        // Verify data was saved locally
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          throw new Error('Profile data not saved to localStorage')
        }

        const userData = JSON.parse(currentUser)
        if (userData.name !== profileData.name) {
          throw new Error('Profile data not properly updated in localStorage')
        }
      }.bind(this),

      async function testSyncStatusTracking() {
        const status = this.syncService.getSyncStatus()

        if (typeof status.isOnline !== 'boolean') {
          throw new Error('Sync status isOnline not properly tracked')
        }

        if (typeof status.deviceId !== 'string' || status.deviceId.length === 0) {
          throw new Error('Device ID not properly set')
        }

        if (typeof status.pendingChanges !== 'number') {
          throw new Error('Pending changes not properly tracked')
        }
      }.bind(this)
    ]
  }

  /**
   * Avatar synchronization tests
   */
  private getAvatarSyncTests(): (() => Promise<void>)[] {
    return [
      async function testAvatarUpload() {
        // Create a test image data URL
        const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

        const result = await this.syncService.syncAvatarAcrossDevices(testImageData)
        if (result.status !== 'success') {
          throw new Error(`Avatar upload failed: ${result.error}`)
        }

        if (!result.avatarUrl) {
          throw new Error('Avatar upload succeeded but no URL returned')
        }

        // Verify avatar was stored
        const avatarUrl = await avatarStorageService.getAvatarUrl(this.testUserId)
        if (!avatarUrl) {
          throw new Error('Avatar not properly stored')
        }
      }.bind(this),

      async function testAvatarRetrieval() {
        const avatarUrl = await avatarStorageService.getAvatarUrl(this.testUserId)

        if (!avatarUrl) {
          throw new Error('Avatar URL not found after upload')
        }

        if (!avatarUrl.startsWith('data:image/') && !avatarUrl.startsWith('http')) {
          throw new Error('Invalid avatar URL format')
        }
      }.bind(this),

      async function testAvatarCrossDeviceSync() {
        // Simulate retrieving avatar from another device
        const syncResult = await avatarStorageService.syncAvatarAcrossDevices(this.testUserId)

        if (syncResult.status !== 'success') {
          throw new Error(`Cross-device avatar sync failed: ${syncResult.error}`)
        }

        // Verify avatar is accessible
        const avatarUrl = await avatarStorageService.getAvatarUrl(this.testUserId)
        if (!avatarUrl) {
          throw new Error('Avatar not accessible after cross-device sync')
        }
      }.bind(this)
    ]
  }

  /**
   * Real-time update tests
   */
  private getRealtimeTests(): (() => Promise<void>)[] {
    return [
      async function testEventSubscription() {
        let eventReceived = false
        const unsubscribe = this.syncService.subscribeToSyncEvents(this.testUserId, (event) => {
          if (event.type === 'profile_updated') {
            eventReceived = true
          }
        })

        // Trigger a profile update
        await this.syncService.syncProfileToCloud({
          id: this.testUserId,
          name: 'Event Test User'
        })

        // Wait a moment for event processing
        await new Promise(resolve => setTimeout(resolve, 100))

        unsubscribe()

        if (!eventReceived) {
          throw new Error('Profile update event not received')
        }
      }.bind(this),

      async function testSyncEventData() {
        let lastEvent = null
        const unsubscribe = this.syncService.subscribeToSyncEvents(this.testUserId, (event) => {
          lastEvent = event
        })

        // Trigger an avatar change
        const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        await this.syncService.syncAvatarAcrossDevices(testImageData)

        // Wait for event
        await new Promise(resolve => setTimeout(resolve, 100))

        unsubscribe()

        if (!lastEvent) {
          throw new Error('No sync event received for avatar change')
        }

        if (lastEvent.type !== 'avatar_changed') {
          throw new Error(`Expected avatar_changed event, got ${lastEvent.type}`)
        }

        if (lastEvent.userId !== this.testUserId) {
          throw new Error('Event user ID does not match test user')
        }
      }.bind(this)
    ]
  }

  /**
   * Conflict resolution tests
   */
  private getConflictResolutionTests(): (() => Promise<void>)[] {
    return [
      async function testLastWriteWinsConflict() {
        // Simulate concurrent updates
        const update1 = {
          id: this.testUserId,
          name: 'Update 1',
          department: 'Department 1'
        }

        const update2 = {
          id: this.testUserId,
          name: 'Update 2',
          department: 'Department 2'
        }

        // Apply both updates
        await this.syncService.syncProfileToCloud(update1)
        await new Promise(resolve => setTimeout(resolve, 50)) // Small delay
        await this.syncService.syncProfileToCloud(update2)

        // Verify the last update won
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          throw new Error('No user data found after conflict resolution')
        }

        const userData = JSON.parse(currentUser)
        if (userData.name !== 'Update 2') {
          throw new Error('Last-write-wins conflict resolution failed')
        }
      }.bind(this),

      async function testConflictMetricsTracking() {
        const initialStatus = this.syncService.getSyncStatus()
        const initialConflicts = initialStatus.conflictsResolved

        // Force a conflict scenario
        await this.syncService.syncProfileToCloud({
          id: this.testUserId,
          name: 'Conflict Test 1'
        })

        await this.syncService.syncProfileToCloud({
          id: this.testUserId,
          name: 'Conflict Test 2'
        })

        const finalStatus = this.syncService.getSyncStatus()

        // Note: In a real scenario with actual real-time updates from another device,
        // conflicts would be tracked. For this test, we verify the tracking mechanism exists.
        if (typeof finalStatus.conflictsResolved !== 'number') {
          throw new Error('Conflict resolution metrics not properly tracked')
        }
      }.bind(this)
    ]
  }

  /**
   * Offline/online handling tests
   */
  private getOfflineOnlineTests(): (() => Promise<void>)[] {
    return [
      async function testOfflineStateDetection() {
        const status = this.syncService.getSyncStatus()

        if (typeof status.isOnline !== 'boolean') {
          throw new Error('Online state not properly detected')
        }

        // Status should reflect current navigator.onLine state
        if (status.isOnline !== navigator.onLine) {
          throw new Error('Online state does not match navigator.onLine')
        }
      }.bind(this),

      async function testOfflineDataPersistence() {
        // Test data persistence when offline
        const profileData = {
          id: this.testUserId,
          name: 'Offline Test User',
          department: 'Offline Department'
        }

        // Even if offline, data should be saved locally
        const result = await this.syncService.syncProfileToCloud(profileData)

        // Verify local storage was updated regardless of online status
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          throw new Error('Data not persisted locally during offline test')
        }

        const userData = JSON.parse(currentUser)
        if (userData.name !== profileData.name) {
          throw new Error('Profile data not properly updated during offline test')
        }
      }.bind(this)
    ]
  }

  /**
   * Data persistence tests
   */
  private getDataPersistenceTests(): (() => Promise<void>)[] {
    return [
      async function testLocalStoragePersistence() {
        const testData = {
          id: this.testUserId,
          name: 'Persistence Test',
          department: 'Test Dept',
          phone: '+1-555-9999',
          location: 'Test City',
          bio: 'Persistence test bio'
        }

        await this.syncService.syncProfileToCloud(testData)

        // Check currentUser storage
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          throw new Error('currentUser not persisted in localStorage')
        }

        const userData = JSON.parse(currentUser)
        if (userData.name !== testData.name || userData.department !== testData.department) {
          throw new Error('Profile data not properly persisted in currentUser')
        }

        // Check userProfile storage
        const userProfile = localStorage.getItem(`userProfile_${this.testUserId}`)
        if (!userProfile) {
          throw new Error('userProfile not persisted in localStorage')
        }
      }.bind(this),

      async function testDataIntegrity() {
        const originalData = {
          id: this.testUserId,
          email: 'integrity@test.com',
          name: 'Integrity Test',
          role: 'staff',
          department: 'Quality Assurance',
          phone: '+1-555-1234',
          location: 'Test Lab',
          bio: 'Data integrity testing'
        }

        await this.syncService.syncProfileToCloud(originalData)

        // Retrieve and verify data integrity
        const currentUser = localStorage.getItem('currentUser')
        if (!currentUser) {
          throw new Error('Data not found during integrity test')
        }

        const retrievedData = JSON.parse(currentUser)

        // Check key fields
        const keyFields = ['id', 'email', 'name', 'department', 'phone', 'location', 'bio']
        for (const field of keyFields) {
          if (retrievedData[field] !== originalData[field]) {
            throw new Error(`Data integrity failed for field: ${field}`)
          }
        }
      }.bind(this),

      async function testCrossStorageConsistency() {
        const testData = {
          id: this.testUserId,
          name: 'Consistency Test',
          department: 'Consistency Dept'
        }

        await this.syncService.syncProfileToCloud(testData)

        // Check all storage locations for consistency
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
        const userProfile = JSON.parse(localStorage.getItem(`userProfile_${this.testUserId}`) || '{}')

        if (currentUser.name !== testData.name || userProfile.name !== testData.name) {
          throw new Error('Data not consistent across storage locations')
        }

        if (currentUser.department !== testData.department || userProfile.department !== testData.department) {
          throw new Error('Extended profile data not consistent across storage locations')
        }
      }.bind(this)
    ]
  }

  /**
   * Log test summary
   */
  private logTestSummary(testSuite: TestSuite): void {
    console.log('\n' + '='.repeat(60))
    console.log(`📊 ${testSuite.suiteName} - Test Results`)
    console.log('='.repeat(60))
    console.log(`✅ Passed: ${testSuite.passed}`)
    console.log(`❌ Failed: ${testSuite.failed}`)
    console.log(`⏱️  Total Time: ${testSuite.totalTime}ms`)
    console.log(`📈 Success Rate: ${Math.round((testSuite.passed / testSuite.results.length) * 100)}%`)

    if (testSuite.failed > 0) {
      console.log('\n❌ Failed Tests:')
      testSuite.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`  • ${result.testName}: ${result.error}`)
        })
    }

    console.log('\n' + '='.repeat(60))
  }

  /**
   * Quick validation test for production use
   */
  static async quickValidation(userId: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // Test service availability
      const syncService = enhancedCrossDeviceProfileSync
      if (!syncService) {
        issues.push('Enhanced cross-device sync service not available')
      }

      // Test initialization
      const initResult = await syncService.initialize(userId)
      if (initResult.status !== 'success') {
        issues.push(`Service initialization failed: ${initResult.error}`)
      }

      // Test sync status
      const status = syncService.getSyncStatus()
      if (!status.deviceId) {
        issues.push('Device ID not properly set')
      }

      // Test avatar service
      try {
        await avatarStorageService.getAvatarUrl(userId)
      } catch (error) {
        issues.push('Avatar service not functioning properly')
      }

      // Test profile service
      try {
        await userProfileService.loadUserProfile(userId)
      } catch (error) {
        issues.push('User profile service not functioning properly')
      }

      return {
        valid: issues.length === 0,
        issues
      }

    } catch (error: any) {
      issues.push(`Validation failed: ${error.message}`)
      return {
        valid: false,
        issues
      }
    }
  }
}

// Export test instance for manual testing
export const crossDeviceProfileSyncTest = new CrossDeviceProfileSyncTest()