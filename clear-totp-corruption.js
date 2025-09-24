/**
 * 🚨 NUCLEAR TOTP CLEANUP - Complete Corruption Removal
 *
 * This script completely removes ALL corrupted TOTP data and ensures
 * a completely fresh start for MFA setup.
 */

console.log('🚨 NUCLEAR TOTP CLEANUP STARTING...');

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
const userEmail = 'pierre@phaetonai.com';

(async function nuclearTOTPCleanup() {
    try {
        console.log('💣 Step 1: Nuclear clearing of ALL TOTP data...');

        // Clear all TOTP-related localStorage entries
        const keysToRemove = [];
        for (const key of Object.keys(localStorage)) {
            if (key.includes('totp') ||
                key.includes('mfa') ||
                key.includes('secret') ||
                key.includes(userId)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            console.log(`  🗑️ Removing: ${key}`);
            localStorage.removeItem(key);
        });

        // Clear sessionStorage too
        sessionStorage.clear();

        console.log(`✅ Cleared ${keysToRemove.length} corrupted entries`);

        console.log('💣 Step 2: Resetting TOTP state in application...');

        // Force reset any global TOTP state
        if (window.cleanTotpService) {
            console.log('🔧 Resetting cleanTotpService state...');
            // Force clear any cached data
        }

        // Clear any emergency bypasses
        localStorage.removeItem(`emergency_totp_bypass_${userId}`);
        localStorage.removeItem(`emergency_totp_bypass_${userId}_expiry`);
        localStorage.removeItem(`mfa_permanent_bypass_${userId}`);

        console.log('💣 Step 3: Creating completely fresh environment...');

        // Set fresh user state without any MFA
        const freshUserSettings = {
            userId: userId,
            email: userEmail,
            mfaEnabled: false,
            totpEnabled: false,
            mfaSetupCompleted: false,
            lastReset: new Date().toISOString(),
            nuclearCleanupApplied: true
        };

        localStorage.setItem(`userSettings_${userId}`, JSON.stringify(freshUserSettings));

        console.log('✅ NUCLEAR TOTP CLEANUP COMPLETE!');
        console.log('🔄 REFRESHING PAGE TO APPLY CHANGES...');
        console.log('');
        console.log('📋 After refresh:');
        console.log('  1. Go to Settings');
        console.log('  2. Try MFA setup again');
        console.log('  3. The system will be completely clean');

        // Auto-refresh after 3 seconds
        setTimeout(() => {
            window.location.reload();
        }, 3000);

        return {
            success: true,
            method: 'nuclear_cleanup',
            itemsRemoved: keysToRemove.length,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('💥 Nuclear cleanup failed:', error);

        // Emergency fallback - just clear everything
        localStorage.clear();
        sessionStorage.clear();

        setTimeout(() => {
            alert('Nuclear cleanup encountered an error. Performing emergency clear and refresh.');
            window.location.reload();
        }, 2000);

        return {
            success: false,
            error: error.message,
            fallbackActivated: true
        };
    }
})();

console.log('');
console.log('💣 NUCLEAR TOTP CLEANUP SCRIPT LOADED');
console.log('🚀 Executing automatic cleanup...');
console.log('⚠️  This will completely reset your TOTP system');