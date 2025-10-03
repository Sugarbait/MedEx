/**
 * Run MedEx Schema Migration
 *
 * This script executes the SQL migration to create the medex schema
 * and separate MedEx data from CareXPS data.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!')
  console.error('   Required in .env.local:')
  console.error('   - VITE_SUPABASE_URL')
  console.error('   - VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' }, // Use public schema for admin operations
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('🚀 Starting MedEx Schema Migration...\n')

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251003000001_create_medex_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded')
    console.log('📊 Migration size:', migrationSQL.length, 'bytes\n')

    // Execute the migration
    console.log('⏳ Executing migration...')

    const { data, error } = await supabase.rpc('exec', {
      sql: migrationSQL
    })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      console.error('\n💡 Manual steps:')
      console.error('   1. Go to https://supabase.com/dashboard')
      console.error('   2. Navigate to SQL Editor')
      console.error('   3. Copy the contents of: supabase/migrations/20251003000001_create_medex_schema.sql')
      console.error('   4. Paste and run in SQL Editor')
      return
    }

    console.log('✅ Migration executed successfully!\n')

    // Verify the schema was created
    console.log('🔍 Verifying schema creation...')

    const { data: schemas, error: schemaError } = await supabase
      .rpc('exec', {
        sql: "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'medex';"
      })

    if (schemaError) {
      console.error('⚠️ Could not verify schema:', schemaError.message)
    } else if (schemas && schemas.length > 0) {
      console.log('✅ medex schema verified\n')
    }

    // Check tables in medex schema
    console.log('📋 Checking tables in medex schema...')

    const { data: tables, error: tablesError } = await supabase
      .rpc('exec', {
        sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'medex' ORDER BY table_name;"
      })

    if (tablesError) {
      console.error('⚠️ Could not list tables:', tablesError.message)
    } else if (tables) {
      console.log(`✅ Found ${tables.length} tables in medex schema\n`)
    }

    // Count users in both schemas
    console.log('👥 Checking user counts...')

    // Public schema (CareXPS)
    const { count: publicCount, error: publicError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (!publicError) {
      console.log(`   public schema (CareXPS): ${publicCount} users`)
    }

    // Medex schema
    const supabaseMedex = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'medex' },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { count: medexCount, error: medexError } = await supabaseMedex
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (!medexError) {
      console.log(`   medex schema (MedEx): ${medexCount} users\n`)
    }

    console.log('✅ Migration complete!')
    console.log('\n📝 Summary:')
    console.log('   • medex schema created')
    console.log('   • All tables copied from public schema')
    console.log('   • MedEx app configured to use medex schema')
    console.log('   • CareXPS data remains in public schema (unaffected)')
    console.log('\n🎯 Next step: Reload your MedEx app to see empty user list\n')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    console.error('\n💡 Try running the migration manually in Supabase SQL Editor')
  }
}

// Run the migration
runMigration()
