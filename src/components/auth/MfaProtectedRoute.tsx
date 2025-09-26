import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Lock,
  Settings,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import FreshMfaService from '@/services/freshMfaService'

interface MfaProtectedRouteProps {
  children: React.ReactNode
  user: {
    id: string
    email: string
    name?: string
    role?: string
  }
  requiredForPages?: string[]
  showInlineSetup?: boolean
}

interface MfaStatus {
  isLoading: boolean
  hasSetup: boolean
  isEnabled: boolean
  error: string | null
}

export const MfaProtectedRoute: React.FC<MfaProtectedRouteProps> = ({
  children,
  user,
  requiredForPages = ['calls', 'sms'],
  showInlineSetup = false
}) => {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>({
    isLoading: true,
    hasSetup: false,
    isEnabled: false,
    error: null
  })
  const [showMfaRequirement, setShowMfaRequirement] = useState(false)

  useEffect(() => {
    checkMfaStatus()
  }, [user.id])

  useEffect(() => {
    // Listen for MFA status changes
    const handleMfaStatusChange = () => {
      checkMfaStatus()
    }

    window.addEventListener('totpStatusChanged', handleMfaStatusChange)
    window.addEventListener('mfaSetupCompleted', handleMfaStatusChange)

    return () => {
      window.removeEventListener('totpStatusChanged', handleMfaStatusChange)
      window.removeEventListener('mfaSetupCompleted', handleMfaStatusChange)
    }
  }, [user.id])

  const checkMfaStatus = async () => {
    setMfaStatus(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const isEnabled = await FreshMfaService.isMfaEnabled(user.id)

      setMfaStatus({
        isLoading: false,
        hasSetup: isEnabled,
        isEnabled: isEnabled,
        error: null
      })

      // Show requirement notice if MFA is not set up
      setShowMfaRequirement(!isEnabled)

    } catch (error: any) {
      console.error('MFA status check failed:', error)
      setMfaStatus({
        isLoading: false,
        hasSetup: false,
        isEnabled: false,
        error: error.message || 'Failed to check MFA status'
      })
      setShowMfaRequirement(true)
    }
  }

  // Check if current route requires MFA
  const currentPath = window.location.pathname
  const requiresMfa = requiredForPages.some(page => currentPath.includes(`/${page}`))

  // If route doesn't require MFA, render children
  if (!requiresMfa) {
    return <>{children}</>
  }

  // If MFA is enabled, render children
  if (mfaStatus.hasSetup && mfaStatus.isEnabled) {
    return <>{children}</>
  }

  // If loading, show loading state
  if (mfaStatus.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Checking security requirements...</p>
        </div>
      </div>
    )
  }

  // Show MFA requirement screen
  if (showMfaRequirement) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-start justify-center pt-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
              Multi-Factor Authentication Required
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This page requires additional security verification to access sensitive healthcare data.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Security Notice</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Access to Call and SMS pages requires MFA for HIPAA compliance and patient data protection.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  What you need to do:
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Go to Settings → Security</li>
                  <li>Enable Multi-Factor Authentication</li>
                  <li>Set up your authenticator app</li>
                  <li>Return here to access protected pages</li>
                </ol>
              </div>

              {mfaStatus.error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">{mfaStatus.error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={() => (window.location.href = '/settings?tab=security')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Settings className="w-4 h-4" />
                  Go to Security Settings
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={checkMfaStatus}
                  disabled={mfaStatus.isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${mfaStatus.isLoading ? 'animate-spin' : ''}`} />
                  Check Again
                </button>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Protected by HIPAA-compliant security measures
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Fallback - should not reach here
  return <Navigate to="/settings?tab=security" replace />
}

// Hook for checking MFA status in components
export const useMfaStatus = (userId: string) => {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>({
    isLoading: true,
    hasSetup: false,
    isEnabled: false,
    error: null
  })

  const checkStatus = async () => {
    setMfaStatus(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const isEnabled = await FreshMfaService.isMfaEnabled(userId)

      setMfaStatus({
        isLoading: false,
        hasSetup: isEnabled,
        isEnabled: isEnabled,
        error: null
      })

    } catch (error: any) {
      setMfaStatus({
        isLoading: false,
        hasSetup: false,
        isEnabled: false,
        error: error.message || 'Failed to check MFA status'
      })
    }
  }

  useEffect(() => {
    checkStatus()

    // Listen for MFA status changes
    const handleMfaStatusChange = () => {
      checkStatus()
    }

    window.addEventListener('totpStatusChanged', handleMfaStatusChange)
    window.addEventListener('mfaSetupCompleted', handleMfaStatusChange)

    return () => {
      window.removeEventListener('totpStatusChanged', handleMfaStatusChange)
      window.removeEventListener('mfaSetupCompleted', handleMfaStatusChange)
    }
  }, [userId])

  return { ...mfaStatus, refresh: checkStatus }
}