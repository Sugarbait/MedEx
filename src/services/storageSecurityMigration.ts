/**
 * Storage Security Migration Service
 *
 * Migrates all insecure localStorage usage to encrypted secureStorage
 * for HIPAA compliance and PHI protection
 */

import { secureStorage } from '@/services/secureStorage'
import { secureLogger } from '@/services/secureLogger'
import { encryptionService } from '@/services/encryption'

const logger = secureLogger.component('StorageSecurityMigration')

export interface MigrationResult {
  success: boolean
  migratedKeys: string[]
  errors: string[]
  phiDataFound: boolean
}

class StorageSecurityMigrationService {
  private readonly PHI_PATTERNS = [
    /patient/i,
    /transcript/i,
    /call_summary/i,
    /phone_number/i,
    /message/i,
    /email/i,
    /currentUser/i,
    /userProfile/i,
    /credentials/i
  ]

  /**
   * Migrate all localStorage data to encrypted secureStorage
   */
  async migrateAllLocalStorage(): Promise<MigrationResult> {
    try {
      logger.info('Starting localStorage to secureStorage migration')

      const result: MigrationResult = {
        success: true,
        migratedKeys: [],
        errors: [],
        phiDataFound: false
      }

      // Get all localStorage keys
      const keys = Object.keys(localStorage)
      logger.debug(`Found ${keys.length} localStorage keys to migrate`)

      for (const key of keys) {
        try {
          const migrationSuccess = await this.migrateKey(key)
          if (migrationSuccess.success) {
            result.migratedKeys.push(key)
            if (migrationSuccess.isPHI) {
              result.phiDataFound = true
            }
          } else {
            result.errors.push(`Failed to migrate key: ${key}`)
          }
        } catch (error) {
          const errorMsg = `Error migrating key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          logger.error('Key migration failed', undefined, undefined, { key, error: errorMsg })
        }
      }

      // If any errors occurred, mark as partial success
      if (result.errors.length > 0) {
        result.success = false
      }

      logger.info('localStorage migration completed', undefined, undefined, {
        migratedCount: result.migratedKeys.length,
        errorCount: result.errors.length,
        phiDataFound: result.phiDataFound
      })

      return result

    } catch (error) {
      logger.error('localStorage migration failed', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return {
        success: false,
        migratedKeys: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        phiDataFound: false
      }
    }
  }

  /**
   * Migrate a specific localStorage key to secureStorage
   */
  private async migrateKey(key: string): Promise<{ success: boolean; isPHI: boolean }> {
    try {
      const value = localStorage.getItem(key)
      if (value === null) {
        return { success: true, isPHI: false }
      }

      // Check if this is likely PHI data
      const isPHI = this.isPotentialPHI(key, value)

      // Determine storage options based on key type
      const storageOptions = this.getStorageOptions(key, isPHI)

      // Migrate to secureStorage
      await secureStorage.setItem(key, value, storageOptions)

      // Remove from localStorage after successful migration
      localStorage.removeItem(key)

      logger.debug('Key migrated successfully', undefined, undefined, {
        key,
        isPHI,
        encrypted: storageOptions.encrypt
      })

      return { success: true, isPHI }

    } catch (error) {
      logger.error('Failed to migrate key', undefined, undefined, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { success: false, isPHI: false }
    }
  }

  /**
   * Check if data is potentially PHI
   */
  private isPotentialPHI(key: string, value: string): boolean {
    // Check key patterns
    const keyContainsPHI = this.PHI_PATTERNS.some(pattern => pattern.test(key))

    if (keyContainsPHI) {
      return true
    }

    // Check value content for PHI indicators
    try {
      const parsed = JSON.parse(value)
      const valueStr = JSON.stringify(parsed).toLowerCase()

      const valueContainsPHI = [
        'patient', 'transcript', 'phone', 'email', 'message',
        'name', 'address', 'medical', 'health', 'treatment'
      ].some(term => valueStr.includes(term))

      return valueContainsPHI
    } catch {
      // If not JSON, check string content
      return this.PHI_PATTERNS.some(pattern => pattern.test(value))
    }
  }

  /**
   * Get appropriate storage options for different key types
   */
  private getStorageOptions(key: string, isPHI: boolean) {
    // Session data - short expiration
    if (key.includes('session') || key.includes('token')) {
      return {
        encrypt: true,
        expiresIn: 15 * 60 * 1000, // 15 minutes
        isPHI: false
      }
    }

    // PHI data - always encrypted, marked as PHI
    if (isPHI) {
      return {
        encrypt: true,
        isPHI: true,
        expiresIn: 24 * 60 * 60 * 1000 // 24 hours
      }
    }

    // User credentials - encrypted
    if (key.includes('credential') || key.includes('password') || key.includes('mfa')) {
      return {
        encrypt: true,
        isPHI: false,
        expiresIn: 7 * 24 * 60 * 60 * 1000 // 7 days
      }
    }

    // User preferences - optionally encrypted
    if (key.includes('preference') || key.includes('setting') || key.includes('theme')) {
      return {
        encrypt: false,
        isPHI: false
      }
    }

    // Default: encrypt everything for safety
    return {
      encrypt: true,
      isPHI: false,
      expiresIn: 24 * 60 * 60 * 1000 // 24 hours
    }
  }

  /**
   * Clean up any remaining insecure storage
   */
  async cleanupInsecureStorage(): Promise<void> {
    try {
      logger.info('Cleaning up insecure storage')

      // Clear any remaining localStorage items that weren't migrated
      const remainingKeys = Object.keys(localStorage)
      if (remainingKeys.length > 0) {
        logger.warn('Found remaining localStorage keys after migration', undefined, undefined, {
          remainingKeys
        })

        // Force clear all localStorage for security
        localStorage.clear()
        logger.info('Forced localStorage cleanup completed')
      }

      // Clear sessionStorage except for non-sensitive items
      const sessionKeys = Object.keys(sessionStorage)
      const sensitiveSessionKeys = sessionKeys.filter(key =>
        this.PHI_PATTERNS.some(pattern => pattern.test(key))
      )

      for (const key of sensitiveSessionKeys) {
        sessionStorage.removeItem(key)
        logger.debug('Removed sensitive sessionStorage key', undefined, undefined, { key })
      }

      logger.info('Insecure storage cleanup completed')

    } catch (error) {
      logger.error('Failed to cleanup insecure storage', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Verify migration was successful
   */
  async verifyMigration(): Promise<{ success: boolean; issues: string[] }> {
    try {
      logger.info('Verifying storage migration')

      const issues: string[] = []

      // Check for remaining PHI in localStorage
      const localStorageKeys = Object.keys(localStorage)
      for (const key of localStorageKeys) {
        if (this.PHI_PATTERNS.some(pattern => pattern.test(key))) {
          issues.push(`PHI data still in localStorage: ${key}`)
        }
      }

      // Check for remaining PHI in sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage)
      for (const key of sessionStorageKeys) {
        if (this.PHI_PATTERNS.some(pattern => pattern.test(key))) {
          issues.push(`PHI data still in sessionStorage: ${key}`)
        }
      }

      // Verify secureStorage is working
      try {
        await secureStorage.setItem('migration_test', 'test_value', { encrypt: true })
        const testValue = await secureStorage.getItem('migration_test')
        if (testValue !== 'test_value') {
          issues.push('secureStorage encryption verification failed')
        }
        secureStorage.removeItem('migration_test')
      } catch (error) {
        issues.push(`secureStorage test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      const success = issues.length === 0

      logger.info('Migration verification completed', undefined, undefined, {
        success,
        issueCount: issues.length
      })

      return { success, issues }

    } catch (error) {
      logger.error('Migration verification failed', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return {
        success: false,
        issues: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Emergency secure wipe of all client-side storage
   */
  async emergencySecureWipe(): Promise<void> {
    try {
      logger.warn('Performing emergency secure wipe of all client storage')

      // Clear all localStorage
      localStorage.clear()

      // Clear all sessionStorage
      sessionStorage.clear()

      // Clear all secureStorage
      secureStorage.clear()

      // Clear IndexedDB if used
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases()
          for (const db of databases) {
            if (db.name) {
              indexedDB.deleteDatabase(db.name)
            }
          }
        } catch (error) {
          logger.warn('Failed to clear IndexedDB during emergency wipe', undefined, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      logger.warn('Emergency secure wipe completed')

    } catch (error) {
      logger.error('Emergency secure wipe failed', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

export const storageSecurityMigration = new StorageSecurityMigrationService()

// Auto-migration function to be called during app initialization
export async function initializeSecureStorage(): Promise<void> {
  try {
    logger.info('Initializing secure storage migration')

    // Perform migration
    const migrationResult = await storageSecurityMigration.migrateAllLocalStorage()

    if (migrationResult.phiDataFound) {
      logger.warn('PHI data was found in localStorage and has been migrated to encrypted storage')
    }

    if (!migrationResult.success) {
      logger.error('Storage migration completed with errors', undefined, undefined, {
        errors: migrationResult.errors
      })
    }

    // Clean up any remaining insecure storage
    await storageSecurityMigration.cleanupInsecureStorage()

    // Verify migration
    const verification = await storageSecurityMigration.verifyMigration()
    if (!verification.success) {
      logger.error('Storage migration verification failed', undefined, undefined, {
        issues: verification.issues
      })
    }

    logger.info('Secure storage initialization completed', undefined, undefined, {
      migrationSuccess: migrationResult.success,
      verificationSuccess: verification.success
    })

  } catch (error) {
    logger.error('Secure storage initialization failed', undefined, undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}