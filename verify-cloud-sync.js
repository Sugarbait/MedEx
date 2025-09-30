/**
 * Verify Cloud Sync - Test Cross-Device Data Retrieval
 * Simulates accessing data from another device
 */

console.log('🔍 VERIFYING CROSS-DEVICE CLOUD SYNC');
console.log('===================================');

const verifyCloudSync = async () => {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    console.log('❌ No current user found');
    return;
  }

  try {
    const userData = JSON.parse(currentUser);
    const userId = userData.id;

    console.log('👤 Testing for user:', userId);

    // Step 1: Backup current localStorage profile fields
    const localBackup = localStorage.getItem(`profileFields_${userId}`);
    console.log('💾 Current localStorage data:', localBackup);

    // Step 2: Clear localStorage to simulate fresh device
    localStorage.removeItem(`profileFields_${userId}`);
    console.log('🗑️ Cleared localStorage (simulating fresh device)');

    // Step 3: Try to load from cloud only
    if (window.robustProfileSyncService) {
      console.log('☁️ Loading data from cloud...');

      const cloudResult = await window.robustProfileSyncService.loadProfileData(userId);
      console.log('📥 Cloud load result:', cloudResult);

      if (cloudResult.status === 'success' && cloudResult.data) {
        console.log('✅ SUCCESS! Cross-device sync is working!');
        console.log('📋 Retrieved data from cloud:');
        console.log('   - Department:', cloudResult.data.department || 'EMPTY');
        console.log('   - Phone:', cloudResult.data.phone || 'EMPTY');
        console.log('   - Location:', cloudResult.data.location || 'EMPTY');
        console.log('   - Display Name:', cloudResult.data.display_name || 'EMPTY');
        console.log('   - Bio:', cloudResult.data.bio || 'EMPTY');

        // Check if all fields have data
        const hasAllData = cloudResult.data.department &&
                          cloudResult.data.phone &&
                          cloudResult.data.location &&
                          cloudResult.data.display_name &&
                          cloudResult.data.bio;

        if (hasAllData) {
          console.log('🎉 PERFECT! All profile fields retrieved from cloud');
        } else {
          console.log('⚠️ Some fields are missing data in cloud');
        }

      } else {
        console.log('❌ FAILED! Could not retrieve data from cloud');
        console.log('Error:', cloudResult.error);
      }

      // Step 4: Restore localStorage backup
      if (localBackup) {
        localStorage.setItem(`profileFields_${userId}`, localBackup);
        console.log('🔄 Restored localStorage backup');
      }

    } else {
      console.log('❌ robustProfileSyncService not available');

      // Restore backup even if service not available
      if (localBackup) {
        localStorage.setItem(`profileFields_${userId}`, localBackup);
        console.log('🔄 Restored localStorage backup');
      }
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
};

// Export for easy access
window.verifyCloudSync = verifyCloudSync;

console.log('\n🎮 USAGE:');
console.log('- verifyCloudSync() - Test cross-device data retrieval');

// Auto-run the verification
verifyCloudSync();