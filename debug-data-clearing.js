/**
 * Debug Data Clearing Issue
 * Track what's clearing the localStorage profile data
 */

console.log('🕵️ DEBUGGING DATA CLEARING ISSUE');
console.log('===============================');

// Save the original localStorage.setItem to intercept calls
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;

// Track all localStorage writes to profile data
localStorage.setItem = function(key, value) {
  if (key.includes('profileFields_')) {
    console.log('🔍 PROFILE FIELDS WRITE DETECTED:');
    console.log('   Key:', key);
    console.log('   Value:', value);
    console.trace('   Stack trace:');
  }
  return originalSetItem.call(this, key, value);
};

localStorage.removeItem = function(key) {
  if (key.includes('profileFields_')) {
    console.log('🗑️ PROFILE FIELDS DELETE DETECTED:');
    console.log('   Key:', key);
    console.trace('   Stack trace:');
  }
  return originalRemoveItem.call(this, key, value);
};

console.log('✅ Profile data tracking enabled - any writes to profileFields will be logged');

// Check current state
const checkCurrentState = () => {
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      const userData = JSON.parse(currentUser);
      const userId = userData.id;
      const profileFields = localStorage.getItem(`profileFields_${userId}`);

      console.log('\n📊 CURRENT STATE:');
      console.log('User ID:', userId);
      console.log('Profile Fields:', profileFields);

      if (profileFields) {
        const parsed = JSON.parse(profileFields);
        console.log('Parsed fields:', parsed);
      }

      return { userId, profileFields };
    } catch (error) {
      console.error('Error parsing current user:', error);
    }
  }
  return null;
};

// Save known good data
const saveTestData = () => {
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      const userData = JSON.parse(currentUser);
      const userId = userData.id;

      const testData = {
        department: 'DEBUG TEST Department',
        phone: 'DEBUG TEST +1 (555) 999-8888',
        location: 'DEBUG TEST Location',
        display_name: 'DEBUG TEST Pierre',
        bio: 'DEBUG TEST Bio'
      };

      console.log('\n💾 SAVING TEST DATA:', testData);
      localStorage.setItem(`profileFields_${userId}`, JSON.stringify(testData));
      console.log('✅ Test data saved');

      return testData;
    } catch (error) {
      console.error('Error saving test data:', error);
    }
  }
  return null;
};

// Watch for changes
const watchForChanges = () => {
  let lastState = checkCurrentState();

  setInterval(() => {
    const currentState = checkCurrentState();

    if (currentState && lastState) {
      if (currentState.profileFields !== lastState.profileFields) {
        console.log('\n🚨 PROFILE FIELDS CHANGED!');
        console.log('Previous:', lastState.profileFields);
        console.log('Current:', currentState.profileFields);

        // If data was cleared, save it back
        if (currentState.profileFields && currentState.profileFields.includes('""')) {
          console.log('🔄 Data was cleared! Attempting to restore...');
          const restored = saveTestData();
          if (restored) {
            console.log('✅ Test data restored');
          }
        }
      }
    }

    lastState = currentState;
  }, 1000);
};

// Export functions
window.dataTracker = {
  checkCurrentState,
  saveTestData,
  watchForChanges
};

console.log('\n🎮 USAGE:');
console.log('- window.dataTracker.checkCurrentState() - Check current profile data');
console.log('- window.dataTracker.saveTestData() - Save test profile data');
console.log('- window.dataTracker.watchForChanges() - Watch for data changes');

// Auto-start
checkCurrentState();
saveTestData();
watchForChanges();