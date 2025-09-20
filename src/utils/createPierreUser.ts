/**
 * Script to create Pierre super user account
 */

import { userManagementService } from '@/services/userManagementService'
import { UserProfileData } from '@/services/userProfileService'

export async function createPierreUser() {
  try {
    console.log('Creating admin super user account...')

    const userData: Omit<UserProfileData, 'id'> = {
      name: 'Pierre PhaetonAI',
      email: 'pierre@phaetonai.com',
      role: 'admin',  // Set as admin role (mapped from super_user)
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

    const credentials = {
      email: 'pierre@phaetonai.com',
      password: '$Ineed1millie$_carexps',
      tempPassword: false
    }

    const response = await userManagementService.createSystemUser(userData, credentials)

    if (response.status === 'success') {
      console.log('Admin super user created successfully!')
      console.log('User credentials configured')
      console.log('Password: configured successfully')
      console.log('Role: admin')
      return response.data
    } else {
      console.error('Failed to create admin user:', response.error)
      return null
    }
  } catch (error) {
    console.error('Error creating admin user:', error)
    return null
  }
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).createPierreUser = createPierreUser
}