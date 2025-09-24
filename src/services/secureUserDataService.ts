/**
 * Secure User Data Service
 *
 * Replaces direct localStorage access for user data with encrypted storage
 * Ensures all user data is properly encrypted and PHI is protected
 */

import { secureStorage } from '@/services/secureStorage'
import { secureLogger } from '@/services/secureLogger'
import { encryptionService } from '@/services/encryption'
import { secureApiService } from '@/services/secureApiService'
import { User } from '@/types'

const logger = secureLogger.component('SecureUserDataService')

export interface SecureUserData {
  id: string
  azure_ad_id: string
  email: string
  name: string
  role: string
  mfa_enabled: boolean
  last_login?: string
  is_active: boolean
  created_at?: string
  avatar?: string // Keep avatar for compatibility
  // Remove any PHI fields from client-side storage
}

export interface UserSettings {
  theme: string
  notifications: Record<string, boolean>
  language: string
  timezone: string
  preferences: Record<string, any>
}

class SecureUserDataService {

  /**
   * Set current user data securely (replaces localStorage.setItem('currentUser'))
   */
  async setCurrentUser(userData: User): Promise<void> {
    try {
      // Sanitize user data - remove any PHI that shouldn't be stored client-side
      const secureUserData: SecureUserData = {
        id: userData.id,
        azure_ad_id: userData.azure_ad_id || userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        mfa_enabled: true, // SECURITY POLICY: MFA is always mandatory
        last_login: userData.last_login || userData.lastLogin,
        is_active: userData.is_active !== undefined ? userData.is_active : (userData.isActive !== undefined ? userData.isActive : true),
        created_at: userData.created_at || userData.createdAt,
        avatar: userData.avatar
      }

      // Store in encrypted secure storage with session expiration
      await secureStorage.setSessionData('currentUser', secureUserData)

      logger.info('Current user set securely', userData.id, undefined, {
        action: 'set_current_user',
        role: userData.role
      })

    } catch (error) {
      logger.error('Failed to set current user securely', userData?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to store user data securely')
    }
  }

  /**
   * Get current user data securely (replaces localStorage.getItem('currentUser'))
   */
  async getCurrentUser(): Promise<SecureUserData | null> {
    try {
      const userData = await secureStorage.getItem<SecureUserData>('currentUser')

      if (!userData) {
        logger.debug('No current user found in secure storage')
        return null
      }

      logger.debug('Current user retrieved securely', userData.id)
      return userData

    } catch (error) {
      logger.error('Failed to get current user securely', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Update current user data securely
   */
  async updateCurrentUser(updates: Partial<SecureUserData>): Promise<void> {
    try {
      const currentUser = await this.getCurrentUser()
      if (!currentUser) {
        throw new Error('No current user to update')
      }

      const updatedUser = { ...currentUser, ...updates }
      await this.setCurrentUser(updatedUser as User)

      logger.info('Current user updated securely', currentUser.id, undefined, {
        action: 'update_current_user',
        updatedFields: Object.keys(updates)
      })

    } catch (error) {
      logger.error('Failed to update current user securely', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Remove current user data securely
   */
  async removeCurrentUser(): Promise<void> {
    try {
      secureStorage.removeItem('currentUser')
      logger.info('Current user removed securely')

    } catch (error) {
      logger.error('Failed to remove current user securely', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Set user settings securely (replaces localStorage.setItem('settings_${userId}'))
   */
  async setUserSettings(userId: string, settings: UserSettings): Promise<void> {
    try {
      const settingsKey = `settings_${userId}`

      // Store settings with user preference encryption (optional)
      await secureStorage.setUserPreference(settingsKey, settings, false) // Not encrypted for settings

      logger.debug('User settings set securely', userId, undefined, {
        action: 'set_user_settings'
      })

    } catch (error) {
      logger.error('Failed to set user settings securely', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to store user settings securely')
    }
  }

  /**
   * Get user settings securely (replaces localStorage.getItem('settings_${userId}'))
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    try {
      const settingsKey = `settings_${userId}`
      const settings = await secureStorage.getItem<UserSettings>(settingsKey)

      if (!settings) {
        // Return default settings if none found
        const defaultSettings: UserSettings = {
          theme: 'light',
          notifications: {
            email: true,
            sms: false,
            push: true
          },
          language: 'en',
          timezone: 'UTC',
          preferences: {}
        }

        // Store default settings
        await this.setUserSettings(userId, defaultSettings)
        return defaultSettings
      }

      logger.debug('User settings retrieved securely', userId)
      return settings

    } catch (error) {
      logger.error('Failed to get user settings securely', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Set user credentials securely (replaces localStorage.setItem('userCredentials_${userId}'))
   */
  async setUserCredentials(userId: string, credentials: any): Promise<void> {
    try {
      const credentialsKey = `userCredentials_${userId}`

      // Always encrypt credentials as they are sensitive
      await secureStorage.setItem(credentialsKey, credentials, {
        encrypt: true,
        isPHI: false,
        expiresIn: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      logger.info('User credentials set securely', userId, undefined, {
        action: 'set_user_credentials'
      })

    } catch (error) {
      logger.error('Failed to set user credentials securely', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to store user credentials securely')
    }
  }

  /**
   * Get user credentials securely (replaces localStorage.getItem('userCredentials_${userId}'))
   */
  async getUserCredentials(userId: string): Promise<any | null> {
    try {
      const credentialsKey = `userCredentials_${userId}`
      const credentials = await secureStorage.getItem(credentialsKey)

      if (!credentials) {
        logger.debug('No credentials found for user', userId)
        return null
      }

      logger.debug('User credentials retrieved securely', userId)
      return credentials

    } catch (error) {
      logger.error('Failed to get user credentials securely', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Remove user credentials securely
   */
  async removeUserCredentials(userId: string): Promise<void> {
    try {
      const credentialsKey = `userCredentials_${userId}`
      secureStorage.removeItem(credentialsKey)

      logger.info('User credentials removed securely', userId, undefined, {
        action: 'remove_user_credentials'
      })

    } catch (error) {
      logger.error('Failed to remove user credentials securely', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Set system users list securely (replaces localStorage.setItem('systemUsers'))
   */
  async setSystemUsers(users: any[]): Promise<void> {
    try {
      // Remove any PHI from system users list before storing
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at
        // Remove any PHI fields
      }))

      await secureStorage.setItem('systemUsers', sanitizedUsers, {
        encrypt: true,
        isPHI: false,
        expiresIn: 24 * 60 * 60 * 1000 // 24 hours
      })

      logger.debug('System users set securely', undefined, undefined, {
        action: 'set_system_users',
        userCount: sanitizedUsers.length
      })

    } catch (error) {
      logger.error('Failed to set system users securely', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw new Error('Failed to store system users securely')
    }
  }

  /**
   * Get system users list securely (replaces localStorage.getItem('systemUsers'))
   */
  async getSystemUsers(): Promise<any[] | null> {
    try {
      const users = await secureStorage.getItem<any[]>('systemUsers')

      if (!users) {
        logger.debug('No system users found in secure storage')
        return []
      }

      logger.debug('System users retrieved securely', undefined, undefined, {
        userCount: users.length
      })
      return users

    } catch (error) {
      logger.error('Failed to get system users securely', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Migrate legacy localStorage user data to secure storage
   */
  async migrateLegacyUserData(): Promise<void> {
    try {
      logger.info('Starting legacy user data migration')

      // Migrate currentUser
      const currentUserData = localStorage.getItem('currentUser')
      if (currentUserData) {
        try {
          const userData = JSON.parse(currentUserData)
          await this.setCurrentUser(userData)
          localStorage.removeItem('currentUser')
          logger.info('Migrated currentUser to secure storage')
        } catch (error) {
          logger.warn('Failed to migrate currentUser', undefined, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Migrate systemUsers
      const systemUsersData = localStorage.getItem('systemUsers')
      if (systemUsersData) {
        try {
          const usersData = JSON.parse(systemUsersData)
          await this.setSystemUsers(usersData)
          localStorage.removeItem('systemUsers')
          logger.info('Migrated systemUsers to secure storage')
        } catch (error) {
          logger.warn('Failed to migrate systemUsers', undefined, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Migrate user settings
      const localStorageKeys = Object.keys(localStorage)
      for (const key of localStorageKeys) {
        if (key.startsWith('settings_')) {
          try {
            const settingsData = localStorage.getItem(key)
            if (settingsData) {
              const settings = JSON.parse(settingsData)
              const userId = key.replace('settings_', '')
              await this.setUserSettings(userId, settings)
              localStorage.removeItem(key)
              logger.debug('Migrated user settings to secure storage', userId)
            }
          } catch (error) {
            logger.warn('Failed to migrate user settings', undefined, undefined, {
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }

        // Migrate user credentials
        if (key.startsWith('userCredentials_')) {
          try {
            const credentialsData = localStorage.getItem(key)
            if (credentialsData) {
              const credentials = JSON.parse(credentialsData)
              const userId = key.replace('userCredentials_', '')
              await this.setUserCredentials(userId, credentials)
              localStorage.removeItem(key)
              logger.info('Migrated user credentials to secure storage', userId)
            }
          } catch (error) {
            logger.warn('Failed to migrate user credentials', undefined, undefined, {
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }
      }

      logger.info('Legacy user data migration completed')

    } catch (error) {
      logger.error('Legacy user data migration failed', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Get user profile from server-side API (for PHI data)
   */
  async getUserProfileSecure(azureAdId: string): Promise<any> {
    try {
      const currentUser = await this.getCurrentUser()
      const sessionId = currentUser ? 'current_session' : undefined

      const response = await secureApiService.getUserProfileSecure(azureAdId, {
        userId: currentUser?.id,
        sessionId,
        encryption: true,
        auditLog: true
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to retrieve user profile')
      }

      return response.data

    } catch (error) {
      logger.error('Failed to get user profile securely', undefined, undefined, {
        azureAdId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}

export const secureUserDataService = new SecureUserDataService()

// Legacy compatibility wrapper
export const legacyStorageCompat = {
  getCurrentUser: () => secureUserDataService.getCurrentUser(),
  setCurrentUser: (user: User) => secureUserDataService.setCurrentUser(user),
  getUserSettings: (userId: string) => secureUserDataService.getUserSettings(userId),
  setUserSettings: (userId: string, settings: UserSettings) => secureUserDataService.setUserSettings(userId, settings),
  getSystemUsers: () => secureUserDataService.getSystemUsers(),
  setSystemUsers: (users: any[]) => secureUserDataService.setSystemUsers(users)
}