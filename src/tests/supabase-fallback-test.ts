/**
 * Supabase Fallback Configuration Test
 *
 * Tests the improved fallback behavior and reduced console spam
 * when Supabase is not configured or unavailable
 */

import { supabase, supabaseConfig } from '@/config/supabase'
import { connectionState } from '@/utils/connectionState'
import { userSettingsService } from '@/services/userSettingsService'
import { mfaService } from '@/services/mfaService'

// Mock console methods to capture output
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
}

let consoleLogs: string[] = []
let consoleWarns: string[] = []
let consoleErrors: string[] = []

function mockConsole() {
  console.log = (...args) => {
    consoleLogs.push(args.join(' '))
    originalConsole.log(...args)
  }
  console.warn = (...args) => {
    consoleWarns.push(args.join(' '))
    originalConsole.warn(...args)
  }
  console.error = (...args) => {
    consoleErrors.push(args.join(' '))
    originalConsole.error(...args)
  }
}

function restoreConsole() {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
}

function clearConsoleLogs() {
  consoleLogs = []
  consoleWarns = []
  consoleErrors = []
}

export async function testSupabaseFallbackBehavior() {
  console.log('🧪 Testing Supabase fallback behavior...')

  // Setup console mocking
  mockConsole()
  clearConsoleLogs()

  try {
    // Test 1: Configuration state
    console.log('\n📋 Test 1: Configuration State')
    console.log('Supabase configured:', supabaseConfig.isConfigured())
    console.log('localStorage-only mode:', supabaseConfig.isLocalStorageOnly())
    console.log('Connection state:', connectionState.getStatusMessage())

    // Test 2: User settings service with fallback
    console.log('\n📋 Test 2: User Settings Service Fallback')
    clearConsoleLogs()

    const testUserId = 'test-user-123'
    const testSettings = await userSettingsService.getUserSettings(testUserId)

    console.log('Settings retrieved:', !!testSettings)
    console.log('Console spam after settings retrieval:')
    console.log(`- Logs: ${consoleLogs.length}`)
    console.log(`- Warnings: ${consoleWarns.length}`)
    console.log(`- Errors: ${consoleErrors.length}`)

    // Test 3: MFA service with fallback
    console.log('\n📋 Test 3: MFA Service Fallback')
    clearConsoleLogs()

    const mfaStatus = await mfaService.getMFAStatus(testUserId)
    console.log('MFA status retrieved:', !!mfaStatus)
    console.log('Console spam after MFA status check:')
    console.log(`- Logs: ${consoleLogs.length}`)
    console.log(`- Warnings: ${consoleWarns.length}`)
    console.log(`- Errors: ${consoleErrors.length}`)

    // Test 4: Supabase client operations
    console.log('\n📋 Test 4: Direct Supabase Operations')
    clearConsoleLogs()

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1)

      console.log('Supabase query result:', { hasData: !!data, hasError: !!error })
    } catch (directError) {
      console.log('Direct Supabase error (expected):', directError.message.substring(0, 50) + '...')
    }

    console.log('Console spam after direct Supabase calls:')
    console.log(`- Logs: ${consoleLogs.length}`)
    console.log(`- Warnings: ${consoleWarns.length}`)
    console.log(`- Errors: ${consoleErrors.length}`)

    // Test 5: Realtime subscription (should be silent)
    console.log('\n📋 Test 5: Realtime Subscriptions')
    clearConsoleLogs()

    userSettingsService.subscribeToSettings(testUserId, (settings) => {
      console.log('Settings updated via realtime')
    })

    // Wait a moment for any async setup
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('Console spam after realtime subscription:')
    console.log(`- Logs: ${consoleLogs.length}`)
    console.log(`- Warnings: ${consoleWarns.length}`)
    console.log(`- Errors: ${consoleErrors.length}`)

    // Cleanup
    userSettingsService.unsubscribeFromSettings(testUserId)

    // Final assessment
    console.log('\n📊 Test Results Summary:')
    const totalConsoleNoise = consoleLogs.length + consoleWarns.length + consoleErrors.length

    if (totalConsoleNoise < 10) {
      console.log('✅ PASS: Console spam significantly reduced')
    } else if (totalConsoleNoise < 20) {
      console.log('⚠️ PARTIAL: Some console noise remains but improved')
    } else {
      console.log('❌ FAIL: Still too much console spam')
    }

    console.log(`Total console outputs: ${totalConsoleNoise}`)
    console.log('Most common console messages:')

    const allMessages = [...consoleLogs, ...consoleWarns, ...consoleErrors]
    const messageCounts = allMessages.reduce((acc, msg) => {
      const key = msg.substring(0, 50) + '...'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    Object.entries(messageCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([msg, count]) => {
        console.log(`  - ${count}x: ${msg}`)
      })

    return {
      success: totalConsoleNoise < 10,
      totalConsoleNoise,
      breakdown: {
        logs: consoleLogs.length,
        warnings: consoleWarns.length,
        errors: consoleErrors.length
      }
    }

  } finally {
    // Always restore console
    restoreConsole()
  }
}

// Auto-run test if this file is executed directly
if (typeof window !== 'undefined' && (window as any).runSupabaseFallbackTest) {
  testSupabaseFallbackBehavior().then(result => {
    console.log('🧪 Test completed:', result)
  })
}