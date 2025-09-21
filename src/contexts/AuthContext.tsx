import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import type { User, MFAChallenge, SessionInfo } from '@/types'
import { authService } from '@/services/authService'
import { useSupabase } from './SupabaseContext'
import { userSettingsService } from '@/services/userSettingsService'
import { mfaService } from '@/services/mfaService'
import { secureStorage } from '@/services/secureStorage'
import { secureLogger } from '@/services/secureLogger'

const logger = secureLogger.component('AuthContext')

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  mfaRequired: boolean
  mfaChallenge: MFAChallenge | null
  sessionInfo: SessionInfo | null
  login: () => Promise<void>
  logout: () => Promise<void>
  completeMFA: (code: string) => Promise<boolean>
  refreshSession: () => Promise<void>
  hasPermission: (resource: string, action: string) => boolean
  userSettings: any
  updateSettings: (settings: Partial<any>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const { supabase } = useSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [userSettings, setUserSettings] = useState<any>(null)

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true)
      try {
        if (isAuthenticated && accounts.length > 0) {
          const account = accounts[0]
          logger.debug('Initializing authentication', account.homeAccountId)

          const userProfile = await authService.getUserProfile(account.homeAccountId)

          if (userProfile.mfaEnabled && !userProfile.mfaVerified) {
            logger.info('MFA required for user', userProfile.id)
            setMfaRequired(true)
            const challenge = await authService.initiateMFA(userProfile.id)
            setMfaChallenge(challenge)
          } else {
            setUser(userProfile)

            // Create or retrieve secure session
            let session: SessionInfo
            try {
              session = await authService.getSessionInfo()
            } catch {
              // Create new session if none exists
              session = await authService.createSession(userProfile.id)
            }
            setSessionInfo(session)

            // Store user data securely
            await secureStorage.setSessionData('current_user', userProfile)

            // Load user settings from Supabase (cross-device sync)
            if (userProfile.id) {
              try {
                console.log('🔄 Loading user settings and MFA state for cross-device sync...')

                // Force sync settings from Supabase on login
                const settings = await userSettingsService.forceSyncFromSupabase(userProfile.id) ||
                                await userSettingsService.getUserSettings(userProfile.id)
                setUserSettings(settings)

                // Force sync MFA data from Supabase on login
                await mfaService.forceCloudSync(userProfile.id)

                // Store settings securely
                await secureStorage.setUserPreference('user_settings', settings, false)

                // Subscribe to real-time settings changes for cross-device sync
                userSettingsService.subscribeToSettings(userProfile.id, async (newSettings) => {
                  console.log('📱 Real-time settings update received from another device')
                  setUserSettings(newSettings)
                  await secureStorage.setUserPreference('user_settings', newSettings, false)

                  // Dispatch event for UI updates
                  window.dispatchEvent(new CustomEvent('settingsUpdated', {
                    detail: newSettings
                  }))
                })

                console.log('✅ Cross-device sync setup completed')
              } catch (syncError) {
                console.warn('⚠️ Cross-device sync setup failed, using local fallback:', syncError)

                // Fallback to local-only mode
                const fallbackSettings = await userSettingsService.getUserSettings(userProfile.id)
                setUserSettings(fallbackSettings)
              }
            }

            logger.info('Authentication successful', userProfile.id, session.sessionId)
          }
        } else {
          // Clear any existing session data
          await secureStorage.removeItem('current_user')
          await secureStorage.removeItem('user_settings')
        }
      } catch (error) {
        logger.error('Auth initialization error', undefined, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [isAuthenticated, accounts, supabase])

  useEffect(() => {
    if (!isAuthenticated) {
      const cleanupSession = async () => {
        setUser(null)
        setSessionInfo(null)
        setMfaRequired(false)
        setMfaChallenge(null)
        setUserSettings(null)

        // Clean up cross-device subscriptions and cache
        userSettingsService.unsubscribeFromSettings()
        userSettingsService.clearCache()

        // Clear secure storage
        await secureStorage.removeItem('current_user')
        await secureStorage.removeItem('user_settings')

        logger.debug('Session cleanup completed')
      }

      cleanupSession()
    }
  }, [isAuthenticated])

  const login = async () => {
    try {
      logger.info('Initiating login')

      await instance.loginPopup({
        scopes: ['User.Read', 'openid', 'profile'],
        prompt: 'select_account'
      })

      logger.info('Login successful')
    } catch (error) {
      logger.error('Login error', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  const logout = async () => {
    try {
      logger.info('Initiating logout', user?.id, sessionInfo?.sessionId)

      if (sessionInfo) {
        await authService.invalidateSession(sessionInfo.sessionId)
      }

      // Clean up cross-device subscriptions
      userSettingsService.unsubscribeFromSettings()
      userSettingsService.clearCache()

      // Clear all secure storage
      secureStorage.clear()

      await instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
        mainWindowRedirectUri: window.location.origin
      })

      setUser(null)
      setSessionInfo(null)
      setMfaRequired(false)
      setMfaChallenge(null)
      setUserSettings(null)

      console.log('🔇 Cross-device sync cleaned up')

      logger.info('Logout completed')
    } catch (error) {
      logger.error('Logout error', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const completeMFA = async (code: string): Promise<boolean> => {
    try {
      if (!mfaChallenge || !accounts.length) {
        return false
      }

      const isValid = await authService.verifyMFA(mfaChallenge.challenge, code)

      if (isValid) {
        const account = accounts[0]
        const userProfile = await authService.getUserProfile(account.homeAccountId)
        setUser(userProfile)

        const session = await authService.getSessionInfo()
        setSessionInfo(session)

        setMfaRequired(false)
        setMfaChallenge(null)

        return true
      }

      return false
    } catch (error) {
      console.error('MFA verification error:', error)
      return false
    }
  }

  const refreshSession = async () => {
    try {
      if (!user) return

      const session = await authService.refreshSession()
      setSessionInfo(session)

      const updatedUser = await authService.getUserProfile(user.id)
      setUser(updatedUser)
    } catch (error) {
      console.error('Session refresh error:', error)
      await logout()
    }
  }

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false

    return user.permissions.some(permission =>
      permission.resource === resource &&
      permission.actions.includes(action as any)
    )
  }

  const updateSettings = async (settings: Partial<any>): Promise<void> => {
    if (!user?.id) return

    try {
      console.log('🔄 Updating settings with cross-device sync...', Object.keys(settings))
      const updatedSettings = await userSettingsService.updateUserSettings(user.id, settings)
      setUserSettings(updatedSettings)

      // Update secure storage
      await secureStorage.setUserPreference('user_settings', updatedSettings, false)

      console.log('✅ Settings updated and synced across devices')
    } catch (error) {
      console.error('❌ Failed to update settings:', error)
      throw error
    }
  }

  // Secure session timeout handling
  useEffect(() => {
    if (!sessionInfo || !user) return

    const timeoutDuration = 15 * 60 * 1000 // 15 minutes
    const warningDuration = 2 * 60 * 1000  // 2 minutes before timeout

    let timeoutId: NodeJS.Timeout
    let warningTimeoutId: NodeJS.Timeout
    let activityTimer: NodeJS.Timeout

    const handleSessionExpiry = async () => {
      logger.warn('Session expired due to inactivity', user.id, sessionInfo.sessionId)
      await logout()
    }

    const handleSessionWarning = () => {
      logger.info('Session expiring soon, showing warning', user.id, sessionInfo.sessionId)

      const shouldContinue = window.confirm(
        'Your session will expire in 2 minutes due to inactivity. Click OK to continue.'
      )

      if (shouldContinue) {
        refreshSession().catch(() => {
          logger.error('Failed to refresh session on user request')
          logout()
        })
      } else {
        logout()
      }
    }

    const resetTimeout = () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      clearTimeout(activityTimer)

      // Set warning timer
      warningTimeoutId = setTimeout(handleSessionWarning, timeoutDuration - warningDuration)

      // Set expiry timer
      timeoutId = setTimeout(handleSessionExpiry, timeoutDuration)

      // Throttle activity tracking to avoid excessive timer resets
      activityTimer = setTimeout(() => {
        // Activity timer ready for next reset
      }, 1000) // 1 second throttle
    }

    const handleActivity = () => {
      if (!activityTimer) {
        resetTimeout()
      }
    }

    // Monitor user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true, capture: true })
    })

    // Also monitor visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Initial timeout setup
    resetTimeout()

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      clearTimeout(activityTimer)

      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      logger.debug('Session timeout monitoring cleaned up')
    }
  }, [sessionInfo, user])

  const value: AuthContextType = {
    user,
    isAuthenticated: isAuthenticated && !mfaRequired,
    isLoading,
    mfaRequired,
    mfaChallenge,
    sessionInfo,
    login,
    logout,
    completeMFA,
    refreshSession,
    hasPermission,
    userSettings,
    updateSettings
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}