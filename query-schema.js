/**
 * Query Supabase to see actual table schemas
 */

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE'

async function queryCallsSchema() {
  console.log('\n📞 Querying calls table schema...')

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/calls?limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  )

  if (response.ok) {
    const calls = await response.json()
    if (calls.length > 0) {
      console.log('✅ Sample call record:')
      console.log(JSON.stringify(calls[0], null, 2))
    } else {
      console.log('⚠️  No calls in database')
    }
  } else {
    console.error(`❌ Error: ${response.status}`)
  }
}

async function querySMSSchema() {
  console.log('\n💬 Querying sms_messages table schema...')

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sms_messages?limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  )

  if (response.ok) {
    const messages = await response.json()
    if (messages.length > 0) {
      console.log('✅ Sample SMS record:')
      console.log(JSON.stringify(messages[0], null, 2))
    } else {
      console.log('⚠️  No SMS messages in database')
    }
  } else {
    console.error(`❌ Error: ${response.status}`)
  }
}

async function main() {
  await queryCallsSchema()
  await querySMSSchema()
}

main()
