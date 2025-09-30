/**
 * Debug Profile Loading Issues
 * Run this in browser console to diagnose why profile data isn't loading on page refresh
 */

console.log('🔍 DEBUGGING PROFILE LOADING ISSUES');
console.log('===================================');

// Check current user data
const checkCurrentUser = () => {
  const currentUser = localStorage.getItem('currentUser');
  console.log('\n🔍 Current User Check:');
  if (currentUser) {
    try {
      const userData = JSON.parse(currentUser);
      console.log('✅ Current User ID:', userData.id);
      console.log('✅ Current User Email:', userData.email);
      console.log('✅ Current User Profile Data:');
      console.log('   - Department:', userData.department || 'NOT SET');
      console.log('   - Phone:', userData.phone || 'NOT SET');
      console.log('   - Location:', userData.location || 'NOT SET');
      console.log('   - Display Name:', userData.display_name || 'NOT SET');
      return userData;
    } catch (error) {
      console.error('❌ Failed to parse currentUser:', error);
      return null;
    }
  } else {
    console.log('❌ No currentUser found in localStorage');
    return null;
  }
};

// Check separate profile fields storage
const checkProfileFields = (userId) => {
  if (!userId) return null;

  const profileFields = localStorage.getItem(`profileFields_${userId}`);
  console.log('\n🔍 Profile Fields Check:');
  if (profileFields) {
    try {
      const fields = JSON.parse(profileFields);
      console.log('✅ Profile Fields Found:');
      console.log('   - Department:', fields.department || 'NOT SET');
      console.log('   - Phone:', fields.phone || 'NOT SET');
      console.log('   - Location:', fields.location || 'NOT SET');
      console.log('   - Display Name:', fields.display_name || 'NOT SET');
      console.log('   - Bio:', fields.bio || 'NOT SET');
      return fields;
    } catch (error) {
      console.error('❌ Failed to parse profileFields:', error);
      return null;
    }
  } else {
    console.log('❌ No profileFields found for user ID:', userId);
    return null;
  }
};

// Check individual user profile
const checkUserProfile = (userId) => {
  if (!userId) return null;

  const userProfile = localStorage.getItem(`userProfile_${userId}`);
  console.log('\n🔍 User Profile Check:');
  if (userProfile) {
    try {
      const profile = JSON.parse(userProfile);
      console.log('✅ User Profile Found:');
      console.log('   - Department:', profile.department || 'NOT SET');
      console.log('   - Phone:', profile.phone || 'NOT SET');
      console.log('   - Location:', profile.location || 'NOT SET');
      console.log('   - Display Name:', profile.display_name || 'NOT SET');
      return profile;
    } catch (error) {
      console.error('❌ Failed to parse userProfile:', error);
      return null;
    }
  } else {
    console.log('❌ No userProfile found for user ID:', userId);
    return null;
  }
};

// Check system users
const checkSystemUsers = (userId) => {
  if (!userId) return null;

  const systemUsers = localStorage.getItem('systemUsers');
  console.log('\n🔍 System Users Check:');
  if (systemUsers) {
    try {
      const users = JSON.parse(systemUsers);
      const user = users.find(u => u.id === userId);
      if (user) {
        console.log('✅ User Found in System Users:');
        console.log('   - Department:', user.department || 'NOT SET');
        console.log('   - Phone:', user.phone || 'NOT SET');
        console.log('   - Location:', user.location || 'NOT SET');
        console.log('   - Display Name:', user.display_name || 'NOT SET');
        return user;
      } else {
        console.log('❌ User not found in systemUsers array');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to parse systemUsers:', error);
      return null;
    }
  } else {
    console.log('❌ No systemUsers found in localStorage');
    return null;
  }
};

// Test the robustProfileSyncService loading method
const testRobustServiceLoading = async (userId) => {
  if (!userId) return null;

  console.log('\n🔍 Testing Robust Profile Sync Service:');
  try {
    // Import the service if available
    if (window.robustProfileSyncService) {
      const result = await window.robustProfileSyncService.loadProfileData(userId);
      console.log('✅ Robust Service Result:', result);
      return result;
    } else {
      console.log('❌ robustProfileSyncService not available in window object');
      return null;
    }
  } catch (error) {
    console.error('❌ Robust service loading failed:', error);
    return null;
  }
};

// Run all diagnostics
const runAllDiagnostics = async () => {
  console.log('🚀 Starting Profile Loading Diagnostics...\n');

  const currentUser = checkCurrentUser();
  const userId = currentUser?.id;

  if (!userId) {
    console.log('\n❌ CRITICAL: No user ID available for diagnostics');
    return;
  }

  const profileFields = checkProfileFields(userId);
  const userProfile = checkUserProfile(userId);
  const systemUser = checkSystemUsers(userId);
  const robustResult = await testRobustServiceLoading(userId);

  console.log('\n📊 DIAGNOSTIC SUMMARY:');
  console.log('======================');
  console.log('✅ Current User Available:', !!currentUser);
  console.log('✅ Profile Fields Available:', !!profileFields);
  console.log('✅ User Profile Available:', !!userProfile);
  console.log('✅ System Users Available:', !!systemUser);
  console.log('✅ Robust Service Working:', !!robustResult);

  console.log('\n🎯 RECOMMENDED FIXES:');
  if (!profileFields && !userProfile && !systemUser) {
    console.log('❌ NO PROFILE DATA FOUND - Profile was never saved properly');
    console.log('   → Try saving profile data again');
  } else if (profileFields || userProfile || systemUser) {
    console.log('✅ PROFILE DATA EXISTS - Loading mechanism issue');
    console.log('   → Check component useEffect and loading logic');
    console.log('   → Verify timing of data loading');
  }

  return {
    currentUser,
    profileFields,
    userProfile,
    systemUser,
    robustResult
  };
};

// Manual profile field injection (for testing)
const injectTestProfileData = (userId) => {
  if (!userId) {
    console.log('❌ Cannot inject test data - no user ID provided');
    return;
  }

  const testData = {
    department: 'Emergency Medicine',
    phone: '+1 (555) 123-4567',
    location: 'Toronto General Hospital',
    display_name: 'Dr. Test User',
    bio: 'Emergency physician with 10+ years experience'
  };

  // Inject into all storage locations
  localStorage.setItem(`profileFields_${userId}`, JSON.stringify(testData));

  // Also update currentUser
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      const userData = JSON.parse(currentUser);
      Object.assign(userData, testData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to update currentUser:', error);
    }
  }

  console.log('✅ Test profile data injected successfully');
  console.log('   → Refresh the page to test loading');
};

// Export functions to global scope
window.profileDebug = {
  runAllDiagnostics,
  checkCurrentUser,
  checkProfileFields,
  checkUserProfile,
  checkSystemUsers,
  testRobustServiceLoading,
  injectTestProfileData
};

console.log('\n🎮 USAGE:');
console.log('Run window.profileDebug.runAllDiagnostics() to diagnose all issues');
console.log('Run window.profileDebug.injectTestProfileData("USER_ID") to inject test data');

// Auto-run diagnostics
runAllDiagnostics();