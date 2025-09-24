/**
 * TOTP Verification Component - Fresh Implementation
 * Handles TOTP code verification for login
 */

import React, { useState, useEffect, useRef } from 'react'
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react'
import { cleanTotpService } from '../../services/cleanTotpService'

interface TOTPVerificationProps {
  userId: string
  onVerificationSuccess: () => void
  onCancel?: () => void
  title?: string
  subtitle?: string
  allowBackupCodes?: boolean
}

const TOTPVerification: React.FC<TOTPVerificationProps> = ({
  userId,
  onVerificationSuccess,
  onCancel,
  title = "Two-Factor Authentication",
  subtitle = "Enter the 6-digit code from your authenticator app",
  allowBackupCodes = true
}) => {
  const [code, setCode] = useState<string>('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string>('')
  const [showBackupInput, setShowBackupInput] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(30)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // TOTP timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = 30 - (now % 30)
      setTimeRemaining(remaining)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const handleCodeChange = (value: string) => {
    // For backup codes, allow longer input
    if (showBackupInput) {
      const cleanValue = value.replace(/\D/g, '').slice(0, 8)
      setCode(cleanValue)
    } else {
      // For TOTP codes, limit to 6 digits
      const cleanValue = value.replace(/\D/g, '').slice(0, 6)
      setCode(cleanValue)
    }
    setError('')
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!code.trim()) {
      setError('Please enter a code')
      return
    }

    // Validate code length
    const expectedLength = showBackupInput ? 8 : 6
    if (code.length !== expectedLength) {
      setError(`Please enter a valid ${expectedLength}-digit code`)
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const result = await cleanTotpService.verifyTOTP(userId, code.trim(), false)

      if (result.success) {
        onVerificationSuccess()
      } else {
        setError(result.error || 'Invalid code. Please try again.')
        setCode('')
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }
    } catch (error) {
      console.error('TOTP verification failed:', error)
      setError('Verification failed. Please try again.')
      setCode('')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim()) {
      handleSubmit()
    }
  }

  const toggleBackupInput = () => {
    setShowBackupInput(!showBackupInput)
    setCode('')
    setError('')
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <Shield className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600">{subtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={showBackupInput ? "12345678" : "000000"}
              className="w-full text-center text-2xl font-mono p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              maxLength={showBackupInput ? 8 : 6}
              autoComplete="off"
              inputMode="numeric"
            />
            {!showBackupInput && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="flex items-center space-x-1">
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 font-mono">
                    {timeRemaining}s
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="text-center mt-3">
            <p className="text-xs text-gray-500">
              {showBackupInput
                ? "Enter 8-digit backup code"
                : "Code refreshes every 30 seconds"
              }
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="submit"
            disabled={isVerifying || !code.trim() || (showBackupInput ? code.length !== 8 : code.length !== 6)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </button>

          {allowBackupCodes && (
            <button
              type="button"
              onClick={toggleBackupInput}
              className="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              {showBackupInput
                ? "Use authenticator app instead"
                : "Use backup code instead"
              }
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Open your authenticator app (Google Authenticator, Authy, etc.) and enter the current 6-digit code for CareXPS Healthcare CRM.
        </p>
      </div>
    </div>
  )
}

export default TOTPVerification