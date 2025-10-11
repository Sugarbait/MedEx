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

async function clearLockout() {
  console.log('🔓 Clearing lockout for test@medex.com...\n');

  const email = 'test@medex.com';

  try {
    // Clear failed login attempts from database
    console.log('📝 Step 1: Clearing failed_login_attempts table...');
    const { error: dbError } = await supabase
      .from('failed_login_attempts')
      .delete()
      .eq('email', email);

    if (dbError) {
      console.warn('⚠️  Database clear warning:', dbError.message);
    } else {
      console.log('✅ Database failed attempts cleared');
    }

    // Clear localStorage lockout (if stored locally)
    console.log('\n📝 Step 2: Clearing localStorage lockout entries...');
    console.log('   ℹ️  Open browser console and run:');
    console.log('   localStorage.removeItem("lockout_test@medex.com");');
    console.log('   localStorage.removeItem("failedAttempts_test@medex.com");');

    // Try to find and clear user-specific lockout data
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (user) {
      console.log(`\n📝 Step 3: User ID found: ${user.id}`);
      console.log('   Additional localStorage keys to clear:');
      console.log(`   localStorage.removeItem("lockout_${user.id}");`);
      console.log(`   localStorage.removeItem("failedAttempts_${user.id}");`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Lockout Cleared!');
    console.log('='.repeat(60));
    console.log('\n📋 Next Steps:');
    console.log('1. Clear browser localStorage (see commands above)');
    console.log('2. Refresh the page (Ctrl+R or F5)');
    console.log('3. Try logging in again');
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log('   Email: test@medex.com');
    console.log('   Password: TestMedEx123!@#');
    console.log('');

  } catch (error) {
    console.error('❌ Error clearing lockout:', error);
    process.exit(1);
  }
}

clearLockout();
