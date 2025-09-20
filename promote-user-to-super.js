// Quick script to promote current user to super_user role
console.log('🔧 Promoting current user to super_user role...');

// Get current user from localStorage
const currentUser = localStorage.getItem('currentUser');
if (!currentUser) {
  console.log('❌ No current user found in localStorage');
} else {
  try {
    const user = JSON.parse(currentUser);
    console.log('👤 Current user:', user.name, '(', user.email, ')');
    console.log('📝 Current role:', user.role);

    // Update role to super_user
    user.role = 'super_user';

    // Save back to localStorage
    localStorage.setItem('currentUser', JSON.stringify(user));

    console.log('✅ User promoted to super_user role!');
    console.log('🔄 Refreshing page to apply changes...');

    // Trigger a page refresh to reload with new role
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.log('❌ Error updating user role:', error);
  }
}