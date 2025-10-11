import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkUsersTableSchema() {
  console.log('\n📋 === CHECKING USERS TABLE SCHEMA ===\n')

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1)

  if (error) {
    console.log('❌ Error querying users table:', error.message)
    return null
  }

  console.log('✅ Users table exists and is accessible')

  // Get column info from pg_catalog
  const { data: columns, error: schemaError } = await supabase.rpc('get_table_columns', {
    table_name: 'users'
  })

  if (schemaError) {
    console.log('⚠️  Could not get detailed schema, using sample data')
    if (data && data.length > 0) {
      console.log('\nSample user structure:')
      console.log(JSON.stringify(data[0], null, 2))
    }
  } else {
    console.log('\nTable columns:', columns)
  }

  return data
}

async function checkUserCredentialsTable() {
  console.log('\n📋 === CHECKING USER_CREDENTIALS TABLE ===\n')

  const { data, error } = await supabase
    .from('user_credentials')
    .select('*')
    .limit(1)

  if (error) {
    console.log('❌ Error querying user_credentials table:', error.message)
    return false
  }

  console.log('✅ user_credentials table exists')
  return true
}

async function deleteTestUser() {
  console.log('\n🗑️  === DELETING EXISTING TEST USER ===\n')

  // Find test user
  const { data: existingUsers } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'test@test.com')

  if (existingUsers && existingUsers.length > 0) {
    const userId = existingUsers[0].id
    console.log(`Found existing test user with ID: ${userId}`)

    // Delete from auth
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      console.log('⚠️  Auth delete error:', authDeleteError.message)
    } else {
      console.log('✅ Deleted from auth.users')
    }

    // Delete from public.users
    const { error: dbDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbDeleteError) {
      console.log('⚠️  DB delete error:', dbDeleteError.message)
    } else {
      console.log('✅ Deleted from public.users')
    }

    // Delete credentials
    const { error: credDeleteError } = await supabase
      .from('user_credentials')
      .delete()
      .eq('user_id', userId)

    if (credDeleteError) {
      console.log('⚠️  Credentials delete error:', credDeleteError.message)
    } else {
      console.log('✅ Deleted from user_credentials')
    }
  } else {
    console.log('ℹ️  No existing test user found')
  }
}

async function createTestUser() {
  console.log('\n🆕 === CREATING TEST USER ===\n')

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

  console.log('✅ Created in auth.users with ID:', authData.user.id)

  const userId = authData.user.id

  // Step 2: Create in public.users
  console.log('\nStep 2: Creating in public.users...')

  const userData = {
    id: userId,
    email: testEmail,
    name: testName,
    role: 'super_user',
    isActive: true,
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
  console.log('User data:', JSON.stringify(dbData, null, 2))

  // Step 3: Create credentials (hashed password)
  console.log('\nStep 3: Creating user credentials...')

  // Simple hash for testing (in production, use bcrypt)
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

  // Check public.users
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (dbError) {
    console.log('❌ Database verification failed:', dbError.message)
  } else {
    console.log('✅ Found in public.users:', dbUser.email)
    console.log('   - Role:', dbUser.role)
    console.log('   - Active:', dbUser.isActive)
    console.log('   - Tenant:', dbUser.tenant_id)
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
  console.log('\n🔐 Testing login...')
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'test@test.com',
    password: 'Test123!'
  })

  if (loginError) {
    console.log('❌ Login failed:', loginError.message)
  } else {
    console.log('✅ LOGIN SUCCESSFUL!')
    console.log('   - User ID:', loginData.user.id)
    console.log('   - Email:', loginData.user.email)

    // Sign out
    await supabase.auth.signOut()
  }
}

async function checkExistingUsers() {
  console.log('\n👥 === CHECKING EXISTING USERS ===\n')

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, role, isActive, tenant_id')
    .eq('tenant_id', 'medex')

  if (error) {
    console.log('❌ Error:', error.message)
    return
  }

  console.log(`Found ${users.length} MedEx users:`)
  users.forEach((user, i) => {
    console.log(`\n${i + 1}. ${user.email}`)
    console.log(`   - Name: ${user.name}`)
    console.log(`   - Role: ${user.role}`)
    console.log(`   - Active: ${user.isActive}`)
    console.log(`   - ID: ${user.id}`)
  })
}

async function main() {
  console.log('🚀 === MEDEX USER CREATION DIAGNOSTICS ===\n')

  try {
    // Check existing users
    await checkExistingUsers()

    // Check schema
    await checkUsersTableSchema()
    await checkUserCredentialsTable()

    // Delete any existing test user
    await deleteTestUser()

    // Create test user
    const userId = await createTestUser()

    if (userId) {
      // Verify creation
      await verifyTestUser(userId)

      console.log('\n✅ === SUCCESS ===')
      console.log('\nTest user created successfully!')
      console.log('Email: test@test.com')
      console.log('Password: Test123!')
      console.log('\nYou can now log in with these credentials.')
    } else {
      console.log('\n❌ === FAILED ===')
      console.log('\nUser creation failed. Check errors above.')
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error)
  }
}

main()
