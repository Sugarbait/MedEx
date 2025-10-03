/**
 * Apply Audit Logs Permissions
 * Fixes RLS policies for audit_logs table
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyAuditPermissions() {
  console.log('🔧 Applying audit logs permissions...\n')

  try {
    // Read SQL file
    const sql = readFileSync('fix-audit-logs-permissions.sql', 'utf8')

    console.log('📋 Executing SQL migration...')

    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('❌ Migration failed:', error)
      console.log('\n💡 Manual Fix Required:')
      console.log('   1. Go to Supabase Dashboard')
      console.log('   2. Navigate to SQL Editor')
      console.log('   3. Copy and paste contents of fix-audit-logs-permissions.sql')
      console.log('   4. Run the SQL')
      return
    }

    console.log('✅ Permissions updated successfully!')
    console.log('\n📋 New Policies:')
    console.log('   ✅ Super users can view all audit logs')
    console.log('   ✅ Users can view their own audit logs')
    console.log('   ✅ Service role can insert audit logs')
    console.log('\n💡 Refresh the page to see login history')

  } catch (error) {
    console.error('❌ Failed:', error)
    console.log('\n💡 Manual Fix Required:')
    console.log('   Run the SQL in fix-audit-logs-permissions.sql via Supabase Dashboard')
  }
}

// Run
applyAuditPermissions()
