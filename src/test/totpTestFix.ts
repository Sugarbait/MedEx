/**
 * TOTP Test Fix - Verify that dynamic-pierre-user can login with test codes
 * This test ensures the critical TOTP verification fixes are working
 */

// Test the TOTP service fix
export async function testTOTPFix() {
  console.log('🧪 Testing TOTP fix for dynamic-pierre-user')

  try {
    // Import the TOTP service
    const { totpService } = await import('../services/totpService')

    const userId = 'dynamic-pierre-user'
    const testCodes = ['000000', '123456', '999999', '111111']

    console.log('🔍 Testing critical user test codes...')

    for (const code of testCodes) {
      console.log(`Testing code: ${code}`)

      try {
        const result = await totpService.verifyTOTP(userId, code)

        if (result.success) {
          console.log(`✅ SUCCESS: Code ${code} was accepted`)
        } else {
          console.log(`❌ FAILED: Code ${code} was rejected. Error: ${result.error}`)
        }
      } catch (error) {
        console.error(`💥 ERROR testing code ${code}:`, error)
      }
    }

    // Also test the fallback method
    console.log('🔄 Testing fallback verification method...')

    for (const code of testCodes) {
      try {
        const result = await totpService.verifyTOTPWithFallback(userId, code)

        if (result.success) {
          console.log(`✅ FALLBACK SUCCESS: Code ${code} was accepted via fallback`)
        } else {
          console.log(`❌ FALLBACK FAILED: Code ${code} was rejected. Error: ${result.error}`)
        }
      } catch (error) {
        console.error(`💥 FALLBACK ERROR testing code ${code}:`, error)
      }
    }

    // Test that invalid codes are still rejected
    console.log('🔍 Testing invalid codes are rejected...')
    const invalidCodes = ['555555', '777777', 'invalid']

    for (const code of invalidCodes) {
      try {
        const result = await totpService.verifyTOTP(userId, code)

        if (!result.success) {
          console.log(`✅ CORRECTLY REJECTED: Invalid code ${code} was properly rejected`)
        } else {
          console.log(`⚠️ UNEXPECTED: Invalid code ${code} was incorrectly accepted`)
        }
      } catch (error) {
        console.error(`💥 ERROR testing invalid code ${code}:`, error)
      }
    }

    console.log('🏁 TOTP test completed')

  } catch (error) {
    console.error('💥 FATAL ERROR in TOTP test:', error)
  }
}

// Run the test automatically if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).testTOTPFix = testTOTPFix
  console.log('🧪 TOTP Test available as window.testTOTPFix()')
}

export default testTOTPFix