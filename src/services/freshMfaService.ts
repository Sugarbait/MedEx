/**
 * 🆕 FRESH MFA SERVICE - Built from scratch with zero corruption
 *
 * This is a completely new, clean MFA implementation that:
 * - Uses clean Base32 secret generation
 * - No encryption corruption
 * - Simple, reliable TOTP verification
 * - Clean database storage
 */

import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { supabase } from '../config/supabase'

export interface FreshMfaSetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

export interface FreshMfaVerification {
  success: boolean
  message: string
}

export class FreshMfaService {
  /**
   * Generate a completely fresh TOTP setup
   */
  static async generateMfaSetup(userId: string, userEmail: string): Promise<FreshMfaSetup> {
    try {
      console.log('🆕 FreshMFA: Generating completely new MFA setup for:', userId)

      // Generate clean Base32 secret (32 chars = 160 bits)
      const secret = this.generateCleanBase32Secret()

      console.log('✅ Generated clean Base32 secret:', {
        length: secret.length,
        isValidBase32: this.isValidBase32(secret)
      })

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: 'CareXPS CRM',
        label: userEmail,
        secret: secret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      })

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(totp.toString())

      // Generate backup codes
      const backupCodes = this.generateBackupCodes()

      // Store in database (clean, no encryption corruption)
      await this.storeFreshMfaData(userId, {
        secret,
        backupCodes,
        enabled: false, // Not enabled until verified
        setupCompleted: false
      })

      console.log('✅ Fresh MFA setup generated successfully')

      return {
        secret,
        qrCodeUrl,
        backupCodes
      }

    } catch (error) {
      console.error('❌ Fresh MFA setup generation failed:', error)
      throw new Error(`MFA setup generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Verify TOTP code and complete MFA setup
   */
  static async verifyAndEnableMfa(userId: string, totpCode: string): Promise<FreshMfaVerification> {
    try {
      console.log('🔍 FreshMFA: Verifying TOTP code for user:', userId)

      // Get fresh MFA data from database
      const mfaData = await this.getFreshMfaData(userId)
      if (!mfaData) {
        return {
          success: false,
          message: 'MFA setup not found. Please start setup again.'
        }
      }

      // Create TOTP instance with stored secret
      const totp = new OTPAuth.TOTP({
        secret: mfaData.secret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      })

      // Verify the code
      const isValid = totp.validate({
        token: totpCode,
        window: 1 // Allow 1 time step tolerance
      })

      if (isValid !== null) {
        // Code is valid - enable MFA
        await this.enableFreshMfa(userId)

        console.log('✅ TOTP code verified successfully - MFA enabled')

        return {
          success: true,
          message: 'MFA enabled successfully!'
        }
      } else {
        console.log('❌ TOTP code verification failed')

        return {
          success: false,
          message: 'Invalid TOTP code. Please check your authenticator app and try again.'
        }
      }

    } catch (error) {
      console.error('❌ Fresh MFA verification failed:', error)
      return {
        success: false,
        message: 'Verification failed. Please try again.'
      }
    }
  }

  /**
   * Check if user has MFA enabled
   */
  static async isMfaEnabled(userId: string): Promise<boolean> {
    try {
      const mfaData = await this.getFreshMfaData(userId)
      return mfaData?.enabled === true && mfaData?.setupCompleted === true
    } catch (error) {
      console.error('❌ Error checking MFA status:', error)
      return false
    }
  }

  /**
   * Verify TOTP code for login
   */
  static async verifyLoginCode(userId: string, totpCode: string): Promise<boolean> {
    try {
      const mfaData = await this.getFreshMfaData(userId)
      if (!mfaData?.enabled) {
        return false
      }

      const totp = new OTPAuth.TOTP({
        secret: mfaData.secret,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      })

      const isValid = totp.validate({
        token: totpCode,
        window: 1
      })

      return isValid !== null
    } catch (error) {
      console.error('❌ Login TOTP verification failed:', error)
      return false
    }
  }

  /**
   * Disable MFA for a user
   */
  static async disableMfa(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          fresh_mfa_secret: null,
          fresh_mfa_enabled: false,
          fresh_mfa_setup_completed: false,
          fresh_mfa_backup_codes: null
        })
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Error disabling MFA:', error)
        return false
      }

      console.log('✅ MFA disabled successfully')
      return true
    } catch (error) {
      console.error('❌ Error disabling MFA:', error)
      return false
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Generate a clean Base32 secret (no corruption possible)
   */
  private static generateCleanBase32Secret(): string {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let secret = ''

    // Generate 32 character Base32 secret (160 bits of entropy)
    for (let i = 0; i < 32; i++) {
      const randomIndex = Math.floor(Math.random() * base32Chars.length)
      secret += base32Chars[randomIndex]
    }

    return secret
  }

  /**
   * Validate Base32 format
   */
  private static isValidBase32(secret: string): boolean {
    const base32Regex = /^[A-Z2-7]+$/
    return base32Regex.test(secret) && secret.length >= 16
  }

  /**
   * Generate backup codes
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = []

    for (let i = 0; i < 10; i++) {
      // Generate 8-digit backup code
      const code = Math.random().toString().slice(2, 10)
      codes.push(code)
    }

    return codes
  }

  /**
   * Store fresh MFA data in database (clean storage)
   */
  private static async storeFreshMfaData(userId: string, data: any): Promise<void> {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        fresh_mfa_secret: data.secret, // Store as plain text - no encryption corruption
        fresh_mfa_enabled: data.enabled,
        fresh_mfa_setup_completed: data.setupCompleted,
        fresh_mfa_backup_codes: JSON.stringify(data.backupCodes),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id' // Specify the column for conflict resolution
      })

    if (error) {
      console.error('❌ Error storing fresh MFA data:', error)
      throw new Error('Failed to store MFA data')
    }

    console.log('✅ Fresh MFA data stored successfully')
  }

  /**
   * Get fresh MFA data from database
   */
  private static async getFreshMfaData(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('fresh_mfa_secret, fresh_mfa_enabled, fresh_mfa_setup_completed, fresh_mfa_backup_codes')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      console.log('ℹ️ No fresh MFA data found for user:', userId)
      return null
    }

    return {
      secret: data.fresh_mfa_secret,
      enabled: data.fresh_mfa_enabled,
      setupCompleted: data.fresh_mfa_setup_completed,
      backupCodes: data.fresh_mfa_backup_codes ? JSON.parse(data.fresh_mfa_backup_codes) : []
    }
  }

  /**
   * Enable fresh MFA after successful verification
   */
  private static async enableFreshMfa(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_settings')
      .update({
        fresh_mfa_enabled: true,
        fresh_mfa_setup_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('❌ Error enabling fresh MFA:', error)
      throw new Error('Failed to enable MFA')
    }

    console.log('✅ Fresh MFA enabled successfully')
  }
}

// Export singleton instance
export const freshMfaService = new FreshMfaService()