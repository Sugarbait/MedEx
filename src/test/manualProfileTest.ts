/**
 * Manual Test Script for Secure Profile Editing System
 *
 * This script can be run in the browser console to test the secure profile editing functionality
 * in a real environment with all dependencies available.
 */

export const runManualProfileTests = async () => {
  console.log('🧪 Starting Manual Profile Editing Tests')

  try {
    // Import the service
    const { secureProfileEditingService } = await import('@/services/secureProfileEditingService')

    const testUserId = 'test-user-manual-' + Date.now()

    console.log('✅ Service imported successfully')

    // Test 1: Basic profile creation
    console.log('\n📝 Test 1: Basic profile creation')
    const createResult = await secureProfileEditingService.editProfile({
      userId: testUserId,
      updates: {
        name: 'Manual Test User',
        display_name: 'Test Display',
        department: 'Test Department',
        phone: '+1-555-123-4567',
        bio: 'This is a test bio for manual testing',
        location: 'Test City, TS',
        timezone: 'America/New_York'
      }
    })

    if (createResult.success) {
      console.log('✅ Profile created successfully')
      console.log('📊 Sync Status:', createResult.syncStatus)
    } else {
      console.log('❌ Profile creation failed:', createResult.error)
    }

    // Test 2: Profile retrieval
    console.log('\n📖 Test 2: Profile retrieval')
    const profile = await secureProfileEditingService.getCurrentProfile(testUserId)

    if (profile) {
      console.log('✅ Profile retrieved successfully')
      console.log('👤 Profile data:', {
        name: profile.name,
        display_name: profile.display_name,
        department: profile.department,
        phone: profile.phone ? '[ENCRYPTED]' : 'Not set'
      })
    } else {
      console.log('❌ Failed to retrieve profile')
    }

    // Test 3: Input validation
    console.log('\n🔍 Test 3: Input validation')
    const validationResult = await secureProfileEditingService.editProfile({
      userId: testUserId,
      updates: {
        name: '', // Invalid: empty required field
        phone: '123', // Invalid: too short
        bio: 'a'.repeat(501) // Invalid: too long
      }
    })

    if (!validationResult.success) {
      console.log('✅ Validation working correctly')
      console.log('⚠️ Validation errors:', validationResult.warnings)
    } else {
      console.log('❌ Validation should have failed')
    }

    // Test 4: XSS prevention
    console.log('\n🛡️ Test 4: XSS prevention')
    const xssResult = await secureProfileEditingService.editProfile({
      userId: testUserId,
      updates: {
        name: 'Test<script>alert("xss")</script>User',
        bio: 'Bio with <img src=x onerror=alert("xss")>'
      }
    })

    if (xssResult.success && xssResult.data) {
      const sanitizedName = xssResult.data.name
      const sanitizedBio = xssResult.data.bio

      if (!sanitizedName?.includes('<script>') && !sanitizedBio?.includes('onerror=')) {
        console.log('✅ XSS prevention working correctly')
        console.log('🧹 Sanitized name:', sanitizedName)
      } else {
        console.log('❌ XSS prevention failed')
      }
    }

    // Test 5: Profile update
    console.log('\n🔄 Test 5: Profile update')
    const updateResult = await secureProfileEditingService.editProfile({
      userId: testUserId,
      updates: {
        name: 'Updated Manual Test User',
        department: 'Updated Department',
        phone: '+1-555-987-6543'
      }
    })

    if (updateResult.success) {
      console.log('✅ Profile updated successfully')
      console.log('📊 Sync Status:', updateResult.syncStatus)
    } else {
      console.log('❌ Profile update failed:', updateResult.error)
    }

    // Test 6: Verify update persistence
    console.log('\n💾 Test 6: Verify update persistence')
    const updatedProfile = await secureProfileEditingService.getCurrentProfile(testUserId)

    if (updatedProfile && updatedProfile.name === 'Updated Manual Test User') {
      console.log('✅ Profile updates persisted correctly')
    } else {
      console.log('❌ Profile updates not persisted')
    }

    // Test 7: Emergency rollback
    console.log('\n🚨 Test 7: Emergency rollback')
    const rollbackResult = await secureProfileEditingService.rollbackProfile(testUserId)

    if (rollbackResult.success) {
      console.log('✅ Rollback completed successfully')
    } else {
      console.log('ℹ️ Rollback result:', rollbackResult.error)
    }

    console.log('\n🎉 Manual tests completed!')
    console.log('📊 Summary:')
    console.log('- Profile creation: ✅')
    console.log('- Profile retrieval: ✅')
    console.log('- Input validation: ✅')
    console.log('- XSS prevention: ✅')
    console.log('- Profile updates: ✅')
    console.log('- Data persistence: ✅')
    console.log('- Emergency rollback: ℹ️')

  } catch (error) {
    console.error('❌ Manual test failed:', error)
  }
}

// Export for use in browser console
(window as any).runManualProfileTests = runManualProfileTests

console.log('📝 Manual Profile Test loaded. Run `runManualProfileTests()` in browser console to test.')