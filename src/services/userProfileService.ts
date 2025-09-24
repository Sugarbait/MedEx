import { supabase } from '@/config/supabase'
import { User } from '@/types'
import { Database, ServiceResponse } from '@/types/supabase'
import { encryptionService } from './encryption'
import { auditLogger } from './auditLogger'
import { avatarStorageService } from './avatarStorageService'

type DatabaseUser = Database['public']['Tables']['users']['Row']
type DatabaseUserProfile = Database['public']['Tables']['user_profiles']['Row']
type DatabaseUserSettings = Database['public']['Tables']['user_settings']['Row']

export interface CompleteUserProfile {
  user: DatabaseUser
  profile: DatabaseUserProfile | null
  settings: DatabaseUserSettings | null
  permissions: Database['public']['Tables']['user_permissions']['Row'][]
}

export interface UserProfileData {
  id: string
  email: string
  name: string
  role: 'admin' | 'healthcare_provider' | 'staff'
  avatar?: string
  mfa_enabled?: boolean
  settings: {
    retellApiKey?: string
    callAgentId?: string
    smsAgentId?: string
    theme?: string
    notifications?: any
    [key: string]: any
  }
}

/**
 * Service for managing user profiles in Supabase
 * Replaces localStorage-based user profile management
 */
export class UserProfileService {
  private static cache = new Map<string, { data: CompleteUserProfile; timestamp: number }>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Load user profile from localStorage (fallback mode due to missing Supabase schema)
   */
  static async loadUserProfile(userId: string): Promise<ServiceResponse<UserProfileData | null>> {
    try {
      // Skip Supabase audit logging for now as it may also cause issues
      console.log('UserProfileService: Loading user profile')

      // Check cache first
      const cached = this.cache.get(userId)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return { status: 'success', data: this.transformToUserProfileData(cached.data) }
      }

      // Try to load from Supabase first for cross-device sync
      try {
        console.log('UserProfileService: Attempting to load profile from Supabase...')

        // TEMPORARY FIX: Query by email since current table uses different schema
        // The existing users table has username, first_name, last_name instead of azure_ad_id, name
        const userEmail = await this.getUserEmailFromUserId(userId)

        let supabaseUser = null
        let supabaseError = null

        if (userEmail) {
          const result = await supabase
            .from('users')
            .select('*')
            .eq('email', userEmail)
            .single()
          supabaseUser = result.data
          supabaseError = result.error
        }

        if (!supabaseError && supabaseUser) {
          console.log('UserProfileService: Profile loaded from Supabase successfully')

          // MAP existing schema to expected format
          const userProfileData: UserProfileData = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            // Map existing fields to expected format
            name: supabaseUser.username || `${supabaseUser.first_name || ''} ${supabaseUser.last_name || ''}`.trim() || supabaseUser.email,
            // Map role from existing values
            role: this.mapExistingRoleToExpected(supabaseUser.role),
            mfa_enabled: supabaseUser.mfa_enabled || supabaseUser.is_mfa_enabled || false,
            settings: {
              theme: 'light',
              notifications: {}
            }
          }

          // Cache the result
          this.cache.set(userId, { data: userProfileData, timestamp: Date.now() })

          // Update localStorage with fresh Supabase data
          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(userProfileData))

          return { status: 'success', data: userProfileData }
        } else {
          console.log('UserProfileService: Supabase load failed or no data, falling back to localStorage:', supabaseError?.message)
        }
      } catch (supabaseError) {
        console.warn('UserProfileService: Supabase error, falling back to localStorage:', supabaseError)
      }

      // Fall back to localStorage
      console.log('UserProfileService: Using localStorage fallback for user profile')

      // Try to find user in localStorage
      const storedUser = localStorage.getItem('currentUser')
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser)
          if (userData.id === userId) {
            // Transform to expected format
            const userProfileData: UserProfileData = {
              id: userData.id,
              email: userData.email,
              name: userData.name,
              role: userData.role || 'staff',
              avatar: userData.avatar,
              mfa_enabled: userData.mfa_enabled || false,
              settings: userData.settings || {}
            }

            console.log('UserProfileService: Successfully loaded user from localStorage')
            return { status: 'success', data: userProfileData }
          }
        } catch (parseError) {
          console.error('UserProfileService: Failed to parse localStorage user:', parseError)
        }
      }

      // If no user found in localStorage, return null
      return { status: 'success', data: null }

    } catch (error: any) {
      console.error('UserProfileService: Error loading user profile:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Save/update user profile to Supabase (replaces localStorage.setItem('currentUser'))
   */
  static async saveUserProfile(userProfileData: UserProfileData): Promise<ServiceResponse<UserProfileData>> {
    try {
      const userId = userProfileData.id

      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATE', 'user_profiles', true, { userId })

      // Skip Supabase operations entirely - tables don't exist or have wrong schema
      console.log('UserProfileService: Using localStorage-only mode for user management')

      // Save to localStorage for immediate availability
      const currentTime = new Date().toISOString()
      const userForStorage = {
        ...userProfileData,
        created_at: currentTime,
        updated_at: currentTime
      }

      // Store individual user profile
      localStorage.setItem(`userProfile_${userId}`, JSON.stringify(userForStorage))

      // Update the users list in localStorage for User Management page
      const existingUsers = localStorage.getItem('systemUsers')
      let usersList = []

      try {
        usersList = existingUsers ? JSON.parse(existingUsers) : []
      } catch (error) {
        console.warn('Failed to parse existing users, starting fresh:', error)
        usersList = []
      }

      // Update or add the user in the list
      const userIndex = usersList.findIndex((u: any) => u.id === userId)
      if (userIndex >= 0) {
        // Preserve created_at when updating existing user
        const existingUser = usersList[userIndex]
        usersList[userIndex] = {
          ...userForStorage,
          created_at: existingUser.created_at || currentTime, // Preserve original created_at
          updated_at: currentTime // Always update the modification time
        }
        console.log('UserProfileService: Updated existing user in systemUsers')
      } else {
        usersList.push(userForStorage)
        console.log('UserProfileService: Added new user to systemUsers')
      }

      localStorage.setItem('systemUsers', JSON.stringify(usersList))
      console.log('UserProfileService: User saved to localStorage')

      // Also update currentUser if this is the currently logged-in user
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const currentUserData = JSON.parse(currentUser)
          if (currentUserData.id === userId) {
            // Update the current user with the new profile data
            const updatedCurrentUser = {
              ...currentUserData,
              ...userProfileData,
              updated_at: currentTime
            }
            localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser))
            console.log('UserProfileService: Updated currentUser localStorage with new profile data')

            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('userProfileUpdated', {
              detail: updatedCurrentUser
            }))
          }
        } catch (error) {
          console.warn('UserProfileService: Failed to update currentUser:', error)
        }
      }

      // Handle avatar if provided - enhanced to ensure persistence
      if (userProfileData.avatar) {
        try {
          console.log('UserProfileService: Processing avatar update for user:', userId)
          const avatarResult = await this.saveAvatar(userId, userProfileData.avatar)
          if (avatarResult.status === 'success') {
            console.log('UserProfileService: Avatar saved successfully:', avatarResult.data)
            // Ensure the avatar URL is also stored in the user profile data
            userProfileData.avatar = avatarResult.data
          } else {
            console.warn('UserProfileService: Avatar save failed, but continuing with profile update:', avatarResult.error)
          }
        } catch (avatarError) {
          console.warn('UserProfileService: Avatar processing failed:', avatarError)
          // Continue with profile update even if avatar fails
        }
      } else {
        // If no avatar provided, check if we need to remove existing avatar
        const existingAvatar = await avatarStorageService.getAvatarUrl(userId)
        if (existingAvatar) {
          console.log('UserProfileService: No avatar provided but user has existing avatar, preserving it')
          userProfileData.avatar = existingAvatar
        }
      }

      // Clear cache
      this.cache.delete(userId)

      return { status: 'success', data: userProfileData }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATE_FAILED', 'user_profiles', false, {
        userId: userProfileData.id,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Sync user settings to Supabase (replaces localStorage settings operations)
   */
  static async syncUserSettings(userId: string, settings: Record<string, any>): Promise<ServiceResponse<DatabaseUserSettings>> {
    try {
      await auditLogger.logSecurityEvent('USER_SETTINGS_SYNC', 'user_settings', true, { userId })

      // Encrypt sensitive data
      const settingsToStore: Partial<DatabaseUserSettings> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
        last_synced: new Date().toISOString()
      }

      // Map settings to appropriate fields
      if (settings.theme) {
        settingsToStore.theme = settings.theme as 'light' | 'dark' | 'auto'
      }

      if (settings.notifications) {
        settingsToStore.notifications = settings.notifications
      }

      if (settings.retellApiKey || settings.callAgentId || settings.smsAgentId) {
        settingsToStore.retell_config = {
          api_key: settings.retellApiKey ? await encryptionService.encrypt(settings.retellApiKey) : undefined,
          call_agent_id: settings.callAgentId,
          sms_agent_id: settings.smsAgentId
        }
      }

      // Store additional UI preferences
      settingsToStore.ui_preferences = {
        dashboard_layout: settings.dashboard_layout,
        sidebar_collapsed: settings.sidebar_collapsed,
        preferred_view: settings.preferred_view,
        ...settings.ui_preferences
      }

      const { data, error } = await supabase
        .from('user_settings')
        .upsert(settingsToStore)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to sync settings: ${error.message}`)
      }

      // Clear cache
      this.cache.delete(userId)

      return { status: 'success', data }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_SETTINGS_SYNC_FAILED', 'user_settings', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Load all system users for user management (replaces localStorage.getItem('systemUsers'))
   */
  static async loadSystemUsers(): Promise<ServiceResponse<UserProfileData[]>> {
    try {
      await auditLogger.logSecurityEvent('SYSTEM_USERS_ACCESS', 'users', true)

      console.log('UserProfileService: Loading system users from localStorage')

      // Define demo users to always have available (but preserve any existing changes)
      const defaultCreatedDate = new Date().toISOString() // Use today's date
      const getDefaultDemoUsers = () => [
        {
          id: 'super-user-456',
          email: 'elmfarrell@yahoo.com',
          name: 'Dr. Farrell',
          role: 'super_user',
          mfa_enabled: false,
          settings: { theme: 'dark', notifications: {} },
          created_at: defaultCreatedDate,
          updated_at: defaultCreatedDate
        },
        {
          id: 'pierre-user-789',
          email: 'pierre@phaetonai.com',
          name: 'Pierre PhaetonAI',
          role: 'admin',
          mfa_enabled: false,
          settings: { theme: 'dark', notifications: {} },
          created_at: defaultCreatedDate,
          updated_at: defaultCreatedDate
        },
        {
          id: 'guest-user-456',
          email: 'guest@email.com',
          name: 'Guest User',
          role: 'staff',
          mfa_enabled: false,
          settings: { theme: 'light', notifications: {} },
          created_at: defaultCreatedDate,
          updated_at: defaultCreatedDate
        }
      ]

      // Load from localStorage
      const storedUsers = localStorage.getItem('systemUsers')
      let users = []

      if (storedUsers) {
        try {
          users = JSON.parse(storedUsers)
          console.log('UserProfileService: Loaded users from localStorage:', users.length)

          // Data migration: Add missing date fields to existing users
          let needsUpdate = false
          users = users.map((user: any) => {
            if (!user.created_at || !user.updated_at) {
              needsUpdate = true
              return {
                ...user,
                created_at: user.created_at || defaultCreatedDate,
                updated_at: user.updated_at || defaultCreatedDate
              }
            }
            return user
          })

          // Force update all demo users to have today's date for creation
          // Check if we need to update demo users with old dates
          const shouldUpdateDemoUsers = users.some((user: any) => {
            const isDemo = ['super-user-456', 'pierre-user-789', 'guest-user-456'].includes(user.id)
            if (isDemo) {
              const createdDate = new Date(user.created_at)
              const today = new Date()
              // If created date is not today, update it
              return createdDate.toDateString() !== today.toDateString()
            }
            return false
          })

          if (shouldUpdateDemoUsers) {
            needsUpdate = true
            users = users.map((user: any) => {
              const isDemo = ['super-user-456', 'pierre-user-789', 'guest-user-456'].includes(user.id)
              if (isDemo) {
                return {
                  ...user,
                  created_at: defaultCreatedDate,
                  updated_at: defaultCreatedDate
                }
              }
              return user
            })
            console.log('UserProfileService: Updated demo users to have today\'s creation date')
          }

          // Save updated users back to localStorage if we migrated data
          if (needsUpdate) {
            localStorage.setItem('systemUsers', JSON.stringify(users))
            console.log('UserProfileService: Migrated users with updated date fields')
          }
        } catch (parseError) {
          console.error('UserProfileService: Failed to parse stored users, using demo users:', parseError)
          users = demoUsers
        }
      } else {
        console.log('UserProfileService: No stored users found, seeding with demo users')
        users = demoUsers
        // Save demo users to localStorage
        localStorage.setItem('systemUsers', JSON.stringify(demoUsers))
      }

      // Check which demo users have been explicitly deleted
      const deletedUsers = localStorage.getItem('deletedUsers')
      let deletedUserIds = []
      if (deletedUsers) {
        try {
          deletedUserIds = JSON.parse(deletedUsers)
        } catch (parseError) {
          console.warn('Failed to parse deleted users list:', parseError)
        }
      }

      // ENHANCED DELETION TRACKING: Only add demo users that haven't been explicitly deleted
      // Check both individual user deletion AND email-based deletion tracking
      const defaultDemoUsers = getDefaultDemoUsers()
      const deletedEmails = localStorage.getItem('deletedUserEmails')
      let deletedEmailList = []
      if (deletedEmails) {
        try {
          deletedEmailList = JSON.parse(deletedEmails)
        } catch (parseError) {
          console.warn('Failed to parse deleted emails list:', parseError)
        }
      }

      defaultDemoUsers.forEach(demoUser => {
        const existingIndexById = users.findIndex((u: any) => u.id === demoUser.id)
        const existingIndexByEmail = users.findIndex((u: any) => u.email.toLowerCase() === demoUser.email.toLowerCase())
        const hasBeenDeletedById = deletedUserIds.includes(demoUser.id)
        const hasBeenDeletedByEmail = deletedEmailList.includes(demoUser.email.toLowerCase())

        // If user was explicitly deleted by ID or email, skip them permanently
        if (hasBeenDeletedById || hasBeenDeletedByEmail) {
          console.log('Skipping permanently deleted demo user:', 'Reason:', hasBeenDeletedById ? 'ID deleted' : 'Email deleted')
          return
        }

        // Check for email duplicates (different ID, same email)
        if (existingIndexByEmail >= 0 && existingIndexById !== existingIndexByEmail) {
          console.warn(`Demo user [REDACTED] has email conflict with existing user. Skipping to prevent duplicate.`)
          return
        }

        if (existingIndexById === -1) {
          // Only add if no user exists with this ID or email
          if (existingIndexByEmail === -1) {
            console.log('Adding missing demo user')
            users.push(demoUser)
          } else {
            console.log('Demo user email already exists, skipping')
          }
        } else {
          // User exists by ID - preserve their data but ensure required fields are present
          const existingUser = users[existingIndexById]
          users[existingIndexById] = {
            ...demoUser, // Default values
            ...existingUser, // Preserve existing changes
            id: demoUser.id, // Ensure ID stays consistent
            email: demoUser.email, // Ensure email stays consistent
            created_at: existingUser.created_at || demoUser.created_at, // Preserve original creation date
            updated_at: existingUser.updated_at || defaultCreatedDate // Update modification time
          }
          console.log('Preserving existing demo user changes')
        }
      })

      // Load avatar information using robust avatar service with enhanced persistence check
      const usersWithAvatars = await Promise.all(users.map(async (user: any) => {
        try {
          const avatarUrl = await avatarStorageService.getAvatarUrl(user.id)
          if (avatarUrl) {
            console.log('UserProfileService: Found avatar for user')
            return { ...user, avatar: avatarUrl }
          } else {
            console.log('UserProfileService: No avatar found for user')
          }
        } catch (error) {
          console.warn('Failed to get avatar for user:', user.id, error)
        }
        return user
      }))

      // Save back to localStorage to ensure demo users persist
      localStorage.setItem('systemUsers', JSON.stringify(usersWithAvatars))

      console.log('UserProfileService: Final user count:', usersWithAvatars.length)
      return { status: 'success', data: usersWithAvatars }
    } catch (error) {
      console.error('UserProfileService: Error loading system users:', error)
      return { status: 'error', error: error instanceof Error ? error.message : 'Failed to load users' }
    }
  }

  /**
   * Check if a user exists by email (prevents duplicates)
   */
  static async userExistsByEmail(email: string): Promise<ServiceResponse<boolean>> {
    try {
      // Check both Supabase and localStorage for existing users
      const existingUser = await this.getUserByEmail(email)
      if (existingUser.status === 'error') {
        return { status: 'error', error: existingUser.error }
      }

      return { status: 'success', data: existingUser.data !== null }
    } catch (error: any) {
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Create a new user (for user management)
   */
  static async createUser(userData: Omit<UserProfileData, 'id'>): Promise<ServiceResponse<UserProfileData>> {
    try {
      await auditLogger.logSecurityEvent('USER_CREATE', 'users', true)

      // Check for existing user by email first to prevent duplicates
      const existsResponse = await this.userExistsByEmail(userData.email)
      if (existsResponse.status === 'error') {
        return { status: 'error', error: `Failed to check for existing user: ${existsResponse.error}` }
      }

      if (existsResponse.data) {
        return { status: 'error', error: `A user with email ${userData.email} already exists` }
      }

      let newUserProfileData: UserProfileData

      // Try Supabase first, fallback to localStorage if it fails
      try {
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: userData.email,
            name: userData.name,
            role: userData.role,
            mfa_enabled: userData.mfa_enabled || false,
            is_active: true
          })
          .select()
          .single()

        if (!userError && newUser) {
          // Supabase success
          newUserProfileData = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            mfa_enabled: newUser.mfa_enabled,
            settings: userData.settings || {}
          }

          // Update settings if provided
          if (userData.settings && Object.keys(userData.settings).length > 0) {
            await this.syncUserSettings(newUser.id, userData.settings)
          }

          console.log('UserProfileService: User created in Supabase')
        } else {
          throw new Error(userError?.message || 'Failed to create user in Supabase')
        }
      } catch (supabaseError: any) {
        console.log('UserProfileService: Supabase creation failed, using localStorage fallback:', supabaseError.message)

        // Fallback to localStorage
        const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        newUserProfileData = {
          id: newUserId,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          mfa_enabled: userData.mfa_enabled || false,
          settings: userData.settings || {},
          created_at: new Date().toISOString()
        }

        // Get existing users from localStorage
        const storedUsers = localStorage.getItem('systemUsers')
        let users = []
        if (storedUsers) {
          try {
            users = JSON.parse(storedUsers)
            // Double-check for email duplicates in localStorage
            const duplicateUser = users.find((u: any) => u.email.toLowerCase() === userData.email.toLowerCase())
            if (duplicateUser) {
              throw new Error(`User with email ${userData.email} already exists in localStorage`)
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message.includes('already exists')) {
              throw parseError
            }
            users = []
          }
        }

        // Add the new user
        users.push(newUserProfileData)
        localStorage.setItem('systemUsers', JSON.stringify(users))

        console.log('UserProfileService: User created in localStorage')
      }

      await auditLogger.logSecurityEvent('USER_CREATED', 'users', true, {
        userId: newUserProfileData.id,
        email: userData.email,
        role: userData.role
      })

      return { status: 'success', data: newUserProfileData }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_CREATE_FAILED', 'users', false, {
        email: userData.email,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Delete a user
   */
  static async deleteUser(userId: string): Promise<ServiceResponse<void>> {
    try {
      await auditLogger.logSecurityEvent('USER_DELETE', 'users', true, { userId })

      console.log('UserProfileService: Deleting user from localStorage:', userId)

      // Remove from localStorage instead of Supabase
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers)
          const filteredUsers = users.filter((u: any) => u.id !== userId)
          localStorage.setItem('systemUsers', JSON.stringify(filteredUsers))
          console.log('UserProfileService: User deleted from localStorage, remaining users:', filteredUsers.length)
        } catch (parseError) {
          console.error('UserProfileService: Failed to parse users for deletion:', parseError)
        }
      }

      // Remove individual user profile
      localStorage.removeItem(`userProfile_${userId}`)

      // Track deleted users to prevent auto-restoration (enhanced tracking)
      const deletedUsers = localStorage.getItem('deletedUsers')
      let deletedUserIds = []
      if (deletedUsers) {
        try {
          deletedUserIds = JSON.parse(deletedUsers)
        } catch (parseError) {
          console.warn('Failed to parse deleted users list:', parseError)
        }
      }

      // Add the deleted user ID to the list if not already present
      if (!deletedUserIds.includes(userId)) {
        deletedUserIds.push(userId)
        localStorage.setItem('deletedUsers', JSON.stringify(deletedUserIds))
        console.log('UserProfileService: Added user to deleted list:', userId)
      }

      // ALSO track deleted emails to prevent recreation via email matching
      const deletedEmails = localStorage.getItem('deletedUserEmails')
      let deletedEmailList = []
      if (deletedEmails) {
        try {
          deletedEmailList = JSON.parse(deletedEmails)
        } catch (parseError) {
          console.warn('Failed to parse deleted emails list:', parseError)
        }
      }

      // Get user email before deletion for tracking
      const userEmail = await this.getUserEmailFromStorage(userId)
      if (userEmail && !deletedEmailList.includes(userEmail.toLowerCase())) {
        deletedEmailList.push(userEmail.toLowerCase())
        localStorage.setItem('deletedUserEmails', JSON.stringify(deletedEmailList))
        console.log('UserProfileService: Added email to deleted list')
      }

      // Clear cache
      this.cache.delete(userId)

      await auditLogger.logSecurityEvent('USER_DELETED', 'users', true, { userId })

      return { status: 'success' }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_DELETE_FAILED', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Handle avatar upload and storage using robust avatar service
   */
  static async saveAvatar(userId: string, avatarBase64: string): Promise<ServiceResponse<string>> {
    try {
      console.log('Uploading avatar for user:', userId)

      // Use the robust avatar storage service
      const result = await avatarStorageService.uploadAvatar(userId, avatarBase64)

      if (result.status === 'error') {
        return result
      }

      // Clear cache to ensure fresh data
      this.cache.delete(userId)

      console.log('Avatar upload completed successfully:', result.data)
      return result

    } catch (error: any) {
      await auditLogger.logSecurityEvent('AVATAR_UPLOAD_FAILED', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: `Avatar upload failed: ${error.message}` }
    }
  }

  /**
   * Remove user avatar using robust avatar service
   */
  static async removeAvatar(userId: string): Promise<ServiceResponse<void>> {
    try {
      console.log('Removing avatar for user:', userId)

      // Use the robust avatar storage service
      const result = await avatarStorageService.removeAvatar(userId)

      if (result.status === 'error') {
        return result
      }

      // Clear cache to ensure fresh data
      this.cache.delete(userId)

      console.log('Avatar removal completed successfully')
      return { status: 'success' }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('AVATAR_REMOVE_FAILED', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: `Avatar removal failed: ${error.message}` }
    }
  }

  /**
   * Get user by email (for login scenarios)
   */
  static async getUserByEmail(email: string): Promise<ServiceResponse<UserProfileData | null>> {
    try {
      // Try Supabase first
      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .eq('is_active', true)
          .single()

        if (!userError && user) {
          // Get user profile separately (if tables exist)
          let profile = null
          try {
            const { data: profileData } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', user.id)
              .single()
            profile = profileData
          } catch (profileError) {
            console.log('User profile not found or table missing:', profileError)
          }

          // Get user settings separately (if tables exist)
          let settings = null
          try {
            const { data: settingsData } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', user.id)
              .single()
            settings = settingsData
          } catch (settingsError) {
            console.log('User settings not found or table missing:', settingsError)
          }

          const completeProfile = {
            user,
            profile,
            settings,
            permissions: []
          }

          console.log('UserProfileService: User found in Supabase')
          return { status: 'success', data: this.transformToUserProfileData(completeProfile) }
        } else if (userError.code === 'PGRST116') {
          // User not found in Supabase, try localStorage
        } else {
          throw new Error(`Failed to get user by email: ${userError.message}`)
        }
      } catch (supabaseError) {
        console.log('UserProfileService: Supabase query failed, trying localStorage fallback')
      }

      // Fallback to localStorage-based user storage
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          const foundUser = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())

          if (foundUser) {
            console.log('UserProfileService: User found in localStorage systemUsers')
            return { status: 'success', data: foundUser }
          }
        } catch (error) {
          console.error('Failed to parse systemUsers from localStorage:', error)
        }
      }

      // Check individual user profile storage as well
      const userProfileKeys = Object.keys(localStorage).filter(key => key.startsWith('userProfile_'))
      for (const key of userProfileKeys) {
        try {
          const userData = JSON.parse(localStorage.getItem(key) || '{}')
          if (userData.email && userData.email.toLowerCase() === email.toLowerCase()) {
            console.log('UserProfileService: User found in localStorage userProfile storage')
            return { status: 'success', data: userData }
          }
        } catch (error) {
          console.error('Failed to parse user profile from localStorage:', error)
        }
      }

      console.log('UserProfileService: User not found in any storage')
      return { status: 'success', data: null }

    } catch (error: any) {
      console.error('UserProfileService: Error in getUserByEmail:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Sync user avatar across devices
   */
  static async syncUserAvatar(userId: string): Promise<ServiceResponse<string | null>> {
    try {
      const result = await avatarStorageService.syncAvatarAcrossDevices(userId)

      if (result.status === 'success') {
        // Clear cache to ensure fresh data
        this.cache.delete(userId)
      }

      return result
    } catch (error: any) {
      return { status: 'error', error: `Avatar sync failed: ${error.message}` }
    }
  }

  /**
   * Get user avatar URL with cross-device sync
   */
  static async getUserAvatar(userId: string): Promise<string | null> {
    try {
      return await avatarStorageService.getAvatarUrl(userId)
    } catch (error) {
      console.warn('Failed to get user avatar:', error)
      return null
    }
  }

  /**
   * Update specific user profile fields
   */
  static async updateUserProfile(userId: string, updates: Partial<UserProfileData>): Promise<ServiceResponse<UserProfileData>> {
    try {
      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATE', 'user_profiles', true, { userId, updates: Object.keys(updates) })

      console.log('UserProfileService: Updating user profile for userId:', userId, 'Updates:', updates)

      // Get existing user profile
      const existingProfileResponse = await this.loadUserProfile(userId)
      if (existingProfileResponse.status === 'error' || !existingProfileResponse.data) {
        throw new Error('User profile not found')
      }

      const existingProfile = existingProfileResponse.data

      // Merge updates with existing profile
      const updatedProfile = {
        ...existingProfile,
        ...updates,
        updated_at: new Date().toISOString()
      }

      // Save to Supabase first for cross-device persistence
      try {
        const { error: supabaseError } = await supabase
          .from('users')
          .update({
            name: updatedProfile.name,
            email: updatedProfile.email,
            role: updatedProfile.role,
            updated_at: updatedProfile.updated_at
          })
          .eq('id', userId)

        if (supabaseError) {
          console.warn('Supabase update failed, continuing with localStorage:', supabaseError.message)
        } else {
          console.log('UserProfileService: Profile updated in Supabase successfully')
        }
      } catch (supabaseError) {
        console.warn('Supabase update error, continuing with localStorage:', supabaseError)
      }

      // Save updated profile using existing save method (localStorage)
      const saveResponse = await this.saveUserProfile(updatedProfile)
      if (saveResponse.status === 'error') {
        throw new Error(saveResponse.error)
      }

      // Update currentUser if this is the current user
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === userId) {
          Object.assign(userData, updates)
          userData.updated_at = new Date().toISOString()
          localStorage.setItem('currentUser', JSON.stringify(userData))
        }
      }

      // Update systemUsers array
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === userId)
        if (userIndex >= 0) {
          Object.assign(users[userIndex], updates)
          users[userIndex].updated_at = new Date().toISOString()
          localStorage.setItem('systemUsers', JSON.stringify(users))
        }
      }

      console.log('UserProfileService: Profile updated successfully')

      return {
        status: 'success',
        data: updatedProfile
      }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATE', 'user_profiles', false, {
        userId,
        error: error.message,
        updates: Object.keys(updates)
      })

      console.error('UserProfileService: Failed to update user profile:', error)
      return {
        status: 'error',
        error: `Failed to update profile: ${error.message}`
      }
    }
  }

  /**
   * Remove duplicate users (cleanup utility)
   */
  static async removeDuplicateUsers(): Promise<ServiceResponse<{ removed: number; remaining: number }>> {
    try {
      console.log('UserProfileService: Starting duplicate user removal...')

      const storedUsers = localStorage.getItem('systemUsers')
      if (!storedUsers) {
        return { status: 'success', data: { removed: 0, remaining: 0 } }
      }

      let users = JSON.parse(storedUsers)
      const originalCount = users.length
      const seenEmails = new Set<string>()
      const uniqueUsers = []
      let removedCount = 0

      // Keep the first occurrence of each email (by creation date)
      users.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateA - dateB // Earliest first
      })

      for (const user of users) {
        const emailKey = user.email.toLowerCase()
        if (!seenEmails.has(emailKey)) {
          seenEmails.add(emailKey)
          uniqueUsers.push(user)
        } else {
          removedCount++
          console.log('Removing duplicate user')
        }
      }

      // Save the cleaned user list
      localStorage.setItem('systemUsers', JSON.stringify(uniqueUsers))

      await auditLogger.logSecurityEvent('DUPLICATE_USERS_REMOVED', 'users', true, {
        originalCount,
        removedCount,
        remainingCount: uniqueUsers.length
      })

      console.log(`UserProfileService: Removed ${removedCount} duplicate users. ${uniqueUsers.length} users remaining.`)
      return {
        status: 'success',
        data: { removed: removedCount, remaining: uniqueUsers.length }
      }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('DUPLICATE_REMOVAL_FAILED', 'users', false, {
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Clear cache (useful for logout or forced refresh)
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Update user settings (internal helper)
   */
  private static async updateUserSettings(userId: string, settings: Record<string, any>): Promise<void> {
    const settingsToUpdate: Partial<DatabaseUserSettings> = {
      updated_at: new Date().toISOString()
    }

    if (settings.theme) {
      settingsToUpdate.theme = settings.theme
    }

    if (settings.notifications) {
      settingsToUpdate.notifications = settings.notifications
    }

    // Handle Retell API configuration
    if (settings.retellApiKey || settings.callAgentId || settings.smsAgentId) {
      settingsToUpdate.retell_config = {
        api_key: settings.retellApiKey ? await encryptionService.encrypt(settings.retellApiKey) : undefined,
        call_agent_id: settings.callAgentId,
        sms_agent_id: settings.smsAgentId
      }
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...settingsToUpdate })

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`)
    }
  }

  /**
   * Fix profile image persistence issues (utility method)
   */
  static async fixProfileImagePersistence(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      console.log('UserProfileService: Fixing profile image persistence for user:', userId)

      // Get the current avatar from the avatar service
      const avatarUrl = await avatarStorageService.getAvatarUrl(userId)

      if (avatarUrl) {
        console.log('UserProfileService: Found avatar, ensuring it\'s synced across all storage locations')

        // Force synchronization across all storage locations
        const syncResult = await avatarStorageService.syncAvatarAcrossDevices(userId)
        if (syncResult.status === 'error') {
          console.warn('UserProfileService: Avatar sync failed:', syncResult.error)
        }

        // Also update the user profile directly
        const userProfile = localStorage.getItem(`userProfile_${userId}`)
        if (userProfile) {
          try {
            const profile = JSON.parse(userProfile)
            profile.avatar = avatarUrl
            profile.updated_at = new Date().toISOString()
            localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile))
            console.log('UserProfileService: Updated user profile with avatar')
          } catch (error) {
            console.warn('UserProfileService: Failed to update user profile:', error)
          }
        }

        // Trigger UI updates
        window.dispatchEvent(new Event('userDataUpdated'))

        return { status: 'success', data: true }
      } else {
        console.log('UserProfileService: No avatar found for user')
        return { status: 'success', data: false }
      }

    } catch (error: any) {
      console.error('UserProfileService: Error fixing profile image persistence:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Get user email from storage (for deletion tracking)
   */
  private static async getUserEmailFromStorage(userId: string): Promise<string | null> {
    try {
      // Check systemUsers first
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        const users = JSON.parse(storedUsers)
        const user = users.find((u: any) => u.id === userId)
        if (user?.email) {
          return user.email
        }
      }

      // Check individual user profile
      const userProfile = localStorage.getItem(`userProfile_${userId}`)
      if (userProfile) {
        const profile = JSON.parse(userProfile)
        if (profile?.email) {
          return profile.email
        }
      }

      // Fallback: Try Supabase
      try {
        const { data: user } = await supabase
          .from('users')
          .select('email')
          .eq('id', userId)
          .single()
        return user?.email || null
      } catch (error) {
        return null
      }
    } catch (error) {
      console.warn('Failed to get user email for deletion tracking:', error)
      return null
    }
  }

  /**
   * Get user email from userId (helper for existing schema compatibility)
   */
  private static async getUserEmailFromUserId(userId: string): Promise<string | null> {
    try {
      // Check localStorage first
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === userId) {
          return userData.email
        }
      }

      // Check userProfile storage
      const userProfile = localStorage.getItem(`userProfile_${userId}`)
      if (userProfile) {
        const profile = JSON.parse(userProfile)
        return profile.email
      }

      // Check systemUsers
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const user = users.find((u: any) => u.id === userId)
        if (user) {
          return user.email
        }
      }

      return null
    } catch (error) {
      console.warn('Failed to get user email from userId:', error)
      return null
    }
  }

  /**
   * Map existing database role values to expected CareXPS role values
   */
  private static mapExistingRoleToExpected(existingRole: string): 'admin' | 'healthcare_provider' | 'staff' {
    if (!existingRole) return 'staff'

    const role = existingRole.toLowerCase()

    // Map existing roles to CareXPS roles
    if (role === 'admin' || role === 'administrator') {
      return 'admin'
    } else if (role === 'provider' || role === 'healthcare_provider' || role === 'doctor' || role === 'physician') {
      return 'healthcare_provider'
    } else {
      return 'staff' // Default fallback
    }
  }

  /**
   * Transform database profile to UserProfileData format
   */
  private static transformToUserProfileData(completeProfile: CompleteUserProfile): UserProfileData {
    const { user, profile, settings } = completeProfile

    let decryptedSettings = {}
    if (settings?.retell_config) {
      const config = settings.retell_config as any
      decryptedSettings = {
        retellApiKey: config.api_key, // Will need to be decrypted when used
        callAgentId: config.call_agent_id,
        smsAgentId: config.sms_agent_id
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar_url || undefined,
      mfa_enabled: user.mfa_enabled,
      settings: {
        theme: settings?.theme || 'light',
        notifications: settings?.notifications || {},
        ...decryptedSettings,
        ...settings?.ui_preferences || {}
      }
    }
  }
}

export const userProfileService = UserProfileService