/**
 * Authentication Middleware Service
 * Handles server-side authentication logic and security
 * 
 * Key Features:
 * - MSAL client instance management
 * - Azure AD authentication state
 * - Session validation and security
 * - MFA integration and validation
 * - Error handling and recovery
 * - HIPAA-compliant audit logging
 */

import { PublicClientApplication, AccountInfo, AuthenticationResult, InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalInstance, loginRequest, tokenRequest } from '../config/msalConfig'
import { authService } from './authService'
import { totpService } from './totpService'
import { secureLogger } from './secureLogger'
import { encryptionService } from './encryption'
import { supabase } from '../config/supabase'
import type { User, SessionInfo, AuthenticationState } from '../types'

const logger = secureLogger.component('AuthMiddleware')

// Single MSAL instance management
class AuthenticationMiddleware {
  private static instance: AuthenticationMiddleware
  private msalClient: PublicClientApplication
  private isInitialized = false
  private authState: AuthenticationState = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    sessionInfo: null,
    mfaRequired: false,
    error: null
  }
  private authStateListeners: Array<(state: AuthenticationState) => void> = []
  private sessionValidationTimer: NodeJS.Timeout | null = null

  private constructor() {
    this.msalClient = msalInstance
    this.initializeMiddleware()
  }

  public static getInstance(): AuthenticationMiddleware {
    if (!AuthenticationMiddleware.instance) {
      AuthenticationMiddleware.instance = new AuthenticationMiddleware()
    }
    return AuthenticationMiddleware.instance
  }

  /**
   * Initialize the authentication middleware
   */
  private async initializeMiddleware(): Promise<void> {
    try {
      logger.info('Initializing authentication middleware')
      
      // Handle redirect promise to process returning authentication flows
      await this.msalClient.handleRedirectPromise()
        .then((response: AuthenticationResult | null) => {
          if (response) {
            logger.info('Redirect authentication successful', response.account?.homeAccountId)
            this.handleAuthenticationResult(response)
          }
        })
        .catch((error) => {
          logger.error('Redirect authentication failed', undefined, undefined, {
            error: error.message,
            errorCode: error.errorCode
          })
          this.updateAuthState({ error: error.message, isLoading: false })
        })

      // Check for existing authentication
      const accounts = this.msalClient.getAllAccounts()
      if (accounts.length > 0) {
        await this.validateExistingSession(accounts[0])
      } else {
        this.updateAuthState({ isLoading: false })
      }

      this.isInitialized = true
      logger.info('Authentication middleware initialized successfully')
      
    } catch (error) {
      logger.error('Failed to initialize authentication middleware', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      this.updateAuthState({ 
        error: 'Authentication initialization failed', 
        isLoading: false 
      })
    }
  }

  /**
   * Validate existing authentication session
   */
  private async validateExistingSession(account: AccountInfo): Promise<void> {
    try {
      logger.debug('Validating existing session', account.homeAccountId)
      
      // Try to get a token silently to validate the session
      const response = await this.msalClient.acquireTokenSilent({
        ...tokenRequest,
        account
      })
      
      if (response) {
        await this.handleAuthenticationResult(response)
      }
      
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        logger.info('Session expired, interaction required', account.homeAccountId)
        this.updateAuthState({ isLoading: false })
      } else {
        logger.error('Session validation failed', account.homeAccountId, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        this.updateAuthState({ 
          error: 'Session validation failed', 
          isLoading: false 
        })
      }
    }
  }

  /**
   * Handle successful authentication result
   */
  private async handleAuthenticationResult(result: AuthenticationResult): Promise<void> {
    try {
      const account = result.account
      if (!account) {
        throw new Error('No account information in authentication result')
      }

      logger.info('Processing authentication result', account.homeAccountId)
      
      // Get user profile with MFA status
      const userProfile = await authService.getUserProfile(account.homeAccountId)
      
      // Check if MFA is required
      const mfaEnabled = await totpService.isTOTPEnabled(userProfile.id)
      
      if (mfaEnabled) {
        // Check for valid MFA session
        const mfaSessionValid = await this.validateMFASession(userProfile.id)
        
        if (!mfaSessionValid) {
          logger.info('MFA verification required', userProfile.id)
          this.updateAuthState({
            user: userProfile,
            mfaRequired: true,
            isLoading: false
          })
          return
        }
      }
      
      // Create or validate session
      let sessionInfo: SessionInfo
      try {
        sessionInfo = await authService.getSessionInfo()
        // Validate session is not expired
        if (new Date() >= new Date(sessionInfo.expiresAt)) {
          throw new Error('Session expired')
        }
      } catch {
        sessionInfo = await authService.createSession(userProfile.id)
      }
      
      // Mark user as MFA verified if MFA session is valid or MFA not required
      userProfile.mfaVerified = !mfaEnabled || !this.authState.mfaRequired
      
      this.updateAuthState({
        isAuthenticated: true,
        user: userProfile,
        sessionInfo,
        mfaRequired: false,
        isLoading: false,
        error: null
      })
      
      // Start session monitoring
      this.startSessionValidation(sessionInfo)
      
      logger.info('Authentication completed successfully', userProfile.id, sessionInfo.sessionId)
      
    } catch (error) {
      logger.error('Failed to process authentication result', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      this.updateAuthState({ 
        error: 'Authentication processing failed', 
        isLoading: false 
      })
    }
  }

  /**
   * Validate MFA session
   */
  private async validateMFASession(userId: string): Promise<boolean> {
    try {
      // Check for existing MFA session in secure storage
      const { secureStorage } = await import('./secureStorage')
      const mfaSession = await secureStorage.getSessionData(`mfa_session_${userId}`)
      
      if (mfaSession && new Date() < new Date(mfaSession.expiresAt)) {
        logger.debug('Valid MFA session found', userId)
        return true
      }
      
      logger.debug('No valid MFA session found', userId)
      return false
      
    } catch (error) {
      logger.warn('MFA session validation failed', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Initiate login flow
   */
  public async login(): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Authentication middleware not initialized')
      }
      
      logger.info('Initiating login flow')
      this.updateAuthState({ isLoading: true, error: null })
      
      const response = await this.msalClient.loginPopup({
        ...loginRequest,
        prompt: 'select_account'
      })
      
      await this.handleAuthenticationResult(response)
      
    } catch (error) {
      logger.error('Login failed', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any)?.errorCode
      })
      
      let errorMessage = 'Login failed'
      if (error instanceof Error) {
        if (error.message.includes('popup_window_error')) {
          errorMessage = 'Popup blocked. Please allow popups and try again.'
        } else if (error.message.includes('user_cancelled')) {
          errorMessage = 'Login cancelled by user'
        } else {
          errorMessage = error.message
        }
      }
      
      this.updateAuthState({ 
        error: errorMessage, 
        isLoading: false 
      })
      throw error
    }
  }

  /**
   * Complete MFA verification
   */
  public async completeMFA(code: string): Promise<boolean> {
    try {
      if (!this.authState.user) {
        throw new Error('No user context for MFA verification')
      }
      
      logger.info('Completing MFA verification', this.authState.user.id)
      
      const result = await totpService.verifyTOTP(this.authState.user.id, code, false)
      
      if (!result.success) {
        logger.warn('MFA verification failed', this.authState.user.id, undefined, {
          error: result.error
        })
        return false
      }
      
      // Create MFA session
      const { secureStorage } = await import('./secureStorage')
      const mfaSession = {
        userId: this.authState.user.id,
        verified: true,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
      }
      
      await secureStorage.setSessionData(`mfa_session_${this.authState.user.id}`, mfaSession)
      
      // Create application session
      const sessionInfo = await authService.createSession(this.authState.user.id)
      
      // Update user as MFA verified
      const updatedUser = { ...this.authState.user, mfaVerified: true }
      
      this.updateAuthState({
        isAuthenticated: true,
        user: updatedUser,
        sessionInfo,
        mfaRequired: false,
        error: null
      })
      
      // Start session monitoring
      this.startSessionValidation(sessionInfo)
      
      logger.info('MFA verification completed successfully', this.authState.user.id)
      return true
      
    } catch (error) {
      logger.error('MFA completion failed', this.authState.user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Logout user
   */
  public async logout(): Promise<void> {
    try {
      logger.info('Initiating logout', this.authState.user?.id)
      
      // Stop session validation
      if (this.sessionValidationTimer) {
        clearInterval(this.sessionValidationTimer)
        this.sessionValidationTimer = null
      }
      
      // Invalidate session if exists
      if (this.authState.sessionInfo) {
        try {
          await authService.invalidateSession(this.authState.sessionInfo.sessionId)
        } catch (error) {
          logger.warn('Failed to invalidate session', undefined, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // Clear MFA sessions
      if (this.authState.user) {
        try {
          const { secureStorage } = await import('./secureStorage')
          await secureStorage.removeItem(`mfa_session_${this.authState.user.id}`)
        } catch (error) {
          logger.warn('Failed to clear MFA session', undefined, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // MSAL logout
      try {
        await this.msalClient.logoutPopup({
          postLogoutRedirectUri: window.location.origin,
          mainWindowRedirectUri: window.location.origin
        })
      } catch (error) {
        logger.warn('MSAL logout failed', undefined, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      
      // Reset auth state
      this.updateAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        sessionInfo: null,
        mfaRequired: false,
        error: null
      })
      
      logger.info('Logout completed successfully')
      
    } catch (error) {
      logger.error('Logout failed', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Force reset auth state even if logout fails
      this.updateAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        sessionInfo: null,
        mfaRequired: false,
        error: null
      })
    }
  }

  /**
   * Start session validation timer
   */
  private startSessionValidation(sessionInfo: SessionInfo): void {
    // Clear any existing timer
    if (this.sessionValidationTimer) {
      clearInterval(this.sessionValidationTimer)
    }
    
    // Validate session every 5 minutes
    this.sessionValidationTimer = setInterval(async () => {
      try {
        const currentSession = await authService.getSessionInfo()
        
        // Check if session is expired or invalid
        if (new Date() >= new Date(currentSession.expiresAt)) {
          logger.warn('Session expired during validation', sessionInfo.userId, sessionInfo.sessionId)
          await this.logout()
        }
        
      } catch (error) {
        logger.warn('Session validation failed', sessionInfo.userId, sessionInfo.sessionId, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        await this.logout()
      }
    }, 5 * 60 * 1000) // 5 minutes
  }

  /**
   * Update authentication state and notify listeners
   */
  private updateAuthState(updates: Partial<AuthenticationState>): void {
    this.authState = { ...this.authState, ...updates }
    
    // Notify all listeners
    this.authStateListeners.forEach(listener => {
      try {
        listener(this.authState)
      } catch (error) {
        logger.error('Auth state listener error', undefined, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })
  }

  /**
   * Subscribe to authentication state changes
   */
  public subscribeToAuthState(listener: (state: AuthenticationState) => void): () => void {
    this.authStateListeners.push(listener)
    
    // Immediately call with current state
    listener(this.authState)
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(listener)
      if (index > -1) {
        this.authStateListeners.splice(index, 1)
      }
    }
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): AuthenticationState {
    return { ...this.authState }
  }

  /**
   * Refresh user session
   */
  public async refreshSession(): Promise<void> {
    try {
      if (!this.authState.user) {
        throw new Error('No user context for session refresh')
      }
      
      const refreshedSession = await authService.refreshSession()
      const updatedUser = await authService.getUserProfile(this.authState.user.id)
      
      this.updateAuthState({
        user: updatedUser,
        sessionInfo: refreshedSession
      })
      
      // Restart session validation with new session
      this.startSessionValidation(refreshedSession)
      
      logger.info('Session refreshed successfully', updatedUser.id, refreshedSession.sessionId)
      
    } catch (error) {
      logger.error('Session refresh failed', this.authState.user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // If refresh fails, logout the user
      await this.logout()
      throw error
    }
  }

  /**
   * Check if user has specific permission
   */
  public hasPermission(resource: string, action: string): boolean {
    if (!this.authState.user || !this.authState.isAuthenticated) {
      return false
    }
    
    return this.authState.user.permissions.some(permission =>
      permission.resource === resource &&
      permission.actions.includes(action as any)
    )
  }

  /**
   * Get MSAL accounts (for debugging)
   */
  public getMSALAccounts(): AccountInfo[] {
    return this.msalClient.getAllAccounts()
  }
}

// Export singleton instance
export const authMiddleware = AuthenticationMiddleware.getInstance()
export type { AuthenticationState }