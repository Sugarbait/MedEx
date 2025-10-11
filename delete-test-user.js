/**
 * Delete test@test.com user completely from database
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🗑️  Deleting test@test.com user completely...\n')

async function deleteTestUser() {
  try {
    // Get user ID first
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'test@test.com')

    if (users && users.length > 0) {
      const userId = users[0].id
      console.log(`Found user: ${userId}`)

      // Delete related records
      await supabase.from('user_credentials').delete().eq('user_id', userId)
      await supabase.from('user_settings').delete().eq('user_id', userId)
      await supabase.from('notes').delete().eq('user_id', userId)
      await supabase.from('users').delete().eq('id', userId)
      console.log('✅ Deleted user and related records')
    }

    // Delete failed login attempts
    await supabase.from('failed_login_attempts').delete().eq('email', 'test@test.com')
    console.log('✅ Deleted failed login attempts')

    console.log('\n✅ test@test.com COMPLETELY DELETED!\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

deleteTestUser()
