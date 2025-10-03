/**
 * Fetch 5 most recent calls and chats from Retell AI
 * No date filters - just get the most recent ones available
 */

const RETELL_API_KEY = 'key_c3f084f5ca67781070e188b47d7f'
const USD_TO_CAD = 1.45
const TWILIO_VOICE_RATE = 0.022
const TWILIO_SMS_RATE = 0.0083

async function fetchRecentCalls() {
  console.log('\n' + '='.repeat(80))
  console.log('📞 RECENT CALLS - COST BREAKDOWN')
  console.log('='.repeat(80))

  try {
    const response = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sort_order: 'descending',
        limit: 100 // Get more to find recent ones
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const calls = data.calls || []

    console.log(`\nFound ${calls.length} total calls in system`)

    if (calls.length === 0) {
      console.log('\n⚠️  No calls found in your Retell AI account.')
      console.log('   This could mean:')
      console.log('   - No calls have been made yet')
      console.log('   - Calls were archived or deleted')
      console.log('   - Using wrong API key or agent ID')
      return
    }

    // Get 5 most recent
    const recent = calls.slice(0, 5)

    console.log(`\nShowing 5 most recent calls:\n`)

    recent.forEach((call, index) => {
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

  } catch (error) {
    console.error(`\n❌ Error fetching calls: ${error.message}`)
  }
}

async function fetchRecentChats() {
  console.log('\n\n' + '='.repeat(80))
  console.log('💬 RECENT SMS CHATS - COST BREAKDOWN')
  console.log('='.repeat(80))

  try {
    // Try v2 endpoint first
    let response = await fetch('https://api.retellai.com/v2/list-chats', {
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

    // If v2 fails, try v1
    if (!response.ok) {
      response = await fetch('https://api.retellai.com/list-chats', {
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
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const chats = data.chats || []

    console.log(`\nFound ${chats.length} total chats in system`)

    if (chats.length === 0) {
      console.log('\n⚠️  No chats found in your Retell AI account.')
      console.log('   This could mean:')
      console.log('   - No SMS chats have been created yet')
      console.log('   - Chats were archived or deleted')
      console.log('   - Using wrong API key or agent ID')
      return
    }

    // Get 5 most recent
    const recent = chats.slice(0, 5)

    console.log(`\nShowing 5 most recent chats:\n`)

    recent.forEach((chat, index) => {
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
  console.log('\n🔍 FETCHING MOST RECENT RETELL AI DATA')
  console.log('Exchange Rate: 1 USD = 1.45 CAD (FIXED)')
  console.log('Twilio Voice: $0.022 USD/min')
  console.log('Twilio SMS: $0.0083 USD/segment\n')

  await fetchRecentCalls()
  await fetchRecentChats()

  console.log('\n\n✅ Fetch complete!')
  console.log('='.repeat(80) + '\n')
}

main()
