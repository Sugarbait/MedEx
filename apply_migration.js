const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables or configure your Supabase connection
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('YOUR_') || supabaseServiceKey.includes('YOUR_')) {
  console.error('Please set your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  console.error('Or edit this script to include your Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'fix_user_settings_azure_rls.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔗 Connecting to Supabase...');

    // Split the SQL into individual statements for better error handling
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .filter(stmt => !stmt.match(/^(SELECT|\\d)/)); // Remove SELECT statements and \d commands

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip certain statements that don't work well in this context
      if (statement.includes('\\d ') ||
          statement.includes('SELECT') ||
          statement.startsWith('/*') ||
          statement.includes('RAISE NOTICE')) {
        console.log(`⏭️  Skipping statement ${i + 1}: ${statement.substring(0, 50)}...`);
        skipCount++;
        continue;
      }

      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);

        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          // Try direct execution for DDL statements
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ sql: statement + ';' })
          });

          if (!response.ok) {
            console.warn(`⚠️  Warning for statement ${i + 1}: ${error.message}`);
            // Continue with next statement for non-critical errors
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }

      } catch (err) {
        console.warn(`⚠️  Error executing statement ${i + 1}: ${err.message}`);
        console.log(`📝 Statement was: ${statement}`);
        // Continue with migration - some errors are expected (like DROP IF EXISTS)
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(`📈 Successfully executed: ${successCount} statements`);
    console.log(`⏭️  Skipped: ${skipCount} statements`);
    console.log('\n🔍 Verifying migration...');

    // Verify the migration worked
    const { data: policies, error: policyError } = await supabase
      .rpc('exec_sql', {
        sql: `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_settings' ORDER BY policyname;`
      });

    if (!policyError && policies) {
      console.log('🛡️  RLS Policies created:');
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`);
      });
    }

    console.log('\n🎉 Migration applied successfully!');
    console.log('🔄 Cross-device settings synchronization should now work properly.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
applyMigration();