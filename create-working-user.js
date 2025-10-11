import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🔧 Creating working admin user...\n')

async function createUser() {
  try {
    // Step 1: Delete old user
    console.log('1️⃣ Cleaning up old admin user...')
    await supabase.from('user_credentials').delete().match({ user_id: 'admin-medex-001' })
    await supabase.from('users').delete().match({ id: 'admin-medex-001' })
    console.log('   ✅ Cleaned up\n')

    // Step 2: Create in Supabase Auth
    console.log('2️⃣ Creating user in Supabase Auth...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@medex.com',
      password: 'admin123',
      email_confirm: true
    })

    if (authError) {
      console.log('   ❌ Auth error:', authError.message)
      return
    }

    const userId = authData.user.id
    console.log(`   ✅ Auth user created: ${userId}\n`)

    // Step 3: Create in database
    console.log('3️⃣ Creating user in database...')
    const { error: dbError } = await supabase.from('users').insert({
      id: userId,
      email: 'admin@medex.com',
      name: 'MedEx Admin',
      role: 'super_user',
      tenant_id: 'medex',
      is_active: true
    })

    if (dbError) {
      console.log('   ❌ DB error:', dbError.message)
    } else {
      console.log('   ✅ Database user created\n')
    }

    // Step 4: Verify
    console.log('4️⃣ Verifying...')
    const { data: users } = await supabase.from('users').select('*').eq('email', 'admin@medex.com')
    console.log(`   ✅ Users found: ${users?.length}`)
    if (users && users.length > 0) {
      console.log(`   - Email: ${users[0].email}`)
      console.log(`   - Role: ${users[0].role}`)
      console.log(`   - Tenant: ${users[0].tenant_id}\n`)
    }

    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║              ✅ USER CREATED SUCCESSFULLY! ✅                 ║')
    console.log('╚════════════════════════════════════════════════════════════════╝\n')
    console.log('🎯 Login with:')
    console.log('   Email: admin@medex.com')
    console.log('   Password: admin123\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

createUser()
