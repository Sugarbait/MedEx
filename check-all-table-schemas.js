import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function getTableColumns(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1)

  if (error) {
    return { error: error.message }
  }

  if (data && data.length > 0) {
    return { columns: Object.keys(data[0]) }
  }

  // Try with empty insert to get column names from error
  const { error: insertError } = await supabase
    .from(tableName)
    .insert([{}])

  return { error: 'No data and could not determine schema' }
}

async function main() {
  console.log('📋 === ALL TABLE SCHEMAS ===\n')

  const tables = [
    'users',
    'user_credentials',
    'user_settings',
    'audit_logs',
    'calls',
    'sms_messages'
  ]

  for (const table of tables) {
    console.log(`\n🔍 Table: ${table}`)
    console.log('─'.repeat(50))

    const result = await getTableColumns(table)

    if (result.error) {
      console.log(`❌ Error: ${result.error}`)
    } else if (result.columns) {
      console.log(`✅ Columns (${result.columns.length}):`)
      result.columns.forEach(col => {
        // Highlight camelCase vs snake_case
        const hasUnderscore = col.includes('_')
        const hasCamelCase = /[a-z][A-Z]/.test(col)
        const style = hasUnderscore ? '🐍' : hasCamelCase ? '🐪' : '  '
        console.log(`   ${style} ${col}`)
      })
    }
  }

  console.log('\n\n📊 === LEGEND ===')
  console.log('🐍 = snake_case (PostgreSQL standard)')
  console.log('🐪 = camelCase (JavaScript standard)')
  console.log('   = single word (no case issue)')
}

main()
