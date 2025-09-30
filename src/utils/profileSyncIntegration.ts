import { enhancedCrossDeviceProfileSync } from '@/services/enhancedCrossDeviceProfileSync'
import { userProfileService } from '@/services/userProfileService'
import { avatarStorageService } from '@/services/avatarStorageService'
import { profileFieldsPersistenceService } from '@/services/profileFieldsPersistenceService'
import { auditLogger } from '@/services/auditLogger'

/**
 * Profile Sync Integration Utility
 *
 * Provides high-level integration functions for cross-device profile synchronization
 * that can be easily used throughout the application. This utility ensures consistent
 * behavior and proper error handling across all profile-related operations.
 */

export interface ProfileSyncIntegrationOptions {
  enableRealtime?: boolean
  enableOfflineFallback?: boolean
  autoRetry?: boolean
  retryInterval?: number
  maxRetries?: number
}

export interface ProfileSyncResult {
  success: boolean
  message: string
  data?: any
  warnings?: string[]
  errors?: string[]
}

export class ProfileSyncIntegration {
  private static initialized = false
  private static currentUserId: string | null = null
  private static options: ProfileSyncIntegrationOptions = {
    enableRealtime: true,
    enableOfflineFallback: true,
    autoRetry: true,
    retryInterval: 5000,
    maxRetries: 3
  }

  /**
   * Initialize profile sync integration for a user
   */
  static async initialize(
    userId: string,
    options: ProfileSyncIntegrationOptions = {}
  ): Promise<ProfileSyncResult> {
    try {
      console.log('🔄 PROFILE INTEGRATION: Initializing for user:', userId)

      this.currentUserId = userId
      this.options = { ...this.options, ...options }

      await auditLogger.logSecurityEvent('PROFILE_SYNC_INTEGRATION_INIT', 'system', true, {
        userId,
        options: this.options
      })

      // Initialize the enhanced sync service
      const syncResult = await enhancedCrossDeviceProfileSync.initialize(userId)
      if (syncResult.status !== 'success') {
        throw new Error(`Sync service initialization failed: ${syncResult.error}`)
      }

      // Initialize avatar service
      await avatarStorageService.initialize()

      // Validate existing profile data
      const validationResult = await this.validateProfileData(userId)
      if (!validationResult.success) {
        console.warn('⚠️ PROFILE INTEGRATION: Profile validation issues detected:', validationResult.warnings)
      }

      this.initialized = true

      console.log('✅ PROFILE INTEGRATION: Initialization complete')
      return {
        success: true,
        message: 'Profile sync integration initialized successfully',
        data: {
          userId,
          deviceId: enhancedCrossDeviceProfileSync.getSyncStatus().deviceId,
          options: this.options
        },
        warnings: validationResult.warnings
      }

    } catch (error: any) {
      console.error('❌ PROFILE INTEGRATION: Initialization failed:', error)

      await auditLogger.logSecurityEvent('PROFILE_SYNC_INTEGRATION_INIT_FAILED', 'system', false, {
        userId,
        error: error.message
      })

      return {
        success: false,
        message: `Profile sync initialization failed: ${error.message}`,
        errors: [error.message]
      }
    }
  }

  /**
   * Update user profile with full cross-device sync
   */
  static async updateUserProfile(
    userId: string,
    profileUpdates: {
      name?: string
      display_name?: string
      department?: string
      phone?: string
      bio?: string
      location?: string
    }
  ): Promise<ProfileSyncResult> {
    try {
      if (!this.initialized || this.currentUserId !== userId) {
        const initResult = await this.initialize(userId)
        if (!initResult.success) {
          return initResult
        }
      }

      console.log('📝 PROFILE INTEGRATION: Updating profile for user:', userId)

      await auditLogger.logSecurityEvent('PROFILE_UPDATE_START', 'user_profiles', true, {
        userId,
        fields: Object.keys(profileUpdates)
      })

      const warnings: string[] = []
      const errors: string[] = []

      // Update via enhanced sync service (primary method)
      const syncResult = await enhancedCrossDeviceProfileSync.syncProfileToCloud(profileUpdates as any)

      if (syncResult.status === 'success') {
        console.log('✅ PROFILE INTEGRATION: Enhanced sync completed successfully')
      } else {
        warnings.push(`Enhanced sync failed: ${syncResult.error}`)
        console.warn('⚠️ PROFILE INTEGRATION: Enhanced sync failed, using fallback methods')

        // Fallback to direct profile service
        try {
          const fallbackResult = await userProfileService.updateUserProfile(userId, profileUpdates)
          if (fallbackResult.status === 'success') {
            console.log('✅ PROFILE INTEGRATION: Fallback profile service succeeded')
          } else {
            errors.push(`Profile service fallback failed: ${fallbackResult.error}`)
          }
        } catch (fallbackError: any) {
          errors.push(`Profile service fallback error: ${fallbackError.message}`)
        }

        // Fallback to direct persistence service
        try {
          const persistenceResult = await profileFieldsPersistenceService.saveProfileFieldsComplete(userId, profileUpdates)
          if (persistenceResult.status === 'success') {
            console.log('✅ PROFILE INTEGRATION: Fallback persistence service succeeded')
          } else {
            errors.push(`Persistence service fallback failed: ${persistenceResult.error}`)
          }
        } catch (persistenceError: any) {
          errors.push(`Persistence service fallback error: ${persistenceError.message}`)
        }
      }

      // Trigger UI updates
      window.dispatchEvent(new CustomEvent('profileSyncIntegrationUpdate', {
        detail: { userId, updates: profileUpdates }
      }))

      await auditLogger.logSecurityEvent('PROFILE_UPDATE_COMPLETE', 'user_profiles', true, {
        userId,
        success: errors.length === 0,
        warningsCount: warnings.length,
        errorsCount: errors.length
      })

      const success = errors.length === 0
      return {
        success,
        message: success
          ? 'Profile updated and synchronized across devices'
          : 'Profile update completed with some errors',
        data: profileUpdates,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error: any) {
      console.error('❌ PROFILE INTEGRATION: Profile update failed:', error)

      await auditLogger.logSecurityEvent('PROFILE_UPDATE_FAILED', 'user_profiles', false, {
        userId,
        error: error.message
      })

      return {
        success: false,
        message: `Profile update failed: ${error.message}`,
        errors: [error.message]
      }
    }
  }

  /**
   * Upload and sync avatar across devices
   */
  static async updateUserAvatar(
    userId: string,
    avatarFile: File | string
  ): Promise<ProfileSyncResult> {
    try {
      if (!this.initialized || this.currentUserId !== userId) {
        const initResult = await this.initialize(userId)
        if (!initResult.success) {
          return initResult
        }
      }

      console.log('🖼️ PROFILE INTEGRATION: Uploading avatar for user:', userId)

      await auditLogger.logSecurityEvent('AVATAR_UPDATE_START', 'users', true, {
        userId,
        fileType: typeof avatarFile === 'string' ? 'base64' : avatarFile.type
      })

      const warnings: string[] = []
      const errors: string[] = []
      let avatarUrl: string | undefined

      // Primary method: Enhanced sync service
      const syncResult = await enhancedCrossDeviceProfileSync.syncAvatarAcrossDevices(avatarFile)

      if (syncResult.status === 'success') {
        avatarUrl = syncResult.avatarUrl
        console.log('✅ PROFILE INTEGRATION: Enhanced avatar sync completed successfully')
      } else {
        warnings.push(`Enhanced avatar sync failed: ${syncResult.error}`)
        console.warn('⚠️ PROFILE INTEGRATION: Enhanced avatar sync failed, using fallback')

        // Fallback to direct avatar service
        try {
          const uploadResult = await avatarStorageService.uploadAvatar(userId, avatarFile)
          if (uploadResult.status === 'success') {
            avatarUrl = uploadResult.data
            console.log('✅ PROFILE INTEGRATION: Fallback avatar service succeeded')
          } else {
            errors.push(`Avatar service fallback failed: ${uploadResult.error}`)
          }
        } catch (avatarError: any) {
          errors.push(`Avatar service fallback error: ${avatarError.message}`)
        }
      }

      // Update profile with new avatar URL
      if (avatarUrl) {
        try {
          const profileResult = await this.updateUserProfile(userId, {})
          if (!profileResult.success && profileResult.errors) {
            warnings.push('Avatar uploaded but profile update had issues')
          }
        } catch (profileError: any) {
          warnings.push(`Avatar uploaded but profile update failed: ${profileError.message}`)
        }
      }

      // Trigger UI updates
      window.dispatchEvent(new CustomEvent('avatarSyncIntegrationUpdate', {
        detail: { userId, avatarUrl }
      }))

      await auditLogger.logSecurityEvent('AVATAR_UPDATE_COMPLETE', 'users', true, {
        userId,
        success: errors.length === 0,
        avatarUrl: avatarUrl || 'none'
      })

      const success = errors.length === 0 && avatarUrl !== undefined
      return {
        success,
        message: success
          ? 'Avatar uploaded and synchronized across devices'
          : 'Avatar update completed with some errors',
        data: { avatarUrl },
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error: any) {
      console.error('❌ PROFILE INTEGRATION: Avatar update failed:', error)

      await auditLogger.logSecurityEvent('AVATAR_UPDATE_FAILED', 'users', false, {
        userId,
        error: error.message
      })

      return {
        success: false,
        message: `Avatar update failed: ${error.message}`,
        errors: [error.message]
      }
    }
  }

  /**
   * Load complete user profile from all sources
   */
  static async loadUserProfile(userId: string): Promise<ProfileSyncResult> {
    try {
      console.log('📥 PROFILE INTEGRATION: Loading profile for user:', userId)

      const warnings: string[] = []
      let profileData: any = null

      // Try enhanced sync service first
      if (this.initialized && this.currentUserId === userId) {
        try {
          const syncStatus = enhancedCrossDeviceProfileSync.getSyncStatus()
          if (syncStatus.isOnline) {
            const forceResult = await enhancedCrossDeviceProfileSync.forceFullSync()
            if (forceResult.status === 'success') {
              console.log('✅ PROFILE INTEGRATION: Enhanced sync loaded fresh data')
            } else {
              warnings.push(`Enhanced sync failed: ${forceResult.error}`)
            }
          }
        } catch (syncError: any) {
          warnings.push(`Enhanced sync error: ${syncError.message}`)
        }
      }

      // Load from user profile service
      const profileResult = await userProfileService.loadUserProfile(userId)
      if (profileResult.status === 'success' && profileResult.data) {
        profileData = profileResult.data
        console.log('✅ PROFILE INTEGRATION: Loaded profile from user profile service')
      } else {
        warnings.push(`User profile service failed: ${profileResult.error}`)
      }

      // Enhance with extended profile fields
      try {
        const extendedResult = await profileFieldsPersistenceService.loadProfileFieldsComplete(userId)
        if (extendedResult.status === 'success' && extendedResult.data) {
          profileData = { ...profileData, ...extendedResult.data }
          console.log('✅ PROFILE INTEGRATION: Enhanced with extended profile fields')
        } else {
          warnings.push(`Extended profile fields failed: ${extendedResult.error}`)
        }
      } catch (extendedError: any) {
        warnings.push(`Extended profile fields error: ${extendedError.message}`)
      }

      // Load avatar
      try {
        const avatarUrl = await avatarStorageService.getAvatarUrl(userId)
        if (avatarUrl) {
          profileData = { ...profileData, avatar: avatarUrl }
          console.log('✅ PROFILE INTEGRATION: Loaded avatar')
        }
      } catch (avatarError: any) {
        warnings.push(`Avatar loading error: ${avatarError.message}`)
      }

      if (!profileData) {
        throw new Error('No profile data could be loaded from any source')
      }

      return {
        success: true,
        message: 'Profile loaded successfully',
        data: profileData,
        warnings: warnings.length > 0 ? warnings : undefined
      }

    } catch (error: any) {
      console.error('❌ PROFILE INTEGRATION: Profile loading failed:', error)

      return {
        success: false,
        message: `Profile loading failed: ${error.message}`,
        errors: [error.message]
      }
    }
  }

  /**
   * Force full synchronization from cloud
   */
  static async forceSyncFromCloud(userId: string): Promise<ProfileSyncResult> {
    try {
      if (!this.initialized || this.currentUserId !== userId) {
        const initResult = await this.initialize(userId)
        if (!initResult.success) {
          return initResult
        }
      }

      console.log('🔄 PROFILE INTEGRATION: Force syncing from cloud for user:', userId)

      await auditLogger.logSecurityEvent('FORCE_SYNC_START', 'system', true, { userId })

      const warnings: string[] = []

      // Force sync via enhanced service
      const syncResult = await enhancedCrossDeviceProfileSync.forceFullSync()
      if (syncResult.status !== 'success') {
        warnings.push(`Enhanced sync failed: ${syncResult.error}`)
      }

      // Force sync avatar
      try {
        const avatarResult = await avatarStorageService.syncAvatarAcrossDevices(userId)
        if (avatarResult.status !== 'success') {
          warnings.push(`Avatar sync failed: ${avatarResult.error}`)
        }
      } catch (avatarError: any) {
        warnings.push(`Avatar sync error: ${avatarError.message}`)
      }

      // Reload profile data
      const loadResult = await this.loadUserProfile(userId)
      if (!loadResult.success) {
        warnings.push('Profile reload after sync had issues')
      }

      // Trigger UI refresh
      window.dispatchEvent(new CustomEvent('forceSyncComplete', {
        detail: { userId }
      }))

      await auditLogger.logSecurityEvent('FORCE_SYNC_COMPLETE', 'system', true, {
        userId,
        warnings: warnings.length
      })

      return {
        success: true,
        message: 'Force sync completed',
        data: loadResult.data,
        warnings: warnings.length > 0 ? warnings : undefined
      }

    } catch (error: any) {
      console.error('❌ PROFILE INTEGRATION: Force sync failed:', error)

      await auditLogger.logSecurityEvent('FORCE_SYNC_FAILED', 'system', false, {
        userId,
        error: error.message
      })

      return {
        success: false,
        message: `Force sync failed: ${error.message}`,
        errors: [error.message]
      }
    }
  }

  /**
   * Get sync status and health information
   */
  static getSyncStatus(): {
    initialized: boolean
    userId: string | null
    isOnline: boolean
    realtimeConnected: boolean
    lastSync: Date | null
    deviceId: string
    pendingChanges: number
    healthStatus: 'healthy' | 'warning' | 'error'
  } {
    if (!this.initialized) {
      return {
        initialized: false,
        userId: null,
        isOnline: false,
        realtimeConnected: false,
        lastSync: null,
        deviceId: '',
        pendingChanges: 0,
        healthStatus: 'error'
      }
    }

    const syncStatus = enhancedCrossDeviceProfileSync.getSyncStatus()

    let healthStatus: 'healthy' | 'warning' | 'error' = 'healthy'
    if (!syncStatus.isOnline) {
      healthStatus = 'warning'
    } else if (syncStatus.syncErrors.length > 0) {
      healthStatus = 'error'
    } else if (!syncStatus.isRealtimeConnected) {
      healthStatus = 'warning'
    }

    return {
      initialized: this.initialized,
      userId: this.currentUserId,
      isOnline: syncStatus.isOnline,
      realtimeConnected: syncStatus.isRealtimeConnected,
      lastSync: syncStatus.lastFullSync ? new Date(syncStatus.lastFullSync) : null,
      deviceId: syncStatus.deviceId,
      pendingChanges: syncStatus.pendingChanges,
      healthStatus
    }
  }

  /**
   * Validate profile data integrity
   */
  private static async validateProfileData(userId: string): Promise<ProfileSyncResult> {
    try {
      const warnings: string[] = []

      // Check localStorage consistency
      const currentUser = localStorage.getItem('currentUser')
      const userProfile = localStorage.getItem(`userProfile_${userId}`)

      if (!currentUser) {
        warnings.push('currentUser not found in localStorage')
      }

      if (!userProfile) {
        warnings.push('userProfile not found in localStorage')
      }

      if (currentUser && userProfile) {
        try {
          const currentUserData = JSON.parse(currentUser)
          const userProfileData = JSON.parse(userProfile)

          if (currentUserData.id !== userProfileData.id) {
            warnings.push('User ID mismatch between currentUser and userProfile')
          }

          if (currentUserData.email !== userProfileData.email) {
            warnings.push('Email mismatch between storage locations')
          }
        } catch (parseError) {
          warnings.push('Failed to parse localStorage data')
        }
      }

      return {
        success: warnings.length === 0,
        message: warnings.length === 0 ? 'Profile data validation passed' : 'Profile data validation found issues',
        warnings: warnings.length > 0 ? warnings : undefined
      }

    } catch (error: any) {
      return {
        success: false,
        message: `Profile validation failed: ${error.message}`,
        errors: [error.message]
      }
    }
  }

  /**
   * Cleanup integration resources
   */
  static cleanup(): void {
    if (this.initialized) {
      enhancedCrossDeviceProfileSync.cleanup()
      this.initialized = false
      this.currentUserId = null
      console.log('🧹 PROFILE INTEGRATION: Cleanup completed')
    }
  }
}

// Export for easy access
export const profileSyncIntegration = ProfileSyncIntegration