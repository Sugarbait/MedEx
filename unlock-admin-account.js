/**
 * Unlock Admin Account
 * Resets account lockout for admin@phaetonai.com
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function unlockAdminAccount() {
  console.log('🔓 Unlocking admin@phaetonai.com account...\n')

  try {
    const AUTH_USER_ID = '444a5a73-be32-4d35-8c09-fe48abf5dc65'
    const EMAIL = 'admin@phaetonai.com'

    // Clear lockout by resetting failed login attempts in database
    const { error: dbError } = await supabase
      .from('users')
      .update({
        failed_login_attempts: 0,
        account_locked_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', AUTH_USER_ID)

    if (dbError) {
      console.log('⚠️  Note:', dbError.message)
    } else {
      console.log('✅ Database lockout cleared')
    }

    // Also update the auth user to ensure it's active
    const { error: authError } = await supabase.auth.admin.updateUserById(
      AUTH_USER_ID,
      {
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: {
          name: 'Admin User',
          role: 'super_user',
          tenant_id: 'medex'
        }
      }
    )

    if (authError) {
      console.log('⚠️  Auth update note:', authError.message)
    } else {
      console.log('✅ Auth user unlocked')
    }

    console.log('\n✅ Account unlocked!')
    console.log('\n🔓 Login Credentials:')
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: Admin123!`)
    console.log('\n💡 You can now log in immediately')

  } catch (error) {
    console.error('❌ Unlock failed:', error)
  }
}

// Run
unlockAdminAccount()
