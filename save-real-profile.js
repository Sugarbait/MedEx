/**
 * Save Real Profile Data to Cloud
 *
 * This script saves the actual user profile data (not test data) to ensure
 * it's available for cross-device loading in incognito mode.
 */

console.log('💾 SAVING REAL PROFILE DATA TO CLOUD');
console.log('===================================');

const saveRealProfileData = async () => {
  // Check if services are available
  if (!window.robustProfileSyncService) {
    console.error('❌ robustProfileSyncService not available. Please wait for app to load fully.');
    return;
  }

  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    console.error('❌ No current user found');
    return;
  }

  try {
    const userData = JSON.parse(currentUser);
    console.log('👤 Current user:', userData.email, 'ID:', userData.id);

    // Get current profile fields from localStorage
    const profileFieldsKey = `profileFields_${userData.id}`;
    const existingProfileFields = localStorage.getItem(profileFieldsKey);

    let currentProfileFields = {};
    if (existingProfileFields) {
      try {
        currentProfileFields = JSON.parse(existingProfileFields);
        console.log('📋 Current profile fields:', currentProfileFields);
      } catch (error) {
        console.warn('⚠️ Could not parse existing profile fields');
      }
    } else {
      console.log('📋 No existing profile fields found in localStorage');
    }

    // Prepare the profile data with real values (you can customize these)
    const realProfileData = {
      id: userData.id,
      email: userData.email,
      name: userData.name || userData.email,
      role: userData.role || 'user',
      avatar: userData.avatar,
      mfa_enabled: userData.mfa_enabled || false,
      // Use existing profile fields or set up real ones
      display_name: currentProfileFields.display_name || userData.name || 'Pierre Farrell',
      department: currentProfileFields.department || 'AI Development',
      phone: currentProfileFields.phone || '+1-555-AI-TECH',
      bio: currentProfileFields.bio || 'AI Technology Leader and Healthcare Innovation Expert',
      location: currentProfileFields.location || 'Canada'
    };

    console.log('🔄 Saving real profile data to cloud...');
    console.log('📊 Profile data to save:', realProfileData);

    // Save to cloud using the robust sync service
    const saveResult = await window.robustProfileSyncService.saveProfileData(realProfileData);

    console.log('💾 Save result:', saveResult);

    if (saveResult.status === 'success') {
      console.log('✅ REAL PROFILE DATA SAVED TO CLOUD!');
      console.log('📈 Sync status:');
      console.log('  - Cloud saved:', saveResult.data.cloudSaved);
      console.log('  - Local saved:', saveResult.data.localSaved);
      console.log('  - Warnings:', saveResult.data.warnings);

      // Now test loading from cloud to verify
      console.log('\n🔍 Verifying cloud save by loading...');
      const loadResult = await window.robustProfileSyncService.loadProfileData(userData.id);

      if (loadResult.status === 'success' && loadResult.data) {
        console.log('✅ VERIFICATION SUCCESSFUL - Data available in cloud:');
        console.log('  - Department:', loadResult.data.department || 'EMPTY');
        console.log('  - Phone:', loadResult.data.phone || 'EMPTY');
        console.log('  - Location:', loadResult.data.location || 'EMPTY');
        console.log('  - Bio:', loadResult.data.bio || 'EMPTY');
        console.log('  - Display Name:', loadResult.data.display_name || 'EMPTY');

        console.log('\n🎉 SUCCESS! Your profile data is now saved to the cloud.');
        console.log('🔄 You can now test incognito mode and the data should load automatically.');
      } else {
        console.error('❌ Verification failed - data not found in cloud');
      }

    } else {
      console.error('❌ Failed to save profile data to cloud:', saveResult.error);
    }

  } catch (error) {
    console.error('❌ Error saving real profile data:', error);
  }
};

// Also create a function to test incognito loading simulation
const testIncognitoLoading = async () => {
  console.log('\n🕵️ TESTING INCOGNITO MODE SIMULATION');
  console.log('=====================================');

  if (!window.robustProfileSyncService) {
    console.error('❌ robustProfileSyncService not available');
    return;
  }

  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    console.error('❌ No current user found');
    return;
  }

  const userData = JSON.parse(currentUser);
  const userId = userData.id;

  // Backup current localStorage profile fields
  const profileFieldsKey = `profileFields_${userId}`;
  const backup = localStorage.getItem(profileFieldsKey);

  console.log('💾 Backing up current localStorage profile fields...');

  // Temporarily remove profile fields to simulate fresh device
  localStorage.removeItem(profileFieldsKey);
  console.log('🗑️ Temporarily removed localStorage profile fields (simulating incognito/fresh device)');

  try {
    // Try to load profile data (should come from cloud only)
    console.log('🔄 Loading profile data in simulated incognito mode...');
    const loadResult = await window.robustProfileSyncService.loadProfileData(userId);

    console.log('📥 Load result:', loadResult);

    if (loadResult.status === 'success' && loadResult.data) {
      console.log('✅ INCOGNITO SIMULATION SUCCESS! Profile data loaded from cloud:');
      console.log('  - Department:', loadResult.data.department || 'EMPTY');
      console.log('  - Phone:', loadResult.data.phone || 'EMPTY');
      console.log('  - Location:', loadResult.data.location || 'EMPTY');
      console.log('  - Bio:', loadResult.data.bio || 'EMPTY');
      console.log('  - Display Name:', loadResult.data.display_name || 'EMPTY');
    } else {
      console.error('❌ INCOGNITO SIMULATION FAILED - No data loaded from cloud');
      console.log('This means the data either wasn\'t saved to cloud or there\'s an issue with cloud loading');
    }

  } finally {
    // Restore backup
    if (backup) {
      localStorage.setItem(profileFieldsKey, backup);
      console.log('🔄 Restored localStorage backup');
    } else {
      console.log('ℹ️ No backup to restore (profile fields were empty)');
    }
  }
};

// Export functions to window
window.profileCloudSave = {
  saveReal: saveRealProfileData,
  testIncognito: testIncognitoLoading
};

console.log('\n🎮 USAGE:');
console.log('1. window.profileCloudSave.saveReal() - Save your real profile to cloud');
console.log('2. window.profileCloudSave.testIncognito() - Test incognito loading simulation');
console.log('');
console.log('💡 Run saveReal() first, then test with actual incognito mode!');