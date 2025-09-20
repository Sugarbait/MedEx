/**
 * Immediate Guest User Cleanup Script
 * Run this in the browser console to fix duplicate Guest users
 *
 * To use:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter to execute
 */

console.log('🧹 Guest User Cleanup Script Starting...');

// Function to clean up duplicate Guest users
function cleanupDuplicateGuests() {
  try {
    console.log('📋 Checking for duplicate Guest users...');

    const storedUsers = localStorage.getItem('systemUsers');
    if (!storedUsers) {
      console.log('ℹ️ No system users found');
      return { removed: 0, success: true };
    }

    let users = [];
    try {
      users = JSON.parse(storedUsers);
    } catch (parseError) {
      console.error('❌ Failed to parse system users:', parseError);
      return { removed: 0, success: false };
    }

    // Find all Guest users
    const guestUsers = users.filter(user =>
      (user.email && user.email.toLowerCase() === 'guest@email.com') ||
      (user.name && user.name.toLowerCase() === 'guest') ||
      (user.id && user.id.toLowerCase().includes('guest'))
    );

    console.log(`🔍 Found ${guestUsers.length} Guest users`);

    if (guestUsers.length <= 1) {
      console.log('✅ No duplicate Guest users found');
      return { removed: 0, success: true };
    }

    // Show all Guest users before cleanup
    guestUsers.forEach((user, index) => {
      console.log(`Guest ${index + 1}: ID=${user.id}, Name=${user.name}, Created=${user.created_at}`);
    });

    // Sort by creation date (keep oldest)
    guestUsers.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });

    const userToKeep = guestUsers[0];
    const usersToRemove = guestUsers.slice(1);

    console.log(`📌 Keeping Guest user: ${userToKeep.id}`);
    console.log(`🗑️ Removing ${usersToRemove.length} duplicate Guest users`);

    // Remove duplicates
    const idsToRemove = usersToRemove.map(u => u.id);
    const cleanedUsers = users.filter(user => !idsToRemove.includes(user.id));

    localStorage.setItem('systemUsers', JSON.stringify(cleanedUsers));

    // Remove individual profiles
    idsToRemove.forEach(userId => {
      localStorage.removeItem(`userProfile_${userId}`);
    });

    console.log(`✅ Successfully removed ${usersToRemove.length} duplicate Guest users`);
    return { removed: usersToRemove.length, keptUserId: userToKeep.id, success: true };

  } catch (error) {
    console.error('❌ Error cleaning up duplicate Guest users:', error);
    return { removed: 0, success: false };
  }
}

// Function to add Guest users to deleted list
function addGuestToDeletedList() {
  try {
    console.log('🚫 Adding Guest users to deleted list...');

    const deletedUsers = localStorage.getItem('deletedUsers');
    let deletedUserIds = [];
    if (deletedUsers) {
      try {
        deletedUserIds = JSON.parse(deletedUsers);
      } catch (parseError) {
        console.warn('⚠️ Failed to parse deleted users list');
      }
    }

    // Get Guest user IDs from current system
    const storedUsers = localStorage.getItem('systemUsers');
    if (storedUsers) {
      try {
        const users = JSON.parse(storedUsers);
        const guestUsers = users.filter(user =>
          (user.email && user.email.toLowerCase() === 'guest@email.com') ||
          (user.name && user.name.toLowerCase() === 'guest') ||
          (user.id && user.id.toLowerCase().includes('guest'))
        );

        guestUsers.forEach(guestUser => {
          if (!deletedUserIds.includes(guestUser.id)) {
            deletedUserIds.push(guestUser.id);
            console.log(`➕ Added Guest user ID to deleted list: ${guestUser.id}`);
          }
        });
      } catch (parseError) {
        console.error('❌ Failed to parse system users');
      }
    }

    // Add common Guest ID patterns
    const commonGuestIds = ['guest-user-123', 'Guest', 'guest'];
    commonGuestIds.forEach(id => {
      if (!deletedUserIds.includes(id)) {
        deletedUserIds.push(id);
        console.log(`➕ Added common Guest ID to deleted list: ${id}`);
      }
    });

    localStorage.setItem('deletedUsers', JSON.stringify(deletedUserIds));
    console.log('✅ Guest users added to deleted list successfully');
    return true;

  } catch (error) {
    console.error('❌ Error adding Guest users to deleted list:', error);
    return false;
  }
}

// Function to remove all Guest users completely
function removeAllGuestUsers() {
  try {
    console.log('🗑️ Removing all Guest users from system...');

    const storedUsers = localStorage.getItem('systemUsers');
    if (storedUsers) {
      const users = JSON.parse(storedUsers);
      const nonGuestUsers = users.filter(user =>
        !((user.email && user.email.toLowerCase() === 'guest@email.com') ||
          (user.name && user.name.toLowerCase() === 'guest') ||
          (user.id && user.id.toLowerCase().includes('guest')))
      );
      localStorage.setItem('systemUsers', JSON.stringify(nonGuestUsers));
      console.log('✅ Removed all Guest users from system');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error removing Guest users:', error);
    return false;
  }
}

// Main execution
async function runCompleteGuestCleanup() {
  console.log('🚀 Starting complete Guest user cleanup...');

  // Show current state
  console.log('\n📊 CURRENT STATE:');
  const storedUsers = localStorage.getItem('systemUsers');
  if (storedUsers) {
    try {
      const users = JSON.parse(storedUsers);
      const guestUsers = users.filter(user =>
        (user.email && user.email.toLowerCase() === 'guest@email.com') ||
        (user.name && user.name.toLowerCase() === 'guest') ||
        (user.id && user.id.toLowerCase().includes('guest'))
      );
      console.log(`Current Guest users: ${guestUsers.length}`);
      guestUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ID: ${user.id}, Name: ${user.name}, Email: ${user.email}`);
      });
    } catch (error) {
      console.error('Error reading current users:', error);
    }
  }

  // Step 1: Clean up duplicates
  console.log('\n🧹 STEP 1: Cleaning up duplicates...');
  const cleanupResult = cleanupDuplicateGuests();

  // Step 2: Add to deleted list
  console.log('\n🚫 STEP 2: Adding to deleted list...');
  const addedToDeleted = addGuestToDeletedList();

  // Step 3: Remove all Guest users
  console.log('\n🗑️ STEP 3: Removing all Guest users...');
  const removedAll = removeAllGuestUsers();

  // Show final results
  console.log('\n📋 FINAL RESULTS:');
  console.log(`Duplicates removed: ${cleanupResult.removed}`);
  console.log(`Added to deleted list: ${addedToDeleted}`);
  console.log(`All Guest users removed: ${removedAll}`);
  console.log(`Overall success: ${cleanupResult.success && addedToDeleted && removedAll}`);

  // Show final state
  console.log('\n🏁 FINAL STATE:');
  const finalUsers = localStorage.getItem('systemUsers');
  if (finalUsers) {
    try {
      const users = JSON.parse(finalUsers);
      const remainingGuests = users.filter(user =>
        (user.email && user.email.toLowerCase() === 'guest@email.com') ||
        (user.name && user.name.toLowerCase() === 'guest') ||
        (user.id && user.id.toLowerCase().includes('guest'))
      );
      console.log(`Remaining Guest users: ${remainingGuests.length}`);

      // Show deleted list
      const deletedUsers = localStorage.getItem('deletedUsers');
      if (deletedUsers) {
        const deleted = JSON.parse(deletedUsers);
        const guestDeletedIds = deleted.filter(id =>
          id.toLowerCase().includes('guest') || id.includes('Guest')
        );
        console.log(`Guest IDs in deleted list: ${guestDeletedIds.length}`);
      }
    } catch (error) {
      console.error('Error reading final state:', error);
    }
  }

  console.log('🎉 Guest cleanup complete! The Guest users should no longer return after deletion.');
  console.log('💡 To test: Refresh the page and check if Guest users reappear.');

  return {
    duplicatesRemoved: cleanupResult.removed,
    addedToDeletedList: addedToDeleted,
    allRemoved: removedAll,
    success: cleanupResult.success && addedToDeleted && removedAll
  };
}

// Execute the cleanup
runCompleteGuestCleanup();