/**
 * Password Debug Utility
 * Temporary utility to help diagnose and fix password storage issues
 */

import { encryptionService } from '@/services/encryption'

export class PasswordDebugger {
  /**
   * Clear all stored credentials for a user
   */
  static clearUserCredentials(userId: string, email?: string) {
    console.log('Clearing credentials')

    // Clear by user ID
    localStorage.removeItem(`userCredentials_${userId}`)

    // Clear by Supabase UUID if known
    const knownUUIDs: { [key: string]: string } = {
      'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
      'super-user-456': '', // Add if known
      'demo-user-123': ''  // Add if known
    }

    const uuid = knownUUIDs[userId]
    if (uuid) {
      localStorage.removeItem(`userCredentials_${uuid}`)
      console.log('Also cleared credentials for alternate identifier')
    }

    console.log('Credentials cleared successfully')
  }

  /**
   * Manually set a password for a user (for testing)
   */
  static async setUserPassword(userId: string, email: string, password: string) {
    try {
      console.log('Setting password')

      // Encrypt the password using the same method as the system
      const encryptedPassword = await encryptionService.encryptString(password)

      // Create the credentials object
      const credentials = {
        email: email,
        password: encryptedPassword,
        tempPassword: false
      }

      // Encrypt the entire credentials object
      const encryptedCredentials = await encryptionService.encryptString(JSON.stringify(credentials))

      // Store under the user ID
      localStorage.setItem(`userCredentials_${userId}`, encryptedCredentials)

      // Also store under Supabase UUID if known
      const knownUUIDs: { [key: string]: string } = {
        'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'super-user-456': '', // Add if known
        'demo-user-123': ''  // Add if known
      }

      const uuid = knownUUIDs[userId]
      if (uuid) {
        localStorage.setItem(`userCredentials_${uuid}`, encryptedCredentials)
        console.log('Also stored credentials for alternate identifier')
      }

      console.log('Password set successfully!')
      console.log('User can now login with configured credentials')
    } catch (error) {
      console.error('Failed to set password:', error)
    }
  }


  /**
   * Check what's stored for a user
   */
  static async checkStoredCredentials(userId: string) {
    try {
      console.log('Checking stored credentials')

      // Check by user ID
      const stored = localStorage.getItem(`userCredentials_${userId}`)
      if (stored) {
        console.log('Found credentials by identifier')
        const decrypted = await encryptionService.decryptString(stored)
        const credentials = JSON.parse(decrypted)
        console.log('Stored credentials: found')
        console.log('Has password:', !!credentials.password)

        if (credentials.password) {
          try {
            const decryptedPassword = await encryptionService.decryptString(credentials.password)
            console.log('Password decryption: successful')
          } catch (e) {
            console.log('Could not decrypt password - may be plain text or corrupted')
          }
        }
      } else {
        console.log('No credentials found by identifier')
      }

      // Check by UUID
      const knownUUIDs: { [key: string]: string } = {
        'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'super-user-456': '', // Add if known
        'demo-user-123': ''  // Add if known
      }

      const uuid = knownUUIDs[userId]
      if (uuid) {
        const storedByUUID = localStorage.getItem(`userCredentials_${uuid}`)
        if (storedByUUID) {
          console.log('Found credentials by alternate identifier')
        }
      }
    } catch (error) {
      console.error('Failed to check credentials:', error)
    }
  }
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  // Create simple object with static methods to avoid constructor issues
  (window as any).PasswordDebugger = {
    clearUserCredentials: (userId: string, email?: string) => PasswordDebugger.clearUserCredentials(userId, email),
    setUserPassword: (userId: string, email: string, password: string) => PasswordDebugger.setUserPassword(userId, email, password),
    checkStoredCredentials: (userId: string) => PasswordDebugger.checkStoredCredentials(userId)
  };

  // Quick access functions
  (window as any).setUserPassword = async (userId: string, email: string, password: string) => {
    return await PasswordDebugger.setUserPassword(userId, email, password);
  };
  (window as any).checkCredentials = async (userId: string) => {
    return await PasswordDebugger.checkStoredCredentials(userId);
  };
}
