/**
 * Comprehensive fetch of both calls and chats from all possible sources
 */

const RETELL_API_KEY = 'key_c3f084f5ca67781070e188b47d7f'
const AGENT_ID_VOICE = 'agent_447a1b9da540237693b0440df6'
const AGENT_ID_SMS = 'agent_643486efd4b5a0e9d7e094ab99'
const USD_TO_CAD = 1.45
const TWILIO_VOICE_RATE = 0.022
const TWILIO_SMS_RATE = 0.0083

async function fetchCallsAllMethods() {
  console.log('\n' + '='.repeat(80))
  console.log('📞 TRYING ALL METHODS TO FETCH CALLS')
  console.log('='.repeat(80))

  // Method 1: No filters
  console.log('\n1️⃣  Method 1: No filters, sort descending...')
  try {
    const response1 = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort_order: 'descending',
        limit: 1000
      })
    })

    if (response1.ok) {
      const data1 = await response1.json()
      console.log(`   ✅ Found ${data1.calls?.length || 0} calls`)
      if (data1.calls && data1.calls.length > 0) {
        return data1.calls
      }
    } else {
      console.log(`   ❌ Failed: ${response1.status}`)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }

  // Method 2: With agent_id filter
  console.log('\n2️⃣  Method 2: With agent_id filter...')
  try {
    const response2 = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort_order: 'descending',
        limit: 1000,
        filter_criteria: {
          agent_id: [AGENT_ID_VOICE]
        }
      })
    })

    if (response2.ok) {
      const data2 = await response2.json()
      console.log(`   ✅ Found ${data2.calls?.length || 0} calls`)
      if (data2.calls && data2.calls.length > 0) {
        return data2.calls
      }
    } else {
      console.log(`   ❌ Failed: ${response2.status}`)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }

  // Method 3: With date range (last 30 days)
  console.log('\n3️⃣  Method 3: Last 30 days...')
  try {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    const response3 = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort_order: 'descending',
        limit: 1000,
        filter_criteria: {
          start_timestamp: {
            lower_threshold: thirtyDaysAgo
          }
        }
      })
    })

    if (response3.ok) {
      const data3 = await response3.json()
      console.log(`   ✅ Found ${data3.calls?.length || 0} calls`)
      if (data3.calls && data3.calls.length > 0) {
        return data3.calls
      }
    } else {
      console.log(`   ❌ Failed: ${response3.status}`)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }

  // Method 4: Sort ascending (oldest first)
  console.log('\n4️⃣  Method 4: Sort ascending (oldest first)...')
  try {
    const response4 = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort_order: 'ascending',
        limit: 1000
      })
    })

    if (response4.ok) {
      const data4 = await response4.json()
      console.log(`   ✅ Found ${data4.calls?.length || 0} calls`)
      if (data4.calls && data4.calls.length > 0) {
        return data4.calls.reverse() // Reverse to get newest first
      }
    } else {
      console.log(`   ❌ Failed: ${response4.status}`)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`)
  }

  console.log('\n⚠️  NO CALLS FOUND IN ANY METHOD')
  console.log('   Possible reasons:')
  console.log('   - Your Retell account has no voice calls yet')
  console.log('   - All calls were deleted/archived')
  console.log('   - Account only has SMS chats, no phone calls')

  return []
}

function displayCalls(calls) {
  if (calls.length === 0) return

  console.log('\n' + '='.repeat(80))
  console.log('📞 VOICE CALLS - COST BREAKDOWN')
  console.log('='.repeat(80))
  console.log(`\nShowing 5 most recent calls:\n`)

  calls.slice(0, 5).forEach((call, index) => {
    const duration = call.duration_ms ? call.duration_ms / 1000 : 0
    const minutes = Math.ceil(duration / 60)

    const retellCents = call.call_cost?.combined_cost || 0
    const retellUSD = retellCents / 100
    const retellCAD = retellUSD * USD_TO_CAD

    const twilioUSD = minutes * TWILIO_VOICE_RATE
    const twilioCAD = twilioUSD * USD_TO_CAD

    const totalUSD = retellUSD + twilioUSD
    const totalCAD = retellCAD + twilioCAD

    const date = new Date(call.start_timestamp)
    const timeAgo = getTimeAgo(call.start_timestamp)

    console.log(`\n${index + 1}. Call ID: ${call.call_id.substring(0, 35)}...`)
    console.log(`   Phone: ${call.from_number || 'N/A'}`)
    console.log(`   Time: ${date.toLocaleString()} (${timeAgo})`)
    console.log(`   Duration: ${Math.floor(duration)}s (${minutes} billed minutes)`)
    console.log(`   Status: ${call.call_status}`)
    console.log(`   ` + '-'.repeat(76))
    console.log(`   Retell AI Voice:  $${retellUSD.toFixed(4)} USD × 1.45 = $${retellCAD.toFixed(4)} CAD`)
    console.log(`   Twilio Voice:     $${twilioUSD.toFixed(4)} USD × 1.45 = $${twilioCAD.toFixed(4)} CAD`)
    console.log(`   ` + '='.repeat(76))
    console.log(`   TOTAL:            $${totalUSD.toFixed(4)} USD × 1.45 = $${totalCAD.toFixed(4)} CAD`)
  })
}

async function fetchChats() {
  console.log('\n\n' + '='.repeat(80))
  console.log('💬 SMS CHATS - COST BREAKDOWN')
  console.log('='.repeat(80))

  try {
    const response = await fetch('https://api.retellai.com/v2/list-chats', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort_order: 'descending',
        limit: 100
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const chats = data.chats || []

    console.log(`\nFound ${chats.length} total chats`)
    console.log(`Showing 5 most recent chats:\n`)

    chats.slice(0, 5).forEach((chat, index) => {
      const messageCount = chat.message_with_tool_calls?.length || 0

      const retellCents = chat.chat_cost?.combined_cost || 0
      const retellUSD = retellCents / 100
      const retellWithFee = retellUSD > 0 ? retellUSD : 0.03
      const retellCAD = retellWithFee * USD_TO_CAD

      let totalChars = 0
      if (chat.message_with_tool_calls) {
        chat.message_with_tool_calls.forEach(msg => {
          totalChars += (msg.content || '').length
        })
      }
      const segments = Math.ceil(totalChars / 160) + 4
      const twilioUSD = segments * TWILIO_SMS_RATE
      const twilioCAD = twilioUSD * USD_TO_CAD

      const totalUSD = retellWithFee + twilioUSD
      const totalCAD = retellCAD + twilioCAD

      const date = new Date(chat.start_timestamp)
      const timeAgo = getTimeAgo(chat.start_timestamp)
      const feeNote = retellUSD === 0 ? ' (added $0.03 fee)' : ''

      console.log(`\n${index + 1}. Chat ID: ${chat.chat_id.substring(0, 35)}...`)
      console.log(`   Phone: ${chat.access_phone_number || 'N/A'}`)
      console.log(`   Time: ${date.toLocaleString()} (${timeAgo})`)
      console.log(`   Messages: ${messageCount}, Segments: ${segments}`)
      console.log(`   Status: ${chat.chat_status}`)
      console.log(`   ` + '-'.repeat(76))
      console.log(`   Retell AI Chat:   $${retellWithFee.toFixed(4)} USD × 1.45 = $${retellCAD.toFixed(4)} CAD${feeNote}`)
      console.log(`   Twilio SMS:       $${twilioUSD.toFixed(4)} USD × 1.45 = $${twilioCAD.toFixed(4)} CAD`)
      console.log(`   ` + '='.repeat(76))
      console.log(`   TOTAL:            $${totalUSD.toFixed(4)} USD × 1.45 = $${totalCAD.toFixed(4)} CAD`)
    })

  } catch (error) {
    console.error(`\n❌ Error fetching chats: ${error.message}`)
  }
}

function getTimeAgo(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return `${seconds} second${seconds !== 1 ? 's' : ''} ago`
}

async function main() {
  console.log('\n🔍 COMPREHENSIVE RETELL AI DATA FETCH')
  console.log('Exchange Rate: 1 USD = 1.45 CAD (FIXED)')
  console.log('Twilio Voice: $0.022 USD/min')
  console.log('Twilio SMS: $0.0083 USD/segment')
  console.log('Voice Agent: ' + AGENT_ID_VOICE)
  console.log('SMS Agent: ' + AGENT_ID_SMS)

  const calls = await fetchCallsAllMethods()
  displayCalls(calls)

  await fetchChats()

  console.log('\n\n✅ Fetch complete!')
  console.log('='.repeat(80) + '\n')
}

main()
