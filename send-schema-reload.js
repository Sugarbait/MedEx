/**
 * Send NOTIFY signal to PostgREST to reload schema
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🔄 Sending schema reload signal to PostgREST...\n')

async function reloadSchema() {
  try {
    // Try NOTIFY via SQL
    const { data, error } = await supabase.rpc('exec', {
      sql: "NOTIFY pgrst, 'reload schema';"
    })

    if (error) {
      console.log('⚠️  NOTIFY command not available via RPC')
      console.log('   Error:', error.message)
    } else {
      console.log('✅ Schema reload signal sent successfully')
    }

    // Wait a moment
    console.log('\n⏱️  Waiting 5 seconds for schema cache to refresh...\n')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Test table access
    console.log('🔍 Testing table access...\n')

    const tables = ['users', 'user_settings', 'audit_logs', 'user_credentials', 'notes', 'failed_login_attempts']
    let successCount = 0

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(0)

        if (!error) {
          console.log(`   ✅ ${table}`)
          successCount++
        } else {
          console.log(`   ❌ ${table}: ${error.message}`)
        }
      } catch (err) {
        console.log(`   ❌ ${table}: ${err.message}`)
      }
    }

    console.log(`\n📊 Result: ${successCount}/${tables.length} tables accessible\n`)

    if (successCount === tables.length) {
      console.log('╔════════════════════════════════════════════════════════════════╗')
      console.log('║              ✅ SCHEMA RELOAD SUCCESSFUL! ✅                   ║')
      console.log('╚════════════════════════════════════════════════════════════════╝\n')
      console.log('🎉 All tables are now accessible via REST API!')
      console.log('🎯 Return to localhost:3000 and try creating your first user!\n')
    } else {
      console.log('╔════════════════════════════════════════════════════════════════╗')
      console.log('║              ⏰ SCHEMA CACHE STILL REFRESHING...              ║')
      console.log('╚════════════════════════════════════════════════════════════════╝\n')
      console.log('💡 PostgREST may take up to 60 seconds to refresh its cache.')
      console.log('   Please wait 1 minute and try again.\n')
      console.log('🔄 You can run this script again to check:\n')
      console.log('   node send-schema-reload.js\n')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

reloadSchema()
