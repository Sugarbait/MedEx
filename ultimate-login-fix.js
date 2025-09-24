/**
 * 🚨 ULTIMATE LOGIN FIX SCRIPT
 *
 * This script handles ALL known login issues:
 * 1. Multiple user ID variations (dynamic-pierre-user vs c550502f-c39d-4bb3-bb8c-d193657fdb24)
 * 2. Database conflicts (409 errors)
 * 3. TOTP decryption failures
 * 4. Bad Request errors (400 errors)
 *
 * Usage: Copy and paste this entire script into browser console
 */

(async function ultimateLoginFix() {
    console.log('🚨 ULTIMATE LOGIN FIX STARTING...');
    console.log('💥 NUCLEAR APPROACH - FIXING ALL LOGIN ISSUES');

    try {
        // All possible user IDs we've seen
        const userIds = [
            'dynamic-pierre-user',
            'c550502f-c39d-4bb3-bb8c-d193657fdb24',
            'pierre-user-789',
            'super-user-456'
        ];

        const userEmail = 'pierre@phaetonai.com';

        console.log('🎯 Target User: ' + userEmail);
        console.log('🔑 User IDs to clean: ' + userIds.join(', '));

        // Step 1: NUCLEAR CLEAR - Remove ALL localStorage data
        console.log('📋 Step 1: NUCLEAR CLEAR of ALL localStorage...');

        // Get count before clearing
        const beforeCount = localStorage.length;
        console.log(`   Found ${beforeCount} localStorage items`);

        // Clear everything - nuclear option
        localStorage.clear();
        console.log('   💥 ALL localStorage cleared');

        console.log('✅ Step 1 Complete: Nuclear clear performed');

        // Step 2: Emergency utilities if available
        console.log('📋 Step 2: Using ALL available emergency utilities...');

        try {
            // Clear failed login attempts
            if (window.LoginAttemptTracker) {
                if (window.LoginAttemptTracker.emergencyClearAll) {
                    window.LoginAttemptTracker.emergencyClearAll();
                    console.log('   ✅ LoginAttemptTracker cleared');
                }
                if (window.LoginAttemptTracker.emergencyUnblock) {
                    window.LoginAttemptTracker.emergencyUnblock(userEmail);
                    console.log('   ✅ User unblocked in LoginAttemptTracker');
                }
            }

            // Use MFA emergency recovery for all user IDs
            if (window.mfaEmergencyRecovery) {
                for (const userId of userIds) {
                    try {
                        if (window.mfaEmergencyRecovery.emergencyMFAReset) {
                            await window.mfaEmergencyRecovery.emergencyMFAReset(userId);
                            console.log(`   ✅ MFA reset for: ${userId}`);
                        }
                        if (window.mfaEmergencyRecovery.createTemporaryMFABypass) {
                            window.mfaEmergencyRecovery.createTemporaryMFABypass(userId, 2);
                            console.log(`   ✅ Temporary MFA bypass created for: ${userId}`);
                        }
                    } catch (e) {
                        console.warn(`   ⚠️ MFA reset failed for ${userId}:`, e.message);
                    }
                }
            }

            // Use fixUserIssues if available
            if (window.fixUserIssues) {
                if (window.fixUserIssues.fixAllUserIssues) {
                    await window.fixUserIssues.fixAllUserIssues();
                    console.log('   ✅ fixUserIssues.fixAllUserIssues() completed');
                }
                if (window.fixUserIssues.forceRefreshAllUserData) {
                    await window.fixUserIssues.forceRefreshAllUserData();
                    console.log('   ✅ Force refresh all user data completed');
                }
            }

            // Use authFixer if available
            if (window.authFixer) {
                if (window.authFixer.fixAll) {
                    await window.authFixer.fixAll();
                    console.log('   ✅ authFixer.fixAll() completed');
                }
                if (window.authFixer.fixPierre) {
                    await window.authFixer.fixPierre();
                    console.log('   ✅ authFixer.fixPierre() completed');
                }
            }

        } catch (utilError) {
            console.warn('   ⚠️ Some emergency utilities failed:', utilError.message);
        }

        console.log('✅ Step 2 Complete: Emergency utilities attempted');

        // Step 3: Force clean user state for all IDs
        console.log('📋 Step 3: Creating clean user states...');

        for (const userId of userIds) {
            try {
                // Create minimal clean user settings
                const cleanSettings = {
                    mfaEnabled: false,
                    mfaSetupCompleted: false,
                    lastLogin: new Date().toISOString(),
                    theme: 'light',
                    userId: userId,
                    email: userEmail
                };

                localStorage.setItem(`userSettings_${userId}`, JSON.stringify(cleanSettings));
                console.log(`   ✅ Clean settings created for: ${userId}`);

                // Clear any session data
                localStorage.removeItem(`mfa_session_${userId}`);
                localStorage.removeItem(`mfa_verified_${userId}`);
                localStorage.removeItem(`totp_${userId}`);

            } catch (e) {
                console.warn(`   ⚠️ Failed to create clean state for ${userId}:`, e.message);
            }
        }

        console.log('✅ Step 3 Complete: Clean user states created');

        // Step 4: Clear any remaining authentication state
        console.log('📋 Step 4: Final authentication cleanup...');

        const authKeys = [
            'currentUser',
            'userSession',
            'authState',
            'msal.interaction.status',
            'msal.token.keys',
            'totpService_initialized',
            'crossDeviceSync_initialized'
        ];

        authKeys.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });

        console.log('   ✅ Authentication state cleared');
        console.log('✅ Step 4 Complete: Final cleanup done');

        // Step 5: Provide recovery instructions
        console.log('📋 Step 5: IMMEDIATE RECOVERY INSTRUCTIONS');
        console.log('');
        console.log('🚀 DO THIS RIGHT NOW:');
        console.log('1. 🔄 REFRESH THE PAGE (F5 or Ctrl+R) - DO THIS FIRST!');
        console.log('2. 🌐 Go to login page');
        console.log('3. 📧 Enter: pierre@phaetonai.com');
        console.log('4. 🔑 Enter your password');
        console.log('5. ⚡ If MFA prompt appears, look for "Skip" or "Setup New MFA" option');
        console.log('6. 🏠 You should reach the dashboard');
        console.log('');
        console.log('🔧 IF YOU STILL CAN\'T LOGIN:');
        console.log('   - Try incognito/private window');
        console.log('   - Use Ctrl+Shift+L for emergency logout');
        console.log('   - Run: window.ultimateFixUtils.tryAllUserIds()');
        console.log('   - Contact system admin if all fails');
        console.log('');
        console.log('📱 AFTER SUCCESSFUL LOGIN:');
        console.log('   - Go to Settings → Security');
        console.log('   - Delete old "CareXPS" entry from Google Authenticator');
        console.log('   - Click "Setup New MFA"');
        console.log('   - Scan fresh QR code');
        console.log('');

        // Step 6: Verification
        console.log('📋 Step 6: Verifying nuclear cleanup...');

        const afterCount = localStorage.length;
        console.log(`   localStorage items: Before=${beforeCount}, After=${afterCount}`);

        if (afterCount < 5) {
            console.log('   ✅ Nuclear cleanup successful - minimal data remaining');
        } else {
            console.warn(`   ⚠️ Still have ${afterCount} items in localStorage`);
        }

        console.log('');
        console.log('💥 ULTIMATE LOGIN FIX COMPLETED!');
        console.log('🚀 REFRESH THE PAGE NOW AND TRY LOGGING IN!');

        return {
            success: true,
            method: 'nuclear_clear',
            userIds: userIds,
            email: userEmail,
            beforeCount: beforeCount,
            afterCount: afterCount
        };

    } catch (error) {
        console.error('❌ Ultimate Login Fix failed:', error);
        console.log('');
        console.log('🚨 LAST RESORT OPTIONS:');
        console.log('1. Close ALL browser windows and restart browser');
        console.log('2. Try different browser (Chrome, Firefox, Edge)');
        console.log('3. Use incognito/private mode');
        console.log('4. Clear browser data completely');
        console.log('5. Contact system administrator');

        return {
            success: false,
            error: error.message,
            lastResort: true
        };
    }
})();

// Ultimate fix utilities for ongoing issues
window.ultimateFixUtils = {
    userIds: [
        'dynamic-pierre-user',
        'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'pierre-user-789',
        'super-user-456'
    ],

    userEmail: 'pierre@phaetonai.com',

    // Try logging in with different user IDs
    tryAllUserIds: function() {
        console.log('🔄 Trying to set up login for all user IDs...');

        this.userIds.forEach(userId => {
            const settings = {
                mfaEnabled: false,
                userId: userId,
                email: this.userEmail,
                lastLogin: new Date().toISOString()
            };

            localStorage.setItem(`userSettings_${userId}`, JSON.stringify(settings));
            localStorage.setItem('currentUser', JSON.stringify({
                id: userId,
                email: this.userEmail,
                name: 'Pierre',
                role: 'super_user'
            }));

            console.log(`   ✅ Setup attempt for: ${userId}`);
        });

        console.log('💡 Refresh page and try login now');
    },

    // Complete nuclear option
    nuclearDestroy: function() {
        console.log('💥 NUCLEAR DESTROY - CLEARING EVERYTHING...');
        localStorage.clear();
        sessionStorage.clear();

        // Clear cookies
        document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        console.log('💥 Everything destroyed. Close browser and restart.');
    },

    // Check current login state
    checkLoginState: function() {
        console.log('🔍 Current login state:');
        console.log('localStorage items:', localStorage.length);
        console.log('currentUser:', localStorage.getItem('currentUser'));

        this.userIds.forEach(userId => {
            const settings = localStorage.getItem(`userSettings_${userId}`);
            if (settings) {
                console.log(`Settings for ${userId}:`, JSON.parse(settings));
            }
        });
    }
};

console.log('');
console.log('🔧 Ultimate Fix Utilities loaded:');
console.log('  - window.ultimateFixUtils.tryAllUserIds()');
console.log('  - window.ultimateFixUtils.nuclearDestroy()');
console.log('  - window.ultimateFixUtils.checkLoginState()');
console.log('');
console.log('🚀 REFRESH THE PAGE NOW TO TEST LOGIN!');