/**
 * Add MFA Columns to user_settings Table
 *
 * This script adds the missing MFA columns directly to the user_settings table.
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

console.log('🔧 Connecting to Supabase...')
console.log('URL:', SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function addMfaColumns() {
  console.log('\n🚀 Adding MFA columns to user_settings table...\n')

  try {
    // First, check current schema
    console.log('1️⃣ Checking current user_settings schema...')
    const { data: currentData, error: currentError } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1)

    if (currentError) {
      console.log('⚠️  Note:', currentError.message)
    }

    console.log('   Current columns:', currentData ? Object.keys(currentData[0] || {}).join(', ') : 'N/A')

    // The columns we need to add
    const migrations = [
      {
        name: 'fresh_mfa_secret',
        sql: `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_secret TEXT;`
      },
      {
        name: 'fresh_mfa_enabled',
        sql: `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_enabled BOOLEAN DEFAULT false;`
      },
      {
        name: 'fresh_mfa_setup_completed',
        sql: `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_setup_completed BOOLEAN DEFAULT false;`
      },
      {
        name: 'fresh_mfa_backup_codes',
        sql: `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_backup_codes TEXT;`
      }
    ]

    console.log('\n2️⃣ Executing SQL to add missing columns...')
    console.log('\n📝 SQL to execute:')
    migrations.forEach(m => console.log(`   ${m.sql}`))

    console.log('\n⚠️  IMPORTANT: These ALTER TABLE commands need to be run in Supabase SQL Editor')
    console.log('\n📌 INSTRUCTIONS:')
    console.log('   1. Go to: https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm/sql/new')
    console.log('   2. Copy and paste this SQL:\n')
    console.log('   ' + '─'.repeat(70))
    migrations.forEach(m => console.log('   ' + m.sql))
    console.log('   ' + '─'.repeat(70))
    console.log('\n   3. Click "Run" button')
    console.log('   4. Wait for success message\n')

    // Verify columns after manual migration
    console.log('3️⃣ After running the SQL above, verify with this query:')
    console.log('\n   SELECT column_name FROM information_schema.columns')
    console.log('   WHERE table_name = \'user_settings\' AND column_name LIKE \'fresh_mfa%\';')
    console.log('\n   You should see 4 rows returned.\n')

    console.log('✅ Script complete!')
    console.log('⏭️  Next: Run the SQL commands in Supabase Dashboard as shown above\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

addMfaColumns()
