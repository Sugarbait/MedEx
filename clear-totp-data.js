/**
 * Clear all TOTP data from localStorage
 * Run this in the browser console to remove all leftover TOTP test data
 */

console.log('🧹 Clearing all TOTP data from localStorage...');

// List of users to clear
const usersToClean = [
  'dynamic-pierre-user',
  'pierre-user-789',
  'super-user-456',
  'c550502f-c39d-4bb3-bb8c-d193657fdb24',
  'guest-user-456'
];

// Clear TOTP data for each user
usersToClean.forEach(userId => {
  console.log(`Clearing TOTP data for ${userId}...`);
  localStorage.removeItem(`totp_${userId}`);
  localStorage.removeItem(`totp_secret_${userId}`);
  localStorage.removeItem(`totp_enabled_${userId}`);
  localStorage.removeItem(`mfa_sessions_${userId}`);
  localStorage.removeItem(`totp_backup_codes_${userId}`);
});

// Also clear any general TOTP settings
localStorage.removeItem('totp_settings');
localStorage.removeItem('mfa_enabled');

console.log('✅ All TOTP data cleared!');
console.log('Users can now login without MFA verification.');
console.log('To set up MFA properly, users should go to Settings → Security → Setup MFA');

// Reload the page to apply changes
setTimeout(() => {
  console.log('Reloading page...');
  window.location.reload();
}, 1000);