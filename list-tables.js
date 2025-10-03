/**
 * List all available tables in Supabase
 */

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE'

const tablesToCheck = [
  'calls',
  'chats',
  'sms_messages',
  'patients',
  'users',
  'audit_logs'
]

async function checkTable(tableName) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${tableName}?limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  )

  return {
    name: tableName,
    exists: response.ok,
    status: response.status,
    hasData: response.ok && (await response.json()).length > 0
  }
}

async function main() {
  console.log('\n🔍 Checking Supabase tables...\n')

  for (const table of tablesToCheck) {
    const result = await checkTable(table)

    if (result.exists) {
      const dataStatus = result.hasData ? '✅ HAS DATA' : '⚠️  EMPTY'
      console.log(`✅ ${table.padEnd(20)} ${dataStatus}`)
    } else {
      console.log(`❌ ${table.padEnd(20)} NOT FOUND (${result.status})`)
    }
  }

  console.log('\n')
}

main()
