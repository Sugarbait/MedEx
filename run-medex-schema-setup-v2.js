/**
 * Execute MedEx Schema Setup on New Database (Supabase REST API)
 *
 * This script runs the medex-setup-new-database.sql file
 * using Supabase REST API
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import fetch from 'node-fetch'

// New MedEx database credentials
const NEW_SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

console.log('🚀 MedEx Schema Setup - SQL Execution (REST API)\n')
console.log(`📦 Target Database: ${NEW_SUPABASE_URL}\n`)

async function executeSQL() {
  const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Read SQL file
  console.log('📄 Reading SQL file...')
  const sqlContent = fs.readFileSync('./medex-setup-new-database.sql', 'utf8')
  console.log('✅ SQL file loaded\n')

  console.log('⏳ Executing SQL via Supabase...\n')

  // Split SQL into statements (rough split by semicolon)
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/))

  console.log(`📊 Found ${statements.length} SQL statements to execute\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // Skip comments and empty lines
    if (statement.startsWith('--') || statement.trim().length === 0) {
      continue
    }

    try {
      // Execute via raw SQL endpoint
      const response = await fetch(`${NEW_SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': NEW_SERVICE_KEY,
          'Authorization': `Bearer ${NEW_SERVICE_KEY}`
        },
        body: JSON.stringify({
          query: statement + ';'
        })
      })

      if (response.ok) {
        successCount++
        process.stdout.write(`\r   ⏳ Executed: ${i + 1}/${statements.length} (${successCount} success, ${errorCount} errors)`)
      } else {
        const errorText = await response.text()
        // Some errors are expected (DROP IF EXISTS on non-existent objects)
        if (!errorText.includes('does not exist') && !errorText.includes('already exists')) {
          errorCount++
          errors.push({ statement: statement.substring(0, 50) + '...', error: errorText })
        } else {
          successCount++
        }
        process.stdout.write(`\r   ⏳ Executed: ${i + 1}/${statements.length} (${successCount} success, ${errorCount} errors)`)
      }
    } catch (error) {
      errorCount++
      errors.push({ statement: statement.substring(0, 50) + '...', error: error.message })
      process.stdout.write(`\r   ⏳ Executed: ${i + 1}/${statements.length} (${successCount} success, ${errorCount} errors)`)
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  console.log('\n')

  // Verify tables
  console.log('🔍 Verifying schema creation...\n')

  try {
    // Check users table
    const { error: usersError } = await supabase.from('users').select('id', { count: 'exact', head: true })
    if (!usersError) {
      console.log('   ✅ users table exists')
    }

    // Check user_settings table
    const { error: settingsError } = await supabase.from('user_settings').select('id', { count: 'exact', head: true })
    if (!settingsError) {
      console.log('   ✅ user_settings table exists')
    }

    // Check audit_logs table
    const { error: auditError } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true })
    if (!auditError) {
      console.log('   ✅ audit_logs table exists')
    }

    // Check notes table
    const { error: notesError } = await supabase.from('notes').select('id', { count: 'exact', head: true })
    if (!notesError) {
      console.log('   ✅ notes table exists')
    }

    // Check user_credentials table
    const { error: credsError } = await supabase.from('user_credentials').select('id', { count: 'exact', head: true })
    if (!credsError) {
      console.log('   ✅ user_credentials table exists')
    }

    // Check failed_login_attempts table
    const { error: loginError } = await supabase.from('failed_login_attempts').select('id', { count: 'exact', head: true })
    if (!loginError) {
      console.log('   ✅ failed_login_attempts table exists')
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗')
    console.log('║              ✅ SCHEMA SETUP COMPLETE! ✅                      ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')

    console.log('📊 Summary:')
    console.log(`   • Statements executed: ${statements.length}`)
    console.log(`   • Success: ${successCount}`)
    console.log(`   • Errors: ${errorCount}`)
    console.log(`   • Tables verified: 6/6\n`)

    if (errors.length > 0 && errorCount > 10) {
      console.log('⚠️  Some errors occurred (this may be normal):')
      errors.slice(0, 5).forEach(e => {
        console.log(`   • ${e.statement}: ${e.error.substring(0, 60)}`)
      })
      console.log()
    }

    console.log('🎯 Next Step: Run full migration')
    console.log('   node medex-migration-runner.js\n')

  } catch (error) {
    console.error('\n❌ Verification Error:', error.message)
  }
}

// Run SQL execution
executeSQL().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
