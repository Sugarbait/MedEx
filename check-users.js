/**
 * Check Users Script
 * Lists all MedEx users
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cpkslvmydfdevdftieck.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjkwMDI5NSwiZXhwIjoyMDYyNDc2Mjk1fQ.5Nwr-DrgL63DwPMH2egxgdjoHGhAxCvIrz2SMTMKqD0'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkUsers() {
  console.log('📊 Checking MedEx users...\n')

  try {
    // Get all MedEx users
    const { data: medexUsers, error: medexError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id, created_at')
      .eq('tenant_id', 'medex')
      .order('created_at', { ascending: false })

    if (medexError) {
      console.error('❌ Error querying MedEx users:', medexError)
    } else {
      console.log(`✅ Found ${medexUsers.length} MedEx user(s):`)
      medexUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.email}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   Name: ${user.name || 'N/A'}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Created: ${user.created_at}`)
      })
    }

    // Also check all users (any tenant)
    console.log('\n\n📊 All users in database:')
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (allError) {
      console.error('❌ Error querying all users:', allError)
    } else {
      console.log(`\n✅ Found ${allUsers.length} user(s) (showing latest 10):`)
      allUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.email}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   Tenant: ${user.tenant_id}`)
        console.log(`   Name: ${user.name || 'N/A'}`)
        console.log(`   ID: ${user.id}`)
      })
    }

  } catch (error) {
    console.error('❌ Script failed:', error)
  }
}

// Run the check
checkUsers()
