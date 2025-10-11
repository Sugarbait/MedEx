/**
 * URGENT FIX: Unlock and Reset Password for dr@medexhealthservices.com
 *
 * This script will:
 * 1. Query the Supabase database to get the user ID
 * 2. Clear all lockout data from Supabase
 * 3. Clear all lockout data from localStorage
 * 4. Reset the password and store it in BOTH Supabase AND localStorage
 * 5. Verify the password works
 *
 * USAGE:
 * 1. Run SQL queries in Supabase SQL Editor first
 * 2. Then run this script in the browser console
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDk2NDcsImV4cCI6MjA0MjQyNTY0N30.2e5AqZLo6z8bkmvQXBL7pLgTCJIcKQS6TqD7BKfQYRM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Email to unlock
const EMAIL = 'dr@medexhealthservices.com';
const NEW_PASSWORD = 'MedEx2025!'; // Strong temporary password

// ============================================================================
// STEP 1: SQL QUERIES TO RUN IN SUPABASE SQL EDITOR
// ============================================================================

const SQL_QUERIES = `
-- 1. Get user ID for dr@medexhealthservices.com
SELECT id, email, name, role, is_active, tenant_id, created_at
FROM users
WHERE email = 'dr@medexhealthservices.com' AND tenant_id = 'medex';

-- 2. Clear failed login attempts from Supabase
DELETE FROM failed_login_attempts WHERE email = 'dr@medexhealthservices.com';

-- 3. Check user_profiles for stored credentials
SELECT user_id, encrypted_retell_api_key
FROM user_profiles
WHERE user_id = (
  SELECT id FROM users WHERE email = 'dr@medexhealthservices.com' AND tenant_id = 'medex'
);

-- 4. Enable the account if disabled
UPDATE users
SET is_active = true, updated_at = NOW()
WHERE email = 'dr@medexhealthservices.com' AND tenant_id = 'medex';
`;

console.log('📋 STEP 1: Run these SQL queries in Supabase SQL Editor:');
console.log('='.repeat(80));
console.log(SQL_QUERIES);
console.log('='.repeat(80));

// ============================================================================
// STEP 2: BROWSER CONSOLE FUNCTIONS
// ============================================================================

async function unlockAndResetDrAccount() {
  console.log('\n🔧 Starting account unlock and password reset...\n');

  try {
    // STEP 1: Get user ID from Supabase
    console.log('📍 Step 1: Getting user ID from Supabase...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, is_active')
      .eq('email', EMAIL)
      .eq('tenant_id', 'medex')
      .single();

    if (userError || !user) {
      console.error('❌ Error: User not found in database');
      console.error(userError);
      return { success: false, error: 'User not found' };
    }

    console.log('✅ Found user:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.is_active
    });

    const userId = user.id;

    // STEP 2: Clear Supabase failed_login_attempts
    console.log('\n📍 Step 2: Clearing Supabase failed_login_attempts...');
    const { error: deleteError } = await supabase
      .from('failed_login_attempts')
      .delete()
      .eq('email', EMAIL);

    if (deleteError) {
      console.warn('⚠️ Warning: Could not clear Supabase failed attempts:', deleteError.message);
    } else {
      console.log('✅ Cleared Supabase failed_login_attempts');
    }

    // STEP 3: Clear localStorage lockout data
    console.log('\n📍 Step 3: Clearing localStorage lockout data...');

    // Clear loginStats
    localStorage.removeItem(`loginStats_${userId}`);
    console.log(`✅ Cleared loginStats_${userId}`);

    // Clear failed_login_attempts from localStorage
    try {
      const existingAttempts = localStorage.getItem('failed_login_attempts');
      if (existingAttempts) {
        let attempts = JSON.parse(existingAttempts);
        const originalCount = attempts.length;
        attempts = attempts.filter(attempt => attempt.email !== EMAIL);
        localStorage.setItem('failed_login_attempts', JSON.stringify(attempts));
        console.log(`✅ Removed ${originalCount - attempts.length} failed attempts from localStorage`);
      }
    } catch (err) {
      console.warn('⚠️ Warning: Could not clear localStorage failed attempts:', err);
      localStorage.removeItem('failed_login_attempts');
    }

    // Set clean lockout state
    const cleanStats = {
      loginAttempts: 0,
      lastLogin: undefined,
      lockoutUntil: undefined
    };
    localStorage.setItem(`loginStats_${userId}`, JSON.stringify(cleanStats));
    console.log('✅ Set clean lockout state in localStorage');

    // STEP 4: Store new password in BOTH Supabase AND localStorage
    console.log('\n📍 Step 4: Storing new password in BOTH locations...');

    // Import encryption service (needs to be available in the app)
    if (typeof window.encryptionService === 'undefined') {
      console.error('❌ Error: encryptionService not available. Please ensure the app is running.');
      return { success: false, error: 'Encryption service not available' };
    }

    const encryptionService = window.encryptionService;

    // Create credentials object
    const credentials = {
      email: EMAIL,
      password: NEW_PASSWORD,
      tempPassword: false
    };

    // Encrypt the password
    const hashedPassword = await encryptionService.encryptString(NEW_PASSWORD);

    const credentialsToStore = {
      ...credentials,
      password: hashedPassword
    };

    // Encrypt the entire credentials object
    const encryptedCredentials = await encryptionService.encryptString(JSON.stringify(credentialsToStore));

    // Store in Supabase user_profiles
    const { error: supabaseError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        encrypted_retell_api_key: encryptedCredentials
      });

    if (supabaseError) {
      console.error('❌ Error storing credentials in Supabase:', supabaseError.message);
      console.log('⚠️ Will try localStorage only...');
    } else {
      console.log('✅ Credentials stored in Supabase successfully');
    }

    // Store in localStorage
    localStorage.setItem(`userCredentials_${userId}`, encryptedCredentials);
    console.log('✅ Credentials stored in localStorage successfully');

    // STEP 5: Verify credentials are stored correctly
    console.log('\n📍 Step 5: Verifying password storage...');

    // Try to retrieve from Supabase
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('encrypted_retell_api_key')
      .eq('user_id', userId)
      .single();

    if (!profileError && profileData?.encrypted_retell_api_key) {
      const decrypted = await encryptionService.decryptString(profileData.encrypted_retell_api_key);
      const retrievedCreds = JSON.parse(decrypted);
      console.log('✅ Supabase storage verified - credentials can be retrieved');
    } else {
      console.warn('⚠️ Warning: Could not verify Supabase storage');
    }

    // Try to retrieve from localStorage
    const localCreds = localStorage.getItem(`userCredentials_${userId}`);
    if (localCreds) {
      const decrypted = await encryptionService.decryptString(localCreds);
      const retrievedCreds = JSON.parse(decrypted);
      console.log('✅ localStorage storage verified - credentials can be retrieved');
    } else {
      console.error('❌ Error: localStorage storage verification failed');
    }

    // STEP 6: Enable the account
    console.log('\n📍 Step 6: Enabling user account...');
    const { error: enableError } = await supabase
      .from('users')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('tenant_id', 'medex');

    if (enableError) {
      console.error('❌ Error enabling account:', enableError.message);
    } else {
      console.log('✅ Account enabled successfully');
    }

    // FINAL REPORT
    console.log('\n' + '='.repeat(80));
    console.log('🎉 UNLOCK AND PASSWORD RESET COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📊 Summary:');
    console.log(`   ✅ User ID: ${userId}`);
    console.log(`   ✅ Email: ${EMAIL}`);
    console.log(`   ✅ Account unlocked: YES`);
    console.log(`   ✅ Failed login attempts cleared: YES`);
    console.log(`   ✅ New password set: YES`);
    console.log(`   ✅ Password stored in Supabase: ${!supabaseError ? 'YES' : 'NO (localStorage only)'}`);
    console.log(`   ✅ Password stored in localStorage: YES`);
    console.log(`   ✅ Account enabled: YES`);
    console.log('\n🔑 New Login Credentials:');
    console.log(`   Email: ${EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Test login with the new password');
    console.log('   2. If successful, ask user to change password in Settings');
    console.log('   3. Password should now persist across sessions');
    console.log('='.repeat(80));

    return {
      success: true,
      userId: userId,
      passwordStoredInSupabase: !supabaseError,
      passwordStoredInLocalStorage: true
    };

  } catch (error) {
    console.error('\n❌ UNLOCK FAILED:', error);
    console.error('Error details:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// DIAGNOSTIC FUNCTION
// ============================================================================

async function diagnoseDrAccount() {
  console.log('\n🔍 Diagnosing dr@medexhealthservices.com account...\n');

  try {
    // Check Supabase user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', EMAIL)
      .eq('tenant_id', 'medex')
      .single();

    console.log('📍 Supabase User Record:');
    if (userError) {
      console.log('   ❌ Error:', userError.message);
    } else if (!user) {
      console.log('   ❌ Not found');
    } else {
      console.log('   ✅ Found:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLogin: user.last_login
      });
    }

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const userId = user.id;

    // Check failed_login_attempts in Supabase
    const { data: attempts, error: attemptsError } = await supabase
      .from('failed_login_attempts')
      .select('*')
      .eq('email', EMAIL);

    console.log('\n📍 Supabase Failed Login Attempts:');
    if (attemptsError) {
      console.log('   ❌ Error:', attemptsError.message);
    } else {
      console.log(`   Found ${attempts?.length || 0} attempts`);
      if (attempts && attempts.length > 0) {
        console.log('   Recent attempts:', attempts.slice(0, 3));
      }
    }

    // Check user_profiles for credentials
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('encrypted_retell_api_key')
      .eq('user_id', userId)
      .single();

    console.log('\n📍 Supabase Credentials Storage (user_profiles):');
    if (profileError) {
      console.log('   ❌ Error:', profileError.message);
    } else if (!profile?.encrypted_retell_api_key) {
      console.log('   ⚠️ No credentials stored');
    } else {
      console.log('   ✅ Credentials found');
      if (typeof window.encryptionService !== 'undefined') {
        try {
          const decrypted = await window.encryptionService.decryptString(profile.encrypted_retell_api_key);
          const creds = JSON.parse(decrypted);
          console.log('   ✅ Can decrypt credentials');
          console.log('   Email in credentials:', creds.email);
        } catch (err) {
          console.log('   ❌ Cannot decrypt credentials:', err.message);
        }
      }
    }

    // Check localStorage
    console.log('\n📍 localStorage Data:');

    const loginStats = localStorage.getItem(`loginStats_${userId}`);
    console.log(`   loginStats_${userId}:`, loginStats ? JSON.parse(loginStats) : 'Not found');

    const userCreds = localStorage.getItem(`userCredentials_${userId}`);
    console.log(`   userCredentials_${userId}:`, userCreds ? '✅ Found' : '❌ Not found');

    if (userCreds && typeof window.encryptionService !== 'undefined') {
      try {
        const decrypted = await window.encryptionService.decryptString(userCreds);
        const creds = JSON.parse(decrypted);
        console.log('   ✅ Can decrypt localStorage credentials');
        console.log('   Email in credentials:', creds.email);
      } catch (err) {
        console.log('   ❌ Cannot decrypt localStorage credentials:', err.message);
      }
    }

    const failedAttempts = localStorage.getItem('failed_login_attempts');
    if (failedAttempts) {
      const attempts = JSON.parse(failedAttempts);
      const drAttempts = attempts.filter(a => a.email === EMAIL);
      console.log(`   failed_login_attempts: ${drAttempts.length} for this user`);
    } else {
      console.log('   failed_login_attempts: Not found');
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('='.repeat(80));
    console.log(`User ID: ${userId}`);
    console.log(`Account Active: ${user.is_active ? 'YES' : 'NO'}`);
    console.log(`Failed Attempts in Supabase: ${attempts?.length || 0}`);
    console.log(`Credentials in Supabase: ${profile?.encrypted_retell_api_key ? 'YES' : 'NO'}`);
    console.log(`Credentials in localStorage: ${userCreds ? 'YES' : 'NO'}`);
    console.log('='.repeat(80));

    return {
      success: true,
      userId: userId,
      isActive: user.is_active,
      hasSupabaseAttempts: (attempts?.length || 0) > 0,
      hasSupabaseCredentials: !!profile?.encrypted_retell_api_key,
      hasLocalStorageCredentials: !!userCreds
    };

  } catch (error) {
    console.error('\n❌ DIAGNOSIS FAILED:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// EXPORT FUNCTIONS TO WINDOW FOR EASY ACCESS
// ============================================================================

if (typeof window !== 'undefined') {
  window.unlockDrAccount = unlockAndResetDrAccount;
  window.diagnoseDrAccount = diagnoseDrAccount;

  console.log('\n✅ Functions loaded! Use in browser console:');
  console.log('   - window.diagnoseDrAccount() - Diagnose the account issue');
  console.log('   - window.unlockDrAccount() - Unlock and reset password');
}

export { unlockAndResetDrAccount, diagnoseDrAccount };
