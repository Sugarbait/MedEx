/**
 * MFA Backend Service - Unified Backend Interface
 *
 * Provides a single, secure interface for all MFA operations
 * Integrates secureTotpService with proper error handling and logging
 */

import { secureTotpService } from './secureTotpService'
import { totpMigrationService } from './totpMigrationService'
import { createAuditEntry } from '../utils/encryption'

interface MFASetupResponse {
  success: boolean
  qrCodeUrl?: string
  manualKey?: string
  backupCodes?: string[]
  error?: string
  requiresMigration?: boolean
}

interface MFAVerificationResponse {
  success: boolean
  enabled?: boolean
  error?: string
  timeSyncWarning?: boolean
}

interface MFAStatusResponse {
  hasSetup: boolean
  isEnabled: boolean
  requiresSetup: boolean
  requiresMigration: boolean
}

class MFABackendService {
  /**
   * Initialize MFA setup for a user with migration check
   */
  async setupMFA(userId: string, userEmail: string): Promise<MFASetupResponse> {
    console.log(`🚀 MFA Backend: Setting up MFA for ${userId} (${userEmail})`)

    try {
      // 1. Check if user needs migration first
      const migrationResult = await totpMigrationService.migrateUserTOTP(userId)
      if (!migrationResult) {
        console.warn('⚠️ MFA Backend: Migration failed, continuing with setup...')
      }

      // 2. Generate fresh TOTP setup using secure service
      const setupResult = await secureTotpService.generateTOTPSetup(userId, userEmail)

      if (setupResult.success) {
        // 3. Create audit log
        try {
          const auditEntry = createAuditEntry('MFA_SETUP_INITIATED', `user:${userId}`, {
            email: userEmail,
            timestamp: new Date().toISOString()
          })
          console.log('📝 MFA Backend: Audit log created for MFA setup')
        } catch (auditError) {
          console.warn('⚠️ MFA Backend: Audit logging failed:', auditError)
        }

        return {
          success: true,
          qrCodeUrl: setupResult.qr_url,
          manualKey: setupResult.manual_entry_key,
          backupCodes: setupResult.backup_codes
        }
      } else {
        return {
          success: false,
          error: setupResult.error || 'Failed to generate MFA setup'
        }
      }

    } catch (error) {
      console.error('❌ MFA Backend: Setup failed:', error)
      return {
        success: false,
        error: 'MFA setup failed. Please try again.'
      }
    }
  }

  /**
   * Verify MFA code with comprehensive error handling
   */
  async verifyMFA(userId: string, code: string, enableOnSuccess: boolean = false): Promise<MFAVerificationResponse> {
    console.log(`🔍 MFA Backend: Verifying MFA for ${userId}`)

    try {
      // 1. Input sanitization
      const sanitizedCode = code?.trim().replace(/\s/g, '')

      if (!sanitizedCode) {
        return {
          success: false,
          error: 'Please enter a verification code'
        }
      }

      // 2. Check if user needs migration
      const migrationResult = await totpMigrationService.migrateUserTOTP(userId)
      if (!migrationResult) {
        console.warn('⚠️ MFA Backend: Migration failed during verification')
      }

      // 3. Perform verification using secure service
      const verificationResult = await secureTotpService.verifyTOTP(userId, sanitizedCode, enableOnSuccess)

      if (verificationResult.success) {
        // 4. Create success audit log
        try {
          const auditEntry = createAuditEntry('MFA_VERIFICATION_SUCCESS', `user:${userId}`, {
            enabledOnSuccess: enableOnSuccess,
            timeSyncIssue: !verificationResult.timeSync,
            timestamp: new Date().toISOString()
          })
          console.log('📝 MFA Backend: Audit log created for successful MFA verification')
        } catch (auditError) {
          console.warn('⚠️ MFA Backend: Audit logging failed:', auditError)
        }

        return {
          success: true,
          enabled: enableOnSuccess,
          timeSyncWarning: !verificationResult.timeSync
        }
      } else {
        // 5. Create failure audit log (without sensitive data)
        try {
          const auditEntry = createAuditEntry('MFA_VERIFICATION_FAILED', `user:${userId}`, {
            error: 'Invalid code provided',
            timestamp: new Date().toISOString()
          })
          console.log('📝 MFA Backend: Audit log created for failed MFA verification')
        } catch (auditError) {
          console.warn('⚠️ MFA Backend: Audit logging failed:', auditError)
        }

        return {
          success: false,
          error: verificationResult.error || 'Invalid verification code'
        }
      }

    } catch (error) {
      console.error('❌ MFA Backend: Verification failed:', error)

      // Create error audit log
      try {
        const auditEntry = createAuditEntry('MFA_VERIFICATION_ERROR', `user:${userId}`, {
          error: 'System error during verification',
          timestamp: new Date().toISOString()
        })
      } catch (auditError) {
        console.warn('⚠️ MFA Backend: Audit logging failed:', auditError)
      }

      return {
        success: false,
        error: 'Verification failed due to system error. Please try again.'
      }
    }
  }

  /**
   * Get comprehensive MFA status for a user
   */
  async getMFAStatus(userId: string): Promise<MFAStatusResponse> {
    console.log(`📊 MFA Backend: Getting MFA status for ${userId}`)

    try {
      // 1. Check if migration is needed
      const migrationStatus = await totpMigrationService.getMigrationStatus()
      const needsMigration = migrationStatus.migrationNeeded

      // 2. Check current status using secure service
      const hasSetup = await secureTotpService.hasTOTPSetup(userId)
      const isEnabled = await secureTotpService.isTOTPEnabled(userId)

      return {
        hasSetup,
        isEnabled,
        requiresSetup: !hasSetup,
        requiresMigration: needsMigration
      }

    } catch (error) {
      console.error('❌ MFA Backend: Status check failed:', error)

      return {
        hasSetup: false,
        isEnabled: false,
        requiresSetup: true,
        requiresMigration: false
      }
    }
  }

  /**
   * Disable MFA for a user with proper cleanup
   */
  async disableMFA(userId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`🔒 MFA Backend: Disabling MFA for ${userId}`)

    try {
      // 1. Disable using secure service
      const disableResult = await secureTotpService.disableTOTP(userId)

      if (disableResult) {
        // 2. Create audit log
        try {
          const auditEntry = createAuditEntry('MFA_DISABLED', `user:${userId}`, {
            timestamp: new Date().toISOString()
          })
          console.log('📝 MFA Backend: Audit log created for MFA disable')
        } catch (auditError) {
          console.warn('⚠️ MFA Backend: Audit logging failed:', auditError)
        }

        return { success: true }
      } else {
        return {
          success: false,
          error: 'Failed to disable MFA. Please try again.'
        }
      }

    } catch (error) {
      console.error('❌ MFA Backend: Disable failed:', error)
      return {
        success: false,
        error: 'MFA disable failed due to system error.'
      }
    }
  }

  /**
   * Emergency recovery for problematic users
   */
  async emergencyRecovery(userId: string): Promise<{
    success: boolean
    message: string
    actionsTaken: string[]
  }> {
    console.log(`🚨 MFA Backend: Emergency recovery for ${userId}`)

    try {
      // 1. Perform emergency fix
      const fixResult = await totpMigrationService.emergencyUserFix(userId)

      // 2. Create audit log
      try {
        const auditEntry = createAuditEntry('MFA_EMERGENCY_RECOVERY', `user:${userId}`, {
          success: fixResult.success,
          actionsTaken: fixResult.actionsTaken,
          timestamp: new Date().toISOString()
        })
        console.log('📝 MFA Backend: Audit log created for emergency recovery')
      } catch (auditError) {
        console.warn('⚠️ MFA Backend: Audit logging failed:', auditError)
      }

      return fixResult

    } catch (error) {
      console.error('❌ MFA Backend: Emergency recovery failed:', error)

      return {
        success: false,
        message: `Emergency recovery failed: ${error}`,
        actionsTaken: ['Emergency recovery attempted but failed']
      }
    }
  }

  /**
   * Health check for MFA backend services
   */
  async healthCheck(): Promise<{
    healthy: boolean
    services: {
      secureTotp: boolean
      migration: boolean
      database: boolean
    }
    issues: string[]
  }> {
    const issues: string[] = []
    const services = {
      secureTotp: true,
      migration: true,
      database: true
    }

    try {
      // Check secure TOTP service
      try {
        const testUserId = 'health-check-test'
        await secureTotpService.hasTOTPSetup(testUserId)
      } catch (error) {
        services.secureTotp = false
        issues.push('Secure TOTP service error: ' + error)
      }

      // Check migration service
      try {
        await totpMigrationService.getMigrationStatus()
      } catch (error) {
        services.migration = false
        issues.push('Migration service error: ' + error)
      }

      // Check database connectivity
      try {
        const { error } = await import('../config/supabase').then(m => m.supabase.from('user_totp').select('count').limit(1))
        if (error && !error.message.includes('permission')) {
          services.database = false
          issues.push('Database connectivity error: ' + error.message)
        }
      } catch (error) {
        services.database = false
        issues.push('Database check error: ' + error)
      }

      const healthy = services.secureTotp && services.migration && services.database

      return {
        healthy,
        services,
        issues
      }

    } catch (error) {
      return {
        healthy: false,
        services: { secureTotp: false, migration: false, database: false },
        issues: ['Health check failed: ' + error]
      }
    }
  }

  /**
   * Get debug information for troubleshooting
   */
  async getDebugInfo(userId: string): Promise<{
    currentTimestamp: number
    hasDatabaseSetup: boolean
    hasLocalStorageSetup: boolean
    migrationNeeded: boolean
    lastVerificationTime?: string
  }> {
    try {
      const currentTimestamp = secureTotpService.getCurrentTimestamp()

      // Check database
      const { data: dbData } = await import('../config/supabase').then(m =>
        m.supabase.from('user_totp').select('last_used_at').eq('user_id', userId).maybeSingle()
      )

      // Check localStorage
      const localData = localStorage.getItem(`totp_${userId}`)

      // Check if migration needed
      const migrationStatus = await totpMigrationService.getMigrationStatus()

      return {
        currentTimestamp,
        hasDatabaseSetup: !!dbData,
        hasLocalStorageSetup: !!localData,
        migrationNeeded: migrationStatus.migrationNeeded,
        lastVerificationTime: dbData?.last_used_at || undefined
      }

    } catch (error) {
      console.error('❌ MFA Backend: Debug info failed:', error)
      return {
        currentTimestamp: Math.floor(Date.now() / 1000),
        hasDatabaseSetup: false,
        hasLocalStorageSetup: false,
        migrationNeeded: false
      }
    }
  }
}

// Export singleton instance
export const mfaBackendService = new MFABackendService()