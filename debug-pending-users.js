/**
 * Debug script to check pending users in the database
 * Run with: node debug-pending-users.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugPendingUsers() {
  console.log('🔍 Checking users table for pending users...\n')

  try {
    // Query 1: Get ALL users (no filter)
    console.log('📊 Query 1: ALL users in database')
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', 'medex')
      .order('created_at', { ascending: false })

    if (allError) {
      console.error('❌ Error fetching all users:', allError)
    } else {
      console.log(`✅ Found ${allUsers?.length || 0} total users`)
      allUsers?.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email}`)
        console.log(`     - Name: ${user.name}`)
        console.log(`     - Role: ${user.role}`)
        console.log(`     - is_active: ${user.is_active}`)
        console.log(`     - Created: ${new Date(user.created_at).toLocaleString()}`)
        console.log(`     - Full data:`, JSON.stringify(user, null, 2))
        console.log('')
      })
    }

    // Query 2: Get ONLY inactive users (is_active = false)
    console.log('\n📊 Query 2: INACTIVE users (is_active = false)')
    const { data: inactiveUsers, error: inactiveError } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', 'medex')
      .eq('is_active', false)
      .order('created_at', { ascending: false })

    if (inactiveError) {
      console.error('❌ Error fetching inactive users:', inactiveError)
    } else {
      console.log(`✅ Found ${inactiveUsers?.length || 0} inactive users`)
      if (inactiveUsers && inactiveUsers.length > 0) {
        inactiveUsers.forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.email}`)
          console.log(`     - Name: ${user.name}`)
          console.log(`     - Role: ${user.role}`)
          console.log(`     - is_active: ${user.is_active}`)
          console.log(`     - Created: ${new Date(user.created_at).toLocaleString()}`)
          console.log('')
        })
      } else {
        console.log('  ℹ️ No inactive users found')
      }
    }

    // Query 3: Get ONLY active users (is_active = true)
    console.log('\n📊 Query 3: ACTIVE users (is_active = true)')
    const { data: activeUsers, error: activeError } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', 'medex')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (activeError) {
      console.error('❌ Error fetching active users:', activeError)
    } else {
      console.log(`✅ Found ${activeUsers?.length || 0} active users`)
      activeUsers?.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} - ${user.name}`)
      })
    }

    // Query 4: Check users table schema
    console.log('\n📊 Query 4: Users table schema (check is_active column exists)')
    const { data: schemaData, error: schemaError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'users'
          AND column_name IN ('is_active', 'is_locked', 'role', 'tenant_id')
          ORDER BY column_name
        `
      })

    if (schemaError) {
      console.log('ℹ️ Could not query schema (requires custom RPC function)')
    } else {
      console.log('✅ Schema information:')
      console.log(schemaData)
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total users: ${allUsers?.length || 0}`)
    console.log(`Active users: ${activeUsers?.length || 0}`)
    console.log(`Inactive users: ${inactiveUsers?.length || 0}`)
    console.log('')

    if (inactiveUsers && inactiveUsers.length === 0) {
      console.log('⚠️  WARNING: No inactive users found!')
      console.log('   This means either:')
      console.log('   1. No users have been created with is_active=false')
      console.log('   2. The UserRegistration component is not setting is_active=false correctly')
      console.log('   3. The database column defaults to true')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the debug function
debugPendingUsers()
  .then(() => {
    console.log('\n✅ Debug script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Debug script failed:', error)
    process.exit(1)
  })
