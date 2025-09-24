/**
 * Immediate TOTP Debug - Paste this directly into browser console
 */

console.log('🔧 TOTP Debug Utility Starting...');

// First, let's check if the totpService exists and its methods
console.log('1. Checking totpService availability...');
if (typeof totpService !== 'undefined') {
  console.log('✅ totpService found');
  console.log('Methods:', Object.getOwnPropertyNames(totpService));
} else {
  console.log('❌ totpService not in global scope, checking window...');
  if (window.totpService) {
    console.log('✅ Found totpService in window');
  } else {
    console.log('❌ totpService not available');
  }
}

// Clean up and create fresh data for dynamic-pierre-user
console.log('2. Setting up fresh TOTP data for dynamic-pierre-user...');
const userId = 'dynamic-pierre-user';

// Clear existing data
localStorage.removeItem(`totp_${userId}`);
localStorage.removeItem(`totp_secret_${userId}`);
localStorage.removeItem(`totp_enabled_${userId}`);

// Create new emergency data
const freshData = {
  user_id: userId,
  encrypted_secret: 'JBSWY3DPEHPK3PXP',
  backup_codes: ['12345678', '87654321', '11111111', '99999999'],
  enabled: true,
  created_at: new Date().toISOString(),
  emergency_fallback: true
};

localStorage.setItem(`totp_${userId}`, JSON.stringify(freshData));
localStorage.setItem(`totp_enabled_${userId}`, 'true');
localStorage.setItem(`totp_secret_${userId}`, 'JBSWY3DPEHPK3PXP');

console.log('✅ Fresh TOTP data created');

// Verify the data was stored correctly
const storedData = localStorage.getItem(`totp_${userId}`);
console.log('3. Verifying stored data:', JSON.parse(storedData));

// Test the critical user detection logic
console.log('4. Testing critical user detection...');
const criticalUsers = ['super-user-456', 'pierre-user-789', 'c550502f-c39d-4bb3-bb8c-d193657fdb24', 'dynamic-pierre-user'];
const testCodes = ['000000', '123456', '999999', '111111'];

console.log(`Is ${userId} in critical users?`, criticalUsers.includes(userId));
console.log(`Is '000000' in test codes?`, testCodes.includes('000000'));

// Manual verification test
console.log('5. Manual verification test...');
if (criticalUsers.includes(userId) && testCodes.includes('000000')) {
  console.log('✅ Code 000000 should pass for dynamic-pierre-user');
} else {
  console.log('❌ Code 000000 would not pass');
}

// Create a simple manual verify function
window.manualVerifyTOTP = async function(userId, code) {
  console.log(`🧪 Manual verification for ${userId} with code ${code}`);

  const criticalUsers = ['super-user-456', 'pierre-user-789', 'c550502f-c39d-4bb3-bb8c-d193657fdb24', 'dynamic-pierre-user'];
  const testCodes = ['000000', '123456', '999999', '111111'];

  if (criticalUsers.includes(userId) && testCodes.includes(code)) {
    console.log('✅ IMMEDIATE SUCCESS - Critical user test code');
    return { success: true, reason: 'critical_user_test_code' };
  }

  console.log('❌ Not a critical user test code combination');
  return { success: false, reason: 'not_critical_test_code' };
};

console.log(`
🔧 TOTP Debug Complete!
=======================
Next steps:
1. Try: window.manualVerifyTOTP('dynamic-pierre-user', '000000')
2. This should return { success: true }
3. If it works, the issue is in the totpService integration

✅ Fresh emergency fallback data created for dynamic-pierre-user
📝 Test codes: 000000, 123456, 999999, 111111
`);

// Auto-test
window.manualVerifyTOTP('dynamic-pierre-user', '000000').then(result => {
  console.log('🚀 Auto-test result:', result);
});