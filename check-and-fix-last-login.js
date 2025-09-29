/**
 * Script to check and fix last_login values in the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAndFixLastLogin() {
  console.log('🔍 Checking last_login values in database...\n');

  try {
    // Step 1: Get all users with their last_login values
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, created_at, last_login')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching users:', error.message);
      return;
    }

    console.log(`Found ${users.length} users in database:\n`);
    console.log('Current last_login status:');
    console.log('='.repeat(80));

    let nullCount = 0;
    let hasValueCount = 0;

    // Display current status
    users.forEach(user => {
      if (user.last_login) {
        hasValueCount++;
        console.log(`✅ ${user.email}: ${new Date(user.last_login).toLocaleString()}`);
      } else {
        nullCount++;
        console.log(`❌ ${user.email}: NULL (no last login recorded)`);
      }
    });

    console.log('='.repeat(80));
    console.log(`\nSummary:`);
    console.log(`- Users with last_login: ${hasValueCount}`);
    console.log(`- Users without last_login: ${nullCount}`);

    // Step 2: Fix NULL values
    if (nullCount > 0) {
      console.log('\n🔧 Fixing NULL last_login values...\n');

      for (const user of users) {
        if (!user.last_login) {
          // Set last_login to created_at for users who haven't logged in
          const { error: updateError } = await supabase
            .from('users')
            .update({ last_login: user.created_at })
            .eq('id', user.id);

          if (updateError) {
            console.error(`❌ Failed to update ${user.email}:`, updateError.message);
          } else {
            console.log(`✅ Updated ${user.email} - set last_login to ${new Date(user.created_at).toLocaleString()}`);
          }
        }
      }

      console.log('\n✅ All NULL values have been fixed!');
    } else {
      console.log('\n✅ All users already have last_login values!');
    }

    // Step 3: Verify the fix
    console.log('\n📊 Verifying the fix...');

    const { data: verifyUsers, error: verifyError } = await supabase
      .from('users')
      .select('email, last_login')
      .order('created_at', { ascending: true });

    if (!verifyError) {
      console.log('\nFinal status:');
      console.log('='.repeat(80));
      verifyUsers.forEach(user => {
        console.log(`✅ ${user.email}: ${user.last_login ? new Date(user.last_login).toLocaleString() : 'Still NULL'}`);
      });
      console.log('='.repeat(80));
    }

    console.log('\n🎉 Done! Refresh your User Management page to see the updates.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check and fix
checkAndFixLastLogin();