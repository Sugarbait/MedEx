import { supabase, supabaseAdmin } from '@/config/supabase'
import { UserSettings, ServiceResponse, RealtimePayload, Database } from '@/types/supabase'
import { encryptPHI, decryptPHI } from '@/utils/encryption'
import { v4 as uuidv4 } from 'uuid'

type UserSettingsRow = Database['public']['Tables']['user_settings']['Row']

/**
 * Enhanced user settings service with cross-device synchronization
 * Supports both Azure AD authentication and localStorage fallback
 */
export class EnhancedUserSettingsService {
  private static syncListeners = new Map<string, ((settings: UserSettings) => void)[]>()
  private static realtimeSubscription: any = null
  private static isOnline = navigator.onLine
  private static pendingSync = new Map<string, Partial<UserSettings>>()

  /**
   * Initialize the service with online/offline detection
   */
  static initialize(): void {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true
      this.processPendingSync()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })

    // Initialize real-time sync if online
    if (this.isOnline) {
      this.initializeRealtimeSync()
    }
  }

  /**
   * Initialize real-time sync for user settings
   */
  static initializeRealtimeSync(): void {
    if (this.realtimeSubscription) return

    try {
      this.realtimeSubscription = supabase
        .channel('user_settings_sync')
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
            console.log('Real-time settings sync initialized')
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Real-time sync error, falling back to localStorage')
          }
        })
    } catch (error) {
      console.warn('Failed to initialize real-time sync:', error)
    }
  }

  /**
   * Cleanup real-time sync
   */
  static cleanupSync(): void {
    if (this.realtimeSubscription) {
      supabase.removeChannel(this.realtimeSubscription)
      this.realtimeSubscription = null
    }
    this.syncListeners.clear()
    this.pendingSync.clear()
  }

  /**
   * Get user ID from Azure AD authentication context
   */
  private static async getCurrentUserId(): Promise<string | null> {
    try {
      // Method 1: Try to get from Supabase auth context
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Look up user by Azure AD ID
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('azure_ad_id', user.id)
          .eq('is_active', true)
          .single()

        if (data) return data.id
      }

      // Method 2: Try to get from session storage (fallback)
      const sessionData = sessionStorage.getItem('carexps_session')
      if (sessionData) {
        const session = JSON.parse(sessionData)
        return session.userId || null
      }

      // Method 3: Try to get from secure storage
      const secureSession = localStorage.getItem('carexps_session')
      if (secureSession) {
        const session = JSON.parse(secureSession)
        return session.userId || null
      }

      return null
    } catch (error) {
      console.warn('Failed to get current user ID:', error)
      return null
    }
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
          console.warn('Encryption not available, using base64 encoding')
          result.api_key = btoa(config.api_key)
          result.api_key_encoded = true
        }
      }

      return result
    } catch (error) {
      console.error('Failed to process retell config:', error)
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
          if (encryptedConfig.api_key_encoded) {
            result.api_key = atob(encryptedConfig.api_key)
          } else {
            result.api_key = decryptPHI(encryptedConfig.api_key)
          }
        } catch (decryptError) {
          console.warn('Failed to decrypt API key')
          try {
            result.api_key = atob(encryptedConfig.api_key)
          } catch {
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
   * Get user settings with automatic fallback chain
   */
  static async getUserSettings(userId: string): Promise<ServiceResponse<UserSettings | null>> {
    try {
      // If online, try Supabase first
      if (this.isOnline) {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single()

          if (!error && data) {
            // Decrypt sensitive data
            const settings = data as UserSettings
            if (settings.retell_config) {
              settings.retell_config = await this.decryptRetellConfig(settings.retell_config)
            }

            // Update localStorage cache
            this.updateLocalCache(userId, settings)

            return { status: 'success', data: settings }
          }

          // If no data found in Supabase, try localStorage
          if (error?.code === 'PGRST116') {
            console.log('No settings found in Supabase, checking localStorage')
          }
        } catch (supabaseError) {
          console.warn('Supabase query failed, falling back to localStorage:', supabaseError)
        }
      }

      // Fallback to localStorage
      const cached = this.getFromLocalCache(userId)
      if (cached) {
        return { status: 'success', data: cached }
      }

      // If nothing found, create default settings
      return await this.createDefaultSettings(userId)

    } catch (error: any) {
      console.error('Failed to get user settings:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Update user settings with cross-device sync
   */
  static async updateUserSettings(
    userId: string,
    settings: Partial<UserSettings>,
    optimistic: boolean = true
  ): Promise<ServiceResponse<UserSettings>> {
    try {
      // Validate settings first
      const validation = this.validateSettings(settings)
      if (!validation.isValid) {
        return {
          status: 'error',
          error: `Settings validation failed: ${validation.errors.join(', ')}`
        }
      }

      // Get current settings for merging
      const currentResponse = await this.getUserSettings(userId)
      const currentSettings = currentResponse.data || {}

      // Merge with current settings
      const mergedSettings = this.mergeSettings(currentSettings, settings)

      // Optimistic update for immediate UI feedback
      if (optimistic) {
        this.updateLocalCache(userId, mergedSettings as UserSettings)
        this.notifyListeners(userId, mergedSettings as UserSettings)
      }

      // Try to sync to Supabase if online
      if (this.isOnline) {
        try {
          // Encrypt sensitive data before saving
          const settingsToSave = { ...mergedSettings }
          if (settingsToSave.retell_config) {
            settingsToSave.retell_config = await this.encryptRetellConfig(settingsToSave.retell_config)
          }

          // Use upsert with conflict resolution
          const { data, error } = await supabase
            .from('user_settings')
            .upsert({
              user_id: userId,
              ...settingsToSave,
              updated_at: new Date().toISOString(),
              last_synced: new Date().toISOString()
            }, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            })
            .select()
            .single()

          if (!error && data) {
            // Decrypt for return
            const finalSettings = data as UserSettings
            if (finalSettings.retell_config) {
              finalSettings.retell_config = await this.decryptRetellConfig(finalSettings.retell_config)
            }

            // Update cache with final result
            this.updateLocalCache(userId, finalSettings)
            this.notifyListeners(userId, finalSettings)

            // Remove from pending sync if successful
            this.pendingSync.delete(userId)

            console.log('Settings synced to Supabase successfully')
            return { status: 'success', data: finalSettings }
          } else {
            console.warn('Failed to sync to Supabase:', error)
            // Add to pending sync for retry when online
            this.pendingSync.set(userId, mergedSettings)
          }
        } catch (supabaseError) {
          console.warn('Supabase sync failed:', supabaseError)
          // Add to pending sync for retry when online
          this.pendingSync.set(userId, mergedSettings)
        }
      } else {
        // Offline - add to pending sync
        this.pendingSync.set(userId, mergedSettings)
        console.log('Offline - settings queued for sync')
      }

      // Always update localStorage as final fallback
      this.updateLocalCache(userId, mergedSettings as UserSettings)

      return { status: 'success', data: mergedSettings as UserSettings }

    } catch (error: any) {
      console.error('Failed to update user settings:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Create default settings for a user
   */
  static async createDefaultSettings(userId: string): Promise<ServiceResponse<UserSettings>> {
    try {
      const defaultSettings: Partial<UserSettings> = {
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
        device_sync_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_synced: new Date().toISOString()
      }

      // Try to save to Supabase if online
      if (this.isOnline) {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .upsert(defaultSettings, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            })
            .select()
            .single()

          if (!error && data) {
            const settings = data as UserSettings
            this.updateLocalCache(userId, settings)
            console.log('Default settings created in Supabase')
            return { status: 'success', data: settings }
          }
        } catch (supabaseError) {
          console.warn('Failed to create default settings in Supabase:', supabaseError)
        }
      }

      // Fallback to localStorage
      const settings = {
        ...defaultSettings,
        id: uuidv4()
      } as UserSettings

      this.updateLocalCache(userId, settings)
      console.log('Default settings created in localStorage')

      return { status: 'success', data: settings }

    } catch (error: any) {
      console.error('Failed to create default settings:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Subscribe to settings changes for real-time updates
   */
  static subscribeToUserSettings(
    userId: string,
    callback: (settings: UserSettings) => void
  ): () => void {
    if (!this.syncListeners.has(userId)) {
      this.syncListeners.set(userId, [])
    }

    this.syncListeners.get(userId)!.push(callback)

    // Return unsubscribe function
    return () => {
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
   * Force sync settings across all devices
   */
  static async forceSyncAcrossDevices(userId: string): Promise<ServiceResponse<UserSettings>> {
    try {
      if (!this.isOnline) {
        return { status: 'error', error: 'Cannot sync while offline' }
      }

      // Get latest from Supabase
      const response = await this.getUserSettings(userId)
      if (response.status === 'error' || !response.data) {
        return response as ServiceResponse<UserSettings>
      }

      const serverSettings = response.data

      // Update last_synced timestamp
      await supabase
        .from('user_settings')
        .update({ last_synced: new Date().toISOString() })
        .eq('user_id', userId)

      // Notify all listeners
      this.notifyListeners(userId, serverSettings)

      console.log('Settings force-synced across devices')
      return { status: 'success', data: serverSettings }

    } catch (error: any) {
      console.error('Failed to force sync:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Get sync status for a user
   */
  static async getSyncStatus(userId: string): Promise<ServiceResponse<{
    lastSynced: string | null
    needsSync: boolean
    isOnline: boolean
    hasPendingChanges: boolean
  }>> {
    try {
      const settings = await this.getUserSettings(userId)
      if (settings.status === 'error' || !settings.data) {
        return { status: 'error', error: 'Could not retrieve settings' }
      }

      const cached = this.getFromLocalCache(userId)
      const hasPendingChanges = this.pendingSync.has(userId) ||
                               (cached && (!settings.data.last_synced ||
                                new Date(cached.updated_at || 0) > new Date(settings.data.last_synced)))

      return {
        status: 'success',
        data: {
          lastSynced: settings.data.last_synced,
          needsSync: hasPendingChanges,
          isOnline: this.isOnline,
          hasPendingChanges
        }
      }
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Process pending sync operations when coming back online
   */
  private static async processPendingSync(): Promise<void> {
    if (!this.isOnline || this.pendingSync.size === 0) return

    console.log(`Processing ${this.pendingSync.size} pending sync operations`)

    for (const [userId, settings] of this.pendingSync.entries()) {
      try {
        const result = await this.updateUserSettings(userId, settings, false)
        if (result.status === 'success') {
          this.pendingSync.delete(userId)
          console.log(`Synced pending changes for user ${userId}`)
        }
      } catch (error) {
        console.warn(`Failed to sync pending changes for user ${userId}:`, error)
      }
    }
  }

  /**
   * Handle real-time updates from Supabase
   */
  private static handleRealtimeUpdate(payload: RealtimePayload<UserSettingsRow>): void {
    const { eventType, new: newRecord } = payload

    if (eventType === 'UPDATE' || eventType === 'INSERT') {
      if (newRecord) {
        const userId = newRecord.user_id
        const settings = newRecord as UserSettings

        // Update local cache
        this.updateLocalCache(userId, settings)

        // Notify listeners
        this.notifyListeners(userId, settings)

        console.log(`Real-time update received for user ${userId}`)
      }
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
   * Validate settings data
   */
  private static validateSettings(settings: Partial<UserSettings>): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate theme
    if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
      errors.push('Invalid theme value')
    }

    // Validate session timeout
    if (settings.security_preferences?.session_timeout) {
      const timeout = settings.security_preferences.session_timeout
      if (timeout < 1 || timeout > 480) {
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
   * Update localStorage cache
   */
  private static updateLocalCache(userId: string, settings: UserSettings): void {
    try {
      const cacheKey = `user_settings_${userId}`
      localStorage.setItem(cacheKey, JSON.stringify({
        data: settings,
        timestamp: Date.now(),
        version: '2.0.0'
      }))
    } catch (error) {
      console.warn('Failed to update localStorage cache:', error)
    }
  }

  /**
   * Get settings from localStorage cache
   */
  private static getFromLocalCache(userId: string): UserSettings | null {
    try {
      const cacheKey = `user_settings_${userId}`
      const cached = localStorage.getItem(cacheKey)

      if (cached) {
        const { data, timestamp, version } = JSON.parse(cached)

        // Check if cache is still valid (24 hours for offline support)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        if (Date.now() - timestamp < maxAge) {
          return data
        }
      }

      return null
    } catch (error) {
      console.warn('Failed to get from localStorage cache:', error)
      return null
    }
  }

  /**
   * Notify all listeners of settings changes
   */
  private static notifyListeners(userId: string, settings: UserSettings): void {
    const listeners = this.syncListeners.get(userId)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(settings)
        } catch (error) {
          console.warn('Error notifying settings listener:', error)
        }
      })
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
        version: '2.0.0'
      }

      return { status: 'success', data: exportData }
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Import settings from backup or another device
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

      const response = await this.updateUserSettings(userId, finalSettings, false)

      if (response.status === 'success') {
        console.log('Settings imported successfully')
      }

      return response
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }
}

// Export alias for compatibility with App.tsx
export { EnhancedUserSettingsService as UserSettingsService }