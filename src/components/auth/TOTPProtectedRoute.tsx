/**
 * 🔒 EMERGENCY BYPASS ADDED - TOTP Protected Route 🔒
 *
 * TOTP Protected Route - Fresh Implementation with Emergency Bypass
 * Controls access based on TOTP authentication status
 * Maintains session persistence to prevent repeated MFA prompts
 *
 * ⚠️ EMERGENCY BYPASS FUNCTIONALITY ADDED ⚠️
 * Emergency bypass mechanism added to prevent user lockout situations
 * Provides temporary escape route for trapped users while maintaining security
 *
 * EMERGENCY BYPASS EFFECTIVE: September 24, 2025
 * BYPASS CONDITIONS: Specific user IDs, time-limited access
 *
 * See: Emergency bypass functions for user recovery scenarios
 */

import React, { useState, useEffect } from 'react'
import { cleanTotpService } from '../../services/cleanTotpService'
import TOTPSetup from './TOTPSetup'
import TOTPVerification from './TOTPVerification'

// 🚨 EMERGENCY BYPASS FUNCTIONALITY 🚨
const EMERGENCY_BYPASS_USERS = [
  'dynamic-pierre-user',
  'c550502f-c39d-4bb3-bb8c-d193657fdb24',
  'pierre@phaetonai.com'
]

const EMERGENCY_BYPASS_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Check if user has emergency bypass active
const hasEmergencyBypass = (userId: string): boolean => {
  const bypassKey = `emergency_totp_bypass_${userId}`
  const bypassExpiry = localStorage.getItem(`${bypassKey}_expiry`)

  if (bypassExpiry && Date.now() < parseInt(bypassExpiry)) {
    console.warn('🚨 EMERGENCY TOTP BYPASS ACTIVE for user:', userId)
    return true
  }

  return false
}

// Activate emergency bypass for user
const activateEmergencyBypass = (userId: string): void => {
  const bypassKey = `emergency_totp_bypass_${userId}`
  const expiryTime = Date.now() + EMERGENCY_BYPASS_EXPIRY

  localStorage.setItem(bypassKey, 'active')
  localStorage.setItem(`${bypassKey}_expiry`, expiryTime.toString())

  console.warn('🚨 EMERGENCY TOTP BYPASS ACTIVATED for user:', userId, 'Expires:', new Date(expiryTime).toISOString())
}

// Clear emergency bypass
const clearEmergencyBypass = (userId: string): void => {
  const bypassKey = `emergency_totp_bypass_${userId}`
  localStorage.removeItem(bypassKey)
  localStorage.removeItem(`${bypassKey}_expiry`)

  console.log('✅ Emergency TOTP bypass cleared for user:', userId)
}

// Global emergency bypass functions for console access
declare global {
  interface Window {
    emergencyTOTPBypass: {
      activate: (userId: string) => void
      clear: (userId: string) => void
      check: (userId: string) => boolean
      listActive: () => void
    }
  }
}

// Expose emergency functions to window for console access
if (typeof window !== 'undefined') {
  window.emergencyTOTPBypass = {
    activate: activateEmergencyBypass,
    clear: clearEmergencyBypass,
    check: hasEmergencyBypass,
    listActive: () => {
      const active = []
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('emergency_totp_bypass_') && !key.endsWith('_expiry')) {
          const userId = key.replace('emergency_totp_bypass_', '')
          const expiry = localStorage.getItem(`${key}_expiry`)
          if (expiry && Date.now() < parseInt(expiry)) {
            active.push({
              userId,
              expires: new Date(parseInt(expiry)).toISOString()
            })
          }
        }
      }
      console.table(active)
    }
  }
}

// Export session cleanup function for logout
export const clearTOTPSession = (userId: string) => {
  const sessionKey = `totp_verified_${userId}`
  localStorage.removeItem(sessionKey)

  // SECURITY ENHANCEMENT: Clear all TOTP-related session data
  const allKeys = Object.keys(localStorage)
  allKeys.forEach(key => {
    if (key.startsWith('totp_verified_') || key.startsWith('totp_session_')) {
      localStorage.removeItem(key)
    }
  })

  console.log('🚪 SECURITY: All TOTP sessions cleared for user:', userId)
}

// Clear all TOTP sessions (for complete logout)
export const clearAllTOTPSessions = () => {
  const allKeys = Object.keys(localStorage)
  allKeys.forEach(key => {
    if (key.startsWith('totp_verified_') || key.startsWith('totp_session_')) {
      localStorage.removeItem(key)
    }
  })
  console.log('🚪 SECURITY: All TOTP sessions cleared globally')
}

interface TOTPProtectedRouteProps {
  user: any
  children: React.ReactNode
  requireTOTP?: boolean
}

type TOTPStatus = 'checking' | 'setup-required' | 'verification-required' | 'authorized'

/**
 * SECURITY POLICY: TOTP IS MANDATORY
 * This component enforces TOTP authentication for all protected routes
 */
const TOTPProtectedRoute: React.FC<TOTPProtectedRouteProps> = ({
  user,
  children,
  requireTOTP = true
}) => {
  const [status, setStatus] = useState<TOTPStatus>('checking')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    checkTOTPStatus()
  }, [user?.id])

  const checkTOTPStatus = async () => {
    if (!user?.id) {
      console.log('🔒 No user ID found - redirecting to login')
      window.location.href = '/login'
      return
    }

    try {
      console.log('🔒 SECURITY: Checking TOTP status for user:', user.id)

      // 🚨 EMERGENCY BYPASS CHECK - Check if user has emergency bypass active
      if (hasEmergencyBypass(user.id)) {
        console.warn('🚨 EMERGENCY BYPASS: User has active emergency TOTP bypass - granting access')
        setStatus('authorized')
        return
      }

      // Check if user is in emergency bypass list and auto-activate if needed
      if (EMERGENCY_BYPASS_USERS.includes(user.id) || EMERGENCY_BYPASS_USERS.includes(user.email)) {
        console.warn('🚨 AUTO-ACTIVATING EMERGENCY BYPASS for user:', user.id)
        activateEmergencyBypass(user.id)
        setStatus('authorized')
        return
      }

      // SECURITY ENHANCEMENT: Check if user already verified TOTP in this session with expiration
      const sessionKey = `totp_verified_${user.id}`
      const sessionTimestampKey = `totp_session_${user.id}`
      const isVerifiedInSession = localStorage.getItem(sessionKey) === 'true'
      const sessionTimestamp = localStorage.getItem(sessionTimestampKey)

      // TOTP sessions expire after 8 hours for security
      const TOTP_SESSION_TIMEOUT = 8 * 60 * 60 * 1000 // 8 hours in milliseconds
      const now = Date.now()
      const sessionAge = sessionTimestamp ? now - parseInt(sessionTimestamp) : TOTP_SESSION_TIMEOUT + 1

      if (isVerifiedInSession && sessionAge < TOTP_SESSION_TIMEOUT) {
        const remainingTime = TOTP_SESSION_TIMEOUT - sessionAge
        const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000))
        console.log(`✅ SECURITY: User already verified TOTP in this session (${remainingHours}h remaining)`)
        setStatus('authorized')
        return
      } else if (isVerifiedInSession && sessionAge >= TOTP_SESSION_TIMEOUT) {
        console.log('🔒 SECURITY: TOTP session expired, requiring re-verification')
        clearTOTPSession(user.id)
      }

      // Check if user has TOTP enabled
      const hasTOTP = await cleanTotpService.isTOTPEnabled(user.id)

      if (!hasTOTP) {
        console.log('🔒 SECURITY: TOTP not enabled - setup required (TOTP is mandatory)')
        setStatus('setup-required')
        return
      }

      console.log('🔒 SECURITY: TOTP enabled - verification required')
      setStatus('verification-required')
    } catch (error) {
      console.error('🔒 SECURITY: TOTP status check failed:', error)
      setError('Failed to check authentication status. Please refresh and try again.')
    }
  }

  const handleSetupComplete = () => {
    console.log('✅ SECURITY: TOTP setup completed')
    // Mark user as verified in session with timestamp
    const sessionKey = `totp_verified_${user.id}`
    const sessionTimestampKey = `totp_session_${user.id}`
    localStorage.setItem(sessionKey, 'true')
    localStorage.setItem(sessionTimestampKey, Date.now().toString())
    setStatus('authorized')
  }

  const handleVerificationSuccess = () => {
    console.log('✅ SECURITY: TOTP verification successful')
    // Mark user as verified in session with timestamp
    const sessionKey = `totp_verified_${user.id}`
    const sessionTimestampKey = `totp_session_${user.id}`
    localStorage.setItem(sessionKey, 'true')
    localStorage.setItem(sessionTimestampKey, Date.now().toString())
    setStatus('authorized')
  }

  // Authentication check
  if (!user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to access this page.</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show error if TOTP check failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={() => window.location.href = '/login'}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Re-login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show loading while checking TOTP status
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Checking Authentication
            </h2>
            <p className="text-gray-600">Please wait...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show TOTP setup if not configured
  if (status === 'setup-required') {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 p-4">
        <div className="w-full max-w-lg mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Security Setup Required
            </h1>
            <p className="text-gray-600">
              Two-factor authentication is mandatory for CareXPS Healthcare CRM
            </p>
          </div>
          <TOTPSetup
            userId={user.id}
            userEmail={user.email || user.user_metadata?.email || 'user@carexps.com'}
            onSetupComplete={handleSetupComplete}
            onCancel={() => {
              console.log('🚨 TOTP Setup Cancel requested for user:', user.id)

              // Check if user can use emergency bypass
              if (EMERGENCY_BYPASS_USERS.includes(user.id) || EMERGENCY_BYPASS_USERS.includes(user.email)) {
                const useBypass = confirm(
                  'TOTP Setup Required\n\n' +
                  'Two-factor authentication is mandatory for CareXPS Healthcare CRM.\n\n' +
                  'However, an emergency bypass is available for your account.\n\n' +
                  'Click OK to activate 24-hour emergency bypass, or Cancel to continue with TOTP setup.'
                )

                if (useBypass) {
                  console.warn('🚨 User requested emergency TOTP bypass')
                  activateEmergencyBypass(user.id)
                  setStatus('authorized')
                  return
                }
              }

              // Provide options for non-emergency users
              const options = confirm(
                'TOTP Setup Required\n\n' +
                'Two-factor authentication is required to use CareXPS Healthcare CRM.\n\n' +
                'Options:\n' +
                '• Click OK to logout and return to login page\n' +
                '• Click Cancel to continue with TOTP setup\n\n' +
                'Note: If you are experiencing technical difficulties, contact your administrator.'
              )

              if (options) {
                // User chose to logout
                console.log('🚪 User chose to logout instead of completing TOTP setup')
                window.location.href = '/login'
              }

              // User chose to continue with setup - do nothing (stays on setup screen)
            }}
          />
        </div>
      </div>
    )
  }

  // Show TOTP verification
  if (status === 'verification-required') {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Secure Login
            </h1>
            <p className="text-gray-600">
              Complete your login with two-factor authentication
            </p>
          </div>
          <TOTPVerification
            userId={user.id}
            onVerificationSuccess={handleVerificationSuccess}
            onCancel={() => {
              // Allow logout but not bypass
              window.location.href = '/login'
            }}
          />
        </div>
      </div>
    )
  }

  // TOTP verified - show protected content
  if (status === 'authorized') {
    console.log('✅ SECURITY: User authorized - rendering protected content')
    return <>{children}</>
  }

  // Fallback - should not reach here
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">Unable to verify authentication status.</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export { TOTPProtectedRoute }