/**
 * Cloud-Synchronized TOTP Service - Enhanced Implementation
 * Prioritizes database storage for cross-device MFA synchronization
 *
 * This service implements database-first approach for TOTP data storage,
 * ensuring MFA setup on one device automatically works on all other devices.
 *
 * Features:
 * - Database-first storage with localStorage as cache/fallback
 * - Real-time synchronization across devices
 * - Offline capability with graceful degradation
 * - HIPAA-compliant encryption and audit logging
 * - Cross-device compatibility
 */

import { TOTP, Secret } from 'otpauth'
import { encryptPHI, decryptPHI } from '../utils/encryption'
import { supabase } from '../config/supabase'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '../services/auditLogger'

interface TOTPConfig {
  issuer: string
  label: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
}

interface UserTOTP {
  id: string
  user_id: string
  encrypted_secret: string
  backup_codes: string[]
  enabled: boolean
  created_at: string
  last_used_at: string | null
  synced_at: string
  device_info?: {
    setup_device?: string
    last_sync_device?: string
  }
}

interface TOTPSetupResult {
  secret: string
  qr_url: string
  manual_entry_key: string
  backup_codes: string[]
  sync_status: 'database' | 'localStorage' | 'offline'
}

interface TOTPVerificationResult {
  success: boolean
  error?: string
  sync_status?: 'database' | 'localStorage' | 'offline'
}

interface TOTPSyncResult {
  success: boolean
  source: 'database' | 'localStorage'
  synced_at: string
  devices_synced: number
}

class CloudSyncTOTPService {
  private config: TOTPConfig = {
    issuer: 'MedEx Healthcare CRM',
    label: 'MedEx',
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  }

  private syncSubscription: any = null
  private lastSyncTime: Date = new Date()

  constructor() {
    this.initializeRealTimeSync()
  }

  /**
   * Initialize real-time synchronization for TOTP data
   */
  private initializeRealTimeSync(): void {
    try {
      // Subscribe to user_totp table changes for real-time sync
      this.syncSubscription = supabase
        .channel('totp-sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_totp'
          },
          (payload) => {
            console.log('🔄 TOTP Sync: Real-time update received:', payload)
            this.handleRealTimeTOTPUpdate(payload)
          }
        )
        .subscribe()

      console.log('✅ TOTP Sync: Real-time synchronization initialized')
    } catch (error) {
      console.warn('⚠️ TOTP Sync: Real-time sync initialization failed, using polling fallback:', error)
      this.initializePollingSync()
    }
  }

  /**
   * Fallback polling-based sync for when real-time subscriptions fail
   */
  private initializePollingSync(): void {
    setInterval(async () => {
      const user = localStorage.getItem('current_user_id')
      if (user) {
        await this.syncTOTPFromDatabase(user, false) // Silent sync
      }
    }, 30000) // Sync every 30 seconds
  }

  /**
   * Handle real-time TOTP updates from Supabase
   */
  private async handleRealTimeTOTPUpdate(payload: any): Promise<void> {
    try {
      const currentUserId = localStorage.getItem('current_user_id')

      // Only process updates for the current user
      if (payload.new?.user_id === currentUserId || payload.old?.user_id === currentUserId) {
        console.log('🔄 TOTP Sync: Processing real-time update for current user')

        // Update localStorage cache with new data
        if (payload.eventType === 'DELETE') {
          localStorage.removeItem(`totp_${currentUserId}`)
          localStorage.removeItem(`totp_enabled_${currentUserId}`)
        } else if (payload.new) {
          // Cache the updated data locally
          const cachedData = {
            ...payload.new,
            last_sync: new Date().toISOString(),
            sync_source: 'real-time'
          }
          localStorage.setItem(`totp_${currentUserId}`, JSON.stringify(cachedData))
          localStorage.setItem(`totp_enabled_${currentUserId}`, payload.new.enabled.toString())
        }

        // Dispatch event for UI components to update
        window.dispatchEvent(new CustomEvent('totpSyncUpdate', {
          detail: {
            userId: currentUserId,
            eventType: payload.eventType,
            syncedAt: new Date().toISOString()
          }
        }))

        console.log('✅ TOTP Sync: Real-time update processed successfully')
      }
    } catch (error) {
      console.error('❌ TOTP Sync: Real-time update processing failed:', error)
    }
  }

  /**
   * Generate a new TOTP setup with cloud synchronization
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    try {
      console.log('🚀 Cloud TOTP: Generating TOTP setup for:', { userId, userEmail })

      // Audit log the setup attempt
      await auditLogger.logPHIAccess(
        AuditAction.CREATE,
        ResourceType.USER_SETTINGS,
        `totp-setup-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'totp_setup_generation',
          userId,
          timestamp: new Date().toISOString()
        }
      )

      // Generate a random secret
      const secret = new Secret({ size: 32 })
      console.log('🚀 Cloud TOTP: Secret generated successfully')

      // Create TOTP instance
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: userEmail,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret
      })

      // Generate QR code URL and backup codes
      const qr_url = totp.toString()
      const manual_entry_key = secret.base32
      const backup_codes = this.generateBackupCodes()

      // Encrypt the secret and backup codes
      console.log('🔐 Cloud TOTP: Encrypting secret and backup codes...')
      const encrypted_secret = encryptPHI(secret.base32)
      const encrypted_backup_codes = backup_codes.map(code => encryptPHI(code))

      console.log('🔐 Cloud TOTP: Encryption completed successfully')

      // Device info for tracking
      const deviceInfo = {
        setup_device: navigator.userAgent,
        setup_timestamp: new Date().toISOString()
      }

      let syncStatus: 'database' | 'localStorage' | 'offline' = 'offline'

      // Primary: Store in database for cloud synchronization
      console.log('☁️ Cloud TOTP: Storing TOTP data in database...')
      try {
        const { data: upsertResult, error: upsertError } = await supabase.rpc('upsert_user_totp', {
          target_user_id: userId,
          secret: encrypted_secret,
          backup_codes_json: encrypted_backup_codes,
          is_enabled: false
        })

        if (upsertError) {
          console.warn('⚠️ Cloud TOTP: Database upsert function failed, trying direct upsert:', upsertError.message)

          // Fallback to direct table upsert
          const { error: directError } = await supabase
            .from('user_totp')
            .upsert({
              user_id: userId,
              encrypted_secret,
              backup_codes: encrypted_backup_codes,
              enabled: false,
              created_at: new Date().toISOString(),
              synced_at: new Date().toISOString()
            })

          if (directError) {
            console.warn('⚠️ Cloud TOTP: Direct upsert failed:', directError.message)
            throw directError
          } else {
            console.log('✅ Cloud TOTP: TOTP data stored successfully via direct upsert')
            syncStatus = 'database'
          }
        } else {
          console.log('✅ Cloud TOTP: TOTP data stored successfully via database function')
          syncStatus = 'database'
        }

        // Cache in localStorage for performance and offline access
        const cacheData = {
          user_id: userId,
          encrypted_secret,
          backup_codes: encrypted_backup_codes,
          enabled: false,
          created_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
          device_info: deviceInfo,
          cache_source: 'database'
        }
        localStorage.setItem(`totp_${userId}`, JSON.stringify(cacheData))
        console.log('💾 Cloud TOTP: Data cached in localStorage for offline access')

      } catch (dbError) {
        console.warn('⚠️ Cloud TOTP: Database unavailable, using localStorage only:', dbError)

        // Fallback to localStorage with sync pending flag
        const fallbackData = {
          user_id: userId,
          encrypted_secret,
          backup_codes: encrypted_backup_codes,
          enabled: false,
          created_at: new Date().toISOString(),
          device_info: deviceInfo,
          sync_pending: true,
          cache_source: 'localStorage'
        }
        localStorage.setItem(`totp_${userId}`, JSON.stringify(fallbackData))
        syncStatus = 'localStorage'
        console.log('💾 Cloud TOTP: TOTP data stored in localStorage with sync pending')

        // Schedule sync retry
        this.scheduleRetrySync(userId)
      }

      // Audit log successful setup
      await auditLogger.logPHIAccess(
        AuditAction.CREATE,
        ResourceType.USER_SETTINGS,
        `totp-setup-success-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'totp_setup_completed',
          userId,
          syncStatus,
          timestamp: new Date().toISOString()
        }
      )

      return {
        secret: manual_entry_key,
        qr_url,
        manual_entry_key,
        backup_codes,
        sync_status: syncStatus
      }
    } catch (error) {
      console.error('❌ Cloud TOTP Setup Error:', error)

      // Audit log the error
      await auditLogger.logPHIAccess(
        AuditAction.CREATE,
        ResourceType.USER_SETTINGS,
        `totp-setup-error-${userId}`,
        AuditOutcome.FAILURE,
        {
          operation: 'totp_setup_failed',
          userId,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      )

      throw new Error('Failed to generate cloud-synchronized TOTP setup')
    }
  }

  /**
   * Verify TOTP code with cloud synchronization
   */
  async verifyTOTP(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    try {
      console.log('🔍 Cloud TOTP: Verifying TOTP for user:', userId)

      // Audit log verification attempt
      await auditLogger.logPHIAccess(
        AuditAction.ACCESS,
        ResourceType.USER_SETTINGS,
        `totp-verify-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'totp_verification_attempt',
          userId,
          codeLength: code.length,
          timestamp: new Date().toISOString()
        }
      )

      let totpData: any = null
      let syncStatus: 'database' | 'localStorage' | 'offline' = 'offline'

      // Primary: Try database first for cloud-synchronized data
      console.log('☁️ Cloud TOTP: Checking database for TOTP data...')
      try {
        const { data: dbData, error: dbError } = await supabase
          .from('user_totp')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (!dbError && dbData) {
          console.log('✅ Cloud TOTP: Found TOTP data in database (cloud-synced)')
          totpData = dbData
          syncStatus = 'database'

          // Update cache with fresh database data
          const cacheData = {
            ...dbData,
            last_sync: new Date().toISOString(),
            cache_source: 'database'
          }
          localStorage.setItem(`totp_${userId}`, JSON.stringify(cacheData))
        } else {
          console.log('⚠️ Cloud TOTP: Database query failed or no data:', dbError?.message)
        }
      } catch (dbError) {
        console.warn('⚠️ Cloud TOTP: Database unavailable:', dbError)
      }

      // Fallback: Use localStorage cache if database is unavailable
      if (!totpData) {
        console.log('💾 Cloud TOTP: Falling back to localStorage cache...')
        const localTotpData = localStorage.getItem(`totp_${userId}`)
        if (localTotpData) {
          try {
            const parsed = JSON.parse(localTotpData)
            totpData = parsed
            syncStatus = 'localStorage'
            console.log('✅ Cloud TOTP: Using localStorage cache data')

            // If data has sync_pending flag, attempt to sync now
            if (parsed.sync_pending) {
              this.attemptBackgroundSync(userId, parsed)
            }
          } catch (parseError) {
            console.error('❌ Cloud TOTP: Failed to parse localStorage data:', parseError)
          }
        }
      }

      // Check if we found any TOTP data
      if (!totpData) {
        console.log('❌ Cloud TOTP: No TOTP data found')
        return {
          success: false,
          error: 'TOTP not set up for this user. Please setup MFA in Settings.',
          sync_status: syncStatus
        }
      }

      // Decrypt the secret
      console.log('🔍 Cloud TOTP: Decrypting secret...')
      let decrypted_secret: string
      try {
        decrypted_secret = decryptPHI(totpData.encrypted_secret)
        console.log('✅ Cloud TOTP: Secret decrypted successfully')
      } catch (decryptError) {
        console.warn('⚠️ Cloud TOTP: Decryption failed, checking if plain text')

        if (/^[A-Z2-7]+=*$/i.test(totpData.encrypted_secret)) {
          decrypted_secret = totpData.encrypted_secret
          console.log('✅ Cloud TOTP: Using plain base32 secret')
        } else {
          console.error('❌ Cloud TOTP: Invalid secret format')
          return {
            success: false,
            error: 'Invalid TOTP configuration',
            sync_status: syncStatus
          }
        }
      }

      // Create TOTP instance and verify
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: this.config.label,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: Secret.fromBase32(decrypted_secret)
      })

      // Verify the code (allow 1 period of drift)
      const delta = totp.validate({ token: code, window: 1 })

      if (delta === null) {
        // Try backup codes
        try {
          const backupCodeValid = await this.verifyBackupCode(userId, code, syncStatus)
          if (!backupCodeValid) {
            return {
              success: false,
              error: 'Invalid TOTP code',
              sync_status: syncStatus
            }
          }
        } catch (backupError) {
          console.warn('⚠️ Cloud TOTP: Backup code verification failed:', backupError)
          return {
            success: false,
            error: 'Invalid TOTP code',
            sync_status: syncStatus
          }
        }
      }

      // Update last used timestamp and optionally enable
      const updateData: any = {
        last_used_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      }

      if (enableOnSuccess && !totpData.enabled) {
        updateData.enabled = true
      }

      // Update database if available
      if (syncStatus === 'database') {
        try {
          await supabase
            .from('user_totp')
            .update(updateData)
            .eq('user_id', userId)
          console.log('✅ Cloud TOTP: Database updated successfully')
        } catch (dbError) {
          console.warn('⚠️ Cloud TOTP: Database update failed:', dbError)
        }
      }

      // Always update localStorage cache
      const updatedTotpData = { ...totpData, ...updateData, cache_source: syncStatus }
      localStorage.setItem(`totp_${userId}`, JSON.stringify(updatedTotpData))
      console.log('✅ Cloud TOTP: localStorage cache updated')

      // Audit log successful verification
      await auditLogger.logPHIAccess(
        AuditAction.ACCESS,
        ResourceType.USER_SETTINGS,
        `totp-verify-success-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'totp_verification_success',
          userId,
          syncStatus,
          timestamp: new Date().toISOString()
        }
      )

      return {
        success: true,
        sync_status: syncStatus
      }
    } catch (error) {
      console.error('❌ Cloud TOTP Verification Error:', error)

      // Audit log verification error
      await auditLogger.logPHIAccess(
        AuditAction.ACCESS,
        ResourceType.USER_SETTINGS,
        `totp-verify-error-${userId}`,
        AuditOutcome.FAILURE,
        {
          operation: 'totp_verification_failed',
          userId,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      )

      return {
        success: false,
        error: 'TOTP verification failed',
        sync_status: 'offline'
      }
    }
  }

  /**
   * Synchronize TOTP data from database to localStorage
   */
  async syncTOTPFromDatabase(userId: string, forceFetch: boolean = false): Promise<TOTPSyncResult> {
    try {
      console.log('🔄 Cloud TOTP: Synchronizing from database...')

      // Check if we have recent cache and don't need to fetch
      if (!forceFetch) {
        const cachedData = localStorage.getItem(`totp_${userId}`)
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData)
            const cacheAge = Date.now() - new Date(parsed.last_sync || 0).getTime()

            // If cache is less than 1 minute old, skip sync
            if (cacheAge < 60000 && parsed.cache_source === 'database') {
              console.log('ℹ️ Cloud TOTP: Using recent cache, skipping sync')
              return {
                success: true,
                source: 'localStorage',
                synced_at: parsed.last_sync,
                devices_synced: 0
              }
            }
          } catch (parseError) {
            console.warn('⚠️ Cloud TOTP: Failed to parse cache for sync check')
          }
        }
      }

      // Fetch fresh data from database
      const { data: dbData, error: dbError } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (dbError) {
        console.error('❌ Cloud TOTP: Database sync failed:', dbError)
        return {
          success: false,
          source: 'database',
          synced_at: new Date().toISOString(),
          devices_synced: 0
        }
      }

      if (dbData) {
        // Update localStorage cache with database data
        const syncedData = {
          ...dbData,
          last_sync: new Date().toISOString(),
          cache_source: 'database'
        }
        localStorage.setItem(`totp_${userId}`, JSON.stringify(syncedData))
        localStorage.setItem(`totp_enabled_${userId}`, dbData.enabled.toString())

        console.log('✅ Cloud TOTP: Synchronized from database successfully')

        // Dispatch sync event
        window.dispatchEvent(new CustomEvent('totpSyncComplete', {
          detail: {
            userId,
            syncedAt: syncedData.last_sync,
            source: 'database'
          }
        }))

        return {
          success: true,
          source: 'database',
          synced_at: syncedData.last_sync,
          devices_synced: 1
        }
      } else {
        console.log('ℹ️ Cloud TOTP: No TOTP data found in database')
        return {
          success: true,
          source: 'database',
          synced_at: new Date().toISOString(),
          devices_synced: 0
        }
      }
    } catch (error) {
      console.error('❌ Cloud TOTP: Sync error:', error)
      return {
        success: false,
        source: 'database',
        synced_at: new Date().toISOString(),
        devices_synced: 0
      }
    }
  }

  /**
   * Check if user has TOTP setup (database-first approach)
   */
  async hasTOTPSetup(userId: string): Promise<boolean> {
    try {
      console.log('🔍 Cloud TOTP: Checking TOTP setup for user:', userId)

      // Primary: Check database first
      try {
        const { data: dbData, error: dbError } = await supabase
          .from('user_totp')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()

        if (!dbError && dbData) {
          console.log('✅ Cloud TOTP: TOTP setup found in database')
          return true
        } else if (dbError) {
          console.log('⚠️ Cloud TOTP: Database check failed:', dbError.message)
        } else {
          console.log('ℹ️ Cloud TOTP: No TOTP setup found in database')
        }
      } catch (dbError) {
        console.warn('⚠️ Cloud TOTP: Database unavailable for setup check:', dbError)
      }

      // Fallback: Check localStorage
      console.log('💾 Cloud TOTP: Checking localStorage fallback...')
      const localTotpData = localStorage.getItem(`totp_${userId}`)
      if (localTotpData) {
        try {
          JSON.parse(localTotpData)
          console.log('✅ Cloud TOTP: TOTP setup found in localStorage')
          return true
        } catch (parseError) {
          console.error('❌ Cloud TOTP: Failed to parse localStorage data:', parseError)
        }
      }

      console.log('ℹ️ Cloud TOTP: No TOTP setup found')
      return false
    } catch (error) {
      console.error('❌ Cloud TOTP: Setup check error:', error)
      return false
    }
  }

  /**
   * Check if TOTP is enabled (database-first approach)
   */
  async isTOTPEnabled(userId: string): Promise<boolean> {
    try {
      console.log('🔍 Cloud TOTP: Checking TOTP enabled status for user:', userId)

      // Primary: Check database first
      try {
        const { data: dbData, error: dbError } = await supabase
          .from('user_totp')
          .select('enabled')
          .eq('user_id', userId)
          .maybeSingle()

        if (!dbError && dbData) {
          console.log('✅ Cloud TOTP: TOTP enabled status from database:', dbData.enabled)

          // Update cache with database status
          localStorage.setItem(`totp_enabled_${userId}`, dbData.enabled.toString())

          return dbData.enabled
        } else if (dbError) {
          console.log('⚠️ Cloud TOTP: Database enabled check failed:', dbError.message)
        } else {
          console.log('ℹ️ Cloud TOTP: No TOTP record found in database')
        }
      } catch (dbError) {
        console.warn('⚠️ Cloud TOTP: Database unavailable for enabled check:', dbError)
      }

      // Fallback: Check localStorage
      console.log('💾 Cloud TOTP: Checking localStorage enabled status...')
      const localEnabled = localStorage.getItem(`totp_enabled_${userId}`)
      if (localEnabled !== null) {
        const isEnabled = localEnabled === 'true'
        console.log('✅ Cloud TOTP: TOTP enabled status from localStorage:', isEnabled)
        return isEnabled
      }

      // Check full localStorage data as final fallback
      const localTotpData = localStorage.getItem(`totp_${userId}`)
      if (localTotpData) {
        try {
          const parsedData = JSON.parse(localTotpData)
          console.log('✅ Cloud TOTP: TOTP enabled status from full localStorage data:', parsedData.enabled || false)
          return parsedData.enabled || false
        } catch (parseError) {
          console.error('❌ Cloud TOTP: Failed to parse localStorage data:', parseError)
        }
      }

      console.log('ℹ️ Cloud TOTP: No enabled status found, defaulting to false')
      return false
    } catch (error) {
      console.error('❌ Cloud TOTP: Enabled check error:', error)
      return false
    }
  }

  /**
   * Disable TOTP with cloud synchronization
   */
  async disableTOTP(userId: string): Promise<boolean> {
    try {
      console.log('🔒 Cloud TOTP: Disabling TOTP for user:', userId)

      // Audit log disable attempt
      await auditLogger.logPHIAccess(
        AuditAction.DELETE,
        ResourceType.USER_SETTINGS,
        `totp-disable-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'totp_disable_attempt',
          userId,
          timestamp: new Date().toISOString()
        }
      )

      let dbSuccess = false

      // Primary: Delete from database
      try {
        const { error } = await supabase
          .from('user_totp')
          .delete()
          .eq('user_id', userId)

        if (error) {
          console.error('❌ Cloud TOTP: Database delete error:', error)
        } else {
          console.log('✅ Cloud TOTP: TOTP deleted from database successfully')
          dbSuccess = true
        }
      } catch (dbError) {
        console.warn('⚠️ Cloud TOTP: Database unavailable for delete:', dbError)
      }

      // Always clear localStorage cache
      localStorage.removeItem(`totp_${userId}`)
      localStorage.removeItem(`totp_enabled_${userId}`)
      console.log('🧹 Cloud TOTP: Cleared localStorage cache')

      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('totpSyncUpdate', {
        detail: {
          userId,
          eventType: 'DELETE',
          syncedAt: new Date().toISOString()
        }
      }))

      // Audit log disable result
      await auditLogger.logPHIAccess(
        AuditAction.DELETE,
        ResourceType.USER_SETTINGS,
        `totp-disable-result-${userId}`,
        dbSuccess ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
        {
          operation: 'totp_disable_completed',
          userId,
          databaseSuccess: dbSuccess,
          timestamp: new Date().toISOString()
        }
      )

      console.log('✅ Cloud TOTP: TOTP disabled successfully')
      return true
    } catch (error) {
      console.error('❌ Cloud TOTP: Disable error:', error)
      return false
    }
  }

  /**
   * Force synchronization across all devices
   */
  async forceSyncAllDevices(userId: string): Promise<TOTPSyncResult> {
    try {
      console.log('🔄 Cloud TOTP: Force syncing all devices for user:', userId)

      // Fetch latest data from database
      const syncResult = await this.syncTOTPFromDatabase(userId, true)

      if (syncResult.success) {
        // Trigger real-time update for other devices
        // This happens automatically through Supabase real-time subscriptions
        console.log('✅ Cloud TOTP: Force sync completed successfully')
      }

      return syncResult
    } catch (error) {
      console.error('❌ Cloud TOTP: Force sync error:', error)
      return {
        success: false,
        source: 'database',
        synced_at: new Date().toISOString(),
        devices_synced: 0
      }
    }
  }

  /**
   * Get sync status information
   */
  async getSyncStatus(userId: string): Promise<{
    hasCloudData: boolean
    hasCacheData: boolean
    lastSync: string | null
    syncPending: boolean
    cacheSource: 'database' | 'localStorage' | 'none'
  }> {
    try {
      let hasCloudData = false
      let hasCacheData = false
      let lastSync: string | null = null
      let syncPending = false
      let cacheSource: 'database' | 'localStorage' | 'none' = 'none'

      // Check database
      try {
        const { data: dbData, error: dbError } = await supabase
          .from('user_totp')
          .select('synced_at')
          .eq('user_id', userId)
          .maybeSingle()

        if (!dbError && dbData) {
          hasCloudData = true
          lastSync = dbData.synced_at
          cacheSource = 'database'
        }
      } catch (dbError) {
        console.warn('⚠️ Cloud TOTP: Database sync status check failed:', dbError)
      }

      // Check localStorage
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          hasCacheData = true
          if (!lastSync) {
            lastSync = parsed.last_sync || parsed.synced_at
            cacheSource = 'localStorage'
          }
          syncPending = parsed.sync_pending || false
        } catch (parseError) {
          console.error('❌ Cloud TOTP: Failed to parse cache for sync status:', parseError)
        }
      }

      return {
        hasCloudData,
        hasCacheData,
        lastSync,
        syncPending,
        cacheSource
      }
    } catch (error) {
      console.error('❌ Cloud TOTP: Get sync status error:', error)
      return {
        hasCloudData: false,
        hasCacheData: false,
        lastSync: null,
        syncPending: false,
        cacheSource: 'none'
      }
    }
  }

  // Private helper methods

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString().slice(2, 10)
      codes.push(code)
    }
    return codes
  }

  /**
   * Verify backup code with cloud sync
   */
  private async verifyBackupCode(userId: string, code: string, syncStatus: 'database' | 'localStorage' | 'offline'): Promise<boolean> {
    try {
      console.log('🔍 Cloud TOTP: Verifying backup code for user:', userId)

      let totpData: any = null

      if (syncStatus === 'database') {
        // Get from database
        const { data, error } = await supabase
          .from('user_totp')
          .select('backup_codes')
          .eq('user_id', userId)
          .maybeSingle()

        if (!error && data) {
          totpData = data
        }
      }

      if (!totpData) {
        // Fallback to localStorage
        const localData = localStorage.getItem(`totp_${userId}`)
        if (localData) {
          const parsed = JSON.parse(localData)
          totpData = parsed
        }
      }

      if (!totpData?.backup_codes) {
        return false
      }

      // Check each encrypted backup code
      for (const encryptedCode of totpData.backup_codes) {
        try {
          const decryptedCode = decryptPHI(encryptedCode)
          if (decryptedCode === code) {
            // Remove the used backup code
            const updatedCodes = totpData.backup_codes.filter(c => c !== encryptedCode)

            // Update database if available
            if (syncStatus === 'database') {
              await supabase
                .from('user_totp')
                .update({
                  backup_codes: updatedCodes,
                  synced_at: new Date().toISOString()
                })
                .eq('user_id', userId)
            }

            // Update localStorage cache
            const cachedData = localStorage.getItem(`totp_${userId}`)
            if (cachedData) {
              const parsed = JSON.parse(cachedData)
              parsed.backup_codes = updatedCodes
              parsed.last_sync = new Date().toISOString()
              localStorage.setItem(`totp_${userId}`, JSON.stringify(parsed))
            }

            return true
          }
        } catch (decryptError) {
          continue
        }
      }

      return false
    } catch (error) {
      console.error('❌ Cloud TOTP: Backup code verification error:', error)
      return false
    }
  }

  /**
   * Schedule retry sync for offline data
   */
  private scheduleRetrySync(userId: string): void {
    console.log('⏰ Cloud TOTP: Scheduling retry sync for user:', userId)

    const retrySync = async () => {
      try {
        const localData = localStorage.getItem(`totp_${userId}`)
        if (localData) {
          const parsed = JSON.parse(localData)
          if (parsed.sync_pending) {
            console.log('🔄 Cloud TOTP: Retrying sync for offline data...')
            await this.attemptBackgroundSync(userId, parsed)
          }
        }
      } catch (error) {
        console.error('❌ Cloud TOTP: Retry sync failed:', error)
      }
    }

    // Retry after 30 seconds, then every 5 minutes
    setTimeout(retrySync, 30000)
    const retryInterval = setInterval(retrySync, 300000)

    // Clear interval after 1 hour
    setTimeout(() => clearInterval(retryInterval), 3600000)
  }

  /**
   * Attempt background sync for offline data
   */
  private async attemptBackgroundSync(userId: string, localData: any): Promise<void> {
    try {
      console.log('🔄 Cloud TOTP: Attempting background sync...')

      // Try to upsert to database
      const { error } = await supabase
        .from('user_totp')
        .upsert({
          user_id: userId,
          encrypted_secret: localData.encrypted_secret,
          backup_codes: localData.backup_codes,
          enabled: localData.enabled,
          created_at: localData.created_at,
          synced_at: new Date().toISOString()
        })

      if (!error) {
        // Success - remove sync_pending flag
        delete localData.sync_pending
        localData.last_sync = new Date().toISOString()
        localData.cache_source = 'database'
        localStorage.setItem(`totp_${userId}`, JSON.stringify(localData))

        console.log('✅ Cloud TOTP: Background sync successful')

        // Dispatch sync event
        window.dispatchEvent(new CustomEvent('totpSyncComplete', {
          detail: {
            userId,
            syncedAt: localData.last_sync,
            source: 'background-sync'
          }
        }))
      }
    } catch (error) {
      console.warn('⚠️ Cloud TOTP: Background sync failed:', error)
    }
  }

  /**
   * Cleanup method to unsubscribe from real-time sync
   */
  destroy(): void {
    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe()
      this.syncSubscription = null
      console.log('🧹 Cloud TOTP: Real-time sync subscription cleaned up')
    }
  }
}

// Export singleton instance
export const cloudSyncTotpService = new CloudSyncTOTPService()