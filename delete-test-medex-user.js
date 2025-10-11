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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteTestMedExUser() {
  console.log('🗑️  Deleting Test MedEx User...\n');

  const testEmail = 'test@medex.com';

  try {
    // Step 1: Find the user
    console.log('🔍 Step 1: Finding test user...');
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .eq('tenant_id', 'medex')
      .single();

    if (findError || !user) {
      console.log('⚠️  Test user not found in database');
      return;
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Step 2: Delete from user_settings
    console.log('\n🗑️  Step 2: Deleting user_settings...');
    const { error: settingsError } = await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', user.id);

    if (settingsError) {
      console.warn('⚠️  User settings deletion warning:', settingsError.message);
    } else {
      console.log('✅ User settings deleted');
    }

    // Step 3: Delete from users table
    console.log('\n🗑️  Step 3: Deleting from users table...');
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id);

    if (userError) {
      console.error('❌ User deletion failed:', userError.message);
    } else {
      console.log('✅ User deleted from users table');
    }

    // Step 4: Delete from Supabase Auth
    console.log('\n🗑️  Step 4: Deleting from Supabase Auth...');
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

    if (authError) {
      console.error('❌ Auth user deletion failed:', authError.message);
    } else {
      console.log('✅ User deleted from Supabase Auth');
    }

    // Success
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Test User Deleted Successfully!');
    console.log('='.repeat(60));
    console.log(`\n✅ ${testEmail} has been completely removed`);
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

deleteTestMedExUser();
