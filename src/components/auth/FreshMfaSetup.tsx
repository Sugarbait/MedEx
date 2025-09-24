/**
 * 🆕 FRESH MFA SETUP COMPONENT - Built from scratch with zero corruption
 *
 * This is a completely new, clean MFA setup component that:
 * - Uses the fresh MFA service
 * - Clean UI with no legacy code
 * - Proper error handling
 * - Simple, reliable flow
 */

import React, { useState } from 'react'
import { QrCode, Shield, Copy, Check, AlertCircle, Key } from 'lucide-react'
import { FreshMfaService } from '../../services/freshMfaService'

interface FreshMfaSetupProps {
  userId: string
  userEmail: string
  onSetupComplete: () => void
  onCancel: () => void
}

export const FreshMfaSetup: React.FC<FreshMfaSetupProps> = ({
  userId,
  userEmail,
  onSetupComplete,
  onCancel
}) => {
  const [step, setStep] = useState<'generate' | 'verify'>('generate')
  const [setupData, setSetupData] = useState<any>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)
  const [backupCodesCopied, setBackupCodesCopied] = useState(false)

  /**
   * Generate fresh MFA setup
   */
  const handleGenerateSetup = async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🆕 Generating fresh MFA setup...')

      const freshSetup = await FreshMfaService.generateMfaSetup(userId, userEmail)

      setSetupData(freshSetup)
      setStep('verify')

      console.log('✅ Fresh MFA setup generated successfully')
    } catch (error) {
      console.error('❌ Fresh MFA setup generation failed:', error)
      setError(error instanceof Error ? error.message : 'Setup generation failed')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Verify TOTP code and complete setup
   */
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit verification code')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Verifying TOTP code...')

      const result = await FreshMfaService.verifyAndEnableMfa(userId, verificationCode)

      if (result.success) {
        console.log('✅ MFA setup completed successfully')
        onSetupComplete()
      } else {
        setError(result.message)
      }
    } catch (error) {
      console.error('❌ MFA verification failed:', error)
      setError('Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Copy text to clipboard
   */
  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    try {
      await navigator.clipboard.writeText(text)

      if (type === 'secret') {
        setSecretCopied(true)
        setTimeout(() => setSecretCopied(false), 2000)
      } else {
        setBackupCodesCopied(true)
        setTimeout(() => setBackupCodesCopied(false), 2000)
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  /**
   * Format secret for display (add spaces every 4 characters)
   */
  const formatSecret = (secret: string) => {
    return secret.replace(/(.{4})/g, '$1 ').trim()
  }

  if (step === 'generate') {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Setup Multi-Factor Authentication</h2>
          <p className="text-gray-600 mt-2">
            Secure your account with time-based one-time passwords (TOTP)
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">What you'll need:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• An authenticator app (Google Authenticator, Authy, etc.)</li>
              <li>• Your mobile device with camera for QR scanning</li>
              <li>• A secure place to store backup codes</li>
            </ul>
          </div>

          <button
            onClick={handleGenerateSetup}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Generating Setup...
              </>
            ) : (
              <>
                <Key className="w-5 h-5 mr-2" />
                Generate MFA Setup
              </>
            )}
          </button>

          <button
            onClick={onCancel}
            className="w-full px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Scan QR Code</h2>
        <p className="text-gray-600 mt-2">
          Add this account to your authenticator app
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* QR Code Section */}
        <div className="text-center">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
            {setupData?.qrCodeUrl && (
              <img
                src={setupData.qrCodeUrl}
                alt="MFA QR Code"
                className="w-48 h-48"
              />
            )}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Scan this QR code with your authenticator app
          </p>
        </div>

        {/* Manual Entry Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or enter this secret manually:
            </label>
            <div className="bg-gray-50 p-3 rounded-lg border">
              <code className="text-sm font-mono break-all">
                {setupData?.secret ? formatSecret(setupData.secret) : ''}
              </code>
              <button
                onClick={() => copyToClipboard(setupData?.secret || '', 'secret')}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                {secretCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Backup Codes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Backup Codes (save these securely):
            </label>
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs">
              <div className="grid grid-cols-2 gap-1">
                {setupData?.backupCodes?.map((code: string, index: number) => (
                  <code key={index} className="font-mono">{code}</code>
                ))}
              </div>
              <button
                onClick={() => copyToClipboard(setupData?.backupCodes?.join('\n') || '', 'backup')}
                className="mt-2 text-yellow-700 hover:text-yellow-900 flex items-center text-sm"
              >
                {backupCodesCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy All Codes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Section */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Verify Setup</h3>
        <p className="text-gray-600 mb-4">
          Enter the 6-digit code from your authenticator app to complete setup:
        </p>

        <div className="flex space-x-4">
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={6}
          />

          <button
            onClick={handleVerifyCode}
            disabled={isLoading || verificationCode.length !== 6}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Complete Setup'
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={onCancel}
          className="text-gray-600 hover:text-gray-800 underline"
        >
          Cancel Setup
        </button>
      </div>
    </div>
  )
}