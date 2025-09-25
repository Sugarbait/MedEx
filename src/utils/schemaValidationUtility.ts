/**
 * Schema Validation Utility
 * ========================
 * Comprehensive utility for validating database schema state,
 * testing column existence, and ensuring optimal Retell AI integration.
 *
 * This utility provides:
 * 1. Column existence validation for user_profiles table
 * 2. Index verification for performance optimization
 * 3. Function availability testing
 * 4. Schema health monitoring
 * 5. Migration verification tools
 */

import { supabase } from '@/config/supabase'
import { auditLogger } from '@/services/auditLogger'

export interface SchemaValidationResult {
  status: 'success' | 'error' | 'warning'
  message: string
  details?: any
  recommendations?: string[]
}

export interface TableColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
  exists: boolean
}

export interface SchemaHealthReport {
  overall_status: 'healthy' | 'needs_migration' | 'critical_issues'
  missing_columns: string[]
  existing_columns: TableColumnInfo[]
  missing_indexes: string[]
  existing_indexes: string[]
  missing_functions: string[]
  existing_functions: string[]
  retell_integration_ready: boolean
  profile_management_ready: boolean
  performance_optimized: boolean
  recommendations: string[]
}

class SchemaValidationUtility {
  private validationCache: Map<string, { result: any; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Required columns for complete functionality
   */
  private readonly REQUIRED_COLUMNS = [
    // Profile Information
    'department',
    'position',
    'phone',
    'display_name',
    'first_name',
    'last_name',

    // Retell AI Integration
    'encrypted_agent_config',
    'encrypted_retell_api_key',
    'encrypted_call_agent_id',
    'encrypted_sms_agent_id',
    'phone_number',
    'webhook_config',
    'retell_integration_status',
    'last_retell_sync',

    // User Management
    'avatar_url',
    'timezone',
    'language',
    'is_active',
    'preferences',
    'metadata',

    // Base fields (should already exist)
    'id',
    'user_id',
    'created_at',
    'updated_at'
  ]

  /**
   * Required indexes for performance
   */
  private readonly REQUIRED_INDEXES = [
    'idx_user_profiles_department',
    'idx_user_profiles_encrypted_retell_api_key',
    'idx_user_profiles_phone_number',
    'idx_user_profiles_retell_integration_status',
    'idx_user_profiles_is_active',
    'idx_user_profiles_user_id_active',
    'idx_user_profiles_preferences_gin',
    'idx_user_profiles_webhook_config_gin',
    'idx_user_profiles_metadata_gin'
  ]

  /**
   * Required helper functions
   */
  private readonly REQUIRED_FUNCTIONS = [
    'store_retell_config',
    'get_complete_user_profile',
    'update_retell_integration_status'
  ]

  /**
   * Get cached result if still valid
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.validationCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.result as T
    }
    return null
  }

  /**
   * Cache validation result
   */
  private setCachedResult<T>(key: string, result: T): void {
    this.validationCache.set(key, {
      result,
      timestamp: Date.now()
    })
  }

  /**
   * Validate that all required columns exist in user_profiles table
   */
  async validateTableColumns(): Promise<SchemaValidationResult> {
    const cacheKey = 'validate_table_columns'
    const cached = this.getCachedResult<SchemaValidationResult>(cacheKey)
    if (cached) return cached

    try {
      console.log('SchemaValidationUtility: Checking table columns...')

      const { data: columns, error } = await supabase.rpc('get_table_columns', {
        table_name: 'user_profiles'
      }).catch(async () => {
        // Fallback method if RPC doesn't exist
        const query = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'user_profiles'
          AND table_schema = 'public'
          ORDER BY column_name;
        `
        return await supabase.rpc('execute_sql', { query })
      }).catch(async () => {
        // Direct column check fallback
        console.log('Using direct column validation method')
        const results = await Promise.allSettled(
          this.REQUIRED_COLUMNS.map(async (column) => {
            try {
              const { error } = await supabase
                .from('user_profiles')
                .select(column)
                .limit(1)
                .single()

              return {
                column_name: column,
                exists: !error || !error.message.includes(column),
                data_type: 'unknown',
                is_nullable: 'unknown',
                column_default: null
              }
            } catch (e: any) {
              return {
                column_name: column,
                exists: false,
                data_type: 'unknown',
                is_nullable: 'unknown',
                column_default: null
              }
            }
          })
        )

        return {
          data: results
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<any>).value),
          error: null
        }
      })

      if (error && !columns) {
        throw error
      }

      const existingColumns = new Set(
        (columns || []).map((col: any) => col.column_name)
      )
      const missingColumns = this.REQUIRED_COLUMNS.filter(
        col => !existingColumns.has(col)
      )

      const result: SchemaValidationResult = {
        status: missingColumns.length === 0 ? 'success' : 'error',
        message: missingColumns.length === 0
          ? `All ${this.REQUIRED_COLUMNS.length} required columns exist`
          : `Missing ${missingColumns.length} required columns`,
        details: {
          total_required: this.REQUIRED_COLUMNS.length,
          existing_columns: Array.from(existingColumns),
          missing_columns: missingColumns,
          column_info: columns || []
        },
        recommendations: missingColumns.length > 0 ? [
          'Run the COMPREHENSIVE_USER_PROFILES_SCHEMA_FIX.sql migration script',
          'Verify Supabase connection and permissions',
          'Check that user_profiles table exists'
        ] : []
      }

      this.setCachedResult(cacheKey, result)
      return result

    } catch (error: any) {
      console.error('SchemaValidationUtility: Column validation error:', error)

      const result: SchemaValidationResult = {
        status: 'error',
        message: 'Failed to validate table columns',
        details: { error: error.message },
        recommendations: [
          'Check Supabase connection',
          'Verify database permissions',
          'Ensure user_profiles table exists',
          'Run database migration script'
        ]
      }

      this.setCachedResult(cacheKey, result)
      return result
    }
  }

  /**
   * Validate that critical columns exist by testing queries
   */
  async validateCriticalColumns(): Promise<SchemaValidationResult> {
    const criticalColumns = ['department', 'encrypted_agent_config', 'encrypted_retell_api_key']

    try {
      console.log('SchemaValidationUtility: Testing critical columns...')

      const testResults = await Promise.allSettled(
        criticalColumns.map(async (column) => {
          const { error } = await supabase
            .from('user_profiles')
            .select(column)
            .limit(1)
            .single()

          return {
            column,
            exists: !error || !error.message.toLowerCase().includes('column') || !error.message.includes(column)
          }
        })
      )

      const results = testResults
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value)

      const missingCritical = results.filter(r => !r.exists).map(r => r.column)

      if (missingCritical.length === 0) {
        return {
          status: 'success',
          message: 'All critical columns are accessible',
          details: { tested_columns: criticalColumns, all_exist: true }
        }
      } else {
        return {
          status: 'error',
          message: `Missing critical columns: ${missingCritical.join(', ')}`,
          details: { missing_columns: missingCritical, results },
          recommendations: [
            'Run the database migration script immediately',
            'These columns are required for core functionality',
            'Profile saves and API key storage will fail without them'
          ]
        }
      }

    } catch (error: any) {
      console.error('SchemaValidationUtility: Critical column test error:', error)
      return {
        status: 'error',
        message: 'Failed to test critical columns',
        details: { error: error.message },
        recommendations: [
          'Check database connectivity',
          'Verify table permissions',
          'Run migration script'
        ]
      }
    }
  }

  /**
   * Check if indexes exist for performance optimization
   */
  async validateIndexes(): Promise<SchemaValidationResult> {
    const cacheKey = 'validate_indexes'
    const cached = this.getCachedResult<SchemaValidationResult>(cacheKey)
    if (cached) return cached

    try {
      console.log('SchemaValidationUtility: Checking performance indexes...')

      // Try to get index information
      const { data: indexes, error } = await supabase.rpc('get_table_indexes', {
        table_name: 'user_profiles'
      }).catch(() => ({ data: null, error: 'RPC not available' }))

      const existingIndexes = indexes
        ? indexes.map((idx: any) => idx.indexname || idx.index_name)
        : []

      const missingIndexes = this.REQUIRED_INDEXES.filter(
        idx => !existingIndexes.some((existing: string) => existing.includes(idx))
      )

      const result: SchemaValidationResult = {
        status: missingIndexes.length === 0 ? 'success' : 'warning',
        message: missingIndexes.length === 0
          ? 'All performance indexes exist'
          : `Missing ${missingIndexes.length} performance indexes`,
        details: {
          total_required: this.REQUIRED_INDEXES.length,
          existing_indexes: existingIndexes,
          missing_indexes: missingIndexes
        },
        recommendations: missingIndexes.length > 0 ? [
          'Run migration script to create missing indexes',
          'Performance may be impacted without proper indexing',
          'Consider manual index creation for immediate improvement'
        ] : []
      }

      this.setCachedResult(cacheKey, result)
      return result

    } catch (error: any) {
      console.error('SchemaValidationUtility: Index validation error:', error)

      const result: SchemaValidationResult = {
        status: 'warning',
        message: 'Could not verify index status',
        details: { error: error.message },
        recommendations: [
          'Indexes may be missing - performance could be impacted',
          'Run full migration script to ensure proper indexing'
        ]
      }

      this.setCachedResult(cacheKey, result)
      return result
    }
  }

  /**
   * Validate that helper functions exist
   */
  async validateHelperFunctions(): Promise<SchemaValidationResult> {
    const cacheKey = 'validate_functions'
    const cached = this.getCachedResult<SchemaValidationResult>(cacheKey)
    if (cached) return cached

    try {
      console.log('SchemaValidationUtility: Checking helper functions...')

      const functionTests = await Promise.allSettled(
        this.REQUIRED_FUNCTIONS.map(async (funcName) => {
          try {
            // Test if function exists by trying to call it with invalid params
            // This should fail with "function doesn't exist" or "invalid parameters"
            const { error } = await supabase.rpc(funcName, {}).catch(e => ({ error: e }))

            // If error mentions function doesn't exist, it's missing
            const exists = !error?.message?.toLowerCase().includes('does not exist') &&
                          !error?.message?.toLowerCase().includes('function') &&
                          !error?.code?.includes('42883')

            return { function: funcName, exists }
          } catch (e) {
            return { function: funcName, exists: false }
          }
        })
      )

      const results = functionTests
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value)

      const missingFunctions = results.filter(r => !r.exists).map(r => r.function)

      const result: SchemaValidationResult = {
        status: missingFunctions.length === 0 ? 'success' : 'warning',
        message: missingFunctions.length === 0
          ? 'All helper functions are available'
          : `Missing ${missingFunctions.length} helper functions`,
        details: {
          total_required: this.REQUIRED_FUNCTIONS.length,
          existing_functions: results.filter(r => r.exists).map(r => r.function),
          missing_functions: missingFunctions
        },
        recommendations: missingFunctions.length > 0 ? [
          'Helper functions missing - some operations may fail',
          'Run migration script to create missing functions',
          'Fallback methods should handle missing functions gracefully'
        ] : []
      }

      this.setCachedResult(cacheKey, result)
      return result

    } catch (error: any) {
      console.error('SchemaValidationUtility: Function validation error:', error)

      const result: SchemaValidationResult = {
        status: 'warning',
        message: 'Could not verify function availability',
        details: { error: error.message },
        recommendations: [
          'Helper functions may be missing',
          'Application should use fallback methods',
          'Run migration script to ensure functions exist'
        ]
      }

      this.setCachedResult(cacheKey, result)
      return result
    }
  }

  /**
   * Test actual functionality by attempting operations
   */
  async testActualFunctionality(): Promise<SchemaValidationResult> {
    try {
      console.log('SchemaValidationUtility: Testing actual functionality...')

      const testUserId = `schema-test-${Date.now()}`
      const testData = {
        user_id: testUserId,
        department: 'Test Department',
        encrypted_agent_config: { test: 'config' },
        encrypted_retell_api_key: 'test-key'
      }

      // Test 1: Can we insert data with new columns?
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert(testData)

      if (insertError) {
        console.warn('Insert test failed:', insertError.message)

        // Check which columns caused the error
        const missingColumns = this.REQUIRED_COLUMNS.filter(col =>
          insertError.message.toLowerCase().includes(col)
        )

        return {
          status: 'error',
          message: 'Cannot insert data with required columns',
          details: {
            insert_error: insertError.message,
            likely_missing_columns: missingColumns
          },
          recommendations: [
            'Run database migration script immediately',
            'Profile and API key operations will fail until fixed',
            'Check specific error for missing column details'
          ]
        }
      }

      // Test 2: Can we query the new columns?
      const { data: queryData, error: queryError } = await supabase
        .from('user_profiles')
        .select('department, encrypted_agent_config, encrypted_retell_api_key')
        .eq('user_id', testUserId)
        .single()

      if (queryError) {
        console.warn('Query test failed:', queryError.message)
      }

      // Test 3: Can we update with new columns?
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          department: 'Updated Department',
          retell_integration_status: 'configured'
        })
        .eq('user_id', testUserId)

      // Cleanup test data
      await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', testUserId)

      if (queryError || updateError) {
        return {
          status: 'error',
          message: 'Schema operations are failing',
          details: {
            query_error: queryError?.message,
            update_error: updateError?.message
          },
          recommendations: [
            'Schema migration may be incomplete',
            'Some columns may be missing or have wrong types',
            'Run migration script to fix schema issues'
          ]
        }
      }

      // All tests passed
      await auditLogger.logSecurityEvent(
        'SCHEMA_VALIDATION_PASSED',
        'user_profiles',
        true,
        { test_user_id: testUserId }
      )

      return {
        status: 'success',
        message: 'All functionality tests passed',
        details: {
          insert_successful: true,
          query_successful: true,
          update_successful: true,
          test_data_cleaned: true
        }
      }

    } catch (error: any) {
      console.error('SchemaValidationUtility: Functionality test error:', error)

      return {
        status: 'error',
        message: 'Functionality testing failed',
        details: { error: error.message },
        recommendations: [
          'Database may be inaccessible or corrupted',
          'Check connection and permissions',
          'Run migration script to repair schema'
        ]
      }
    }
  }

  /**
   * Generate comprehensive schema health report
   */
  async generateHealthReport(): Promise<SchemaHealthReport> {
    console.log('SchemaValidationUtility: Generating comprehensive health report...')

    try {
      const [
        columnValidation,
        criticalValidation,
        indexValidation,
        functionValidation,
        functionalityTest
      ] = await Promise.all([
        this.validateTableColumns(),
        this.validateCriticalColumns(),
        this.validateIndexes(),
        this.validateHelperFunctions(),
        this.testActualFunctionality()
      ])

      // Determine overall health status
      let overallStatus: 'healthy' | 'needs_migration' | 'critical_issues' = 'healthy'

      if (columnValidation.status === 'error' ||
          criticalValidation.status === 'error' ||
          functionalityTest.status === 'error') {
        overallStatus = 'critical_issues'
      } else if (columnValidation.status === 'warning' ||
                 indexValidation.status === 'warning' ||
                 functionValidation.status === 'warning') {
        overallStatus = 'needs_migration'
      }

      // Compile recommendations
      const allRecommendations = [
        ...(columnValidation.recommendations || []),
        ...(criticalValidation.recommendations || []),
        ...(indexValidation.recommendations || []),
        ...(functionValidation.recommendations || []),
        ...(functionalityTest.recommendations || [])
      ]

      const uniqueRecommendations = Array.from(new Set(allRecommendations))

      const report: SchemaHealthReport = {
        overall_status: overallStatus,
        missing_columns: columnValidation.details?.missing_columns || [],
        existing_columns: columnValidation.details?.existing_columns || [],
        missing_indexes: indexValidation.details?.missing_indexes || [],
        existing_indexes: indexValidation.details?.existing_indexes || [],
        missing_functions: functionValidation.details?.missing_functions || [],
        existing_functions: functionValidation.details?.existing_functions || [],
        retell_integration_ready:
          criticalValidation.status === 'success' &&
          columnValidation.details?.missing_columns?.filter((col: string) =>
            col.includes('retell') || col.includes('agent') || col === 'phone_number'
          ).length === 0,
        profile_management_ready:
          criticalValidation.status === 'success' &&
          !columnValidation.details?.missing_columns?.includes('department'),
        performance_optimized: indexValidation.status === 'success',
        recommendations: uniqueRecommendations
      }

      console.log('SchemaValidationUtility: Health report generated:', {
        overall_status: report.overall_status,
        missing_columns: report.missing_columns.length,
        retell_ready: report.retell_integration_ready,
        profile_ready: report.profile_management_ready
      })

      return report

    } catch (error: any) {
      console.error('SchemaValidationUtility: Health report generation failed:', error)

      return {
        overall_status: 'critical_issues',
        missing_columns: [],
        existing_columns: [],
        missing_indexes: [],
        existing_indexes: [],
        missing_functions: [],
        existing_functions: [],
        retell_integration_ready: false,
        profile_management_ready: false,
        performance_optimized: false,
        recommendations: [
          'Health report generation failed',
          'Database connection or permissions issue',
          'Run migration script and retry validation'
        ]
      }
    }
  }

  /**
   * Clear validation cache (use after running migrations)
   */
  clearCache(): void {
    this.validationCache.clear()
    console.log('SchemaValidationUtility: Validation cache cleared')
  }

  /**
   * Quick validation for critical issues only
   */
  async quickValidation(): Promise<{
    isHealthy: boolean
    criticalIssues: string[]
    canSaveProfiles: boolean
    canSaveApiKeys: boolean
  }> {
    try {
      const criticalTest = await this.validateCriticalColumns()

      const criticalIssues: string[] = []
      let canSaveProfiles = true
      let canSaveApiKeys = true

      if (criticalTest.status === 'error') {
        const missingColumns = criticalTest.details?.missing_columns || []

        if (missingColumns.includes('department')) {
          criticalIssues.push('Cannot save profile information - department column missing')
          canSaveProfiles = false
        }

        if (missingColumns.includes('encrypted_agent_config')) {
          criticalIssues.push('Cannot save API keys - encrypted_agent_config column missing')
          canSaveApiKeys = false
        }

        if (missingColumns.includes('encrypted_retell_api_key')) {
          criticalIssues.push('Retell AI integration suboptimal - encrypted_retell_api_key column missing')
        }
      }

      return {
        isHealthy: criticalIssues.length === 0,
        criticalIssues,
        canSaveProfiles,
        canSaveApiKeys
      }

    } catch (error: any) {
      console.error('SchemaValidationUtility: Quick validation failed:', error)

      return {
        isHealthy: false,
        criticalIssues: ['Database validation failed - connection or permission issue'],
        canSaveProfiles: false,
        canSaveApiKeys: false
      }
    }
  }
}

// Export singleton instance
export const schemaValidationUtility = new SchemaValidationUtility()

// Export types for use in components
export type { SchemaValidationResult, TableColumnInfo, SchemaHealthReport }