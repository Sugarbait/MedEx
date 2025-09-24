/**
 * Emergency MFA Escape Script
 *
 * IMMEDIATE FIX FOR MFA MODAL TRAP ISSUE
 *
 * This script provides immediate escape from the MFA modal trap by:
 * 1. Activating emergency TOTP bypass for the trapped user
 * 2. Clearing problematic MFA session data
 * 3. Providing console commands for ongoing management
 *
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter to execute
 * 4. Refresh the page - you should now have access
 */

console.log('🚨 EMERGENCY MFA ESCAPE SCRIPT LOADING...')

// User IDs that are known to be trapped
const TRAPPED_USER_IDS = [
  'dynamic-pierre-user',
  'c550502f-c39d-4bb3-bb8c-d193657fdb24',
  'pierre@phaetonai.com'
]

// Emergency bypass duration (24 hours)
const EMERGENCY_BYPASS_EXPIRY = 24 * 60 * 60 * 1000

// Function to activate emergency bypass
function activateEmergencyTOTPBypass(userId) {
  const bypassKey = `emergency_totp_bypass_${userId}`
  const expiryTime = Date.now() + EMERGENCY_BYPASS_EXPIRY

  localStorage.setItem(bypassKey, 'active')
  localStorage.setItem(`${bypassKey}_expiry`, expiryTime.toString())

  console.warn(`🚨 EMERGENCY TOTP BYPASS ACTIVATED for user: ${userId}`)
  console.log(`⏰ Expires: ${new Date(expiryTime).toISOString()}`)

  return true
}

// Function to clear all MFA-related session data that might be causing issues
function clearProblematicMFAData() {
  console.log('🧹 Clearing problematic MFA session data...')

  const keysToRemove = []

  // Find all MFA/TOTP related keys
  for (const key of Object.keys(localStorage)) {
    if (
      key.startsWith('mfa_') ||
      key.startsWith('totp_') ||
      key.startsWith('totpSecret_') ||
      key.startsWith('mfa_secret_') ||
      key.includes('totpEnabled') ||
      key.includes('mfaEnabled')
    ) {
      keysToRemove.push(key)
    }
  }

  // Remove the problematic keys
  keysToRemove.forEach(key => {
    console.log(`  Removing: ${key}`)
    localStorage.removeItem(key)
  })

  console.log(`✅ Removed ${keysToRemove.length} problematic MFA keys`)
  return keysToRemove.length
}

// Main emergency fix function
function emergencyMFAEscape() {
  console.log('🚨 EXECUTING EMERGENCY MFA ESCAPE...')

  let activatedUsers = 0

  // Activate bypass for all known trapped users
  TRAPPED_USER_IDS.forEach(userId => {
    activateEmergencyTOTPBypass(userId)
    activatedUsers++
  })

  // Clear problematic data
  const removedKeys = clearProblematicMFAData()

  // Set emergency session data
  sessionStorage.setItem('emergency_mfa_bypass', 'active')
  sessionStorage.setItem('emergency_mfa_bypass_expires', (Date.now() + EMERGENCY_BYPASS_EXPIRY).toString())

  console.log('✅ EMERGENCY ESCAPE COMPLETE!')
  console.log(`   - Activated bypass for ${activatedUsers} users`)
  console.log(`   - Removed ${removedKeys} problematic localStorage keys`)
  console.log(`   - Set emergency session bypass`)
  console.log('')
  console.log('🔄 NEXT STEPS:')
  console.log('   1. Refresh the page (F5 or Ctrl+R)')
  console.log('   2. You should now have access to the application')
  console.log('   3. Navigate to Settings to properly configure MFA when ready')
  console.log('')
  console.log('⚠️  Emergency bypass expires in 24 hours')

  return true
}

// Create global emergency functions for ongoing use
window.emergencyMFA = {
  escape: emergencyMFAEscape,
  activateBypass: activateEmergencyTOTPBypass,
  clearData: clearProblematicMFAData,

  // Check current bypass status
  checkStatus: () => {
    console.log('🔍 EMERGENCY BYPASS STATUS:')

    TRAPPED_USER_IDS.forEach(userId => {
      const bypassKey = `emergency_totp_bypass_${userId}`
      const expiry = localStorage.getItem(`${bypassKey}_expiry`)

      if (expiry && Date.now() < parseInt(expiry)) {
        const remainingTime = parseInt(expiry) - Date.now()
        const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000))
        const remainingMinutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000))

        console.log(`   ✅ ${userId}: ACTIVE (${remainingHours}h ${remainingMinutes}m remaining)`)
      } else {
        console.log(`   ❌ ${userId}: INACTIVE`)
      }
    })

    const sessionBypass = sessionStorage.getItem('emergency_mfa_bypass')
    const sessionExpiry = sessionStorage.getItem('emergency_mfa_bypass_expires')

    if (sessionBypass === 'active' && sessionExpiry && Date.now() < parseInt(sessionExpiry)) {
      const remainingTime = parseInt(sessionExpiry) - Date.now()
      const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000))
      console.log(`   ✅ Session bypass: ACTIVE (${remainingHours}h remaining)`)
    } else {
      console.log(`   ❌ Session bypass: INACTIVE`)
    }
  },

  // Manual activation for specific user
  activate: (userId) => {
    if (!userId) {
      console.error('❌ Please provide a user ID: emergencyMFA.activate("your-user-id")')
      return false
    }

    return activateEmergencyTOTPBypass(userId)
  }
}

// Execute the emergency escape immediately
console.log('🚨 EXECUTING IMMEDIATE EMERGENCY ESCAPE...')
emergencyMFAEscape()

console.log('')
console.log('📋 AVAILABLE EMERGENCY COMMANDS:')
console.log('   emergencyMFA.escape()           - Run full emergency escape')
console.log('   emergencyMFA.checkStatus()      - Check bypass status')
console.log('   emergencyMFA.activate(userId)   - Activate bypass for specific user')
console.log('   emergencyMFA.clearData()        - Clear problematic MFA data')
console.log('')
console.log('🔄 NOW REFRESH THE PAGE TO ACCESS THE APPLICATION!')