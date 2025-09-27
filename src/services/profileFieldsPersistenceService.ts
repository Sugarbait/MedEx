import { supabase } from '@/config/supabase'
import { auditLogger } from './auditLogger'

/**
 * Service specifically for handling profile field persistence
 * Fixes the Department, Phone Number, and Location field persistence issues
 */
export class ProfileFieldsPersistenceService {

  /**
   * Validate user ID to prevent undefined/null issues
   */
  static validateUserId(userId: string): boolean {
    if (!userId || userId === 'undefined' || userId === 'null' || typeof userId !== 'string') {
      console.error('🔧 PROFILE PERSISTENCE: Invalid user ID:', userId)
      return false
    }
    return true
  }

  /**
   * Save profile fields to Supabase user_profiles table
   */
  static async saveProfileFields(
    userId: string,
    profileData: {
      name?: string
      display_name?: string
      department?: string
      phone?: string
      bio?: string
      location?: string
    }
  ): Promise<{ status: 'success' | 'error'; error?: string; data?: any }> {
    try {
      // Validate user ID first
      if (!this.validateUserId(userId)) {
        const error = `Invalid user ID: ${userId}. Cannot save profile fields.`
        console.error('🔧 PROFILE PERSISTENCE:', error)
        return { status: 'error', error }
      }

      console.log('🔧 PROFILE PERSISTENCE: Saving profile fields for user:', userId)
      console.log('🔧 PROFILE PERSISTENCE: Fields to save:', {
        department: profileData.department,
        phone: profileData.phone,
        location: profileData.location,
        display_name: profileData.display_name,
        bio: profileData.bio
      })

      await auditLogger.logSecurityEvent('PROFILE_FIELDS_SAVE', 'user_profiles', true, {
        userId,
        fields: Object.keys(profileData)
      })

      // Prepare data for user_profiles table - ensure user_id is a string
      const profileFields = {
        user_id: String(userId), // Explicitly convert to string
        display_name: profileData.display_name || profileData.name || null,
        department: profileData.department || null,
        phone: profileData.phone || null,
        bio: profileData.bio || null,
        location: profileData.location || null,
        updated_at: new Date().toISOString()
      }

      // Remove undefined values and ensure all values are properly typed
      const cleanProfileFields = Object.fromEntries(
        Object.entries(profileFields)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value === null ? null : String(value)])
      )

      console.log('🔧 PROFILE PERSISTENCE: Clean fields for database:', cleanProfileFields)

      // Use UPSERT pattern instead of checking for existing record
      // This is more reliable and handles race conditions better
      console.log('🔧 PROFILE PERSISTENCE: Performing UPSERT operation')
      const { data: upsertData, error: upsertError } = await supabase
        .from('user_profiles')
        .upsert(cleanProfileFields, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()

      if (upsertError) {
        console.error('🔧 PROFILE PERSISTENCE: UPSERT failed:', upsertError)

        // Check if this is an RLS policy error
        if (upsertError.code === '42501' || upsertError.message?.includes('row-level security policy')) {
          console.warn('🔒 PROFILE PERSISTENCE: RLS policy blocking operation - using localStorage fallback')
          // Don't throw error for RLS issues, just fall back to localStorage
          return { status: 'error', error: 'RLS_POLICY_BLOCK', data: null }
        }

        // Try a direct INSERT as fallback for new profiles
        console.log('🔧 PROFILE PERSISTENCE: Trying direct INSERT as fallback')
        const { data: insertData, error: insertError } = await supabase
          .from('user_profiles')
          .insert(cleanProfileFields)
          .select()

        if (insertError) {
          console.error('🔧 PROFILE PERSISTENCE: INSERT fallback also failed:', insertError)

          // Check if INSERT also failed due to RLS
          if (insertError.code === '42501' || insertError.message?.includes('row-level security policy')) {
            console.warn('🔒 PROFILE PERSISTENCE: INSERT also blocked by RLS - using localStorage fallback')
            return { status: 'error', error: 'RLS_POLICY_BLOCK', data: null }
          }

          throw new Error(`Database operation failed: ${upsertError.message}. Fallback failed: ${insertError.message}`)
        }

        console.log('✅ PROFILE PERSISTENCE: Fallback INSERT successful')
        return { status: 'success', data: insertData }
      }

      console.log('✅ PROFILE PERSISTENCE: UPSERT operation successful')
      return { status: 'success', data: upsertData }

    } catch (error: any) {
      console.error('🔧 PROFILE PERSISTENCE: Save failed:', error)

      // Log more details for debugging
      console.error('🔧 PROFILE PERSISTENCE: Error details:', {
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        userId: userId,
        userIdType: typeof userId,
        profileData: profileData
      })

      await auditLogger.logSecurityEvent('PROFILE_FIELDS_SAVE_FAILED', 'user_profiles', false, {
        userId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details
      })

      return { status: 'error', error: `Profile save failed: ${error.message}` }
    }
  }

  /**
   * Load profile fields from Supabase user_profiles table
   */
  static async loadProfileFields(userId: string): Promise<{
    status: 'success' | 'error';
    error?: string;
    data?: {
      display_name?: string
      department?: string
      phone?: string
      bio?: string
      location?: string
    }
  }> {
    try {
      // Validate user ID first
      if (!this.validateUserId(userId)) {
        const error = `Invalid user ID: ${userId}. Cannot load profile fields.`
        console.error('🔧 PROFILE PERSISTENCE:', error)
        return { status: 'error', error }
      }

      console.log('🔧 PROFILE PERSISTENCE: Loading profile fields for user:', userId)

      await auditLogger.logSecurityEvent('PROFILE_FIELDS_LOAD', 'user_profiles', true, { userId })

      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('display_name, department, phone, bio, location, updated_at')
        .eq('user_id', String(userId)) // Ensure user_id is a string
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - this is OK, return empty data
          console.log('🔧 PROFILE PERSISTENCE: No profile found for user, returning empty data')
          return { status: 'success', data: {} }
        }

        // Log additional error details for debugging
        console.error('🔧 PROFILE PERSISTENCE: Load error details:', {
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          userId: userId,
          userIdType: typeof userId
        })

        throw new Error(`Failed to load profile: ${error.message} (Code: ${error.code})`)
      }

      console.log('✅ PROFILE PERSISTENCE: Successfully loaded profile fields:', {
        department: profileData?.department,
        phone: profileData?.phone,
        location: profileData?.location,
        display_name: profileData?.display_name
      })

      return {
        status: 'success',
        data: {
          display_name: profileData?.display_name || '',
          department: profileData?.department || '',
          phone: profileData?.phone || '',
          bio: profileData?.bio || '',
          location: profileData?.location || ''
        }
      }

    } catch (error: any) {
      console.error('🔧 PROFILE PERSISTENCE: Load failed:', error)

      // Log more details for debugging
      console.error('🔧 PROFILE PERSISTENCE: Load error details:', {
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        userId: userId,
        userIdType: typeof userId
      })

      await auditLogger.logSecurityEvent('PROFILE_FIELDS_LOAD_FAILED', 'user_profiles', false, {
        userId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details
      })

      return { status: 'error', error: `Profile load failed: ${error.message}` }
    }
  }

  /**
   * Update localStorage with profile fields for immediate display
   */
  static updateLocalStorageProfileFields(
    userId: string,
    profileData: {
      name?: string
      display_name?: string
      department?: string
      phone?: string
      bio?: string
      location?: string
    }
  ): void {
    try {
      console.log('🔧 PROFILE PERSISTENCE: Updating localStorage with profile fields')

      // Update currentUser if this is the current user
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === userId) {
          Object.assign(userData, profileData)
          userData.updated_at = new Date().toISOString()
          localStorage.setItem('currentUser', JSON.stringify(userData))
          console.log('✅ PROFILE PERSISTENCE: Updated currentUser in localStorage')
        }
      }

      // Update userProfile storage
      const userProfile = localStorage.getItem(`userProfile_${userId}`)
      if (userProfile) {
        const profile = JSON.parse(userProfile)
        Object.assign(profile, profileData)
        profile.updated_at = new Date().toISOString()
        localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile))
        console.log('✅ PROFILE PERSISTENCE: Updated userProfile in localStorage')
      } else {
        // Create new userProfile if it doesn't exist
        const newProfile = {
          id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        }
        localStorage.setItem(`userProfile_${userId}`, JSON.stringify(newProfile))
        console.log('✅ PROFILE PERSISTENCE: Created new userProfile in localStorage')
      }

      // Update systemUsers array
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === userId)
        if (userIndex >= 0) {
          Object.assign(users[userIndex], profileData)
          users[userIndex].updated_at = new Date().toISOString()
          localStorage.setItem('systemUsers', JSON.stringify(users))
          console.log('✅ PROFILE PERSISTENCE: Updated systemUsers in localStorage')
        }
      }

    } catch (error) {
      console.error('🔧 PROFILE PERSISTENCE: Failed to update localStorage:', error)
    }
  }

  /**
   * Complete profile field persistence - saves to both database and localStorage
   */
  static async saveProfileFieldsComplete(
    userId: string,
    profileData: {
      name?: string
      display_name?: string
      department?: string
      phone?: string
      bio?: string
      location?: string
    }
  ): Promise<{ status: 'success' | 'error'; error?: string }> {
    try {
      // Validate user ID first
      if (!this.validateUserId(userId)) {
        const error = `Invalid user ID: ${userId}. Cannot save profile fields.`
        console.error('🔧 PROFILE PERSISTENCE:', error)
        return { status: 'error', error }
      }

      console.log('🔧 PROFILE PERSISTENCE: Starting complete profile field save for user:', userId)

      // Save to Supabase first
      const supabaseResult = await this.saveProfileFields(userId, profileData)

      if (supabaseResult.status === 'error') {
        if (supabaseResult.error === 'RLS_POLICY_BLOCK') {
          console.warn('🔒 PROFILE PERSISTENCE: Supabase blocked by RLS policies - continuing with localStorage only')
        } else {
          console.warn('🔧 PROFILE PERSISTENCE: Supabase save failed, continuing with localStorage only:', supabaseResult.error)
        }
        // Don't fail completely - localStorage save can still work
      } else {
        console.log('✅ PROFILE PERSISTENCE: Supabase save successful')
      }

      // Always update localStorage for immediate display
      this.updateLocalStorageProfileFields(userId, profileData)

      // Trigger UI update events
      window.dispatchEvent(new Event('userDataUpdated'))
      window.dispatchEvent(new CustomEvent('userProfileUpdated', {
        detail: { userId, profileData }
      }))

      console.log('✅ PROFILE PERSISTENCE: Complete profile field save finished')
      return { status: 'success' }

    } catch (error: any) {
      console.error('🔧 PROFILE PERSISTENCE: Complete save failed:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Load profile fields with fallback strategy
   */
  static async loadProfileFieldsComplete(userId: string): Promise<{
    status: 'success' | 'error'
    error?: string
    data?: {
      name?: string
      display_name?: string
      department?: string
      phone?: string
      bio?: string
      location?: string
    }
  }> {
    try {
      // Validate user ID first
      if (!this.validateUserId(userId)) {
        const error = `Invalid user ID: ${userId}. Cannot load profile fields.`
        console.error('🔧 PROFILE PERSISTENCE:', error)
        return { status: 'error', error }
      }

      console.log('🔧 PROFILE PERSISTENCE: Starting complete profile field load for user:', userId)

      // Try Supabase first
      const supabaseResult = await this.loadProfileFields(userId)

      if (supabaseResult.status === 'success' && supabaseResult.data) {
        const hasExtendedFields = supabaseResult.data.department ||
                                  supabaseResult.data.phone ||
                                  supabaseResult.data.location ||
                                  supabaseResult.data.bio

        if (hasExtendedFields) {
          console.log('✅ PROFILE PERSISTENCE: Loaded profile fields from Supabase')

          // Update localStorage with fresh data
          this.updateLocalStorageProfileFields(userId, supabaseResult.data)

          return { status: 'success', data: supabaseResult.data }
        }
      }

      // Fallback to localStorage
      console.log('🔧 PROFILE PERSISTENCE: Falling back to localStorage')

      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser)
          if (userData.id === userId) {
            const localData = {
              name: userData.name,
              display_name: userData.display_name || userData.name,
              department: userData.department || '',
              phone: userData.phone || '',
              bio: userData.bio || '',
              location: userData.location || ''
            }

            console.log('✅ PROFILE PERSISTENCE: Loaded profile fields from localStorage')
            return { status: 'success', data: localData }
          }
        } catch (parseError) {
          console.warn('🔧 PROFILE PERSISTENCE: Failed to parse currentUser data:', parseError)
        }
      }

      // Check userProfile storage
      const userProfile = localStorage.getItem(`userProfile_${userId}`)
      if (userProfile) {
        try {
          const profileData = JSON.parse(userProfile)
          const localData = {
            name: profileData.name,
            display_name: profileData.display_name || profileData.name,
            department: profileData.department || '',
            phone: profileData.phone || '',
            bio: profileData.bio || '',
            location: profileData.location || ''
          }

          console.log('✅ PROFILE PERSISTENCE: Loaded profile fields from userProfile storage')
          return { status: 'success', data: localData }
        } catch (parseError) {
          console.warn('🔧 PROFILE PERSISTENCE: Failed to parse userProfile data:', parseError)
        }
      }

      console.log('🔧 PROFILE PERSISTENCE: No profile data found anywhere')
      return { status: 'success', data: {} }

    } catch (error: any) {
      console.error('🔧 PROFILE PERSISTENCE: Complete load failed:', error)
      return { status: 'error', error: error.message }
    }
  }
}

export const profileFieldsPersistenceService = ProfileFieldsPersistenceService