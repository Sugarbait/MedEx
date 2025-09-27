/**
 * Debug utility for profile field persistence
 * Use in browser console to test and verify profile field persistence
 */

import { profileFieldsPersistenceService } from '@/services/profileFieldsPersistenceService'

export class ProfilePersistenceDebug {

  /**
   * Test saving profile fields
   */
  static async testSaveProfileFields(userId: string = 'test-user-123') {
    console.log('🔧 TESTING: Profile fields save...')

    const testData = {
      name: 'Test User',
      display_name: 'Dr. Test User',
      department: 'Emergency Medicine',
      phone: '+1-555-123-4567',
      bio: 'Test physician specializing in emergency medicine',
      location: 'Toronto General Hospital'
    }

    console.log('Test data:', testData)

    const result = await profileFieldsPersistenceService.saveProfileFieldsComplete(userId, testData)

    if (result.status === 'success') {
      console.log('✅ TESTING: Save successful!')
    } else {
      console.error('❌ TESTING: Save failed:', result.error)
    }

    return result
  }

  /**
   * Test loading profile fields
   */
  static async testLoadProfileFields(userId: string = 'test-user-123') {
    console.log('🔧 TESTING: Profile fields load...')

    const result = await profileFieldsPersistenceService.loadProfileFieldsComplete(userId)

    if (result.status === 'success') {
      console.log('✅ TESTING: Load successful!')
      console.log('Loaded data:', result.data)
    } else {
      console.error('❌ TESTING: Load failed:', result.error)
    }

    return result
  }

  /**
   * Test complete save-load cycle
   */
  static async testSaveLoadCycle(userId: string = 'test-user-123') {
    console.log('🔧 TESTING: Complete save-load cycle...')

    // Save test data
    const saveResult = await this.testSaveProfileFields(userId)
    if (saveResult.status !== 'success') {
      return saveResult
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100))

    // Load data back
    const loadResult = await this.testLoadProfileFields(userId)

    if (loadResult.status === 'success') {
      console.log('✅ TESTING: Save-load cycle completed successfully!')

      // Verify data consistency
      const hasRequiredFields = loadResult.data?.department &&
                               loadResult.data?.phone &&
                               loadResult.data?.location

      if (hasRequiredFields) {
        console.log('✅ TESTING: All required fields are present and persisted!')
      } else {
        console.warn('⚠️ TESTING: Some fields may not have persisted correctly')
      }
    }

    return loadResult
  }

  /**
   * Check localStorage status
   */
  static checkLocalStorageStatus(userId: string = 'test-user-123') {
    console.log('🔧 TESTING: Checking localStorage status...')

    // Check currentUser
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      const userData = JSON.parse(currentUser)
      if (userData.id === userId) {
        console.log('✅ currentUser found:', {
          department: userData.department,
          phone: userData.phone,
          location: userData.location
        })
      } else {
        console.log('ℹ️ currentUser exists but for different user')
      }
    } else {
      console.log('❌ No currentUser in localStorage')
    }

    // Check userProfile
    const userProfile = localStorage.getItem(`userProfile_${userId}`)
    if (userProfile) {
      const profileData = JSON.parse(userProfile)
      console.log('✅ userProfile found:', {
        department: profileData.department,
        phone: profileData.phone,
        location: profileData.location
      })
    } else {
      console.log('❌ No userProfile in localStorage')
    }

    // Check systemUsers
    const systemUsers = localStorage.getItem('systemUsers')
    if (systemUsers) {
      const users = JSON.parse(systemUsers)
      const user = users.find((u: any) => u.id === userId)
      if (user) {
        console.log('✅ User found in systemUsers:', {
          department: user.department,
          phone: user.phone,
          location: user.location
        })
      } else {
        console.log('❌ User not found in systemUsers')
      }
    } else {
      console.log('❌ No systemUsers in localStorage')
    }
  }

  /**
   * Simulate page refresh persistence test
   */
  static async simulatePageRefreshTest(userId: string = 'test-user-123') {
    console.log('🔧 TESTING: Simulating page refresh test...')

    // Save test data
    const testData = {
      name: 'Refresh Test User',
      display_name: 'Dr. Refresh Test',
      department: 'Cardiology',
      phone: '+1-555-999-8888',
      bio: 'Testing page refresh persistence',
      location: 'Mount Sinai Hospital'
    }

    console.log('1. Saving profile data...')
    const saveResult = await profileFieldsPersistenceService.saveProfileFieldsComplete(userId, testData)

    if (saveResult.status !== 'success') {
      console.error('❌ Save failed, cannot continue test')
      return saveResult
    }

    console.log('2. Simulating page refresh (clearing component state)...')
    // This simulates what happens when a page refreshes
    // The component state is lost but localStorage and database should persist

    console.log('3. Loading profile data (as would happen on page load)...')
    const loadResult = await profileFieldsPersistenceService.loadProfileFieldsComplete(userId)

    if (loadResult.status === 'success' && loadResult.data) {
      const fieldsMatch = loadResult.data.department === testData.department &&
                         loadResult.data.phone === testData.phone &&
                         loadResult.data.location === testData.location

      if (fieldsMatch) {
        console.log('✅ TESTING: Page refresh persistence test PASSED!')
        console.log('✅ All fields persisted correctly through simulated refresh')
      } else {
        console.error('❌ TESTING: Page refresh persistence test FAILED!')
        console.error('Expected:', testData)
        console.error('Loaded:', loadResult.data)
      }
    } else {
      console.error('❌ TESTING: Failed to load data after refresh simulation')
    }

    return loadResult
  }

  /**
   * Run all tests
   */
  static async runAllTests(userId: string = 'test-user-123') {
    console.log('🚀 TESTING: Running all profile persistence tests...')
    console.log('='.repeat(50))

    try {
      // Test 1: Basic save
      console.log('\n📝 Test 1: Basic Save')
      await this.testSaveProfileFields(userId)

      // Test 2: Basic load
      console.log('\n📖 Test 2: Basic Load')
      await this.testLoadProfileFields(userId)

      // Test 3: Save-load cycle
      console.log('\n🔄 Test 3: Save-Load Cycle')
      await this.testSaveLoadCycle(userId)

      // Test 4: LocalStorage status
      console.log('\n💾 Test 4: LocalStorage Status')
      this.checkLocalStorageStatus(userId)

      // Test 5: Page refresh simulation
      console.log('\n🔄 Test 5: Page Refresh Simulation')
      await this.simulatePageRefreshTest(userId)

      console.log('\n✅ TESTING: All tests completed!')
      console.log('='.repeat(50))

    } catch (error) {
      console.error('❌ TESTING: Test suite failed:', error)
    }
  }
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).ProfilePersistenceDebug = ProfilePersistenceDebug
  console.log('🔧 ProfilePersistenceDebug available globally')
  console.log('Usage: ProfilePersistenceDebug.runAllTests("your-user-id")')
}

export default ProfilePersistenceDebug