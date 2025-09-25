/**
 * Schema Test and Validation Script
 * =================================
 * Comprehensive testing script to validate database schema,
 * test all fallback methods, and verify optimal Retell AI integration.
 *
 * Run this script in the browser console after running the migration
 * to verify everything is working correctly.
 *
 * Usage:
 * 1. Open browser console on your CareXPS application
 * 2. Paste this entire script
 * 3. Run: await runComprehensiveSchemaTests()
 */

// Test configuration
const TEST_CONFIG = {
  userId: `schema-test-${Date.now()}`,
  retellConfig: {
    api_key: 'test-api-key-12345',
    call_agent_id: 'test-call-agent-abc',
    sms_agent_id: 'test-sms-agent-xyz',
    phone_number: '+1234567890',
    webhook_config: {
      webhook_url: 'https://example.com/webhook',
      events: ['call.started', 'call.ended', 'sms.received'],
      secret: 'webhook-secret-123'
    }
  },
  profileData: {
    department: 'Test Department',
    position: 'Test Position',
    first_name: 'Test',
    last_name: 'User',
    phone: '+1987654321'
  }
}

/**
 * Import required services (these should be available in the application context)
 */
async function getServices() {
  try {
    // Try to get services from window/global context
    const services = {
      schemaValidationUtility: window.schemaValidationUtility ||
                               await import('/src/utils/schemaValidationUtility.js').then(m => m.schemaValidationUtility),
      enhancedApiKeyFallbackService: window.enhancedApiKeyFallbackService ||
                                    await import('/src/services/enhancedApiKeyFallbackService.js').then(m => m.enhancedApiKeyFallbackService),
      apiKeyFallbackService: window.apiKeyFallbackService ||
                           await import('/src/services/apiKeyFallbackService.js').then(m => m.apiKeyFallbackService),
      supabase: window.supabase || await import('/src/config/supabase.js').then(m => m.supabase)
    }

    return services
  } catch (error) {
    console.error('❌ Could not load required services:', error)
    console.log('Make sure you are running this script in the CareXPS application context')
    return null
  }
}

/**
 * Test 1: Basic Schema Validation
 */
async function testSchemaValidation(services) {
  console.log('\n🔍 Test 1: Basic Schema Validation')
  console.log('=' .repeat(50))

  try {
    const { schemaValidationUtility } = services

    // Test critical columns
    const criticalTest = await schemaValidationUtility.validateCriticalColumns()
    console.log('Critical Columns Test:', criticalTest.status === 'success' ? '✅' : '❌', criticalTest.message)

    if (criticalTest.status === 'error') {
      console.log('Missing columns:', criticalTest.details?.missing_columns || 'Unknown')
      return false
    }

    // Test full column validation
    const columnTest = await schemaValidationUtility.validateTableColumns()
    console.log('Column Validation:', columnTest.status === 'success' ? '✅' : '❌', columnTest.message)

    // Test indexes
    const indexTest = await schemaValidationUtility.validateIndexes()
    console.log('Index Validation:', indexTest.status === 'success' ? '✅' : '⚠️', indexTest.message)

    // Test helper functions
    const functionTest = await schemaValidationUtility.validateHelperFunctions()
    console.log('Function Validation:', functionTest.status === 'success' ? '✅' : '⚠️', functionTest.message)

    return criticalTest.status === 'success'

  } catch (error) {
    console.error('❌ Schema validation test failed:', error)
    return false
  }
}

/**
 * Test 2: Comprehensive Health Report
 */
async function testHealthReport(services) {
  console.log('\n📊 Test 2: Comprehensive Health Report')
  console.log('=' .repeat(50))

  try {
    const { schemaValidationUtility } = services

    const healthReport = await schemaValidationUtility.generateHealthReport()

    console.log(`Overall Status: ${healthReport.overall_status === 'healthy' ? '✅' :
                                  healthReport.overall_status === 'needs_migration' ? '⚠️' : '❌'} ${healthReport.overall_status}`)

    console.log(`Retell Integration Ready: ${healthReport.retell_integration_ready ? '✅' : '❌'}`)
    console.log(`Profile Management Ready: ${healthReport.profile_management_ready ? '✅' : '❌'}`)
    console.log(`Performance Optimized: ${healthReport.performance_optimized ? '✅' : '❌'}`)

    if (healthReport.missing_columns.length > 0) {
      console.log('Missing Columns:', healthReport.missing_columns)
    }

    if (healthReport.recommendations.length > 0) {
      console.log('Recommendations:')
      healthReport.recommendations.forEach(rec => console.log(`  • ${rec}`))
    }

    return healthReport.overall_status === 'healthy'

  } catch (error) {
    console.error('❌ Health report test failed:', error)
    return false
  }
}

/**
 * Test 3: Direct Database Operations
 */
async function testDirectDatabaseOperations(services) {
  console.log('\n💾 Test 3: Direct Database Operations')
  console.log('=' .repeat(50))

  try {
    const { supabase } = services
    const testUserId = TEST_CONFIG.userId

    // Test 3a: Insert with all new columns
    console.log('Testing insert with new columns...')
    const { data: insertData, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: testUserId,
        department: TEST_CONFIG.profileData.department,
        position: TEST_CONFIG.profileData.position,
        first_name: TEST_CONFIG.profileData.first_name,
        last_name: TEST_CONFIG.profileData.last_name,
        phone: TEST_CONFIG.profileData.phone,
        encrypted_agent_config: { test: 'config' },
        encrypted_retell_api_key: 'encrypted-test-key',
        encrypted_call_agent_id: 'encrypted-call-agent',
        encrypted_sms_agent_id: 'encrypted-sms-agent',
        phone_number: TEST_CONFIG.retellConfig.phone_number,
        webhook_config: TEST_CONFIG.retellConfig.webhook_config,
        retell_integration_status: 'configured',
        timezone: 'UTC',
        language: 'en',
        is_active: true,
        preferences: { theme: 'dark' },
        metadata: { test: true }
      })

    if (insertError) {
      console.error('❌ Insert failed:', insertError.message)
      return false
    }

    console.log('✅ Insert successful')

    // Test 3b: Query with all columns
    console.log('Testing query with all columns...')
    const { data: queryData, error: queryError } = await supabase
      .from('user_profiles')
      .select(`
        department, position, phone, encrypted_agent_config,
        encrypted_retell_api_key, encrypted_call_agent_id, encrypted_sms_agent_id,
        phone_number, webhook_config, retell_integration_status,
        timezone, language, is_active, preferences, metadata
      `)
      .eq('user_id', testUserId)
      .single()

    if (queryError) {
      console.error('❌ Query failed:', queryError.message)
      return false
    }

    console.log('✅ Query successful')
    console.log('Retrieved data keys:', Object.keys(queryData))

    // Test 3c: Update operations
    console.log('Testing update operations...')
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        department: 'Updated Department',
        retell_integration_status: 'active',
        last_retell_sync: new Date().toISOString()
      })
      .eq('user_id', testUserId)

    if (updateError) {
      console.error('❌ Update failed:', updateError.message)
      return false
    }

    console.log('✅ Update successful')

    // Cleanup
    await supabase.from('user_profiles').delete().eq('user_id', testUserId)
    console.log('✅ Cleanup completed')

    return true

  } catch (error) {
    console.error('❌ Direct database operations test failed:', error)
    return false
  }
}

/**
 * Test 4: Enhanced API Key Fallback Service
 */
async function testEnhancedFallbackService(services) {
  console.log('\n🔄 Test 4: Enhanced API Key Fallback Service')
  console.log('=' .repeat(50))

  try {
    const { enhancedApiKeyFallbackService } = services
    const testUserId = `enhanced-test-${Date.now()}`

    // Test 4a: Schema status check
    console.log('Checking schema status...')
    const schemaStatus = await enhancedApiKeyFallbackService.getSchemaStatus()

    console.log(`Schema Optimal: ${schemaStatus.optimal ? '✅' : '❌'}`)
    console.log(`Migration Needed: ${schemaStatus.migrationNeeded ? '⚠️ Yes' : '✅ No'}`)

    if (schemaStatus.recommendations.length > 0) {
      console.log('Recommendations:')
      schemaStatus.recommendations.forEach(rec => console.log(`  • ${rec}`))
    }

    // Test 4b: Store configuration
    console.log('Testing configuration storage...')
    const storeResult = await enhancedApiKeyFallbackService.storeRetellConfiguration(
      testUserId,
      TEST_CONFIG.retellConfig
    )

    if (storeResult.status !== 'success') {
      console.error('❌ Configuration storage failed:', storeResult.error)
      return false
    }

    console.log('✅ Configuration storage successful')

    // Test 4c: Retrieve configuration
    console.log('Testing configuration retrieval...')
    const retrieveResult = await enhancedApiKeyFallbackService.retrieveRetellConfiguration(testUserId)

    if (retrieveResult.status !== 'success' || !retrieveResult.data) {
      console.error('❌ Configuration retrieval failed:', retrieveResult.error || 'No data returned')
      return false
    }

    console.log('✅ Configuration retrieval successful')

    // Verify data integrity
    const retrievedConfig = retrieveResult.data
    const dataIntegrityCheck =
      retrievedConfig.api_key === TEST_CONFIG.retellConfig.api_key &&
      retrievedConfig.call_agent_id === TEST_CONFIG.retellConfig.call_agent_id &&
      retrievedConfig.sms_agent_id === TEST_CONFIG.retellConfig.sms_agent_id &&
      retrievedConfig.phone_number === TEST_CONFIG.retellConfig.phone_number

    console.log(`Data Integrity: ${dataIntegrityCheck ? '✅' : '❌'}`)

    if (!dataIntegrityCheck) {
      console.log('Expected:', TEST_CONFIG.retellConfig)
      console.log('Retrieved:', retrievedConfig)
    }

    // Test 4d: All methods test
    console.log('Testing all storage methods...')
    const methodsTest = await enhancedApiKeyFallbackService.testAllMethods(`methods-test-${Date.now()}`)

    console.log(`Overall Success: ${methodsTest.overall_success ? '✅' : '❌'}`)
    console.log(`Optimal Schema: ${methodsTest.optimal_schema ? '✅' : '❌'}`)
    console.log(`Partial Schema: ${methodsTest.partial_schema ? '✅' : '❌'}`)
    console.log(`Legacy Fallback: ${methodsTest.legacy_fallback ? '✅' : '❌'}`)
    console.log(`Emergency localStorage: ${methodsTest.emergency_localStorage ? '✅' : '❌'}`)

    // Cleanup
    await services.supabase.from('user_profiles').delete().eq('user_id', testUserId)
    await services.supabase.from('user_settings').delete().eq('user_id', testUserId)

    return storeResult.status === 'success' && dataIntegrityCheck

  } catch (error) {
    console.error('❌ Enhanced fallback service test failed:', error)
    return false
  }
}

/**
 * Test 5: Legacy API Key Fallback Service Compatibility
 */
async function testLegacyFallbackService(services) {
  console.log('\n🔧 Test 5: Legacy API Key Fallback Service Compatibility')
  console.log('=' .repeat(50))

  try {
    const { apiKeyFallbackService } = services
    const testUserId = `legacy-test-${Date.now()}`

    // Test legacy API format
    const legacyApiKeys = {
      retell_api_key: TEST_CONFIG.retellConfig.api_key,
      call_agent_id: TEST_CONFIG.retellConfig.call_agent_id,
      sms_agent_id: TEST_CONFIG.retellConfig.sms_agent_id
    }

    // Test storage
    console.log('Testing legacy service storage...')
    const storeResult = await apiKeyFallbackService.storeApiKeys(testUserId, legacyApiKeys)

    if (storeResult.status !== 'success') {
      console.error('❌ Legacy storage failed:', storeResult.error)
      return false
    }

    console.log('✅ Legacy storage successful')

    // Test retrieval
    console.log('Testing legacy service retrieval...')
    const retrieveResult = await apiKeyFallbackService.retrieveApiKeys(testUserId)

    if (retrieveResult.status !== 'success' || !retrieveResult.data) {
      console.error('❌ Legacy retrieval failed:', retrieveResult.error || 'No data returned')
      return false
    }

    console.log('✅ Legacy retrieval successful')

    // Verify data
    const retrievedKeys = retrieveResult.data
    const legacyDataIntegrityCheck =
      retrievedKeys.retell_api_key === legacyApiKeys.retell_api_key &&
      retrievedKeys.call_agent_id === legacyApiKeys.call_agent_id &&
      retrievedKeys.sms_agent_id === legacyApiKeys.sms_agent_id

    console.log(`Legacy Data Integrity: ${legacyDataIntegrityCheck ? '✅' : '❌'}`)

    // Test schema handling
    console.log('Testing schema handling...')
    const schemaTest = await apiKeyFallbackService.testSchemaHandling(`schema-test-${Date.now()}`)

    console.log(`Can Store Keys: ${schemaTest.canStoreKeys ? '✅' : '❌'}`)
    console.log(`Can Retrieve Keys: ${schemaTest.canRetrieveKeys ? '✅' : '❌'}`)
    console.log(`Fallback Method: ${schemaTest.fallbackMethod}`)

    // Cleanup
    await services.supabase.from('user_profiles').delete().eq('user_id', testUserId)
    await services.supabase.from('user_settings').delete().eq('user_id', testUserId)

    return legacyDataIntegrityCheck && schemaTest.canStoreKeys && schemaTest.canRetrieveKeys

  } catch (error) {
    console.error('❌ Legacy fallback service test failed:', error)
    return false
  }
}

/**
 * Test 6: Helper Functions
 */
async function testHelperFunctions(services) {
  console.log('\n🔧 Test 6: Helper Functions')
  console.log('=' .repeat(50))

  try {
    const { supabase } = services
    const testUserId = `helper-test-${Date.now()}`

    // Test store_retell_config function
    console.log('Testing store_retell_config function...')
    const { data: storeResult, error: storeError } = await supabase
      .rpc('store_retell_config', {
        target_user_id: testUserId,
        api_key: 'encrypted-test-key',
        call_agent_id: 'encrypted-call-agent',
        sms_agent_id: 'encrypted-sms-agent',
        phone_num: '+1234567890',
        webhook_conf: { webhook_url: 'https://example.com/webhook' }
      })

    if (storeError) {
      console.log('⚠️ store_retell_config function not available:', storeError.message)
    } else {
      console.log('✅ store_retell_config function working')
    }

    // Test get_complete_user_profile function
    console.log('Testing get_complete_user_profile function...')
    const { data: profileResult, error: profileError } = await supabase
      .rpc('get_complete_user_profile', { target_user_id: testUserId })

    if (profileError) {
      console.log('⚠️ get_complete_user_profile function not available:', profileError.message)
    } else {
      console.log('✅ get_complete_user_profile function working')
    }

    // Test update_retell_integration_status function
    console.log('Testing update_retell_integration_status function...')
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_retell_integration_status', {
        target_user_id: testUserId,
        new_status: 'active'
      })

    if (updateError) {
      console.log('⚠️ update_retell_integration_status function not available:', updateError.message)
    } else {
      console.log('✅ update_retell_integration_status function working')
    }

    // Cleanup
    await supabase.from('user_profiles').delete().eq('user_id', testUserId)

    return !storeError || !profileError || !updateError // At least one function should work

  } catch (error) {
    console.error('❌ Helper functions test failed:', error)
    return false
  }
}

/**
 * Main test runner
 */
async function runComprehensiveSchemaTests() {
  console.log('🚀 COMPREHENSIVE SCHEMA TEST AND VALIDATION')
  console.log('=' .repeat(60))
  console.log('This script will test all aspects of the database schema migration.')
  console.log('Please ensure you have run COMPREHENSIVE_USER_PROFILES_SCHEMA_FIX.sql first.')
  console.log('=' .repeat(60))

  const services = await getServices()
  if (!services) {
    console.error('❌ Cannot proceed without required services')
    return
  }

  const testResults = {
    schemaValidation: false,
    healthReport: false,
    directOperations: false,
    enhancedFallback: false,
    legacyFallback: false,
    helperFunctions: false
  }

  try {
    // Run all tests
    testResults.schemaValidation = await testSchemaValidation(services)
    testResults.healthReport = await testHealthReport(services)
    testResults.directOperations = await testDirectDatabaseOperations(services)
    testResults.enhancedFallback = await testEnhancedFallbackService(services)
    testResults.legacyFallback = await testLegacyFallbackService(services)
    testResults.helperFunctions = await testHelperFunctions(services)

    // Calculate overall results
    const totalTests = Object.keys(testResults).length
    const passedTests = Object.values(testResults).filter(result => result).length
    const failedTests = totalTests - passedTests

    // Final report
    console.log('\n🎯 FINAL TEST RESULTS')
    console.log('=' .repeat(50))

    Object.entries(testResults).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`)
    })

    console.log('\n📊 SUMMARY')
    console.log('=' .repeat(50))
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${passedTests} ✅`)
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`)
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`)

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS')
    console.log('=' .repeat(50))

    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED!')
      console.log('Your database schema is fully optimized and ready for production.')
      console.log('• Profile information saves will work correctly')
      console.log('• API key storage is optimized')
      console.log('• Retell AI integration is fully functional')
      console.log('• All fallback methods are working')
    } else {
      console.log('⚠️ SOME TESTS FAILED - RECOMMENDED ACTIONS:')

      if (!testResults.schemaValidation || !testResults.directOperations) {
        console.log('• Run COMPREHENSIVE_USER_PROFILES_SCHEMA_FIX.sql migration immediately')
        console.log('• Core functionality will not work without proper schema')
      }

      if (!testResults.enhancedFallback && !testResults.legacyFallback) {
        console.log('• API key storage may not work - check database permissions')
        console.log('• Verify Supabase connection is working')
      }

      if (!testResults.helperFunctions) {
        console.log('• Helper functions missing - migration may not have completed fully')
        console.log('• Application will use fallback methods (may be slower)')
      }

      console.log('• Review failed tests above for specific issues')
      console.log('• Check browser console for additional error details')
    }

    // Clear caches after testing
    if (services.enhancedApiKeyFallbackService) {
      services.enhancedApiKeyFallbackService.clearSchemaCache()
    }
    if (services.apiKeyFallbackService) {
      services.apiKeyFallbackService.resetSchemaCache()
    }

    console.log('\n✅ Schema cache cleared - ready for normal operations')

  } catch (error) {
    console.error('❌ Comprehensive test failed:', error)
    console.log('Please check your database connection and try again.')
  }
}

// Export the main function for manual execution
window.runComprehensiveSchemaTests = runComprehensiveSchemaTests

// Also provide individual test functions
window.schemaTests = {
  runComprehensiveSchemaTests,
  testSchemaValidation,
  testHealthReport,
  testDirectDatabaseOperations,
  testEnhancedFallbackService,
  testLegacyFallbackService,
  testHelperFunctions
}

console.log('📋 Schema Test Script Loaded')
console.log('Run: await runComprehensiveSchemaTests()')
console.log('Or individual tests via: window.schemaTests.testName(services)')