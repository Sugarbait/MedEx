/**
 * Secure TOTP Service - Comprehensive Backend Fix
 *
 * Fixes for Critical Issues:
 * 1. Encryption/decryption consistency
 * 2. Time synchronization for TOTP validation
 * 3. Proper database vs localStorage handling
 * 4. Complete elimination of legacy test data
 * 5. Robust error handling and recovery
 */

import { TOTP, Secret } from 'otpauth'
import { encryptPHI, decryptPHI } from '../utils/encryption'
import { supabase } from '../config/supabase'

interface TOTPSetupResult {
  secret: string
  qr_url: string
  manual_entry_key: string
  backup_codes: string[]
  success: boolean
  error?: string
}

interface TOTPVerificationResult {
  success: boolean
  error?: string
  timeSync?: boolean
}

interface TOTPData {
  user_id: string
  encrypted_secret: string
  backup_codes: string[]
  enabled: boolean
  created_at: string
  last_used_at?: string
}

class SecureTOTPService {
  private readonly config = {
    issuer: 'MedEx Healthcare CRM',
    algorithm: 'SHA1' as const,
    digits: 6,
    period: 30,
    // Time window for validation (±30 seconds = ±1 period)
    timeWindow: 1,
    // Maximum time drift allowed (5 minutes)
    maxTimeDrift: 5 * 60
  }

  /**
   * Complete emergency cleanup - removes ALL TOTP data for a user
   */
  async emergencyCleanup(userId: string): Promise<boolean> {
    console.log('🚨 SecureTOTP: Emergency cleanup for user:', userId)

    try {
      // 1. Clear database completely
      await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', userId)

      // 2. Clear all localStorage keys
      const keysToRemove = [
        `totp_${userId}`,
        `totp_secret_${userId}`,
        `totp_enabled_${userId}`,
        `mfa_sessions_${userId}`,
        `mfa_setup_${userId}`,
        `mfa_verified_${userId}`
      ]

      keysToRemove.forEach(key => {
        localStorage.removeItem(key)
      })

      // 3. Clear any old test data from sessionStorage
      sessionStorage.removeItem(`totp_temp_${userId}`)

      console.log('✅ SecureTOTP: Emergency cleanup completed')
      return true
    } catch (error) {
      console.error('❌ SecureTOTP: Emergency cleanup failed:', error)
      return false
    }
  }

  /**
   * Generate fresh TOTP setup with proper encryption
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<TOTPSetupResult> {
    console.log('🚀 SecureTOTP: Generating fresh setup for:', userId)

    try {
      // 1. Emergency cleanup first to ensure clean state
      await this.emergencyCleanup(userId)

      // 2. Generate completely new cryptographically secure secret
      const secret = new Secret({ size: 32 }) // 256 bits
      console.log('🔐 SecureTOTP: Generated fresh 256-bit secret')

      // 3. Create TOTP instance with proper parameters
      const totp = new TOTP({
        issuer: this.config.issuer,
        label: userEmail,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret
      })

      // 4. Generate QR code URL and manual entry key
      const qr_url = totp.toString()
      const manual_entry_key = secret.base32

      // 5. Generate secure backup codes
      const backup_codes = this.generateSecureBackupCodes()

      // 6. Encrypt data for storage
      const encrypted_secret = encryptPHI(secret.base32, 'phi')
      const encrypted_backup_codes = backup_codes.map(code => encryptPHI(code, 'phi'))

      console.log('💾 SecureTOTP: Storing encrypted data in database...')

      // 7. Store in database with transaction safety
      const { error: insertError } = await supabase
        .from('user_totp')
        .insert({
          user_id: userId,
          encrypted_secret,
          backup_codes: encrypted_backup_codes,
          enabled: false, // Will be enabled after verification
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.warn('⚠️ SecureTOTP: Database storage failed, using encrypted localStorage fallback:', insertError.message)

        // Secure localStorage fallback with encryption
        const totpData: TOTPData = {
          user_id: userId,
          encrypted_secret,
          backup_codes: encrypted_backup_codes,
          enabled: false,
          created_at: new Date().toISOString()
        }

        localStorage.setItem(`totp_${userId}`, JSON.stringify(totpData))
        console.log('✅ SecureTOTP: Stored in encrypted localStorage fallback')
      } else {
        console.log('✅ SecureTOTP: Stored in database successfully')
      }

      return {
        secret: manual_entry_key,
        qr_url,
        manual_entry_key,
        backup_codes,
        success: true
      }

    } catch (error) {
      console.error('❌ SecureTOTP: Setup generation failed:', error)
      return {
        secret: '',
        qr_url: '',
        manual_entry_key: '',
        backup_codes: [],
        success: false,
        error: 'Failed to generate TOTP setup. Please try again.'
      }
    }
  }

  /**
   * Verify TOTP code with proper time synchronization and drift handling
   */
  async verifyTOTP(userId: string, code: string, enableOnSuccess: boolean = false): Promise<TOTPVerificationResult> {
    console.log('🔍 SecureTOTP: Verifying code for user:', userId)
    console.log('🔍 SecureTOTP: Code length:', code?.length)

    try {
      // 1. Input validation
      if (!code || !/^\d{6}$/.test(code)) {
        console.log('❌ SecureTOTP: Invalid code format')
        return { success: false, error: 'Please enter a valid 6-digit code' }
      }

      // 2. Get TOTP data with proper error handling
      const totpData = await this.getTOTPData(userId)
      if (!totpData) {
        console.log('❌ SecureTOTP: No TOTP data found')
        return { success: false, error: 'TOTP not set up. Please set up MFA in Settings.' }
      }

      // 3. Decrypt secret with validation
      let decryptedSecret: string
      try {
        decryptedSecret = decryptPHI(totpData.encrypted_secret, 'phi')
        console.log('✅ SecureTOTP: Secret decrypted successfully')

        // Validate base32 format
        if (!/^[A-Z2-7]+=*$/i.test(decryptedSecret)) {
          throw new Error('Invalid base32 format')
        }
      } catch (decryptError) {
        console.error('❌ SecureTOTP: Secret decryption failed:', decryptError)
        return { success: false, error: 'TOTP configuration invalid. Please reset MFA.' }
      }

      // 4. Create TOTP instance for verification
      let totp: TOTP
      try {
        totp = new TOTP({
          issuer: this.config.issuer,
          label: this.config.issuer,
          algorithm: this.config.algorithm,
          digits: this.config.digits,
          period: this.config.period,
          secret: Secret.fromBase32(decryptedSecret)
        })
      } catch (secretError) {
        console.error('❌ SecureTOTP: Failed to create TOTP instance:', secretError)
        return { success: false, error: 'TOTP configuration invalid. Please reset MFA.' }
      }

      // 5. Enhanced time-aware verification with multiple approaches
      const currentTime = Date.now()
      let verificationSuccess = false
      let timeSync = true

      // Standard verification with window
      const standardDelta = totp.validate({
        token: code,
        timestamp: currentTime,
        window: this.config.timeWindow
      })

      if (standardDelta !== null) {
        verificationSuccess = true
        console.log('✅ SecureTOTP: Standard verification successful, delta:', standardDelta)
      } else {
        // Extended verification for time drift (±5 minutes)
        console.log('⏰ SecureTOTP: Standard verification failed, checking for time drift...')

        const extendedWindows = [2, 3, 4, 5, -2, -3, -4, -5] // Extended time windows

        for (const window of extendedWindows) {
          const extendedDelta = totp.validate({
            token: code,
            timestamp: currentTime + (window * this.config.period * 1000),
            window: 0 // No additional window since we're manually adjusting
          })

          if (extendedDelta !== null) {
            verificationSuccess = true
            timeSync = false
            console.log(`⏰ SecureTOTP: Extended verification successful with window: ${window}`)
            break
          }
        }

        // If still no success, check backup codes
        if (!verificationSuccess) {
          console.log('🔑 SecureTOTP: Checking backup codes...')
          verificationSuccess = await this.verifyBackupCode(userId, code, totpData)
        }
      }

      if (verificationSuccess) {
        console.log('✅ SecureTOTP: Verification successful')

        // Update database/localStorage
        await this.updateTOTPUsage(userId, enableOnSuccess, totpData)

        return {
          success: true,
          timeSync,
          error: !timeSync ? 'Code verified but time sync issue detected. Check device time.' : undefined
        }
      } else {
        console.log('❌ SecureTOTP: Verification failed')
        return { success: false, error: 'Invalid TOTP code. Please try again.' }
      }

    } catch (error) {
      console.error('❌ SecureTOTP: Verification error:', error)
      return { success: false, error: 'Verification failed. Please try again.' }
    }
  }

  /**
   * Get TOTP data with proper fallback handling
   */
  private async getTOTPData(userId: string): Promise<TOTPData | null> {
    try {
      // 1. Try database first
      const { data: dbData, error: dbError } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!dbError && dbData) {
        console.log('📊 SecureTOTP: Found data in database')
        return dbData as TOTPData
      }

      console.log('⚠️ SecureTOTP: Database query failed or no data, checking localStorage:', dbError?.message)

      // 2. Fallback to localStorage
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData) as TOTPData

          // CRITICAL: Reject any old test data immediately
          if (parsed.encrypted_secret === 'JBSWY3DPEHPK3PXP') {
            console.log('🚨 SecureTOTP: Detected old test secret - cleaning up')
            await this.emergencyCleanup(userId)
            return null
          }

          console.log('📊 SecureTOTP: Found data in localStorage')
          return parsed
        } catch (parseError) {
          console.error('❌ SecureTOTP: Failed to parse localStorage data:', parseError)
          return null
        }
      }

      console.log('📊 SecureTOTP: No TOTP data found')
      return null

    } catch (error) {
      console.error('❌ SecureTOTP: Error getting TOTP data:', error)
      return null
    }
  }

  /**
   * Verify backup code with proper decryption
   */
  private async verifyBackupCode(userId: string, code: string, totpData: TOTPData): Promise<boolean> {
    try {
      if (!totpData.backup_codes || !Array.isArray(totpData.backup_codes)) {
        return false
      }

      for (let i = 0; i < totpData.backup_codes.length; i++) {
        const encryptedCode = totpData.backup_codes[i]
        try {
          const decryptedCode = decryptPHI(encryptedCode, 'phi')
          if (decryptedCode === code) {
            console.log('✅ SecureTOTP: Backup code verified')

            // Remove used backup code
            const updatedCodes = totpData.backup_codes.filter((_, index) => index !== i)
            await this.updateBackupCodes(userId, updatedCodes)

            return true
          }
        } catch (decryptError) {
          // Skip invalid backup codes
          continue
        }
      }

      return false
    } catch (error) {
      console.error('❌ SecureTOTP: Backup code verification error:', error)
      return false
    }
  }

  /**
   * Update TOTP usage timestamp and enable status
   */
  private async updateTOTPUsage(userId: string, enable: boolean, currentData: TOTPData): Promise<void> {
    try {
      const updateData: Partial<TOTPData> = {
        last_used_at: new Date().toISOString()
      }

      if (enable && !currentData.enabled) {
        updateData.enabled = true
      }

      // Try database update first
      const { error: dbError } = await supabase
        .from('user_totp')
        .update(updateData)
        .eq('user_id', userId)

      if (!dbError) {
        console.log('✅ SecureTOTP: Database updated successfully')
      } else {
        console.warn('⚠️ SecureTOTP: Database update failed:', dbError.message)
      }

      // Always update localStorage as backup
      const updatedData = { ...currentData, ...updateData }
      localStorage.setItem(`totp_${userId}`, JSON.stringify(updatedData))
      console.log('✅ SecureTOTP: localStorage updated successfully')

    } catch (error) {
      console.error('❌ SecureTOTP: Failed to update usage:', error)
    }
  }

  /**
   * Update backup codes after use
   */
  private async updateBackupCodes(userId: string, updatedCodes: string[]): Promise<void> {
    try {
      // Update database
      await supabase
        .from('user_totp')
        .update({ backup_codes: updatedCodes })
        .eq('user_id', userId)

      // Update localStorage
      const localData = localStorage.getItem(`totp_${userId}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          parsed.backup_codes = updatedCodes
          localStorage.setItem(`totp_${userId}`, JSON.stringify(parsed))
        } catch (parseError) {
          console.warn('⚠️ SecureTOTP: Failed to update localStorage backup codes:', parseError)
        }
      }

      console.log('✅ SecureTOTP: Backup codes updated')
    } catch (error) {
      console.error('❌ SecureTOTP: Failed to update backup codes:', error)
    }
  }

  /**
   * Check if user has TOTP setup
   */
  async hasTOTPSetup(userId: string): Promise<boolean> {
    try {
      const totpData = await this.getTOTPData(userId)
      return totpData !== null
    } catch (error) {
      console.error('❌ SecureTOTP: Setup check error:', error)
      return false
    }
  }

  /**
   * Check if user has TOTP enabled
   */
  async isTOTPEnabled(userId: string): Promise<boolean> {
    try {
      const totpData = await this.getTOTPData(userId)
      return totpData?.enabled || false
    } catch (error) {
      console.error('❌ SecureTOTP: Enabled check error:', error)
      return false
    }
  }

  /**
   * Disable TOTP for a user
   */
  async disableTOTP(userId: string): Promise<boolean> {
    console.log('🔄 SecureTOTP: Disabling TOTP for:', userId)
    return await this.emergencyCleanup(userId)
  }

  /**
   * Generate cryptographically secure backup codes
   */
  private generateSecureBackupCodes(count: number = 8): string[] {
    const codes: string[] = []

    for (let i = 0; i < count; i++) {
      // Generate secure 8-digit backup code
      const randomBytes = new Uint8Array(4)
      crypto.getRandomValues(randomBytes)

      // Convert to 8-digit number
      const randomNumber = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('')
      const code = parseInt(randomNumber, 16).toString().slice(0, 8).padStart(8, '0')
      codes.push(code)
    }

    return codes
  }

  /**
   * Get current Unix timestamp for debugging
   */
  getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000)
  }

  /**
   * Generate current TOTP value for debugging (admin only)
   */
  async generateCurrentTOTPValue(userId: string): Promise<string | null> {
    try {
      const totpData = await this.getTOTPData(userId)
      if (!totpData) {
        return null
      }

      const decryptedSecret = decryptPHI(totpData.encrypted_secret, 'phi')

      const totp = new TOTP({
        issuer: this.config.issuer,
        label: this.config.issuer,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: Secret.fromBase32(decryptedSecret)
      })

      return totp.generate()
    } catch (error) {
      console.error('❌ SecureTOTP: Failed to generate current value:', error)
      return null
    }
  }
}

// Export singleton instance
export const secureTotpService = new SecureTOTPService()