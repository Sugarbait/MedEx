#!/usr/bin/env node

/**
 * Migration script to add last_login column to users table
 * Run this to fix the "Last Login: Never" issue in User Management
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function applyMigration() {
  console.log('🚀 Starting last_login column migration...');

  try {
    // Check if column already exists by trying to query it
    console.log('📊 Checking if last_login column exists...');
    const { error: checkError } = await supabase
      .from('users')
      .select('last_login')
      .limit(1);

    if (!checkError) {
      console.log('✅ last_login column already exists! No migration needed.');
      return;
    }

    if (checkError.message.includes('column users.last_login does not exist')) {
      console.log('🔧 last_login column not found. Adding it now...');

      // Use raw SQL to add the column
      const { error: alterError } = await supabase.rpc('exec_sql', {
        query: `
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;
        `
      }).catch(async () => {
        // If exec_sql doesn't exist, try a different approach
        console.log('⚠️ Direct SQL execution not available. Attempting alternative approach...');

        // Alternative: Update the users table schema through Supabase Dashboard
        console.log(`
❗ MANUAL ACTION REQUIRED:

Please add the last_login column manually in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to the Table Editor
3. Select the "users" table
4. Click "Edit Table" or "Add Column"
5. Add a new column with these settings:
   - Name: last_login
   - Type: timestamptz (timestamp with time zone)
   - Default Value: (leave empty)
   - Is Nullable: Yes
6. Save the changes

After adding the column, run this script again to populate initial values.
        `);
        process.exit(1);
      });

      if (alterError) {
        console.error('❌ Failed to add column:', alterError);
        throw alterError;
      }

      console.log('✅ last_login column added successfully!');

      // Set initial values for existing users
      console.log('📝 Setting initial last_login values for existing users...');
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('id, created_at');

      if (!fetchError && users) {
        for (const user of users) {
          await supabase
            .from('users')
            .update({ last_login: user.created_at })
            .eq('id', user.id);
        }
        console.log(`✅ Updated ${users.length} users with initial last_login values`);
      }
    } else {
      console.error('❌ Unexpected error:', checkError);
      throw checkError;
    }

    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your application');
    console.log('2. Users will now see proper last login times');
    console.log('3. Last login will update automatically when users log in');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration().catch(console.error);