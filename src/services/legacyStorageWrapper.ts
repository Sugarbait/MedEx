/**
 * Legacy Storage Wrapper
 *
 * Provides a compatibility layer that redirects localStorage calls
 * to encrypted secureStorage for existing code
 */

import { secureStorage } from '@/services/secureStorage'
import { secureUserDataService } from '@/services/secureUserDataService'
import { secureLogger } from '@/services/secureLogger'

const logger = secureLogger.component('LegacyStorageWrapper')

class LegacyStorageWrapper {

  /**
   * Secure replacement for localStorage.getItem('currentUser')
   */
  async getCurrentUser(): Promise<any | null> {
    try {
      const userData = await secureUserDataService.getCurrentUser()
      if (userData) {
        // Return in format expected by legacy code
        return JSON.stringify(userData)
      }
      return null
    } catch (error) {
      logger.error('Failed to get current user via legacy wrapper', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Secure replacement for localStorage.setItem('currentUser', data)
   */
  async setCurrentUser(userData: string | object): Promise<void> {
    try {
      const userObj = typeof userData === 'string' ? JSON.parse(userData) : userData
      await secureUserDataService.setCurrentUser(userObj)
    } catch (error) {
      logger.error('Failed to set current user via legacy wrapper', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Secure replacement for localStorage.getItem('systemUsers')
   */
  async getSystemUsers(): Promise<any | null> {
    try {
      const users = await secureUserDataService.getSystemUsers()
      if (users) {
        return JSON.stringify(users)
      }
      return null
    } catch (error) {
      logger.error('Failed to get system users via legacy wrapper', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Secure replacement for localStorage.setItem('systemUsers', data)
   */
  async setSystemUsers(usersData: string | any[]): Promise<void> {
    try {
      const usersArray = typeof usersData === 'string' ? JSON.parse(usersData) : usersData
      await secureUserDataService.setSystemUsers(usersArray)
    } catch (error) {
      logger.error('Failed to set system users via legacy wrapper', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Secure replacement for localStorage.getItem(`settings_${userId}`)
   */
  async getUserSettings(userId: string): Promise<any | null> {
    try {
      const settings = await secureUserDataService.getUserSettings(userId)
      if (settings) {
        return JSON.stringify(settings)
      }
      return null
    } catch (error) {
      logger.error('Failed to get user settings via legacy wrapper', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Secure replacement for localStorage.setItem(`settings_${userId}`, data)
   */
  async setUserSettings(userId: string, settingsData: string | object): Promise<void> {
    try {
      const settingsObj = typeof settingsData === 'string' ? JSON.parse(settingsData) : settingsData
      await secureUserDataService.setUserSettings(userId, settingsObj)
    } catch (error) {
      logger.error('Failed to set user settings via legacy wrapper', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Secure replacement for localStorage.getItem(`userCredentials_${userId}`)
   */
  async getUserCredentials(userId: string): Promise<any | null> {
    try {
      const credentials = await secureUserDataService.getUserCredentials(userId)
      if (credentials) {
        return JSON.stringify(credentials)
      }
      return null
    } catch (error) {
      logger.error('Failed to get user credentials via legacy wrapper', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Secure replacement for localStorage.setItem(`userCredentials_${userId}`, data)
   */
  async setUserCredentials(userId: string, credentialsData: string | object): Promise<void> {
    try {
      const credentialsObj = typeof credentialsData === 'string' ? JSON.parse(credentialsData) : credentialsData
      await secureUserDataService.setUserCredentials(userId, credentialsObj)
    } catch (error) {
      logger.error('Failed to set user credentials via legacy wrapper', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Generic secure storage item getter
   */
  async getItem(key: string): Promise<any | null> {
    try {
      // Handle special cases
      if (key === 'currentUser') {
        return this.getCurrentUser()
      }
      if (key === 'systemUsers') {
        return this.getSystemUsers()
      }
      if (key.startsWith('settings_')) {
        const userId = key.replace('settings_', '')
        return this.getUserSettings(userId)
      }
      if (key.startsWith('userCredentials_')) {
        const userId = key.replace('userCredentials_', '')
        return this.getUserCredentials(userId)
      }

      // For other items, use secureStorage directly
      const item = await secureStorage.getItem(key)
      return item ? JSON.stringify(item) : null

    } catch (error) {
      logger.error('Failed to get item via legacy wrapper', undefined, undefined, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Generic secure storage item setter
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      // Handle special cases
      if (key === 'currentUser') {
        return this.setCurrentUser(value)
      }
      if (key === 'systemUsers') {
        return this.setSystemUsers(value)
      }
      if (key.startsWith('settings_')) {
        const userId = key.replace('settings_', '')
        return this.setUserSettings(userId, value)
      }
      if (key.startsWith('userCredentials_')) {
        const userId = key.replace('userCredentials_', '')
        return this.setUserCredentials(userId, value)
      }

      // For other items, determine appropriate storage options
      const isPHI = this.isPotentialPHI(key, value)
      const storageOptions = {
        encrypt: true,
        isPHI,
        expiresIn: isPHI ? 24 * 60 * 60 * 1000 : undefined // 24 hours for PHI
      }

      try {
        const parsedValue = JSON.parse(value)
        await secureStorage.setItem(key, parsedValue, storageOptions)
      } catch {
        // If not JSON, store as string
        await secureStorage.setItem(key, value, storageOptions)
      }

    } catch (error) {
      logger.error('Failed to set item via legacy wrapper', undefined, undefined, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Secure replacement for localStorage.removeItem()
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (key === 'currentUser') {
        await secureUserDataService.removeCurrentUser()
      } else if (key.startsWith('userCredentials_')) {
        const userId = key.replace('userCredentials_', '')
        await secureUserDataService.removeUserCredentials(userId)
      } else {
        secureStorage.removeItem(key)
      }
    } catch (error) {
      logger.error('Failed to remove item via legacy wrapper', undefined, undefined, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Clear all secure storage
   */
  async clear(): Promise<void> {
    try {
      secureStorage.clear()
      await secureUserDataService.removeCurrentUser()
    } catch (error) {
      logger.error('Failed to clear storage via legacy wrapper', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Check if data is potentially PHI
   */
  private isPotentialPHI(key: string, value: string): boolean {
    const phiPatterns = [
      /patient/i, /transcript/i, /call_summary/i, /phone_number/i,
      /message/i, /email/i, /medical/i, /health/i, /treatment/i
    ]

    return phiPatterns.some(pattern =>
      pattern.test(key) || pattern.test(value)
    )
  }
}

export const legacyStorageWrapper = new LegacyStorageWrapper()

/**
 * Drop-in replacement functions for common localStorage patterns
 */
export const secureLocalStorage = {
  getItem: (key: string) => legacyStorageWrapper.getItem(key),
  setItem: (key: string, value: string) => legacyStorageWrapper.setItem(key, value),
  removeItem: (key: string) => legacyStorageWrapper.removeItem(key),
  clear: () => legacyStorageWrapper.clear(),

  // Synchronous compatibility methods (returns promises but can be awaited)
  getItemAsync: (key: string) => legacyStorageWrapper.getItem(key),
  setItemAsync: (key: string, value: string) => legacyStorageWrapper.setItem(key, value),
  removeItemAsync: (key: string) => legacyStorageWrapper.removeItem(key),
  clearAsync: () => legacyStorageWrapper.clear()
}