/**
 * Quick Logout Test - Run this in browser console
 */

console.log('🧪 Quick Logout Test Starting...')

// Step 1: Check current state
console.log('\n📋 STEP 1: Current State Check')
const currentState = {
  justLoggedOut: localStorage.getItem('justLoggedOut'),
  currentUser: localStorage.getItem('currentUser'),
  sessionCredentials: sessionStorage.getItem('retell_credentials_backup'),
  emergencyCredentials: localStorage.getItem('__emergencyRetellCredentials'),
  memoryCredentials: window.__retellCredentialsBackup,
  settingsCount: Object.keys(localStorage).filter(key => key.startsWith('settings_')).length
}
console.log('Current State:', currentState)

// Step 2: Set logout flag to test prevention
console.log('\n📋 STEP 2: Setting justLoggedOut flag')
localStorage.setItem('justLoggedOut', 'true')
console.log('✅ justLoggedOut flag set to:', localStorage.getItem('justLoggedOut'))

// Step 3: Test if credential storage is prevented
console.log('\n📋 STEP 3: Testing Credential Storage Prevention')

// Clear existing credentials first
sessionStorage.removeItem('retell_credentials_backup')
localStorage.removeItem('__emergencyRetellCredentials')
if (window.__retellCredentialsBackup) {
  delete window.__retellCredentialsBackup
}

// Try to manually trigger credential storage (this should be prevented)
console.log('Attempting to trigger credential storage...')

// Check if bulletproof system respects the flag
if (window.retellService && window.retellService.forceUpdateCredentials) {
  try {
    console.log('Testing retellService.forceUpdateCredentials()...')
    window.retellService.forceUpdateCredentials()
  } catch (error) {
    console.log('RetellService error (this might be expected):', error.message)
  }
}

if (window.bulletproofCredentialInitializer && window.bulletproofCredentialInitializer.initialize) {
  try {
    console.log('Testing bulletproofCredentialInitializer.initialize()...')
    window.bulletproofCredentialInitializer.initialize()
  } catch (error) {
    console.log('BulletproofCredentialInitializer error (this might be expected):', error.message)
  }
}

// Step 4: Check if prevention worked
console.log('\n📋 STEP 4: Checking Prevention Results')
setTimeout(() => {
  const afterState = {
    justLoggedOut: localStorage.getItem('justLoggedOut'),
    sessionCredentials: sessionStorage.getItem('retell_credentials_backup'),
    emergencyCredentials: localStorage.getItem('__emergencyRetellCredentials'),
    memoryCredentials: window.__retellCredentialsBackup,
    settingsCount: Object.keys(localStorage).filter(key => key.startsWith('settings_')).length
  }

  console.log('After Prevention Test:', afterState)

  // Determine if prevention worked
  const preventionWorked = !afterState.sessionCredentials &&
                          !afterState.emergencyCredentials &&
                          !afterState.memoryCredentials

  console.log(`\n🎯 PREVENTION TEST: ${preventionWorked ? '✅ PASSED' : '❌ FAILED'}`)

  if (!preventionWorked) {
    console.log('❌ Issues found:')
    if (afterState.sessionCredentials) console.log('  - SessionStorage credentials still exist')
    if (afterState.emergencyCredentials) console.log('  - Emergency credentials still exist')
    if (afterState.memoryCredentials) console.log('  - Memory credentials still exist')
  } else {
    console.log('✅ All credential storage successfully prevented!')
  }

  // Step 5: Clean up test
  console.log('\n📋 STEP 5: Cleaning up test')
  localStorage.removeItem('justLoggedOut')
  console.log('✅ Test cleanup completed')

}, 2000)

console.log('\n💡 Test will complete in 2 seconds...')