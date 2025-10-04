import { supabase } from '@/config/supabase'
import { Database, ServiceResponse } from '@/types/supabase'
import { userProfileService, UserProfileData } from './userProfileService'
import { auditLogger } from './auditLogger'
import { encryptionService } from './encryption'

type UserCredentials = {
  email: string
  password: string
  tempPassword?: boolean
}

export interface SystemUserWithCredentials extends UserProfileData {
  credentials?: UserCredentials
  lastLogin?: string
  loginAttempts?: number
  isLocked?: boolean
  created_at?: string
  updated_at?: string
}

/**
 * Service for managing system users and their credentials
 * Replaces localStorage-based user management operations
 */
export class UserManagementService {
  private static readonly MAX_LOGIN_ATTEMPTS = 3
  private static readonly LOCKOUT_DURATION = 30 * 60 * 1000 // 30 minutes

  /**
   * Load all system users with their credentials (replaces localStorage.getItem('systemUsers'))
   */
  static async loadSystemUsers(): Promise<ServiceResponse<SystemUserWithCredentials[]>> {
    try {
      await auditLogger.logSecurityEvent('SYSTEM_USERS_MANAGEMENT_ACCESS', 'users', true)

      // Get all users with their profiles and settings
      const usersResponse = await userProfileService.loadSystemUsers()
      if (usersResponse.status === 'error') {
        return usersResponse as ServiceResponse<SystemUserWithCredentials[]>
      }

      const users = usersResponse.data || []

      // Get login statistics and credentials for each user
      const systemUsers = await Promise.all(
        users.map(async (user) => {
          const loginStats = await this.getUserLoginStats(user.id)
          const credentials = await this.getUserCredentials(user.id)

          return {
            ...user,
            credentials,
            // CRITICAL: Keep user.lastLogin from userProfileService if it exists (from audit logs)
            // Only use loginStats.lastLogin as fallback if user doesn't already have lastLogin
            lastLogin: user.lastLogin || loginStats.lastLogin,
            loginAttempts: loginStats.loginAttempts,
            isLocked: loginStats.isLocked
          } as SystemUserWithCredentials
        })
      )

      return { status: 'success', data: systemUsers }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('SYSTEM_USERS_MANAGEMENT_ACCESS_FAILED', 'users', false, {
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Save system users (replaces localStorage.setItem('systemUsers'))
   */
  static async saveSystemUsers(users: SystemUserWithCredentials[]): Promise<ServiceResponse<void>> {
    try {
      await auditLogger.logSecurityEvent('SYSTEM_USERS_MANAGEMENT_UPDATE', 'users', true)

      // Update each user
      for (const user of users) {
        // Update user profile
        const profileResponse = await userProfileService.saveUserProfile(user)
        if (profileResponse.status === 'error') {
          throw new Error(`Failed to update user ${user.email}: ${profileResponse.error}`)
        }

        // Update credentials if provided
        if (user.credentials) {
          await this.saveUserCredentials(user.id, user.credentials)
        }
      }

      await auditLogger.logSecurityEvent('SYSTEM_USERS_MANAGEMENT_UPDATED', 'users', true, {
        userCount: users.length
      })

      return { status: 'success' }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('SYSTEM_USERS_MANAGEMENT_UPDATE_FAILED', 'users', false, {
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Create a new system user with credentials
   */
  static async createSystemUser(
    userData: Omit<UserProfileData, 'id'>,
    credentials: UserCredentials
  ): Promise<ServiceResponse<SystemUserWithCredentials>> {
    try {
      await auditLogger.logSecurityEvent('SYSTEM_USER_CREATE', 'users', true, {
        email: userData.email
      })

      // Check for existing user first to prevent duplicates
      const existsResponse = await userProfileService.userExistsByEmail(userData.email)
      if (existsResponse.status === 'error') {
        return { status: 'error', error: `Failed to check for existing user: ${existsResponse.error}` }
      }

      if (existsResponse.data) {
        return { status: 'error', error: `A user with email ${userData.email} already exists` }
      }

      // Create the user profile
      const createResponse = await userProfileService.createUser(userData)
      if (createResponse.status === 'error') {
        return createResponse as ServiceResponse<SystemUserWithCredentials>
      }

      const newUser = createResponse.data!

      // Save credentials
      await this.saveUserCredentials(newUser.id, credentials)

      // Return complete user data
      const systemUser: SystemUserWithCredentials = {
        ...newUser,
        credentials,
        lastLogin: undefined,
        loginAttempts: 0,
        isLocked: false
      }

      await auditLogger.logSecurityEvent('SYSTEM_USER_CREATED', 'users', true, {
        userId: newUser.id,
        email: userData.email,
        role: userData.role
      })

      return { status: 'success', data: systemUser }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('SYSTEM_USER_CREATE_FAILED', 'users', false, {
        email: userData.email,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(email: string, password: string): Promise<ServiceResponse<SystemUserWithCredentials | null>> {
    try {
      await auditLogger.logSecurityEvent('USER_AUTHENTICATION_ATTEMPT', 'users', true, {
        email,
        timestamp: new Date().toISOString()
      })

      // 🔒 SECURITY: Get user by email, disabling cache fallback for authentication
      // This ensures deleted users cannot log in using cached credentials
      const userResponse = await userProfileService.getUserByEmail(email, false)
      if (userResponse.status === 'error') {
        return userResponse as ServiceResponse<SystemUserWithCredentials | null>
      }

      if (!userResponse.data) {
        await this.recordFailedLogin(email, 'User not found')
        return { status: 'success', data: null }
      }

      const user = userResponse.data

      // Check if this is a demo user by email - if so, never lock them out
      const isDemoUser = email === 'demo@carexps.com' || email === 'elmfarrell@yahoo.com' || email === 'pierre@phaetonai.com'

      if (!isDemoUser) {
        // Check if user is locked (only for non-demo users)
        const loginStats = await this.getUserLoginStats(user.id)
        if (loginStats.isLocked) {
          await auditLogger.logSecurityEvent('USER_AUTHENTICATION_BLOCKED', 'users', false, {
            email,
            reason: 'Account locked'
          })
          return { status: 'error', error: 'Account is temporarily locked due to too many failed login attempts. Contact your administrator to unlock your account.' }
        }
      } else {
        // For demo users, always clear any lockout data that might exist
        await this.forceClearLockout(user.id, email)
        console.log('UserManagementService: Demo user - lockout check bypassed and cleared')
      }

      // Try Supabase Auth first (for users created through Supabase Auth)
      let authSuccess = false
      let credentials: UserCredentials | null = null

      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (authData?.session && !authError) {
          console.log('UserManagementService: Authenticated via Supabase Auth')
          authSuccess = true
          // Sign out immediately to avoid session conflicts
          await supabase.auth.signOut()
          // Create dummy credentials for compatibility
          credentials = { email, password: '' }
        }
      } catch (authErr) {
        console.log('UserManagementService: Supabase Auth not applicable, trying local credentials')
      }

      // If Supabase Auth failed, try local credentials
      if (!authSuccess) {
        credentials = await this.getUserCredentials(user.id)
        if (!credentials || !await this.verifyPassword(password, credentials.password)) {
          await this.recordFailedLogin(email, 'Invalid password')
          await this.incrementLoginAttempts(user.id)
          return { status: 'success', data: null }
        }
      }

      // Reset login attempts on successful login
      await this.resetLoginAttempts(user.id)

      // Update last login
      await this.updateLastLogin(user.id)

      const authenticatedUser: SystemUserWithCredentials = {
        ...user,
        credentials,
        lastLogin: new Date().toISOString(),
        loginAttempts: 0,
        isLocked: false
      }

      await auditLogger.logSecurityEvent('USER_AUTHENTICATION_SUCCESS', 'users', true, {
        userId: user.id,
        email
      })

      return { status: 'success', data: authenticatedUser }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_AUTHENTICATION_ERROR', 'users', false, {
        email,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Update user credentials
   */
  static async updateUserCredentials(
    userId: string,
    newCredentials: UserCredentials
  ): Promise<ServiceResponse<void>> {
    try {
      await auditLogger.logSecurityEvent('USER_CREDENTIALS_UPDATE', 'users', true, { userId })

      await this.saveUserCredentials(userId, newCredentials)

      await auditLogger.logSecurityEvent('USER_CREDENTIALS_UPDATED', 'users', true, { userId })

      return { status: 'success' }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_CREDENTIALS_UPDATE_FAILED', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Delete system user
   */
  static async deleteSystemUser(userId: string): Promise<ServiceResponse<void>> {
    try {
      console.log('UserManagementService: Starting user deletion process')
      await auditLogger.logSecurityEvent('SYSTEM_USER_DELETE', 'users', true, { userId })

      // Delete user profile (cascade will handle related records)
      const deleteResponse = await userProfileService.deleteUser(userId)
      if (deleteResponse.status === 'error') {
        return deleteResponse
      }

      // Additional Supabase cleanup for user management specific tables
      try {
        // Clear any MFA-related data
        await supabase
          .from('user_settings')
          .update({
            fresh_mfa_secret: null,
            fresh_mfa_enabled: false,
            fresh_mfa_setup_completed: false,
            fresh_mfa_backup_codes: null
          })
          .eq('user_id', userId)
        console.log('UserManagementService: Cleared MFA data for deleted user')
      } catch (mfaError) {
        console.log('UserManagementService: MFA cleanup failed or tables missing')
      }

      // Remove credentials
      await this.removeUserCredentials(userId)

      // Clean up login statistics
      localStorage.removeItem(`loginStats_${userId}`)

      // Clean up any failed login attempts for this user by email
      try {
        const userEmail = await this.getUserEmail(userId)
        if (userEmail) {
          // Remove from localStorage failed attempts
          const existingAttempts = localStorage.getItem('failed_login_attempts')
          if (existingAttempts) {
            let attempts = JSON.parse(existingAttempts)
            attempts = attempts.filter((attempt: any) => attempt.email !== userEmail)
            localStorage.setItem('failed_login_attempts', JSON.stringify(attempts))
          }

          // Try to remove from Supabase failed_login_attempts if available
          try {
            await supabase
              .from('failed_login_attempts')
              .delete()
              .eq('email', userEmail)
          } catch (supabaseError) {
            console.log('Could not remove failed login attempts from Supabase (table may not exist)')
          }
        }
      } catch (emailError) {
        console.log('Could not retrieve user email for cleanup, continuing with deletion')
      }

      // Enhanced deletion tracking to prevent recreation
      const deletedUsers = localStorage.getItem('deletedUsers')
      let deletedUserIds = []
      if (deletedUsers) {
        try {
          deletedUserIds = JSON.parse(deletedUsers)
        } catch (parseError) {
          console.warn('Failed to parse deleted users list:', parseError)
          deletedUserIds = []
        }
      }

      if (!deletedUserIds.includes(userId)) {
        deletedUserIds.push(userId)
        localStorage.setItem('deletedUsers', JSON.stringify(deletedUserIds))
        console.log('UserManagementService: Added user to deleted list')
      }

      // ALSO track deleted emails to prevent recreation via email matching
      const deletedEmails = localStorage.getItem('deletedUserEmails')
      let deletedEmailList = []
      if (deletedEmails) {
        try {
          deletedEmailList = JSON.parse(deletedEmails)
        } catch (parseError) {
          console.warn('Failed to parse deleted emails list:', parseError)
          deletedEmailList = []
        }
      }

      // Get user email from the earlier fetch and track it
      try {
        const userEmail = await this.getUserEmail(userId)
        if (userEmail && !deletedEmailList.includes(userEmail.toLowerCase())) {
          deletedEmailList.push(userEmail.toLowerCase())
          localStorage.setItem('deletedUserEmails', JSON.stringify(deletedEmailList))
          console.log('UserManagementService: Added email to deleted list')
        }
      } catch (emailError) {
        console.log('Could not get user email for deletion tracking, continuing...')
      }

      await auditLogger.logSecurityEvent('SYSTEM_USER_DELETED', 'users', true, { userId })
      console.log('UserManagementService: User deletion completed successfully')

      return { status: 'success' }

    } catch (error: any) {
      console.error('UserManagementService: Failed to delete user:', error)
      await auditLogger.logSecurityEvent('SYSTEM_USER_DELETE_FAILED', 'users', false, {
        userId,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Get user credentials (encrypted storage)
   */
  private static async getUserCredentials(userId: string): Promise<UserCredentials | null> {
    try {
      // Use the single source of truth from getStoredCredentials
      // This ensures we don't have conflicting logic between storage methods
      const storedCredentials = await this.getStoredCredentials(userId)
      return storedCredentials

    } catch (error) {
      console.error('Failed to get user credentials:', error)
      return null
    }
  }

  /**
   * Save user credentials (encrypted)
   */
  private static async saveUserCredentials(userId: string, credentials: UserCredentials): Promise<void> {
    try {
      // Store credentials securely - storeCredentials will handle encryption
      // Don't double-encrypt the password here, let storeCredentials handle it
      await this.storeCredentials(userId, credentials)

    } catch (error) {
      throw new Error(`Failed to save credentials: ${error}`)
    }
  }

  /**
   * Remove user credentials
   */
  private static async removeUserCredentials(userId: string): Promise<void> {
    try {
      await this.removeStoredCredentials(userId)
    } catch (error) {
      console.error('Failed to remove credentials:', error)
    }
  }

  /**
   * Get user login statistics
   */
  private static async getUserLoginStats(userId: string): Promise<{
    lastLogin?: string
    loginAttempts: number
    isLocked: boolean
  }> {
    try {
      // Try Supabase first, fall back to localStorage if tables don't exist
      try {
        let userEmail = await this.getUserEmail(userId)

        // Handle demo user emails if Supabase lookup fails
        if (!userEmail) {
          const demoUserMap: { [key: string]: string } = {
            'demo-user-123': 'demo@carexps.com',
            'super-user-456': 'elmfarrell@yahoo.com',
            'pierre-user-789': 'pierre@phaetonai.com'
          }
          userEmail = demoUserMap[userId]
        }

        if (userEmail) {
          const { data: attempts, error } = await supabase
            .from('failed_login_attempts')
            .select('*')
            .eq('email', userEmail)
            .gte('attempted_at', new Date(Date.now() - this.LOCKOUT_DURATION).toISOString())
            .order('attempted_at', { ascending: false })

          if (!error && attempts) {
            const recentAttempts = attempts.length
            const isLocked = recentAttempts >= this.MAX_LOGIN_ATTEMPTS

            // Get last successful login from users table
            const { data: user } = await supabase
              .from('users')
              .select('last_login')
              .eq('id', userId)
              .single()

            return {
              lastLogin: user?.last_login || undefined,
              loginAttempts: recentAttempts,
              isLocked
            }
          }
        }
      } catch (supabaseError) {
        console.log('UserManagementService: Supabase failed_login_attempts table not available, using localStorage fallback')
      }

      // Fallback to localStorage
      const storedStats = localStorage.getItem(`loginStats_${userId}`)
      if (storedStats) {
        const stats = JSON.parse(storedStats)
        const now = Date.now()

        // Check if lockoutUntil is set and still in the future
        const lockoutExpiry = stats.lockoutUntil ? new Date(stats.lockoutUntil).getTime() : 0

        // Additional check: if lockoutUntil is undefined or null, user is not locked
        const isLocked = stats.lockoutUntil && lockoutExpiry > now

        return {
          lastLogin: stats.lastLogin,
          loginAttempts: stats.loginAttempts || 0,
          isLocked: Boolean(isLocked) // Ensure boolean return
        }
      }

      // Return default stats if no stored data
      return { loginAttempts: 0, isLocked: false }

    } catch (error) {
      console.error('Failed to get login stats:', error)
      return { loginAttempts: 0, isLocked: false }
    }
  }

  /**
   * Record failed login attempt
   */
  private static async recordFailedLogin(email: string, reason: string): Promise<void> {
    try {
      // Try Supabase first, fall back to localStorage if table doesn't exist
      try {
        const { error } = await supabase
          .from('failed_login_attempts')
          .insert({
            email,
            ip_address: await this.getClientIP(),
            user_agent: navigator.userAgent,
            reason,
            attempted_at: new Date().toISOString()
          })

        if (!error) {
          console.log('UserManagementService: Failed login recorded in Supabase')
          return
        }
      } catch (supabaseError) {
        console.log('UserManagementService: Supabase failed_login_attempts table not available, using localStorage fallback')
      }

      // Fallback to localStorage
      const attemptData = {
        email,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent,
        reason,
        attempted_at: new Date().toISOString()
      }

      const existingAttempts = localStorage.getItem('failed_login_attempts')
      let attempts = []
      if (existingAttempts) {
        attempts = JSON.parse(existingAttempts)
      }

      attempts.push(attemptData)

      // Keep only last 100 attempts to prevent localStorage from growing too large
      if (attempts.length > 100) {
        attempts = attempts.slice(-100)
      }

      localStorage.setItem('failed_login_attempts', JSON.stringify(attempts))
      console.log('UserManagementService: Failed login recorded in localStorage')

    } catch (error) {
      console.error('Failed to record failed login:', error)
    }
  }

  /**
   * Increment login attempts for user
   */
  private static async incrementLoginAttempts(userId: string): Promise<void> {
    try {
      const email = await this.getUserEmail(userId)
      if (email) {
        await this.recordFailedLogin(email, 'Invalid password')

        // Also update localStorage stats for the user
        const storedStats = localStorage.getItem(`loginStats_${userId}`)
        let stats = { loginAttempts: 0, lastLogin: undefined }
        if (storedStats) {
          stats = JSON.parse(storedStats)
        }

        stats.loginAttempts = (stats.loginAttempts || 0) + 1

        // Set lockout time if max attempts reached
        if (stats.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
          stats.lockoutUntil = new Date(Date.now() + this.LOCKOUT_DURATION).toISOString()
        }

        localStorage.setItem(`loginStats_${userId}`, JSON.stringify(stats))
      }
    } catch (error) {
      console.error('Failed to increment login attempts:', error)
    }
  }

  /**
   * Reset login attempts for user
   */
  private static async resetLoginAttempts(userId: string): Promise<void> {
    try {
      let email = await this.getUserEmail(userId)

      // Handle demo user emails if Supabase lookup fails
      if (!email) {
        const demoUserMap: { [key: string]: string } = {
          'demo-user-123': 'demo@carexps.com',
          'super-user-456': 'elmfarrell@yahoo.com',
          'pierre-user-789': 'pierre@phaetonai.com'
        }
        email = demoUserMap[userId]
      }

      if (email) {
        // Try Supabase first, fall back to localStorage if table doesn't exist
        try {
          await supabase
            .from('failed_login_attempts')
            .delete()
            .eq('email', email)
          console.log('UserManagementService: Login attempts reset in Supabase')
        } catch (supabaseError) {
          console.log('UserManagementService: Supabase failed_login_attempts table not available, using localStorage fallback')
        }

        // Always reset localStorage stats
        const stats = {
          loginAttempts: 0,
          lastLogin: new Date().toISOString(),
          lockoutUntil: undefined
        }
        localStorage.setItem(`loginStats_${userId}`, JSON.stringify(stats))

        // Also clean up localStorage failed attempts for this email
        const existingAttempts = localStorage.getItem('failed_login_attempts')
        if (existingAttempts) {
          let attempts = JSON.parse(existingAttempts)
          attempts = attempts.filter((attempt: any) => attempt.email !== email)
          localStorage.setItem('failed_login_attempts', JSON.stringify(attempts))
        }
      } else {
        // If no email found at all, still reset the localStorage stats for this user
        const stats = {
          loginAttempts: 0,
          lastLogin: new Date().toISOString(),
          lockoutUntil: undefined
        }
        localStorage.setItem(`loginStats_${userId}`, JSON.stringify(stats))
        console.log('UserManagementService: Reset localStorage stats for user')
      }
    } catch (error) {
      console.error('Failed to reset login attempts:', error)
    }
  }

  /**
   * Update last login timestamp
   */
  private static async updateLastLogin(userId: string): Promise<void> {
    const now = new Date().toISOString()

    try {
      // Try to update Supabase first
      await supabase
        .from('users')
        .update({
          last_login: now
        })
        .eq('id', userId)
    } catch (error) {
      console.log('Could not update last login in Supabase (table may not exist), using localStorage fallback')
    }

    // Always update localStorage as well for local development and as backup
    try {
      const loginStatsKey = `loginStats_${userId}`
      const existingStats = localStorage.getItem(loginStatsKey)
      let stats = { loginAttempts: 0, lastLogin: undefined, lockoutUntil: undefined }

      if (existingStats) {
        stats = JSON.parse(existingStats)
      }

      stats.lastLogin = now
      localStorage.setItem(loginStatsKey, JSON.stringify(stats))
      console.log('UserManagementService: Updated lastLogin in localStorage')
    } catch (error) {
      console.error('Failed to update last login in localStorage:', error)
    }
  }

  /**
   * Get user email by ID
   */
  private static async getUserEmail(userId: string): Promise<string | null> {
    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      if (!error && data?.email) {
        return data.email
      }
    } catch (error) {
      console.log('UserManagementService: Supabase email lookup failed, trying localStorage fallback')
    }

    // Fallback to localStorage credentials
    try {
      const credentials = await this.getStoredCredentials(userId)
      if (credentials?.email) {
        console.log('UserManagementService: Email found in localStorage credentials')
        return credentials.email
      }
    } catch (error) {
      console.log('UserManagementService: localStorage email lookup failed, trying hardcoded demo users')
    }

    return null
  }

  /**
   * Hash password (implement proper hashing in production)
   */
  private static async hashPassword(password: string): Promise<string> {
    // For demo purposes - implement proper password hashing in production
    // Use bcrypt, scrypt, or Argon2
    return await encryptionService.encryptString(password)
  }

  /**
   * Verify password
   */
  private static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const decrypted = await encryptionService.decryptString(hashedPassword)
      return password === decrypted
    } catch (error) {
      return false
    }
  }

  /**
   * Change user password (for super users)
   * CRITICAL SECURITY: This method ensures old passwords are completely invalidated
   */
  static async changeUserPassword(userId: string, newPassword: string): Promise<ServiceResponse<boolean>> {
    try {
      console.log('UserManagementService: Starting password change process')

      // STEP 1: Get user email for credentials
      let userEmail = await this.getUserEmail(userId)
      if (!userEmail) {
        const demoUserMap: { [key: string]: string } = {
          'demo-user-123': 'demo@carexps.com',
          'super-user-456': 'elmfarrell@yahoo.com',
          'pierre-user-789': 'pierre@phaetonai.com'
        }
        userEmail = demoUserMap[userId]
      }

      if (!userEmail) {
        throw new Error(`Cannot change password: User email not found for user ID ${userId}`)
      }

      // STEP 2: Log the password change attempt
      await auditLogger.logSecurityEvent('USER_PASSWORD_CHANGE_ATTEMPT', 'users', true, {
        userId,
        userEmail,
        timestamp: new Date().toISOString(),
        changedBy: 'super_user'
      })

      // STEP 3: Create new credentials object
      const newCredentials: UserCredentials = {
        email: userEmail,
        password: newPassword,  // Pass the plain password - storeCredentials will encrypt it
        tempPassword: false
      }

      // STEP 4: Store the new credentials (this will automatically clear old ones first)
      await this.saveUserCredentials(userId, newCredentials)
      console.log('UserManagementService: New credentials stored for user')

      // STEP 5: For demo users, also update the corresponding demo user ID
      if (userEmail) {
        const emailToIdMap: { [key: string]: string } = {
          'demo@carexps.com': 'demo-user-123',
          'elmfarrell@yahoo.com': 'super-user-456',
          'pierre@phaetonai.com': 'pierre-user-789'
        }
        const demoUserId = emailToIdMap[userEmail]
        if (demoUserId && demoUserId !== userId) {
          console.log('UserManagementService: Also updating credentials for demo user')
          await this.saveUserCredentials(demoUserId, newCredentials)
        }
      }

      // STEP 6: Verify the password change by testing the new credentials
      console.log('UserManagementService: Verifying password change')
      const verificationResult = await this.authenticateUser(userEmail, newPassword)
      if (verificationResult.status !== 'success' || !verificationResult.data) {
        throw new Error('Password change verification failed - new password does not authenticate')
      }
      console.log('UserManagementService: Password change verification successful')

      // STEP 7: Clear any existing lockouts or failed login attempts
      await this.clearAccountLockout(userId)

      // STEP 8: Log successful password change
      await auditLogger.logSecurityEvent('USER_PASSWORD_CHANGED', 'users', true, {
        userId,
        userEmail,
        timestamp: new Date().toISOString(),
        changedBy: 'super_user',
        verified: true
      })

      console.log('UserManagementService: Password changed and verified successfully')
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('UserManagementService: Failed to change password:', error)
      await auditLogger.logSecurityEvent('USER_PASSWORD_CHANGE_FAILED', 'users', false, {
        userId,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      return { status: 'error', error: error.message || 'Failed to change password' }
    }
  }

  /**
   * Get client IP address
   */
  private static async getClientIP(): Promise<string> {
    try {
      // In a real implementation, get this from the server
      return 'localhost'
    } catch (error) {
      return 'unknown'
    }
  }

  /**
   * Store credentials securely (implementation-specific)
   * CRITICAL: This method ensures complete credential replacement to prevent old passwords from working
   */
  private static async storeCredentials(userId: string, credentials: UserCredentials): Promise<void> {
    try {
      console.log('UserManagementService: Storing new credentials for user')

      // STEP 1: Clear ALL existing credentials first to prevent old passwords from working
      await this.removeStoredCredentials(userId)
      console.log('UserManagementService: Cleared all existing credentials for user')

      // STEP 2: Encrypt the password within the credentials object
      const credentialsToStore = {
        ...credentials,
        password: await this.hashPassword(credentials.password)
      }

      // STEP 3: Encrypt the entire credentials object
      const encryptedCredentials = await encryptionService.encryptString(JSON.stringify(credentialsToStore))

      // STEP 4: Try Supabase first
      let supabaseSuccess = false
      try {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: userId,
            encrypted_retell_api_key: encryptedCredentials
          })

        if (!error) {
          console.log('UserManagementService: Credentials stored in Supabase successfully')
          supabaseSuccess = true
        }
      } catch (supabaseError) {
        console.log('UserManagementService: Supabase credential storage failed, using localStorage only')
      }

      // STEP 5: Always store in localStorage (as backup or primary)
      localStorage.setItem(`userCredentials_${userId}`, encryptedCredentials)
      console.log('UserManagementService: Credentials stored in localStorage successfully')

      // STEP 6: Verify the credentials were stored properly by testing decryption
      const verifyCredentials = await this.getStoredCredentials(userId)
      if (!verifyCredentials || verifyCredentials.email !== credentials.email) {
        throw new Error('Credential verification failed - stored credentials could not be retrieved')
      }
      console.log('UserManagementService: Credential storage verified')

    } catch (error) {
      console.error(`UserManagementService: Failed to store credentials for user ${userId}:`, error)
      throw new Error(`Failed to store user credentials: ${error}`)
    }
  }

  /**
   * Get stored credentials
   */
  private static async getStoredCredentials(userId: string): Promise<UserCredentials | null> {
    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from('user_profiles')
        .select('encrypted_retell_api_key')
        .eq('user_id', userId)
        .single()

      if (!error && data?.encrypted_retell_api_key) {
        const decrypted = await encryptionService.decryptString(data.encrypted_retell_api_key)
        console.log('UserManagementService: Credentials loaded from Supabase')
        return JSON.parse(decrypted)
      }
    } catch (error) {
      console.log('UserManagementService: Supabase credential retrieval failed, using localStorage fallback')
    }

    // Fallback to localStorage
    try {
      const encryptedCredentials = localStorage.getItem(`userCredentials_${userId}`)
      if (!encryptedCredentials) {
        return null
      }

      const decrypted = await encryptionService.decryptString(encryptedCredentials)
      console.log('UserManagementService: Credentials loaded from localStorage')
      return JSON.parse(decrypted)

    } catch (error) {
      console.error('UserManagementService: Failed to retrieve credentials:', error)
      return null
    }
  }

  /**
   * Remove stored credentials completely from all storage locations
   * CRITICAL: This ensures old credentials cannot be retrieved after password changes
   */
  private static async removeStoredCredentials(userId: string): Promise<void> {
    console.log('UserManagementService: Removing all stored credentials')

    // STEP 1: Remove from Supabase
    try {
      await supabase
        .from('user_profiles')
        .update({
          encrypted_retell_api_key: null
        })
        .eq('user_id', userId)
      console.log('UserManagementService: Credentials removed from Supabase')
    } catch (error) {
      console.log('UserManagementService: Supabase credential removal failed (table may not exist)')
    }

    // STEP 2: Remove from localStorage
    try {
      localStorage.removeItem(`userCredentials_${userId}`)
      console.log('UserManagementService: Credentials removed from localStorage')
    } catch (error) {
      console.error('UserManagementService: Failed to remove credentials from localStorage:', error)
    }

    // STEP 3: Clear any cached authentication data that might contain old credentials
    try {
      // Clear any additional cached data related to this user
      localStorage.removeItem(`loginStats_${userId}`)
      console.log('UserManagementService: Cleared login stats cache for user')
    } catch (error) {
      console.log('UserManagementService: Could not clear login stats cache (non-critical)')
    }

    // STEP 4: Verify removal by attempting to retrieve credentials
    try {
      const remainingCredentials = await this.getStoredCredentials(userId)
      if (remainingCredentials) {
        console.warn(`UserManagementService: WARNING - credentials still found after removal for user ${userId}`)
      } else {
        console.log('UserManagementService: Verified complete credential removal')
      }
    } catch (error) {
      // This is expected if credentials are properly removed
      console.log('UserManagementService: Credential removal verification complete')
    }
  }

  /**
   * Disable user account (lock them out) - super users only
   */
  static async disableUser(userId: string, reason?: string): Promise<ServiceResponse<boolean>> {
    try {
      console.log('UserManagementService: Disabling user account:', userId)

      // Update user in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          is_locked: true,
          locked_reason: reason || 'Account disabled by super user',
          locked_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      // Update in localStorage
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          const userIndex = users.findIndex((u: any) => u.id === userId)
          if (userIndex >= 0) {
            users[userIndex].isLocked = true
            localStorage.setItem('systemUsers', JSON.stringify(users))
          }
        } catch (parseError) {
          console.warn('Failed to update localStorage:', parseError)
        }
      }

      console.log('✅ User account disabled successfully')

      // Log the action
      await auditLogger.logSecurityEvent(
        'USER_DISABLED',
        'users',
        true,
        {
          userId,
          reason: reason || 'Disabled by super user',
          disabledBy: 'super_user'
        }
      )

      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('❌ Failed to disable user:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Enable user account (unlock them) - super users only
   */
  static async enableUser(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      console.log('UserManagementService: Enabling user account:', userId)

      // Clear lockout in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          is_locked: false,
          locked_reason: null,
          locked_at: null,
          failed_login_attempts: 0,
          last_failed_login: null
        })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      // Update in localStorage
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          const userIndex = users.findIndex((u: any) => u.id === userId)
          if (userIndex >= 0) {
            users[userIndex].isLocked = false
            localStorage.setItem('systemUsers', JSON.stringify(users))
          }
        } catch (parseError) {
          console.warn('Failed to update localStorage:', parseError)
        }
      }

      console.log('✅ User account enabled successfully')

      // Log the action
      await auditLogger.logSecurityEvent(
        'USER_ENABLED',
        'users',
        true,
        {
          userId,
          enabledBy: 'super_user'
        }
      )

      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('❌ Failed to enable user:', error)
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Clear account lockout for a user (for super users)
   */
  static async clearAccountLockout(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      console.log('UserManagementService: Clearing account lockout')

      // Get user email first, with fallback for demo users
      let userEmail = await this.getUserEmail(userId)

      // Handle demo user emails if Supabase lookup fails
      if (!userEmail) {
        const demoUserMap: { [key: string]: string } = {
          'demo-user-123': 'demo@carexps.com',
          'super-user-456': 'elmfarrell@yahoo.com',
          'pierre-user-789': 'pierre@phaetonai.com'
        }
        userEmail = demoUserMap[userId]
        console.log('UserManagementService: Using demo email mapping')
      }

      // 1. Clear Supabase failed_login_attempts (if available and email found)
      if (userEmail) {
        try {
          await supabase
            .from('failed_login_attempts')
            .delete()
            .eq('email', userEmail)
          console.log('UserManagementService: Cleared Supabase failed_login_attempts')
        } catch (supabaseError) {
          console.log('UserManagementService: Supabase failed_login_attempts table not available or error occurred')
        }
      }

      // 2. Clear localStorage loginStats for the user (force unlock)
      const loginStatsKey = `loginStats_${userId}`
      const clearedStats = {
        loginAttempts: 0,
        lastLogin: undefined,
        lockoutUntil: undefined // Explicitly clear lockout
      }
      localStorage.setItem(loginStatsKey, JSON.stringify(clearedStats))
      console.log('UserManagementService: Cleared localStorage loginStats')

      // 3. Clear localStorage failed_login_attempts for this email (if email found)
      if (userEmail) {
        try {
          const existingAttempts = localStorage.getItem('failed_login_attempts')
          if (existingAttempts) {
            let attempts = JSON.parse(existingAttempts)
            const originalCount = attempts.length
            attempts = attempts.filter((attempt: any) => attempt.email !== userEmail)
            localStorage.setItem('failed_login_attempts', JSON.stringify(attempts))
            console.log(`UserManagementService: Removed ${originalCount - attempts.length} failed attempts`)
          }
        } catch (error) {
          console.error('UserManagementService: Error clearing failed_login_attempts from localStorage:', error)
          // If parsing fails, just remove the entire item to be safe
          localStorage.removeItem('failed_login_attempts')
        }
      }

      // 4. Try to update last_login in Supabase (if available)
      try {
        await supabase
          .from('users')
          .update({
            last_login: new Date().toISOString()
          })
          .eq('id', userId)
        console.log('UserManagementService: Updated last_login in Supabase')
      } catch (error) {
        console.log('UserManagementService: Could not update last_login in Supabase (table may not exist)')
      }

      console.log('UserManagementService: Account lockout comprehensively cleared')
      return { status: 'success', data: true }

    } catch (error: any) {
      console.error('UserManagementService: Failed to clear account lockout:', error)
      return { status: 'error', error: error.message || 'Failed to clear account lockout' }
    }
  }

  /**
   * Forcefully clear all lockout data for a user (debugging/emergency use)
   */
  static async forceClearLockout(userId: string, userEmail?: string): Promise<void> {
    try {
      console.log('UserManagementService: Force clearing all lockout data')

      // Get email if not provided
      if (!userEmail) {
        userEmail = await this.getUserEmail(userId)
        if (!userEmail) {
          const demoUserMap: { [key: string]: string } = {
            'demo-user-123': 'demo@carexps.com',
            'super-user-456': 'elmfarrell@yahoo.com',
            'pierre-user-789': 'pierre@phaetonai.com'
          }
          userEmail = demoUserMap[userId]
        }
      }

      // Clear all possible localStorage entries
      localStorage.removeItem(`loginStats_${userId}`)
      localStorage.removeItem(`userCredentials_${userId}`)

      if (userEmail) {
        // Clear from global failed attempts
        const existingAttempts = localStorage.getItem('failed_login_attempts')
        if (existingAttempts) {
          try {
            let attempts = JSON.parse(existingAttempts)
            attempts = attempts.filter((attempt: any) => attempt.email !== userEmail)
            localStorage.setItem('failed_login_attempts', JSON.stringify(attempts))
          } catch {
            localStorage.removeItem('failed_login_attempts')
          }
        }
      }

      // Set clean state
      const cleanStats = {
        loginAttempts: 0,
        lastLogin: undefined,
        lockoutUntil: undefined
      }
      localStorage.setItem(`loginStats_${userId}`, JSON.stringify(cleanStats))

      console.log('UserManagementService: Force clear completed')
    } catch (error) {
      console.error('UserManagementService: Force clear failed:', error)
    }
  }

  /**
   * Debug method to check lockout status (for troubleshooting)
   */
  static async debugLockoutStatus(userId: string): Promise<{
    userId: string
    userEmail: string | null
    loginStats: any
    isCurrentlyLocked: boolean
    supabaseData?: any
    localStorageData: any
  }> {
    try {
      // Get user email with demo fallback
      let userEmail = await this.getUserEmail(userId)
      if (!userEmail) {
        const demoUserMap: { [key: string]: string } = {
          'demo-user-123': 'demo@carexps.com',
          'super-user-456': 'elmfarrell@yahoo.com',
          'pierre-user-789': 'pierre@phaetonai.com'
        }
        userEmail = demoUserMap[userId]
      }

      // Get current login stats
      const loginStats = await this.getUserLoginStats(userId)

      // Get localStorage data
      const localLoginStats = localStorage.getItem(`loginStats_${userId}`)
      const localFailedAttempts = localStorage.getItem('failed_login_attempts')

      const debugInfo = {
        userId,
        userEmail,
        loginStats,
        isCurrentlyLocked: loginStats.isLocked,
        localStorageData: {
          loginStats: localLoginStats ? JSON.parse(localLoginStats) : null,
          failedAttempts: localFailedAttempts ? JSON.parse(localFailedAttempts) : null
        }
      }

      console.log('UserManagementService: Debug lockout status:', JSON.stringify(debugInfo, null, 2))
      return debugInfo

    } catch (error) {
      console.error('UserManagementService: Debug lockout status failed:', error)
      return {
        userId,
        userEmail: null,
        loginStats: { loginAttempts: 0, isLocked: false },
        isCurrentlyLocked: false,
        localStorageData: null
      }
    }
  }

  /**
   * Fix double-encrypted passwords for affected users
   * This method should be called after the authentication fix to clean up existing users
   */
  static async fixDoubleEncryptedPasswords(): Promise<ServiceResponse<{ fixed: number; errors: string[] }>> {
    try {
      console.log('UserManagementService: Starting to fix double-encrypted passwords...')
      const result = { fixed: 0, errors: [] as string[] }

      // Get all system users
      const usersResponse = await this.loadSystemUsers()
      if (usersResponse.status === 'error') {
        return { status: 'error', error: `Failed to load users: ${usersResponse.error}` }
      }

      const users = usersResponse.data || []
      console.log(`UserManagementService: Found ${users.length} users to check`)

      for (const user of users) {
        try {
          // Try to get stored credentials
          const credentials = await this.getUserCredentials(user.id)
          if (!credentials) {
            console.log('UserManagementService: No credentials found for user')
            continue
          }

          // Test if the password is double-encrypted by trying to decrypt it twice
          try {
            const onceDecrypted = await encryptionService.decryptString(credentials.password)
            // If we can decrypt it again, it was double-encrypted
            const twiceDecrypted = await encryptionService.decryptString(onceDecrypted)

            console.log('UserManagementService: Found double-encrypted password for user')

            // Fix the password by storing the once-decrypted version as the new plain password
            const fixedCredentials: UserCredentials = {
              email: credentials.email,
              password: onceDecrypted, // This is the actual password that was double-encrypted
              tempPassword: credentials.tempPassword || false
            }

            await this.saveUserCredentials(user.id, fixedCredentials)
            result.fixed++
            console.log('UserManagementService: Fixed password for user')

          } catch (decryptError) {
            // If we can't decrypt twice, the password is correctly encrypted (single encryption)
            console.log('UserManagementService: Password for user is correctly encrypted')
          }

        } catch (error: any) {
          const errorMsg = `Failed to fix password for user ${user.email}: ${error.message}`
          console.error('UserManagementService:', errorMsg)
          result.errors.push(errorMsg)
        }
      }

      await auditLogger.logSecurityEvent('PASSWORD_DOUBLE_ENCRYPTION_FIX', 'users', true, {
        usersFixed: result.fixed,
        errors: result.errors.length
      })

      console.log(`UserManagementService: Password fix complete. Fixed: ${result.fixed}, Errors: ${result.errors.length}`)
      return { status: 'success', data: result }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('PASSWORD_DOUBLE_ENCRYPTION_FIX_FAILED', 'users', false, {
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Clean up duplicate users in the system
   */
  static async cleanupDuplicateUsers(): Promise<ServiceResponse<{ removed: number; remaining: number }>> {
    try {
      await auditLogger.logSecurityEvent('DUPLICATE_CLEANUP_START', 'users', true)

      const result = await userProfileService.removeDuplicateUsers()
      if (result.status === 'error') {
        return result
      }

      await auditLogger.logSecurityEvent('DUPLICATE_CLEANUP_COMPLETED', 'users', true, {
        removedCount: result.data?.removed || 0,
        remainingCount: result.data?.remaining || 0
      })

      return result
    } catch (error: any) {
      await auditLogger.logSecurityEvent('DUPLICATE_CLEANUP_FAILED', 'users', false, {
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Clean up duplicate user profiles causing role switching
   * Removes "User" role profiles while preserving "Super User" profiles
   */
  static async cleanupDuplicateProfiles(): Promise<ServiceResponse<{ removed: number; updated: boolean }>> {
    try {
      console.log('🧹 CLEANUP: Removing duplicate user profiles causing role switching')
      await auditLogger.logSecurityEvent('DUPLICATE_PROFILE_CLEANUP_START', 'users', true)

      // 1. Check current systemUsers
      const systemUsers = localStorage.getItem('systemUsers')
      if (!systemUsers) {
        console.log('❌ No systemUsers found in localStorage')
        return { status: 'error', error: 'No systemUsers found in localStorage' }
      }

      const users = JSON.parse(systemUsers)
      console.log(`📊 Found ${users.length} users in systemUsers`)

      // 2. Group users by email to find duplicates
      const usersByEmail: { [email: string]: any[] } = {}
      users.forEach((user: any, index: number) => {
        const email = user.email
        if (!usersByEmail[email]) {
          usersByEmail[email] = []
        }
        usersByEmail[email].push({ ...user, originalIndex: index })
      })

      // 3. Identify duplicates and remove "User" role profiles
      let cleanedUsers: any[] = []
      let removedCount = 0

      for (const [email, userList] of Object.entries(usersByEmail)) {
        if (userList.length > 1) {
          console.log(`\n⚠️ DUPLICATE FOUND for ${email}:`)
          userList.forEach((user: any, i: number) => {
            console.log(`  ${i + 1}. ID: ${user.id}, Role: ${user.role}, Name: ${user.name}`)
          })

          // Keep Super User, remove others
          const superUser = userList.find((u: any) => u.role === 'super_user')
          const userRole = userList.find((u: any) => u.role === 'user')

          if (superUser && userRole) {
            console.log(`✅ Keeping Super User profile: ${superUser.id}`)
            console.log(`🗑️ Removing User profile: ${userRole.id}`)
            cleanedUsers.push(superUser)
            removedCount++

            // Log the specific removal
            await auditLogger.logSecurityEvent('DUPLICATE_USER_PROFILE_REMOVED', 'users', true, {
              removedUserId: userRole.id,
              keptUserId: superUser.id,
              email: email,
              removedRole: userRole.role,
              keptRole: superUser.role
            })
          } else {
            // If no super_user, keep the first one
            console.log(`⚠️ No super_user found, keeping first profile`)
            cleanedUsers.push(userList[0])
          }
        } else {
          // No duplicates, keep the user
          cleanedUsers.push(userList[0])
        }
      }

      // 4. Update systemUsers if changes were made
      let systemUsersUpdated = false
      if (removedCount > 0) {
        console.log(`\n💾 Updating systemUsers - removed ${removedCount} duplicate profiles`)
        localStorage.setItem('systemUsers', JSON.stringify(cleanedUsers))
        console.log(`✅ Updated systemUsers: ${cleanedUsers.length} users remain`)
        systemUsersUpdated = true
      } else {
        console.log('\n✅ No duplicate profiles found to remove')
      }

      // 5. Check and fix currentUser if it's a duplicate
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser)
          console.log(`\n👤 Current user: ${userData.email} (Role: ${userData.role})`)

          // Find the corresponding cleaned user
          const cleanedUser = cleanedUsers.find((u: any) => u.email === userData.email)
          if (cleanedUser && cleanedUser.role !== userData.role) {
            console.log(`🔄 Updating currentUser role from ${userData.role} to ${cleanedUser.role}`)
            const updatedUser = { ...userData, ...cleanedUser }
            localStorage.setItem('currentUser', JSON.stringify(updatedUser))
            console.log('✅ CurrentUser updated to match cleaned profile')

            await auditLogger.logSecurityEvent('CURRENT_USER_ROLE_CORRECTED', 'users', true, {
              userId: userData.id,
              email: userData.email,
              oldRole: userData.role,
              newRole: cleanedUser.role
            })
          }
        } catch (error) {
          console.error('❌ Error checking currentUser:', error)
        }
      }

      // 6. Clean up user-specific settings for removed profiles
      console.log('\n🧹 Cleaning up user-specific localStorage keys...')
      const removedUserIds = users
        .filter((u: any) => !cleanedUsers.find((c: any) => c.id === u.id))
        .map((u: any) => u.id)

      removedUserIds.forEach((userId: string) => {
        const keysToRemove = [
          `settings_${userId}`,
          `userProfile_${userId}`,
          `user_settings_${userId}`,
          `avatar_${userId}`,
          `avatar_data_${userId}`
        ]

        keysToRemove.forEach((key: string) => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key)
            console.log(`🗑️ Removed localStorage key: ${key}`)
          }
        })
      })

      await auditLogger.logSecurityEvent('DUPLICATE_PROFILE_CLEANUP_COMPLETED', 'users', true, {
        removedCount,
        remainingCount: cleanedUsers.length,
        systemUsersUpdated
      })

      console.log('\n🎉 CLEANUP COMPLETE!')
      console.log('📝 Summary:')
      console.log(`   - Removed ${removedCount} duplicate profiles`)
      console.log(`   - ${cleanedUsers.length} users remain in systemUsers`)
      console.log(`   - Role switching should now be resolved`)
      console.log('\n💡 Refresh the page to see the changes take effect')

      return {
        status: 'success',
        data: {
          removed: removedCount,
          updated: systemUsersUpdated
        }
      }

    } catch (error: any) {
      console.error('❌ CLEANUP ERROR:', error)
      await auditLogger.logSecurityEvent('DUPLICATE_PROFILE_CLEANUP_FAILED', 'users', false, {
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Initialize default system users (for first-time setup)
   */
  static async initializeDefaultUsers(): Promise<ServiceResponse<void>> {
    try {
      // Check if any admin users exist
      const { data: adminUsers, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)

      if (error) {
        throw new Error(`Failed to check for admin users: ${error.message}`)
      }

      if (adminUsers && adminUsers.length > 0) {
        return { status: 'success' } // Admin users already exist
      }

      // Create default admin user
      const defaultAdmin: Omit<UserProfileData, 'id'> = {
        email: 'admin@carexps.com',
        name: 'System Administrator',
        role: 'admin',
        mfa_enabled: true,
        settings: {
          theme: 'dark',
          notifications: {
            email: true,
            sms: true,
            push: true,
            in_app: true,
            call_alerts: true,
            sms_alerts: true,
            security_alerts: true
          }
        }
      }

      const defaultCredentials: UserCredentials = {
        email: 'admin@carexps.com',
        password: 'ChangeMe123!',
        tempPassword: true
      }

      const createResponse = await this.createSystemUser(defaultAdmin, defaultCredentials)
      if (createResponse.status === 'error') {
        throw new Error(`Failed to create default admin: ${createResponse.error}`)
      }

      await auditLogger.logSecurityEvent('DEFAULT_ADMIN_CREATED', 'users', true, {
        email: defaultAdmin.email
      })

      return { status: 'success' }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('DEFAULT_ADMIN_CREATE_FAILED', 'users', false, {
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }

  /**
   * Get login history for a specific user from audit logs
   * Returns the last 10 login attempts (both successful and failed)
   */
  static async getUserLoginHistory(userId: string): Promise<ServiceResponse<{
    loginHistory: Array<{
      timestamp: string
      action: string
      outcome: 'SUCCESS' | 'FAILURE'
      sourceIp?: string
      userAgent?: string
      failureReason?: string
    }>
    totalLogins: number
  }>> {
    try {
      // Log the audit access attempt
      await auditLogger.logSecurityEvent('USER_LOGIN_HISTORY_ACCESS', 'users', false, {
        targetUserId: userId,
        accessedBy: auditLogger.currentUser?.id || 'system'
      })

      // Get user email for audit log filtering - try multiple approaches
      let userEmail = await this.getUserEmail(userId)

      if (!userEmail) {
        // Handle demo users with hardcoded mapping (case-insensitive)
        const demoUserMap: { [key: string]: string } = {
          'demo-user-123': 'demo@carexps.com',
          'super-user-456': 'elmfarrell@yahoo.com',
          'pierre-user-789': 'pierre@phaetonai.com',
          // Add more variations for Pierre's account
          'dynamic-pierre-user': 'pierre@phaetonai.com',
          'c550502f-c39d-4bb3-bb8c-d193657fdb24': 'pierre@phaetonai.com'
        }
        userEmail = demoUserMap[userId]
      }

      if (!userEmail) {
        // Try to get email from localStorage users
        try {
          const systemUsers = localStorage.getItem('systemUsers')
          if (systemUsers) {
            const users = JSON.parse(systemUsers)
            const user = users.find((u: any) => u.id === userId)
            if (user?.email) {
              userEmail = user.email
            }
          }
        } catch (error) {
          console.warn('Failed to get user email from localStorage:', error)
        }
      }

      if (!userEmail) {
        // Try to get email from current user if this is the current user's history
        try {
          const currentUser = localStorage.getItem('currentUser')
          if (currentUser) {
            const userData = JSON.parse(currentUser)
            if (userData.id === userId && userData.email) {
              userEmail = userData.email
            }
          }
        } catch (error) {
          console.warn('Failed to get current user email:', error)
        }
      }

      if (!userEmail) {
        console.error('Login history: Unable to find email for user ID:', userId)
        return { status: 'error', error: `User not found (ID: ${userId}). Please contact your administrator.` }
      }

      console.log(`Login history: Found user email: ${userEmail} for user ID: ${userId}`)

      // Query audit logs for login events - try multiple approaches
      const auditReport = await auditLogger.getAuditLogs({
        userId: userId,
        action: undefined, // We'll filter for LOGIN and LOGIN_FAILURE manually
        limit: 100, // Get more records to filter for login events
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
      })

      console.log(`Login history: Found ${auditReport.entries?.length || 0} audit entries`)

      if (!auditReport.entries) {
        // If no audit entries found, return empty but successful result
        console.log('Login history: No audit entries found, returning empty result')
        return {
          status: 'success',
          data: {
            loginHistory: [],
            totalLogins: 0
          }
        }
      }

      // Filter for login-related events and format them
      // Look for both user ID and email matches to be more inclusive
      const loginEvents = auditReport.entries
        .filter(entry => {
          const isLoginAction = entry.action === 'LOGIN' || entry.action === 'LOGIN_FAILURE'
          const matchesUser = entry.user_id === userId ||
                            entry.user_name?.toLowerCase() === userEmail.toLowerCase() ||
                            entry.user_id?.includes(userEmail.split('@')[0])

          return isLoginAction || matchesUser
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10) // Last 10 login attempts
        .map(entry => {
          // Process failure_reason - check if it's encrypted (legacy format)
          let processedFailureReason = entry.failure_reason

          // Check if failure_reason looks like encrypted data
          if (processedFailureReason && typeof processedFailureReason === 'string') {
            // If it looks like a JSON encrypted object, show legacy message
            if (processedFailureReason.includes('"data"') &&
                processedFailureReason.includes('"iv"') &&
                processedFailureReason.includes('"tag"')) {
              processedFailureReason = '[Legacy audit entry - reason not available]'
            }
          } else if (processedFailureReason && typeof processedFailureReason === 'object' &&
                     (processedFailureReason as any).data) {
            // If it's already parsed as an encrypted object, show legacy message
            processedFailureReason = '[Legacy audit entry - reason not available]'
          }

          return {
            timestamp: entry.timestamp,
            action: entry.action === 'LOGIN' ? 'Login' : entry.action === 'LOGIN_FAILURE' ? 'Failed Login' : entry.action,
            outcome: entry.outcome as 'SUCCESS' | 'FAILURE',
            sourceIp: entry.source_ip,
            userAgent: entry.user_agent,
            failureReason: processedFailureReason
          }
        })

      console.log(`Login history: Found ${loginEvents.length} login events after filtering`)

      // Count total successful logins
      const totalSuccessfulLogins = auditReport.entries.filter(
        entry => entry.action === 'LOGIN' && entry.outcome === 'SUCCESS' && (
          entry.user_id === userId ||
          entry.user_name?.toLowerCase() === userEmail.toLowerCase()
        )
      ).length

      console.log(`Login history: Total successful logins: ${totalSuccessfulLogins}`)

      return {
        status: 'success',
        data: {
          loginHistory: loginEvents,
          totalLogins: totalSuccessfulLogins
        }
      }

    } catch (error: any) {
      await auditLogger.logSecurityEvent('USER_LOGIN_HISTORY_ACCESS_FAILED', 'users', false, {
        targetUserId: userId,
        error: error.message
      })
      return { status: 'error', error: error.message }
    }
  }
}

export const userManagementService = UserManagementService