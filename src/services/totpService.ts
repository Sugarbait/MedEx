/**
 * TOTP Service - Time-based One-Time Password Implementation
 * Built from scratch for CareXPS Healthcare CRM
 * Implements RFC 6238 TOTP standard with secure encryption
 */

import { TOTP, Secret } from 'otpauth'
import { encryptPHI, decryptPHI } from '../utils/encryption'
import { supabase } from '../config/supabase'

interface TOTPConfig {
  issuer: string
  label: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
}

interface UserTOTP {
  id: string
  user_id: string
  encrypted_secret: string
  backup_codes: string[]
  enabled: boolean
  created_at: string
  last_used_at: string | null
}

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

class TOTPService {
  private config: TOTPConfig = {
    issuer: 'CareXPS Healthcare CRM',
    label: 'CareXPS',
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  }

  /**
   * Generate a new TOTP secret for user setup
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    try {
      console.log('🚀 TOTP Service: Generating TOTP setup for:', { userId, userEmail })

      // Generate a random secret
      const secret = new Secret({ size: 32 })
      console.log('🚀 TOTP Service: Secret generated successfully')

      // Create TOTP instance
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: userEmail,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret
      })

      // Generate QR code URL
      const qr_url = totp.toString()

      // Get manual entry key (base32 encoded secret)
      const manual_entry_key = secret.base32

      // Generate backup codes
      const backup_codes = this.generateBackupCodes()

      // Encrypt the secret before storing
      console.log('🔐 TOTP Service: Encrypting secret...')
      const encrypted_secret = encryptPHI(secret.base32)
      console.log('🔐 TOTP Service: Secret encrypted successfully')

      // Store in database with fallback to localStorage
      console.log('💾 TOTP Service: Storing TOTP data in database...')
      try {
        const { error } = await supabase
          .from('user_totp')
          .upsert({
            user_id: userId,
            encrypted_secret,
            backup_codes: backup_codes.map(code => encryptPHI(code)),
            enabled: false, // Not enabled until first successful verification
            created_at: new Date().toISOString()
          })

        if (error) {
          console.warn('⚠️ TOTP Service: Supabase storage failed, using localStorage:', error.message)
          // Fallback to localStorage
          const totpData = {
            user_id: userId,
            encrypted_secret,
            backup_codes: backup_codes.map(code => encryptPHI(code)),
            enabled: false,
            created_at: new Date().toISOString()
          }
          localStorage.setItem(`totp_${userId}`, JSON.stringify(totpData))
          console.log('✅ TOTP Service: TOTP data stored in localStorage fallback')
        } else {
          console.log('✅ TOTP Service: TOTP data stored successfully in database')
        }
      } catch (dbError) {
        console.warn('⚠️ TOTP Service: Database unavailable, using localStorage fallback:', dbError)
        // Fallback to localStorage
        const totpData = {
          user_id: userId,
          encrypted_secret,
          backup_codes: backup_codes.map(code => encryptPHI(code)),
          enabled: false,
          created_at: new Date().toISOString()
        }
        localStorage.setItem(`totp_${userId}`, JSON.stringify(totpData))
        console.log('✅ TOTP Service: TOTP data stored in localStorage fallback')
      }

      return {
        secret: manual_entry_key,
        qr_url,
        manual_entry_key,
        backup_codes
      }
    } catch (error) {
      console.error('TOTP Setup Error:', error)
      throw new Error('Failed to generate TOTP setup')
    }
  }

  /**
   * Verify a TOTP code and optionally enable TOTP for the user
   */
  async verifyTOTP(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    try {
      // Get user's TOTP data
      const { data: totpData, error } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error || !totpData) {
        return { success: false, error: 'TOTP not set up for this user' }
      }

      // Decrypt the secret
      let decrypted_secret: string
      try {
        decrypted_secret = decryptPHI(totpData.encrypted_secret)
      } catch (decryptError) {
        console.error('TOTP secret decryption failed:', decryptError)
        return { success: false, error: 'Invalid TOTP configuration' }
      }

      // Create TOTP instance with stored secret
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: this.config.label,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: Secret.fromBase32(decrypted_secret)
      })

      // Verify the code (allow 1 period of drift in either direction)
      const delta = totp.validate({ token: code, window: 1 })

      if (delta === null) {
        // Check if it's a backup code
        const backupCodeValid = await this.verifyBackupCode(userId, code)
        if (!backupCodeValid) {
          return { success: false, error: 'Invalid TOTP code' }
        }
      }

      // Update last used timestamp and optionally enable
      const updateData: any = {
        last_used_at: new Date().toISOString()
      }

      if (enableOnSuccess && !totpData.enabled) {
        updateData.enabled = true
      }

      await supabase
        .from('user_totp')
        .update(updateData)
        .eq('user_id', userId)

      return { success: true }
    } catch (error) {
      console.error('TOTP Verification Error:', error)
      return { success: false, error: 'TOTP verification failed' }
    }
  }

  /**
   * Check if user has TOTP setup (regardless of enabled status)
   */
  async hasTOTPSetup(userId: string): Promise<boolean> {
    try {
      console.log('🔍 TOTP Service: Checking if TOTP setup exists for user:', userId)

      // Try database first
      try {
        const { data, error } = await supabase
          .from('user_totp')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!error && data) {
          console.log('🔍 TOTP Service: TOTP setup found in database')
          return true
        } else if (error) {
          console.log('🔍 TOTP Service: Database error, checking localStorage fallback:', error.message)
        }
      } catch (dbError) {
        console.log('🔍 TOTP Service: Database unavailable, checking localStorage fallback:', dbError)
      }

      // Fallback to localStorage
      console.log('🔍 TOTP Service: Checking localStorage for TOTP setup...')
      const localTotpData = localStorage.getItem(`totp_${userId}`)
      if (localTotpData) {
        try {
          JSON.parse(localTotpData) // Just check if it's valid JSON
          console.log('🔍 TOTP Service: TOTP setup found in localStorage')
          return true
        } catch (parseError) {
          console.error('🔍 TOTP Service: Failed to parse localStorage TOTP data:', parseError)
        }
      }

      console.log('🔍 TOTP Service: No TOTP setup found in database or localStorage')
      return false
    } catch (error) {
      console.error('❌ TOTP Setup Check Error:', error)
      return false
    }
  }

  /**
   * Check if user has TOTP enabled
   */
  async isTOTPEnabled(userId: string): Promise<boolean> {
    try {
      console.log('🔍 TOTP Service: Checking if TOTP enabled for user:', userId)

      // Try database first
      try {
        const { data, error } = await supabase
          .from('user_totp')
          .select('enabled')
          .eq('user_id', userId)
          .single()

        console.log('🔍 TOTP Service: Database response:', { data, error })

        if (error) {
          console.log('🔍 TOTP Service: Database error, checking localStorage fallback:', error.message)
        } else if (data) {
          console.log('🔍 TOTP Service: TOTP enabled status from database:', data.enabled)
          return data.enabled
        }
      } catch (dbError) {
        console.log('🔍 TOTP Service: Database unavailable, checking localStorage fallback:', dbError)
      }

      // Fallback to localStorage
      console.log('🔍 TOTP Service: Checking localStorage for TOTP data...')
      const localTotpData = localStorage.getItem(`totp_${userId}`)
      if (localTotpData) {
        try {
          const parsedData = JSON.parse(localTotpData)
          console.log('🔍 TOTP Service: TOTP enabled status from localStorage:', parsedData.enabled)
          return parsedData.enabled || false
        } catch (parseError) {
          console.error('🔍 TOTP Service: Failed to parse localStorage TOTP data:', parseError)
        }
      }

      console.log('🔍 TOTP Service: No TOTP data found in database or localStorage')
      return false
    } catch (error) {
      console.error('❌ TOTP Check Error:', error)
      return false
    }
  }

  /**
   * Disable TOTP for a user (emergency only)
   */
  async disableTOTP(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      return !error
    } catch (error) {
      console.error('TOTP Disable Error:', error)
      return false
    }
  }

  /**
   * Generate backup codes for TOTP
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

  /**
   * Verify a backup code
   */
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    try {
      const { data: totpData } = await supabase
        .from('user_totp')
        .select('backup_codes')
        .eq('user_id', userId)
        .single()

      if (!totpData?.backup_codes) {
        return false
      }

      // Decrypt and check each backup code
      for (const encryptedCode of totpData.backup_codes) {
        try {
          const decryptedCode = decryptPHI(encryptedCode)
          if (decryptedCode === code) {
            // Remove the used backup code
            const updatedCodes = totpData.backup_codes.filter(c => c !== encryptedCode)

            await supabase
              .from('user_totp')
              .update({ backup_codes: updatedCodes })
              .eq('user_id', userId)

            return true
          }
        } catch (decryptError) {
          // Skip corrupted backup codes
          continue
        }
      }

      return false
    } catch (error) {
      console.error('Backup code verification error:', error)
      return false
    }
  }

  /**
   * Get remaining backup codes count
   */
  async getRemainingBackupCodes(userId: string): Promise<number> {
    try {
      const { data } = await supabase
        .from('user_totp')
        .select('backup_codes')
        .eq('user_id', userId)
        .single()

      return data?.backup_codes?.length || 0
    } catch (error) {
      console.error('Backup codes count error:', error)
      return 0
    }
  }
}

// Export singleton instance
export const totpService = new TOTPService()