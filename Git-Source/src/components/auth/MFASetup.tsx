import React, { useState, useEffect } from 'react'
import { TOTP } from 'otpauth'
import QRCode from 'qrcode'
import {
  QrCodeIcon,
  SmartphoneIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CopyIcon,
  ShieldCheckIcon
} from 'lucide-react'
import { mfaService } from '@/services/mfaService'

interface MFASetupProps {
  user: any
  onComplete: (secret: string, backupCodes?: string[]) => void
  onCancel: () => void
}

export const MFASetup: React.FC<MFASetupProps> = ({ user, onComplete, onCancel }) => {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup-codes'>('setup')
  const [secret, setSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [backupCodesCopied, setBackupCodesCopied] = useState(false)

  useEffect(() => {
    generateMFASecretViaMFAService()
  }, [])

  const generateMFASecretViaMFAService = async () => {
    try {
      console.log('Generating MFA secret using MFA service for user:', user.email)

      // Use the MFA service to generate the secret and QR code
      const mfaSecret = await mfaService.generateSecret(user.id, user.email)

      console.log('MFA service generated secret successfully:', {
        hasSecret: !!mfaSecret.secret,
        hasQrCode: !!mfaSecret.qrCodeUrl,
        hasBackupCodes: mfaSecret.backupCodes?.length > 0
      })

      setSecret(mfaSecret.manualEntryKey)
      setQrCodeUrl(mfaSecret.qrCodeUrl)

      // Store the backup codes for later use
      if (mfaSecret.backupCodes && mfaSecret.backupCodes.length > 0) {
        setBackupCodes(mfaSecret.backupCodes)
      }

      console.log('✅ MFA secret generated and stored via MFA service')
    } catch (error) {
      console.error('❌ Failed to generate MFA secret via service:', error)
      setError('Failed to generate MFA secret: ' + (error instanceof Error ? error.message : 'Unknown error'))

      // Fallback to manual generation if service fails
      console.log('Falling back to manual secret generation...')
      await generateMFASecretManually()
    }
  }

  const generateMFASecretManually = async () => {
    try {
      // Generate a cryptographically secure random secret (32 characters)
      const array = new Uint8Array(20) // 20 bytes = 32 base32 chars
      crypto.getRandomValues(array)
      const newSecret = Array.from(array, byte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[byte % 32]).join('')

      console.log('Generated manual secret for fallback')
      setSecret(newSecret)

      // Create TOTP instance
      const totp = new TOTP({
        issuer: 'CareXPS Healthcare CRM',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: newSecret
      })

      const totpUri = totp.toString()
      console.log('Generated TOTP URI for fallback')

      // Generate QR code with explicit options
      const qrUrl = await QRCode.toDataURL(totpUri, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      console.log('QR Code generation result:', qrUrl ? 'Success' : 'Failed')
      setQrCodeUrl(qrUrl)

      // Generate backup codes manually
      const manualBackupCodes = []
      for (let i = 0; i < 10; i++) {
        const code = Math.random().toString().slice(2, 10)
        manualBackupCodes.push(code)
      }
      setBackupCodes(manualBackupCodes)

      // Fallback: if QR code generation fails, at least show the manual setup
      if (!qrUrl) {
        setError('QR code generation failed, but you can still use manual setup below.')
      }
    } catch (error) {
      console.error('Failed to generate MFA secret manually:', error)
      setError('Failed to generate MFA secret: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const copySecretToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const generateBackupCodes = () => {
    const codes = []
    for (let i = 0; i < 10; i++) {
      // Generate 8-digit backup codes
      const code = Math.random().toString().slice(2, 10)
      codes.push(code)
    }
    setBackupCodes(codes)
    return codes
  }

  const copyBackupCodes = async () => {
    try {
      const codesText = backupCodes.join('\n')
      await navigator.clipboard.writeText(codesText)
      setBackupCodesCopied(true)
      setTimeout(() => setBackupCodesCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy backup codes:', error)
    }
  }

  const verifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      console.log('Verifying MFA code using MFA service...')

      // Use the MFA service to verify the code
      const verificationResult = await mfaService.verifyTOTP(user.id, verificationCode, false)

      console.log('MFA verification result:', verificationResult)

      if (verificationResult.success) {
        console.log('✅ MFA verification successful via service')
        // If we don't have backup codes yet, generate them
        if (backupCodes.length === 0) {
          generateBackupCodes()
        }
        setStep('backup-codes')
      } else {
        console.log('❌ MFA verification failed via service:', verificationResult.message)
        setError(verificationResult.message || 'Invalid verification code. Please try again.')
      }
    } catch (error) {
      console.error('❌ MFA service verification failed, trying manual verification:', error)

      // Fallback to manual verification
      try {
        const totp = new TOTP({
          issuer: 'CareXPS Healthcare CRM',
          label: user.email,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: secret
        })

        const isValid = totp.validate({
          token: verificationCode,
          window: 1
        }) !== null

        if (isValid) {
          console.log('✅ Manual verification successful')
          if (backupCodes.length === 0) {
            generateBackupCodes()
          }
          setStep('backup-codes')
        } else {
          setError('Invalid verification code. Please try again.')
        }
      } catch (manualError) {
        console.error('Manual verification also failed:', manualError)
        setError('Verification failed. Please try again.')
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const formatSecret = (secret: string) => {
    return secret.match(/.{1,4}/g)?.join(' ') || secret
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Set Up Multi-Factor Authentication
          </h2>
          <p className="text-gray-600">
            Secure your account with time-based one-time passwords (TOTP)
          </p>
        </div>

        {step === 'setup' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="font-semibold text-gray-900 mb-4">
                Step 1: Scan QR Code
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Use your authenticator app (Google Authenticator, Authy, etc.) to scan this QR code:
              </p>

              {qrCodeUrl ? (
                <div className="bg-white p-4 rounded-lg border border-gray-200 inline-block">
                  <img src={qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
                </div>
              ) : (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 text-sm">QR code is generating... If it doesn't appear, use the manual setup below.</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Manual Setup</h4>
              <p className="text-sm text-gray-600 mb-3">
                If you can't scan the QR code, enter this secret key manually:
              </p>
              <div className="bg-white rounded border border-gray-200 p-3 flex items-center justify-between">
                <code className="text-sm font-mono text-gray-900">
                  {formatSecret(secret)}
                </code>
                <button
                  onClick={copySecretToClipboard}
                  className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                  title="Copy to clipboard"
                >
                  <CopyIcon className="w-4 h-4" />
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 mt-1">Copied to clipboard!</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('verify')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="font-semibold text-gray-900 mb-4">
                Step 2: Verify Setup
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Enter the 6-digit code from your authenticator app to complete setup:
              </p>
            </div>

            <div>
              <input
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setVerificationCode(value)
                  setError('')
                }}
                className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={6}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircleIcon className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <SmartphoneIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Tip</h4>
                  <p className="text-sm text-blue-800">
                    The code changes every 30 seconds. If it doesn't work, wait for a new code and try again.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('setup')}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={isVerifying}
              >
                Back
              </button>
              <button
                onClick={verifyCode}
                disabled={verificationCode.length !== 6 || isVerifying}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4" />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'backup-codes' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="font-semibold text-gray-900 mb-4">
                Step 3: Save Your Backup Codes
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Save these backup codes in a safe place. You can use them to access your account if you lose your phone.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Backup Codes</h4>
                <button
                  onClick={copyBackupCodes}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <CopyIcon className="w-4 h-4" />
                  {backupCodesCopied ? 'Copied!' : 'Copy All'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <div key={index} className="bg-white rounded border border-gray-200 p-2 font-mono text-sm text-center">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900 mb-1">Important</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Each backup code can only be used once</li>
                    <li>• Store them in a secure location (password manager, safe, etc.)</li>
                    <li>• Don't share these codes with anyone</li>
                    <li>• Generate new codes if these are compromised</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('verify')}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => {
                  console.log('🎉 MFA setup complete! Secret and backup codes ready for integration.')
                  console.log('Secret length:', secret?.length)
                  console.log('Backup codes count:', backupCodes?.length)
                  onComplete(secret, backupCodes)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <CheckCircleIcon className="w-4 h-4" />
                Complete Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}