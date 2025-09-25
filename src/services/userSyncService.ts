/**
 * User Settings Sync Service
 * Provides cross-device synchronization for user settings, API keys, and preferences
 * Supports multiple backend storage options including Firebase, Supabase, or custom API
 */

interface UserSettings {
  theme?: string
  mfaEnabled?: boolean
  refreshInterval?: number
  sessionTimeout?: number
  notifications?: {
    calls?: boolean
    sms?: boolean
    system?: boolean
  }
  retellApiKey?: string
  callAgentId?: string
  smsAgentId?: string
  avatar?: string
  preferences?: Record<string, any>
}

interface SyncStatus {
  lastSync: string
  deviceId: string
  conflictResolution: 'server_wins' | 'client_wins' | 'merge'
}

class UserSyncService {
  private userId: string | null = null
  private deviceId: string
  private syncEnabled: boolean = false
  private backendType: 'firebase' | 'supabase' | 'api' | 'demo' = 'supabase'
  private apiEndpoint: string = ''
  private syncInterval: number = 30000 // 30 seconds

  constructor() {
    // Generate unique device ID
    this.deviceId = this.getOrCreateDeviceId()

    // Initialize sync configuration from environment or settings
    this.initializeSyncConfig()
  }

  /**
   * Initialize sync configuration
   */
  private initializeSyncConfig() {
    // Check for environment variables or settings
    const storedConfig = localStorage.getItem('syncConfig')
    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig)
        this.backendType = config.backendType || 'supabase'
        this.apiEndpoint = config.apiEndpoint || ''
        this.syncEnabled = config.enabled || false
      } catch (error) {
        console.error('Failed to load sync config:', error)
      }
    }

    console.log('UserSyncService initialized:', {
      deviceId: this.deviceId,
      backendType: this.backendType,
      syncEnabled: this.syncEnabled
    })
  }

  /**
   * Get or create a unique device ID (Azure Static Web Apps compatible)
   */
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId')
    if (!deviceId) {
      // Use crypto.randomUUID if available (modern browsers), fallback to timestamp + random
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        deviceId = `device_${crypto.randomUUID()}`
      } else {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      }
      localStorage.setItem('deviceId', deviceId)
    }
    return deviceId
  }

  /**
   * Set user ID for sync operations
   */
  public setUserId(userId: string) {
    this.userId = userId
    console.log('UserSyncService: User ID set to', userId)
  }

  /**
   * Enable/disable sync
   */
  public setSyncEnabled(enabled: boolean) {
    this.syncEnabled = enabled
    this.saveSyncConfig()
    console.log('UserSyncService: Sync', enabled ? 'enabled' : 'disabled')
  }

  /**
   * Configure backend type and endpoint
   */
  public configureBackend(type: 'firebase' | 'supabase' | 'api' | 'demo', endpoint?: string) {
    this.backendType = type
    if (endpoint) {
      this.apiEndpoint = endpoint
    }
    this.saveSyncConfig()
    console.log('UserSyncService: Backend configured', { type, endpoint })
  }

  /**
   * Save sync configuration
   */
  private saveSyncConfig() {
    const config = {
      backendType: this.backendType,
      apiEndpoint: this.apiEndpoint,
      enabled: this.syncEnabled
    }
    localStorage.setItem('syncConfig', JSON.stringify(config))
  }

  /**
   * Sync user settings to cloud
   */
  public async syncSettingsToCloud(settings: UserSettings): Promise<{ success: boolean; message?: string }> {
    if (!this.syncEnabled || !this.userId) {
      return { success: false, message: 'Sync not enabled or user not set' }
    }

    try {
      console.log('Syncing settings to cloud:', { userId: this.userId, deviceId: this.deviceId })

      const syncData = {
        userId: this.userId,
        deviceId: this.deviceId,
        settings,
        timestamp: new Date().toISOString(),
        version: 1
      }

      switch (this.backendType) {
        case 'firebase':
          return await this.syncToFirebase(syncData)
        case 'supabase':
          return await this.syncToSupabase(syncData)
        case 'api':
          return await this.syncToAPI(syncData)
        case 'demo':
          return await this.syncToDemo(syncData)
        default:
          return { success: false, message: 'Invalid backend type' }
      }
    } catch (error) {
      console.error('Error syncing settings to cloud:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Sync user settings from cloud
   */
  public async syncSettingsFromCloud(): Promise<{ success: boolean; settings?: UserSettings; message?: string }> {
    if (!this.syncEnabled || !this.userId) {
      return { success: false, message: 'Sync not enabled or user not set' }
    }

    try {
      console.log('Syncing settings from cloud:', { userId: this.userId, deviceId: this.deviceId })

      switch (this.backendType) {
        case 'firebase':
          return await this.syncFromFirebase()
        case 'supabase':
          return await this.syncFromSupabase()
        case 'api':
          return await this.syncFromAPI()
        case 'demo':
          return await this.syncFromDemo()
        default:
          return { success: false, message: 'Invalid backend type' }
      }
    } catch (error) {
      console.error('Error syncing settings from cloud:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Demo sync implementation (simulates cloud storage)
   */
  private async syncToDemo(syncData: any): Promise<{ success: boolean; message?: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Store in localStorage with cloud-like key structure
    const cloudKey = `cloud_settings_${this.userId}`
    localStorage.setItem(cloudKey, JSON.stringify(syncData))

    console.log('Demo sync: Settings uploaded to simulated cloud')
    return { success: true, message: 'Settings synced to demo cloud storage' }
  }

  private async syncFromDemo(): Promise<{ success: boolean; settings?: UserSettings; message?: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))

    const cloudKey = `cloud_settings_${this.userId}`
    const cloudData = localStorage.getItem(cloudKey)

    if (!cloudData) {
      return { success: false, message: 'No cloud settings found' }
    }

    try {
      const syncData = JSON.parse(cloudData)
      console.log('Demo sync: Settings downloaded from simulated cloud')
      return { success: true, settings: syncData.settings, message: 'Settings synced from demo cloud storage' }
    } catch (error) {
      return { success: false, message: 'Failed to parse cloud settings' }
    }
  }

  /**
   * Firebase sync implementation
   */
  private async syncToFirebase(syncData: any): Promise<{ success: boolean; message?: string }> {
    // TODO: Implement Firebase Firestore sync
    console.log('Firebase sync not implemented yet')
    return { success: false, message: 'Firebase sync not implemented' }
  }

  private async syncFromFirebase(): Promise<{ success: boolean; settings?: UserSettings; message?: string }> {
    // TODO: Implement Firebase Firestore sync
    console.log('Firebase sync not implemented yet')
    return { success: false, message: 'Firebase sync not implemented' }
  }

  /**
   * Supabase sync implementation
   */
  private async syncToSupabase(syncData: any): Promise<{ success: boolean; message?: string }> {
    try {
      // We'll use the existing userProfileService which already handles Supabase
      const { userProfileService } = await import('./userProfileService')

      // Sync the settings to Supabase via the user profile service
      const result = await userProfileService.syncUserSettings(this.userId!, syncData.settings)

      if (result.status === 'success') {
        localStorage.setItem(`lastSync_${this.userId}`, new Date().toISOString())
        console.log('Supabase sync: Settings uploaded to Supabase')
        return { success: true, message: 'Settings synced to Supabase successfully' }
      } else {
        return { success: false, message: result.error || 'Supabase sync failed' }
      }
    } catch (error) {
      console.error('Supabase sync error:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Supabase connection failed' }
    }
  }

  private async syncFromSupabase(): Promise<{ success: boolean; settings?: UserSettings; message?: string }> {
    try {
      // We'll use the existing userProfileService which already handles Supabase
      const { userProfileService } = await import('./userProfileService')

      // Get the user profile which includes settings
      const result = await userProfileService.loadUserProfile(this.userId!)

      if (result.status === 'success' && result.data?.settings) {
        console.log('Supabase sync: Settings downloaded from Supabase')
        return {
          success: true,
          settings: result.data.settings,
          message: 'Settings synced from Supabase successfully'
        }
      } else {
        return { success: false, message: 'No settings found in Supabase or sync failed' }
      }
    } catch (error) {
      console.error('Supabase sync error:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Supabase connection failed' }
    }
  }

  /**
   * Custom API sync implementation (Azure Static Web Apps compatible)
   */
  private async syncToAPI(syncData: any): Promise<{ success: boolean; message?: string }> {
    if (!this.apiEndpoint) {
      return { success: false, message: 'API endpoint not configured' }
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/user-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(syncData)
      })

      if (response.ok) {
        console.log('API sync: Settings uploaded to custom API')
        return { success: true, message: 'Settings synced to API' }
      } else {
        const error = await response.text()
        return { success: false, message: `API sync failed: ${error}` }
      }
    } catch (error) {
      console.error('API sync error:', error)
      return { success: false, message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }

  private async syncFromAPI(): Promise<{ success: boolean; settings?: UserSettings; message?: string }> {
    if (!this.apiEndpoint) {
      return { success: false, message: 'API endpoint not configured' }
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/user-settings/${this.userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('API sync: Settings downloaded from custom API')
        return { success: true, settings: data.settings, message: 'Settings synced from API' }
      } else {
        const error = await response.text()
        return { success: false, message: `API sync failed: ${error}` }
      }
    } catch (error) {
      console.error('API sync error:', error)
      return { success: false, message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }

  /**
   * Get authentication token (implement based on your auth system)
   */
  private getAuthToken(): string {
    // TODO: Implement based on your authentication system
    return localStorage.getItem('authToken') || ''
  }

  private autoSyncIntervalId: number | null = null

  /**
   * Start automatic sync (Azure Static Web Apps compatible)
   */
  public startAutoSync() {
    if (!this.syncEnabled) return

    // Clear existing interval if any
    this.stopAutoSync()

    this.autoSyncIntervalId = window.setInterval(async () => {
      if (this.userId && this.syncEnabled) {
        try {
          console.log('Auto-sync: Checking for settings updates')
          const result = await this.syncSettingsFromCloud()
          if (result.success && result.settings) {
            // Trigger event to notify components of settings update
            window.dispatchEvent(new CustomEvent('cloudSettingsUpdated', {
              detail: result.settings
            }))
          }
        } catch (error) {
          console.error('Auto-sync error:', error)
        }
      }
    }, this.syncInterval)

    console.log('Auto-sync started with interval:', this.syncInterval)
  }

  /**
   * Stop automatic sync
   */
  public stopAutoSync() {
    if (this.autoSyncIntervalId !== null) {
      window.clearInterval(this.autoSyncIntervalId)
      this.autoSyncIntervalId = null
      console.log('Auto-sync stopped')
    }
  }

  /**
   * Force sync now
   */
  public async forceSyncNow(): Promise<{ success: boolean; message: string }> {
    if (!this.userId) {
      return { success: false, message: 'User not set' }
    }

    try {
      // Get current local settings
      const localSettings = localStorage.getItem(`settings_${this.userId}`)
      if (localSettings) {
        const settings = JSON.parse(localSettings)
        const uploadResult = await this.syncSettingsToCloud(settings)

        if (uploadResult.success) {
          return { success: true, message: 'Settings synced to cloud successfully' }
        } else {
          return { success: false, message: uploadResult.message || 'Sync failed' }
        }
      } else {
        return { success: false, message: 'No local settings to sync' }
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Force sync user data (alias for forceSyncNow for compatibility)
   */
  public async forceSyncUserData(userId: string): Promise<{ status: string; error?: string }> {
    // Set user ID if not already set
    if (this.userId !== userId) {
      this.setUser(userId)
    }

    try {
      const result = await this.forceSyncNow()
      return {
        status: result.success ? 'success' : 'error',
        error: result.success ? undefined : result.message
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): { enabled: boolean; lastSync?: string; deviceId: string; backend: string } {
    const lastSync = localStorage.getItem(`lastSync_${this.userId}`)
    return {
      enabled: this.syncEnabled,
      lastSync: lastSync || undefined,
      deviceId: this.deviceId,
      backend: this.backendType
    }
  }
}

// Export singleton instance
export const userSyncService = new UserSyncService()