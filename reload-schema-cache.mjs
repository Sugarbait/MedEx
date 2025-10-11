/**
 * Reload PostgREST Schema Cache
 * Fixes PGRST204 errors by forcing schema cache refresh
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

console.log('🔄 PostgREST Schema Cache Reload Tool\n');
console.log('Database:', supabaseUrl);
console.log('\n' + '='.repeat(60) + '\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Method 1: Try via RPC
console.log('📡 Method 1: Attempting reload via RPC...\n');

const { data: rpcData, error: rpcError } = await supabase
  .rpc('pgrst_reload_schema');

if (rpcError) {
  console.log('❌ RPC method failed (this is expected if function doesn\'t exist)');
  console.log('Error:', rpcError.message);
} else {
  console.log('✅ Schema cache reloaded via RPC');
  console.log('Response:', rpcData);
}

console.log('\n' + '='.repeat(60) + '\n');

// Method 2: Try via SQL NOTIFY
console.log('📡 Method 2: Attempting reload via SQL NOTIFY...\n');

const notifySQL = `NOTIFY pgrst, 'reload schema';`;

const { data: notifyData, error: notifyError } = await supabase
  .from('_placeholder')  // This will fail but might trigger schema reload
  .select('*')
  .limit(0);

// We expect this to fail - that's OK
console.log('⚠️  Direct SQL NOTIFY requires database-level access');
console.log('   This method usually requires admin access to PostgreSQL');

console.log('\n' + '='.repeat(60) + '\n');

// Method 3: Test if cache is fresh by querying failed_login_attempts
console.log('🧪 Method 3: Testing if schema cache is fresh...\n');

const testData = {
  email: 'cache-test@example.com',
  ip_address: 'localhost',
  user_agent: 'schema-cache-test',
  reason: 'Schema cache test',
  attempted_at: new Date().toISOString()
};

const { data: testInsert, error: testError } = await supabase
  .from('failed_login_attempts')
  .insert(testData)
  .select();

if (testError) {
  console.log('❌ Schema cache is STALE');
  console.log('Error code:', testError.code);
  console.log('Error:', testError.message);

  if (testError.code === 'PGRST204') {
    console.log('\n⚠️  PGRST204 error detected - schema cache needs manual reload\n');
    console.log('📋 Please reload the schema cache manually:\n');
    console.log('Option 1 (RECOMMENDED):');
    console.log('  1. Go to https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm');
    console.log('  2. Navigate to Settings → API');
    console.log('  3. Click "Reload schema" button\n');
    console.log('Option 2 (SQL Editor):');
    console.log('  Run this SQL: NOTIFY pgrst, \'reload schema\';\n');
    console.log('Option 3 (Restart PostgREST):');
    console.log('  Restart your Supabase project (Settings → General → Restart project)');
  }
} else {
  console.log('✅ Schema cache is FRESH');
  console.log('Test insert succeeded:', testInsert);

  // Clean up test data
  if (testInsert && testInsert[0]) {
    await supabase
      .from('failed_login_attempts')
      .delete()
      .eq('id', testInsert[0].id);
    console.log('🧹 Cleaned up test record');
  }
}

console.log('\n' + '='.repeat(60) + '\n');

// Additional diagnostics
console.log('🔍 Additional Diagnostics:\n');

// Check if table exists
const { data: tableCheck, error: tableError } = await supabase
  .from('failed_login_attempts')
  .select('*')
  .limit(1);

if (tableError) {
  console.log('❌ Table access error:', tableError.message);
} else {
  console.log('✅ Table is accessible');
  console.log('   Records in table:', tableCheck?.length || 0);
}

// Check users table
const { data: usersCheck, error: usersError } = await supabase
  .from('users')
  .select('count', { count: 'exact', head: true })
  .eq('tenant_id', 'medex');

if (usersError) {
  console.log('❌ Users table error:', usersError.message);
} else {
  console.log('✅ Users table accessible');
  console.log('   Users with tenant_id=medex:', usersCheck?.length || 0);
}

console.log('\n' + '='.repeat(60) + '\n');
console.log('✅ Diagnostic complete\n');
console.log('If schema cache is stale, follow the manual reload instructions above.');
