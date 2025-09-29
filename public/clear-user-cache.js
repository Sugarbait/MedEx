/**
 * Script to clear cached user data and force refresh from database
 * Run this in the browser console to fix the "Last Login: Never" issue
 */

(function clearUserCache() {
  console.log('🧹 Clearing cached user data...');

  // Clear all user-related localStorage items
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('systemUsers') ||
      key.includes('loginStats') ||
      key.includes('userCache') ||
      key.includes('users_') ||
      key.startsWith('settings_')
    )) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    console.log(`Removing: ${key}`);
    localStorage.removeItem(key);
  });

  // Specifically remove the systemUsers cache
  localStorage.removeItem('systemUsers');

  console.log(`✅ Cleared ${keysToRemove.length} cached items`);
  console.log('📊 The page will now reload to fetch fresh data from the database...');

  // Reload the page after a brief delay
  setTimeout(() => {
    window.location.reload();
  }, 1000);
})();