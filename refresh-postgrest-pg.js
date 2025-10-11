#!/usr/bin/env node

/**
 * PostgREST Schema Cache Refresh Script (Using pg package)
 *
 * This script forces PostgREST to reload its schema cache by sending NOTIFY pgrst.
 */

import pkg from 'pg';
const { Client } = pkg;
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

// Extract project reference from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

// Construct PostgreSQL connection string for Supavisor pooler
const connectionConfig = {
  host: `aws-0-us-east-1.pooler.supabase.com`,
  port: 6543,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password: SERVICE_ROLE_KEY,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000
};

console.log('\n🔄 PostgREST Schema Cache Refresh (Direct PostgreSQL)\n');
console.log('Project:', projectRef);
console.log('Connection: Supavisor Pooler (Transaction Mode)');

async function refreshSchemaCache() {
  const client = new Client(connectionConfig);

  try {
    console.log('\n📡 Step 1: Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully');

    console.log('\n📊 Step 2: Verifying tables exist...');
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'user_settings', 'audit_logs', 'user_credentials', 'notes', 'failed_login_attempts')
      ORDER BY table_name
    `);

    console.log(`✅ Found ${tableCheck.rows.length} tables:`);
    tableCheck.rows.forEach(row => console.log(`  - ${row.table_name}`));

    console.log('\n🔔 Step 3: Sending NOTIFY pgrst to reload schema...');

    // This is the official PostgREST schema reload command
    await client.query(`NOTIFY pgrst, 'reload schema'`);

    console.log('✅ NOTIFY sent successfully');

    console.log('\n⏳ Step 4: Waiting 5 seconds for PostgREST to reload...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🧪 Step 5: Testing REST API access...');

    // Test REST API access to each table
    const tablesToTest = tableCheck.rows.map(r => r.table_name);
    const testResults = [];

    for (const table of tablesToTest) {
      const url = `${SUPABASE_URL}/rest/v1/${table}?limit=1`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
          }
        });

        if (response.ok) {
          testResults.push({ table, status: '✅ OK', code: response.status });
        } else {
          const errorText = await response.text();
          testResults.push({
            table,
            status: '❌ Error',
            code: response.status,
            error: errorText.substring(0, 100)
          });
        }
      } catch (error) {
        testResults.push({
          table,
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
        console.log(`   ${result.error}`);
      }
    });
    console.log('─────────────────────────────────────────');

    const allAccessible = testResults.every(r => r.status === '✅ OK');

    if (allAccessible) {
      console.log('\n✅ SUCCESS: All tables are now accessible via REST API!');
      console.log('\n📝 Next Steps:');
      console.log('1. You can now create your first user');
      console.log('2. User registration should work correctly');
      console.log('3. All database operations should function normally');
    } else {
      console.log('\n⚠️ SCHEMA RELOAD SENT BUT TABLES STILL NOT ACCESSIBLE\n');
      console.log('This might indicate a PostgREST configuration issue.');
      console.log('\n🔧 Manual Steps Required:');
      console.log('');
      console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
      console.log('2. Select your project: onwgbfetzrctshdwwimm');
      console.log('3. Go to: Settings > API');
      console.log('4. Click: "Reload API Schema" button');
      console.log('5. Wait 10-15 seconds');
      console.log('6. Try user registration again');
      console.log('');
      console.log('Alternative Approach:');
      console.log('1. Go to Table Editor in Supabase Dashboard');
      console.log('2. Verify all 6 tables are visible');
      console.log('3. Click on each table to ensure they load');
      console.log('4. This forces PostgREST to recognize them');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.message.includes('authentication') || error.message.includes('password')) {
      console.log('\n🔑 Authentication Error:');
      console.log('The database password might be different from the SERVICE_ROLE_KEY.');
      console.log('');
      console.log('Solution:');
      console.log('1. Go to: https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm/settings/database');
      console.log('2. Reset database password');
      console.log('3. Note: This is different from the API keys');
    } else {
      console.log('\n🔧 Manual Refresh Required:');
      console.log('1. Go to: https://supabase.com/dashboard');
      console.log('2. Project: onwgbfetzrctshdwwimm');
      console.log('3. Settings > API > "Reload API Schema"');
    }
  } finally {
    await client.end();
  }
}

// Run the refresh
refreshSchemaCache().catch(console.error);
