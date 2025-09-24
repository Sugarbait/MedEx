/**
 * TOTP Login Verification Component
 * Shows MFA verification screen during login process
 */

import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle, Clock } from 'lucide-react'
import { totpService } from '../../services/totpService'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '../../services/auditLogger'

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
  const [timeoutMinutes, setTimeoutMinutes] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)

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
          codeLength: verificationCode.length
        }
      )

      const result = await totpService.verifyTOTP(user.id, verificationCode.trim())

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
            totalAttempts: attempts + 1
          }
        )

        onVerificationSuccess()
      } else {
        console.log('❌ SECURITY: TOTP verification failed')
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
          setTimeoutMinutes(15) // 15 minute lockout
          setError('Too many failed attempts. Account locked for 15 minutes.')

          // Log account lockout
          await auditLogger.logPHIAccess(
            AuditAction.LOGIN_FAILURE,
            ResourceType.SYSTEM,
            `mfa-lockout-${user.id}`,
            AuditOutcome.FAILURE,
            {
              operation: 'mfa_account_locked',
              userId: user.id,
              lockoutDuration: '15 minutes',
              totalFailedAttempts: newAttempts
            }
          )

          setTimeout(() => {
            console.log('🚫 SECURITY: Automatically cancelling MFA verification due to lockout')
            onCancel()
          }, 3000)
        } else {
          const remainingAttempts = 3 - newAttempts
          setError(result.error || `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`)
        }
        setVerificationCode('')
      }
    } catch (error: any) {
      console.error('❌ SECURITY: TOTP verification error:', error)

      // Log verification system error
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN_FAILURE,
        ResourceType.SYSTEM,
        `mfa-error-${user.id}`,
        AuditOutcome.FAILURE,
        {
          operation: 'mfa_verification_error',
          userId: user.id,
          error: error.message || 'Unknown error'
        }
      )

      setError(`Verification failed: ${error.message || 'Please try again.'}`)
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
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Enter the 6-digit code from your authenticator app
          </p>
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
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed'
              }`}
            >
              {isLocked
                ? `Locked (${timeoutMinutes}m)`
                : isVerifying
                ? 'Verifying...'
                : 'Verify & Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TOTPLoginVerification