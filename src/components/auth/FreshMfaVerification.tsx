/**
 * 🆕 FRESH MFA VERIFICATION COMPONENT - Built from scratch with zero corruption
 *
 * This is a completely new, clean MFA verification component for login that:
 * - Uses the fresh MFA service
 * - Clean UI with no legacy code
 * - Proper error handling
 * - Simple, reliable verification flow
 */

import React, { useState } from 'react'
import { Shield, AlertCircle, Key, ArrowLeft } from 'lucide-react'
import { FreshMfaService } from '../../services/freshMfaService'

interface FreshMfaVerificationProps {
  userId: string
  userEmail: string
  onVerificationSuccess: () => void
  onCancel?: () => void
  showCancel?: boolean
}

export const FreshMfaVerification: React.FC<FreshMfaVerificationProps> = ({
  userId,
  userEmail,
  onVerificationSuccess,
  onCancel,
  showCancel = true
}) => {
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  /**
   * Handle TOTP code verification for login
   */
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit verification code')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 FreshMFA: Verifying login code...')

      const isValid = await FreshMfaService.verifyLoginCode(userId, verificationCode)

      if (isValid) {
        console.log('✅ MFA verification successful - granting access')
        onVerificationSuccess()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)

        console.log('❌ MFA verification failed, attempt:', newAttempts)

        if (newAttempts >= 5) {
          setError('Too many failed attempts. Please try again later or contact support.')
        } else {
          setError(`Invalid verification code. ${5 - newAttempts} attempts remaining.`)
        }

        // Clear the input for retry
        setVerificationCode('')
      }
    } catch (error) {
      console.error('❌ MFA verification error:', error)
      setError('Verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle key press for Enter key submission
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && verificationCode.length === 6) {
      handleVerifyCode()
    }
  }

  /**
   * Handle input change with validation
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setVerificationCode(value)

    // Clear error when user starts typing
    if (error) {
      setError(null)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Multi-Factor Authentication</h2>
        <p className="text-gray-600 mt-2">
          Enter the 6-digit code from your authenticator app
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Signed in as: <span className="font-medium">{userEmail}</span>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Verification Code Input */}
      <div className="space-y-4">
        <div>
          <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
            Verification Code
          </label>
          <input
            id="verification-code"
            type="text"
            value={verificationCode}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="000000"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1 text-center">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <button
          onClick={handleVerifyCode}
          disabled={isLoading || verificationCode.length !== 6 || attempts >= 5}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Verifying...
            </>
          ) : (
            <>
              <Key className="w-5 h-5 mr-2" />
              Verify Code
            </>
          )}
        </button>
      </div>

      {/* Help Section */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Having trouble?</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Make sure your device's time is correct</li>
          <li>• Try refreshing your authenticator app</li>
          <li>• Wait for the code to refresh if it's about to expire</li>
          <li>• Check that you're using the correct account in your app</li>
        </ul>
      </div>

      {/* Back/Cancel Button */}
      {showCancel && onCancel && (
        <div className="mt-6 text-center">
          <button
            onClick={onCancel}
            className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mt-4 flex justify-center space-x-2">
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-full transition-colors ${
              index < verificationCode.length
                ? 'bg-blue-600'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}