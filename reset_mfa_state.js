/**
 * Reset MFA State Script
 * Clears all MFA data for a clean state
 */

function resetMFAState(userId = 'pierre-user-789') {
  console.log('=== Resetting MFA State ===')
  console.log('User ID:', userId)

  // Clear all local storage MFA keys
  const mfaKeys = [
    `mfa_data_${userId}`,
    `mfa_global_${userId}`,
    `mfa_persistent_${userId}_*`,  // Will need to find actual fingerprint
    'mfa_verified'
  ]

  // Find all MFA-related keys in localStorage
  const allKeys = Object.keys(localStorage)
  const mfaRelatedKeys = allKeys.filter(key =>
    key.includes('mfa') && key.includes(userId)
  )

  console.log('Found MFA-related keys:', mfaRelatedKeys)

  // Remove all MFA-related keys
  mfaRelatedKeys.forEach(key => {
    localStorage.removeItem(key)
    console.log('Removed:', key)
  })

  // Also remove general MFA keys
  localStorage.removeItem('mfa_verified')
  console.log('Removed: mfa_verified')

  console.log('✓ Local MFA state cleared')

  // If MFA service is available, use it to permanently remove MFA
  if (window.mfaService) {
    console.log('Using MFA service to permanently remove MFA setup...')

    try {
      // Use the permanentlyRemoveMFA method if available
      if (typeof window.mfaService.permanentlyRemoveMFA === 'function') {
        window.mfaService.permanentlyRemoveMFA(userId)
        console.log('✓ MFA permanently removed via service')
      } else {
        console.log('⚠ permanentlyRemoveMFA method not available')
      }
    } catch (error) {
      console.error('Error removing MFA via service:', error)
    }
  }

  // Clear any test data that might have been created
  const testKeys = allKeys.filter(key =>
    key.includes('test') && key.includes('mfa')
  )
  testKeys.forEach(key => {
    localStorage.removeItem(key)
    console.log('Removed test key:', key)
  })

  console.log('=== MFA State Reset Complete ===')
  console.log('Please refresh the page to see the updated state')

  return {
    removedKeys: mfaRelatedKeys,
    timestamp: new Date().toISOString()
  }
}

function checkMFAState(userId = 'pierre-user-789') {
  console.log('=== Checking MFA State ===')

  // Check localStorage for any MFA data
  const allKeys = Object.keys(localStorage)
  const mfaKeys = allKeys.filter(key =>
    key.includes('mfa') && key.includes(userId)
  )

  console.log('MFA-related keys found:', mfaKeys)

  mfaKeys.forEach(key => {
    const value = localStorage.getItem(key)
    console.log(`${key}:`, value ? 'HAS DATA' : 'EMPTY')
  })

  // Check if MFA service reports any setup
  if (window.mfaService) {
    console.log('Checking MFA service status...')

    // Use sync methods to avoid async issues in console
    if (typeof window.mfaService.hasMFASetupSync === 'function') {
      const hasSetup = window.mfaService.hasMFASetupSync(userId)
      const hasEnabled = window.mfaService.hasMFAEnabledSync(userId)

      console.log('Has Setup (sync):', hasSetup)
      console.log('Has Enabled (sync):', hasEnabled)
    } else {
      console.log('Sync methods not available, trying async...')

      window.mfaService.hasMFASetup(userId).then(hasSetup => {
        console.log('Has Setup (async):', hasSetup)
      }).catch(err => console.error('Error checking setup:', err))

      window.mfaService.hasMFAEnabled(userId).then(hasEnabled => {
        console.log('Has Enabled (async):', hasEnabled)
      }).catch(err => console.error('Error checking enabled:', err))
    }
  }

  return {
    mfaKeysFound: mfaKeys.length,
    keys: mfaKeys,
    timestamp: new Date().toISOString()
  }
}

// Make functions available globally
window.resetMFAState = resetMFAState
window.checkMFAState = checkMFAState

console.log('MFA Reset Script Loaded.')
console.log('Commands:')
console.log('- resetMFAState() - Clear all MFA data')
console.log('- checkMFAState() - Check current MFA state')
console.log('- resetMFAState("pierre-user-789") - Reset for specific user')