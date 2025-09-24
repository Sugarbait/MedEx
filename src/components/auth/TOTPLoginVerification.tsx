/**
 * TOTP Login Verification Component
 * Shows MFA verification screen during login process
 */

import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle } from 'lucide-react'
import { totpService } from '../../services/totpService'

interface TOTPLoginVerificationProps {
  user: any
  onVerificationSuccess: () => void
  onCancel: () => void
}

const TOTPLoginVerification: React.FC<TOTPLoginVerificationProps> = ({
  user,
  onVerificationSuccess,
  onCancel
}) => {
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string>('')
  const [attempts, setAttempts] = useState(0)

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

  const handleVerification = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      console.log('🔍 Login MFA: Verifying TOTP code for user:', user.id)
      const result = await totpService.verifyTOTP(user.id, verificationCode.trim())

      if (result.success) {
        console.log('✅ Login MFA: TOTP verification successful')
        onVerificationSuccess()
      } else {
        console.log('❌ Login MFA: TOTP verification failed')
        const newAttempts = attempts + 1
        setAttempts(newAttempts)

        if (newAttempts >= 3) {
          setError('Too many failed attempts. Please try logging in again.')
          setTimeout(() => onCancel(), 2000)
        } else {
          setError(result.error || `Invalid code. ${3 - newAttempts} attempts remaining.`)
        }
        setVerificationCode('')
      }
    } catch (error) {
      console.error('❌ Login MFA: TOTP verification error:', error)
      setError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && verificationCode.length === 6 && !isVerifying) {
      handleVerification()
    }
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
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Enter the 6-digit code from your authenticator app
          </p>

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
              className="w-full text-center text-2xl font-mono p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              maxLength={6}
              autoFocus
              autoComplete="off"
              disabled={isVerifying}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Enter your 6-digit authentication code
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
              disabled={isVerifying || verificationCode.length !== 6}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              {isVerifying ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TOTPLoginVerification