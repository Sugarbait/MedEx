/**
 * Check actual database schema - what tables really exist
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🔍 Checking actual database schema...\n')

async function checkSchema() {
  try {
    // Query PostgreSQL information_schema to see what tables actually exist
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .eq('table_type', 'BASE TABLE')
      .in('table_schema', ['public', 'auth', 'storage'])
      .order('table_schema')
      .order('table_name')

    if (error) {
      console.log('❌ Cannot query information_schema:', error.message)
      console.log('\nTrying direct table queries instead...\n')

      // Fallback: try direct table access
      const testTables = ['users', 'user_settings', 'audit_logs', 'user_credentials', 'notes', 'failed_login_attempts']

      for (const table of testTables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .limit(0)

          if (error) {
            console.log(`❌ ${table}: ${error.code} - ${error.message}`)
          } else {
            console.log(`✅ ${table}: Table exists and is accessible`)
          }
        } catch (err) {
          console.log(`❌ ${table}: ${err.message}`)
        }
      }
      return
    }

    console.log('📊 Tables in database:\n')

    const publicTables = tables.filter(t => t.table_schema === 'public')

    if (publicTables.length === 0) {
      console.log('⚠️  NO TABLES FOUND IN PUBLIC SCHEMA!\n')
      console.log('This means the CREATE TABLE statements did not actually execute.\n')
    } else {
      console.log('✅ Public schema tables:')
      publicTables.forEach(t => {
        console.log(`   - ${t.table_name}`)
      })
      console.log()
    }

    const authTables = tables.filter(t => t.table_schema === 'auth')
    if (authTables.length > 0) {
      console.log('🔐 Auth schema tables (Supabase Auth):')
      authTables.forEach(t => {
        console.log(`   - ${t.table_name}`)
      })
      console.log()
    }

    const storageTables = tables.filter(t => t.table_schema === 'storage')
    if (storageTables.length > 0) {
      console.log('📦 Storage schema tables (Supabase Storage):')
      storageTables.forEach(t => {
        console.log(`   - ${t.table_name}`)
      })
      console.log()
    }

    console.log(`\n📈 Total tables: ${tables.length}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkSchema()
