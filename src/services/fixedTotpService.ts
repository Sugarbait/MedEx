/**
 * Fixed TOTP Service - Proper Base32 Secret Handling
 *
 * CRITICAL FIX: This service properly handles Base32 TOTP secrets without corruption.
 *
 * Root Problem Solved:
 * - TOTP secrets are Base32 strings that MUST maintain their exact format
 * - Previous encryption was corrupting Base32 format during encrypt/decrypt
 * - This service stores Base32 secrets as-is with minimal processing
 *
 * Key Changes:
 * 1. Store Base32 secrets directly without aggressive encryption that corrupts format
 * 2. Use simple base64 encoding for storage (preserves Base32 format)
 * 3. Validate Base32 format before and after storage operations
 * 4. Proper error handling for Base32 parsing issues
 */

import { TOTP, Secret } from 'otpauth'
import { supabase } from '../config/supabase'

interface TOTPSetupResult {
  secret: string
  qr_url: string
  manual_entry_key: string
  backup_codes: string[]
}

interface TOTPVerificationResult {
  success: boolean
  error?: string
}

class FixedTOTPService {
  private config = {
    issuer: 'MedEx Healthcare CRM',
    label: 'MedEx',
    algorithm: 'SHA1' as const,
    digits: 6,
    period: 30
  }

  /**
   * Validate Base32 string format
   */
  private validateBase32(secret: string): boolean {
    try {
      // Base32 should only contain A-Z and 2-7, with optional padding (=)
      const base32Regex = /^[A-Z2-7]+=*$/
      if (!base32Regex.test(secret)) {
        console.error('❌ Invalid Base32 format - contains invalid characters:', secret)
        return false
      }

      // Test that it can be parsed by OTPAuth
      Secret.fromBase32(secret)
      return true
    } catch (error) {
      console.error('❌ Base32 validation failed:', error)
      return false
    }
  }

  /**
   * Safely store Base32 secret (using simple base64 encoding to prevent corruption)
   */
  private encodeSecretForStorage(base32Secret: string): string {
    try {
      // Simply base64 encode the Base32 string to preserve it exactly
      return btoa(base32Secret)
    } catch (error) {
      console.error('❌ Failed to encode secret for storage:', error)
      throw new Error('Failed to prepare secret for storage')
    }
  }

  /**
   * Safely retrieve Base32 secret from storage
   */
  private decodeSecretFromStorage(encodedSecret: string): string {
    try {
      // Decode from base64 to get original Base32 string
      const base32Secret = atob(encodedSecret)

      // Validate it's still proper Base32
      if (!this.validateBase32(base32Secret)) {
        throw new Error('Decoded secret is not valid Base32')
      }

      return base32Secret
    } catch (error) {
      console.error('❌ Failed to decode secret from storage:', error)
      throw new Error('Failed to retrieve secret from storage')
    }
  }

  /**
   * Generate fresh TOTP setup - creates clean Base32 secret
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    console.log('🚀 Fixed TOTP: Generating fresh setup for:', userId)

    try {
      // Step 1: Generate completely new Base32 secret
      const secret = new Secret({ size: 32 })
      const base32Secret = secret.base32

      console.log('🔐 Generated fresh Base32 secret, length:', base32Secret.length)

      // Step 2: Validate the generated secret
      if (!this.validateBase32(base32Secret)) {
        throw new Error('Generated secret is not valid Base32')
      }

      // Step 3: Create TOTP instance for QR code generation
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: userEmail,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret
      })

      // Step 4: Generate QR code and manual entry key
      const qr_url = totp.toString()
      const manual_entry_key = base32Secret

      // Step 5: Generate backup codes
      const backup_codes = this.generateBackupCodes()

      // Step 6: Safely encode secret and backup codes for storage
      const encoded_secret = this.encodeSecretForStorage(base32Secret)
      const encoded_backup_codes = backup_codes.map(code => btoa(code))

      console.log('💾 Storing in database with encoded secret...')

      // Clear any existing records first (emergency cleanup)
      await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // Insert new record with safely encoded secret
      const { error } = await supabase
        .from('user_totp')
        .insert({
          user_id: userId,
          encrypted_secret: encoded_secret, // Actually just base64-encoded Base32
          backup_codes: encoded_backup_codes,
          enabled: false, // Will be enabled after verification
          created_at: new Date().toISOString()
        })

      if (error) {
        console.warn('⚠️ Database storage failed, using localStorage fallback:', error.message)
        // Fallback to localStorage with same encoding
        localStorage.setItem(`fixed_totp_${userId}`, JSON.stringify({
          user_id: userId,
          encoded_secret: encoded_secret,
          backup_codes: encoded_backup_codes,
          enabled: false,
          created_at: new Date().toISOString()
        }))
      }

      console.log('✅ Fixed TOTP setup generated successfully')
      return {
        secret: manual_entry_key,
        qr_url,
        manual_entry_key,
        backup_codes
      }
    } catch (error) {
      console.error('❌ Fixed TOTP setup generation failed:', error)
      throw new Error(`Failed to generate TOTP setup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify TOTP code - proper Base32 handling
   */
  async verifyTOTP(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    console.log('🔍 Fixed TOTP: Verifying code for:', userId)

    try {
      // Step 1: Get TOTP data from database first
      let totpData: any = null

      const { data: dbData, error: dbError } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!dbError && dbData) {
        console.log('📊 Found TOTP data in database')
        totpData = dbData
      } else {
        console.log('⚠️ Database query failed, checking localStorage:', dbError?.message)

        // Fallback to localStorage (check both new and old formats)
        const newFormatData = localStorage.getItem(`fixed_totp_${userId}`)
        const oldFormatData = localStorage.getItem(`totp_${userId}`)

        if (newFormatData) {
          try {
            const parsed = JSON.parse(newFormatData)
            totpData = {
              ...parsed,
              encrypted_secret: parsed.encoded_secret // Map new format to expected field
            }
            console.log('📊 Found TOTP data in localStorage (new format)')
          } catch (parseError) {
            console.error('❌ Failed to parse new format localStorage data:', parseError)
          }
        } else if (oldFormatData) {
          try {
            totpData = JSON.parse(oldFormatData)
            console.log('📊 Found TOTP data in localStorage (old format)')
          } catch (parseError) {
            console.error('❌ Failed to parse old format localStorage data:', parseError)
          }
        }
      }

      if (!totpData) {
        console.log('❌ No TOTP data found')
        return { success: false, error: 'TOTP not set up for this user' }
      }

      // Step 2: Safely decode the secret
      let base32Secret: string
      try {
        // Try new safe decoding method first
        if (totpData.encoded_secret) {
          base32Secret = this.decodeSecretFromStorage(totpData.encoded_secret)
          console.log('✅ Decoded secret using safe method')
        } else {
          // Fall back to old method if needed (but this might fail)
          console.log('⚠️ Attempting old decryption method...')
          const { decryptPHI } = await import('../utils/encryption')
          const decrypted = decryptPHI(totpData.encrypted_secret)

          // Validate the decrypted result
          if (!this.validateBase32(decrypted)) {
            throw new Error('Decrypted secret is not valid Base32 format')
          }

          base32Secret = decrypted
          console.log('⚠️ Old decryption method succeeded, but secret may still be corrupted')
        }
      } catch (decryptError) {
        console.error('❌ Failed to decode TOTP secret:', decryptError)
        return {
          success: false,
          error: 'TOTP secret corrupted. Please reset your MFA setup.'
        }
      }

      // Step 3: Final validation before creating TOTP instance
      if (!this.validateBase32(base32Secret)) {
        console.error('❌ Retrieved secret failed Base32 validation')
        return {
          success: false,
          error: 'TOTP secret is corrupted. Please reset your MFA setup.'
        }
      }

      // Step 4: Create TOTP instance and verify
      console.log('🔐 Creating TOTP instance with Base32 secret...')
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: this.config.label,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: Secret.fromBase32(base32Secret)
      })

      // Step 5: Verify the code
      console.log('🔍 Verifying TOTP code...')
      const delta = totp.validate({ token: code, window: 1 })

      if (delta !== null) {
        console.log('✅ TOTP verification successful!')

        // Update last used timestamp and optionally enable
        const updateData: any = {
          last_used_at: new Date().toISOString()
        }

        if (enableOnSuccess) {
          updateData.enabled = true
          console.log('🔐 Enabling MFA for user')
        }

        // Try to update database
        try {
          await supabase
            .from('user_totp')
            .update(updateData)
            .eq('user_id', userId)
        } catch (updateError) {
          console.warn('⚠️ Database update failed:', updateError)
          // Update localStorage as fallback
          if (totpData.encoded_secret) {
            // New format
            const updatedData = { ...totpData, ...updateData }
            localStorage.setItem(`fixed_totp_${userId}`, JSON.stringify(updatedData))
          } else {
            // Old format
            const updatedData = { ...totpData, ...updateData }
            localStorage.setItem(`totp_${userId}`, JSON.stringify(updatedData))
          }
        }

        return { success: true }
      } else {
        console.log('❌ TOTP code verification failed')

        // Check backup codes if main verification failed
        if (totpData.backup_codes && Array.isArray(totpData.backup_codes)) {
          console.log('🔍 Checking backup codes...')
          for (const encodedCode of totpData.backup_codes) {
            try {
              const decryptedCode = atob(encodedCode) // Simple base64 decode for backup codes
              if (decryptedCode === code) {
                console.log('✅ Backup code verification successful')

                // Remove used backup code
                const updatedCodes = totpData.backup_codes.filter((c: string) => c !== encodedCode)

                try {
                  await supabase
                    .from('user_totp')
                    .update({
                      backup_codes: updatedCodes,
                      last_used_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)
                } catch (updateError) {
                  console.warn('⚠️ Backup code removal failed:', updateError)
                }

                return { success: true }
              }
            } catch (decryptError) {
              // Skip invalid backup codes
              continue
            }
          }
        }

        return { success: false, error: 'Invalid TOTP code or backup code' }
      }
    } catch (error) {
      console.error('❌ TOTP verification error:', error)
      return {
        success: false,
        error: `TOTP verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Emergency cleanup - removes all TOTP data for user (both old and new formats)
   */
  async emergencyCleanup(userId: string): Promise<boolean> {
    try {
      console.log('🚨 Emergency TOTP cleanup for:', userId)

      // Clear database
      await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // Clear ALL localStorage variants
      const keysToRemove = [
        `fixed_totp_${userId}`, // New format
        `totp_${userId}`, // Old format
        `totp_secret_${userId}`, // Legacy
        `totp_enabled_${userId}`, // Legacy
        `mfa_sessions_${userId}` // MFA sessions
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
        console.log(`🧹 Removed localStorage key: ${key}`)
      })

      console.log('✅ Emergency cleanup completed')
      return true
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error)
      return false
    }
  }

  /**
   * Check if user has TOTP setup (checks both old and new formats)
   */
  async hasTOTPSetup(userId: string): Promise<boolean> {
    try {
      // Check database first
      const { data, error } = await supabase
        .from('user_totp')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!error && data) {
        return true
      }

      // Check localStorage (both formats)
      const newFormat = localStorage.getItem(`fixed_totp_${userId}`)
      const oldFormat = localStorage.getItem(`totp_${userId}`)

      return !!(newFormat || oldFormat)
    } catch (error) {
      console.error('❌ TOTP setup check error:', error)
      return false
    }
  }

  /**
   * Check if user has TOTP enabled (checks both old and new formats)
   */
  async isTOTPEnabled(userId: string): Promise<boolean> {
    try {
      // Check database first
      const { data, error } = await supabase
        .from('user_totp')
        .select('enabled')
        .eq('user_id', userId)
        .maybeSingle()

      if (!error && data) {
        return data.enabled
      }

      // Check localStorage (both formats)
      const newFormatData = localStorage.getItem(`fixed_totp_${userId}`)
      if (newFormatData) {
        try {
          const parsed = JSON.parse(newFormatData)
          return parsed.enabled || false
        } catch (parseError) {
          console.error('❌ Failed to parse new format data:', parseError)
        }
      }

      const oldFormatData = localStorage.getItem(`totp_${userId}`)
      if (oldFormatData) {
        try {
          const parsed = JSON.parse(oldFormatData)
          return parsed.enabled || false
        } catch (parseError) {
          console.error('❌ Failed to parse old format data:', parseError)
        }
      }

      return false
    } catch (error) {
      console.error('❌ TOTP enabled check error:', error)
      return false
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      const code = Math.random().toString().slice(2, 10)
      codes.push(code)
    }
    return codes
  }
}

// Export singleton instance
export const fixedTotpService = new FixedTOTPService()