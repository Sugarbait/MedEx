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

async function checkUser() {
  console.log('🔍 Checking test@test.com...\n');

  // Check database
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'test@test.com')
    .eq('tenant_id', 'medex')
    .single();

  if (dbError) {
    console.log('❌ Database Error:', dbError.message);
  } else if (!dbUser) {
    console.log('❌ User NOT found in database');
  } else {
    console.log('✅ User found in database:');
    console.log('   Email:', dbUser.email);
    console.log('   ID:', dbUser.id);
    console.log('   Role:', dbUser.role);
    console.log('   Is Active:', dbUser.is_active);
    console.log('   Tenant:', dbUser.tenant_id);
    console.log('');

    if (dbUser.is_active === false) {
      console.log('⚠️  USER IS PENDING APPROVAL');
      console.log('   This user cannot log in until approved by a super user');
    } else {
      console.log('✅ USER IS ACTIVE - Should be able to log in');
    }
  }

  // Check Auth
  console.log('\n🔐 Checking Supabase Auth...');
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const authUser = authUsers.users.find(u => u.email === 'test@test.com');

  if (!authUser) {
    console.log('❌ User NOT found in Supabase Auth');
    console.log('   🚨 Cannot log in without Auth record');
  } else {
    console.log('✅ User found in Auth:', authUser.id);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS:');
  console.log('='.repeat(60));
  
  if (dbUser && authUser) {
    if (dbUser.is_active === false) {
      console.log('❌ LOGIN WILL FAIL - User is PENDING APPROVAL');
      console.log('   Solution: Approve user in User Management page');
    } else {
      console.log('✅ User should be able to log in');
      console.log('   If login fails, check password or clear lockout');
    }
  } else if (dbUser && !authUser) {
    console.log('❌ LOGIN WILL FAIL - User missing from Supabase Auth');
    console.log('   Solution: Need to create Auth user');
  } else if (!dbUser && authUser) {
    console.log('❌ LOGIN WILL FAIL - User missing from database');
    console.log('   Solution: Need to create database record');
  } else {
    console.log('❌ LOGIN WILL FAIL - User does not exist');
    console.log('   Solution: Need to create user completely');
  }
}

checkUser();
