/**
 * Force Delete Elite User
 * Direct deletion using auth ID: c4b2b868-b76b-46c4-abcf-f65027e9f64c
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function forceDeleteEliteUser() {
  const USER_ID = 'c4b2b868-b76b-46c4-abcf-f65027e9f64c'

  console.log('🗑️  Force deleting auth user...')
  console.log(`   User ID: ${USER_ID}`)
  console.log(`   Email: elitesquadp@protonmail.com\n`)

  try {
    // Try deletion with shouldSoftDelete option set to false
    const { data, error } = await supabase.auth.admin.deleteUser(
      USER_ID,
      false // shouldSoftDelete = false for permanent deletion
    )

    if (error) {
      console.error('❌ Deletion failed:', error.message)
      console.log('\n💡 Alternative: This user must be deleted via Supabase Dashboard')
      console.log('   1. Go to https://supabase.com/dashboard')
      console.log('   2. Select your project: cpkslvmydfdevdftieck')
      console.log('   3. Navigate to Authentication → Users')
      console.log('   4. Find elitesquadp@protonmail.com')
      console.log('   5. Click the three dots → Delete User')
      return
    }

    console.log('✅ Auth user deleted successfully!')
    console.log('\n💡 Orphaned test user has been permanently removed')

  } catch (error) {
    console.error('❌ Failed:', error.message)
    console.log('\n💡 Manual deletion required via Supabase Dashboard')
  }
}

// Run
forceDeleteEliteUser()
