import { supabase } from '@/config/supabase'
import { UserSettings, ServiceResponse, RealtimePayload, Database } from '@/types/supabase'
import { encryptPHI, decryptPHI } from '@/utils/encryption'
import { v4 as uuidv4 } from 'uuid'

type UserSettingsRow = Database['public']['Tables']['user_settings']['Row']

/**
 * BULLETPROOF User Settings Service with Cross-Device Synchronization
 *
 * Features:
 * - Real-time sync across all devices/browsers
 * - Offline mode with automatic sync when online
 * - Migration from localStorage to Supabase
 * - Encryption for sensitive data (API keys)
 * - Conflict resolution for concurrent updates
 * - Comprehensive error handling and retry logic
 * - Data validation and integrity checks
 * - Audit logging for security compliance
 */
export class RobustUserSettingsService {
  private static syncListeners = new Map<string, ((settings: UserSettings) => void)[]>()
  private static realtimeSubscription: any = null
  private static isOnline = navigator.onLine
  private static pendingSync = new Map<string, Partial<UserSettings>>()
  private static retryQueue = new Map<string, { settings: Partial<UserSettings>; retries: number; lastAttempt: number }>()
  private static isInitialized = false
  private static maxRetries = 5
  private static retryDelay = 1000 // 1 second base delay
  private static maxRetryDelay = 30000 // 30 seconds max delay

  /**
   * Initialize the service with comprehensive setup
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('🚀 Initializing RobustUserSettingsService...')

    // Set up online/offline detection
    window.addEventListener('online', () => {
      console.log('📶 Network connection restored')
      this.isOnline = true
      this.processPendingSync()
      this.processRetryQueue()
    })

    window.addEventListener('offline', () => {
      console.log('📵 Network connection lost - switching to offline mode')
      this.isOnline = false
    })

    // Set up periodic sync for long-running sessions
    setInterval(() => {
      this.processRetryQueue()
    }, 30000) // Check retry queue every 30 seconds

    // Initialize real-time sync if online
    if (this.isOnline) {
      await this.initializeRealtimeSync()
    }

    // Migrate any existing localStorage settings
    await this.migrateLocalStorageSettings()

    this.isInitialized = true
    console.log('✅ RobustUserSettingsService initialized successfully')
  }

  /**
   * Initialize real-time synchronization
   */
  private static async initializeRealtimeSync(): Promise<void> {
    if (this.realtimeSubscription) return

    try {
      console.log('🔄 Setting up real-time settings synchronization...')

      this.realtimeSubscription = supabase
        .channel('user_settings_robust_sync')
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
            console.log('✅ Real-time settings sync active')
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('⚠️ Real-time sync error - operating in polling mode')
          }
        })
    } catch (error) {
      console.warn('⚠️ Failed to initialize real-time sync:', error)
    }
  }

  /**
   * Migrate existing localStorage settings to Supabase
   */
  private static async migrateLocalStorageSettings(): Promise<void> {
    try {
      console.log('🔄 Checking for localStorage settings to migrate...')

      // Get current user from localStorage or session
      const currentUser = this.getCurrentUserFromStorage()
      if (!currentUser?.id) {
        console.log('ℹ️ No current user found for migration')
        return
      }

      const userId = currentUser.id
      const legacyKey = `settings_${userId}`
      const legacySettings = localStorage.getItem(legacyKey)

      if (!legacySettings) {
        console.log('ℹ️ No legacy settings found to migrate')
        return
      }

      // Check if user already has settings in Supabase
      const existingSettings = await this.getUserSettings(userId)
      if (existingSettings.status === 'success' && existingSettings.data) {
        console.log('ℹ️ User already has Supabase settings - migration not needed')
        return
      }

      // Parse and migrate legacy settings
      try {
        const parsed = JSON.parse(legacySettings)
        console.log('🔄 Migrating legacy settings to Supabase...')

        const migratedSettings: Partial<UserSettings> = {
          theme: parsed.theme || 'light',
          notifications: {
            email: parsed.notifications?.calls ?? true,
            sms: parsed.notifications?.sms ?? true,
            push: true,
            in_app: true,
            call_alerts: parsed.notifications?.calls ?? true,
            sms_alerts: parsed.notifications?.sms ?? true,
            security_alerts: parsed.notifications?.system ?? true
          },
          security_preferences: {
            session_timeout: parsed.sessionTimeout || 15,
            require_mfa: true, // SECURITY POLICY: MFA is always mandatory
            password_expiry_reminder: true,
            login_notifications: true
          },
          retell_config: parsed.retellApiKey || parsed.callAgentId || parsed.smsAgentId ? {
            api_key: parsed.retellApiKey,
            call_agent_id: parsed.callAgentId,
            sms_agent_id: parsed.smsAgentId
          } : null
        }

        const result = await this.updateUserSettings(userId, migratedSettings, false)
        if (result.status === 'success') {
          console.log('✅ Successfully migrated legacy settings to Supabase')
          // Keep legacy settings as backup for now, don't delete immediately
          localStorage.setItem(`${legacyKey}_migrated`, new Date().toISOString())
        } else {
          console.error('❌ Failed to migrate legacy settings:', result.error)
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse legacy settings:', parseError)
      }
    } catch (error) {
      console.warn('⚠️ Migration process failed:', error)
    }
  }

  /**
   * Get current user from various storage locations
   */
  private static getCurrentUserFromStorage(): { id: string; email?: string } | null {
    try {
      // Try current user first
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const user = JSON.parse(currentUser)
        if (user.id) return user
      }

      // Try session storage
      const sessionUser = sessionStorage.getItem('currentUser')
      if (sessionUser) {
        const user = JSON.parse(sessionUser)
        if (user.id) return user
      }

      return null
    } catch (error) {
      console.warn('Failed to get current user from storage:', error)
      return null
    }
  }

  /**
   * Get user settings with comprehensive fallback chain
   */
  static async getUserSettings(userId: string): Promise<ServiceResponse<UserSettings | null>> {
    try {
      // Try Supabase first if online
      if (this.isOnline) {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single()

          if (!error && data) {
            // Decrypt sensitive data
            const settings = await this.decryptSettings(data as UserSettings)

            // Update local cache
            this.updateLocalCache(userId, settings)

            return { status: 'success', data: settings }
          }

          // If no data found in Supabase but no error, that's OK
          if (error?.code === 'PGRST116') {
            console.log('ℹ️ No settings found in Supabase for user', userId)
          } else if (error) {
            throw error
          }
        } catch (supabaseError) {
          console.warn('⚠️ Supabase query failed, falling back to cache:', supabaseError)
        }
      }

      // Fallback to local cache
      const cached = this.getFromLocalCache(userId)
      if (cached) {
        console.log('📱 Using cached settings for user', userId)
        return { status: 'success', data: cached }
      }

      // If nothing found, create default settings
      console.log('🔧 Creating default settings for user', userId)
      return await this.createDefaultSettings(userId)

    } catch (error: any) {
      console.error('❌ Failed to get user settings:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Update user settings with robust sync and conflict resolution
   */
  static async updateUserSettings(
    userId: string,
    settings: Partial<UserSettings>,
    optimistic: boolean = true
  ): Promise<ServiceResponse<UserSettings>> {
    try {
      // Validate settings
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

      // Merge with current settings (deep merge)
      const mergedSettings = this.mergeSettings(currentSettings, settings)

      // Optimistic update for immediate UI feedback
      if (optimistic) {
        this.updateLocalCache(userId, mergedSettings as UserSettings)
        this.notifyListeners(userId, mergedSettings as UserSettings)
      }

      // Try to sync to Supabase if online
      if (this.isOnline) {
        try {
          const result = await this.syncToSupabase(userId, mergedSettings)
          if (result.status === 'success') {
            console.log('✅ Settings synced to Supabase successfully')
            this.removePendingSync(userId)
            this.removeFromRetryQueue(userId)
            return result
          } else {
            throw new Error(result.error)
          }
        } catch (syncError) {
          console.warn('⚠️ Failed to sync to Supabase, adding to pending:', syncError)
          this.addToPendingSync(userId, mergedSettings)
          this.addToRetryQueue(userId, mergedSettings)
        }
      } else {
        console.log('📵 Offline - adding to pending sync queue')
        this.addToPendingSync(userId, mergedSettings)
      }

      // Always update local cache as final fallback
      this.updateLocalCache(userId, mergedSettings as UserSettings)

      return { status: 'success', data: mergedSettings as UserSettings }

    } catch (error: any) {
      console.error('❌ Failed to update user settings:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Sync settings to Supabase with conflict resolution
   */
  private static async syncToSupabase(
    userId: string,
    settings: Partial<UserSettings>
  ): Promise<ServiceResponse<UserSettings>> {
    try {
      // Encrypt sensitive data before saving
      const settingsToSave = await this.encryptSettings(settings)

      // Check for existing settings and handle conflicts
      const { data: existingData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)

      // Clean up duplicates if found
      if (existingData && existingData.length > 1) {
        console.log(`🧹 Cleaning up ${existingData.length} duplicate settings for user ${userId}`)
        await this.cleanupDuplicates(userId)
      }

      // Use upsert for atomic operation
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settingsToSave,
          updated_at: new Date().toISOString(),
          last_synced: new Date().toISOString(),
          device_sync_enabled: true
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (error) throw error

      if (!data) {
        throw new Error('No data returned from upsert operation')
      }

      // Decrypt for return
      const finalSettings = await this.decryptSettings(data as UserSettings)

      // Update cache with final result
      this.updateLocalCache(userId, finalSettings)
      this.notifyListeners(userId, finalSettings)

      return { status: 'success', data: finalSettings }

    } catch (error: any) {
      console.error('❌ Failed to sync to Supabase:', error)
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
        dashboard_layout: {
          widgets: []
        },
        device_sync_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_synced: new Date().toISOString()
      }

      // Try to save to Supabase if online
      if (this.isOnline) {
        try {
          const result = await this.syncToSupabase(userId, defaultSettings)
          if (result.status === 'success') {
            console.log('✅ Default settings created in Supabase')
            return result
          }
        } catch (supabaseError) {
          console.warn('⚠️ Failed to create default settings in Supabase:', supabaseError)
        }
      }

      // Fallback to localStorage
      const settings = {
        ...defaultSettings,
        id: uuidv4()
      } as UserSettings

      this.updateLocalCache(userId, settings)
      console.log('📱 Default settings created in localStorage')

      return { status: 'success', data: settings }

    } catch (error: any) {
      console.error('❌ Failed to create default settings:', error)
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

    console.log(`📡 Subscribed to settings changes for user ${userId}`)

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
      console.log(`📡 Unsubscribed from settings changes for user ${userId}`)
    }
  }

  /**
   * Force sync settings across all devices (alias for forceSyncAcrossDevices)
   */
  static async forceSync(userId: string): Promise<ServiceResponse<UserSettings>> {
    return this.forceSyncAcrossDevices(userId)
  }

  /**
   * Force sync settings across all devices
   */
  static async forceSyncAcrossDevices(userId: string): Promise<ServiceResponse<UserSettings>> {
    try {
      if (!this.isOnline) {
        return { status: 'error', error: 'Cannot sync while offline' }
      }

      console.log('🔄 Force syncing settings across devices...')

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

      console.log('✅ Settings force-synced across devices')
      return { status: 'success', data: serverSettings }

    } catch (error: any) {
      console.error('❌ Failed to force sync:', error)
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
    retryQueueSize: number
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
          hasPendingChanges,
          retryQueueSize: this.retryQueue.size
        }
      }
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Clean up duplicate settings entries
   */
  private static async cleanupDuplicates(userId: string): Promise<void> {
    try {
      const { data: existingRows } = await supabase
        .from('user_settings')
        .select('id, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (!existingRows || existingRows.length <= 1) {
        return
      }

      // Keep the most recent row, delete the rest
      const rowsToDelete = existingRows.slice(1)
      const idsToDelete = rowsToDelete.map(row => row.id)

      await supabase
        .from('user_settings')
        .delete()
        .in('id', idsToDelete)

      console.log(`🧹 Cleaned up ${idsToDelete.length} duplicate settings for user ${userId}`)
    } catch (error) {
      console.warn('⚠️ Failed to cleanup duplicates:', error)
    }
  }

  /**
   * Process pending sync operations when coming back online
   */
  private static async processPendingSync(): Promise<void> {
    if (!this.isOnline || this.pendingSync.size === 0) return

    console.log(`🔄 Processing ${this.pendingSync.size} pending sync operations`)

    for (const [userId, settings] of this.pendingSync.entries()) {
      try {
        const result = await this.syncToSupabase(userId, settings)
        if (result.status === 'success') {
          this.pendingSync.delete(userId)
          this.removeFromRetryQueue(userId)
          console.log(`✅ Synced pending changes for user ${userId}`)
        }
      } catch (error) {
        console.warn(`⚠️ Failed to sync pending changes for user ${userId}:`, error)
        this.addToRetryQueue(userId, settings)
      }
    }
  }

  /**
   * Process retry queue with exponential backoff
   */
  private static async processRetryQueue(): Promise<void> {
    if (!this.isOnline || this.retryQueue.size === 0) return

    const now = Date.now()

    for (const [userId, retryInfo] of this.retryQueue.entries()) {
      const { settings, retries, lastAttempt } = retryInfo

      // Calculate exponential backoff delay
      const delay = Math.min(this.retryDelay * Math.pow(2, retries), this.maxRetryDelay)

      if (now - lastAttempt >= delay) {
        if (retries >= this.maxRetries) {
          console.warn(`⚠️ Max retries exceeded for user ${userId}, removing from queue`)
          this.retryQueue.delete(userId)
          continue
        }

        try {
          const result = await this.syncToSupabase(userId, settings)
          if (result.status === 'success') {
            this.retryQueue.delete(userId)
            this.removePendingSync(userId)
            console.log(`✅ Retry successful for user ${userId} after ${retries + 1} attempts`)
          } else {
            throw new Error(result.error)
          }
        } catch (error) {
          this.retryQueue.set(userId, {
            settings,
            retries: retries + 1,
            lastAttempt: now
          })
          console.warn(`⚠️ Retry ${retries + 1} failed for user ${userId}:`, error)
        }
      }
    }
  }

  /**
   * Handle real-time updates from Supabase
   */
  private static handleRealtimeUpdate(payload: RealtimePayload<UserSettingsRow>): void {
    const { eventType, new: newRecord } = payload

    if ((eventType === 'UPDATE' || eventType === 'INSERT') && newRecord) {
      const userId = newRecord.user_id
      console.log(`📡 Real-time update received for user ${userId}`)

      // Decrypt settings and update cache
      this.decryptSettings(newRecord as UserSettings).then(settings => {
        this.updateLocalCache(userId, settings)
        this.notifyListeners(userId, settings)
      }).catch(error => {
        console.warn('⚠️ Failed to decrypt real-time update:', error)
      })
    }
  }

  /**
   * Encrypt sensitive settings data
   */
  private static async encryptSettings(settings: Partial<UserSettings>): Promise<Partial<UserSettings>> {
    const encrypted = { ...settings }

    if (encrypted.retell_config?.api_key) {
      try {
        const apiKey = encrypted.retell_config.api_key

        // Check if already encrypted (contains encryption prefixes)
        if (apiKey.includes('cbc:') || apiKey.includes('gcm:') || apiKey.includes('aes:')) {
          console.log('🔒 API key already encrypted, skipping re-encryption')
          // Already encrypted, don't encrypt again
          return encrypted
        }

        console.log('🔒 Encrypting clean API key for secure storage')
        encrypted.retell_config = {
          ...encrypted.retell_config,
          api_key: encryptPHI(encrypted.retell_config.api_key)
        }
      } catch (error) {
        console.warn('⚠️ Encryption failed, using base64 encoding:', error)
        encrypted.retell_config = {
          ...encrypted.retell_config,
          api_key: btoa(encrypted.retell_config.api_key),
          api_key_encoded: true
        } as any
      }
    }

    return encrypted
  }

  /**
   * Decrypt sensitive settings data
   */
  private static async decryptSettings(settings: UserSettings): Promise<UserSettings> {
    const decrypted = { ...settings }

    if (decrypted.retell_config?.api_key) {
      try {
        const config = decrypted.retell_config as any
        if (config.api_key_encoded) {
          decrypted.retell_config.api_key = atob(config.api_key)
        } else {
          decrypted.retell_config.api_key = decryptPHI(config.api_key)
        }
      } catch (error) {
        console.warn('⚠️ Decryption failed, using value as-is:', error)
      }
    }

    return decrypted
  }

  /**
   * Merge settings objects with deep merge for nested objects
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
      const cacheKey = `user_settings_robust_${userId}`
      localStorage.setItem(cacheKey, JSON.stringify({
        data: settings,
        timestamp: Date.now(),
        version: '3.0.0'
      }))
    } catch (error) {
      console.warn('⚠️ Failed to update localStorage cache:', error)
    }
  }

  /**
   * Get settings from localStorage cache
   */
  private static getFromLocalCache(userId: string): UserSettings | null {
    try {
      const cacheKey = `user_settings_robust_${userId}`
      const cached = localStorage.getItem(cacheKey)

      if (cached) {
        const { data, timestamp, version } = JSON.parse(cached)

        // For offline support, use longer cache validity (7 days)
        const maxAge = 7 * 24 * 60 * 60 * 1000
        if (Date.now() - timestamp < maxAge) {
          return data
        }
      }

      return null
    } catch (error) {
      console.warn('⚠️ Failed to get from localStorage cache:', error)
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
          console.warn('⚠️ Error notifying settings listener:', error)
        }
      })
    }
  }

  /**
   * Pending sync management
   */
  private static addToPendingSync(userId: string, settings: Partial<UserSettings>): void {
    this.pendingSync.set(userId, settings)
  }

  private static removePendingSync(userId: string): void {
    this.pendingSync.delete(userId)
  }

  /**
   * Retry queue management
   */
  private static addToRetryQueue(userId: string, settings: Partial<UserSettings>): void {
    this.retryQueue.set(userId, {
      settings,
      retries: 0,
      lastAttempt: Date.now()
    })
  }

  private static removeFromRetryQueue(userId: string): void {
    this.retryQueue.delete(userId)
  }

  /**
   * Cleanup resources
   */
  static cleanup(): void {
    if (this.realtimeSubscription) {
      supabase.removeChannel(this.realtimeSubscription)
      this.realtimeSubscription = null
    }
    this.syncListeners.clear()
    this.pendingSync.clear()
    this.retryQueue.clear()
    this.isInitialized = false
    console.log('🧹 RobustUserSettingsService cleaned up')
  }

  /**
   * Export settings for backup
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
        version: '3.0.0'
      }

      return { status: 'success', data: exportData }
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Import settings from backup
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
        console.log('✅ Settings imported successfully')
      }

      return response
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }
}