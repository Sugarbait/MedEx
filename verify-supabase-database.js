#!/usr/bin/env node

/**
 * Supabase Database Verification Script
 * Checks if tables exist and are accessible via REST API
 */

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA';

const REQUIRED_TABLES = [
  'users',
  'user_settings',
  'audit_logs',
  'user_credentials',
  'notes',
  'failed_login_attempts'
];

async function checkTable(tableName) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Table '${tableName}' - EXISTS and ACCESSIBLE`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Row count check: ${Array.isArray(data) ? 'Valid response' : 'Invalid response'}`);
      return { table: tableName, exists: true, error: null };
    } else {
      console.log(`❌ Table '${tableName}' - ERROR`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${JSON.stringify(data, null, 2)}`);
      return { table: tableName, exists: false, error: data };
    }
  } catch (error) {
    console.log(`❌ Table '${tableName}' - FETCH FAILED`);
    console.log(`   Error: ${error.message}`);
    return { table: tableName, exists: false, error: error.message };
  }
}

async function checkAllTables() {
  console.log('='.repeat(60));
  console.log('SUPABASE DATABASE VERIFICATION');
  console.log('='.repeat(60));
  console.log(`Database URL: ${SUPABASE_URL}`);
  console.log(`Service Key: ${SERVICE_KEY.substring(0, 20)}...`);
  console.log('='.repeat(60));
  console.log('');

  const results = [];

  for (const table of REQUIRED_TABLES) {
    const result = await checkTable(table);
    results.push(result);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const existingTables = results.filter(r => r.exists);
  const missingTables = results.filter(r => !r.exists);

  console.log(`Total tables checked: ${REQUIRED_TABLES.length}`);
  console.log(`✅ Existing tables: ${existingTables.length}`);
  console.log(`❌ Missing tables: ${missingTables.length}`);

  if (missingTables.length > 0) {
    console.log('');
    console.log('Missing tables:');
    missingTables.forEach(r => {
      console.log(`  - ${r.table}`);
    });
  }

  console.log('');
  console.log('='.repeat(60));

  if (missingTables.length > 0) {
    console.log('⚠️  ACTION REQUIRED:');
    console.log('');
    console.log('Tables are missing from the database. To fix this:');
    console.log('');
    console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project: onwgbfetzrctshdwwimm');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy the contents of: medex-setup-new-database.sql');
    console.log('5. Paste into SQL Editor and click "Run"');
    console.log('');
    console.log('Or run this command to see the SQL:');
    console.log('  cat "I:\\Apps Back Up\\Main MedEX CRM\\medex-setup-new-database.sql"');
    console.log('='.repeat(60));
  } else {
    console.log('✅ All tables exist and are accessible!');
    console.log('='.repeat(60));
  }
}

// Run the verification
checkAllTables().catch(console.error);
