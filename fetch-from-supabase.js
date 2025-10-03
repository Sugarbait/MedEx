/**
 * Fetch recent calls and chats from Supabase database
 * This is where your app actually stores the data
 */

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE'

const USD_TO_CAD = 1.45
const TWILIO_VOICE_RATE = 0.022
const TWILIO_SMS_RATE = 0.0083

async function fetchCallsFromSupabase() {
  console.log('\n' + '='.repeat(80))
  console.log('📞 FETCHING CALLS FROM SUPABASE DATABASE')
  console.log('='.repeat(80))

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/calls?select=*&order=start_timestamp.desc&limit=5`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`)
    }

    const calls = await response.json()
    console.log(`\n✅ Found ${calls.length} calls in database`)

    if (calls.length === 0) {
      console.log('\n⚠️  No calls in database yet')
      return
    }

    console.log(`\nShowing all calls:\n`)

    calls.forEach((call, index) => {
      const duration = call.call_length_ms ? call.call_length_ms / 1000 : 0
      const minutes = Math.ceil(duration / 60)

      // Parse call_cost if it's a string
      let callCost = call.call_cost
      if (typeof callCost === 'string') {
        try {
          callCost = JSON.parse(callCost)
        } catch (e) {
          callCost = {}
        }
      }

      const retellCents = callCost?.combined_cost || 0
      const retellUSD = retellCents / 100
      const retellCAD = retellUSD * USD_TO_CAD

      const twilioUSD = minutes * TWILIO_VOICE_RATE
      const twilioCAD = twilioUSD * USD_TO_CAD

      const totalUSD = retellUSD + twilioUSD
      const totalCAD = retellCAD + twilioCAD

      const date = new Date(call.start_timestamp)
      const timeAgo = getTimeAgo(new Date(call.start_timestamp).getTime())

      console.log(`\n${index + 1}. Call ID: ${call.call_id?.substring(0, 35) || 'N/A'}...`)
      console.log(`   Phone: ${call.from_number || 'N/A'}`)
      console.log(`   Time: ${date.toLocaleString()} (${timeAgo})`)
      console.log(`   Duration: ${Math.floor(duration)}s (${minutes} billed minutes)`)
      console.log(`   Status: ${call.call_status || 'N/A'}`)
      console.log(`   ` + '-'.repeat(76))
      console.log(`   Retell AI Voice:  $${retellUSD.toFixed(4)} USD × 1.45 = $${retellCAD.toFixed(4)} CAD`)
      console.log(`   Twilio Voice:     $${twilioUSD.toFixed(4)} USD × 1.45 = $${twilioCAD.toFixed(4)} CAD`)
      console.log(`   ` + '='.repeat(76))
      console.log(`   TOTAL:            $${totalUSD.toFixed(4)} USD × 1.45 = $${totalCAD.toFixed(4)} CAD`)
    })

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`)
  }
}

async function fetchChatsFromSupabase() {
  console.log('\n\n' + '='.repeat(80))
  console.log('💬 FETCHING CHATS FROM SUPABASE DATABASE')
  console.log('='.repeat(80))

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/chats?select=*&order=start_timestamp.desc&limit=5`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`)
    }

    const chats = await response.json()
    console.log(`\n✅ Found ${chats.length} chats in database`)

    if (chats.length === 0) {
      console.log('\n⚠️  No chats in database yet')
      return
    }

    console.log(`\nShowing all chats:\n`)

    chats.forEach((chat, index) => {
      // Parse chat_cost if it's a string
      let chatCost = chat.chat_cost
      if (typeof chatCost === 'string') {
        try {
          chatCost = JSON.parse(chatCost)
        } catch (e) {
          chatCost = {}
        }
      }

      const retellCents = chatCost?.combined_cost || 0
      const retellUSD = retellCents / 100
      const retellWithFee = retellUSD > 0 ? retellUSD : 0.03
      const retellCAD = retellWithFee * USD_TO_CAD

      // Estimate segments
      const messageCount = chat.message_count || 0
      let totalChars = 0
      if (chat.messages && Array.isArray(chat.messages)) {
        chat.messages.forEach(msg => {
          totalChars += (msg.content || '').length
        })
      }
      const segments = Math.max(Math.ceil(totalChars / 160), 1) + 4
      const twilioUSD = segments * TWILIO_SMS_RATE
      const twilioCAD = twilioUSD * USD_TO_CAD

      const totalUSD = retellWithFee + twilioUSD
      const totalCAD = retellCAD + twilioCAD

      const date = new Date(chat.start_timestamp)
      const timeAgo = getTimeAgo(new Date(chat.start_timestamp).getTime())
      const feeNote = retellUSD === 0 ? ' (added $0.03 fee)' : ''

      console.log(`\n${index + 1}. Chat ID: ${chat.chat_id?.substring(0, 35) || 'N/A'}...`)
      console.log(`   Phone: ${chat.access_phone_number || 'N/A'}`)
      console.log(`   Time: ${date.toLocaleString()} (${timeAgo})`)
      console.log(`   Messages: ${messageCount}, Segments: ${segments}`)
      console.log(`   Status: ${chat.chat_status || 'N/A'}`)
      console.log(`   ` + '-'.repeat(76))
      console.log(`   Retell AI Chat:   $${retellWithFee.toFixed(4)} USD × 1.45 = $${retellCAD.toFixed(4)} CAD${feeNote}`)
      console.log(`   Twilio SMS:       $${twilioUSD.toFixed(4)} USD × 1.45 = $${twilioCAD.toFixed(4)} CAD`)
      console.log(`   ` + '='.repeat(76))
      console.log(`   TOTAL:            $${totalUSD.toFixed(4)} USD × 1.45 = $${totalCAD.toFixed(4)} CAD`)
    })

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`)
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
  console.log('\n🔍 FETCHING DATA FROM SUPABASE (Your App Database)')
  console.log('Exchange Rate: 1 USD = 1.45 CAD (FIXED)')
  console.log('Twilio Voice: $0.022 USD/min')
  console.log('Twilio SMS: $0.0083 USD/segment\n')

  await fetchCallsFromSupabase()
  await fetchChatsFromSupabase()

  console.log('\n\n✅ Fetch complete!')
  console.log('='.repeat(80) + '\n')
}

main()
