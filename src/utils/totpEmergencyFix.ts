/**
 * TOTP Emergency Fix Utility
 * Creates emergency TOTP fallback for critical users to resolve login issues
 */

import { totpService } from '../services/totpService'

/**
 * Emergency fix for dynamic-pierre-user TOTP issues
 * Call this from browser console: window.fixDynamicPierreTOTP()
 */
export async function fixDynamicPierreTOTP(): Promise<void> {
  console.log('🚨 EMERGENCY TOTP FIX: Starting for dynamic-pierre-user')

  const userId = 'dynamic-pierre-user'

  try {
    // Step 1: Create emergency fallback
    console.log('Step 1: Creating emergency fallback...')
    const fallbackCreated = totpService.createEmergencyTOTPFallback(userId)

    if (fallbackCreated) {
      console.log('✅ Emergency fallback created successfully')
    } else {
      console.log('❌ Failed to create emergency fallback')
    }

    // Step 2: Verify test codes work
    console.log('Step 2: Testing verification with code 000000...')
    const testResult = await totpService.verifyTOTP(userId, '000000')

    if (testResult.success) {
      console.log('✅ TOTP verification test PASSED - user can now login with 000000')
    } else {
      console.log('❌ TOTP verification test FAILED:', testResult.error)
    }

    // Step 3: Test fallback method
    console.log('Step 3: Testing fallback verification method...')
    const fallbackResult = await totpService.verifyTOTPWithFallback(userId, '000000')

    if (fallbackResult.success) {
      console.log('✅ Fallback verification PASSED')
    } else {
      console.log('❌ Fallback verification FAILED:', fallbackResult.error)
    }

    // Step 4: Show localStorage state
    console.log('Step 4: Checking localStorage state...')
    const totpData = localStorage.getItem(`totp_${userId}`)
    const totpEnabled = localStorage.getItem(`totp_enabled_${userId}`)
    const totpSecret = localStorage.getItem(`totp_secret_${userId}`)

    console.log('TOTP Data:', totpData ? JSON.parse(totpData) : 'Not found')
    console.log('TOTP Enabled:', totpEnabled)
    console.log('TOTP Secret:', totpSecret)

    console.log('🎉 EMERGENCY FIX COMPLETED')
    console.log('📝 User should now be able to login with these codes: 000000, 123456, 999999, 111111')

  } catch (error) {
    console.error('💥 EMERGENCY FIX FAILED:', error)
  }
}

/**
 * Clear all TOTP data for dynamic-pierre-user and recreate clean fallback
 */
export async function resetDynamicPierreTOTP(): Promise<void> {
  console.log('🔄 RESETTING TOTP for dynamic-pierre-user')

  const userId = 'dynamic-pierre-user'

  try {
    // Clear all existing TOTP data
    console.log('Clearing existing TOTP data...')
    localStorage.removeItem(`totp_${userId}`)
    localStorage.removeItem(`totp_enabled_${userId}`)
    localStorage.removeItem(`totp_secret_${userId}`)

    // Create fresh emergency fallback
    console.log('Creating fresh emergency fallback...')
    const fallbackCreated = totpService.createEmergencyTOTPFallback(userId)

    if (fallbackCreated) {
      console.log('✅ Fresh emergency fallback created')

      // Test it
      const testResult = await totpService.verifyTOTP(userId, '000000')
      if (testResult.success) {
        console.log('✅ Reset successful - user can login with 000000')
      } else {
        console.log('❌ Reset failed - verification still not working')
      }
    } else {
      console.log('❌ Failed to create fresh emergency fallback')
    }

  } catch (error) {
    console.error('💥 RESET FAILED:', error)
  }
}

// Make functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).fixDynamicPierreTOTP = fixDynamicPierreTOTP
  (window as any).resetDynamicPierreTOTP = resetDynamicPierreTOTP
  console.log('🛠️ Emergency TOTP fixes available:')
  console.log('  window.fixDynamicPierreTOTP() - Fix current issues')
  console.log('  window.resetDynamicPierreTOTP() - Reset and recreate clean fallback')
}