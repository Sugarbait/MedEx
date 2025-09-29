/**
 * Debug script to check last_login data in database vs UI
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function debugLastLogin() {
  console.log('🔍 Debugging Last Login Issue...\n');
  console.log('='.repeat(60));

  try {
    // Check raw database data
    console.log('\n📊 STEP 1: Raw Database Data');
    console.log('-'.repeat(30));

    const { data: users, error: dbError } = await supabase
      .from('users')
      .select('email, name, last_login, created_at')
      .order('email');

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return;
    }

    console.log('Database Results:');
    users.forEach(user => {
      const lastLogin = user.last_login
        ? new Date(user.last_login).toLocaleString()
        : 'NULL';
      console.log(`  ${user.email}: ${lastLogin}`);
    });

    // Check userProfileService mapping
    console.log('\n🔄 STEP 2: Service Layer Mapping');
    console.log('-'.repeat(30));

    // Simulate what userProfileService should do
    const mappedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      lastLogin: user.last_login, // This is the critical mapping
      created_at: user.created_at
    }));

    console.log('Mapped Results:');
    mappedUsers.forEach(user => {
      const lastLogin = user.lastLogin
        ? new Date(user.lastLogin).toLocaleString()
        : 'undefined/null';
      console.log(`  ${user.email}: ${lastLogin}`);
    });

    // Check if mapping preserved the data
    const mappingSuccessful = mappedUsers.every(user =>
      user.lastLogin !== undefined && user.lastLogin !== null
    );

    console.log(`\n✅ Mapping Successful: ${mappingSuccessful}`);

    // Check localStorage cache
    console.log('\n💾 STEP 3: localStorage Cache Check');
    console.log('-'.repeat(30));
    console.log('NOTE: This needs to be checked in browser console:');
    console.log('  localStorage.getItem("systemUsers")');

    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));

    const hasData = users.some(u => u.last_login !== null);
    console.log(`Database has last_login data: ${hasData ? '✅ YES' : '❌ NO'}`);
    console.log(`Field mapping working: ${mappingSuccessful ? '✅ YES' : '❌ NO'}`);

    if (hasData && mappingSuccessful) {
      console.log('\n🎯 LIKELY ISSUE: UI is using cached data without lastLogin field');
      console.log('SOLUTION: Clear localStorage cache in browser and refresh');
    } else if (!hasData) {
      console.log('\n⚠️ ISSUE: Database missing last_login data');
      console.log('SOLUTION: Update last_login field when users log in');
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugLastLogin();