/**
 * Clear old TOTP test data that's interfering with new MFA setup
 * Run this in browser console to fix login issue
 */

console.log('🧹 Clearing old TOTP test data...');

// Clear the old test data
localStorage.removeItem('totp_dynamic-pierre-user');
localStorage.removeItem('totp_secret_dynamic-pierre-user');
localStorage.removeItem('totp_enabled_dynamic-pierre-user');

// Also clear for other users
const users = ['pierre-user-789', 'super-user-456', 'c550502f-c39d-4bb3-bb8c-d193657fdb24'];
users.forEach(userId => {
  localStorage.removeItem(`totp_${userId}`);
  localStorage.removeItem(`totp_secret_${userId}`);
  localStorage.removeItem(`totp_enabled_${userId}`);
});

console.log('✅ Old TOTP test data cleared!');
console.log('Your new MFA setup should now work properly at login.');
console.log('Reloading page...');

setTimeout(() => {
  window.location.reload();
}, 1000);