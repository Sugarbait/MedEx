/**
 * Insert minimal test records based on database schema
 */

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE'

// Using schema from database_schema_setup.sql
async function insertTestCall() {
  console.log('\n📞 Inserting minimal test call...')

  // Minimal required fields based on schema
  const testCall = {
    user_id: '00000000-0000-0000-0000-000000000000', // Will need actual user_id
    start_time: new Date().toISOString(),
    status: 'completed'
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/calls`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(testCall)
      }
    )

    if (response.ok) {
      const inserted = await response.json()
      console.log('✅ Test call inserted!')
      console.log(`   ID: ${inserted[0]?.id}`)
      return true
    } else {
      const error = await response.text()
      console.error(`❌ Failed: ${response.status} - ${error}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    return false
  }
}

async function insertTestSMS() {
  console.log('\n💬 Inserting minimal test SMS...')

  // Minimal required fields based on schema
  const testSMS = {
    direction: 'inbound',
    encrypted_content: 'Test SMS message', // Will be encrypted in real app
    from_number: '+1234567890',
    to_number: '+10987654321',
    created_at: new Date().toISOString()
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sms_messages`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(testSMS)
      }
    )

    if (response.ok) {
      const inserted = await response.json()
      console.log('✅ Test SMS inserted!')
      console.log(`   ID: ${inserted[0]?.id}`)
      return true
    } else {
      const error = await response.text()
      console.error(`❌ Failed: ${response.status} - ${error}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    return false
  }
}

// First, get a valid user_id
async function getValidUserId() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/users?limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  )

  if (response.ok) {
    const users = await response.json()
    if (users.length > 0) {
      return users[0].id
    }
  }
  return null
}

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 TOAST NOTIFICATION TEST - INSERT MINIMAL RECORDS')
  console.log('='.repeat(80))

  // Get valid user ID first
  const userId = await getValidUserId()
  if (!userId) {
    console.error('\n❌ No users found in database. Cannot insert test records.')
    return
  }

  console.log(`\n✅ Using user_id: ${userId}`)

  const args = process.argv.slice(2)
  const type = args[0] || 'both'

  if (type === 'call' || type === 'both') {
    await insertTestCall()
  }

  if (type === 'sms' || type === 'both') {
    await insertTestSMS()
  }

  console.log('\n' + '='.repeat(80))
  console.log('Next steps:')
  console.log('1. Open http://localhost:3002')
  console.log('2. Login if needed')
  console.log('3. REFRESH the page (F5)')
  console.log('4. Check for toast notifications in bottom-right corner')
  console.log('='.repeat(80) + '\n')
}

main()
