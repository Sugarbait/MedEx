/**
 * MedEx Data Import Script
 *
 * This script imports the exported MedEx data into the new isolated Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

// NEW database credentials (hardcoded for this migration)
const NEW_SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const NEW_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODA5ODYsImV4cCI6MjA3NTU1Njk4Nn0.MgsjiXT2Y0WqQf2puG2p27tHaMRfhiUET2TDWc668lI'
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function importMedExData() {
  console.log('🚀 Starting MedEx Data Import...\n')
  console.log(`📦 Target: ${NEW_SUPABASE_URL}\n`)

  try {
    // Read exported data
    const exportFilePath = './medex-export-data.json'
    if (!fs.existsSync(exportFilePath)) {
      console.error('❌ Export file not found: medex-export-data.json')
      console.error('   Please run medex-export-schema.js first!')
      process.exit(1)
    }

    const exportedData = JSON.parse(fs.readFileSync(exportFilePath, 'utf8'))

    console.log('📁 Loaded export file\n')

    // Import data in dependency order
    const importOrder = [
      'users',
      'user_credentials',
      'user_settings',
      'notes',
      'audit_logs',
      'failed_login_attempts'
    ]

    let totalImported = 0

    for (const tableName of importOrder) {
      const records = exportedData[tableName] || []

      if (records.length === 0) {
        console.log(`⏭️  ${tableName}: No records to import`)
        continue
      }

      console.log(`📋 Importing ${tableName}: ${records.length} records...`)

      try {
        // Import in batches of 100 for better performance
        const batchSize = 100
        let imported = 0

        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize)

          const { error } = await newSupabase
            .from(tableName)
            .insert(batch)

          if (error) {
            console.error(`   ⚠️  Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`)
            // Continue with next batch
          } else {
            imported += batch.length
            process.stdout.write(`\r   ⏳ Imported: ${imported}/${records.length}`)
          }
        }

        console.log(`\n   ✅ ${tableName}: ${imported} records imported`)
        totalImported += imported

      } catch (error) {
        console.error(`   ❌ ${tableName} import failed:`, error.message)
      }
    }

    console.log(`\n✅ Import Complete!`)
    console.log(`📊 Total Records Imported: ${totalImported}\n`)

    // Verify import
    console.log('🔍 Verifying import...')

    for (const tableName of importOrder) {
      try {
        const { count, error } = await newSupabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (error) {
          console.log(`   ⚠️  ${tableName}: Could not verify`)
        } else {
          console.log(`   ✅ ${tableName}: ${count} records in database`)
        }
      } catch (error) {
        console.log(`   ⚠️  ${tableName}: Verification failed`)
      }
    }

    console.log(`\n✅ Migration Complete!`)
    console.log(`\n🎯 Next Steps:`)
    console.log(`   1. Update .env.local with new Supabase credentials`)
    console.log(`   2. Restart your MedEx app`)
    console.log(`   3. Test login and functionality\n`)

  } catch (error) {
    console.error('❌ Import failed:', error)
    throw error
  }
}

// Run import
importMedExData()
