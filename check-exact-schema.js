import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log('🔍 === CHECKING EXACT USERS TABLE SCHEMA ===\n')

  // Method 1: Try to insert with empty data to see what columns are expected
  const { error } = await supabase
    .from('users')
    .insert([{}])
    .select()

  if (error) {
    console.log('Expected columns (from error):')
    console.log(error.message)
  }

  // Method 2: Get any existing user to see actual column names
  const { data: sampleUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .limit(1)

  if (selectError) {
    console.log('\n❌ Error getting sample:', selectError.message)
  } else if (sampleUser && sampleUser.length > 0) {
    console.log('\n✅ Actual column names from existing data:')
    console.log(Object.keys(sampleUser[0]).join(', '))
    console.log('\n📋 Full sample user:')
    console.log(JSON.stringify(sampleUser[0], null, 2))
  } else {
    console.log('\nℹ️  No users exist yet, cannot determine exact schema')

    // Try selecting with common column names
    const testColumns = [
      'id', 'email', 'name', 'role',
      'isActive', 'is_active',
      'tenant_id', 'tenantId',
      'created_at', 'createdAt', 'created',
      'updated_at', 'updatedAt', 'updated'
    ]

    for (const col of testColumns) {
      const { error: colError } = await supabase
        .from('users')
        .select(col)
        .limit(1)

      if (!colError) {
        console.log(`✅ ${col} - EXISTS`)
      }
    }
  }
}

main()
