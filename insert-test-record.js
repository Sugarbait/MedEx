/**
 * Insert test Call and SMS records into Supabase
 * This will trigger toast notifications when page is loaded/refreshed
 */

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE'

async function insertTestCall() {
  console.log('\n📞 Inserting test call record...')

  const testCall = {
    call_id: `test_call_${Date.now()}`,
    start_timestamp: new Date().toISOString(),
    from_number: '+1234567890',
    call_status: 'completed',
    call_length_ms: 30000
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
      console.log('✅ Test call inserted successfully!')
      console.log(`   Call ID: ${testCall.call_id}`)
      console.log(`   Timestamp: ${testCall.start_timestamp}`)
      console.log(`   Status: ${testCall.call_status}`)
      console.log('\n🔔 REFRESH YOUR BROWSER TO SEE TOAST NOTIFICATION!')
      return true
    } else {
      const error = await response.text()
      console.error(`❌ Failed to insert call: ${response.status}`)
      console.error(`   Error: ${error}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Error inserting call: ${error.message}`)
    return false
  }
}

async function insertTestSMS() {
  console.log('\n💬 Inserting test SMS record...')

  const testSMS = {
    from_number: '+1234567890',
    content: 'Test SMS for toast notification',
    direction: 'inbound',
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
      console.log('✅ Test SMS inserted successfully!')
      console.log(`   SMS ID: ${inserted[0]?.id || 'N/A'}`)
      console.log(`   Timestamp: ${testSMS.created_at}`)
      console.log(`   Content: ${testSMS.content}`)
      console.log('\n🔔 REFRESH YOUR BROWSER TO SEE TOAST NOTIFICATION!')
      return true
    } else {
      const error = await response.text()
      console.error(`❌ Failed to insert SMS: ${response.status}`)
      console.error(`   Error: ${error}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Error inserting SMS: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 TOAST NOTIFICATION TEST - INSERT TEST RECORDS')
  console.log('='.repeat(80))

  const args = process.argv.slice(2)
  const type = args[0] || 'both'

  if (type === 'call' || type === 'both') {
    await insertTestCall()
  }

  if (type === 'sms' || type === 'both') {
    await insertTestSMS()
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Test records inserted!')
  console.log('\nNext steps:')
  console.log('1. Open http://localhost:3002 in your browser')
  console.log('2. Login if needed')
  console.log('3. Wait 2-3 seconds')
  console.log('4. REFRESH the page (F5 or Ctrl+R)')
  console.log('5. You should see toast notification(s) appear in bottom-right')
  console.log('='.repeat(80) + '\n')
}

main()
