/**
 * MFA Emergency Recovery Utilities
 * Provides emergency recovery options for MFA authentication issues
 */

import { supabase } from '../config/supabase'

export interface EmergencyRecoveryOptions {
  userId: string
  recoveryMethods: RecoveryMethod[]
  created: string
}

export interface RecoveryMethod {
  method: string
  description: string
  priority: 'high' | 'medium' | 'low'
  instructions?: string
  code?: string
  enabled: boolean
}

class MFAEmergencyRecovery {
  private readonly CRITICAL_USERS = [
    'dynamic-pierre-user',
    'pierre-user-789',
    'super-user-456',
    'guest-user-456',
    'c550502f-c39d-4bb3-bb8c-d193657fdb24'
  ]

  /**
   * Complete MFA cleanup and reset for a user
   */
  async emergencyMFAReset(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🚨 Emergency MFA Reset for user:', userId)

      // Step 1: Clear database records
      try {
        await supabase
          .from('user_totp')
          .delete()
          .eq('user_id', userId)

        await supabase
          .from('user_mfa_configs')
          .delete()
          .eq('user_id', userId)

        console.log('✅ Database MFA records cleared')
      } catch (dbError) {
        console.warn('⚠️ Database cleanup failed:', dbError)
      }

      // Step 2: Clear all localStorage
      const keysToRemove = [
        `totp_${userId}`,
        `totp_secret_${userId}`,
        `totp_enabled_${userId}`,
        `mfa_sessions_${userId}`,
        'totp_setup_temp',
        'mfa_setup_in_progress'
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      // Step 3: Reset user MFA enabled flag
      try {
        await supabase
          .from('users')
          .update({ mfa_enabled: false })
          .eq('id', userId)
      } catch (userUpdateError) {
        console.warn('⚠️ User MFA flag update failed:', userUpdateError)
      }

      console.log('✅ Emergency MFA reset completed')
      return {
        success: true,
        message: 'MFA has been completely reset. User can now setup fresh MFA in Settings.'
      }
    } catch (error) {
      console.error('❌ Emergency MFA reset failed:', error)
      return {
        success: false,
        message: 'Emergency MFA reset failed. Manual intervention required.'
      }
    }
  }

  /**
   * Create temporary MFA bypass for critical users
   */
  createTemporaryMFABypass(userId: string, durationHours: number = 1): boolean {
    try {
      if (!this.CRITICAL_USERS.includes(userId)) {
        console.log('❌ Temporary MFA bypass denied - user not in critical list')
        return false
      }

      const expiryTime = new Date()
      expiryTime.setHours(expiryTime.getHours() + durationHours)

      const bypassData = {
        userId,
        created: new Date().toISOString(),
        expires: expiryTime.toISOString(),
        durationHours,
        reason: 'Emergency MFA issues'
      }

      localStorage.setItem(`mfa_emergency_bypass_${userId}`, JSON.stringify(bypassData))

      console.log(`✅ Temporary MFA bypass created for ${durationHours} hour(s)`)
      return true
    } catch (error) {
      console.error('❌ Failed to create temporary MFA bypass:', error)
      return false
    }
  }

  /**
   * Check if user has active MFA bypass
   */
  hasActiveMFABypass(userId: string): boolean {
    try {
      const bypassData = localStorage.getItem(`mfa_emergency_bypass_${userId}`)
      if (!bypassData) {
        return false
      }

      const parsed = JSON.parse(bypassData)
      const expiryTime = new Date(parsed.expires)
      const now = new Date()

      if (now > expiryTime) {
        // Bypass expired, clean up
        localStorage.removeItem(`mfa_emergency_bypass_${userId}`)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Error checking MFA bypass:', error)
      return false
    }
  }

  /**
   * Generate comprehensive recovery instructions
   */
  generateRecoveryInstructions(userId: string): EmergencyRecoveryOptions {
    const recoveryMethods: RecoveryMethod[] = [
      {
        method: 'settings_reset',
        description: 'Setup fresh MFA through Settings page',
        priority: 'high',
        instructions: 'Go to Settings > Security > Setup New MFA and scan fresh QR code',
        enabled: true
      },
      {
        method: 'emergency_reset',
        description: 'Emergency MFA reset via console',
        priority: 'medium',
        code: `
// Run this in browser console
window.mfaEmergencyRecovery.emergencyMFAReset('${userId}')
  .then(result => console.log('Reset result:', result));
`,
        enabled: this.CRITICAL_USERS.includes(userId)
      },
      {
        method: 'temporary_bypass',
        description: 'Create temporary MFA bypass (1 hour)',
        priority: 'medium',
        code: `
// Run this in browser console for 1-hour bypass
window.mfaEmergencyRecovery.createTemporaryMFABypass('${userId}', 1);
`,
        enabled: this.CRITICAL_USERS.includes(userId)
      },
      {
        method: 'admin_assistance',
        description: 'Contact system administrator',
        priority: 'low',
        instructions: 'If all other methods fail, contact system administrator for manual reset',
        enabled: true
      }
    ]

    return {
      userId,
      recoveryMethods: recoveryMethods.filter(method => method.enabled),
      created: new Date().toISOString()
    }
  }

  /**
   * Validate TOTP data integrity
   */
  async validateTOTPData(userId: string): Promise<{
    valid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Check database
      const { data: dbData, error: dbError } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (dbError) {
        issues.push(`Database query failed: ${dbError.message}`)
        recommendations.push('Check Supabase connection and database schema')
      }

      // Check localStorage
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          if (parsed.encrypted_secret === 'JBSWY3DPEHPK3PXP') {
            issues.push('Old test secret detected in localStorage')
            recommendations.push('Clear localStorage and setup fresh MFA')
          }
        } catch (parseError) {
          issues.push('Corrupted localStorage TOTP data')
          recommendations.push('Clear localStorage TOTP data')
        }
      }

      // Check for conflicting data
      if (dbData && localData) {
        const parsed = JSON.parse(localData)
        if (dbData.encrypted_secret !== parsed.encrypted_secret) {
          issues.push('Database and localStorage have different secrets')
          recommendations.push('Clear localStorage to use database secret')
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        recommendations
      }
    } catch (error) {
      return {
        valid: false,
        issues: [`Validation failed: ${error}`],
        recommendations: ['Run emergency MFA reset']
      }
    }
  }

  /**
   * Auto-fix common TOTP issues
   */
  async autoFixCommonIssues(userId: string): Promise<{
    fixed: boolean
    actions: string[]
    remainingIssues: string[]
  }> {
    const actions: string[] = []
    const remainingIssues: string[] = []

    try {
      // Fix 1: Remove old test data
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          if (parsed.encrypted_secret === 'JBSWY3DPEHPK3PXP') {
            localStorage.removeItem(`totp_${userId}`)
            localStorage.removeItem(`totp_secret_${userId}`)
            localStorage.removeItem(`totp_enabled_${userId}`)
            actions.push('Removed old test secret from localStorage')
          }
        } catch (parseError) {
          localStorage.removeItem(`totp_${userId}`)
          actions.push('Removed corrupted localStorage data')
        }
      }

      // Fix 2: Validate database data
      const validation = await this.validateTOTPData(userId)
      if (!validation.valid) {
        remainingIssues.push(...validation.issues)
      }

      return {
        fixed: remainingIssues.length === 0,
        actions,
        remainingIssues
      }
    } catch (error) {
      remainingIssues.push(`Auto-fix failed: ${error}`)
      return {
        fixed: false,
        actions,
        remainingIssues
      }
    }
  }
}

// Export singleton instance
export const mfaEmergencyRecovery = new MFAEmergencyRecovery()

// Make available globally for console access
if (typeof window !== 'undefined') {
  (window as any).mfaEmergencyRecovery = mfaEmergencyRecovery
}