import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Testing Supabase Connection...')
console.log('URL:', supabaseUrl)
console.log('Key starts with:', supabaseServiceKey?.substring(0, 20) + '...')

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testConnection() {
  try {
    console.log('\n📊 Testing basic connection...')

    // First, just test if we can connect at all
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    if (error) {
      console.log('❌ Error:', error.message)

      if (error.message.includes('azure_ad_id')) {
        console.log('\n🚨 ISSUE FOUND: The users table has not been created yet!')
        console.log('\n📝 TO FIX THIS:')
        console.log('1. Go to: https://supabase.com/dashboard/project/cpkslvmydfdevdftieck')
        console.log('2. Click "SQL Editor" in the left sidebar')
        console.log('3. Click "New query"')
        console.log('4. Copy the content from SIMPLE_DB_SETUP.sql')
        console.log('5. Paste it and click "Run"')
        console.log('\n⚠️  The database tables must be created before the app can work!')
      }
    } else {
      console.log('✅ Success! Database is working correctly')
      console.log('Found', data?.length || 0, 'users')
    }
  } catch (err) {
    console.log('❌ Connection failed:', err.message)
  }
}

testConnection()