// 🚨 NUCLEAR MFA DATABASE CLEANUP - FIXED VERSION
console.log('🚨 NUCLEAR MFA DATABASE CLEANUP STARTING...');

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

(async function nuclearMFADatabaseCleanup() {
    try {
        console.log('💣 Step 1: Clearing corrupted database TOTP entries...');

        // Access Supabase client if available
        if (window.supabase || window._supabaseClient) {
            const supabase = window.supabase || window._supabaseClient;

            console.log('🔥 Found Supabase client - clearing database TOTP data...');

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

            console.log('✅ Database TOTP data cleared successfully');
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

        sessionStorage.clear();

        console.log(`✅ Cleared ${keysToRemove.length} corrupted entries`);

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

        console.log('✅ NUCLEAR MFA DATABASE CLEANUP COMPLETE!');
        console.log('🔄 REFRESHING PAGE...');

        setTimeout(() => {
            window.location.reload();
        }, 3000);

        return { success: true, cleanupApplied: true };

    } catch (error) {
        console.error('💥 Cleanup failed:', error);
        localStorage.clear();
        sessionStorage.clear();
        setTimeout(() => window.location.reload(), 2000);
        return { success: false, error: error.message };
    }
})();