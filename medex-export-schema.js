/**
 * MedEx Schema Export Script
 *
 * This script exports the MedEx data from the shared Supabase database
 * (only records with tenant_id = 'medex')
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

// Load environment variables from .env.local (OLD shared database)
dotenv.config({ path: '.env.local' })

const OLD_SUPABASE_URL = process.env.VITE_SUPABASE_URL
const OLD_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!OLD_SUPABASE_URL || !OLD_SERVICE_KEY) {
  console.error('❌ Missing old Supabase credentials in .env.local!')
  process.exit(1)
}

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Tables to export (in dependency order)
const TABLES_TO_EXPORT = [
  'users',
  'user_settings',
  'user_credentials',
  'audit_logs',
  'notes',
  'user_profiles',
  'failed_login_attempts'
]

async function exportMedExData() {
  console.log('🚀 Starting MedEx Data Export...\n')
  console.log(`📦 Source: ${OLD_SUPABASE_URL}`)
  console.log(`🎯 Tenant Filter: tenant_id = 'medex'\n`)

  const exportedData = {}

  try {
    for (const tableName of TABLES_TO_EXPORT) {
      console.log(`📋 Exporting table: ${tableName}...`)

      // Query with tenant filter
      let query = oldSupabase
        .from(tableName)
        .select('*')

      // Add tenant filter for tables that have tenant_id column
      if (['users', 'user_settings', 'audit_logs'].includes(tableName)) {
        query = query.eq('tenant_id', 'medex')
      }

      const { data, error } = await query

      if (error) {
        // Table might not exist or might not have data
        console.warn(`   ⚠️  ${tableName}: ${error.message}`)
        exportedData[tableName] = []
      } else {
        exportedData[tableName] = data || []
        console.log(`   ✅ ${tableName}: ${data?.length || 0} records exported`)
      }
    }

    // Save to JSON file
    const exportFilePath = './medex-export-data.json'
    fs.writeFileSync(exportFilePath, JSON.stringify(exportedData, null, 2))

    console.log(`\n✅ Export Complete!`)
    console.log(`📁 Exported data saved to: ${exportFilePath}`)
    console.log(`\n📊 Summary:`)

    let totalRecords = 0
    for (const [table, records] of Object.entries(exportedData)) {
      console.log(`   • ${table}: ${records.length} records`)
      totalRecords += records.length
    }

    console.log(`\n📦 Total Records Exported: ${totalRecords}`)
    console.log(`\n🎯 Next Step: Run medex-setup-new-database.js\n`)

    return exportedData

  } catch (error) {
    console.error('❌ Export failed:', error)
    throw error
  }
}

// Run export
exportMedExData()
