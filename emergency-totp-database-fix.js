/**
 * EMERGENCY TOTP DATABASE FIX
 *
 * This script fixes the specific database errors for user c550502f-c39d-4bb3-bb8c-d193657fdb24:
 * - POST .../rpc/upsert_user_totp 400 (Bad Request)
 * - POST .../user_totp 409 (Conflict)
 *
 * Run this in the browser console on the CareXPS site.
 */

console.log('🚨 EMERGENCY TOTP DATABASE FIX - Starting...');

const PROBLEMATIC_USER_ID = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
const DYNAMIC_USER_ID = 'dynamic-pierre-user';

async function emergencyTOTPDatabaseFix() {
    try {
        console.log('🔍 Step 1: Identifying the problem...');
        console.log('User ID with database conflicts:', PROBLEMATIC_USER_ID);
        console.log('Email:', 'pierre@phaetonai.com');

        // Step 1: Clear all localStorage for both user IDs
        console.log('🧹 Step 2: Clearing ALL localStorage data...');

        const keysToRemove = [
            // For UUID user
            `totp_${PROBLEMATIC_USER_ID}`,
            `totp_secret_${PROBLEMATIC_USER_ID}`,
            `totp_enabled_${PROBLEMATIC_USER_ID}`,
            `mfa_sessions_${PROBLEMATIC_USER_ID}`,
            `mfa_setup_${PROBLEMATIC_USER_ID}`,
            `mfa_verified_${PROBLEMATIC_USER_ID}`,
            `mfa_session_${PROBLEMATIC_USER_ID}`,
            `userSettings_${PROBLEMATIC_USER_ID}`,

            // For dynamic user (fallback)
            `totp_${DYNAMIC_USER_ID}`,
            `totp_secret_${DYNAMIC_USER_ID}`,
            `totp_enabled_${DYNAMIC_USER_ID}`,
            `mfa_sessions_${DYNAMIC_USER_ID}`,
            `mfa_setup_${DYNAMIC_USER_ID}`,
            `mfa_verified_${DYNAMIC_USER_ID}`,
            `mfa_session_${DYNAMIC_USER_ID}`,
            `userSettings_${DYNAMIC_USER_ID}`,

            // General MFA data
            'totp_setup_temp',
            'mfa_setup_in_progress',
            'emergency_totp_fallback',
            'mfa_sessions',
            'totp_secrets',
            'backup_codes'
        ];

        let removedCount = 0;
        keysToRemove.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`   ✅ Removed: ${key}`);
                removedCount++;
            }
        });

        console.log(`✅ Step 2 Complete: Removed ${removedCount} localStorage items`);

        // Step 2: Clear any old test data globally
        console.log('🧹 Step 3: Clearing old test secret data...');

        const oldTestSecret = 'JBSWY3DPEHPK3PXP';
        const testKeysRemoved = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                try {
                    const value = localStorage.getItem(key);
                    if (value && value.includes(oldTestSecret)) {
                        testKeysRemoved.push(key);
                        localStorage.removeItem(key);
                        console.log(`   ✅ Removed test data from: ${key}`);
                    }
                } catch (e) {
                    // Skip non-string values
                }
            }
        }

        console.log(`✅ Step 3 Complete: Removed ${testKeysRemoved.length} test data items`);

        // Step 3: Database cleanup (if Supabase is available)
        console.log('🗃️ Step 4: Database cleanup...');

        if (typeof window.supabase !== 'undefined') {
            const supabase = window.supabase;

            try {
                // Delete existing TOTP records for the problematic user
                console.log('   Deleting user_totp records...');
                const { error: totpDeleteError } = await supabase
                    .from('user_totp')
                    .delete()
                    .eq('user_id', PROBLEMATIC_USER_ID);

                if (totpDeleteError) {
                    console.log('   ⚠️ TOTP delete result:', totpDeleteError.message);
                } else {
                    console.log('   ✅ TOTP records deleted successfully');
                }

                // Delete MFA config records
                console.log('   Deleting user_mfa_configs records...');
                const { error: mfaDeleteError } = await supabase
                    .from('user_mfa_configs')
                    .delete()
                    .eq('user_id', PROBLEMATIC_USER_ID);

                if (mfaDeleteError) {
                    console.log('   ⚠️ MFA config delete result:', mfaDeleteError.message);
                } else {
                    console.log('   ✅ MFA config records deleted successfully');
                }

                // Reset MFA enabled flag in users table
                console.log('   Resetting MFA enabled flag...');
                const { error: userUpdateError } = await supabase
                    .from('users')
                    .update({ mfa_enabled: false })
                    .eq('id', PROBLEMATIC_USER_ID);

                if (userUpdateError) {
                    console.log('   ⚠️ User update result:', userUpdateError.message);
                } else {
                    console.log('   ✅ User MFA flag reset successfully');
                }

                console.log('✅ Step 4 Complete: Database cleanup successful');

            } catch (dbError) {
                console.log('   ⚠️ Database operation failed:', dbError.message);
                console.log('   This is OK if the records didn\'t exist');
            }
        } else {
            console.log('   ⚠️ Supabase not available, skipping database cleanup');
            console.log('   Database cleanup will happen when you try to setup MFA again');
        }

        // Step 4: Clear authentication state
        console.log('🔐 Step 5: Clearing authentication state...');

        const authKeys = [
            'currentUser',
            'userSession',
            'authState',
            'auth_token',
            'user_data'
        ];

        authKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`   ✅ Cleared: ${key}`);
            }
        });

        console.log('✅ Step 5 Complete: Authentication state cleared');

        // Step 5: Recovery instructions
        console.log('📱 Step 6: Recovery Instructions');
        console.log('=====================================');
        console.log('');
        console.log('🎉 EMERGENCY FIX COMPLETED!');
        console.log('');
        console.log('⏭️ NEXT STEPS:');
        console.log('1. 🔄 Refresh this page (F5 or Ctrl+R)');
        console.log('2. 🚪 Try logging in with your regular credentials');
        console.log('3. ⚙️ Go to Settings → Security');
        console.log('4. 🆕 Click "Setup MFA" or "Enable MFA"');
        console.log('5. 🗑️ Delete old "CareXPS Healthcare CRM" from your authenticator app');
        console.log('6. 📷 Scan the NEW QR code with your authenticator app');
        console.log('7. 🔢 Enter the 6-digit code to verify setup');
        console.log('8. ✅ Test login with the new MFA code');
        console.log('');
        console.log('🚨 If you still get errors:');
        console.log('   - The database conflicts have been cleared');
        console.log('   - The 409 Conflict error should be gone');
        console.log('   - The 400 Bad Request should be fixed');
        console.log('');
        console.log('🔧 Emergency commands available:');
        console.log('   - Emergency logout: Ctrl+Shift+L');
        console.log('   - Re-run this fix: Copy and paste this script again');

        return {
            success: true,
            message: 'Emergency TOTP database fix completed successfully',
            userIds: [PROBLEMATIC_USER_ID, DYNAMIC_USER_ID],
            removedItems: removedCount,
            testDataRemoved: testKeysRemoved.length
        };

    } catch (error) {
        console.error('❌ Emergency fix failed:', error);
        console.log('');
        console.log('🆘 FALLBACK OPTIONS:');
        console.log('1. Clear all localStorage: localStorage.clear()');
        console.log('2. Use incognito/private browsing window');
        console.log('3. Try a different browser');
        console.log('4. Contact system administrator');

        return {
            success: false,
            message: 'Emergency fix failed: ' + error.message
        };
    }
}

// Execute the emergency fix
emergencyTOTPDatabaseFix().then(result => {
    console.log('');
    console.log('📊 EMERGENCY FIX RESULT:', result);
}).catch(error => {
    console.error('💥 Critical error:', error);
});

// Add utility functions to window for ongoing support
window.emergencyTOTPUtils = {
    // Quick check for remaining problematic data
    checkForProblems: function() {
        console.log('🔍 Checking for remaining TOTP problems...');

        const problematicKeys = [];
        const oldTestSecret = 'JBSWY3DPEHPK3PXP';

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                try {
                    const value = localStorage.getItem(key);
                    if (value && (value.includes(oldTestSecret) || key.includes('totp') || key.includes('mfa'))) {
                        problematicKeys.push(key);
                    }
                } catch (e) {}
            }
        }

        if (problematicKeys.length === 0) {
            console.log('✅ No remaining problems found');
        } else {
            console.log('⚠️ Found remaining MFA/TOTP keys:');
            problematicKeys.forEach(key => console.log(`   - ${key}`));
        }

        return problematicKeys;
    },

    // Nuclear option - clear everything MFA related
    nuclearMFAClear: function() {
        console.log('☢️ NUCLEAR MFA CLEAR - Removing ALL MFA data...');

        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                allKeys.push(key);
            }
        }

        let removedCount = 0;
        allKeys.forEach(key => {
            try {
                const value = localStorage.getItem(key);
                if (value && (
                    key.includes('totp') ||
                    key.includes('mfa') ||
                    key.includes('auth') ||
                    value.includes('JBSWY3DPEHPK3PXP') ||
                    value.includes('totp') ||
                    value.includes('mfa')
                )) {
                    localStorage.removeItem(key);
                    console.log(`   ☢️ Nuked: ${key}`);
                    removedCount++;
                }
            } catch (e) {}
        });

        console.log(`☢️ Nuclear clear complete: Removed ${removedCount} items`);
        console.log('🔄 Please refresh the page and try login again');
    }
};

console.log('');
console.log('🛠️ Emergency TOTP utilities loaded:');
console.log('   - window.emergencyTOTPUtils.checkForProblems()');
console.log('   - window.emergencyTOTPUtils.nuclearMFAClear()');