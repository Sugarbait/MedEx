/**
 * Reset Admin Password
 * Sets a fresh password for admin@phaetonai.com
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

async function resetAdminPassword() {
  console.log('🔑 Resetting password for admin@phaetonai.com...\n')

  try {
    const AUTH_USER_ID = '444a5a73-be32-4d35-8c09-fe48abf5dc65'
    const EMAIL = 'admin@phaetonai.com'
    const NEW_PASSWORD = 'MedExAdmin2025!'

    console.log('📋 Account Details:')
    console.log(`   Auth ID: ${AUTH_USER_ID}`)
    console.log(`   Email: ${EMAIL}`)
    console.log(`   New Password: ${NEW_PASSWORD}\n`)

    // Update password in Supabase Auth
    const { data, error } = await supabase.auth.admin.updateUserById(
      AUTH_USER_ID,
      {
        password: NEW_PASSWORD,
        email_confirm: true
      }
    )

    if (error) {
      console.error('❌ Error resetting password:', error)
      return
    }

    console.log('✅ Password reset successfully!')
    console.log('\n🔓 NEW Login Credentials:')
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${NEW_PASSWORD}`)
    console.log('\n💡 Clear browser cache and try logging in with the new password')

  } catch (error) {
    console.error('❌ Reset failed:', error)
  }
}

// Run
resetAdminPassword()
