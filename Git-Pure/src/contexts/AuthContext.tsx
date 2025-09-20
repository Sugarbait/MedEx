import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import type { User, MFAChallenge, SessionInfo } from '@/types'
import { authService } from '@/services/authService'
import { useSupabase } from './SupabaseContext'
import { userSettingsService } from '@/services'

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
          const userProfile = await authService.getUserProfile(account.homeAccountId)

          if (userProfile.mfaEnabled && !userProfile.mfaVerified) {
            setMfaRequired(true)
            const challenge = await authService.initiateMFA(userProfile.id)
            setMfaChallenge(challenge)
          } else {
            setUser(userProfile)
            const session = await authService.getSessionInfo()
            setSessionInfo(session)

            // Load user settings from Supabase
            if (supabase && userProfile.id) {
              const settings = await userSettingsService.getUserSettings(userProfile.id)
              setUserSettings(settings)

              // Subscribe to settings changes for cross-device sync
              userSettingsService.subscribeToSettings(userProfile.id, (newSettings) => {
                setUserSettings(newSettings)
              })
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [isAuthenticated, accounts, supabase])

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null)
      setSessionInfo(null)
      setMfaRequired(false)
      setMfaChallenge(null)
      setUserSettings(null)
      // Unsubscribe from settings when logged out
      userSettingsService.unsubscribeFromSettings()
    }
  }, [isAuthenticated])

  const login = async () => {
    try {
      await instance.loginPopup({
        scopes: ['User.Read', 'openid', 'profile'],
        prompt: 'select_account'
      })
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      if (sessionInfo) {
        await authService.invalidateSession(sessionInfo.sessionId)
      }

      await instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
        mainWindowRedirectUri: window.location.origin
      })

      setUser(null)
      setSessionInfo(null)
      setMfaRequired(false)
      setMfaChallenge(null)
    } catch (error) {
      console.error('Logout error:', error)
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
      const updatedSettings = await userSettingsService.updateUserSettings(user.id, settings)
      setUserSettings(updatedSettings)
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  }

  // Session timeout handling
  useEffect(() => {
    if (!sessionInfo) return

    const timeoutDuration = 15 * 60 * 1000 // 15 minutes
    let timeoutId: NodeJS.Timeout
    let warningTimeoutId: NodeJS.Timeout

    const resetTimeout = () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)

      warningTimeoutId = setTimeout(() => {
        const shouldContinue = window.confirm(
          'Your session will expire in 2 minutes due to inactivity. Click OK to continue.'
        )

        if (shouldContinue) {
          refreshSession()
        } else {
          logout()
        }
      }, timeoutDuration - 2 * 60 * 1000) // 2 minutes before timeout

      timeoutId = setTimeout(() => {
        logout()
      }, timeoutDuration)
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    const resetTimer = () => resetTimeout()

    events.forEach(event => {
      document.addEventListener(event, resetTimer, true)
    })

    resetTimeout()

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(warningTimeoutId)
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true)
      })
    }
  }, [sessionInfo])

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