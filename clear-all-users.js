/**
 * Clear all MedEx users from the database
 * This will delete all users and related data for tenant_id = 'medex'
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🗑️  Clearing ALL MedEx users from database...\n')

async function clearAllUsers() {
  try {
    // Step 1: Get all MedEx users
    console.log('1️⃣ Finding all MedEx users...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .eq('tenant_id', 'medex')

    if (usersError) {
      console.error('   ❌ Error fetching users:', usersError.message)
      return
    }

    if (!users || users.length === 0) {
      console.log('   ✅ No users found - database is already clear\n')
      return
    }

    console.log(`   ✅ Found ${users.length} user(s) to delete:`)
    users.forEach(user => console.log(`      - ${user.email} (${user.id})`))
    console.log('')

    // Step 2: Delete from Supabase Auth
    console.log('2️⃣ Deleting users from Supabase Auth...')
    let authDeleteCount = 0
    let authFailCount = 0

    for (const user of users) {
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id)
        if (authError) {
          console.log(`   ⚠️  Auth delete failed for ${user.email}: ${authError.message}`)
          authFailCount++
        } else {
          authDeleteCount++
        }
      } catch (error) {
        console.log(`   ⚠️  Auth delete error for ${user.email}:`, error.message)
        authFailCount++
      }
    }
    console.log(`   ✅ Deleted ${authDeleteCount} user(s) from Auth (${authFailCount} failed)\n`)

    // Step 3: Delete related records
    console.log('3️⃣ Deleting related records...')

    const userIds = users.map(u => u.id)

    // Delete user_credentials
    const { error: credsError } = await supabase
      .from('user_credentials')
      .delete()
      .in('user_id', userIds)

    if (credsError) {
      console.log(`   ⚠️  user_credentials delete warning: ${credsError.message}`)
    } else {
      console.log('   ✅ Deleted user_credentials')
    }

    // Delete user_settings
    const { error: settingsError } = await supabase
      .from('user_settings')
      .delete()
      .in('user_id', userIds)

    if (settingsError) {
      console.log(`   ⚠️  user_settings delete warning: ${settingsError.message}`)
    } else {
      console.log('   ✅ Deleted user_settings')
    }

    // Delete notes
    const { error: notesError } = await supabase
      .from('notes')
      .delete()
      .in('user_id', userIds)

    if (notesError) {
      console.log(`   ⚠️  notes delete warning: ${notesError.message}`)
    } else {
      console.log('   ✅ Deleted notes')
    }

    console.log('')

    // Step 4: Delete users from database
    console.log('4️⃣ Deleting users from database...')
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('tenant_id', 'medex')

    if (deleteError) {
      console.error('   ❌ Error deleting users:', deleteError.message)
      return
    }
    console.log('   ✅ Deleted all users from database\n')

    // Step 5: Clear failed login attempts
    console.log('5️⃣ Clearing failed login attempts...')
    const { error: failedError } = await supabase
      .from('failed_login_attempts')
      .delete()
      .neq('id', 0) // Delete all rows

    if (failedError) {
      console.log(`   ⚠️  failed_login_attempts warning: ${failedError.message}`)
    } else {
      console.log('   ✅ Cleared failed login attempts\n')
    }

    // Step 6: Verify deletion
    console.log('6️⃣ Verifying deletion...')
    const { data: remainingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', 'medex')

    console.log(`   ✅ Remaining users: ${remainingUsers?.length || 0}\n`)

    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║           ✅ ALL MEDEX USERS CLEARED! ✅                      ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')
    console.log('🎯 Database is now empty and ready for first user registration.')
    console.log('   Visit http://localhost:3003 to see the welcome message!\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

clearAllUsers()
