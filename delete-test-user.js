/**
 * Delete Test User Script
 * Removes a user from the Supabase database
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function deleteTestUser() {
  try {
    console.log('🔍 Fetching all users from database...')

    // Get all users
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', 'medex')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError)
      return
    }

    if (!users || users.length === 0) {
      console.log('✅ No users found in database')
      return
    }

    console.log(`\n📊 Found ${users.length} user(s):`)
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Name: ${user.name}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Metadata Role: ${user.metadata?.original_role || 'N/A'}`)
      console.log(`   Active: ${user.is_active}`)
      console.log(`   Created: ${user.created_at}`)
    })

    // Delete all users
    console.log('\n🗑️  Deleting all users...')
    for (const user of users) {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)

      if (deleteError) {
        console.error(`❌ Error deleting user ${user.email}:`, deleteError)
      } else {
        console.log(`✅ Deleted user: ${user.email}`)
      }

      // Also delete from user_settings if exists
      const { error: settingsError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user.id)

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.log(`   ⚠️  Could not delete settings: ${settingsError.message}`)
      } else {
        console.log(`   ✅ Deleted user_settings for ${user.email}`)
      }
    }

    console.log('\n✅ All users deleted successfully!')
    console.log('💡 You can now register as the first user and get Super User role')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
deleteTestUser()
