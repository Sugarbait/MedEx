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

  // CRITICAL FIX: Safe user setter that preserves user ID integrity
  const setUserSafely = (newUser: User | null) => {
    if (newUser) {
      // Validate that user has required properties before setting
      if (!newUser.id || newUser.id === 'undefined') {
        console.error('🚨 CRITICAL: Attempted to set user with invalid ID:', newUser)
        // Try to recover user ID from localStorage
        try {
          const currentUser = localStorage.getItem('currentUser')
          if (currentUser) {
            const userData = JSON.parse(currentUser)
            if (userData.id && userData.id !== 'undefined') {
              newUser.id = userData.id
              console.log('✅ RECOVERED: User ID restored from localStorage')
            }
          }
        } catch (error) {
          console.error('Failed to recover user ID:', error)
          return // Don't set invalid user
        }
      }

      // Additional validation for critical fields
      if (!newUser.email && !newUser.name) {
        console.error('🚨 CRITICAL: User missing email and name:', newUser)
        return // Don't set invalid user
      }

      console.log('✅ Setting user safely:', {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      })
    }

    // CRITICAL: Hard-coded Super User enforcement for specific emails
    if (newUser.email === 'pierre@phaetonai.com' || newUser.email === 'elmfarrell@yahoo.com') {
      newUser.role = 'super_user'
      console.log(`🔐 HARD-CODED SUPER USER: Enforced super_user role for ${newUser.email} in AuthContext.setUser`)
    }

    setUser(newUser)
  }

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

          setUserSafely(demoUser)
          // In demo mode, still respect user's MFA settings for testing
          // setMfaRequired(false) // Skip MFA in demo mode
          console.log('🔧 DEMO MODE: MFA will be checked based on user settings (not automatically skipped)')

          // Sync avatar in demo mode too
          try {
            console.log('🖼️ [DEMO] Syncing avatar for demo user:', demoUser.id)
            const avatarSyncResult = await AvatarStorageService.syncAvatarAcrossDevices(demoUser.id)
            if (avatarSyncResult.status === 'success' && avatarSyncResult.data) {
              demoUser.avatar = avatarSyncResult.data
              setUserSafely({ ...demoUser }) // Update with synced avatar
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

            // Update last_login timestamp in Supabase for users with valid session
            try {
              const { error: lastLoginError } = await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userProfile.id)

              if (lastLoginError) {
                console.warn('⚠️ Failed to update last_login:', lastLoginError)
              } else {
                console.log('✅ Updated last_login timestamp for authenticated user:', userProfile.id)
                // Clear cached systemUsers to force refresh on User Management page
                localStorage.removeItem('systemUsers')
                console.log('🧹 Cleared systemUsers cache to show updated last_login')
              }
            } catch (loginUpdateError) {
              console.warn('⚠️ Error updating last_login:', loginUpdateError)
            }

            setUserSafely(userProfile)

            // Sync avatar across devices after successful authentication
            try {
              console.log('🖼️ [AUTH] Syncing avatar across devices for user:', userProfile.id)
              const avatarSyncResult = await AvatarStorageService.syncAvatarAcrossDevices(userProfile.id)
              if (avatarSyncResult.status === 'success') {
                console.log('✅ [AUTH] Avatar successfully synced across devices')
                // Update user profile with synced avatar if available
                if (avatarSyncResult.data) {
                  userProfile.avatar = avatarSyncResult.data
                  setUserSafely({ ...userProfile }) // Update with synced avatar
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
        setUserSafely(null)
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
        // CRITICAL: Set logout flag FIRST before any clearing
        localStorage.setItem('justLoggedOut', 'true')
        localStorage.setItem('justLoggedOutTimestamp', Date.now().toString())
        localStorage.setItem('forceLoginPage', 'true') // Force login page display
        console.log('🚪 Set logout flags to force return to login page')

        // ENHANCED: Record logout with browser session tracker
        try {
          const { browserSessionTracker } = await import('../utils/browserSessionTracker')
          browserSessionTracker.recordLogout()
          console.log('🔒 Browser session logout recorded with user agent tracking')
        } catch (error) {
          console.warn('Failed to record browser session logout:', error)
        }

        localStorage.removeItem('freshMfaVerified')
        localStorage.removeItem('currentUser')
        localStorage.removeItem('mfa_verified')

        if (user?.id) {
          userSettingsService.unsubscribeFromSettings(user.id)
          userSettingsService.clearCache(user.id)
          localStorage.removeItem(`settings_${user.id}`)
        }

        await secureStorage.clear()

        // CRITICAL FIX: Clear sessionStorage to ensure fresh login detection
        sessionStorage.removeItem('appInitialized')
        sessionStorage.removeItem('spa-redirect-path')
        console.log('✅ SessionStorage cleared for fresh login detection')

        // COMPREHENSIVE: Clear ALL authentication and user-related localStorage items
        const keysToRemove = Object.keys(localStorage).filter(key =>
          key.startsWith('msal.') || // MSAL tokens
          key.includes('login-hint') || // MSAL login hints
          key.includes('account') || // MSAL accounts
          key.includes('token') || // Any token-related keys
          key.includes('credential') || // Any credential-related keys
          key.includes('session') || // Any session-related keys
          key.startsWith('settings_') || // User settings (includes API keys)
          key.startsWith('user_') || // User data
          key.startsWith('profile_') || // Profile data
          key.startsWith('browserSession') || // Browser sessions
          key === 'systemUsers' || // System users list
          key === 'retell_credentials_backup' || // Retell credentials backup
          key === 'currentUser' // Current user data
        )

        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
          console.log(`🗑️ Removed localStorage key: ${key}`)
        })

        // CRITICAL: Clear bulletproof credential storage completely
        try {
          // Clear all sessionStorage credential backups
          sessionStorage.removeItem('retell_credentials_backup')

          // Clear in-memory credential backups
          if (typeof window !== 'undefined') {
            delete (window as any).__retellCredentialsBackup
          }

          // Clear emergency recovery credentials
          localStorage.removeItem('__emergencyRetellCredentials')
          localStorage.removeItem('__fallbackRetellConfig')

          console.log('🔐 Cleared all bulletproof credential storage')
        } catch (credentialClearError) {
          console.warn('Error clearing credential storage:', credentialClearError)
        }

        // Clear all sessionStorage
        sessionStorage.clear()
        console.log('🗑️ Cleared all sessionStorage')

        // CRITICAL: Remove login session markers
        sessionStorage.removeItem('appInitialized')
        localStorage.removeItem('userLoginTimestamp')
        console.log('🚪 Cleared login session markers')

        // CRITICAL: Force MSAL to clear all accounts and cache
        try {
          const accounts = instance.getAllAccounts()
          if (accounts.length > 0) {
            console.log('🔐 Clearing MSAL accounts and cache')
            await instance.logoutPopup({
              account: accounts[0],
              postLogoutRedirectUri: window.location.origin
            })
          }

          // Force clear MSAL cache
          instance.clearCache()
          console.log('✅ MSAL cache cleared completely')
        } catch (msalError) {
          console.warn('Warning: MSAL logout error (non-critical):', msalError)
          // Continue with logout even if MSAL fails
        }
      } catch (cleanupError) {
        console.error('Error during logout cleanup:', cleanupError)
      }

      if (!isDemoMode) {
        try {
          // CRITICAL: Clear MSAL cache BEFORE logout to ensure tokens are removed
          console.log('🔐 Starting comprehensive MSAL cleanup...')

          // Get all accounts first
          const allAccounts = instance.getAllAccounts()

          // Clear each account explicitly
          for (const account of allAccounts) {
            try {
              // Set account to null
              instance.setActiveAccount(null)

              // Try to remove the account from cache if method is available
              if (typeof (instance as any).removeAccount === 'function') {
                await (instance as any).removeAccount(account)
                console.log(`🗑️ Removed account: ${account.username}`)
              }
            } catch (accountError) {
              console.warn('Error removing account:', accountError)
            }
          }

          // Manual cleanup of all MSAL localStorage keys
          const msalKeys = Object.keys(localStorage).filter(key =>
            key.startsWith('msal.') ||
            key.includes('.msal') ||
            key.includes('clientId') ||
            key.includes('authority')
          )

          msalKeys.forEach(key => {
            localStorage.removeItem(key)
            console.log(`🗑️ Manually removed MSAL key: ${key}`)
          })

          // Clear MSAL session storage as well
          const msalSessionKeys = Object.keys(sessionStorage).filter(key =>
            key.startsWith('msal.') || key.includes('.msal')
          )

          msalSessionKeys.forEach(key => {
            sessionStorage.removeItem(key)
            console.log(`🗑️ Removed MSAL session key: ${key}`)
          })

          // Now perform the actual logout
          // Use logoutRedirect with account for more reliable logout
          try {
            if (allAccounts.length > 0) {
              console.log(`🔐 Logging out account: ${allAccounts[0].username}`)
              await instance.logoutRedirect({
                account: allAccounts[0],
                postLogoutRedirectUri: window.location.origin,
                onRedirectNavigate: () => {
                  // Allow navigation this time to complete Microsoft logout
                  console.log('🔄 Allowing Microsoft logout redirect')
                  return true
                }
              })
            } else {
              // No accounts found, force general logout
              await instance.logoutRedirect({
                postLogoutRedirectUri: window.location.origin
              })
            }
            console.log('✅ MSAL logout redirect initiated')
          } catch (redirectError) {
            console.warn('⚠️ Redirect logout failed, trying popup:', redirectError)
            // Fallback to popup
            try {
              await instance.logoutPopup({
                postLogoutRedirectUri: window.location.origin,
                mainWindowRedirectUri: window.location.origin
              })
              console.log('✅ MSAL popup logout successful')
            } catch (popupError) {
              console.error('❌ Both logout methods failed:', popupError)
              // Manual cleanup as last resort
              allAccounts.forEach(account => {
                try {
                  instance.setActiveAccount(null)
                  if (typeof (instance as any).removeAccount === 'function') {
                    (instance as any).removeAccount(account)
                  }
                } catch (e) {
                  console.warn('Manual account removal failed:', e)
                }
              })
            }
          }
        } catch (msalError) {
          console.error('MSAL logout error:', msalError)
          // Emergency cleanup - remove ALL possible auth-related keys
          const authKeys = Object.keys(localStorage).filter(key =>
            key.toLowerCase().includes('msal') ||
            key.toLowerCase().includes('account') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('auth') ||
            key.toLowerCase().includes('session')
          )

          authKeys.forEach(key => {
            localStorage.removeItem(key)
            console.log(`🗑️ Emergency removal of key: ${key}`)
          })

          // Clear sessionStorage completely as last resort
          sessionStorage.clear()
          console.log('🗑️ Emergency: Cleared all sessionStorage')
        }
      }

      setUserSafely(null)
      setSessionInfo(null)
      setMfaRequired(false)
      setMfaChallenge(null)
      setUserSettings(null)
      setMfaInitiated(false)

      logger.info('Logout completed')

      // CRITICAL FIX: Set logout flag to prevent auto-login on reload
      localStorage.setItem('justLoggedOut', 'true')

      // Force page reload after logout to ensure complete session reset
      // This prevents any lingering authentication state that might bypass fresh login
      if (!isDemoMode) {
        // Clear the logout flag after a longer delay to ensure all services see it
        setTimeout(() => {
          localStorage.removeItem('justLoggedOut')
          console.log('🔄 Cleared justLoggedOut flag after 20 seconds')
        }, 20000) // Extended to 20 seconds to account for Microsoft logout redirect

        // Don't force reload immediately - let MSAL logout redirect handle navigation
        // If MSAL redirect fails, reload after a longer delay
        setTimeout(() => {
          const currentLogoutFlag = localStorage.getItem('justLoggedOut')
          if (currentLogoutFlag === 'true') {
            console.log('🔄 MSAL redirect may have failed, performing manual page reload')
            window.location.replace(window.location.origin)
          }
        }, 3000) // Give MSAL redirect 3 seconds to complete
      }
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

        // Update last_login timestamp in Supabase
        try {
          const { error: lastLoginError } = await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', userProfile.id)

          if (lastLoginError) {
            console.warn('⚠️ Failed to update last_login:', lastLoginError)
          } else {
            console.log('✅ Updated last_login timestamp after MFA:', userProfile.id)
            // Clear cached systemUsers to force refresh on User Management page
            localStorage.removeItem('systemUsers')
            console.log('🧹 Cleared systemUsers cache to show updated last_login')
          }
        } catch (loginUpdateError) {
          console.warn('⚠️ Error updating last_login:', loginUpdateError)
        }

        userProfile.mfaVerified = true
        const mfaTimestamp = Date.now().toString()
        localStorage.setItem('freshMfaVerified', mfaTimestamp)

        setUserSafely(userProfile)

        // Sync avatar across devices after successful MFA completion
        try {
          console.log('🖼️ [MFA] Syncing avatar across devices for user:', userProfile.id)
          const avatarSyncResult = await AvatarStorageService.syncAvatarAcrossDevices(userProfile.id)
          if (avatarSyncResult.status === 'success') {
            console.log('✅ [MFA] Avatar successfully synced across devices')
            // Update user profile with synced avatar if available
            if (avatarSyncResult.data) {
              userProfile.avatar = avatarSyncResult.data
              setUserSafely({ ...userProfile }) // Update with synced avatar
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

      setUserSafely(updatedUser)
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