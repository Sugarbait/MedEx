import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import type { User, MFAChallenge, SessionInfo } from '@/types'
import { authService } from '@/services/authService'
import { useSupabase } from './SupabaseContext'
import { userSettingsService } from '@/services/userSettingsService'
import { secureStorage } from '@/services/secureStorage'
import { secureLogger } from '@/services/secureLogger'
import { FreshMfaService } from '@/services/freshMfaService'
import { retellService } from '@/services'

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
  // Check if we're in demo mode (localhost with fake Azure credentials)
  const isDemoMode = window.location.hostname === 'localhost' &&
    (import.meta.env.VITE_AZURE_CLIENT_ID === '12345678-1234-1234-1234-123456789012' ||
     !import.meta.env.VITE_AZURE_CLIENT_ID)

  // Only use MSAL hooks if not in demo mode
  const msalData = isDemoMode ? { instance: null, accounts: [] } : useMsal()
  const { instance, accounts } = msalData
  const isAuthenticated = isDemoMode ? true : useIsAuthenticated()
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
        if (isDemoMode) {
          // Demo mode - create a mock user for development
          console.log('🔧 DEMO MODE: Creating demo user for development')
          const demoUser: User = {
            id: 'demo-user-123',
            email: 'demo@localhost.dev',
            name: 'Demo User',
            role: 'admin',
            is_super_user: true,
            is_enabled: true,
            profile_status: 'enabled'
          }
          setUser(demoUser)
          setMfaRequired(false) // Skip MFA in demo mode

          // CRITICAL: Load API keys in demo mode too
          console.log('🚀 DEMO MODE: Loading API keys for demo user...')
          try {
            // Set up demo localStorage structure
            localStorage.setItem('currentUser', JSON.stringify({ id: demoUser.id }))
            const demoSettings = {
              theme: 'light',
              mfaEnabled: false,
              refreshInterval: 30000,
              sessionTimeout: 15,
              notifications: { calls: true, sms: true, system: true },
              retellApiKey: 'key_c3f084f5ca67781070e188b47d7f',
              callAgentId: 'agent_447a1b9da540237693b0440df6',
              smsAgentId: 'agent_643486efd4b5a0e9d7e094ab99'
            }
            localStorage.setItem(`settings_${demoUser.id}`, JSON.stringify(demoSettings))

            // API keys are already loaded in main.tsx
            retellService.loadCredentials()
            console.log('✅ DEMO MODE: API keys loaded from main.tsx initialization')
          } catch (error) {
            console.error('❌ DEMO MODE: Error loading API keys:', error)
            retellService.forceUpdateCredentials()
          }

          setIsLoading(false)
          return
        }

        if (isAuthenticated && accounts.length > 0) {
          const account = accounts[0]
          logger.debug('Initializing authentication', account.homeAccountId)

          const userProfile = await authService.getUserProfile(account.homeAccountId)

          // Check if MFA is required
          let mfaEnabled = false
          let hasValidMFASession = false

          try {
            mfaEnabled = await FreshMfaService.isMfaEnabled(userProfile.id)

            // Check for existing valid MFA session (24 hour window)
            const mfaTimestamp = localStorage.getItem('freshMfaVerified')
            if (mfaTimestamp) {
              const sessionAge = Date.now() - parseInt(mfaTimestamp)
              const MAX_MFA_SESSION_AGE = 24 * 60 * 60 * 1000 // 24 hours
              hasValidMFASession = sessionAge < MAX_MFA_SESSION_AGE
            }

            console.log('🔐 MFA Status Check:', {
              userId: userProfile.id,
              mfaEnabled,
              hasValidMFASession,
              requiresVerification: mfaEnabled && !hasValidMFASession
            })

          } catch (mfaCheckError) {
            console.error('❌ Error checking MFA status:', mfaCheckError)
            mfaEnabled = userProfile.mfaEnabled || false
            hasValidMFASession = false
          }

          // CRITICAL: MFA is required if user has MFA enabled AND no valid session exists
          if (mfaEnabled && !hasValidMFASession) {
            logger.info('MANDATORY MFA required for user', userProfile.id)
            setMfaRequired(true)

            try {
              const challenge = await authService.initiateMFA(userProfile.id)
              setMfaChallenge(challenge)
              console.log('🔐 MFA challenge initiated for mandatory verification')
            } catch (challengeError) {
              console.error('❌ Failed to initiate MFA challenge:', challengeError)
              setMfaRequired(true)
            }
          } else {
            // User either doesn't have MFA enabled OR has a valid session
            if (mfaEnabled && hasValidMFASession) {
              console.log('✅ Valid MFA session found - user authenticated')
              userProfile.mfaVerified = true
            }
            setUser(userProfile)

            // Create or retrieve secure session
            let session: SessionInfo
            try {
              session = await authService.getSessionInfo()
            } catch {
              session = await authService.createSession(userProfile.id)
            }
            setSessionInfo(session)

            // Store user data securely
            await secureStorage.setSessionData('current_user', userProfile)

            // Load user settings and API keys
            if (userProfile.id) {
              try {
                console.log('🔄 Loading settings for user:', userProfile.id)
                let settings = await userSettingsService.forceSyncFromCloud(userProfile.id)

                if (!settings) {
                  settings = await userSettingsService.getUserSettings(userProfile.id)
                }

                setUserSettings(settings)
                await secureStorage.setUserPreference('user_settings', settings, false)

                // Store in localStorage for SettingsPage
                localStorage.setItem(`settings_${userProfile.id}`, JSON.stringify({
                  theme: settings?.theme || 'light',
                  mfaEnabled: userProfile.mfaEnabled || false,
                  refreshInterval: 30000,
                  sessionTimeout: settings?.security_preferences?.session_timeout || 15,
                  notifications: {
                    calls: settings?.notifications?.call_alerts ?? true,
                    sms: settings?.notifications?.sms_alerts ?? true,
                    system: settings?.notifications?.security_alerts ?? true
                  },
                  retellApiKey: settings?.retell_config?.api_key,
                  callAgentId: settings?.retell_config?.call_agent_id,
                  smsAgentId: settings?.retell_config?.sms_agent_id
                }))

                // API keys are now loaded in main.tsx before React starts
                retellService.loadCredentials()

                // Dispatch event to notify other components that API is ready
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
                    detail: {
                      apiKey: true,
                      callAgentId: true,
                      smsAgentId: true
                    }
                  }))
                  console.log('📡 API configuration ready event dispatched')
                }, 100)

                // Subscribe to real-time settings changes
                userSettingsService.subscribeToSettings(userProfile.id, async (newSettings) => {
                  setUserSettings(newSettings)
                  await secureStorage.setUserPreference('user_settings', newSettings, false)

                  // Update retell service when settings change
                  if (newSettings?.retell_config?.api_key) {
                    retellService.updateCredentials(
                      newSettings.retell_config.api_key,
                      newSettings.retell_config.call_agent_id,
                      newSettings.retell_config.sms_agent_id
                    )
                    retellService.loadCredentials()

                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
                        detail: {
                          apiKey: !!newSettings.retell_config.api_key,
                          callAgentId: !!newSettings.retell_config.call_agent_id,
                          smsAgentId: !!newSettings.retell_config.sms_agent_id
                        }
                      }))
                    }, 100)
                  }
                })

              } catch (error) {
                console.warn('Failed to load settings:', error)
                // Fallback settings handling
                try {
                  const fallbackSettings = await userSettingsService.getUserSettings(userProfile.id)
                  setUserSettings(fallbackSettings)

                  if (fallbackSettings?.retell_config) {
                    retellService.updateCredentials(
                      fallbackSettings.retell_config.api_key,
                      fallbackSettings.retell_config.call_agent_id,
                      fallbackSettings.retell_config.sms_agent_id
                    )
                  }
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
  }, [isAuthenticated, accounts, supabase, isDemoMode])

  useEffect(() => {
    if (!isAuthenticated) {
      const cleanupSession = async () => {
        setUser(null)
        setSessionInfo(null)
        setMfaRequired(false)
        setMfaChallenge(null)
        setUserSettings(null)

        userSettingsService.unsubscribeFromSettings()
        userSettingsService.clearCache()

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

      // Clear all authentication data
      try {
        localStorage.removeItem('freshMfaVerified')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('mfa_verified')

        if (user?.id) {
          userSettingsService.unsubscribeFromSettings(user.id)
          userSettingsService.clearCache(user.id)
          localStorage.removeItem(`settings_${user.id}`)
        }

        await secureStorage.clear()
      } catch (cleanupError) {
        console.error('Error during logout cleanup:', cleanupError)
      }

      if (!isDemoMode) {
        try {
          await instance.logoutPopup({
            postLogoutRedirectUri: window.location.origin,
            mainWindowRedirectUri: window.location.origin
          })
        } catch (msalError) {
          console.warn('MSAL logout failed, continuing with local cleanup:', msalError)
        }
      }

      setUser(null)
      setSessionInfo(null)
      setMfaRequired(false)
      setMfaChallenge(null)
      setUserSettings(null)

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

      const account = accounts[0]
      const userProfile = await authService.getUserProfile(account.homeAccountId)
      const isValid = await FreshMfaService.verifyLoginCode(userProfile.id, code)

      if (isValid) {
        userProfile.mfaVerified = true
        const mfaTimestamp = Date.now().toString()
        localStorage.setItem('freshMfaVerified', mfaTimestamp)

        setUser(userProfile)

        const session = await authService.getSessionInfo()
        setSessionInfo(session)

        setMfaRequired(false)
        setMfaChallenge(null)

        await secureStorage.setSessionData('current_user', userProfile)

        try {
          await authService.verifyMFA(mfaChallenge.challenge, code)
        } catch (dbError) {
          console.warn('Failed to mark MFA challenge as used in database:', dbError)
        }

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
      const updatedSettings = await userSettingsService.updateUserSettings(user.id, settings)
      setUserSettings(updatedSettings)
      await secureStorage.setUserPreference('user_settings', updatedSettings, false)
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  }

  // Session timeout handling (simplified for clean version)
  useEffect(() => {
    if (!sessionInfo || !user) return

    const timeoutDuration = 15 * 60 * 1000 // 15 minutes
    const warningDuration = 2 * 60 * 1000  // 2 minutes before timeout

    let timeoutId: NodeJS.Timeout
    let warningTimeoutId: NodeJS.Timeout

    const handleSessionExpiry = async () => {
      logger.warn('Session expired due to inactivity', user.id, sessionInfo.sessionId)
      await logout()
    }

    const handleSessionWarning = () => {
      const shouldContinue = window.confirm(
        'Your session will expire in 2 minutes due to inactivity. Click OK to continue, or Cancel to logout now.'
      )

      if (shouldContinue) {
        refreshSession().catch(() => logout())
      } else {
        logout()
      }
    }

    const resetTimeout = () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)

      warningTimeoutId = setTimeout(handleSessionWarning, timeoutDuration - warningDuration)
      timeoutId = setTimeout(handleSessionExpiry, timeoutDuration)
    }

    const handleActivity = () => {
      resetTimeout()
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true, capture: true })
    })

    resetTimeout()

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
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