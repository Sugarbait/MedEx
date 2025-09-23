/**
 * User Settings Service for Cross-Device Synchronization
 *
 * Implements Supabase-first approach for user preferences and settings
 * with localStorage as cache/fallback. Provides real-time sync across devices.
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
  device_sync_enabled: boolean
  [key: string]: any
}

class UserSettingsServiceClass {
  private cache = new Map<string, { data: UserSettingsData; timestamp: number }>()
  private readonly CACHE_TTL = 2 * 60 * 1000 // 2 minutes (aggressive sync)
  private realtimeChannels = new Map<string, SupabaseRealtimeChannel>()
  private subscriptionCallbacks = new Map<string, (settings: UserSettingsData) => void>()
  private lastSupabaseAttempt = 0
  private readonly SUPABASE_RETRY_COOLDOWN = 60000 // 60 seconds between attempts (increased)
  private consecutiveFailures = 0
  private readonly MAX_CONSECUTIVE_FAILURES = 3
  private silentMode = false // Flag to suppress console messages after multiple failures

  /**
   * Get user settings with Supabase-first approach
   */
  async getUserSettings(userId: string): Promise<UserSettingsData> {
    try {
      // Check cache first
      const cached = this.cache.get(userId)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log('📱 Using cached user settings')
        return cached.data
      }

      // PRIORITY 1: Try Supabase for cross-device sync (with cooldown)
      let supabaseData: UserSettingsData | null = null
      const now = Date.now()
      const shouldTrySupabase = supabaseConfig.isConfigured() &&
        (now - this.lastSupabaseAttempt > this.SUPABASE_RETRY_COOLDOWN || this.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES)

      if (shouldTrySupabase) {
        try {
          this.lastSupabaseAttempt = now
          const { data: settings, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single()

          if (!error && settings) {
            supabaseData = await this.transformSupabaseToLocal(settings)
            this.consecutiveFailures = 0 // Reset failure count on success
            this.silentMode = false // Reset silent mode on success
            console.log('✅ User settings loaded from Supabase (cross-device sync)')

            // Cache the result
            this.cache.set(userId, { data: supabaseData, timestamp: Date.now() })

            // Store in localStorage as cache
            this.storeLocalSettings(userId, supabaseData)

            return supabaseData
          } else if (error.code !== 'PGRST116') {
            this.consecutiveFailures++
            if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
              this.silentMode = true
            }
            if (!this.silentMode) {
              console.warn('⚠️ Supabase settings query failed:', error.message)
            }
          }
        } catch (supabaseError) {
          this.consecutiveFailures++
          if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
            this.silentMode = true
          }
          if (!this.silentMode) {
            console.warn('⚠️ Supabase unavailable, using localStorage fallback')
          }
        }
      }

      // PRIORITY 2: Fallback to localStorage
      const localData = this.getLocalSettings(userId)
      if (localData) {
        if (!this.silentMode) {
          console.log('⚠️ Using localStorage fallback (offline mode)')
        }

        // Try to background sync to Supabase (with cooldown)
        if (supabaseConfig.isConfigured() && this.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
          this.backgroundSyncToSupabase(userId, localData).catch(() => {
            // Silent fail for background sync
          })
        }

        return localData
      }

      // PRIORITY 3: Return default settings and create them
      const defaultSettings = this.getDefaultSettings()
      console.log('📋 No existing settings found, creating defaults')

      // Try to save defaults to Supabase immediately
      await this.updateUserSettings(userId, defaultSettings)

      return defaultSettings

    } catch (error) {
      console.error('❌ Error getting user settings:', error)

      // Return defaults as last resort
      return this.getDefaultSettings()
    }
  }

  /**
   * Update user settings with immediate cross-device sync
   */
  async updateUserSettings(userId: string, updates: Partial<UserSettingsData>): Promise<UserSettingsData> {
    try {
      // Get current settings
      const currentSettings = await this.getUserSettings(userId)
      const newSettings = { ...currentSettings, ...updates }

      // PRIORITY 1: Save to Supabase for cross-device sync (with cooldown)
      let supabaseSuccess = false
      if (supabaseConfig.isConfigured() && this.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
        try {
          const supabaseData = await this.transformLocalToSupabase(userId, newSettings)
          const { error } = await supabase
            .from('user_settings')
            .upsert(supabaseData, { onConflict: 'user_id' })

          if (!error) {
            this.consecutiveFailures = 0 // Reset on success
            this.silentMode = false // Reset silent mode on success
            console.log('✅ Settings saved to Supabase (cross-device sync)')
            supabaseSuccess = true
          } else {
            this.consecutiveFailures++
            if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
              this.silentMode = true
            }
            if (!this.silentMode) {
              console.warn('⚠️ Supabase save failed:', error.message)
            }
          }
        } catch (supabaseError) {
          this.consecutiveFailures++
          if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
            this.silentMode = true
          }
          if (!this.silentMode) {
            console.warn('⚠️ Supabase unavailable for settings save')
          }
        }
      }

      // PRIORITY 2: Save to localStorage as cache/fallback
      try {
        this.storeLocalSettings(userId, newSettings)
        if (!this.silentMode) {
          console.log(supabaseSuccess ? '✅ Settings cached locally' : '⚠️ Settings saved to localStorage fallback')
        }
      } catch (localError) {
        console.error('❌ localStorage save failed:', localError)
        if (!supabaseSuccess) {
          throw new Error('Failed to save settings - both Supabase and localStorage failed')
        }
      }

      // Update cache
      this.cache.set(userId, { data: newSettings, timestamp: Date.now() })

      // Audit log
      await auditLogger.logSecurityEvent('USER_SETTINGS_UPDATE', 'user_settings', true, {
        userId,
        updatedFields: Object.keys(updates),
        syncedToSupabase: supabaseSuccess
      })

      if (!this.silentMode) {
        console.log('✅ User settings updated successfully')
      }
      return newSettings

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error updating user settings:', errorMessage)

      await auditLogger.logSecurityEvent('USER_SETTINGS_UPDATE_FAILED', 'user_settings', false, {
        userId,
        error: errorMessage
      })

      throw error
    }
  }

  /**
   * Subscribe to real-time settings changes for cross-device sync
   */
  subscribeToSettings(userId: string, callback: (settings: UserSettingsData) => void): void {
    // Skip realtime subscriptions if in localStorage-only mode
    if (!supabaseConfig.isConfigured() || supabaseConfig.isLocalStorageOnly()) {
      console.log('📴 Real-time sync disabled - using localStorage-only mode')
      this.subscriptionCallbacks.set(userId, callback)
      return
    }

    try {
      // Store callback
      this.subscriptionCallbacks.set(userId, callback)

      // Create realtime channel with enhanced error handling
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

                // Update cache
                this.cache.set(userId, { data: newSettings, timestamp: Date.now() })

                // Update localStorage cache
                this.storeLocalSettings(userId, newSettings)

                // Notify callback
                callback(newSettings)

                console.log('✅ Settings synced from real-time update')
              } catch (error) {
                console.error('❌ Error processing real-time settings update:', error)
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('📡 Real-time settings sync active')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.log('📴 Real-time sync unavailable - using localStorage mode')
            supabaseConfig.setLocalStorageOnly(true)
          }
        })

      // Store channel reference
      this.realtimeChannels.set(userId, channel)

    } catch (error) {
      console.log('📴 Real-time subscription failed - using localStorage mode')
      supabaseConfig.setLocalStorageOnly(true)
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
   * Force sync settings from Supabase (for login scenarios)
   */
  async forceSyncFromSupabase(userId: string): Promise<UserSettingsData | null> {
    try {
      console.log('🔄 Force syncing settings from Supabase...')

      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (!error && settings) {
        const localSettings = await this.transformSupabaseToLocal(settings)

        // Update cache and localStorage
        this.cache.set(userId, { data: localSettings, timestamp: Date.now() })
        this.storeLocalSettings(userId, localSettings)

        console.log('✅ Settings force-synced from Supabase')
        return localSettings
      } else if (error.code !== 'PGRST116') {
        console.warn('⚠️ Force sync failed:', error.message)
      }

      return null
    } catch (error) {
      console.error('❌ Force sync from Supabase failed:', error)
      return null
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
      },
      device_sync_enabled: true
    }
  }

  /**
   * Store settings in localStorage (cache/fallback)
   */
  private storeLocalSettings(userId: string, settings: UserSettingsData): void {
    try {
      const storageKey = `user_settings_${userId}`
      const dataToStore = {
        ...settings,
        cachedAt: new Date().toISOString(),
        deviceFingerprint: this.generateDeviceFingerprint()
      }

      localStorage.setItem(storageKey, JSON.stringify(dataToStore))
      console.log('💾 Settings stored in localStorage cache')
    } catch (error) {
      console.error('❌ Failed to store settings in localStorage:', error)
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
        const parsed = JSON.parse(stored)
        console.log('📱 Settings retrieved from localStorage')
        return parsed
      }

      return null
    } catch (error) {
      console.error('❌ Failed to get settings from localStorage:', error)
      return null
    }
  }

  /**
   * Background sync to Supabase
   */
  private async backgroundSyncToSupabase(userId: string, settings: UserSettingsData): Promise<void> {
    try {
      if (!this.silentMode) {
        console.log('🔄 Background syncing settings to Supabase...')
      }
      const supabaseData = await this.transformLocalToSupabase(userId, settings)

      const { error } = await supabase
        .from('user_settings')
        .upsert(supabaseData, { onConflict: 'user_id' })

      if (!error) {
        this.consecutiveFailures = 0 // Reset on success
        this.silentMode = false // Reset silent mode
        console.log('✅ Background sync to Supabase completed')
      } else {
        this.consecutiveFailures++
        if (!this.silentMode) {
          console.warn('⚠️ Background sync failed:', error.message)
        }
      }
    } catch (error) {
      this.consecutiveFailures++
      if (!this.silentMode) {
        console.warn('⚠️ Background sync to Supabase failed:', error)
      }
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
      accessibility_settings: settings.accessibility_settings as UserSettingsData['accessibility_settings'],
      device_sync_enabled: settings.device_sync_enabled
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
      device_sync_enabled: settings.device_sync_enabled,
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
   * Generate device fingerprint for tracking
   */
  private generateDeviceFingerprint(): string {
    try {
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset()
      ].join('|')

      let hash = 0
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }

      return Math.abs(hash).toString(36)
    } catch (error) {
      return 'unknown-device'
    }
  }

  /**
   * Clear cache (useful for logout)
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
    } else {
      this.cache.clear()
    }
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsServiceClass()