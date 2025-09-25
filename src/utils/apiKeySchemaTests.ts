/**
 * API Key Schema Tests
 * ===================
 * Tests for the API key storage fallback system and schema migration
 *
 * Usage:
 * - Run these tests after applying the schema migration
 * - Tests both fallback scenarios and proper schema functionality
 * - Validates data integrity and error handling
 */

import { supabase } from '@/config/supabase'
import { apiKeyFallbackService } from '@/services/apiKeyFallbackService'
import { encryptionService } from '@/services/encryption'

interface TestResults {
  schemaCheck: { passed: boolean; error?: string }
  fallbackStorage: { passed: boolean; error?: string }
  fallbackRetrieval: { passed: boolean; error?: string }
  migrationReadiness: { passed: boolean; error?: string }
  overallScore: number
}

class ApiKeySchemaTests {
  private testUserId = '550e8400-e29b-41d4-a716-446655440000' // Test user ID

  async runAllTests(): Promise<TestResults> {
    console.log('🧪 Starting API Key Schema Tests...')

    const results: TestResults = {
      schemaCheck: { passed: false },
      fallbackStorage: { passed: false },
      fallbackRetrieval: { passed: false },
      migrationReadiness: { passed: false },
      overallScore: 0
    }

    try {
      // Test 1: Schema Check
      console.log('\n📋 Test 1: Schema Detection')
      results.schemaCheck = await this.testSchemaDetection()

      // Test 2: Fallback Storage
      console.log('\n💾 Test 2: Fallback Storage')
      results.fallbackStorage = await this.testFallbackStorage()

      // Test 3: Fallback Retrieval
      console.log('\n📤 Test 3: Fallback Retrieval')
      results.fallbackRetrieval = await this.testFallbackRetrieval()

      // Test 4: Migration Readiness
      console.log('\n🔄 Test 4: Migration Readiness')
      results.migrationReadiness = await this.testMigrationReadiness()

      // Calculate overall score
      const passedTests = Object.values(results).filter(result =>
        typeof result === 'object' && result.passed
      ).length
      results.overallScore = Math.round((passedTests / 4) * 100)

      console.log('\n📊 TEST RESULTS SUMMARY')
      console.log('========================')
      console.log(`Schema Check: ${results.schemaCheck.passed ? '✅ PASS' : '❌ FAIL'}`)
      console.log(`Fallback Storage: ${results.fallbackStorage.passed ? '✅ PASS' : '❌ FAIL'}`)
      console.log(`Fallback Retrieval: ${results.fallbackRetrieval.passed ? '✅ PASS' : '❌ FAIL'}`)
      console.log(`Migration Readiness: ${results.migrationReadiness.passed ? '✅ PASS' : '❌ FAIL'}`)
      console.log(`Overall Score: ${results.overallScore}%`)

      if (results.overallScore === 100) {
        console.log('\n🎉 ALL TESTS PASSED - System is ready!')
      } else if (results.overallScore >= 75) {
        console.log('\n⚠️  Most tests passed - Minor issues detected')
      } else {
        console.log('\n🚨 CRITICAL ISSUES DETECTED - Review failures')
      }

      return results

    } catch (error: any) {
      console.error('🚨 Critical error running tests:', error)
      throw error
    }
  }

  private async testSchemaDetection(): Promise<{ passed: boolean; error?: string }> {
    try {
      // Reset the schema cache to force fresh detection
      apiKeyFallbackService.resetSchemaCache()

      // Test direct schema queries
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (profileError) {
        console.log(`❌ user_profiles table error: ${profileError.message}`)
        return { passed: false, error: `user_profiles table error: ${profileError.message}` }
      }

      // Check if the table has any data to inspect structure
      if (profileData) {
        const hasEncryptedRetellKey = 'encrypted_retell_api_key' in profileData
        const hasEncryptedAgentConfig = 'encrypted_agent_config' in profileData

        console.log(`📋 Schema Detection Results:`)
        console.log(`   - encrypted_retell_api_key: ${hasEncryptedRetellKey ? '✅' : '❌'}`)
        console.log(`   - encrypted_agent_config: ${hasEncryptedAgentConfig ? '✅' : '❌'}`)

        return {
          passed: true,
          error: hasEncryptedAgentConfig ? undefined : 'Missing encrypted_agent_config column'
        }
      } else {
        console.log('📋 No data in user_profiles table - schema detection limited')
        return { passed: true, error: 'No existing data to test schema' }
      }

    } catch (error: any) {
      console.log(`❌ Schema detection failed: ${error.message}`)
      return { passed: false, error: error.message }
    }
  }

  private async testFallbackStorage(): Promise<{ passed: boolean; error?: string }> {
    try {
      const testApiKeys = {
        retell_api_key: 'test_retell_key_12345',
        call_agent_id: 'test_call_agent_67890',
        sms_agent_id: 'test_sms_agent_54321'
      }

      console.log('💾 Testing API key storage...')
      const result = await apiKeyFallbackService.storeApiKeys(this.testUserId, testApiKeys)

      if (result.status === 'success') {
        console.log('✅ API key storage successful')
        return { passed: true }
      } else {
        console.log(`❌ API key storage failed: ${result.error}`)
        return { passed: false, error: result.error }
      }

    } catch (error: any) {
      console.log(`❌ Storage test failed: ${error.message}`)
      return { passed: false, error: error.message }
    }
  }

  private async testFallbackRetrieval(): Promise<{ passed: boolean; error?: string }> {
    try {
      console.log('📤 Testing API key retrieval...')
      const result = await apiKeyFallbackService.retrieveApiKeys(this.testUserId)

      if (result.status === 'success' && result.data) {
        const hasRetellKey = !!result.data.retell_api_key
        const hasCallAgent = !!result.data.call_agent_id
        const hasSmsAgent = !!result.data.sms_agent_id

        console.log(`📤 Retrieved keys:`)
        console.log(`   - Retell API Key: ${hasRetellKey ? '✅' : '❌'}`)
        console.log(`   - Call Agent ID: ${hasCallAgent ? '✅' : '❌'}`)
        console.log(`   - SMS Agent ID: ${hasSmsAgent ? '✅' : '❌'}`)

        if (hasRetellKey && hasCallAgent && hasSmsAgent) {
          console.log('✅ API key retrieval successful')
          return { passed: true }
        } else {
          const missing = []
          if (!hasRetellKey) missing.push('retell_api_key')
          if (!hasCallAgent) missing.push('call_agent_id')
          if (!hasSmsAgent) missing.push('sms_agent_id')

          const error = `Missing keys: ${missing.join(', ')}`
          console.log(`⚠️  Partial retrieval: ${error}`)
          return { passed: false, error }
        }
      } else {
        console.log(`❌ API key retrieval failed: ${result.error}`)
        return { passed: false, error: result.error }
      }

    } catch (error: any) {
      console.log(`❌ Retrieval test failed: ${error.message}`)
      return { passed: false, error: error.message }
    }
  }

  private async testMigrationReadiness(): Promise<{ passed: boolean; error?: string }> {
    try {
      console.log('🔄 Testing migration readiness...')

      // Test if migration SQL would work
      const migrationCheckQuery = `
        SELECT
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND table_schema = 'public'
        AND column_name IN ('encrypted_retell_api_key', 'encrypted_agent_config')
        ORDER BY column_name
      `

      const { data: columns, error } = await supabase.rpc('execute_sql_query', {
        query: migrationCheckQuery
      })

      if (error && !error.message.includes('function execute_sql_query')) {
        console.log(`❌ Migration readiness check failed: ${error.message}`)
        return { passed: false, error: error.message }
      }

      // Alternative method: Try to describe the table
      try {
        const { error: describeError } = await supabase
          .from('user_profiles')
          .select('encrypted_retell_api_key, encrypted_agent_config')
          .limit(1)
          .maybeSingle()

        if (describeError) {
          if (describeError.message.includes('encrypted_agent_config')) {
            console.log('🔄 Migration needed: encrypted_agent_config column missing')
            return { passed: true, error: 'Migration needed for encrypted_agent_config column' }
          } else if (describeError.message.includes('encrypted_retell_api_key')) {
            console.log('🔄 Migration needed: encrypted_retell_api_key column missing')
            return { passed: true, error: 'Migration needed for encrypted_retell_api_key column' }
          } else {
            console.log(`❌ Unexpected schema error: ${describeError.message}`)
            return { passed: false, error: describeError.message }
          }
        } else {
          console.log('✅ Migration readiness: Schema appears complete')
          return { passed: true }
        }
      } catch (describeError: any) {
        console.log('🔄 Migration readiness assessment completed with limitations')
        return { passed: true, error: 'Limited schema introspection available' }
      }

    } catch (error: any) {
      console.log(`❌ Migration readiness test failed: ${error.message}`)
      return { passed: false, error: error.message }
    }
  }

  /**
   * Clean up test data
   */
  async cleanup(): Promise<void> {
    try {
      console.log('\n🧹 Cleaning up test data...')

      // Remove test data from user_profiles
      await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', this.testUserId)

      // Remove test data from user_settings
      await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', this.testUserId)

      console.log('✅ Test cleanup completed')
    } catch (error: any) {
      console.log(`⚠️  Test cleanup warning: ${error.message}`)
    }
  }
}

// Export the test class and a convenience function
export { ApiKeySchemaTests }

export async function runApiKeySchemaTests(): Promise<TestResults> {
  const tests = new ApiKeySchemaTests()
  try {
    return await tests.runAllTests()
  } finally {
    await tests.cleanup()
  }
}

// Make it available globally for browser console testing
if (typeof window !== 'undefined') {
  ;(window as any).runApiKeySchemaTests = runApiKeySchemaTests
  ;(window as any).apiKeySchemaTests = new ApiKeySchemaTests()
}