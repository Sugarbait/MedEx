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
    role: 'super_user'
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
      console.log(`Setting up credentials for ${user.name} (${user.email})...`)

      try {
        // Set password using PasswordDebugger
        await PasswordDebugger.setUserPassword(user.id, user.email, user.password)
        console.log(`✅ Credentials set for ${user.name}`)

        // Clear any lockouts
        await userManagementService.clearAccountLockout(user.id)
        console.log(`✅ Lockout cleared for ${user.name}`)

      } catch (error: any) {
        console.error(`❌ Failed to set credentials for ${user.name}:`, error.message)
      }
    }

    // Clear global failed login attempts
    localStorage.removeItem('failed_login_attempts')
    console.log('✅ Cleared global failed login attempts')

    console.log('🎉 All user credentials setup complete!')

    // Display summary
    console.log('\n📋 Login Credentials Summary:')
    ALL_USERS.forEach(user => {
      console.log(`${user.name}: ${user.email} / ${user.password}`)
    })

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
      console.log(`Testing ${user.name} (${user.email})...`)

      const response = await userManagementService.authenticateUser(user.email, user.password)

      if (response.status === 'success' && response.data) {
        console.log(`✅ ${user.name} authentication successful`)
        results.push({
          user: user.name,
          email: user.email,
          status: 'SUCCESS',
          message: 'Authentication successful'
        })
      } else {
        console.log(`❌ ${user.name} authentication failed: ${response.error}`)
        results.push({
          user: user.name,
          email: user.email,
          status: 'FAILED',
          message: response.error || 'Authentication failed'
        })
      }

    } catch (error: any) {
      console.error(`💥 ${user.name} authentication error:`, error)
      results.push({
        user: user.name,
        email: user.email,
        status: 'ERROR',
        message: error.message
      })
    }
  }

  console.log('\n📊 Authentication Test Results:')
  results.forEach(result => {
    const icon = result.status === 'SUCCESS' ? '✅' : result.status === 'FAILED' ? '❌' : '💥'
    console.log(`${icon} ${result.user} (${result.email}): ${result.message}`)
  })

  return results
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).setupAllUserCredentials = setupAllUserCredentials
  (window as any).testAllUserAuthentication = testAllUserAuthentication
}