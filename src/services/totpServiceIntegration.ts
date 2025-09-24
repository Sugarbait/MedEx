/**
 * TOTP Service Integration Layer
 * Provides backward compatibility while enabling cloud synchronization
 *
 * This service acts as a bridge between the existing totpService interface
 * and the new cloudSyncTotpService, allowing gradual migration to cloud-synced MFA
 * without breaking existing components.
 *
 * Features:
 * - Drop-in replacement for existing totpService
 * - Automatic fallback to cloud-synced implementation
 * - Maintains all existing function signatures
 * - Enhanced with cloud sync capabilities
 * - Seamless migration path
 */

import { cloudSyncTotpService } from './cloudSyncTotpService'
import { totpService as legacyTotpService } from './totpService'

// Re-export types from cloudSyncTotpService for consistency
interface TOTPSetupResult {
  secret: string
  qr_url: string
  manual_entry_key: string
  backup_codes: string[]
  sync_status?: 'database' | 'localStorage' | 'offline' // Enhanced with sync status
}

interface TOTPVerificationResult {
  success: boolean
  error?: string
  sync_status?: 'database' | 'localStorage' | 'offline' // Enhanced with sync status
}

class TOTPServiceIntegration {
  private useCloudSync: boolean = true
  private fallbackToLegacy: boolean = true

  constructor() {
    console.log('🔄 TOTP Integration: Service initialized with cloud sync enabled')

    // Check if cloud sync should be enabled based on environment
    try {
      const cloudSyncDisabled = localStorage.getItem('disable_totp_cloud_sync') === 'true'
      if (cloudSyncDisabled) {
        console.log('⚠️ TOTP Integration: Cloud sync disabled by user preference')
        this.useCloudSync = false
      }
    } catch (error) {
      console.warn('⚠️ TOTP Integration: Could not check cloud sync preference:', error)
    }
  }

  /**
   * Generate a new TOTP setup - Enhanced with cloud synchronization
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    console.log('🚀 TOTP Integration: Generating TOTP setup for:', { userId, userEmail, useCloudSync: this.useCloudSync })

    if (this.useCloudSync) {
      try {
        console.log('☁️ TOTP Integration: Using cloud-synced TOTP generation')
        const result = await cloudSyncTotpService.generateTOTPSetup(userId, userEmail)

        // Mark setup as cloud-synced for tracking
        this.markSetupAsCloudSynced(userId, result.sync_status)

        return result
      } catch (error) {
        console.error('❌ TOTP Integration: Cloud sync setup failed:', error)

        if (this.fallbackToLegacy) {
          console.log('🔄 TOTP Integration: Falling back to legacy TOTP setup')
          return this.generateLegacyTOTPSetup(userId, userEmail)
        } else {
          throw error
        }
      }
    } else {
      console.log('💾 TOTP Integration: Using legacy TOTP generation')
      return this.generateLegacyTOTPSetup(userId, userEmail)
    }
  }

  /**
   * Verify a TOTP code - Enhanced with cloud synchronization
   */
  async verifyTOTP(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    console.log('🔍 TOTP Integration: Verifying TOTP for user:', { userId, useCloudSync: this.useCloudSync })

    if (this.useCloudSync) {
      try {
        console.log('☁️ TOTP Integration: Using cloud-synced TOTP verification')
        const result = await cloudSyncTotpService.verifyTOTP(userId, code, enableOnSuccess)

        // Track verification method for analytics
        this.trackVerificationMethod(userId, result.sync_status || 'unknown')

        return result
      } catch (error) {
        console.error('❌ TOTP Integration: Cloud sync verification failed:', error)

        if (this.fallbackToLegacy) {
          console.log('🔄 TOTP Integration: Falling back to legacy TOTP verification')
          return this.verifyLegacyTOTP(userId, code, enableOnSuccess)
        } else {
          throw error
        }
      }
    } else {
      console.log('💾 TOTP Integration: Using legacy TOTP verification')
      return this.verifyLegacyTOTP(userId, code, enableOnSuccess)
    }
  }

  /**
   * Check if user has TOTP setup - Enhanced with cloud synchronization
   */
  async hasTOTPSetup(userId: string): Promise<boolean> {
    console.log('🔍 TOTP Integration: Checking TOTP setup for user:', { userId, useCloudSync: this.useCloudSync })

    if (this.useCloudSync) {
      try {
        console.log('☁️ TOTP Integration: Using cloud-synced setup check')
        return await cloudSyncTotpService.hasTOTPSetup(userId)
      } catch (error) {
        console.error('❌ TOTP Integration: Cloud sync setup check failed:', error)

        if (this.fallbackToLegacy) {
          console.log('🔄 TOTP Integration: Falling back to legacy setup check')
          return await legacyTotpService.hasTOTPSetup(userId)
        } else {
          return false
        }
      }
    } else {
      console.log('💾 TOTP Integration: Using legacy setup check')
      return await legacyTotpService.hasTOTPSetup(userId)
    }
  }

  /**
   * Check if TOTP is enabled - Enhanced with cloud synchronization
   */
  async isTOTPEnabled(userId: string): Promise<boolean> {
    console.log('🔍 TOTP Integration: Checking TOTP enabled status for user:', { userId, useCloudSync: this.useCloudSync })

    if (this.useCloudSync) {
      try {
        console.log('☁️ TOTP Integration: Using cloud-synced enabled check')
        return await cloudSyncTotpService.isTOTPEnabled(userId)
      } catch (error) {
        console.error('❌ TOTP Integration: Cloud sync enabled check failed:', error)

        if (this.fallbackToLegacy) {
          console.log('🔄 TOTP Integration: Falling back to legacy enabled check')
          return await legacyTotpService.isTOTPEnabled(userId)
        } else {
          return false
        }
      }
    } else {
      console.log('💾 TOTP Integration: Using legacy enabled check')
      return await legacyTotpService.isTOTPEnabled(userId)
    }
  }

  /**
   * Disable TOTP - Enhanced with cloud synchronization
   */
  async disableTOTP(userId: string): Promise<boolean> {
    console.log('🔒 TOTP Integration: Disabling TOTP for user:', { userId, useCloudSync: this.useCloudSync })

    let cloudSyncResult = false
    let legacyResult = false

    // Always try to disable from both systems to ensure complete cleanup
    if (this.useCloudSync) {
      try {
        console.log('☁️ TOTP Integration: Disabling cloud-synced TOTP')
        cloudSyncResult = await cloudSyncTotpService.disableTOTP(userId)
      } catch (error) {
        console.error('❌ TOTP Integration: Cloud sync disable failed:', error)
      }
    }

    // Also disable legacy TOTP to ensure complete cleanup
    try {
      console.log('💾 TOTP Integration: Disabling legacy TOTP for complete cleanup')
      legacyResult = await legacyTotpService.disableTOTP(userId)
    } catch (error) {
      console.error('❌ TOTP Integration: Legacy disable failed:', error)
    }

    const success = cloudSyncResult || legacyResult
    console.log(`${success ? '✅' : '❌'} TOTP Integration: TOTP disable result:`, {
      cloudSync: cloudSyncResult,
      legacy: legacyResult,
      overall: success
    })

    return success
  }

  /**
   * Get remaining backup codes count - Enhanced with cloud synchronization
   */
  async getRemainingBackupCodes(userId: string): Promise<number> {
    console.log('🔍 TOTP Integration: Getting backup codes count for user:', userId)

    if (this.useCloudSync) {
      try {
        // Cloud sync service doesn't have this method yet, so we'll implement it
        const syncStatus = await cloudSyncTotpService.getSyncStatus(userId)
        if (syncStatus.hasCloudData || syncStatus.hasCacheData) {
          // For now, return a placeholder - this would need to be implemented in cloudSyncTotpService
          console.log('☁️ TOTP Integration: Using cloud-synced backup codes count (placeholder)')
          return 8 // Default backup codes count
        }
      } catch (error) {
        console.error('❌ TOTP Integration: Cloud sync backup codes check failed:', error)
      }
    }

    // Fallback to legacy service
    try {
      console.log('💾 TOTP Integration: Using legacy backup codes count')
      return await legacyTotpService.getRemainingBackupCodes(userId)
    } catch (error) {
      console.error('❌ TOTP Integration: Legacy backup codes check failed:', error)
      return 0
    }
  }

  // Enhanced cloud sync methods

  /**
   * Force sync TOTP data across all devices
   */
  async forceSyncAllDevices(userId: string): Promise<{ success: boolean; message: string }> {
    if (!this.useCloudSync) {
      return {
        success: false,
        message: 'Cloud sync is disabled'
      }
    }

    try {
      console.log('🔄 TOTP Integration: Force syncing all devices for user:', userId)
      const result = await cloudSyncTotpService.forceSyncAllDevices(userId)

      return {
        success: result.success,
        message: result.success
          ? `Synced to ${result.devices_synced} device(s)`
          : 'Sync failed'
      }
    } catch (error) {
      console.error('❌ TOTP Integration: Force sync failed:', error)
      return {
        success: false,
        message: 'Sync error occurred'
      }
    }
  }

  /**
   * Get sync status information
   */
  async getSyncStatus(userId: string): Promise<{
    isCloudSyncEnabled: boolean
    hasCloudData: boolean
    hasCacheData: boolean
    lastSync: string | null
    syncPending: boolean
    cacheSource: string
  }> {
    try {
      if (!this.useCloudSync) {
        return {
          isCloudSyncEnabled: false,
          hasCloudData: false,
          hasCacheData: await legacyTotpService.hasTOTPSetup(userId),
          lastSync: null,
          syncPending: false,
          cacheSource: 'legacy'
        }
      }

      const status = await cloudSyncTotpService.getSyncStatus(userId)
      return {
        isCloudSyncEnabled: true,
        hasCloudData: status.hasCloudData,
        hasCacheData: status.hasCacheData,
        lastSync: status.lastSync,
        syncPending: status.syncPending,
        cacheSource: status.cacheSource
      }
    } catch (error) {
      console.error('❌ TOTP Integration: Get sync status failed:', error)
      return {
        isCloudSyncEnabled: this.useCloudSync,
        hasCloudData: false,
        hasCacheData: false,
        lastSync: null,
        syncPending: false,
        cacheSource: 'error'
      }
    }
  }

  /**
   * Enable or disable cloud sync
   */
  setCloudSyncEnabled(enabled: boolean): void {
    console.log(`🔄 TOTP Integration: ${enabled ? 'Enabling' : 'Disabling'} cloud sync`)
    this.useCloudSync = enabled

    try {
      localStorage.setItem('disable_totp_cloud_sync', (!enabled).toString())
    } catch (error) {
      console.warn('⚠️ TOTP Integration: Could not save cloud sync preference:', error)
    }
  }

  /**
   * Check if cloud sync is enabled
   */
  isCloudSyncEnabled(): boolean {
    return this.useCloudSync
  }

  // Legacy compatibility methods

  /**
   * Legacy TOTP setup generation
   */
  private async generateLegacyTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    const result = await legacyTotpService.generateTOTPSetup(userId, userEmail)

    // Add sync status for consistency
    return {
      ...result,
      sync_status: 'localStorage'
    }
  }

  /**
   * Legacy TOTP verification
   */
  private async verifyLegacyTOTP(userId: string, code: string, enableOnSuccess: boolean): Promise<TOTPVerificationResult> {
    const result = await legacyTotpService.verifyTOTP(userId, code, enableOnSuccess)

    // Add sync status for consistency
    return {
      ...result,
      sync_status: 'localStorage'
    }
  }

  /**
   * Mark setup as cloud-synced for tracking
   */
  private markSetupAsCloudSynced(userId: string, syncStatus: string): void {
    try {
      const trackingData = {
        userId,
        setupMethod: 'cloud-sync',
        syncStatus,
        timestamp: new Date().toISOString()
      }
      localStorage.setItem(`totp_setup_tracking_${userId}`, JSON.stringify(trackingData))
      console.log('📊 TOTP Integration: Setup tracking updated:', trackingData)
    } catch (error) {
      console.warn('⚠️ TOTP Integration: Could not update setup tracking:', error)
    }
  }

  /**
   * Track verification method for analytics
   */
  private trackVerificationMethod(userId: string, method: string): void {
    try {
      const trackingData = {
        userId,
        verificationMethod: method,
        timestamp: new Date().toISOString()
      }

      // Store recent verification methods (keep last 10)
      const key = `totp_verification_tracking_${userId}`
      const existing = localStorage.getItem(key)
      let history = existing ? JSON.parse(existing) : []

      history.unshift(trackingData)
      history = history.slice(0, 10) // Keep last 10 entries

      localStorage.setItem(key, JSON.stringify(history))
      console.log('📊 TOTP Integration: Verification tracking updated:', trackingData)
    } catch (error) {
      console.warn('⚠️ TOTP Integration: Could not update verification tracking:', error)
    }
  }

  // Legacy methods for backward compatibility

  /**
   * Create emergency TOTP fallback (legacy method)
   */
  createEmergencyTOTPFallback(userId: string): boolean {
    console.log('🚨 TOTP Integration: Creating emergency fallback using legacy service')
    return legacyTotpService.createEmergencyTOTPFallback(userId)
  }

  /**
   * Check database health and fallback (legacy method)
   */
  async checkDatabaseHealthAndFallback(userId: string): Promise<{ healthy: boolean; usingFallback: boolean }> {
    console.log('🏥 TOTP Integration: Checking database health using legacy service')
    return await legacyTotpService.checkDatabaseHealthAndFallback(userId)
  }

  /**
   * Verify TOTP with fallback (legacy method)
   */
  async verifyTOTPWithFallback(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    // Use the integrated verification which already handles fallbacks
    return await this.verifyTOTP(userId, code, enableOnSuccess)
  }
}

// Export singleton instance
export const totpServiceIntegrated = new TOTPServiceIntegration()

// Export for backward compatibility (can be used as drop-in replacement)
export const totpService = totpServiceIntegrated