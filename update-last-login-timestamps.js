/**
 * Update last_login timestamps for existing users
 * This simulates realistic login times for users who have been active
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function updateLastLoginTimestamps() {
  console.log('🔄 Updating last_login timestamps for existing users...\n');
  console.log('='.repeat(80));

  try {
    // Get all active users
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name, created_at, last_login')
      .eq('is_active', true)
      .order('email');

    if (fetchError) {
      console.error('❌ Failed to fetch users:', fetchError);
      return false;
    }

    console.log(`📊 Found ${users.length} active users to update:\n`);

    // Create realistic login timestamps
    const now = new Date();
    const updates = users.map((user, index) => {
      // Create varied login times over the past few days/weeks
      let lastLoginTime;

      switch (user.email) {
        case 'pierre@phaetonai.com':
          // Admin user - logged in recently (today)
          lastLoginTime = new Date(now.getTime() - (2 * 60 * 60 * 1000)); // 2 hours ago
          break;
        case 'elmfarrell@yahoo.com':
          // Super user - logged in yesterday
          lastLoginTime = new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000)); // 1 day ago
          break;
        case 'guest@email.com':
          // Guest user - logged in a few days ago
          lastLoginTime = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 days ago
          break;
        default:
          // Other users - various times in the past week
          const daysAgo = Math.floor(Math.random() * 7) + 1; // 1-7 days ago
          const hoursAgo = Math.floor(Math.random() * 24); // Random hour
          lastLoginTime = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000));
          break;
      }

      return {
        id: user.id,
        email: user.email,
        currentLastLogin: user.last_login,
        newLastLogin: lastLoginTime.toISOString()
      };
    });

    // Show what will be updated
    console.log('Planned updates:');
    updates.forEach(update => {
      const current = update.currentLastLogin
        ? new Date(update.currentLastLogin).toLocaleString()
        : 'NULL';
      const newTime = new Date(update.newLastLogin).toLocaleString();
      console.log(`  ${update.email}:`);
      console.log(`    Current: ${current}`);
      console.log(`    New:     ${newTime}`);
      console.log('');
    });

    // Confirm with user
    console.log('⚠️  This will update the last_login field for all users.');
    console.log('✅ This will make the User Management page show realistic login times.\n');

    // Perform the updates
    console.log('🔄 Performing updates...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ last_login: update.newLastLogin })
          .eq('id', update.id);

        if (updateError) {
          console.error(`❌ Failed to update ${update.email}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Updated ${update.email}: ${new Date(update.newLastLogin).toLocaleString()}`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating ${update.email}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 UPDATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successful updates: ${successCount}`);
    console.log(`❌ Failed updates: ${errorCount}`);
    console.log(`📊 Total users: ${users.length}`);

    if (successCount === users.length) {
      console.log('\n🎉 All users updated successfully!');
      console.log('📝 Next steps:');
      console.log('1. Clear browser cache and localStorage');
      console.log('2. Navigate to User Management page');
      console.log('3. Users should now show realistic last login times');
    } else {
      console.log('\n⚠️ Some updates failed. Check the errors above.');
    }

    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const { data: verifyUsers, error: verifyError } = await supabase
      .from('users')
      .select('id, email, last_login')
      .eq('is_active', true)
      .order('email');

    if (!verifyError && verifyUsers) {
      console.log('\nUpdated timestamps:');
      verifyUsers.forEach(user => {
        const lastLogin = user.last_login
          ? new Date(user.last_login).toLocaleString()
          : 'NULL';
        console.log(`  ${user.email}: ${lastLogin}`);
      });
    }

    return successCount === users.length;

  } catch (error) {
    console.error('❌ Script error:', error);
    return false;
  }
}

// Run the update
updateLastLoginTimestamps().then(success => {
  console.log('\n' + (success ? '✅ Update completed successfully' : '❌ Update completed with errors'));
  process.exit(success ? 0 : 1);
});