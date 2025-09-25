/**
 * Enhanced API Key Fallback Service
 * =================================
 * Advanced fallback system for API key storage with comprehensive
 * schema validation and optimal Retell AI integration support.
 *
 * This enhanced service provides:
 * 1. Advanced schema detection with validation utility integration
 * 2. Support for all new user_profiles columns
 * 3. Optimal Retell AI configuration management
 * 4. Intelligent fallback routing based on schema state
 * 5. Performance optimization with caching
 * 6. Migration detection and automatic schema updates
 */

import { supabase } from '@/config/supabase'
import { encryptionService } from './encryption'
import { auditLogger } from './auditLogger'
import { schemaValidationUtility } from '@/utils/schemaValidationUtility'
import { ServiceResponse } from '@/types/supabase'

interface RetellApiKeys {
  retell_api_key?: string
  call_agent_id?: string
  sms_agent_id?: string
  phone_number?: string
  webhook_url?: string
}

interface EncryptedRetellKeys {
  encrypted_retell_api_key?: string
  encrypted_call_agent_id?: string
  encrypted_sms_agent_id?: string
}

interface RetellConfiguration {
  api_key: string
  call_agent_id?: string
  sms_agent_id?: string
  phone_number?: string
  webhook_config?: {
    webhook_url: string
    events: string[]
    secret?: string
  }
  integration_status?: 'not_configured' | 'configured' | 'active' | 'error' | 'disabled'
}

interface SchemaCapabilities {
  hasProfileColumns: boolean // department, position, phone, etc.
  hasEncryptedAgentConfig: boolean // encrypted_agent_config
  hasEncryptedRetellApiKey: boolean // encrypted_retell_api_key
  hasRetellIntegrationColumns: boolean // call_agent_id, sms_agent_id, phone_number, etc.
  hasStatusTracking: boolean // retell_integration_status, last_retell_sync
  hasOptimalSchema: boolean // all columns for best performance
}

export class EnhancedApiKeyFallbackService {
  private schemaCapabilities: SchemaCapabilities | null = null
  private schemaLastChecked = 0
  private readonly SCHEMA_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  private validationUtility = schemaValidationUtility

  /**
   * Advanced schema detection with comprehensive column checking
   */
  private async detectSchemaCapabilities(): Promise<SchemaCapabilities> {
    // Use cached result if still valid
    if (this.schemaCapabilities &&
        Date.now() - this.schemaLastChecked < this.SCHEMA_CACHE_DURATION) {
      return this.schemaCapabilities
    }

    console.log('EnhancedApiKeyFallbackService: Detecting schema capabilities...')

    try {
      // Use the validation utility for comprehensive schema checking
      const healthReport = await this.validationUtility.generateHealthReport()

      const missingColumns = new Set(healthReport.missing_columns)

      const capabilities: SchemaCapabilities = {
        hasProfileColumns: !missingColumns.has('department') &&
                          !missingColumns.has('position') &&
                          !missingColumns.has('phone'),

        hasEncryptedAgentConfig: !missingColumns.has('encrypted_agent_config'),

        hasEncryptedRetellApiKey: !missingColumns.has('encrypted_retell_api_key'),

        hasRetellIntegrationColumns: !missingColumns.has('encrypted_call_agent_id') &&
                                   !missingColumns.has('encrypted_sms_agent_id') &&
                                   !missingColumns.has('phone_number') &&
                                   !missingColumns.has('webhook_config'),

        hasStatusTracking: !missingColumns.has('retell_integration_status') &&
                          !missingColumns.has('last_retell_sync'),

        hasOptimalSchema: healthReport.overall_status === 'healthy' &&
                         healthReport.retell_integration_ready &&
                         healthReport.profile_management_ready
      }

      this.schemaCapabilities = capabilities
      this.schemaLastChecked = Date.now()

      console.log('EnhancedApiKeyFallbackService: Schema capabilities detected:', {
        optimal: capabilities.hasOptimalSchema,
        retell_ready: capabilities.hasRetellIntegrationColumns,
        profile_ready: capabilities.hasProfileColumns,
        fallback_needed: !capabilities.hasOptimalSchema
      })

      // Log schema status for monitoring
      await auditLogger.logSecurityEvent(
        'SCHEMA_CAPABILITIES_DETECTED',
        'user_profiles',
        capabilities.hasOptimalSchema,
        {
          capabilities,
          migration_needed: !capabilities.hasOptimalSchema
        }
      )

      return capabilities

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Schema detection failed:', error)

      // Conservative fallback - assume basic schema only
      const conservativeCapabilities: SchemaCapabilities = {
        hasProfileColumns: false,
        hasEncryptedAgentConfig: false,
        hasEncryptedRetellApiKey: false,
        hasRetellIntegrationColumns: false,
        hasStatusTracking: false,
        hasOptimalSchema: false
      }

      this.schemaCapabilities = conservativeCapabilities
      this.schemaLastChecked = Date.now()

      return conservativeCapabilities
    }
  }

  /**
   * Store Retell AI configuration using optimal available method
   */
  async storeRetellConfiguration(
    userId: string,
    config: RetellConfiguration
  ): Promise<ServiceResponse<boolean>> {
    try {
      console.log('EnhancedApiKeyFallbackService: Storing Retell configuration...')

      const schema = await this.detectSchemaCapabilities()

      // Method 1: Optimal schema - use new dedicated columns
      if (schema.hasOptimalSchema) {
        console.log('Using optimal schema storage method')
        return await this.storeWithOptimalSchema(userId, config)
      }

      // Method 2: Partial schema - use available columns + fallbacks
      if (schema.hasEncryptedRetellApiKey || schema.hasEncryptedAgentConfig) {
        console.log('Using partial schema storage method')
        return await this.storeWithPartialSchema(userId, config, schema)
      }

      // Method 3: Legacy fallback - user_settings only
      console.log('Using legacy fallback storage method')
      return await this.storeWithLegacyFallback(userId, config)

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Configuration storage failed:', error)

      try {
        // Emergency fallback to encrypted localStorage
        console.log('Using emergency localStorage fallback')
        return await this.storeInEmergencyLocalStorage(userId, config)
      } catch (emergencyError: any) {
        await auditLogger.logSecurityEvent(
          'RETELL_CONFIG_STORAGE_FAILED',
          'all_methods',
          false,
          { userId, error: error.message, emergency_error: emergencyError.message }
        )

        return {
          status: 'error',
          error: `All storage methods failed: ${error.message}`
        }
      }
    }
  }

  /**
   * Store using optimal schema (all columns available)
   */
  private async storeWithOptimalSchema(
    userId: string,
    config: RetellConfiguration
  ): Promise<ServiceResponse<boolean>> {
    try {
      // Encrypt sensitive data
      const encryptedApiKey = config.api_key ?
        await encryptionService.encryptString(config.api_key) : null

      const encryptedCallAgent = config.call_agent_id ?
        await encryptionService.encryptString(config.call_agent_id) : null

      const encryptedSmsAgent = config.sms_agent_id ?
        await encryptionService.encryptString(config.sms_agent_id) : null

      // Use the new helper function if available
      try {
        const { data: functionResult, error: functionError } = await supabase
          .rpc('store_retell_config', {
            target_user_id: userId,
            api_key: encryptedApiKey,
            call_agent_id: encryptedCallAgent,
            sms_agent_id: encryptedSmsAgent,
            phone_num: config.phone_number,
            webhook_conf: config.webhook_config || null
          })

        if (!functionError && functionResult) {
          console.log('EnhancedApiKeyFallbackService: Optimal storage via helper function succeeded')

          await auditLogger.logSecurityEvent(
            'RETELL_CONFIG_STORED_OPTIMAL',
            'user_profiles',
            true,
            { userId, method: 'helper_function', has_api_key: !!config.api_key }
          )

          return { status: 'success', data: true }
        }

        console.log('Helper function not available, using direct insert')
      } catch (functionError) {
        console.log('Helper function failed, using direct insert')
      }

      // Direct database insert/update
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          encrypted_retell_api_key: encryptedApiKey,
          encrypted_call_agent_id: encryptedCallAgent,
          encrypted_sms_agent_id: encryptedSmsAgent,
          phone_number: config.phone_number,
          webhook_config: config.webhook_config,
          retell_integration_status: config.integration_status || 'configured',
          last_retell_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      await auditLogger.logSecurityEvent(
        'RETELL_CONFIG_STORED_OPTIMAL',
        'user_profiles',
        true,
        { userId, method: 'direct_upsert', has_api_key: !!config.api_key }
      )

      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Optimal storage failed:', error)
      throw error
    }
  }

  /**
   * Store using partial schema (some columns available)
   */
  private async storeWithPartialSchema(
    userId: string,
    config: RetellConfiguration,
    schema: SchemaCapabilities
  ): Promise<ServiceResponse<boolean>> {
    try {
      const encryptedApiKey = config.api_key ?
        await encryptionService.encryptString(config.api_key) : null

      // Store what we can in user_profiles
      if (schema.hasEncryptedRetellApiKey) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: userId,
            encrypted_retell_api_key: encryptedApiKey,
            ...(schema.hasEncryptedAgentConfig && {
              encrypted_agent_config: {
                call_agent_id: config.call_agent_id,
                sms_agent_id: config.sms_agent_id,
                phone_number: config.phone_number
              }
            }),
            ...(schema.hasStatusTracking && {
              retell_integration_status: config.integration_status || 'configured',
              last_retell_sync: new Date().toISOString()
            }),
            updated_at: new Date().toISOString()
          })

        if (profileError) throw profileError
      }

      // Store additional config in user_settings as fallback
      const fallbackConfig = {
        retell_api_key: config.api_key,
        call_agent_id: config.call_agent_id,
        sms_agent_id: config.sms_agent_id,
        phone_number: config.phone_number,
        webhook_config: config.webhook_config
      }

      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          retell_config: fallbackConfig,
          updated_at: new Date().toISOString()
        })

      if (settingsError) throw settingsError

      await auditLogger.logSecurityEvent(
        'RETELL_CONFIG_STORED_PARTIAL',
        'user_profiles,user_settings',
        true,
        { userId, method: 'partial_schema', capabilities: schema }
      )

      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Partial storage failed:', error)
      throw error
    }
  }

  /**
   * Store using legacy fallback (user_settings only)
   */
  private async storeWithLegacyFallback(
    userId: string,
    config: RetellConfiguration
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          retell_config: {
            api_key: config.api_key,
            call_agent_id: config.call_agent_id,
            sms_agent_id: config.sms_agent_id,
            phone_number: config.phone_number,
            webhook_config: config.webhook_config,
            integration_status: config.integration_status || 'configured'
          },
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      await auditLogger.logSecurityEvent(
        'RETELL_CONFIG_STORED_LEGACY',
        'user_settings',
        true,
        { userId, method: 'legacy_fallback' }
      )

      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Legacy storage failed:', error)
      throw error
    }
  }

  /**
   * Emergency localStorage fallback
   */
  private async storeInEmergencyLocalStorage(
    userId: string,
    config: RetellConfiguration
  ): Promise<ServiceResponse<boolean>> {
    try {
      const encryptedConfig = {
        encrypted_api_key: config.api_key ?
          await encryptionService.encryptString(config.api_key) : null,
        encrypted_call_agent_id: config.call_agent_id ?
          await encryptionService.encryptString(config.call_agent_id) : null,
        encrypted_sms_agent_id: config.sms_agent_id ?
          await encryptionService.encryptString(config.sms_agent_id) : null,
        phone_number: config.phone_number,
        webhook_config: config.webhook_config,
        stored_at: new Date().toISOString(),
        method: 'emergency_localStorage'
      }

      const storageKey = `retell_config_${userId}`
      localStorage.setItem(storageKey, JSON.stringify(encryptedConfig))

      await auditLogger.logSecurityEvent(
        'RETELL_CONFIG_STORED_EMERGENCY',
        'localStorage',
        true,
        { userId, method: 'emergency_localStorage' }
      )

      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Emergency storage failed:', error)
      throw error
    }
  }

  /**
   * Retrieve Retell AI configuration using best available method
   */
  async retrieveRetellConfiguration(userId: string): Promise<ServiceResponse<RetellConfiguration | null>> {
    try {
      console.log('EnhancedApiKeyFallbackService: Retrieving Retell configuration...')

      const schema = await this.detectSchemaCapabilities()

      // Method 1: Optimal schema retrieval
      if (schema.hasOptimalSchema) {
        const result = await this.retrieveFromOptimalSchema(userId)
        if (result.status === 'success' && result.data) return result
      }

      // Method 2: Partial schema retrieval
      if (schema.hasEncryptedRetellApiKey || schema.hasEncryptedAgentConfig) {
        const result = await this.retrieveFromPartialSchema(userId, schema)
        if (result.status === 'success' && result.data) return result
      }

      // Method 3: Legacy fallback retrieval
      const legacyResult = await this.retrieveFromLegacyFallback(userId)
      if (legacyResult.status === 'success' && legacyResult.data) return legacyResult

      // Method 4: Emergency localStorage retrieval
      return await this.retrieveFromEmergencyLocalStorage(userId)

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Configuration retrieval failed:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Retrieve from optimal schema
   */
  private async retrieveFromOptimalSchema(userId: string): Promise<ServiceResponse<RetellConfiguration | null>> {
    try {
      // Try using helper function first
      try {
        const { data: functionResult, error: functionError } = await supabase
          .rpc('get_complete_user_profile', { target_user_id: userId })

        if (!functionError && functionResult && functionResult.length > 0) {
          const profile = functionResult[0]
          if (profile.encrypted_retell_api_key) {
            const config: RetellConfiguration = {
              api_key: await encryptionService.decryptString(profile.encrypted_retell_api_key),
              call_agent_id: profile.encrypted_call_agent_id ?
                await encryptionService.decryptString(profile.encrypted_call_agent_id) : undefined,
              sms_agent_id: profile.encrypted_sms_agent_id ?
                await encryptionService.decryptString(profile.encrypted_sms_agent_id) : undefined,
              phone_number: profile.phone_number || undefined,
              webhook_config: profile.webhook_config || undefined,
              integration_status: profile.retell_integration_status || 'not_configured'
            }

            return { status: 'success', data: config }
          }
        }
      } catch (functionError) {
        console.log('Helper function not available, using direct query')
      }

      // Direct database query
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          encrypted_retell_api_key,
          encrypted_call_agent_id,
          encrypted_sms_agent_id,
          phone_number,
          webhook_config,
          retell_integration_status
        `)
        .eq('user_id', userId)
        .single()

      if (error) throw error

      if (!data || !data.encrypted_retell_api_key) {
        return { status: 'success', data: null }
      }

      const config: RetellConfiguration = {
        api_key: await encryptionService.decryptString(data.encrypted_retell_api_key),
        call_agent_id: data.encrypted_call_agent_id ?
          await encryptionService.decryptString(data.encrypted_call_agent_id) : undefined,
        sms_agent_id: data.encrypted_sms_agent_id ?
          await encryptionService.decryptString(data.encrypted_sms_agent_id) : undefined,
        phone_number: data.phone_number || undefined,
        webhook_config: data.webhook_config || undefined,
        integration_status: data.retell_integration_status || 'not_configured'
      }

      return { status: 'success', data: config }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Optimal retrieval failed:', error)
      throw error
    }
  }

  /**
   * Retrieve from partial schema
   */
  private async retrieveFromPartialSchema(
    userId: string,
    schema: SchemaCapabilities
  ): Promise<ServiceResponse<RetellConfiguration | null>> {
    try {
      const config: Partial<RetellConfiguration> = {}

      // Get what we can from user_profiles
      if (schema.hasEncryptedRetellApiKey) {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select(`
            encrypted_retell_api_key,
            ${schema.hasEncryptedAgentConfig ? 'encrypted_agent_config,' : ''}
            ${schema.hasStatusTracking ? 'retell_integration_status' : ''}
          `)
          .eq('user_id', userId)
          .single()

        if (!profileError && profileData) {
          if (profileData.encrypted_retell_api_key) {
            config.api_key = await encryptionService.decryptString(profileData.encrypted_retell_api_key)
          }

          if (schema.hasEncryptedAgentConfig && profileData.encrypted_agent_config) {
            const agentConfig = profileData.encrypted_agent_config
            config.call_agent_id = agentConfig.call_agent_id
            config.sms_agent_id = agentConfig.sms_agent_id
            config.phone_number = agentConfig.phone_number
          }

          if (schema.hasStatusTracking) {
            config.integration_status = profileData.retell_integration_status || 'not_configured'
          }
        }
      }

      // Get additional data from user_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('retell_config')
        .eq('user_id', userId)
        .single()

      if (!settingsError && settingsData?.retell_config) {
        const retellConfig = settingsData.retell_config
        config.call_agent_id = config.call_agent_id || retellConfig.call_agent_id
        config.sms_agent_id = config.sms_agent_id || retellConfig.sms_agent_id
        config.phone_number = config.phone_number || retellConfig.phone_number
        config.webhook_config = config.webhook_config || retellConfig.webhook_config
        config.integration_status = config.integration_status || retellConfig.integration_status
      }

      if (!config.api_key) {
        return { status: 'success', data: null }
      }

      return { status: 'success', data: config as RetellConfiguration }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Partial retrieval failed:', error)
      throw error
    }
  }

  /**
   * Retrieve from legacy fallback
   */
  private async retrieveFromLegacyFallback(userId: string): Promise<ServiceResponse<RetellConfiguration | null>> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('retell_config')
        .eq('user_id', userId)
        .single()

      if (error) throw error

      if (!data?.retell_config?.api_key) {
        return { status: 'success', data: null }
      }

      const retellConfig = data.retell_config
      const config: RetellConfiguration = {
        api_key: retellConfig.api_key,
        call_agent_id: retellConfig.call_agent_id,
        sms_agent_id: retellConfig.sms_agent_id,
        phone_number: retellConfig.phone_number,
        webhook_config: retellConfig.webhook_config,
        integration_status: retellConfig.integration_status || 'not_configured'
      }

      return { status: 'success', data: config }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Legacy retrieval failed:', error)
      throw error
    }
  }

  /**
   * Retrieve from emergency localStorage
   */
  private async retrieveFromEmergencyLocalStorage(userId: string): Promise<ServiceResponse<RetellConfiguration | null>> {
    try {
      const storageKey = `retell_config_${userId}`
      const storedData = localStorage.getItem(storageKey)

      if (!storedData) {
        return { status: 'success', data: null }
      }

      const encryptedConfig = JSON.parse(storedData)

      if (!encryptedConfig.encrypted_api_key) {
        return { status: 'success', data: null }
      }

      const config: RetellConfiguration = {
        api_key: await encryptionService.decryptString(encryptedConfig.encrypted_api_key),
        call_agent_id: encryptedConfig.encrypted_call_agent_id ?
          await encryptionService.decryptString(encryptedConfig.encrypted_call_agent_id) : undefined,
        sms_agent_id: encryptedConfig.encrypted_sms_agent_id ?
          await encryptionService.decryptString(encryptedConfig.encrypted_sms_agent_id) : undefined,
        phone_number: encryptedConfig.phone_number,
        webhook_config: encryptedConfig.webhook_config,
        integration_status: 'configured' // Default for localStorage
      }

      return { status: 'success', data: config }

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Emergency retrieval failed:', error)
      return { status: 'success', data: null }
    }
  }

  /**
   * Check current schema status and provide migration guidance
   */
  async getSchemaStatus(): Promise<{
    optimal: boolean
    capabilities: SchemaCapabilities
    migrationNeeded: boolean
    recommendations: string[]
  }> {
    const capabilities = await this.detectSchemaCapabilities()

    const recommendations: string[] = []

    if (!capabilities.hasOptimalSchema) {
      recommendations.push('Run COMPREHENSIVE_USER_PROFILES_SCHEMA_FIX.sql migration')
    }

    if (!capabilities.hasProfileColumns) {
      recommendations.push('Profile information saves will fail without migration')
    }

    if (!capabilities.hasEncryptedAgentConfig && !capabilities.hasEncryptedRetellApiKey) {
      recommendations.push('API key storage is using suboptimal fallback methods')
    }

    if (!capabilities.hasRetellIntegrationColumns) {
      recommendations.push('Retell AI integration features are limited without proper schema')
    }

    return {
      optimal: capabilities.hasOptimalSchema,
      capabilities,
      migrationNeeded: !capabilities.hasOptimalSchema,
      recommendations
    }
  }

  /**
   * Clear schema cache (use after running migrations)
   */
  clearSchemaCache(): void {
    this.schemaCapabilities = null
    this.schemaLastChecked = 0
    this.validationUtility.clearCache()
    console.log('EnhancedApiKeyFallbackService: Schema cache cleared')
  }

  /**
   * Test all storage and retrieval methods
   */
  async testAllMethods(userId: string = `test-${Date.now()}`): Promise<{
    optimal_schema: boolean
    partial_schema: boolean
    legacy_fallback: boolean
    emergency_localStorage: boolean
    overall_success: boolean
  }> {
    const testConfig: RetellConfiguration = {
      api_key: 'test-key-123',
      call_agent_id: 'test-call-agent',
      sms_agent_id: 'test-sms-agent',
      phone_number: '+1234567890'
    }

    const results = {
      optimal_schema: false,
      partial_schema: false,
      legacy_fallback: false,
      emergency_localStorage: false,
      overall_success: false
    }

    try {
      // Test storage
      const storeResult = await this.storeRetellConfiguration(userId, testConfig)
      if (storeResult.status === 'success') {
        // Test retrieval
        const retrieveResult = await this.retrieveRetellConfiguration(userId)
        if (retrieveResult.status === 'success' && retrieveResult.data?.api_key === testConfig.api_key) {
          results.overall_success = true

          // Determine which method was used based on schema capabilities
          const capabilities = await this.detectSchemaCapabilities()
          results.optimal_schema = capabilities.hasOptimalSchema
          results.partial_schema = !capabilities.hasOptimalSchema &&
                                 (capabilities.hasEncryptedRetellApiKey || capabilities.hasEncryptedAgentConfig)
          results.legacy_fallback = !capabilities.hasEncryptedRetellApiKey && !capabilities.hasEncryptedAgentConfig
        }
      }

      // Test emergency method explicitly
      try {
        await this.storeInEmergencyLocalStorage(userId, testConfig)
        const emergencyResult = await this.retrieveFromEmergencyLocalStorage(userId)
        results.emergency_localStorage = emergencyResult.status === 'success'
      } catch (emergencyError) {
        console.warn('Emergency localStorage test failed:', emergencyError)
      }

      // Cleanup test data
      await Promise.allSettled([
        supabase.from('user_profiles').delete().eq('user_id', userId),
        supabase.from('user_settings').delete().eq('user_id', userId)
      ])

      localStorage.removeItem(`retell_config_${userId}`)

      return results

    } catch (error: any) {
      console.error('EnhancedApiKeyFallbackService: Method testing failed:', error)
      return results
    }
  }
}

// Export singleton instance
export const enhancedApiKeyFallbackService = new EnhancedApiKeyFallbackService()

// Export types for use in other components
export type { RetellApiKeys, RetellConfiguration, SchemaCapabilities }