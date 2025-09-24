/**
 * Enhanced Authentication Context
 * Uses the new authentication middleware for better state management
 * and fixes multiple client instance issues
 */

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { authMiddleware } from '../services/authenticationMiddleware'
import { userSettingsService } from '../services/userSettingsService'
import { secureStorage } from '../services/secureStorage'
import { secureLogger } from '../services/secureLogger'
import type { User, AuthenticationState, SessionInfo } from '../types'

const logger = secureLogger.component('EnhancedAuthContext')

interface EnhancedAuthContextType {
  // Authentication state
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  mfaRequired: boolean
  sessionInfo: SessionInfo | null
  error: string | null
  
  // Authentication actions
  login: () => Promise<void>
  logout: () => Promise<void>
  completeMFA: (code: string) => Promise<boolean>
  refreshSession: () => Promise<void>
  clearError: () => void
  
  // Permission checking
  hasPermission: (resource: string, action: string) => boolean
  
  // Settings management
  userSettings: any
  updateSettings: (settings: Partial<any>) => Promise<void>
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined)

export const useEnhancedAuth = () => {
  const context = useContext(EnhancedAuthContext)
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider')
  }
  return context
}

interface EnhancedAuthProviderProps {
  children: ReactNode
}

export const EnhancedAuthProvider: React.FC<EnhancedAuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthenticationState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    sessionInfo: null,
    mfaRequired: false,
    error: null
  })
  const [userSettings, setUserSettings] = useState<any>(null)

  // Subscribe to authentication state changes from middleware
  useEffect(() => {
    logger.info('Initializing enhanced auth context')
    
    const unsubscribe = authMiddleware.subscribeToAuthState((newState: AuthenticationState) => {
      setAuthState(newState)
      
      // Load user settings when user is authenticated
      if (newState.isAuthenticated && newState.user && !userSettings) {
        loadUserSettings(newState.user.id)
      }
      
      // Clear settings when user is logged out
      if (!newState.isAuthenticated) {
        setUserSettings(null)
      }
    })
    
    return () => {
      unsubscribe()
      logger.debug('Enhanced auth context cleanup completed')
    }
  }, [])

  // Load user settings with cross-device sync
  const loadUserSettings = useCallback(async (userId: string) => {
    try {
      logger.debug('Loading user settings with cross-device sync', userId)
      
      // Force sync from cloud for cross-device support
      let settings = await userSettingsService.forceSyncFromCloud(userId)
      
      if (!settings) {
        // Fallback to regular settings load
        settings = await userSettingsService.getUserSettings(userId)
        
        if (!settings) {
          // Enhanced recovery: Try to find data from other storage locations
          try {
            const { userProfileService } = await import('../services/userProfileService')
            const profileResponse = await userProfileService.loadUserProfile(userId)
            
            if (profileResponse.status === 'success' && profileResponse.data?.settings) {
              const profileSettings = profileResponse.data.settings
              
              settings = {
                retell_config: {
                  api_key: profileSettings.retellApiKey,
                  call_agent_id: profileSettings.callAgentId,
                  sms_agent_id: profileSettings.smsAgentId
                }
              }
              
              logger.info('Settings recovered from profile service', userId)
            }
          } catch (recoveryError) {
            logger.warn('Settings recovery failed', userId, undefined, {
              error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
            })
          }
        }
      }
      
      setUserSettings(settings)
      
      // Store in secure storage
      if (settings) {
        await secureStorage.setUserPreference('user_settings', settings, false)
      }
      
      // Subscribe to real-time settings changes
      userSettingsService.subscribeToSettings(userId, async (newSettings) => {
        setUserSettings(newSettings)
        await secureStorage.setUserPreference('user_settings', newSettings, false)
        
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('settingsUpdated', {
          detail: newSettings
        }))
      })
      
      logger.info('User settings loaded successfully', userId)
      
    } catch (error) {
      logger.error('Failed to load user settings', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [])

  // Authentication actions
  const login = useCallback(async () => {
    try {
      await authMiddleware.login()
    } catch (error) {
      logger.error('Login failed in context', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      // Clear settings subscription
      if (authState.user) {
        userSettingsService.unsubscribeFromSettings(authState.user.id)
        userSettingsService.clearCache(authState.user.id)
      }
      
      // Clear secure storage
      await secureStorage.clear()
      
      // Logout via middleware
      await authMiddleware.logout()
      
      // Clear local settings
      setUserSettings(null)
      
      logger.info('Logout completed successfully')
      
    } catch (error) {
      logger.error('Logout failed in context', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Force clear local state even if logout fails
      setUserSettings(null)
      throw error
    }
  }, [authState.user])

  const completeMFA = useCallback(async (code: string): Promise<boolean> => {
    try {
      const success = await authMiddleware.completeMFA(code)
      
      if (success && authState.user) {
        // Load user settings after successful MFA
        await loadUserSettings(authState.user.id)
      }
      
      return success
    } catch (error) {
      logger.error('MFA completion failed in context', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }, [authState.user, loadUserSettings])

  const refreshSession = useCallback(async () => {
    try {
      await authMiddleware.refreshSession()
    } catch (error) {
      logger.error('Session refresh failed in context', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [])

  const clearError = useCallback(() => {
    // This would need to be implemented in the middleware
    // For now, we can dispatch a custom event or call a middleware method
    logger.debug('Clearing authentication error')
  }, [])

  const hasPermission = useCallback((resource: string, action: string): boolean => {
    return authMiddleware.hasPermission(resource, action)
  }, [])

  const updateSettings = useCallback(async (settings: Partial<any>): Promise<void> => {
    if (!authState.user?.id) {
      throw new Error('No user context for settings update')
    }
    
    try {
      logger.debug('Updating settings with cross-device sync', authState.user.id)
      
      const updatedSettings = await userSettingsService.updateUserSettings(
        authState.user.id, 
        settings
      )
      
      setUserSettings(updatedSettings)
      
      // Update secure storage
      await secureStorage.setUserPreference('user_settings', updatedSettings, false)
      
      logger.info('Settings updated successfully', authState.user.id)
      
    } catch (error) {
      logger.error('Failed to update settings', authState.user.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [authState.user])

  const contextValue: EnhancedAuthContextType = {
    // State
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    mfaRequired: authState.mfaRequired,
    sessionInfo: authState.sessionInfo,
    error: authState.error,
    
    // Actions
    login,
    logout,
    completeMFA,
    refreshSession,
    clearError,
    
    // Permissions
    hasPermission,
    
    // Settings
    userSettings,
    updateSettings
  }

  return (
    <EnhancedAuthContext.Provider value={contextValue}>
      {children}
    </EnhancedAuthContext.Provider>
  )
}

// Export both the enhanced context and the original for backward compatibility
export { EnhancedAuthContext }

// Migration helper - allows gradual migration from old context to new
export const useAuth = useEnhancedAuth // Alias for backward compatibility