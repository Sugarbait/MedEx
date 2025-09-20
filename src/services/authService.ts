import { User, MFAChallenge, SessionInfo } from '@/types'
import { supabase } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import { mfaService } from '@/services/mfaService'
import { secureStorage } from '@/services/secureStorage'
import { encryptionService } from '@/services/encryption'

const logger = secureLogger.component('AuthService')

class AuthService {
  async getUserProfile(accountId: string): Promise<User & { mfaVerified: boolean }> {
    try {
      logger.debug('Fetching user profile', accountId)

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

      // If user doesn't exist in database, create with default values
      if (!user) {
        logger.info('User not found in database, creating default profile', accountId)

        const defaultUser: Partial<User> = {
          azure_ad_id: accountId,
          email: `user-${accountId.substring(0, 8)}@healthcare.local`,
          name: 'Healthcare User',
          role: 'healthcare_provider',
          permissions: [
            { resource: 'dashboard', actions: ['read'] },
            { resource: 'calls', actions: ['read', 'write'] },
            { resource: 'sms', actions: ['read', 'write'] },
            { resource: 'analytics', actions: ['read'] },
            { resource: 'settings', actions: ['read', 'write'] }
          ],
          lastLogin: new Date().toISOString(),
          mfaEnabled: true, // Enable MFA by default for security
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

        // Check MFA verification status
        const mfaVerified = await mfaService.hasMFAEnabled(accountId)

        return {
          ...newUser as User,
          mfaVerified
        }
      }

      // Update last login
      await supabase
        .from('users')
        .update({ lastLogin: new Date().toISOString() })
        .eq('azure_ad_id', accountId)

      // Check MFA verification status
      const mfaVerified = await mfaService.hasMFAEnabled(accountId)

      logger.debug('User profile retrieved successfully', accountId)

      return {
        ...user as User,
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

      // Check if user has MFA setup
      const hasMFA = await mfaService.hasMFASetup(userId)

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

      // Verify TOTP code using MFA service
      const verificationResult = await mfaService.verifyTOTP(challengeData.user_id, code)

      if (verificationResult.success) {
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