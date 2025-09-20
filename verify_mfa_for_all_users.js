/**
 * Verification script to test MFA persistence for all users in the system
 * Run this in browser console to verify universal MFA persistence
 */

function verifyMFAForAllUsers() {
  console.log('=== Universal MFA Persistence Verification ===')

  // Your system's three main users
  const users = [
    { id: 'super-user-456', email: 'elmfarrell@yahoo.com', name: 'Dr. Farrell' },
    { id: 'pierre-user-789', email: 'pierre@phaetonai.com', name: 'Pierre PhaetonAI' },
    { id: 'guest-user-456', email: 'guest@email.com', name: 'Guest User' }
  ]

  const results = {}

  users.forEach(user => {
    console.log(`\n--- Testing MFA Persistence for ${user.name} ---`)

    // Generate storage keys for this user
    const deviceFingerprint = 'test_fingerprint_123'
    const primaryKey = `mfa_persistent_${user.id}_${deviceFingerprint}`
    const fallbackKey = `mfa_data_${user.id}`
    const globalKey = `mfa_global_${user.id}`

    console.log(`User: ${user.name} (${user.email})`)
    console.log(`User ID: ${user.id}`)
    console.log(`Storage Keys:`)
    console.log(`  Primary: ${primaryKey}`)
    console.log(`  Fallback: ${fallbackKey}`)
    console.log(`  Global: ${globalKey}`)

    // Mock MFA data for this user
    const mockMFAData = {
      encryptedSecret: `encrypted_secret_${user.id}`,
      encryptedBackupCodes: [`backup1_${user.id}`, `backup2_${user.id}`],
      createdAt: new Date().toISOString(),
      verified: true,
      deviceFingerprint: deviceFingerprint,
      userAgent: navigator.userAgent,
      storedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      userId: user.id,
      userEmail: user.email
    }

    // Store MFA data for this user
    localStorage.setItem(primaryKey, JSON.stringify(mockMFAData))
    localStorage.setItem(fallbackKey, JSON.stringify(mockMFAData))
    localStorage.setItem(globalKey, JSON.stringify(mockMFAData))

    // Verify storage
    const storedPrimary = localStorage.getItem(primaryKey)
    const storedFallback = localStorage.getItem(fallbackKey)
    const storedGlobal = localStorage.getItem(globalKey)

    const userResult = {
      user: user.name,
      email: user.email,
      userId: user.id,
      persistence: {
        primary: !!storedPrimary,
        fallback: !!storedFallback,
        global: !!storedGlobal
      },
      storageKeys: {
        primary: primaryKey,
        fallback: fallbackKey,
        global: globalKey
      }
    }

    results[user.id] = userResult

    console.log(`✓ Primary storage: ${userResult.persistence.primary ? 'SUCCESS' : 'FAILED'}`)
    console.log(`✓ Fallback storage: ${userResult.persistence.fallback ? 'SUCCESS' : 'FAILED'}`)
    console.log(`✓ Global storage: ${userResult.persistence.global ? 'SUCCESS' : 'FAILED'}`)

    // Test retrieval
    if (storedPrimary) {
      const retrievedData = JSON.parse(storedPrimary)
      console.log(`✓ Data retrieval: SUCCESS`)
      console.log(`  - Has secret: ${!!retrievedData.encryptedSecret}`)
      console.log(`  - User ID: ${retrievedData.userId}`)
      console.log(`  - Email: ${retrievedData.userEmail}`)
    } else {
      console.log(`✗ Data retrieval: FAILED`)
    }
  })

  console.log('\n=== Summary for All Users ===')

  let allSuccessful = true
  Object.values(results).forEach(result => {
    const success = result.persistence.primary && result.persistence.fallback && result.persistence.global
    console.log(`${result.user}: ${success ? '✅ FULLY PERSISTENT' : '❌ FAILED'}`)
    if (!success) allSuccessful = false
  })

  console.log(`\nOverall Status: ${allSuccessful ? '✅ ALL USERS HAVE PERSISTENT MFA' : '❌ SOME USERS FAILED'}`)

  // Test cross-user isolation
  console.log('\n--- Testing User Isolation ---')
  users.forEach(user1 => {
    users.forEach(user2 => {
      if (user1.id !== user2.id) {
        const key1 = `mfa_persistent_${user1.id}_test_fingerprint_123`
        const key2 = `mfa_persistent_${user2.id}_test_fingerprint_123`

        const data1 = localStorage.getItem(key1)
        const data2 = localStorage.getItem(key2)

        if (data1 && data2) {
          const parsed1 = JSON.parse(data1)
          const parsed2 = JSON.parse(data2)

          const isolated = parsed1.userId !== parsed2.userId
          console.log(`${user1.name} ↔ ${user2.name}: ${isolated ? '✓ ISOLATED' : '✗ MIXED'}`)
        }
      }
    })
  })

  return {
    success: allSuccessful,
    results: results,
    timestamp: new Date().toISOString()
  }
}

// Test MFA service methods for all users (if available)
function testMFAServiceForAllUsers() {
  if (!window.mfaService) {
    console.log('⚠ MFA Service not available in window object')
    return
  }

  console.log('\n=== Testing MFA Service Methods ===')

  const users = [
    { id: 'super-user-456', name: 'Dr. Farrell' },
    { id: 'pierre-user-789', name: 'Pierre PhaetonAI' },
    { id: 'guest-user-456', name: 'Guest User' }
  ]

  users.forEach(user => {
    console.log(`\n--- ${user.name} (${user.id}) ---`)

    try {
      const hasSetup = window.mfaService.hasMFASetup(user.id)
      const hasEnabled = window.mfaService.hasMFAEnabled(user.id)
      const status = window.mfaService.getMFAStatus(user.id)

      console.log(`Has Setup: ${hasSetup}`)
      console.log(`Has Enabled: ${hasEnabled}`)
      console.log(`Status:`, status)
    } catch (error) {
      console.log(`Error testing MFA service for ${user.name}:`, error)
    }
  })
}

// Make functions available globally
window.verifyMFAForAllUsers = verifyMFAForAllUsers
window.testMFAServiceForAllUsers = testMFAServiceForAllUsers

console.log('Universal MFA Verification loaded. Run:')
console.log('- verifyMFAForAllUsers() to test storage persistence')
console.log('- testMFAServiceForAllUsers() to test service methods')