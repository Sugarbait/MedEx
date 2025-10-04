import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './config/supabase'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './services/auditLogger'
import { userProfileService } from './services/userProfileService'
import { retellService } from './services/retellService'
import { AuthProvider } from './contexts/AuthContext'
import { SupabaseProvider } from './contexts/SupabaseContext'

// Import SMS cost test for validation
import './test/smsCostCalculationTest'
// MFA cross-device security test removed (now using TOTP)
import { ThemeManager } from './utils/themeManager'
// Import role correction utility
import { correctAndStoreUserRole, checkAndFixStoredUser } from './utils/correctSuperUserRoles'
// Import user role persistence fixer
import './utils/fixUserRolePersistence'
import { initializeSecureStorage } from './services/storageSecurityMigration'
// Import bulletproof API key test utility
import './utils/bulletproofApiKeyTest'
// Import final user cleanup utility
import './utils/finalUserCleanup'
// Import automatic user fix to prevent "User User" profiles
import './utils/autoUserFix'
// Import hard-coded Super User enforcement utility
import './utils/enforceSuperUser'
import { secureUserDataService } from './services/secureUserDataService'
import { authService } from './services/authService'
// Removed old TOTP service - using fresh MFA service
import { UserSettingsService } from './services/userSettingsServiceEnhanced'
// Removed old TOTP hook - using fresh MFA service
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
// Removed old TOTP protected route - using fresh MFA components
import { AuditLogger } from './components/security/AuditLogger'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import { SessionTimeoutWarning } from './components/common/SessionTimeoutWarning'
import { ToastManager } from './components/common/ToastManager'
import { SecurityAlerts } from './components/security/SecurityAlerts'
import { retellMonitoringService } from './services/retellMonitoringService'

// Pages
import { DashboardPage } from './pages/DashboardPage'
import { CallsPage } from './pages/CallsPage'
import { SMSPage } from './pages/SMSPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { MandatoryMfaLogin } from './components/auth/MandatoryMfaLogin'
import { MfaProtectedRoute } from './components/auth/MfaProtectedRoute'

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

// Component to handle SPA redirect from 404.html
const SPARedirectHandler: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    // Check if there's a stored redirect path from 404.html
    const storedPath = sessionStorage.getItem('spa-redirect-path')
    if (storedPath && storedPath !== '/') {
      console.log('🔄 SPA redirect detected, navigating to:', storedPath)
      sessionStorage.removeItem('spa-redirect-path')

      // Use setTimeout to ensure React Router is ready
      setTimeout(() => {
        navigate(storedPath, { replace: true })
      }, 100)
    }
  }, [navigate])

  return null
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

  // Setup bulletproof API key monitoring for navigation
  useEffect(() => {
    if (!user?.id) return

    // Monitor for API configuration changes
    const handleApiSettingsUpdate = () => {
      console.log('🔄 App - API settings updated, refreshing service')
      setTimeout(async () => {
        try {
          await retellService.ensureCredentialsLoaded()
        } catch (error) {
          console.error('Error refreshing API credentials:', error)
        }
      }, 100)
    }

    // Listen for various API update events
    window.addEventListener('apiSettingsUpdated', handleApiSettingsUpdate)
    window.addEventListener('userSettingsUpdated', handleApiSettingsUpdate)

    return () => {
      window.removeEventListener('apiSettingsUpdated', handleApiSettingsUpdate)
      window.removeEventListener('userSettingsUpdated', handleApiSettingsUpdate)
    }
  }, [user?.id])

  // Ensure theme persistence and bulletproof API key loading on navigation
  useEffect(() => {
    ThemeManager.initialize()

    // BULLETPROOF FIX: Ensure API keys persist across ALL navigation
    if (user?.id) {
      console.log('🔄 Navigation detected - ensuring bulletproof API key persistence')

      // Use the new bulletproof loading system
      const ensureApiKeys = async () => {
        try {
          // Ensure credentials are loaded with fallback mechanisms
          await retellService.ensureCredentialsLoaded()

          // Verify configuration is successful
          if (retellService.isConfigured()) {
            console.log('✅ API keys confirmed loaded for navigation to:', location.pathname)

            // Dispatch comprehensive API ready event
            window.dispatchEvent(new CustomEvent('apiConfigurationReady', {
              detail: {
                apiKey: true,
                callAgentId: true,
                smsAgentId: true,
                source: 'bulletproof_navigation',
                pathname: location.pathname,
                timestamp: Date.now()
              }
            }))
          } else {
            console.warn('⚠️ API keys could not be loaded during navigation')
          }
        } catch (error) {
          console.error('❌ Error ensuring API keys during navigation:', error)
        }
      }

      // Execute with small delay to ensure page stability
      const timeoutId = setTimeout(ensureApiKeys, 50)

      // Cleanup on unmount or dependency change
      return () => clearTimeout(timeoutId)
    }
  }, [location.pathname, user?.id])

  // Get session timeout from user settings (default 15 minutes) - make it reactive
  const [sessionTimeout, setSessionTimeout] = useState(() => {
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
  })

  // Listen for settings updates to update session timeout
  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const savedSettings = localStorage.getItem(`settings_${user?.id}`)
        if (savedSettings) {
          const settings = JSON.parse(savedSettings)
          const newTimeout = (settings.sessionTimeout || 15) * 60 * 1000
          if (newTimeout !== sessionTimeout) {
            console.log('🔄 Session timeout updated:', newTimeout / 60000, 'minutes')
            setSessionTimeout(newTimeout)
          }
        }
      } catch (error) {
        console.error('Failed to update session timeout setting:', error)
      }
    }

    // Listen for settings changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `settings_${user?.id}` && e.newValue) {
        handleSettingsUpdate()
      }
    }

    // Listen for custom events from SettingsPage
    const handleCustomSettingsUpdate = (event: any) => {
      console.log('🔄 App.tsx: Received userSettingsUpdated event:', event.detail)
      setTimeout(handleSettingsUpdate, 150) // Small delay to ensure localStorage is updated
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('userSettingsUpdated', handleCustomSettingsUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('userSettingsUpdated', handleCustomSettingsUpdate)
    }
  }, [user?.id, sessionTimeout])

  const WARNING_TIME = 2 * 60 * 1000 // Show warning 2 minutes before timeout

  const { resetTimeout, getTimeRemaining, getTimeRemainingFormatted } = useSessionTimeout({
    timeout: sessionTimeout,
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

  // Fresh MFA authentication will be handled by individual pages
  console.log('🔒 SECURITY: Fresh MFA protection available')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Security Alerts Component */}
      <SecurityAlerts />

      {/* HIPAA Compliance Banner - Hidden on mobile */}
      {hipaaMode && (
        <div className="hidden lg:block fixed top-0 left-0 right-0 bg-blue-600 text-white px-4 py-2 text-sm z-50">
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

      <div className={`flex ${hipaaMode ? 'lg:pt-10' : ''}`}>
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

          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={<DashboardPage user={user} />}
              />

              <Route
                path="/calls"
                element={
                  <MfaProtectedRoute user={user} requiredForPages={['calls']}>
                    <CallsPage user={user} />
                  </MfaProtectedRoute>
                }
              />
              <Route
                path="/sms"
                element={
                  <MfaProtectedRoute user={user} requiredForPages={['sms']}>
                    <SMSPage user={user} />
                  </MfaProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={<SettingsPage user={user} />}
              />
              <Route
                path="/privacy-policy"
                element={<PrivacyPolicyPage />}
              />
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

      {/* Toast Notifications */}
      <ToastManager userId={user?.id} />
    </div>
  )
}

const App: React.FC = () => {
  // Removed isLoading state - main.tsx handles initial loading
  const [user, setUser] = useState<any>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [pendingMfaUser, setPendingMfaUser] = useState<any>(null) // User awaiting MFA verification
  const [isTransitioningFromMfa, setIsTransitioningFromMfa] = useState(false) // Prevents dashboard flash during MFA transition
  const [mfaCheckInProgress, setMfaCheckInProgress] = useState(false) // ANTI-FLASH: Prevents dashboard rendering during MFA check
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Start with sidebar closed on mobile devices
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024 // lg breakpoint
    }
    return true
  })
  const [hipaaMode, setHipaaMode] = useState(true)

  // Handle window resize for responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024
      // Only update if transitioning between mobile and desktop
      setSidebarOpen(current => {
        if ((isDesktop && !current) || (!isDesktop && current && window.innerWidth < 768)) {
          return isDesktop
        }
        return current
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ANTI-FLASH FIX: Clear MFA check state when pending MFA user is set
  useEffect(() => {
    if (pendingMfaUser && mfaCheckInProgress) {
      console.log('🔒 ANTI-FLASH: Clearing MFA check state as pending MFA user is set')
      setMfaCheckInProgress(false)
    }
  }, [pendingMfaUser, mfaCheckInProgress])

  // Initialize bulletproof API key system on app start
  useEffect(() => {
    const initializeBulletproofApi = async () => {
      try {
        console.log('🔧 App - Initializing bulletproof API system...')
        // PRODUCTION MODE: Enable Retell AI monitoring
        console.log('🚀 Production Mode - Initializing Retell AI services')
        await retellService.ensureCredentialsLoaded()
        retellMonitoringService.start()
      } catch (error) {
        console.error('❌ App - Error initializing bulletproof API system:', error)
      }
    }

    initializeBulletproofApi()

    // Cleanup on unmount
    return () => {
      try {
        retellService.destroy()
        retellMonitoringService.stop()
      } catch (error) {
        console.warn('Error cleaning up retell service:', error)
      }
    }
  }, [])

  useEffect(() => {
    // Initialize security and storage systems
    const initializeSecurity = async () => {
      // Check and fix any stored user roles at startup
      checkAndFixStoredUser()
      try {
        // Temporarily disable secure storage migration for stability
        // await initializeSecureStorage()

        // Initialize theme manager
        ThemeManager.initialize()

        // Initialize cross-device settings synchronization
        UserSettingsService.initialize()

        console.log('Basic security systems and cross-device sync initialized successfully')
      } catch (error) {
        console.error('Failed to initialize security systems:', error)
      }
    }

    // Don't wait for async initialization to complete
    initializeSecurity().catch(error => {
      console.error('Security initialization failed:', error)
    })

    const loadUser = async () => {
      let mfaRequiredDuringLoad = false // Track MFA requirement during this load

      try {
        console.log('🔄 App.tsx: Starting loadUser function...')

        // CRITICAL FIX: Check if user just logged out to prevent auto-login
        const justLoggedOut = localStorage.getItem('justLoggedOut')
        const forceLoginPage = localStorage.getItem('forceLoginPage')
        if (justLoggedOut === 'true' || forceLoginPage === 'true') {
          console.log('🛑 User just logged out - forcing return to login page')

          // CRITICAL FIX: Clear all credential storage immediately
          try {
            // Clear sessionStorage credential backups
            sessionStorage.removeItem('retell_credentials_backup')

            // Clear in-memory credential backups
            if (typeof window !== 'undefined') {
              delete (window as any).__retellCredentialsBackup
            }

            // Clear emergency recovery credentials
            localStorage.removeItem('__emergencyRetellCredentials')
            localStorage.removeItem('__fallbackRetellConfig')

            console.log('🔐 App.tsx: Cleared all credential storage during logout check')
          } catch (error) {
            console.warn('⚠️ App.tsx: Error clearing credentials:', error)
          }

          // DON'T remove justLoggedOut flag yet - let background initialization see it
          localStorage.removeItem('currentUser')
          setUser(null)
          setIsInitializing(false)
          setMfaCheckInProgress(false)

          // PERMANENT LOGOUT FLAGS: Do NOT remove these flags automatically
          // They will only be cleared when user successfully logs in again
          // This prevents MFA bypass after logout regardless of time elapsed
          console.log('🚪 Logout flags set and will persist until next successful login')

          return // Exit early - don't try to load user
        }

        // ADDITIONAL FIX: Check if user should be forced to login page due to logout
        // Even if logout flags expired, check if no current user exists
        const storedUser = localStorage.getItem('currentUser')
        if (!storedUser) {
          console.log('🚪 No stored user found - user must login first')
          setUser(null)
          setIsInitializing(false)
          setMfaCheckInProgress(false)
          return // Exit early - force login
        }

        // CRITICAL ADDITIONAL CHECK: Even with stored user, respect forceLoginPage flag
        const shouldForceLogin = localStorage.getItem('forceLoginPage')
        if (shouldForceLogin === 'true') {
          console.log('🚪 FORCE LOGIN: forceLoginPage flag is set - redirecting to login despite stored user')
          localStorage.removeItem('currentUser') // Clear the stored user to prevent loops
          localStorage.removeItem('freshMfaVerified') // Clear MFA verification
          localStorage.removeItem('mfa_verified') // Clear old MFA verification
          setUser(null)
          setIsInitializing(false)
          setMfaCheckInProgress(false)
          return // Force user to login page
        }

        // ENHANCED: Check browser session tracker for persistent logout state
        try {
          const { browserSessionTracker } = await import('./utils/browserSessionTracker')
          if (browserSessionTracker.shouldForceLogin()) {
            console.log('🚫 BROWSER SESSION: User agent indicates recent logout - forcing login page')
            localStorage.removeItem('currentUser')
            localStorage.removeItem('freshMfaVerified')
            localStorage.removeItem('mfa_verified')
            localStorage.setItem('forceLoginPage', 'true') // Set flag to maintain state
            setUser(null)
            setIsInitializing(false)
            setMfaCheckInProgress(false)
            return // Force user to login page
          }
        } catch (error) {
          console.warn('Failed to check browser session tracker:', error)
        }

        // ANTI-FLASH FIX: Set MFA check in progress to prevent dashboard flash
        setMfaCheckInProgress(true)

        // SECURITY CHECK: Ensure user has actively logged in and wasn't auto-restored
        // Check if this appears to be a fresh browser session without explicit login
        const hasActiveSession = sessionStorage.getItem('appInitialized')
        const userLoginTimestamp = localStorage.getItem('userLoginTimestamp')

        if (!hasActiveSession && !userLoginTimestamp) {
          console.log('🚪 Fresh browser session detected - require explicit login')
          setUser(null)
          setIsInitializing(false)
          setMfaCheckInProgress(false)
          return // Force user to login page
        }

        // Use localStorage directly for stability
        let fallbackUser = null
        try {
          const localStorageUser = localStorage.getItem('currentUser')
          if (localStorageUser) {
            fallbackUser = JSON.parse(localStorageUser)
            console.log('Loaded user from localStorage')

            // 🔒 CRITICAL SECURITY: Verify user still exists in database
            // This prevents deleted users from accessing via cached localStorage data
            console.log('🔒 SECURITY: Verifying user exists in database before allowing access...')
            const verifyResponse = await userProfileService.getUserByEmail(fallbackUser.email, false)
            if (!verifyResponse.data) {
              console.error('🚫 SECURITY: User no longer exists in database - clearing cache and blocking access')
              localStorage.removeItem('currentUser')
              localStorage.removeItem('pendingMfaUser')
              fallbackUser = null // Block access
            } else {
              console.log('✅ SECURITY: User verified in database')
            }
          }
        } catch (fallbackError) {
          console.warn('localStorage failed:', fallbackError)
        }

        if (fallbackUser) {
          const userData = fallbackUser

          // CRITICAL SECURITY FIX: Check MFA lockout status before any user loading
          // This prevents app-level bypass of MFA lockout
          console.log('🔒 SECURITY: Checking MFA lockout status before user initialization')
          try {
            const { MfaLockoutService } = await import('./services/mfaLockoutService')
            const appLockoutStatus = MfaLockoutService.getLockoutStatus(userData.id, userData.email)

            if (appLockoutStatus.isLocked) {
              const timeRemaining = MfaLockoutService.formatTimeRemaining(appLockoutStatus.remainingTime!)
              console.log('🚫 SECURITY: App-level access blocked due to active MFA lockout for user:', userData.id)

              // Log the blocked app access attempt
              await auditLogger.logAuthenticationEvent(
                AuditAction.LOGIN_FAILURE,
                userData.id,
                AuditOutcome.FAILURE,
                JSON.stringify({
                  operation: 'app_level_lockout_block',
                  userId: userData.id,
                  email: userData.email,
                  timeRemaining,
                  lockoutEnds: appLockoutStatus.lockoutEnds,
                  bypassAttempt: 'app_initialization'
                })
              )

              // Clear all user data and force logout
              localStorage.removeItem('currentUser')
              localStorage.removeItem('freshMfaVerified')
              localStorage.removeItem('mfa_verified')
              setUser(null)
              setIsInitializing(false)
              console.log('🔒 SECURITY: User data cleared due to active MFA lockout')
              return // CRITICAL: Block app initialization during lockout
            } else {
              console.log('✅ SECURITY: No active MFA lockout found during app initialization')
            }
          } catch (lockoutCheckError) {
            console.error('❌ SECURITY: Error checking MFA lockout during app initialization:', lockoutCheckError)
            // Continue with normal flow but log the error
          }

          // CRITICAL: Check if user requires mandatory MFA verification
          console.log('🔐 MANDATORY MFA CHECK: Checking if user requires MFA verification')

          try {
            const FreshMfaService = (await import('./services/freshMfaService')).default

            // SECURITY ENHANCEMENT: Fail-secure MFA checking
            let mfaEnabled = false
            let mfaCheckFailed = false

            try {
              mfaEnabled = await FreshMfaService.isMfaEnabled(userData.id)
              console.log('✅ MFA status check successful:', mfaEnabled)
            } catch (mfaServiceError) {
              console.error('❌ MFA status check failed:', mfaServiceError)
              mfaCheckFailed = true

              // FAIL-SECURE: If we can't determine MFA status, check if user should have MFA
              // Super users and certain profiles should have MFA enforced
              const requiresMfaProfiles = [
                'super-user-456',   // elmfarrell@yahoo.com
                'pierre-user-789',  // pierre@phaetonai.com
                'dynamic-pierre-user' // pierre@phaetonai.com
              ]

              const requiresMfaEmails = ['elmfarrell@yahoo.com', 'pierre@phaetonai.com']

              // If this user should have MFA, enforce it even if check failed
              if (requiresMfaProfiles.includes(userData.id) ||
                  (userData.email && requiresMfaEmails.includes(userData.email.toLowerCase())) ||
                  userData.mfaEnabled === true) {
                console.log('🔐 FAIL-SECURE: User should have MFA - enforcing verification despite check failure')
                mfaEnabled = true
              }
            }

            // SECURITY ENHANCEMENT: Always require MFA verification on fresh app load
            // Clear any existing MFA session to ensure user must verify MFA after each login
            const mfaTimestamp = localStorage.getItem('freshMfaVerified')
            let hasValidMfaSession = false

            // MFA ENFORCEMENT: ALWAYS require MFA on login for MFA-enabled users
            // Use sessionStorage to distinguish login vs page refresh
            const isPageRefresh = sessionStorage.getItem('appInitialized')

            if (isPageRefresh) {
              // Page refresh - check if MFA session is still valid
              if (mfaTimestamp) {
                const sessionAge = Date.now() - parseInt(mfaTimestamp)
                const MAX_MFA_SESSION_AGE = 30 * 60 * 1000 // 30 minutes
                hasValidMfaSession = sessionAge < MAX_MFA_SESSION_AGE

                console.log('🔄 PAGE REFRESH - MFA session check:', {
                  sessionAgeMinutes: Math.round(sessionAge / 60000),
                  isValid: hasValidMfaSession
                })
              } else {
                hasValidMfaSession = false
                console.log('🔄 PAGE REFRESH - No MFA session found')
              }
            } else {
              // Fresh login - ALWAYS require MFA for MFA-enabled users
              hasValidMfaSession = false
              sessionStorage.setItem('appInitialized', 'true')
              console.log('🚪 FRESH LOGIN - MFA verification required (no skips)')
            }

            console.log('🔐 App MFA Status Check:', {
              userId: userData.id,
              email: userData.email,
              mfaEnabled,
              mfaCheckFailed,
              hasValidMfaSession,
              requiresVerification: mfaEnabled && !hasValidMfaSession
            })

            // MFA ENFORCEMENT: Always enforce MFA when enabled (production behavior)
            // Note: This ensures consistent security behavior across all environments
            if (mfaEnabled && !hasValidMfaSession) {
              console.log('🔐 MANDATORY MFA required - showing MFA verification screen')

              // CRITICAL LOGOUT CHECK: Don't show MFA if user just logged out
              const justLoggedOut = localStorage.getItem('justLoggedOut')
              const forceLoginPage = localStorage.getItem('forceLoginPage')
              if (justLoggedOut === 'true' || forceLoginPage === 'true') {
                console.log('🛑 User just logged out - bypassing MFA detection, forcing login page')
                return // Exit early - don't set pending MFA user
              }

              mfaRequiredDuringLoad = true // Mark MFA as required for this load

              // ANTI-FLASH FIX: Set pending user in state update function to ensure synchronization
              setPendingMfaUser({
                ...userData,
                mfaCheckFailed // Pass this info to help with debugging
              })

              // CRITICAL ANTI-FLASH: Keep mfaCheckInProgress true until MFA screen renders
              // This prevents dashboard from flashing before MFA verification appears
              console.log('🔒 ANTI-FLASH: Keeping MFA check in progress to prevent dashboard flash')

              return // Exit early - don't load full user data until MFA is verified
            }

            // If MFA is not required or user has valid session, proceed normally
            console.log('✅ No MFA verification required - proceeding with normal login flow')

          } catch (mfaCheckError) {
            console.error('❌ Critical error in MFA checking system:', mfaCheckError)
            // ULTIMATE FAIL-SAFE: If entire MFA system fails, still enforce for known MFA users
            if (userData.mfaEnabled || userData.email === 'elmfarrell@yahoo.com' || userData.email === 'pierre@phaetonai.com') {
              console.log('🚨 CRITICAL FAIL-SAFE: Enforcing MFA due to system failure for known MFA user')

              // CRITICAL LOGOUT CHECK: Don't show MFA if user just logged out
              const justLoggedOut = localStorage.getItem('justLoggedOut')
              const forceLoginPage = localStorage.getItem('forceLoginPage')
              if (justLoggedOut === 'true' || forceLoginPage === 'true') {
                console.log('🛑 User just logged out - bypassing fail-safe MFA detection, forcing login page')
                return // Exit early - don't set pending MFA user
              }

              mfaRequiredDuringLoad = true // Mark MFA as required for this load

              // ANTI-FLASH FIX: Set pending user with proper state management
              setPendingMfaUser(userData)

              // CRITICAL ANTI-FLASH: Keep mfaCheckInProgress true for fail-safe MFA enforcement
              console.log('🔒 FAIL-SAFE ANTI-FLASH: Keeping MFA check in progress for fail-safe enforcement')

              return
            }
            console.log('⚠️ MFA system failed but user not flagged for MFA - proceeding without verification')
          }

          // Force sync settings from Supabase for cross-device access
          console.log('🔄 Syncing cross-device data on app initialization...')
          try {
            // Import the services
            const { userSettingsService } = await import('./services/userSettingsService')

            // Load user settings from cloud
            const settingsSynced = await userSettingsService.getUserSettings(userData.id)
            console.log(`✅ Settings loaded on init: ${settingsSynced ? 'successful' : 'using defaults'}`)

            // Reload Retell credentials after settings sync
            if (settingsSynced && settingsSynced.retell_config) {
              const { retellService } = await import('./services/retellService')
              retellService.updateCredentials(
                settingsSynced.retell_config.api_key,
                settingsSynced.retell_config.call_agent_id,
                settingsSynced.retell_config.sms_agent_id
              )
              // Ensure the bulletproof system has the latest credentials
              await retellService.ensureCredentialsLoaded()
              console.log('✅ Retell credentials updated and ensured loaded')
            }
          } catch (syncError) {
            console.warn('⚠️ Cross-device sync on init failed, using local data:', syncError)
            // Continue with initialization even if sync fails - will use local/default data
          }

          // Try to load full profile from Supabase with timeout
          try {
            // Add timeout to prevent hanging
            const profileResponse = await Promise.race([
              userProfileService.loadUserProfile(userData.id),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Supabase timeout')), 5000)
              )
            ]) as any

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

              const correctedUser = correctAndStoreUserRole(supabaseUser)

              // CRITICAL FIX: Only set user if MFA is not required to prevent dashboard flash
              if (!pendingMfaUser) {
                setUser(correctedUser)
                console.log('User loaded from Supabase successfully')
              } else {
                console.log('🔐 MFA required - user not set to prevent dashboard flash')
              }

              // Store user data in localStorage for stability (correctedUser is already stored by correctAndStoreUserRole)

              // Start session monitoring for security
              await authService.startSessionMonitoring()

              // Load Retell credentials using bulletproof system
              await retellService.ensureCredentialsLoaded()
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

              const correctedUser = correctAndStoreUserRole(userData)

              // CRITICAL FIX: Only set user if MFA is not required to prevent dashboard flash
              if (!pendingMfaUser) {
                setUser(correctedUser)
                console.log('User loaded from localStorage (Supabase fallback)')
              } else {
                console.log('🔐 MFA required - user not set to prevent dashboard flash (fallback path)')
              }

              // Load Retell credentials using bulletproof system
              await retellService.ensureCredentialsLoaded()
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

            // CRITICAL FIX: Only set user if MFA is not required to prevent dashboard flash
            if (!pendingMfaUser) {
              setUser(userData)
              console.log('✅ User set after fallback avatar processing')
            } else {
              console.log('🔐 MFA required - user not set to prevent dashboard flash (catch block)')
            }

            // Load Retell credentials using bulletproof system
            await retellService.ensureCredentialsLoaded().catch(err => {
              console.warn('Retell credentials loading failed:', err)
              retellService.loadCredentials() // Fallback to sync method
            })
          }

          // 🔒 FRESH MFA PROTECTION 🔒
          // Fresh MFA authentication will be handled by individual components
          // MFA requirement will be enforced by page-level protection
          // ⚠️ CRITICAL: Do not globally disable MFA requirement

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
        console.error('❌ App.tsx: Error loading user:', error)
        // Clear any potentially corrupted data
        localStorage.removeItem('currentUser')
        setUser(null)
      } finally {
        // ANTI-FLASH FIX: Manage both initialization and MFA check states
        if (!mfaRequiredDuringLoad) {
          console.log('✅ App.tsx: loadUser completed, setting initializing to false and clearing MFA check')
          setIsInitializing(false)
          setMfaCheckInProgress(false)
        } else {
          console.log('🔐 MFA required - keeping initializing state but allowing MFA check to complete')
          // Clear MFA check in progress to allow MFA screen to render
          // But keep isInitializing true to prevent dashboard flash
          setMfaCheckInProgress(false)
        }
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

              // CRITICAL FIX: Validate user data before setting
              if (!supabaseUser.id || supabaseUser.id === 'undefined') {
                console.error('🚨 CRITICAL: Supabase user has invalid ID during refresh, aborting user set:', supabaseUser)
                return
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
      // Handle different event data structures
      const userId = updatedUserData?.userId || updatedUserData?.id
      const profileData = updatedUserData?.profileData || updatedUserData

      if (userId && userId === user?.id) {
        // CRITICAL FIX: Validate user data before setting to prevent ID corruption
        if (!userId || userId === 'undefined') {
          console.error('🚨 CRITICAL: Received user update with invalid ID, ignoring:', updatedUserData)
          return
        }

        // Preserve critical user fields to prevent corruption
        const safeUserData = {
          ...user, // Start with current user data to preserve all fields
          ...profileData, // Apply profile updates
          // Force preserve critical fields - never allow these to be corrupted
          id: user?.id || userId,
          email: user?.email,
          name: user?.name
        }

        setUser(safeUserData)
        console.log('✅ App: User profile updated safely from event:', {
          id: safeUserData.id,
          email: safeUserData.email,
          name: safeUserData.name
        })
      }
    }

    // Listen for theme changes
    const handleThemeChange = (e: CustomEvent) => {
      console.log('Theme changed:', e.detail.theme)
      ThemeManager.initialize()
    }

    // Execute loadUser with timeout protection
    Promise.race([
      loadUser(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Loading timeout')), 10000)
      )
    ]).catch(error => {
      console.warn('⚠️ App.tsx: LoadUser timed out or failed:', error.message)
      // Removed setIsLoading - main.tsx handles loading
    })

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

  /**
   * Handle successful mandatory MFA verification at login
   */
  const handleMandatoryMfaSuccess = async () => {
    try {
      console.log('✅ MANDATORY MFA verification successful - completing login')

      if (pendingMfaUser) {
        // Store MFA verification timestamp
        const mfaTimestamp = Date.now().toString()
        localStorage.setItem('freshMfaVerified', mfaTimestamp)

        // Load the full user profile and complete authentication
        const userData = pendingMfaUser

        // Try to load full profile from Supabase
        try {
          const profileResponse = await userProfileService.loadUserProfile(userData.id)

          if (profileResponse.status === 'success' && profileResponse.data) {
            const supabaseUser = profileResponse.data
            // Mark as MFA verified (Note: Add to UserProfileData type if needed)

            // Load avatar
            try {
              const avatarUrl = await userProfileService.getUserAvatar(supabaseUser.id)
              if (avatarUrl) {
                supabaseUser.avatar = avatarUrl
              }
            } catch (avatarError) {
              console.warn('Failed to load user avatar after MFA:', avatarError)
            }

            // ANTI-FLASH FIX: Set user state after a brief delay to ensure smooth transition
            setTimeout(() => {
              // CRITICAL FIX: Validate user data before setting
              if (!supabaseUser.id || supabaseUser.id === 'undefined') {
                console.error('🚨 CRITICAL: Supabase user has invalid ID, aborting user set:', supabaseUser)
                return
              }
              setUser(supabaseUser)
              console.log('✅ User loaded from Supabase after mandatory MFA verification')
            }, 100)
            localStorage.setItem('currentUser', JSON.stringify(supabaseUser))

          } else {
            // Fallback to pending user data
            userData.mfaVerified = true
            // ANTI-FLASH FIX: Set user state after a brief delay to ensure smooth transition
            setTimeout(() => {
              setUser(userData)
              console.log('✅ User loaded from localStorage after mandatory MFA verification')
            }, 100)
            localStorage.setItem('currentUser', JSON.stringify(userData))
          }

          // Start session monitoring and load credentials
          await authService.startSessionMonitoring()
          await retellService.loadCredentialsAsync()

        } catch (profileError) {
          console.warn('Failed to load full profile after MFA, using pending user data:', profileError)
          userData.mfaVerified = true
          // ANTI-FLASH FIX: Set user state after a brief delay to ensure smooth transition
          setTimeout(() => {
            setUser(userData)
          }, 100)
          localStorage.setItem('currentUser', JSON.stringify(userData))
        }

        // ANTI-FLASH FIX: Start transition state to prevent dashboard flash
        console.log('🔄 Starting MFA transition state to prevent dashboard flash')
        setIsTransitioningFromMfa(true)

        // Clear pending MFA user immediately (this stops the MFA screen)
        setPendingMfaUser(null)

        // CRITICAL FIX: Stop initializing state after successful MFA verification
        setIsInitializing(false)

        // ANTI-FLASH FIX: Clear all anti-flash states
        setMfaCheckInProgress(false)

        // Clear transition state after user state is set (150ms delay to ensure state is applied)
        setTimeout(() => {
          setIsTransitioningFromMfa(false)
          console.log('✅ MFA transition completed - dashboard ready to render')
        }, 150)

        // Log successful authentication
        const { auditLogger, AuditAction, AuditOutcome } = await import('./services/auditLogger')
        await auditLogger.logAuthenticationEvent(
          AuditAction.LOGIN,
          userData.id,
          AuditOutcome.SUCCESS,
          JSON.stringify({ mfaVerified: true, loginMethod: 'mandatory_mfa' })
        )

        console.log('🎉 MANDATORY MFA login flow completed successfully')

        // FIX: Remove the window.location.href redirect to prevent double loading
        // React will naturally navigate to dashboard once setUser() clears pendingMfaUser
        // The routing in App.tsx automatically shows AppContent when user is set
      }

    } catch (error) {
      console.error('❌ Error completing mandatory MFA verification:', error)
      // Reset to login state on error
      handleMandatoryMfaCancel()
    }
  }

  /**
   * Handle mandatory MFA verification cancellation
   */
  const handleMandatoryMfaCancel = () => {
    console.log('❌ MANDATORY MFA verification cancelled - returning to login')

    // Clear all authentication data
    localStorage.removeItem('currentUser')
    localStorage.removeItem('freshMfaVerified')
    localStorage.removeItem('mfa_verified')

    // Reset state
    setPendingMfaUser(null)
    setUser(null)
    setMfaRequired(false)
    setIsTransitioningFromMfa(false) // Clear transition state

    // ANTI-FLASH FIX: Clear all anti-flash states when MFA is cancelled
    setMfaCheckInProgress(false)

    // CRITICAL FIX: Stop initializing state when MFA is cancelled
    setIsInitializing(false)

    console.log('✅ Authentication state cleared after MFA cancellation')
  }

  const handleLogout = async () => {
    console.log('🚪 Logging out user and clearing all authentication data')

    // CRITICAL FIX: Set logout flags FIRST to prevent any MFA detection race conditions
    localStorage.setItem('justLoggedOut', 'true')
    localStorage.setItem('forceLoginPage', 'true')
    localStorage.setItem('justLoggedOutTimestamp', Date.now().toString())
    console.log('🛑 Logout flags set FIRST to prevent MFA detection')

    // CRITICAL: Immediately clear MFA-related states to prevent MFA screen from showing
    setPendingMfaUser(null)
    setMfaRequired(false)
    setMfaCheckInProgress(false)
    setIsTransitioningFromMfa(false)
    setIsInitializing(false)
    console.log('🛑 MFA states cleared immediately during logout')

    try {
      // SECURITY ENHANCEMENT: Comprehensive logout cleanup with avatar preservation
      if (user?.id) {
        console.log('🔒 Clearing user-specific authentication data on logout')

        // CRITICAL: Preserve avatar data before clearing currentUser
        let preservedAvatar = null
        try {
          const currentUserData = localStorage.getItem('currentUser')
          if (currentUserData) {
            const userData = JSON.parse(currentUserData)
            if (userData.avatar) {
              preservedAvatar = userData.avatar
              // Ensure avatar is stored in persistent avatar storage
              localStorage.setItem(`avatar_data_${user.id}`, preservedAvatar)
              console.log('💾 Avatar preserved for next login')
            }
          }
        } catch (avatarError) {
          console.warn('Failed to preserve avatar during logout:', avatarError)
        }

        // Clear MFA sessions
        try {
          // Clear any fresh MFA sessions if needed
          localStorage.removeItem('freshMfaVerified')
          // Clear browser session marker to ensure MFA required on next login
          localStorage.removeItem(`browserSession_${user.id}`)
          console.log('✅ Fresh MFA sessions and browser session markers cleared')
        } catch (mfaError) {
          console.error('Error clearing MFA sessions:', mfaError)
        }

        // CRITICAL FIX: Clear sessionStorage to ensure fresh login detection
        try {
          sessionStorage.removeItem('appInitialized')
          sessionStorage.removeItem('spa-redirect-path')
          console.log('✅ SessionStorage cleared for fresh login detection')
        } catch (sessionError) {
          console.error('Error clearing sessionStorage:', sessionError)
        }

        // Clear user-specific data (but not avatar data)
        localStorage.removeItem(`settings_${user.id}`)
        localStorage.removeItem(`user_settings_${user.id}`)
        // NOTE: We DON'T clear avatar_data_${user.id} or avatar_${user.id} to preserve profile pictures
      } else {
        // Clear all MFA sessions when user ID is not available
        try {
          localStorage.removeItem('freshMfaVerified')
          console.log('✅ Fresh MFA sessions cleared (no user ID)')
        } catch (mfaError) {
          console.error('Error clearing all MFA sessions:', mfaError)
        }

        // CRITICAL FIX: Also clear sessionStorage when no user ID available
        try {
          sessionStorage.removeItem('appInitialized')
          sessionStorage.removeItem('spa-redirect-path')
          console.log('✅ SessionStorage cleared for fresh login detection (no user ID)')
        } catch (sessionError) {
          console.error('Error clearing sessionStorage (no user ID):', sessionError)
        }
      }

      // Clear main authentication data
      localStorage.removeItem('currentUser')
      localStorage.removeItem('mfa_verified')

      // Clear any session timeout warnings (if available)
      // setShowTimeoutWarning && setShowTimeoutWarning(false)

      // Reset application state
      setUser(null)
      setMfaRequired(false)
      setPendingMfaUser(null) // CRITICAL: Clear pending MFA user
      setMfaCheckInProgress(false) // Clear MFA check state

      console.log('✅ Complete logout cleanup performed with avatar preservation')

      // CRITICAL FIX: Set logout flag to prevent auto-login on reload
      localStorage.setItem('justLoggedOut', 'true')

      // CRITICAL: Also clear the currentUser to prevent detection on reload
      localStorage.removeItem('currentUser')

      // COMPREHENSIVE: Clear ALL authentication-related and user-specific localStorage items
      const keysToRemove = Object.keys(localStorage).filter(key =>
        key.startsWith('msal.') || // MSAL tokens
        key.includes('login-hint') || // MSAL login hints
        key.includes('account') || // MSAL accounts
        key.startsWith('settings_') || // User settings (includes API keys)
        key.startsWith('user_') || // User data
        key.startsWith('profile_') || // Profile data
        key.startsWith('browserSession') || // Browser sessions
        key === 'currentUser' || // Current user data
        key === 'freshMfaVerified' || // MFA verification
        key === 'mfa_verified' || // MFA status
        key === 'systemUsers' || // System users list
        key === 'retell_credentials_backup' // Retell credentials backup
      )

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        console.log(`🗑️ Removed localStorage key: ${key}`)
      })

      // Also clear sessionStorage completely
      sessionStorage.clear()
      console.log('🗑️ Cleared all sessionStorage')

      // Force page reload to ensure complete session reset
      // This prevents any lingering state that might cause MFA bypass
      setTimeout(() => {
        console.log('🔄 Performing hard page reload to ensure complete logout')
        window.location.href = window.location.origin
      }, 100) // Small delay to ensure cleanup completes
    } catch (error) {
      console.error('Error during logout cleanup:', error)
      // Still clear basic data even if advanced cleanup fails
      localStorage.removeItem('currentUser')
      localStorage.removeItem('mfa_verified')
      setUser(null)
      setMfaRequired(false)
    }
  }

  // Removed duplicate loading screen - main.tsx handles initial loading

  // Show mandatory MFA verification screen if user is pending MFA
  if (pendingMfaUser) {
    return (
      <MandatoryMfaLogin
        user={pendingMfaUser}
        onMfaVerified={handleMandatoryMfaSuccess}
        onMfaCancel={handleMandatoryMfaCancel}
      />
    )
  }

  // ANTI-FLASH FIX: Show loading state during initialization OR MFA check to prevent dashboard flash
  if (isInitializing || mfaCheckInProgress) {
    const loadingMessage = mfaCheckInProgress
      ? 'Checking security requirements...'
      : 'Loading...'

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{loadingMessage}</p>
          {mfaCheckInProgress && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Verifying authentication requirements...
            </p>
          )}
        </div>
      </div>
    )
  }

  // ANTI-FLASH FIX: Show loading during MFA transition to prevent dashboard flash
  if (isTransitioningFromMfa) {
    console.log('🔄 ANTI-FLASH: Showing transition loading screen to prevent dashboard flash')
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Completing authentication...</p>
        </div>
      </div>
    )
  }


  if (!user) {
    return <LoginPage onLogin={() => {
      console.log('🔄 Login completed - redirecting to dashboard')

      // CRITICAL FIX: Clear logout flags when successful login occurs
      localStorage.removeItem('justLoggedOut')
      localStorage.removeItem('forceLoginPage')
      localStorage.removeItem('justLoggedOutTimestamp')
      console.log('✅ Logout flags cleared after successful login - MFA flow can now proceed')

      // ENHANCED: Clear browser session logout state
      try {
        import('./utils/browserSessionTracker').then(({ browserSessionTracker }) => {
          browserSessionTracker.clearLogoutState()
          console.log('🔓 Browser session logout state cleared after successful login')
        })
      } catch (error) {
        console.warn('Failed to clear browser session logout state:', error)
      }

      // SECURITY FIX: Set login session markers to prevent bypass
      sessionStorage.setItem('appInitialized', 'true')
      localStorage.setItem('userLoginTimestamp', Date.now().toString())
      console.log('🔐 Login session markers set - authenticated session established')

      // In production, redirect to dashboard directly for better UX
      const isProduction = window.location.hostname.includes('azurestaticapps.net') ||
                          window.location.hostname.includes('nexasync.ca')

      if (isProduction) {
        window.location.href = '/dashboard'
      } else {
        // In development, still reload to ensure proper initialization
        window.location.reload()
      }
    }} />
  }

  // Dashboard is ready to render without flash
  console.log('🎯 ANTI-FLASH: Rendering dashboard content - no flash should occur')

  return (
    <SupabaseProvider>
      <AuthProvider>
        <Router>
          <SPARedirectHandler />
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
      </AuthProvider>
    </SupabaseProvider>
  )
}

// Make duplicate profile cleanup function available globally in console
if (typeof window !== 'undefined') {
  import('./services/userManagementService').then(({ UserManagementService }) => {
    (window as any).cleanupDuplicateProfiles = async () => {
      console.log('🧹 Starting duplicate profile cleanup...')
      const result = await UserManagementService.cleanupDuplicateProfiles()
      if (result.status === 'success') {
        console.log(`✅ Cleanup completed: removed ${result.data?.removed} duplicate profiles`)
        console.log('💡 Please refresh the page to see the changes')
        return result
      } else {
        console.error('❌ Cleanup failed:', result.error)
        return result
      }
    }

    // Also expose debug function
    (window as any).debugUserProfiles = () => {
      console.log('🔍 DEBUGGING USER PROFILES - FINDING DUPLICATES')
      console.log('===============================================')

      // Check localStorage systemUsers
      console.log('\n📱 localStorage systemUsers:')
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        try {
          const users = JSON.parse(systemUsers)
          console.log(`Found ${users.length} users in systemUsers:`)
          users.forEach((user: any, index: number) => {
            console.log(`  ${index + 1}. ID: ${user.id}`)
            console.log(`     Name: ${user.name}`)
            console.log(`     Email: ${user.email}`)
            console.log(`     Role: ${user.role}`)
            console.log(`     Has Avatar: ${!!user.avatar}`)
            console.log(`     ---`)
          })

          // Check for duplicates
          console.log('\n🔍 DUPLICATE ANALYSIS:')
          const usersByEmail: { [email: string]: any[] } = {}
          users.forEach((user: any) => {
            const email = user.email
            if (!usersByEmail[email]) {
              usersByEmail[email] = []
            }
            usersByEmail[email].push(user)
          })

          for (const [email, userList] of Object.entries(usersByEmail)) {
            if (userList.length > 1) {
              console.log(`⚠️ DUPLICATE FOUND for ${email}:`)
              userList.forEach((user: any, i: number) => {
                console.log(`  ${i + 1}. ID: ${user.id}, Role: ${user.role}, Name: ${user.name}`)
              })
            }
          }
        } catch (error) {
          console.error('Failed to parse systemUsers:', error)
        }
      } else {
        console.log('No systemUsers found in localStorage')
      }

      // Check currentUser
      console.log('\n👤 localStorage currentUser:')
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser)
          console.log('Current user details:')
          console.log(`  ID: ${user.id}`)
          console.log(`  Name: ${user.name}`)
          console.log(`  Email: ${user.email}`)
          console.log(`  Role: ${user.role}`)
          console.log(`  Has Avatar: ${!!user.avatar}`)
        } catch (error) {
          console.error('Failed to parse currentUser:', error)
        }
      } else {
        console.log('No currentUser found in localStorage')
      }

      console.log('\n✅ Debug complete!')
      console.log('💡 To fix duplicates, run: cleanupDuplicateProfiles()')
    }

    console.log('🔧 User profile management utilities loaded:')
    console.log('  - cleanupDuplicateProfiles() - Remove duplicate User profiles, keep Super User')
    console.log('  - debugUserProfiles() - Analyze user profiles for duplicates')
  }).catch(error => {
    console.warn('Failed to load user management utilities:', error)
  })
}

export default App