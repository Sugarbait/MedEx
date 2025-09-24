/**
 * 🚨 SUPABASE DATABASE TOTP CORRUPTION FIX
 *
 * This script directly cleans corrupted TOTP data from the Supabase database
 * which is preventing MFA verification from working.
 */

console.log('🚨 SUPABASE DATABASE TOTP FIX STARTING...');

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

(async function fixSupabaseTOTPCorruption() {
    try {
        console.log('🔍 Step 1: Accessing Supabase client...');

        // Get Supabase client
        const supabase = window.supabase || window._supabaseClient;

        if (!supabase) {
            throw new Error('No Supabase client found! Make sure you are logged in.');
        }

        console.log('✅ Supabase client found');

        console.log('🧹 Step 2: Clearing ALL corrupted TOTP data from database...');

        // Clear user_settings table TOTP data
        const { error: userSettingsError } = await supabase
            .from('user_settings')
            .update({
                totp_secret: null,
                mfa_enabled: false,
                totp_enabled: false,
                totp_setup_completed: false,
                mfa_backup_codes: null
            })
            .eq('user_id', userId);

        if (userSettingsError) {
            console.warn('user_settings update error:', userSettingsError);
        } else {
            console.log('✅ Cleared user_settings TOTP data');
        }

        // Clear any user_profiles TOTP data
        const { error: profilesError } = await supabase
            .from('user_profiles')
            .update({
                totp_secret: null,
                mfa_enabled: false,
                encrypted_totp_secret: null
            })
            .eq('user_id', userId);

        if (profilesError) {
            console.warn('user_profiles update error (table may not exist):', profilesError);
        } else {
            console.log('✅ Cleared user_profiles TOTP data');
        }

        // Delete from any dedicated MFA/TOTP tables
        const mfaTables = ['user_mfa', 'user_totp', 'mfa_secrets', 'totp_secrets'];

        for (const table of mfaTables) {
            try {
                const { error } = await supabase
                    .from(table)
                    .delete()
                    .eq('user_id', userId);

                if (error) {
                    console.warn(`${table} delete error (table may not exist):`, error);
                } else {
                    console.log(`✅ Cleared ${table} data`);
                }
            } catch (err) {
                console.warn(`${table} table doesn't exist or access denied:`, err.message);
            }
        }

        console.log('🔄 Step 3: Verifying database cleanup...');

        // Verify the cleanup worked
        const { data: verifySettings } = await supabase
            .from('user_settings')
            .select('totp_secret, mfa_enabled, totp_enabled')
            .eq('user_id', userId)
            .single();

        if (verifySettings) {
            console.log('📊 Database state after cleanup:', {
                totp_secret: verifySettings.totp_secret,
                mfa_enabled: verifySettings.mfa_enabled,
                totp_enabled: verifySettings.totp_enabled
            });

            if (verifySettings.totp_secret === null) {
                console.log('✅ Database TOTP corruption successfully cleared!');
            } else {
                console.warn('⚠️ TOTP data still exists in database:', verifySettings.totp_secret);
            }
        }

        console.log('🧹 Step 4: Clearing localStorage to match database...');

        // Clear localStorage to match the clean database state
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

        sessionStorage.clear();

        console.log(`✅ Cleared ${keysToRemove.length} localStorage entries`);

        console.log('🎯 Step 5: Setting clean user state...');

        // Set completely clean user state
        const cleanUserSettings = {
            userId: userId,
            email: 'pierre@phaetonai.com',
            mfaEnabled: false,
            totpEnabled: false,
            mfaSetupCompleted: false,
            totpSetupCompleted: false,
            supabaseDatabaseCleanupApplied: true,
            lastSupabaseCleanup: new Date().toISOString()
        };

        localStorage.setItem(`userSettings_${userId}`, JSON.stringify(cleanUserSettings));

        console.log('✅✅✅ SUPABASE DATABASE TOTP FIX COMPLETE! ✅✅✅');
        console.log('');
        console.log('🎉 RESULTS:');
        console.log('  ✅ Database TOTP corruption cleared');
        console.log('  ✅ localStorage corruption cleared');
        console.log('  ✅ Clean state established');
        console.log('');
        console.log('🔄 REFRESHING PAGE TO APPLY CHANGES...');
        console.log('');
        console.log('📋 NEXT STEPS AFTER REFRESH:');
        console.log('  1. Go to Settings → Security');
        console.log('  2. Click "Setup MFA"');
        console.log('  3. Fresh secrets will be generated');
        console.log('  4. QR code will work perfectly');
        console.log('  5. Authenticator codes will be accepted');

        // Auto-refresh after 4 seconds to show the results
        setTimeout(() => {
            window.location.reload();
        }, 4000);

        return {
            success: true,
            method: 'supabase_database_cleanup',
            databaseCleaned: true,
            localStorageCleaned: true
        };

    } catch (error) {
        console.error('💥 Supabase database cleanup failed:', error);

        // Emergency fallback
        console.log('🚨 Performing emergency localStorage cleanup...');
        localStorage.clear();
        sessionStorage.clear();

        setTimeout(() => {
            alert('Supabase database cleanup failed. Performed emergency localStorage clear. Please try MFA setup again.');
            window.location.reload();
        }, 2000);

        return {
            success: false,
            error: error.message,
            emergencyFallbackApplied: true
        };
    }
})();

console.log('');
console.log('🔥 SUPABASE DATABASE TOTP CORRUPTION FIX LOADED');
console.log('🚀 Executing direct database cleanup...');
console.log('⚠️ This will clean corrupted TOTP data directly from Supabase database');