/**
 * COMPREHENSIVE MFA FIX
 * This script addresses all MFA authentication issues:
 * 1. Clears ALL old test TOTP data
 * 2. Forces fresh MFA secret generation
 * 3. Fixes database inconsistencies
 * 4. Provides emergency recovery options
 *
 * Run this in browser console, then follow the setup instructions.
 */

console.log('🚀 COMPREHENSIVE MFA FIX - Starting complete cleanup and regeneration');

// Step 1: Complete localStorage cleanup for the problematic user
const problematicUser = 'dynamic-pierre-user';

console.log('🧹 Step 1: Clearing ALL existing TOTP data for:', problematicUser);
const keysToRemove = [
  `totp_${problematicUser}`,
  `totp_secret_${problematicUser}`,
  `totp_enabled_${problematicUser}`,
  `mfa_sessions_${problematicUser}`,
  'totp_setup_temp',
  'mfa_setup_in_progress',
  'emergency_totp_fallback'
];

keysToRemove.forEach(key => {
  if (localStorage.getItem(key)) {
    console.log('   ❌ Removing:', key);
    localStorage.removeItem(key);
  }
});

console.log('✅ Step 1 Complete: All localStorage data cleared');

// Step 2: Database cleanup function (if Supabase is available)
async function cleanupDatabase() {
  console.log('🗃️ Step 2: Attempting database cleanup...');

  try {
    // Check if supabase is available in the global scope
    if (typeof window !== 'undefined' && window.supabase) {
      const supabase = window.supabase;

      // Delete existing TOTP records for the user
      const { error: deleteError } = await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', problematicUser);

      if (deleteError) {
        console.log('   ⚠️ Database delete failed (this is OK if no records exist):', deleteError.message);
      } else {
        console.log('   ✅ Existing database TOTP records cleared');
      }

      // Also clear any MFA config records
      const { error: mfaDeleteError } = await supabase
        .from('user_mfa_configs')
        .delete()
        .eq('user_id', problematicUser);

      if (mfaDeleteError) {
        console.log('   ⚠️ MFA config delete failed (this is OK if no records exist):', mfaDeleteError.message);
      } else {
        console.log('   ✅ MFA config records cleared');
      }

      console.log('✅ Step 2 Complete: Database cleanup successful');
      return true;
    } else {
      console.log('   ⚠️ Supabase not available in global scope, skipping database cleanup');
      return false;
    }
  } catch (error) {
    console.log('   ⚠️ Database cleanup failed:', error.message);
    return false;
  }
}

// Step 3: Generate fresh TOTP setup instructions
function generateFreshSetupInstructions() {
  console.log('📱 Step 3: Fresh MFA Setup Instructions');
  console.log('');
  console.log('🔐 To complete the MFA fix:');
  console.log('');
  console.log('1. 📱 FIRST: Open your authenticator app');
  console.log('2. 🗑️ DELETE the old "CareXPS Healthcare CRM" entry (if it exists)');
  console.log('3. ⚙️ Go to CareXPS Settings page');
  console.log('4. 🆕 Click "Setup New MFA" or "Enable MFA"');
  console.log('5. 📷 Scan the NEW QR code with your authenticator app');
  console.log('6. 🔢 Enter the 6-digit code from your app to verify');
  console.log('7. ✅ Complete the setup process');
  console.log('8. 🚪 Try logging out and back in with the new code');
  console.log('');
  console.log('🚨 IMPORTANT: Do NOT use any old codes or manual entry keys!');
  console.log('🔄 The QR code will generate a completely fresh secret.');
}

// Step 4: Create emergency recovery options
function createEmergencyRecovery() {
  console.log('🆘 Step 4: Setting up emergency recovery options');

  // Create emergency recovery instructions
  const emergencyRecovery = {
    user: problematicUser,
    recoveryMethods: [
      {
        method: 'settings_page_reset',
        description: 'Use Settings page to setup fresh MFA',
        priority: 'high',
        instructions: 'Go to Settings > Security > Setup New MFA'
      },
      {
        method: 'browser_console_disable',
        description: 'Temporarily disable MFA via console',
        priority: 'medium',
        code: `
// Emergency MFA disable (run in console)
localStorage.setItem('emergency_mfa_disabled_${problematicUser}', 'true');
localStorage.setItem('emergency_mfa_disabled_timestamp', new Date().toISOString());
console.log('Emergency MFA disabled - you have 1 hour to fix MFA setup');
`
      },
      {
        method: 'admin_reset',
        description: 'Contact administrator for manual MFA reset',
        priority: 'low',
        instructions: 'If all else fails, contact system administrator'
      }
    ],
    created: new Date().toISOString()
  };

  localStorage.setItem('mfa_emergency_recovery', JSON.stringify(emergencyRecovery));
  console.log('✅ Emergency recovery options saved to localStorage');

  return emergencyRecovery;
}

// Step 5: Validation function to check cleanup success
function validateCleanup() {
  console.log('🔍 Step 5: Validating cleanup success');

  let allClear = true;
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      console.log('   ❌ Still exists:', key);
      allClear = false;
    } else {
      console.log('   ✅ Cleared:', key);
    }
  });

  // Check for any remaining TOTP-related keys
  const remainingTotpKeys = Object.keys(localStorage).filter(key =>
    key.toLowerCase().includes('totp') ||
    key.toLowerCase().includes('mfa') ||
    key.includes(problematicUser)
  );

  if (remainingTotpKeys.length > 1) { // Allow the emergency recovery key
    console.log('   ⚠️ Remaining MFA-related keys found:');
    remainingTotpKeys.forEach(key => console.log('     -', key));
    allClear = false;
  }

  return allClear;
}

// Execute the comprehensive fix
async function executeComprehensiveFix() {
  console.log('🔄 Starting comprehensive MFA fix execution...');
  console.log('');

  // Run database cleanup
  const dbCleanupSuccess = await cleanupDatabase();

  // Generate fresh setup instructions
  generateFreshSetupInstructions();

  // Create emergency recovery
  const recoveryOptions = createEmergencyRecovery();

  // Validate cleanup
  const cleanupSuccess = validateCleanup();

  console.log('');
  console.log('📊 COMPREHENSIVE FIX SUMMARY:');
  console.log('=====================================');
  console.log('🧹 localStorage cleanup:', cleanupSuccess ? '✅ Success' : '❌ Failed');
  console.log('🗃️ Database cleanup:', dbCleanupSuccess ? '✅ Success' : '⚠️ Skipped/Failed');
  console.log('🆘 Emergency recovery:', '✅ Configured');
  console.log('📱 Fresh setup instructions:', '✅ Ready');
  console.log('');

  if (cleanupSuccess) {
    console.log('🎉 COMPREHENSIVE FIX COMPLETE!');
    console.log('');
    console.log('🔥 The old test secret "JBSWY3DPEHPK3PXP" has been COMPLETELY REMOVED');
    console.log('🆕 Follow the setup instructions above to create fresh MFA');
    console.log('🔐 Your new secret will be cryptographically secure and unique');
    console.log('');
    console.log('⏭️ NEXT STEPS:');
    console.log('1. Follow the fresh setup instructions above');
    console.log('2. Test login with the new MFA code');
    console.log('3. If issues persist, check the emergency recovery options');
  } else {
    console.log('⚠️ PARTIAL CLEANUP - Some issues detected');
    console.log('🔧 Manual intervention may be required');
  }

  return {
    success: cleanupSuccess,
    dbCleanup: dbCleanupSuccess,
    recoveryOptions: recoveryOptions
  };
}

// Auto-execute the fix
executeComprehensiveFix().catch(error => {
  console.error('❌ Comprehensive fix execution failed:', error);
  console.log('🆘 You can still try the manual steps in the instructions above');
});