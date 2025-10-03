/**
 * Check Column Types
 * Determine the actual data types for users.id and audit_logs.user_id
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkColumnTypes() {
  console.log('🔍 Checking column types...\n')

  try {
    // Query information_schema to get column types
    const { data: usersColumns, error: usersError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, udt_name')
      .eq('table_name', 'users')
      .eq('column_name', 'id')

    console.log('📊 users.id column:')
    if (usersColumns && usersColumns.length > 0) {
      console.log(`   Type: ${usersColumns[0].data_type}`)
      console.log(`   UDT: ${usersColumns[0].udt_name}`)
    }

    const { data: auditColumns, error: auditError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, udt_name')
      .eq('table_name', 'audit_logs')
      .eq('column_name', 'user_id')

    console.log('\n📊 audit_logs.user_id column:')
    if (auditColumns && auditColumns.length > 0) {
      console.log(`   Type: ${auditColumns[0].data_type}`)
      console.log(`   UDT: ${auditColumns[0].udt_name}`)
    }

    // Check actual data
    const { data: sampleUser } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single()

    console.log('\n📊 Sample user.id value:')
    if (sampleUser) {
      console.log(`   Value: ${sampleUser.id}`)
      console.log(`   Type: ${typeof sampleUser.id}`)
    }

    const { data: sampleAudit } = await supabase
      .from('audit_logs')
      .select('user_id')
      .not('user_id', 'is', null)
      .limit(1)
      .single()

    console.log('\n📊 Sample audit_logs.user_id value:')
    if (sampleAudit) {
      console.log(`   Value: ${sampleAudit.user_id}`)
      console.log(`   Type: ${typeof sampleAudit.user_id}`)
    }

  } catch (error) {
    console.error('❌ Failed:', error)
  }
}

// Run
checkColumnTypes()
