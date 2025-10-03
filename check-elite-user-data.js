/**
 * Check Elite User Data
 * Find all related data for elitesquadp@protonmail.com
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkEliteUserData() {
  console.log('🔍 Checking all data for elitesquadp@protonmail.com...\n')

  try {
    const AUTH_USER_ID = 'c4b2b868-b76b-46c4-abcf-f65027e9f64c'

    // Check user_settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', AUTH_USER_ID)

    console.log(`📊 user_settings: ${settings?.length || 0} records`)
    if (settings && settings.length > 0) {
      console.log('   Found settings records - these need to be deleted first')
    }

    // Check audit_logs
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', AUTH_USER_ID)

    console.log(`📊 audit_logs: ${auditLogs?.length || 0} records`)
    if (auditLogs && auditLogs.length > 0) {
      console.log('   Found audit log records')
    }

    // Check notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', AUTH_USER_ID)

    console.log(`📊 notes: ${notes?.length || 0} records`)

    // Check any other tables that might reference this user
    console.log('\n💡 Summary:')
    const totalRecords = (settings?.length || 0) + (auditLogs?.length || 0) + (notes?.length || 0)

    if (totalRecords > 0) {
      console.log(`   Total related records: ${totalRecords}`)
      console.log('   These records need to be deleted before the auth user can be removed')
    } else {
      console.log('   No related records found - deletion should be possible')
    }

  } catch (error) {
    console.error('❌ Failed:', error)
  }
}

// Run
checkEliteUserData()
