import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import type { User, MFAChallenge, SessionInfo } from '@/types'
import { authService } from '@/services/authService'
import { useSupabase } from './SupabaseContext'
import { userSettingsService } from '@/services/userSettingsService'
import { secureStorage } from '@/services/secureStorage'
import { secureLogger } from '@/services/secureLogger'
import FreshMfaService from '@/services/freshMfaService'
import { retellService } from '@/services'
import { AvatarStorageService } from '@/services/avatarStorageService'
import { MfaLockoutService } from '@/services/mfaLockoutService'
import { getBulletproofCredentials, storeCredentialsEverywhere, validateCredentials } from '@/config/retellCredentials'

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
  // Demo mode disabled - always use real authentication
  const isDemoMode = false

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
  const [mfaInitiated, setMfaInitiated] = useState(false)
  const [authInitialized, setAuthInitialized] = useState(false)

  useEffect(() => {
    const initializeAuth = async () => {
      // Prevent re-initialization if already initialized or have a user
      if (authInitialized || (isDemoMode && user)) {
        if (isDemoMode && user) {
          console.log('🔧 DEMO MODE: User already initialized, skipping re-initialization')
        }
        return
      }

      setIsLoading(true)
      setAuthInitialized(true) // Mark as initialized to prevent re-runs
      try {
        if (isDemoMode) {
          // Demo mode - try to preserve existing user profile if available
          console.log('🔧 DEMO MODE: Checking for existing user profile')

          let demoUser: User
          try {
            const existingUser = localStorage.getItem('currentUser')
            if (existingUser) {
              const parsedUser = JSON.parse(existingUser)
              console.log('🔧 DEMO MODE: Using existing user profile:', parsedUser.email || parsedUser.name)
              demoUser = {
                id: parsedUser.id || 'demo-user-123',
                email: parsedUser.email || 'demo@localhost.dev',
                name: parsedUser.name || 'Demo User',
                role: parsedUser.role || 'admin',
                is_super_user: parsedUser.is_super_user ?? true,
                is_enabled: parsedUser.is_enabled ?? true,
                profile_status: parsedUser.profile_status || 'enabled'
              }
            } else {
              console.log('🔧 DEMO MODE: Creating new demo user for development')
              demoUser = {
                id: 'demo-user-123',
                email: 'demo@localhost.dev',
                name: 'Demo User',
                role: 'admin',
                is_super_user: true,
                is_enabled: true,
                profile_status: 'enabled'
              }
            }
          } catch (error) {
            console.log('🔧 DEMO MODE: Error reading existing user, using default demo user')
            demoUser = {
              id: 'demo-user-123',
              email: 'demo@localhost.dev',
              name: 'Demo User',
              role: 'admin',
              is_super_user: true,
              is_enabled: true,
              profile_status: 'enabled'
            }
          }

          setUser(demoUser)
          // In demo mode, still respect user's MFA settings for testing
          // setMfaRequired(false) // Skip MFA in demo mode
          console.log('🔧 DEMO MODE: MFA will be checked based on user settings (not automatically skipped)')

          // Sync avatar in demo mode too
          try {
            console.log('🖼️ [DEMO] Syncing avatar for demo user:', demoUser.id)
            const avatarSyncResult = await AvatarStorageService.syncAvatarAcrossDevices(demoUser.id)
            if (avatarSyncResult.status === 'success' && avatarSyncResult.data) {
              demoUser.avatar = avatarSyncResult.data
              setUser({ ...demoUser }) // Update with synced avatar
              console.log('✅ [DEMO] Avatar synced successfully')
            }
          } catch (avatarError) {
            console.log('⚠️ [DEMO] Avatar sync failed, but continuing:', avatarError)
          }

          // CRITICAL: Load API keys in demo mode too
          console.log('🚀 DEMO MODE: Loading API keys for demo user...')
          try {
            // Set up demo localStorage structure
            localStorage.setItem('currentUser', JSON.stringify({ id: demoUser.id }))
            // Get bulletproof credentials for demo mode
            const bulletproofCreds = getBulletproofCredentials()
            const demoSettings = {
              theme: 'light',
              mfaEnabled: false,
              refreshInterval: 30000,
              sessionTimeout: 15,
              notifications: { calls: true, sms: true, system: true },
              retellApiKey: bulletproofCreds.apiKey,
              callAgentId: bulletproofCreds.callAgentId,
              smsAgentId: bulletproofCreds.smsAgentId
            }
            localStorage.setItem(`settings_${demoUser.id}`, JSON.stringify(demoSettings))

            // Store bulletproof credentials everywhere for maximum persistence
            storeCredentialsEverywhere(bulletproofCreds)

            // API keys are already loaded in main.tsx
            retellService.loadCredentials()
            console.log('✅ DEMO MODE: Bulletproof credentials stored and loaded successfully')
          } catch (error) {
            console.error('❌ DEMO MODE: Error loading API keys:', error)
            // Force update with bulletproof credentials
            retellService.forceUpdateCredentials()

            // Ensure credentials are stored everywhere as fallback
            try {
              const bulletproofCreds = getBulletproofCredentials()
              storeCredentialsEverywhere(bulletproofCreds)
            } catch (fallbackError) {
              console.error('❌ DEMO MODE: Fallback credential storage failed:', fallbackError)
            }
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

            // Check for existing valid MFA session (5 minute window after successful MFA)
            const mfaTimestamp = localStorage.getItem('freshMfaVerified')
            if (mfaTimestamp) {
              const sessionAge = Date.now() - parseInt(mfaTimestamp)
              const MAX_MFA_SESSION_AGE = 5 * 60 * 1000 // 5 minutes - short window for immediate re-auth scenarios
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

            // Prevent duplicate MFA initiation
            if (!mfaInitiated) {
              setMfaInitiated(true)
              try {
                const challenge = await authService.initiateMFA(userProfile.id)
                setMfaChallenge(challenge)
                console.log('🔐 MFA challenge initiated for mandatory verification')
              } catch (challengeError) {
                console.error('❌ Failed to initiate MFA challenge:', challengeError)
                setMfaRequired(true)
              }
            } else {
              console.log('🔐 MFA already initiated - skipping duplicate request')
            }
          } else {
            // User either doesn't have MFA enabled OR has a valid session
            if (mfaEnabled && hasValidMFASession) {
              console.log('✅ Valid MFA session found - user authenticated')
              userProfile.mfaVerified = true
            }
            setUser(userProfile)

            // Sync avatar across devices after successful authentication
            try {
              console.log('🖼️ [AUTH] Syncing avatar across devices for user:', userProfile.id)
              const avatarSyncResult = await AvatarStorageService.syncAvatarAcrossDevices(userProfile.id)
              if (avatarSyncResult.status === 'success') {
                console.log('✅ [AUTH] Avatar successfully synced across devices')
                // Update user profile with synced avatar if available
                if (avatarSyncResult.data) {
                  userProfile.avatar = avatarSyncResult.data
                  setUser({ ...userProfile }) // Update with synced avatar
                }
              } else {
                console.log('⚠️ [AUTH] Avatar sync failed, but continuing authentication:', avatarSyncResult.error)
              }
            } catch (avatarError) {
              console.log('⚠️ [AUTH] Avatar sync error, but continuing authentication:', avatarError)
            }

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

                // AUTO-POPULATE: Ensure bulletproof credentials are always available
                let finalApiKey = settings?.retell_config?.api_key
                let finalCallAgentId = settings?.retell_config?.call_agent_id
                let finalSmsAgentId = settings?.retell_config?.sms_agent_id

                // If no credentials in user settings, use bulletproof fallback
                if (!finalApiKey || !finalCallAgentId || !finalSmsAgentId) {
                  console.log('🔐 AuthContext: User missing credentials, auto-populating with bulletproof values...')
                  try {
                    const bulletproofCreds = getBulletproofCredentials()
                    finalApiKey = finalApiKey || bulletproofCreds.apiKey
                    finalCallAgentId = finalCallAgentId || bulletproofCreds.callAgentId
                    finalSmsAgentId = finalSmsAgentId || bulletproofCreds.smsAgentId

                    // Store bulletproof credentials everywhere for persistence
                    storeCredentialsEverywhere(bulletproofCreds)

                    console.log('✅ AuthContext: Bulletproof credentials auto-populated for user')
                  } catch (credError) {
                    console.error('❌ AuthContext: Failed to load bulletproof credentials:', credError)
                  }
                }

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
                  retellApiKey: finalApiKey,
                  callAgentId: finalCallAgentId,
                  smsAgentId: finalSmsAgentId
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
                // Fallback settings handling with bulletproof credentials
                try {
                  const fallbackSettings = await userSettingsService.getUserSettings(userProfile.id)
                  setUserSettings(fallbackSettings)

                  if (fallbackSettings?.retell_config) {
                    retellService.updateCredentials(
                      fallbackSettings.retell_config.api_key,
                      fallbackSettings.retell_config.call_agent_id,
                      fallbackSettings.retell_config.sms_agent_id
                    )
                  } else {
                    // Force bulletproof credentials if no settings found
                    console.log('🔐 AuthContext: Fallback settings empty, forcing bulletproof credentials...')
                    retellService.forceUpdateCredentials()
                  }
                } catch (fallbackError) {
                  console.error('❌ AuthContext: Settings fallback failed, using bulletproof credentials:', fallbackError)
                  // Ultimate fallback: Force bulletproof credentials
                  retellService.forceUpdateCredentials()

                  try {
                    const bulletproofCreds = getBulletproofCredentials()
                    storeCredentialsEverywhere(bulletproofCreds)
                  } catch (ultimateFallbackError) {
                    console.error('❌ AuthContext: Ultimate fallback failed:', ultimateFallbackError)
                  }
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
        setMfaInitiated(false)

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
      setMfaInitiated(false)

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
        // SECURITY FIX: Clear MFA lockout attempts on successful verification
        await MfaLockoutService.clearMfaAttempts(userProfile.id, userProfile.email)

        userProfile.mfaVerified = true
        const mfaTimestamp = Date.now().toString()
        localStorage.setItem('freshMfaVerified', mfaTimestamp)

        setUser(userProfile)

        // Sync avatar across devices after successful MFA completion
        try {
          console.log('🖼️ [MFA] Syncing avatar across devices for user:', userProfile.id)
          const avatarSyncResult = await AvatarStorageService.syncAvatarAcrossDevices(userProfile.id)
          if (avatarSyncResult.status === 'success') {
            console.log('✅ [MFA] Avatar successfully synced across devices')
            // Update user profile with synced avatar if available
            if (avatarSyncResult.data) {
              userProfile.avatar = avatarSyncResult.data
              setUser({ ...userProfile }) // Update with synced avatar
            }
          } else {
            console.log('⚠️ [MFA] Avatar sync failed, but continuing authentication:', avatarSyncResult.error)
          }
        } catch (avatarError) {
          console.log('⚠️ [MFA] Avatar sync error, but continuing authentication:', avatarError)
        }

        const session = await authService.getSessionInfo()
        setSessionInfo(session)

        setMfaRequired(false)
        setMfaChallenge(null)
        setMfaInitiated(false)

        await secureStorage.setSessionData('current_user', userProfile)

        try {
          await authService.verifyMFA(mfaChallenge.challenge, code)
        } catch (dbError) {
          console.warn('Failed to mark MFA challenge as used in database:', dbError)
        }

        // Load user settings and API keys after successful MFA
        if (userProfile.id) {
          try {
            console.log('🔄 Post-MFA: Loading settings for user:', userProfile.id)
            let settings = await userSettingsService.forceSyncFromCloud(userProfile.id)

            if (!settings) {
              settings = await userSettingsService.getUserSettings(userProfile.id)
            }

            setUserSettings(settings)
            await secureStorage.setUserPreference('user_settings', settings, false)

            // AUTO-POPULATE: Ensure bulletproof credentials for post-MFA
            try {
              const bulletproofCreds = getBulletproofCredentials()
              storeCredentialsEverywhere(bulletproofCreds)
            } catch (credError) {
              console.warn('⚠️ Post-MFA: Error storing bulletproof credentials:', credError)
            }

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
              console.log('📡 Post-MFA: API configuration ready event dispatched')
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
              }
            })
          } catch (error) {
            console.error('❌ Post-MFA: Error loading settings:', error)
            // Force bulletproof credentials as post-MFA fallback
            console.log('🔐 Post-MFA: Forcing bulletproof credentials due to settings error...')
            retellService.forceUpdateCredentials()

            try {
              const bulletproofCreds = getBulletproofCredentials()
              storeCredentialsEverywhere(bulletproofCreds)
            } catch (fallbackError) {
              console.error('❌ Post-MFA: Bulletproof fallback failed:', fallbackError)
            }
          }
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

      // Sync avatar during session refresh to ensure cross-device consistency
      try {
        console.log('🖼️ [REFRESH] Syncing avatar during session refresh for user:', updatedUser.id)
        const avatarSyncResult = await AvatarStorageService.syncAvatarAcrossDevices(updatedUser.id)
        if (avatarSyncResult.status === 'success' && avatarSyncResult.data) {
          updatedUser.avatar = avatarSyncResult.data
          console.log('✅ [REFRESH] Avatar synced during session refresh')
        }
      } catch (avatarError) {
        console.log('⚠️ [REFRESH] Avatar sync failed during refresh, but continuing:', avatarError)
      }

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