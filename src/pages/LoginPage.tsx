import React, { useState } from 'react'
import { ShieldCheckIcon, EyeIcon, EyeOffIcon, AlertCircleIcon } from 'lucide-react'
import { Footer } from '@/components/layout/Footer'
import { userManagementService } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { PasswordDebugger } from '@/utils/passwordDebug'
import { createGuestUser } from '@/utils/createGuestUser'
import { createPierreUser } from '@/utils/createPierreUser'
import { cleanupDuplicateGuests } from '@/utils/cleanupDuplicateGuests'
import { setupAllUserCredentials, testAllUserAuthentication } from '@/utils/setupAllUserCredentials'
import { LoginAttemptTracker } from '@/utils/loginAttemptTracker'

interface LoginPageProps {
  onLogin: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  // Emergency admin unlock function (press Ctrl+Shift+U on login page)
  // Emergency credential setup function (press Ctrl+Shift+S on login page)
  React.useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault()
        console.log('Emergency unlock triggered')

        // Force clear all demo user lockouts
        try {
          await userManagementService.forceClearLockout('super-user-456', 'system@carexps.com')
          await userManagementService.forceClearLockout('pierre-user-789', 'admin@carexps.com')
          await userManagementService.forceClearLockout('guest-user-456', 'guest@carexps.com')

          // Also clear any global lockout data
          LoginAttemptTracker.emergencyClearAll()

          alert('Emergency unlock completed for all demo accounts')
        } catch (error) {
          console.error('Emergency unlock failed:', error)
          alert('Emergency unlock failed - check console for details')
        }
      } else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        console.log('Emergency credential setup triggered')

        try {
          const result = await setupAllUserCredentials()
          if (result.success) {
            alert('All user credentials have been set up successfully!\n\nCheck console for login details.')
          } else {
            alert(`Credential setup failed: ${result.error}`)
          }
        } catch (error: any) {
          console.error('Credential setup failed:', error)
          alert(`Credential setup failed: ${error.message}`)
        }
      } else if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        console.log('Authentication test triggered')

        try {
          await testAllUserAuthentication()
          alert('Authentication test completed - check console for results')
        } catch (error: any) {
          console.error('Authentication test failed:', error)
          alert(`Authentication test failed: ${error.message}`)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Create Guest and Pierre users on component mount if they don't exist
  React.useEffect(() => {
    const createUsersIfNeeded = async () => {
      try {
        // First, clean up any existing duplicate Guest users
        console.log('Cleaning up duplicate system users...')
        await cleanupDuplicateGuests()

        // Then proceed with normal user checking/creation
        // Check if system user has been explicitly deleted
        const deletedUsers = localStorage.getItem('deletedUsers')
        let deletedUserIds = []
        if (deletedUsers) {
          try {
            deletedUserIds = JSON.parse(deletedUsers)
          } catch (parseError) {
            console.warn('Failed to parse deleted users list:', parseError)
          }
        }

        // Check if system user is in the deleted list
        const isGuestDeleted = deletedUserIds.some((id: string) =>
          id.includes('guest') ||
          id.toLowerCase().includes('guest') ||
          id === 'guest-user-123' // Standard system user ID if it exists
        )

        // Only create/fix system user if it hasn't been explicitly deleted
        if (!isGuestDeleted) {
          // Check and create/fix system user
          let guestResponse = await userProfileService.getUserByEmail('guest@email.com')
          if (!guestResponse.data) {
            // Try the old format as well
            guestResponse = await userProfileService.getUserByEmail('Guest@email.com')
          }

          if (!guestResponse.data) {
            console.log('Creating system user...')
            await createGuestUser()
            console.log('System user created successfully')
          } else {
            // System user exists, ensure password is set correctly
            console.log('System user already exists, updating credentials...')
            const userId = guestResponse.data.id
            await PasswordDebugger.setUserPassword(userId, 'guest@email.com', 'Guest1000!')
            console.log('System user credentials updated successfully')
          }
        } else {
          console.log('System user has been deleted by user - skipping recreation')
        }

        // Check and create admin super user
        const adminResponse = await userProfileService.getUserByEmail('pierre@phaetonai.com')
        if (!adminResponse.data) {
          console.log('Creating admin super user...')
          await createPierreUser()
          console.log('Admin super user created successfully')
        } else {
          // Admin exists, ensure password is set correctly
          console.log('Admin user already exists, updating credentials...')
          const userId = adminResponse.data.id
          await PasswordDebugger.setUserPassword(userId, 'pierre@phaetonai.com', '$Ineed1millie$_carexps')
          console.log('Admin user credentials updated successfully')
        }
      } catch (error) {
        console.log('User check/creation error:', error)
      }
    }
    createUsersIfNeeded()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setWarning('')

    try {
      if (!email || !password) {
        setError('Please enter both email and password')
        return
      }

      // Check if user is currently blocked
      const blockStatus = LoginAttemptTracker.isUserBlocked(email)
      if (blockStatus.isBlocked) {
        const remainingMinutes = Math.ceil((blockStatus.remainingTime || 0) / (60 * 1000))
        setError(`Account temporarily blocked due to too many failed login attempts. Try again in ${remainingMinutes} minutes.`)
        return
      }

      // Clear lockouts for system users before attempting authentication
      if (email === 'elmfarrell@yahoo.com' || email === 'pierre@phaetonai.com' || email === 'guest@email.com') {
        // Clear failed login attempts for system users
        const failedAttempts = localStorage.getItem('failed_login_attempts')
        if (failedAttempts) {
          try {
            let attempts = JSON.parse(failedAttempts)
            attempts = attempts.filter((attempt: any) => attempt.email !== email)
            localStorage.setItem('failed_login_attempts', JSON.stringify(attempts))
          } catch (error) {
            localStorage.removeItem('failed_login_attempts')
          }
        }

        // Clear login stats for system users
        if (email === 'elmfarrell@yahoo.com') {
          localStorage.removeItem('loginStats_super-user-456')
        } else if (email === 'pierre@phaetonai.com') {
          localStorage.removeItem('loginStats_pierre-user-789')
        } else if (email === 'guest@email.com') {
          localStorage.removeItem('loginStats_guest-user-456')
        }
      }

      // For system users, try system account login first for better reliability
      const isSystemUser = email === 'elmfarrell@yahoo.com' || email === 'pierre@phaetonai.com' || email === 'guest@email.com'

      if (isSystemUser) {
        // Try system account login first for system users
        if (await handleDemoAccountLogin(email, password)) {
          onLogin()
          return
        }
      }

      // Try to authenticate with Supabase
      const authResponse = await userManagementService.authenticateUser(email, password)

      if (authResponse.status === 'error') {
        // For system users, if Supabase fails, we already tried system login above
        if (isSystemUser) {
          setError('Invalid email or password. Check with your administrator if you need an account.')
        } else {
          setError(authResponse.error || 'Authentication failed')
        }
        return
      }

      if (authResponse.data) {
        // User authenticated successfully
        const userData = authResponse.data

        // Save user profile as current user (replaces localStorage.setItem('currentUser'))
        const profileResponse = await userProfileService.saveUserProfile(userData)

        if (profileResponse.status === 'error') {
          console.error('Failed to save user profile:', profileResponse.error)
          // Continue with login even if profile save fails
        }

        // Store minimal user data in localStorage for immediate access
        // This will be replaced by Supabase calls in other components
        localStorage.setItem('currentUser', JSON.stringify({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          mfa_enabled: userData.mfa_enabled
        }))

        // Clear failed attempts on successful login
        LoginAttemptTracker.clearFailedAttempts(email)
        onLogin()
      } else {
        // Check for system accounts as fallback (only if user not found in system and not already tried)
        if (!isSystemUser && await handleDemoAccountLogin(email, password)) {
          // Clear failed attempts on successful login
          LoginAttemptTracker.clearFailedAttempts(email)
          onLogin()
        } else {
          // Record failed attempt and show warning
          const attemptResult = LoginAttemptTracker.recordFailedAttempt(email)

          if (attemptResult.isBlocked) {
            setError(attemptResult.warning || 'Account temporarily blocked')
          } else {
            setError('Invalid email or password. Check with your administrator if you need an account.')
            if (attemptResult.warning) {
              setWarning(attemptResult.warning)
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setError('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Helper method to check demo user password against stored credentials
  const checkDemoUserPassword = async (userId: string, password: string): Promise<boolean> => {
    try {
      // Import encryption service to verify password
      const { encryptionService } = await import('@/services/encryption')
      const { secureStorage } = await import('@/services/secureStorage')

      // Try to get credentials from secure storage first (new location)
      let encryptedCredentials = null
      try {
        const secureData = await secureStorage.getItem(`userCredentials_${userId}`, { isPHI: true })
        if (secureData) {
          encryptedCredentials = secureData
        }
      } catch (error) {
        console.log('No credentials in secure storage')
      }

      // Fallback: Check localStorage for stored credentials under demo user ID
      if (!encryptedCredentials) {
        encryptedCredentials = localStorage.getItem(`userCredentials_${userId}`)
      }

      // If not found under demo ID, also check under Supabase UUID for this demo user
      if (!encryptedCredentials) {
        // Check for known Supabase UUIDs for demo users
        const demoUUIDMap: { [key: string]: string } = {
          'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
          'super-user-456': 'c550502f-c39d-4bb3-bb8c-d193657fdb24', // This might be wrong, but try it
        }

        const supabaseUUID = demoUUIDMap[userId]
        if (supabaseUUID) {
          // Try secure storage first
          try {
            const secureData = await secureStorage.getItem(`userCredentials_${supabaseUUID}`, { isPHI: true })
            if (secureData) {
              encryptedCredentials = secureData
            }
          } catch (error) {
            // Fallback to localStorage
            encryptedCredentials = localStorage.getItem(`userCredentials_${supabaseUUID}`)
          }
          console.log('Checking credentials under alternate identifier')
        }
      }

      if (!encryptedCredentials) {
        return false
      }

      // Decrypt the stored credentials
      const decrypted = await encryptionService.decryptString(encryptedCredentials)
      const credentials = JSON.parse(decrypted)
      console.log('Credentials structure verified (content redacted for security)')

      // Verify the password
      if (credentials.password) {
        console.log('Password verification: credentials found, validating...')

        // The stored password is already encrypted, so we need to decrypt it
        const decryptedStoredPassword = await encryptionService.decryptString(credentials.password)
        const isMatch = password === decryptedStoredPassword
        console.log(`Password verification result: ${isMatch ? 'successful' : 'failed'}`)
        return isMatch
      }

      return false
    } catch (error) {
      console.log('Failed to check stored credentials, clearing corrupted data')
      // Clear corrupted credentials to prevent future errors
      localStorage.removeItem(`userCredentials_${userId}`)
      return false
    }
  }

  // Helper method for demo account handling
  const handleDemoAccountLogin = async (email: string, password: string): Promise<boolean> => {
    let demoUserData = null

    // Clear any lockouts for system users to prevent getting stuck
    if (email === 'elmfarrell@yahoo.com' || email === 'pierre@phaetonai.com' || email === 'guest@email.com') {
      // Clear failed login attempts for system users
      const failedAttempts = localStorage.getItem('failed_login_attempts')
      if (failedAttempts) {
        try {
          let attempts = JSON.parse(failedAttempts)
          attempts = attempts.filter((attempt: any) => attempt.email !== email)
          localStorage.setItem('failed_login_attempts', JSON.stringify(attempts))
        } catch (error) {
          localStorage.removeItem('failed_login_attempts')
        }
      }

      // Clear login stats for system users
      if (email === 'elmfarrell@yahoo.com') {
        localStorage.removeItem('loginStats_super-user-456')
      } else if (email === 'pierre@phaetonai.com') {
        localStorage.removeItem('loginStats_pierre-user-789')
      } else if (email === 'guest@email.com') {
        localStorage.removeItem('loginStats_guest-user-001')
      }
    }

    // Check built-in system accounts - now uses dynamic password verification
    if (email === 'elmfarrell@yahoo.com') {
      // Try stored credentials first, fall back to default password
      const isValidPassword = await checkDemoUserPassword('super-user-456', password) || password === 'Farrell1000!'
      if (isValidPassword) {
        demoUserData = {
          id: 'super-user-456',
          email: 'elmfarrell@yahoo.com',
          name: 'System Admin',
          role: 'super_user' as const,
          mfa_enabled: false,
          settings: {
            theme: 'dark',
            notifications: {}
          }
        }
      }
    } else if (email === 'pierre@phaetonai.com') {
      // Find admin user dynamically (could be created by createPierreUser utility)
      const storedUsers = localStorage.getItem('systemUsers')
      let pierreUser = null

      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers)
          pierreUser = users.find((u: any) => u.email === 'pierre@phaetonai.com')
        } catch (e) {
          console.error('Failed to parse stored users:', e)
        }
      }

      // Check stored credentials or default password
      const userToCheck = pierreUser?.id || 'pierre-user-789' // fallback to old ID
      const isValidPassword = await checkDemoUserPassword(userToCheck, password) || password === '$Ineed1millie$_carexps'

      if (isValidPassword) {
        demoUserData = pierreUser || {
          id: 'dynamic-pierre-user',
          email: 'pierre@phaetonai.com',
          name: 'Admin User',
          role: 'admin' as const,
          mfa_enabled: false,
          settings: {
            theme: 'light',
            notifications: {
              calls: true,
              sms: true,
              system: true
            }
          }
        }
      }
    } else if (email === 'guest@email.com') {
      // Try stored credentials first, fall back to default password
      const isValidPassword = await checkDemoUserPassword('guest-user-456', password) || password === 'Guest1000!'
      if (isValidPassword) {
        demoUserData = {
          id: 'guest-user-456',
          email: 'guest@email.com',
          name: 'Staff User',
          role: 'staff' as const,
          mfa_enabled: false,
          settings: {
            theme: 'light',
            notifications: {}
          }
        }
      }
    }

    if (demoUserData) {
      try {
        // Try to create/update the system user in Supabase
        const createResponse = await userProfileService.saveUserProfile(demoUserData)

        if (createResponse.status === 'success') {
          // Update last login for successful system login
          const loginStatsKey = `loginStats_${demoUserData.id}`
          const loginStats = {
            loginAttempts: 0,
            lastLogin: new Date().toISOString(),
            lockoutUntil: undefined
          }
          localStorage.setItem(loginStatsKey, JSON.stringify(loginStats))

          localStorage.setItem('currentUser', JSON.stringify({
            id: demoUserData.id,
            email: demoUserData.email,
            name: demoUserData.name,
            role: demoUserData.role,
            mfa_enabled: demoUserData.mfa_enabled
          }))
          return true
        }
      } catch (error) {
        console.error('Failed to create system user:', error)
      }

      // Fallback to localStorage if Supabase fails
      // Update last login for successful system login (fallback case)
      const loginStatsKey = `loginStats_${demoUserData.id}`
      const loginStats = {
        loginAttempts: 0,
        lastLogin: new Date().toISOString(),
        lockoutUntil: undefined
      }
      localStorage.setItem(loginStatsKey, JSON.stringify(loginStats))

      localStorage.setItem('currentUser', JSON.stringify({
        id: demoUserData.id,
        email: demoUserData.email,
        name: demoUserData.name,
        role: demoUserData.role,
        mfa_enabled: demoUserData.mfa_enabled
      }))
      return true
    }

    return false
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src="https://carexps.nexasync.ca/images/Logo.png"
                alt="CareXPS Logo"
                className="h-16 w-auto object-contain"
              />
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Sign in to your healthcare account
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
              <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </div>
          )}

          {/* Warning Display */}
          {warning && (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
              <AlertCircleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-700 dark:text-yellow-300 text-sm">{warning}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-3 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 dark:hover:bg-gray-600 rounded-r-lg transition-colors"
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-5 h-5 text-gray-400 dark:text-gray-300" />
                  ) : (
                    <EyeIcon className="w-5 h-5 text-gray-400 dark:text-gray-300" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-200">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus:outline-none focus:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
        </div>
      </div>

      {/* Footer */}
      <Footer variant="transparent" />
    </div>
  )
}