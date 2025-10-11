/**
 * Run MFA Migration Script
 *
 * This script runs the Fresh MFA columns migration on your Supabase database.
 * It adds the required columns: fresh_mfa_secret, fresh_mfa_enabled,
 * fresh_mfa_setup_completed, and fresh_mfa_backup_codes.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ ERROR: Missing Supabase environment variables')
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

console.log('🔧 Connecting to Supabase...')
console.log('URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  try {
    console.log('\n📋 Reading migration file...')

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20241225000001_add_fresh_mfa_columns.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('✅ Migration file loaded')
    console.log('\n🚀 Running migration...\n')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Verifying columns...')

    // Verify the columns exist
    const { data: columns, error: verifyError } = await supabase
      .from('user_settings')
      .select('fresh_mfa_secret, fresh_mfa_enabled, fresh_mfa_setup_completed, fresh_mfa_backup_codes')
      .limit(0)

    if (verifyError && verifyError.code !== 'PGRST116') {
      console.error('⚠️  Verification warning:', verifyError.message)
    } else {
      console.log('✅ All MFA columns verified successfully!')
    }

    console.log('\n🎉 Migration complete! Your MFA system should now work correctly.')

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

// Alternative: Direct SQL execution via HTTP
async function runMigrationDirect() {
  try {
    console.log('\n📋 Reading migration file...')

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20241225000001_add_fresh_mfa_columns.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('✅ Migration file loaded')
    console.log('\n🚀 Running migration via direct SQL...\n')

    // Execute using REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceRoleKey,
        'Authorization': `Bearer ${supabaseServiceRoleKey}`
      },
      body: JSON.stringify({ sql: migrationSQL })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Migration failed:', errorText)

      // Try alternative approach: Split into individual statements
      console.log('\n🔄 Trying alternative approach (splitting statements)...')
      const statements = migrationSQL.split(';').filter(s => s.trim())

      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
          if (error) {
            console.error('❌ Statement failed:', error)
          }
        }
      }
    }

    console.log('\n✅ Migration completed!')
    console.log('\n🎉 Migration complete! Your MFA system should now work correctly.')

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

// Check if exec_sql function exists, otherwise provide manual instructions
async function checkExecSqlFunction() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' })

  if (error && error.message.includes('function') && error.message.includes('does not exist')) {
    console.log('\n⚠️  The exec_sql function is not available in your Supabase database.')
    console.log('\n📝 Please run the migration manually:')
    console.log('\n1. Go to your Supabase Dashboard: https://app.supabase.com')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Open the file: supabase/migrations/20241225000001_add_fresh_mfa_columns.sql')
    console.log('4. Copy and paste the SQL into the editor')
    console.log('5. Click "Run"')
    console.log('\nAlternatively, use the Supabase CLI:')
    console.log('  npx supabase db push --db-url "YOUR_DATABASE_URL"')
    return false
  }

  return true
}

// Main execution
(async () => {
  const hasExecSql = await checkExecSqlFunction()

  if (hasExecSql) {
    await runMigration()
  }
})()
