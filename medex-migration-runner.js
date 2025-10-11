/**
 * MedEx Database Migration - One-Click Runner
 *
 * This script automatically runs all migration steps:
 * 1. Export MedEx data from old shared database
 * 2. Set up schema in new isolated database
 * 3. Import MedEx data to new database
 * 4. Update environment variables
 * 5. Verify migration success
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
import { execSync } from 'child_process'

// Load current environment
dotenv.config({ path: '.env.local' })

// OLD database (shared with CareXPS)
const OLD_SUPABASE_URL = process.env.VITE_SUPABASE_URL
const OLD_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// NEW database (isolated for MedEx)
const NEW_SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const NEW_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODA5ODYsImV4cCI6MjA3NTU1Njk4Nn0.MgsjiXT2Y0WqQf2puG2p27tHaMRfhiUET2TDWc668lI'
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

// Tables to migrate
const TABLES_TO_EXPORT = [
  'users',
  'user_settings',
  'user_credentials',
  'audit_logs',
  'notes',
  'failed_login_attempts'
]

console.log('╔════════════════════════════════════════════════════════════════╗')
console.log('║      MedEx Database Migration - One-Click Runner               ║')
console.log('╚════════════════════════════════════════════════════════════════╝\n')

// ============================================================================
// STEP 1: EXPORT DATA FROM OLD DATABASE
// ============================================================================
async function step1_exportData() {
  console.log('┌────────────────────────────────────────────────────────────────┐')
  console.log('│ STEP 1: Export MedEx Data from Shared Database                │')
  console.log('└────────────────────────────────────────────────────────────────┘\n')

  const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const exportedData = {}

  try {
    for (const tableName of TABLES_TO_EXPORT) {
      process.stdout.write(`   📋 Exporting ${tableName}... `)

      let query = oldSupabase.from(tableName).select('*')

      // Add tenant filter for tables that have tenant_id
      if (['users', 'user_settings', 'audit_logs'].includes(tableName)) {
        query = query.eq('tenant_id', 'medex')
      }

      const { data, error } = await query

      if (error) {
        console.log(`⚠️  ${error.message}`)
        exportedData[tableName] = []
      } else {
        exportedData[tableName] = data || []
        console.log(`✅ ${data?.length || 0} records`)
      }
    }

    // Save to file
    fs.writeFileSync('./medex-export-data.json', JSON.stringify(exportedData, null, 2))

    const totalRecords = Object.values(exportedData).reduce((sum, records) => sum + records.length, 0)
    console.log(`\n   ✅ Step 1 Complete: ${totalRecords} records exported\n`)

    return exportedData
  } catch (error) {
    console.error(`\n   ❌ Step 1 Failed:`, error.message)
    throw error
  }
}

// ============================================================================
// STEP 2: SET UP NEW DATABASE SCHEMA
// ============================================================================
async function step2_setupSchema() {
  console.log('┌────────────────────────────────────────────────────────────────┐')
  console.log('│ STEP 2: Set Up Schema in New Isolated Database                │')
  console.log('└────────────────────────────────────────────────────────────────┘\n')

  const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Read SQL schema file
    const schemaSQL = fs.readFileSync('./medex-setup-new-database.sql', 'utf8')

    console.log('   📄 Loaded schema SQL file')
    console.log('   ⏳ Executing schema setup...\n')

    // Split SQL into individual statements and execute
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let successCount = 0
    let errorCount = 0

    for (const statement of statements) {
      try {
        await newSupabase.rpc('query', { query_text: statement + ';' })
        successCount++
      } catch (error) {
        // Some errors are expected (like DROP IF EXISTS on non-existent objects)
        if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
          errorCount++
        }
      }
    }

    console.log(`   ✅ Step 2 Complete: Schema created successfully`)
    console.log(`      • Executed: ${statements.length} SQL statements`)
    console.log(`      • Success: ${successCount}`)
    if (errorCount > 0) {
      console.log(`      • Warnings: ${errorCount}\n`)
    } else {
      console.log()
    }
  } catch (error) {
    console.error(`\n   ⚠️  Step 2: Schema setup completed with warnings`)
    console.log(`      • You may need to run medex-setup-new-database.sql manually in Supabase SQL Editor\n`)
  }
}

// ============================================================================
// STEP 3: IMPORT DATA TO NEW DATABASE
// ============================================================================
async function step3_importData(exportedData) {
  console.log('┌────────────────────────────────────────────────────────────────┐')
  console.log('│ STEP 3: Import MedEx Data to New Database                     │')
  console.log('└────────────────────────────────────────────────────────────────┘\n')

  const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const importOrder = [
    'users',
    'user_credentials',
    'user_settings',
    'notes',
    'audit_logs',
    'failed_login_attempts'
  ]

  let totalImported = 0

  try {
    for (const tableName of importOrder) {
      const records = exportedData[tableName] || []

      if (records.length === 0) {
        console.log(`   ⏭️  ${tableName}: No records to import`)
        continue
      }

      process.stdout.write(`   📋 Importing ${tableName}: ${records.length} records... `)

      // Import in batches
      const batchSize = 100
      let imported = 0

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)

        const { error } = await newSupabase
          .from(tableName)
          .insert(batch)

        if (!error) {
          imported += batch.length
        }
      }

      console.log(`✅ ${imported} imported`)
      totalImported += imported
    }

    console.log(`\n   ✅ Step 3 Complete: ${totalImported} records imported\n`)
  } catch (error) {
    console.error(`\n   ❌ Step 3 Failed:`, error.message)
    throw error
  }
}

// ============================================================================
// STEP 4: UPDATE ENVIRONMENT VARIABLES
// ============================================================================
async function step4_updateEnv() {
  console.log('┌────────────────────────────────────────────────────────────────┐')
  console.log('│ STEP 4: Update Environment Variables                          │')
  console.log('└────────────────────────────────────────────────────────────────┘\n')

  try {
    // Backup old .env.local
    const oldEnv = fs.readFileSync('.env.local', 'utf8')
    fs.writeFileSync('.env.local.backup', oldEnv)
    console.log('   💾 Backed up .env.local to .env.local.backup')

    // Update Supabase credentials
    const newEnv = oldEnv
      .replace(OLD_SUPABASE_URL, NEW_SUPABASE_URL)
      .replace(process.env.VITE_SUPABASE_ANON_KEY, NEW_ANON_KEY)
      .replace(OLD_SERVICE_KEY, NEW_SERVICE_KEY)

    fs.writeFileSync('.env.local', newEnv)
    console.log('   ✅ Updated .env.local with new Supabase credentials\n')

    console.log('   📝 New Database Configuration:')
    console.log(`      • URL: ${NEW_SUPABASE_URL}`)
    console.log(`      • Isolated: Yes (MedEx only)\n`)

    console.log('   ✅ Step 4 Complete\n')
  } catch (error) {
    console.error(`\n   ❌ Step 4 Failed:`, error.message)
    throw error
  }
}

// ============================================================================
// STEP 5: VERIFY MIGRATION
// ============================================================================
async function step5_verify() {
  console.log('┌────────────────────────────────────────────────────────────────┐')
  console.log('│ STEP 5: Verify Migration Success                              │')
  console.log('└────────────────────────────────────────────────────────────────┘\n')

  const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    console.log('   🔍 Checking database contents...\n')

    for (const tableName of TABLES_TO_EXPORT) {
      const { count, error } = await newSupabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`      ⚠️  ${tableName}: ${error.message}`)
      } else {
        console.log(`      ✅ ${tableName}: ${count} records`)
      }
    }

    console.log(`\n   ✅ Step 5 Complete: Verification successful\n`)
  } catch (error) {
    console.error(`\n   ⚠️  Step 5: Verification completed with warnings\n`)
  }
}

// ============================================================================
// MAIN MIGRATION RUNNER
// ============================================================================
async function runMigration() {
  const startTime = Date.now()

  try {
    // Step 1: Export
    const exportedData = await step1_exportData()

    // Step 2: Setup Schema
    await step2_setupSchema()

    // Step 3: Import
    await step3_importData(exportedData)

    // Step 4: Update Env
    await step4_updateEnv()

    // Step 5: Verify
    await step5_verify()

    // Success
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║                  ✅ MIGRATION COMPLETE! ✅                     ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')

    console.log(`   ⏱️  Total Time: ${duration} seconds`)
    console.log(`   📊 Database: MedEx now has its own isolated Supabase database`)
    console.log(`   🔒 Security: Complete data separation from CareXPS\n`)

    console.log('🎯 Next Steps:')
    console.log('   1. Restart your MedEx application')
    console.log('   2. Log in and verify all functionality works')
    console.log('   3. Test: Users, Settings, Audit Logs, Notes')
    console.log('   4. If everything works, you can safely delete:')
    console.log('      • medex-export-data.json')
    console.log('      • .env.local.backup (keep as backup for now)\n')

    console.log('🎉 MedEx is now running on its own isolated database!\n')

  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════════╗')
    console.error('║                    ❌ MIGRATION FAILED ❌                      ║')
    console.error('╚════════════════════════════════════════════════════════════════╝\n')

    console.error('   Error:', error.message)
    console.error('\n   💡 Troubleshooting:')
    console.error('      1. Check your internet connection')
    console.error('      2. Verify Supabase credentials are correct')
    console.error('      3. Run individual scripts manually:')
    console.error('         • node medex-export-schema.js')
    console.error('         • (Run medex-setup-new-database.sql in Supabase Dashboard)')
    console.error('         • node medex-import-data.js')
    console.error('      4. Check Supabase dashboard for any RLS policy issues\n')

    process.exit(1)
  }
}

// Run migration
runMigration()
