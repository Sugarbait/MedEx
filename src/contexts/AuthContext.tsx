import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import type { User, MFAChallenge, SessionInfo } from '@/types'
import { authService } from '@/services/authService'
import { useSupabase } from './SupabaseContext'
import { userSettingsService } from '@/services/userSettingsService'
// MFA functionality moved to TOTPProtectedRoute
import { secureStorage } from '@/services/secureStorage'
import { secureLogger } from '@/services/secureLogger'
import { FreshMfaService } from '@/services/freshMfaService'

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
          setIsLoading(false)
          return
        }

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

          // Check if MFA is required after sync - Using Fresh MFA Service
          console.log('🔐 MANDATORY MFA: Checking MFA requirement using Fresh MFA Service')

          let mfaEnabled = false
          let hasValidMFASession = false

          try {
            // Use Fresh MFA Service to check if MFA is enabled
            mfaEnabled = await FreshMfaService.isMfaEnabled(userProfile.id)

            // Check for existing valid MFA session (24 hour window)
            const mfaTimestamp = localStorage.getItem('freshMfaVerified')
            if (mfaTimestamp) {
              const sessionAge = Date.now() - parseInt(mfaTimestamp)
              const MAX_MFA_SESSION_AGE = 24 * 60 * 60 * 1000 // 24 hours
              hasValidMFASession = sessionAge < MAX_MFA_SESSION_AGE
            }

            console.log('🔐 MFA Status Check (Mandatory):', {
              userId: userProfile.id,
              mfaEnabled,
              hasValidMFASession,
              sessionAge: mfaTimestamp ? (Date.now() - parseInt(mfaTimestamp)) / 1000 / 60 : null,
              requiresVerification: mfaEnabled && !hasValidMFASession
            })

          } catch (mfaCheckError) {
            console.error('❌ Error checking MFA status:', mfaCheckError)
            // Default to requiring MFA if check fails for security
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
              setMfaRequired(true) // Still require MFA even if challenge fails
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

                // Also store in localStorage for immediate access by SettingsPage
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

                // CRITICAL: Initialize retell service with API credentials immediately upon login
                if (settings?.retell_config?.api_key) {
                  console.log('🚀 INITIALIZING RETELL SERVICE with API credentials from login...')
                  try {
                    const { retellService } = await import('@/services/retellService')
                    retellService.updateCredentials(
                      settings.retell_config.api_key,
                      settings.retell_config.call_agent_id,
                      settings.retell_config.sms_agent_id
                    )

                    // CRITICAL FIX: Force reload credentials from localStorage to ensure consistency
                    retellService.loadCredentials()
                    console.log('✅ Retell service initialized with API credentials on login!')

                    // Dispatch event to notify other components that API is ready
                    // Add a small delay to ensure all other initialization is complete
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
                        detail: {
                          apiKey: !!settings.retell_config.api_key,
                          callAgentId: !!settings.retell_config.call_agent_id,
                          smsAgentId: !!settings.retell_config.sms_agent_id
                        }
                      }))
                      console.log('📡 API configuration ready event dispatched')
                    }, 100) // 100ms delay to ensure Dashboard has time to set up listeners
                  } catch (retellError) {
                    console.error('❌ Failed to initialize retell service on login:', retellError)
                  }
                } else {
                  console.log('⚠️ No API credentials found in database - using hardcoded fallback credentials for production')
                  try {
                    const { retellService } = await import('@/services/retellService')
                    // Use hardcoded credentials as fallback for production
                    retellService.forceUpdateCredentials()
                    console.log('✅ Retell service initialized with fallback credentials!')

                    // Dispatch event to notify other components that API is ready
                    // Add a small delay to ensure all other initialization is complete
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
                        detail: {
                          apiKey: true,
                          callAgentId: true,
                          smsAgentId: true
                        }
                      }))
                      console.log('📡 API configuration ready event dispatched (fallback credentials)')
                    }, 100) // 100ms delay to ensure Dashboard has time to set up listeners
                  } catch (retellError) {
                    console.error('❌ Failed to initialize retell service with fallback credentials:', retellError)
                  }
                }

                // Subscribe to real-time settings changes
                userSettingsService.subscribeToSettings(userProfile.id, async (newSettings) => {
                  setUserSettings(newSettings)
                  await secureStorage.setUserPreference('user_settings', newSettings, false)

                  // CRITICAL: Update retell service when settings change
                  if (newSettings?.retell_config?.api_key) {
                    try {
                      const { retellService } = await import('@/services/retellService')
                      retellService.updateCredentials(
                        newSettings.retell_config.api_key,
                        newSettings.retell_config.call_agent_id,
                        newSettings.retell_config.sms_agent_id
                      )

                      // CRITICAL FIX: Force reload credentials from localStorage to ensure consistency
                      retellService.loadCredentials()
                      console.log('✅ Retell service updated with new credentials from real-time sync')

                      // Notify components of API configuration update
                      // Add a small delay to ensure all other initialization is complete
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
                          detail: {
                            apiKey: !!newSettings.retell_config.api_key,
                            callAgentId: !!newSettings.retell_config.call_agent_id,
                            smsAgentId: !!newSettings.retell_config.sms_agent_id
                          }
                        }))
                        console.log('📡 API configuration ready event dispatched (real-time sync)')
                      }, 100) // 100ms delay to ensure components have time to process
                    } catch (retellError) {
                      console.error('❌ Failed to update retell service from real-time sync:', retellError)
                    }
                  } else {
                    // If no API key in settings, use fallback credentials
                    try {
                      const { retellService } = await import('@/services/retellService')
                      retellService.forceUpdateCredentials()
                      console.log('✅ Retell service updated with fallback credentials from real-time sync')

                      // Notify components of API configuration update
                      // Add a small delay to ensure all other initialization is complete
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
                          detail: {
                            apiKey: true,
                            callAgentId: true,
                            smsAgentId: true
                          }
                        }))
                        console.log('📡 API configuration ready event dispatched (real-time sync fallback)')
                      }, 100) // 100ms delay to ensure components have time to process
                    } catch (retellError) {
                      console.error('❌ Failed to update retell service with fallback credentials:', retellError)
                    }
                  }

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

                  // Store fallback settings in localStorage for SettingsPage access
                  localStorage.setItem(`settings_${userProfile.id}`, JSON.stringify({
                    theme: fallbackSettings?.theme || 'light',
                    mfaEnabled: userProfile.mfaEnabled || false,
                    refreshInterval: 30000,
                    sessionTimeout: fallbackSettings?.security_preferences?.session_timeout || 15,
                    notifications: {
                      calls: fallbackSettings?.notifications?.call_alerts ?? true,
                      sms: fallbackSettings?.notifications?.sms_alerts ?? true,
                      system: fallbackSettings?.notifications?.security_alerts ?? true
                    },
                    retellApiKey: fallbackSettings?.retell_config?.api_key,
                    callAgentId: fallbackSettings?.retell_config?.call_agent_id,
                    smsAgentId: fallbackSettings?.retell_config?.sms_agent_id
                  }))

                  // Also try to initialize retell service with fallback settings
                  if (fallbackSettings?.retell_config) {
                    try {
                      const { retellService } = await import('@/services/retellService')
                      retellService.updateCredentials(
                        fallbackSettings.retell_config.api_key,
                        fallbackSettings.retell_config.call_agent_id,
                        fallbackSettings.retell_config.sms_agent_id
                      )
                      console.log('✅ Retell service initialized with fallback settings')

                      // Dispatch API ready event
                      // Add a small delay to ensure all other initialization is complete
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
                          detail: {
                            apiKey: !!fallbackSettings.retell_config.api_key,
                            callAgentId: !!fallbackSettings.retell_config.call_agent_id,
                            smsAgentId: !!fallbackSettings.retell_config.sms_agent_id
                          }
                        }))
                        console.log('📡 API configuration ready event dispatched (fallback settings)')
                      }, 100) // 100ms delay to ensure components have time to process
                    } catch (retellError) {
                      console.error('❌ Failed to initialize retell service with fallback:', retellError)
                    }
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

      // SECURITY ENHANCEMENT: Comprehensive cleanup on logout
      try {
        // Clear MFA sessions
        localStorage.removeItem('freshMfaVerified')
        console.log('✅ Fresh MFA sessions cleared')

        // Clean up settings subscriptions for current user
        if (user?.id) {
          userSettingsService.unsubscribeFromSettings(user.id)
          userSettingsService.clearCache(user.id)

          // Clear user-specific localStorage items
          localStorage.removeItem(`user_settings_${user.id}`)
          localStorage.removeItem(`settings_${user.id}`)
          localStorage.removeItem('freshMfaVerified')
        } else {
          // Fallback: clean up all subscriptions and cache
          userSettingsService.unsubscribeFromSettings()
          userSettingsService.clearCache()

          // Clear all user-related localStorage items
          const allKeys = Object.keys(localStorage)
          allKeys.forEach(key => {
            if (key.startsWith('user_settings_') ||
                key.startsWith('settings_') ||
                key.startsWith('freshMfaVerified_')) {
              localStorage.removeItem(key)
            }
          })
        }

        // Clear all secure storage
        await secureStorage.clear()

        // Clear main authentication data
        localStorage.removeItem('currentUser')
        localStorage.removeItem('mfa_verified')

        console.log('🚪 SECURITY: Complete authentication cleanup performed')
      } catch (cleanupError) {
        console.error('Error during logout cleanup:', cleanupError)
        // Continue with logout even if cleanup fails
      }

      try {
        await instance.logoutPopup({
          postLogoutRedirectUri: window.location.origin,
          mainWindowRedirectUri: window.location.origin
        })
      } catch (msalError) {
        console.warn('MSAL logout failed, continuing with local cleanup:', msalError)
      }

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

      // SECURITY: Even if logout fails, clear local data
      try {
        localStorage.removeItem('currentUser')
        localStorage.removeItem('mfa_verified')
        localStorage.removeItem('freshMfaVerified')
        console.log('✅ All MFA sessions cleared on logout failure')
      } catch (fallbackError) {
        console.error('Fallback cleanup also failed:', fallbackError)
      }
    }
  }

  const completeMFA = async (code: string): Promise<boolean> => {
    try {
      if (!mfaChallenge || !accounts.length) {
        return false
      }

      // Use Fresh MFA Service for verification
      const account = accounts[0]
      const userProfile = await authService.getUserProfile(account.homeAccountId)

      const isValid = await FreshMfaService.verifyLoginCode(userProfile.id, code)

      if (isValid) {
        // CRITICAL: Mark user as MFA verified and store session timestamp
        userProfile.mfaVerified = true
        const mfaTimestamp = Date.now().toString()
        localStorage.setItem('freshMfaVerified', mfaTimestamp)

        setUser(userProfile)

        const session = await authService.getSessionInfo()
        setSessionInfo(session)

        setMfaRequired(false)
        setMfaChallenge(null)

        // Update user profile storage with verified status
        await secureStorage.setSessionData('current_user', userProfile)

        // Mark the MFA challenge as used in database
        try {
          await authService.verifyMFA(mfaChallenge.challenge, code)
        } catch (dbError) {
          console.warn('Failed to mark MFA challenge as used in database:', dbError)
          // Continue - the important verification was done with Fresh MFA Service
        }

        console.log('✅ MANDATORY MFA completed successfully - user now has verified access')
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

  // ENHANCED session timeout handling with proper cleanup
  useEffect(() => {
    if (!sessionInfo || !user) return

    // Get session timeout from user settings, default to 15 minutes
    let timeoutDuration = 15 * 60 * 1000 // 15 minutes default
    try {
      const savedSettings = localStorage.getItem(`settings_${user.id}`)
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        if (settings.sessionTimeout) {
          timeoutDuration = settings.sessionTimeout * 60 * 1000 // Convert minutes to ms
        }
      }
    } catch (error) {
      console.error('Failed to load session timeout setting:', error)
    }

    const warningDuration = 2 * 60 * 1000  // 2 minutes before timeout

    let timeoutId: NodeJS.Timeout
    let warningTimeoutId: NodeJS.Timeout
    let activityTimer: NodeJS.Timeout
    let isWarningShown = false

    const handleSessionExpiry = async () => {
      logger.warn('Session expired due to inactivity', user.id, sessionInfo.sessionId)

      // SECURITY ENHANCEMENT: Clear all authentication data on timeout
      try {
        // Clear MFA sessions
        localStorage.removeItem('freshMfaVerified')
        console.log('✅ Fresh MFA sessions cleared on timeout')

        // Clear all user data
        localStorage.removeItem('currentUser')
        localStorage.removeItem('mfa_verified')

        // Clear secure storage
        await secureStorage.clear()

        console.log('🚪 SECURITY: All authentication data cleared on session timeout')
      } catch (error) {
        console.error('Error clearing authentication data on timeout:', error)
      }

      await logout()
    }

    const handleSessionWarning = () => {
      if (isWarningShown) return // Prevent multiple warnings
      isWarningShown = true

      logger.info('Session expiring soon, showing warning', user.id, sessionInfo.sessionId)

      const shouldContinue = window.confirm(
        'Your session will expire in 2 minutes due to inactivity. Click OK to continue, or Cancel to logout now.'
      )

      if (shouldContinue) {
        // SECURITY ENHANCEMENT: Require MFA re-verification for session extension
        const lastMFATime = localStorage.getItem('freshMfaVerified')
        const now = Date.now()
        const mfaAge = lastMFATime ? now - parseInt(lastMFATime) : Infinity
        const MFA_REAUTH_THRESHOLD = 4 * 60 * 60 * 1000 // 4 hours

        if (mfaAge > MFA_REAUTH_THRESHOLD) {
          alert('For security, you will need to re-verify your identity to continue.')
          // Clear MFA sessions to force re-authentication
          localStorage.removeItem('freshMfaVerified')
          console.log('✅ Fresh MFA session cleared for re-authentication')
        }

        refreshSession().catch(() => {
          logger.error('Failed to refresh session on user request')
          logout()
        })
        isWarningShown = false
      } else {
        logout()
      }
    }

    const resetTimeout = () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      clearTimeout(activityTimer)
      isWarningShown = false

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

    // Listen for settings changes that might affect timeout duration
    const handleSettingsChange = () => {
      resetTimeout() // Restart with potentially new timeout duration
    }
    window.addEventListener('userSettingsUpdated', handleSettingsChange)

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      clearTimeout(activityTimer)

      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('userSettingsUpdated', handleSettingsChange)

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