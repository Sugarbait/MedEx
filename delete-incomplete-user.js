/**
 * Delete Incomplete User
 * Removes admin@phaetonai.com from users table so you can recreate it properly
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function deleteIncompleteUser() {
  console.log('🗑️  Deleting incomplete user admin@phaetonai.com...\n')

  try {
    const USER_ID = 'f99057b7-23bf-4d1b-8104-1f715a1a9851'

    // Delete from users table
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', USER_ID)

    if (deleteError) {
      console.error('❌ Error deleting user:', deleteError)
      return
    }

    console.log('✅ User deleted from database')
    console.log('\n💡 Next steps:')
    console.log('   1. Log into MedEx (you may need to clear cache)')
    console.log('   2. Go to User Management')
    console.log('   3. Click "Add New User"')
    console.log('   4. Create user with:')
    console.log('      - Email: admin@phaetonai.com')
    console.log('      - Password: (your choice)')
    console.log('      - Role: Super User')
    console.log('   5. This will properly create both database AND auth records')

  } catch (error) {
    console.error('❌ Failed:', error)
  }
}

// Run
deleteIncompleteUser()
