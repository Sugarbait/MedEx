import React, { useState } from 'react'
import { ShieldCheckIcon, KeyIcon, AlertTriangleIcon } from 'lucide-react'
import { mfaService } from '@/services/mfaService'

interface MFAGateProps {
  onSuccess: () => void
  user: any
}

export const MFAGate: React.FC<MFAGateProps> = ({ onSuccess, user }) => {
  const [mfaCode, setMfaCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsVerifying(true)
    setError('')

    try {
      console.log('🔐 Attempting MFA verification for user:', user.email)

      // Use the MFA service to verify the code
      const verificationResult = await mfaService.verifyTOTP(user.id, mfaCode, false)

      console.log('MFA verification result:', verificationResult)

      if (verificationResult.success) {
        console.log('✅ MFA verification successful')
        onSuccess()
        return
      } else {
        console.log('❌ MFA verification failed:', verificationResult.message)
        setError(verificationResult.message || 'Invalid MFA code. Please try again.')
        return
      }

    } catch (error) {
      console.error('❌ MFA verification error:', error)
      setError('MFA verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
      setMfaCode('')
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
            <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Multi-Factor Authentication
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            HIPAA compliance requires additional verification for {user?.name}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="mfa-code" className="sr-only">
              Verification Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="mfa-code"
                name="mfa-code"
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit code"
                className="appearance-none rounded-lg relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangleIcon className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isVerifying || mfaCode.length !== 6}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </button>

          </div>
        </form>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                HIPAA Compliance Notice
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  This additional authentication step is required to protect patient health information (PHI)
                  in accordance with HIPAA security regulations.
                </p>
                <p className="mt-2 text-xs">
                  Use your authenticator app or backup codes to generate the verification code.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}