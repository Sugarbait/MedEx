/**
 * Utility to clear cached user data and force database refresh
 * This fixes the "Last Login: Never" issue
 */

export const clearUserCache = () => {
  console.log('🧹 Clearing cached user data to fix Last Login display...');

  // Remove the cached systemUsers which has outdated data
  localStorage.removeItem('systemUsers');

  // Remove any user-specific login stats that might be cached
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('loginStats_') ||
      key.includes('userCache') ||
      key.includes('users_cache')
    )) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    console.log(`Removing cached: ${key}`);
    localStorage.removeItem(key);
  });

  console.log(`✅ Cleared cached user data. Page will now fetch fresh data from database.`);

  // Return true to indicate cache was cleared
  return true;
};

// Auto-clear on page load if needed
export const ensureFreshUserData = () => {
  // Check if systemUsers exists and if it has outdated structure
  const systemUsers = localStorage.getItem('systemUsers');

  if (systemUsers) {
    try {
      const users = JSON.parse(systemUsers);

      // Check if any user is missing lastLogin data
      // This indicates we have old cached data
      const hasOldData = users.some((u: any) =>
        u.lastLogin === undefined &&
        !u.last_login
      );

      if (hasOldData) {
        console.log('🔄 Detected outdated user cache, clearing...');
        clearUserCache();
        return true; // Cache was cleared
      }
    } catch (e) {
      // If parse fails, clear the cache
      clearUserCache();
      return true;
    }
  }

  return false; // Cache was not cleared
};