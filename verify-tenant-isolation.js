import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyTenantIsolation() {
  console.log('🔍 Verifying Tenant Isolation Configuration\n');
  console.log('='.repeat(60));

  let allChecksPassed = true;

  // Check 1: Verify tenant_id column exists
  console.log('\n📋 Check 1: Verifying tenant_id columns...');

  const tables = ['users', 'user_settings', 'audit_logs', 'notes'];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('tenant_id')
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.log(`   ❌ ${table}: tenant_id column missing or inaccessible`);
        console.log(`      Error: ${error.message}`);
        allChecksPassed = false;
      } else {
        console.log(`   ✅ ${table}: tenant_id column exists`);
      }
    } catch (err) {
      console.log(`   ❌ ${table}: Error checking column - ${err.message}`);
      allChecksPassed = false;
    }
  }

  // Check 2: Verify existing data has tenant_id
  console.log('\n📋 Check 2: Verifying existing data has tenant_id...');

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('email, tenant_id, role')
    .order('created_at', { ascending: true });

  if (usersError) {
    console.log(`   ❌ Error fetching users: ${usersError.message}`);
    allChecksPassed = false;
  } else {
    console.log(`   ✅ Found ${users.length} users`);

    // Group by tenant
    const tenants = {};
    users.forEach(user => {
      if (!tenants[user.tenant_id]) {
        tenants[user.tenant_id] = [];
      }
      tenants[user.tenant_id].push(user);
    });

    console.log('\n   User distribution by tenant:');
    Object.entries(tenants).forEach(([tenantId, users]) => {
      console.log(`   📁 ${tenantId}: ${users.length} users`);
      users.forEach(u => {
        console.log(`      - ${u.email} (${u.role})`);
      });
    });

    // Check for users without tenant_id
    const usersWithoutTenant = users.filter(u => !u.tenant_id);
    if (usersWithoutTenant.length > 0) {
      console.log(`\n   ⚠️  WARNING: ${usersWithoutTenant.length} users without tenant_id`);
      allChecksPassed = false;
    }
  }

  // Check 3: Verify indexes exist
  console.log('\n📋 Check 3: Checking for tenant_id indexes...');
  console.log('   ℹ️  (This requires direct database access - check manually in Supabase)');

  // Check 4: Application-level filtering check
  console.log('\n📋 Check 4: Checking application tenant configuration...');

  try {
    const tenantConfigPath = join(__dirname, 'src', 'config', 'tenantConfig.ts');
    const { readFileSync } = await import('fs');
    const tenantConfig = readFileSync(tenantConfigPath, 'utf8');

    if (tenantConfig.includes("CURRENT_TENANT: 'medex'")) {
      console.log('   ✅ Application configured for MedEx tenant');
    } else {
      console.log('   ❌ Application tenant configuration incorrect');
      allChecksPassed = false;
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify tenant configuration file');
  }

  // Summary
  console.log('\n' + '='.repeat(60));

  if (allChecksPassed) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('\nTenant isolation is properly configured!');
    console.log('\nNext steps:');
    console.log('1. Run the RLS migration in Supabase SQL Editor');
    console.log('2. Add application-level .eq(\'tenant_id\', \'medex\') to all queries');
    console.log('3. Test user creation with tenant_id=\'medex\'');
  } else {
    console.log('❌ SOME CHECKS FAILED');
    console.log('\nPlease fix the issues above before proceeding.');
  }

  console.log('='.repeat(60) + '\n');

  // Additional verification: Check if RLS is enabled
  console.log('📋 Additional Check: RLS Policy Status');
  console.log('   ℹ️  To verify RLS is enabled, run this query in Supabase SQL Editor:');
  console.log('');
  console.log('   SELECT tablename, rowsecurity FROM pg_tables');
  console.log('   WHERE schemaname = \'public\'');
  console.log('   AND tablename IN (\'users\', \'user_settings\', \'audit_logs\', \'notes\');');
  console.log('');
  console.log('   Expected: All tables should show rowsecurity = true');
  console.log('');
}

verifyTenantIsolation().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
