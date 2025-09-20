import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ShieldCheckIcon, LogOutIcon } from 'lucide-react'

export const MFAPage: React.FC = () => {
  const { completeMFA, mfaChallenge, logout } = useAuth()
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const success = await completeMFA(code)
      if (!success) {
        setError('Invalid verification code. Please try again.')
      }
    } catch (error) {
      setError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-neutral-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logout Button - Top Right */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-gray-100 transition-colors"
            title="Logout to allow another user to access the system"
          >
            <LogOutIcon className="w-4 h-4" />
            Switch User
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center">
              <ShieldCheckIcon className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-gray-100 mb-2">
            Two-Factor Authentication
          </h1>
          <p className="text-neutral-600 dark:text-gray-400">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* MFA Form */}
        <form onSubmit={handleSubmit} className="healthcare-card">
          <div className="mb-6">
            <label
              htmlFor="mfa-code"
              className="block text-sm font-medium text-neutral-900 dark:text-gray-100 mb-2">
              Verification Code
            </label>
            <input
              id="mfa-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="healthcare-input text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 dark:bg-red-900/20 border border-danger-200 dark:border-red-600 rounded-md">
              <p className="text-sm text-danger-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={code.length !== 6 || isVerifying}
            className="w-full healthcare-button-primary flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShieldCheckIcon className="w-5 h-5" />
            )}
            {isVerifying ? 'Verifying...' : 'Verify Code'}
          </button>

          <div className="mt-4 text-center">
            <p className="text-sm text-neutral-600">
              Code expires in 5 minutes
            </p>
          </div>
        </form>

        {/* Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600 dark:text-gray-400">
            Having trouble? Contact your system administrator.
          </p>
          <p className="text-xs text-neutral-500 dark:text-gray-500 mt-2">
            Need to let another user access the system? Use "Switch User" above.
          </p>
        </div>
      </div>
    </div>
  )
}