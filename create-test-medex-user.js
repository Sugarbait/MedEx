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

async function createTestMedExUser() {
  console.log('🔧 Creating Test MedEx Super User...\n');

  const testUser = {
    email: 'test@medex.com',
    name: 'Test MedEx User',
    role: 'super_user',
    tenant_id: 'medex',
    is_active: true,
    password: 'TestMedEx123!@#'  // Temporary password
  };

  try {
    // Step 1: Create Supabase Auth user
    console.log('📝 Step 1: Creating Supabase Auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true,
      user_metadata: {
        name: testUser.name,
        role: testUser.role,
        tenant_id: testUser.tenant_id
      }
    });

    if (authError) {
      console.error('❌ Auth user creation failed:', authError.message);
      process.exit(1);
    }

    console.log(`✅ Supabase Auth user created with ID: ${authData.user.id}`);

    // Step 2: Create user profile in users table
    console.log('\n📝 Step 2: Creating user profile in users table...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        tenant_id: testUser.tenant_id,
        is_active: testUser.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ User profile creation failed:', userError.message);
      console.log('⚠️  Rolling back auth user...');
      await supabase.auth.admin.deleteUser(authData.user.id);
      process.exit(1);
    }

    console.log('✅ User profile created in users table');

    // Step 3: Create user_settings record
    console.log('\n📝 Step 3: Creating user_settings record...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('user_settings')
      .insert({
        user_id: authData.user.id,
        tenant_id: testUser.tenant_id,
        theme: 'light',
        notifications: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (settingsError) {
      console.warn('⚠️  User settings creation failed (non-critical):', settingsError.message);
    } else {
      console.log('✅ User settings created');
    }

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Test MedEx User Created Successfully!');
    console.log('='.repeat(60));
    console.log('\n📋 User Details:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Password: ${testUser.password}`);
    console.log(`   Name: ${testUser.name}`);
    console.log(`   Role: ${testUser.role}`);
    console.log(`   Tenant ID: ${testUser.tenant_id}`);
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Active: ${testUser.is_active}`);

    console.log('\n🔐 Login Credentials:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Password: ${testUser.password}`);

    console.log('\n✅ Next Steps:');
    console.log('   1. Try logging in with these credentials');
    console.log('   2. Verify you can access the MedEx dashboard');
    console.log('   3. Confirm CareXPS users are NOT visible');
    console.log('   4. Proceed with tenant filtering code updates');

    console.log('\n⚠️  IMPORTANT:');
    console.log('   This is a TEMPORARY test user');
    console.log('   Delete after testing with: node delete-test-medex-user.js');
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createTestMedExUser();
