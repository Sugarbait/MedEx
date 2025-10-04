/**
 * Simplified TOTP Service - Clean Implementation
 * Eliminates complex fallback logic that was causing MFA issues
 * Focuses on reliable database-first approach with localStorage fallback
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

class SimplifiedTOTPService {
  private config = {
    issuer: 'MedEx Healthcare CRM',
    label: 'MedEx',
    algorithm: 'SHA1' as const,
    digits: 6,
    period: 30
  }

  /**
   * Generate fresh TOTP setup - always creates new secret
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    console.log('🚀 Simplified TOTP: Generating fresh setup for:', userId)

    try {
      // Step 1: Generate completely new secret
      const secret = new Secret({ size: 32 })
      console.log('🔐 Generated fresh secret')

      // Step 2: Create TOTP instance
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: userEmail,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret
      })

      // Step 3: Generate QR code and manual entry key
      const qr_url = totp.toString()
      const manual_entry_key = secret.base32

      // Step 4: Generate backup codes
      const backup_codes = this.generateBackupCodes()

      // Step 5: Encrypt and store in database
      const encrypted_secret = encryptPHI(secret.base32)
      const encrypted_backup_codes = backup_codes.map(code => encryptPHI(code))

      console.log('💾 Storing in database...')

      // Clear any existing records first
      await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // Insert new record
      const { error } = await supabase
        .from('user_totp')
        .insert({
          user_id: userId,
          encrypted_secret,
          backup_codes: encrypted_backup_codes,
          enabled: false, // Will be enabled after verification
          created_at: new Date().toISOString()
        })

      if (error) {
        console.warn('⚠️ Database storage failed, using localStorage fallback:', error.message)
        // Fallback to localStorage
        localStorage.setItem(`totp_${userId}`, JSON.stringify({
          user_id: userId,
          encrypted_secret,
          backup_codes: encrypted_backup_codes,
          enabled: false,
          created_at: new Date().toISOString()
        }))
      }

      console.log('✅ TOTP setup generated successfully')
      return {
        secret: manual_entry_key,
        qr_url,
        manual_entry_key,
        backup_codes
      }
    } catch (error) {
      console.error('❌ TOTP setup generation failed:', error)
      throw new Error('Failed to generate TOTP setup')
    }
  }

  /**
   * Verify TOTP code - simplified logic
   */
  async verifyTOTP(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    console.log('🔍 Simplified TOTP: Verifying code for:', userId)

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

        // Fallback to localStorage
        const localData = localStorage.getItem(`totp_${userId}`)
        if (localData) {
          try {
            totpData = JSON.parse(localData)
            console.log('📊 Found TOTP data in localStorage')
          } catch (parseError) {
            console.error('❌ Failed to parse localStorage data:', parseError)
          }
        }
      }

      if (!totpData) {
        console.log('❌ No TOTP data found')
        return { success: false, error: 'TOTP not set up for this user' }
      }

      // Step 2: Decrypt secret
      let decrypted_secret: string
      try {
        decrypted_secret = decryptPHI(totpData.encrypted_secret)
      } catch (decryptError) {
        console.error('❌ Failed to decrypt TOTP secret:', decryptError)
        return { success: false, error: 'Invalid TOTP configuration' }
      }

      // Step 3: Verify code
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: this.config.label,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: Secret.fromBase32(decrypted_secret)
      })

      const delta = totp.validate({ token: code, window: 1 })

      if (delta !== null) {
        console.log('✅ TOTP verification successful')

        // Update last used timestamp and optionally enable
        const updateData: any = {
          last_used_at: new Date().toISOString()
        }

        if (enableOnSuccess) {
          updateData.enabled = true
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
          const updatedData = { ...totpData, ...updateData }
          localStorage.setItem(`totp_${userId}`, JSON.stringify(updatedData))
        }

        return { success: true }
      } else {
        console.log('❌ TOTP code verification failed')

        // Check backup codes if main verification failed
        if (totpData.backup_codes && Array.isArray(totpData.backup_codes)) {
          for (const encryptedCode of totpData.backup_codes) {
            try {
              const decryptedCode = decryptPHI(encryptedCode)
              if (decryptedCode === code) {
                console.log('✅ Backup code verification successful')

                // Remove used backup code
                const updatedCodes = totpData.backup_codes.filter((c: string) => c !== encryptedCode)

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

        return { success: false, error: 'Invalid TOTP code' }
      }
    } catch (error) {
      console.error('❌ TOTP verification error:', error)
      return { success: false, error: 'TOTP verification failed' }
    }
  }

  /**
   * Check if user has TOTP setup
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

      // Fallback to localStorage
      const localData = localStorage.getItem(`totp_${userId}`)
      return !!localData
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
      // Check database first
      const { data, error } = await supabase
        .from('user_totp')
        .select('enabled')
        .eq('user_id', userId)
        .maybeSingle()

      if (!error && data) {
        return data.enabled
      }

      // Fallback to localStorage
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          return parsed.enabled || false
        } catch (parseError) {
          console.error('❌ Failed to parse localStorage data:', parseError)
        }
      }

      return false
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
      console.log('🔄 Disabling TOTP for:', userId)

      // Remove from database
      const { error } = await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // Also clear localStorage
      localStorage.removeItem(`totp_${userId}`)

      if (!error) {
        console.log('✅ TOTP disabled successfully')
        return true
      } else {
        console.warn('⚠️ Database deletion failed:', error.message)
        return false
      }
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
      console.log('🚨 Emergency TOTP cleanup for:', userId)

      // Clear database
      await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // Clear localStorage
      const keysToRemove = [
        `totp_${userId}`,
        `totp_secret_${userId}`,
        `totp_enabled_${userId}`,
        `mfa_sessions_${userId}`
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
export const simplifiedTotpService = new SimplifiedTOTPService()