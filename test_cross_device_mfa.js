/**
 * Cross-Device MFA Persistence Test Script
 * Tests MFA synchronization across devices using Supabase cloud storage
 */

function testCrossDeviceMFA() {
  console.log('=== Cross-Device MFA Persistence Test ===')

  const testUser = {
    id: 'pierre-user-789',
    email: 'pierre@phaetonai.com',
    name: 'Pierre PhaetonAI'
  }

  console.log(`Testing cross-device MFA for: ${testUser.name} (${testUser.email})`)

  // Test phases
  const phases = [
    'Phase 1: Simulate Device A Setup',
    'Phase 2: Simulate Device B Sync',
    'Phase 3: Test Cross-Device Operations',
    'Phase 4: Verify Persistence After Logout/Login'
  ]

  console.log('\nTest Phases:')
  phases.forEach((phase, index) => {
    console.log(`${index + 1}. ${phase}`)
  })

  return {
    testPhase1: () => testDeviceASetup(testUser),
    testPhase2: () => testDeviceBSync(testUser),
    testPhase3: () => testCrossDeviceOperations(testUser),
    testPhase4: () => testPersistenceAfterLogout(testUser),
    runAllPhases: () => runAllTestPhases(testUser)
  }
}

async function testDeviceASetup(testUser) {
  console.log('\n=== Phase 1: Device A Setup ===')

  try {
    // Check if MFA service is available
    if (!window.mfaService) {
      console.error('❌ MFA Service not available')
      return false
    }

    const mfaService = window.mfaService

    console.log('1. Checking initial MFA status...')
    const initialStatus = await mfaService.getMFAStatus(testUser.id)
    console.log('Initial Status:', initialStatus)

    console.log('2. Simulating MFA setup on Device A...')

    // Mock MFA data for Device A
    const deviceAFingerprint = 'device_a_fingerprint_123'
    const mockMFAData = {
      encryptedSecret: 'encrypted_totp_secret_device_a',
      encryptedBackupCodes: ['code1_a', 'code2_a', 'code3_a'],
      verified: true,
      temporarilyDisabled: false,
      createdAt: new Date().toISOString(),
      deviceFingerprint: deviceAFingerprint,
      userAgent: 'Device A User Agent',
      storedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    }

    // Store using the internal methods (simulating MFA setup)
    if (mfaService.storeLocalMFAData) {
      mfaService.storeLocalMFAData(testUser.id, mockMFAData)
    } else {
      console.warn('⚠ storeLocalMFAData method not accessible, using localStorage directly')
      localStorage.setItem(`mfa_data_${testUser.id}`, JSON.stringify(mockMFAData))
    }

    console.log('3. Verifying MFA setup on Device A...')
    const hasSetup = await mfaService.hasMFASetup(testUser.id)
    const hasEnabled = await mfaService.hasMFAEnabled(testUser.id)

    console.log(`✓ Has Setup: ${hasSetup}`)
    console.log(`✓ Has Enabled: ${hasEnabled}`)

    const statusAfterSetup = await mfaService.getMFAStatus(testUser.id)
    console.log('Status after setup:', statusAfterSetup)

    return hasSetup && hasEnabled
  } catch (error) {
    console.error('❌ Phase 1 failed:', error)
    return false
  }
}

async function testDeviceBSync(testUser) {
  console.log('\n=== Phase 2: Device B Sync ===')

  try {
    if (!window.mfaService) {
      console.error('❌ MFA Service not available')
      return false
    }

    const mfaService = window.mfaService

    console.log('1. Simulating Device B (fresh device with no local MFA data)...')

    // Clear local storage to simulate fresh device
    const deviceBFingerprint = 'device_b_fingerprint_456'
    const keysToRemove = [
      `mfa_data_${testUser.id}`,
      `mfa_global_${testUser.id}`,
      `mfa_persistent_${testUser.id}_${deviceBFingerprint}`
    ]

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`Cleared: ${key}`)
    })

    console.log('2. Attempting to sync MFA data from cloud on Device B...')

    // Try to get MFA data (should trigger cloud sync)
    const syncedData = await mfaService.forceSyncFromCloud(testUser.id)
    console.log(`Cloud sync result: ${syncedData ? 'SUCCESS' : 'FAILED'}`)

    if (syncedData) {
      console.log('3. Verifying synced data on Device B...')
      const hasSetup = await mfaService.hasMFASetup(testUser.id)
      const hasEnabled = await mfaService.hasMFAEnabled(testUser.id)
      const status = await mfaService.getMFAStatus(testUser.id)

      console.log(`✓ Has Setup: ${hasSetup}`)
      console.log(`✓ Has Enabled: ${hasEnabled}`)
      console.log('✓ Synced Status:', status)

      return hasSetup && hasEnabled
    } else {
      console.log('❌ Failed to sync MFA data from cloud')
      return false
    }
  } catch (error) {
    console.error('❌ Phase 2 failed:', error)
    return false
  }
}

async function testCrossDeviceOperations(testUser) {
  console.log('\n=== Phase 3: Cross-Device Operations ===')

  try {
    if (!window.mfaService) {
      console.error('❌ MFA Service not available')
      return false
    }

    const mfaService = window.mfaService

    console.log('1. Testing MFA disable on current device...')
    await mfaService.disableMFA(testUser.id)

    const statusAfterDisable = await mfaService.getMFAStatus(testUser.id)
    console.log('Status after disable:', statusAfterDisable)

    console.log('2. Testing MFA re-enable...')
    const reEnabled = await mfaService.enableMFA(testUser.id)
    console.log(`Re-enable result: ${reEnabled ? 'SUCCESS' : 'FAILED'}`)

    const statusAfterEnable = await mfaService.getMFAStatus(testUser.id)
    console.log('Status after re-enable:', statusAfterEnable)

    console.log('3. Testing registered devices...')
    const registeredDevices = await mfaService.getRegisteredDevices(testUser.id)
    console.log('Registered devices:', registeredDevices)

    return reEnabled && registeredDevices.length > 0
  } catch (error) {
    console.error('❌ Phase 3 failed:', error)
    return false
  }
}

async function testPersistenceAfterLogout(testUser) {
  console.log('\n=== Phase 4: Persistence After Logout ===')

  try {
    if (!window.mfaService) {
      console.error('❌ MFA Service not available')
      return false
    }

    const mfaService = window.mfaService

    console.log('1. Recording MFA status before logout simulation...')
    const statusBeforeLogout = await mfaService.getMFAStatus(testUser.id)
    console.log('Status before logout:', statusBeforeLogout)

    console.log('2. Simulating logout (clearing session data but preserving MFA)...')
    // Clear session data but NOT MFA data
    localStorage.removeItem('currentUser')
    localStorage.removeItem('mfa_verified')

    console.log('3. Simulating login (checking MFA persistence)...')
    // Restore user session
    const mockUser = {
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      mfa_enabled: true
    }
    localStorage.setItem('currentUser', JSON.stringify(mockUser))

    console.log('4. Verifying MFA persistence after login...')
    const statusAfterLogin = await mfaService.getMFAStatus(testUser.id)
    console.log('Status after login:', statusAfterLogin)

    const persistent = statusAfterLogin.hasSetup &&
                     statusAfterLogin.isAvailableOnThisDevice &&
                     statusAfterLogin.registeredDevices.length > 0

    console.log(`✓ MFA Persistence: ${persistent ? 'SUCCESS' : 'FAILED'}`)

    return persistent
  } catch (error) {
    console.error('❌ Phase 4 failed:', error)
    return false
  }
}

async function runAllTestPhases(testUser) {
  console.log('\n=== Running All Test Phases ===')

  const results = {
    phase1: false,
    phase2: false,
    phase3: false,
    phase4: false
  }

  try {
    console.log('Starting comprehensive cross-device MFA test...')

    results.phase1 = await testDeviceASetup(testUser)
    console.log(`Phase 1 Result: ${results.phase1 ? '✅ PASS' : '❌ FAIL'}`)

    if (results.phase1) {
      results.phase2 = await testDeviceBSync(testUser)
      console.log(`Phase 2 Result: ${results.phase2 ? '✅ PASS' : '❌ FAIL'}`)
    }

    if (results.phase2) {
      results.phase3 = await testCrossDeviceOperations(testUser)
      console.log(`Phase 3 Result: ${results.phase3 ? '✅ PASS' : '❌ FAIL'}`)
    }

    if (results.phase3) {
      results.phase4 = await testPersistenceAfterLogout(testUser)
      console.log(`Phase 4 Result: ${results.phase4 ? '✅ PASS' : '❌ FAIL'}`)
    }

    const allPassed = Object.values(results).every(result => result === true)

    console.log('\n=== Final Results ===')
    console.log('Cross-Device MFA Test Results:')
    Object.entries(results).forEach(([phase, passed]) => {
      console.log(`${phase}: ${passed ? '✅ PASS' : '❌ FAIL'}`)
    })

    console.log(`\nOverall Result: ${allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)

    return {
      success: allPassed,
      results,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error)
    return {
      success: false,
      results,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

// Make functions available globally
window.testCrossDeviceMFA = testCrossDeviceMFA

console.log('Cross-Device MFA Test Script Loaded.')
console.log('Run: const test = testCrossDeviceMFA()')
console.log('Then: await test.runAllPhases() to run all tests')
console.log('Or run individual phases: test.testPhase1(), test.testPhase2(), etc.')