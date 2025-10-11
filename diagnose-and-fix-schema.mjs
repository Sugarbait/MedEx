/**
 * Diagnose and Fix Failed Login Attempts Table Schema
 * This script will:
 * 1. Check the current schema of failed_login_attempts
 * 2. Check what columns the app is trying to insert
 * 3. Add any missing columns
 * 4. Test the fix with a sample insert
 */

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
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
  console.error('VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Found' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Expected columns based on application code (lines 389-397 in userManagementService.ts)
const EXPECTED_COLUMNS = {
  email: 'text',
  ip_address: 'text',
  user_agent: 'text',
  reason: 'text',
  attempted_at: 'timestamptz'
};

async function checkTableExists() {
  console.log('\n🔍 Step 1: Checking if failed_login_attempts table exists...\n');

  const { data, error } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .limit(1);

  if (error) {
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('❌ Table does not exist!');
      return false;
    }
    console.log('⚠️  Error checking table:', error.message);
    console.log('Full error:', JSON.stringify(error, null, 2));
    return null;
  }

  console.log('✅ Table exists');
  return true;
}

async function getCurrentSchema() {
  console.log('\n🔍 Step 2: Getting current table schema...\n');

  // Try to get first row and examine structure
  const { data: sampleData, error: sampleError } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.log('❌ Error:', sampleError.message);
    return null;
  }

  if (sampleData && sampleData.length > 0) {
    console.log('📊 Current columns (from sample data):');
    const columns = Object.keys(sampleData[0]);
    columns.forEach(col => console.log(`   - ${col}`));
    return columns;
  }

  console.log('ℹ️  Table exists but has no data yet - cannot determine schema from data');
  console.log('📊 Assuming table has no columns, will need to create/alter it');
  return [];
}

async function createTable() {
  console.log('\n🔨 Creating failed_login_attempts table...\n');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      reason TEXT,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create index on email for faster lookups
    CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email
    ON public.failed_login_attempts(email);

    -- Create index on attempted_at for time-based queries
    CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_attempted_at
    ON public.failed_login_attempts(attempted_at);

    -- Enable RLS
    ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow service role to insert failed attempts" ON public.failed_login_attempts;
    DROP POLICY IF EXISTS "Allow service role to read failed attempts" ON public.failed_login_attempts;
    DROP POLICY IF EXISTS "Allow service role to delete failed attempts" ON public.failed_login_attempts;
    DROP POLICY IF EXISTS "Allow authenticated to read own attempts" ON public.failed_login_attempts;

    -- Create policy to allow service role full access
    CREATE POLICY "Allow service role to insert failed attempts"
    ON public.failed_login_attempts
    FOR INSERT
    TO service_role
    WITH CHECK (true);

    CREATE POLICY "Allow service role to read failed attempts"
    ON public.failed_login_attempts
    FOR SELECT
    TO service_role
    USING (true);

    CREATE POLICY "Allow service role to delete failed attempts"
    ON public.failed_login_attempts
    FOR DELETE
    TO service_role
    USING (true);

    -- Allow authenticated users to read their own attempts
    CREATE POLICY "Allow authenticated to read own attempts"
    ON public.failed_login_attempts
    FOR SELECT
    TO authenticated
    USING (true);
  `;

  console.log('📋 SQL to create table:');
  console.log(createTableSQL);
  console.log('\n⚠️  Supabase JavaScript client cannot execute DDL statements.');
  console.log('📋 Please copy and run the SQL above in your Supabase SQL Editor.\n');
  console.log('OR run this command:');
  console.log(`curl -X POST "${supabaseUrl}/rest/v1/rpc/exec_sql" \\`);
  console.log(`  -H "apikey: ${supabaseServiceKey}" \\`);
  console.log(`  -H "Authorization: Bearer ${supabaseServiceKey}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"sql": ${JSON.stringify(createTableSQL)}}'`);

  return false; // Return false to indicate manual intervention needed
}

async function addMissingColumns(currentColumns) {
  console.log('\n🔨 Step 3: Checking for missing columns...\n');

  const missingColumns = [];

  for (const [colName, colType] of Object.entries(EXPECTED_COLUMNS)) {
    if (!currentColumns.includes(colName)) {
      missingColumns.push({ name: colName, type: colType });
    }
  }

  if (missingColumns.length === 0) {
    console.log('✅ All required columns exist');
    return true;
  }

  console.log('⚠️  Missing columns:', missingColumns.map(c => c.name).join(', '));
  console.log('\n📋 SQL to add missing columns:\n');

  const alterSQL = missingColumns.map(col => {
    const nullable = col.name === 'email' || col.name === 'attempted_at' ? 'NOT NULL' : '';
    const defaultVal = col.name === 'attempted_at' ? ' DEFAULT NOW()' : '';
    return `ALTER TABLE public.failed_login_attempts ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${nullable}${defaultVal};`;
  }).join('\n');

  console.log(alterSQL);
  console.log('\n⚠️  Please run this SQL in your Supabase SQL Editor.\n');

  return false;
}

async function testInsert() {
  console.log('\n🧪 Step 4: Testing insert with sample data...\n');

  const testData = {
    email: 'test@example.com',
    ip_address: 'localhost',
    user_agent: 'test-user-agent',
    reason: 'Test insert',
    attempted_at: new Date().toISOString()
  };

  console.log('Inserting test record:', testData);

  const { data, error } = await supabase
    .from('failed_login_attempts')
    .insert(testData)
    .select();

  if (error) {
    console.log('❌ Insert failed:', error.message);
    console.log('Error details:', JSON.stringify(error, null, 2));
    return false;
  }

  console.log('✅ Insert successful!');
  console.log('Inserted record:', data);

  // Clean up test data
  if (data && data[0]) {
    await supabase
      .from('failed_login_attempts')
      .delete()
      .eq('id', data[0].id);
    console.log('🧹 Cleaned up test record');
  }

  return true;
}

async function checkUsersTable() {
  console.log('\n🔍 Bonus: Checking users table accessibility...\n');

  // Test with service role key
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, tenant_id')
    .eq('tenant_id', 'medex')
    .limit(5);

  if (error) {
    console.log('❌ Users table error (service role):', error.message);
    console.log('Error details:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Users table accessible with service role');
    console.log('User count (tenant_id=medex):', data?.length || 0);
    if (data && data.length > 0) {
      console.log('Sample users:');
      data.forEach(user => {
        console.log(`   - ${user.email} (${user.role})`);
      });
    }
  }

  // Test with anon key
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (anonKey) {
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: anonData, error: anonError } = await anonClient
      .from('users')
      .select('id, email')
      .eq('tenant_id', 'medex')
      .limit(1);

    if (anonError) {
      console.log('⚠️  Users table error (anon key):', anonError.message);
      console.log('   This is expected if RLS is enabled');
    } else {
      console.log('✅ Users table accessible with anon key');
    }
  }
}

async function main() {
  console.log('🚀 Supabase Failed Login Attempts Table Diagnostic Tool');
  console.log('================================================\n');
  console.log('Database:', supabaseUrl);
  console.log('Using: Service Role Key\n');

  // Step 1: Check if table exists
  const tableExists = await checkTableExists();

  if (tableExists === false) {
    // Table doesn't exist, show SQL to create it
    await createTable();
    console.log('\n❌ Table needs to be created manually. Exiting.');
    process.exit(1);
  } else if (tableExists === null) {
    // Error checking table
    console.log('\n❌ Could not determine if table exists. Exiting.');
    process.exit(1);
  }

  // Step 2: Get current schema
  const currentColumns = await getCurrentSchema();

  if (currentColumns === null) {
    console.log('\n❌ Could not get table schema. Exiting.');
    process.exit(1);
  }

  // Step 3: Add missing columns if needed
  if (currentColumns.length > 0) {
    const columnsAdded = await addMissingColumns(currentColumns);
    if (!columnsAdded) {
      console.log('\n⚠️  Columns need to be added manually.');
      process.exit(1);
    }
  } else {
    console.log('\n⚠️  Table exists but schema unknown (no data). Cannot auto-fix.');
    console.log('Please run the CREATE TABLE SQL shown above.');
    process.exit(1);
  }

  // Step 4: Test insert
  const testPassed = await testInsert();

  // Bonus: Check users table
  await checkUsersTable();

  console.log('\n' + '='.repeat(50));
  if (testPassed) {
    console.log('✅ DIAGNOSIS COMPLETE - All checks passed!');
    console.log('The failed_login_attempts table is now ready to use.');
  } else {
    console.log('⚠️  DIAGNOSIS COMPLETE - Some issues remain');
    console.log('Please review the errors above and fix manually.');
  }
  console.log('='.repeat(50) + '\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
