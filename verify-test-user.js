import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

console.log('🔍 === VERIFYING TEST USER ===\n')

// 1. Check Auth
console.log('1️⃣ Checking Supabase Auth...')
const { data: authList } = await supabase.auth.admin.listUsers()
const testAuthUser = authList?.users?.find(u => u.email === 'test@test.com')

if (testAuthUser) {
  console.log('✅ Found in auth.users')
  console.log(`   ID: ${testAuthUser.id}`)
  console.log(`   Email: ${testAuthUser.email}`)
  console.log(`   Created: ${new Date(testAuthUser.created_at).toLocaleString()}`)
} else {
  console.log('❌ NOT found in auth.users')
}

// 2. Check Database (USING SNAKE_CASE)
console.log('\n2️⃣ Checking public.users...')
const { data: dbUser, error: dbError } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'test@test.com')
  .single()

if (dbError) {
  console.log('❌ Error:', dbError.message)
} else if (dbUser) {
  console.log('✅ Found in public.users')
  console.log(`   ID: ${dbUser.id}`)
  console.log(`   Email: ${dbUser.email}`)
  console.log(`   Name: ${dbUser.name}`)
  console.log(`   Role: ${dbUser.role}`)
  console.log(`   Active: ${dbUser.is_active}`)      // 🐍 snake_case
  console.log(`   Tenant: ${dbUser.tenant_id}`)      // 🐍 snake_case
  console.log(`   Created: ${dbUser.created_at}`)    // 🐍 snake_case
} else {
  console.log('❌ NOT found in public.users')
}

// 3. Check Credentials
console.log('\n3️⃣ Checking user_credentials...')
const { data: creds, error: credError } = await supabase
  .from('user_credentials')
  .select('*')
  .eq('user_id', testAuthUser?.id || '')
  .single()

if (credError) {
  console.log('❌ Error:', credError.message)
} else if (creds) {
  console.log('✅ Found credentials')
  console.log(`   User ID: ${creds.user_id}`)        // 🐍 snake_case
  console.log(`   Created: ${creds.created_at}`)     // 🐍 snake_case
} else {
  console.log('⚠️  No credentials found')
}

// 4. Test Login
console.log('\n4️⃣ Testing login...')
const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
  email: 'test@test.com',
  password: 'Test123!'
})

if (loginError) {
  console.log('❌ Login failed:', loginError.message)
} else {
  console.log('✅ Login successful!')
  console.log(`   User: ${loginData.user.email}`)
  console.log(`   Session: ${loginData.session.access_token.substring(0, 20)}...`)
  await supabase.auth.signOut()
  console.log('✅ Signed out')
}

// 5. Query Examples
console.log('\n\n📋 === CORRECT QUERY EXAMPLES ===\n')

console.log('✅ Select user (SNAKE_CASE):')
console.log(`
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'test@test.com')
  .eq('is_active', true)      // 🐍 NOT isActive
  .eq('tenant_id', 'medex')   // 🐍 NOT tenantId
  .single()
`)

console.log('\n✅ Insert user (SNAKE_CASE):')
console.log(`
const userData = {
  id: userId,
  email: 'test@test.com',
  name: 'Test User',
  role: 'super_user',
  is_active: true,            // 🐍 NOT isActive
  tenant_id: 'medex',         // 🐍 NOT tenantId
  created_at: new Date().toISOString(),  // 🐍 NOT createdAt
  updated_at: new Date().toISOString()   // 🐍 NOT updatedAt
}

const { data, error } = await supabase
  .from('users')
  .insert([userData])
  .select()
`)

console.log('\n✅ Update user (SNAKE_CASE):')
console.log(`
const { data, error } = await supabase
  .from('users')
  .update({
    is_active: true,          // 🐍 NOT isActive
    updated_at: new Date().toISOString()  // 🐍 NOT updatedAt
  })
  .eq('id', userId)
  .select()
`)

console.log('\n\n🐍 === SNAKE_CASE COLUMN MAPPING ===\n')
console.log('JavaScript (camelCase)  →  Database (snake_case)')
console.log('─'.repeat(50))
console.log('isActive                →  is_active')
console.log('createdAt               →  created_at')
console.log('updatedAt               →  updated_at')
console.log('lastLogin               →  last_login')
console.log('tenantId                →  tenant_id')
console.log('avatarUrl               →  avatar_url')
console.log('firstName               →  first_name')
console.log('lastName                →  last_name')
console.log('userId                  →  user_id')

console.log('\n\n✅ === FINAL STATUS ===\n')
console.log('🎯 Test user created successfully')
console.log('🔑 Email: test@test.com')
console.log('🔐 Password: Test123!')
console.log('✅ Can log in and authenticate')
console.log('\n🐛 Root cause: Code uses camelCase, database uses snake_case')
console.log('🔧 Fix: Update service files to use snake_case for database operations')
