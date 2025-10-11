/**
 * Check if user is still locked out
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log('🔍 Checking lockout status for test@test.com...\n')

async function checkLockout() {
  try {
    // Check failed login attempts
    const { data: attempts, error } = await supabase
      .from('failed_login_attempts')
      .select('*')
      .eq('email', 'test@test.com')
      .order('created_at', { ascending: false })

    if (error) {
      console.log('❌ Error checking failed_login_attempts:', error.message)
      return
    }

    console.log(`📊 Failed login attempts for test@test.com: ${attempts.length}\n`)

    if (attempts.length === 0) {
      console.log('✅ NO LOCKOUT - Account is clear!')
      console.log('   You can log in now.\n')
    } else {
      console.log('⚠️  Found failed login attempts:')
      attempts.slice(0, 5).forEach((attempt, i) => {
        console.log(`   ${i + 1}. ${attempt.created_at} - ${attempt.failure_reason || 'Unknown'}`)
      })

      // Check if lockout is expired (1 hour = 3600000ms)
      const latestAttempt = new Date(attempts[0].created_at)
      const now = new Date()
      const timeSinceAttempt = now - latestAttempt
      const oneHour = 60 * 60 * 1000

      console.log(`\n⏰ Time since last attempt: ${Math.floor(timeSinceAttempt / 1000 / 60)} minutes`)

      if (timeSinceAttempt > oneHour) {
        console.log('✅ Lockout expired - You can log in now!\n')
      } else {
        const remainingMs = oneHour - timeSinceAttempt
        const remainingMin = Math.ceil(remainingMs / 1000 / 60)
        console.log(`🔒 Still locked out for ${remainingMin} more minutes\n`)
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkLockout()
