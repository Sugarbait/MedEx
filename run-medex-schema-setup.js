/**
 * Execute MedEx Schema Setup on New Database
 *
 * This script runs the medex-setup-new-database.sql file
 * against the new isolated Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import pg from 'pg'

const { Client } = pg

// New MedEx database credentials
const NEW_SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

// Construct PostgreSQL connection string
// Format: postgresql://postgres:[SERVICE_ROLE_KEY]@db.[PROJECT_REF].supabase.co:5432/postgres
const PROJECT_REF = 'onwgbfetzrctshdwwimm'
const POSTGRES_PASSWORD = NEW_SERVICE_KEY
const DB_URL = `postgresql://postgres.${PROJECT_REF}:${POSTGRES_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

console.log('🚀 MedEx Schema Setup - SQL Execution\n')
console.log(`📦 Target Database: ${NEW_SUPABASE_URL}\n`)

async function executeSQL() {
  // Read SQL file
  console.log('📄 Reading SQL file...')
  const sqlContent = fs.readFileSync('./medex-setup-new-database.sql', 'utf8')

  console.log('✅ SQL file loaded\n')
  console.log('⏳ Connecting to database...\n')

  const client = new Client({
    connectionString: DB_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    await client.connect()
    console.log('✅ Connected to database\n')

    console.log('⏳ Executing SQL schema setup...\n')

    // Execute the entire SQL file
    await client.query(sqlContent)

    console.log('✅ SQL execution complete!\n')

    // Verify tables were created
    console.log('🔍 Verifying tables...\n')

    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `)

    console.log('📊 Tables created:')
    tableCheck.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`)
    })

    console.log('\n🔒 Verifying RLS policies...\n')

    const policyCheck = await client.query(`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `)

    const policyCount = policyCheck.rows.length
    console.log(`📋 RLS Policies created: ${policyCount}`)

    // Group by table
    const policiesByTable = {}
    policyCheck.rows.forEach(row => {
      if (!policiesByTable[row.tablename]) {
        policiesByTable[row.tablename] = []
      }
      policiesByTable[row.tablename].push(row.policyname)
    })

    Object.entries(policiesByTable).forEach(([table, policies]) => {
      console.log(`   ✅ ${table}: ${policies.length} policies`)
    })

    console.log('\n╔════════════════════════════════════════════════════════════════╗')
    console.log('║              ✅ SCHEMA SETUP COMPLETE! ✅                      ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')

    console.log('📊 Summary:')
    console.log(`   • Tables: ${tableCheck.rows.length}`)
    console.log(`   • RLS Policies: ${policyCount}`)
    console.log(`   • Database: Ready for data import\n`)

    console.log('🎯 Next Step: Run data migration')
    console.log('   node medex-migration-runner.js\n')

  } catch (error) {
    console.error('\n❌ SQL Execution Error:', error.message)
    console.error('\n💡 Troubleshooting:')
    console.error('   1. Check database connection')
    console.error('   2. Verify service role key is correct')
    console.error('   3. Try running SQL manually in Supabase Dashboard\n')
    throw error
  } finally {
    await client.end()
    console.log('🔌 Database connection closed\n')
  }
}

// Run SQL execution
executeSQL().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
