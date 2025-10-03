/**
 * Repurpose Auth User
 * Convert existing auth user to admin@phaetonai.com
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

async function repurposeAuthUser() {
  console.log('🔄 Repurposing test auth user for admin@phaetonai.com...\n')

  try {
    // Use the first test user
    const AUTH_USER_ID = '444a5a73-be32-4d35-8c09-fe48abf5dc65'
    const NEW_EMAIL = 'admin@phaetonai.com'
    const NEW_PASSWORD = 'Admin123!'

    console.log('📋 Converting test user:')
    console.log(`   Auth ID: ${AUTH_USER_ID}`)
    console.log(`   New Email: ${NEW_EMAIL}`)
    console.log(`   New Password: ${NEW_PASSWORD}\n`)

    // Update the auth user's email and password
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      AUTH_USER_ID,
      {
        email: NEW_EMAIL,
        password: NEW_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: 'Admin User',
          role: 'super_user',
          tenant_id: 'medex'
        }
      }
    )

    if (updateError) {
      console.error('❌ Error updating auth user:', updateError)
      return
    }

    console.log('✅ Auth user updated successfully!')

    // Now create/update the database user record
    console.log('\n📝 Creating database user record...')

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', AUTH_USER_ID)
      .single()

    if (existingUser) {
      // Update existing record
      const { error: dbError } = await supabase
        .from('users')
        .update({
          email: NEW_EMAIL,
          name: 'Admin User',
          role: 'super_user',
          tenant_id: 'medex',
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', AUTH_USER_ID)

      if (dbError) {
        console.error('❌ Error updating database:', dbError)
        return
      }

      console.log('✅ Database user updated!')

    } else {
      // Create new record
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          id: AUTH_USER_ID,
          email: NEW_EMAIL,
          name: 'Admin User',
          role: 'super_user',
          tenant_id: 'medex',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (dbError) {
        console.error('❌ Error creating database user:', dbError)
        return
      }

      console.log('✅ Database user created!')
    }

    console.log('\n✅ Setup complete!')
    console.log('\n🔓 Login Credentials:')
    console.log(`   Email: ${NEW_EMAIL}`)
    console.log(`   Password: ${NEW_PASSWORD}`)
    console.log('\n💡 Next steps:')
    console.log('   1. Clear browser cache: localStorage.clear(); location.reload()')
    console.log('   2. Go to login page')
    console.log('   3. Use credentials above to log in')

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

// Run
repurposeAuthUser()
