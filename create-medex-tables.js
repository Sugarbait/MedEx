#!/usr/bin/env node

/**
 * MedEx Database Table Creation Script
 * Creates all required tables in the Supabase database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA';

async function executeSqlFile(sqlFilePath) {
  console.log('='.repeat(60));
  console.log('MEDEX DATABASE SETUP');
  console.log('='.repeat(60));
  console.log(`Database URL: ${SUPABASE_URL}`);
  console.log(`SQL File: ${sqlFilePath}`);
  console.log('='.repeat(60));
  console.log('');

  // Read SQL file
  console.log('📖 Reading SQL file...');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log(`   File size: ${sqlContent.length} bytes`);
  console.log('');

  // Execute SQL via Supabase SQL API
  console.log('🔄 Executing SQL statements...');
  console.log('');

  const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        query: sqlContent
      })
    });

    const data = await response.text();

    if (response.ok) {
      console.log('✅ SQL execution completed successfully!');
      console.log('');
      if (data) {
        console.log('Response:', data);
      }
      return true;
    } else {
      console.log('❌ SQL execution failed!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${data}`);
      console.log('');
      console.log('⚠️  The exec_sql function may not exist in Supabase.');
      console.log('');
      console.log('MANUAL EXECUTION REQUIRED:');
      console.log('');
      console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm');
      console.log('2. Click "SQL Editor" in the left sidebar');
      console.log('3. Click "New Query"');
      console.log('4. Copy the contents of: medex-setup-new-database.sql');
      console.log('5. Paste into the SQL editor');
      console.log('6. Click "Run" or press Ctrl+Enter');
      console.log('');
      return false;
    }
  } catch (error) {
    console.log('❌ Error executing SQL:');
    console.log(`   ${error.message}`);
    console.log('');
    console.log('MANUAL EXECUTION REQUIRED:');
    console.log('');
    console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm');
    console.log('2. Click "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Copy the contents of: medex-setup-new-database.sql');
    console.log('5. Paste into the SQL editor');
    console.log('6. Click "Run" or press Ctrl+Enter');
    console.log('');
    return false;
  }
}

// Run the script
const sqlFilePath = path.join(__dirname, 'medex-setup-new-database.sql');
executeSqlFile(sqlFilePath)
  .then(success => {
    if (success) {
      console.log('='.repeat(60));
      console.log('✅ DATABASE SETUP COMPLETE');
      console.log('='.repeat(60));
      console.log('');
      console.log('Next steps:');
      console.log('1. Run verify-supabase-database.js to confirm tables exist');
      console.log('2. Update .env.local with new database credentials:');
      console.log('   VITE_SUPABASE_URL=https://onwgbfetzrctshdwwimm.supabase.co');
      console.log('   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
      console.log('   VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
      console.log('');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
