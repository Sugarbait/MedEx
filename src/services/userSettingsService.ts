import { supabase } from '@/config/supabase'
import { UserSettingsService as BaseUserSettingsService } from './supabaseService'
import { EnhancedUserSettingsService } from './userSettingsServiceEnhanced'
import { UserSettings, ServiceResponse, RealtimePayload } from '@/types/supabase'
import { Database } from '@/types/supabase'
import { encryptPHI, decryptPHI } from '@/utils/encryption'

type UserSettingsRow = Database['public']['Tables']['user_settings']['Row']

/**
 * Enhanced user settings service with cross-device synchronization
 */
export class UserSettingsService extends BaseUserSettingsService {
  private static syncListeners = new Map<string, ((settings: UserSettings) => void)[]>()
  private static realtimeSubscription: any = null

  /**
   * Initialize real-time sync for user settings (Enhanced Version)
   */
  static initializeSync(): void {
    console.log('Initializing enhanced real-time sync')

    // Initialize the enhanced service
    EnhancedUserSettingsService.initialize()

    // Keep legacy subscription for backward compatibility
    if (this.realtimeSubscription) return

    this.realtimeSubscription = supabase
      .channel('user_settings_sync_legacy')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings'
        },
        (payload: RealtimePayload<UserSettingsRow>) => {
          this.handleRealtimeUpdate(payload)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Legacy real-time sync initialized')
        }
      })
  }

  /**
   * Cleanup real-time sync (Enhanced Version)
   */
  static cleanupSync(): void {
    // Cleanup enhanced service
    EnhancedUserSettingsService.cleanupSync()

    // Cleanup legacy subscription
    if (this.realtimeSubscription) {
      supabase.removeChannel(this.realtimeSubscription)
      this.realtimeSubscription = null
    }
    this.syncListeners.clear()
  }

  /**
   * Encrypt retell_config for secure storage
   */
  private static async encryptRetellConfig(config: {
    api_key?: string
    call_agent_id?: string
    sms_agent_id?: string
  }): Promise<any> {
    try {
      const result: any = {
        call_agent_id: config.call_agent_id,
        sms_agent_id: config.sms_agent_id
      }

      if (config.api_key) {
        try {
          const encryptedKey = encryptPHI(config.api_key)
          result.api_key = encryptedKey
        } catch (encryptError) {
          // If encryption fails, store the key as-is with a marker
          console.warn('Encryption not available, storing API key with basic encoding')
          // Use basic base64 encoding as fallback (not secure, but better than plaintext)
          result.api_key = btoa(config.api_key)
          result.api_key_encoded = true
        }
      }

      return result
    } catch (error) {
      console.error('Failed to process retell config:', error)
      // Return the config as-is if encryption completely fails
      return config
    }
  }

  /**
   * Decrypt retell_config for use
   */
  private static async decryptRetellConfig(encryptedConfig: any): Promise<{
    api_key?: string
    call_agent_id?: string
    sms_agent_id?: string
  } | null> {
    try {
      if (!encryptedConfig) return null

      const result: any = {
        call_agent_id: encryptedConfig.call_agent_id,
        sms_agent_id: encryptedConfig.sms_agent_id
      }

      if (encryptedConfig.api_key) {
        try {
          // Check if it's base64 encoded (fallback method)
          if (encryptedConfig.api_key_encoded) {
            result.api_key = atob(encryptedConfig.api_key)
          } else {
            // Try to decrypt using the encryption service
            result.api_key = decryptPHI(encryptedConfig.api_key)
          }
        } catch (decryptError) {
          console.warn('Failed to decrypt API key, using as-is')
          // If decryption fails, check if it's base64 encoded
          try {
            // Try base64 decode as last resort
            const decoded = atob(encryptedConfig.api_key)
            // Quick check if decode worked (should contain recognizable characters)
            if (decoded && decoded.length > 0) {
              result.api_key = decoded
            } else {
              result.api_key = encryptedConfig.api_key
            }
          } catch {
            // If all fails, use as-is (might be plaintext)
            result.api_key = encryptedConfig.api_key
          }
        }
      }

      return result
    } catch (error) {
      console.error('Failed to decrypt retell config:', error)
      return null
    }
  }

  /**
   * Enhanced subscription to settings changes with cross-device support
   */
  static subscribeToUserSettings(
    userId: string,
    callback: (settings: UserSettings) => void
  ): () => void {
    // Subscribe to enhanced service for real-time updates
    const enhancedUnsubscribe = EnhancedUserSettingsService.subscribeToUserSettings(userId, callback)

    // Also maintain legacy listeners for backward compatibility
    if (!this.syncListeners.has(userId)) {
      this.syncListeners.set(userId, [])
    }

    this.syncListeners.get(userId)!.push(callback)

    // Return combined unsubscribe function
    return () => {
      // Unsubscribe from enhanced service
      enhancedUnsubscribe()

      // Unsubscribe from legacy listeners
      const listeners = this.syncListeners.get(userId)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
        if (listeners.length === 0) {
          this.syncListeners.delete(userId)
        }
      }
    }
  }

  /**
   * Handle real-time updates from Supabase
   */
  private static handleRealtimeUpdate(payload: RealtimePayload<UserSettingsRow>): void {
    const { eventType, new: newRecord, old: oldRecord } = payload

    let userId: string | undefined
    let settings: UserSettings | null = null

    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        if (newRecord) {
          userId = newRecord.user_id
          settings = newRecord as UserSettings
        }
        break
      case 'DELETE':
        if (oldRecord) {
          userId = oldRecord.user_id
        }
        break
    }

    if (userId && settings) {
      const listeners = this.syncListeners.get(userId)
      if (listeners) {
        listeners.forEach(callback => callback(settings!))
      }
    }
  }

  /**
   * Enhanced getUserSettings with cross-device support
   */
  static async getUserSettings(userId: string): Promise<ServiceResponse<UserSettings | null>> {
    try {
      console.log('Using enhanced settings service for getUserSettings')

      // Use enhanced service for robust retrieval
      const result = await EnhancedUserSettingsService.getUserSettings(userId)

      if (result.status === 'success' && result.data) {
        // Log security event for audit trail
        await this.logSecurityEvent('SETTINGS_ACCESSED', 'user_settings', true, {
          userId,
          method: 'enhanced'
        })
      }

      return result
    } catch (error: any) {
      console.warn('Enhanced service failed, falling back to base service')
      return super.getUserSettings(userId)
    }
  }

  /**
   * Get user settings with caching and decryption
   */
  static async getUserSettingsWithCache(userId: string): Promise<ServiceResponse<UserSettings | null>> {
    try {
      // Try to get from cache first (localStorage for demo, could use IndexedDB)
      const cacheKey = `user_settings_${userId}`
      const cached = localStorage.getItem(cacheKey)

      if (cached) {
        const { data: cachedSettings, timestamp } = JSON.parse(cached)

        // Check if cache is still valid (5 minutes)
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return { status: 'success', data: cachedSettings }
        }
      }

      // Fetch from database with decryption
      const response = await this.getUserSettings(userId)

      if (response.status === 'success' && response.data) {
        // Cache the decrypted settings
        localStorage.setItem(cacheKey, JSON.stringify({
          data: response.data,
          timestamp: Date.now()
        }))
      }

      return response
    } catch (error: any) {
      return this.handleError(error, 'getUserSettingsWithCache')
    }
  }

  /**
   * Override updateUserSettings to handle encryption
   */
  static async updateUserSettings(
    userId: string,
    settings: Partial<UserSettings>
  ): Promise<ServiceResponse<UserSettings>> {
    try {
      // Prepare settings for database storage
      const settingsToSave = { ...settings }

      // Encrypt retell_config if it exists
      if (settingsToSave.retell_config) {
        const encryptedConfig = await this.encryptRetellConfig(settingsToSave.retell_config)
        settingsToSave.retell_config = encryptedConfig
      }

      // Save to database with encryption
      const baseResponse = await super.updateUserSettings(userId, settingsToSave as any)

      if (baseResponse.status === 'error') {
        return baseResponse as ServiceResponse<UserSettings>
      }

      // Return decrypted settings for use
      const decryptedSettings = baseResponse.data as UserSettings
      if (decryptedSettings.retell_config) {
        const decryptedConfig = await this.decryptRetellConfig(decryptedSettings.retell_config)
        decryptedSettings.retell_config = decryptedConfig
      }

      return { status: 'success', data: decryptedSettings }
    } catch (error: any) {
      return this.handleError(error, 'updateUserSettings')
    }
  }

  /**
   * Update user settings with cross-device synchronization via enhanced service
   */
  static async updateUserSettingsSync(
    userId: string,
    settings: Partial<UserSettings>,
    optimistic: boolean = true
  ): Promise<ServiceResponse<UserSettings>> {
    try {
      console.log('Using enhanced settings service for cross-device sync')

      // Use the enhanced service for robust sync
      const result = await EnhancedUserSettingsService.updateUserSettings(userId, settings, optimistic)

      if (result.status === 'success') {
        // Log security event for audit trail
        await this.logSecurityEvent('SETTINGS_UPDATED', 'user_settings', true, {
          userId,
          syncMethod: 'enhanced',
          fields: Object.keys(settings)
        })

        // Notify real-time listeners
        const listeners = this.syncListeners.get(userId)
        if (listeners && result.data) {
          listeners.forEach(callback => callback(result.data!))
        }
      }

      return result
    } catch (error: any) {
      console.error('Error in enhanced updateUserSettingsSync:', error)
      return this.handleError(error, 'updateUserSettingsSync')
    }
  }

  /**
   * Merge settings objects with conflict resolution
   */
  private static mergeSettings(
    current: Partial<UserSettings>,
    updates: Partial<UserSettings>
  ): Partial<UserSettings> {
    const merged = { ...current, ...updates }

    // Deep merge for nested objects
    if (current.notifications && updates.notifications) {
      merged.notifications = { ...current.notifications, ...updates.notifications }
    }

    if (current.security_preferences && updates.security_preferences) {
      merged.security_preferences = {
        ...current.security_preferences,
        ...updates.security_preferences
      }
    }

    if (current.dashboard_layout && updates.dashboard_layout) {
      merged.dashboard_layout = {
        ...current.dashboard_layout,
        ...updates.dashboard_layout
      }
    }

    if (current.communication_preferences && updates.communication_preferences) {
      merged.communication_preferences = {
        ...current.communication_preferences,
        ...updates.communication_preferences
      }
    }

    if (current.accessibility_settings && updates.accessibility_settings) {
      merged.accessibility_settings = {
        ...current.accessibility_settings,
        ...updates.accessibility_settings
      }
    }

    if (current.retell_config && updates.retell_config) {
      merged.retell_config = {
        ...current.retell_config,
        ...updates.retell_config
      }
    }

    return merged
  }

  /**
   * Enhanced cross-device sync
   */
  static async syncAcrossDevices(userId: string): Promise<ServiceResponse<UserSettings>> {
    try {
      console.log('Force syncing settings across devices')

      // Use enhanced service for force sync
      const result = await EnhancedUserSettingsService.forceSyncAcrossDevices(userId)

      if (result.status === 'success') {
        await this.logSecurityEvent('SETTINGS_FORCE_SYNCED', 'user_settings', true, {
          userId,
          method: 'enhanced'
        })
      }

      return result
    } catch (error: any) {
      return this.handleError(error, 'syncAcrossDevices')
    }
  }

  /**
   * Enhanced sync status with online/offline support
   */
  static async getSyncStatus(userId: string): Promise<ServiceResponse<{
    lastSynced: string | null
    needsSync: boolean
    deviceCount?: number
    isOnline: boolean
    hasPendingChanges: boolean
  }>> {
    try {
      // Get enhanced sync status
      const enhancedStatus = await EnhancedUserSettingsService.getSyncStatus(userId)

      if (enhancedStatus.status === 'success') {
        // Add device count information
        const { data: sessions } = await supabase
          .from('user_sessions')
          .select('device_info')
          .eq('user_id', userId)
          .eq('is_active', true)

        const deviceCount = sessions?.length || 0

        return {
          status: 'success',
          data: {
            ...enhancedStatus.data,
            deviceCount
          }
        }
      }

      return enhancedStatus
    } catch (error: any) {
      return this.handleError(error, 'getSyncStatus')
    }
  }

  /**
   * Import settings from another device/backup
   */
  static async importSettings(
    userId: string,
    settingsData: Partial<UserSettings>,
    overwrite: boolean = false
  ): Promise<ServiceResponse<UserSettings>> {
    try {
      let finalSettings = settingsData

      if (!overwrite) {
        // Merge with existing settings
        const currentResponse = await this.getUserSettings(userId)
        if (currentResponse.status === 'success' && currentResponse.data) {
          finalSettings = this.mergeSettings(currentResponse.data, settingsData)
        }
      }

      const response = await this.updateUserSettings(userId, finalSettings)

      if (response.status === 'success') {
        await this.logSecurityEvent('SETTINGS_IMPORTED', 'user_settings', true, {
          userId,
          overwrite,
          importedFields: Object.keys(settingsData)
        })
      }

      return response
    } catch (error: any) {
      return this.handleError(error, 'importSettings')
    }
  }

  /**
   * Export settings for backup or transfer
   */
  static async exportSettings(userId: string): Promise<ServiceResponse<{
    settings: UserSettings
    exportDate: string
    version: string
  }>> {
    try {
      const response = await this.getUserSettings(userId)

      if (response.status === 'error' || !response.data) {
        return { status: 'error', error: 'Could not retrieve settings for export' }
      }

      const exportData = {
        settings: response.data,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      }

      await this.logSecurityEvent('SETTINGS_EXPORTED', 'user_settings', true, { userId })

      return { status: 'success', data: exportData }
    } catch (error: any) {
      return this.handleError(error, 'exportSettings')
    }
  }

  /**
   * Reset settings to defaults
   */
  static async resetToDefaults(userId: string): Promise<ServiceResponse<UserSettings>> {
    try {
      // Get current settings for audit log
      const currentResponse = await this.getUserSettings(userId)
      const currentSettings = currentResponse.data

      // Delete current settings (will trigger default creation)
      await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId)

      // Create new default settings
      const response = await this.createDefaultSettings(userId)

      if (response.status === 'success') {
        // Clear cache
        const cacheKey = `user_settings_${userId}`
        localStorage.removeItem(cacheKey)

        await this.logSecurityEvent('SETTINGS_RESET', 'user_settings', true, {
          userId,
          previousSettings: currentSettings ? '[REDACTED]' : null
        })
      }

      return response
    } catch (error: any) {
      return this.handleError(error, 'resetToDefaults')
    }
  }

  /**
   * Validate settings data
   */
  static validateSettings(settings: Partial<UserSettings>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate theme
    if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
      errors.push('Invalid theme value')
    }

    // Validate session timeout
    if (settings.security_preferences?.session_timeout) {
      const timeout = settings.security_preferences.session_timeout
      if (timeout < 1 || timeout > 480) { // 1 minute to 8 hours
        errors.push('Session timeout must be between 1 and 480 minutes')
      }
    }

    // Validate business hours
    if (settings.communication_preferences?.business_hours) {
      const { start, end } = settings.communication_preferences.business_hours
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

      if (start && !timeRegex.test(start)) {
        errors.push('Invalid business hours start time format')
      }

      if (end && !timeRegex.test(end)) {
        errors.push('Invalid business hours end time format')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Repair user settings by cleaning up duplicates and ensuring data integrity
   * This is a utility method for troubleshooting duplicate settings issues
   */
  static async repairUserSettings(userId: string): Promise<ServiceResponse<{
    duplicatesFound: number
    duplicatesRemoved: number
    settingsRepaired: boolean
  }>> {
    try {
      console.log(`Starting user settings repair for user: ${userId}`)

      // Step 1: Clean up duplicates using base service method
      const cleanupResult = await super.cleanupDuplicateSettings(userId)

      let duplicatesFound = 0
      let duplicatesRemoved = 0

      if (cleanupResult.status === 'success') {
        duplicatesRemoved = cleanupResult.data.cleanedCount
        duplicatesFound = duplicatesRemoved > 0 ? duplicatesRemoved + 1 : 0 // +1 for the kept row
      }

      // Step 2: Verify settings exist, create if not
      const settingsResponse = await this.getUserSettings(userId)
      let settingsRepaired = false

      if (settingsResponse.status === 'error' || !settingsResponse.data) {
        console.log(`No settings found for user ${userId}, creating defaults...`)
        const createResult = await super.createDefaultSettings(userId)
        settingsRepaired = createResult.status === 'success'
      } else {
        console.log(`Settings exist for user ${userId}`)
        settingsRepaired = true
      }

      // Step 3: Clear cache to force fresh data
      const cacheKey = `user_settings_${userId}`
      localStorage.removeItem(cacheKey)

      console.log(`User settings repair completed for user ${userId}:`, {
        duplicatesFound,
        duplicatesRemoved,
        settingsRepaired
      })

      return {
        status: 'success',
        data: {
          duplicatesFound,
          duplicatesRemoved,
          settingsRepaired
        }
      }
    } catch (error: any) {
      console.error('Error in repairUserSettings:', error)
      return this.handleError(error, 'repairUserSettings')
    }
  }

}