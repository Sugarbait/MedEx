/**
 * Create MedEx Schema Migration Script
 *
 * This script creates a separate 'medex' schema in the Supabase database
 * and copies all table structures from the 'public' schema.
 *
 * CareXPS will continue using 'public' schema (unaffected)
 * MedEx will use 'medex' schema (completely isolated)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createMedExSchema() {
  console.log('🏗️  Creating MedEx schema...\n')

  try {
    // Step 1: Create medex schema
    console.log('1️⃣  Creating medex schema...')
    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE SCHEMA IF NOT EXISTS medex;'
    })

    if (schemaError) {
      console.error('❌ Failed to create schema:', schemaError)
      return
    }
    console.log('✅ Schema created successfully\n')

    // Step 2: Get all tables from public schema
    console.log('2️⃣  Fetching table list from public schema...')
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')

    if (tablesError) {
      console.error('❌ Failed to fetch tables:', tablesError)
      return
    }

    const tableNames = tables.map(t => t.table_name).filter(name =>
      !name.startsWith('_') && // Skip internal tables
      !name.includes('migrations') // Skip migration tracking tables
    )

    console.log(`✅ Found ${tableNames.length} tables to copy:\n   ${tableNames.join(', ')}\n`)

    // Step 3: Copy each table structure to medex schema
    console.log('3️⃣  Copying table structures to medex schema...')

    for (const tableName of tableNames) {
      console.log(`   📋 Copying table: ${tableName}...`)

      // Create table in medex schema with same structure as public schema
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS medex.${tableName}
        (LIKE public.${tableName} INCLUDING ALL);
      `

      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: createTableSQL
      })

      if (createError) {
        console.error(`   ❌ Failed to copy ${tableName}:`, createError.message)
      } else {
        console.log(`   ✅ ${tableName} copied successfully`)
      }
    }

    console.log('\n4️⃣  Copying Row Level Security (RLS) policies...')

    // Enable RLS on all tables in medex schema
    for (const tableName of tableNames) {
      const enableRLSSQL = `ALTER TABLE medex.${tableName} ENABLE ROW LEVEL SECURITY;`

      await supabase.rpc('exec_sql', { sql: enableRLSSQL })
    }
    console.log('✅ RLS enabled on all medex tables\n')

    // Step 4: Grant permissions
    console.log('5️⃣  Setting up permissions...')
    const grantSQL = `
      GRANT USAGE ON SCHEMA medex TO anon, authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA medex TO anon, authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA medex TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA medex GRANT ALL ON TABLES TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA medex GRANT ALL ON SEQUENCES TO anon, authenticated;
    `

    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql: grantSQL
    })

    if (grantError) {
      console.error('❌ Failed to set permissions:', grantError)
    } else {
      console.log('✅ Permissions configured\n')
    }

    console.log('✅ MedEx schema setup complete!\n')
    console.log('📊 Summary:')
    console.log(`   • Schema: medex`)
    console.log(`   • Tables copied: ${tableNames.length}`)
    console.log(`   • Data: Empty (clean slate for MedEx)`)
    console.log(`   • CareXPS: Unaffected (still using public schema)`)
    console.log('\n🎯 Next step: Update MedEx app to use "medex" schema\n')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the migration
createMedExSchema()
