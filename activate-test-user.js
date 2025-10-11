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

async function activateTestUser() {
  console.log('🔧 Activating test@test.com user...\n');

  const testEmail = 'test@test.com';

  try {
    // Find the user by email
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .eq('tenant_id', 'medex');

    if (findError) {
      console.error('❌ Error finding user:', findError.message);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.error('❌ User not found with email:', testEmail);
      process.exit(1);
    }

    const user = users[0];
    console.log(`📋 Found user: ${user.name} (${user.email})`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Current Status: ${user.is_active ? 'Active' : 'Inactive'}`);

    if (user.is_active) {
      console.log('\n✅ User is already active!');
      console.log('   You can log in immediately with:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: test1000!`);
      return;
    }

    // Activate the user
    console.log('\n📝 Activating user...');
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error activating user:', updateError.message);
      process.exit(1);
    }

    console.log('✅ User activated successfully!');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 User is Now Active!');
    console.log('='.repeat(60));
    console.log('\n🔐 Login Credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: test1000!`);
    console.log(`   Status: ACTIVE ✅`);

    console.log('\n✅ Next Steps:');
    console.log(`   1. Go to http://localhost:7767`);
    console.log(`   2. Log in with the credentials above`);
    console.log('   3. Test the application functionality');
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

activateTestUser();
