/**
 * TOTP Protected Route - Fresh Implementation
 * Controls access based on TOTP authentication status
 */

import React, { useState, useEffect } from 'react'
import { totpService } from '../../services/totpService'
import TOTPSetup from './TOTPSetup'
import TOTPVerification from './TOTPVerification'

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

      // Check if user has TOTP enabled
      const hasTOTP = await totpService.isTOTPEnabled(user.id)

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
    setStatus('authorized')
  }

  const handleVerificationSuccess = () => {
    console.log('✅ SECURITY: TOTP verification successful')
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full">
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
              // TOTP is mandatory - cannot cancel
              alert('Two-factor authentication is required to use CareXPS Healthcare CRM.')
            }}
          />
        </div>
      </div>
    )
  }

  // Show TOTP verification
  if (status === 'verification-required') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full">
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