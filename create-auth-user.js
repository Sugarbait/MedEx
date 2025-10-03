/**
 * Create Auth User
 * Creates Supabase Auth user for admin@phaetonai.com
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

async function createAuthUser() {
  console.log('🔐 Creating Supabase Auth user for admin@phaetonai.com...\n')

  try {
    const EMAIL = 'admin@phaetonai.com'
    const PASSWORD = 'Admin123!'  // Change this to your desired password
    const USER_ID = 'f99057b7-23bf-4d1b-8104-1f715a1a9851'

    console.log('📋 User Details:')
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${PASSWORD}`)
    console.log(`   User ID: ${USER_ID}`)

    // Create auth user using Admin API
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,  // Auto-confirm email
      user_metadata: {
        name: 'Admin User',
        role: 'super_user'
      }
    })

    if (createError) {
      // Check if user already exists
      if (createError.message.includes('already registered')) {
        console.log('⚠️  Auth user already exists, updating password instead...')

        // Get the existing auth user
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === EMAIL)

        if (existingUser) {
          // Update password
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: PASSWORD }
          )

          if (updateError) {
            console.error('❌ Error updating password:', updateError)
            return
          }

          console.log('✅ Password updated successfully!')
          console.log(`\n📋 Auth User ID: ${existingUser.id}`)
        }
      } else {
        console.error('❌ Error creating auth user:', createError)
        return
      }
    } else {
      console.log('✅ Auth user created successfully!')
      console.log(`\n📋 Auth User ID: ${authUser.user.id}`)
    }

    console.log('\n💡 Login Credentials:')
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${PASSWORD}`)
    console.log('\n✅ You can now log in!')
    console.log('   Clear browser cache first: localStorage.clear(); location.reload()')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

// Run the setup
createAuthUser()
