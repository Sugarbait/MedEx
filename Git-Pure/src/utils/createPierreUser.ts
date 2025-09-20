/**
 * Script to create Pierre super user account
 */

import { userManagementService } from '@/services/userManagementService'
import { UserProfileData } from '@/services/userProfileService'

export async function createPierreUser() {
  try {
    console.log('Creating Pierre super user account...')

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
      console.log('Pierre super user created successfully!')
      console.log('Email: pierre@phaetonai.com')
      console.log('Password: $Ineed1millie$_carexps')
      console.log('Role: admin')
      return response.data
    } else {
      console.error('Failed to create Pierre user:', response.error)
      return null
    }
  } catch (error) {
    console.error('Error creating Pierre user:', error)
    return null
  }
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).createPierreUser = createPierreUser
}