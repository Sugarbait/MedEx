/**
 * Clean TOTP Service - Fixed Base32 Handling
 *
 * This service fixes the critical Base32 decryption error by ensuring:
 * 1. Base32 secrets are properly cleaned before processing
 * 2. Encryption format prefixes are removed from decrypted secrets
 * 3. Only valid Base32 characters are used for TOTP generation
 * 4. Comprehensive error handling for corrupted data
 */

import { TOTP, Secret } from 'otpauth'
import { encryptPHI, decryptPHI } from '../utils/encryption'
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

interface UserTOTP {
  id?: string
  user_id: string
  encrypted_secret: string
  backup_codes: string[]
  enabled: boolean
  created_at: string
  last_used_at?: string
}

/**
 * Clean and validate Base32 string
 * Removes encryption format prefixes and ensures only valid Base32 characters
 */
function cleanBase32Secret(secret: string): string {
  if (!secret) {
    throw new Error('Empty secret provided')
  }

  // Remove common encryption format prefixes
  let cleaned = secret
  if (cleaned.includes('cbc:')) {
    cleaned = cleaned.split('cbc:').pop() || cleaned
  }
  if (cleaned.includes('gcm:')) {
    cleaned = cleaned.split('gcm:').pop() || cleaned
  }
  if (cleaned.includes(':')) {
    // Remove any remaining colons and take the last part
    const parts = cleaned.split(':')
    cleaned = parts[parts.length - 1]
  }

  // Remove any whitespace
  cleaned = cleaned.replace(/\s/g, '')

  // Convert to uppercase for consistency
  cleaned = cleaned.toUpperCase()

  // Validate Base32 format (only A-Z and 2-7, with optional padding =)
  const base32Regex = /^[A-Z2-7]+=*$/
  if (!base32Regex.test(cleaned)) {
    console.error('❌ Invalid Base32 secret after cleaning:', {
      original: secret,
      cleaned: cleaned,
      length: cleaned.length,
      containsInvalidChars: !/^[A-Z2-7=]*$/.test(cleaned)
    })

    // Try to extract valid Base32 characters only (but remove padding issues)
    const validCharsOnly = cleaned.replace(/[^A-Z2-7]/g, '') // Remove all non-Base32 chars including =
    if (validCharsOnly.length >= 16) { // Minimum viable secret length
      console.warn('⚠️ Attempting to recover Base32 secret by removing invalid characters')
      cleaned = validCharsOnly
    } else {
      throw new Error(`Invalid Base32 secret: contains invalid characters. Original: "${secret}", Cleaned: "${cleaned}"`)
    }
  }

  // Ensure minimum length for security
  if (cleaned.length < 16) {
    throw new Error(`Base32 secret too short: ${cleaned.length} characters (minimum 16 required)`)
  }

  console.log('✅ Base32 secret cleaned successfully:', {
    originalLength: secret.length,
    cleanedLength: cleaned.length,
    isValidBase32: base32Regex.test(cleaned)
  })

  return cleaned
}

class CleanTOTPService {
  private config = {
    issuer: 'MedEx Healthcare CRM',
    label: 'MedEx',
    algorithm: 'SHA1' as const,
    digits: 6,
    period: 30
  }

  /**
   * Generate a new TOTP setup with clean Base32 handling
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    console.log('🚀 Clean TOTP: Generating fresh setup for:', userId)

    try {
      // Generate a new 32-byte secret (256 bits)
      const secret = new Secret({ size: 32 })
      const base32Secret = secret.base32

      console.log('🔐 Generated fresh Base32 secret:', {
        length: base32Secret.length,
        isValidBase32: /^[A-Z2-7]+=*$/.test(base32Secret)
      })

      // Validate the generated secret
      const cleanedSecret = cleanBase32Secret(base32Secret)

      // Create TOTP instance with the clean secret
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: userEmail,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: Secret.fromBase32(cleanedSecret)
      })

      // Generate QR code URL and manual entry key
      const qr_url = totp.toString()
      const manual_entry_key = cleanedSecret

      // Generate backup codes
      const backup_codes = this.generateBackupCodes()

      // Store in database - encrypt the clean Base32 secret
      console.log('💾 Storing TOTP data...')

      // Clear any existing TOTP data for this user first
      await this.clearUserTOTPData(userId)

      // Encrypt the CLEAN Base32 secret
      const encrypted_secret = encryptPHI(cleanedSecret)
      const encrypted_backup_codes = backup_codes.map(code => encryptPHI(code))

      const totpRecord: Omit<UserTOTP, 'id'> = {
        user_id: userId,
        encrypted_secret,
        backup_codes: encrypted_backup_codes,
        enabled: false, // Will be enabled after verification
        created_at: new Date().toISOString()
      }

      // Try database first
      const { error: dbError } = await supabase
        .from('user_totp')
        .insert(totpRecord)

      if (dbError) {
        console.warn('⚠️ Database storage failed, using localStorage fallback:', dbError.message)
        localStorage.setItem(`totp_${userId}`, JSON.stringify(totpRecord))
      }

      console.log('✅ Clean TOTP setup generated successfully')

      return {
        secret: manual_entry_key,
        qr_url,
        manual_entry_key,
        backup_codes
      }

    } catch (error) {
      console.error('❌ Clean TOTP setup generation failed:', error)
      throw new Error(`Failed to generate TOTP setup: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify TOTP code with clean Base32 handling
   */
  async verifyTOTP(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    console.log('🔍 Clean TOTP: Verifying code for user:', userId)

    try {
      // Validate input
      if (!code || !/^\d{6}$/.test(code.trim())) {
        return { success: false, error: 'Please enter a valid 6-digit code' }
      }

      // Get TOTP data
      const totpData = await this.getUserTOTPData(userId)
      if (!totpData) {
        console.log('❌ No TOTP data found for user')
        return { success: false, error: 'TOTP not set up for this user' }
      }

      // Decrypt and clean the secret
      let decryptedSecret: string
      try {
        decryptedSecret = decryptPHI(totpData.encrypted_secret)
        console.log('🔓 Secret decrypted, attempting to clean:', {
          rawLength: decryptedSecret.length,
          hasColon: decryptedSecret.includes(':'),
          firstChars: decryptedSecret.substring(0, 10) + '...'
        })
      } catch (decryptError) {
        console.error('❌ Failed to decrypt TOTP secret:', decryptError)
        return { success: false, error: 'Invalid TOTP configuration - decryption failed' }
      }

      // Clean the decrypted secret
      let cleanSecret: string
      try {
        cleanSecret = cleanBase32Secret(decryptedSecret)
        console.log('🧹 Secret cleaned successfully:', {
          originalLength: decryptedSecret.length,
          cleanedLength: cleanSecret.length
        })
      } catch (cleanError) {
        console.error('❌ Failed to clean Base32 secret:', cleanError)
        return { success: false, error: `Invalid Base32 secret format: ${cleanError instanceof Error ? cleanError.message : 'Unknown error'}` }
      }

      // Create TOTP instance and verify
      try {
        const totp = new TOTP({
          issuer: this.config.issuer,
          label: this.config.label,
          algorithm: this.config.algorithm,
          digits: this.config.digits,
          period: this.config.period,
          secret: Secret.fromBase32(cleanSecret)
        })

        // Verify the code with time window tolerance
        const delta = totp.validate({ token: code.trim(), window: 1 })

        if (delta !== null) {
          console.log('✅ TOTP verification successful, delta:', delta)

          // Update last used timestamp and optionally enable
          await this.updateTOTPUsage(userId, enableOnSuccess)

          return { success: true }
        } else {
          console.log('❌ TOTP code verification failed, checking backup codes...')

          // Try backup codes
          const backupResult = await this.verifyBackupCode(userId, code.trim())
          if (backupResult) {
            return { success: true }
          }

          return { success: false, error: 'Invalid TOTP code. Please check your authenticator app and try again.' }
        }

      } catch (totpError) {
        console.error('❌ TOTP creation or validation failed:', totpError)
        return { success: false, error: 'Failed to process TOTP verification' }
      }

    } catch (error) {
      console.error('❌ TOTP verification error:', error)
      return { success: false, error: 'TOTP verification failed due to system error' }
    }
  }

  /**
   * Check if user has TOTP setup
   */
  async hasTOTPSetup(userId: string): Promise<boolean> {
    try {
      const totpData = await this.getUserTOTPData(userId)
      return !!totpData
    } catch (error) {
      console.error('❌ TOTP setup check error:', error)
      return false
    }
  }

  /**
   * Check if user has TOTP enabled
   */
  async isTOTPEnabled(userId: string): Promise<boolean> {
    try {
      const totpData = await this.getUserTOTPData(userId)
      return totpData?.enabled || false
    } catch (error) {
      console.error('❌ TOTP enabled check error:', error)
      return false
    }
  }

  /**
   * Disable TOTP for a user
   */
  async disableTOTP(userId: string): Promise<boolean> {
    try {
      console.log('🔄 Disabling TOTP for user:', userId)

      const success = await this.clearUserTOTPData(userId)

      if (success) {
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('totpStatusChanged', {
          detail: { userId, isEnabled: false }
        }))
      }

      return success
    } catch (error) {
      console.error('❌ TOTP disable error:', error)
      return false
    }
  }

  /**
   * Emergency cleanup - removes all TOTP data for user
   */
  async emergencyCleanup(userId: string): Promise<boolean> {
    try {
      console.log('🚨 Emergency TOTP cleanup for user:', userId)

      // Clear database
      await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // Clear all localStorage keys
      const keysToRemove = [
        `totp_${userId}`,
        `totp_secret_${userId}`,
        `totp_enabled_${userId}`,
        `mfa_sessions_${userId}`,
        `mfa_setup_${userId}`,
        `mfa_verified_${userId}`,
        `mfa_emergency_bypass_${userId}`
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      console.log('✅ Emergency cleanup completed')
      return true
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error)
      return false
    }
  }

  // Private helper methods

  /**
   * Get user TOTP data from database or localStorage
   */
  private async getUserTOTPData(userId: string): Promise<UserTOTP | null> {
    // Try database first
    try {
      const { data, error } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!error && data) {
        console.log('📊 Found TOTP data in database')
        return data as UserTOTP
      }
    } catch (dbError) {
      console.warn('⚠️ Database query failed:', dbError)
    }

    // Fallback to localStorage
    try {
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        const parsed = JSON.parse(localData) as UserTOTP
        console.log('📊 Found TOTP data in localStorage')
        return parsed
      }
    } catch (parseError) {
      console.error('❌ Failed to parse localStorage TOTP data:', parseError)
    }

    return null
  }

  /**
   * Clear all TOTP data for a user
   */
  private async clearUserTOTPData(userId: string): Promise<boolean> {
    try {
      // Clear database
      await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // Clear localStorage
      localStorage.removeItem(`totp_${userId}`)

      console.log('🧹 TOTP data cleared for user:', userId)
      return true
    } catch (error) {
      console.error('❌ Failed to clear TOTP data:', error)
      return false
    }
  }

  /**
   * Update TOTP usage timestamp and optionally enable
   */
  private async updateTOTPUsage(userId: string, enableOnSuccess: boolean): Promise<void> {
    const updateData: Partial<UserTOTP> = {
      last_used_at: new Date().toISOString()
    }

    if (enableOnSuccess) {
      updateData.enabled = true
    }

    try {
      // Update database
      await supabase
        .from('user_totp')
        .update(updateData)
        .eq('user_id', userId)

      // Update localStorage as fallback
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          const updated = { ...parsed, ...updateData }
          localStorage.setItem(`totp_${userId}`, JSON.stringify(updated))
        } catch (parseError) {
          console.warn('⚠️ Failed to update localStorage TOTP data:', parseError)
        }
      }

      console.log('✅ TOTP usage updated')
    } catch (error) {
      console.warn('⚠️ Failed to update TOTP usage:', error)
    }
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    try {
      const totpData = await this.getUserTOTPData(userId)
      if (!totpData?.backup_codes || !Array.isArray(totpData.backup_codes)) {
        return false
      }

      // Check each backup code
      for (const encryptedCode of totpData.backup_codes) {
        try {
          const decryptedCode = decryptPHI(encryptedCode)
          if (decryptedCode === code) {
            console.log('✅ Backup code verification successful')

            // Remove used backup code
            const updatedCodes = totpData.backup_codes.filter(c => c !== encryptedCode)

            // Update database
            await supabase
              .from('user_totp')
              .update({
                backup_codes: updatedCodes,
                last_used_at: new Date().toISOString()
              })
              .eq('user_id', userId)

            return true
          }
        } catch (decryptError) {
          // Skip invalid backup codes
          continue
        }
      }

      return false
    } catch (error) {
      console.error('❌ Backup code verification error:', error)
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
      const code = Math.random().toString(10).slice(2, 10).padStart(8, '0')
      codes.push(code)
    }
    return codes
  }
}

// Export singleton instance
export const cleanTotpService = new CleanTOTPService()