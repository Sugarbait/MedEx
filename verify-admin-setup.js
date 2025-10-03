/**
 * Verify Admin Setup
 * Check both auth and database records for admin@phaetonai.com
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function verifyAdminSetup() {
  console.log('🔍 Verifying admin@phaetonai.com setup...\n')

  try {
    // Check auth users
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const adminAuthUser = authUsers?.users?.find(u => u.email === 'admin@phaetonai.com')

    console.log('📊 Supabase Auth Status:')
    if (adminAuthUser) {
      console.log('   ✅ Found in auth.users')
      console.log(`   Auth ID: ${adminAuthUser.id}`)
      console.log(`   Email: ${adminAuthUser.email}`)
      console.log(`   Email Confirmed: ${adminAuthUser.email_confirmed_at ? 'Yes' : 'No'}`)
      console.log(`   Created: ${adminAuthUser.created_at}`)
      console.log(`   Last Sign In: ${adminAuthUser.last_sign_in_at || 'Never'}`)
    } else {
      console.log('   ❌ Not found in auth.users')
    }

    // Check database users
    const { data: dbUsers } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@phaetonai.com')

    console.log('\n📊 Database Status:')
    if (dbUsers && dbUsers.length > 0) {
      console.log('   ✅ Found in users table')
      dbUsers.forEach(user => {
        console.log(`   User ID: ${user.id}`)
        console.log(`   Email: ${user.email}`)
        console.log(`   Name: ${user.name || 'Not set'}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   Tenant: ${user.tenant_id}`)
        console.log(`   Active: ${user.is_active}`)
      })
    } else {
      console.log('   ❌ Not found in users table')
    }

    // Check if IDs match
    if (adminAuthUser && dbUsers && dbUsers.length > 0) {
      console.log('\n🔗 ID Matching:')
      if (adminAuthUser.id === dbUsers[0].id) {
        console.log('   ✅ Auth ID matches Database ID')
      } else {
        console.log('   ⚠️  ID MISMATCH!')
        console.log(`   Auth ID:     ${adminAuthUser.id}`)
        console.log(`   Database ID: ${dbUsers[0].id}`)
        console.log('   This will prevent login!')
      }
    }

    // Test password by attempting sign in
    console.log('\n🔐 Testing Password:')
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@phaetonai.com',
      password: 'MedExAdmin2025!'
    })

    if (signInError) {
      console.log('   ❌ Password test failed:', signInError.message)
    } else {
      console.log('   ✅ Password is correct!')
      console.log('   Issue might be with application login logic')
    }

  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

// Run
verifyAdminSetup()
