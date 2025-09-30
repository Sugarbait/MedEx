/**
 * Bulletproof Profile Fields Service
 *
 * Ensures profile fields (Department, Phone, Location, Bio) work across ALL browsers and devices
 * by implementing multiple storage strategies and cloud synchronization
 */

import { supabase, supabaseConfig } from '@/config/supabase'
import { ServiceResponse } from '@/types/supabase'
import { auditLogger } from './auditLogger'

export interface ProfileFields {
  department: string
  phone: string
  location: string
  display_name: string
  bio: string
}

export interface ProfileFieldsSyncResult {
  cloudSaved: boolean
  localSaved: boolean
  multipleStorageSaved: boolean
  errors: string[]
  warnings: string[]
}

export class BulletproofProfileFieldsService {
  private static readonly STORAGE_KEYS = [
    'profileFields_',     // Primary key
    'userProfile_',       // Backup key 1
    'profileData_',       // Backup key 2
    'userFields_'         // Backup key 3
  ]

  /**
   * Save profile fields using multiple storage strategies
   */
  static async saveProfileFields(userId: string, fields: ProfileFields): Promise<ServiceResponse<ProfileFieldsSyncResult>> {
    const result: ProfileFieldsSyncResult = {
      cloudSaved: false,
      localSaved: false,
      multipleStorageSaved: false,
      errors: [],
      warnings: []
    }

    try {
      console.log('🛡️ BULLETPROOF PROFILE: Saving fields for user:', userId, fields)

      // Strategy 1: Save to multiple localStorage keys for browser compatibility
      const localStorageSuccess = await this.saveToMultipleLocalStorage(userId, fields)
      result.multipleStorageSaved = localStorageSuccess

      // Strategy 2: Update current user data
      const currentUserSuccess = this.updateCurrentUserData(userId, fields)
      result.localSaved = currentUserSuccess

      // Strategy 3: Save to cloud if available
      if (supabaseConfig.isConfigured()) {
        const cloudResult = await this.saveToCloud(userId, fields)
        result.cloudSaved = cloudResult.success

        if (!cloudResult.success) {
          result.warnings.push(`Cloud save failed: ${cloudResult.error}`)
        }
      } else {
        result.warnings.push('Cloud sync unavailable - Supabase not configured')
      }

      // Strategy 4: Force immediate browser sync
      this.forceBrowserSync(userId, fields)

      // Trigger update events
      this.triggerUpdateEvents(userId, fields)

      const status = (result.localSaved || result.multipleStorageSaved) ? 'success' : 'error'
      return {
        status,
        data: result,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined
      }

    } catch (error: any) {
      console.error('🛡️ BULLETPROOF PROFILE: Save failed:', error)
      result.errors.push(error.message)

      return {
        status: 'error',
        data: result,
        error: error.message
      }
    }
  }

  /**
   * Load profile fields using comprehensive fallback strategy
   */
  static async loadProfileFields(userId: string): Promise<ServiceResponse<ProfileFields>> {
    try {
      console.log('🛡️ BULLETPROOF PROFILE: Loading fields for user:', userId)

      let fields: ProfileFields | null = null

      // Strategy 1: Try cloud first for latest data
      if (supabaseConfig.isConfigured()) {
        const cloudFields = await this.loadFromCloud(userId)
        if (cloudFields.success && cloudFields.data) {
          fields = cloudFields.data
          console.log('✅ BULLETPROOF PROFILE: Loaded from cloud successfully')

          // Auto-save to localStorage for offline access
          await this.saveToMultipleLocalStorage(userId, fields)
        }
      }

      // Strategy 2: Try multiple localStorage keys as fallback
      if (!fields) {
        fields = await this.loadFromMultipleLocalStorage(userId)
        if (fields) {
          console.log('✅ BULLETPROOF PROFILE: Loaded from localStorage')
        }
      }

      // Strategy 3: Try current user data
      if (!fields) {
        fields = this.loadFromCurrentUser(userId)
        if (fields) {
          console.log('✅ BULLETPROOF PROFILE: Loaded from currentUser')
        }
      }

      // Strategy 4: Try email-based cloud lookup for cross-device access
      if (!fields && supabaseConfig.isConfigured()) {
        const currentUser = localStorage.getItem('currentUser')
        if (currentUser) {
          try {
            const userData = JSON.parse(currentUser)
            if (userData.email) {
              const emailResult = await this.loadFromCloudByEmail(userData.email)
              if (emailResult.success && emailResult.data) {
                fields = emailResult.data
                console.log('✅ BULLETPROOF PROFILE: Found by email lookup')

                // Save for future access
                await this.saveToMultipleLocalStorage(userId, fields)
              }
            }
          } catch (error) {
            console.warn('🛡️ BULLETPROOF PROFILE: Email lookup failed:', error)
          }
        }
      }

      // Return found fields or defaults
      const finalFields: ProfileFields = fields || {
        department: '',
        phone: '',
        location: '',
        display_name: '',
        bio: ''
      }

      return {
        status: 'success',
        data: finalFields
      }

    } catch (error: any) {
      console.error('🛡️ BULLETPROOF PROFILE: Load failed:', error)
      return {
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * Force sync from cloud and update all local storage
   */
  static async forceSyncFromCloud(userId: string): Promise<ServiceResponse<ProfileFields>> {
    try {
      console.log('🛡️ BULLETPROOF PROFILE: Force syncing from cloud')

      if (!supabaseConfig.isConfigured()) {
        return {
          status: 'error',
          error: 'Cloud sync unavailable'
        }
      }

      const cloudResult = await this.loadFromCloud(userId)
      if (cloudResult.success && cloudResult.data) {
        // Update all storage methods
        await this.saveToMultipleLocalStorage(userId, cloudResult.data)
        this.updateCurrentUserData(userId, cloudResult.data)
        this.forceBrowserSync(userId, cloudResult.data)
        this.triggerUpdateEvents(userId, cloudResult.data)

        return {
          status: 'success',
          data: cloudResult.data
        }
      }

      return {
        status: 'error',
        error: cloudResult.error || 'Failed to sync from cloud'
      }

    } catch (error: any) {
      console.error('🛡️ BULLETPROOF PROFILE: Force sync failed:', error)
      return {
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * Save to multiple localStorage keys for browser compatibility
   */
  private static async saveToMultipleLocalStorage(userId: string, fields: ProfileFields): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString()
      const dataWithTimestamp = {
        ...fields,
        updated_at: timestamp,
        user_id: userId
      }

      let successCount = 0

      // Save to all storage keys
      for (const keyPrefix of this.STORAGE_KEYS) {
        try {
          const key = `${keyPrefix}${userId}`
          localStorage.setItem(key, JSON.stringify(dataWithTimestamp))
          successCount++
          console.log(`✅ BULLETPROOF PROFILE: Saved to ${key}`)
        } catch (error) {
          console.warn(`🛡️ BULLETPROOF PROFILE: Failed to save to ${keyPrefix}${userId}:`, error)
        }
      }

      // Also save profile fields in a global fallback location
      try {
        const allProfiles = localStorage.getItem('allUserProfiles') || '{}'
        const profiles = JSON.parse(allProfiles)
        profiles[userId] = dataWithTimestamp
        localStorage.setItem('allUserProfiles', JSON.stringify(profiles))
        successCount++
        console.log('✅ BULLETPROOF PROFILE: Saved to global allUserProfiles')
      } catch (error) {
        console.warn('🛡️ BULLETPROOF PROFILE: Failed to save to global store:', error)
      }

      return successCount > 0

    } catch (error) {
      console.error('🛡️ BULLETPROOF PROFILE: Multiple localStorage save failed:', error)
      return false
    }
  }

  /**
   * Load from multiple localStorage keys with fallback
   */
  private static async loadFromMultipleLocalStorage(userId: string): Promise<ProfileFields | null> {
    try {
      // Try all storage keys
      for (const keyPrefix of this.STORAGE_KEYS) {
        try {
          const key = `${keyPrefix}${userId}`
          const data = localStorage.getItem(key)
          if (data) {
            const parsed = JSON.parse(data)
            if (this.isValidProfileFields(parsed)) {
              console.log(`✅ BULLETPROOF PROFILE: Found data in ${key}`)
              return {
                department: parsed.department || '',
                phone: parsed.phone || '',
                location: parsed.location || '',
                display_name: parsed.display_name || parsed.name || '',
                bio: parsed.bio || ''
              }
            }
          }
        } catch (error) {
          console.warn(`🛡️ BULLETPROOF PROFILE: Failed to load from ${keyPrefix}${userId}:`, error)
        }
      }

      // Try global fallback
      try {
        const allProfiles = localStorage.getItem('allUserProfiles')
        if (allProfiles) {
          const profiles = JSON.parse(allProfiles)
          if (profiles[userId] && this.isValidProfileFields(profiles[userId])) {
            console.log('✅ BULLETPROOF PROFILE: Found data in global store')
            const data = profiles[userId]
            return {
              department: data.department || '',
              phone: data.phone || '',
              location: data.location || '',
              display_name: data.display_name || data.name || '',
              bio: data.bio || ''
            }
          }
        }
      } catch (error) {
        console.warn('🛡️ BULLETPROOF PROFILE: Failed to load from global store:', error)
      }

      return null

    } catch (error) {
      console.error('🛡️ BULLETPROOF PROFILE: Multiple localStorage load failed:', error)
      return null
    }
  }

  /**
   * Update current user data with profile fields
   */
  private static updateCurrentUserData(userId: string, fields: ProfileFields): boolean {
    try {
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === userId) {
          const updatedUser = {
            ...userData,
            ...fields,
            updated_at: new Date().toISOString()
          }
          localStorage.setItem('currentUser', JSON.stringify(updatedUser))
          console.log('✅ BULLETPROOF PROFILE: Updated currentUser')
          return true
        }
      }

      // Also update systemUsers
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === userId)
        if (userIndex >= 0) {
          users[userIndex] = {
            ...users[userIndex],
            ...fields,
            updated_at: new Date().toISOString()
          }
          localStorage.setItem('systemUsers', JSON.stringify(users))
          console.log('✅ BULLETPROOF PROFILE: Updated systemUsers')
          return true
        }
      }

      return false

    } catch (error) {
      console.error('🛡️ BULLETPROOF PROFILE: Failed to update current user data:', error)
      return false
    }
  }

  /**
   * Load profile fields from current user data
   */
  private static loadFromCurrentUser(userId: string): ProfileFields | null {
    try {
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === userId && this.isValidProfileFields(userData)) {
          return {
            department: userData.department || '',
            phone: userData.phone || '',
            location: userData.location || '',
            display_name: userData.display_name || userData.name || '',
            bio: userData.bio || ''
          }
        }
      }

      return null

    } catch (error) {
      console.error('🛡️ BULLETPROOF PROFILE: Failed to load from current user:', error)
      return null
    }
  }

  /**
   * Save profile fields to cloud (user_profiles table)
   */
  private static async saveToCloud(userId: string, fields: ProfileFields): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🛡️ BULLETPROOF PROFILE: Saving to cloud')

      const profileData = {
        user_id: userId,
        display_name: fields.display_name || '',
        department: fields.department || '',
        phone: fields.phone || '',
        bio: fields.bio || '',
        location: fields.location || '',
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_profiles')
        .upsert(profileData, { onConflict: 'user_id' })

      if (error) {
        console.error('🛡️ BULLETPROOF PROFILE: Cloud save failed:', error)
        return { success: false, error: error.message }
      }

      await auditLogger.logSecurityEvent('PROFILE_FIELDS_CLOUD_SAVED', 'user_profiles', true, {
        userId,
        fieldsUpdated: Object.keys(fields)
      })

      console.log('✅ BULLETPROOF PROFILE: Saved to cloud successfully')
      return { success: true }

    } catch (error: any) {
      console.error('🛡️ BULLETPROOF PROFILE: Cloud save error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Load profile fields from cloud
   */
  private static async loadFromCloud(userId: string): Promise<{ success: boolean; data?: ProfileFields; error?: string }> {
    try {
      console.log('🛡️ BULLETPROOF PROFILE: Loading from cloud')

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: 'Profile not found in cloud' }
        }
        return { success: false, error: error.message }
      }

      if (data) {
        // Check if the cloud data actually has meaningful content
        const hasContent = Boolean(
          data.department ||
          data.phone ||
          data.location ||
          data.display_name ||
          data.bio
        )

        // If cloud data exists but is all empty, treat as "not found" so we fall back to localStorage
        if (!hasContent) {
          console.log('🛡️ BULLETPROOF PROFILE: Cloud data exists but is empty, will try localStorage fallback')
          return { success: false, error: 'Cloud profile exists but has no content' }
        }

        return {
          success: true,
          data: {
            department: data.department || '',
            phone: data.phone || '',
            location: data.location || '',
            display_name: data.display_name || '',
            bio: data.bio || ''
          }
        }
      }

      return { success: false, error: 'No profile data found' }

    } catch (error: any) {
      console.error('🛡️ BULLETPROOF PROFILE: Cloud load error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Load profile fields from cloud by email (cross-device compatibility)
   */
  private static async loadFromCloudByEmail(email: string): Promise<{ success: boolean; data?: ProfileFields; error?: string }> {
    try {
      console.log('🛡️ BULLETPROOF PROFILE: Loading from cloud by email:', email)

      // First get user ID by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('email', email)
        .single()

      if (userError || !userData) {
        return { success: false, error: 'User not found by email' }
      }

      // Then get profile data
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userData.id)
        .single()

      if (profileError || !profileData) {
        return { success: false, error: 'Profile not found by email' }
      }

      return {
        success: true,
        data: {
          department: profileData.department || '',
          phone: profileData.phone || '',
          location: profileData.location || '',
          display_name: profileData.display_name || userData.name || '',
          bio: profileData.bio || ''
        }
      }

    } catch (error: any) {
      console.error('🛡️ BULLETPROOF PROFILE: Email lookup error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Force browser sync across tabs and windows
   */
  private static forceBrowserSync(userId: string, fields: ProfileFields): void {
    try {
      // Trigger storage events to notify other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: `profileFields_${userId}`,
        newValue: JSON.stringify(fields),
        url: window.location.href
      }))

      // Also trigger for backup keys
      for (const keyPrefix of this.STORAGE_KEYS) {
        window.dispatchEvent(new StorageEvent('storage', {
          key: `${keyPrefix}${userId}`,
          newValue: JSON.stringify(fields),
          url: window.location.href
        }))
      }

      console.log('✅ BULLETPROOF PROFILE: Triggered browser sync events')

    } catch (error) {
      console.warn('🛡️ BULLETPROOF PROFILE: Failed to trigger browser sync:', error)
    }
  }

  /**
   * Trigger update events for UI components
   */
  private static triggerUpdateEvents(userId: string, fields: ProfileFields): void {
    try {
      window.dispatchEvent(new CustomEvent('profileFieldsUpdated', {
        detail: { userId, fields }
      }))

      window.dispatchEvent(new CustomEvent('userProfileUpdated', {
        detail: { userId, profileData: fields }
      }))

      window.dispatchEvent(new Event('userDataUpdated'))

      console.log('✅ BULLETPROOF PROFILE: Triggered update events')

    } catch (error) {
      console.warn('🛡️ BULLETPROOF PROFILE: Failed to trigger update events:', error)
    }
  }

  /**
   * Validate if data contains valid profile fields
   */
  private static isValidProfileFields(data: any): boolean {
    return data && typeof data === 'object' && (
      data.department !== undefined ||
      data.phone !== undefined ||
      data.location !== undefined ||
      data.display_name !== undefined ||
      data.bio !== undefined ||
      data.name !== undefined
    )
  }

  /**
   * Get synchronization status
   */
  static getSyncStatus(userId: string): {
    cloudAvailable: boolean
    localStorageCount: number
    lastSync: string | null
    hasProfileData: boolean
  } {
    let localStorageCount = 0
    let hasProfileData = false

    // Check all storage locations
    for (const keyPrefix of this.STORAGE_KEYS) {
      try {
        const data = localStorage.getItem(`${keyPrefix}${userId}`)
        if (data && this.isValidProfileFields(JSON.parse(data))) {
          localStorageCount++
          hasProfileData = true
        }
      } catch (error) {
        // Continue checking other keys
      }
    }

    return {
      cloudAvailable: supabaseConfig.isConfigured(),
      localStorageCount,
      lastSync: localStorage.getItem('lastProfileFieldsSync'),
      hasProfileData
    }
  }

  /**
   * Update last sync timestamp
   */
  static updateLastSyncTime(): void {
    localStorage.setItem('lastProfileFieldsSync', new Date().toISOString())
  }
}

export const bulletproofProfileFieldsService = BulletproofProfileFieldsService