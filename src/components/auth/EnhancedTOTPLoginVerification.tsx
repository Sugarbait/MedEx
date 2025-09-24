import React, { useState, useEffect } from 'react'
import {
  Shield,
  AlertTriangle,
  Clock,
  Smartphone,
  Monitor,
  Tablet,
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react'
import { totpService } from '../../services/totpService'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '../../services/auditLogger'

interface EnhancedTOTPLoginVerificationProps {
  user: any
  onVerificationSuccess: () => void
  onCancel: () => void
}

interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
  isOnline: boolean
  lastSeen: Date
}

interface SyncStatus {
  isOnline: boolean
  isSynced: boolean
  lastSyncTime: Date | null
  syncError: string | null
  devicesWithMFA: number
  currentDevice: DeviceInfo | null
}

const EnhancedTOTPLoginVerification: React.FC<EnhancedTOTPLoginVerificationProps> = ({
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
  const [showHelp, setShowHelp] = useState(false)
  const [showSyncDetails, setShowSyncDetails] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSynced: false,
    lastSyncTime: null,
    syncError: null,
    devicesWithMFA: 0,
    currentDevice: null
  })

  useEffect(() => {
    // Initialize sync status and device info
    const initializeSyncStatus = async () => {
      try {
        // Detect current device info
        const currentDevice: DeviceInfo = {
          type: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)
            ? (/iPad/.test(navigator.userAgent) ? 'tablet' : 'mobile')
            : 'desktop',
          browser: getBrowserName(),
          os: getOSName(),
          isOnline: navigator.onLine,
          lastSeen: new Date()
        }

        // Mock sync status - in real implementation this would check actual sync state
        setSyncStatus({
          isOnline: navigator.onLine,
          isSynced: true,
          lastSyncTime: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
          syncError: null,
          devicesWithMFA: 3,
          currentDevice
        })
      } catch (error) {
        console.error('Failed to initialize sync status:', error)
        setSyncStatus(prev => ({
          ...prev,
          syncError: 'Failed to check sync status'
        }))
      }
    }

    initializeSyncStatus()

    // Listen for online/offline status changes
    const handleOnline = () => setSyncStatus(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSyncStatus(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

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

  const getBrowserName = (): string => {
    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Unknown'
  }

  const getOSName = (): string => {
    const userAgent = navigator.userAgent
    if (userAgent.includes('Windows')) return 'Windows'
    if (userAgent.includes('Mac OS')) return 'macOS'
    if (userAgent.includes('Linux')) return 'Linux'
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS'
    if (userAgent.includes('Android')) return 'Android'
    return 'Unknown'
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return Smartphone
      case 'tablet':
        return Tablet
      default:
        return Monitor
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

    try {
      console.log('🔍 SECURITY: Verifying TOTP code for user:', user.id)

      // Log MFA verification attempt
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN,
        ResourceType.SYSTEM,
        `mfa-verification-${user.id}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'mfa_verification_attempt',
          userId: user.id,
          attempt: attempts + 1,
          codeLength: verificationCode.length,
          deviceType: syncStatus.currentDevice?.type,
          browser: syncStatus.currentDevice?.browser,
          syncStatus: syncStatus.isSynced ? 'synced' : 'not_synced'
        }
      )

      // Map demo user IDs to their actual Supabase UUIDs for MFA verification
      const demoUUIDMap: { [key: string]: string } = {
        'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'super-user-456': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'dynamic-pierre-user': 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
      }

      const verificationUserId = demoUUIDMap[user.id] || user.id
      console.log('🔍 SECURITY: Using verification user ID:', verificationUserId, 'for login user:', user.id)

      // Use TOTP verification service
      const result = await totpService.verifyTOTP(verificationUserId, verificationCode.trim(), false)

      if (result.success) {
        console.log('✅ SECURITY: TOTP verification successful')

        // Log successful MFA verification
        await auditLogger.logPHIAccess(
          AuditAction.LOGIN,
          ResourceType.SYSTEM,
          `mfa-success-${user.id}`,
          AuditOutcome.SUCCESS,
          {
            operation: 'mfa_verification_success',
            userId: user.id,
            totalAttempts: attempts + 1,
            deviceType: syncStatus.currentDevice?.type,
            syncEnabled: syncStatus.isSynced
          }
        )

        onVerificationSuccess()
      } else {
        console.log('❌ SECURITY: TOTP verification failed')

        // Handle sync-related errors differently
        if (result.error && result.error.includes('TOTP not set up')) {
          const criticalUsers = ['dynamic-pierre-user', 'pierre-user-789', 'super-user-456']
          if (criticalUsers.includes(user.id)) {
            console.log('🚨 SECURITY: Critical user TOTP setup issue')
            setError('MFA setup incomplete. Please configure MFA in Settings → Security.')
          } else {
            setError('MFA not configured. Please set up MFA in your account settings.')
          }
        } else if (!syncStatus.isOnline) {
          setError('Unable to verify code while offline. Please check your connection.')
        } else if (syncStatus.syncError) {
          setError('Sync error detected. Code verification may be delayed.')
        } else {
          const newAttempts = attempts + 1
          setAttempts(newAttempts)

          // Log failed MFA verification
          await auditLogger.logPHIAccess(
            AuditAction.LOGIN_FAILURE,
            ResourceType.SYSTEM,
            `mfa-failure-${user.id}`,
            AuditOutcome.FAILURE,
            {
              operation: 'mfa_verification_failed',
              userId: user.id,
              attempt: newAttempts,
              remainingAttempts: 3 - newAttempts,
              error: result.error
            }
          )

          if (newAttempts >= 3) {
            console.log('🚫 SECURITY: Maximum MFA attempts exceeded - locking account')
            setIsLocked(true)
            setTimeoutMinutes(15)
            setError('Too many failed attempts. Account locked for 15 minutes.')

            setTimeout(() => {
              console.log('🚫 SECURITY: Automatically cancelling MFA verification due to lockout')
              onCancel()
            }, 3000)
          } else {
            const remainingAttempts = 3 - newAttempts
            setError(result.error || `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`)
          }
        }
        setVerificationCode('')
      }
    } catch (error: any) {
      console.error('❌ SECURITY: TOTP verification error:', error)

      // Provide contextual error messages based on sync status
      let userError = 'Verification failed. Please try again.'
      if (error.message) {
        if (error.message.includes('network') || error.message.includes('connection')) {
          userError = 'Network issue detected. Please check your connection and try again.'
        } else if (error.message.includes('timeout')) {
          userError = 'Request timed out. Please try again.'
        } else if (!syncStatus.isOnline) {
          userError = 'You\'re offline. Please connect to the internet to verify your code.'
        } else if (syncStatus.syncError) {
          userError = 'Sync service unavailable. Your code may not be recognized on this device.'
        }
      }

      setError(userError)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && verificationCode.length === 6 && !isVerifying) {
      handleVerification()
    }
  }

  const formatLastSync = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    return date.toLocaleTimeString()
  }

  const DeviceIcon = syncStatus.currentDevice ? getDeviceIcon(syncStatus.currentDevice.type) : Monitor

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
          {/* MFA Icon with sync status */}
          <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center relative">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {syncStatus.isOnline ? (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <Cloud className="w-2 h-2 text-white" />
              </div>
            ) : (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                <CloudOff className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Two-Factor Authentication
          </h2>

          <div className="mb-4">
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Enter the 6-digit code from your authenticator app
            </p>

            {/* Device and sync status */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-center gap-2 text-sm">
                <DeviceIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {syncStatus.currentDevice?.os} • {syncStatus.currentDevice?.browser}
                </span>
                {syncStatus.isOnline ? (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <Wifi className="w-3 h-3" />
                    <span className="text-xs">Online</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                    <WifiOff className="w-3 h-3" />
                    <span className="text-xs">Offline</span>
                  </div>
                )}
              </div>

              {syncStatus.isSynced && syncStatus.lastSyncTime && (
                <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>Last sync: {formatLastSync(syncStatus.lastSyncTime)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Warning messages based on sync status */}
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

          {!syncStatus.isOnline && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <WifiOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0" />
                <span className="text-yellow-700 dark:text-yellow-200 text-sm">
                  You're offline. MFA verification requires an internet connection.
                </span>
              </div>
            </div>
          )}

          {syncStatus.syncError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                <span className="text-red-700 dark:text-red-200 text-sm">
                  Sync service error: {syncStatus.syncError}
                </span>
              </div>
            </div>
          )}

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
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }`}
              maxLength={6}
              autoFocus={!isLocked}
              autoComplete="off"
              disabled={isVerifying || isLocked}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Enter your 6-digit authentication code
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 mb-4">
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
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed'
              }`}
            >
              {isLocked
                ? `Locked (${timeoutMinutes}m)`
                : isVerifying
                ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Verifying...
                    </div>
                  )
                : 'Verify & Sign In'}
            </button>
          </div>

          {/* Help and Details Toggle */}
          <div className="flex items-center justify-center gap-4 text-sm">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <HelpCircle className="w-4 h-4" />
              {showHelp ? 'Hide Help' : 'Need Help?'}
            </button>
            <button
              onClick={() => setShowSyncDetails(!showSyncDetails)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showSyncDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showSyncDetails ? 'Hide Details' : 'Sync Details'}
            </button>
          </div>

          {/* Help Section */}
          {showHelp && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-left">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Troubleshooting</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Make sure your device's time is accurate</li>
                <li>• Try generating a new code in your authenticator app</li>
                <li>• Check that you have internet connectivity</li>
                <li>• Ensure MFA is set up on this device type</li>
                <li>• Contact IT if you're still having issues</li>
              </ul>
            </div>
          )}

          {/* Sync Details Section */}
          {showSyncDetails && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-left">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Synchronization Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Connection:</span>
                  <span className={syncStatus.isOnline ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}>
                    {syncStatus.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">MFA Sync:</span>
                  <span className={syncStatus.isSynced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {syncStatus.isSynced ? 'Synchronized' : 'Not Synced'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Devices with MFA:</span>
                  <span className="text-gray-900 dark:text-gray-100">{syncStatus.devicesWithMFA}</span>
                </div>
                {syncStatus.lastSyncTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Last Sync:</span>
                    <span className="text-gray-900 dark:text-gray-100">{formatLastSync(syncStatus.lastSyncTime)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EnhancedTOTPLoginVerification