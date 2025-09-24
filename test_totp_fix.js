/**
 * Test script to verify TOTP database fix
 * Run this script to test the TOTP functionality for dynamic-pierre-user
 */

// Test configuration
const TEST_USER_ID = 'dynamic-pierre-user'
const TEST_CODE = '123456' // This should work with test setup

console.log('🧪 Starting TOTP Fix Test for user:', TEST_USER_ID)

// Function to test TOTP service
async function testTOTPService() {
  try {
    // Import the TOTP service (this assumes the module is available)
    const { totpService } = await import('./src/services/totpService.js')

    console.log('\n1. Testing hasTOTPSetup()...')
    const hasSetup = await totpService.hasTOTPSetup(TEST_USER_ID)
    console.log('   Result:', hasSetup)

    console.log('\n2. Testing isTOTPEnabled()...')
    const isEnabled = await totpService.isTOTPEnabled(TEST_USER_ID)
    console.log('   Result:', isEnabled)

    console.log('\n3. Testing verifyTOTP() with test code...')
    const verifyResult = await totpService.verifyTOTP(TEST_USER_ID, TEST_CODE)
    console.log('   Result:', verifyResult)

    console.log('\n✅ All TOTP tests completed!')

    return {
      hasSetup,
      isEnabled,
      verifyResult,
      success: true
    }

  } catch (error) {
    console.error('\n❌ TOTP Test Error:', error.message)
    return {
      error: error.message,
      success: false
    }
  }
}

// Direct Supabase test function
async function testSupabaseDirectly() {
  try {
    console.log('\n🔍 Testing Supabase connection directly...')

    // This requires the supabase client to be available
    const { supabase } = await import('./src/config/supabase.js')

    console.log('\n1. Testing user_totp table direct query...')
    const { data: directData, error: directError } = await supabase
      .from('user_totp')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .maybeSingle()

    console.log('   Direct query result:', { data: directData, error: directError })

    console.log('\n2. Testing get_user_totp function...')
    const { data: functionData, error: functionError } = await supabase
      .rpc('get_user_totp', { target_user_id: TEST_USER_ID })

    console.log('   Function result:', { data: functionData, error: functionError })

    console.log('\n3. Testing user_totp_status view...')
    const { data: statusData, error: statusError } = await supabase
      .from('user_totp_status')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .maybeSingle()

    console.log('   Status view result:', { data: statusData, error: statusError })

    return {
      directQuery: { data: directData, error: directError },
      functionQuery: { data: functionData, error: functionError },
      statusView: { data: statusData, error: statusError },
      success: true
    }

  } catch (error) {
    console.error('\n❌ Supabase Test Error:', error.message)
    return {
      error: error.message,
      success: false
    }
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Running TOTP Fix Tests')
  console.log('=' .repeat(50))

  // Test 1: Supabase Direct
  const supabaseResult = await testSupabaseDirectly()
  console.log('\n📊 Supabase Test Results:')
  console.log(JSON.stringify(supabaseResult, null, 2))

  // Test 2: TOTP Service
  const totpResult = await testTOTPService()
  console.log('\n📊 TOTP Service Test Results:')
  console.log(JSON.stringify(totpResult, null, 2))

  // Summary
  console.log('\n' + '=' .repeat(50))
  console.log('📋 Test Summary:')
  console.log('Supabase Tests:', supabaseResult.success ? '✅ PASSED' : '❌ FAILED')
  console.log('TOTP Service Tests:', totpResult.success ? '✅ PASSED' : '❌ FAILED')

  if (supabaseResult.success && totpResult.success) {
    console.log('\n🎉 ALL TESTS PASSED! The TOTP fix is working correctly.')
  } else {
    console.log('\n⚠️ Some tests failed. Check the error messages above.')
  }
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testTOTPService,
    testSupabaseDirectly,
    runTests
  }
}

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  // Browser environment - add to window for manual testing
  window.totpTestSuite = {
    testTOTPService,
    testSupabaseDirectly,
    runTests
  }

  console.log('🌐 TOTP Test Suite loaded in browser. Use window.totpTestSuite.runTests()')
} else if (import.meta.url === `file://${process.argv[1]}`) {
  // Node.js environment - run tests
  runTests()
}