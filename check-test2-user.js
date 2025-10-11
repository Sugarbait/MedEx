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
  console.log('🔍 Checking for test2@test.com...\n');

  try {
    // Check database users table
    console.log('1️⃣ Checking users table...');
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test2@test.com')
      .eq('tenant_id', 'medex')
      .single();

    if (dbError && dbError.code !== 'PGRST116') {
      console.error('❌ Database error:', dbError);
    } else if (!dbUser) {
      console.log('❌ User NOT found in database users table');
      console.log('   This means user creation FAILED');
    } else {
      console.log('✅ User found in database:');
      console.log('   ID:', dbUser.id);
      console.log('   Email:', dbUser.email);
      console.log('   Name:', dbUser.name);
      console.log('   Role:', dbUser.role);
      console.log('   Is Active:', dbUser.is_active);
      console.log('   Tenant:', dbUser.tenant_id);
      console.log('');
      
      if (dbUser.is_active === false) {
        console.log('✅ CORRECT: User is PENDING (is_active = false)');
        console.log('   Should appear in "Pending Approvals" section');
      } else {
        console.log('⚠️  UNEXPECTED: User is ACTIVE (is_active = true)');
        console.log('   Should be in "Active Users" section instead');
      }
    }

    // Check Supabase Auth
    console.log('\n2️⃣ Checking Supabase Auth...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Auth error:', authError);
    } else {
      const authUser = authUsers.users.find(u => u.email === 'test2@test.com');
      if (!authUser) {
        console.log('❌ User NOT found in Supabase Auth');
        console.log('   User cannot log in until approved AND Auth user created');
      } else {
        console.log('✅ User found in Supabase Auth:');
        console.log('   ID:', authUser.id);
        console.log('   Email:', authUser.email);
        console.log('   Confirmed:', authUser.email_confirmed_at ? 'Yes' : 'No');
      }
    }

    // Check all MedEx users
    console.log('\n3️⃣ All MedEx users in database:');
    const { data: allUsers } = await supabase
      .from('users')
      .select('email, is_active, role')
      .eq('tenant_id', 'medex')
      .order('created_at', { ascending: true });

    if (allUsers && allUsers.length > 0) {
      console.log(`   Total: ${allUsers.length} users`);
      allUsers.forEach((u, i) => {
        const status = u.is_active ? 'ACTIVE' : 'PENDING';
        console.log(`   ${i + 1}. ${u.email} - ${u.role} - ${status}`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkUser();
