/**
 * Simple User Settings Service for Cloud Sync
 *
 * Basic cloud sync approach: load from cloud on login, save to cloud on changes,
 * localStorage as cache. No complex device management or conflict resolution.
 */

import { supabase, supabaseConfig } from '@/config/supabase'
import { Database, UserSettings, ServiceResponse, RealtimeChannel } from '@/types/supabase'
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

class UserSettingsServiceClass {
  private cache = new Map<string, { data: UserSettingsData; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private realtimeChannels = new Map<string, SupabaseRealtimeChannel>()
  private subscriptionCallbacks = new Map<string, (settings: UserSettingsData) => void>()
  private failedQueries = new Map<string, { count: number; lastAttempt: number }>()
  private readonly MAX_RETRY_COUNT = 3
  private readonly RETRY_COOLDOWN = 30000 // 30 seconds

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
   * Get user settings with simple cloud sync
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
   * Update user settings with simple cloud sync
   */
  async updateUserSettings(userId: string, updates: Partial<UserSettingsData>): Promise<UserSettingsData> {
    try {
      // Get current settings
      const currentSettings = await this.getUserSettings(userId)
      const newSettings = { ...currentSettings, ...updates }

      // Save to Supabase if available and not blocked by failures
      let cloudSuccess = false
      if (supabaseConfig.isConfigured() && !this.shouldSkipSupabaseQuery(userId)) {
        try {
          const supabaseData = await this.transformLocalToSupabase(userId, newSettings)
          const { error } = await supabase
            .from('user_settings')
            .upsert(supabaseData, { onConflict: 'user_id' })

          if (error) {
            console.warn('Failed to save to cloud:', error.code, error.message)
            this.recordFailedQuery(userId)
          } else {
            cloudSuccess = true
            this.clearFailureRecord(userId)
          }
        } catch (supabaseError: any) {
          console.warn('Failed to save to cloud, saving locally:', supabaseError.message)
          this.recordFailedQuery(userId)
        }
      }

      // Always save locally as backup/cache
      this.storeLocalSettings(userId, newSettings)

      // Update cache
      this.cache.set(userId, { data: newSettings, timestamp: Date.now() })

      // Audit log
      await auditLogger.logSecurityEvent('USER_SETTINGS_UPDATE', 'user_settings', true, {
        userId,
        updatedFields: Object.keys(updates),
        cloudSync: cloudSuccess
      })

      return newSettings

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error updating user settings:', errorMessage)

      await auditLogger.logSecurityEvent('USER_SETTINGS_UPDATE_FAILED', 'user_settings', false, {
        userId,
        error: errorMessage
      })

      throw error
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

          // Also try other robust settings service if available
          console.log('🔧 ALTERNATIVE SYNC: Checking RobustUserSettingsService...')
          const { RobustUserSettingsService } = await import('./userSettingsServiceRobust')
          const robustResponse = await RobustUserSettingsService.getUserSettings(userId)

          if (robustResponse.status === 'success' && robustResponse.data?.retell_config) {
            console.log('✅ ALTERNATIVE SYNC: Found settings in RobustUserSettingsService')
            const transformedSettings = this.transformRobustToLocal(robustResponse.data)
            this.updateLocalCache(userId, transformedSettings)
            return transformedSettings
          }

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
}

// Export singleton instance
export const userSettingsService = new UserSettingsServiceClass()