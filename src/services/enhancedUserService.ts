import { supabase } from '@/config/supabase'
import { Database, ServiceResponse } from '@/types/supabase'
import { encryptionService } from './encryption'
import { auditLogger } from './auditLogger'
import { apiKeyFallbackService } from './apiKeyFallbackService'

type DatabaseUser = Database['public']['Tables']['users']['Row']
type DatabaseUserProfile = Database['public']['Tables']['user_profiles']['Row']
type DatabaseUserSettings = Database['public']['Tables']['user_settings']['Row']

export interface EnhancedUserProfile {
  id: string
  email: string
  name: string
  role: 'admin' | 'healthcare_provider' | 'staff' | 'super_user'
  is_super_user: boolean
  is_enabled: boolean
  profile_status: 'enabled' | 'disabled' | 'suspended' | 'pending'
  profile: {
    display_name?: string
    first_name?: string
    last_name?: string
    department?: string
    phone?: string
    is_active: boolean
    encrypted_retell_api_key?: string
    encrypted_agent_config?: any
  }
  settings: {
    theme?: string
    profile_name?: string
    profile_first_name?: string
    profile_last_name?: string
    encrypted_api_keys?: any
    retell_config?: any
    settings_version?: number
    sync_status?: string
  }
  super_user_permissions?: string[]
  created_at: string
  updated_at: string
}

/**
 * Enhanced User Service for comprehensive user management
 * Handles super user roles, profile status, and data persistence
 */
export class EnhancedUserService {

  /**
   * Get user with complete profile information
   */
  static async getCompleteUserProfile(userId: string): Promise<ServiceResponse<EnhancedUserProfile | null>> {
    try {
      console.log(`EnhancedUserService: Getting complete profile for user ${userId}`)

      // Get user data with all related information
      const { data, error } = await supabase
        .from('user_management_view')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Database query error:', error)
        throw error
      }

      if (!data) {
        console.log('EnhancedUserService: User not found')
        return { status: 'success', data: null }
      }

      // Transform the data to our enhanced format
      const enhancedProfile: EnhancedUserProfile = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role as any,
        is_super_user: data.is_super_user || false,
        is_enabled: data.is_enabled || false,
        profile_status: data.profile_status as any || 'disabled',
        profile: {
          display_name: data.display_name,
          first_name: data.first_name,
          last_name: data.last_name,
          department: data.department,
          phone: data.phone,
          is_active: data.profile_active || false,
          encrypted_retell_api_key: data.encrypted_retell_api_key,
          encrypted_agent_config: data.encrypted_agent_config
        },
        settings: {
          theme: data.theme,
          profile_name: data.profile_name,
          profile_first_name: data.profile_first_name,
          profile_last_name: data.profile_last_name,
          encrypted_api_keys: data.encrypted_api_keys,
          retell_config: data.retell_config,
          settings_version: data.settings_version,
          sync_status: data.sync_status
        },
        super_user_permissions: data.super_user_permissions || [],
        created_at: data.created_at,
        updated_at: data.updated_at
      }

      console.log('EnhancedUserService: Successfully retrieved user profile')
      return { status: 'success', data: enhancedProfile }

    } catch (error: any) {
      console.error('EnhancedUserService: Error getting complete user profile:', error)

      // Fallback to basic user lookup
      try {
        const fallbackData = await this.getFallbackUserData(userId)
        return { status: 'success', data: fallbackData }
      } catch (fallbackError) {
        return { status: 'error', error: error.message || 'Failed to get user profile' }
      }
    }
  }

  /**
   * Fallback method to get user data from individual tables
   */
  private static async getFallbackUserData(userId: string): Promise<EnhancedUserProfile | null> {
    console.log('EnhancedUserService: Using fallback method')

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      throw new Error('User not found in fallback')
    }

    // Get profile data (optional)
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Get settings data (optional)
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role as any,
      is_super_user: userData.is_super_user || false,
      is_enabled: userData.is_enabled || false,
      profile_status: userData.profile_status as any || 'disabled',
      profile: {
        display_name: profileData?.display_name,
        first_name: profileData?.first_name,
        last_name: profileData?.last_name,
        department: profileData?.department || (settingsData?.retell_config ? (() => {
          try { return JSON.parse(settingsData.retell_config)?.fallback_department } catch { return undefined }
        })() : undefined),
        phone: profileData?.phone,
        is_active: profileData?.is_active || false,
        encrypted_retell_api_key: profileData?.encrypted_retell_api_key,
        encrypted_agent_config: profileData?.encrypted_agent_config
      },
      settings: {
        theme: settingsData?.theme,
        profile_name: settingsData?.profile_name,
        profile_first_name: settingsData?.profile_first_name,
        profile_last_name: settingsData?.profile_last_name,
        encrypted_api_keys: settingsData?.encrypted_api_keys,
        retell_config: settingsData?.retell_config,
        settings_version: settingsData?.settings_version || 1,
        sync_status: settingsData?.sync_status || 'synced'
      },
      super_user_permissions: [],
      created_at: userData.created_at,
      updated_at: userData.updated_at
    }
  }

  /**
   * Update user profile with persistence fixes
   */
  static async updateUserProfile(
    userId: string,
    profileUpdates: {
      name?: string
      first_name?: string
      last_name?: string
      display_name?: string
      department?: string
      phone?: string
    }
  ): Promise<ServiceResponse<boolean>> {
    try {
      console.log(`EnhancedUserService: Updating profile for user ${userId}`)

      // Update users table
      if (profileUpdates.name) {
        const { error: userError } = await supabase
          .from('users')
          .update({
            name: profileUpdates.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (userError) throw userError
      }

      // Update user_profiles table with graceful fallback for missing columns
      const profileData: any = {
        updated_at: new Date().toISOString()
      }

      // Collect fields that might not exist in the schema
      const potentiallyMissingFields: any = {}

      if (profileUpdates.display_name !== undefined) potentiallyMissingFields.display_name = profileUpdates.display_name
      if (profileUpdates.first_name !== undefined) potentiallyMissingFields.first_name = profileUpdates.first_name
      if (profileUpdates.last_name !== undefined) potentiallyMissingFields.last_name = profileUpdates.last_name
      if (profileUpdates.department !== undefined) potentiallyMissingFields.department = profileUpdates.department

      // Phone is likely to exist, add it to profileData directly
      if (profileUpdates.phone !== undefined) profileData.phone = profileUpdates.phone

      // Try to update user_profiles with all fields first
      let profileError = null
      let fieldsToRemove: string[] = []

      try {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: userId,
            ...profileData,
            ...potentiallyMissingFields
          })

        profileError = error
      } catch (error: any) {
        profileError = error
      }

      // If there's a schema error, identify which columns don't exist
      if (profileError && profileError.message) {
        console.log('Profile update error:', profileError.message)

        // Check for schema cache errors indicating missing columns
        if (profileError.message.includes('Could not find') && profileError.message.includes('column')) {
          // Check for each potentially missing field in the error message
          for (const field of Object.keys(potentiallyMissingFields)) {
            if (profileError.message.includes(`'${field}'`)) {
              fieldsToRemove.push(field)
              console.log(`Field '${field}' not found in user_profiles table`)
            }
          }

          // If no specific fields identified but it's a schema error, remove all potentially missing fields
          if (fieldsToRemove.length === 0) {
            fieldsToRemove = Object.keys(potentiallyMissingFields)
            console.log('Schema error detected, removing all potentially missing fields:', fieldsToRemove)
          }
        }

        // If we identified missing fields, retry without them
        if (fieldsToRemove.length > 0) {
          const safeProfileData = { ...profileData }
          const fallbackData: any = {}

          // Add only the fields that exist to safeProfileData
          for (const [key, value] of Object.entries(potentiallyMissingFields)) {
            if (!fieldsToRemove.includes(key)) {
              safeProfileData[key] = value
            } else {
              fallbackData[key] = value
            }
          }

          // Retry with only existing columns (skip if no safe fields remain)
          if (Object.keys(safeProfileData).length > 1) { // More than just updated_at
            const { error: retryError } = await supabase
              .from('user_profiles')
              .upsert({
                user_id: userId,
                ...safeProfileData
              })

            if (retryError) {
              console.error('Failed to update user_profiles even with safe fields:', retryError)
              throw retryError
            }
          } else {
            console.log('No safe fields to update in user_profiles, skipping database update')
          }

          // Store missing fields in user_settings as fallback
          if (Object.keys(fallbackData).length > 0) {
            console.log('Storing missing fields in user_settings:', Object.keys(fallbackData))

            const settingsFallback: any = {
              user_id: userId,
              updated_at: new Date().toISOString()
            }

            // Store display_name and other missing profile fields
            if (fallbackData.display_name) settingsFallback.profile_display_name = fallbackData.display_name
            if (fallbackData.first_name) settingsFallback.profile_first_name = fallbackData.first_name
            if (fallbackData.last_name) settingsFallback.profile_last_name = fallbackData.last_name
            if (fallbackData.department) {
              settingsFallback.retell_config = JSON.stringify({
                fallback_department: fallbackData.department
              })
            }

            const { error: settingsError } = await supabase
              .from('user_settings')
              .upsert(settingsFallback)

            if (settingsError) {
              console.warn('Could not store fallback data in user_settings:', settingsError)
              // Don't throw - fallback storage is not critical
            }
          }
        } else if (profileError) {
          // Some other error occurred, not a schema issue
          throw profileError
        }
      }

      // Update user_settings table for profile name persistence
      const settingsData: any = {
        updated_at: new Date().toISOString()
      }

      if (profileUpdates.name) settingsData.profile_name = profileUpdates.name
      if (profileUpdates.first_name) settingsData.profile_first_name = profileUpdates.first_name
      if (profileUpdates.last_name) settingsData.profile_last_name = profileUpdates.last_name

      if (Object.keys(settingsData).length > 1) { // More than just updated_at
        const { error: settingsError } = await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            ...settingsData
          })

        if (settingsError) throw settingsError
      }

      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATED', 'users', true, {
        userId,
        updatedFields: Object.keys(profileUpdates)
      })

      console.log('EnhancedUserService: Profile updated successfully')
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedUserService: Error updating profile:', error)
      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATE_FAILED', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: error.message || 'Failed to update profile' }
    }
  }

  /**
   * Update user API keys with persistence fixes
   */
  static async updateUserApiKeys(
    userId: string,
    apiKeys: {
      retell_api_key?: string
      call_agent_id?: string
      sms_agent_id?: string
      phone_number?: string
    }
  ): Promise<ServiceResponse<boolean>> {
    try {
      console.log(`EnhancedUserService: Updating API keys for user ${userId}`)

      // Use the fallback service to handle API key storage
      // This automatically detects schema issues and uses the best available storage method
      const fallbackResult = await apiKeyFallbackService.storeApiKeys(userId, apiKeys)
      if (fallbackResult.status === 'error') {
        throw new Error(fallbackResult.error || 'Failed to store API keys')
      }

      console.log('EnhancedUserService: API keys stored successfully via fallback service')

      await auditLogger.logSecurityEvent('USER_API_KEYS_UPDATED', 'user_settings', true, {
        userId,
        keysUpdated: Object.keys(apiKeys)
      })

      console.log('EnhancedUserService: API keys updated successfully')
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedUserService: Error updating API keys:', error)
      await auditLogger.logSecurityEvent('USER_API_KEYS_UPDATE_FAILED', 'user_settings', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: error.message || 'Failed to update API keys' }
    }
  }

  /**
   * Get decrypted API keys for a user using the fallback service
   */
  static async getUserApiKeys(userId: string): Promise<ServiceResponse<{
    retell_api_key?: string
    call_agent_id?: string
    sms_agent_id?: string
  }>> {
    try {
      console.log(`EnhancedUserService: Getting API keys for user ${userId}`)

      // Use the fallback service to handle API key retrieval
      // This automatically detects schema issues and uses the best available retrieval method
      const fallbackResult = await apiKeyFallbackService.retrieveApiKeys(userId)

      if (fallbackResult.status === 'error') {
        throw new Error(fallbackResult.error || 'Failed to retrieve API keys')
      }

      console.log('EnhancedUserService: API keys retrieved successfully via fallback service')
      return {
        status: 'success',
        data: fallbackResult.data || {}
      }

    } catch (error: any) {
      console.error('EnhancedUserService: Error getting API keys:', error)
      return { status: 'error', error: error.message || 'Failed to get API keys' }
    }
  }

  /**
   * Set user profile status (enable/disable)
   */
  static async setUserProfileStatus(
    userId: string,
    enabled: boolean,
    reason?: string,
    performedBy?: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      console.log(`EnhancedUserService: Setting profile status for user ${userId} to ${enabled ? 'enabled' : 'disabled'}`)

      // Use the stored function for atomic update
      const { error } = await supabase.rpc('set_user_profile_status', {
        p_user_id: userId,
        p_enabled: enabled,
        p_reason: reason || null,
        p_performed_by: performedBy || null
      })

      if (error) throw error

      console.log('EnhancedUserService: Profile status updated successfully')
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedUserService: Error setting profile status:', error)
      return { status: 'error', error: error.message || 'Failed to set profile status' }
    }
  }

  /**
   * Grant super user privileges
   */
  static async grantSuperUserPrivileges(
    userId: string,
    grantedBy: string,
    permissions: string[] = ['user_management', 'system_settings', 'audit_access']
  ): Promise<ServiceResponse<boolean>> {
    try {
      console.log(`EnhancedUserService: Granting super user privileges to ${userId}`)

      // Use the stored function for atomic update
      const { data, error } = await supabase.rpc('grant_super_user_privileges', {
        p_user_id: userId,
        p_granted_by: grantedBy,
        p_permissions: permissions
      })

      if (error) throw error

      console.log('EnhancedUserService: Super user privileges granted successfully')
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedUserService: Error granting super user privileges:', error)
      return { status: 'error', error: error.message || 'Failed to grant super user privileges' }
    }
  }

  /**
   * Revoke super user privileges
   */
  static async revokeSuperUserPrivileges(
    userId: string,
    revokedBy: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      console.log(`EnhancedUserService: Revoking super user privileges from ${userId}`)

      // Use the stored function for atomic update
      const { data, error } = await supabase.rpc('revoke_super_user_privileges', {
        p_user_id: userId,
        p_revoked_by: revokedBy
      })

      if (error) throw error

      console.log('EnhancedUserService: Super user privileges revoked successfully')
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('EnhancedUserService: Error revoking super user privileges:', error)
      return { status: 'error', error: error.message || 'Failed to revoke super user privileges' }
    }
  }

  /**
   * Get all users for management (super users only)
   */
  static async getAllUsersForManagement(): Promise<ServiceResponse<EnhancedUserProfile[]>> {
    try {
      console.log('EnhancedUserService: Getting all users for management')

      const { data, error } = await supabase
        .from('user_management_view')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const users: EnhancedUserProfile[] = (data || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_super_user: user.is_super_user || false,
        is_enabled: user.is_enabled || false,
        profile_status: user.profile_status || 'disabled',
        profile: {
          display_name: user.display_name,
          first_name: user.first_name,
          last_name: user.last_name,
          department: user.department,
          phone: user.phone,
          is_active: user.profile_active || false,
          encrypted_retell_api_key: user.encrypted_retell_api_key,
          encrypted_agent_config: user.encrypted_agent_config
        },
        settings: {
          theme: user.theme,
          profile_name: user.profile_name,
          profile_first_name: user.profile_first_name,
          profile_last_name: user.profile_last_name,
          encrypted_api_keys: user.encrypted_api_keys,
          retell_config: user.retell_config,
          settings_version: user.settings_version,
          sync_status: user.sync_status
        },
        super_user_permissions: user.super_user_permissions || [],
        created_at: user.created_at,
        updated_at: user.updated_at
      }))

      return { status: 'success', data: users }

    } catch (error: any) {
      console.error('EnhancedUserService: Error getting all users:', error)
      return { status: 'error', error: error.message || 'Failed to get users' }
    }
  }

  /**
   * Create a new user with default disabled status
   */
  static async createUser(userData: {
    email: string
    name: string
    role?: 'admin' | 'healthcare_provider' | 'staff'
    first_name?: string
    last_name?: string
    department?: string
    phone?: string
  }): Promise<ServiceResponse<string>> {
    try {
      console.log(`EnhancedUserService: Creating new user ${userData.email}`)

      // Generate a unique user ID
      const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2)}`

      // Create user in users table (disabled by default)
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: userData.email,
          name: userData.name,
          role: userData.role || 'staff',
          is_enabled: false, // New users disabled by default
          profile_status: 'disabled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (userError) throw userError

      // Create user profile (inactive by default)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          display_name: userData.name,
          first_name: userData.first_name,
          last_name: userData.last_name,
          department: userData.department,
          phone: userData.phone,
          role: userData.role || 'staff',
          is_active: false, // New profiles inactive by default
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (profileError) throw profileError

      // Create default user settings
      const { error: settingsError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          theme: 'light',
          profile_name: userData.name,
          profile_first_name: userData.first_name,
          profile_last_name: userData.last_name,
          settings_version: 1,
          sync_status: 'synced',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (settingsError) throw settingsError

      await auditLogger.logSecurityEvent('USER_CREATED', 'users', true, {
        userId,
        email: userData.email,
        role: userData.role
      })

      console.log('EnhancedUserService: User created successfully')
      return { status: 'success', data: userId }

    } catch (error: any) {
      console.error('EnhancedUserService: Error creating user:', error)
      await auditLogger.logSecurityEvent('USER_CREATE_FAILED', 'users', false, {
        email: userData.email,
        error: error.message
      })
      return { status: 'error', error: error.message || 'Failed to create user' }
    }
  }

  /**
   * Helper method to get next settings version
   */
  private static async getNextSettingsVersion(userId: string): Promise<number> {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('settings_version')
        .eq('user_id', userId)
        .single()

      return (data?.settings_version || 0) + 1
    } catch {
      return 1
    }
  }

  /**
   * Update user settings using the safe conflict resolution function
   */
  static async updateUserSettingsSafe(
    userId: string,
    settings: any,
    clientVersion?: number
  ): Promise<ServiceResponse<{
    success: boolean
    conflict: boolean
    version: number
    settings: any
  }>> {
    try {
      console.log(`EnhancedUserService: Updating user settings safely for ${userId}`)

      const { data, error } = await supabase.rpc('update_user_settings_safe', {
        p_user_id: userId,
        p_settings: settings,
        p_client_version: clientVersion
      })

      if (error) throw error

      return { status: 'success', data }

    } catch (error: any) {
      console.error('EnhancedUserService: Error updating settings safely:', error)
      return { status: 'error', error: error.message || 'Failed to update settings' }
    }
  }
}

export const enhancedUserService = EnhancedUserService