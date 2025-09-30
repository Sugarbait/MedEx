// Simple Profile Debug - Run in Console
console.log('🔍 Debugging Profile Fields...');

const userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';

// Check localStorage data
console.log('📋 localStorage Data:');
const profileFieldsKey = `profileFields_${userId}`;
const profileData = localStorage.getItem(profileFieldsKey);
if (profileData) {
  console.log('✅ profileFields data:', JSON.parse(profileData));
} else {
  console.log('❌ No profileFields data found');
}

// Check current user
const currentUser = localStorage.getItem('currentUser');
if (currentUser) {
  console.log('✅ currentUser:', JSON.parse(currentUser));
} else {
  console.log('❌ No currentUser found');
}

// Test bulletproof service if available
if (typeof bulletproofProfileFieldsService !== 'undefined') {
  console.log('🛡️ Testing bulletproof service...');
  bulletproofProfileFieldsService.loadProfileFields(userId).then(result => {
    console.log('🛡️ Service result:', result);
  });
} else {
  console.log('❌ Bulletproof service not available');
}