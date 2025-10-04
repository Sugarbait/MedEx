/**
 * Create a test pending user for debugging
 * Run with: node create-pending-user.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import crypto from 'crypto'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Hash password function (simple for testing)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function createPendingUser() {
  console.log('🔍 Creating test pending user...\n')

  const testUser = {
    email: 'pending.user@test.com',
    name: 'Test Pending User',
    role: 'user',
    is_active: false, // This is the key field!
    azure_ad_id: `placeholder_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    mfa_enabled: false,
    last_login: null,
    tenant_id: 'medex',
    metadata: {
      created_via: 'test_script',
      original_role: 'user',
      note: 'Test user for pending approvals debugging'
    }
  }

  try {
    // Check if user already exists
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('email', testUser.email)
      .eq('tenant_id', 'medex')
      .single()

    if (existing) {
      console.log('ℹ️  User already exists:')
      console.log('   Email:', existing.email)
      console.log('   is_active:', existing.is_active)
      console.log('\nDeleting existing user first...')

      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', existing.id)

      if (deleteError) {
        console.error('❌ Error deleting existing user:', deleteError)
        process.exit(1)
      }

      console.log('✅ Deleted existing user')
    }

    // Create the pending user
    console.log('\n📝 Creating user with data:')
    console.log(JSON.stringify(testUser, null, 2))

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single()

    if (createError) {
      console.error('❌ Error creating user:', createError)
      process.exit(1)
    }

    console.log('\n✅ User created successfully!')
    console.log('   ID:', newUser.id)
    console.log('   Email:', newUser.email)
    console.log('   Name:', newUser.name)
    console.log('   Role:', newUser.role)
    console.log('   is_active:', newUser.is_active)
    console.log('')

    // Also create credentials for this user
    const hashedPassword = hashPassword('Password123!')

    const credentials = {
      user_id: newUser.id,
      email: testUser.email,
      password_hash: hashedPassword,
      temp_password: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('🔐 Creating credentials...')
    const { data: credData, error: credError } = await supabase
      .from('user_credentials')
      .insert(credentials)
      .select()
      .single()

    if (credError) {
      console.warn('⚠️  Could not create credentials (table may not exist):', credError.message)
    } else {
      console.log('✅ Credentials created successfully')
    }

    // Verify the user was created with correct is_active value
    console.log('\n🔍 Verifying user in database...')
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', newUser.id)
      .single()

    if (verifyError) {
      console.error('❌ Error verifying user:', verifyError)
    } else {
      console.log('✅ Verification successful!')
      console.log('   is_active in DB:', verifyUser.is_active)
      console.log('')

      if (verifyUser.is_active === false) {
        console.log('✅ SUCCESS: User is correctly marked as inactive (pending approval)')
      } else {
        console.log('❌ ERROR: User is_active should be false but is:', verifyUser.is_active)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('NEXT STEPS:')
    console.log('='.repeat(60))
    console.log('1. Open the app and navigate to Settings > User Management')
    console.log('2. Look for the "Pending Approvals" amber section')
    console.log('3. The user "pending.user@test.com" should appear there')
    console.log('4. Check browser console for debug logs')
    console.log('')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run the function
createPendingUser()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
