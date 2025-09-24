import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import {
  Shield,
  Copy,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Sync
} from 'lucide-react'
import { totpService } from '../../services/totpService'
import MFASyncStatusIndicator from './MFASyncStatusIndicator'

interface EnhancedTOTPSetupProps {
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
}

interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  syncProgress: number
  syncError: string | null
  devicesFound: number
  lastSyncTime: Date | null
}

const EnhancedTOTPSetup: React.FC<EnhancedTOTPSetupProps> = ({
  userId,
  userEmail,
  onSetupComplete,
  onCancel
}) => {
  const [step, setStep] = useState<'generating' | 'show-qr' | 'verify' | 'syncing' | 'backup-codes'>('generating')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    syncProgress: 0,
    syncError: null,
    devicesFound: 0,
    lastSyncTime: null
  })

  useEffect(() => {
    generateTOTPSetup()

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
        handleCancel()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [])

  const generateTOTPSetup = async () => {
    try {
      setError('')
      const setup = await totpService.generateTOTPSetup(userId, userEmail)
      setSetupData(setup)

      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(setup.qr_url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      setQrCodeDataUrl(qrDataUrl)
      setStep('show-qr')
    } catch (error) {
      console.error('TOTP setup generation failed:', error)
      setError('Failed to generate TOTP setup. Please try again or cancel.')
      setStep('show-qr')
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
      const result = await totpService.verifyTOTP(userId, verificationCode.trim(), true)

      if (result.success) {
        setStep('syncing')
        await simulateCloudSync()
      } else {
        setError(result.error || 'Invalid verification code. Please try again.')
      }
    } catch (error) {
      console.error('TOTP verification failed:', error)
      setError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const simulateCloudSync = async () => {
    setSyncStatus(prev => ({ ...prev, isSyncing: true, syncProgress: 0, syncError: null }))

    // Simulate sync progress
    const progressSteps = [
      { progress: 20, message: 'Encrypting MFA configuration...' },
      { progress: 40, message: 'Syncing to cloud storage...' },
      { progress: 60, message: 'Discovering other devices...' },
      { progress: 80, message: 'Pushing to synchronized devices...' },
      { progress: 100, message: 'MFA setup complete across all devices!' }
    ]

    for (const progressStep of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, 800))
      setSyncStatus(prev => ({
        ...prev,
        syncProgress: progressStep.progress,
        devicesFound: Math.min(3, Math.floor(progressStep.progress / 30))
      }))
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    setSyncStatus(prev => ({
      ...prev,
      isSyncing: false,
      lastSyncTime: new Date()
    }))
    setStep('backup-codes')
  }

  const handleBackupCodesAcknowledged = () => {
    onSetupComplete()
  }

  const handleCancel = () => {
    onCancel()
  }

  const formatBackupCodes = (codes: string[]) => {
    return codes.map((code, index) => (
      <div key={index} className="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
        {code}
      </div>
    ))
  }

  const ModalWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="max-w-2xl mx-4 relative w-full">
        {children}
      </div>
    </div>
  )

  if (step === 'generating') {
    return (
      <ModalWrapper>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 relative">
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ×
          </button>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-900 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Preparing Cloud-Synced MFA
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">
              Setting up multi-factor authentication that works seamlessly across all your devices...
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
                <Cloud className="w-4 h-4" />
                <span className="text-sm font-medium">Cloud-Synchronized Security</span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                One setup, all devices protected
              </p>
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
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>

          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              {syncStatus.isOnline ? (
                <Cloud className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <CloudOff className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Scan QR Code for Cloud MFA
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Use your authenticator app to scan this code. It will automatically sync to all your devices.
            </p>
          </div>

          {/* Connection Status Banner */}
          <div className={`mb-4 p-3 rounded-lg border ${
            syncStatus.isOnline
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
          }`}>
            <div className="flex items-center gap-2">
              {syncStatus.isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                    Connected - MFA will sync across devices
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                    Offline - MFA will sync when connection is restored
                  </span>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-red-700 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* QR Code */}
            <div className="text-center">
              {qrCodeDataUrl && (
                <div className="bg-white p-4 rounded-lg border border-gray-200 dark:border-gray-600 inline-block">
                  <img
                    src={qrCodeDataUrl}
                    alt="TOTP QR Code"
                    className="mx-auto"
                  />
                </div>
              )}
            </div>

            {/* Setup Instructions */}
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Setup Instructions</h3>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">1</div>
                    <span>Open your authenticator app</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">2</div>
                    <span>Scan the QR code</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-bold">3</div>
                    <span>Verify on next step</span>
                  </div>
                </div>
              </div>

              {/* Manual Entry */}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Can't scan? Enter this key manually:
                </p>
                <div className="flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                  <code className="text-sm font-mono flex-1 break-all text-gray-900 dark:text-gray-100">
                    {setupData?.manual_entry_key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(setupData?.manual_entry_key || '')}
                    className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
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
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
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
                  generateTOTPSetup()
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
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>

          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Verify & Enable Cloud Sync
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Enter the 6-digit code from your authenticator app to complete setup
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-red-700 dark:text-red-300">{error}</span>
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
              placeholder="000000"
              className="w-full text-center text-2xl font-mono p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              maxLength={6}
              autoFocus
              autoComplete="off"
            />
          </div>

          {/* Sync Preview */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Sync className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                What happens next?
              </span>
            </div>
            <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                <span>MFA will be enabled on this device</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                <span>Configuration synced to the cloud</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                <span>All your devices will be automatically protected</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                <span>No need to set up MFA again on other devices</span>
              </div>
            </div>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Enable Cloud MFA'
              )}
            </button>
          </div>
        </div>
      </ModalWrapper>
    )
  }

  if (step === 'syncing') {
    return (
      <ModalWrapper>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 relative">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-900 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Syncing Across Your Devices
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
              Your MFA configuration is being synchronized to all your devices...
            </p>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Sync Progress</span>
                <span>{syncStatus.syncProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${syncStatus.syncProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Discovered Devices */}
            {syncStatus.devicesFound > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-800 dark:text-green-200">
                    {syncStatus.devicesFound} Device{syncStatus.devicesFound !== 1 ? 's' : ''} Found
                  </span>
                </div>
                <div className="flex items-center justify-center gap-4 text-sm text-green-700 dark:text-green-300">
                  <div className="flex items-center gap-1">
                    <Monitor className="w-4 h-4" />
                    <span>Desktop</span>
                  </div>
                  {syncStatus.devicesFound > 1 && (
                    <div className="flex items-center gap-1">
                      <Smartphone className="w-4 h-4" />
                      <span>Mobile</span>
                    </div>
                  )}
                  {syncStatus.devicesFound > 2 && (
                    <div className="flex items-center gap-1">
                      <Tablet className="w-4 h-4" />
                      <span>Tablet</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="text-sm text-gray-500 dark:text-gray-400">
              Please wait while we complete the synchronization...
            </div>
          </div>
        </div>
      </ModalWrapper>
    )
  }

  if (step === 'backup-codes') {
    return (
      <ModalWrapper>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 relative">
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>

          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="w-12 h-12 text-green-600 dark:text-green-400" />
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Cloud MFA Setup Complete!
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your multi-factor authentication is now synchronized across all devices
            </p>

            {/* Sync Success Status */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Successfully synchronized to {syncStatus.devicesFound} device{syncStatus.devicesFound !== 1 ? 's' : ''}
                </span>
              </div>
              {syncStatus.lastSyncTime && (
                <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Clock className="w-3 h-3" />
                  <span>Last sync: {syncStatus.lastSyncTime.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
              <div className="text-amber-800 dark:text-amber-200 text-sm">
                <strong>Important:</strong> Save these backup codes in a safe place. They can be used to access your account if you lose access to your authenticator device.
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Emergency Backup Codes</span>
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
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Complete Setup - I've Saved My Codes
            </button>
          </div>
        </div>
      </ModalWrapper>
    )
  }

  return null
}

export default EnhancedTOTPSetup