/**
 * Direct localStorage Debug
 * Run this to see exactly what's stored and what's being loaded
 */

console.log('🔍 DIRECT LOCALSTORAGE DEBUG');
console.log('============================');

// Get current user
const getCurrentUserData = () => {
  const currentUserStr = localStorage.getItem('currentUser');
  console.log('\n📊 Current User localStorage:');
  console.log('Raw data:', currentUserStr);

  if (currentUserStr) {
    try {
      const currentUser = JSON.parse(currentUserStr);
      console.log('Parsed user:', {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        department: currentUser.department,
        phone: currentUser.phone,
        location: currentUser.location,
        display_name: currentUser.display_name
      });
      return currentUser;
    } catch (error) {
      console.error('❌ Failed to parse currentUser:', error);
      return null;
    }
  } else {
    console.log('❌ No currentUser in localStorage');
    return null;
  }
};

// Check all profile-related localStorage keys
const checkAllProfileKeys = (userId) => {
  console.log(`\n🔍 All Profile Keys for User: ${userId}`);
  console.log('=====================================');

  // Check profileFields
  const profileFieldsKey = `profileFields_${userId}`;
  const profileFields = localStorage.getItem(profileFieldsKey);
  console.log(`\n📁 ${profileFieldsKey}:`);
  console.log('Raw:', profileFields);
  if (profileFields) {
    try {
      console.log('Parsed:', JSON.parse(profileFields));
    } catch (error) {
      console.error('Parse error:', error);
    }
  }

  // Check userProfile
  const userProfileKey = `userProfile_${userId}`;
  const userProfile = localStorage.getItem(userProfileKey);
  console.log(`\n📁 ${userProfileKey}:`);
  console.log('Raw:', userProfile);
  if (userProfile) {
    try {
      console.log('Parsed:', JSON.parse(userProfile));
    } catch (error) {
      console.error('Parse error:', error);
    }
  }

  // Check systemUsers
  const systemUsers = localStorage.getItem('systemUsers');
  console.log('\n📁 systemUsers:');
  console.log('Raw:', systemUsers);
  if (systemUsers) {
    try {
      const users = JSON.parse(systemUsers);
      const userInSystem = users.find(u => u.id === userId);
      console.log('Current user in systemUsers:', userInSystem);
    } catch (error) {
      console.error('Parse error:', error);
    }
  }
};

// Test the loading service manually
const testLoadingServiceManually = (userId) => {
  console.log(`\n🧪 MANUAL LOADING TEST for User: ${userId}`);
  console.log('===========================================');

  // Simulate the loadFromLocalStorage logic
  let baseUserData = null;

  // Step 1: Get currentUser
  const currentUserStr = localStorage.getItem('currentUser');
  if (currentUserStr) {
    try {
      const userData = JSON.parse(currentUserStr);
      if (userData.id === userId) {
        baseUserData = userData;
        console.log('✅ Found baseUserData from currentUser');
      } else {
        console.log('❌ CurrentUser ID mismatch:', userData.id, 'vs', userId);
      }
    } catch (error) {
      console.log('❌ Failed to parse currentUser');
    }
  }

  // Step 2: Get profileFields
  const profileFieldsStr = localStorage.getItem(`profileFields_${userId}`);
  if (profileFieldsStr) {
    try {
      const fields = JSON.parse(profileFieldsStr);
      console.log('✅ Found profileFields:', fields);

      if (baseUserData) {
        const mergedData = {
          ...baseUserData,
          department: fields.department || baseUserData.department || '',
          phone: fields.phone || baseUserData.phone || '',
          location: fields.location || baseUserData.location || '',
          display_name: fields.display_name || baseUserData.display_name || baseUserData.name || '',
          bio: fields.bio || baseUserData.bio || ''
        };
        console.log('✅ MERGED RESULT:', {
          department: mergedData.department,
          phone: mergedData.phone,
          location: mergedData.location,
          display_name: mergedData.display_name,
          bio: mergedData.bio
        });
        return mergedData;
      } else {
        console.log('⚠️ No baseUserData, creating from fields only');
        const profileData = {
          id: userId,
          email: '',
          name: fields.display_name || '',
          role: 'user',
          department: fields.department || '',
          phone: fields.phone || '',
          location: fields.location || '',
          display_name: fields.display_name || '',
          bio: fields.bio || ''
        };
        console.log('✅ FIELDS-ONLY RESULT:', profileData);
        return profileData;
      }
    } catch (error) {
      console.log('❌ Failed to parse profileFields');
    }
  } else {
    console.log('❌ No profileFields found');
  }

  if (baseUserData) {
    console.log('✅ Using baseUserData only:', baseUserData);
    return baseUserData;
  }

  console.log('❌ No data found at all');
  return null;
};

// Save test data and verify it's saved correctly
const saveAndVerifyTestData = (userId) => {
  console.log(`\n💾 SAVE AND VERIFY TEST for User: ${userId}`);
  console.log('=========================================');

  const testData = {
    department: 'TEST Emergency Medicine',
    phone: 'TEST +1 (555) 999-8888',
    location: 'TEST Toronto Hospital',
    display_name: 'TEST Dr. Profile Fix',
    bio: 'TEST Bio for profile fixing'
  };

  console.log('📤 Saving test data:', testData);

  // Save to profileFields
  localStorage.setItem(`profileFields_${userId}`, JSON.stringify(testData));

  // Verify it was saved
  const saved = localStorage.getItem(`profileFields_${userId}`);
  console.log('📥 Immediately retrieved:', saved);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      console.log('✅ Successfully saved and retrieved:', parsed);
      return true;
    } catch (error) {
      console.error('❌ Failed to parse saved data:', error);
      return false;
    }
  } else {
    console.log('❌ Data not saved properly');
    return false;
  }
};

// Run complete diagnostic
const runCompleteDiagnostic = () => {
  console.log('🚀 RUNNING COMPLETE DIAGNOSTIC');
  console.log('===============================');

  const currentUser = getCurrentUserData();
  const userId = currentUser?.id;

  if (!userId) {
    console.log('❌ Cannot continue - no user ID');
    return;
  }

  checkAllProfileKeys(userId);

  const saveSuccess = saveAndVerifyTestData(userId);
  if (saveSuccess) {
    const loadResult = testLoadingServiceManually(userId);

    console.log('\n🎯 DIAGNOSTIC SUMMARY:');
    console.log('======================');
    console.log('✅ User ID available:', !!userId);
    console.log('✅ Save test passed:', saveSuccess);
    console.log('✅ Load test passed:', !!loadResult);

    if (loadResult && loadResult.department === 'TEST Emergency Medicine') {
      console.log('🎉 SUCCESS: Profile data persistence is working!');
    } else {
      console.log('❌ FAILURE: Profile data not loading correctly');
    }
  }
};

// Export functions
window.localStorageDebug = {
  runCompleteDiagnostic,
  getCurrentUserData,
  checkAllProfileKeys,
  testLoadingServiceManually,
  saveAndVerifyTestData
};

console.log('\n🎮 USAGE:');
console.log('window.localStorageDebug.runCompleteDiagnostic()');

// Auto-run
runCompleteDiagnostic();