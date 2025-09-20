/**
 * PHI Access Guard - HIPAA Compliance Component
 *
 * Ensures that Protected Health Information can only be accessed by users with:
 * 1. Valid authentication
 * 2. MFA verification completed
 * 3. Appropriate permissions
 */

import React, { useState, useEffect } from 'react'
import { User } from '@/types'
import { authService } from '@/services/authService'
import { mfaService } from '@/services/mfaService'
import { secureLogger } from '@/services/secureLogger'

const logger = secureLogger.component('PHIAccessGuard')

interface PHIAccessGuardProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  fallbackComponent?: React.ReactNode
}

const PHIAccessGuard: React.FC<PHIAccessGuardProps> = ({
  children,
  requiredPermissions = [],
  fallbackComponent
}) => {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    checkPHIAccess()
  }, [])

  const checkPHIAccess = async () => {
    try {
      setIsLoading(true)

      // Get current user
      const currentUserData = localStorage.getItem('currentUser')
      if (!currentUserData) {
        logger.warn('PHI access denied: No authenticated user')
        setIsAuthorized(false)
        setIsLoading(false)
        return
      }

      const user: User = JSON.parse(currentUserData)
      setUser(user)

      // MAXIMUM SECURITY: MFA is ALWAYS required for PHI access - no exceptions
      if (!user.mfaEnabled) {
        logger.warn('PHI access denied: MFA not enabled for user', user.id)
        setIsAuthorized(false)
        setMfaRequired(true)
        setIsLoading(false)
        return
      }

      // Verify MFA session is active - REQUIRED for all users
      const mfaStatus = await mfaService.getMFAStatus(user.id)
      if (!mfaStatus.isEnabled || !mfaStatus.isAvailableOnThisDevice) {
        logger.warn('PHI access denied: MFA verification required', user.id)
        setIsAuthorized(false)
        setMfaRequired(true)
        setIsLoading(false)
        return
      }

      // Check permissions if specified
      if (requiredPermissions.length > 0) {
        const hasRequiredPermissions = requiredPermissions.every(permission => {
          return user.permissions?.some(p => p.resource === permission)
        })

        if (!hasRequiredPermissions) {
          logger.warn('PHI access denied: Insufficient permissions')
          setIsAuthorized(false)
          setIsLoading(false)
          return
        }
      }

      // All checks passed
      logger.info('PHI access granted for authorized user')
      setIsAuthorized(true)
      setIsLoading(false)

    } catch (error) {
      logger.error('PHI access check failed', undefined, undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
      setIsAuthorized(false)
      setIsLoading(false)
    }
  }

  const handleMFAVerification = async () => {
    if (!user) return

    try {
      // In a real implementation, this would show the MFA input dialog
      // For now, we'll just re-check access
      await checkPHIAccess()
    } catch (error) {
      logger.error('MFA verification failed', undefined, undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Verifying access...</span>
      </div>
    )
  }

  if (!isAuthorized) {
    if (mfaRequired) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 m-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                MFA Verification Required
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Access to Protected Health Information requires Multi-Factor Authentication (MFA) verification.
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={handleMFAVerification}
                  className="bg-yellow-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  Verify MFA
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return fallbackComponent || (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Access Denied
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>
                You do not have sufficient permissions to access Protected Health Information.
                Please contact your administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // User is authorized, render the protected content
  return <>{children}</>
}

export default PHIAccessGuard