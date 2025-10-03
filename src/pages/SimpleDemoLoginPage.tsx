import React, { useState } from 'react'
import { ShieldCheckIcon, EyeIcon, EyeOffIcon, InfoIcon } from 'lucide-react'
import { demoAuthService } from '@/services/demoAuthService'

interface SimpleDemoLoginPageProps {
  onLogin: () => void
}

export const SimpleDemoLoginPage: React.FC<SimpleDemoLoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showMFA, setShowMFA] = useState(false)
  const [pendingUserId, setPendingUserId] = useState('')

  const demoUsers = demoAuthService.getDemoUsers()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (!email || !password) {
        setError('Please enter both email and password')
        return
      }

      // Check if demo user
      if (!demoAuthService.isDemo(email)) {
        setError('This is a demo environment. Please use one of the demo accounts shown below.')
        return
      }

      // Attempt login
      const result = demoAuthService.login(email, password)

      if (!result.success) {
        setError(result.error || 'Login failed')
        return
      }

      const user = result.user!

      // Store user data
      localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfaEnabled: user.mfaEnabled
      }))

      // Check if MFA is required
      if (user.mfaEnabled) {
        setPendingUserId(user.id)
        setShowMFA(true)
        setError('')
      } else {
        // No MFA required, proceed to login
        onLogin()
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (!mfaCode) {
        setError('Please enter the MFA code')
        return
      }

      const result = demoAuthService.verifyMFA(pendingUserId, mfaCode)

      if (!result.success) {
        setError(result.error || 'Invalid MFA code')
        return
      }

      // MFA verified, proceed to login
      onLogin()
    } catch (err: any) {
      setError(err.message || 'MFA verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  const fillDemoCredentials = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
    setError('')
  }

  if (showMFA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src="/images/medex-logo.png"
              alt="MedEx Logo"
              className="max-h-20 w-auto mx-auto mb-4 object-contain"
            />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">MFA Verification</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Enter your MFA code to continue</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleMFASubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  MFA Code
                </label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="123456"
                  maxLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Verifying...' : 'Verify MFA'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMFA(false)
                  setMfaCode('')
                  setPendingUserId('')
                }}
                className="w-full text-blue-600 hover:text-blue-700 text-sm"
              >
                ← Back to login
              </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <InfoIcon className="inline w-4 h-4 mr-1" />
                Demo MFA code: <strong>123456</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/images/medex-logo.png"
            alt="MedEx Logo"
            className="max-h-20 w-auto mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">MedEx Healthcare CRM</h1>
          <p className="text-gray-600 dark:text-gray-400">HIPAA-Compliant Healthcare Platform</p>
        </div>

        {/* Login Form - Centered */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-center mb-4">
              <ShieldCheckIcon className="w-12 h-12 text-blue-600 mx-auto mb-2" />
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Sign In</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Enter your credentials to continue</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="admin@medex.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
        </div>
      </div>
    </div>
  )
}
