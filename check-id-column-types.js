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

async function checkIdTypes() {
  console.log('🔍 Checking ID column data types...\n');

  // Check each table's ID columns
  const checks = [
    { table: 'users', columns: ['id'] },
    { table: 'user_settings', columns: ['id', 'user_id'] },
    { table: 'audit_logs', columns: ['id', 'user_id'] },
    { table: 'notes', columns: ['id', 'created_by'] }
  ];

  for (const check of checks) {
    console.log(`📋 ${check.table} table:`);

    const { data, error } = await supabase
      .from(check.table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      continue;
    }

    if (data && data.length > 0) {
      const row = data[0];
      for (const col of check.columns) {
        const value = row[col];
        const type = typeof value;
        console.log(`   ${col}: ${type} (value: ${value?.substring?.(0, 36) || value})`);
      }
    }

    console.log('');
  }

  // Now query information_schema for exact data types
  console.log('📊 Querying information_schema for exact data types...\n');

  const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'user_settings', 'audit_logs', 'notes')
      AND column_name IN ('id', 'user_id', 'created_by')
      ORDER BY table_name, column_name;
    `
  });

  if (schemaError) {
    console.log('⚠️ Could not query information_schema via RPC');
    console.log('Run this query manually in Supabase SQL Editor:\n');
    console.log(`SELECT table_name, column_name, data_type, udt_name`);
    console.log(`FROM information_schema.columns`);
    console.log(`WHERE table_schema = 'public'`);
    console.log(`AND table_name IN ('users', 'user_settings', 'audit_logs', 'notes')`);
    console.log(`AND column_name IN ('id', 'user_id', 'created_by')`);
    console.log(`ORDER BY table_name, column_name;\n`);
  } else {
    console.log('Schema info:', schemaData);
  }
}

checkIdTypes();
