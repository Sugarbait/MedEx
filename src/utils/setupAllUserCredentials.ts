/**
 * Setup all user credentials for the CareXPS system
 * This ensures all demo users have proper authentication
 */

import { userManagementService } from '@/services/userManagementService'
import { PasswordDebugger } from './passwordDebug'

interface UserCredential {
  id: string
  email: string
  password: string
  name: string
  role: string
}

const ALL_USERS: UserCredential[] = [
  {
    id: 'super-user-456',
    email: 'elmfarrell@yahoo.com',
    password: 'Farrell1000!',
    name: 'Dr. Farrell',
    role: 'super_user'
  },
  {
    id: 'pierre-user-789',
    email: 'pierre@phaetonai.com',
    password: '$Ineed1millie$_carexps',
    name: 'Pierre PhaetonAI',
    role: 'admin'
  },
  {
    id: 'guest-user-456',
    email: 'guest@email.com',
    password: 'Guest1000!',
    name: 'Guest User',
    role: 'staff'
  }
]

export async function setupAllUserCredentials() {
  console.log('🔐 Setting up credentials for all users...')

  try {
    for (const user of ALL_USERS) {
      console.log('Setting up credentials for user...')

      try {
        // Set password using PasswordDebugger
        await PasswordDebugger.setUserPassword(user.id, user.email, user.password)
        console.log('✅ Credentials configured successfully')

        // Clear any lockouts
        await userManagementService.clearAccountLockout(user.id)
        console.log('✅ Account lockout cleared')

      } catch (error: any) {
        console.error('❌ Failed to set credentials for user')
      }
    }

    // Clear global failed login attempts
    localStorage.removeItem('failed_login_attempts')
    console.log('✅ Cleared global failed login attempts')

    console.log('🎉 All user credentials setup complete!')

    // Display summary
    console.log('\n📋 User Setup Summary:')
    console.log(`${ALL_USERS.length} users configured successfully`)

    return {
      success: true,
      users: ALL_USERS
    }

  } catch (error: any) {
    console.error('💥 Error setting up user credentials:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Test authentication for all users
export async function testAllUserAuthentication() {
  console.log('🧪 Testing authentication for all users...')

  const results = []

  for (const user of ALL_USERS) {
    try {
      console.log('Testing user authentication...')

      const response = await userManagementService.authenticateUser(user.email, user.password)

      if (response.status === 'success' && response.data) {
        console.log('✅ User authentication successful')
        results.push({
          user: 'User',
          status: 'SUCCESS',
          message: 'Authentication successful'
        })
      } else {
        console.log('❌ User authentication failed')
        results.push({
          user: 'User',
          status: 'FAILED',
          message: 'Authentication failed'
        })
      }

    } catch (error: any) {
      console.error('💥 User authentication error')
      results.push({
        user: 'User',
        status: 'ERROR',
        message: 'Authentication error'
      })
    }
  }

  console.log('\n📊 Authentication Test Results:')
  results.forEach(result => {
    const icon = result.status === 'SUCCESS' ? '✅' : result.status === 'FAILED' ? '❌' : '💥'
    console.log(`${icon} User authentication: ${result.message}`)
  })

  return results
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).setupAllUserCredentials = setupAllUserCredentials
  (window as any).testAllUserAuthentication = testAllUserAuthentication
}