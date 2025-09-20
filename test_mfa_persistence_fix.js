/**
 * Test script to verify the MFA persistence fixes
 * This should be run in the browser console to test the fixes
 */

function testMFAPersistenceFix() {
  console.log('🧪 === MFA Persistence Fix Test ===')

  const testUserId = 'pierre-user-789'
  const testEmail = 'pierre@phaetonai.com'

  console.log(`Testing MFA persistence for user: ${testUserId} (${testEmail})`)

  // Clear any existing MFA data first
  console.log('1. Clearing existing MFA data...')
  const keysToRemove = [
    `mfa_persistent_${testUserId}_*`,
    `mfa_simple_${testUserId}`,
    `mfa_data_${testUserId}`,
    `mfa_global_${testUserId}`
  ]

  // Clear localStorage keys
  Object.keys(localStorage).forEach(key => {
    if (key.includes(`mfa`) && key.includes(testUserId)) {
      localStorage.removeItem(key)
      console.log(`  Removed: ${key}`)
    }
  })

  console.log('2. Testing MFA service integration...')

  // Check if MFA service is available
  if (!window.mfaService) {
    console.error('❌ MFA Service not available in window object')
    console.log('💡 The app may not have loaded completely. Please reload and try again.')
    return false
  }

  const mfaService = window.mfaService
  console.log('✅ MFA Service found')

  // Test the enhanced localStorage storage
  console.log('3. Testing enhanced localStorage storage...')

  const mockMFAData = {
    encryptedSecret: 'test_encrypted_secret_12345',
    encryptedBackupCodes: ['backup1', 'backup2', 'backup3'],
    verified: true,
    temporarilyDisabled: false,
    createdAt: new Date().toISOString(),
    deviceFingerprint: 'test_fingerprint_123',
    userAgent: navigator.userAgent,
    storedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString()
  }

  // Test the private method by accessing it through a workaround
  try {
    // Store data using the same method the service uses
    const primaryKey = `mfa_persistent_${testUserId}_test_fingerprint`
    const simpleKey = `mfa_simple_${testUserId}`
    const fallbackKey = `mfa_data_${testUserId}`
    const globalKey = `mfa_global_${testUserId}`

    const dataToStore = JSON.stringify(mockMFAData)
    localStorage.setItem(primaryKey, dataToStore)
    localStorage.setItem(simpleKey, dataToStore)
    localStorage.setItem(fallbackKey, dataToStore)
    localStorage.setItem(globalKey, dataToStore)

    console.log('✅ MFA data stored with multiple keys')

    // Verify storage
    const verification = localStorage.getItem(simpleKey)
    if (verification) {
      console.log('✅ Storage verification successful')
    } else {
      console.error('❌ Storage verification failed')
      return false
    }
  } catch (error) {
    console.error('❌ Storage test failed:', error)
    return false
  }

  // Test MFA status checking
  console.log('4. Testing MFA status checking...')

  return new Promise(async (resolve) => {
    try {
      const hasSetup = await mfaService.hasMFASetup(testUserId)
      const hasEnabled = await mfaService.hasMFAEnabled(testUserId)
      const status = await mfaService.getMFAStatus(testUserId)

      console.log('MFA Status Results:', {
        hasSetup,
        hasEnabled,
        status: status ? {
          hasSetup: status.hasSetup,
          isEnabled: status.isEnabled,
          isAvailableOnThisDevice: status.isAvailableOnThisDevice,
          registeredDevices: status.registeredDevices?.length || 0
        } : 'null'
      })

      if (hasSetup && status && status.hasSetup) {
        console.log('✅ MFA service correctly detects stored data')
      } else {
        console.log('⚠️ MFA service may not be detecting stored data correctly')
      }

      // Test logout/login simulation
      console.log('5. Testing logout/login persistence...')

      // Simulate logout (clear session but preserve MFA)
      localStorage.removeItem('currentUser')
      localStorage.removeItem('mfa_verified')

      console.log('   Simulated logout (cleared session data)')

      // Check if MFA data persists
      const afterLogoutStatus = await mfaService.getMFAStatus(testUserId)

      console.log('   After logout status:', {
        hasSetup: afterLogoutStatus?.hasSetup,
        isAvailableOnThisDevice: afterLogoutStatus?.isAvailableOnThisDevice
      })

      // Simulate login
      const mockUser = {
        id: testUserId,
        email: testEmail,
        name: 'Pierre PhaetonAI',
        role: 'super_user',
        mfa_enabled: true
      }
      localStorage.setItem('currentUser', JSON.stringify(mockUser))

      console.log('   Simulated login (restored user session)')

      // Check if MFA data is still available
      const afterLoginStatus = await mfaService.getMFAStatus(testUserId)

      console.log('   After login status:', {
        hasSetup: afterLoginStatus?.hasSetup,
        isEnabled: afterLoginStatus?.isEnabled,
        isAvailableOnThisDevice: afterLoginStatus?.isAvailableOnThisDevice
      })

      const persistenceWorking = afterLoginStatus?.hasSetup && afterLoginStatus?.isAvailableOnThisDevice

      console.log('6. Test Results Summary:')
      console.log(`   💾 Data Storage: ✅ Working`)
      console.log(`   🔄 Service Integration: ${hasSetup ? '✅' : '❌'} ${hasSetup ? 'Working' : 'Failed'}`)
      console.log(`   🔒 Logout/Login Persistence: ${persistenceWorking ? '✅' : '❌'} ${persistenceWorking ? 'Working' : 'Failed'}`)

      const overallSuccess = hasSetup && persistenceWorking

      console.log(`\n🏁 Overall Result: ${overallSuccess ? '🎉 SUCCESS' : '❌ FAILED'}`)

      if (overallSuccess) {
        console.log('🎉 MFA persistence is now working correctly!')
        console.log('✅ Users should no longer lose MFA configuration on logout/login')
      } else {
        console.log('❌ MFA persistence still has issues that need attention')
      }

      resolve(overallSuccess)
    } catch (error) {
      console.error('❌ Test execution failed:', error)
      resolve(false)
    }
  })
}

// Test function for manual MFA setup verification
function testMFASetupFlow() {
  console.log('🧪 === MFA Setup Flow Test ===')

  const testUserId = 'pierre-user-789'
  const testEmail = 'pierre@phaetonai.com'

  console.log('This test simulates the complete MFA setup flow:')
  console.log('1. Secret generation via MFA service')
  console.log('2. Data storage with multiple persistence keys')
  console.log('3. Verification that data persists across sessions')

  if (!window.mfaService) {
    console.error('❌ MFA Service not available')
    return false
  }

  const mfaService = window.mfaService

  return new Promise(async (resolve) => {
    try {
      console.log('1. Generating MFA secret via service...')

      const mfaSecret = await mfaService.generateSecret(testUserId, testEmail)

      console.log('✅ MFA secret generated:', {
        hasSecret: !!mfaSecret.secret,
        hasQrCode: !!mfaSecret.qrCodeUrl,
        hasBackupCodes: mfaSecret.backupCodes?.length > 0,
        secretLength: mfaSecret.secret?.length
      })

      console.log('2. Checking if data was stored properly...')

      // Wait a moment for storage to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

      const hasSetup = await mfaService.hasMFASetup(testUserId)
      const status = await mfaService.getMFAStatus(testUserId)

      console.log('✅ Post-setup verification:', {
        hasSetup,
        statusAvailable: !!status,
        isAvailableOnDevice: status?.isAvailableOnThisDevice
      })

      const setupSuccessful = hasSetup && status && status.isAvailableOnThisDevice

      console.log(`\n🏁 Setup Flow Result: ${setupSuccessful ? '✅ SUCCESS' : '❌ FAILED'}`)

      resolve(setupSuccessful)
    } catch (error) {
      console.error('❌ MFA setup flow test failed:', error)
      resolve(false)
    }
  })
}

// Make functions available globally
window.testMFAPersistenceFix = testMFAPersistenceFix
window.testMFASetupFlow = testMFASetupFlow

console.log('🧪 MFA Persistence Fix Test Script Loaded')
console.log('')
console.log('Available test functions:')
console.log('• await testMFAPersistenceFix() - Test the complete persistence fix')
console.log('• await testMFASetupFlow() - Test the MFA setup integration')
console.log('')
console.log('Run these tests after the app has loaded completely.')