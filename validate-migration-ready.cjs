const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function validateMigrationReady() {
  console.log('========================================');
  console.log('MIGRATION READINESS CHECK');
  console.log('========================================\n');

  let allChecks = true;

  // Check 1: Verify migration SQL file exists
  console.log('✓ Check 1: Migration SQL file exists');
  if (fs.existsSync('EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql')) {
    const content = fs.readFileSync('EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql', 'utf8');
    console.log(`  File size: ${content.length} bytes`);
    console.log(`  Contains "user_id TEXT": ${content.includes('user_id TEXT') ? '✅ YES' : '❌ NO'}`);
    if (!content.includes('user_id TEXT')) {
      console.log('  ⚠️  WARNING: Migration may still use UUID type!');
      allChecks = false;
    }
  } else {
    console.log('  ❌ Migration file not found!');
    allChecks = false;
  }

  // Check 2: Verify users table structure
  console.log('\n✓ Check 2: Verify users.id column type');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (!userError && userData && userData.length > 0) {
    const sampleId = userData[0].id;
    console.log(`  Sample ID: ${sampleId}`);
    console.log(`  Type: ${typeof sampleId}`);

    // Check if it's a UUID string
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sampleId);
    console.log(`  Format: ${isUUID ? 'UUID string (stored as TEXT)' : 'Non-UUID text'}`);

    if (!isUUID) {
      console.log('  ⚠️  WARNING: users.id is not in UUID format!');
      allChecks = false;
    }
  } else {
    console.log('  ❌ Could not query users table');
    console.log(`  Error: ${userError?.message}`);
    allChecks = false;
  }

  // Check 3: Verify no conflicting tables exist
  console.log('\n✓ Check 3: Check for conflicting tables');
  const tablesToCheck = ['user_profiles', 'user_credentials', 'failed_login_attempts'];

  for (const tableName of tablesToCheck) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    if (!error) {
      console.log(`  ⚠️  ${tableName} already exists (will be dropped by migration)`);
    } else if (error.message.includes('does not exist')) {
      console.log(`  ✅ ${tableName} does not exist (ready to create)`);
    } else {
      console.log(`  ❓ ${tableName} status unknown: ${error.message}`);
    }
  }

  // Check 4: Verify Supabase connection
  console.log('\n✓ Check 4: Supabase connection');
  const { data: healthCheck, error: healthError } = await supabase
    .from('users')
    .select('count')
    .limit(1);

  if (!healthError) {
    console.log('  ✅ Connection successful');
  } else {
    console.log('  ❌ Connection failed');
    console.log(`  Error: ${healthError.message}`);
    allChecks = false;
  }

  // Check 5: Verify tenant_id exists in users table
  console.log('\n✓ Check 5: Verify tenant_id column exists');
  const { data: tenantCheck, error: tenantError } = await supabase
    .from('users')
    .select('tenant_id')
    .limit(1);

  if (!tenantError) {
    console.log('  ✅ tenant_id column exists');
  } else {
    console.log('  ⚠️  tenant_id column may not exist');
    console.log(`  Error: ${tenantError.message}`);
  }

  // Final summary
  console.log('\n========================================');
  console.log('MIGRATION READINESS SUMMARY');
  console.log('========================================\n');

  if (allChecks) {
    console.log('✅ ALL CHECKS PASSED - Ready to execute migration!\n');
    console.log('Next steps:');
    console.log('1. Open Supabase SQL Editor');
    console.log('2. Copy contents of EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql');
    console.log('3. Paste and click Run');
    console.log('4. Verify success messages\n');
  } else {
    console.log('❌ SOME CHECKS FAILED - Review issues above before migration\n');
  }

  console.log('========================================\n');
}

validateMigrationReady()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Validation error:', err);
    process.exit(1);
  });
