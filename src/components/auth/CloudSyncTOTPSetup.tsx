/**
 * Cloud-Synchronized TOTP Setup Component
 * Enhanced version that prioritizes database storage for cross-device MFA sync
 *
 * Features:
 * - Database-first storage with localStorage cache
 * - Real-time sync status display
 * - Cross-device compatibility indicators
 * - Offline capability with sync pending notifications
 * - Enhanced security with audit logging
 */

import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Shield, Copy, Check, AlertTriangle, Eye, EyeOff, Cloud, CloudOff, Smartphone, Monitor, Wifi } from 'lucide-react'
import { cloudSyncTotpService } from '../../services/cloudSyncTotpService'

interface CloudSyncTOTPSetupProps {
  userId: string
  userEmail: string
  onSetupComplete: () => void
  onCancel: () => void
}

interface SetupData {
  secret: string
  qr_url: string
  manual_entry_key: string
  backup_codes: string[]
  sync_status: 'database' | 'localStorage' | 'offline'
}

const CloudSyncTOTPSetup: React.FC<CloudSyncTOTPSetupProps> = ({
  userId,
  userEmail,
  onSetupComplete,
  onCancel
}) => {
  console.log('🎯 CloudSyncTOTPSetup component rendered for:', { userId, userEmail })

  const [step, setStep] = useState<'generating' | 'show-qr' | 'verify' | 'backup-codes'>('generating')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    hasCloudData: boolean
    hasCacheData: boolean
    lastSync: string | null
    syncPending: boolean
    cacheSource: 'database' | 'localStorage' | 'none'
  } | null>(null)

  // Generate TOTP setup on component mount
  useEffect(() => {
    generateCloudSyncTOTPSetup()
  }, [])

  // Handle escape key to cancel setup
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('🚫 CloudSyncTOTPSetup: Escape key pressed - canceling setup')
        handleCancel()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [])

  // Listen for sync status updates
  useEffect(() => {
    const handleSyncUpdate = (event: CustomEvent) => {
      console.log('🔄 CloudSyncTOTPSetup: Sync update received:', event.detail)
      updateSyncStatus()
    }

    window.addEventListener('totpSyncUpdate', handleSyncUpdate as EventListener)
    window.addEventListener('totpSyncComplete', handleSyncUpdate as EventListener)

    return () => {
      window.removeEventListener('totpSyncUpdate', handleSyncUpdate as EventListener)
      window.removeEventListener('totpSyncComplete', handleSyncUpdate as EventListener)
    }
  }, [])

  const generateCloudSyncTOTPSetup = async () => {
    try {
      console.log('🚀 CloudSyncTOTPSetup: Starting cloud-synced TOTP setup generation...')
      setError('')

      console.log('🚀 CloudSyncTOTPSetup: Calling cloudSyncTotpService.generateTOTPSetup...')
      const setup = await cloudSyncTotpService.generateTOTPSetup(userId, userEmail)
      console.log('🚀 CloudSyncTOTPSetup: TOTP setup received:', setup)
      setSetupData(setup)

      // Update sync status
      await updateSyncStatus()

      console.log('🚀 CloudSyncTOTPSetup: Generating QR code...')
      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(setup.qr_url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      console.log('🚀 CloudSyncTOTPSetup: QR code generated successfully')
      setQrCodeDataUrl(qrDataUrl)

      console.log('🚀 CloudSyncTOTPSetup: Moving to show-qr step')
      setStep('show-qr')
      console.log('🚀 CloudSyncTOTPSetup: Setup generation completed!')
    } catch (error) {
      console.error('❌ CloudSyncTOTPSetup: Setup generation failed:', error)
      setError('Failed to generate cloud-synced TOTP setup. Please try again or cancel.')
      setStep('show-qr')
    }
  }

  const updateSyncStatus = async () => {
    try {
      const status = await cloudSyncTotpService.getSyncStatus(userId)
      setSyncStatus(status)
      console.log('📊 CloudSyncTOTPSetup: Sync status updated:', status)
    } catch (error) {
      console.error('❌ CloudSyncTOTPSetup: Failed to update sync status:', error)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const handleVerification = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const result = await cloudSyncTotpService.verifyTOTP(userId, verificationCode.trim(), true)

      if (result.success) {
        // Update sync status after successful verification
        await updateSyncStatus()
        setStep('backup-codes')
      } else {
        setError(result.error || 'Invalid verification code. Please try again.')
      }
    } catch (error) {
      console.error('CloudSync TOTP verification failed:', error)
      setError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleBackupCodesAcknowledged = () => {
    onSetupComplete()
  }

  const handleCancel = () => {
    console.log('🚫 CloudSyncTOTPSetup: Cancel button clicked - closing modal immediately')
    onCancel()
  }

  const formatBackupCodes = (codes: string[]) => {
    return codes.map((code, index) => (
      <div key={index} className="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
        {code}
      </div>
    ))
  }

  const getSyncStatusDisplay = () => {
    if (!syncStatus) return null

    if (syncStatus.hasCloudData && syncStatus.cacheSource === 'database') {
      return (
        <div className="flex items-center text-green-600 dark:text-green-400 text-sm">
          <Cloud className="w-4 h-4 mr-1" />
          <span>Cloud-synced - Available on all devices</span>
        </div>
      )
    }

    if (syncStatus.hasCacheData && syncStatus.syncPending) {
      return (
        <div className="flex items-center text-amber-600 dark:text-amber-400 text-sm">
          <CloudOff className="w-4 h-4 mr-1" />
          <span>Offline mode - Will sync when online</span>
        </div>
      )
    }

    if (syncStatus.hasCacheData) {
      return (
        <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm">
          <Monitor className="w-4 h-4 mr-1" />
          <span>Local setup - Enable sync for all devices</span>
        </div>
      )
    }

    return null
  }

  const getDeviceCompatibilityInfo = () => {
    const syncDisplay = getSyncStatusDisplay()

    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
        <div className="flex items-start">
          <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-blue-800 dark:text-blue-200 text-sm">
            <div className="font-medium mb-1">Cross-Device Compatibility</div>
            <div className="mb-2">
              {setupData?.sync_status === 'database' ? (
                <span>✅ Your MFA will work on all your devices automatically</span>
              ) : setupData?.sync_status === 'localStorage' ? (
                <span>⏳ MFA will sync to cloud when connection is restored</span>
              ) : (
                <span>📱 MFA is currently device-specific</span>
              )}
            </div>
            {syncDisplay}
            {syncStatus?.lastSync && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Modal wrapper for all steps
  const ModalWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="max-w-lg mx-4 relative">
        {children}
      </div>
    </div>
  )

  if (step === 'generating') {
    return (
      <ModalWrapper>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 relative max-w-md mx-auto">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ×
          </button>

          <div className="text-center">
            {/* Professional loading icon */}
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-800 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Setting Up Cloud-Synced MFA
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              Preparing your two-factor authentication with cross-device synchronization...
            </p>

            {/* Enhanced progress indicator */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
              <div className="flex justify-center items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                <Wifi className="w-3 h-3 mr-1" />
                Connecting to cloud services...
              </div>
            </div>
          </div>
        </div>
      </ModalWrapper>
    )
  }

  if (step === 'show-qr') {
    return (
      <ModalWrapper>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 relative">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>

        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Scan QR Code
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Use your authenticator app to scan this QR code
          </p>
        </div>

        {/* Device compatibility info */}
        {getDeviceCompatibilityInfo()}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-red-700 dark:text-red-200">{error}</span>
            </div>
          </div>
        )}

        <div className="text-center mb-6">
          {qrCodeDataUrl && (
            <img
              src={qrCodeDataUrl}
              alt="TOTP QR Code"
              className="mx-auto border rounded-lg shadow-sm"
            />
          )}
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Can't scan? Enter this key manually:
          </p>
          <div className="flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
            <code className="text-sm font-mono flex-1 break-all text-gray-900 dark:text-gray-100">
              {setupData?.manual_entry_key}
            </code>
            <button
              onClick={() => copyToClipboard(setupData?.manual_entry_key || '')}
              className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          {error ? (
            <button
              onClick={() => {
                setError('')
                generateCloudSyncTOTPSetup()
              }}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Retry Setup
            </button>
          ) : (
            <button
              onClick={() => setStep('verify')}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next: Verify
            </button>
          )}
        </div>
        </div>
      </ModalWrapper>
    )
  }

  if (step === 'verify') {
    return (
      <ModalWrapper>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 relative">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>

        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Verify Setup
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* Sync status display */}
        {getSyncStatusDisplay() && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            {getSyncStatusDisplay()}
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-red-700 dark:text-red-200">{error}</span>
            </div>
          </div>
        )}

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
            onInput={(e) => {
              const target = e.target as HTMLInputElement
              target.setSelectionRange(target.value.length, target.value.length)
            }}
            placeholder="000000"
            className="w-full text-center text-2xl font-mono p-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            maxLength={6}
            autoFocus
            autoComplete="off"
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setStep('show-qr')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleVerification}
            disabled={isVerifying || verificationCode.length !== 6}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? 'Verifying...' : 'Verify & Enable'}
          </button>
        </div>
        </div>
      </ModalWrapper>
    )
  }

  if (step === 'backup-codes') {
    return (
      <ModalWrapper>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 relative">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>

        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Setup Complete!
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Save these backup codes in a safe place
          </p>
        </div>

        {/* Final sync status */}
        {setupData?.sync_status === 'database' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-4">
            <div className="flex items-center text-green-800 dark:text-green-200 text-sm">
              <Cloud className="w-4 h-4 mr-2" />
              <span>MFA is now synchronized across all your devices</span>
            </div>
          </div>
        )}

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
            <div className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>Important:</strong> These backup codes can be used to access your account if you lose your authenticator device. Each code can only be used once.
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Backup Codes</span>
            <button
              onClick={() => setShowBackupCodes(!showBackupCodes)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
            >
              {showBackupCodes ? (
                <>
                  <EyeOff className="w-4 h-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1" />
                  Show
                </>
              )}
            </button>
          </div>

          {showBackupCodes ? (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {setupData?.backup_codes && formatBackupCodes(setupData.backup_codes)}
            </div>
          ) : (
            <div className="bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">Click "Show" to view backup codes</p>
            </div>
          )}

          <button
            onClick={() => copyToClipboard(setupData?.backup_codes.join('\n') || '')}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy All Codes
              </>
            )}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={handleBackupCodesAcknowledged}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            I've Saved My Backup Codes
          </button>
        </div>
        </div>
      </ModalWrapper>
    )
  }

  return null
}

export default CloudSyncTOTPSetup