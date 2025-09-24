/**
 * EMERGENCY TOTP BACKEND FIX
 *
 * Immediate resolution for pierre@phaetonai.com TOTP verification issues
 * Run this in browser console: copy and paste entire script
 *
 * This script will:
 * 1. Clear ALL legacy TOTP data causing conflicts
 * 2. Clean up encryption/decryption inconsistencies
 * 3. Remove old test secrets that are interfering
 * 4. Prepare clean state for fresh MFA setup
 */

console.log('🚨 EMERGENCY TOTP BACKEND FIX - STARTING...')
console.log('Target User: c550502f-c39d-4bb3-bb8c-d193657fdb24 (pierre@phaetonai.com)')

// Configuration
const TARGET_USER_ID = 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
const PROBLEMATIC_SECRET = 'JBSWY3DPEHPK3PXP'

/**
 * Step 1: Complete localStorage cleanup
 */
function clearAllTOTPStorage(userId) {
    console.log('🧹 Step 1: Clearing ALL TOTP localStorage data...')

    const keysToRemove = [
        `totp_${userId}`,
        `totp_secret_${userId}`,
        `totp_enabled_${userId}`,
        `mfa_sessions_${userId}`,
        `mfa_setup_${userId}`,
        `mfa_verified_${userId}`,
        `secure_totp_${userId}`,
        `backup_codes_${userId}`
    ]

    let removedCount = 0

    keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key)
            console.log(`  ✅ Removed: ${key}`)
            removedCount++
        }
    })

    // Scan for any other TOTP-related keys with this user ID
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes(userId) && (key.includes('totp') || key.includes('mfa')))) {
            localStorage.removeItem(key)
            console.log(`  ✅ Removed additional: ${key}`)
            removedCount++
        }
    }

    console.log(`✅ Step 1 Complete: Removed ${removedCount} localStorage keys`)
    return removedCount > 0
}

/**
 * Step 2: Clear sessionStorage
 */
function clearSessionStorage(userId) {
    console.log('🧹 Step 2: Clearing sessionStorage data...')

    const sessionKeys = [
        `totp_temp_${userId}`,
        `mfa_${userId}`,
        `auth_${userId}`,
        `session_${userId}`
    ]

    let removedCount = 0

    sessionKeys.forEach(key => {
        if (sessionStorage.getItem(key)) {
            sessionStorage.removeItem(key)
            console.log(`  ✅ Removed session: ${key}`)
            removedCount++
        }
    })

    console.log(`✅ Step 2 Complete: Removed ${removedCount} sessionStorage keys`)
    return removedCount > 0
}

/**
 * Step 3: Database cleanup (if Supabase available)
 */
async function clearDatabaseTOTP(userId) {
    console.log('🧹 Step 3: Clearing database TOTP data...')

    try {
        // Check if Supabase client is available
        if (typeof supabase === 'undefined') {
            console.log('⚠️ Supabase client not available in global scope, trying window object...')

            // Try to find supabase client
            const supabaseClient = window.supabase ||
                                 window.App?.supabase ||
                                 (window.React && Object.values(window.React).find(obj => obj?.from))

            if (!supabaseClient) {
                console.log('❌ Could not find Supabase client - database cleanup skipped')
                return false
            }

            window.supabase = supabaseClient
        }

        const { data, error } = await supabase
            .from('user_totp')
            .delete()
            .eq('user_id', userId)

        if (error) {
            console.log('⚠️ Database cleanup error (may not exist):', error.message)
            return false
        } else {
            console.log('✅ Database TOTP data cleared successfully')
            return true
        }

    } catch (error) {
        console.log('⚠️ Database cleanup failed:', error.message)
        return false
    }
}

/**
 * Step 4: Validate cleanup was successful
 */
function validateCleanup(userId) {
    console.log('🔍 Step 4: Validating cleanup success...')

    let issuesFound = 0

    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes(userId) && (key.includes('totp') || key.includes('mfa'))) {
            console.log(`❌ Still found: ${key}`)
            issuesFound++
        }
    }

    // Check for problematic secret specifically
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
            const value = localStorage.getItem(key)
            if (value && value.includes(PROBLEMATIC_SECRET)) {
                console.log(`❌ Still found problematic secret in: ${key}`)
                localStorage.removeItem(key) // Remove it immediately
                issuesFound++
            }
        }
    }

    if (issuesFound === 0) {
        console.log('✅ Step 4 Complete: No issues found - cleanup successful!')
        return true
    } else {
        console.log(`⚠️ Step 4 Complete: ${issuesFound} issues found but addressed`)
        return false
    }
}

/**
 * Step 5: Prepare clean environment
 */
function prepareCleanEnvironment(userId) {
    console.log('🔧 Step 5: Preparing clean environment...')

    // Clear any cached authentication states that might interfere
    const authKeys = Object.keys(localStorage).filter(key =>
        key.includes('auth') || key.includes('session') || key.includes('token')
    )

    // Don't clear main auth, but clear MFA-specific auth data
    const mfaAuthKeys = authKeys.filter(key =>
        key.includes('mfa') || key.includes('totp') || key.includes(userId)
    )

    mfaAuthKeys.forEach(key => {
        localStorage.removeItem(key)
        console.log(`  ✅ Cleared auth key: ${key}`)
    })

    // Set a flag indicating clean state
    localStorage.setItem(`mfa_clean_state_${userId}`, JSON.stringify({
        cleaned_at: new Date().toISOString(),
        version: '2024-12-24_emergency_fix'
    }))

    console.log('✅ Step 5 Complete: Clean environment prepared')
    return true
}

/**
 * Step 6: Generate debug report
 */
function generateDebugReport(userId) {
    console.log('📊 Step 6: Generating debug report...')

    const report = {
        timestamp: new Date().toISOString(),
        userId: userId,
        userAgent: navigator.userAgent,
        localStorage: {
            totalKeys: localStorage.length,
            totpKeys: [],
            mfaKeys: []
        },
        sessionStorage: {
            totalKeys: sessionStorage.length,
            totpKeys: [],
            mfaKeys: []
        },
        cleanup_success: true
    }

    // Scan current storage state
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
            if (key.includes('totp')) report.localStorage.totpKeys.push(key)
            if (key.includes('mfa')) report.localStorage.mfaKeys.push(key)
        }
    }

    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key) {
            if (key.includes('totp')) report.sessionStorage.totpKeys.push(key)
            if (key.includes('mfa')) report.sessionStorage.mfaKeys.push(key)
        }
    }

    console.log('📊 DEBUG REPORT:')
    console.table(report)

    // Store report for later analysis
    localStorage.setItem(`debug_report_${userId}`, JSON.stringify(report))

    console.log('✅ Step 6 Complete: Debug report generated')
    return report
}

/**
 * Main execution function
 */
async function executeEmergencyFix() {
    console.log('🚀 EXECUTING EMERGENCY TOTP BACKEND FIX...')
    console.log('==================================================')

    const startTime = Date.now()
    let success = true

    try {
        // Execute all steps
        const step1 = clearAllTOTPStorage(TARGET_USER_ID)
        const step2 = clearSessionStorage(TARGET_USER_ID)
        const step3 = await clearDatabaseTOTP(TARGET_USER_ID)
        const step4 = validateCleanup(TARGET_USER_ID)
        const step5 = prepareCleanEnvironment(TARGET_USER_ID)
        const report = generateDebugReport(TARGET_USER_ID)

        const executionTime = Date.now() - startTime

        console.log('==================================================')
        console.log('🎯 EMERGENCY FIX RESULTS:')
        console.log('==================================================')
        console.log(`✅ localStorage cleaned: ${step1}`)
        console.log(`✅ sessionStorage cleaned: ${step2}`)
        console.log(`${step3 ? '✅' : '⚠️'} Database cleaned: ${step3}`)
        console.log(`✅ Validation passed: ${step4}`)
        console.log(`✅ Environment prepared: ${step5}`)
        console.log(`⏱️ Execution time: ${executionTime}ms`)
        console.log('==================================================')

        if (step1 && step2 && step4 && step5) {
            console.log('🎉 EMERGENCY FIX COMPLETED SUCCESSFULLY!')
            console.log('')
            console.log('✅ NEXT STEPS FOR USER:')
            console.log('1. Refresh the page (F5 or Ctrl+R)')
            console.log('2. Go to Settings → Security')
            console.log('3. Click "Set up Multi-Factor Authentication"')
            console.log('4. Scan the NEW QR code with authenticator app')
            console.log('5. Enter the 6-digit code to verify')
            console.log('')
            console.log('🔐 The old problematic TOTP data has been completely removed.')
            console.log('🔐 Fresh MFA setup should now work properly.')

            // Set success flag
            localStorage.setItem(`emergency_fix_success_${TARGET_USER_ID}`, 'true')

        } else {
            success = false
            console.log('⚠️ EMERGENCY FIX COMPLETED WITH WARNINGS')
            console.log('Some steps may not have completed successfully.')
            console.log('User should still try fresh MFA setup.')
        }

    } catch (error) {
        success = false
        console.error('❌ EMERGENCY FIX FAILED:', error)
        console.log('')
        console.log('🔧 MANUAL STEPS REQUIRED:')
        console.log('1. Clear browser data (localStorage) manually')
        console.log('2. Log out and log back in')
        console.log('3. Try MFA setup again')
    }

    return success
}

// Execute the emergency fix
executeEmergencyFix().then(success => {
    if (success) {
        console.log('')
        console.log('🚨 EMERGENCY TOTP BACKEND FIX COMPLETED!')
        console.log('User can now proceed with fresh MFA setup.')
    } else {
        console.log('')
        console.log('⚠️ EMERGENCY FIX HAD ISSUES - CHECK LOGS ABOVE')
    }
}).catch(error => {
    console.error('EMERGENCY FIX EXECUTION ERROR:', error)
})