/**
 * 🆕 FRESH MFA VERIFICATION COMPONENT - Built from scratch with zero corruption
 *
 * This is a completely new, clean MFA verification component for login that:
 * - Uses the fresh MFA service
 * - Clean UI with no legacy code
 * - Proper error handling
 * - Simple, reliable verification flow
 */

import React, { useState, useEffect } from 'react'
import { Shield, AlertCircle, Key, ArrowLeft, Lock, FileText } from 'lucide-react'
import FreshMfaService from '../../services/freshMfaService'
import { MfaLockoutService } from '../../services/mfaLockoutService'

interface LockoutStatus {
  isLocked: boolean
  attemptsRemaining: number
  lockoutEnds?: Date
  remainingTime?: number
}

interface FreshMfaVerificationProps {
  userId: string
  userEmail: string
  onVerificationSuccess: () => void
  onCancel?: () => void
  showCancel?: boolean
  lockoutStatus?: LockoutStatus
}

export const FreshMfaVerification: React.FC<FreshMfaVerificationProps> = ({
  userId,
  userEmail,
  onVerificationSuccess,
  onCancel,
  showCancel = true,
  lockoutStatus: initialLockoutStatus
}) => {
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus | null>(initialLockoutStatus || null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [remainingBackupCodes, setRemainingBackupCodes] = useState<number>(0)

  /**
   * Load remaining backup codes count
   */
  useEffect(() => {
    const loadBackupCodesCount = async () => {
      try {
        const count = await FreshMfaService.getRemainingBackupCodesCount(userId)
        setRemainingBackupCodes(count)
      } catch (error) {
        console.error('Failed to load backup codes count:', error)
        setRemainingBackupCodes(0)
      }
    }

    loadBackupCodesCount()
  }, [userId])

  /**
   * Update lockout status periodically and enforce on component load
   */
  useEffect(() => {
    const updateLockoutStatus = () => {
      const currentStatus = MfaLockoutService.getLockoutStatus(userId, userEmail)
      setLockoutStatus(currentStatus)

      if (currentStatus.isLocked && currentStatus.remainingTime) {
        const timeLeft = MfaLockoutService.formatTimeRemaining(currentStatus.remainingTime)
        setTimeRemaining(timeLeft)
        // SECURITY FIX: Set error immediately if user is locked out on component load
        setError(`Account is locked out. Please try again in ${timeLeft}.`)
      } else {
        setTimeRemaining('')
        // Note: Error clearing handled by user interaction to avoid dependency cycles
      }
    }

    // Update immediately on component mount - prevents bypass
    updateLockoutStatus()

    // Update every 30 seconds
    const interval = setInterval(updateLockoutStatus, 30000)

    return () => clearInterval(interval)
  }, [userId, userEmail])

  /**
   * Handle verification (TOTP or backup code) for login with attempt limiting
   */
  const handleVerifyCode = async () => {
    const expectedLength = useBackupCode ? 8 : 6
    const codeType = useBackupCode ? 'backup code' : 'verification code'

    if (!verificationCode || verificationCode.length !== expectedLength) {
      setError(`Please enter a ${expectedLength}-digit ${codeType}`)
      return
    }

    // SECURITY FIX: Always check current lockout status before attempting verification
    const currentLockoutStatus = MfaLockoutService.getLockoutStatus(userId, userEmail)
    setLockoutStatus(currentLockoutStatus) // Update component state

    if (currentLockoutStatus.isLocked) {
      const timeLeft = MfaLockoutService.formatTimeRemaining(currentLockoutStatus.remainingTime!)
      setError(`Account is locked out. Please try again in ${timeLeft}.`)
      setTimeRemaining(timeLeft)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 FreshMFA: Verifying login code...')

      const isValid = useBackupCode
        ? await FreshMfaService.verifyBackupCode(userId, verificationCode)
        : await FreshMfaService.verifyLoginCode(userId, verificationCode)

      if (isValid) {
        console.log('✅ MFA verification successful - granting access')

        // SECURITY FIX: Clear MFA lockout attempts on successful verification
        await MfaLockoutService.clearMfaAttempts(userId, userEmail)

        onVerificationSuccess()
      } else {
        console.log('❌ MFA verification failed - recording attempt')

        // Record failed attempt and check if lockout should be triggered
        const updatedLockoutStatus = await MfaLockoutService.recordFailedMfaAttempt(userId, userEmail)
        setLockoutStatus(updatedLockoutStatus)

        if (updatedLockoutStatus.isLocked) {
          const timeLeft = MfaLockoutService.formatTimeRemaining(updatedLockoutStatus.remainingTime!)
          setError(`Too many failed attempts. Account locked for ${timeLeft}. Please try again later.`)
          setTimeRemaining(timeLeft)
        } else {
          const remaining = updatedLockoutStatus.attemptsRemaining
          setError(`Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`)
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
    const expectedLength = useBackupCode ? 8 : 6
    if (e.key === 'Enter' && verificationCode.length === expectedLength) {
      handleVerifyCode()
    }
  }

  /**
   * Handle input change with validation
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxLength = useBackupCode ? 8 : 6
    const value = e.target.value.replace(/\D/g, '').slice(0, maxLength)
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
          {useBackupCode
            ? 'Enter one of your 8-digit backup codes'
            : 'Enter the 6-digit code from your authenticator app'
          }
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

      {/* Input Mode Toggle */}
      <div className="mb-4 flex justify-center space-x-4">
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(false)
            setVerificationCode('')
            setError(null)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !useBackupCode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Key className="w-4 h-4 inline mr-2" />
          Authenticator App
        </button>

        {remainingBackupCodes > 0 && (
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(true)
              setVerificationCode('')
              setError(null)
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              useBackupCode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Backup Code ({remainingBackupCodes} left)
          </button>
        )}
      </div>

      {/* Verification Code Input */}
      <div className="space-y-4">
        <div>
          <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
            {useBackupCode ? 'Backup Code' : 'Verification Code'}
          </label>
          <input
            id="verification-code"
            type="text"
            value={verificationCode}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={useBackupCode ? "12345678" : "000000"}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={useBackupCode ? 8 : 6}
            autoComplete="one-time-code"
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1 text-center">
            {useBackupCode
              ? `Enter one of your 8-digit backup codes (${remainingBackupCodes} remaining)`
              : 'Enter the 6-digit code from your authenticator app'
            }
          </p>
        </div>

        <button
          onClick={handleVerifyCode}
          disabled={isLoading || verificationCode.length !== (useBackupCode ? 8 : 6) || (lockoutStatus?.isLocked || false)}
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

      {/* Lockout Status Display */}
      {lockoutStatus && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          {lockoutStatus.isLocked ? (
            <div className="flex items-center text-red-600">
              <Lock className="w-5 h-5 mr-2" />
              <div>
                <p className="font-medium">Account Temporarily Locked</p>
                <p className="text-sm text-gray-600">
                  Too many failed attempts. Try again in {timeRemaining}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center text-amber-600">
              <AlertCircle className="w-5 h-5 mr-2" />
              <div>
                <p className="font-medium">Verification Attempts</p>
                <p className="text-sm text-gray-600">
                  {lockoutStatus.attemptsRemaining} attempt{lockoutStatus.attemptsRemaining !== 1 ? 's' : ''} remaining before 30-minute lockout
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Back/Cancel Button */}
      {showCancel && onCancel && (
        <div className="mt-6 text-center">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mt-4 flex justify-center space-x-2">
        {[...Array(useBackupCode ? 8 : 6)].map((_, index) => (
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