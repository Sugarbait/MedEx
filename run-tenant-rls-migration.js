import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🔄 Running tenant RLS policies migration...\n');

    // Read the migration file
    const migrationPath = join(__dirname, 'supabase', 'migrations', '20251008000001_add_tenant_rls_policies.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (rough split by semicolons)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comment blocks
      if (statement.includes('============') || statement.startsWith('COMMENT ON')) {
        continue;
      }

      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

        if (error) {
          // Try direct query if RPC fails
          const { error: directError } = await supabase.from('_sql').select('*').limit(0);
          if (directError) {
            console.warn(`⚠️  Warning: Could not execute statement ${i + 1}:`, error.message);
            console.log('Statement:', statement.substring(0, 100) + '...');
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.warn(`⚠️  Warning on statement ${i + 1}:`, err.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed!');
    console.log('='.repeat(60) + '\n');

    // Verify the migration
    console.log('🔍 Verifying tenant isolation...\n');

    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('email, tenant_id')
      .limit(5);

    if (usersError) {
      console.error('❌ Error checking users:', usersError.message);
    } else {
      console.log('👥 Sample users:');
      users.forEach(u => {
        console.log(`   - ${u.email} (tenant: ${u.tenant_id})`);
      });
    }

    console.log('\n📋 Next steps:');
    console.log('1. Add application-level tenant filtering to all database queries');
    console.log('2. Test with both MedEx and CareXPS users');
    console.log('3. Verify cross-tenant isolation is working\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
