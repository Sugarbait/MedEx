import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function investigate() {
  console.log('🔍 Investigating test@test.com in database...\n');

  // Check ALL entries for test@test.com (no tenant filter)
  const { data: allUsers, error: allError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'test@test.com');

  console.log('='.repeat(60));
  console.log('ALL test@test.com entries (no tenant filter):');
  console.log('='.repeat(60));

  if (allError) {
    console.log('❌ Error:', allError.message);
  } else if (!allUsers || allUsers.length === 0) {
    console.log('❌ NO entries found in database');
  } else {
    console.log(`✅ Found ${allUsers.length} entries:\n`);
    allUsers.forEach((user, index) => {
      console.log(`Entry ${index + 1}:`);
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Name:', user.name);
      console.log('  Role:', user.role);
      console.log('  Tenant ID:', user.tenant_id || '(NULL)');
      console.log('  Is Active:', user.is_active);
      console.log('  Created:', user.created_at);
      console.log('');
    });
  }

  // Check with MedEx tenant filter
  const { data: medexUser, error: medexError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'test@test.com')
    .eq('tenant_id', 'medex')
    .single();

  console.log('='.repeat(60));
  console.log('test@test.com with tenant_id=\'medex\' filter:');
  console.log('='.repeat(60));

  if (medexError) {
    console.log('❌ Error:', medexError.message);
    console.log('   Code:', medexError.code);
    console.log('   Details:', medexError.details);
  } else if (!medexUser) {
    console.log('❌ No user found with tenant_id=\'medex\'');
  } else {
    console.log('✅ User found:');
    console.log('  ID:', medexUser.id);
    console.log('  Email:', medexUser.email);
    console.log('  Tenant:', medexUser.tenant_id);
    console.log('  Is Active:', medexUser.is_active);
  }

  // Check Supabase Auth
  console.log('\n' + '='.repeat(60));
  console.log('Supabase Auth status:');
  console.log('='.repeat(60));

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const authUser = authUsers.users.find(u => u.email === 'test@test.com');

  if (!authUser) {
    console.log('❌ NOT found in Supabase Auth');
  } else {
    console.log('✅ Found in Auth:');
    console.log('  ID:', authUser.id);
    console.log('  Email:', authUser.email);
    console.log('  Created:', authUser.created_at);
  }

  // Final diagnosis
  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS:');
  console.log('='.repeat(60));

  if (allUsers && allUsers.length > 1) {
    console.log('🚨 DUPLICATE ENTRIES DETECTED!');
    console.log(`   Found ${allUsers.length} database entries for test@test.com`);
    console.log('   This causes the "multiple rows returned" error');
    console.log('\n💡 SOLUTION:');
    console.log('   1. Delete all entries except the one with tenant_id=\'medex\'');
    console.log('   2. If no medex entry exists, keep the Auth user and create medex record');
  } else if (allUsers && allUsers.length === 1) {
    const user = allUsers[0];
    if (user.tenant_id !== 'medex') {
      console.log('⚠️  WRONG TENANT!');
      console.log(`   User exists but has tenant_id='${user.tenant_id}' instead of 'medex'`);
      console.log('\n💡 SOLUTION:');
      console.log('   Update tenant_id to \'medex\' or delete and recreate');
    } else if (user.is_active === false) {
      console.log('⚠️  PENDING APPROVAL');
      console.log('   User exists with correct tenant but is_active=false');
      console.log('\n💡 SOLUTION:');
      console.log('   User needs to be approved by super user in User Management');
    } else {
      console.log('✅ User looks correct in database');
      console.log('   If login still fails, check password or other auth issues');
    }
  } else if (authUser && (!allUsers || allUsers.length === 0)) {
    console.log('🚨 MISSING DATABASE RECORD!');
    console.log('   User exists in Auth but NOT in database');
    console.log('   This is the same bug as test2@test.com');
    console.log('\n💡 SOLUTION:');
    console.log('   Create database record manually OR fix userProfileService.ts bug');
  } else {
    console.log('❌ User does not exist anywhere');
    console.log('\n💡 SOLUTION:');
    console.log('   Create new user through User Management');
  }
}

investigate();
