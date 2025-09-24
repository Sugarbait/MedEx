/**
 * TOTP Migration Service - Safe Transition to Secure Implementation
 *
 * Handles migration from legacy TOTP services to secureTotpService
 * Ensures data integrity and user experience continuity
 */

import { secureTotpService } from './secureTotpService'
import { supabase } from '../config/supabase'

interface MigrationResult {
  success: boolean
  usersProcessed: number
  usersMigrated: number
  errors: string[]
}

class TOTPMigrationService {
  /**
   * Migrate specific user from legacy TOTP to secure implementation
   */
  async migrateUserTOTP(userId: string, force: boolean = false): Promise<boolean> {
    console.log(`🔄 TOTP Migration: Starting migration for user ${userId}`)

    try {
      // 1. Check if user already has clean secure TOTP setup
      const hasSecureSetup = await secureTotpService.hasTOTPSetup(userId)
      if (hasSecureSetup && !force) {
        console.log('✅ TOTP Migration: User already has secure TOTP setup')
        return true
      }

      // 2. Check for legacy data that needs cleanup
      const legacyDataFound = await this.detectLegacyData(userId)

      if (legacyDataFound) {
        console.log('🧹 TOTP Migration: Legacy data detected, performing cleanup...')

        // 3. Emergency cleanup of all legacy data
        await secureTotpService.emergencyCleanup(userId)

        console.log('✅ TOTP Migration: Legacy data cleaned up')
        return true
      } else {
        console.log('ℹ️ TOTP Migration: No legacy data found for user')
        return true
      }

    } catch (error) {
      console.error(`❌ TOTP Migration: Failed for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Detect legacy TOTP data that needs cleanup
   */
  private async detectLegacyData(userId: string): Promise<boolean> {
    let legacyFound = false

    try {
      // Check localStorage for legacy keys
      const legacyKeys = [
        `totp_${userId}`,
        `totp_secret_${userId}`,
        `totp_enabled_${userId}`,
        `mfa_sessions_${userId}`,
        `mfa_setup_${userId}`,
        `mfa_verified_${userId}`
      ]

      for (const key of legacyKeys) {
        const value = localStorage.getItem(key)
        if (value) {
          // Check for problematic test secret
          if (value.includes('JBSWY3DPEHPK3PXP')) {
            console.log(`🚨 TOTP Migration: Found legacy test secret in ${key}`)
            legacyFound = true
          } else {
            // Check for unencrypted or old format data
            try {
              const parsed = JSON.parse(value)
              if (parsed && typeof parsed === 'object') {
                if (parsed.encrypted_secret === 'JBSWY3DPEHPK3PXP' ||
                    (parsed.encrypted_secret && !parsed.encrypted_secret.startsWith('cbc:') && !parsed.encrypted_secret.startsWith('gcm:'))) {
                  console.log(`🚨 TOTP Migration: Found legacy format in ${key}`)
                  legacyFound = true
                }
              }
            } catch (parseError) {
              // If we can't parse it, it's potentially corrupted
              console.log(`🚨 TOTP Migration: Found corrupted data in ${key}`)
              legacyFound = true
            }
          }
        }
      }

      // Check database for legacy records
      const { data: dbData, error: dbError } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!dbError && dbData) {
        // Check if database has test secret or old format
        if (dbData.encrypted_secret === 'JBSWY3DPEHPK3PXP') {
          console.log('🚨 TOTP Migration: Found legacy test secret in database')
          legacyFound = true
        } else if (dbData.encrypted_secret &&
                   !dbData.encrypted_secret.startsWith('cbc:') &&
                   !dbData.encrypted_secret.startsWith('gcm:')) {
          console.log('🚨 TOTP Migration: Found legacy format in database')
          legacyFound = true
        }
      }

      return legacyFound

    } catch (error) {
      console.error('❌ TOTP Migration: Error detecting legacy data:', error)
      return false
    }
  }

  /**
   * Batch migrate all users with legacy TOTP data
   */
  async migrateAllUsers(): Promise<MigrationResult> {
    console.log('🔄 TOTP Migration: Starting batch migration of all users')

    const result: MigrationResult = {
      success: true,
      usersProcessed: 0,
      usersMigrated: 0,
      errors: []
    }

    try {
      // Get all users with TOTP data from database
      const { data: dbUsers, error: dbError } = await supabase
        .from('user_totp')
        .select('user_id')

      if (!dbError && dbUsers) {
        for (const user of dbUsers) {
          result.usersProcessed++

          try {
            const migrationSuccess = await this.migrateUserTOTP(user.user_id)
            if (migrationSuccess) {
              result.usersMigrated++
            } else {
              result.errors.push(`Failed to migrate user: ${user.user_id}`)
            }
          } catch (userError) {
            result.errors.push(`Error migrating user ${user.user_id}: ${userError}`)
            result.success = false
          }
        }
      }

      // Also check localStorage for any users not in database
      const localStorageUsers = this.findLocalStorageUsers()
      for (const userId of localStorageUsers) {
        // Skip if already processed from database
        if (dbUsers?.some(u => u.user_id === userId)) {
          continue
        }

        result.usersProcessed++

        try {
          const migrationSuccess = await this.migrateUserTOTP(userId)
          if (migrationSuccess) {
            result.usersMigrated++
          } else {
            result.errors.push(`Failed to migrate localStorage user: ${userId}`)
          }
        } catch (userError) {
          result.errors.push(`Error migrating localStorage user ${userId}: ${userError}`)
          result.success = false
        }
      }

      console.log(`✅ TOTP Migration: Completed. Processed: ${result.usersProcessed}, Migrated: ${result.usersMigrated}, Errors: ${result.errors.length}`)

      if (result.errors.length > 0) {
        console.warn('⚠️ TOTP Migration: Errors encountered:', result.errors)
      }

      return result

    } catch (error) {
      console.error('❌ TOTP Migration: Batch migration failed:', error)
      result.success = false
      result.errors.push(`Batch migration error: ${error}`)
      return result
    }
  }

  /**
   * Find all users with TOTP data in localStorage
   */
  private findLocalStorageUsers(): string[] {
    const users: string[] = []

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('totp_') && key !== 'totp_temp') {
          const userId = key.replace('totp_', '')
          if (userId && !users.includes(userId)) {
            users.push(userId)
          }
        }
      }
    } catch (error) {
      console.error('❌ TOTP Migration: Error scanning localStorage:', error)
    }

    return users
  }

  /**
   * Validate migration success for a user
   */
  async validateMigration(userId: string): Promise<boolean> {
    try {
      // Check that no legacy data exists
      const legacyFound = await this.detectLegacyData(userId)
      if (legacyFound) {
        console.log(`❌ TOTP Migration: Validation failed - legacy data still exists for ${userId}`)
        return false
      }

      // Check that secure service can properly check setup status
      const hasSetup = await secureTotpService.hasTOTPSetup(userId)
      console.log(`✅ TOTP Migration: Validation passed for ${userId}, has setup: ${hasSetup}`)

      return true

    } catch (error) {
      console.error(`❌ TOTP Migration: Validation error for ${userId}:`, error)
      return false
    }
  }

  /**
   * Get migration status report for admin dashboard
   */
  async getMigrationStatus(): Promise<{
    totalUsers: number
    usersWithLegacyData: number
    usersWithSecureSetup: number
    migrationNeeded: boolean
  }> {
    try {
      let totalUsers = 0
      let usersWithLegacyData = 0
      let usersWithSecureSetup = 0

      // Check database users
      const { data: dbUsers, error: dbError } = await supabase
        .from('user_totp')
        .select('user_id')

      if (!dbError && dbUsers) {
        totalUsers += dbUsers.length

        for (const user of dbUsers) {
          const hasLegacy = await this.detectLegacyData(user.user_id)
          if (hasLegacy) {
            usersWithLegacyData++
          } else {
            usersWithSecureSetup++
          }
        }
      }

      // Check localStorage users
      const localUsers = this.findLocalStorageUsers()
      for (const userId of localUsers) {
        // Skip if already counted from database
        if (dbUsers?.some(u => u.user_id === userId)) {
          continue
        }

        totalUsers++
        const hasLegacy = await this.detectLegacyData(userId)
        if (hasLegacy) {
          usersWithLegacyData++
        } else {
          usersWithSecureSetup++
        }
      }

      return {
        totalUsers,
        usersWithLegacyData,
        usersWithSecureSetup,
        migrationNeeded: usersWithLegacyData > 0
      }

    } catch (error) {
      console.error('❌ TOTP Migration: Status check failed:', error)
      return {
        totalUsers: 0,
        usersWithLegacyData: 0,
        usersWithSecureSetup: 0,
        migrationNeeded: false
      }
    }
  }

  /**
   * Emergency fix for specific problematic user (like pierre@phaetonai.com)
   */
  async emergencyUserFix(userId: string): Promise<{
    success: boolean
    message: string
    actionsTaken: string[]
  }> {
    console.log(`🚨 TOTP Migration: Emergency fix for user ${userId}`)

    const actionsTaken: string[] = []

    try {
      // 1. Complete emergency cleanup
      actionsTaken.push('Emergency cleanup of all TOTP data')
      await secureTotpService.emergencyCleanup(userId)

      // 2. Clear any session data
      actionsTaken.push('Cleared session storage')
      sessionStorage.removeItem(`totp_temp_${userId}`)
      sessionStorage.removeItem(`mfa_${userId}`)

      // 3. Clear any cached authentication states
      actionsTaken.push('Cleared cached auth states')
      const authKeys = Object.keys(localStorage).filter(key =>
        key.includes(userId) && (key.includes('auth') || key.includes('session'))
      )
      authKeys.forEach(key => localStorage.removeItem(key))

      // 4. Validate cleanup
      const validationResult = await this.validateMigration(userId)
      if (validationResult) {
        actionsTaken.push('Validated cleanup success')

        return {
          success: true,
          message: 'Emergency fix completed successfully. User can now set up fresh MFA.',
          actionsTaken
        }
      } else {
        return {
          success: false,
          message: 'Emergency fix completed but validation failed. Manual intervention may be needed.',
          actionsTaken
        }
      }

    } catch (error) {
      console.error(`❌ TOTP Migration: Emergency fix failed for ${userId}:`, error)

      return {
        success: false,
        message: `Emergency fix failed: ${error}`,
        actionsTaken
      }
    }
  }
}

// Export singleton instance
export const totpMigrationService = new TOTPMigrationService()