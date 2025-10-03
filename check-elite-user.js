/**
 * Check Elite User
 * Check tenant for elitesquadp@protonmail.com
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkEliteUser() {
  console.log('📊 Checking elitesquadp@protonmail.com...\n')

  try {
    // Check in users table
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id, created_at')
      .eq('email', 'elitesquadp@protonmail.com')

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    if (users && users.length > 0) {
      console.log('✅ Found in users table:')
      users.forEach(user => {
        console.log(`   Email: ${user.email}`)
        console.log(`   Tenant: ${user.tenant_id}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   ID: ${user.id}`)
      })
    } else {
      console.log('❌ Not found in users table')
      console.log('💡 This user only exists in Supabase Auth (not in your app database)')
      console.log('   This is likely a leftover test user that should be cleaned up')
    }

  } catch (error) {
    console.error('❌ Failed:', error)
  }
}

// Run
checkEliteUser()
