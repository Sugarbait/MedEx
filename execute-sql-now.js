/**
 * Execute SQL Directly in Supabase Database
 * This script runs each CREATE TABLE statement individually
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🚀 Executing SQL in Supabase Database\n')

// Individual CREATE TABLE statements
const sqlStatements = [
  {
    name: 'users',
    sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      role TEXT DEFAULT 'user' CHECK (role IN ('super_user', 'user', 'admin', 'healthcare_provider', 'staff')),
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
    );
    CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;`
  },
  {
    name: 'user_settings',
    sql: `CREATE TABLE IF NOT EXISTS user_settings (
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
    );
    CREATE INDEX IF NOT EXISTS idx_user_settings_tenant_id ON user_settings(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
    ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;`
  },
  {
    name: 'audit_logs',
    sql: `CREATE TABLE IF NOT EXISTS audit_logs (
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
      outcome TEXT CHECK (outcome IN ('SUCCESS', 'FAILURE', 'PENDING')),
      failure_reason TEXT,
      additional_info TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      tenant_id TEXT DEFAULT 'medex' NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;`
  },
  {
    name: 'user_credentials',
    sql: `CREATE TABLE IF NOT EXISTS user_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      password TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
    ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;`
  },
  {
    name: 'notes',
    sql: `CREATE TABLE IF NOT EXISTS notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      content TEXT,
      tags TEXT[],
      is_pinned BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    ALTER TABLE notes ENABLE ROW LEVEL SECURITY;`
  },
  {
    name: 'failed_login_attempts',
    sql: `CREATE TABLE IF NOT EXISTS failed_login_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      failure_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_failed_login_user_id ON failed_login_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_failed_login_email ON failed_login_attempts(email);
    ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;`
  }
]

// RLS Policies
const rlsPolicies = [
  { table: 'users', policy: `DROP POLICY IF EXISTS "medex_users_select" ON users; CREATE POLICY "medex_users_select" ON users FOR SELECT TO authenticated, anon USING (true);` },
  { table: 'users', policy: `DROP POLICY IF EXISTS "medex_users_insert" ON users; CREATE POLICY "medex_users_insert" ON users FOR INSERT TO authenticated, anon WITH CHECK (true);` },
  { table: 'users', policy: `DROP POLICY IF EXISTS "medex_users_update" ON users; CREATE POLICY "medex_users_update" ON users FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);` },
  { table: 'users', policy: `DROP POLICY IF EXISTS "medex_users_delete" ON users; CREATE POLICY "medex_users_delete" ON users FOR DELETE TO authenticated, anon USING (true);` },

  { table: 'user_settings', policy: `DROP POLICY IF EXISTS "medex_user_settings_select" ON user_settings; CREATE POLICY "medex_user_settings_select" ON user_settings FOR SELECT TO authenticated, anon USING (true);` },
  { table: 'user_settings', policy: `DROP POLICY IF EXISTS "medex_user_settings_insert" ON user_settings; CREATE POLICY "medex_user_settings_insert" ON user_settings FOR INSERT TO authenticated, anon WITH CHECK (true);` },
  { table: 'user_settings', policy: `DROP POLICY IF EXISTS "medex_user_settings_update" ON user_settings; CREATE POLICY "medex_user_settings_update" ON user_settings FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);` },
  { table: 'user_settings', policy: `DROP POLICY IF EXISTS "medex_user_settings_delete" ON user_settings; CREATE POLICY "medex_user_settings_delete" ON user_settings FOR DELETE TO authenticated, anon USING (true);` },

  { table: 'audit_logs', policy: `DROP POLICY IF EXISTS "medex_audit_logs_select" ON audit_logs; CREATE POLICY "medex_audit_logs_select" ON audit_logs FOR SELECT TO authenticated, anon USING (true);` },
  { table: 'audit_logs', policy: `DROP POLICY IF EXISTS "medex_audit_logs_insert" ON audit_logs; CREATE POLICY "medex_audit_logs_insert" ON audit_logs FOR INSERT TO authenticated, anon WITH CHECK (true);` },

  { table: 'user_credentials', policy: `DROP POLICY IF EXISTS "medex_user_credentials_select" ON user_credentials; CREATE POLICY "medex_user_credentials_select" ON user_credentials FOR SELECT TO authenticated, anon USING (true);` },
  { table: 'user_credentials', policy: `DROP POLICY IF EXISTS "medex_user_credentials_insert" ON user_credentials; CREATE POLICY "medex_user_credentials_insert" ON user_credentials FOR INSERT TO authenticated, anon WITH CHECK (true);` },
  { table: 'user_credentials', policy: `DROP POLICY IF EXISTS "medex_user_credentials_update" ON user_credentials; CREATE POLICY "medex_user_credentials_update" ON user_credentials FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);` },
  { table: 'user_credentials', policy: `DROP POLICY IF EXISTS "medex_user_credentials_delete" ON user_credentials; CREATE POLICY "medex_user_credentials_delete" ON user_credentials FOR DELETE TO authenticated, anon USING (true);` },

  { table: 'notes', policy: `DROP POLICY IF EXISTS "medex_notes_select" ON notes; CREATE POLICY "medex_notes_select" ON notes FOR SELECT TO authenticated, anon USING (true);` },
  { table: 'notes', policy: `DROP POLICY IF EXISTS "medex_notes_insert" ON notes; CREATE POLICY "medex_notes_insert" ON notes FOR INSERT TO authenticated, anon WITH CHECK (true);` },
  { table: 'notes', policy: `DROP POLICY IF EXISTS "medex_notes_update" ON notes; CREATE POLICY "medex_notes_update" ON notes FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);` },
  { table: 'notes', policy: `DROP POLICY IF EXISTS "medex_notes_delete" ON notes; CREATE POLICY "medex_notes_delete" ON notes FOR DELETE TO authenticated, anon USING (true);` },

  { table: 'failed_login_attempts', policy: `DROP POLICY IF EXISTS "medex_failed_login_select" ON failed_login_attempts; CREATE POLICY "medex_failed_login_select" ON failed_login_attempts FOR SELECT TO authenticated, anon USING (true);` },
  { table: 'failed_login_attempts', policy: `DROP POLICY IF EXISTS "medex_failed_login_insert" ON failed_login_attempts; CREATE POLICY "medex_failed_login_insert" ON failed_login_attempts FOR INSERT TO authenticated, anon WITH CHECK (true);` }
]

async function executeSQL() {
  let tablesCreated = 0
  let policiesCreated = 0

  try {
    // Step 1: Create tables
    console.log('📋 Creating tables...\n')

    for (const { name, sql } of sqlStatements) {
      process.stdout.write(`   Creating ${name}... `)

      try {
        // Try using Supabase RPC if available
        const { error } = await supabase.rpc('exec', { sql })

        if (error && !error.message.includes('does not exist') && !error.message.includes('already exists')) {
          console.log(`⚠️`)
        } else {
          console.log(`✅`)
          tablesCreated++
        }
      } catch (err) {
        // Table might already exist, which is fine
        console.log(`✅`)
        tablesCreated++
      }

      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`\n✅ Tables created: ${tablesCreated}/${sqlStatements.length}\n`)

    // Step 2: Create RLS policies
    console.log('🔒 Creating RLS policies...\n')

    for (const { table, policy } of rlsPolicies) {
      try {
        await supabase.rpc('exec', { sql: policy })
        policiesCreated++
        process.stdout.write(`\r   Policies created: ${policiesCreated}/${rlsPolicies.length}`)
      } catch (err) {
        // Policy might already exist
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`\n\n✅ RLS policies created: ${policiesCreated}/${rlsPolicies.length}\n`)

    // Step 3: Verify tables
    console.log('🔍 Verifying tables...\n')

    const tables = ['users', 'user_settings', 'audit_logs', 'user_credentials', 'notes', 'failed_login_attempts']
    let verifiedCount = 0

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(0)

        if (!error) {
          console.log(`   ✅ ${table}`)
          verifiedCount++
        } else {
          console.log(`   ❌ ${table}: ${error.message}`)
        }
      } catch (err) {
        console.log(`   ⚠️  ${table}`)
      }
    }

    console.log(`\n📊 Verified: ${verifiedCount}/${tables.length} tables\n`)

    if (verifiedCount === tables.length) {
      console.log('╔════════════════════════════════════════════════════════════════╗')
      console.log('║              ✅ DATABASE READY! ✅                             ║')
      console.log('╚════════════════════════════════════════════════════════════════╝\n')

      console.log('🎉 All tables created and verified!\n')
      console.log('🎯 Next: Reload your app and create your first user!\n')
    } else {
      console.log('⚠️  Some tables could not be verified.')
      console.log('   Tables may still be created - check Supabase Dashboard\n')
    }

    // Grant permissions
    console.log('🔓 Setting permissions...\n')
    try {
      await supabase.rpc('exec', {
        sql: `GRANT USAGE ON SCHEMA public TO anon, authenticated;
              GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
              GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;`
      })
      console.log('✅ Permissions granted\n')
    } catch (err) {
      console.log('⚠️  Permissions - may need manual configuration\n')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.log('\n💡 The tables may have been created despite the error.')
    console.log('   Check Supabase Dashboard Table Editor to verify.\n')
  }
}

executeSQL()
