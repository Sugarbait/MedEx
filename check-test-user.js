import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUser() {
  console.log('🔍 Checking for test@test.com...\n');

  try {
    // Check database users table
    console.log('1️⃣ Checking users table...');
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@test.com')
      .eq('tenant_id', 'medex')
      .single();

    if (dbError && dbError.code !== 'PGRST116') {
      console.error('❌ Database error:', dbError);
    } else if (!dbUser) {
      console.log('❌ User NOT found in database users table');
    } else {
      console.log('✅ User found in database:');
      console.log('   ID:', dbUser.id);
      console.log('   Email:', dbUser.email);
      console.log('   Role:', dbUser.role);
      console.log('   Is Active:', dbUser.is_active);
      console.log('   Tenant:', dbUser.tenant_id);
    }

    // Check Supabase Auth
    console.log('\n2️⃣ Checking Supabase Auth...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Auth error:', authError);
    } else {
      const authUser = authUsers.users.find(u => u.email === 'test@test.com');
      if (!authUser) {
        console.log('❌ User NOT found in Supabase Auth');
        console.log('   🚨 This is the problem! User exists in database but not in Auth.');
      } else {
        console.log('✅ User found in Supabase Auth:');
        console.log('   ID:', authUser.id);
        console.log('   Email:', authUser.email);
        console.log('   Confirmed:', authUser.email_confirmed_at ? 'Yes' : 'No');
      }
    }

    // Check user_settings
    console.log('\n3️⃣ Checking user_settings...');
    if (dbUser) {
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', dbUser.id)
        .eq('tenant_id', 'medex')
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.log('❌ Settings error:', settingsError.message);
      } else if (!settings) {
        console.log('⚠️  No user_settings found (this might be OK)');
      } else {
        console.log('✅ User settings found');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkUser();
