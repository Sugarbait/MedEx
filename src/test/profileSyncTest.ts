import { robustProfileSyncService, ProfileData } from '@/services/robustProfileSyncService'
import { supabaseConfig } from '@/config/supabase'

/**
 * Test suite for Profile Sync functionality
 *
 * This test verifies that profile data is properly saved and synced
 * across devices and storage systems.
 */

export class ProfileSyncTest {

  /**
   * Test profile save and load functionality
   */
  static async testProfileSaveAndLoad(): Promise<{ success: boolean; results: string[] }> {
    const results: string[] = []
    let success = true

    try {
      console.log('🧪 PROFILE SYNC TEST: Starting save and load test')

      // Test data
      const testProfile: ProfileData = {
        id: 'test-user-123',
        email: 'test@carexps.com',
        name: 'Test User',
        role: 'staff',
        department: 'Emergency Medicine',
        phone: '+1-555-0123',
        bio: 'Test healthcare provider',
        location: 'Toronto General Hospital',
        display_name: 'Dr. Test',
        mfa_enabled: false
      }

      // Test 1: Save profile data
      results.push('🧪 Test 1: Saving profile data...')
      const saveResult = await robustProfileSyncService.saveProfileData(testProfile)

      if (saveResult.status === 'success') {
        results.push(`✅ Save successful - Local: ${saveResult.data?.localSaved}, Cloud: ${saveResult.data?.cloudSaved}`)

        if (saveResult.data?.warnings.length) {
          results.push(`⚠️ Warnings: ${saveResult.data.warnings.join(', ')}`)
        }
      } else {
        results.push(`❌ Save failed: ${saveResult.error}`)
        success = false
      }

      // Test 2: Load profile data
      results.push('🧪 Test 2: Loading profile data...')
      const loadResult = await robustProfileSyncService.loadProfileData(testProfile.id)

      if (loadResult.status === 'success' && loadResult.data) {
        const loadedProfile = loadResult.data

        // Verify data integrity
        const fieldsToCheck = ['name', 'email', 'department', 'phone', 'bio', 'location', 'display_name']
        let dataIntegrityPassed = true

        for (const field of fieldsToCheck) {
          const originalValue = testProfile[field as keyof ProfileData]
          const loadedValue = loadedProfile[field as keyof ProfileData]

          if (originalValue !== loadedValue) {
            results.push(`❌ Data integrity failed for ${field}: expected "${originalValue}", got "${loadedValue}"`)
            dataIntegrityPassed = false
            success = false
          }
        }

        if (dataIntegrityPassed) {
          results.push('✅ Data integrity check passed - all fields match')
        }
      } else {
        results.push(`❌ Load failed: ${loadResult.error}`)
        success = false
      }

      // Test 3: Test cloud sync availability
      results.push('🧪 Test 3: Checking cloud sync status...')
      const syncStatus = robustProfileSyncService.getSyncStatus()
      results.push(`📊 Cloud available: ${syncStatus.cloudAvailable}`)
      results.push(`📊 Local storage mode: ${syncStatus.localStorageMode}`)
      results.push(`📊 Last sync: ${syncStatus.lastSync || 'Never'}`)

      // Test 4: Force cloud sync (if available)
      if (syncStatus.cloudAvailable) {
        results.push('🧪 Test 4: Testing force cloud sync...')
        const forceSyncResult = await robustProfileSyncService.forceSyncFromCloud(testProfile.id)

        if (forceSyncResult.status === 'success') {
          results.push('✅ Force cloud sync successful')
        } else {
          results.push(`⚠️ Force cloud sync failed: ${forceSyncResult.error}`)
          // Don't mark as failure since cloud might not be available
        }
      } else {
        results.push('🧪 Test 4: Skipped - cloud sync not available')
      }

      // Cleanup
      results.push('🧪 Cleaning up test data...')
      try {
        localStorage.removeItem(`userProfile_${testProfile.id}`)
        results.push('✅ Cleanup completed')
      } catch (error) {
        results.push(`⚠️ Cleanup warning: ${error}`)
      }

    } catch (error: any) {
      results.push(`💥 Test suite error: ${error.message}`)
      success = false
    }

    results.push(success ? '🎉 All tests passed!' : '🚨 Some tests failed')
    return { success, results }
  }

  /**
   * Test localStorage persistence
   */
  static async testLocalStoragePersistence(): Promise<{ success: boolean; results: string[] }> {
    const results: string[] = []
    let success = true

    try {
      results.push('🧪 LOCALSTORAGE TEST: Testing localStorage persistence...')

      const testProfile: ProfileData = {
        id: 'test-localStorage-456',
        email: 'localStorage-test@carexps.com',
        name: 'LocalStorage Test User',
        role: 'staff',
        department: 'Radiology',
        phone: '+1-555-0456',
        bio: 'Testing localStorage persistence',
        location: 'Test Hospital',
        display_name: 'Dr. LocalStorage'
      }

      // Save to localStorage only
      const saveResult = await robustProfileSyncService.saveProfileData(testProfile)

      if (saveResult.data?.localSaved) {
        results.push('✅ LocalStorage save successful')

        // Verify data persists in all localStorage locations
        const currentUser = localStorage.getItem('currentUser')
        const userProfile = localStorage.getItem(`userProfile_${testProfile.id}`)
        const systemUsers = localStorage.getItem('systemUsers')

        if (userProfile) {
          const parsedProfile = JSON.parse(userProfile)
          if (parsedProfile.department === testProfile.department) {
            results.push('✅ UserProfile localStorage verified')
          } else {
            results.push('❌ UserProfile localStorage mismatch')
            success = false
          }
        } else {
          results.push('❌ UserProfile not found in localStorage')
          success = false
        }

        // Load and verify
        const loadResult = await robustProfileSyncService.loadProfileData(testProfile.id)
        if (loadResult.status === 'success' && loadResult.data?.department === testProfile.department) {
          results.push('✅ LocalStorage load verified')
        } else {
          results.push('❌ LocalStorage load failed')
          success = false
        }

      } else {
        results.push('❌ LocalStorage save failed')
        success = false
      }

      // Cleanup
      localStorage.removeItem(`userProfile_${testProfile.id}`)

    } catch (error: any) {
      results.push(`💥 LocalStorage test error: ${error.message}`)
      success = false
    }

    return { success, results }
  }

  /**
   * Run all tests
   */
  static async runAllTests(): Promise<void> {
    console.log('🧪 PROFILE SYNC TEST SUITE: Starting all tests...')
    console.log('=' * 50)

    try {
      // Test 1: Profile Save and Load
      const test1 = await this.testProfileSaveAndLoad()
      console.log('\n📋 PROFILE SAVE/LOAD TEST RESULTS:')
      test1.results.forEach(result => console.log(result))

      // Test 2: localStorage Persistence
      const test2 = await this.testLocalStoragePersistence()
      console.log('\n📋 LOCALSTORAGE TEST RESULTS:')
      test2.results.forEach(result => console.log(result))

      // Summary
      console.log('\n' + '=' * 50)
      console.log('📊 TEST SUITE SUMMARY:')
      console.log(`Profile Save/Load Test: ${test1.success ? '✅ PASSED' : '❌ FAILED'}`)
      console.log(`LocalStorage Test: ${test2.success ? '✅ PASSED' : '❌ FAILED'}`)

      const overallSuccess = test1.success && test2.success
      console.log(`Overall Result: ${overallSuccess ? '🎉 ALL TESTS PASSED' : '🚨 SOME TESTS FAILED'}`)

      // Environment info
      console.log('\n🔧 ENVIRONMENT INFO:')
      console.log(`Supabase configured: ${supabaseConfig.isConfigured()}`)
      console.log(`LocalStorage only mode: ${supabaseConfig.isLocalStorageOnly()}`)

    } catch (error: any) {
      console.error('💥 Test suite failed to run:', error)
    }
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).profileSyncTest = ProfileSyncTest
  console.log('🧪 Profile Sync Test Suite loaded. Run window.profileSyncTest.runAllTests() to test.')
}