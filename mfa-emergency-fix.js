/**
 * 🚨 EMERGENCY MFA FIX SCRIPT
 *
 * This script fixes the MFA authentication issue by:
 * 1. Clearing old test TOTP data (JBSWY3DPEHPK3PXP)
 * 2. Resetting MFA for dynamic-pierre-user
 * 3. Creating fresh MFA setup
 *
 * Usage: Copy and paste this entire script into browser console on the CareXPS site
 */

(async function emergencyMFAFix() {
    console.log('🚨 EMERGENCY MFA FIX STARTING...');

    try {
        // Step 1: Clear all old test TOTP data
        console.log('📋 Step 1: Clearing old test TOTP data...');

        const oldTestSecret = 'JBSWY3DPEHPK3PXP';
        const keysToRemove = [];

        // Find all localStorage keys with old test data
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                try {
                    const value = localStorage.getItem(key);
                    if (value && value.includes(oldTestSecret)) {
                        keysToRemove.push(key);
                        console.log(`   Found old test data in: ${key}`);
                    }
                } catch (e) {
                    // Skip non-string values
                }
            }
        }

        // Remove all keys with old test data
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`   ✅ Removed: ${key}`);
        });

        // Also remove specific MFA-related keys
        const mfaKeys = [
            'mfa_setup_dynamic-pierre-user',
            'totp_dynamic-pierre-user',
            'mfa_sessions',
            'totp_secrets',
            'backup_codes'
        ];

        mfaKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`   ✅ Removed MFA key: ${key}`);
            }
        });

        console.log('✅ Step 1 Complete: Old test data cleared');

        // Step 2: Reset user MFA state
        console.log('📋 Step 2: Resetting MFA state for dynamic-pierre-user...');

        const userId = 'dynamic-pierre-user';

        // Clear MFA enabled flag
        const userSettings = JSON.parse(localStorage.getItem('userSettings_' + userId) || '{}');
        if (userSettings.mfaEnabled) {
            userSettings.mfaEnabled = false;
            localStorage.setItem('userSettings_' + userId, JSON.stringify(userSettings));
            console.log('   ✅ Cleared MFA enabled flag');
        }

        // Clear any cached MFA verification status
        localStorage.removeItem('mfa_verified_' + userId);
        localStorage.removeItem('mfa_session_' + userId);

        console.log('✅ Step 2 Complete: MFA state reset');

        // Step 3: Force fresh login state
        console.log('📋 Step 3: Resetting authentication state...');

        // Clear current user session
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userSession');
        localStorage.removeItem('authState');

        console.log('✅ Step 3 Complete: Auth state cleared');

        // Step 4: Provide recovery instructions
        console.log('📋 Step 4: MFA Recovery Instructions');
        console.log('');
        console.log('🔧 NEXT STEPS TO COMPLETE FIX:');
        console.log('1. Refresh the page (F5)');
        console.log('2. Log in with your regular credentials');
        console.log('3. Go to Settings → Security');
        console.log('4. Click "Setup MFA" to create fresh TOTP');
        console.log('5. Delete old "CareXPS Healthcare CRM" entry from your authenticator app');
        console.log('6. Scan the new QR code');
        console.log('7. Test login with the new MFA code');
        console.log('');
        console.log('🚨 Emergency Recovery Commands:');
        console.log('   - Run this script again if issues persist');
        console.log('   - Use Ctrl+Shift+L for emergency logout');
        console.log('');

        // Step 5: Verify cleanup
        console.log('📋 Step 5: Verifying cleanup...');

        let foundOldData = false;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                try {
                    const value = localStorage.getItem(key);
                    if (value && value.includes(oldTestSecret)) {
                        console.warn(`   ⚠️ Still found old data in: ${key}`);
                        foundOldData = true;
                    }
                } catch (e) {
                    // Skip non-string values
                }
            }
        }

        if (!foundOldData) {
            console.log('   ✅ No old test data found - cleanup successful');
        }

        console.log('');
        console.log('🎉 EMERGENCY MFA FIX COMPLETED!');
        console.log('💡 Please refresh the page and follow the recovery instructions above.');

        return true;

    } catch (error) {
        console.error('❌ Emergency MFA Fix failed:', error);
        console.log('');
        console.log('🚨 FALLBACK OPTIONS:');
        console.log('1. Clear all localStorage: localStorage.clear()');
        console.log('2. Use incognito/private window');
        console.log('3. Contact system administrator');
        return false;
    }
})();

// Additional utility functions for ongoing MFA management
window.mfaUtils = {
    // Check if old test data still exists
    checkForOldData: function() {
        const oldTestSecret = 'JBSWY3DPEHPK3PXP';
        let found = false;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                try {
                    const value = localStorage.getItem(key);
                    if (value && value.includes(oldTestSecret)) {
                        console.log(`Old test data found in: ${key}`);
                        found = true;
                    }
                } catch (e) {}
            }
        }

        if (!found) {
            console.log('✅ No old test data found');
        }
        return found;
    },

    // Emergency MFA disable for critical users
    emergencyDisableMFA: function(userId = 'dynamic-pierre-user') {
        console.log(`🚨 Emergency MFA disable for: ${userId}`);

        // Clear all MFA data for user
        const keysToRemove = [
            `mfa_setup_${userId}`,
            `totp_${userId}`,
            `mfa_verified_${userId}`,
            `mfa_session_${userId}`
        ];

        keysToRemove.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`   Removed: ${key}`);
            }
        });

        // Disable MFA in user settings
        const userSettings = JSON.parse(localStorage.getItem(`userSettings_${userId}`) || '{}');
        userSettings.mfaEnabled = false;
        localStorage.setItem(`userSettings_${userId}`, JSON.stringify(userSettings));

        console.log('✅ MFA disabled for user. Please refresh and try logging in.');
    }
};

console.log('🔧 MFA Utilities loaded:');
console.log('  - window.mfaUtils.checkForOldData()');
console.log('  - window.mfaUtils.emergencyDisableMFA(userId)');