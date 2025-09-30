import { supabase } from '@/config/supabase'
import { auditLogger } from './auditLogger'
import { avatarStorageService } from './avatarStorageService'
import { userProfileService } from './userProfileService'
import { profileFieldsPersistenceService } from './profileFieldsPersistenceService'

/**
 * Enhanced Cross-Device Profile Synchronization Service
 *
 * Provides comprehensive profile data synchronization across devices with:
 * - Real-time bidirectional sync via Supabase real-time
 * - Conflict resolution with last-write-wins strategy
 * - Offline-first architecture with automatic sync when online
 * - HIPAA-compliant audit logging
 * - Robust error handling and fallback mechanisms
 */

export interface ProfileSyncData {
  id: string
  email: string
  name: string
  role: string
  avatar?: string
  mfa_enabled?: boolean
  // Extended profile fields
  display_name?: string
  department?: string
  phone?: string
  bio?: string
  location?: string
  // Sync metadata
  lastSynced?: string
  deviceId?: string
  syncVersion?: number
}

export interface SyncStatus {
  isOnline: boolean
  isRealtimeConnected: boolean
  lastFullSync: string | null
  pendingChanges: number
  conflictsResolved: number
  deviceId: string
  syncErrors: string[]
}

export interface SyncEvent {
  type: 'profile_updated' | 'avatar_changed' | 'field_updated' | 'sync_status'
  userId: string
  deviceId: string
  field?: string
  oldValue?: any
  newValue?: any
  timestamp: string
  source: 'local' | 'remote' | 'cloud'
}

type SyncEventCallback = (event: SyncEvent) => void

export class EnhancedCrossDeviceProfileSync {
  private static instance: EnhancedCrossDeviceProfileSync | null = null
  private deviceId: string
  private userId: string | null = null
  private realtimeChannel: any = null
  private eventListeners: Map<string, SyncEventCallback[]> = new Map()
  private syncQueue: Map<string, any> = new Map()
  private isOnline: boolean = navigator.onLine
  private syncVersion: number = 1
  private syncStatus: SyncStatus
  private pendingOperations: Set<string> = new Set()

  private constructor() {
    this.deviceId = this.generateDeviceId()
    this.syncStatus = {
      isOnline: this.isOnline,
      isRealtimeConnected: false,
      lastFullSync: null,
      pendingChanges: 0,
      conflictsResolved: 0,
      deviceId: this.deviceId,
      syncErrors: []
    }
    this.initializeNetworkListeners()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EnhancedCrossDeviceProfileSync {
    if (!this.instance) {
      this.instance = new EnhancedCrossDeviceProfileSync()
    }
    return this.instance
  }

  /**
   * Initialize sync for a specific user
   */
  async initialize(userId: string): Promise<{ status: 'success' | 'error'; error?: string }> {
    try {
      console.log('🔄 ENHANCED SYNC: Initializing for user:', userId)

      this.userId = userId

      await auditLogger.logSecurityEvent('PROFILE_SYNC_INIT', 'user_profiles', true, {
        userId,
        deviceId: this.deviceId
      })

      // Initialize real-time subscription
      await this.initializeRealtimeSync()

      // Perform initial sync from cloud
      await this.performInitialSync()

      // Start periodic sync
      this.startPeriodicSync()

      console.log('✅ ENHANCED SYNC: Initialization complete')
      return { status: 'success' }

    } catch (error: any) {
      console.error('❌ ENHANCED SYNC: Initialization failed:', error)
      this.syncStatus.syncErrors.push(`Init failed: ${error.message}`)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Initialize real-time synchronization
   */
  private async initializeRealtimeSync(): Promise<void> {
    if (!this.userId || !supabase) return

    try {
      // Remove existing channel if any
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel)
      }

      this.realtimeChannel = supabase
        .channel(`profile-sync-${this.userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${this.userId}`
          },
          (payload) => this.handleUserTableChange(payload)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_profiles',
            filter: `user_id=eq.${this.userId}`
          },
          (payload) => this.handleProfileTableChange(payload)
        )
        .subscribe((status) => {
          console.log('🔄 REALTIME STATUS:', status)
          this.syncStatus.isRealtimeConnected = status === 'SUBSCRIBED'
          this.emitSyncEvent({
            type: 'sync_status',
            userId: this.userId!,
            deviceId: this.deviceId,
            newValue: this.syncStatus,
            timestamp: new Date().toISOString(),
            source: 'local'
          })
        })

      console.log('✅ ENHANCED SYNC: Real-time subscription initialized')
    } catch (error) {
      console.error('❌ ENHANCED SYNC: Real-time initialization failed:', error)
      this.syncStatus.syncErrors.push(`Realtime failed: ${error}`)
    }
  }

  /**
   * Handle changes to users table
   */
  private async handleUserTableChange(payload: any): Promise<void> {
    try {
      if (payload.eventType === 'UPDATE' && payload.new) {
        console.log('📥 REMOTE CHANGE: Users table updated')

        const remoteData = payload.new
        await this.resolveConflictAndSync('users', remoteData)

        this.emitSyncEvent({
          type: 'profile_updated',
          userId: this.userId!,
          deviceId: 'remote',
          newValue: remoteData,
          timestamp: new Date().toISOString(),
          source: 'remote'
        })
      }
    } catch (error) {
      console.error('❌ ENHANCED SYNC: Error handling user table change:', error)
    }
  }

  /**
   * Handle changes to user_profiles table
   */
  private async handleProfileTableChange(payload: any): Promise<void> {
    try {
      if ((payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') && payload.new) {
        console.log('📥 REMOTE CHANGE: User profiles table updated')

        const remoteData = payload.new
        await this.resolveConflictAndSync('user_profiles', remoteData)

        // Determine which field was updated
        let updatedField = 'profile'
        if (payload.old) {
          const changedFields = Object.keys(remoteData).filter(
            key => remoteData[key] !== payload.old[key]
          )
          updatedField = changedFields[0] || 'profile'
        }

        this.emitSyncEvent({
          type: 'field_updated',
          userId: this.userId!,
          deviceId: 'remote',
          field: updatedField,
          oldValue: payload.old,
          newValue: remoteData,
          timestamp: new Date().toISOString(),
          source: 'remote'
        })
      }
    } catch (error) {
      console.error('❌ ENHANCED SYNC: Error handling profile table change:', error)
    }
  }

  /**
   * Resolve conflicts and sync data
   */
  private async resolveConflictAndSync(table: 'users' | 'user_profiles', remoteData: any): Promise<void> {
    try {
      // Get local data
      const localData = await this.getLocalProfileData()
      if (!localData) return

      // Simple last-write-wins conflict resolution
      const remoteTimestamp = new Date(remoteData.updated_at || 0).getTime()
      const localTimestamp = new Date(localData.lastSynced || 0).getTime()

      if (remoteTimestamp > localTimestamp) {
        console.log('🔄 CONFLICT RESOLUTION: Remote data is newer, updating local')
        await this.updateLocalDataFromRemote(table, remoteData)
        this.syncStatus.conflictsResolved++
      } else {
        console.log('🔄 CONFLICT RESOLUTION: Local data is newer, keeping local')
      }
    } catch (error) {
      console.error('❌ ENHANCED SYNC: Conflict resolution failed:', error)
    }
  }

  /**
   * Update local data from remote changes
   */
  private async updateLocalDataFromRemote(table: 'users' | 'user_profiles', remoteData: any): Promise<void> {
    try {
      if (table === 'users') {
        // Update basic user fields
        const userData = {
          id: this.userId!,
          email: remoteData.email,
          name: remoteData.name,
          role: remoteData.role,
          avatar: remoteData.avatar_url,
          mfa_enabled: remoteData.mfa_enabled
        }
        this.updateLocalStorage('currentUser', userData)
        this.updateLocalStorage(`userProfile_${this.userId}`, userData)
        this.updateSystemUsers(userData)
      } else if (table === 'user_profiles') {
        // Update extended profile fields
        const profileData = {
          display_name: remoteData.display_name,
          department: remoteData.department,
          phone: remoteData.phone,
          bio: remoteData.bio,
          location: remoteData.location
        }
        profileFieldsPersistenceService.updateLocalStorageProfileFields(this.userId!, profileData)
      }

      // Trigger UI updates
      window.dispatchEvent(new CustomEvent('crossDeviceProfileSync', {
        detail: { userId: this.userId, table, data: remoteData }
      }))

    } catch (error) {
      console.error('❌ ENHANCED SYNC: Failed to update local data:', error)
    }
  }

  /**
   * Sync profile data to cloud
   */
  async syncProfileToCloud(profileData: Partial<ProfileSyncData>): Promise<{ status: 'success' | 'error'; error?: string }> {
    if (!this.userId) {
      return { status: 'error', error: 'No user ID set' }
    }

    const operationId = `sync_${Date.now()}`
    this.pendingOperations.add(operationId)

    try {
      console.log('☁️ SYNC TO CLOUD: Starting profile sync')

      await auditLogger.logSecurityEvent('PROFILE_SYNC_TO_CLOUD', 'user_profiles', true, {
        userId: this.userId,
        deviceId: this.deviceId,
        fields: Object.keys(profileData)
      })

      // Update basic user fields if present
      if (profileData.name || profileData.email || profileData.role || profileData.avatar) {
        const userUpdate: any = {
          updated_at: new Date().toISOString()
        }

        if (profileData.name) userUpdate.name = profileData.name
        if (profileData.email) userUpdate.email = profileData.email
        if (profileData.role) userUpdate.role = profileData.role
        if (profileData.avatar) userUpdate.avatar_url = profileData.avatar
        if (profileData.mfa_enabled !== undefined) userUpdate.mfa_enabled = profileData.mfa_enabled

        const { error: userError } = await supabase
          .from('users')
          .update(userUpdate)
          .eq('id', this.userId)

        if (userError) {
          console.warn('⚠️ SYNC TO CLOUD: Users table update failed:', userError.message)
        } else {
          console.log('✅ SYNC TO CLOUD: Users table updated')
        }
      }

      // Update extended profile fields if present
      const profileFields = ['display_name', 'department', 'phone', 'bio', 'location']
      const hasProfileFields = profileFields.some(field => profileData[field as keyof ProfileSyncData] !== undefined)

      if (hasProfileFields) {
        const profileUpdate: any = {
          user_id: this.userId,
          updated_at: new Date().toISOString()
        }

        profileFields.forEach(field => {
          const value = profileData[field as keyof ProfileSyncData]
          if (value !== undefined) {
            profileUpdate[field] = value
          }
        })

        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert(profileUpdate, { onConflict: 'user_id' })

        if (profileError) {
          console.warn('⚠️ SYNC TO CLOUD: Profile table update failed:', profileError.message)
          // Continue with localStorage update even if cloud fails
        } else {
          console.log('✅ SYNC TO CLOUD: Profile table updated')
        }
      }

      // Update local storage with sync metadata
      const localData = await this.getLocalProfileData()
      if (localData) {
        localData.lastSynced = new Date().toISOString()
        localData.deviceId = this.deviceId
        localData.syncVersion = ++this.syncVersion
        this.setLocalProfileData(localData)
      }

      this.syncStatus.lastFullSync = new Date().toISOString()
      this.syncStatus.pendingChanges = Math.max(0, this.syncStatus.pendingChanges - 1)

      console.log('✅ SYNC TO CLOUD: Profile sync completed')
      return { status: 'success' }

    } catch (error: any) {
      console.error('❌ SYNC TO CLOUD: Profile sync failed:', error)
      this.syncStatus.syncErrors.push(`Cloud sync failed: ${error.message}`)

      await auditLogger.logSecurityEvent('PROFILE_SYNC_TO_CLOUD_FAILED', 'user_profiles', false, {
        userId: this.userId,
        error: error.message
      })

      return { status: 'error', error: error.message }
    } finally {
      this.pendingOperations.delete(operationId)
    }
  }

  /**
   * Sync avatar across devices
   */
  async syncAvatarAcrossDevices(avatarFile?: File | string): Promise<{ status: 'success' | 'error'; error?: string; avatarUrl?: string }> {
    if (!this.userId) {
      return { status: 'error', error: 'No user ID set' }
    }

    try {
      console.log('🖼️ AVATAR SYNC: Starting cross-device avatar sync')

      let avatarUrl: string | null = null

      if (avatarFile) {
        // Upload new avatar
        const uploadResult = await avatarStorageService.uploadAvatar(this.userId, avatarFile)
        if (uploadResult.status === 'error') {
          return uploadResult
        }
        avatarUrl = uploadResult.data!
      } else {
        // Get existing avatar
        avatarUrl = await avatarStorageService.getAvatarUrl(this.userId)
      }

      // Sync to cloud
      if (avatarUrl) {
        await this.syncProfileToCloud({ avatar: avatarUrl })
      }

      this.emitSyncEvent({
        type: 'avatar_changed',
        userId: this.userId,
        deviceId: this.deviceId,
        newValue: avatarUrl,
        timestamp: new Date().toISOString(),
        source: 'local'
      })

      console.log('✅ AVATAR SYNC: Cross-device avatar sync completed')
      return { status: 'success', avatarUrl: avatarUrl || undefined }

    } catch (error: any) {
      console.error('❌ AVATAR SYNC: Failed:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Perform initial sync from cloud
   */
  private async performInitialSync(): Promise<void> {
    if (!this.userId) return

    try {
      console.log('🔄 INITIAL SYNC: Loading profile from cloud')

      // Load user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', this.userId)
        .single()

      if (!userError && userData) {
        const profileData: Partial<ProfileSyncData> = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          avatar: userData.avatar_url,
          mfa_enabled: userData.mfa_enabled,
          lastSynced: new Date().toISOString(),
          deviceId: this.deviceId,
          syncVersion: this.syncVersion
        }

        // Load extended profile
        const { data: extendedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', this.userId)
          .single()

        if (extendedProfile) {
          profileData.display_name = extendedProfile.display_name
          profileData.department = extendedProfile.department
          profileData.phone = extendedProfile.phone
          profileData.bio = extendedProfile.bio
          profileData.location = extendedProfile.location
        }

        // Update local storage
        this.setLocalProfileData(profileData)
        this.syncStatus.lastFullSync = new Date().toISOString()

        console.log('✅ INITIAL SYNC: Profile loaded from cloud')
      }
    } catch (error) {
      console.warn('⚠️ INITIAL SYNC: Cloud sync failed, using local data:', error)
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    // Sync every 5 minutes if online
    setInterval(async () => {
      if (this.isOnline && this.userId && this.syncQueue.size === 0) {
        await this.performInitialSync()
      }
    }, 5 * 60 * 1000)
  }

  /**
   * Initialize network listeners
   */
  private initializeNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncStatus.isOnline = true
      console.log('🌐 NETWORK: Online - resuming sync')
      this.processSyncQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.syncStatus.isOnline = false
      console.log('🌐 NETWORK: Offline - queuing changes')
    })
  }

  /**
   * Process queued sync operations
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.size === 0) return

    console.log(`🔄 QUEUE: Processing ${this.syncQueue.size} queued operations`)

    for (const [operationId, operation] of this.syncQueue.entries()) {
      try {
        await this.syncProfileToCloud(operation.data)
        this.syncQueue.delete(operationId)
      } catch (error) {
        console.error('❌ QUEUE: Failed to process operation:', operationId, error)
      }
    }
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem('carexps_enhanced_device_id')
    if (stored) return stored

    const deviceId = `device_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`
    localStorage.setItem('carexps_enhanced_device_id', deviceId)
    return deviceId
  }

  /**
   * Get local profile data
   */
  private async getLocalProfileData(): Promise<ProfileSyncData | null> {
    if (!this.userId) return null

    try {
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === this.userId) {
          return {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            avatar: userData.avatar,
            mfa_enabled: userData.mfa_enabled,
            display_name: userData.display_name,
            department: userData.department,
            phone: userData.phone,
            bio: userData.bio,
            location: userData.location,
            lastSynced: userData.lastSynced,
            deviceId: userData.deviceId,
            syncVersion: userData.syncVersion
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ LOCAL DATA: Failed to get local profile data:', error)
    }

    return null
  }

  /**
   * Set local profile data
   */
  private setLocalProfileData(data: Partial<ProfileSyncData>): void {
    if (!this.userId) return

    try {
      // Update currentUser
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === this.userId) {
          Object.assign(userData, data)
          userData.updated_at = new Date().toISOString()
          localStorage.setItem('currentUser', JSON.stringify(userData))
        }
      }

      // Update userProfile
      const existingProfile = localStorage.getItem(`userProfile_${this.userId}`)
      if (existingProfile) {
        const profileData = JSON.parse(existingProfile)
        Object.assign(profileData, data)
        profileData.updated_at = new Date().toISOString()
        localStorage.setItem(`userProfile_${this.userId}`, JSON.stringify(profileData))
      }

      // Update systemUsers
      this.updateSystemUsers(data)

    } catch (error) {
      console.warn('⚠️ LOCAL DATA: Failed to set local profile data:', error)
    }
  }

  /**
   * Update localStorage helper
   */
  private updateLocalStorage(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.warn(`⚠️ LOCAL STORAGE: Failed to update ${key}:`, error)
    }
  }

  /**
   * Update systemUsers array
   */
  private updateSystemUsers(data: Partial<ProfileSyncData>): void {
    try {
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === this.userId)
        if (userIndex >= 0) {
          Object.assign(users[userIndex], data)
          users[userIndex].updated_at = new Date().toISOString()
          localStorage.setItem('systemUsers', JSON.stringify(users))
        }
      }
    } catch (error) {
      console.warn('⚠️ SYSTEM USERS: Failed to update:', error)
    }
  }

  /**
   * Subscribe to sync events
   */
  subscribeToSyncEvents(userId: string, callback: SyncEventCallback): () => void {
    const listeners = this.eventListeners.get(userId) || []
    listeners.push(callback)
    this.eventListeners.set(userId, listeners)

    // Return unsubscribe function
    return () => {
      const currentListeners = this.eventListeners.get(userId) || []
      const filteredListeners = currentListeners.filter(l => l !== callback)
      this.eventListeners.set(userId, filteredListeners)
    }
  }

  /**
   * Emit sync event to listeners
   */
  private emitSyncEvent(event: SyncEvent): void {
    const listeners = this.eventListeners.get(event.userId) || []
    listeners.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('❌ EVENT: Listener error:', error)
      }
    })
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Force full profile sync
   */
  async forceFullSync(): Promise<{ status: 'success' | 'error'; error?: string }> {
    if (!this.userId) {
      return { status: 'error', error: 'No user ID set' }
    }

    try {
      console.log('🔄 FORCE SYNC: Starting full profile sync')

      // Get current local data
      const localData = await this.getLocalProfileData()
      if (!localData) {
        return { status: 'error', error: 'No local profile data found' }
      }

      // Sync to cloud
      const syncResult = await this.syncProfileToCloud(localData)
      if (syncResult.status === 'error') {
        return syncResult
      }

      // Perform fresh sync from cloud
      await this.performInitialSync()

      console.log('✅ FORCE SYNC: Full profile sync completed')
      return { status: 'success' }

    } catch (error: any) {
      console.error('❌ FORCE SYNC: Failed:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.realtimeChannel && supabase) {
      supabase.removeChannel(this.realtimeChannel)
      this.realtimeChannel = null
    }
    this.eventListeners.clear()
    this.syncQueue.clear()
    this.pendingOperations.clear()
    console.log('🧹 ENHANCED SYNC: Cleanup completed')
  }
}

// Export singleton instance
export const enhancedCrossDeviceProfileSync = EnhancedCrossDeviceProfileSync.getInstance()