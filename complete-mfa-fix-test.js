/**
 * Complete MFA Fix Test Script
 *
 * This script tests the complete fixed MFA flow for the specific user
 * experiencing TOTP verification issues.
 *
 * Run this in the browser console on the CareXPS application.
 */

const USER_ID = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
const USER_EMAIL = 'pierre@phaetonai.com';

console.log('🚀 Starting Complete MFA Fix Test');
console.log('User ID:', USER_ID);
console.log('User Email:', USER_EMAIL);

// Step 1: Import the fixed services
async function importServices() {
  try {
    console.log('\n📦 Importing fixed services...');

    // Import the cleanup tool and fixed TOTP service
    const { mfaCleanupTool } = await import('./src/utils/mfaCleanupTool.ts');
    const { fixedTotpService } = await import('./src/services/fixedTotpService.ts');

    console.log('✅ Services imported successfully');
    return { mfaCleanupTool, fixedTotpService };

  } catch (error) {
    console.error('❌ Failed to import services:', error);
    throw error;
  }
}

// Step 2: Complete cleanup
async function performCleanup(mfaCleanupTool) {
  try {
    console.log('\n🧹 Performing complete MFA cleanup...');

    const result = await mfaCleanupTool.cleanupUserMFA(USER_ID);

    console.log('Cleanup Result:', result.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', result.message);

    if (result.details.length > 0) {
      console.log('Details:');
      result.details.forEach(detail => console.log(' ', detail));
    }

    // Verify cleanup
    const verification = await mfaCleanupTool.verifyCleanup(USER_ID);
    console.log('Cleanup Verification:', verification.clean ? '✅ Clean' : '⚠️ Issues found');

    if (verification.issues.length > 0) {
      console.log('Remaining Issues:');
      verification.issues.forEach(issue => console.log(' ', issue));
    }

    return result.success;

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return false;
  }
}

// Step 3: Generate fresh MFA setup
async function generateFreshSetup(mfaCleanupTool) {
  try {
    console.log('\n🔐 Generating fresh MFA setup...');

    const setup = await mfaCleanupTool.generateFreshSetup(USER_ID, USER_EMAIL);

    console.log('✅ Fresh MFA setup generated');
    console.log('QR Code URL:', setup.qr_url);
    console.log('Manual Entry Key:', setup.manual_entry_key);
    console.log('Backup Codes Count:', setup.backup_codes.length);

    // Log the QR code for easy scanning
    console.log('\n📱 QR CODE FOR AUTHENTICATION APP:');
    console.log('Scan this with your authenticator app:');
    console.log(setup.qr_url);

    console.log('\n🔑 MANUAL ENTRY KEY:');
    console.log('If you prefer manual entry, use this key:');
    console.log(setup.manual_entry_key);

    return setup;

  } catch (error) {
    console.error('❌ Fresh setup generation failed:', error);
    throw error;
  }
}

// Step 4: Wait for user to scan QR code and provide test code
function waitForUserInput() {
  return new Promise((resolve) => {
    console.log('\n⏳ Please scan the QR code with your authenticator app');
    console.log('Once scanned, call: testTOTPCode("YOUR_6_DIGIT_CODE")');

    // Make the test function available globally
    window.testTOTPCode = async (code) => {
      try {
        const { mfaCleanupTool } = await import('./src/utils/mfaCleanupTool.ts');

        console.log('\n🧪 Testing TOTP code:', code);

        const testResult = await mfaCleanupTool.testNewSetup(USER_ID, code);

        if (testResult.success) {
          console.log('✅ TOTP verification test passed!');
          console.log('Now completing MFA setup...');

          const completionResult = await mfaCleanupTool.completeMFASetup(USER_ID, code);

          if (completionResult.success) {
            console.log('🎉 MFA setup completed successfully!');
            console.log('✅ User now has working MFA protection');
            return true;
          } else {
            console.error('❌ MFA completion failed:', completionResult.message);
            return false;
          }
        } else {
          console.error('❌ TOTP verification test failed:', testResult.message);
          console.log('Please try again with a fresh code from your authenticator app');
          return false;
        }

      } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
      }
    };

    resolve(true);
  });
}

// Main execution function
async function runCompleteMFAFix() {
  try {
    console.log('🎯 Complete MFA Fix Test - Starting...');

    // Step 1: Import services
    const services = await importServices();

    // Step 2: Cleanup corrupted data
    const cleanupSuccess = await performCleanup(services.mfaCleanupTool);

    if (!cleanupSuccess) {
      throw new Error('Cleanup failed');
    }

    // Step 3: Generate fresh setup
    const setup = await generateFreshSetup(services.mfaCleanupTool);

    // Step 4: Wait for user interaction
    await waitForUserInput();

    console.log('\n🏁 MFA Fix Test Setup Complete');
    console.log('Next steps:');
    console.log('1. Scan the QR code with your authenticator app');
    console.log('2. Call: testTOTPCode("YOUR_6_DIGIT_CODE")');
    console.log('3. MFA will be enabled automatically upon successful verification');

  } catch (error) {
    console.error('💥 Complete MFA Fix Test Failed:', error);
    console.log('\nTroubleshooting:');
    console.log('- Ensure you are on the CareXPS application page');
    console.log('- Check that the services are properly imported');
    console.log('- Try refreshing the page and running again');
  }
}

// Additional utility functions for manual testing
window.checkMFAStatus = async () => {
  try {
    const { fixedTotpService } = await import('./src/services/fixedTotpService.ts');

    const hasSetup = await fixedTotpService.hasTOTPSetup(USER_ID);
    const isEnabled = await fixedTotpService.isTOTPEnabled(USER_ID);

    console.log('📊 Current MFA Status:');
    console.log('Has Setup:', hasSetup ? '✅ Yes' : '❌ No');
    console.log('Is Enabled:', isEnabled ? '✅ Yes' : '❌ No');

    return { hasSetup, isEnabled };
  } catch (error) {
    console.error('❌ Status check failed:', error);
    return null;
  }
};

window.emergencyCleanup = async () => {
  try {
    const { mfaCleanupTool } = await import('./src/utils/mfaCleanupTool.ts');
    const result = await mfaCleanupTool.cleanupUserMFA(USER_ID);
    console.log('Emergency cleanup result:', result);
    return result;
  } catch (error) {
    console.error('Emergency cleanup failed:', error);
    return null;
  }
};

// Auto-start the fix process
console.log('🚀 Auto-starting Complete MFA Fix...');
runCompleteMFAFix();

console.log('\n📋 Available Commands:');
console.log('- testTOTPCode("123456") - Test a 6-digit TOTP code');
console.log('- checkMFAStatus() - Check current MFA setup status');
console.log('- emergencyCleanup() - Emergency cleanup if needed');