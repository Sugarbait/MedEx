/**
 * Emergency MFA Recovery Script for UI Issues
 * Run this in browser console to help with TOTP setup problems
 */

// Emergency recovery functions for console access
window.emergencyMFARecovery = {

  // For user: c550502f-c39d-4bb3-bb8c-d193657fdb24 (pierre@phaetonai.com)
  activateEmergencyAccess: function(userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24') {
    console.log('🚨 ACTIVATING EMERGENCY ACCESS for user:', userId)

    // Clear all corrupted MFA data
    const keysToRemove = [
      `totp_${userId}`,
      `totp_secret_${userId}`,
      `totp_enabled_${userId}`,
      `mfa_sessions_${userId}`,
      'totp_setup_temp',
      'mfa_setup_in_progress'
    ]

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log('🧹 Removed:', key)
    })

    // Create 24-hour emergency bypass
    const expiryTime = new Date()
    expiryTime.setHours(expiryTime.getHours() + 24)

    const bypassData = {
      userId,
      created: new Date().toISOString(),
      expires: expiryTime.toISOString(),
      reason: 'UI emergency recovery - TOTP setup issues'
    }

    localStorage.setItem(`mfa_emergency_bypass_${userId}`, JSON.stringify(bypassData))
    console.log('✅ 24-hour emergency bypass activated')

    // Also set TOTP session to allow immediate access
    localStorage.setItem(`totp_verified_${userId}`, 'true')
    localStorage.setItem(`totp_session_${userId}`, Date.now().toString())
    console.log('✅ Emergency TOTP session created')

    console.log('🎉 EMERGENCY ACCESS GRANTED')
    console.log('You can now access the app normally for 24 hours.')
    console.log('Please go to Settings > Security to set up fresh MFA.')

    return {
      success: true,
      message: 'Emergency access activated for 24 hours',
      expires: expiryTime.toISOString()
    }
  },

  // Clear all MFA data and reset completely
  completeMFAReset: function(userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24') {
    console.log('🔄 COMPLETE MFA RESET for user:', userId)

    // Clear localStorage
    const allKeys = Object.keys(localStorage)
    allKeys.forEach(key => {
      if (key.includes('totp') || key.includes('mfa') || key.includes(userId)) {
        localStorage.removeItem(key)
        console.log('🗑️ Removed:', key)
      }
    })

    console.log('✅ Complete MFA reset completed')
    console.log('All MFA data cleared. You can now set up fresh MFA.')

    return {
      success: true,
      message: 'Complete MFA reset completed'
    }
  },

  // Check current MFA status
  checkMFAStatus: function(userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24') {
    console.log('🔍 CHECKING MFA STATUS for user:', userId)

    const status = {
      userId,
      totpData: localStorage.getItem(`totp_${userId}`),
      totpEnabled: localStorage.getItem(`totp_enabled_${userId}`),
      totpSecret: localStorage.getItem(`totp_secret_${userId}`),
      totpVerified: localStorage.getItem(`totp_verified_${userId}`),
      emergencyBypass: localStorage.getItem(`mfa_emergency_bypass_${userId}`),
      session: localStorage.getItem(`totp_session_${userId}`)
    }

    console.table(status)

    // Check if emergency bypass is active
    const bypassData = status.emergencyBypass
    if (bypassData) {
      try {
        const parsed = JSON.parse(bypassData)
        const expiryTime = new Date(parsed.expires)
        const now = new Date()

        if (now < expiryTime) {
          console.log('🚨 Emergency bypass is ACTIVE')
          console.log('Expires:', expiryTime.toISOString())
        } else {
          console.log('⏰ Emergency bypass has EXPIRED')
        }
      } catch (e) {
        console.log('❌ Corrupted bypass data')
      }
    }

    return status
  },

  // Quick fix for UI stuck in TOTP setup
  fixStuckTOTPUI: function(userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24') {
    console.log('🔧 FIXING STUCK TOTP UI for user:', userId)

    // Activate emergency access
    this.activateEmergencyAccess(userId)

    // Try to close any modal/setup dialogs
    const modals = document.querySelectorAll('[class*="modal"], [class*="dialog"], [class*="overlay"]')
    modals.forEach(modal => {
      if (modal.style.display !== 'none') {
        modal.style.display = 'none'
        console.log('🚪 Closed modal/dialog')
      }
    })

    // Try to trigger a page refresh
    setTimeout(() => {
      console.log('🔄 Refreshing page to apply changes...')
      window.location.reload()
    }, 2000)

    return {
      success: true,
      message: 'UI fix applied, refreshing page...'
    }
  },

  // Emergency instructions
  help: function() {
    console.log(`
🚨 EMERGENCY MFA RECOVERY HELP
===============================

For user: c550502f-c39d-4bb3-bb8c-d193657fdb24 (pierre@phaetonai.com)

QUICK FIXES:
1. emergencyMFARecovery.activateEmergencyAccess()    - 24h bypass + access
2. emergencyMFARecovery.fixStuckTOTPUI()             - Fix stuck UI + refresh
3. emergencyMFARecovery.completeMFAReset()           - Clear all MFA data

DIAGNOSTICS:
- emergencyMFARecovery.checkMFAStatus()              - Check current status

THEN:
- Go to Settings > Security > Setup Fresh MFA
- Scan new QR code with authenticator app
- Complete setup normally

WARNING: Emergency bypass is temporary! Set up proper MFA within 24 hours.
    `)
  }
}

// Also expose functions directly for easier access
window.activateEmergencyAccess = window.emergencyMFARecovery.activateEmergencyAccess
window.fixStuckTOTPUI = window.emergencyMFARecovery.fixStuckTOTPUI
window.completeMFAReset = window.emergencyMFARecovery.completeMFAReset
window.checkMFAStatus = window.emergencyMFARecovery.checkMFAStatus

// Show help automatically
console.log('🚨 EMERGENCY MFA RECOVERY LOADED')
console.log('Type: emergencyMFARecovery.help() for instructions')
console.log('Quick fix: emergencyMFARecovery.fixStuckTOTPUI()')

// Auto-detect if user is stuck and offer help
setTimeout(() => {
  if (window.location.hash.includes('totp') ||
      document.querySelector('[class*="totp"], [class*="mfa"]') ||
      localStorage.getItem('totp_setup_in_progress')) {

    console.log('🚨 TOTP/MFA UI detected - Emergency recovery available')
    console.log('Run: emergencyMFARecovery.fixStuckTOTPUI()')
  }
}, 1000)

export default window.emergencyMFARecovery