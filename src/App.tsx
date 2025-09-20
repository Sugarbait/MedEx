import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './config/supabase'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './services/auditLogger'
import { userProfileService } from './services/userProfileService'
import { mfaService } from './services/mfaService'
import { retellService } from './services/retellService'
import { ThemeManager } from './utils/themeManager'
import { initializeSecureStorage } from './services/storageSecurityMigration'
import { secureUserDataService } from './services/secureUserDataService'
import { authService } from './services/authService'
import { UserSettingsService } from './services/userSettingsServiceEnhanced'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { MFAGate } from './components/auth/MFAGate'
import { MFAProtectedRoute } from './components/auth/MFAProtectedRoute'
import { AuditLogger } from './components/security/AuditLogger'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import { SessionTimeoutWarning } from './components/common/SessionTimeoutWarning'

// Pages
import { DashboardPage } from './pages/DashboardPage'
import { CallsPage } from './pages/CallsPage'
import { SMSPage } from './pages/SMSPage'
import { SettingsPage } from './pages/SettingsPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { LoginPage } from './pages/LoginPage'

import {
  ShieldCheckIcon,
  AlertTriangleIcon
} from 'lucide-react'

const getPageTitle = (pathname: string): string => {
  switch (pathname) {
    case '/dashboard':
      return 'Dashboard'
    case '/calls':
      return 'Calls'
    case '/sms':
      return 'SMS'
    case '/users':
      return 'User Management'
    case '/settings':
      return 'Settings'
    default:
      return 'Dashboard'
  }
}

const AppContent: React.FC<{
  user: any
  mfaRequired: boolean
  setMfaRequired: (value: boolean) => void
  sidebarOpen: boolean
  setSidebarOpen: (value: boolean) => void
  hipaaMode: boolean
  handleMFASuccess: () => void
  handleLogout: () => void
}> = ({ user, mfaRequired, setMfaRequired, sidebarOpen, setSidebarOpen, hipaaMode, handleMFASuccess, handleLogout }) => {
  const location = useLocation()
  const pageTitle = getPageTitle(location.pathname)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)

  // Ensure theme persistence on navigation
  useEffect(() => {
    ThemeManager.initialize()
  }, [location.pathname])

  // Get session timeout from user settings (default 15 minutes)
  const getUserSessionTimeout = (): number => {
    try {
      const savedSettings = localStorage.getItem(`settings_${user?.id}`)
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        return (settings.sessionTimeout || 15) * 60 * 1000 // Convert minutes to ms
      }
    } catch (error) {
      console.error('Failed to load session timeout setting:', error)
    }
    return 15 * 60 * 1000 // Default 15 minutes
  }

  const SESSION_TIMEOUT = getUserSessionTimeout()
  const WARNING_TIME = 2 * 60 * 1000 // Show warning 2 minutes before timeout

  const { resetTimeout, getTimeRemaining, getTimeRemainingFormatted } = useSessionTimeout({
    timeout: SESSION_TIMEOUT,
    onTimeout: handleLogout,
    user,
    enabled: !!user && !mfaRequired
  })

  // Check for warning time every 30 seconds
  useEffect(() => {
    if (!user || mfaRequired) return

    const checkWarning = () => {
      const remaining = getTimeRemaining()
      if (remaining <= WARNING_TIME && remaining > 0 && !showTimeoutWarning) {
        setShowTimeoutWarning(true)
      }
    }

    checkWarning() // Check immediately
    const interval = setInterval(checkWarning, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [user, mfaRequired, getTimeRemaining, showTimeoutWarning])

  const handleExtendSession = () => {
    resetTimeout()
    setShowTimeoutWarning(false)
  }

  const handleDismissWarning = () => {
    setShowTimeoutWarning(false)
  }

  if (mfaRequired) {
    return <MFAGate onSuccess={handleMFASuccess} user={user} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* HIPAA Compliance Banner */}
      {hipaaMode && (
        <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white px-4 py-2 text-sm z-50">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4" />
            <span>HIPAA Compliant Mode Active - All actions are audited</span>
            <div className="ml-auto flex items-center gap-4 text-xs">
              <span>Session: {user?.name}</span>
              <span>Encrypted</span>
              <span>Audit: ON</span>
            </div>
          </div>
        </div>
      )}

      <div className={`flex ${hipaaMode ? 'pt-10' : ''}`}>
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          user={user}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col transition-all duration-300">
          <Header
            user={user}
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
            onLogout={handleLogout}
            pageTitle={pageTitle}
            getTimeRemaining={getTimeRemaining}
            onExtendSession={handleExtendSession}
          />

          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage user={user} />} />
              <Route
                path="/calls"
                element={
                  <MFAProtectedRoute user={user} requiresMFA={true}>
                    <CallsPage user={user} />
                  </MFAProtectedRoute>
                }
              />
              <Route
                path="/sms"
                element={
                  <MFAProtectedRoute user={user} requiresMFA={true}>
                    <SMSPage user={user} />
                  </MFAProtectedRoute>
                }
              />
              <Route path="/users" element={<UserManagementPage user={user} />} />
              <Route path="/settings" element={<SettingsPage user={user} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>

      {/* Audit Logger Component */}
      <AuditLogger user={user} />

      {/* Session Timeout Warning */}
      <SessionTimeoutWarning
        isVisible={showTimeoutWarning}
        timeRemaining={getTimeRemaining()}
        onExtendSession={handleExtendSession}
        onLogout={handleLogout}
        onDismiss={handleDismissWarning}
      />
    </div>
  )
}

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hipaaMode, setHipaaMode] = useState(true)

  useEffect(() => {
    // Initialize security and storage systems
    const initializeSecurity = async () => {
      try {
        // Temporarily disable secure storage migration for stability
        // await initializeSecureStorage()

        // Initialize theme manager
        ThemeManager.initialize()

        // Initialize cross-device settings synchronization
        await UserSettingsService.initializeSync()

        console.log('Basic security systems and cross-device sync initialized successfully')
      } catch (error) {
        console.error('Failed to initialize security systems:', error)
      }
    }

    initializeSecurity()

    const loadUser = async () => {
      try {
        // Add emergency logout function (press Ctrl+Shift+L to force logout)
        window.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            e.preventDefault()
            console.log('🚪 Emergency logout triggered')
            localStorage.removeItem('currentUser')
            localStorage.removeItem('mfa_verified')
            window.location.reload()
          }
        })

        // Temporarily use localStorage directly for stability
        let storedUser = null
        try {
          const localStorageUser = localStorage.getItem('currentUser')
          if (localStorageUser) {
            storedUser = JSON.parse(localStorageUser)
            console.log('Loaded user from localStorage')
          }
        } catch (fallbackError) {
          console.warn('localStorage failed:', fallbackError)
        }

        if (storedUser) {
          const userData = storedUser

          // Try to load full profile from Supabase
          try {
            const profileResponse = await userProfileService.loadUserProfile(userData.id)

            if (profileResponse.status === 'success' && profileResponse.data) {
              // Use Supabase data as primary source
              const supabaseUser = profileResponse.data

              // Ensure avatar is loaded from avatar storage service with enhanced persistence
              try {
                const avatarUrl = await userProfileService.getUserAvatar(supabaseUser.id)
                if (avatarUrl) {
                  supabaseUser.avatar = avatarUrl
                } else {
                  // Additional fallback: check if avatar exists in currentUser localStorage
                  const storedUser = localStorage.getItem('currentUser')
                  if (storedUser) {
                    const parsedUser = JSON.parse(storedUser)
                    if (parsedUser.avatar) {
                      supabaseUser.avatar = parsedUser.avatar
                    }
                  }
                }
              } catch (avatarError) {
                console.warn('Failed to load user avatar:', avatarError)
                // Final fallback: check localStorage currentUser
                try {
                  const storedUser = localStorage.getItem('currentUser')
                  if (storedUser) {
                    const parsedUser = JSON.parse(storedUser)
                    if (parsedUser.avatar) {
                      supabaseUser.avatar = parsedUser.avatar
                    }
                  }
                } catch (fallbackError) {
                  console.warn('Avatar fallback also failed:', fallbackError)
                }
              }

              setUser(supabaseUser)
              console.log('User loaded from Supabase successfully')

              // Store user data in localStorage for stability
              localStorage.setItem('currentUser', JSON.stringify(supabaseUser))

              // Start session monitoring for security
              await authService.startSessionMonitoring()

              // Load Retell credentials for this user from Supabase
              await retellService.loadCredentialsAsync()
            } else {
              // Fallback to localStorage data, but still try to load avatar with enhanced persistence
              try {
                const avatarUrl = await userProfileService.getUserAvatar(userData.id)
                if (avatarUrl) {
                  userData.avatar = avatarUrl
                  // Update localStorage with avatar data
                  localStorage.setItem('currentUser', JSON.stringify(userData))
                } else if (!userData.avatar) {
                  // If no avatar from service and no existing avatar, preserve any existing localStorage avatar
                  const storedUser = localStorage.getItem('currentUser')
                  if (storedUser) {
                    const parsedUser = JSON.parse(storedUser)
                    if (parsedUser.avatar) {
                      userData.avatar = parsedUser.avatar
                    }
                  }
                }
              } catch (avatarError) {
                console.warn('Failed to load user avatar from fallback:', avatarError)
                // Preserve existing avatar from localStorage if available
                if (!userData.avatar) {
                  try {
                    const storedUser = localStorage.getItem('currentUser')
                    if (storedUser) {
                      const parsedUser = JSON.parse(storedUser)
                      if (parsedUser.avatar) {
                        userData.avatar = parsedUser.avatar
                      }
                    }
                  } catch (preserveError) {
                    console.warn('Failed to preserve avatar from localStorage:', preserveError)
                  }
                }
              }

              setUser(userData)
              console.log('User loaded from localStorage (Supabase fallback)')

              // Load Retell credentials for this user from Supabase
              await retellService.loadCredentialsAsync()
            }
          } catch (supabaseError) {
            console.warn('Failed to load from Supabase, using localStorage:', supabaseError)

            // Still try to load avatar even in catch block with enhanced persistence
            try {
              const avatarUrl = await userProfileService.getUserAvatar(userData.id)
              if (avatarUrl) {
                userData.avatar = avatarUrl
                localStorage.setItem('currentUser', JSON.stringify(userData))
              } else if (!userData.avatar) {
                // Preserve any existing avatar from localStorage
                const storedUser = localStorage.getItem('currentUser')
                if (storedUser) {
                  const parsedUser = JSON.parse(storedUser)
                  if (parsedUser.avatar) {
                    userData.avatar = parsedUser.avatar
                  }
                }
              }
            } catch (avatarError) {
              console.warn('Failed to load user avatar in catch block:', avatarError)
              // Final fallback: preserve avatar from localStorage
              if (!userData.avatar) {
                try {
                  const storedUser = localStorage.getItem('currentUser')
                  if (storedUser) {
                    const parsedUser = JSON.parse(storedUser)
                    if (parsedUser.avatar) {
                      userData.avatar = parsedUser.avatar
                    }
                  }
                } catch (preserveError) {
                  console.warn('Failed to preserve avatar in catch block:', preserveError)
                }
              }
            }

            setUser(userData)

            // Load Retell credentials for this user
            retellService.loadCredentials()
          }

          // Check if MFA is required - use MFA service for accurate check
          const checkMFARequirement = async () => {
            try {
              const hasMFAEnabled = await mfaService.hasMFAEnabled(userData.id)
              const currentSession = mfaService.getCurrentSession(userData.id)

              console.log('MFA Check: Status evaluated')

              // MFA is required if:
              // 1. User has MFA enabled AND
              // 2. No valid current session exists
              if (hasMFAEnabled && !currentSession) {
                console.log('🔒 MFA verification required')
                setMfaRequired(true)
              } else if (hasMFAEnabled && currentSession) {
                console.log('✅ Valid MFA session found')
                setMfaRequired(false)
              } else {
                console.log('ℹ️ MFA not enabled for current user')
                setMfaRequired(false)
              }
            } catch (error) {
              console.error('Error checking MFA requirement:', error)
              // Fallback to simple check if service fails
              if (userData.mfa_enabled && !localStorage.getItem('mfa_verified')) {
                setMfaRequired(true)
              }
            }
          }

          checkMFARequirement()

          // Log authentication event for HIPAA audit
          try {
            await auditLogger.logAuthenticationEvent(
              AuditAction.LOGIN,
              userData.id,
              AuditOutcome.SUCCESS
            )
          } catch (auditError) {
            console.error('Failed to log authentication event:', auditError)
          }
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Function to refresh user data from Supabase (with localStorage fallback)
    const refreshUserData = async () => {
      try {
        const storedUser = localStorage.getItem('currentUser')
        if (storedUser) {
          const userData = JSON.parse(storedUser)

          // Try to refresh from Supabase first
          try {
            const profileResponse = await userProfileService.loadUserProfile(userData.id)

            if (profileResponse.status === 'success' && profileResponse.data) {
              const supabaseUser = profileResponse.data

              // Ensure avatar is loaded from avatar storage service with enhanced persistence
              try {
                const avatarUrl = await userProfileService.getUserAvatar(supabaseUser.id)
                if (avatarUrl) {
                  supabaseUser.avatar = avatarUrl
                } else {
                  // Preserve avatar from current user if available
                  const currentUserData = localStorage.getItem('currentUser')
                  if (currentUserData) {
                    const parsedUser = JSON.parse(currentUserData)
                    if (parsedUser.avatar) {
                      supabaseUser.avatar = parsedUser.avatar
                    }
                  }
                }
              } catch (avatarError) {
                console.warn('Failed to load user avatar during refresh:', avatarError)
                // Preserve existing avatar from localStorage
                try {
                  const currentUserData = localStorage.getItem('currentUser')
                  if (currentUserData) {
                    const parsedUser = JSON.parse(currentUserData)
                    if (parsedUser.avatar) {
                      supabaseUser.avatar = parsedUser.avatar
                    }
                  }
                } catch (preserveError) {
                  console.warn('Failed to preserve avatar during refresh:', preserveError)
                }
              }

              setUser(supabaseUser)
              localStorage.setItem('currentUser', JSON.stringify(supabaseUser))
              console.log('User data refreshed from Supabase successfully')
            } else {
              // Fallback to localStorage, but still try to load avatar with persistence
              try {
                const avatarUrl = await userProfileService.getUserAvatar(userData.id)
                if (avatarUrl) {
                  userData.avatar = avatarUrl
                  localStorage.setItem('currentUser', JSON.stringify(userData))
                } else if (!userData.avatar) {
                  // Preserve existing avatar if no new one found
                  const currentUserData = localStorage.getItem('currentUser')
                  if (currentUserData) {
                    const parsedUser = JSON.parse(currentUserData)
                    if (parsedUser.avatar) {
                      userData.avatar = parsedUser.avatar
                    }
                  }
                }
              } catch (avatarError) {
                console.warn('Failed to load user avatar during refresh fallback:', avatarError)
                // Preserve avatar in fallback case
                if (!userData.avatar) {
                  try {
                    const currentUserData = localStorage.getItem('currentUser')
                    if (currentUserData) {
                      const parsedUser = JSON.parse(currentUserData)
                      if (parsedUser.avatar) {
                        userData.avatar = parsedUser.avatar
                      }
                    }
                  } catch (preserveError) {
                    console.warn('Failed to preserve avatar during refresh fallback:', preserveError)
                  }
                }
              }

              setUser(userData)
              console.log('User data refreshed from localStorage')
            }
          } catch (supabaseError) {
            console.warn('Failed to refresh from Supabase, using localStorage:', supabaseError)

            // Still try to load avatar even in catch block during refresh with persistence
            try {
              const avatarUrl = await userProfileService.getUserAvatar(userData.id)
              if (avatarUrl) {
                userData.avatar = avatarUrl
                localStorage.setItem('currentUser', JSON.stringify(userData))
              } else if (!userData.avatar) {
                // Preserve existing avatar even in error case
                const currentUserData = localStorage.getItem('currentUser')
                if (currentUserData) {
                  const parsedUser = JSON.parse(currentUserData)
                  if (parsedUser.avatar) {
                    userData.avatar = parsedUser.avatar
                  }
                }
              }
            } catch (avatarError) {
              console.warn('Failed to load user avatar in refresh catch block:', avatarError)
              // Final preservation attempt in error case
              if (!userData.avatar) {
                try {
                  const currentUserData = localStorage.getItem('currentUser')
                  if (currentUserData) {
                    const parsedUser = JSON.parse(currentUserData)
                    if (parsedUser.avatar) {
                      userData.avatar = parsedUser.avatar
                    }
                  }
                } catch (preserveError) {
                  console.warn('Failed to preserve avatar in refresh catch block:', preserveError)
                }
              }
            }

            setUser(userData)
          }
        }
      } catch (error) {
        console.error('Error refreshing user data:', error)
      }
    }

    // Listen for localStorage changes (for cross-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentUser') {
        refreshUserData()
      }
    }

    // Listen for custom events (for same-tab updates)
    const handleUserUpdate = () => {
      refreshUserData()
    }

    // Listen for user profile updates specifically
    const handleUserProfileUpdate = (e: CustomEvent) => {
      const updatedUserData = e.detail
      if (updatedUserData && updatedUserData.id === user?.id) {
        setUser(updatedUserData)
        console.log('App: User profile updated from event')
      }
    }

    // Listen for theme changes
    const handleThemeChange = (e: CustomEvent) => {
      console.log('Theme changed:', e.detail.theme)
      ThemeManager.initialize()
    }

    loadUser()

    // Add event listeners
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('userDataUpdated', handleUserUpdate)
    window.addEventListener('userProfileUpdated', handleUserProfileUpdate as EventListener)
    window.addEventListener('themeChanged', handleThemeChange as EventListener)

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('userDataUpdated', handleUserUpdate)
      window.removeEventListener('userProfileUpdated', handleUserProfileUpdate as EventListener)
      window.removeEventListener('themeChanged', handleThemeChange as EventListener)
    }
  }, [])

  const handleMFASuccess = () => {
    console.log('✅ MFA verification successful, granting full access')
    setMfaRequired(false)
    // Keep the old localStorage for backward compatibility
    localStorage.setItem('mfa_verified', 'true')
  }

  const handleLogout = () => {
    console.log('🚪 Logging out user and clearing MFA sessions')

    // Clear MFA sessions for the user
    if (user?.id) {
      try {
        // Invalidate all sessions for this user
        const currentSession = mfaService.getCurrentSession(user.id)
        if (currentSession) {
          mfaService.invalidateSession(currentSession.sessionToken)
        }
      } catch (error) {
        console.error('Error clearing MFA sessions on logout:', error)
      }
    }

    localStorage.removeItem('currentUser')
    localStorage.removeItem('mfa_verified')
    setUser(null)
    setMfaRequired(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShieldCheckIcon className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 dark:text-gray-300">Loading CareXPS Healthcare CRM...</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Initializing HIPAA-compliant environment</p>
          <button
            onClick={() => {
              localStorage.removeItem('currentUser')
              localStorage.removeItem('mfa_verified')
              window.location.reload()
            }}
            className="mt-4 px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Force Logout & Show Login
          </button>
          <p className="text-xs text-gray-400 mt-2">Press Ctrl+Shift+L for emergency logout</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={() => window.location.reload()} />
  }

  return (
    <Router>
      <AppContent
        user={user}
        mfaRequired={mfaRequired}
        setMfaRequired={setMfaRequired}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        hipaaMode={hipaaMode}
        handleMFASuccess={handleMFASuccess}
        handleLogout={handleLogout}
      />
    </Router>
  )
}

export default App