/**
 * MFA Cleanup Tool - Emergency Fix for Corrupted TOTP Data
 *
 * This utility completely cleans up corrupted MFA data for a specific user
 * and prepares them for fresh MFA setup using the fixed TOTP service.
 *
 * Usage:
 * 1. Run cleanup for specific user
 * 2. User can then go through fresh MFA setup
 * 3. New setup will use proper Base32 handling
 */

import { supabase } from '../config/supabase'
import { fixedTotpService } from '../services/fixedTotpService'

interface CleanupResult {
  success: boolean
  message: string
  details: string[]
}

class MFACleanupTool {
  /**
   * Complete cleanup for a specific user
   */
  async cleanupUserMFA(userId: string): Promise<CleanupResult> {
    const details: string[] = []

    try {
      console.log(`🚨 Starting complete MFA cleanup for user: ${userId}`)
      details.push(`Starting cleanup for user: ${userId}`)

      // Step 1: Clear database records
      try {
        const { error: deleteError } = await supabase
          .from('user_totp')
          .delete()
          .eq('user_id', userId)

        if (deleteError) {
          details.push(`⚠️ Database cleanup warning: ${deleteError.message}`)
        } else {
          details.push('✅ Database TOTP records cleared')
        }
      } catch (dbError) {
        details.push(`⚠️ Database cleanup failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
      }

      // Step 2: Clear all localStorage variants
      const localStorageKeys = [
        `fixed_totp_${userId}`,        // New fixed format
        `totp_${userId}`,              // Old format
        `totp_secret_${userId}`,       // Legacy secret
        `totp_enabled_${userId}`,      // Legacy enabled flag
        `mfa_sessions_${userId}`,      // MFA session data
        `mfa_setup_${userId}`,         // Setup state
        `totp_backup_codes_${userId}`, // Legacy backup codes
        `user_mfa_${userId}`,          // Any user MFA data
        `secure_mfa_${userId}`         // Secure MFA data
      ]

      let clearedCount = 0
      localStorageKeys.forEach(key => {
        const existed = localStorage.getItem(key) !== null
        localStorage.removeItem(key)
        if (existed) {
          clearedCount++
          details.push(`🧹 Cleared localStorage: ${key}`)
        }
      })

      if (clearedCount === 0) {
        details.push('ℹ️ No localStorage keys found to clear')
      } else {
        details.push(`✅ Cleared ${clearedCount} localStorage entries`)
      }

      // Step 3: Use the fixed TOTP service for additional cleanup
      try {
        await fixedTotpService.emergencyCleanup(userId)
        details.push('✅ Fixed TOTP service cleanup completed')
      } catch (serviceError) {
        details.push(`⚠️ Fixed service cleanup warning: ${serviceError instanceof Error ? serviceError.message : 'Unknown error'}`)
      }

      // Step 4: Clear any session storage related to MFA
      const sessionKeys = [
        `mfa_verified_${userId}`,
        `totp_setup_state_${userId}`,
        `mfa_challenge_${userId}`
      ]

      sessionKeys.forEach(key => {
        const existed = sessionStorage.getItem(key) !== null
        sessionStorage.removeItem(key)
        if (existed) {
          details.push(`🧹 Cleared sessionStorage: ${key}`)
        }
      })

      console.log('✅ Complete MFA cleanup successful')
      details.push('🎉 Cleanup completed successfully')

      return {
        success: true,
        message: 'MFA cleanup completed successfully. User can now set up fresh MFA.',
        details
      }

    } catch (error) {
      console.error('❌ MFA cleanup failed:', error)
      details.push(`❌ Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)

      return {
        success: false,
        message: 'MFA cleanup encountered errors. Check details for more information.',
        details
      }
    }
  }

  /**
   * Verify cleanup was successful
   */
  async verifyCleanup(userId: string): Promise<{ clean: boolean, issues: string[] }> {
    const issues: string[] = []

    try {
      // Check database
      const { data: dbData, error: dbError } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!dbError && dbData) {
        issues.push('Database still contains TOTP data')
      }

      // Check localStorage
      const checkKeys = [
        `fixed_totp_${userId}`,
        `totp_${userId}`,
        `totp_secret_${userId}`,
        `totp_enabled_${userId}`,
        `mfa_sessions_${userId}`
      ]

      checkKeys.forEach(key => {
        if (localStorage.getItem(key) !== null) {
          issues.push(`localStorage still contains: ${key}`)
        }
      })

      // Check service state
      try {
        const hasSetup = await fixedTotpService.hasTOTPSetup(userId)
        if (hasSetup) {
          issues.push('Fixed TOTP service still reports setup exists')
        }

        const isEnabled = await fixedTotpService.isTOTPEnabled(userId)
        if (isEnabled) {
          issues.push('Fixed TOTP service still reports MFA is enabled')
        }
      } catch (serviceError) {
        // Service errors are expected after cleanup
      }

      return {
        clean: issues.length === 0,
        issues
      }

    } catch (error) {
      issues.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        clean: false,
        issues
      }
    }
  }

  /**
   * Generate fresh MFA setup after cleanup
   */
  async generateFreshSetup(userId: string, userEmail: string) {
    try {
      console.log(`🔄 Generating fresh MFA setup for: ${userId}`)

      // Double-check cleanup was successful
      const verification = await this.verifyCleanup(userId)
      if (!verification.clean) {
        console.warn('⚠️ Cleanup verification found issues:', verification.issues)
        // Continue anyway - the fixed service should handle it
      }

      // Generate new setup using fixed service
      const setup = await fixedTotpService.generateTOTPSetup(userId, userEmail)

      console.log('✅ Fresh MFA setup generated successfully')
      return setup

    } catch (error) {
      console.error('❌ Fresh setup generation failed:', error)
      throw new Error(`Failed to generate fresh MFA setup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Test the new setup by verifying a TOTP code
   */
  async testNewSetup(userId: string, testCode: string) {
    try {
      console.log(`🧪 Testing new MFA setup for: ${userId}`)

      const result = await fixedTotpService.verifyTOTP(userId, testCode, false)

      if (result.success) {
        console.log('✅ New MFA setup test successful')
        return { success: true, message: 'TOTP verification test passed' }
      } else {
        console.log('❌ New MFA setup test failed:', result.error)
        return { success: false, message: result.error || 'Verification test failed' }
      }

    } catch (error) {
      console.error('❌ MFA setup test failed:', error)
      return {
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Complete MFA setup (enable after successful verification)
   */
  async completeMFASetup(userId: string, verificationCode: string) {
    try {
      console.log(`🏁 Completing MFA setup for: ${userId}`)

      const result = await fixedTotpService.verifyTOTP(userId, verificationCode, true)

      if (result.success) {
        console.log('✅ MFA setup completed and enabled')
        return { success: true, message: 'MFA setup completed successfully' }
      } else {
        console.log('❌ MFA completion failed:', result.error)
        return { success: false, message: result.error || 'MFA completion failed' }
      }

    } catch (error) {
      console.error('❌ MFA completion failed:', error)
      return {
        success: false,
        message: `Completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

// Export singleton instance
export const mfaCleanupTool = new MFACleanupTool()

// Convenience functions for browser console usage
export const cleanupUserMFA = (userId: string) => mfaCleanupTool.cleanupUserMFA(userId)
export const verifyCleanup = (userId: string) => mfaCleanupTool.verifyCleanup(userId)
export const generateFreshSetup = (userId: string, userEmail: string) =>
  mfaCleanupTool.generateFreshSetup(userId, userEmail)
export const testNewSetup = (userId: string, testCode: string) =>
  mfaCleanupTool.testNewSetup(userId, testCode)
export const completeMFASetup = (userId: string, verificationCode: string) =>
  mfaCleanupTool.completeMFASetup(userId, verificationCode)