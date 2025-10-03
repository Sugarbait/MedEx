import { User, MFAChallenge, SessionInfo } from '@/types'
import { supabase } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import FreshMfaService from '@/services/freshMfaService'
import { secureStorage } from '@/services/secureStorage'
import { encryptionService } from '@/services/encryption'

const logger = secureLogger.component('AuthService')

class AuthService {
  async getUserProfile(accountId: string): Promise<User & { mfaVerified: boolean }> {
    try {
      logger.debug('Fetching complete user profile with cross-device sync', accountId)

      // First, try to get user from database
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('azure_ad_id', accountId)
        .single()

      if (error && error.code !== 'PGRST116') {
        logger.error('Database error fetching user profile', accountId, undefined, { error: error.message })
        throw new Error('Failed to fetch user profile from database')
      }

      let userProfile: User

      // If user doesn't exist in database, try to find by email or create new
      if (!user) {
        // Try to find existing user by searching all known users in the system
        let existingUser: any = null
        try {
          const { userProfileService } = await import('./userProfileService')

          // Load all system users to find a match
          const usersResponse = await userProfileService.loadSystemUsers()
          if (usersResponse.status === 'success' && usersResponse.data) {
            // Try to find the first admin/super_user
            if (!existingUser) {
              const adminUser = usersResponse.data.find(user =>
                user.role === 'admin' || user.role === 'super_user'
              )
              if (adminUser) {
                existingUser = adminUser
                logger.info('Found existing admin user to map', accountId, undefined, {
                  email: adminUser.email,
                  userId: adminUser.id,
                  role: adminUser.role
                })
              }
            }
          }
        } catch (lookupError) {
          logger.warn('System user lookup failed, will create new user', accountId, undefined, {
            error: lookupError instanceof Error ? lookupError.message : 'Unknown error'
          })
        }

        if (existingUser) {
          // Use existing user profile but update azure_ad_id
          userProfile = {
            ...existingUser,
            azure_ad_id: accountId,
            lastLogin: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          // Update the user in Supabase with the Azure AD ID
          try {
            await supabase
              .from('users')
              .upsert({
                id: userProfile.id,
                azure_ad_id: accountId,
                email: userProfile.email,
                name: userProfile.name,
                role: userProfile.role,
                last_login: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            logger.info('Updated existing user with Azure AD ID', accountId, undefined, { userId: userProfile.id })
          } catch (updateError) {
            logger.warn('Failed to update user in Supabase, continuing with existing profile', accountId, undefined, {
              error: updateError instanceof Error ? updateError.message : 'Unknown error'
            })
          }
        } else {
          // NEVER create generic healthcare profiles - always try to get real user info
          logger.info('User not found in database, attempting to get Azure AD profile', accountId)

          // Try to get actual user info from Azure AD/MSAL
          let userEmail = `user-${accountId.substring(0, 8)}@carexps.com`
          let userName = 'Unknown User'

          // Attempt to get real Azure AD account information
          if (typeof window !== 'undefined' && (window as any).msalInstance) {
            try {
              const accounts = (window as any).msalInstance.getAllAccounts()
              if (accounts.length > 0 && accounts[0].username) {
                userEmail = accounts[0].username
                userName = accounts[0].name || accounts[0].username.split('@')[0]
                logger.info('Retrieved real Azure AD profile info', accountId, undefined, {
                  email: userEmail,
                  name: userName
                })
              }
            } catch (azureError) {
              logger.warn('Failed to get Azure AD profile, using fallback', accountId, undefined, {
                error: azureError instanceof Error ? azureError.message : 'Unknown error'
              })
            }
          }

          const defaultUser: Partial<User> = {
            azure_ad_id: accountId,
            email: userEmail,
            name: userName,
            role: 'super_user', // Always create as super_user instead of healthcare_provider
            permissions: [
              { resource: '*', actions: ['*'] } // Full permissions for super users
            ],
            last_login: new Date().toISOString(), // Use correct database field name
            mfaEnabled: false, // Start with MFA disabled, user can enable later
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          // Insert user into database
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert(defaultUser)
            .select()
            .single()

          if (insertError) {
            logger.error('Failed to create user in database', accountId, undefined, { error: insertError.message })
            throw new Error('Failed to create user profile')
          }

          logger.info('User profile created successfully', accountId)
          userProfile = newUser as User
        }
      } else {
        // Update last login with correct field name
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('azure_ad_id', accountId)

        userProfile = user as User
      }

      // Load complete user profile data including settings and API keys
      try {
        logger.debug('Loading user settings and API keys for cross-device sync', userProfile.id)

        // Get user settings from Supabase (includes API keys and preferences)
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userProfile.id)
          .single()

        if (!settingsError && userSettings) {
          logger.debug('User settings loaded from Supabase', userProfile.id)

          // Decrypt API keys if they exist
          if (userSettings.retell_config) {
            try {
              const config = userSettings.retell_config as any
              if (config.api_key) {
                const { encryptionService } = await import('./encryption')
                const decryptedApiKey = await encryptionService.decrypt(config.api_key)

                // Add API keys to user profile
                userProfile.retellApiKey = decryptedApiKey
                userProfile.callAgentId = config.call_agent_id
                userProfile.smsAgentId = config.sms_agent_id

                logger.debug('API keys decrypted and loaded for cross-device access', userProfile.id)
              }
            } catch (decryptError) {
              logger.warn('Failed to decrypt API keys, but continuing', userProfile.id, undefined, {
                error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
              })
            }
          }

          // Add other settings to user profile
          userProfile.theme = userSettings.theme || 'light'
          userProfile.notifications = userSettings.notifications || {}
          userProfile.preferences = {
            ...userSettings.security_preferences,
            ...userSettings.communication_preferences,
            ...userSettings.accessibility_settings,
            dashboard_layout: userSettings.dashboard_layout
          }
        } else {
          logger.debug('No user settings found in Supabase, will use defaults', userProfile.id)
        }

        // Load user profile data for additional information
        const { userProfileService } = await import('./userProfileService')
        const profileResponse = await userProfileService.loadUserProfile(userProfile.id)

        if (profileResponse.status === 'success' && profileResponse.data) {
          const profileData = profileResponse.data

          // Merge profile data with user data
          if (profileData.settings) {
            userProfile.retellApiKey = userProfile.retellApiKey || profileData.settings.retellApiKey
            userProfile.callAgentId = userProfile.callAgentId || profileData.settings.callAgentId
            userProfile.smsAgentId = userProfile.smsAgentId || profileData.settings.smsAgentId
          }

          userProfile.avatar = profileData.avatar
          logger.debug('Profile data merged successfully', userProfile.id)
        }

      } catch (profileError) {
        logger.warn('Failed to load complete profile data, using basic profile', userProfile.id, undefined, {
          error: profileError instanceof Error ? profileError.message : 'Unknown error'
        })
      }

      // Check MFA verification status using Fresh MFA Service
      let mfaVerified = false
      try {
        // Check if MFA is enabled using Fresh MFA Service
        const mfaEnabled = await FreshMfaService.isMfaEnabled(userProfile.id)
        const hasMFASetup = mfaEnabled // Fresh MFA uses simple enabled/disabled state

        userProfile.mfaEnabled = mfaEnabled || hasMFASetup
        mfaVerified = mfaEnabled

        logger.debug('MFA status synchronized', userProfile.id, undefined, {
          mfaEnabled: userProfile.mfaEnabled,
          mfaVerified,
          hasMFASetup
        })
      } catch (mfaError) {
        logger.warn('Failed to sync MFA data, using basic MFA status', userProfile.id, undefined, {
          error: mfaError instanceof Error ? mfaError.message : 'Unknown error'
        })

        // Fallback to basic MFA check using Fresh MFA Service
        try {
          mfaVerified = await FreshMfaService.isMfaEnabled(userProfile.id)
        } catch (fallbackError) {
          console.warn('Fresh MFA fallback also failed:', fallbackError)
          mfaVerified = false
        }
      }

      logger.info('Complete user profile loaded with cross-device sync', userProfile.id, undefined, {
        hasApiKeys: !!(userProfile.retellApiKey && userProfile.callAgentId),
        hasMFA: userProfile.mfaEnabled,
        hasAvatar: !!userProfile.avatar,
        hasPreferences: !!userProfile.preferences
      })

      return {
        ...userProfile,
        mfaVerified
      }

    } catch (error) {
      logger.error('Failed to get user profile', accountId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async initiateMFA(userId: string): Promise<MFAChallenge> {
    try {
      logger.debug('Initiating MFA challenge', userId)

      // Check if user has MFA setup using Fresh MFA Service
      const hasMFA = await FreshMfaService.isMfaEnabled(userId)

      if (!hasMFA) {
        logger.warn('MFA not setup for user', userId)
        throw new Error('MFA not configured for this user. Please set up MFA first.')
      }

      // Create challenge token (this would typically involve your MFA provider)
      const challengeToken = crypto.randomUUID()

      // Store challenge in database with expiration
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

      await supabase
        .from('mfa_challenges')
        .insert({
          user_id: userId,
          challenge_token: challengeToken,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        })

      logger.info('MFA challenge created', userId)

      return {
        method: 'totp',
        challenge: challengeToken,
        expiresAt
      }

    } catch (error) {
      logger.error('Failed to initiate MFA', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async verifyMFA(challenge: string, code: string): Promise<boolean> {
    try {
      logger.debug('Verifying MFA code')

      // Get challenge from database
      const { data: challengeData, error } = await supabase
        .from('mfa_challenges')
        .select('*')
        .eq('challenge_token', challenge)
        .eq('used', false)
        .single()

      if (error || !challengeData) {
        logger.warn('Invalid MFA challenge token')
        return false
      }

      // Check if challenge has expired
      if (new Date() > new Date(challengeData.expires_at)) {
        logger.warn('MFA challenge has expired')
        return false
      }

      // Verify TOTP code using Fresh MFA Service
      const verificationResult = await FreshMfaService.verifyLoginCode(challengeData.user_id, code)

      if (verificationResult) {
        // Mark challenge as used
        await supabase
          .from('mfa_challenges')
          .update({ used: true, used_at: new Date().toISOString() })
          .eq('challenge_token', challenge)

        logger.info('MFA verification successful', challengeData.user_id)
        return true
      } else {
        logger.warn('MFA verification failed', challengeData.user_id)
        return false
      }

    } catch (error) {
      logger.error('MFA verification error', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  async getSessionInfo(): Promise<SessionInfo> {
    try {
      // Get current session from encrypted secure storage (instead of plain sessionStorage)
      const sessionData = await secureStorage.getItem('carexps_session')

      if (!sessionData) {
        throw new Error('No active session found')
      }

      const session = sessionData as SessionInfo

      // Check if session has expired
      if (new Date() > new Date(session.expiresAt)) {
        secureStorage.removeItem('carexps_session')
        throw new Error('Session has expired')
      }

      logger.debug('Session info retrieved', session.userId, session.sessionId)

      return session

    } catch (error) {
      logger.error('Failed to get session info', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async createSession(userId: string): Promise<SessionInfo> {
    try {
      const sessionId = crypto.randomUUID()
      const refreshToken = crypto.randomUUID() // Add refresh token for rotation
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes
      const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const sessionInfo: SessionInfo = {
        sessionId,
        userId,
        createdAt: now,
        expiresAt,
        refreshToken,
        refreshExpiresAt,
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent,
        isActive: true
      }

      // Store session in encrypted secure storage (instead of plain sessionStorage)
      await secureStorage.setSessionData('carexps_session', sessionInfo)

      // Store session in database for audit purposes with encrypted tokens
      const encryptedRefreshToken = await encryptionService.encryptString(refreshToken)

      await supabase
        .from('user_sessions')
        .insert({
          session_id: sessionId,
          user_id: userId,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          refresh_expires_at: refreshExpiresAt.toISOString(),
          encrypted_refresh_token: encryptedRefreshToken,
          ip_address: sessionInfo.ipAddress,
          user_agent: sessionInfo.userAgent,
          is_active: true
        })

      logger.info('Secure session created with token rotation', userId, sessionId)

      return sessionInfo

    } catch (error) {
      logger.error('Failed to create session', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async refreshSession(): Promise<SessionInfo> {
    try {
      const currentSession = await this.getSessionInfo()

      // Check if refresh token is still valid
      if (!currentSession.refreshToken || !currentSession.refreshExpiresAt) {
        throw new Error('No refresh token available')
      }

      if (new Date() > new Date(currentSession.refreshExpiresAt)) {
        throw new Error('Refresh token expired')
      }

      // Create new session with token rotation
      const newSessionId = crypto.randomUUID()
      const newRefreshToken = crypto.randomUUID()
      const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const refreshedSession: SessionInfo = {
        ...currentSession,
        sessionId: newSessionId,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        refreshExpiresAt: newRefreshExpiresAt
      }

      // Update encrypted session storage
      await secureStorage.setSessionData('carexps_session', refreshedSession)

      // Invalidate old session and create new one in database
      await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          invalidated_at: new Date().toISOString()
        })
        .eq('session_id', currentSession.sessionId)

      // Create new session record with new encrypted refresh token
      const encryptedRefreshToken = await encryptionService.encryptString(newRefreshToken)

      await supabase
        .from('user_sessions')
        .insert({
          session_id: newSessionId,
          user_id: currentSession.userId,
          created_at: new Date().toISOString(),
          expires_at: newExpiresAt.toISOString(),
          refresh_expires_at: newRefreshExpiresAt.toISOString(),
          encrypted_refresh_token: encryptedRefreshToken,
          ip_address: currentSession.ipAddress,
          user_agent: currentSession.userAgent,
          is_active: true
        })

      logger.info('Session refreshed with token rotation', currentSession.userId, newSessionId, {
        oldSessionId: currentSession.sessionId
      })

      return refreshedSession

    } catch (error) {
      logger.error('Failed to refresh session', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      // Remove from encrypted secure storage
      secureStorage.removeItem('carexps_session')

      // Mark as inactive in database
      await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          invalidated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)

      logger.info('Session invalidated securely', undefined, sessionId)

    } catch (error) {
      logger.error('Failed to invalidate session', undefined, sessionId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Add automatic session timeout mechanism
   */
  private sessionTimeoutId: NodeJS.Timeout | null = null

  async startSessionMonitoring(): Promise<void> {
    try {
      // Clear any existing timeout
      if (this.sessionTimeoutId) {
        clearTimeout(this.sessionTimeoutId)
      }

      const session = await this.getSessionInfo()
      const timeUntilExpiry = new Date(session.expiresAt).getTime() - Date.now()

      if (timeUntilExpiry > 0) {
        this.sessionTimeoutId = setTimeout(async () => {
          try {
            await this.invalidateSession(session.sessionId)
            logger.info('Session automatically expired', session.userId, session.sessionId)

            // Notify the application about session expiry
            window.dispatchEvent(new CustomEvent('sessionExpired', {
              detail: { sessionId: session.sessionId, userId: session.userId }
            }))
          } catch (error) {
            logger.error('Failed to auto-expire session', session.userId, session.sessionId, {
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }, timeUntilExpiry)

        logger.debug('Session monitoring started', session.userId, session.sessionId, {
          expiresIn: timeUntilExpiry
        })
      }
    } catch (error) {
      logger.warn('Failed to start session monitoring', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  stopSessionMonitoring(): void {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId)
      this.sessionTimeoutId = null
    }
  }

  private async getClientIP(): Promise<string> {
    try {
      // In production, this would get the real client IP from headers
      // For now, return a placeholder
      return '127.0.0.1'
    } catch {
      return '127.0.0.1'
    }
  }
}

export const authService = new AuthService()