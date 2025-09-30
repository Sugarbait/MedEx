/**
 * Live Test for Logout Prevention
 *
 * This test will be injected into the running application to verify
 * that the logout prevention mechanisms are working correctly.
 */

// Test function that can be run in browser console
window.testLogoutPrevention = function() {
    console.log('🧪 LIVE LOGOUT PREVENTION TEST STARTING...')
    console.log('='.repeat(50))

    // Step 1: Check initial state
    console.log('\n📋 STEP 1: Initial State Check')
    const initialState = {
        justLoggedOut: localStorage.getItem('justLoggedOut'),
        sessionCredentials: !!sessionStorage.getItem('retell_credentials_backup'),
        emergencyCredentials: !!localStorage.getItem('__emergencyRetellCredentials'),
        memoryCredentials: !!window.__retellCredentialsBackup,
        settingsCount: Object.keys(localStorage).filter(key => key.startsWith('settings_')).length
    }
    console.log('Initial state:', initialState)

    // Step 2: Set logout flag
    console.log('\n📋 STEP 2: Setting justLoggedOut Flag')
    localStorage.setItem('justLoggedOut', 'true')
    console.log('✅ justLoggedOut flag set to:', localStorage.getItem('justLoggedOut'))

    // Step 3: Clear existing credentials to start fresh
    console.log('\n📋 STEP 3: Clearing Existing Credentials')
    sessionStorage.removeItem('retell_credentials_backup')
    localStorage.removeItem('__emergencyRetellCredentials')
    localStorage.removeItem('__fallbackRetellConfig')
    if (window.__retellCredentialsBackup) {
        delete window.__retellCredentialsBackup
    }
    console.log('✅ Cleared all existing credentials')

    // Step 4: Try to trigger credential storage (should be prevented)
    console.log('\n📋 STEP 4: Testing Credential Storage Prevention')

    // Test bulletproof credential initializer
    if (window.bulletproofCredentialInitializer) {
        console.log('Testing bulletproofCredentialInitializer.initialize()...')
        try {
            window.bulletproofCredentialInitializer.initialize()
            console.log('BulletproofCredentialInitializer called (check for prevention logs)')
        } catch (error) {
            console.log('BulletproofCredentialInitializer error:', error.message)
        }
    }

    // Test retell service
    if (window.retellService) {
        console.log('Testing retellService.forceUpdateCredentials()...')
        try {
            window.retellService.forceUpdateCredentials()
            console.log('RetellService called (check for prevention logs)')
        } catch (error) {
            console.log('RetellService error:', error.message)
        }
    }

    // Step 5: Check results after a delay
    console.log('\n📋 STEP 5: Checking Results (waiting 3 seconds)...')
    setTimeout(() => {
        const finalState = {
            justLoggedOut: localStorage.getItem('justLoggedOut'),
            sessionCredentials: !!sessionStorage.getItem('retell_credentials_backup'),
            emergencyCredentials: !!localStorage.getItem('__emergencyRetellCredentials'),
            memoryCredentials: !!window.__retellCredentialsBackup,
            settingsCount: Object.keys(localStorage).filter(key => key.startsWith('settings_')).length
        }

        console.log('Final state:', finalState)

        // Check if prevention worked
        const preventionWorked = !finalState.sessionCredentials &&
                               !finalState.emergencyCredentials &&
                               !finalState.memoryCredentials

        console.log('\n' + '='.repeat(50))
        console.log(`🎯 LOGOUT PREVENTION TEST: ${preventionWorked ? '✅ PASSED' : '❌ FAILED'}`)

        if (preventionWorked) {
            console.log('✅ SUCCESS: No credentials were stored after setting justLoggedOut flag')
            console.log('✅ The logout prevention mechanism is working correctly!')
        } else {
            console.log('❌ FAILURE: Credentials were still stored despite justLoggedOut flag')
            if (finalState.sessionCredentials) console.log('  - SessionStorage credentials found')
            if (finalState.emergencyCredentials) console.log('  - Emergency credentials found')
            if (finalState.memoryCredentials) console.log('  - Memory credentials found')
        }

        // Clean up
        localStorage.removeItem('justLoggedOut')
        console.log('\n🧹 Test cleanup completed')
        console.log('='.repeat(50))

        // Return result for programmatic use
        return preventionWorked

    }, 3000)

    console.log('⏳ Test will complete in 3 seconds...')
}

// Auto-run the test
console.log('🚀 Logout Prevention Test Loaded!')
console.log('💡 Run test with: window.testLogoutPrevention()')
console.log('💡 Auto-running test in 2 seconds...')

setTimeout(() => {
    window.testLogoutPrevention()
}, 2000)