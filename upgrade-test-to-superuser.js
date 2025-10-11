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

async function upgradeToSuperUser() {
  console.log('🔧 Upgrading test@test.com to Super User...\n');

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
    console.log(`   Current Role: ${user.role}`);
    console.log(`   Current Status: ${user.is_active ? 'Active' : 'Inactive'}`);

    if (user.role === 'super_user') {
      console.log('\n✅ User is already a Super User!');
      return;
    }

    // Upgrade to super_user
    console.log('\n📝 Upgrading to Super User role...');
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({
        role: 'super_user',
        is_active: true,  // Ensure active
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error upgrading user:', updateError.message);
      process.exit(1);
    }

    console.log('✅ User upgraded to Super User successfully!');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 User is Now a Super User!');
    console.log('='.repeat(60));
    console.log('\n📋 Updated User Details:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: test1000!`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: super_user 👑`);
    console.log(`   Status: ACTIVE ✅`);
    console.log(`   User ID: ${user.id}`);

    console.log('\n🔐 Login Credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: test1000!`);

    console.log('\n✅ Super User Permissions:');
    console.log('   • Full admin access to all features');
    console.log('   • User Management (create, activate, delete users)');
    console.log('   • Access to all settings and configurations');
    console.log('   • HIPAA audit log viewing');
    console.log('   • System-wide permissions');

    console.log('\n✅ Next Steps:');
    console.log(`   1. Go to http://localhost:7767`);
    console.log(`   2. Log in with the credentials above`);
    console.log('   3. Access Settings > User Management');
    console.log('   4. Verify Super User capabilities');
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

upgradeToSuperUser();
