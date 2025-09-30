/**
 * 🔧 AZURE USER ID PERSISTENCE FIX
 *
 * ROOT CAUSE IDENTIFIED: User ID becomes undefined after profile save
 * SOLUTION: Preserve user ID in multiple storage locations and restore when needed
 *
 * Copy and paste this script into Azure console, then run: applyUserIdFix()
 */

console.log('🔧 Loading Azure User ID Persistence Fix...');

window.applyUserIdFix = function() {
  console.log('🛡️ APPLYING USER ID PERSISTENCE FIX...');

  const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

  // Step 1: Ensure user ID is preserved in currentUser
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      const userData = JSON.parse(currentUser);
      if (!userData.id || userData.id !== userId) {
        userData.id = userId;
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('✅ Fixed currentUser ID:', userData);
      } else {
        console.log('✅ currentUser ID is correct:', userData.id);
      }
    } catch (e) {
      console.error('❌ Failed to fix currentUser:', e);
    }
  }

  // Step 2: Create backup user ID storage
  const backupUserData = {
    id: userId,
    email: 'pierre@phaetonai.com',
    name: 'Pierre Morenzie',
    role: 'super_user',
    timestamp: new Date().toISOString()
  };

  localStorage.setItem('backupCurrentUser', JSON.stringify(backupUserData));
  localStorage.setItem('preservedUserId', userId);
  console.log('✅ Created backup user data');

  // Step 3: Override profile loading to use preserved user ID
  window.fixedProfileLoader = {
    async loadProfileWithFixedId() {
      console.log('🛡️ Loading profile with fixed user ID...');

      // Always use the correct user ID
      const fixedUserId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

      const profileKeys = [
        `profileFields_${fixedUserId}`,
        `userProfile_${fixedUserId}`,
        `profileData_${fixedUserId}`
      ];

      for (const key of profileKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            console.log(`✅ Found profile data in ${key}:`, parsed);
            return parsed;
          } catch (e) {
            console.error(`❌ Failed to parse ${key}:`, e);
          }
        }
      }

      console.log('❌ No profile data found');
      return {};
    },

    async saveProfileWithFixedId(profileData) {
      console.log('🛡️ Saving profile with fixed user ID...', profileData);

      const fixedUserId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

      // Save to multiple keys for redundancy
      const keys = [
        `profileFields_${fixedUserId}`,
        `userProfile_${fixedUserId}`,
        `profileData_${fixedUserId}`,
        `backup_profileFields_${fixedUserId}`
      ];

      keys.forEach(key => {
        try {
          localStorage.setItem(key, JSON.stringify(profileData));
          console.log(`✅ Saved to ${key}`);
        } catch (e) {
          console.error(`❌ Failed to save to ${key}:`, e);
        }
      });

      // Preserve user ID after save
      this.preserveUserIdAfterSave();
    },

    preserveUserIdAfterSave() {
      console.log('🛡️ Preserving user ID after save...');

      const fixedUserId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

      // Ensure currentUser has correct ID
      setTimeout(() => {
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          try {
            const userData = JSON.parse(currentUser);
            if (!userData.id || userData.id !== fixedUserId) {
              userData.id = fixedUserId;
              localStorage.setItem('currentUser', JSON.stringify(userData));
              console.log('✅ Restored user ID after save:', userData.id);
            }
          } catch (e) {
            console.error('❌ Failed to restore user ID:', e);
          }
        }
      }, 100);

      // Force trigger user context update
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userUpdated', {
          detail: {
            id: fixedUserId,
            email: 'pierre@phaetonai.com',
            name: 'Pierre Morenzie'
          }
        }));
        console.log('✅ Triggered user context update');
      }, 200);
    }
  };

  console.log('✅ User ID persistence fix applied!');
  console.log('');
  console.log('🔧 Available Commands:');
  console.log('  window.fixedProfileLoader.loadProfileWithFixedId()  - Load profile with correct ID');
  console.log('  window.fixedProfileLoader.saveProfileWithFixedId()  - Save profile with correct ID');
  console.log('');
  console.log('💡 Next steps:');
  console.log('  1. Fill in profile fields');
  console.log('  2. Use fixedProfileLoader.saveProfileWithFixedId(data) instead of regular save');
  console.log('  3. Refresh page and check if data persists');
};

// Auto-run the fix
window.applyUserIdFix();

// Additional helper to check current state
window.checkUserIdState = function() {
  console.log('🔍 CHECKING USER ID STATE...');

  const currentUser = localStorage.getItem('currentUser');
  const preservedId = localStorage.getItem('preservedUserId');
  const backupUser = localStorage.getItem('backupCurrentUser');

  console.log('currentUser:', currentUser ? JSON.parse(currentUser) : 'None');
  console.log('preservedUserId:', preservedId);
  console.log('backupCurrentUser:', backupUser ? JSON.parse(backupUser) : 'None');

  // Check profile data
  const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
  const profileData = localStorage.getItem(`profileFields_${userId}`);
  console.log('Profile data exists:', !!profileData);
  if (profileData) {
    console.log('Profile data:', JSON.parse(profileData));
  }
};

console.log('✅ Azure User ID Fix Loaded!');
console.log('🚀 Commands:');
console.log('  applyUserIdFix()     - Apply the user ID persistence fix');
console.log('  checkUserIdState()   - Check current user ID state');
console.log('');
console.log('🔧 The fix has been automatically applied!');