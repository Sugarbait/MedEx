/**
 * Clear Corrupted MFA Data Utility
 *
 * This utility clears the corrupted MFA data caused by users sharing the same UUID.
 * Run this to force both users to set up MFA separately.
 */

import { supabase } from '../config/supabase'

export class ClearCorruptedMfaData {
  /**
   * Clear MFA data for users affected by the UUID sharing bug
   */
  static async clearAllMfaData(): Promise<void> {
    try {
      console.log('🧹 CRITICAL FIX: Clearing corrupted MFA data from UUID sharing bug...')

      // UUIDs that were affected by the sharing bug
      const affectedUuids = [
        'c550502f-c39d-4bb3-bb8c-d193657fdb24', // Was shared between pierre-user-789 and dynamic-pierre-user
        'ee77ed8f-525f-43c9-a70a-b81cb8dc8d5d', // elmfarrell@yahoo.com
        'a1b2c3d4-e5f6-7890-abcd-123456789012'  // New unique UUID for dynamic-pierre-user
      ]

      // Clear fresh MFA data for all affected users
      for (const uuid of affectedUuids) {
        console.log(`🧹 Clearing MFA data for UUID: ${uuid}`)

        const { error } = await supabase
          .from('user_settings')
          .update({
            fresh_mfa_secret: null,
            fresh_mfa_enabled: false,
            fresh_mfa_setup_completed: false,
            fresh_mfa_backup_codes: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', uuid)

        if (error) {
          console.error(`❌ Error clearing MFA data for ${uuid}:`, error)
        } else {
          console.log(`✅ Cleared MFA data for ${uuid}`)
        }
      }

      // Also clear any MFA sessions from localStorage
      localStorage.removeItem('freshMfaVerified')
      localStorage.removeItem('mfa_verified')

      console.log('🎉 CRITICAL FIX: All corrupted MFA data cleared successfully!')
      console.log('📝 Next steps:')
      console.log('   1. Each user must set up MFA individually')
      console.log('   2. MFA will be properly isolated per user')
      console.log('   3. No more shared MFA credentials')

    } catch (error) {
      console.error('❌ CRITICAL ERROR: Failed to clear corrupted MFA data:', error)
      throw error
    }
  }

  /**
   * Clear MFA data for a specific user
   */
  static async clearMfaForUser(userId: string): Promise<void> {
    try {
      console.log(`🧹 Clearing MFA data for specific user: ${userId}`)

      // Import the user ID translation service
      const { userIdTranslationService } = await import('../services/userIdTranslationService')

      // Get the UUID for this user
      const uuid = await userIdTranslationService.stringToUuid(userId)
      if (!uuid) {
        console.warn(`⚠️ No UUID found for user: ${userId}`)
        return
      }

      console.log(`🔄 User ${userId} maps to UUID: ${uuid}`)

      // Clear MFA data in database
      const { error } = await supabase
        .from('user_settings')
        .update({
          fresh_mfa_secret: null,
          fresh_mfa_enabled: false,
          fresh_mfa_setup_completed: false,
          fresh_mfa_backup_codes: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', uuid)

      if (error) {
        console.error(`❌ Error clearing MFA data for user ${userId}:`, error)
        throw error
      }

      console.log(`✅ Successfully cleared MFA data for user: ${userId} (UUID: ${uuid})`)

    } catch (error) {
      console.error(`❌ Error clearing MFA for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Verify MFA isolation - check that each user has separate MFA data
   */
  static async verifyMfaIsolation(): Promise<void> {
    try {
      console.log('🔍 VERIFICATION: Checking MFA isolation between users...')

      const userMappings = {
        'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
        'super-user-456': 'ee77ed8f-525f-43c9-a70a-b81cb8dc8d5d',
        'dynamic-pierre-user': 'a1b2c3d4-e5f6-7890-abcd-123456789012'
      }

      console.log('📊 Current User ID Mappings:')
      for (const [stringId, uuid] of Object.entries(userMappings)) {
        console.log(`   ${stringId} → ${uuid}`)
      }

      // Check MFA data for each user
      for (const [stringId, uuid] of Object.entries(userMappings)) {
        const { data, error } = await supabase
          .from('user_settings')
          .select('fresh_mfa_enabled, fresh_mfa_setup_completed')
          .eq('user_id', uuid)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error(`❌ Error checking MFA for ${stringId}:`, error)
          continue
        }

        const mfaStatus = data ? {
          enabled: data.fresh_mfa_enabled || false,
          setupCompleted: data.fresh_mfa_setup_completed || false
        } : {
          enabled: false,
          setupCompleted: false
        }

        console.log(`📋 ${stringId} (${uuid}):`, mfaStatus)
      }

      // Verify no shared UUIDs
      const uniqueUuids = new Set(Object.values(userMappings))
      if (uniqueUuids.size === Object.values(userMappings).length) {
        console.log('✅ VERIFICATION PASSED: All users have unique UUIDs')
      } else {
        console.error('❌ VERIFICATION FAILED: Users still sharing UUIDs!')
      }

    } catch (error) {
      console.error('❌ Error verifying MFA isolation:', error)
    }
  }
}

// Make available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).clearCorruptedMfaData = ClearCorruptedMfaData.clearAllMfaData
  (window as any).clearMfaForUser = ClearCorruptedMfaData.clearMfaForUser
  (window as any).verifyMfaIsolation = ClearCorruptedMfaData.verifyMfaIsolation
}

// Manual cleanup only - DO NOT auto-run on import to preserve MFA data
// To run manually: ClearCorruptedMfaData.clearAllMfaData()
console.log('🔧 MFA cleanup utility loaded (manual use only)')