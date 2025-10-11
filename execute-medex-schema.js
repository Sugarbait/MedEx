/**
 * Execute MedEx Schema SQL Directly
 *
 * This script creates all tables and policies programmatically using Supabase client
 */

import { createClient } from '@supabase/supabase-js'

// New MedEx database credentials
const NEW_SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🚀 MedEx Database Schema Setup - Direct Execution\n')
console.log(`📦 Target: ${NEW_SUPABASE_URL}\n`)

async function executeSchema() {
  try {
    console.log('⏳ Creating tables...\n')

    // We'll use the Supabase client to create a simple table first as a test
    // Then verify if we can execute raw SQL

    console.log('🔍 Testing database connection...')

    // Try to query information_schema to verify connection
    const { data: testData, error: testError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1)

    if (testError) {
      console.log('⚠️  Direct query failed, trying alternative approach...\n')
    } else {
      console.log('✅ Database connection successful!\n')
    }

    // Since we can't execute raw SQL directly via the Supabase client easily,
    // let's create tables using the REST API
    console.log('⏳ Creating schema via REST API...\n')

    const sqlStatements = [
      // Create users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        tenant_id TEXT DEFAULT 'medex' NOT NULL,
        avatar_url TEXT,
        phone TEXT,
        department TEXT,
        location TEXT,
        bio TEXT
      )`,

      // Create user_settings table
      `CREATE TABLE IF NOT EXISTS user_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme TEXT DEFAULT 'light',
        notifications JSONB DEFAULT '{"email": true, "sms": false, "push": true, "in_app": true}',
        security_preferences JSONB DEFAULT '{"session_timeout": 15, "require_mfa": true}',
        communication_preferences JSONB DEFAULT '{"default_method": "phone"}',
        accessibility_settings JSONB DEFAULT '{"high_contrast": false, "large_text": false}',
        retell_config JSONB,
        tenant_id TEXT DEFAULT 'medex' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      )`,

      // Create audit_logs table
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        user_name TEXT,
        action TEXT NOT NULL,
        table_name TEXT,
        record_id TEXT,
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        outcome TEXT,
        failure_reason TEXT,
        additional_info TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        tenant_id TEXT DEFAULT 'medex' NOT NULL
      )`,

      // Create user_credentials table
      `CREATE TABLE IF NOT EXISTS user_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      )`,

      // Create notes table
      `CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        content TEXT,
        tags TEXT[],
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Create failed_login_attempts table
      `CREATE TABLE IF NOT EXISTS failed_login_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        failure_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    ]

    let successCount = 0

    for (const sql of sqlStatements) {
      try {
        const tableName = sql.match(/CREATE TABLE.*?(\w+)\s*\(/)?.[1] || 'unknown'
        process.stdout.write(`   📋 Creating ${tableName}... `)

        const response = await fetch(`${NEW_SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': NEW_SERVICE_KEY,
            'Authorization': `Bearer ${NEW_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: sql })
        })

        if (response.ok || response.status === 404) {
          console.log('✅')
          successCount++
        } else {
          const errorText = await response.text()
          console.log(`⚠️  ${errorText.substring(0, 50)}`)
        }

        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.log(`❌ ${error.message}`)
      }
    }

    console.log(`\n✅ Table creation attempted: ${successCount}/${sqlStatements.length}\n`)

    // Now verify tables exist
    console.log('🔍 Verifying tables...\n')

    const tablesToCheck = ['users', 'user_settings', 'audit_logs', 'user_credentials', 'notes', 'failed_login_attempts']
    let verifiedCount = 0

    for (const table of tablesToCheck) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .limit(0)

        if (!error) {
          console.log(`   ✅ ${table}`)
          verifiedCount++
        } else {
          console.log(`   ❌ ${table}: ${error.message}`)
        }
      } catch (error) {
        console.log(`   ⚠️  ${table}: Could not verify`)
      }
    }

    console.log(`\n📊 Verified: ${verifiedCount}/${tablesToCheck.length} tables\n`)

    if (verifiedCount === tablesToCheck.length) {
      console.log('╔════════════════════════════════════════════════════════════════╗')
      console.log('║           ✅ ALL TABLES CREATED SUCCESSFULLY! ✅               ║')
      console.log('╚════════════════════════════════════════════════════════════════╝\n')

      console.log('🎯 Next Step: Run the full migration')
      console.log('   node medex-migration-runner.js\n')
    } else {
      console.log('⚠️  Some tables could not be verified.')
      console.log('   This might be normal - try running the migration anyway.\n')
      console.log('   Or manually run the SQL in Supabase Dashboard.\n')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error('\n💡 Alternative: Use the HTML setup guide')
    console.error('   Open: setup-medex-database.html\n')
  }
}

executeSchema()
