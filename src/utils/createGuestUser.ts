/**
 * Script to create a guest user account
 */

import { userManagementService } from '@/services/userManagementService'
import { UserProfileData } from '@/services/userProfileService'

export async function createGuestUser() {
  try {
    console.log('Creating system user account...')

    const userData: Omit<UserProfileData, 'id'> = {
      name: 'Guest User',
      email: 'guest@email.com',
      role: 'staff',  // Set as staff role (mapped from user)
      mfa_enabled: false,
      settings: {
        theme: 'light',
        notifications: {}
      }
    }

    const credentials = {
      email: 'guest@email.com',
      password: 'Guest1000!',
      tempPassword: false
    }

    const response = await userManagementService.createSystemUser(userData, credentials)

    if (response.status === 'success') {
      console.log('System user created successfully!')
      console.log('User credentials configured')
      console.log('Password: configured successfully')
      return response.data
    } else {
      console.error('Failed to create system user:', response.error)
      return null
    }
  } catch (error) {
    console.error('Error creating system user:', error)
    return null
  }
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).createGuestUser = createGuestUser
}