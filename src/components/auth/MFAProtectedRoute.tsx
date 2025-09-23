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
    // Check if user has valid MFA session using MFA service
    const currentSession = mfaService.getCurrentSession(user.id)

    console.log('MFAProtectedRoute Access Check:', {
      userId: user.id,
      userEmail: user.email,
      hasValidSession: !!currentSession,
      sessionExpiry: currentSession?.expiresAt,
      mfaVerifiedFallback: localStorage.getItem('mfa_verified') === 'true'
    })

    // SECURITY FIX: Only trust server-side session validation, not localStorage
    const hasAccess = !!currentSession

    if (hasAccess) {
      console.log('✅ User has MFA access - allowing protected route access')
    } else {
      console.log('🔒 User lacks MFA access - blocking protected route access')
    }

    return hasAccess
  } catch (error) {
    console.error('Error checking MFA access for protected route:', error)
    // SECURITY FIX: No localStorage fallback - must have valid session
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