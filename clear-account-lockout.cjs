/**
 * Clear Account Lockout for test@test.com
 *
 * This script clears the failed login attempts and lockout for test@test.com
 * so you can test Azure login immediately after fixing the GitHub secrets.
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Connecting to MedEx Supabase...')
console.log('URL:', SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function clearAccountLockout() {
  const email = 'test@test.com'

  console.log(`\n🔓 Clearing account lockout for: ${email}\n`)

  try {
    // Step 1: Find the user
    console.log('1️⃣ Finding user in database...')
    const { data: users, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('tenant_id', 'medex')

    if (findError) {
      console.error('❌ Error finding user:', findError.message)
      return
    }

    if (!users || users.length === 0) {
      console.log('⚠️  User not found in database')
      return
    }

    const user = users[0]
    console.log('✅ User found:', user.id)
    console.log('   Email:', user.email)
    console.log('   Current lockout status:', user.is_locked || false)
    console.log('   Failed attempts:', user.failed_login_attempts || 0)

    // Step 2: Clear lockout in database
    console.log('\n2️⃣ Clearing lockout in database...')
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_locked: false,
        failed_login_attempts: 0,
        lockout_until: null,
        last_failed_login: null
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Error updating user:', updateError.message)
      return
    }

    console.log('✅ Database lockout cleared')

    // Step 3: Clear failed_login_attempts table
    console.log('\n3️⃣ Clearing failed login attempts table...')
    const { error: deleteError } = await supabase
      .from('failed_login_attempts')
      .delete()
      .eq('email', email)

    if (deleteError) {
      console.log('⚠️  Note: Could not clear failed_login_attempts table:', deleteError.message)
    } else {
      console.log('✅ Failed login attempts cleared')
    }

    // Step 4: Verify the fix
    console.log('\n4️⃣ Verifying account status...')
    const { data: verifyUser } = await supabase
      .from('users')
      .select('email, is_locked, failed_login_attempts, lockout_until')
      .eq('id', user.id)
      .single()

    console.log('\n✅ Account Status After Fix:')
    console.log('   Email:', verifyUser.email)
    console.log('   Locked:', verifyUser.is_locked || false)
    console.log('   Failed Attempts:', verifyUser.failed_login_attempts || 0)
    console.log('   Lockout Until:', verifyUser.lockout_until || 'None')

    console.log('\n🎉 SUCCESS! Account lockout cleared!')
    console.log('📌 You can now login with test@test.com after GitHub secrets are updated\n')

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

clearAccountLockout()
