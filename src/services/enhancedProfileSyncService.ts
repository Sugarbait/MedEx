import { supabase, supabaseConfig } from '@/config/supabase'
import { userProfileService } from '@/services/userProfileService'
import { avatarStorageService } from '@/services/avatarStorageService'
import { realTimeSyncService } from '@/services/realTimeSyncService'
import { auditLogger } from '@/services/auditLogger'
import { ServiceResponse } from '@/types/supabase'

export interface ProfileSyncEvent {
  eventType: 'profile_updated' | 'avatar_changed' | 'field_updated'
  userId: string
  deviceId: string
  field?: string
  oldValue?: any
  newValue?: any
  timestamp: string
  metadata?: any
}

export interface ProfileField {
  fieldName: string
  value: any
  lastModified: string
  deviceId: string
  syncStatus: 'pending' | 'synced' | 'failed'
}

export interface ProfileSyncStatus {
  userId: string
  lastFullSync: string | null
  pendingFields: string[]
  syncEnabled: boolean
  deviceId: string
  connectionState: 'connected' | 'offline' | 'syncing'
}

/**
 * Enhanced Profile Synchronization Service
 *
 * Provides comprehensive cross-device synchronization for all profile fields
 * including real-time updates, conflict resolution, and offline support.
 */
export class EnhancedProfileSyncService {
  private static userId: string | null = null
  private static deviceId: string | null = null
  private static syncListeners: Set<(event: ProfileSyncEvent) => void> = new Set()
  private static fieldPendingSync: Map<string, ProfileField> = new Map()
  private static realtimeChannel: any = null
  private static syncTimer: NodeJS.Timeout | null = null
  private static isInitialized = false

  /**
   * Initialize enhanced profile synchronization
   */
  static async initialize(userId: string): Promise<ServiceResponse<ProfileSyncStatus>> {
    try {
      console.log('🔄 Enhanced Profile Sync: Initializing for user:', userId)

      this.userId = userId
      this.deviceId = this.generateDeviceId()

      // Initialize user profile service cross-device sync
      const profileSyncInit = await userProfileService.initializeCrossDeviceProfileSync(userId, this.deviceId)
      if (!profileSyncInit.success) {
        console.warn('Profile service sync initialization failed:', profileSyncInit)
      }

      // Initialize real-time sync service if available
      if (supabaseConfig.isConfigured()) {
        try {
          const realtimeInit = await realTimeSyncService.initialize(userId, this.deviceId, {
            enableRealtime: true,
            retryAttempts: 3,
            syncInterval: 30000
          })

          if (realtimeInit) {
            // Set up event handlers
            realTimeSyncService.setEventHandlers({
              onSyncEvent: this.handleRealtimeSyncEvent.bind(this),
              onConnectionChange: this.handleConnectionChange.bind(this),
              onError: this.handleSyncError.bind(this)
            })
          }
        } catch (realtimeError) {
          console.warn('Real-time sync initialization failed, using localStorage-only mode:', realtimeError)
        }
      }

      // Set up profile field monitoring
      await this.setupProfileFieldMonitoring()

      // Set up avatar sync monitoring
      await this.setupAvatarSyncMonitoring()

      // Start periodic sync
      this.startPeriodicSync()

      this.isInitialized = true

      const status: ProfileSyncStatus = {
        userId,
        lastFullSync: new Date().toISOString(),
        pendingFields: [],
        syncEnabled: true,
        deviceId: this.deviceId,
        connectionState: supabaseConfig.isConfigured() ? 'connected' : 'offline'
      }

      await auditLogger.logSecurityEvent('PROFILE_SYNC_INITIALIZED', 'users', true, {
        userId,
        deviceId: this.deviceId,
        connectionState: status.connectionState
      })

      console.log('✅ Enhanced Profile Sync: Initialized successfully')
      return { status: 'success', data: status }

    } catch (error: any) {
      console.error('Enhanced Profile Sync: Initialization failed:', error)
      await auditLogger.logSecurityEvent('PROFILE_SYNC_INIT_FAILED', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: `Profile sync initialization failed: ${error.message}` }
    }
  }

  /**
   * Sync a specific profile field across devices
   */
  static async syncProfileField(
    fieldName: string,
    value: any,
    options?: {
      immediate?: boolean,
      broadcastRealtime?: boolean
    }
  ): Promise<ServiceResponse<boolean>> {
    try {
      if (!this.isInitialized || !this.userId) {
        return { status: 'error', error: 'Profile sync service not initialized' }
      }

      console.log(`🔄 Enhanced Profile Sync: Syncing field '${fieldName}' for user ${this.userId}`)

      const fieldData: ProfileField = {
        fieldName,
        value,
        lastModified: new Date().toISOString(),
        deviceId: this.deviceId!,
        syncStatus: 'pending'
      }

      // Store field for sync
      this.fieldPendingSync.set(fieldName, fieldData)

      // Update local storage immediately
      await this.updateLocalProfileField(fieldName, value)

      // Sync to cloud if connected
      if (supabaseConfig.isConfigured()) {
        try {
          // Create profile update object - handle extended fields appropriately
          const profileUpdate = { [fieldName]: value }

          // Log which fields are being synced to cloud for extended profile fields
          const extendedFields = ['department', 'phone', 'bio', 'location', 'display_name']
          if (extendedFields.includes(fieldName)) {
            console.log(`🔄 Enhanced Profile Sync: Syncing extended profile field '${fieldName}' to user_profiles table`)
          }

          const updateResponse = await userProfileService.updateUserProfile(
            this.userId,
            profileUpdate,
            {
              deviceId: this.deviceId!,
              syncToCloud: true,
              broadcastToOtherDevices: options?.broadcastRealtime !== false
            }
          )

          if (updateResponse.status === 'success') {
            fieldData.syncStatus = 'synced'
            this.fieldPendingSync.delete(fieldName)

            // Broadcast real-time event if enabled
            if (options?.broadcastRealtime !== false) {
              await this.broadcastFieldUpdate(fieldName, value)
            }

            console.log(`✅ Enhanced Profile Sync: Successfully synced field '${fieldName}' to cloud`)
          } else {
            fieldData.syncStatus = 'failed'
            console.warn(`Field sync failed for ${fieldName}:`, updateResponse.error)
          }
        } catch (cloudError) {
          console.warn(`Cloud sync failed for field ${fieldName}, keeping in pending queue:`, cloudError)
          fieldData.syncStatus = 'failed'
        }
      }

      // Emit sync event to listeners
      this.emitSyncEvent({
        eventType: 'field_updated',
        userId: this.userId,
        deviceId: this.deviceId!,
        field: fieldName,
        newValue: value,
        timestamp: fieldData.lastModified
      })

      console.log(`✅ Enhanced Profile Sync: Field '${fieldName}' sync completed`)
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error(`Enhanced Profile Sync: Field sync failed for ${fieldName}:`, error)
      return { status: 'error', error: `Field sync failed: ${error.message}` }
    }
  }

  /**
   * Sync profile avatar with enhanced persistence
   */
  static async syncProfileAvatar(
    avatarData: File | string,
    options?: { immediate?: boolean }
  ): Promise<ServiceResponse<string>> {
    try {
      if (!this.isInitialized || !this.userId) {
        return { status: 'error', error: 'Profile sync service not initialized' }
      }

      console.log('🔄 Enhanced Profile Sync: Syncing avatar for user:', this.userId)

      // Upload avatar using robust avatar storage service
      const uploadResult = await avatarStorageService.uploadAvatar(this.userId, avatarData)

      if (uploadResult.status === 'error') {
        return uploadResult
      }

      const avatarUrl = uploadResult.data!

      // Update profile with new avatar URL
      await this.syncProfileField('avatar', avatarUrl, {
        immediate: options?.immediate,
        broadcastRealtime: true
      })

      // Sync avatar across all devices
      await avatarStorageService.syncAvatarAcrossDevices(this.userId)

      // Emit avatar change event
      this.emitSyncEvent({
        eventType: 'avatar_changed',
        userId: this.userId,
        deviceId: this.deviceId!,
        newValue: avatarUrl,
        timestamp: new Date().toISOString()
      })

      await auditLogger.logSecurityEvent('PROFILE_AVATAR_SYNCED', 'users', true, {
        userId: this.userId,
        deviceId: this.deviceId,
        avatarUrl
      })

      console.log('✅ Enhanced Profile Sync: Avatar sync completed successfully')
      return { status: 'success', data: avatarUrl }

    } catch (error: any) {
      console.error('Enhanced Profile Sync: Avatar sync failed:', error)
      await auditLogger.logSecurityEvent('PROFILE_AVATAR_SYNC_FAILED', 'users', false, {
        userId: this.userId,
        error: error.message
      })
      return { status: 'error', error: `Avatar sync failed: ${error.message}` }
    }
  }

  /**
   * Force full profile synchronization
   */
  static async forceFullProfileSync(): Promise<ServiceResponse<ProfileSyncStatus>> {
    try {
      if (!this.isInitialized || !this.userId) {
        return { status: 'error', error: 'Profile sync service not initialized' }
      }

      console.log('🔄 Enhanced Profile Sync: Starting full profile sync for user:', this.userId)

      // Sync profile from cloud
      const profileSync = await userProfileService.forceSyncProfileFromCloud(this.userId)
      if (profileSync.status === 'error') {
        console.warn('Cloud profile sync failed:', profileSync.error)
      }

      // Sync avatar
      const avatarSync = await avatarStorageService.syncAvatarAcrossDevices(this.userId)
      if (avatarSync.status === 'error') {
        console.warn('Avatar sync failed:', avatarSync.error)
      }

      // Process pending field syncs
      await this.processPendingFieldSyncs()

      // Get current sync status
      const status = await this.getProfileSyncStatus()

      // Emit full sync event
      this.emitSyncEvent({
        eventType: 'profile_updated',
        userId: this.userId,
        deviceId: this.deviceId!,
        timestamp: new Date().toISOString(),
        metadata: { fullSync: true }
      })

      await auditLogger.logSecurityEvent('PROFILE_FULL_SYNC_COMPLETED', 'users', true, {
        userId: this.userId,
        deviceId: this.deviceId,
        pendingFields: status.data?.pendingFields.length || 0
      })

      console.log('✅ Enhanced Profile Sync: Full profile sync completed')
      return status

    } catch (error: any) {
      console.error('Enhanced Profile Sync: Full sync failed:', error)
      await auditLogger.logSecurityEvent('PROFILE_FULL_SYNC_FAILED', 'users', false, {
        userId: this.userId,
        error: error.message
      })
      return { status: 'error', error: `Full profile sync failed: ${error.message}` }
    }
  }

  /**
   * Get current profile synchronization status
   */
  static async getProfileSyncStatus(): Promise<ServiceResponse<ProfileSyncStatus>> {
    try {
      if (!this.isInitialized || !this.userId) {
        return { status: 'error', error: 'Profile sync service not initialized' }
      }

      const pendingFields = Array.from(this.fieldPendingSync.keys())

      const status: ProfileSyncStatus = {
        userId: this.userId,
        lastFullSync: localStorage.getItem(`profile_last_sync_${this.userId}`) || null,
        pendingFields,
        syncEnabled: true,
        deviceId: this.deviceId!,
        connectionState: this.getConnectionState()
      }

      return { status: 'success', data: status }

    } catch (error: any) {
      return { status: 'error', error: `Failed to get sync status: ${error.message}` }
    }
  }

  /**
   * Subscribe to profile sync events
   */
  static subscribeToSyncEvents(callback: (event: ProfileSyncEvent) => void): () => void {
    this.syncListeners.add(callback)
    console.log('📡 Enhanced Profile Sync: Added sync event listener')

    return () => {
      this.syncListeners.delete(callback)
      console.log('📡 Enhanced Profile Sync: Removed sync event listener')
    }
  }

  /**
   * Cleanup synchronization resources
   */
  static async cleanup(): Promise<void> {
    try {
      console.log('🧹 Enhanced Profile Sync: Cleaning up resources')

      // Process any pending syncs before cleanup
      await this.processPendingFieldSyncs()

      // Stop periodic sync
      if (this.syncTimer) {
        clearInterval(this.syncTimer)
        this.syncTimer = null
      }

      // Cleanup real-time service
      await realTimeSyncService.cleanup()

      // Cleanup user profile service
      userProfileService.cleanupProfileSync(this.userId || undefined)

      // Clear listeners
      this.syncListeners.clear()

      // Reset state
      this.isInitialized = false
      this.userId = null
      this.deviceId = null
      this.fieldPendingSync.clear()

      console.log('✅ Enhanced Profile Sync: Cleanup completed')

    } catch (error) {
      console.error('Enhanced Profile Sync: Cleanup failed:', error)
    }
  }

  // Private helper methods

  private static generateDeviceId(): string {
    const stored = localStorage.getItem('carexps_enhanced_device_id')
    if (stored) return stored

    const deviceId = `enhanced_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`
    localStorage.setItem('carexps_enhanced_device_id', deviceId)
    return deviceId
  }

  private static async setupProfileFieldMonitoring(): Promise<void> {
    // Subscribe to user profile service events
    if (this.userId) {
      userProfileService.subscribeToProfileSync(this.userId, (event) => {
        this.handleProfileServiceEvent(event)
      })
    }
  }

  private static async setupAvatarSyncMonitoring(): Promise<void> {
    // Listen for avatar update events
    window.addEventListener('avatarUpdated', (event: any) => {
      if (event.detail?.userId === this.userId) {
        this.emitSyncEvent({
          eventType: 'avatar_changed',
          userId: this.userId!,
          deviceId: this.deviceId!,
          newValue: event.detail.avatarUrl,
          timestamp: new Date().toISOString()
        })
      }
    })
  }

  private static async updateLocalProfileField(fieldName: string, value: any): Promise<void> {
    try {
      if (!this.userId) return

      // Update currentUser
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === this.userId) {
          userData[fieldName] = value
          userData.updated_at = new Date().toISOString()
          localStorage.setItem('currentUser', JSON.stringify(userData))
        }
      }

      // Update userProfile
      const userProfile = localStorage.getItem(`userProfile_${this.userId}`)
      if (userProfile) {
        const profile = JSON.parse(userProfile)
        profile[fieldName] = value
        profile.updated_at = new Date().toISOString()
        localStorage.setItem(`userProfile_${this.userId}`, JSON.stringify(profile))
      }

      // Update systemUsers
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === this.userId)
        if (userIndex >= 0) {
          users[userIndex][fieldName] = value
          users[userIndex].updated_at = new Date().toISOString()
          localStorage.setItem('systemUsers', JSON.stringify(users))
        }
      }

    } catch (error) {
      console.warn('Failed to update local profile field:', error)
    }
  }

  private static async broadcastFieldUpdate(fieldName: string, value: any): Promise<void> {
    try {
      if (supabaseConfig.isConfigured()) {
        await realTimeSyncService.queueSyncEvent(
          'profile_field_updated',
          { fieldName, value, userId: this.userId },
          'normal',
          true
        )
      }
    } catch (error) {
      console.warn('Failed to broadcast field update:', error)
    }
  }

  private static emitSyncEvent(event: ProfileSyncEvent): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Sync event listener error:', error)
      }
    })
  }

  private static startPeriodicSync(): void {
    this.syncTimer = setInterval(async () => {
      if (this.fieldPendingSync.size > 0) {
        await this.processPendingFieldSyncs()
      }
    }, 30000) // Sync every 30 seconds
  }

  private static async processPendingFieldSyncs(): Promise<void> {
    if (!supabaseConfig.isConfigured() || this.fieldPendingSync.size === 0) {
      return
    }

    console.log(`🔄 Enhanced Profile Sync: Processing ${this.fieldPendingSync.size} pending field syncs`)

    const pendingFields = Array.from(this.fieldPendingSync.entries())
    for (const [fieldName, fieldData] of pendingFields) {
      try {
        const profileUpdate = { [fieldName]: fieldData.value }
        const updateResponse = await userProfileService.updateUserProfile(
          this.userId!,
          profileUpdate,
          {
            deviceId: this.deviceId!,
            syncToCloud: true,
            broadcastToOtherDevices: true
          }
        )

        if (updateResponse.status === 'success') {
          this.fieldPendingSync.delete(fieldName)
          console.log(`✅ Enhanced Profile Sync: Synced pending field '${fieldName}'`)
        }
      } catch (error) {
        console.warn(`Failed to sync pending field ${fieldName}:`, error)
      }
    }
  }

  private static getConnectionState(): 'connected' | 'offline' | 'syncing' {
    if (!supabaseConfig.isConfigured()) {
      return 'offline'
    }

    const realtimeState = realTimeSyncService.getConnectionState()
    if (realtimeState.isConnected) {
      return this.fieldPendingSync.size > 0 ? 'syncing' : 'connected'
    }

    return 'offline'
  }

  private static async handleRealtimeSyncEvent(event: any): Promise<void> {
    try {
      if (event.type === 'profile_field_updated' && event.data.userId !== this.userId) {
        // Handle field updates from other devices
        const { fieldName, value } = event.data
        await this.updateLocalProfileField(fieldName, value)

        this.emitSyncEvent({
          eventType: 'field_updated',
          userId: this.userId!,
          deviceId: event.source,
          field: fieldName,
          newValue: value,
          timestamp: event.timestamp
        })
      }
    } catch (error) {
      console.error('Failed to handle realtime sync event:', error)
    }
  }

  private static handleProfileServiceEvent(event: any): void {
    this.emitSyncEvent({
      eventType: event.eventType as any,
      userId: this.userId!,
      deviceId: event.deviceId || 'unknown',
      timestamp: event.timestamp,
      metadata: event.data
    })
  }

  private static handleConnectionChange(state: any): void {
    console.log('📡 Enhanced Profile Sync: Connection state changed:', state.isConnected ? 'connected' : 'disconnected')
  }

  private static handleSyncError(error: any): void {
    console.error('Enhanced Profile Sync: Real-time sync error:', error)
  }
}

export const enhancedProfileSyncService = EnhancedProfileSyncService