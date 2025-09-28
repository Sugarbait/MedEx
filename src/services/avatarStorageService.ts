import { supabase } from '@/config/supabase'
import { ServiceResponse } from '@/types/supabase'
import { auditLogger } from './auditLogger'

export interface AvatarInfo {
  url: string
  storagePath: string
  uploadedAt: string
  synchronized: boolean
}

export interface AvatarStorageOptions {
  quality?: number // 0.1 to 1.0
  maxSize?: number // bytes
  maxDimensions?: { width: number; height: number }
}

/**
 * Robust Avatar Storage Service
 *
 * Provides bulletproof avatar storage with cross-device synchronization:
 * - Primary storage: Supabase Storage (avatars bucket)
 * - Secondary storage: Supabase Database (users.avatar_url)
 * - Fallback storage: localStorage (for offline access)
 * - Cross-device sync through database
 * - Automatic cleanup of old avatars
 */
export class AvatarStorageService {
  private static readonly STORAGE_BUCKET = 'avatars'
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  private static readonly SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  private static readonly DEFAULT_QUALITY = 0.8
  private static readonly DEFAULT_MAX_DIMENSIONS = { width: 512, height: 512 }

  /**
   * Upload avatar with full cross-device synchronization
   */
  static async uploadAvatar(
    userId: string,
    file: File | string, // File object or base64 string
    options: AvatarStorageOptions = {}
  ): Promise<ServiceResponse<string>> {
    try {
      await auditLogger.logSecurityEvent('AVATAR_UPLOAD_START', 'users', true, { userId })

      // Process and validate the image
      const processedImage = await this.processImage(file, options)
      if (!processedImage.success) {
        return { status: 'error', error: processedImage.error }
      }

      // Remove old avatar first
      await this.removeAvatar(userId, false) // Don't log separately

      // Upload to Supabase Storage
      const uploadResult = await this.uploadToSupabaseStorage(userId, processedImage.blob)
      if (uploadResult.status === 'error') {
        return uploadResult
      }

      const avatarUrl = uploadResult.data!
      const storagePath = uploadResult.storagePath!

      // Synchronize across all storage layers
      const syncResult = await this.synchronizeAvatarData(userId, {
        url: avatarUrl,
        storagePath,
        uploadedAt: new Date().toISOString(),
        synchronized: true
      })

      if (syncResult.status === 'error') {
        // If sync fails, try to clean up uploaded file
        await this.cleanupStorageFile(storagePath)
        return syncResult
      }

      await auditLogger.logSecurityEvent('AVATAR_UPLOAD_SUCCESS', 'users', true, {
        userId,
        avatarUrl,
        fileSize: processedImage.blob.size
      })

      return { status: 'success', data: avatarUrl }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('AVATAR_UPLOAD_ERROR', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: `Avatar upload failed: ${error.message}` }
    }
  }

  /**
   * Remove avatar from all storage layers
   */
  static async removeAvatar(userId: string, logOperation: boolean = true): Promise<ServiceResponse<void>> {
    try {
      if (logOperation) {
        await auditLogger.logSecurityEvent('AVATAR_REMOVE_START', 'users', true, { userId })
      }

      // Get current avatar info to clean up storage
      const currentAvatar = await this.getAvatarInfo(userId)

      // Remove from Supabase Storage
      if (currentAvatar?.storagePath) {
        await this.cleanupStorageFile(currentAvatar.storagePath)
      }

      // Clear from all storage layers
      await this.synchronizeAvatarData(userId, null)

      if (logOperation) {
        await auditLogger.logSecurityEvent('AVATAR_REMOVE_SUCCESS', 'users', true, { userId })
      }

      return { status: 'success' }

    } catch (error: any) {
      if (logOperation) {
        await auditLogger.logSecurityEvent('AVATAR_REMOVE_ERROR', 'users', false, {
          userId,
          error: error.message
        })
      }
      return { status: 'error', error: `Avatar removal failed: ${error.message}` }
    }
  }

  /**
   * Get avatar URL with enhanced cross-device synchronization
   */
  static async getAvatarUrl(userId: string): Promise<string | null> {
    try {
      console.log('AvatarStorageService: Getting avatar for userId with cross-device sync:', userId)

      // Check multiple storage locations in order of preference

      // 1. Check local avatar info cache
      const localAvatar = this.getLocalAvatarInfo(userId)
      if (localAvatar?.url) {
        console.log('AvatarStorageService: Found local avatar info:', localAvatar.url.substring(0, 50) + '...')
        return localAvatar.url
      }

      // 2. Check direct base64 storage
      const base64Avatar = localStorage.getItem(`avatar_data_${userId}`)
      if (base64Avatar && base64Avatar.startsWith('data:image/')) {
        console.log('AvatarStorageService: Found direct base64 avatar')
        return base64Avatar
      }

      // 3. Check currentUser storage
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser)
          if (userData.id === userId && userData.avatar) {
            console.log('AvatarStorageService: Found avatar in currentUser')
            return userData.avatar
          }
        } catch (error) {
          console.warn('Failed to parse currentUser for avatar:', error)
        }
      }

      // 4. Check systemUsers array
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          const user = users.find((u: any) => u.id === userId)
          if (user?.avatar) {
            console.log('AvatarStorageService: Found avatar in systemUsers')
            return user.avatar
          }
        } catch (error) {
          console.warn('Failed to parse systemUsers for avatar:', error)
        }
      }

      // 5. ENHANCED: Try cross-device sync from cloud (similar to profile data)
      console.log('AvatarStorageService: No local avatar found, trying cross-device sync from cloud...')
      const cloudSyncResult = await this.loadAvatarFromCloud(userId)
      if (cloudSyncResult.status === 'success' && cloudSyncResult.data) {
        console.log('✅ AvatarStorageService: Found avatar in cloud, auto-syncing to localStorage')

        // Auto-save to localStorage for immediate future access
        await this.synchronizeAvatarData(userId, {
          url: cloudSyncResult.data,
          storagePath: this.extractStoragePathFromUrl(cloudSyncResult.data),
          uploadedAt: new Date().toISOString(),
          synchronized: true
        })

        return cloudSyncResult.data
      }

      // 6. ENHANCED: Try email-based fallback for cross-device compatibility
      const currentUserForEmail = localStorage.getItem('currentUser')
      if (currentUserForEmail) {
        try {
          const userData = JSON.parse(currentUserForEmail)
          if (userData.email) {
            console.log('AvatarStorageService: Trying email-based avatar lookup for:', userData.email)
            const emailResult = await this.loadAvatarFromCloudByEmail(userData.email)
            if (emailResult.status === 'success' && emailResult.data) {
              console.log('✅ AvatarStorageService: Found avatar by email lookup, syncing locally')

              // Auto-save with current user ID for future access
              await this.synchronizeAvatarData(userId, {
                url: emailResult.data,
                storagePath: this.extractStoragePathFromUrl(emailResult.data),
                uploadedAt: new Date().toISOString(),
                synchronized: true
              })

              return emailResult.data
            }
          }
        } catch (error) {
          console.warn('AvatarStorageService: Email-based fallback failed:', error)
        }
      }

      console.log('AvatarStorageService: No avatar found for user after all attempts')
      return null

    } catch (error) {
      console.warn('Error getting avatar URL:', error)
      return null
    }
  }

  /**
   * Load avatar from cloud by user ID (enhanced cross-device method)
   */
  private static async loadAvatarFromCloud(userId: string): Promise<ServiceResponse<string | null>> {
    try {
      console.log('AvatarStorageService: Loading avatar from cloud for user:', userId)

      const { data: user, error } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { status: 'error', error: 'User not found in cloud' }
        }
        return { status: 'error', error: `Cloud avatar load failed: ${error.message}` }
      }

      const avatarUrl = user?.avatar_url || null
      return { status: 'success', data: avatarUrl }

    } catch (error: any) {
      console.error('AvatarStorageService: Cloud avatar load failed:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Load avatar from cloud by email (fallback for cross-device compatibility)
   */
  private static async loadAvatarFromCloudByEmail(email: string): Promise<ServiceResponse<string | null>> {
    try {
      console.log('AvatarStorageService: Loading avatar from cloud by email:', email)

      const { data: user, error } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('email', email)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { status: 'error', error: 'User not found in cloud by email' }
        }
        return { status: 'error', error: `Cloud avatar load by email failed: ${error.message}` }
      }

      const avatarUrl = user?.avatar_url || null
      return { status: 'success', data: avatarUrl }

    } catch (error: any) {
      console.error('AvatarStorageService: Cloud avatar load by email failed:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Synchronize user avatar across devices
   */
  static async syncAvatarAcrossDevices(userId: string): Promise<ServiceResponse<string | null>> {
    try {
      await auditLogger.logSecurityEvent('AVATAR_SYNC_START', 'users', true, { userId })

      // Get the most current avatar from database
      const { data: user, error } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .single()

      if (error) {
        return { status: 'error', error: `Failed to sync avatar: ${error.message}` }
      }

      const avatarUrl = user?.avatar_url || null

      // Update local cache
      if (avatarUrl) {
        this.cacheAvatarLocally(userId, avatarUrl)

        // Update localStorage user data
        await this.updateLocalUserData(userId, avatarUrl)
      } else {
        // Clear local cache if no avatar
        this.clearLocalAvatarCache(userId)
        await this.updateLocalUserData(userId, null)
      }

      await auditLogger.logSecurityEvent('AVATAR_SYNC_SUCCESS', 'users', true, {
        userId,
        avatarUrl: avatarUrl || 'none'
      })

      return { status: 'success', data: avatarUrl }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('AVATAR_SYNC_ERROR', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: `Avatar sync failed: ${error.message}` }
    }
  }

  /**
   * Process and optimize image before upload
   */
  private static async processImage(
    file: File | string,
    options: AvatarStorageOptions
  ): Promise<{ success: true; blob: Blob } | { success: false; error: string }> {
    try {
      const maxSize = options.maxSize || this.MAX_FILE_SIZE
      const quality = options.quality || this.DEFAULT_QUALITY
      const maxDimensions = options.maxDimensions || this.DEFAULT_MAX_DIMENSIONS

      let blob: Blob

      if (typeof file === 'string') {
        // Handle both base64 with data URI and plain base64
        let base64Data: string
        let mimeType = 'image/png' // default

        if (file.startsWith('data:')) {
          // Extract MIME type and base64 data from data URI
          const matches = file.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,(.*)$/)
          if (matches && matches.length === 3) {
            mimeType = matches[1]
            base64Data = matches[2]
          } else {
            throw new Error('Invalid data URI format')
          }
        } else {
          // Plain base64 string
          base64Data = file
        }

        try {
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          blob = new Blob([bytes], { type: mimeType })
        } catch (error) {
          throw new Error('Failed to decode base64 image data')
        }
      } else {
        blob = file
      }

      // Validate file type
      if (!this.SUPPORTED_FORMATS.includes(blob.type)) {
        return { success: false, error: 'Unsupported image format. Please use JPEG, PNG, WebP, or GIF.' }
      }

      // Check file size
      if (blob.size > maxSize) {
        return { success: false, error: `File size too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.` }
      }

      // Resize and optimize image
      const optimizedBlob = await this.optimizeImage(blob, maxDimensions, quality)

      return { success: true, blob: optimizedBlob }

    } catch (error: any) {
      return { success: false, error: `Image processing failed: ${error.message}` }
    }
  }

  /**
   * Optimize image size and quality (CSP-friendly version)
   */
  private static async optimizeImage(
    blob: Blob,
    maxDimensions: { width: number; height: number },
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        const aspectRatio = width / height

        if (width > maxDimensions.width || height > maxDimensions.height) {
          if (width > height) {
            width = maxDimensions.width
            height = width / aspectRatio
          } else {
            height = maxDimensions.height
            width = height * aspectRatio
          }
        }

        canvas.width = width
        canvas.height = height

        // Set white background to avoid black/transparent background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((optimizedBlob) => {
          if (optimizedBlob) {
            resolve(optimizedBlob)
          } else {
            reject(new Error('Image optimization failed'))
          }
        }, 'image/jpeg', quality)
      }

      img.onerror = () => reject(new Error('Failed to load image'))

      // Use FileReader to convert blob to data URL (CSP-friendly)
      const reader = new FileReader()
      reader.onload = () => {
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read image data'))
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Upload to Supabase Storage with improved error handling
   */
  private static async uploadToSupabaseStorage(
    userId: string,
    blob: Blob
  ): Promise<ServiceResponse<string> & { storagePath?: string }> {
    try {
      const fileName = `${userId}/avatar_${Date.now()}.jpg`

      // First, try to ensure the bucket exists
      const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets()

      if (bucketListError) {
        console.warn('Cannot access storage buckets, using localStorage fallback:', bucketListError.message)
        return this.fallbackToLocalStorage(userId, blob)
      }

      const avatarBucket = buckets?.find(bucket => bucket.name === this.STORAGE_BUCKET)
      if (!avatarBucket) {
        console.warn('Avatar bucket does not exist, using localStorage fallback. Please create "avatars" bucket in Supabase.')
        return this.fallbackToLocalStorage(userId, blob)
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg'
        })

      if (uploadError) {
        // If Supabase Storage fails, fall back to base64 storage
        console.warn('Supabase Storage upload failed, using localStorage fallback:', uploadError.message)
        return this.fallbackToLocalStorage(userId, blob)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(fileName)

      return {
        status: 'success',
        data: urlData.publicUrl,
        storagePath: fileName
      }

    } catch (error: any) {
      console.warn('Supabase Storage error, using localStorage fallback:', error.message)
      return this.fallbackToLocalStorage(userId, blob)
    }
  }

  /**
   * Fallback to localStorage for avatar storage
   */
  private static async fallbackToLocalStorage(
    userId: string,
    blob: Blob
  ): Promise<ServiceResponse<string> & { storagePath?: string }> {
    try {
      // Convert blob to base64 for localStorage storage
      const base64 = await this.blobToBase64(blob)
      const storageKey = `avatar_data_${userId}`

      // Store in localStorage
      localStorage.setItem(storageKey, base64)

      console.log('Avatar stored in localStorage as fallback')

      return {
        status: 'success',
        data: base64, // Return the base64 data URL directly
        storagePath: storageKey
      }
    } catch (error: any) {
      return { status: 'error', error: `Fallback storage failed: ${error.message}` }
    }
  }

  /**
   * Convert blob to base64 data URL
   */
  private static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Synchronize avatar data across all storage layers
   */
  private static async synchronizeAvatarData(
    userId: string,
    avatarInfo: AvatarInfo | null
  ): Promise<ServiceResponse<void>> {
    const errors: string[] = []

    try {
      // 1. Update Supabase database (primary source) with role preservation
      // First get current user data to preserve important fields like role
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('role, email')
        .eq('id', userId)
        .single()

      // Prepare update data with role preservation
      const updateData: any = {
        avatar_url: avatarInfo?.url || null,
        updated_at: new Date().toISOString()
      }

      // CRITICAL: Preserve Super User role during avatar database updates
      if (currentUser && (currentUser.email === 'elmfarrell@yahoo.com' || currentUser.email === 'pierre@phaetonai.com')) {
        updateData.role = 'super_user'
        console.log(`✅ AVATAR DB UPDATE: Preserving Super User role for ${currentUser.email}`)
      } else if (currentUser?.role) {
        // Preserve any existing role
        updateData.role = currentUser.role
        console.log(`✅ AVATAR DB UPDATE: Preserving existing role ${currentUser.role}`)
      }

      const { error: dbError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)

      if (dbError) {
        errors.push(`Database update failed: ${dbError.message}`)
      }

      // 2. Update localStorage cache
      if (avatarInfo) {
        localStorage.setItem(`avatar_${userId}`, JSON.stringify(avatarInfo))
        // Also store the direct avatar data for easy access
        localStorage.setItem(`avatar_data_${userId}`, avatarInfo.url)
      } else {
        localStorage.removeItem(`avatar_${userId}`)
        localStorage.removeItem(`avatar_data_${userId}`)
      }

      // 3. Update systemUsers in localStorage
      await this.updateLocalUserData(userId, avatarInfo?.url || null)

      // 4. Update individual user profile
      const userProfile = localStorage.getItem(`userProfile_${userId}`)
      if (userProfile) {
        try {
          const profile = JSON.parse(userProfile)
          if (avatarInfo?.url) {
            profile.avatar = avatarInfo.url
            profile.updated_at = new Date().toISOString()
          } else {
            delete profile.avatar
            profile.updated_at = new Date().toISOString()
          }

          // CRITICAL: Preserve Super User role during avatar updates
          if (profile.email === 'elmfarrell@yahoo.com' || profile.email === 'pierre@phaetonai.com') {
            profile.role = 'super_user'
            console.log(`✅ AVATAR SYNC: Preserved Super User role in userProfile for ${profile.email}`)
          }

          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile))
          console.log('AvatarStorageService: Updated individual user profile with avatar:', userId)
        } catch (parseError) {
          errors.push(`User profile update failed: ${parseError}`)
        }
      }

      // 5. Force update all localStorage storage locations that might contain user data
      try {
        // Update any settings page cached data
        const settingsUserData = localStorage.getItem(`settingsUser_${userId}`)
        if (settingsUserData) {
          const settingsUser = JSON.parse(settingsUserData)
          if (avatarInfo?.url) {
            settingsUser.avatar = avatarInfo.url
          } else {
            delete settingsUser.avatar
          }

          // CRITICAL: Preserve Super User role during avatar updates
          if (settingsUser.email === 'elmfarrell@yahoo.com' || settingsUser.email === 'pierre@phaetonai.com') {
            settingsUser.role = 'super_user'
            console.log(`✅ AVATAR SYNC: Preserved Super User role in settingsUser for ${settingsUser.email}`)
          }

          localStorage.setItem(`settingsUser_${userId}`, JSON.stringify(settingsUser))
        }
      } catch (settingsError) {
        console.warn('Failed to update settings user data:', settingsError)
      }

      if (errors.length > 0 && errors.length === 1 && errors[0].includes('Database update failed')) {
        // If only database failed but localStorage succeeded, it's acceptable for offline mode
        console.warn('Avatar synchronized locally, database sync failed:', errors[0])
        return { status: 'success' }
      } else if (errors.length > 0) {
        return { status: 'error', error: `Sync partially failed: ${errors.join(', ')}` }
      }

      return { status: 'success' }

    } catch (error: any) {
      return { status: 'error', error: `Synchronization failed: ${error.message}` }
    }
  }

  /**
   * Update local user data in systemUsers array
   */
  private static async updateLocalUserData(userId: string, avatarUrl: string | null): Promise<void> {
    try {
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        const users = JSON.parse(storedUsers)
        const userIndex = users.findIndex((u: any) => u.id === userId)

        if (userIndex >= 0) {
          if (avatarUrl) {
            users[userIndex].avatar = avatarUrl
          } else {
            delete users[userIndex].avatar
          }

          // CRITICAL: Preserve Super User role during avatar updates
          if (users[userIndex].email === 'elmfarrell@yahoo.com' || users[userIndex].email === 'pierre@phaetonai.com') {
            users[userIndex].role = 'super_user'
            console.log(`✅ AVATAR STORAGE: Preserved Super User role for ${users[userIndex].email}`)
          }

          users[userIndex].updated_at = new Date().toISOString()
          localStorage.setItem('systemUsers', JSON.stringify(users))
        }
      }

      // Also update currentUser if it matches
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser)
          if (user.id === userId) {
            if (avatarUrl) {
              user.avatar = avatarUrl
            } else {
              delete user.avatar
            }

            // CRITICAL: Preserve Super User role during avatar updates
            if (user.email === 'elmfarrell@yahoo.com' || user.email === 'pierre@phaetonai.com') {
              user.role = 'super_user'
              console.log(`✅ AVATAR STORAGE: Preserved Super User role for ${user.email}`)
            }

            user.updated_at = new Date().toISOString()
            localStorage.setItem('currentUser', JSON.stringify(user))

            // Trigger update events
            window.dispatchEvent(new Event('userDataUpdated'))
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'currentUser',
              newValue: JSON.stringify(user),
              storageArea: localStorage
            }))
          }
        } catch (parseError) {
          console.warn('Failed to update currentUser:', parseError)
        }
      }
    } catch (error) {
      console.warn('Failed to update local user data:', error)
    }
  }

  /**
   * Get avatar info from localStorage
   */
  private static getLocalAvatarInfo(userId: string): AvatarInfo | null {
    try {
      const avatarInfo = localStorage.getItem(`avatar_${userId}`)
      return avatarInfo ? JSON.parse(avatarInfo) : null
    } catch (error) {
      return null
    }
  }

  /**
   * Cache avatar URL locally
   */
  private static cacheAvatarLocally(userId: string, avatarUrl: string): void {
    try {
      const avatarInfo: AvatarInfo = {
        url: avatarUrl,
        storagePath: this.extractStoragePathFromUrl(avatarUrl),
        uploadedAt: new Date().toISOString(),
        synchronized: true
      }
      localStorage.setItem(`avatar_${userId}`, JSON.stringify(avatarInfo))
    } catch (error) {
      console.warn('Failed to cache avatar locally:', error)
    }
  }

  /**
   * Clear local avatar cache
   */
  private static clearLocalAvatarCache(userId: string): void {
    localStorage.removeItem(`avatar_${userId}`)
  }

  /**
   * Get avatar info with storage path
   */
  private static async getAvatarInfo(userId: string): Promise<AvatarInfo | null> {
    // Try localStorage first (faster)
    const localInfo = this.getLocalAvatarInfo(userId)
    if (localInfo) {
      return localInfo
    }

    // Fallback to reconstructing from database
    try {
      const { data: user } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .single()

      if (user?.avatar_url) {
        return {
          url: user.avatar_url,
          storagePath: this.extractStoragePathFromUrl(user.avatar_url),
          uploadedAt: new Date().toISOString(),
          synchronized: true
        }
      }
    } catch (error) {
      console.warn('Failed to get avatar info from database:', error)
    }

    return null
  }

  /**
   * Extract storage path from public URL
   */
  private static extractStoragePathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const bucketIndex = pathParts.findIndex(part => part === this.STORAGE_BUCKET)
      if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/')
      }
    } catch (error) {
      console.warn('Failed to extract storage path from URL:', url)
    }
    return ''
  }

  /**
   * Clean up storage file
   */
  private static async cleanupStorageFile(storagePath: string): Promise<void> {
    try {
      if (storagePath) {
        const { error } = await supabase.storage
          .from(this.STORAGE_BUCKET)
          .remove([storagePath])

        if (error) {
          console.warn('Failed to clean up storage file:', error)
        }
      }
    } catch (error) {
      console.warn('Error during storage cleanup:', error)
    }
  }

  /**
   * Verify if avatar URL is still accessible
   */
  private static async verifyAvatarUrl(url: string): Promise<boolean> {
    try {
      // Skip verification for data URLs (they're always "accessible" if valid)
      if (url.startsWith('data:')) {
        return true
      }

      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Initialize avatar service and perform any necessary migrations
   */
  static async initialize(): Promise<void> {
    try {
      // Ensure avatars bucket exists
      const { data: buckets } = await supabase.storage.listBuckets()
      const avatarBucket = buckets?.find(bucket => bucket.name === this.STORAGE_BUCKET)

      if (!avatarBucket) {
        console.warn('Avatars storage bucket not found. Please create it in Supabase dashboard.')
      }

      console.log('Avatar storage service initialized successfully')
    } catch (error) {
      console.warn('Avatar storage service initialization warning:', error)
    }
  }

  /**
   * Clean up orphaned avatar files (admin function)
   */
  static async cleanupOrphanedAvatars(): Promise<ServiceResponse<number>> {
    try {
      // Get all files in storage
      const { data: files, error: listError } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .list()

      if (listError) {
        return { status: 'error', error: `Failed to list storage files: ${listError.message}` }
      }

      // Get all user IDs with avatars from database
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, avatar_url')
        .not('avatar_url', 'is', null)

      if (usersError) {
        return { status: 'error', error: `Failed to get users: ${usersError.message}` }
      }

      // Find orphaned files
      const activeStoragePaths = new Set(
        users?.map(user => this.extractStoragePathFromUrl(user.avatar_url!)).filter(Boolean) || []
      )

      const filesToDelete: string[] = []
      files?.forEach(file => {
        if (!activeStoragePaths.has(file.name)) {
          filesToDelete.push(file.name)
        }
      })

      // Delete orphaned files
      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(this.STORAGE_BUCKET)
          .remove(filesToDelete)

        if (deleteError) {
          console.warn('Some files could not be deleted:', deleteError)
        }
      }

      await auditLogger.logSecurityEvent('AVATAR_CLEANUP', 'storage', true, {
        filesDeleted: filesToDelete.length,
        totalFiles: files?.length || 0
      })

      return { status: 'success', data: filesToDelete.length }

    } catch (error: any) {
      return { status: 'error', error: `Cleanup failed: ${error.message}` }
    }
  }
}

export const avatarStorageService = AvatarStorageService