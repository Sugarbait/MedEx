/**
 * Test script to verify user profile persistence fix
 * Run this in the browser console to test Pierre's profile updates
 */

import { userProfileService, UserProfileData } from '@/services/userProfileService'
import { userManagementService } from '@/services/userManagementService'

export interface ProfilePersistenceTestResult {
  testName: string
  passed: boolean
  message: string
  data?: any
}

export class ProfilePersistenceTest {
  private static readonly PIERRE_USER_ID = 'pierre-user-789'
  private static readonly PIERRE_EMAIL = 'pierre@phaetonai.com'

  /**
   * Main test suite for profile persistence
   */
  static async runFullTestSuite(): Promise<ProfilePersistenceTestResult[]> {
    console.log('🧪 Starting Profile Persistence Test Suite...')

    const results: ProfilePersistenceTestResult[] = []

    try {
      // Test 1: Initial user data load
      results.push(await this.testInitialUserLoad())

      // Test 2: Profile update
      results.push(await this.testProfileUpdate())

      // Test 3: Demo user preservation
      results.push(await this.testDemoUserPreservation())

      // Test 4: Cross-session persistence simulation
      results.push(await this.testCrossSessionPersistence())

      // Test 5: Current user sync
      results.push(await this.testCurrentUserSync())

      console.log('✅ Profile Persistence Test Suite Complete!')
      console.table(results)

      return results
    } catch (error) {
      console.error('❌ Test suite failed:', error)
      results.push({
        testName: 'Test Suite Execution',
        passed: false,
        message: `Test suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      })
      return results
    }
  }

  /**
   * Test 1: Verify Pierre user can be loaded
   */
  static async testInitialUserLoad(): Promise<ProfilePersistenceTestResult> {
    try {
      console.log('🔍 Test 1: Loading Pierre user...')

      const userResponse = await userProfileService.getUserByEmail(this.PIERRE_EMAIL)

      if (userResponse.status === 'error') {
        return {
          testName: 'Initial User Load',
          passed: false,
          message: `Failed to load Pierre user: ${userResponse.error}`,
          data: userResponse
        }
      }

      if (!userResponse.data) {
        return {
          testName: 'Initial User Load',
          passed: false,
          message: 'Pierre user not found',
          data: userResponse
        }
      }

      return {
        testName: 'Initial User Load',
        passed: true,
        message: `Successfully loaded Pierre user: ${userResponse.data.name}`,
        data: userResponse.data
      }
    } catch (error) {
      return {
        testName: 'Initial User Load',
        passed: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      }
    }
  }

  /**
   * Test 2: Update Pierre's profile and verify persistence
   */
  static async testProfileUpdate(): Promise<ProfilePersistenceTestResult> {
    try {
      console.log('✏️ Test 2: Updating Pierre profile...')

      // Get current user data
      const userResponse = await userProfileService.getUserByEmail(this.PIERRE_EMAIL)
      if (userResponse.status === 'error' || !userResponse.data) {
        return {
          testName: 'Profile Update',
          passed: false,
          message: 'Could not load Pierre user for update test',
          data: userResponse
        }
      }

      // Create updated profile
      const originalName = userResponse.data.name
      const updatedProfile: UserProfileData = {
        ...userResponse.data,
        name: 'Pierre Morenzie', // Changed name
        role: 'super_user', // Changed role
        settings: {
          ...userResponse.data.settings,
          theme: 'dark', // Changed theme
          testUpdate: new Date().toISOString() // Add test marker
        }
      }

      // Save the updated profile
      const saveResponse = await userProfileService.saveUserProfile(updatedProfile)

      if (saveResponse.status === 'error') {
        return {
          testName: 'Profile Update',
          passed: false,
          message: `Failed to save updated profile: ${saveResponse.error}`,
          data: saveResponse
        }
      }

      // Verify the update persisted
      const verifyResponse = await userProfileService.getUserByEmail(this.PIERRE_EMAIL)

      if (verifyResponse.status === 'error' || !verifyResponse.data) {
        return {
          testName: 'Profile Update',
          passed: false,
          message: 'Could not verify updated profile',
          data: verifyResponse
        }
      }

      const isNameUpdated = verifyResponse.data.name === 'Pierre Morenzie'
      const isRoleUpdated = verifyResponse.data.role === 'super_user'
      const hasTestMarker = verifyResponse.data.settings.testUpdate

      if (isNameUpdated && isRoleUpdated && hasTestMarker) {
        return {
          testName: 'Profile Update',
          passed: true,
          message: `Profile successfully updated: ${originalName} → ${verifyResponse.data.name}`,
          data: {
            original: originalName,
            updated: verifyResponse.data.name,
            role: verifyResponse.data.role,
            testMarker: hasTestMarker
          }
        }
      } else {
        return {
          testName: 'Profile Update',
          passed: false,
          message: `Profile update not fully persisted. Name: ${isNameUpdated}, Role: ${isRoleUpdated}, Marker: ${!!hasTestMarker}`,
          data: {
            expected: updatedProfile,
            actual: verifyResponse.data,
            nameMatch: isNameUpdated,
            roleMatch: isRoleUpdated,
            markerExists: !!hasTestMarker
          }
        }
      }
    } catch (error) {
      return {
        testName: 'Profile Update',
        passed: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      }
    }
  }

  /**
   * Test 3: Verify demo users are preserved (not reset by hardcoded values)
   */
  static async testDemoUserPreservation(): Promise<ProfilePersistenceTestResult> {
    try {
      console.log('🔒 Test 3: Testing demo user preservation...')

      // Load all system users
      const usersResponse = await userProfileService.loadSystemUsers()

      if (usersResponse.status === 'error') {
        return {
          testName: 'Demo User Preservation',
          passed: false,
          message: `Failed to load system users: ${usersResponse.error}`,
          data: usersResponse
        }
      }

      const users = usersResponse.data || []
      const pierreUser = users.find(u => u.id === this.PIERRE_USER_ID)

      if (!pierreUser) {
        return {
          testName: 'Demo User Preservation',
          passed: false,
          message: 'Pierre user not found in system users',
          data: users
        }
      }

      // Check if test marker from previous test exists
      const hasTestMarker = pierreUser.settings?.testUpdate
      const hasUpdatedName = pierreUser.name === 'Pierre Morenzie'

      if (hasTestMarker && hasUpdatedName) {
        return {
          testName: 'Demo User Preservation',
          passed: true,
          message: 'Demo user changes preserved after system users reload',
          data: {
            user: pierreUser,
            testMarker: hasTestMarker,
            updatedName: hasUpdatedName
          }
        }
      } else {
        return {
          testName: 'Demo User Preservation',
          passed: false,
          message: `Demo user changes not preserved. Test marker: ${!!hasTestMarker}, Updated name: ${hasUpdatedName}`,
          data: {
            user: pierreUser,
            testMarker: hasTestMarker,
            updatedName: hasUpdatedName
          }
        }
      }
    } catch (error) {
      return {
        testName: 'Demo User Preservation',
        passed: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      }
    }
  }

  /**
   * Test 4: Simulate cross-session persistence (logout/login simulation)
   */
  static async testCrossSessionPersistence(): Promise<ProfilePersistenceTestResult> {
    try {
      console.log('🔄 Test 4: Simulating cross-session persistence...')

      // Clear cache to simulate fresh session
      userProfileService.clearCache()

      // Simulate logout by clearing current user (but keep system data)
      const originalCurrentUser = localStorage.getItem('currentUser')

      // Load Pierre user fresh (as if after login)
      const freshLoadResponse = await userProfileService.getUserByEmail(this.PIERRE_EMAIL)

      if (freshLoadResponse.status === 'error' || !freshLoadResponse.data) {
        return {
          testName: 'Cross-Session Persistence',
          passed: false,
          message: 'Could not load Pierre user in fresh session simulation',
          data: freshLoadResponse
        }
      }

      const freshUser = freshLoadResponse.data
      const hasTestMarker = freshUser.settings?.testUpdate
      const hasUpdatedName = freshUser.name === 'Pierre Morenzie'
      const hasCorrectRole = freshUser.role === 'super_user'

      // Restore original current user if it existed
      if (originalCurrentUser) {
        localStorage.setItem('currentUser', originalCurrentUser)
      }

      if (hasTestMarker && hasUpdatedName && hasCorrectRole) {
        return {
          testName: 'Cross-Session Persistence',
          passed: true,
          message: 'Profile changes persist across sessions',
          data: {
            name: freshUser.name,
            role: freshUser.role,
            testMarker: hasTestMarker
          }
        }
      } else {
        return {
          testName: 'Cross-Session Persistence',
          passed: false,
          message: `Cross-session persistence failed. Name: ${hasUpdatedName}, Role: ${hasCorrectRole}, Marker: ${!!hasTestMarker}`,
          data: {
            user: freshUser,
            expectedName: 'Pierre Morenzie',
            actualName: freshUser.name,
            expectedRole: 'super_user',
            actualRole: freshUser.role,
            testMarker: hasTestMarker
          }
        }
      }
    } catch (error) {
      return {
        testName: 'Cross-Session Persistence',
        passed: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      }
    }
  }

  /**
   * Test 5: Verify current user localStorage sync
   */
  static async testCurrentUserSync(): Promise<ProfilePersistenceTestResult> {
    try {
      console.log('🔄 Test 5: Testing current user sync...')

      // Set Pierre as current user
      const userResponse = await userProfileService.getUserByEmail(this.PIERRE_EMAIL)
      if (userResponse.status === 'error' || !userResponse.data) {
        return {
          testName: 'Current User Sync',
          passed: false,
          message: 'Could not load Pierre user for sync test',
          data: userResponse
        }
      }

      const pierreUser = userResponse.data

      // Set as current user
      localStorage.setItem('currentUser', JSON.stringify(pierreUser))

      // Update profile with new data
      const updatedProfile: UserProfileData = {
        ...pierreUser,
        name: 'Pierre Sync Test',
        settings: {
          ...pierreUser.settings,
          syncTestMarker: new Date().toISOString()
        }
      }

      // Save profile (should trigger currentUser sync)
      const saveResponse = await userProfileService.saveUserProfile(updatedProfile)

      if (saveResponse.status === 'error') {
        return {
          testName: 'Current User Sync',
          passed: false,
          message: `Failed to save profile for sync test: ${saveResponse.error}`,
          data: saveResponse
        }
      }

      // Check if currentUser was updated
      const updatedCurrentUser = localStorage.getItem('currentUser')
      if (!updatedCurrentUser) {
        return {
          testName: 'Current User Sync',
          passed: false,
          message: 'Current user was not found in localStorage after update',
          data: null
        }
      }

      const currentUserData = JSON.parse(updatedCurrentUser)
      const hasSyncedName = currentUserData.name === 'Pierre Sync Test'
      const hasSyncMarker = currentUserData.settings?.syncTestMarker

      if (hasSyncedName && hasSyncMarker) {
        return {
          testName: 'Current User Sync',
          passed: true,
          message: 'Current user localStorage properly synced with profile updates',
          data: {
            syncedName: currentUserData.name,
            syncMarker: hasSyncMarker
          }
        }
      } else {
        return {
          testName: 'Current User Sync',
          passed: false,
          message: `Current user sync failed. Name synced: ${hasSyncedName}, Sync marker: ${!!hasSyncMarker}`,
          data: {
            expected: updatedProfile,
            actualCurrentUser: currentUserData,
            nameSynced: hasSyncedName,
            markerSynced: !!hasSyncMarker
          }
        }
      }
    } catch (error) {
      return {
        testName: 'Current User Sync',
        passed: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      }
    }
  }

  /**
   * Quick test to verify the fix works
   */
  static async quickPierreTest(): Promise<boolean> {
    try {
      console.log('🚀 Quick Pierre Profile Test...')

      // Load Pierre
      const userResponse = await userProfileService.getUserByEmail(this.PIERRE_EMAIL)
      if (userResponse.status === 'error' || !userResponse.data) {
        console.error('❌ Could not load Pierre user')
        return false
      }

      console.log('📋 Original Pierre:', userResponse.data.name, userResponse.data.role)

      // Update to Morenzie with Super User role
      const updatedProfile: UserProfileData = {
        ...userResponse.data,
        name: 'Pierre Morenzie',
        role: 'super_user'
      }

      const saveResponse = await userProfileService.saveUserProfile(updatedProfile)
      if (saveResponse.status === 'error') {
        console.error('❌ Could not save updated profile:', saveResponse.error)
        return false
      }

      console.log('✅ Profile updated successfully')

      // Verify persistence by reloading
      userProfileService.clearCache()
      const verifyResponse = await userProfileService.getUserByEmail(this.PIERRE_EMAIL)

      if (verifyResponse.status === 'error' || !verifyResponse.data) {
        console.error('❌ Could not verify updated profile')
        return false
      }

      const isCorrect = verifyResponse.data.name === 'Pierre Morenzie' && verifyResponse.data.role === 'super_user'

      console.log('🔍 Verification result:', verifyResponse.data.name, verifyResponse.data.role)
      console.log(isCorrect ? '✅ Test PASSED' : '❌ Test FAILED')

      return isCorrect
    } catch (error) {
      console.error('❌ Quick test failed:', error)
      return false
    }
  }
}

// Export to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).ProfilePersistenceTest = ProfilePersistenceTest
  (window as any).testPierreProfile = ProfilePersistenceTest.quickPierreTest
  (window as any).testProfilePersistence = ProfilePersistenceTest.runFullTestSuite
}

export default ProfilePersistenceTest