import { supabase, supabaseConfig } from '@/config/supabase'
import { auditLogger } from './auditLogger'
import { ServiceResponse } from '@/types/supabase'

export interface ProfileData {
  id: string
  email: string
  name: string
  role: string
  avatar?: string
  mfa_enabled?: boolean
  department?: string
  phone?: string
  bio?: string
  location?: string
  display_name?: string
  settings?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface ProfileSyncResult {
  cloudSaved: boolean
  localSaved: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Robust Profile Synchronization Service
 *
 * This service provides a reliable way to save and sync profile data across devices
 * with proper fallback handling and error recovery.
 */
export class RobustProfileSyncService {
  private static readonly RETRY_ATTEMPTS = 3
  private static readonly RETRY_DELAY = 1000 // 1 second

  /**
   * Save profile data with robust cloud sync and fallback handling
   */
  static async saveProfileData(profileData: ProfileData): Promise<ServiceResponse<ProfileSyncResult>> {
    const result: ProfileSyncResult = {
      cloudSaved: false,
      localSaved: false,
      errors: [],
      warnings: []
    }

    try {
      console.log('🔄 ROBUST PROFILE SYNC: Starting save for user:', profileData.id)

      // Always save to localStorage first for immediate availability
      const localResult = await this.saveToLocalStorage(profileData)
      result.localSaved = localResult

      if (!localResult) {
        result.errors.push('Failed to save to localStorage')
      }

      // Try to save to cloud if Supabase is configured
      if (supabaseConfig.isConfigured()) {
        const cloudResult = await this.saveToCloud(profileData)
        result.cloudSaved = cloudResult.success

        if (!cloudResult.success) {
          result.warnings.push(`Cloud save failed: ${cloudResult.error}`)
          console.warn('🔄 ROBUST PROFILE SYNC: Cloud save failed, but localStorage succeeded')
        } else {
          console.log('✅ ROBUST PROFILE SYNC: Successfully saved to both cloud and localStorage')
        }
      } else {
        result.warnings.push('Supabase not configured - using localStorage only')
        console.log('🔄 ROBUST PROFILE SYNC: Operating in localStorage-only mode')
      }

      // Trigger UI update events
      this.triggerUpdateEvents(profileData)

      const status = result.localSaved ? 'success' : 'error'
      const message = result.cloudSaved ?
        'Profile saved and synced to cloud' :
        result.localSaved ? 'Profile saved locally (cloud sync unavailable)' : 'Profile save failed'

      return {
        status,
        data: result,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined
      }

    } catch (error: any) {
      console.error('🔄 ROBUST PROFILE SYNC: Save failed:', error)
      result.errors.push(error.message)

      await auditLogger.logSecurityEvent('PROFILE_SYNC_FAILED', 'user_profiles', false, {
        userId: profileData.id,
        error: error.message
      })

      return {
        status: 'error',
        data: result,
        error: error.message
      }
    }
  }

  /**
   * Load profile data with smart merging - localStorage profile fields take priority
   */
  static async loadProfileData(userId: string): Promise<ServiceResponse<ProfileData | null>> {
    try {
      console.log('🔄 ROBUST PROFILE SYNC: Loading profile for user:', userId)

      let cloudData = null
      let localData = null

      // Try to load from both sources
      if (supabaseConfig.isConfigured()) {
        const cloudResult = await this.loadFromCloud(userId)
        if (cloudResult.success && cloudResult.data) {
          cloudData = cloudResult.data
          console.log('✅ ROBUST PROFILE SYNC: Loaded from cloud successfully')

          // CRITICAL FIX: Auto-save cloud data to localStorage for fresh devices
          // This ensures data is available immediately on new devices/incognito mode
          if (cloudData && !await this.loadFromLocalStorage(userId)) {
            console.log('🔄 ROBUST PROFILE SYNC: Fresh device detected - saving cloud data to localStorage')
            await this.saveToLocalStorage(cloudData)
          }
        } else {
          console.warn('🔄 ROBUST PROFILE SYNC: Cloud load failed, will try email-based fallback')

          // ENHANCED: Try email-based fallback for cross-device compatibility
          const currentUser = localStorage.getItem('currentUser')
          if (currentUser) {
            try {
              const userData = JSON.parse(currentUser)
              if (userData.email) {
                console.log('🔄 ROBUST PROFILE SYNC: Trying email-based cloud lookup for:', userData.email)
                const emailResult = await this.loadFromCloudByEmail(userData.email)
                if (emailResult.success && emailResult.data) {
                  cloudData = emailResult.data
                  console.log('✅ ROBUST PROFILE SYNC: Found cloud data by email lookup')

                  // Save to localStorage with current user ID for future access
                  await this.saveToLocalStorage({ ...cloudData, id: userId })
                }
              }
            } catch (error) {
              console.warn('🔄 ROBUST PROFILE SYNC: Email-based fallback failed:', error)
            }
          }
        }
      }

      // Always check localStorage for profile fields
      localData = await this.loadFromLocalStorage(userId)
      if (localData) {
        console.log('✅ ROBUST PROFILE SYNC: Loaded from localStorage')
      }

      // Smart merge: prioritize localStorage profile fields over cloud data
      if (cloudData && localData) {
        console.log('🔄 ROBUST PROFILE SYNC: Merging cloud and localStorage data (localStorage profile fields priority)')
        const mergedData = {
          ...cloudData,
          // Override with localStorage profile fields if they exist and are not empty
          department: localData.department || cloudData.department || '',
          phone: localData.phone || cloudData.phone || '',
          location: localData.location || cloudData.location || '',
          display_name: localData.display_name || cloudData.display_name || cloudData.name || '',
          bio: localData.bio || cloudData.bio || ''
        }
        console.log('✅ ROBUST PROFILE SYNC: Merged data prioritizing localStorage profile fields')
        return {
          status: 'success',
          data: mergedData
        }
      }

      // Use cloud data if available and no local data
      if (cloudData) {
        console.log('✅ ROBUST PROFILE SYNC: Using cloud data only')
        return {
          status: 'success',
          data: cloudData
        }
      }

      // Use local data if available and no cloud data
      if (localData) {
        console.log('✅ ROBUST PROFILE SYNC: Using localStorage data only')
        return {
          status: 'success',
          data: localData
        }
      }

      console.log('🔄 ROBUST PROFILE SYNC: No profile data found')
      return {
        status: 'success',
        data: null
      }

    } catch (error: any) {
      console.error('🔄 ROBUST PROFILE SYNC: Load failed:', error)
      return {
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * Force sync profile from cloud (for manual refresh)
   */
  static async forceSyncFromCloud(userId: string): Promise<ServiceResponse<ProfileData | null>> {
    try {
      console.log('🔄 ROBUST PROFILE SYNC: Force syncing from cloud for user:', userId)

      if (!supabaseConfig.isConfigured()) {
        return {
          status: 'error',
          error: 'Cloud sync not available - Supabase not configured'
        }
      }

      const cloudData = await this.loadFromCloud(userId)
      if (cloudData.success && cloudData.data) {
        // Update localStorage
        await this.saveToLocalStorage(cloudData.data)

        // Trigger UI events
        this.triggerUpdateEvents(cloudData.data)

        console.log('✅ ROBUST PROFILE SYNC: Force sync completed successfully')
        return {
          status: 'success',
          data: cloudData.data
        }
      }

      return {
        status: 'error',
        error: cloudData.error || 'Failed to load from cloud'
      }

    } catch (error: any) {
      console.error('🔄 ROBUST PROFILE SYNC: Force sync failed:', error)
      return {
        status: 'error',
        error: error.message
      }
    }
  }

  /**
   * Save to cloud with retry logic and proper error handling
   */
  private static async saveToCloud(profileData: ProfileData): Promise<{ success: boolean; error?: string }> {
    let lastError = ''

    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`🔄 ROBUST PROFILE SYNC: Cloud save attempt ${attempt}/${this.RETRY_ATTEMPTS}`)

        // Skip users table update due to schema compatibility issues
        // Profile data will be stored only in user_profiles table
        console.log('📝 ROBUST PROFILE SYNC: Skipping users table update, using user_profiles table only')

        // Then, update the extended profile data
        const extendedFields = {
          user_id: profileData.id,
          display_name: profileData.display_name || profileData.name || '',
          department: profileData.department || '',
          phone: profileData.phone || '',
          bio: profileData.bio || '',
          location: profileData.location || '',
          updated_at: new Date().toISOString()
        }

        console.log('🔧 ROBUST PROFILE SYNC: Saving extended fields to cloud:', extendedFields)

        // Filter out undefined values only (keep empty strings)
        const cleanFields = Object.fromEntries(
          Object.entries(extendedFields).filter(([_, value]) => value !== undefined)
        )

        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert(cleanFields, { onConflict: 'user_id' })

        if (profileError) {
          lastError = `User profiles table error: ${profileError.message}`
          console.warn(`🔄 ROBUST PROFILE SYNC: User profiles table upsert failed (attempt ${attempt}):`, profileError)

          if (attempt < this.RETRY_ATTEMPTS) {
            await this.delay(this.RETRY_DELAY * attempt)
            continue
          }
        } else {
          console.log('✅ ROBUST PROFILE SYNC: User profiles table updated successfully')
        }

        // If user_profiles table was updated successfully, we're good
        if (!profileError) {
          await auditLogger.logSecurityEvent('PROFILE_CLOUD_SAVED', 'user_profiles', true, {
            userId: profileData.id,
            attempt
          })
          return { success: true }
        }

      } catch (error: any) {
        lastError = error.message
        console.error(`🔄 ROBUST PROFILE SYNC: Cloud save attempt ${attempt} failed:`, error)

        if (attempt < this.RETRY_ATTEMPTS) {
          await this.delay(this.RETRY_DELAY * attempt)
        }
      }
    }

    console.error('🔄 ROBUST PROFILE SYNC: All cloud save attempts failed:', lastError)
    return { success: false, error: lastError }
  }

  /**
   * Load from cloud by email (fallback for cross-device compatibility)
   */
  private static async loadFromCloudByEmail(email: string): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
    try {
      console.log('🔄 ROBUST PROFILE SYNC: Loading from cloud by email:', email)

      // Load basic user data by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (userError) {
        if (userError.code === 'PGRST116') {
          return { success: false, error: 'User not found in cloud by email' }
        }
        return { success: false, error: `User query by email failed: ${userError.message}` }
      }

      // Now load extended profile data using the found user ID
      let extendedProfile = null
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userData.id)
          .single()

        if (!profileError && profileData) {
          extendedProfile = profileData
        }
      } catch (error) {
        console.warn('🔄 ROBUST PROFILE SYNC: Extended profile not found by email, using basic data only')
      }

      // Combine data
      const completeProfile: ProfileData = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        avatar: userData.avatar_url,
        mfa_enabled: userData.mfa_enabled,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
        // Extended fields from user_profiles table
        display_name: extendedProfile?.display_name || userData.name,
        department: extendedProfile?.department || '',
        phone: extendedProfile?.phone || '',
        bio: extendedProfile?.bio || '',
        location: extendedProfile?.location || '',
        settings: {}
      }

      return { success: true, data: completeProfile }

    } catch (error: any) {
      console.error('🔄 ROBUST PROFILE SYNC: Cloud load by email failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Load from cloud with comprehensive error handling
   */
  private static async loadFromCloud(userId: string): Promise<{ success: boolean; data?: ProfileData; error?: string }> {
    try {
      console.log('🔄 ROBUST PROFILE SYNC: Loading from cloud for user:', userId)

      // Load basic user data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) {
        if (userError.code === 'PGRST116') {
          return { success: false, error: 'User not found in cloud' }
        }
        return { success: false, error: `User query failed: ${userError.message}` }
      }

      // Load extended profile data
      let extendedProfile = null
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!profileError && profileData) {
          extendedProfile = profileData
        }
      } catch (error) {
        console.warn('🔄 ROBUST PROFILE SYNC: Extended profile not found, using basic data only')
      }

      // Combine data
      const completeProfile: ProfileData = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        avatar: userData.avatar_url,
        mfa_enabled: userData.mfa_enabled,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
        // Extended fields from user_profiles table
        display_name: extendedProfile?.display_name || userData.name,
        department: extendedProfile?.department || '',
        phone: extendedProfile?.phone || '',
        bio: extendedProfile?.bio || '',
        location: extendedProfile?.location || '',
        settings: {}
      }

      return { success: true, data: completeProfile }

    } catch (error: any) {
      console.error('🔄 ROBUST PROFILE SYNC: Cloud load failed:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Save to localStorage with comprehensive storage updates
   */
  private static async saveToLocalStorage(profileData: ProfileData): Promise<boolean> {
    try {
      console.log('🔄 ROBUST PROFILE SYNC: Saving to localStorage')

      const currentTime = new Date().toISOString()
      const updatedProfile = {
        ...profileData,
        updated_at: currentTime
      }

      // Update currentUser if this is the current user
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser)
          if (userData.id === profileData.id) {
            const mergedUser = { ...userData, ...updatedProfile }
            localStorage.setItem('currentUser', JSON.stringify(mergedUser))
            console.log('✅ ROBUST PROFILE SYNC: Updated currentUser in localStorage')
          }
        } catch (error) {
          console.warn('🔄 ROBUST PROFILE SYNC: Failed to update currentUser:', error)
        }
      }

      // Update individual user profile
      localStorage.setItem(`userProfile_${profileData.id}`, JSON.stringify(updatedProfile))

      // Update systemUsers array
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          const userIndex = users.findIndex((u: any) => u.id === profileData.id)

          if (userIndex >= 0) {
            users[userIndex] = { ...users[userIndex], ...updatedProfile }
          } else {
            users.push(updatedProfile)
          }

          localStorage.setItem('systemUsers', JSON.stringify(users))
          console.log('✅ ROBUST PROFILE SYNC: Updated systemUsers in localStorage')
        } catch (error) {
          console.warn('🔄 ROBUST PROFILE SYNC: Failed to update systemUsers:', error)
        }
      }

      // Save profile fields separately for immediate form persistence
      // Only save non-empty values to prevent overwriting existing data
      const existingProfileFields = localStorage.getItem(`profileFields_${profileData.id}`)
      let currentFields = {}

      if (existingProfileFields) {
        try {
          currentFields = JSON.parse(existingProfileFields)
        } catch (error) {
          console.warn('Failed to parse existing profile fields')
        }
      }

      const profileFields = {
        department: profileData.department || currentFields.department || '',
        phone: profileData.phone || currentFields.phone || '',
        location: profileData.location || currentFields.location || '',
        display_name: profileData.display_name || profileData.name || currentFields.display_name || '',
        bio: profileData.bio || currentFields.bio || ''
      }

      localStorage.setItem(`profileFields_${profileData.id}`, JSON.stringify(profileFields))
      console.log('✅ ROBUST PROFILE SYNC: Saved profile fields with preservation of existing data')

      // Trigger a storage event to notify other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'currentUser',
        newValue: localStorage.getItem('currentUser'),
        url: window.location.href
      }))

      return true

    } catch (error) {
      console.error('🔄 ROBUST PROFILE SYNC: localStorage save failed:', error)
      return false
    }
  }

  /**
   * Load from localStorage with fallback strategy
   */
  private static async loadFromLocalStorage(userId: string): Promise<ProfileData | null> {
    try {
      // Try currentUser first if it matches
      const currentUser = localStorage.getItem('currentUser')
      let baseUserData: any = null

      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser)
          if (userData.id === userId) {
            baseUserData = userData
          }
        } catch (error) {
          console.warn('🔄 ROBUST PROFILE SYNC: Failed to parse currentUser')
        }
      }

      // Check for separate profile fields and merge with base data
      const profileFields = localStorage.getItem(`profileFields_${userId}`)
      if (profileFields) {
        try {
          const fields = JSON.parse(profileFields)
          console.log('✅ ROBUST PROFILE SYNC: Found profile fields:', fields)

          if (baseUserData) {
            // Merge with existing user data
            const mergedData = {
              ...baseUserData,
              department: fields.department || baseUserData.department || '',
              phone: fields.phone || baseUserData.phone || '',
              location: fields.location || baseUserData.location || '',
              display_name: fields.display_name || baseUserData.display_name || baseUserData.name || '',
              bio: fields.bio || baseUserData.bio || ''
            }
            console.log('✅ ROBUST PROFILE SYNC: Merged profile fields with user data')
            return mergedData as ProfileData
          } else {
            // Create basic profile data from fields only
            console.log('✅ ROBUST PROFILE SYNC: Creating profile from fields only (no base user data)')
            const profileData = {
              id: userId,
              email: '',
              name: fields.display_name || '',
              role: 'user',
              department: fields.department || '',
              phone: fields.phone || '',
              location: fields.location || '',
              display_name: fields.display_name || '',
              bio: fields.bio || ''
            }
            return profileData as ProfileData
          }
        } catch (error) {
          console.warn('🔄 ROBUST PROFILE SYNC: Failed to parse profile fields')
        }
      }

      if (baseUserData) {
        console.log('✅ ROBUST PROFILE SYNC: Using base user data only')
        return baseUserData as ProfileData
      }

      // Try individual user profile
      const userProfile = localStorage.getItem(`userProfile_${userId}`)
      if (userProfile) {
        try {
          return JSON.parse(userProfile) as ProfileData
        } catch (error) {
          console.warn('🔄 ROBUST PROFILE SYNC: Failed to parse userProfile')
        }
      }

      // Try systemUsers as last resort
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          const user = users.find((u: any) => u.id === userId)
          if (user) {
            return user as ProfileData
          }
        } catch (error) {
          console.warn('🔄 ROBUST PROFILE SYNC: Failed to parse systemUsers')
        }
      }

      return null

    } catch (error) {
      console.error('🔄 ROBUST PROFILE SYNC: localStorage load failed:', error)
      return null
    }
  }

  /**
   * Trigger UI update events
   */
  private static triggerUpdateEvents(profileData: ProfileData): void {
    try {
      window.dispatchEvent(new Event('userDataUpdated'))
      window.dispatchEvent(new CustomEvent('userProfileUpdated', {
        detail: { userId: profileData.id, profileData }
      }))
      window.dispatchEvent(new CustomEvent('crossDeviceProfileSync', {
        detail: { userId: profileData.id, profile: profileData }
      }))
    } catch (error) {
      console.warn('🔄 ROBUST PROFILE SYNC: Failed to trigger update events:', error)
    }
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get sync status
   */
  static getSyncStatus(): {
    cloudAvailable: boolean
    localStorageMode: boolean
    lastSync: string | null
  } {
    return {
      cloudAvailable: supabaseConfig.isConfigured(),
      localStorageMode: supabaseConfig.isLocalStorageOnly(),
      lastSync: localStorage.getItem('lastProfileSync')
    }
  }

  /**
   * Update last sync timestamp
   */
  static updateLastSyncTime(): void {
    localStorage.setItem('lastProfileSync', new Date().toISOString())
  }
}

export const robustProfileSyncService = RobustProfileSyncService