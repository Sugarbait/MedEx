/**
 * Restore Profile Data
 * Quick script to restore your profile information
 */

console.log('🔧 RESTORING PROFILE DATA');
console.log('=========================');

const restoreProfileData = () => {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    console.log('❌ No current user found');
    return false;
  }

  try {
    const userData = JSON.parse(currentUser);
    const userId = userData.id;

    // Your known profile data
    const profileData = {
      department: "IT Department",
      phone: "+14165299916",
      location: "Markham ON",
      display_name: "Pierre",
      bio: "AI Prompt Engineer"
    };

    console.log('📝 Restoring profile data for user:', userId);
    console.log('📋 Data to restore:', profileData);

    // Save the data
    localStorage.setItem(`profileFields_${userId}`, JSON.stringify(profileData));

    // Verify it was saved
    const saved = localStorage.getItem(`profileFields_${userId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('✅ Profile data restored successfully:', parsed);
      return true;
    } else {
      console.log('❌ Failed to save profile data');
      return false;
    }

  } catch (error) {
    console.error('❌ Error restoring profile data:', error);
    return false;
  }
};

// Auto-run
const success = restoreProfileData();

if (success) {
  console.log('\n🎉 SUCCESS! Your profile data has been restored.');
  console.log('📝 Now refresh the page and navigate to Settings > Profile');
  console.log('✅ Your fields should now be populated with:');
  console.log('   - Department: IT Department');
  console.log('   - Phone: +14165299916');
  console.log('   - Location: Markham ON');
} else {
  console.log('\n❌ FAILED! Could not restore profile data.');
}

// Export for manual use
window.restoreProfileData = restoreProfileData;