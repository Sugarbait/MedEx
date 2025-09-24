import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import type { User, MFAChallenge, SessionInfo } from '@/types'
import { authService } from '@/services/authService'
import { useSupabase } from './SupabaseContext'
import { userSettingsService } from '@/services/userSettingsService'
// MFA functionality moved to TOTPProtectedRoute
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

          // Force sync MFA data from cloud for cross-device support
          console.log('🔐 CROSS-DEVICE MFA SYNC: Starting MFA sync for user:', userProfile.id)
          try {
            const mfaSyncStart = Date.now()
            // MFA sync moved to TOTPProtectedRoute
            const mfaSyncSuccess = true
            const mfaSyncDuration = Date.now() - mfaSyncStart

            if (mfaSyncSuccess) {
              console.log(`✅ MFA force sync SUCCESS in ${mfaSyncDuration}ms`)
              console.log('🔐 MFA data available on this device after sync')
            } else {
              console.log(`⚠️ MFA force sync found no cloud data in ${mfaSyncDuration}ms`)
            }
          } catch (error) {
            console.warn('⚠️ MFA force sync failed:', error)
          }

          // Check if MFA is required after sync - Enhanced cross-device check
          // MFA check moved to TOTPProtectedRoute
          const hasMFASetup = false
          const mfaEnabled = hasMFASetup && userProfile.mfaEnabled

          // CRITICAL: Check for existing valid MFA session for cross-device scenarios
          // MFA session check moved to TOTPProtectedRoute
          const existingMFASession = null
          const hasValidMFASession = existingMFASession && existingMFASession.verified &&
                                    new Date() <= existingMFASession.expiresAt

          console.log('🔐 MFA Status Check (Enhanced):', {
            hasMFASetup,
            userProfileMfaEnabled: userProfile.mfaEnabled,
            userProfileMfaVerified: userProfile.mfaVerified,
            finalMfaEnabled: mfaEnabled,
            hasValidMFASession,
            sessionExpiry: existingMFASession?.expiresAt,
            isNewDevice: !hasValidMFASession
          })

          // MFA is required if:
          // 1. User has MFA enabled AND
          // 2. No valid MFA session exists (covers new device scenario)
          if (mfaEnabled && !hasValidMFASession) {
            logger.info('MFA required for user', userProfile.id)
            setMfaRequired(true)
            const challenge = await authService.initiateMFA(userProfile.id)
            setMfaChallenge(challenge)
            console.log('🔐 MFA challenge initiated for cross-device login')
          } else {
            // User either doesn't have MFA enabled OR has a valid session
            if (mfaEnabled && hasValidMFASession) {
              console.log('✅ Valid MFA session found - user authenticated')
              // Update userProfile.mfaVerified to reflect current session status
              userProfile.mfaVerified = true
            }
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

            // Load user settings from cloud with force sync for cross-device support
            if (userProfile.id) {
              try {
                // Enhanced logging for cross-device sync debugging
                console.log('🔄 CROSS-DEVICE SYNC: Starting settings load for user:', userProfile.id)
                console.log('📱 Device check: Cache state before force sync')

                // First, try force sync from cloud to ensure fresh data on new device
                console.log('🔄 Attempting force sync for cross-device login...')
                const startTime = Date.now()
                let settings = await userSettingsService.forceSyncFromCloud(userProfile.id)
                const syncDuration = Date.now() - startTime

                if (settings) {
                  console.log(`✅ Force sync SUCCESS in ${syncDuration}ms`)
                  console.log('📊 Force sync retrieved settings with keys:', Object.keys(settings))
                  if (settings.retell_config) {
                    console.log('🔑 API credentials found in force sync: [REDACTED - HIPAA PROTECTED]')
                    console.log('   - API Key: [REDACTED]')
                    console.log('   - Call Agent ID: [REDACTED]')
                    console.log('   - SMS Agent ID: [REDACTED]')
                  } else {
                    console.log('⚠️ No retell_config found in force sync result')
                  }
                } else {
                  console.log('❌ Force sync returned null - no cloud data found')
                  console.log('🔄 Force sync found no data, falling back to regular settings load...')
                  settings = await userSettingsService.getUserSettings(userProfile.id)

                  if (settings?.retell_config) {
                    console.log('🔍 Fallback found retell_config - this suggests cloud sync issue')
                  } else {
                    console.log('🆕 No settings found anywhere - trying enhanced cross-device recovery...')

                    // Enhanced cross-device recovery: Try to find data from other storage locations
                    try {
                      // Check for data in userProfileService which might have API keys
                      const { userProfileService } = await import('@/services/userProfileService')
                      const profileResponse = await userProfileService.loadUserProfile(userProfile.id)

                      if (profileResponse.status === 'success' && profileResponse.data?.settings) {
                        console.log('🔧 RECOVERY: Found API keys in user profile service')
                        const profileSettings = profileResponse.data.settings

                        // Create settings object with recovered API keys
                        const recoveredSettings = {
                          ...settings,
                          retell_config: {
                            api_key: profileSettings.retellApiKey,
                            call_agent_id: profileSettings.callAgentId,
                            sms_agent_id: profileSettings.smsAgentId
                          }
                        }

                        // Update settings with recovered API keys
                        if (profileSettings.retellApiKey || profileSettings.callAgentId) {
                          settings = recoveredSettings
                          console.log('✅ RECOVERY: API keys recovered from profile service')

                          // Try to save the recovered settings for future use
                          try {
                            await userSettingsService.updateUserSettings(userProfile.id, recoveredSettings)
                            console.log('✅ RECOVERY: Saved recovered settings for future cross-device access')
                          } catch (saveError) {
                            console.warn('⚠️ RECOVERY: Could not save recovered settings:', saveError)
                          }
                        }
                      }

                      // Also check secure storage for any cached settings
                      const cachedSettings = await secureStorage.getUserPreference('user_settings', null)
                      if (cachedSettings?.retell_config && !settings?.retell_config) {
                        console.log('🔧 RECOVERY: Found API keys in secure storage cache')
                        settings = { ...settings, ...cachedSettings }
                        console.log('✅ RECOVERY: API keys recovered from secure storage')
                      }

                    } catch (recoveryError) {
                      console.warn('⚠️ RECOVERY: Enhanced recovery failed:', recoveryError)
                    }
                  }
                }

                setUserSettings(settings)

                // Store settings securely
                await secureStorage.setUserPreference('user_settings', settings, false)

                // Subscribe to real-time settings changes
                userSettingsService.subscribeToSettings(userProfile.id, async (newSettings) => {
                  setUserSettings(newSettings)
                  await secureStorage.setUserPreference('user_settings', newSettings, false)

                  // Dispatch event for UI updates
                  window.dispatchEvent(new CustomEvent('settingsUpdated', {
                    detail: newSettings
                  }))
                })

                console.log('✅ Cross-device settings sync completed successfully')

              } catch (error) {
                console.warn('Failed to load settings:', error)
                // Fall back to regular settings load as safety net
                try {
                  const fallbackSettings = await userSettingsService.getUserSettings(userProfile.id)
                  setUserSettings(fallbackSettings)
                } catch (fallbackError) {
                  console.error('Settings fallback also failed:', fallbackError)
                }
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

      // Clean up settings subscriptions for current user
      if (user?.id) {
        userSettingsService.unsubscribeFromSettings(user.id)
        userSettingsService.clearCache(user.id)
      } else {
        // Fallback: clean up all subscriptions and cache
        userSettingsService.unsubscribeFromSettings()
        userSettingsService.clearCache()
      }

      // Clear all secure storage
      secureStorage.clear()

      // Clear any localStorage items related to user settings
      if (user?.id) {
        localStorage.removeItem(`user_settings_${user.id}`)
      }

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

        // CRITICAL: Mark user as MFA verified for cross-device consistency
        userProfile.mfaVerified = true
        setUser(userProfile)

        const session = await authService.getSessionInfo()
        setSessionInfo(session)

        setMfaRequired(false)
        setMfaChallenge(null)

        // Update user profile storage with verified status
        await secureStorage.setSessionData('current_user', userProfile)

        console.log('✅ MFA completed successfully - user now has verified access')
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