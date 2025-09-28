/**
 * Debug Cloud Sync - Browser Console Test Script
 *
 * This script should be run in the browser console after the app has loaded.
 * It will test cloud synchronization functionality for profile data.
 */

// Wait for app to be fully loaded
const waitForAppReady = async (maxWait = 10000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (window.globalServiceInitializer && window.robustProfileSyncService) {
      console.log('✅ App is ready for cloud sync testing');
      return true;
    }
    console.log('⏳ Waiting for app to initialize...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('❌ App initialization timeout');
  return false;
};

// Main test function
const testCloudSyncDebug = async () => {
  console.log('🌩️ CLOUD SYNC DEBUG TEST');
  console.log('=======================');

  // Wait for app readiness
  const isReady = await waitForAppReady();
  if (!isReady) {
    console.error('❌ App not ready for testing');
    return;
  }

  // Check current user
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    console.error('❌ No current user found');
    return;
  }

  const userData = JSON.parse(currentUser);
  console.log('👤 Current user:', userData.email, 'ID:', userData.id);

  // Test 1: Check service availability
  console.log('\n🔍 TEST 1: Service Availability');
  console.log('globalServiceInitializer available:', !!window.globalServiceInitializer);
  console.log('robustProfileSyncService available:', !!window.robustProfileSyncService);

  if (window.globalServiceInitializer) {
    const status = window.globalServiceInitializer.getStatus();
    console.log('Service status:', status);
  }

  // Test 2: Load current profile data
  console.log('\n📥 TEST 2: Load Profile Data');
  if (window.robustProfileSyncService) {
    try {
      const loadResult = await window.robustProfileSyncService.loadProfileData(userData.id);
      console.log('Load result:', loadResult);

      if (loadResult.status === 'success' && loadResult.data) {
        console.log('📊 Profile fields:');
        console.log('  - Name:', loadResult.data.name || 'EMPTY');
        console.log('  - Display Name:', loadResult.data.display_name || 'EMPTY');
        console.log('  - Department:', loadResult.data.department || 'EMPTY');
        console.log('  - Phone:', loadResult.data.phone || 'EMPTY');
        console.log('  - Location:', loadResult.data.location || 'EMPTY');
        console.log('  - Bio:', loadResult.data.bio || 'EMPTY');
      }
    } catch (error) {
      console.error('❌ Load failed:', error);
    }
  }

  // Test 3: Check localStorage directly
  console.log('\n📁 TEST 3: LocalStorage Check');
  const profileFields = localStorage.getItem(`profileFields_${userData.id}`);
  if (profileFields) {
    console.log('✅ Profile fields in localStorage:', JSON.parse(profileFields));
  } else {
    console.log('❌ No profile fields in localStorage');
  }

  // Test 4: Test save operation (with test data)
  console.log('\n💾 TEST 4: Save Test Data');
  if (window.robustProfileSyncService) {
    try {
      const testProfileData = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        avatar: userData.avatar,
        mfa_enabled: userData.mfa_enabled,
        display_name: userData.display_name || 'Test Display Name',
        department: 'Test Department',
        phone: '+1-555-123-4567',
        bio: 'This is a test bio for cloud sync testing',
        location: 'Test Location'
      };

      console.log('🔄 Saving test profile data...');
      const saveResult = await window.robustProfileSyncService.saveProfileData(testProfileData);
      console.log('Save result:', saveResult);

      if (saveResult.status === 'success') {
        console.log('✅ Save successful!');
        console.log('  - Cloud saved:', saveResult.data.cloudSaved);
        console.log('  - Local saved:', saveResult.data.localSaved);
        console.log('  - Warnings:', saveResult.data.warnings);
      }
    } catch (error) {
      console.error('❌ Save failed:', error);
    }
  }

  // Test 5: Verify the save worked
  console.log('\n🔍 TEST 5: Verify Save Result');
  if (window.robustProfileSyncService) {
    try {
      const verifyResult = await window.robustProfileSyncService.loadProfileData(userData.id);
      console.log('Verification load result:', verifyResult);

      if (verifyResult.status === 'success' && verifyResult.data) {
        console.log('📊 Updated profile fields:');
        console.log('  - Department:', verifyResult.data.department);
        console.log('  - Phone:', verifyResult.data.phone);
        console.log('  - Location:', verifyResult.data.location);
        console.log('  - Bio:', verifyResult.data.bio);
      }
    } catch (error) {
      console.error('❌ Verification failed:', error);
    }
  }

  console.log('\n🎉 Cloud sync test completed!');
};

// Helper function to reset test data
const resetTestData = () => {
  console.log('🔄 Resetting test data...');
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    const userData = JSON.parse(currentUser);
    localStorage.removeItem(`profileFields_${userData.id}`);
    console.log('✅ Test data reset');
  }
};

// Export functions to window for manual testing
window.cloudSyncDebug = {
  test: testCloudSyncDebug,
  reset: resetTestData,
  waitForReady: waitForAppReady
};

console.log('🎮 CLOUD SYNC DEBUG LOADED');
console.log('Usage:');
console.log('  window.cloudSyncDebug.test() - Run full test');
console.log('  window.cloudSyncDebug.reset() - Reset test data');
console.log('  window.cloudSyncDebug.waitForReady() - Wait for app readiness');

// Auto-run if app is already ready
if (window.globalServiceInitializer && window.robustProfileSyncService) {
  console.log('🚀 App already ready - running test...');
  testCloudSyncDebug();
} else {
  console.log('⏳ App not ready yet - use window.cloudSyncDebug.test() when ready');
}