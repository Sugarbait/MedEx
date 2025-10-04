import { supabase } from '@/config/supabase'
import { User } from '@/types'
import { Database, ServiceResponse } from '@/types/supabase'
import { encryptionService } from './encryption'
import { auditLogger } from './auditLogger'
import { avatarStorageService } from './avatarStorageService'
import { getCurrentTenantId } from '@/config/tenantConfig'

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
  role: 'admin' | 'super_user' | 'healthcare_provider' | 'staff' | 'user'
  avatar?: string
  mfa_enabled?: boolean
  isActive?: boolean // User activation status (for pending approvals)
  // Extended profile fields
  department?: string
  phone?: string
  bio?: string
  location?: string
  display_name?: string
  settings: {
    retellApiKey?: string
    callAgentId?: string
    smsAgentId?: string
    theme?: string
    notifications?: any
    [key: string]: any
  }
  // Cross-device sync metadata
  lastSynced?: string
  deviceId?: string
  syncEnabled?: boolean
  // Database fields
  created_at?: string
  updated_at?: string
  lastLogin?: string // Add lastLogin field
  // Local only flag
  _localOnly?: boolean
}

interface ProfileSyncEvent {
  eventType: 'profile_updated' | 'avatar_changed' | 'settings_synced' | 'mfa_changed'
  userId: string
  deviceId?: string
  data: any
  timestamp: string
}

/**
 * Service for managing user profiles with cross-device synchronization
 * Integrates with Supabase for cloud sync and real-time updates
 */
export class UserProfileService {
  private static cache = new Map<string, { data: CompleteUserProfile; timestamp: number; deviceId?: string }>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private static currentDeviceId: string | null = null
  private static syncListeners = new Map<string, ((event: ProfileSyncEvent) => void)[]>()
  private static realtimeChannels = new Map<string, any>()

  /**
   * Initialize cross-device profile sync
   */
  static async initializeCrossDeviceProfileSync(userId: string, deviceId?: string): Promise<{ success: boolean; deviceId: string }> {
    try {
      const finalDeviceId = deviceId || this.generateDeviceId()
      this.currentDeviceId = finalDeviceId

      // Subscribe to profile changes
      await this.subscribeToProfileChanges(userId)

      console.log(`🔄 PROFILE SYNC: Initialized for user ${userId} on device ${finalDeviceId}`)
      return { success: true, deviceId: finalDeviceId }
    } catch (error) {
      console.error('Failed to initialize profile sync:', error)
      return { success: false, deviceId: deviceId || '' }
    }
  }

  /**
   * Generate device ID for profile sync
   */
  private static generateDeviceId(): string {
    const stored = localStorage.getItem('carexps_device_id')
    if (stored) return stored

    const deviceId = `device_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`
    localStorage.setItem('carexps_device_id', deviceId)
    return deviceId
  }

  /**
   * Subscribe to real-time profile changes
   */
  private static async subscribeToProfileChanges(userId: string): Promise<void> {
    try {
      if (!supabase) return

      const channel = supabase
        .channel(`profile-sync-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`
          },
          async (payload) => {
            await this.handleProfileChange(payload, userId)
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            await this.handleSettingsChange(payload, userId)
          }
        )
        .subscribe()

      this.realtimeChannels.set(userId, channel)
      console.log('🔄 Subscribed to profile changes')
    } catch (error) {
      console.error('Failed to subscribe to profile changes:', error)
    }
  }

  /**
   * Handle profile changes from other devices
   */
  private static async handleProfileChange(payload: any, userId: string): Promise<void> {
    try {
      if (payload.eventType === 'UPDATE' && payload.new) {
        console.log('📥 PROFILE SYNC: Received profile update from another device')

        // Clear cache to ensure fresh data
        this.cache.delete(userId)

        // Notify listeners
        const listeners = this.syncListeners.get(userId) || []
        const event: ProfileSyncEvent = {
          eventType: 'profile_updated',
          userId,
          deviceId: 'remote',
          data: payload.new,
          timestamp: new Date().toISOString()
        }

        listeners.forEach(listener => listener(event))

        // Update localStorage
        const updatedProfile = this.transformDatabaseUserToProfile(payload.new)
        if (updatedProfile) {
          localStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedProfile))
          localStorage.setItem('currentUser', JSON.stringify(updatedProfile))

          // Dispatch UI update event
          window.dispatchEvent(new CustomEvent('crossDeviceProfileSync', {
            detail: { userId, profile: updatedProfile }
          }))
        }
      }
    } catch (error) {
      console.error('Error handling profile change:', error)
    }
  }

  /**
   * Handle settings changes from other devices
   */
  private static async handleSettingsChange(payload: any, userId: string): Promise<void> {
    try {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        console.log('📥 PROFILE SYNC: Received settings update from another device')

        // Notify listeners
        const listeners = this.syncListeners.get(userId) || []
        const event: ProfileSyncEvent = {
          eventType: 'settings_synced',
          userId,
          deviceId: 'remote',
          data: payload.new,
          timestamp: new Date().toISOString()
        }

        listeners.forEach(listener => listener(event))
      }
    } catch (error) {
      console.error('Error handling settings change:', error)
    }
  }

  /**
   * Transform database user to profile format
   */
  private static transformDatabaseUserToProfile(dbUser: any): UserProfileData | null {
    try {
      // CRITICAL FIX: Use original_role from metadata if available (super_user stored as admin in DB)
      // Otherwise, map the database role back to application format
      const applicationRole = dbUser.metadata?.original_role || this.mapExistingRoleToExpected(dbUser.role)

      console.log(`🔄 ROLE MAPPING: DB role="${dbUser.role}", metadata.original_role="${dbUser.metadata?.original_role}", final="${applicationRole}"`)

      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: applicationRole,
        avatar: dbUser.avatar_url,
        mfa_enabled: dbUser.mfa_enabled,
        settings: {
          theme: 'light',
          notifications: {}
        },
        lastSynced: new Date().toISOString(),
        deviceId: this.currentDeviceId || undefined,
        syncEnabled: true
      }
    } catch (error) {
      console.error('Error transforming database user:', error)
      return null
    }
  }

  /**
   * Load user profile with cross-device sync support
   */
  static async loadUserProfile(userId: string, options?: {
    forceCloudSync?: boolean,
    deviceId?: string
  }): Promise<ServiceResponse<UserProfileData | null>> {
    try {
      // Skip Supabase audit logging for now as it may also cause issues
      console.log('UserProfileService: Loading user profile')

      // Check cache first with Azure-compatible validation
      const cached = this.cache.get(userId)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        try {
          // Validate cached data before transformation
          if (cached.data && (cached.data.id || cached.data.user?.id)) {
            return { status: 'success', data: this.transformToUserProfileData(cached.data) }
          } else {
            console.warn('UserProfileService: Invalid cached data, clearing cache')
            this.cache.delete(userId)
          }
        } catch (cacheError) {
          console.warn('UserProfileService: Cache transformation failed, clearing cache:', cacheError)
          this.cache.delete(userId)
        }
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

          // Load extended profile information from user_profiles table
          let extendedProfile = null
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', supabaseUser.id)
              .single()

            if (!profileError && profileData) {
              extendedProfile = profileData
              console.log('UserProfileService: Extended profile loaded from user_profiles table')
            } else {
              console.log('UserProfileService: No extended profile found, using basic data only')
            }
          } catch (error) {
            console.warn('UserProfileService: Failed to load extended profile:', error)
          }

          // MAP existing schema to expected format with extended profile data
          const userProfileData: UserProfileData = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            // Map existing fields to expected format - CHECK supabaseUser.name FIRST before falling back
            name: supabaseUser.name || supabaseUser.username || `${supabaseUser.first_name || ''} ${supabaseUser.last_name || ''}`.trim() || supabaseUser.email,
            // Map role from existing values
            role: this.mapExistingRoleToExpected(supabaseUser.role),
            mfa_enabled: supabaseUser.mfa_enabled || supabaseUser.is_mfa_enabled || false,
            // Include extended profile fields
            department: extendedProfile?.department || '',
            phone: extendedProfile?.phone || '',
            bio: extendedProfile?.bio || '',
            location: extendedProfile?.location || '',
            display_name: extendedProfile?.display_name || supabaseUser.name || '',
            settings: {
              theme: 'light',
              notifications: {}
            }
          }

          // CRITICAL: Hard-coded Super User enforcement for specific emails
          if (userProfileData.email === 'pierre@phaetonai.com' ||
              userProfileData.email === 'elmfarrell@yahoo.com' ||
              userProfileData.email === 'admin@phaetonai.com') {
            userProfileData.role = 'super_user'
            console.log(`🔐 HARD-CODED SUPER USER: Enforced super_user role for ${userProfileData.email}`)
          }

          // Cache the result
          this.cache.set(userId, { data: userProfileData as any, timestamp: Date.now() })

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
            // Transform to expected format including extended profile fields
            const userProfileData: UserProfileData = {
              id: userData.id,
              email: userData.email,
              name: userData.name,
              role: userData.role || 'staff',
              avatar: userData.avatar,
              mfa_enabled: userData.mfa_enabled || false,
              // Include extended profile fields from localStorage
              department: userData.department || '',
              phone: userData.phone || '',
              bio: userData.bio || '',
              location: userData.location || '',
              display_name: userData.display_name || userData.name || '',
              settings: userData.settings || {}
            }

            // CRITICAL: Hard-coded Super User enforcement for specific emails
            if (userProfileData.email === 'pierre@phaetonai.com' ||
                userProfileData.email === 'elmfarrell@yahoo.com' ||
                userProfileData.email === 'admin@phaetonai.com') {
              userProfileData.role = 'super_user'
              console.log(`🔐 HARD-CODED SUPER USER: Enforced super_user role for ${userProfileData.email} (localStorage)`)
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
   * Save/update user profile with cross-device sync
   */
  static async saveUserProfile(
    userProfileData: UserProfileData,
    options?: {
      deviceId?: string,
      broadcastToOtherDevices?: boolean,
      syncToCloud?: boolean
    }
  ): Promise<ServiceResponse<UserProfileData>> {
    try {
      const userId = userProfileData.id

      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATE', 'user_profiles', true, { userId })

      // Skip Supabase operations entirely - tables don't exist or have wrong schema
      console.log('UserProfileService: Using localStorage-only mode for user management')

      // Add cross-device sync metadata
      const currentTime = new Date().toISOString()
      const deviceId = options?.deviceId || this.currentDeviceId || 'unknown'
      const userForStorage = {
        ...userProfileData,
        created_at: currentTime,
        updated_at: currentTime,
        lastSynced: currentTime,
        deviceId,
        syncEnabled: options?.syncToCloud !== false
      }

      // Try to save to Supabase first if requested
      if (options?.syncToCloud !== false) {
        try {
          // Map role for database compatibility
          const dbRole = this.mapRoleForDatabase(userProfileData.role)

          const { error } = await supabase
            .from('users')
            .upsert({
              id: userProfileData.id,
              email: userProfileData.email,
              name: userProfileData.name,
              role: dbRole, // Use mapped role for database
              mfa_enabled: userProfileData.mfa_enabled || false,
              avatar_url: userProfileData.avatar,
              azure_ad_id: `placeholder_${userProfileData.id}_${Date.now()}`, // Required by schema
              updated_at: currentTime,
              is_active: true,
              metadata: {
                original_role: userProfileData.role,
                updated_via: 'profile_service'
              }
            }, { onConflict: 'id' })

          if (error) {
            console.warn('Supabase profile save failed, continuing with localStorage:', error.message)
          } else {
            console.log('✅ Profile saved to Supabase successfully')

            // Notify sync listeners
            const listeners = this.syncListeners.get(userId) || []
            const event: ProfileSyncEvent = {
              eventType: 'profile_updated',
              userId,
              deviceId,
              data: userForStorage,
              timestamp: currentTime
            }
            listeners.forEach(listener => listener(event))
          }
        } catch (supabaseError) {
          console.warn('Supabase profile save error:', supabaseError)
        }
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

      // Update cache with sync metadata
      this.cache.set(userId, {
        data: userForStorage as any,
        timestamp: Date.now(),
        deviceId
      })

      // Broadcast to other devices if enabled
      if (options?.broadcastToOtherDevices !== false) {
        console.log('📡 PROFILE SYNC: Changes will be broadcasted to other devices')
      }

      return { status: 'success', data: userForStorage }

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
   * Load all system users for user management with cross-device sync support
   */
  static async loadSystemUsers(): Promise<ServiceResponse<UserProfileData[]>> {
    try {
      await auditLogger.logSecurityEvent('SYSTEM_USERS_ACCESS', 'users', true)

      console.log('UserProfileService: Loading system users with cross-device sync support')

      let allUsers: UserProfileData[] = []

      // Try to load from Supabase first for cross-device sync
      try {
        const currentTenantId = getCurrentTenantId()
        console.log('🔄 Loading users from Supabase for cross-device sync...')
        console.log(`🏢 [TENANT DEBUG] Filtering users by tenant_id: "${currentTenantId}"`)

        const { data: supabaseUsers, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('tenant_id', currentTenantId) // 🎯 Filter by current tenant only
          .order('created_at', { ascending: false })

        console.log(`📊 [TENANT DEBUG] Query returned ${supabaseUsers?.length || 0} users for tenant "${currentTenantId}"`)

        if (!usersError && supabaseUsers && supabaseUsers.length > 0) {
          console.log(`✅ Found ${supabaseUsers.length} users in Supabase`)

          // Map from database format to application format
          const mappedUsers = await Promise.all(supabaseUsers.map(async user => {
            // Get last login from audit logs (more reliable than last_login field)
            // Look for any successful authentication-related action (LOGIN, VIEW, SYSTEM_ACCESS)
            let lastLoginTimestamp = user.last_login
            try {
              console.log(`🔍 Querying audit_logs for user ${user.email} (ID: ${user.id})`)

              // First, let's see ALL audit logs for this user to debug
              const { data: allLogs, error: allLogsError } = await supabase
                .from('audit_logs')
                .select('timestamp, action, outcome, user_id, user_name')
                .eq('user_id', user.id)
                .order('timestamp', { ascending: false })
                .limit(10)

              if (allLogsError) {
                console.error(`❌ Error querying ALL audit_logs for ${user.email}:`, allLogsError)
              } else {
                console.log(`📋 Found ${allLogs?.length || 0} total audit logs for ${user.email}:`, allLogs)
              }

              // Now query specifically for successful login-related actions
              const { data: loginLogs, error: loginError } = await supabase
                .from('audit_logs')
                .select('timestamp, action, outcome, user_id')
                .eq('user_id', user.id)
                .in('action', ['LOGIN', 'VIEW', 'SYSTEM_ACCESS'])
                .eq('outcome', 'SUCCESS')
                .order('timestamp', { ascending: false })
                .limit(1)

              if (loginError) {
                console.error(`❌ Error querying audit_logs for ${user.email}:`, loginError)
              } else if (loginLogs && loginLogs.length > 0) {
                lastLoginTimestamp = loginLogs[0].timestamp
                console.log(`✅ Got last login from audit_logs for ${user.email}: ${lastLoginTimestamp} (action: ${loginLogs[0].action})`)
              } else {
                console.log(`⚠️ No LOGIN/VIEW/SYSTEM_ACCESS audit logs found for ${user.email}`)
                console.log(`⚠️ Falling back to user.last_login: ${user.last_login}`)
              }
            } catch (auditError) {
              console.error(`❌ Exception querying audit logs for ${user.email}:`, auditError)
            }

            const mappedUser = {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.metadata?.original_role || this.mapExistingRoleToExpected(user.role),
              mfa_enabled: user.mfa_enabled,
              isActive: user.is_active !== undefined ? user.is_active : true, // Include activation status
              avatar: user.avatar_url,
              settings: {},
              created_at: user.created_at,
              updated_at: user.updated_at,
              lastLogin: lastLoginTimestamp // Use audit log timestamp if available
            }

            console.log(`🔍 DEBUG loadSystemUsers: User ${user.email} - is_active (DB): ${user.is_active}, isActive (mapped): ${mappedUser.isActive}`)

            // CRITICAL: Hard-coded Super User enforcement for specific emails
            if (mappedUser.email === 'pierre@phaetonai.com' ||
                mappedUser.email === 'elmfarrell@yahoo.com' ||
                mappedUser.email === 'admin@phaetonai.com') {
              mappedUser.role = 'super_user'
              console.log(`🔐 HARD-CODED SUPER USER: Enforced super_user role for ${mappedUser.email} in loadSystemUsers`)
            }

            return mappedUser
          }))

          allUsers = mappedUsers

          // CRITICAL: Filter out deleted users before caching
          const filteredUsers = this.filterDeletedUsers(allUsers)
          allUsers = filteredUsers

          console.log(`📊 DEBUG: After filtering, ${allUsers.length} users remain`)
          allUsers.forEach(u => {
            console.log(`   - ${u.email}: isActive=${u.isActive}, role=${u.role}`)
          })

          // Update localStorage cache for offline access
          localStorage.setItem('systemUsers', JSON.stringify(allUsers))
          console.log('📦 Cached users in localStorage for offline access')

        } else {
          console.log('📂 No users found in Supabase, checking localStorage...')
          throw new Error('No users in Supabase, falling back to localStorage')
        }

      } catch (supabaseError) {
        console.log('UserProfileService: Supabase query failed, using localStorage fallback:', supabaseError)

        // Fallback to localStorage
        console.log('UserProfileService: Loading system users from localStorage fallback')

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
            role: 'super_user',
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
            console.error('UserProfileService: Failed to parse stored users - returning empty array for MedEx:', parseError)
            users = []
          }
        } else {
          console.log('UserProfileService: No stored users found - returning empty array for MedEx')
          users = []
          // Don't seed demo users for MedEx - keep it clean
        }

        // MedEx: Skip demo user restoration logic - keep user list clean
        // (No demo user seeding for MedEx)
        if (false) { // Disabled for MedEx
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
        } // End of disabled demo user logic for MedEx

        allUsers = users

        // CRITICAL: Filter out deleted users from localStorage too
        allUsers = this.filterDeletedUsers(allUsers)
      }

      // Load avatar information using robust avatar service with enhanced persistence check
      const usersWithAvatars = await Promise.all(allUsers.map(async (user: any) => {
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

      // Set up real-time subscription for cross-device sync
      await this.setupUsersRealTimeSync()

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
   * Create a new user (for user management) with proper Supabase integration and real-time sync
   */
  static async createUser(userData: Omit<UserProfileData, 'id'>): Promise<ServiceResponse<UserProfileData>> {
    try {
      console.log('🔍 createUser() ENTRY POINT - Received userData:', JSON.stringify(userData, null, 2))
      console.log('🔍 createUser() - Role verification:', {
        role: userData.role,
        isActive: userData.isActive,
        email: userData.email
      })

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

      // Try Supabase first with proper schema mapping
      try {
        console.log('UserProfileService: Creating user in Supabase with proper schema mapping')

        // Map role to database schema (super_user -> admin for database, but keep super_user in application)
        const dbRole = this.mapRoleForDatabase(userData.role)

        console.log(`🔄 ROLE TRANSFORMATION: Input role="${userData.role}" → Database role="${dbRole}"`)

        // Generate azure_ad_id placeholder for compatibility with schema
        const azureAdId = `placeholder_${Date.now()}_${Math.random().toString(36).substring(2)}`

        const currentTenantId = getCurrentTenantId()
        console.log(`🏢 [TENANT DEBUG] Creating user with tenant_id: "${currentTenantId}"`)

        const userToInsert = {
          email: userData.email,
          name: userData.name,
          role: dbRole, // Use mapped role for database
          azure_ad_id: azureAdId, // Required by schema
          mfa_enabled: userData.mfa_enabled || false,
          is_active: userData.isActive !== undefined ? userData.isActive : true, // Respect isActive from userData, default to true
          last_login: null, // Initialize last_login as null for new users
          metadata: {
            created_via: 'user_management',
            original_role: userData.role, // Store original role in metadata
            device_id: this.currentDeviceId || 'unknown'
          },
          tenant_id: currentTenantId // Ensure tenant_id is set for current tenant
        }

        console.log(`🔍 [TENANT DEBUG] User insert data - tenant_id: "${userToInsert.tenant_id}", email: "${userToInsert.email}"`)

        console.log('🔍 DEBUG: Creating user with is_active =', userToInsert.is_active, 'for email:', userData.email)
        console.log(`📦 METADATA: Storing original_role="${userData.role}" in metadata for future role restoration`)
        console.log('🔍 DETAILED INSERT DATA:', JSON.stringify(userToInsert, null, 2))
        console.log('🔍 METADATA VERIFICATION BEFORE INSERT:', {
          metadata: userToInsert.metadata,
          original_role_in_metadata: userToInsert.metadata?.original_role,
          expected_original_role: userData.role,
          db_role: userToInsert.role
        })

        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert(userToInsert)
          .select()
          .single()

        if (!userError && newUser) {
          // Supabase success - map back to application format
          newUserProfileData = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: userData.role, // Use original role in application (super_user)
            mfa_enabled: newUser.mfa_enabled,
            isActive: newUser.is_active, // Include activation status
            settings: userData.settings || {},
            created_at: newUser.created_at,
            updated_at: newUser.updated_at,
            lastLogin: newUser.last_login // Include last_login field for new users
          }

          console.log('✅ DEBUG: User created successfully with isActive =', newUserProfileData.isActive)
          console.log(`✅ ROLE VERIFICATION: User created with application role="${newUserProfileData.role}" (DB has "${newUser.role}", metadata has "${newUser.metadata?.original_role}")`)
          console.log('🔍 SUPABASE RESPONSE METADATA:', JSON.stringify(newUser.metadata, null, 2))
          console.log('🔍 METADATA COMPARISON:', {
            sent_original_role: userData.role,
            received_original_role: newUser.metadata?.original_role,
            match: userData.role === newUser.metadata?.original_role
          })

          // Create user settings record for cross-device sync
          if (userData.settings && Object.keys(userData.settings).length > 0) {
            await this.syncUserSettings(newUser.id, userData.settings)
          } else {
            // Create default settings
            await this.syncUserSettings(newUser.id, {
              theme: 'light',
              notifications: {
                email: true,
                sms: true,
                push: true,
                in_app: true
              }
            })
          }

          // Update localStorage for immediate UI refresh with better error handling
          try {
            const existingUsers = localStorage.getItem('systemUsers')
            let usersList = []

            if (existingUsers) {
              try {
                usersList = JSON.parse(existingUsers)
              } catch (parseError) {
                console.warn('Failed to parse existing users, starting with empty list:', parseError)
                usersList = []
              }
            }

            // Ensure the new user isn't already in the list (prevent duplicates)
            const existingIndex = usersList.findIndex((u: any) => u.email === newUserProfileData.email)
            if (existingIndex >= 0) {
              // Update existing user instead of adding duplicate
              usersList[existingIndex] = newUserProfileData
              console.log('✅ Updated existing user in localStorage')
            } else {
              // Add new user
              usersList.push(newUserProfileData)
              console.log('✅ Added new user to localStorage')
            }

            localStorage.setItem('systemUsers', JSON.stringify(usersList))
            console.log('📦 localStorage updated with', usersList.length, 'users')

            // Trigger storage event manually for cross-tab sync
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'systemUsers',
              newValue: JSON.stringify(usersList),
              oldValue: existingUsers
            }))

          } catch (storageError) {
            console.error('Failed to update localStorage:', storageError)
            // Continue anyway since Supabase creation was successful
          }

          console.log('✅ UserProfileService: User created in Supabase successfully')

          // Broadcast sync event for real-time updates across devices
          this.broadcastUserCreatedEvent(newUserProfileData)

        } else {
          console.error('❌ SUPABASE INSERT ERROR:', JSON.stringify(userError, null, 2))
          console.error('❌ ERROR DETAILS:', {
            message: userError?.message,
            details: userError?.details,
            hint: userError?.hint,
            code: userError?.code
          })
          throw new Error(userError?.message || 'Failed to create user in Supabase')
        }

      } catch (supabaseError: any) {
        console.log('UserProfileService: Supabase creation failed, using localStorage fallback:', supabaseError.message)

        // Enhanced localStorage fallback with better ID generation
        const newUserId = `local_user_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15)}`

        newUserProfileData = {
          id: newUserId,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          mfa_enabled: userData.mfa_enabled || false,
          settings: userData.settings || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Mark as local-only for sync purposes
          _localOnly: true
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

        // Add the new user with duplicate prevention
        const existingUserIndex = users.findIndex((u: any) => u.email === newUserProfileData.email)
        if (existingUserIndex >= 0) {
          // Update existing user instead of adding duplicate
          users[existingUserIndex] = newUserProfileData
          console.log('✅ Updated existing user in localStorage fallback')
        } else {
          // Add new user
          users.push(newUserProfileData)
          console.log('✅ Added new user to localStorage fallback')
        }

        localStorage.setItem('systemUsers', JSON.stringify(users))
        console.log('📦 localStorage fallback updated with', users.length, 'users')

        // Trigger storage event for cross-tab sync
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'systemUsers',
          newValue: JSON.stringify(users),
          oldValue: JSON.stringify(users.slice(0, -1)) // Previous state
        }))

        console.log('UserProfileService: User created in localStorage fallback mode')
      }

      await auditLogger.logSecurityEvent('USER_CREATED', 'users', true, {
        userId: newUserProfileData.id,
        email: userData.email,
        role: userData.role,
        createdVia: newUserProfileData._localOnly ? 'localStorage' : 'supabase'
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

      console.log('UserProfileService: Deleting user from Supabase and localStorage:', userId)

      // STEP 1: Delete from Supabase first for cross-device sync
      try {
        console.log('UserProfileService: Attempting to delete user from Supabase...')

        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId)

        if (deleteError) {
          console.warn('UserProfileService: Supabase deletion failed:', deleteError.message)
          console.log('UserProfileService: Continuing with localStorage deletion...')
        } else {
          console.log('✅ UserProfileService: User successfully deleted from Supabase')
        }

        // Also delete from user_profiles table
        try {
          await supabase
            .from('user_profiles')
            .delete()
            .eq('user_id', userId)
          console.log('✅ UserProfileService: User profile deleted from Supabase')
        } catch (profileError) {
          console.log('UserProfileService: No user profile to delete or table missing')
        }

        // Also delete from user_settings table
        try {
          await supabase
            .from('user_settings')
            .delete()
            .eq('user_id', userId)
          console.log('✅ UserProfileService: User settings deleted from Supabase')
        } catch (settingsError) {
          console.log('UserProfileService: No user settings to delete or table missing')
        }

      } catch (supabaseError) {
        console.warn('UserProfileService: Supabase deletion error, continuing with localStorage:', supabaseError)
      }

      // STEP 2: Remove from localStorage
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

      // Log successful deletion with cross-device sync info
      await auditLogger.logSecurityEvent('USER_DELETED', 'users', true, {
        userId,
        deletedFromSupabase: true,
        crossDeviceSync: true,
        timestamp: new Date().toISOString()
      })

      // Broadcast deletion event for real-time cross-device sync
      this.broadcastUserDeletedEvent(userId, userEmail)

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
  static async getUserByEmail(email: string, allowCacheFallback: boolean = true): Promise<ServiceResponse<UserProfileData | null>> {
    try {
      // Try Supabase first
      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('tenant_id', 'medex')
          .eq('email', email)
          .maybeSingle()

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
          // User not found in Supabase
          if (!allowCacheFallback) {
            console.log('UserProfileService: User not found in Supabase, cache fallback disabled for security')
            return { status: 'success', data: null }
          }
          // Try localStorage if fallback is allowed
        } else {
          throw new Error(`Failed to get user by email: ${userError.message}`)
        }
      } catch (supabaseError) {
        if (!allowCacheFallback) {
          console.log('UserProfileService: Supabase query failed, cache fallback disabled for security')
          return { status: 'success', data: null }
        }
        console.log('UserProfileService: Supabase query failed, trying localStorage fallback')
      }

      // 🔒 SECURITY: localStorage fallback only allowed for non-authentication scenarios
      if (!allowCacheFallback) {
        console.log('UserProfileService: Cache fallback disabled - user not found')
        return { status: 'success', data: null }
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
   * Force sync profile from cloud
   */
  static async forceSyncProfileFromCloud(userId: string): Promise<ServiceResponse<UserProfileData | null>> {
    try {
      console.log(`🔄 FORCE PROFILE SYNC: Starting for user ${userId}`)

      // Clear cache first
      this.cache.delete(userId)

      // Try to get from Supabase
      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (!error && user) {
          const profile = this.transformDatabaseUserToProfile(user)
          if (profile) {
            // Update localStorage
            localStorage.setItem(`userProfile_${userId}`, JSON.stringify(profile))
            localStorage.setItem('currentUser', JSON.stringify(profile))

            // Update cache
            this.cache.set(userId, {
              data: profile as any,
              timestamp: Date.now(),
              deviceId: 'cloud'
            })

            console.log(`✅ FORCE PROFILE SYNC: Successfully loaded from cloud`)
            return { status: 'success', data: profile }
          }
        }
      } catch (error) {
        console.warn('Cloud sync failed, using local fallback:', error)
      }

      // Fallback to localStorage
      const localProfile = await this.loadUserProfile(userId)
      return localProfile

    } catch (error) {
      console.error('Force profile sync failed:', error)
      return { status: 'error', error: error instanceof Error ? error.message : 'Sync failed' }
    }
  }

  /**
   * Get profile sync status
   */
  static async getProfileSyncStatus(userId: string): Promise<{
    isEnabled: boolean
    lastSync: string | null
    deviceId: string | null
    cloudAvailable: boolean
  }> {
    try {
      const cached = this.cache.get(userId)
      const profile = cached?.data as UserProfileData

      return {
        isEnabled: profile?.syncEnabled || false,
        lastSync: profile?.lastSynced || null,
        deviceId: this.currentDeviceId,
        cloudAvailable: !!supabase
      }
    } catch (error) {
      return {
        isEnabled: false,
        lastSync: null,
        deviceId: null,
        cloudAvailable: false
      }
    }
  }

  /**
   * Subscribe to profile sync events
   */
  static subscribeToProfileSync(userId: string, callback: (event: ProfileSyncEvent) => void): void {
    const listeners = this.syncListeners.get(userId) || []
    listeners.push(callback)
    this.syncListeners.set(userId, listeners)
  }

  /**
   * Unsubscribe from profile sync events
   */
  static unsubscribeFromProfileSync(userId: string, callback?: (event: ProfileSyncEvent) => void): void {
    const listeners = this.syncListeners.get(userId) || []

    if (callback) {
      const filteredListeners = listeners.filter(l => l !== callback)
      this.syncListeners.set(userId, filteredListeners)
    } else {
      this.syncListeners.delete(userId)
    }
  }

  /**
   * Update specific user profile fields with sync support
   */
  static async updateUserProfile(
    userId: string,
    updates: Partial<UserProfileData>,
    options?: {
      deviceId?: string,
      syncToCloud?: boolean,
      broadcastToOtherDevices?: boolean
    }
  ): Promise<ServiceResponse<UserProfileData>> {
    try {
      await auditLogger.logSecurityEvent('USER_PROFILE_UPDATE', 'user_profiles', true, { userId, updates: Object.keys(updates) })

      console.log('UserProfileService: Updating user profile for userId:', userId, 'Updates:', updates)

      // Get existing user profile
      const existingProfileResponse = await this.loadUserProfile(userId)

      let existingProfile: UserProfileData

      if (existingProfileResponse.status === 'error' || !existingProfileResponse.data) {
        console.warn('UserProfileService: No existing profile found, creating from currentUser or defaults')

        // Try to get basic info from currentUser in localStorage
        const currentUser = localStorage.getItem('currentUser')
        if (currentUser) {
          try {
            const userData = JSON.parse(currentUser)
            if (userData.id === userId) {
              existingProfile = {
                id: userData.id,
                email: userData.email,
                name: userData.name || userData.email,
                role: userData.role || 'staff',
                avatar: userData.avatar,
                mfa_enabled: userData.mfa_enabled || false,
                settings: userData.settings || {}
              }
              console.log('UserProfileService: Created profile from currentUser data')
            } else {
              // Create minimal profile with just the userId
              existingProfile = {
                id: userId,
                email: 'unknown@carexps.com',
                name: 'User',
                role: 'staff',
                mfa_enabled: false,
                settings: {}
              }
              console.log('UserProfileService: Created minimal profile for update')
            }
          } catch (error) {
            console.error('Failed to parse currentUser, using minimal profile')
            existingProfile = {
              id: userId,
              email: 'unknown@carexps.com',
              name: 'User',
              role: 'staff',
              mfa_enabled: false,
              settings: {}
            }
          }
        } else {
          // Create minimal profile
          existingProfile = {
            id: userId,
            email: 'unknown@carexps.com',
            name: 'User',
            role: 'staff',
            mfa_enabled: false,
            settings: {}
          }
          console.log('UserProfileService: Created minimal profile for userId:', userId)
        }
      } else {
        existingProfile = existingProfileResponse.data
      }

      // Merge updates with existing profile
      const updatedProfile = {
        ...existingProfile,
        ...updates,
        updated_at: new Date().toISOString()
      }

      // Save to Supabase first for cross-device persistence
      try {
        // Prepare update data for users table
        const usersUpdateData: any = {
          updated_at: updatedProfile.updated_at
        }

        // Only include fields that are explicitly in the updates object
        if ('name' in updates) usersUpdateData.name = updatedProfile.name
        if ('email' in updates) usersUpdateData.email = updatedProfile.email

        // CRITICAL: Special handling for Super User emails - NEVER update their role in Supabase
        const isSuperUserEmail = updatedProfile.email === 'pierre@phaetonai.com' ||
                                updatedProfile.email === 'elmfarrell@yahoo.com' ||
                                updatedProfile.email === 'admin@phaetonai.com'  // MedEX Super User

        if ('role' in updates && !isSuperUserEmail) {
          usersUpdateData.role = updatedProfile.role
        } else if ('role' in updates && isSuperUserEmail) {
          console.log(`🔐 SUPER USER PROTECTION: Skipping role update for ${updatedProfile.email} in Supabase`)
        }

        // Only update users table if there are fields to update
        const hasUsersFields = Object.keys(usersUpdateData).length > 1 // More than just updated_at

        if (!hasUsersFields) {
          console.log('UserProfileService: No users table fields to update, skipping users table')
        } else {
          const { error: usersError } = await supabase
            .from('users')
            .update(usersUpdateData)
            .eq('id', userId)

          if (usersError) {
            console.warn('Supabase users table update failed:', usersError.message)
          } else {
            console.log('UserProfileService: Users table updated in Supabase successfully with fields:', Object.keys(usersUpdateData))
          }
        }

        // Update user_profiles table with extended profile fields (Department, Phone, Location, Bio)
        // CRITICAL: Only include fields that were actually provided in updates to avoid overwriting existing data
        const profileFields: any = {
          user_id: userId,
          updated_at: updatedProfile.updated_at
        }

        // Only add fields that are explicitly provided in updates
        if ('department' in updates) profileFields.department = updates.department || null
        if ('phone' in updates) profileFields.phone = updates.phone || null
        if ('bio' in updates) profileFields.bio = updates.bio || null
        if ('location' in updates) profileFields.location = updates.location || null
        if ('display_name' in updates || 'name' in updates) {
          profileFields.display_name = updates.display_name || updates.name || null
        }

        // Only update user_profiles if there are profile-specific fields to update
        const hasProfileFields = Object.keys(profileFields).some(key =>
          ['department', 'phone', 'bio', 'location', 'display_name'].includes(key)
        )

        if (!hasProfileFields) {
          console.log('UserProfileService: No profile-specific fields to update, skipping user_profiles table')
        } else {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert(profileFields, { onConflict: 'user_id' })

          if (profileError) {
            console.warn('Supabase user_profiles table update failed:', profileError.message)
          } else {
            console.log('UserProfileService: User profiles table updated successfully with fields:', Object.keys(profileFields))
          }
        }

      } catch (supabaseError) {
        console.warn('Supabase update error, continuing with localStorage:', supabaseError)
      }

      // Save updated profile using existing save method with sync options
      const saveResponse = await this.saveUserProfile(updatedProfile, {
        deviceId: options?.deviceId,
        syncToCloud: options?.syncToCloud,
        broadcastToOtherDevices: options?.broadcastToOtherDevices
      })
      if (saveResponse.status === 'error') {
        // If saveUserProfile fails, at least save to localStorage directly
        console.warn('SaveUserProfile failed, saving directly to localStorage')
        localStorage.setItem(`userProfile_${userId}`, JSON.stringify(updatedProfile))
      }

      // Update currentUser if this is the current user
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        if (userData.id === userId) {
          // CRITICAL: Preserve Super User role for specific emails
          const isSuperUserEmail = userData.email === 'pierre@phaetonai.com' ||
                                  userData.email === 'elmfarrell@yahoo.com' ||
                                  userData.email === 'admin@phaetonai.com'
          const originalRole = userData.role

          Object.assign(userData, updates)
          userData.updated_at = new Date().toISOString()

          // Force Super User role preservation
          if (isSuperUserEmail && originalRole === 'super_user') {
            userData.role = 'super_user'
            console.log(`🔐 SUPER USER PROTECTION: Forced role preservation for ${userData.email} in currentUser`)
          }

          localStorage.setItem('currentUser', JSON.stringify(userData))
        }
      }

      // Update systemUsers array
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === userId)
        if (userIndex >= 0) {
          // CRITICAL: Preserve Super User role for specific emails
          const isSuperUserEmail = users[userIndex].email === 'pierre@phaetonai.com' ||
                                  users[userIndex].email === 'elmfarrell@yahoo.com' ||
                                  users[userIndex].email === 'admin@phaetonai.com'
          const originalRole = users[userIndex].role

          Object.assign(users[userIndex], updates)
          users[userIndex].updated_at = new Date().toISOString()

          // Force Super User role preservation
          if (isSuperUserEmail && originalRole === 'super_user') {
            users[userIndex].role = 'super_user'
            console.log(`🔐 SUPER USER PROTECTION: Forced role preservation for ${users[userIndex].email} in systemUsers`)
          }

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
   * Sync avatar across devices
   */
  static async syncAvatarAcrossDevices(userId: string): Promise<ServiceResponse<string | null>> {
    try {
      console.log(`🔄 AVATAR SYNC: Starting for user ${userId}`)

      const result = await avatarStorageService.syncAvatarAcrossDevices(userId)

      if (result.status === 'success' && result.data) {
        // Notify sync listeners
        const listeners = this.syncListeners.get(userId) || []
        const event: ProfileSyncEvent = {
          eventType: 'avatar_changed',
          userId,
          deviceId: this.currentDeviceId || 'unknown',
          data: { avatarUrl: result.data },
          timestamp: new Date().toISOString()
        }
        listeners.forEach(listener => listener(event))

        console.log(`✅ AVATAR SYNC: Completed successfully`)
      }

      return result
    } catch (error) {
      console.error('Avatar sync failed:', error)
      return { status: 'error', error: error instanceof Error ? error.message : 'Avatar sync failed' }
    }
  }

  /**
   * Clean up profile sync resources
   */
  static cleanupProfileSync(userId?: string): void {
    if (userId) {
      // Clean up for specific user
      this.cache.delete(userId)
      this.syncListeners.delete(userId)

      // Unsubscribe from real-time channel
      const channel = this.realtimeChannels.get(userId)
      if (channel && supabase) {
        supabase.removeChannel(channel)
        this.realtimeChannels.delete(userId)
      }

      console.log(`🧹 Cleaned up profile sync for user: ${userId}`)
    } else {
      // Clean up all
      this.cache.clear()
      this.syncListeners.clear()

      // Unsubscribe from all channels
      if (supabase) {
        this.realtimeChannels.forEach((channel) => {
          supabase.removeChannel(channel)
        })
      }
      this.realtimeChannels.clear()

      console.log(`🧹 Cleaned up all profile sync resources`)
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
   * Filter out deleted users based on localStorage tracking
   */
  private static filterDeletedUsers(users: UserProfileData[]): UserProfileData[] {
    try {
      // Get deleted user IDs
      const deletedUsers = localStorage.getItem('deletedUsers')
      let deletedUserIds: string[] = []
      if (deletedUsers) {
        try {
          deletedUserIds = JSON.parse(deletedUsers)
        } catch (parseError) {
          console.warn('Failed to parse deleted users list:', parseError)
        }
      }

      // Get deleted emails
      const deletedEmails = localStorage.getItem('deletedUserEmails')
      let deletedEmailList: string[] = []
      if (deletedEmails) {
        try {
          deletedEmailList = JSON.parse(deletedEmails)
        } catch (parseError) {
          console.warn('Failed to parse deleted emails list:', parseError)
        }
      }

      // Filter out deleted users
      const filteredUsers = users.filter(user => {
        const isDeletedById = deletedUserIds.includes(user.id)
        const isDeletedByEmail = deletedEmailList.includes(user.email.toLowerCase())

        if (isDeletedById || isDeletedByEmail) {
          console.log(`UserProfileService: Filtering out deleted user: ${user.email} (ID: ${user.id})`)
          return false
        }
        return true
      })

      const removedCount = users.length - filteredUsers.length
      if (removedCount > 0) {
        console.log(`UserProfileService: Filtered out ${removedCount} deleted users`)
      }

      return filteredUsers
    } catch (error) {
      console.warn('UserProfileService: Error filtering deleted users, returning original list:', error)
      return users
    }
  }

  /**
   * Map existing database role values to expected CareXPS role values
   */
  private static mapExistingRoleToExpected(existingRole: string): 'admin' | 'super_user' | 'healthcare_provider' | 'staff' {
    if (!existingRole) return 'staff'

    const role = existingRole.toLowerCase()

    // Map existing roles to CareXPS roles
    if (role === 'super_user' || role === 'superuser' || role === 'super user') {
      return 'super_user'
    } else if (role === 'admin' || role === 'administrator') {
      return 'admin'
    } else if (role === 'provider' || role === 'healthcare_provider' || role === 'doctor' || role === 'physician') {
      return 'healthcare_provider'
    } else {
      return 'staff' // Default fallback
    }
  }

  /**
   * Map CareXPS role values to database schema roles
   * CRITICAL FIX: Database schema supports 'super_user' role - DO NOT convert to 'admin'
   */
  private static mapRoleForDatabase(careXpsRole: string): 'admin' | 'healthcare_provider' | 'staff' | 'super_user' {
    const role = careXpsRole.toLowerCase()

    // Map CareXPS roles to database schema roles
    // CRITICAL: Preserve 'super_user' role for first user and super administrators
    if (role === 'super_user' || role === 'superuser' || role === 'super user') {
      return 'super_user' // FIXED: Database schema supports super_user role directly
    } else if (role === 'admin' || role === 'administrator') {
      return 'admin'
    } else if (role === 'provider' || role === 'healthcare_provider' || role === 'doctor' || role === 'physician') {
      return 'healthcare_provider'
    } else {
      return 'staff' // Default fallback
    }
  }

  /**
   * Broadcast user deleted event for real-time cross-device sync
   */
  private static broadcastUserDeletedEvent(userId: string, userEmail?: string | null): void {
    try {
      // Trigger local event for immediate UI updates
      window.dispatchEvent(new CustomEvent('userDeleted', {
        detail: { userId, userEmail }
      }))

      // Update cross-device sync event log
      this.logCrossDeviceSyncEvent({
        event_type: 'user_deleted',
        user_id: userId,
        table_name: 'users',
        record_count: 1,
        success: true,
        metadata: {
          action: 'user_deleted',
          deviceId: this.currentDeviceId || 'unknown',
          timestamp: new Date().toISOString(),
          userEmail: userEmail || undefined
        }
      })

      console.log('📡 User deletion event broadcasted for cross-device sync')
    } catch (error) {
      console.warn('Failed to broadcast user deleted event:', error)
    }
  }

  /**
   * Broadcast user created event for real-time cross-device sync
   */
  private static broadcastUserCreatedEvent(userData: UserProfileData): void {
    try {
      // Notify other devices via Supabase real-time (if available)
      if (supabase) {
        // The insert operation will automatically trigger real-time notifications
        // to subscribed clients through Supabase's built-in real-time system
        console.log('📡 User creation event will be broadcasted via Supabase real-time')
      }

      // Also trigger a local event for immediate UI updates
      window.dispatchEvent(new CustomEvent('userCreated', {
        detail: userData
      }))

      // Update cross-device sync event log
      this.logCrossDeviceSyncEvent({
        event_type: 'device_connected',
        user_id: userData.id,
        table_name: 'users',
        record_count: 1,
        success: true,
        metadata: {
          action: 'user_created',
          deviceId: this.currentDeviceId || 'unknown',
          timestamp: new Date().toISOString()
        }
      })

    } catch (error) {
      console.warn('Failed to broadcast user created event:', error)
    }
  }

  /**
   * Log cross-device sync events for audit trail
   */
  private static async logCrossDeviceSyncEvent(eventData: any): Promise<void> {
    try {
      if (supabase) {
        await supabase
          .from('cross_device_sync_events')
          .insert({
            user_id: eventData.user_id,
            source_device_id: this.currentDeviceId,
            event_type: eventData.event_type,
            table_name: eventData.table_name,
            record_count: eventData.record_count,
            success: eventData.success,
            metadata: eventData.metadata,
            created_at: new Date().toISOString()
          })
      }
    } catch (error) {
      console.warn('Failed to log cross-device sync event:', error)
    }
  }

  /**
   * Set up real-time sync for users table cross-device updates
   */
  private static async setupUsersRealTimeSync(): Promise<void> {
    try {
      if (!supabase || this.realtimeChannels.has('users_sync')) {
        return // Already set up or Supabase not available
      }

      console.log('📡 Setting up real-time sync for users table...')

      const channel = supabase
        .channel('users_sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'users'
          },
          async (payload) => {
            await this.handleUsersTableChange(payload)
          }
        )
        .subscribe()

      this.realtimeChannels.set('users_sync', channel)
      console.log('✅ Real-time sync for users table is now active')

    } catch (error) {
      console.warn('Failed to set up users real-time sync:', error)
    }
  }

  /**
   * Handle real-time changes to users table
   */
  private static async handleUsersTableChange(payload: any): Promise<void> {
    try {
      console.log('📥 REAL-TIME SYNC: Received users table change:', payload.eventType)

      // Update localStorage cache
      const currentUsers = localStorage.getItem('systemUsers')
      if (currentUsers) {
        let users = JSON.parse(currentUsers)

        if (payload.eventType === 'INSERT' && payload.new) {
          // Map database format to application format
          const newUser = {
            id: payload.new.id,
            email: payload.new.email,
            name: payload.new.name,
            role: payload.new.metadata?.original_role || this.mapExistingRoleToExpected(payload.new.role),
            mfa_enabled: payload.new.mfa_enabled,
            avatar: payload.new.avatar_url,
            settings: {},
            created_at: payload.new.created_at,
            updated_at: payload.new.updated_at
          }

          // Add to local cache if not already present
          const existingIndex = users.findIndex((u: any) => u.id === newUser.id)
          if (existingIndex === -1) {
            users.push(newUser)
            localStorage.setItem('systemUsers', JSON.stringify(users))
            console.log('📥 Added new user from real-time sync')

            // Trigger UI update
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
              detail: { action: 'user_added', user: newUser }
            }))
          }

        } else if (payload.eventType === 'UPDATE' && payload.new) {
          // Update existing user
          const updatedUser = {
            id: payload.new.id,
            email: payload.new.email,
            name: payload.new.name,
            role: payload.new.metadata?.original_role || this.mapExistingRoleToExpected(payload.new.role),
            mfa_enabled: payload.new.mfa_enabled,
            avatar: payload.new.avatar_url,
            settings: {},
            created_at: payload.new.created_at,
            updated_at: payload.new.updated_at
          }

          const existingIndex = users.findIndex((u: any) => u.id === updatedUser.id)
          if (existingIndex >= 0) {
            users[existingIndex] = { ...users[existingIndex], ...updatedUser }
            localStorage.setItem('systemUsers', JSON.stringify(users))
            console.log('📥 Updated user from real-time sync')

            // Trigger UI update
            window.dispatchEvent(new CustomEvent('userDataUpdated', {
              detail: { action: 'user_updated', user: updatedUser }
            }))
          }

        } else if (payload.eventType === 'DELETE' && payload.old) {
          // Remove deleted user
          const filteredUsers = users.filter((u: any) => u.id !== payload.old.id)
          localStorage.setItem('systemUsers', JSON.stringify(filteredUsers))
          console.log('📥 Removed user from real-time sync')

          // IMPORTANT: Also add to deleted tracking to prevent recreation
          const deletedUsers = localStorage.getItem('deletedUsers')
          let deletedUserIds: string[] = []
          if (deletedUsers) {
            try {
              deletedUserIds = JSON.parse(deletedUsers)
            } catch (parseError) {
              console.warn('Failed to parse deleted users list:', parseError)
            }
          }

          if (!deletedUserIds.includes(payload.old.id)) {
            deletedUserIds.push(payload.old.id)
            localStorage.setItem('deletedUsers', JSON.stringify(deletedUserIds))
            console.log('📥 Added deleted user to tracking list from real-time sync')
          }

          // Also track deleted email if available
          if (payload.old.email) {
            const deletedEmails = localStorage.getItem('deletedUserEmails')
            let deletedEmailList: string[] = []
            if (deletedEmails) {
              try {
                deletedEmailList = JSON.parse(deletedEmails)
              } catch (parseError) {
                console.warn('Failed to parse deleted emails list:', parseError)
              }
            }

            if (!deletedEmailList.includes(payload.old.email.toLowerCase())) {
              deletedEmailList.push(payload.old.email.toLowerCase())
              localStorage.setItem('deletedUserEmails', JSON.stringify(deletedEmailList))
              console.log('📥 Added deleted email to tracking list from real-time sync')
            }
          }

          // Trigger UI update
          window.dispatchEvent(new CustomEvent('userDataUpdated', {
            detail: { action: 'user_deleted', userId: payload.old.id }
          }))
        }
      }

    } catch (error) {
      console.error('Error handling users table change:', error)
    }
  }

  /**
   * Transform database profile to UserProfileData format
   */
  private static transformToUserProfileData(completeProfile: CompleteUserProfile): UserProfileData {
    const { user, profile, settings } = completeProfile

    // CRITICAL FIX: Validate user data before transformation
    if (!user || !user.id) {
      throw new Error('Invalid user data provided to transformToUserProfileData')
    }

    // CRITICAL FIX: Use original_role from metadata if available (super_user stored as admin in DB)
    // Otherwise, map the database role back to application format
    const applicationRole = user.metadata?.original_role || this.mapExistingRoleToExpected(user.role)

    console.log(`🔄 ROLE MAPPING (transformToUserProfileData): DB role="${user.role}", metadata.original_role="${user.metadata?.original_role}", final="${applicationRole}"`)

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
      role: applicationRole,
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

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    UserProfileService.cleanupProfileSync()
  })
}