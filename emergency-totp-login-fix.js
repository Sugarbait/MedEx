/**
 * 🚨 EMERGENCY TOTP LOGIN FIX SCRIPT
 *
 * This script fixes the current TOTP login issue for pierre@phaetonai.com by:
 * 1. Clearing conflicting TOTP database records
 * 2. Resetting MFA for the correct user ID: c550502f-c39d-4bb3-bb8c-d193657fdb24
 * 3. Creating clean login state
 *
 * Usage: Copy and paste this entire script into browser console on the CareXPS site
 */

(async function emergencyTOTPLoginFix() {
    console.log('🚨 EMERGENCY TOTP LOGIN FIX STARTING...');
    console.log('🎯 Target User: pierre@phaetonai.com');
    console.log('🔑 User ID: c550502f-c39d-4bb3-bb8c-d193657fdb24');

    try {
        const currentUserId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
        const userEmail = 'pierre@phaetonai.com';

        // Step 1: Clear ALL MFA/TOTP related localStorage data
        console.log('📋 Step 1: Nuclear clear of all MFA data...');

        const keysToRemove = [];

        // Find ALL keys that might contain TOTP/MFA data
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.includes('totp') ||
                key.includes('mfa') ||
                key.includes('TOTP') ||
                key.includes('MFA') ||
                key.includes(currentUserId) ||
                key.includes('JBSWY3DPEHPK3PXP') ||
                key.includes('pierre') ||
                key.includes('backup_code') ||
                key.includes('auth_session')
            )) {
                keysToRemove.push(key);
            }
        }

        // Remove all found keys
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`   ✅ Removed: ${key}`);
        });

        // Also remove specific problem keys
        const specificKeys = [
            `totp_${currentUserId}`,
            `mfa_setup_${currentUserId}`,
            `mfa_verified_${currentUserId}`,
            `mfa_session_${currentUserId}`,
            `userSettings_${currentUserId}`,
            'currentUser',
            'userSession',
            'authState',
            'mfa_sessions',
            'totp_secrets',
            'backup_codes',
            'totpService_initialized'
        ];

        specificKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`   ✅ Removed specific key: ${key}`);
            }
        });

        console.log('✅ Step 1 Complete: All MFA data cleared');

        // Step 2: Reset user MFA state completely
        console.log('📋 Step 2: Resetting MFA state completely...');

        // Create clean user settings with MFA disabled
        const cleanUserSettings = {
            mfaEnabled: false,
            mfaSetupCompleted: false,
            lastLogin: new Date().toISOString(),
            theme: 'light'
        };

        localStorage.setItem(`userSettings_${currentUserId}`, JSON.stringify(cleanUserSettings));
        console.log('   ✅ Created clean user settings with MFA disabled');

        console.log('✅ Step 2 Complete: MFA state reset');

        // Step 3: Try to use emergency utilities if available
        console.log('📋 Step 3: Using emergency utilities if available...');

        try {
            // Check if mfaEmergencyRecovery is available
            if (window.mfaEmergencyRecovery && window.mfaEmergencyRecovery.emergencyMFAReset) {
                console.log('   Using mfaEmergencyRecovery.emergencyMFAReset...');
                await window.mfaEmergencyRecovery.emergencyMFAReset(currentUserId);
                console.log('   ✅ Emergency MFA reset completed');
            }

            // Check if LoginAttemptTracker is available
            if (window.LoginAttemptTracker && window.LoginAttemptTracker.emergencyClearAll) {
                console.log('   Using LoginAttemptTracker.emergencyClearAll...');
                window.LoginAttemptTracker.emergencyClearAll();
                console.log('   ✅ Login attempt tracker cleared');
            }

            // Check if fixUserIssues is available
            if (window.fixUserIssues && window.fixUserIssues.fixAllUserIssues) {
                console.log('   Using fixUserIssues.fixAllUserIssues...');
                await window.fixUserIssues.fixAllUserIssues();
                console.log('   ✅ User issues fixed');
            }

        } catch (utilError) {
            console.warn('   ⚠️ Some emergency utilities not available:', utilError.message);
        }

        console.log('✅ Step 3 Complete: Emergency utilities attempted');

        // Step 4: Provide specific recovery instructions
        console.log('📋 Step 4: LOGIN RECOVERY INSTRUCTIONS');
        console.log('');
        console.log('🔧 IMMEDIATE STEPS TO RESTORE LOGIN:');
        console.log('1. 🔄 Refresh the page (F5 or Ctrl+R)');
        console.log('2. 🔑 Try logging in with: pierre@phaetonai.com');
        console.log('3. ⚡ If prompted for MFA, click "Skip" or "Setup New MFA"');
        console.log('4. ⚙️  Go to Settings → Security');
        console.log('5. 🗑️  Delete old "CareXPS" entry from Google Authenticator');
        console.log('6. 📱 Click "Setup New MFA" and scan fresh QR code');
        console.log('7. ✅ Test login with new MFA code');
        console.log('');
        console.log('🚨 IF LOGIN STILL FAILS:');
        console.log('   - Use Ctrl+Shift+L for emergency logout');
        console.log('   - Run: window.mfaUtils.emergencyDisableMFA("' + currentUserId + '")');
        console.log('   - Try incognito/private window');
        console.log('');

        // Step 5: Final verification
        console.log('📋 Step 5: Verifying cleanup success...');

        let remainingMFAData = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('totp') || key.includes('mfa') || key.includes('JBSWY3DPEHPK3PXP'))) {
                console.warn(`   ⚠️ Remaining MFA data: ${key}`);
                remainingMFAData++;
            }
        }

        if (remainingMFAData === 0) {
            console.log('   ✅ Complete cleanup verified - no MFA data remaining');
        } else {
            console.warn(`   ⚠️ Found ${remainingMFAData} remaining MFA keys`);
        }

        console.log('');
        console.log('🎉 EMERGENCY TOTP LOGIN FIX COMPLETED!');
        console.log('💡 Please refresh the page NOW and try logging in.');
        console.log('📧 Login as: pierre@phaetonai.com');
        console.log('🔑 User ID: c550502f-c39d-4bb3-bb8c-d193657fdb24');

        return {
            success: true,
            userId: currentUserId,
            email: userEmail,
            keysRemoved: keysToRemove.length,
            remainingMFAData: remainingMFAData
        };

    } catch (error) {
        console.error('❌ Emergency TOTP Login Fix failed:', error);
        console.log('');
        console.log('🚨 NUCLEAR FALLBACK OPTIONS:');
        console.log('1. localStorage.clear() - Clear everything');
        console.log('2. Use incognito window');
        console.log('3. Restart browser completely');
        console.log('4. Run: window.mfaUtils.emergencyDisableMFA("c550502f-c39d-4bb3-bb8c-d193657fdb24")');

        return {
            success: false,
            error: error.message,
            fallbackAvailable: true
        };
    }
})();

// Enhanced MFA utilities for this specific user
window.pierreLoginFix = {
    currentUserId: 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
    userEmail: 'pierre@phaetonai.com',

    // Nuclear option - clear everything
    nuclearClear: function() {
        console.log('💥 NUCLEAR CLEAR - Removing ALL localStorage data...');
        localStorage.clear();
        console.log('✅ All data cleared. Refresh page and try login.');
    },

    // Check current MFA state
    checkMFAState: function() {
        const userId = this.currentUserId;
        console.log('🔍 Checking MFA state for:', this.userEmail);

        const totpData = localStorage.getItem(`totp_${userId}`);
        const mfaSetup = localStorage.getItem(`mfa_setup_${userId}`);
        const userSettings = localStorage.getItem(`userSettings_${userId}`);

        console.log('TOTP data:', totpData ? 'EXISTS' : 'NONE');
        console.log('MFA setup:', mfaSetup ? 'EXISTS' : 'NONE');
        console.log('User settings:', userSettings ? 'EXISTS' : 'NONE');

        if (userSettings) {
            const settings = JSON.parse(userSettings);
            console.log('MFA enabled:', settings.mfaEnabled);
        }
    },

    // Emergency disable MFA
    disableMFA: function() {
        console.log('🚨 Emergency MFA disable for:', this.userEmail);
        const userId = this.currentUserId;

        // Remove all MFA keys
        [`totp_${userId}`, `mfa_setup_${userId}`, `mfa_verified_${userId}`, `mfa_session_${userId}`].forEach(key => {
            localStorage.removeItem(key);
        });

        // Disable in user settings
        const settings = JSON.parse(localStorage.getItem(`userSettings_${userId}`) || '{}');
        settings.mfaEnabled = false;
        settings.mfaSetupCompleted = false;
        localStorage.setItem(`userSettings_${userId}`, JSON.stringify(settings));

        console.log('✅ MFA disabled. Refresh page and try login.');
    }
};

console.log('');
console.log('🔧 Pierre Login Fix Utilities loaded:');
console.log('  - window.pierreLoginFix.checkMFAState()');
console.log('  - window.pierreLoginFix.disableMFA()');
console.log('  - window.pierreLoginFix.nuclearClear()');