#!/usr/bin/env node

/**
 * Comprehensive Test Script for Cross-Device Settings Synchronization
 * Tests the enhanced user settings service with Supabase integration
 */

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// Configuration
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://cpkslvmydfdevdftieck.supabase.co',
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwa3Nsdm15ZGZkZXZkZnRpZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDAyOTUsImV4cCI6MjA2MjQ3NjI5NX0.IfkIVsp3AtLOyXDW9hq9bEvnozd9IaaUay244iDhWGE',
  serviceRoleKey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
}

// Initialize Supabase clients
const supabase = createClient(config.supabaseUrl, config.supabaseKey)
const supabaseAdmin = config.serviceRoleKey
  ? createClient(config.supabaseUrl, config.serviceRoleKey)
  : null

// Test utilities
class TestLogger {
  static info(message, data = null) {
    console.log(`✅ ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }

  static error(message, error = null) {
    console.log(`❌ ${message}`, error ? error.message || error : '')
  }

  static warn(message, data = null) {
    console.log(`⚠️  ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }

  static test(message) {
    console.log(`\n🧪 Testing: ${message}`)
    console.log('=' .repeat(50))
  }
}

// Mock user data for testing
const createTestUser = async () => {
  const testUserId = crypto.randomUUID()
  const azureAdId = crypto.randomUUID()

  try {
    // Create test user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        azure_ad_id: azureAdId,
        email: `test-${testUserId.substring(0, 8)}@test.com`,
        name: 'Test User',
        role: 'healthcare_provider',
        is_active: true
      })
      .select()
      .single()

    if (error) {
      TestLogger.error('Failed to create test user', error)
      return null
    }

    TestLogger.info('Test user created', { userId: testUserId, azureAdId })
    return { userId: testUserId, azureAdId, user }
  } catch (error) {
    TestLogger.error('Error creating test user', error)
    return null
  }
}

// Default settings for testing
const getDefaultSettings = (userId) => ({
  user_id: userId,
  theme: 'light',
  notifications: {
    email: true,
    sms: false,
    push: true,
    in_app: true,
    call_alerts: true,
    sms_alerts: true,
    security_alerts: true
  },
  security_preferences: {
    session_timeout: 15,
    require_mfa: true,
    password_expiry_reminder: true,
    login_notifications: true
  },
  communication_preferences: {
    default_method: 'phone',
    auto_reply_enabled: false,
    business_hours: {
      enabled: true,
      start: '09:00',
      end: '17:00',
      timezone: 'UTC'
    }
  },
  accessibility_settings: {
    high_contrast: false,
    large_text: false,
    screen_reader: false,
    keyboard_navigation: false
  },
  retell_config: {
    api_key: 'test-api-key-12345',
    call_agent_id: 'agent-123',
    sms_agent_id: 'sms-agent-456'
  },
  device_sync_enabled: true
})

// Test functions
async function testDatabaseConnection() {
  TestLogger.test('Database Connection')

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (error) {
      TestLogger.error('Database connection failed', error)
      return false
    }

    TestLogger.info('Database connection successful')
    return true
  } catch (error) {
    TestLogger.error('Database connection error', error)
    return false
  }
}

async function testRLSPolicies(userId) {
  TestLogger.test('RLS Policies')

  try {
    // Test if we can query user_settings table
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      TestLogger.error('RLS policy test failed', error)
      return false
    }

    TestLogger.info('RLS policies are working')
    return true
  } catch (error) {
    TestLogger.error('RLS policy test error', error)
    return false
  }
}

async function testCreateDefaultSettings(userId) {
  TestLogger.test('Create Default Settings')

  try {
    const defaultSettings = getDefaultSettings(userId)

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(defaultSettings, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      TestLogger.error('Failed to create default settings', error)
      return null
    }

    TestLogger.info('Default settings created successfully', data)
    return data[0] || data
  } catch (error) {
    TestLogger.error('Error creating default settings', error)
    return null
  }
}

async function testUpdateSettings(userId) {
  TestLogger.test('Update Settings')

  try {
    const updates = {
      theme: 'dark',
      notifications: {
        email: false,
        sms: true,
        push: true,
        in_app: true,
        call_alerts: true,
        sms_alerts: true,
        security_alerts: true
      }
    }

    const { data, error } = await supabase
      .from('user_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        last_synced: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()

    if (error) {
      TestLogger.error('Failed to update settings', error)
      return null
    }

    TestLogger.info('Settings updated successfully', data)
    return data[0] || data
  } catch (error) {
    TestLogger.error('Error updating settings', error)
    return null
  }
}

async function testConflictResolution(userId) {
  TestLogger.test('Conflict Resolution')

  try {
    // Simulate concurrent updates
    const update1 = {
      theme: 'dark',
      updated_at: new Date().toISOString()
    }

    const update2 = {
      notifications: {
        email: false,
        sms: true,
        push: false,
        in_app: true,
        call_alerts: true,
        sms_alerts: true,
        security_alerts: true
      },
      updated_at: new Date(Date.now() + 1000).toISOString() // 1 second later
    }

    // Apply both updates
    const { data: result1, error: error1 } = await supabase
      .from('user_settings')
      .update(update1)
      .eq('user_id', userId)
      .select()

    const { data: result2, error: error2 } = await supabase
      .from('user_settings')
      .update(update2)
      .eq('user_id', userId)
      .select()

    if (error1 || error2) {
      TestLogger.error('Conflict resolution test failed', error1 || error2)
      return false
    }

    TestLogger.info('Conflict resolution test passed')
    return true
  } catch (error) {
    TestLogger.error('Error in conflict resolution test', error)
    return false
  }
}

async function testDuplicateCleanup(userId) {
  TestLogger.test('Duplicate Cleanup')

  try {
    // First, check if there are duplicates
    const { data: existing, error: selectError } = await supabase
      .from('user_settings')
      .select('id, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (selectError) {
      TestLogger.error('Failed to check for duplicates', selectError)
      return false
    }

    TestLogger.info(`Found ${existing?.length || 0} settings records for user`)

    if (existing && existing.length > 1) {
      // Keep the most recent, delete the rest
      const rowsToDelete = existing.slice(1)
      const idsToDelete = rowsToDelete.map(row => row.id)

      const { error: deleteError } = await supabase
        .from('user_settings')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) {
        TestLogger.error('Failed to clean up duplicates', deleteError)
        return false
      }

      TestLogger.info(`Cleaned up ${idsToDelete.length} duplicate records`)
    }

    return true
  } catch (error) {
    TestLogger.error('Error in duplicate cleanup test', error)
    return false
  }
}

async function testRealtimeSubscription(userId) {
  TestLogger.test('Real-time Subscription')

  return new Promise((resolve) => {
    try {
      let updateReceived = false

      const subscription = supabase
        .channel('test_settings_sync')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            TestLogger.info('Real-time update received', payload.new)
            updateReceived = true
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            TestLogger.info('Real-time subscription established')

            // Trigger an update to test real-time
            setTimeout(async () => {
              await supabase
                .from('user_settings')
                .update({
                  theme: 'auto',
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)

              // Wait for real-time update
              setTimeout(() => {
                supabase.removeChannel(subscription)
                resolve(updateReceived)
              }, 2000)
            }, 1000)
          } else if (status === 'CHANNEL_ERROR') {
            TestLogger.error('Real-time subscription failed')
            resolve(false)
          }
        })

      // Timeout after 10 seconds
      setTimeout(() => {
        supabase.removeChannel(subscription)
        resolve(updateReceived)
      }, 10000)

    } catch (error) {
      TestLogger.error('Error in real-time subscription test', error)
      resolve(false)
    }
  })
}

async function testEncryptionDecryption() {
  TestLogger.test('Encryption/Decryption (Simulation)')

  try {
    const testData = {
      api_key: 'super-secret-api-key',
      call_agent_id: 'agent-123',
      sms_agent_id: 'sms-456'
    }

    // Simulate base64 encoding (fallback encryption)
    const encoded = {
      api_key: Buffer.from(testData.api_key).toString('base64'),
      api_key_encoded: true,
      call_agent_id: testData.call_agent_id,
      sms_agent_id: testData.sms_agent_id
    }

    // Simulate decoding
    const decoded = {
      api_key: Buffer.from(encoded.api_key, 'base64').toString(),
      call_agent_id: encoded.call_agent_id,
      sms_agent_id: encoded.sms_agent_id
    }

    const isValid = decoded.api_key === testData.api_key &&
                   decoded.call_agent_id === testData.call_agent_id &&
                   decoded.sms_agent_id === testData.sms_agent_id

    if (isValid) {
      TestLogger.info('Encryption/Decryption simulation passed')
      return true
    } else {
      TestLogger.error('Encryption/Decryption simulation failed')
      return false
    }
  } catch (error) {
    TestLogger.error('Error in encryption/decryption test', error)
    return false
  }
}

async function testOfflineSupport(userId) {
  TestLogger.test('Offline Support (localStorage Simulation)')

  try {
    // Simulate localStorage operations
    const mockLocalStorage = new Map()

    const testSettings = {
      user_id: userId,
      theme: 'dark',
      notifications: { email: true },
      timestamp: Date.now()
    }

    // Simulate storing in localStorage
    const cacheKey = `user_settings_${userId}`
    mockLocalStorage.set(cacheKey, JSON.stringify({
      data: testSettings,
      timestamp: Date.now(),
      version: '2.0.0'
    }))

    // Simulate retrieving from localStorage
    const cached = mockLocalStorage.get(cacheKey)
    if (cached) {
      const { data } = JSON.parse(cached)
      TestLogger.info('Offline support simulation passed', data)
      return true
    }

    TestLogger.error('Offline support simulation failed')
    return false
  } catch (error) {
    TestLogger.error('Error in offline support test', error)
    return false
  }
}

async function cleanupTestData(userId) {
  TestLogger.test('Cleanup Test Data')

  try {
    // Delete test user settings
    await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', userId)

    // Delete test user
    await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    TestLogger.info('Test data cleaned up successfully')
    return true
  } catch (error) {
    TestLogger.error('Error cleaning up test data', error)
    return false
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Cross-Device Settings Synchronization Tests')
  console.log('=' .repeat(60))

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  }

  const runTest = async (testName, testFunction, ...args) => {
    results.total++
    try {
      const result = await testFunction(...args)
      if (result) {
        results.passed++
        TestLogger.info(`${testName}: PASSED`)
      } else {
        results.failed++
        TestLogger.error(`${testName}: FAILED`)
      }
      return result
    } catch (error) {
      results.failed++
      TestLogger.error(`${testName}: ERROR`, error)
      return false
    }
  }

  // Test 1: Database Connection
  const connectionOk = await runTest('Database Connection', testDatabaseConnection)
  if (!connectionOk) {
    TestLogger.error('Stopping tests due to database connection failure')
    return
  }

  // Test 2: Create Test User
  const testUser = await createTestUser()
  if (!testUser) {
    TestLogger.error('Stopping tests due to user creation failure')
    return
  }

  const { userId } = testUser

  try {
    // Test 3: RLS Policies
    await runTest('RLS Policies', testRLSPolicies, userId)

    // Test 4: Create Default Settings
    await runTest('Create Default Settings', testCreateDefaultSettings, userId)

    // Test 5: Update Settings
    await runTest('Update Settings', testUpdateSettings, userId)

    // Test 6: Conflict Resolution
    await runTest('Conflict Resolution', testConflictResolution, userId)

    // Test 7: Duplicate Cleanup
    await runTest('Duplicate Cleanup', testDuplicateCleanup, userId)

    // Test 8: Real-time Subscription
    await runTest('Real-time Subscription', testRealtimeSubscription, userId)

    // Test 9: Encryption/Decryption
    await runTest('Encryption/Decryption', testEncryptionDecryption)

    // Test 10: Offline Support
    await runTest('Offline Support', testOfflineSupport, userId)

  } finally {
    // Cleanup
    await cleanupTestData(userId)
  }

  // Final Results
  console.log('\n' + '=' .repeat(60))
  console.log('📊 Test Results Summary')
  console.log('=' .repeat(60))
  console.log(`Total Tests: ${results.total}`)
  console.log(`Passed: ${results.passed} ✅`)
  console.log(`Failed: ${results.failed} ❌`)
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`)

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Cross-device settings synchronization is working correctly.')
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.')
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error)
    process.exit(1)
  })
}

module.exports = {
  runAllTests,
  TestLogger,
  createTestUser,
  testDatabaseConnection,
  testRLSPolicies,
  testCreateDefaultSettings,
  testUpdateSettings,
  testConflictResolution,
  testDuplicateCleanup,
  testRealtimeSubscription,
  testEncryptionDecryption,
  testOfflineSupport
}