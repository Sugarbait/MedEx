import React from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheckIcon, AlertTriangleIcon, LockIcon } from 'lucide-react'
import { mfaService } from '@/services/mfaService'

interface MFAProtectedRouteProps {
  user: any
  children: React.ReactNode
  requiresMFA?: boolean
}

const hasMFAAccess = (user: any): boolean => {
  if (!user?.id) return false

  try {
    // First check if user has MFA enabled - if not, allow access
    const hasMFASetup = mfaService.hasMFASetupSync(user.id)
    const hasMFAEnabled = mfaService.hasMFAEnabledSync(user.id)

    console.log('MFAProtectedRoute - MFA Status Check:', {
      userId: user.id,
      userEmail: user.email,
      hasMFASetup,
      hasMFAEnabled,
      userMfaEnabled: user.mfaEnabled
    })

    // If user doesn't have MFA enabled, allow access
    if (!hasMFAEnabled && !user.mfaEnabled) {
      console.log('✅ User has MFA disabled - allowing access')
      return true
    }

    // If user has MFA enabled, check for valid session
    const currentSession = mfaService.getCurrentSessionSync(user.id)

    console.log('MFAProtectedRoute - Session Check:', {
      hasValidSession: !!currentSession,
      sessionExpiry: currentSession?.expiresAt,
      sessionVerified: currentSession?.verified,
      sessionPHIAccess: currentSession?.phiAccessEnabled
    })

    // CRITICAL: Only allow access if there's a valid, verified MFA session
    // Remove the insecure localStorage fallback
    const hasAccess = !!currentSession && currentSession.verified

    if (hasAccess) {
      console.log('✅ User has valid MFA session - allowing protected route access')
    } else {
      console.log('🔒 User lacks valid MFA session - blocking protected route access')
      console.log('🔒 MFA verification required for cross-device access')
    }

    return hasAccess
  } catch (error) {
    console.error('Error checking MFA access for protected route:', error)
    // SECURITY: In case of error, deny access (fail-safe)
    console.log('🔒 MFA access check failed - denying access for security')
    return false
  }
}

export const MFAProtectedRoute: React.FC<MFAProtectedRouteProps> = ({
  user,
  children,
  requiresMFA = true
}) => {
  // If MFA is not required, render children
  if (!requiresMFA) {
    return <>{children}</>
  }

  // Check if user has MFA access
  const hasAccess = hasMFAAccess(user)

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <LockIcon className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Access Restricted
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Multi-Factor Authentication is required to access this page
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  HIPAA Security Requirement
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    This page contains Protected Health Information (PHI) and requires
                    Multi-Factor Authentication for access in compliance with HIPAA regulations.
                  </p>

                  {!user?.mfa_enabled ? (
                    <div className="mt-4">
                      <p className="font-medium">Steps to gain access:</p>
                      <ol className="mt-2 list-decimal list-inside space-y-1">
                        <li>Go to Settings → Security & Privacy</li>
                        <li>Enable Multi-Factor Authentication</li>
                        <li>Complete the MFA setup process</li>
                        <li>Return to this page and verify your identity</li>
                      </ol>
                    </div>
                  ) : localStorage.getItem(`mfa_secret_${user.id}`) ? (
                    <div className="mt-4">
                      <p className="font-medium">MFA verification required:</p>
                      <p className="mt-1">
                        You need to complete MFA verification to access this page.
                        Navigate to a page that requires MFA to trigger the verification process.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="font-medium">Complete MFA setup:</p>
                      <p className="mt-1">
                        MFA is enabled but setup is incomplete. Please complete the setup process in Settings.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => window.location.href = '/settings'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ShieldCheckIcon className="w-4 h-4" />
              Go to Security Settings
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:underline"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // User has MFA access, render the protected content
  return <>{children}</>
}