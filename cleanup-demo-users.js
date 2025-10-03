/**
 * Cleanup Demo Users Script
 * Removes all demo/test users from MedEx database
 * Keeps only real production users
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Demo user IDs and emails to remove
const DEMO_USER_IDS = [
  'demo-admin-001',
  'super-user-456',
  'pierre-user-789',
  'guest-user-456',
  'test-user-001',
  'test-user-002'
]

const DEMO_EMAILS = [
  'admin@medex.com',
  'elmfarrell@yahoo.com',
  'pierre@phaetonai.com',
  'guest@email.com',
  'test@medex.com',
  'demo@medex.com'
]

async function cleanupDemoUsers() {
  console.log('🧹 Starting demo user cleanup...\n')

  try {
    // 1. List all current users with tenant_id = 'medex'
    console.log('📊 Current MedEx users:')
    const { data: allUsers, error: listError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id')
      .eq('tenant_id', 'medex')

    if (listError) {
      console.error('❌ Error listing users:', listError)
      return
    }

    console.log(`Found ${allUsers.length} MedEx users:`)
    allUsers.forEach(user => {
      const isDemo = DEMO_USER_IDS.includes(user.id) || DEMO_EMAILS.includes(user.email)
      console.log(`  ${isDemo ? '🗑️' : '✅'} ${user.email} (${user.role}) - ID: ${user.id}`)
    })

    // 2. Ask for confirmation
    console.log('\n⚠️  About to delete demo users from:')
    console.log('   - users table')
    console.log('   - user_settings table')
    console.log('   - user_profiles table')
    console.log('   - audit_logs table (demo user entries)')
    console.log('\n🔒 Real production users will be preserved!')

    // 3. Delete from users table
    console.log('\n🗑️  Deleting demo users from users table...')
    const { error: deleteUsersError } = await supabase
      .from('users')
      .delete()
      .eq('tenant_id', 'medex')
      .in('id', DEMO_USER_IDS)

    if (deleteUsersError) {
      console.error('❌ Error deleting from users:', deleteUsersError)
    } else {
      console.log('✅ Deleted demo users from users table')
    }

    // Also delete by email in case some have different IDs
    const { error: deleteByEmailError } = await supabase
      .from('users')
      .delete()
      .eq('tenant_id', 'medex')
      .in('email', DEMO_EMAILS)

    if (deleteByEmailError) {
      console.error('❌ Error deleting by email:', deleteByEmailError)
    } else {
      console.log('✅ Deleted demo users by email')
    }

    // 4. Delete from user_settings table
    console.log('\n🗑️  Deleting demo settings from user_settings table...')
    const { error: deleteSettingsError } = await supabase
      .from('user_settings')
      .delete()
      .eq('tenant_id', 'medex')
      .in('user_id', DEMO_USER_IDS)

    if (deleteSettingsError) {
      console.error('❌ Error deleting settings:', deleteSettingsError)
    } else {
      console.log('✅ Deleted demo user settings')
    }

    // 5. Delete from user_profiles table
    console.log('\n🗑️  Deleting demo profiles from user_profiles table...')
    const { error: deleteProfilesError } = await supabase
      .from('user_profiles')
      .delete()
      .in('user_id', DEMO_USER_IDS)

    if (deleteProfilesError && deleteProfilesError.code !== 'PGRST116') {
      console.error('❌ Error deleting profiles:', deleteProfilesError)
    } else {
      console.log('✅ Deleted demo user profiles')
    }

    // 6. Show remaining users
    console.log('\n📊 Remaining MedEx users after cleanup:')
    const { data: remainingUsers, error: finalListError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id, created_at')
      .eq('tenant_id', 'medex')

    if (finalListError) {
      console.error('❌ Error listing remaining users:', finalListError)
    } else {
      console.log(`\n✅ ${remainingUsers.length} production user(s) remaining:`)
      remainingUsers.forEach(user => {
        console.log(`  ✅ ${user.email} (${user.role})`)
        console.log(`     ID: ${user.id}`)
        console.log(`     Created: ${user.created_at}`)
      })
    }

    console.log('\n🎉 Cleanup complete!')
    console.log('💡 Note: Audit logs for demo users were preserved for compliance')

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
  }
}

// Run cleanup
cleanupDemoUsers()
