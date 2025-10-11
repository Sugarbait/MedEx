import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deleteTestUser() {
  console.log('🗑️  Checking for existing test user...\n')

  const { data: existingAuth } = await supabase.auth.admin.listUsers()
  const testUser = existingAuth?.users?.find(u => u.email === 'test@test.com')

  if (testUser) {
    console.log(`Found existing auth user: ${testUser.id}`)

    // Delete from auth
    await supabase.auth.admin.deleteUser(testUser.id)
    console.log('✅ Deleted from auth.users')

    // Delete from public.users (using snake_case!)
    await supabase
      .from('users')
      .delete()
      .eq('id', testUser.id)
    console.log('✅ Deleted from public.users')

    // Delete credentials
    await supabase
      .from('user_credentials')
      .delete()
      .eq('user_id', testUser.id)
    console.log('✅ Deleted credentials\n')
  } else {
    console.log('ℹ️  No existing test user found\n')
  }
}

async function createTestUser() {
  console.log('🆕 === CREATING TEST USER (FIXED SCHEMA) ===\n')

  const testEmail = 'test@test.com'
  const testPassword = 'Test123!'
  const testName = 'Test User'

  // Step 1: Create in Supabase Auth
  console.log('Step 1: Creating in Supabase Auth...')
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      name: testName,
      role: 'super_user'
    }
  })

  if (authError) {
    console.log('❌ Auth creation failed:', authError.message)
    return null
  }

  console.log('✅ Created in auth.users')
  console.log(`   User ID: ${authData.user.id}\n`)

  const userId = authData.user.id

  // Step 2: Create in public.users (USING SNAKE_CASE!)
  console.log('Step 2: Creating in public.users...')

  const userData = {
    id: userId,
    email: testEmail,
    name: testName,
    role: 'super_user',
    is_active: true,  // ✅ SNAKE_CASE!
    tenant_id: 'medex',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data: dbData, error: dbError } = await supabase
    .from('users')
    .insert([userData])
    .select()

  if (dbError) {
    console.log('❌ Database creation failed:', dbError.message)
    console.log('Error details:', JSON.stringify(dbError, null, 2))

    // Clean up auth user
    await supabase.auth.admin.deleteUser(userId)
    console.log('🗑️  Cleaned up auth user')
    return null
  }

  console.log('✅ Created in public.users')
  console.log('User data:', JSON.stringify(dbData[0], null, 2))

  // Step 3: Create credentials
  console.log('\nStep 3: Creating user credentials...')

  // Use base64 for simple hashing (production should use bcrypt)
  const hashedPassword = Buffer.from(testPassword).toString('base64')

  const { data: credData, error: credError } = await supabase
    .from('user_credentials')
    .insert([{
      user_id: userId,
      password: hashedPassword,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()

  if (credError) {
    console.log('⚠️  Credentials creation failed:', credError.message)
    console.log('(User can still log in via Supabase Auth)')
  } else {
    console.log('✅ Created credentials')
  }

  return userId
}

async function verifyTestUser(userId) {
  console.log('\n🔍 === VERIFYING TEST USER ===\n')

  // Check auth.users
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
  if (authError) {
    console.log('❌ Auth verification failed:', authError.message)
  } else {
    console.log('✅ Found in auth.users:', authUser.user.email)
  }

  // Check public.users (USING SNAKE_CASE!)
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (dbError) {
    console.log('❌ Database verification failed:', dbError.message)
  } else {
    console.log('✅ Found in public.users:', dbUser.email)
    console.log(`   - Name: ${dbUser.name}`)
    console.log(`   - Role: ${dbUser.role}`)
    console.log(`   - Active: ${dbUser.is_active}`)  // ✅ SNAKE_CASE!
    console.log(`   - Tenant: ${dbUser.tenant_id}`)
  }

  // Check credentials
  const { data: creds, error: credError } = await supabase
    .from('user_credentials')
    .select('user_id')
    .eq('user_id', userId)
    .single()

  if (credError) {
    console.log('⚠️  No credentials found (will use Supabase Auth)')
  } else {
    console.log('✅ Found credentials for user')
  }

  // Test login
  console.log('\n🔐 === TESTING LOGIN ===\n')
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'test@test.com',
    password: 'Test123!'
  })

  if (loginError) {
    console.log('❌ Login failed:', loginError.message)
  } else {
    console.log('✅ LOGIN SUCCESSFUL!')
    console.log(`   - User ID: ${loginData.user.id}`)
    console.log(`   - Email: ${loginData.user.email}`)
    console.log(`   - Session expires: ${new Date(loginData.session.expires_at * 1000).toLocaleString()}`)

    // Sign out
    await supabase.auth.signOut()
    console.log('✅ Signed out successfully')
  }
}

async function showAllUsers() {
  console.log('\n👥 === ALL MEDEX USERS ===\n')

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, role, is_active, tenant_id')
    .eq('tenant_id', 'medex')

  if (error) {
    console.log('❌ Error:', error.message)
    return
  }

  console.log(`Total users: ${users.length}\n`)
  users.forEach((user, i) => {
    console.log(`${i + 1}. ${user.email}`)
    console.log(`   - Name: ${user.name}`)
    console.log(`   - Role: ${user.role}`)
    console.log(`   - Active: ${user.is_active}`)
    console.log(`   - ID: ${user.id}\n`)
  })
}

async function main() {
  console.log('🚀 === MEDEX USER CREATION (FIXED) ===\n')

  try {
    // Delete any existing test user
    await deleteTestUser()

    // Create test user
    const userId = await createTestUser()

    if (userId) {
      // Verify creation
      await verifyTestUser(userId)

      // Show all users
      await showAllUsers()

      console.log('\n✅ === SUCCESS ===')
      console.log('\n📋 Test user created successfully!')
      console.log('\n🔑 Login credentials:')
      console.log('   Email: test@test.com')
      console.log('   Password: Test123!')
      console.log('\n🐛 Root cause identified:')
      console.log('   ❌ Code was using: isActive (camelCase)')
      console.log('   ✅ Database expects: is_active (snake_case)')
      console.log('\n📝 Fix required:')
      console.log('   Update userManagementService.ts and userProfileService.ts')
      console.log('   Change all instances of "isActive" to "is_active"')

    } else {
      console.log('\n❌ === FAILED ===')
      console.log('\nUser creation failed. Check errors above.')
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error)
  }
}

main()
