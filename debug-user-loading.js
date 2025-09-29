/**
 * Debug script to trace how users are loaded in the application
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function debugUserLoading() {
  console.log('🔍 Debugging user loading process...\n');

  try {
    // Step 1: Load users like userProfileService does
    console.log('1️⃣ Loading users using userProfileService method:');
    const { data: supabaseUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error:', usersError);
      return;
    }

    console.log(`Found ${supabaseUsers.length} users\n`);

    // Step 2: Map users like the service does
    console.log('2️⃣ Mapping users (current implementation):');
    const mappedUsers = supabaseUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mfa_enabled: user.mfa_enabled,
      avatar: user.avatar_url,
      settings: {},
      created_at: user.created_at,
      updated_at: user.updated_at,
      lastLogin: user.last_login // This is what we added
    }));

    console.log('Mapped users with lastLogin field:');
    mappedUsers.forEach(user => {
      console.log(`- ${user.email}: lastLogin = ${user.lastLogin || 'undefined'}`);
    });

    // Step 3: Check localStorage
    console.log('\n3️⃣ Checking localStorage (systemUsers):');
    // We can't access localStorage from Node.js, so we'll just show what should be there

    console.log('\n4️⃣ Data flow analysis:');
    console.log('Database field: last_login (snake_case) ✅');
    console.log('Mapped field: lastLogin (camelCase) ✅');
    console.log('UI expects: userItem.lastLogin ✅');

    // Step 4: Check what userManagementService would return
    console.log('\n5️⃣ What userManagementService returns:');
    for (const user of mappedUsers) {
      // Simulate getUserLoginStats
      const { data: dbUser } = await supabase
        .from('users')
        .select('last_login')
        .eq('id', user.id)
        .single();

      console.log(`- ${user.email}:`);
      console.log(`  From DB: last_login = ${dbUser?.last_login}`);
      console.log(`  Mapped: lastLogin = ${user.lastLogin}`);
      console.log(`  Should display: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}`);
    }

    console.log('\n✅ Analysis complete!');
    console.log('\nIf users still show "Never" in the UI, it means:');
    console.log('1. The app might be using cached localStorage data');
    console.log('2. The userManagementService might not be returning the lastLogin field');
    console.log('3. Clear browser cache and localStorage, then reload the page');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugUserLoading();