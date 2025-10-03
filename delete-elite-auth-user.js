/**
 * Delete Elite Auth User
 * Removes elitesquadp@protonmail.com from Supabase Auth
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function deleteEliteAuthUser() {
  console.log('🗑️  Deleting elitesquadp@protonmail.com from Supabase Auth...\n')

  try {
    // First, get the auth user ID
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Error listing auth users:', listError)
      return
    }

    const eliteUser = authUsers.users.find(u => u.email === 'elitesquadp@protonmail.com')

    if (!eliteUser) {
      console.log('✅ User not found in auth - already cleaned up')
      return
    }

    console.log(`📋 Found auth user:`)
    console.log(`   Email: ${eliteUser.email}`)
    console.log(`   Auth ID: ${eliteUser.id}`)
    console.log(`   Created: ${eliteUser.created_at}`)
    console.log(`   Last Sign In: ${eliteUser.last_sign_in_at || 'Never'}\n`)

    // Delete the auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(eliteUser.id)

    if (deleteError) {
      console.error('❌ Error deleting auth user:', deleteError)
      return
    }

    console.log('✅ Auth user deleted successfully')
    console.log('\n💡 Cleanup complete - this orphaned test user has been removed')

  } catch (error) {
    console.error('❌ Failed:', error)
  }
}

// Run
deleteEliteAuthUser()
