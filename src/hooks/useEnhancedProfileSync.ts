import { useState, useEffect, useCallback, useRef } from 'react'
import { enhancedCrossDeviceProfileSync, ProfileSyncData, SyncStatus, SyncEvent } from '@/services/enhancedCrossDeviceProfileSync'

/**
 * Enhanced Profile Sync Hook
 *
 * Provides React integration for cross-device profile synchronization with:
 * - Real-time profile updates
 * - Automatic conflict resolution
 * - Offline/online state management
 * - Error handling and retry logic
 * - HIPAA-compliant audit logging
 */

export interface UseEnhancedProfileSyncOptions {
  userId: string
  autoSync?: boolean
  syncInterval?: number
  enableRealtime?: boolean
}

export interface UseEnhancedProfileSyncResult {
  // Profile data
  profileData: ProfileSyncData | null
  isLoading: boolean
  error: string | null

  // Sync status
  syncStatus: SyncStatus
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null

  // Operations
  updateProfile: (updates: Partial<ProfileSyncData>) => Promise<{ success: boolean; error?: string }>
  uploadAvatar: (file: File | string) => Promise<{ success: boolean; error?: string; avatarUrl?: string }>
  forceSync: () => Promise<{ success: boolean; error?: string }>
  clearError: () => void

  // Real-time events
  syncEvents: SyncEvent[]
  clearSyncEvents: () => void
}

export function useEnhancedProfileSync(options: UseEnhancedProfileSyncOptions): UseEnhancedProfileSyncResult {
  const { userId, autoSync = true, syncInterval = 30000, enableRealtime = true } = options

  // State
  const [profileData, setProfileData] = useState<ProfileSyncData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isRealtimeConnected: false,
    lastFullSync: null,
    pendingChanges: 0,
    conflictsResolved: 0,
    deviceId: '',
    syncErrors: []
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([])

  // Refs for stable callbacks
  const syncServiceRef = useRef(enhancedCrossDeviceProfileSync)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Initialize sync service and load profile data
   */
  const initializeSync = useCallback(async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      setError(null)

      console.log('🔄 PROFILE HOOK: Initializing enhanced sync for user:', userId)

      // Initialize the sync service
      const initResult = await syncServiceRef.current.initialize(userId)
      if (initResult.status === 'error') {
        throw new Error(initResult.error)
      }

      // Load initial profile data
      await loadProfileData()

      // Subscribe to real-time events if enabled
      if (enableRealtime) {
        unsubscribeRef.current = syncServiceRef.current.subscribeToSyncEvents(userId, handleSyncEvent)
      }

      // Start auto-sync if enabled
      if (autoSync && syncInterval > 0) {
        syncIntervalRef.current = setInterval(async () => {
          if (!isSyncing) {
            await performAutoSync()
          }
        }, syncInterval)
      }

      console.log('✅ PROFILE HOOK: Enhanced sync initialization completed')

    } catch (err: any) {
      console.error('❌ PROFILE HOOK: Initialization failed:', err)
      setError(err.message || 'Failed to initialize profile sync')
    } finally {
      setIsLoading(false)
    }
  }, [userId, enableRealtime, autoSync, syncInterval])

  /**
   * Load profile data from local storage and sync status
   */
  const loadProfileData = useCallback(async () => {
    try {
      // Load from localStorage first for immediate display
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === userId) {
          setProfileData({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            avatar: userData.avatar,
            mfa_enabled: userData.mfa_enabled,
            display_name: userData.display_name || userData.name,
            department: userData.department || '',
            phone: userData.phone || '',
            bio: userData.bio || '',
            location: userData.location || '',
            lastSynced: userData.lastSynced,
            deviceId: userData.deviceId,
            syncVersion: userData.syncVersion
          })
        }
      }

      // Update sync status
      setSyncStatus(syncServiceRef.current.getSyncStatus())

    } catch (err: any) {
      console.error('❌ PROFILE HOOK: Failed to load profile data:', err)
      setError(err.message || 'Failed to load profile data')
    }
  }, [userId])

  /**
   * Handle sync events from the service
   */
  const handleSyncEvent = useCallback((event: SyncEvent) => {
    console.log('📡 PROFILE HOOK: Received sync event:', event.type)

    // Add to event history
    setSyncEvents(prev => [event, ...prev.slice(0, 9)]) // Keep last 10 events

    // Update profile data based on event
    if (event.type === 'profile_updated' && event.newValue) {
      setProfileData(prev => ({
        ...prev,
        ...event.newValue,
        lastSynced: event.timestamp
      }))
    } else if (event.type === 'avatar_changed') {
      setProfileData(prev => prev ? {
        ...prev,
        avatar: event.newValue,
        lastSynced: event.timestamp
      } : null)
    } else if (event.type === 'field_updated' && event.field && event.newValue !== undefined) {
      setProfileData(prev => prev ? {
        ...prev,
        [event.field!]: event.newValue,
        lastSynced: event.timestamp
      } : null)
    } else if (event.type === 'sync_status') {
      setSyncStatus(event.newValue)
    }
  }, [])

  /**
   * Perform automatic sync
   */
  const performAutoSync = useCallback(async () => {
    try {
      if (!syncStatus.isOnline) return

      const syncResult = await syncServiceRef.current.forceFullSync()
      if (syncResult.status === 'success') {
        await loadProfileData()
      }
    } catch (err) {
      console.warn('⚠️ PROFILE HOOK: Auto-sync failed:', err)
    }
  }, [syncStatus.isOnline, loadProfileData])

  /**
   * Update profile data
   */
  const updateProfile = useCallback(async (updates: Partial<ProfileSyncData>): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsSyncing(true)
      setError(null)

      console.log('📝 PROFILE HOOK: Updating profile with:', Object.keys(updates))

      // Update local state immediately
      setProfileData(prev => prev ? { ...prev, ...updates } : null)

      // Sync to cloud
      const syncResult = await syncServiceRef.current.syncProfileToCloud(updates)
      if (syncResult.status === 'error') {
        // Revert local changes on error
        await loadProfileData()
        setError(syncResult.error!)
        return { success: false, error: syncResult.error }
      }

      // Update sync status
      setSyncStatus(syncServiceRef.current.getSyncStatus())

      console.log('✅ PROFILE HOOK: Profile update completed')
      return { success: true }

    } catch (err: any) {
      console.error('❌ PROFILE HOOK: Profile update failed:', err)
      await loadProfileData() // Revert on error
      const errorMessage = err.message || 'Failed to update profile'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsSyncing(false)
    }
  }, [loadProfileData])

  /**
   * Upload avatar
   */
  const uploadAvatar = useCallback(async (file: File | string): Promise<{ success: boolean; error?: string; avatarUrl?: string }> => {
    try {
      setIsSyncing(true)
      setError(null)

      console.log('🖼️ PROFILE HOOK: Uploading avatar')

      const result = await syncServiceRef.current.syncAvatarAcrossDevices(file)
      if (result.status === 'error') {
        setError(result.error!)
        return { success: false, error: result.error }
      }

      // Update local profile data
      if (result.avatarUrl) {
        setProfileData(prev => prev ? {
          ...prev,
          avatar: result.avatarUrl,
          lastSynced: new Date().toISOString()
        } : null)
      }

      // Update sync status
      setSyncStatus(syncServiceRef.current.getSyncStatus())

      console.log('✅ PROFILE HOOK: Avatar upload completed')
      return { success: true, avatarUrl: result.avatarUrl }

    } catch (err: any) {
      console.error('❌ PROFILE HOOK: Avatar upload failed:', err)
      const errorMessage = err.message || 'Failed to upload avatar'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsSyncing(false)
    }
  }, [])

  /**
   * Force full sync
   */
  const forceSync = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsSyncing(true)
      setError(null)

      console.log('🔄 PROFILE HOOK: Force syncing profile')

      const syncResult = await syncServiceRef.current.forceFullSync()
      if (syncResult.status === 'error') {
        setError(syncResult.error!)
        return { success: false, error: syncResult.error }
      }

      // Reload profile data
      await loadProfileData()

      console.log('✅ PROFILE HOOK: Force sync completed')
      return { success: true }

    } catch (err: any) {
      console.error('❌ PROFILE HOOK: Force sync failed:', err)
      const errorMessage = err.message || 'Failed to sync profile'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsSyncing(false)
    }
  }, [loadProfileData])

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Clear sync events
   */
  const clearSyncEvents = useCallback(() => {
    setSyncEvents([])
  }, [])

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      initializeSync()
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }

      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [userId, initializeSync])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }))
    }

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Computed values
  const lastSyncTime = syncStatus.lastFullSync ? new Date(syncStatus.lastFullSync) : null
  const isOnline = syncStatus.isOnline

  return {
    // Profile data
    profileData,
    isLoading,
    error,

    // Sync status
    syncStatus,
    isOnline,
    isSyncing,
    lastSyncTime,

    // Operations
    updateProfile,
    uploadAvatar,
    forceSync,
    clearError,

    // Real-time events
    syncEvents,
    clearSyncEvents
  }
}