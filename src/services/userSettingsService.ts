/**
 * Simple User Settings Service for Cloud Sync
 *
 * Basic cloud sync approach: load from cloud on login, save to cloud on changes,
 * localStorage as cache. No complex device management or conflict resolution.
 */

import { supabase, supabaseConfig } from '@/config/supabase'
import { Database, UserSettings, ServiceResponse, RealtimeChannel, UserDevice, DeviceSession, SyncQueueItem } from '@/types/supabase'
import { encryptionService } from './encryption'
import { auditLogger } from './auditLogger'
import { RealtimeChannel as SupabaseRealtimeChannel } from '@supabase/supabase-js'

type DatabaseUserSettings = Database['public']['Tables']['user_settings']['Row']

export interface UserSettingsData {
  theme: 'light' | 'dark' | 'auto'
  notifications: {
    email: boolean
    sms: boolean
    push: boolean
    in_app: boolean
    call_alerts: boolean
    sms_alerts: boolean
    security_alerts: boolean
  }
  security_preferences: {
    session_timeout: number
    require_mfa: boolean
    password_expiry_reminder: boolean
    login_notifications: boolean
  }
  dashboard_layout?: {
    widgets?: Array<{
      id: string
      type: string
      position: { x: number; y: number }
      size: { width: number; height: number }
      config?: Record<string, any>
    }>
  }
  communication_preferences: {
    default_method: 'phone' | 'sms' | 'email'
    auto_reply_enabled: boolean
    business_hours: {
      enabled: boolean
      start: string
      end: string
      timezone: string
    }
  }
  accessibility_settings: {
    high_contrast: boolean
    large_text: boolean
    screen_reader: boolean
    keyboard_navigation: boolean
  }
  retell_config?: {
    api_key?: string
    call_agent_id?: string
    sms_agent_id?: string
  }
  [key: string]: any
}

interface DeviceInfo {
  deviceId: string
  deviceFingerprint: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  lastSeen: string
}

interface ConflictInfo {
  conflictId: string
  localData: UserSettingsData
  remoteData: UserSettingsData
  conflictingFields: string[]
  timestamp: string
  deviceId: string
}

class UserSettingsServiceClass {
  private cache = new Map<string, { data: UserSettingsData; timestamp: number; deviceId?: string }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private realtimeChannels = new Map<string, SupabaseRealtimeChannel>()
  private subscriptionCallbacks = new Map<string, (settings: UserSettingsData) => void>()
  private failedQueries = new Map<string, { count: number; lastAttempt: number }>()
  private readonly MAX_RETRY_COUNT = 3
  private readonly RETRY_COOLDOWN = 30000 // 30 seconds
  private currentDeviceId: string | null = null
  private conflictQueue = new Map<string, ConflictInfo[]>()
  private syncQueue = new Map<string, SyncQueueItem[]>()
  private lastSyncTimestamp = new Map<string, string>()
  private crossDeviceListeners = new Map<string, ((event: any) => void)[]>()

  /**
   * Check if we should skip Supabase query due to repeated failures
   */
  private shouldSkipSupabaseQuery(userId: string): boolean {
    const failureInfo = this.failedQueries.get(userId)
    if (!failureInfo) return false

    const now = Date.now()
    if (failureInfo.count >= this.MAX_RETRY_COUNT &&
        (now - failureInfo.lastAttempt) < this.RETRY_COOLDOWN) {
      return true
    }

    // Reset if cooldown period has passed
    if (failureInfo.count >= this.MAX_RETRY_COUNT &&
        (now - failureInfo.lastAttempt) >= this.RETRY_COOLDOWN) {
      this.failedQueries.delete(userId)
      return false
    }

    return false
  }

  /**
   * Record a failed query attempt
   */
  private recordFailedQuery(userId: string): void {
    const failureInfo = this.failedQueries.get(userId)
    if (failureInfo) {
      failureInfo.count++
      failureInfo.lastAttempt = Date.now()
    } else {
      this.failedQueries.set(userId, { count: 1, lastAttempt: Date.now() })
    }
  }

  /**
   * Clear failure record on successful query
   */
  private clearFailureRecord(userId: string): void {
    this.failedQueries.delete(userId)
  }

  /**
   * Initialize cross-device sync for a user
   */
  async initializeCrossDeviceSync(userId: string, deviceId?: string): Promise<{ success: boolean; deviceId: string }> {
    try {
      // Generate or use provided device ID
      const finalDeviceId = deviceId || this.generateDeviceId()
      this.currentDeviceId = finalDeviceId

      // Register device in Supabase
      await this.registerDevice(userId, finalDeviceId)

      // Subscribe to cross-device events
      await this.subscribeToCrossDeviceEvents(userId)

      // Perform initial sync
      await this.performInitialSync(userId)

      console.log(`🔄 CROSS-DEVICE SYNC: Initialized for user ${userId} on device ${finalDeviceId}`)
      return { success: true, deviceId: finalDeviceId }
    } catch (error) {
      console.error('Failed to initialize cross-device sync:', error)
      return { success: false, deviceId: deviceId || '' }
    }
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem('carexps_device_id')
    if (stored) return stored

    const deviceId = `device_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`
    localStorage.setItem('carexps_device_id', deviceId)
    return deviceId
  }

  /**
   * Register device with Supabase
   */
  private async registerDevice(userId: string, deviceId: string): Promise<void> {
    if (!supabaseConfig.isConfigured()) return

    try {
      const deviceInfo = this.getDeviceInfo(deviceId)

      const { error } = await supabase
        .from('user_devices')
        .upsert({
          id: deviceId,
          user_id: userId,
          device_fingerprint: deviceInfo.deviceFingerprint,
          device_name: deviceInfo.deviceName,
          device_type: deviceInfo.deviceType,
          is_active: true,
          last_seen: new Date().toISOString(),
          browser_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
          },
          os_info: {
            platform: navigator.platform,
            vendor: navigator.vendor
          },
          metadata: {
            syncEnabled: true,
            registeredAt: new Date().toISOString()
          }
        }, {
          onConflict: 'id'
        })

      if (error) {
        console.warn('Device registration failed:', error)
      } else {
        console.log('✅ Device registered successfully')

        // Log cross-device event
        await this.logCrossDeviceEvent(userId, deviceId, 'device_registered', {
          success: true,
          deviceInfo
        })
      }
    } catch (error) {
      console.error('Device registration error:', error)
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo(deviceId: string): DeviceInfo {
    const deviceType = this.detectDeviceType()
    const deviceName = this.generateDeviceName(deviceType)
    const deviceFingerprint = this.generateDeviceFingerprint()

    return {
      deviceId,
      deviceFingerprint,
      deviceName,
      deviceType,
      lastSeen: new Date().toISOString()
    }
  }

  /**
   * Detect device type
   */
  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase()
    if (/mobile|android|iphone|ipod/.test(userAgent)) return 'mobile'
    if (/tablet|ipad/.test(userAgent)) return 'tablet'
    return 'desktop'
  }

  /**
   * Generate device name
   */
  private generateDeviceName(deviceType: 'desktop' | 'mobile' | 'tablet'): string {
    const platform = navigator.platform || 'Unknown'
    const browser = this.getBrowserName()
    return `${platform} - ${browser} (${deviceType})`
  }

  /**
   * Get browser name
   */
  private getBrowserName(): string {
    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Unknown'
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || '0',
      navigator.maxTouchPoints?.toString() || '0'
    ]

    return btoa(components.join('|')).substring(0, 32)
  }

  /**
   * Subscribe to cross-device sync events
   */
  private async subscribeToCrossDeviceEvents(userId: string): Promise<void> {
    if (!supabaseConfig.isConfigured()) return

    try {
      // Subscribe to user_settings changes from other devices
      const settingsChannel = supabase
        .channel(`cross-device-settings-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            await this.handleCrossDeviceSettingsChange(payload)
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cross_device_sync_events',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            await this.handleCrossDeviceSyncEvent(payload)
          }
        )
        .subscribe()

      this.realtimeChannels.set(`cross-device-${userId}`, settingsChannel)
      console.log('🔄 Subscribed to cross-device sync events')
    } catch (error) {
      console.error('Failed to subscribe to cross-device events:', error)
    }
  }

  /**
   * Handle cross-device settings changes
   */
  private async handleCrossDeviceSettingsChange(payload: any): Promise<void> {
    try {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const remoteSettings = payload.new as Database['public']['Tables']['user_settings']['Row']

        // Skip if this change came from current device
        if (remoteSettings.last_synced && this.lastSyncTimestamp.get(remoteSettings.user_id) === remoteSettings.last_synced) {
          return
        }

        console.log('📥 CROSS-DEVICE: Received settings update from another device')

        // Check for conflicts
        const localSettings = this.cache.get(remoteSettings.user_id)
        if (localSettings && this.hasConflict(localSettings.data, remoteSettings)) {
          await this.handleConflict(remoteSettings.user_id, localSettings.data, remoteSettings)
          return
        }

        // Apply remote changes
        const transformedSettings = await this.transformSupabaseToLocal(remoteSettings)

        // Update cache
        this.cache.set(remoteSettings.user_id, {
          data: transformedSettings,
          timestamp: Date.now(),
          deviceId: 'remote'
        })

        // Update localStorage
        this.storeLocalSettings(remoteSettings.user_id, transformedSettings)

        // Notify listeners
        const callback = this.subscriptionCallbacks.get(remoteSettings.user_id)
        if (callback) {
          callback(transformedSettings)
        }

        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('crossDeviceSettingsSync', {
          detail: { userId: remoteSettings.user_id, settings: transformedSettings }
        }))
      }
    } catch (error) {
      console.error('Error handling cross-device settings change:', error)
    }
  }

  /**
   * Handle cross-device sync events
   */
  private async handleCrossDeviceSyncEvent(payload: any): Promise<void> {
    try {
      const event = payload.new as Database['public']['Tables']['cross_device_sync_events']['Row']

      console.log(`🔄 CROSS-DEVICE EVENT: ${event.event_type}`, {
        sourceDevice: event.source_device_id,
        targetDevice: event.target_device_id,
        success: event.success
      })

      // Notify cross-device listeners
      const listeners = this.crossDeviceListeners.get(event.user_id) || []
      listeners.forEach(listener => listener(event))

      // Handle specific event types
      switch (event.event_type) {
        case 'device_connected':
        case 'device_registered':
          // Trigger a sync to ensure new device has latest data
          await this.performPartialSync(event.user_id)
          break

        case 'conflict_detected':
          console.warn('⚠️ CONFLICT DETECTED on another device')
          break

        case 'sync_complete':
          console.log('✅ Sync completed on another device')
          break
      }
    } catch (error) {
      console.error('Error handling cross-device sync event:', error)
    }
  }

  /**
   * Check for conflicts between local and remote settings
   */
  private hasConflict(localSettings: UserSettingsData, remoteSettings: Database['public']['Tables']['user_settings']['Row']): boolean {
    // Simple timestamp-based conflict detection
    const localTimestamp = this.cache.get(remoteSettings.user_id)?.timestamp || 0
    const remoteTimestamp = new Date(remoteSettings.updated_at).getTime()

    // If remote is older than local, there might be a conflict
    const timeDiff = Math.abs(remoteTimestamp - localTimestamp)
    return timeDiff > 5000 // 5 seconds threshold
  }

  /**
   * Handle conflicts between local and remote data
   */
  private async handleConflict(
    userId: string,
    localSettings: UserSettingsData,
    remoteSettings: Database['public']['Tables']['user_settings']['Row']
  ): Promise<void> {
    try {
      console.warn('⚠️ CONFLICT DETECTED: Local and remote settings differ')

      const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substring(2)}`
      const conflictingFields = this.identifyConflictingFields(localSettings, remoteSettings)

      const conflictInfo: ConflictInfo = {
        conflictId,
        localData: localSettings,
        remoteData: await this.transformSupabaseToLocal(remoteSettings),
        conflictingFields,
        timestamp: new Date().toISOString(),
        deviceId: this.currentDeviceId || 'unknown'
      }

      // Add to conflict queue
      const userConflicts = this.conflictQueue.get(userId) || []
      userConflicts.push(conflictInfo)
      this.conflictQueue.set(userId, userConflicts)

      // Log conflict event
      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'conflict_detected', {
        conflictId,
        conflictingFields,
        conflictType: 'settings_conflict'
      })

      // Auto-resolve based on strategy (default: last write wins)
      await this.resolveConflictAutomatically(userId, conflictInfo)

    } catch (error) {
      console.error('Error handling conflict:', error)
    }
  }

  /**
   * Identify conflicting fields
   */
  private identifyConflictingFields(local: UserSettingsData, remote: Database['public']['Tables']['user_settings']['Row']): string[] {
    const conflicts: string[] = []

    // Check theme
    if (local.theme !== remote.theme) conflicts.push('theme')

    // Check notifications (deep comparison)
    if (JSON.stringify(local.notifications) !== JSON.stringify(remote.notifications)) {
      conflicts.push('notifications')
    }

    // Check retell config
    if (JSON.stringify(local.retell_config) !== JSON.stringify(remote.retell_config)) {
      conflicts.push('retell_config')
    }

    return conflicts
  }

  /**
   * Resolve conflict automatically using last-write-wins strategy
   */
  private async resolveConflictAutomatically(userId: string, conflict: ConflictInfo): Promise<void> {
    try {
      console.log('🔄 CONFLICT: Auto-resolving using last-write-wins strategy')

      // Use remote data (assuming it's newer)
      const resolvedSettings = conflict.remoteData

      // Update cache and storage
      this.cache.set(userId, {
        data: resolvedSettings,
        timestamp: Date.now(),
        deviceId: 'resolved'
      })

      this.storeLocalSettings(userId, resolvedSettings)

      // Remove from conflict queue
      const userConflicts = this.conflictQueue.get(userId) || []
      const filteredConflicts = userConflicts.filter(c => c.conflictId !== conflict.conflictId)
      this.conflictQueue.set(userId, filteredConflicts)

      // Log resolution
      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'conflict_resolved', {
        conflictId: conflict.conflictId,
        resolution: 'last_write_wins',
        resolvedFields: conflict.conflictingFields
      })

      console.log('✅ CONFLICT: Auto-resolved successfully')

      // Notify callback
      const callback = this.subscriptionCallbacks.get(userId)
      if (callback) {
        callback(resolvedSettings)
      }

    } catch (error) {
      console.error('Error resolving conflict:', error)
    }
  }

  /**
   * Perform initial sync when device connects
   */
  private async performInitialSync(userId: string): Promise<void> {
    try {
      console.log('🔄 INITIAL SYNC: Starting for user', userId)

      if (!supabaseConfig.isConfigured()) {
        console.log('⚠️ INITIAL SYNC: Supabase not configured, skipping')
        return
      }

      // Get latest settings from cloud
      const cloudSettings = await this.forceSyncFromCloud(userId)
      if (cloudSettings) {
        console.log('✅ INITIAL SYNC: Successfully loaded settings from cloud')

        // Log sync event
        await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_complete', {
          syncType: 'initial',
          tablesUpdated: ['user_settings'],
          recordCount: 1
        })
      }

    } catch (error) {
      console.error('Initial sync failed:', error)

      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_start', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        syncType: 'initial'
      })
    }
  }

  /**
   * Perform partial sync (lighter than full sync)
   */
  private async performPartialSync(userId: string): Promise<void> {
    try {
      console.log('🔄 PARTIAL SYNC: Starting for user', userId)

      // Check if we need to sync (based on last sync time)
      const lastSync = this.lastSyncTimestamp.get(userId)
      if (lastSync) {
        const timeSinceLastSync = Date.now() - new Date(lastSync).getTime()
        if (timeSinceLastSync < 30000) { // 30 seconds
          console.log('⚠️ PARTIAL SYNC: Skipping, recent sync detected')
          return
        }
      }

      // Perform lightweight sync
      const cloudSettings = await this.forceSyncFromCloud(userId)
      if (cloudSettings) {
        console.log('✅ PARTIAL SYNC: Completed successfully')
      }

    } catch (error) {
      console.error('Partial sync failed:', error)
    }
  }

  /**
   * Log cross-device events
   */
  private async logCrossDeviceEvent(
    userId: string,
    deviceId: string | null,
    eventType: Database['public']['Tables']['cross_device_sync_events']['Row']['event_type'],
    metadata: any
  ): Promise<void> {
    if (!supabaseConfig.isConfigured()) return

    try {
      const { error } = await supabase
        .from('cross_device_sync_events')
        .insert({
          user_id: userId,
          source_device_id: deviceId,
          event_type: eventType,
          table_name: 'user_settings',
          record_count: metadata.recordCount || 1,
          success: metadata.success !== false,
          error_message: metadata.error || null,
          duration_ms: metadata.duration || null,
          security_context: {
            deviceFingerprint: deviceId ? this.generateDeviceFingerprint() : null,
            trustLevel: 'trusted'
          },
          metadata
        })

      if (error) {
        console.warn('Failed to log cross-device event:', error)
      }
    } catch (error) {
      console.error('Error logging cross-device event:', error)
    }
  }

  /**
   * Get user settings with cross-device sync support
   */
  async getUserSettings(userId: string): Promise<UserSettingsData> {
    try {
      // Check cache first
      const cached = this.cache.get(userId)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data
      }

      // Check if we should skip Supabase due to repeated failures
      if (this.shouldSkipSupabaseQuery(userId)) {
        console.warn(`🚫 Skipping Supabase query for ${userId} due to repeated failures`)
        const localData = this.getLocalSettings(userId)
        if (localData) {
          return localData
        }
        return this.getDefaultSettings()
      }

      // Try to load from Supabase
      if (supabaseConfig.isConfigured()) {
        try {
          const { data: settings, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single()

          if (error) {
            console.warn(`❌ Supabase query failed for ${userId}:`, error.code, error.message)
            this.recordFailedQuery(userId)
            throw new Error(`Supabase error: ${error.code}`)
          }

          if (settings) {
            const localSettings = await this.transformSupabaseToLocal(settings)

            // Success - clear any failure records
            this.clearFailureRecord(userId)

            // Cache and store locally
            this.cache.set(userId, { data: localSettings, timestamp: Date.now() })
            this.storeLocalSettings(userId, localSettings)

            return localSettings
          }
        } catch (supabaseError: any) {
          console.warn('🔥 Supabase query failed, using local fallback:', supabaseError.message)
          this.recordFailedQuery(userId)
          // Fall through to local fallback
        }
      }

      // Fallback to localStorage
      const localData = this.getLocalSettings(userId)
      if (localData) {
        return localData
      }

      // Return and save defaults
      const defaultSettings = this.getDefaultSettings()
      await this.updateUserSettings(userId, defaultSettings)
      return defaultSettings

    } catch (error) {
      console.error('Error getting user settings:', error)
      this.recordFailedQuery(userId)
      return this.getDefaultSettings()
    }
  }

  /**
   * Update user settings with cross-device sync support
   */
  async updateUserSettings(userId: string, updates: Partial<UserSettingsData>, options?: {
    deviceId?: string,
    skipConflictCheck?: boolean,
    broadcastToOtherDevices?: boolean
  }): Promise<UserSettingsData> {
    const startTime = Date.now()

    try {
      console.log(`🔄 UPDATING SETTINGS: Starting update for user ${userId}`, {
        updatedFields: Object.keys(updates),
        deviceId: options?.deviceId || this.currentDeviceId
      })

      // Get current settings
      const currentSettings = await this.getUserSettings(userId)
      const newSettings = { ...currentSettings, ...updates }

      // Check for concurrent updates if not skipping conflict check
      if (!options?.skipConflictCheck && supabaseConfig.isConfigured()) {
        const hasConflict = await this.checkForConcurrentUpdates(userId, newSettings)
        if (hasConflict) {
          console.warn('⚠️ CONCURRENT UPDATE detected, handling conflict')
          // The conflict will be handled automatically, return current settings
          return currentSettings
        }
      }

      // Update timestamp for cross-device sync
      const syncTimestamp = new Date().toISOString()
      this.lastSyncTimestamp.set(userId, syncTimestamp)

      // Save to Supabase if available and not blocked by failures
      let cloudSuccess = false
      if (supabaseConfig.isConfigured() && !this.shouldSkipSupabaseQuery(userId)) {
        try {
          const supabaseData = await this.transformLocalToSupabase(userId, newSettings)

          // Add cross-device sync metadata
          supabaseData.device_sync_enabled = true
          supabaseData.last_synced = syncTimestamp

          const { error } = await supabase
            .from('user_settings')
            .upsert(supabaseData, { onConflict: 'user_id' })

          if (error) {
            console.warn('Failed to save to cloud:', error.code, error.message)
            this.recordFailedQuery(userId)

            // Log sync failure
            await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_start', {
              success: false,
              error: error.message,
              syncType: 'update',
              updatedFields: Object.keys(updates)
            })
          } else {
            cloudSuccess = true
            this.clearFailureRecord(userId)

            // Log successful sync
            await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_complete', {
              success: true,
              syncType: 'update',
              tablesUpdated: ['user_settings'],
              recordCount: 1,
              updatedFields: Object.keys(updates),
              duration: Date.now() - startTime
            })
          }
        } catch (supabaseError: any) {
          console.warn('Failed to save to cloud, saving locally:', supabaseError.message)
          this.recordFailedQuery(userId)

          await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_start', {
            success: false,
            error: supabaseError.message,
            syncType: 'update'
          })
        }
      }

      // Always save locally as backup/cache
      this.storeLocalSettings(userId, newSettings)

      // Update cache with device info
      this.cache.set(userId, {
        data: newSettings,
        timestamp: Date.now(),
        deviceId: options?.deviceId || this.currentDeviceId || 'unknown'
      })

      // Broadcast to other devices if requested and sync was successful
      if (options?.broadcastToOtherDevices !== false && cloudSuccess) {
        console.log('📡 BROADCAST: Settings update will be propagated to other devices via Supabase realtime')
      }

      // Audit log with enhanced metadata
      await auditLogger.logSecurityEvent('USER_SETTINGS_UPDATE', 'user_settings', true, {
        userId,
        updatedFields: Object.keys(updates),
        cloudSync: cloudSuccess,
        deviceId: this.currentDeviceId,
        crossDeviceSync: true,
        syncTimestamp
      })

      console.log(`✅ SETTINGS UPDATED: Success for user ${userId}`, {
        cloudSync: cloudSuccess,
        duration: Date.now() - startTime,
        fieldsUpdated: Object.keys(updates).length
      })

      return newSettings

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const duration = Date.now() - startTime

      console.error('Error updating user settings:', errorMessage, {
        duration,
        userId,
        deviceId: this.currentDeviceId
      })

      await auditLogger.logSecurityEvent('USER_SETTINGS_UPDATE_FAILED', 'user_settings', false, {
        userId,
        error: errorMessage,
        deviceId: this.currentDeviceId,
        duration
      })

      // Log sync failure
      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_start', {
        success: false,
        error: errorMessage,
        syncType: 'update',
        duration
      })

      throw error
    }
  }

  /**
   * Check for concurrent updates from other devices
   */
  private async checkForConcurrentUpdates(userId: string, localSettings: UserSettingsData): Promise<boolean> {
    try {
      if (!supabaseConfig.isConfigured()) return false

      const { data: remoteSettings, error } = await supabase
        .from('user_settings')
        .select('updated_at, last_synced')
        .eq('user_id', userId)
        .single()

      if (error || !remoteSettings) return false

      const lastLocalSync = this.lastSyncTimestamp.get(userId)
      const remoteUpdated = new Date(remoteSettings.updated_at).getTime()
      const lastSyncTime = lastLocalSync ? new Date(lastLocalSync).getTime() : 0

      // If remote was updated after our last sync, there might be a concurrent update
      return remoteUpdated > lastSyncTime + 1000 // 1 second buffer

    } catch (error) {
      console.warn('Failed to check for concurrent updates:', error)
      return false
    }
  }

  /**
   * Subscribe to real-time settings changes
   */
  subscribeToSettings(userId: string, callback: (settings: UserSettingsData) => void): void {
    if (!supabaseConfig.isConfigured()) {
      this.subscriptionCallbacks.set(userId, callback)
      return
    }

    try {
      this.subscriptionCallbacks.set(userId, callback)

      const channel = supabase
        .channel(`user-settings-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              try {
                const newSettings = await this.transformSupabaseToLocal(payload.new as DatabaseUserSettings)

                // Update cache and localStorage
                this.cache.set(userId, { data: newSettings, timestamp: Date.now() })
                this.storeLocalSettings(userId, newSettings)

                // Notify callback
                callback(newSettings)
              } catch (error) {
                console.error('Error processing real-time settings update:', error)
              }
            }
          }
        )
        .subscribe()

      this.realtimeChannels.set(userId, channel)
    } catch (error) {
      console.warn('Real-time subscription failed:', error)
    }
  }

  /**
   * Unsubscribe from real-time settings changes
   */
  unsubscribeFromSettings(userId?: string): void {
    if (userId) {
      // Unsubscribe specific user
      const channel = this.realtimeChannels.get(userId)
      if (channel) {
        supabase.removeChannel(channel)
        this.realtimeChannels.delete(userId)
        this.subscriptionCallbacks.delete(userId)
        console.log('🔇 Unsubscribed from settings for user:', userId)
      }
    } else {
      // Unsubscribe all
      this.realtimeChannels.forEach((channel, userId) => {
        supabase.removeChannel(channel)
      })
      this.realtimeChannels.clear()
      this.subscriptionCallbacks.clear()
      console.log('🔇 Unsubscribed from all settings subscriptions')
    }
  }


  /**
   * Get default settings
   */
  private getDefaultSettings(): UserSettingsData {
    return {
      theme: 'light',
      notifications: {
        email: true,
        sms: true,
        push: true,
        in_app: true,
        call_alerts: true,
        sms_alerts: true,
        security_alerts: true
      },
      security_preferences: {
        session_timeout: 15, // minutes
        require_mfa: true,
        password_expiry_reminder: true,
        login_notifications: true
      },
      dashboard_layout: {
        widgets: []
      },
      communication_preferences: {
        default_method: 'phone',
        auto_reply_enabled: false,
        business_hours: {
          enabled: false,
          start: '09:00',
          end: '17:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      },
      accessibility_settings: {
        high_contrast: false,
        large_text: false,
        screen_reader: false,
        keyboard_navigation: false
      }
    }
  }

  /**
   * Store settings in localStorage
   */
  private storeLocalSettings(userId: string, settings: UserSettingsData): void {
    try {
      const storageKey = `user_settings_${userId}`
      const dataToStore = {
        ...settings,
        cachedAt: new Date().toISOString()
      }

      localStorage.setItem(storageKey, JSON.stringify(dataToStore))
    } catch (error) {
      console.error('Failed to store settings in localStorage:', error)
    }
  }

  /**
   * Get settings from localStorage
   */
  private getLocalSettings(userId: string): UserSettingsData | null {
    try {
      const storageKey = `user_settings_${userId}`
      const stored = localStorage.getItem(storageKey)

      if (stored) {
        return JSON.parse(stored)
      }

      return null
    } catch (error) {
      console.error('Failed to get settings from localStorage:', error)
      return null
    }
  }


  /**
   * Transform Supabase data to local format
   */
  private async transformSupabaseToLocal(settings: DatabaseUserSettings): Promise<UserSettingsData> {
    const localSettings: UserSettingsData = {
      theme: settings.theme,
      notifications: settings.notifications as UserSettingsData['notifications'],
      security_preferences: settings.security_preferences as UserSettingsData['security_preferences'],
      dashboard_layout: settings.dashboard_layout as UserSettingsData['dashboard_layout'],
      communication_preferences: settings.communication_preferences as UserSettingsData['communication_preferences'],
      accessibility_settings: settings.accessibility_settings as UserSettingsData['accessibility_settings']
    }

    // Decrypt sensitive data
    if (settings.retell_config) {
      const config = settings.retell_config as any
      try {
        localSettings.retell_config = {
          api_key: config.api_key ? await encryptionService.decrypt(config.api_key) : undefined,
          call_agent_id: config.call_agent_id,
          sms_agent_id: config.sms_agent_id
        }
      } catch (error) {
        console.warn('⚠️ Failed to decrypt retell config, skipping:', error)
      }
    }

    return localSettings
  }

  /**
   * Transform local data to Supabase format
   */
  private async transformLocalToSupabase(userId: string, settings: UserSettingsData): Promise<Database['public']['Tables']['user_settings']['Insert']> {
    const supabaseData: Database['public']['Tables']['user_settings']['Insert'] = {
      user_id: userId,
      theme: settings.theme,
      notifications: settings.notifications,
      security_preferences: settings.security_preferences,
      dashboard_layout: settings.dashboard_layout || null,
      communication_preferences: settings.communication_preferences,
      accessibility_settings: settings.accessibility_settings,
      updated_at: new Date().toISOString(),
      last_synced: new Date().toISOString()
    }

    // Encrypt sensitive data
    if (settings.retell_config) {
      try {
        supabaseData.retell_config = {
          api_key: settings.retell_config.api_key ? await encryptionService.encrypt(settings.retell_config.api_key) : undefined,
          call_agent_id: settings.retell_config.call_agent_id,
          sms_agent_id: settings.retell_config.sms_agent_id
        }
      } catch (error) {
        console.warn('⚠️ Failed to encrypt retell config, saving without encryption:', error)
        supabaseData.retell_config = settings.retell_config
      }
    }

    return supabaseData
  }


  /**
   * Force immediate sync from cloud, bypassing cache (for cross-device login)
   */
  async forceSyncFromCloud(userId: string): Promise<UserSettingsData | null> {
    try {
      console.log(`🔄 FORCE SYNC: Starting for user ${userId}`)
      console.log(`📋 FORCE SYNC: Cache state before clear:`, this.cache.has(userId) ? 'EXISTS' : 'EMPTY')

      // Clear cache first to ensure fresh data
      this.cache.delete(userId)
      console.log(`🗑️ FORCE SYNC: Cache cleared for user ${userId}`)

      // Check Supabase configuration
      const isConfigured = supabaseConfig.isConfigured()
      console.log(`🔧 FORCE SYNC: Supabase configured:`, isConfigured)

      if (!isConfigured) {
        console.log('⚠️ FORCE SYNC: Supabase not configured, attempting alternative sync methods...')

        // Try alternative data sources when Supabase is not configured
        try {
          console.log('🔧 ALTERNATIVE SYNC: Checking userProfileService for API keys...')
          const { userProfileService } = await import('./userProfileService')
          const profileResponse = await userProfileService.loadUserProfile(userId)

          if (profileResponse.status === 'success' && profileResponse.data?.settings) {
            const profileSettings = profileResponse.data.settings

            if (profileSettings.retellApiKey || profileSettings.callAgentId) {
              console.log('✅ ALTERNATIVE SYNC: Found API keys in profile service')

              // Create settings with API keys from profile service
              const alternativeSettings: UserSettingsData = {
                ...this.getDefaultSettings(),
                retell_config: {
                  api_key: profileSettings.retellApiKey,
                  call_agent_id: profileSettings.callAgentId,
                  sms_agent_id: profileSettings.smsAgentId
                }
              }

              // Cache the alternative settings
              this.updateLocalCache(userId, alternativeSettings)
              console.log('✅ ALTERNATIVE SYNC: API keys recovered and cached')
              return alternativeSettings
            }
          }

          // Robust service fallback removed - service no longer exists

        } catch (alternativeError) {
          console.warn('⚠️ ALTERNATIVE SYNC: Alternative methods failed:', alternativeError)
        }

        console.log('🔍 FORCE SYNC: No alternative data sources found - this is likely why cross-device sync is not working!')
        return null
      }

      // Attempt to fetch from Supabase
      console.log(`🌐 FORCE SYNC: Querying Supabase for user_settings where user_id = ${userId}`)
      const queryStart = Date.now()

      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      const queryDuration = Date.now() - queryStart
      console.log(`⏱️ FORCE SYNC: Supabase query completed in ${queryDuration}ms`)

      if (error) {
        console.log(`❌ FORCE SYNC: Supabase error:`, error)
        console.log(`🔍 FORCE SYNC: Error code:`, error.code)
        console.log(`🔍 FORCE SYNC: Error details:`, error.details)
        console.log(`🔍 FORCE SYNC: Error hint:`, error.hint)
        return null
      }

      if (!settings) {
        console.log('📭 FORCE SYNC: Query succeeded but no settings data returned')
        console.log('ℹ️ FORCE SYNC: No cloud settings found for user, will use defaults')
        return null
      }

      console.log(`📄 FORCE SYNC: Raw settings data received:`)
      console.log(`   - user_id:`, settings.user_id)
      console.log(`   - theme:`, settings.theme)
      console.log(`   - retell_config:`, settings.retell_config ? 'EXISTS' : 'NULL')
      console.log(`   - updated_at:`, settings.updated_at)
      console.log(`   - last_synced:`, settings.last_synced)

      // Transform the data
      console.log(`🔄 FORCE SYNC: Transforming Supabase data to local format...`)
      const transformStart = Date.now()
      const localSettings = await this.transformSupabaseToLocal(settings)
      const transformDuration = Date.now() - transformStart
      console.log(`✅ FORCE SYNC: Transform completed in ${transformDuration}ms`)

      // Log what we got after transformation
      console.log(`📊 FORCE SYNC: Transformed settings keys:`, Object.keys(localSettings))
      if (localSettings.retell_config) {
        console.log(`🔑 FORCE SYNC: API credentials after decryption: [REDACTED - HIPAA PROTECTED]`)
        console.log(`   - API Key: [REDACTED]`)
        console.log(`   - Call Agent ID: [REDACTED]`)
        console.log(`   - SMS Agent ID: [REDACTED]`)
      } else {
        console.log(`❌ FORCE SYNC: No retell_config in transformed data`)
      }

      // Update cache and localStorage immediately
      this.cache.set(userId, { data: localSettings, timestamp: Date.now() })
      this.storeLocalSettings(userId, localSettings)

      console.log(`✅ FORCE SYNC: Successfully cached and stored locally`)
      console.log(`✅ FORCE SYNC: Complete - loaded ${Object.keys(localSettings).length} settings keys`)
      return localSettings

    } catch (error) {
      console.error('❌ FORCE SYNC: Failed with exception:', error)
      console.error('❌ FORCE SYNC: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      return null
    }
  }

  /**
   * Transform robust settings format to local format
   */
  private transformRobustToLocal(robustSettings: any): UserSettingsData {
    return {
      theme: robustSettings.theme || 'light',
      notifications: robustSettings.notifications || {
        email: true,
        sms: true,
        push: true,
        in_app: true,
        call_alerts: true,
        sms_alerts: true,
        security_alerts: true
      },
      security_preferences: robustSettings.security_preferences || {
        session_timeout: 15,
        require_mfa: true,
        password_expiry_reminder: true,
        login_notifications: true
      },
      dashboard_layout: robustSettings.dashboard_layout || { widgets: [] },
      communication_preferences: robustSettings.communication_preferences || {
        default_method: 'phone',
        auto_reply_enabled: false,
        business_hours: {
          enabled: false,
          start: '09:00',
          end: '17:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      },
      accessibility_settings: robustSettings.accessibility_settings || {
        high_contrast: false,
        large_text: false,
        screen_reader: false,
        keyboard_navigation: false
      },
      retell_config: robustSettings.retell_config
    }
  }

  /**
   * Update local cache with settings
   */
  private updateLocalCache(userId: string, settings: UserSettingsData): void {
    this.cache.set(userId, { data: settings, timestamp: Date.now() })
    this.storeLocalSettings(userId, settings)
  }

  /**
   * Clear cache (useful for logout)
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
      this.failedQueries.delete(userId) // Also clear failure records
    } else {
      this.cache.clear()
      this.failedQueries.clear() // Also clear all failure records
    }
  }

  /**
   * Reset failure tracking for a user (useful for retry scenarios)
   */
  resetFailureTracking(userId?: string): void {
    if (userId) {
      this.failedQueries.delete(userId)
      console.log(`🔄 Reset failure tracking for user: ${userId}`)
    } else {
      this.failedQueries.clear()
      console.log(`🔄 Reset all failure tracking`)
    }
  }

  /**
   * Get connected devices for a user
   */
  async getConnectedDevices(userId: string): Promise<UserDevice[]> {
    try {
      if (!supabaseConfig.isConfigured()) {
        return []
      }

      const { data: devices, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_seen', { ascending: false })

      if (error) {
        console.warn('Failed to get connected devices:', error)
        return []
      }

      return devices || []
    } catch (error) {
      console.error('Error getting connected devices:', error)
      return []
    }
  }

  /**
   * Get sync status for user
   */
  async getSyncStatus(userId: string): Promise<{
    isEnabled: boolean
    lastSync: string | null
    deviceCount: number
    pendingConflicts: number
    currentDevice: string | null
  }> {
    try {
      const devices = await this.getConnectedDevices(userId)
      const conflicts = this.conflictQueue.get(userId) || []
      const lastSync = this.lastSyncTimestamp.get(userId)

      return {
        isEnabled: true,
        lastSync,
        deviceCount: devices.length,
        pendingConflicts: conflicts.length,
        currentDevice: this.currentDeviceId
      }
    } catch (error) {
      console.error('Error getting sync status:', error)
      return {
        isEnabled: false,
        lastSync: null,
        deviceCount: 0,
        pendingConflicts: 0,
        currentDevice: null
      }
    }
  }

  /**
   * Force sync settings from all devices
   */
  async forceCrossDeviceSync(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`🔄 FORCE SYNC: Starting cross-device sync for user ${userId}`)

      const startTime = Date.now()

      // Log sync start event
      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_start', {
        syncType: 'manual_force',
        trigger: 'user_initiated'
      })

      // Get latest from cloud
      const cloudSettings = await this.forceSyncFromCloud(userId)

      if (cloudSettings) {
        // Update cache with fresh data
        this.cache.set(userId, {
          data: cloudSettings,
          timestamp: Date.now(),
          deviceId: 'cloud'
        })

        // Notify listeners
        const callback = this.subscriptionCallbacks.get(userId)
        if (callback) {
          callback(cloudSettings)
        }

        // Log success
        const duration = Date.now() - startTime
        await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_complete', {
          syncType: 'manual_force',
          success: true,
          duration,
          tablesUpdated: ['user_settings'],
          recordCount: 1
        })

        console.log(`✅ FORCE SYNC: Completed successfully in ${duration}ms`)
        return { success: true, message: `Sync completed in ${duration}ms` }
      } else {
        throw new Error('Failed to fetch settings from cloud')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'sync_start', {
        syncType: 'manual_force',
        success: false,
        error: errorMessage
      })

      console.error('Force sync failed:', errorMessage)
      return { success: false, message: errorMessage }
    }
  }

  /**
   * Revoke device access
   */
  async revokeDevice(userId: string, deviceId: string): Promise<{ success: boolean; message?: string }> {
    try {
      if (!supabaseConfig.isConfigured()) {
        return { success: false, message: 'Supabase not configured' }
      }

      // Mark device as inactive
      const { error } = await supabase
        .from('user_devices')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId)
        .eq('user_id', userId)

      if (error) {
        throw new Error(error.message)
      }

      // Log device revocation
      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'device_revoked', {
        revokedDeviceId: deviceId,
        reason: 'user_initiated'
      })

      console.log(`🚫 Device revoked: ${deviceId}`)
      return { success: true, message: 'Device access revoked' }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to revoke device:', errorMessage)
      return { success: false, message: errorMessage }
    }
  }

  /**
   * Get pending conflicts for a user
   */
  getPendingConflicts(userId: string): ConflictInfo[] {
    return this.conflictQueue.get(userId) || []
  }

  /**
   * Resolve conflict manually
   */
  async resolveConflict(
    userId: string,
    conflictId: string,
    resolution: 'take_local' | 'take_remote' | 'merge',
    mergedData?: UserSettingsData
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const conflicts = this.conflictQueue.get(userId) || []
      const conflict = conflicts.find(c => c.conflictId === conflictId)

      if (!conflict) {
        return { success: false, message: 'Conflict not found' }
      }

      let resolvedSettings: UserSettingsData

      switch (resolution) {
        case 'take_local':
          resolvedSettings = conflict.localData
          break
        case 'take_remote':
          resolvedSettings = conflict.remoteData
          break
        case 'merge':
          if (!mergedData) {
            return { success: false, message: 'Merged data required for merge resolution' }
          }
          resolvedSettings = mergedData
          break
        default:
          return { success: false, message: 'Invalid resolution type' }
      }

      // Apply resolved settings
      await this.updateUserSettings(userId, resolvedSettings, { skipConflictCheck: true })

      // Remove from conflict queue
      const filteredConflicts = conflicts.filter(c => c.conflictId !== conflictId)
      this.conflictQueue.set(userId, filteredConflicts)

      // Log resolution
      await this.logCrossDeviceEvent(userId, this.currentDeviceId, 'conflict_resolved', {
        conflictId,
        resolution,
        resolvedFields: conflict.conflictingFields
      })

      console.log(`✅ CONFLICT RESOLVED: ${conflictId} using ${resolution} strategy`)
      return { success: true, message: `Conflict resolved using ${resolution} strategy` }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to resolve conflict:', errorMessage)
      return { success: false, message: errorMessage }
    }
  }

  /**
   * Subscribe to cross-device sync events for a user
   */
  subscribeToUserCrossDeviceEvents(userId: string, callback: (event: any) => void): void {
    const listeners = this.crossDeviceListeners.get(userId) || []
    listeners.push(callback)
    this.crossDeviceListeners.set(userId, listeners)
  }

  /**
   * Unsubscribe from cross-device sync events
   */
  unsubscribeFromUserCrossDeviceEvents(userId: string, callback?: (event: any) => void): void {
    const listeners = this.crossDeviceListeners.get(userId) || []

    if (callback) {
      // Remove specific callback
      const filteredListeners = listeners.filter(l => l !== callback)
      this.crossDeviceListeners.set(userId, filteredListeners)
    } else {
      // Remove all callbacks for user
      this.crossDeviceListeners.delete(userId)
    }
  }

  /**
   * Cleanup cross-device sync resources
   */
  cleanupCrossDeviceSync(userId?: string): void {
    if (userId) {
      // Cleanup for specific user
      this.cache.delete(userId)
      this.conflictQueue.delete(userId)
      this.lastSyncTimestamp.delete(userId)
      this.crossDeviceListeners.delete(userId)
      this.subscriptionCallbacks.delete(userId)

      // Unsubscribe from real-time channels
      const channel = this.realtimeChannels.get(`cross-device-${userId}`)
      if (channel) {
        supabase.removeChannel(channel)
        this.realtimeChannels.delete(`cross-device-${userId}`)
      }

      console.log(`🧹 Cleaned up cross-device sync for user: ${userId}`)
    } else {
      // Cleanup all
      this.cache.clear()
      this.conflictQueue.clear()
      this.lastSyncTimestamp.clear()
      this.crossDeviceListeners.clear()
      this.subscriptionCallbacks.clear()

      // Unsubscribe from all channels
      this.realtimeChannels.forEach((channel) => {
        supabase.removeChannel(channel)
      })
      this.realtimeChannels.clear()

      console.log(`🧹 Cleaned up all cross-device sync resources`)
    }
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsServiceClass()

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    userSettingsService.cleanupCrossDeviceSync()
  })
}