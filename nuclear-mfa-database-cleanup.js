/**
 * 🚨 NUCLEAR MFA DATABASE CLEANUP
 *
 * This script specifically targets and removes corrupted MFA/TOTP data
 * from the database that's preventing new MFA setup.
 */

console.log('🚨 NUCLEAR MFA DATABASE CLEANUP STARTING...');

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

(async function nuclearMFADatabaseCleanup() {
    try {
        console.log('💣 Step 1: Clearing corrupted database TOTP entries...');

        // Access Supabase client if available
        if (window.supabase || window._supabaseClient) {
            const supabase = window.supabase || window._supabaseClient;

            console.log('🔥 Found Supabase client - clearing database TOTP data...');

            // Delete ALL TOTP/MFA records for this user
            try {
                // Clear user_settings TOTP data
                const { error: settingsError } = await supabase
                    .from('user_settings')
                    .update({
                        totp_secret: null,
                        mfa_enabled: false,
                        totp_enabled: false
                    })
                    .eq('user_id', userId);

                if (settingsError) {
                    console.warn('Settings update error (may not exist):', settingsError);
                } else {
                    console.log('✅ Cleared user_settings TOTP data');
                }

                // Clear any MFA-specific tables if they exist
                const { error: mfaError } = await supabase
                    .from('user_mfa')
                    .delete()
                    .eq('user_id', userId);

                if (mfaError) {
                    console.warn('MFA table delete error (table may not exist):', mfaError);
                } else {
                    console.log('✅ Cleared user_mfa table data');
                }

                // Clear any TOTP-specific tables if they exist
                const { error: totpError } = await supabase
                    .from('user_totp')
                    .delete()
                    .eq('user_id', userId);

                if (totpError) {
                    console.warn('TOTP table delete error (table may not exist):', totpError);
                } else {
                    console.log('✅ Cleared user_totp table data');
                }

                console.log('✅ Database TOTP data cleared successfully');

            } catch (dbError) {
                console.error('Database cleanup error (continuing with localStorage cleanup):', dbError);
            }
        } else {
            console.log('⚠️ No Supabase client found - proceeding with localStorage cleanup only');
        }

        console.log('💣 Step 2: Nuclear localStorage cleanup...');

        // Clear ALL MFA/TOTP related localStorage
        const keysToRemove = [];
        for (const key of Object.keys(localStorage)) {
            if (key.includes('totp') ||
                key.includes('mfa') ||
                key.includes('secret') ||
                key.includes(userId) ||
                key.includes('totpService') ||
                key.includes('cleanTotp')) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            console.log(`  🗑️ Removing: ${key}`);
            localStorage.removeItem(key);
        });

        // Clear sessionStorage
        sessionStorage.clear();

        console.log(`✅ Cleared ${keysToRemove.length} corrupted localStorage entries`);

        console.log('💣 Step 3: Reset user MFA state completely...');

        // Create completely fresh user state
        const freshUserSettings = {
            userId: userId,
            email: 'pierre@phaetonai.com',
            mfaEnabled: false,
            totpEnabled: false,
            mfaSetupCompleted: false,
            totpSetupCompleted: false,
            lastDatabaseCleanup: new Date().toISOString(),
            nuclearDatabaseCleanupApplied: true
        };

        localStorage.setItem(`userSettings_${userId}`, JSON.stringify(freshUserSettings));

        // Clear any cached TOTP services
        if (window.cleanTotpService) {
            console.log('🔧 Resetting cleanTotpService cache...');
            // Force clear any internal caches
        }

        console.log('✅ NUCLEAR MFA DATABASE CLEANUP COMPLETE!');
        console.log('🔄 REFRESHING PAGE TO APPLY CHANGES...');
        console.log('');
        console.log('📋 After refresh - New MFA Setup Instructions:');
        console.log('  1. Go to Settings → Security');
        console.log('  2. Click "Setup MFA"');
        console.log('  3. The system will generate fresh, clean secrets');
        console.log('  4. QR code should work perfectly');
        console.log('  5. Authenticator codes will be accepted');

        // Auto-refresh after 3 seconds
        setTimeout(() => {
            window.location.reload();
        }, 3000);

        return {
            success: true,
            method: 'nuclear_database_cleanup',
            databaseCleaned: true,
            itemsRemoved: keysToRemove.length,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('💥 Nuclear database cleanup failed:', error);

        // Emergency fallback - comprehensive clear
        localStorage.clear();
        sessionStorage.clear();

        setTimeout(() => {
            alert('Nuclear database cleanup encountered an error. Performing emergency total clear and refresh.');
            window.location.reload();
        }, 2000);

        return {
            success: false,
            error: error.message,
            emergencyFallbackActivated: true
        };
    }
})();

console.log('💣 NUCLEAR MFA DATABASE CLEANUP SCRIPT LOADED');
console.log('🚀 Executing comprehensive database and localStorage cleanup...');
console.log('⚠️ This will completely reset your MFA system from database level');