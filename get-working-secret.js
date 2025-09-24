/**
 * GET YOUR WORKING MFA SECRET
 * Run this in browser console while on the Settings page where MFA verification works
 * This will show you the exact secret that's working in Settings
 */

console.log('🔍 FINDING YOUR WORKING MFA SECRET...');
console.log('');

// Method 1: Check current localStorage TOTP data
const currentTotpData = localStorage.getItem('totp_dynamic-pierre-user');
if (currentTotpData) {
  try {
    const parsed = JSON.parse(currentTotpData);
    console.log('📊 Current TOTP data in localStorage:');
    console.log('   encrypted_secret:', parsed.encrypted_secret);
    console.log('   enabled:', parsed.enabled);
    console.log('   created_at:', parsed.created_at);
    console.log('');
  } catch (e) {
    console.log('❌ Failed to parse current TOTP data');
  }
}

// Method 2: Check all localStorage keys related to TOTP
console.log('🗂️ All TOTP-related localStorage keys:');
const totpKeys = Object.keys(localStorage).filter(key => key.includes('totp') || key.includes('mfa'));
totpKeys.forEach(key => {
  console.log(`   ${key}:`, localStorage.getItem(key));
});
console.log('');

// Method 3: Check if there are any other MFA secrets stored
console.log('🔐 Checking for MFA secrets...');
const allKeys = Object.keys(localStorage);
allKeys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value && typeof value === 'string' && value.length > 10 && /[A-Z2-7]{16,}/.test(value)) {
    console.log(`   Possible secret in ${key}:`, value);
  }
});

console.log('');
console.log('📝 NEXT STEPS:');
console.log('1. If you see a secret that is NOT "JBSWY3DPEHPK3PXP", that might be your real one');
console.log('2. Or go to Settings > Setup New MFA to see the manual entry key');
console.log('3. Use that secret in the final-mfa-fix.js script');