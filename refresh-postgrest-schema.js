#!/usr/bin/env node

/**
 * PostgREST Schema Cache Refresh Script
 *
 * This script forces PostgREST to reload its schema cache after creating new tables.
 *
 * The issue: When tables are created directly via SQL, PostgREST doesn't automatically
 * detect them because it caches the schema. This causes PGRST205 errors.
 *
 * The solution: Send NOTIFY pgrst to PostgreSQL, which triggers PostgREST to reload.
 */

import postgres from 'postgres';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Extract project reference from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

// Construct direct PostgreSQL connection string
const connectionString = `postgresql://postgres.${projectRef}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

console.log('\n🔄 PostgREST Schema Cache Refresh\n');
console.log('Project:', projectRef);
console.log('Connection: Direct PostgreSQL via Supavisor');

async function refreshSchemaCache() {
  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10
  });

  try {
    console.log('\n📡 Step 1: Sending NOTIFY pgrst to PostgreSQL...');

    // This is the official way to reload PostgREST schema cache
    await sql`NOTIFY pgrst, 'reload schema'`;

    console.log('✅ NOTIFY sent successfully');

    console.log('\n📊 Step 2: Verifying table accessibility...');

    // Check if tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'user_settings', 'audit_logs', 'user_credentials', 'notes', 'failed_login_attempts')
      ORDER BY table_name
    `;

    console.log('✅ Found', tables.length, 'tables in database:');
    tables.forEach(t => console.log('  -', t.table_name));

    console.log('\n⏳ Step 3: Waiting 3 seconds for PostgREST to reload...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🧪 Step 4: Testing REST API access...');

    // Test REST API access to each table
    const testResults = [];

    for (const table of tables) {
      const tableName = table.table_name;
      const url = `${SUPABASE_URL}/rest/v1/${tableName}?limit=1`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': process.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
          }
        });

        if (response.ok) {
          testResults.push({ table: tableName, status: '✅ Accessible', code: response.status });
        } else {
          const errorText = await response.text();
          testResults.push({
            table: tableName,
            status: '❌ Error',
            code: response.status,
            error: errorText.substring(0, 100)
          });
        }
      } catch (error) {
        testResults.push({
          table: tableName,
          status: '❌ Failed',
          error: error.message
        });
      }
    }

    console.log('\nREST API Test Results:');
    console.log('─────────────────────────────────────────');
    testResults.forEach(result => {
      console.log(`${result.status} ${result.table} (${result.code || 'N/A'})`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    console.log('─────────────────────────────────────────');

    const allAccessible = testResults.every(r => r.status.includes('✅'));

    if (allAccessible) {
      console.log('\n✅ SUCCESS: All tables are now accessible via REST API!');
      console.log('\n📝 Next Steps:');
      console.log('1. You can now create your first user');
      console.log('2. User registration should work correctly');
      console.log('3. All database operations should function normally');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: Some tables still have issues');
      console.log('\n🔧 Additional Steps Required:');
      console.log('1. Check Supabase Dashboard > Table Editor');
      console.log('2. Verify RLS policies are properly configured');
      console.log('3. Check that schema is set to "public"');
      console.log('4. Try manual schema reload in Supabase Dashboard');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.message.includes('authentication')) {
      console.log('\n🔑 Authentication Error - Possible Solutions:');
      console.log('1. Verify SERVICE_ROLE_KEY is correct in .env.local');
      console.log('2. Check if database password has changed');
      console.log('3. Ensure Supavisor pooler is enabled in Supabase');
    } else if (error.message.includes('timeout')) {
      console.log('\n⏱️ Timeout Error - Possible Solutions:');
      console.log('1. Check internet connection');
      console.log('2. Verify Supabase project is active');
      console.log('3. Try again in a few moments');
    } else {
      console.log('\n🔧 Troubleshooting Steps:');
      console.log('1. Go to Supabase Dashboard > Settings > API');
      console.log('2. Click "Reload Schema" button');
      console.log('3. Wait 10 seconds and try user creation again');
    }
  } finally {
    await sql.end();
  }
}

// Run the refresh
refreshSchemaCache().catch(console.error);
