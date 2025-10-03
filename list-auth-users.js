/**
 * List Auth Users
 * Shows all Supabase Auth users
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function listAuthUsers() {
  console.log('📊 Listing Supabase Auth users...\n')

  try {
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      console.error('❌ Error listing auth users:', error)
      return
    }

    console.log(`✅ Found ${data.users.length} auth user(s):\n`)

    data.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`)
      console.log(`   Auth ID: ${user.id}`)
      console.log(`   Created: ${user.created_at}`)
      console.log(`   Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`)
      console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Failed:', error)
  }
}

// Run
listAuthUsers()
