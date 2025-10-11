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

async function checkSchemas() {
  console.log('🔍 Checking table schemas...\n');

  const tables = ['users', 'user_settings', 'audit_logs', 'notes'];

  for (const table of tables) {
    console.log(`📋 ${table} table:`);

    try {
      // Try to select all columns to see what's there
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        continue;
      }

      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log(`   Columns: ${columns.join(', ')}`);

        // Check for user_id vs id
        if (columns.includes('user_id')) {
          console.log(`   ✅ Has user_id column`);
        } else if (columns.includes('id')) {
          console.log(`   ⚠️  Has id column (not user_id)`);
        }

        // Check for tenant_id
        if (columns.includes('tenant_id')) {
          console.log(`   ✅ Has tenant_id column`);
        } else {
          console.log(`   ❌ Missing tenant_id column`);
        }
      } else {
        console.log(`   ⚠️  Table is empty, trying to infer schema...`);

        // Try inserting and rolling back to see columns
        const { error: schemaError } = await supabase
          .from(table)
          .select('id, user_id, tenant_id')
          .limit(0);

        if (schemaError) {
          console.log(`   Schema check error: ${schemaError.message}`);
        }
      }

      console.log('');
    } catch (err) {
      console.log(`   ❌ Error checking ${table}: ${err.message}\n`);
    }
  }
}

checkSchemas();
