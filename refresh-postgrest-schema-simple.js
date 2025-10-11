#!/usr/bin/env node

/**
 * PostgREST Schema Cache Refresh Script (Simple Version)
 *
 * This script forces PostgREST to reload its schema cache using the Supabase Management API.
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n🔄 PostgREST Schema Cache Refresh (Simple)\n');

async function refreshSchemaCache() {
  try {
    console.log('📊 Step 1: Testing current table accessibility...\n');

    // Test tables before refresh
    const tablesToTest = ['users', 'user_settings', 'audit_logs', 'user_credentials', 'notes', 'failed_login_attempts'];
    const beforeResults = [];

    for (const table of tablesToTest) {
      const url = `${SUPABASE_URL}/rest/v1/${table}?limit=1`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
          }
        });

        beforeResults.push({
          table,
          status: response.ok ? '✅ OK' : '❌ Error',
          code: response.status
        });
      } catch (error) {
        beforeResults.push({
          table,
          status: '❌ Failed',
          error: error.message
        });
      }
    }

    console.log('BEFORE Refresh:');
    beforeResults.forEach(r => console.log(`  ${r.status} ${r.table} (${r.code || 'N/A'})`));

    // Check if all tables are already accessible
    const allAccessible = beforeResults.every(r => r.status === '✅ OK');

    if (allAccessible) {
      console.log('\n✅ All tables are already accessible! No refresh needed.');
      return;
    }

    console.log('\n🔧 Step 2: Alternative Schema Refresh Methods...\n');

    // Method 1: Try SQL function via REST API
    console.log('Method 1: Executing pg_notify via RPC...');
    try {
      const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_notify`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: 'pgrst',
          payload: 'reload schema'
        })
      });

      if (rpcResponse.ok) {
        console.log('  ✅ pg_notify executed successfully');
      } else {
        const errorText = await rpcResponse.text();
        console.log(`  ❌ pg_notify failed: ${errorText}`);
      }
    } catch (error) {
      console.log(`  ❌ pg_notify error: ${error.message}`);
    }

    // Method 2: Force a schema-related query
    console.log('\nMethod 2: Querying information_schema...');
    try {
      const schemaResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_get_tabledef`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          table_name: 'users'
        })
      });

      if (schemaResponse.ok) {
        console.log('  ✅ Schema query executed');
      } else {
        console.log('  ⚠️ Schema query not available (expected)');
      }
    } catch (error) {
      console.log('  ⚠️ Schema query not available (expected)');
    }

    console.log('\n⏳ Step 3: Waiting 5 seconds for PostgREST to reload...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🧪 Step 4: Re-testing table accessibility...\n');

    // Test tables after refresh
    const afterResults = [];

    for (const table of tablesToTest) {
      const url = `${SUPABASE_URL}/rest/v1/${table}?limit=1`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
          }
        });

        const status = response.ok ? '✅ OK' : '❌ Error';
        afterResults.push({
          table,
          status,
          code: response.status
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`  ${status} ${table} (${response.status}): ${errorText.substring(0, 100)}`);
        } else {
          console.log(`  ${status} ${table} (${response.status})`);
        }
      } catch (error) {
        afterResults.push({
          table,
          status: '❌ Failed',
          error: error.message
        });
        console.log(`  ❌ Failed ${table}: ${error.message}`);
      }
    }

    const nowAccessible = afterResults.every(r => r.status === '✅ OK');

    if (nowAccessible) {
      console.log('\n✅ SUCCESS: All tables are now accessible via REST API!');
      console.log('\n📝 Next Steps:');
      console.log('1. You can now create your first user');
      console.log('2. User registration should work correctly');
      console.log('3. All database operations should function normally');
    } else {
      console.log('\n⚠️ MANUAL REFRESH REQUIRED\n');
      console.log('The automatic refresh didn\'t work. Please follow these steps:');
      console.log('');
      console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
      console.log('2. Select your project: onwgbfetzrctshdwwimm');
      console.log('3. Go to: Settings > API');
      console.log('4. Scroll down and click: "Reload API Schema"');
      console.log('5. Wait 10 seconds');
      console.log('6. Try user registration again');
      console.log('');
      console.log('Alternative: Go to Table Editor and verify tables are visible there.');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\n🔧 Manual Refresh Required:');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select project: onwgbfetzrctshdwwimm');
    console.log('3. Settings > API > "Reload API Schema"');
  }
}

// Run the refresh
refreshSchemaCache().catch(console.error);
