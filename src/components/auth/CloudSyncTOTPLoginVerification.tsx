/**
 * Cloud-Synchronized TOTP Login Verification Component
 * Enhanced login MFA verification with cross-device synchronization
 *
 * Features:
 * - Database-first TOTP verification for cloud-synced MFA
 * - Real-time sync status display during login
 * - Offline capability with localStorage fallback
 * - Enhanced security with comprehensive audit logging
 * - Cross-device compatibility indicators
 */

import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle, Clock, Cloud, CloudOff, Wifi, WifiOff } from 'lucide-react'
import { cloudSyncTotpService } from '../../services/cloudSyncTotpService'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '../../services/auditLogger'

interface CloudSyncTOTPLoginVerificationProps {
  user: any
  onVerificationSuccess: () => void
  onCancel: () => void
}

const CloudSyncTOTPLoginVerification: React.FC<CloudSyncTOTPLoginVerificationProps> = ({
  user,
  onVerificationSuccess,
  onCancel
}) => {
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string>('')
  const [attempts, setAttempts] = useState(0)
  const [timeoutMinutes, setTimeoutMinutes] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    hasCloudData: boolean
    hasCacheData: boolean
    lastSync: string | null
    syncPending: boolean
    cacheSource: 'database' | 'localStorage' | 'none'
  } | null>(null)
  const [verificationSource, setVerificationSource] = useState<'database' | 'localStorage' | 'offline' | null>(null)

  // Handle escape key to cancel
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [onCancel])

  // Check sync status on component mount
  useEffect(() => {
    checkSyncStatus()
  }, [user.id])

  // Listen for sync updates during login
  useEffect(() => {
    const handleSyncUpdate = (event: CustomEvent) => {
      console.log('🔄 CloudSyncTOTPLogin: Sync update received during login:', event.detail)
      if (event.detail.userId === user.id) {
        checkSyncStatus()
      }
    }

    window.addEventListener('totpSyncUpdate', handleSyncUpdate as EventListener)
    window.addEventListener('totpSyncComplete', handleSyncUpdate as EventListener)

    return () => {
      window.removeEventListener('totpSyncUpdate', handleSyncUpdate as EventListener)
      window.removeEventListener('totpSyncComplete', handleSyncUpdate as EventListener)
    }
  }, [user.id])

  const checkSyncStatus = async () => {
    try {
      console.log('📊 CloudSyncTOTPLogin: Checking sync status for user:', user.id)

      // Map demo user IDs to their actual Supabase UUIDs for sync check
      const demoUUIDMap: { [key: string]: string } = {
        'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'super-user-456': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'dynamic-pierre-user': 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
      }

      const syncUserId = demoUUIDMap[user.id] || user.id
      const status = await cloudSyncTotpService.getSyncStatus(syncUserId)
      setSyncStatus(status)
      console.log('📊 CloudSyncTOTPLogin: Sync status retrieved:', status)
    } catch (error) {
      console.error('❌ CloudSyncTOTPLogin: Failed to check sync status:', error)
    }
  }

  const handleVerification = async () => {
    if (isLocked) {
      setError(`Account is locked. Please try again in ${timeoutMinutes} minutes.`)
      return
    }

    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)
    setError('')
    setVerificationSource(null)

    try {
      console.log('🔍 CloudSync SECURITY: Verifying TOTP code for user:', user.id)

      // Log MFA verification attempt with cloud sync info
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN,
        ResourceType.SYSTEM,
        `mfa-cloudsync-verification-${user.id}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'mfa_cloudsync_verification_attempt',
          userId: user.id,
          attempt: attempts + 1,
          codeLength: verificationCode.length,
          syncStatus: syncStatus?.cacheSource || 'unknown',
          hasCloudData: syncStatus?.hasCloudData || false,
          timestamp: new Date().toISOString()
        }
      )

      // Map demo user IDs to their actual Supabase UUIDs for MFA verification
      const demoUUIDMap: { [key: string]: string } = {
        'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'super-user-456': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'dynamic-pierre-user': 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
      }

      const verificationUserId = demoUUIDMap[user.id] || user.id
      console.log('🔍 CloudSync SECURITY: Using verification user ID:', verificationUserId, 'for login user:', user.id)

      // Use cloud-synced TOTP verification
      const result = await cloudSyncTotpService.verifyTOTP(verificationUserId, verificationCode.trim(), false)

      if (result.success) {
        console.log('✅ CloudSync SECURITY: TOTP verification successful')
        setVerificationSource(result.sync_status || 'unknown')

        // Log successful MFA verification with sync details
        await auditLogger.logPHIAccess(
          AuditAction.LOGIN,
          ResourceType.SYSTEM,
          `mfa-cloudsync-success-${user.id}`,
          AuditOutcome.SUCCESS,
          {
            operation: 'mfa_cloudsync_verification_success',
            userId: user.id,
            totalAttempts: attempts + 1,
            verificationSource: result.sync_status,
            syncedData: syncStatus?.hasCloudData || false,
            timestamp: new Date().toISOString()
          }
        )

        // Brief delay to show success status
        setTimeout(() => {
          onVerificationSuccess()
        }, 1000)

      } else {
        console.log('❌ CloudSync SECURITY: TOTP verification failed')

        // Handle specific cloud sync error messages
        if (result.error && result.error.includes('TOTP not set up')) {
          const criticalUsers = ['dynamic-pierre-user', 'pierre-user-789', 'super-user-456']
          if (criticalUsers.includes(user.id)) {
            console.log('🚨 CloudSync SECURITY: Critical user TOTP setup issue - cloud sync should handle this')
            console.log('ℹ️ CloudSync SECURITY: User should use Settings to set up fresh MFA or contact admin')
          }
        }

        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setVerificationSource(result.sync_status || 'unknown')

        // Log failed MFA verification with sync details
        await auditLogger.logPHIAccess(
          AuditAction.LOGIN_FAILURE,
          ResourceType.SYSTEM,
          `mfa-cloudsync-failure-${user.id}`,
          AuditOutcome.FAILURE,
          {
            operation: 'mfa_cloudsync_verification_failed',
            userId: user.id,
            attempt: newAttempts,
            remainingAttempts: 3 - newAttempts,
            error: result.error,
            verificationSource: result.sync_status,
            syncStatus: syncStatus?.cacheSource,
            timestamp: new Date().toISOString()
          }
        )

        if (newAttempts >= 3) {
          console.log('🚫 CloudSync SECURITY: Maximum MFA attempts exceeded - locking account')
          setIsLocked(true)
          setTimeoutMinutes(15)
          setError('Too many failed attempts. Account locked for 15 minutes.')

          // Log account lockout
          await auditLogger.logPHIAccess(
            AuditAction.LOGIN_FAILURE,
            ResourceType.SYSTEM,
            `mfa-cloudsync-lockout-${user.id}`,
            AuditOutcome.FAILURE,
            {
              operation: 'mfa_cloudsync_account_locked',
              userId: user.id,
              lockoutDuration: '15 minutes',
              totalFailedAttempts: newAttempts,
              finalAttemptSource: result.sync_status,
              timestamp: new Date().toISOString()
            }
          )

          setTimeout(() => {
            console.log('🚫 CloudSync SECURITY: Auto-cancelling due to lockout')
            onCancel()
          }, 3000)
        } else {
          const remainingAttempts = 3 - newAttempts
          const errorMessage = result.error || `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`

          // Add sync status context to error message
          if (result.sync_status === 'localStorage') {
            setError(`${errorMessage} (Using local backup data)`)
          } else if (result.sync_status === 'offline') {
            setError(`${errorMessage} (Operating in offline mode)`)
          } else {
            setError(errorMessage)
          }
        }
        setVerificationCode('')
      }
    } catch (error: any) {
      console.error('❌ CloudSync SECURITY: TOTP verification error:', error)

      // Enhanced error handling for cloud sync issues
      if (error.message && (error.message.includes('network') || error.message.includes('connection') || error.message.includes('timeout'))) {
        const criticalUsers = ['dynamic-pierre-user', 'pierre-user-789', 'super-user-456']
        if (criticalUsers.includes(user.id)) {
          console.log('🚨 CloudSync SECURITY: Network connectivity issue for critical user')

          try {
            // Try to sync from cached data
            const syncResult = await cloudSyncTotpService.syncTOTPFromDatabase(user.id, false)
            if (syncResult.success) {
              setError('Network issue detected but cached data is available. Please try again.')
            } else {
              setError('Network connectivity issue. Using offline mode - try your code again.')
            }

            // Log connectivity fallback attempt
            await auditLogger.logPHIAccess(
              AuditAction.LOGIN,
              ResourceType.SYSTEM,
              `mfa-cloudsync-connectivity-fallback-${user.id}`,
              AuditOutcome.SUCCESS,
              {
                operation: 'mfa_cloudsync_connectivity_fallback',
                userId: user.id,
                originalError: error.message,
                syncResult: syncResult.success,
                timestamp: new Date().toISOString()
              }
            )
            return
          } catch (fallbackError) {
            console.error('❌ CloudSync SECURITY: Connectivity fallback failed:', fallbackError)
          }
        }
      }

      // Log verification system error
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN_FAILURE,
        ResourceType.SYSTEM,
        `mfa-cloudsync-error-${user.id}`,
        AuditOutcome.FAILURE,
        {
          operation: 'mfa_cloudsync_verification_error',
          userId: user.id,
          error: error.message || 'Unknown error',
          syncStatus: syncStatus?.cacheSource,
          timestamp: new Date().toISOString()
        }
      )

      // Provide enhanced user-friendly error messages
      let userError = 'Verification failed. Please try again.'
      if (error.message) {
        if (error.message.includes('network') || error.message.includes('connection')) {
          userError = 'Network issue detected. Trying offline mode - please check your connection.'
        } else if (error.message.includes('timeout')) {
          userError = 'Request timed out. Using cached data - please try again.'
        } else if (error.message.includes('TOTP not set up')) {
          userError = 'TOTP not configured. Contact administrator for cloud-synced setup.'
        } else if (error.message.includes('cloud sync')) {
          userError = 'Cloud sync issue detected. Using local verification - please try again.'
        }
      }

      setError(userError)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && verificationCode.length === 6 && !isVerifying && !isLocked) {
      handleVerification()
    }
  }

  const getSyncStatusDisplay = () => {
    if (!syncStatus) {
      return (
        <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
          <Wifi className="w-3 h-3 mr-1 animate-pulse" />
          <span>Checking sync status...</span>
        </div>
      )
    }

    if (syncStatus.hasCloudData && syncStatus.cacheSource === 'database') {
      return (
        <div className="flex items-center text-green-600 dark:text-green-400 text-xs">
          <Cloud className="w-3 h-3 mr-1" />
          <span>Cloud-synced MFA active</span>
        </div>
      )
    }

    if (syncStatus.hasCacheData && syncStatus.syncPending) {
      return (
        <div className="flex items-center text-amber-600 dark:text-amber-400 text-xs">
          <CloudOff className="w-3 h-3 mr-1" />
          <span>Offline mode - will sync when online</span>
        </div>
      )
    }

    if (syncStatus.hasCacheData && syncStatus.cacheSource === 'localStorage') {
      return (
        <div className="flex items-center text-blue-600 dark:text-blue-400 text-xs">
          <WifiOff className="w-3 h-3 mr-1" />
          <span>Using local MFA data</span>
        </div>
      )
    }

    return (
      <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
        <AlertTriangle className="w-3 h-3 mr-1" />
        <span>MFA status unknown</span>
      </div>
    )
  }

  const getSuccessMessage = () => {
    if (!verificationSource) return null

    if (verificationSource === 'database') {
      return (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <Cloud className="w-4 h-4 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
            <span className="text-green-700 dark:text-green-200 text-sm font-medium">
              ✅ Verified with cloud-synced MFA
            </span>
          </div>
        </div>
      )
    }

    if (verificationSource === 'localStorage') {
      return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
          <div className="flex items-center">
            <WifiOff className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
            <span className="text-blue-700 dark:text-blue-200 text-sm font-medium">
              ✅ Verified with local MFA data
            </span>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 relative max-w-md mx-4 w-full">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          ×
        </button>

        <div className="text-center">
          {/* MFA Icon */}
          <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Two-Factor Authentication
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Enter the 6-digit code from your authenticator app
          </p>

          {/* Sync status display */}
          <div className="mb-3">
            {getSyncStatusDisplay()}
          </div>

          {/* Success message */}
          {getSuccessMessage()}

          {/* TOTP check error from user object */}
          {user.totpCheckError && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" />
                <span className="text-yellow-700 dark:text-yellow-200 text-sm">
                  {user.totpCheckError}
                </span>
              </div>
            </div>
          )}

          {/* Account locked warning */}
          {isLocked && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                <span className="text-red-700 dark:text-red-200 text-sm font-semibold">
                  Account Locked - Too many failed attempts
                </span>
              </div>
            </div>
          )}

          {/* Verification error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                <span className="text-red-700 dark:text-red-200 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* TOTP Code Input */}
          <div className="mb-6">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setVerificationCode(value)
                setError('')
              }}
              onKeyPress={handleKeyPress}
              placeholder="000000"
              className={`w-full text-center text-2xl font-mono p-4 border rounded-lg outline-none transition-colors ${
                isLocked
                  ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100 cursor-not-allowed'
                  : verificationSource === 'database'
                  ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }`}
              maxLength={6}
              autoFocus={!isLocked}
              autoComplete="off"
              disabled={isVerifying || isLocked}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {verificationSource === 'database' ?
                'Cloud-synced authentication code' :
                verificationSource === 'localStorage' ?
                'Local authentication code' :
                'Enter your 6-digit authentication code'
              }
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              disabled={isVerifying}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleVerification}
              disabled={isVerifying || verificationCode.length !== 6 || isLocked}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                isLocked
                  ? 'bg-red-600 text-white cursor-not-allowed opacity-50'
                  : verificationSource === 'database'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed'
              }`}
            >
              {isLocked
                ? `Locked (${timeoutMinutes}m)`
                : isVerifying
                ? 'Verifying...'
                : verificationSource === 'database'
                ? 'Verified ✅'
                : 'Verify & Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CloudSyncTOTPLoginVerification