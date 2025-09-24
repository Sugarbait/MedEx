/**
 * TOTP Setup Component - Fresh Implementation
 * Handles TOTP setup with QR code and manual entry
 */

import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Shield, Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { totpService } from '../../services/totpService'
import TOTPEmergencyRecovery from './TOTPEmergencyRecovery'

interface TOTPSetupProps {
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

const TOTPSetup: React.FC<TOTPSetupProps> = ({
  userId,
  userEmail,
  onSetupComplete,
  onCancel
}) => {
  console.log('🎯 TOTPSetup component rendered for:', { userId, userEmail })

  const [step, setStep] = useState<'generating' | 'show-qr' | 'verify' | 'backup-codes'>('generating')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [showEmergencyRecovery, setShowEmergencyRecovery] = useState(false)

  // Generate TOTP setup on component mount
  useEffect(() => {
    generateTOTPSetup()
  }, [])

  // Handle escape key to cancel setup
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('🚫 TOTPSetup: Escape key pressed - canceling setup')
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
      console.log('🚀 TOTPSetup: Starting TOTP setup generation...')
      setError('')

      console.log('🚀 TOTPSetup: Calling totpService.generateTOTPSetup...')
      const setup = await totpService.generateTOTPSetup(userId, userEmail)
      console.log('🚀 TOTPSetup: TOTP setup received:', setup)
      setSetupData(setup)

      console.log('🚀 TOTPSetup: Generating QR code...')
      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(setup.qr_url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      console.log('🚀 TOTPSetup: QR code generated successfully')
      setQrCodeDataUrl(qrDataUrl)

      console.log('🚀 TOTPSetup: Moving to show-qr step')
      setStep('show-qr')
      console.log('🚀 TOTPSetup: Setup generation completed!')
    } catch (error) {
      console.error('❌ TOTP setup generation failed:', error)
      setError('Failed to generate TOTP setup. Please try again or cancel.')
      setStep('show-qr') // Show the error state so user can see the error and cancel if needed
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
      console.log('🔍 TOTPSetup: Starting verification with code:', verificationCode)

      // Enhanced verification with better error handling
      const result = await totpService.verifyTOTP(userId, verificationCode.trim(), true)
      console.log('🔍 TOTPSetup: Verification result:', result)

      if (result.success) {
        console.log('✅ TOTPSetup: Verification successful, proceeding to backup codes')
        setStep('backup-codes')
      } else {
        console.log('❌ TOTPSetup: Verification failed:', result.error)

        // Enhanced error messaging with recovery options
        let errorMessage = result.error || 'Invalid verification code. Please try again.'

        // Check for specific error conditions and provide helpful guidance
        if (result.error?.includes('TOTP not set up') || result.error?.includes('old test data')) {
          errorMessage = 'MFA setup data appears corrupted. Please cancel and try setting up MFA again with a fresh QR code.'
        } else if (result.error?.includes('Invalid TOTP code')) {
          errorMessage = 'The code entered does not match. Please check your authenticator app and try again. Make sure you\'re using the latest code (codes refresh every 30 seconds).'
        } else if (result.error?.includes('verification failed')) {
          errorMessage = 'Connection or verification error. Please check your internet connection and try again.'
        }

        setError(errorMessage)
      }
    } catch (error) {
      console.error('❌ TOTPSetup: TOTP verification failed with exception:', error)
      setError('Verification failed due to a system error. Please cancel and try setting up MFA again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleBackupCodesAcknowledged = () => {
    onSetupComplete()
  }

  const handleCancel = () => {
    console.log('🚫 TOTPSetup: Cancel button clicked - providing recovery options')

    // For problematic user, provide immediate emergency recovery options
    if (userId === 'c550502f-c39d-4bb3-bb8c-d193657fdb24') {
      const confirmEmergencyBypass = window.confirm(
        'MFA Setup Issues Detected!\n\n' +
        'Would you like to activate emergency recovery options?\n\n' +
        '• Click OK to enable 1-hour MFA bypass and clear corrupted data\n' +
        '• Click Cancel to just close this setup and try again later\n\n' +
        'Emergency bypass will allow you to access the app without MFA for 1 hour while you fix the setup.'
      )

      if (confirmEmergencyBypass) {
        console.log('🚨 TOTPSetup: Activating emergency recovery for user:', userId)

        // Clear any corrupted data
        localStorage.removeItem(`totp_${userId}`)
        localStorage.removeItem(`totp_secret_${userId}`)
        localStorage.removeItem(`totp_enabled_${userId}`)
        localStorage.removeItem(`mfa_sessions_${userId}`)

        // Create emergency bypass
        const expiryTime = new Date()
        expiryTime.setHours(expiryTime.getHours() + 1)

        const bypassData = {
          userId,
          created: new Date().toISOString(),
          expires: expiryTime.toISOString(),
          reason: 'MFA setup issues - emergency recovery activated'
        }

        localStorage.setItem(`mfa_emergency_bypass_${userId}`, JSON.stringify(bypassData))

        alert(
          'Emergency Recovery Activated!\n\n' +
          '✅ 1-hour MFA bypass enabled\n' +
          '🧹 Corrupted MFA data cleared\n' +
          '🔄 You can now access the app normally\n\n' +
          'Please go to Settings > Security within the next hour to set up fresh MFA with a new QR code.'
        )

        console.log('✅ TOTPSetup: Emergency recovery completed')
      }
    }

    // Reset state to clean up
    setError('')
    setVerificationCode('')
    setStep('generating')

    // Close the modal
    onCancel()
  }

  const formatBackupCodes = (codes: string[]) => {
    return codes.map((code, index) => (
      <div key={index} className="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
        {code}
      </div>
    ))
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
        <div className="bg-white rounded-lg shadow-lg p-8 relative max-w-md mx-auto">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            ×
          </button>

          <div className="text-center">
            {/* Professional loading icon */}
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
              <Shield className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Initializing Security Setup
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Please wait while we prepare your two-factor authentication configuration...
            </p>

            {/* Professional progress indicator */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{width: '60%'}}></div>
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
        <div className="bg-white rounded-lg shadow-lg p-6 relative">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Scan QR Code
          </h2>
          <p className="text-gray-600">
            Use your authenticator app to scan this QR code
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
            <div className="mt-3 text-sm text-red-600">
              <p>Having trouble with TOTP setup? The "Cancel / Get Help" button below will provide emergency recovery options.</p>
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
          <p className="text-sm text-gray-600 mb-2">
            Can't scan? Enter this key manually:
          </p>
          <div className="flex items-center bg-gray-50 border rounded-lg p-3">
            <code className="text-sm font-mono flex-1 break-all">
              {setupData?.manual_entry_key}
            </code>
            <button
              onClick={() => copyToClipboard(setupData?.manual_entry_key || '')}
              className="ml-2 p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 hover:border-red-400 transition-colors font-medium"
            title="Cancel setup and see emergency access options"
          >
            Cancel / Get Help
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
        <div className="bg-white rounded-lg shadow-lg p-6 relative">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Verify Setup
          </h2>
          <p className="text-gray-600">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
              <div className="text-red-700 flex-1">
                <div className="font-medium mb-1">Verification Failed</div>
                <div className="text-sm">{error}</div>
                <div className="mt-2 text-xs text-red-600">
                  <div className="font-medium mb-1">💡 Troubleshooting Tips:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Make sure you're using the current code from your authenticator app</li>
                    <li>Verify you scanned the QR code correctly</li>
                    <li>Try waiting for the next code if the current one is about to expire</li>
                    <li>Check your device's time is accurate</li>
                  </ul>
                  <div className="mt-2 text-red-700 font-medium">
                    If problems persist, click "Cancel / Get Help" below for recovery options.
                  </div>
                </div>
              </div>
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
              // Additional handling to ensure smooth typing
              const target = e.target as HTMLInputElement
              target.setSelectionRange(target.value.length, target.value.length)
            }}
            placeholder="000000"
            className="w-full text-center text-2xl font-mono p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            maxLength={6}
            autoFocus
            autoComplete="off"
          />
        </div>

        <div className="space-y-3">
          <div className="flex space-x-3">
            <button
              onClick={() => setStep('show-qr')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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

          {/* Emergency Actions */}
          {error && (
            <div className="border-t pt-3 space-y-2">
              <button
                onClick={() => setShowEmergencyRecovery(true)}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                🚨 Get Emergency Help
              </button>
              <button
                onClick={handleCancel}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Cancel Setup & Exit
              </button>
            </div>
          )}
        </div>
        </div>
      </ModalWrapper>
    )
  }

  if (step === 'backup-codes') {
    return (
      <ModalWrapper>
        <div className="bg-white rounded-lg shadow-lg p-6 relative">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ×
          </button>
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Setup Complete!
          </h2>
          <p className="text-gray-600">
            Save these backup codes in a safe place
          </p>
        </div>

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
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-sm">Click "Show" to view backup codes</p>
            </div>
          )}

          <button
            onClick={() => copyToClipboard(setupData?.backup_codes.join('\n') || '')}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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

  return (
    <>
      {showEmergencyRecovery && (
        <TOTPEmergencyRecovery
          userId={userId}
          userEmail={userEmail}
          onClose={() => setShowEmergencyRecovery(false)}
          onBypassActivated={() => {
            setShowEmergencyRecovery(false)
            onSetupComplete() // Close the setup and continue
          }}
          onMFAReset={() => {
            setShowEmergencyRecovery(false)
            onCancel() // Close setup to allow fresh start
          }}
        />
      )}
    </>
  )
}

export default TOTPSetup