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

interface LoginPageProps {
  onLogin: () => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Emergency admin unlock function (press Ctrl+Shift+U on login page)
  // Emergency credential setup function (press Ctrl+Shift+S on login page)
  React.useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault()
        console.log('Emergency unlock triggered')

        // Force clear all demo user lockouts
        try {
          await userManagementService.forceClearLockout('super-user-456', 'elmfarrell@yahoo.com')
          await userManagementService.forceClearLockout('pierre-user-789', 'pierre@phaetonai.com')
          await userManagementService.forceClearLockout('guest-user-456', 'guest@email.com')

          // Also clear any global lockout data
          localStorage.removeItem('failed_login_attempts')

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
        console.log('Cleaning up duplicate Guest users...')
        await cleanupDuplicateGuests()

        // Then proceed with normal user checking/creation
        // Check if Guest user has been explicitly deleted by the user
        const deletedUsers = localStorage.getItem('deletedUsers')
        let deletedUserIds = []
        if (deletedUsers) {
          try {
            deletedUserIds = JSON.parse(deletedUsers)
          } catch (parseError) {
            console.warn('Failed to parse deleted users list:', parseError)
          }
        }

        // Check if Guest user is in the deleted list (check for both possible Guest user IDs)
        const isGuestDeleted = deletedUserIds.some((id: string) =>
          id.includes('guest') ||
          id.toLowerCase().includes('guest') ||
          id === 'guest-user-123' // Standard Guest user ID if it exists
        )

        // Only create/fix Guest user if it hasn't been explicitly deleted
        if (!isGuestDeleted) {
          // Check and create/fix Guest user (try both email formats)
          let guestResponse = await userProfileService.getUserByEmail('guest@email.com')
          if (!guestResponse.data) {
            // Try the old format as well
            guestResponse = await userProfileService.getUserByEmail('Guest@email.com')
          }

          if (!guestResponse.data) {
            console.log('Creating Guest user...')
            await createGuestUser()
            console.log('Guest user created successfully')
          } else {
            // Guest user exists, ensure password is set correctly
            console.log('Guest user already exists, fixing password...')
            const userId = guestResponse.data.id
            await PasswordDebugger.setUserPassword(userId, 'guest@email.com', 'Guest1000!')
            console.log('Guest user password fixed')
          }
        } else {
          console.log('Guest user has been deleted by user - skipping recreation')
        }

        // Check and create Pierre super user
        const pierreResponse = await userProfileService.getUserByEmail('pierre@phaetonai.com')
        if (!pierreResponse.data) {
          console.log('Creating Pierre super user...')
          await createPierreUser()
          console.log('Pierre super user created successfully')
        } else {
          // Pierre exists, ensure password is set correctly
          console.log('Pierre user already exists, fixing password...')
          const userId = pierreResponse.data.id
          await PasswordDebugger.setUserPassword(userId, 'pierre@phaetonai.com', '$Ineed1millie$_carexps')
          console.log('Pierre user password fixed')
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

    try {
      if (!email || !password) {
        setError('Please enter both email and password')
        return
      }

      // Clear lockouts for demo users before attempting authentication
      if (email === 'elmfarrell@yahoo.com' || email === 'pierre@phaetonai.com' || email === 'guest@email.com') {
        // Clear failed login attempts for demo users
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

        // Clear login stats for demo users
        if (email === 'elmfarrell@yahoo.com') {
          localStorage.removeItem('loginStats_super-user-456')
        } else if (email === 'pierre@phaetonai.com') {
          localStorage.removeItem('loginStats_pierre-user-789')
        } else if (email === 'guest@email.com') {
          localStorage.removeItem('loginStats_guest-user-456')
        }
      }

      // For demo users, try demo account login first for better reliability
      const isDemoUser = email === 'elmfarrell@yahoo.com' || email === 'pierre@phaetonai.com' || email === 'guest@email.com'

      if (isDemoUser) {
        // Try demo account login first for demo users
        if (await handleDemoAccountLogin(email, password)) {
          onLogin()
          return
        }
      }

      // Try to authenticate with Supabase
      const authResponse = await userManagementService.authenticateUser(email, password)

      if (authResponse.status === 'error') {
        // For demo users, if Supabase fails, we already tried demo login above
        if (isDemoUser) {
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

        onLogin()
      } else {
        // Check for demo accounts as fallback (only if user not found in system and not already tried)
        if (!isDemoUser && await handleDemoAccountLogin(email, password)) {
          onLogin()
        } else {
          setError('Invalid email or password. Check with your administrator if you need an account.')
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

      // Check localStorage for stored credentials under demo user ID
      let encryptedCredentials = localStorage.getItem(`userCredentials_${userId}`)

      // If not found under demo ID, also check under Supabase UUID for this demo user
      if (!encryptedCredentials) {
        // Check for known Supabase UUIDs for demo users
        const demoUUIDMap: { [key: string]: string } = {
          'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
          'super-user-456': 'c550502f-c39d-4bb3-bb8c-d193657fdb24', // This might be wrong, but try it
          }

        const supabaseUUID = demoUUIDMap[userId]
        if (supabaseUUID) {
          encryptedCredentials = localStorage.getItem(`userCredentials_${supabaseUUID}`)
          console.log(`Checking credentials under Supabase UUID ${supabaseUUID} for demo user ${userId}`)
        }
      }

      if (!encryptedCredentials) {
        return false
      }

      // Decrypt the stored credentials
      const decrypted = await encryptionService.decryptString(encryptedCredentials)
      const credentials = JSON.parse(decrypted)
      console.log(`Credentials structure:`, credentials)

      // Verify the password
      if (credentials.password) {
        console.log(`Stored password format:`, credentials.password.substring(0, 20) + '...')

        // The stored password is already encrypted, so we need to decrypt it
        const decryptedStoredPassword = await encryptionService.decryptString(credentials.password)
        console.log(`Password check for ${userId}: stored password found, comparing...`)
        console.log(`Entered password: "${password}"`)
        console.log(`Decrypted stored password: "${decryptedStoredPassword}"`)
        const isMatch = password === decryptedStoredPassword
        console.log(`Password match result: ${isMatch}`)
        return isMatch
      }

      return false
    } catch (error) {
      console.log('Failed to check demo user stored credentials, clearing corrupted data:', error)
      // Clear corrupted credentials to prevent future errors
      localStorage.removeItem(`userCredentials_${userId}`)
      return false
    }
  }

  // Helper method for demo account handling
  const handleDemoAccountLogin = async (email: string, password: string): Promise<boolean> => {
    let demoUserData = null

    // Clear any lockouts for demo users to prevent getting stuck
    if (email === 'elmfarrell@yahoo.com' || email === 'pierre@phaetonai.com' || email === 'guest@email.com') {
      // Clear failed login attempts for demo users
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

      // Clear login stats for demo users
      if (email === 'elmfarrell@yahoo.com') {
        localStorage.removeItem('loginStats_super-user-456')
      } else if (email === 'pierre@phaetonai.com') {
        localStorage.removeItem('loginStats_pierre-user-789')
      } else if (email === 'guest@email.com') {
        localStorage.removeItem('loginStats_guest-user-001')
      }
    }

    // Check built-in demo accounts - now uses dynamic password verification
    if (email === 'elmfarrell@yahoo.com') {
      // Try stored credentials first, fall back to default password
      const isValidPassword = await checkDemoUserPassword('super-user-456', password) || password === 'Farrell1000!'
      if (isValidPassword) {
        demoUserData = {
          id: 'super-user-456',
          email: 'elmfarrell@yahoo.com',
          name: 'Dr. Farrell',
          role: 'super_user' as const,
          mfa_enabled: false,
          settings: {
            theme: 'dark',
            notifications: {}
          }
        }
      }
    } else if (email === 'pierre@phaetonai.com') {
      // Try stored credentials first, fall back to default password
      const isValidPassword = await checkDemoUserPassword('pierre-user-789', password) || password === '$Ineed1millie$_carexps'
      if (isValidPassword) {
        demoUserData = {
          id: 'pierre-user-789',
          email: 'pierre@phaetonai.com',
          name: 'Pierre PhaetonAI',
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
          name: 'Guest User',
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
        // Try to create/update the demo user in Supabase
        const createResponse = await userProfileService.saveUserProfile(demoUserData)

        if (createResponse.status === 'success') {
          // Update last login for successful demo login
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
        console.error('Failed to create demo user:', error)
      }

      // Fallback to localStorage if Supabase fails
      // Update last login for successful demo login (fallback case)
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex flex-col">
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
          <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in to your healthcare account
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-5 h-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="w-5 h-5 text-gray-400" />
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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