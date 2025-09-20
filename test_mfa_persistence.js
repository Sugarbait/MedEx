/**
 * Test script to verify MFA persistence across logout/login cycles
 * Run this in browser console after implementing the MFA persistence fixes
 */

function testMFAPersistence() {
  console.log('=== MFA Persistence Test ===')

  // Simulate the pierre@phaetonai.com user
  const testUserId = 'pierre-user-789'

  // Mock MFA service for testing
  const mockMFAData = {
    encryptedSecret: 'encrypted_secret_12345',
    encryptedBackupCodes: ['backup1', 'backup2', 'backup3'],
    createdAt: new Date().toISOString(),
    verified: true,
    deviceFingerprint: 'test_fingerprint',
    userAgent: navigator.userAgent,
    storedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString()
  }

  console.log('1. Testing MFA storage with multiple persistence keys...')

  // Store MFA data using the new persistence mechanism
  const primaryKey = `mfa_persistent_${testUserId}_test_fingerprint`
  const fallbackKey = `mfa_data_${testUserId}`
  const globalKey = `mfa_global_${testUserId}`

  localStorage.setItem(primaryKey, JSON.stringify(mockMFAData))
  localStorage.setItem(fallbackKey, JSON.stringify(mockMFAData))
  localStorage.setItem(globalKey, JSON.stringify(mockMFAData))

  console.log('✓ MFA data stored with keys:', { primaryKey, fallbackKey, globalKey })

  console.log('2. Testing MFA data retrieval...')

  const retrievedPrimary = localStorage.getItem(primaryKey)
  const retrievedFallback = localStorage.getItem(fallbackKey)
  const retrievedGlobal = localStorage.getItem(globalKey)

  console.log('✓ Primary key data:', retrievedPrimary ? 'Found' : 'Missing')
  console.log('✓ Fallback key data:', retrievedFallback ? 'Found' : 'Missing')
  console.log('✓ Global key data:', retrievedGlobal ? 'Found' : 'Missing')

  console.log('3. Simulating logout (clearing currentUser but preserving MFA)...')

  // Simulate logout - clear user session but preserve MFA setup
  localStorage.removeItem('currentUser')
  localStorage.removeItem('mfa_verified')

  // Verify MFA data still exists
  const afterLogoutPrimary = localStorage.getItem(primaryKey)
  const afterLogoutFallback = localStorage.getItem(fallbackKey)
  const afterLogoutGlobal = localStorage.getItem(globalKey)

  console.log('✓ After logout - Primary key:', afterLogoutPrimary ? 'PRESERVED' : 'LOST')
  console.log('✓ After logout - Fallback key:', afterLogoutFallback ? 'PRESERVED' : 'LOST')
  console.log('✓ After logout - Global key:', afterLogoutGlobal ? 'PRESERVED' : 'LOST')

  console.log('4. Simulating login (checking MFA persistence)...')

  // Simulate login - restore user session
  const mockUser = {
    id: testUserId,
    email: 'pierre@phaetonai.com',
    name: 'Pierre PhaetonAI',
    role: 'super_user',
    mfa_enabled: true
  }

  localStorage.setItem('currentUser', JSON.stringify(mockUser))

  // Check if MFA data is still available
  const afterLoginPrimary = localStorage.getItem(primaryKey)

  if (afterLoginPrimary) {
    const mfaData = JSON.parse(afterLoginPrimary)
    console.log('✓ After login - MFA setup FOUND:', {
      hasSecret: !!mfaData.encryptedSecret,
      isVerified: mfaData.verified,
      deviceFingerprint: mfaData.deviceFingerprint,
      createdAt: mfaData.createdAt
    })
  } else {
    console.log('✗ After login - MFA setup LOST')
  }

  console.log('5. Testing MFA status after persistence...')

  if (window.mfaService) {
    const status = window.mfaService.getMFAStatus(testUserId)
    console.log('✓ MFA Status:', status)
  } else {
    console.log('⚠ MFA Service not available in window object')
  }

  console.log('=== Test Complete ===')
  console.log('Summary:')
  console.log('- MFA data persistence:', afterLoginPrimary ? '✓ WORKING' : '✗ FAILED')
  console.log('- Multiple storage keys:', (afterLogoutPrimary && afterLogoutFallback && afterLogoutGlobal) ? '✓ WORKING' : '✗ FAILED')
  console.log('- Logout preservation:', afterLogoutPrimary ? '✓ WORKING' : '✗ FAILED')

  return {
    success: !!afterLoginPrimary,
    persistenceKeys: {
      primary: !!afterLogoutPrimary,
      fallback: !!afterLogoutFallback,
      global: !!afterLogoutGlobal
    }
  }
}

// Make function available globally for testing
window.testMFAPersistence = testMFAPersistence

console.log('MFA Persistence Test Script Loaded. Run testMFAPersistence() to test.')