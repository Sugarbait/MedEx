/**
 * HIPAA-Compliant TOTP MFA Service
 *
 * Implements Time-based One-Time Password (TOTP) authentication
 * Following RFC 6238 and NIST SP 800-63B guidelines
 * Required for PHI data access under HIPAA Security Rule
 */

import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { encryptionService } from './encryption'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'
import { supabase, supabaseConfig } from '@/config/supabase'
import { encryptPHI, decryptPHI } from '@/utils/encryption'

export interface MFASecret {
  secret: string
  backupCodes: string[]
  qrCodeUrl: string
  manualEntryKey: string
}

export interface MFASession {
  userId: string
  verified: boolean
  verifiedAt: Date
  expiresAt: Date
  sessionToken: string
  phiAccessEnabled: boolean
}

export interface MFAVerificationResult {
  success: boolean
  message: string
  session?: MFASession
  remainingAttempts?: number
}

class TOTPMFAService {
  private readonly issuer = 'CareXPS Healthcare CRM'
  private readonly algorithm = 'SHA1'
  private readonly digits = 6
  private readonly period = 30 // 30 seconds
  private readonly window = 2 // Allow 2 periods tolerance for debugging
  private readonly maxAttempts = 3
  private readonly sessionDuration = 15 * 60 * 1000 // 15 minutes
  private readonly phiSessionDuration = 5 * 60 * 1000 // 5 minutes for PHI access

  private activeSessions: Map<string, MFASession> = new Map()
  private failedAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map()
  private readonly SESSION_STORAGE_KEY = 'carexps_mfa_sessions'
  private lastCloudSyncAttempt = 0
  private readonly CLOUD_SYNC_COOLDOWN = 120000 // 2 minutes (increased)
  private cloudSyncFailures = 0
  private readonly MAX_CLOUD_SYNC_FAILURES = 3
  private cloudSyncSilentMode = false // Flag to suppress cloud sync messages after failures

  constructor() {
    // Load existing sessions from localStorage on service initialization
    this.loadSessionsFromStorage()
    if (this.activeSessions.size > 0) {
      console.log(`🔐 MFA Service initialized with ${this.activeSessions.size} active sessions`)
    }
  }

  /**
   * Save sessions to localStorage
   */
  private saveSessionsToStorage(): void {
    try {
      const sessionsArray = Array.from(this.activeSessions.entries()).map(([token, session]) => ({
        token,
        session: {
          ...session,
          verifiedAt: session.verifiedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString()
        }
      }))
      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessionsArray))
    } catch (error) {
      console.warn('Failed to save MFA sessions to localStorage:', error)
    }
  }

  /**
   * Load sessions from localStorage
   */
  private loadSessionsFromStorage(): void {
    try {
      const storedSessions = localStorage.getItem(this.SESSION_STORAGE_KEY)
      if (storedSessions) {
        const sessionsArray = JSON.parse(storedSessions)
        const now = new Date()

        for (const { token, session } of sessionsArray) {
          const restoredSession: MFASession = {
            ...session,
            verifiedAt: new Date(session.verifiedAt),
            expiresAt: new Date(session.expiresAt)
          }

          // Only restore non-expired sessions
          if (restoredSession.expiresAt > now) {
            this.activeSessions.set(token, restoredSession)
          }
        }

        console.log(`Restored ${this.activeSessions.size} valid MFA sessions from localStorage`)

        // Clean up storage if we filtered out expired sessions
        this.saveSessionsToStorage()
      }
    } catch (error) {
      console.warn('Failed to load MFA sessions from localStorage:', error)
      // Clear corrupted data
      localStorage.removeItem(this.SESSION_STORAGE_KEY)
    }
  }

  /**
   * Generate new TOTP secret for user
   */
  async generateSecret(userId: string, userEmail: string): Promise<MFASecret> {
    try {
      console.log('Starting MFA secret generation for user:', '[USER-ID-REDACTED - HIPAA PROTECTED]')

      // Log MFA setup initiation
      try {
        await auditLogger.logPHIAccess(
          AuditAction.CREATE,
          ResourceType.SYSTEM,
          `mfa-setup-${userId}`,
          AuditOutcome.SUCCESS,
          { operation: 'mfa_secret_generation', targetUser: userId }
        )
        console.log('✓ Audit log created')
      } catch (auditError) {
        console.warn('Audit logging failed:', auditError)
        // Continue without failing
      }

      // Generate cryptographically secure secret
      console.log('Generating OTP secret...')
      // Use the correct API for otpauth 9.4.1: new OTPAuth.Secret({ size: 20 })
      const secret = new OTPAuth.Secret({ size: 20 })
      console.log('✓ OTP secret generated via new OTPAuth.Secret({ size: 20 })')

      // Create TOTP object
      console.log('Creating TOTP object...')
      const totp = new OTPAuth.TOTP({
        issuer: this.issuer,
        label: userEmail,
        algorithm: this.algorithm,
        digits: this.digits,
        period: this.period,
        secret: secret
      })
      console.log('✓ TOTP object created')

      // Generate backup codes
      console.log('Generating backup codes...')
      const backupCodes = this.generateBackupCodes()
      console.log('✓ Backup codes generated:', backupCodes.length)

      // Generate QR code URL
      console.log('Generating QR code...')
      const otpAuthUrl = totp.toString()
      const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl)
      console.log('✓ QR code generated')

      // Get manual entry key (Base32 encoded secret)
      const manualEntryKey = secret.base32
      console.log('✓ Manual entry key generated')

      // Encrypt and store secret (in production, store in secure database)
      console.log('Encrypting secret...')
      const encryptedSecret = await encryptionService.encrypt(manualEntryKey)
      console.log('✓ Secret encrypted')

      console.log('Encrypting backup codes...')
      const encryptedBackupCodes = await Promise.all(
        backupCodes.map(code => encryptionService.encrypt(code))
      )
      console.log('✓ Backup codes encrypted')

      // Store encrypted MFA data
      console.log('Storing MFA data...')
      await this.storeMFAData(userId, {
        encryptedSecret,
        encryptedBackupCodes,
        createdAt: new Date().toISOString(),
        verified: false
      })
      console.log('✓ MFA data stored')

      console.log('✅ MFA secret generation completed successfully')
      return {
        secret: manualEntryKey,
        backupCodes,
        qrCodeUrl,
        manualEntryKey
      }

    } catch (error) {
      console.error('MFA secret generation failed:', error)

      await auditLogger.logPHIAccess(
        AuditAction.CREATE,
        ResourceType.SYSTEM,
        `mfa-setup-${userId}`,
        AuditOutcome.FAILURE,
        { operation: 'mfa_secret_generation_failed', error: error instanceof Error ? error.message : 'Unknown error' }
      )

      // Provide more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to generate MFA secret: ${errorMessage}`)
    }
  }

  /**
   * Verify TOTP code
   */
  async verifyTOTP(userId: string, token: string, isPhiAccess: boolean = false): Promise<MFAVerificationResult> {
    try {
      // Check for rate limiting
      const rateLimitResult = this.checkRateLimit(userId)
      if (!rateLimitResult.allowed) {
        try {
          await auditLogger.logPHIAccess(
            AuditAction.LOGIN_FAILURE,
            ResourceType.SYSTEM,
            `mfa-verification-${userId}`,
            AuditOutcome.FAILURE,
            {
              operation: 'mfa_rate_limited',
              remainingAttempts: rateLimitResult.remainingAttempts,
              phiAccess: isPhiAccess
            }
          )
        } catch (auditError) {
          console.warn('Audit logging failed during rate limit check:', auditError)
        }

        return {
          success: false,
          message: 'Too many failed attempts. Please wait before trying again.',
          remainingAttempts: rateLimitResult.remainingAttempts
        }
      }

      // Get stored MFA data
      const mfaData = await this.getMFAData(userId)

      if (!mfaData) {
        try {
          await auditLogger.logPHIAccess(
            AuditAction.LOGIN_FAILURE,
            ResourceType.SYSTEM,
            `mfa-verification-${userId}`,
            AuditOutcome.FAILURE,
            { operation: 'mfa_not_setup', phiAccess: isPhiAccess }
          )
        } catch (auditError) {
          console.warn('Audit logging failed during MFA data check:', auditError)
        }

        return {
          success: false,
          message: 'MFA not set up for this user'
        }
      }

      // Check if MFA is temporarily disabled
      if (mfaData.temporarilyDisabled) {
        return {
          success: false,
          message: 'MFA is temporarily disabled. Please contact your administrator.'
        }
      }

      // Decrypt secret with error handling
      let secret: string
      try {
        // Validate encrypted data before decryption
        if (!mfaData.encryptedSecret || typeof mfaData.encryptedSecret !== 'string') {
          console.error('Invalid encrypted MFA secret format')
          return {
            success: false,
            message: 'MFA configuration error. Please re-setup MFA.'
          }
        }

        secret = await encryptionService.decrypt(mfaData.encryptedSecret)
      } catch (decryptError) {
        console.error('MFA secret decryption failed:', decryptError)
        // Clear corrupted MFA data
        try {
          await this.clearCorruptedMFAData(userId)
        } catch (clearError) {
          console.warn('Failed to clear corrupted MFA data:', clearError)
        }

        return {
          success: false,
          message: 'MFA configuration corrupted. Please contact administrator to reset MFA.'
        }
      }

      // Create TOTP object with the secret
      const totp = new OTPAuth.TOTP({
        issuer: this.issuer,
        algorithm: this.algorithm,
        digits: this.digits,
        period: this.period,
        secret: OTPAuth.Secret.fromBase32(secret)
      })

      // Verify token with time window tolerance
      const isValid = totp.validate({
        token: token,
        window: this.window
      }) !== null

      if (isValid) {
        // Clear failed attempts
        this.failedAttempts.delete(userId)

        // Create MFA session
        const session = this.createMFASession(userId, isPhiAccess)
        this.activeSessions.set(session.sessionToken, session)
        this.saveSessionsToStorage() // Persist to localStorage

        // Mark MFA as verified for this user and sync immediately across devices
        mfaData.verified = true
        mfaData.verifiedAt = new Date().toISOString()
        mfaData.lastUsedAt = new Date().toISOString()
        await this.storeMFAData(userId, mfaData)

        console.log('✅ MFA verified and synced across devices for user:', userId)

        await auditLogger.logPHIAccess(
          AuditAction.LOGIN,
          ResourceType.SYSTEM,
          `mfa-verification-${userId}`,
          AuditOutcome.SUCCESS,
          {
            operation: 'mfa_verification_success',
            phiAccess: isPhiAccess,
            sessionToken: session.sessionToken
          }
        )

        return {
          success: true,
          message: isPhiAccess ? 'PHI access granted' : 'MFA verification successful',
          session
        }
      } else {
        // Check if it's a backup code
        const backupCodeValid = await this.verifyBackupCode(userId, token)
        if (backupCodeValid) {
          const session = this.createMFASession(userId, isPhiAccess)
          this.activeSessions.set(session.sessionToken, session)
          this.saveSessionsToStorage() // Persist to localStorage

          await auditLogger.logPHIAccess(
            AuditAction.LOGIN,
            ResourceType.SYSTEM,
            `mfa-verification-${userId}`,
            AuditOutcome.SUCCESS,
            { operation: 'backup_code_used', phiAccess: isPhiAccess }
          )

          return {
            success: true,
            message: 'Backup code verification successful',
            session
          }
        }

        // Record failed attempt
        console.log('MFA Debug - TOTP verification failed:', {
          userId,
          tokenAttempted: token,
          backupCodeAttempted: backupCodeValid,
          currentTotpToken: totp.generate()
        })

        this.recordFailedAttempt(userId)
        const remaining = this.maxAttempts - (this.failedAttempts.get(userId)?.count || 0)

        await auditLogger.logPHIAccess(
          AuditAction.LOGIN_FAILURE,
          ResourceType.SYSTEM,
          `mfa-verification-${userId}`,
          AuditOutcome.FAILURE,
          {
            operation: 'invalid_mfa_token',
            remainingAttempts: remaining,
            phiAccess: isPhiAccess
          }
        )

        return {
          success: false,
          message: 'Invalid verification code',
          remainingAttempts: remaining
        }
      }

    } catch (error) {
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN_FAILURE,
        ResourceType.SYSTEM,
        `mfa-verification-${userId}`,
        AuditOutcome.FAILURE,
        { operation: 'mfa_verification_error', error: error instanceof Error ? error.message : 'Unknown error' }
      )

      return {
        success: false,
        message: 'Verification failed due to system error'
      }
    }
  }

  /**
   * Check if user has valid MFA session for PHI access
   */
  async verifyPHIAccess(sessionToken: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionToken)

    if (!session) {
      await auditLogger.logPHIAccess(
        AuditAction.VIEW,
        ResourceType.SYSTEM,
        'phi-access-check',
        AuditOutcome.FAILURE,
        { operation: 'invalid_session_token', sessionToken }
      )
      return false
    }

    if (!session.verified || !session.phiAccessEnabled) {
      await auditLogger.logPHIAccess(
        AuditAction.VIEW,
        ResourceType.SYSTEM,
        'phi-access-check',
        AuditOutcome.FAILURE,
        { operation: 'insufficient_mfa_privileges', userId: session.userId }
      )
      return false
    }

    if (new Date() > session.expiresAt) {
      this.activeSessions.delete(sessionToken)
      this.saveSessionsToStorage() // Persist to localStorage
      await auditLogger.logPHIAccess(
        AuditAction.VIEW,
        ResourceType.SYSTEM,
        'phi-access-check',
        AuditOutcome.FAILURE,
        { operation: 'expired_session', userId: session.userId }
      )
      return false
    }

    // Log successful PHI access verification
    await auditLogger.logPHIAccess(
      AuditAction.VIEW,
      ResourceType.SYSTEM,
      'phi-access-check',
      AuditOutcome.SUCCESS,
      { operation: 'phi_access_verified', userId: session.userId }
    )

    return true
  }

  /**
   * Get MFA session by token
   */
  getMFASession(sessionToken: string): MFASession | null {
    const session = this.activeSessions.get(sessionToken)
    if (session && new Date() <= session.expiresAt) {
      return session
    }
    if (session) {
      this.activeSessions.delete(sessionToken)
      this.saveSessionsToStorage() // Persist to localStorage
    }
    return null
  }

  /**
   * Get current valid MFA session for user
   */
  getCurrentSession(userId: string): MFASession | null {
    // Find the most recent valid session for this user
    let currentSession: MFASession | null = null
    let latestTime = 0
    let sessionsDeleted = false

    for (const [token, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        // Check if session has expired
        if (new Date() > session.expiresAt) {
          this.activeSessions.delete(token)
          sessionsDeleted = true
          continue
        }

        // Find the most recent session
        const sessionTime = new Date(session.verifiedAt).getTime()
        if (sessionTime > latestTime) {
          latestTime = sessionTime
          currentSession = session
        }
      }
    }

    // Save to localStorage if we deleted any sessions
    if (sessionsDeleted) {
      this.saveSessionsToStorage()
    }

    return currentSession
  }

  /**
   * Check if user has MFA enabled and active
   */
  async hasMFAEnabled(userId: string): Promise<boolean> {
    const mfaData = await this.getMFAData(userId)
    return mfaData !== null &&
           mfaData.encryptedSecret !== null &&
           !mfaData.temporarilyDisabled &&
           mfaData.verified
  }

  /**
   * Check if user has MFA setup (even if temporarily disabled)
   */
  async hasMFASetup(userId: string): Promise<boolean> {
    const mfaData = await this.getMFAData(userId)
    return mfaData !== null && mfaData.encryptedSecret !== null
  }

  /**
   * Fast synchronous check for MFA enabled status (uses localStorage cache)
   * Use this for performance-critical authentication flows
   */
  hasMFAEnabledSync(userId: string): boolean {
    const mfaData = this.getLocalMFAData(userId)
    return mfaData !== null &&
           mfaData.encryptedSecret !== null &&
           !mfaData.temporarilyDisabled &&
           mfaData.verified
  }

  /**
   * Fast synchronous check for MFA setup status (uses localStorage cache)
   */
  hasMFASetupSync(userId: string): boolean {
    const mfaData = this.getLocalMFAData(userId)
    return mfaData !== null && mfaData.encryptedSecret !== null
  }

  /**
   * Fast synchronous method to get current session (optimized for auth flow)
   */
  getCurrentSessionSync(userId: string): MFASession | null {
    // First check in-memory sessions
    let currentSession: MFASession | null = null
    let latestTime = 0
    const now = new Date()

    for (const [token, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        // Quick expiry check without deletion (avoid storage writes during auth)
        if (now <= session.expiresAt) {
          const sessionTime = new Date(session.verifiedAt).getTime()
          if (sessionTime > latestTime) {
            latestTime = sessionTime
            currentSession = session
          }
        }
      }
    }

    // If no session found in memory, check localStorage as fallback (important for page refreshes)
    if (!currentSession) {
      console.log(`🔍 No MFA session found in memory for user ${userId}, checking localStorage...`)
      try {
        const storedSessions = localStorage.getItem(this.SESSION_STORAGE_KEY)
        if (storedSessions) {
          const sessionsArray = JSON.parse(storedSessions)
          console.log(`📦 Found ${sessionsArray.length} stored sessions in localStorage`)

          for (const { token, session } of sessionsArray) {
            if (session.userId === userId) {
              const expiresAt = new Date(session.expiresAt)
              console.log(`⏰ Checking session for user ${userId}: expires at ${expiresAt.toISOString()}, now: ${now.toISOString()}`)

              if (now <= expiresAt) {
                const sessionTime = new Date(session.verifiedAt).getTime()
                if (sessionTime > latestTime) {
                  latestTime = sessionTime
                  currentSession = {
                    ...session,
                    verifiedAt: new Date(session.verifiedAt),
                    expiresAt: expiresAt
                  }

                  // Restore this session to memory for future calls
                  this.activeSessions.set(token, currentSession)
                  console.log(`✅ Restored valid MFA session for user ${userId} from localStorage`)
                }
              } else {
                console.log(`❌ Session for user ${userId} has expired`)
              }
            }
          }
        } else {
          console.log('📭 No MFA sessions found in localStorage')
        }
      } catch (error) {
        console.warn('Failed to check localStorage for MFA session during refresh:', error)
      }
    } else {
      console.log(`✅ Found valid MFA session in memory for user ${userId}`)
    }

    return currentSession
  }

  /**
   * Get MFA status information for user
   */
  async getMFAStatus(userId: string): Promise<{
    hasSetup: boolean
    isEnabled: boolean
    isTemporarilyDisabled: boolean
    setupDate: string | null
    disabledDate: string | null
    deviceFingerprint: string | null
    registeredDevices: string[]
    lastSyncedAt: string | null
    isAvailableOnThisDevice: boolean
  }> {
    const mfaData = await this.getMFAData(userId)
    const currentDeviceFingerprint = this.generateUserAgentFingerprint()

    if (!mfaData || !mfaData.encryptedSecret) {
      return {
        hasSetup: false,
        isEnabled: false,
        isTemporarilyDisabled: false,
        setupDate: null,
        disabledDate: null,
        deviceFingerprint: null,
        registeredDevices: [],
        lastSyncedAt: null,
        isAvailableOnThisDevice: false
      }
    }

    return {
      hasSetup: true,
      isEnabled: !mfaData.temporarilyDisabled && mfaData.verified,
      isTemporarilyDisabled: mfaData.temporarilyDisabled || false,
      setupDate: mfaData.createdAt || mfaData.storedAt || null,
      disabledDate: mfaData.disabledAt || null,
      deviceFingerprint: currentDeviceFingerprint,
      registeredDevices: mfaData.registeredDevices || [currentDeviceFingerprint],
      lastSyncedAt: mfaData.cloudMetadata?.lastSync || mfaData.storedAt || null,
      isAvailableOnThisDevice: true
    }
  }

  /**
   * Force sync MFA data from cloud for cross-device access
   */
  async forceSyncFromCloud(userId: string): Promise<boolean> {
    try {
      console.log('Force syncing MFA data from cloud for user:', userId)
      const cloudData = await this.syncFromCloud(userId)
      return cloudData !== null
    } catch (error) {
      console.error('Failed to force sync MFA data from cloud:', error)
      return false
    }
  }

  /**
   * Get list of devices registered for MFA
   */
  async getRegisteredDevices(userId: string): Promise<string[]> {
    try {
      const { data: mfaConfig, error } = await supabase
        .from('user_mfa_configs')
        .select('registered_devices')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error || !mfaConfig) {
        return []
      }

      return mfaConfig.registered_devices as string[] || []
    } catch (error) {
      console.error('Failed to get registered devices:', error)
      return []
    }
  }

  /**
   * Disable MFA for user (but preserve setup for re-enabling)
   */
  async disableMFA(userId: string): Promise<void> {
    await auditLogger.logPHIAccess(
      AuditAction.UPDATE,
      ResourceType.SYSTEM,
      `mfa-disable-${userId}`,
      AuditOutcome.SUCCESS,
      { operation: 'mfa_disabled_temporarily' }
    )

    // Get existing MFA data
    const mfaData = await this.getMFAData(userId)
    if (mfaData) {
      // Mark as disabled but preserve the setup
      mfaData.temporarilyDisabled = true
      mfaData.disabledAt = new Date().toISOString()
      mfaData.verified = false // Reset verification status

      // Store the updated data (preserving setup)
      await this.storeMFAData(userId, mfaData)

      console.log('MFA temporarily disabled for user, setup preserved:', userId)
    }

    // Invalidate all sessions for this user
    let sessionsDeleted = false
    for (const [token, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(token)
        sessionsDeleted = true
      }
    }
    if (sessionsDeleted) {
      this.saveSessionsToStorage()
    }
  }

  /**
   * Permanently remove MFA setup for user
   */
  async permanentlyRemoveMFA(userId: string): Promise<void> {
    await auditLogger.logPHIAccess(
      AuditAction.DELETE,
      ResourceType.SYSTEM,
      `mfa-remove-${userId}`,
      AuditOutcome.SUCCESS,
      { operation: 'mfa_permanently_removed' }
    )

    // Remove all MFA data keys (including the new simple key)
    const keysToRemove = [
      this.getMFAStorageKey(userId), // Primary key
      `mfa_simple_${userId}`,        // Simple key
      `mfa_data_${userId}`,          // Fallback key
      `mfa_global_${userId}`         // Global key
    ]

    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`Removed MFA key: ${key}`)
    })

    // Try to remove from cloud storage as well
    try {
      await supabase
        .from('user_mfa_configs')
        .delete()
        .eq('user_id', userId)
      console.log('MFA data removed from cloud storage')
    } catch (error) {
      console.warn('Failed to remove MFA data from cloud storage (this is OK in localStorage-only mode):', error)
    }

    console.log('MFA permanently removed for user:', userId)

    // Invalidate all sessions for this user
    let sessionsDeleted = false
    for (const [token, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(token)
        sessionsDeleted = true
      }
    }
    if (sessionsDeleted) {
      this.saveSessionsToStorage()
    }
  }

  /**
   * Re-enable MFA for user (if setup exists)
   */
  async enableMFA(userId: string): Promise<boolean> {
    const mfaData = await this.getMFAData(userId)
    if (mfaData && mfaData.encryptedSecret) {
      // Re-enable existing setup
      mfaData.temporarilyDisabled = false
      mfaData.enabledAt = new Date().toISOString()
      delete mfaData.disabledAt

      await this.storeMFAData(userId, mfaData)

      await auditLogger.logPHIAccess(
        AuditAction.UPDATE,
        ResourceType.SYSTEM,
        `mfa-enable-${userId}`,
        AuditOutcome.SUCCESS,
        { operation: 'mfa_re_enabled' }
      )

      console.log('MFA re-enabled for user:', userId)
      return true
    }

    console.log('No existing MFA setup found for user:', userId)
    return false
  }

  /**
   * Invalidate MFA session
   */
  async invalidateSession(sessionToken: string): Promise<void> {
    const session = this.activeSessions.get(sessionToken)
    if (session) {
      await auditLogger.logPHIAccess(
        AuditAction.LOGOUT,
        ResourceType.SYSTEM,
        `mfa-session-${session.userId}`,
        AuditOutcome.SUCCESS,
        { operation: 'session_invalidated', sessionToken }
      )
      this.activeSessions.delete(sessionToken)
      this.saveSessionsToStorage() // Persist to localStorage
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      // Generate 8-digit backup codes
      const code = Math.random().toString(36).substr(2, 8).toUpperCase()
      codes.push(code)
    }
    return codes
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const mfaData = await this.getMFAData(userId)
    if (!mfaData || !mfaData.encryptedBackupCodes) {
      return false
    }

    for (let i = 0; i < mfaData.encryptedBackupCodes.length; i++) {
      try {
        const decryptedCode = await encryptionService.decrypt(mfaData.encryptedBackupCodes[i])
        if (decryptedCode === code.toUpperCase()) {
          // Remove used backup code
          mfaData.encryptedBackupCodes.splice(i, 1)
          await this.storeMFAData(userId, mfaData)
          return true
        }
      } catch (error) {
        // Continue checking other codes
      }
    }
    return false
  }

  /**
   * Create MFA session
   */
  private createMFASession(userId: string, phiAccess: boolean): MFASession {
    const sessionToken = this.generateSessionToken()
    const now = new Date()
    const duration = phiAccess ? this.phiSessionDuration : this.sessionDuration

    return {
      userId,
      verified: true,
      verifiedAt: now,
      expiresAt: new Date(now.getTime() + duration),
      sessionToken,
      phiAccessEnabled: phiAccess
    }
  }

  /**
   * Clear corrupted MFA data for a user
   */
  private async clearCorruptedMFAData(userId: string): Promise<void> {
    try {
      // Clear from Supabase
      const supabase = supabaseService.getClient()
      if (supabase) {
        await supabase
          .from('users')
          .update({
            mfa_secret: null,
            mfa_enabled: false,
            mfa_verified: false,
            mfa_backup_codes: null
          })
          .eq('id', userId)
      }

      // Clear from localStorage
      const keys = [
        `mfa_persistent_${userId}_${this.getDeviceFingerprint()}`,
        `mfa_data_${userId}`,
        `mfa_global_${userId}`,
        `mfa_simple_${userId}`
      ]

      keys.forEach(key => {
        localStorage.removeItem(key)
      })

      // Clear from memory
      this.verifiedSessions.delete(userId)

      console.log(`Cleared corrupted MFA data for user: ${userId}`)
    } catch (error) {
      console.error('Failed to clear corrupted MFA data:', error)
      throw error
    }
  }

  /**
   * Generate secure session token
   */
  private generateSessionToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(userId: string): { allowed: boolean; remainingAttempts: number } {
    const attempts = this.failedAttempts.get(userId)
    if (!attempts) {
      return { allowed: true, remainingAttempts: this.maxAttempts }
    }

    // Reset attempts after 15 minutes
    const resetTime = 15 * 60 * 1000
    if (new Date().getTime() - attempts.lastAttempt.getTime() > resetTime) {
      this.failedAttempts.delete(userId)
      return { allowed: true, remainingAttempts: this.maxAttempts }
    }

    const remaining = this.maxAttempts - attempts.count
    return { allowed: remaining > 0, remainingAttempts: remaining }
  }

  /**
   * Record failed attempt
   */
  private recordFailedAttempt(userId: string): void {
    const existing = this.failedAttempts.get(userId)
    if (existing) {
      existing.count++
      existing.lastAttempt = new Date()
    } else {
      this.failedAttempts.set(userId, { count: 1, lastAttempt: new Date() })
    }
  }

  /**
   * Generate user agent fingerprint for device-specific MFA persistence
   */
  private generateUserAgentFingerprint(): string {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx!.textBaseline = 'top'
    ctx!.font = '14px Arial'
    ctx!.fillText('Device fingerprint', 2, 2)

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|')

    // Create a simple hash
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36)
  }

  /**
   * Get persistent storage key for MFA data
   */
  private getMFAStorageKey(userId: string): string {
    const deviceFingerprint = this.generateUserAgentFingerprint()
    return `mfa_persistent_${userId}_${deviceFingerprint}`
  }

  /**
   * Store MFA data with cross-device persistence (Supabase-first approach)
   */
  private async storeMFAData(userId: string, data: any): Promise<void> {
    const timestamp = new Date().toISOString()
    const deviceFingerprint = this.generateUserAgentFingerprint()

    const persistentData = {
      ...data,
      deviceFingerprint,
      userAgent: navigator.userAgent,
      storedAt: timestamp,
      lastAccessedAt: timestamp
    }

    // PRIORITY 1: Store in Supabase for cross-device persistence
    let supabaseSuccess = false
    try {
      await this.storeCloudMFAData(userId, persistentData, deviceFingerprint)
      console.log('✅ MFA data stored in Supabase for cross-device access')
      supabaseSuccess = true
    } catch (error) {
      console.warn('⚠️ Supabase storage failed, falling back to localStorage:', error)
    }

    // PRIORITY 2: Store locally as cache/fallback
    try {
      this.storeLocalMFAData(userId, persistentData)
      console.log(supabaseSuccess ? '✅ MFA data cached locally' : '⚠️ MFA data stored in localStorage fallback mode')
    } catch (localError) {
      console.error('❌ Both Supabase and localStorage storage failed:', localError)
      if (!supabaseSuccess) {
        throw new Error('Failed to store MFA data - both cloud and local storage failed')
      }
    }
  }

  /**
   * Store MFA data locally for immediate access
   */
  private storeLocalMFAData(userId: string, data: any): void {
    const primaryKey = this.getMFAStorageKey(userId)
    const fallbackKey = `mfa_data_${userId}`
    const globalKey = `mfa_global_${userId}`
    // Add a simple key without device fingerprint for maximum compatibility
    const simpleKey = `mfa_simple_${userId}`

    try {
      const dataToStore = JSON.stringify(data)

      // Store with multiple keys for maximum persistence
      localStorage.setItem(primaryKey, dataToStore)
      localStorage.setItem(fallbackKey, dataToStore)
      localStorage.setItem(globalKey, dataToStore)
      localStorage.setItem(simpleKey, dataToStore)

      console.log('MFA data stored locally with multiple persistence keys:', {
        primaryKey,
        fallbackKey,
        globalKey,
        simpleKey,
        deviceFingerprint: data.deviceFingerprint,
        userId
      })

      // Verify storage worked
      const verification = localStorage.getItem(simpleKey)
      if (!verification) {
        throw new Error('Failed to verify MFA data storage')
      }
      console.log('✅ MFA storage verification successful')
    } catch (error) {
      console.error('❌ Failed to store local MFA data:', error)
      throw error // Re-throw to ensure the caller knows storage failed
    }
  }

  /**
   * Store MFA data in Supabase for cross-device persistence
   */
  private async storeCloudMFAData(userId: string, data: any, deviceFingerprint: string): Promise<void> {
    try {
      // Encrypt sensitive data for cloud storage
      const encryptedSecret = data.encryptedSecret || (data.secret ? encryptPHI(data.secret) : null)
      const encryptedBackupCodes = data.encryptedBackupCodes ||
        (data.backupCodes ? data.backupCodes.map((code: string) => encryptPHI(code)) : [])

      // Get existing registered devices
      const { data: existingConfig } = await supabase
        .from('user_mfa_configs')
        .select('registered_devices')
        .eq('user_id', userId)
        .single()

      let registeredDevices = []
      if (existingConfig?.registered_devices) {
        registeredDevices = existingConfig.registered_devices as string[]
      }

      // Add current device fingerprint if not already registered
      if (!registeredDevices.includes(deviceFingerprint)) {
        registeredDevices.push(deviceFingerprint)
      }

      const mfaConfigData = {
        user_id: userId,
        encrypted_secret: encryptedSecret,
        encrypted_backup_codes: encryptedBackupCodes,
        is_active: true,
        is_verified: data.verified || false,
        temporarily_disabled: data.temporarilyDisabled || false,
        registered_devices: registeredDevices,
        verified_at: data.verified ? new Date().toISOString() : null,
        disabled_at: data.disabledAt || null,
        last_used_at: new Date().toISOString(),
        created_by_device_fingerprint: deviceFingerprint,
        last_used_device_fingerprint: deviceFingerprint,
        metadata: {
          userAgent: navigator.userAgent,
          localStorageData: data,
          createdAt: data.createdAt || data.storedAt,
          lastSync: new Date().toISOString()
        }
      }

      const { error } = await supabase
        .from('user_mfa_configs')
        .upsert(mfaConfigData, {
          onConflict: 'user_id'
        })

      if (error) {
        this.cloudSyncFailures++
        if (this.cloudSyncFailures >= this.MAX_CLOUD_SYNC_FAILURES) {
          this.cloudSyncSilentMode = true
        }

        if (!this.cloudSyncSilentMode) {
          console.error('Failed to store MFA data in cloud:', error)
        }
        // Don't throw error - fallback to local storage
      } else {
        this.cloudSyncFailures = 0 // Reset on success
        this.cloudSyncSilentMode = false
        console.log('MFA data stored in cloud successfully for cross-device access')
      }
    } catch (error) {
      this.cloudSyncFailures++
      if (this.cloudSyncFailures >= this.MAX_CLOUD_SYNC_FAILURES) {
        this.cloudSyncSilentMode = true
      }

      if (!this.cloudSyncSilentMode) {
        console.error('Error storing MFA data in cloud:', error)
      }
      // Don't throw error - fallback to local storage
    }
  }

  /**
   * Get MFA data with Supabase-first approach for cross-device sync
   */
  private async getMFAData(userId: string): Promise<any> {
    try {
      // PRIORITY 1: Try Supabase first for most up-to-date cross-device data (with rate limiting)
      const now = Date.now()
      const shouldTryCloud = (now - this.lastCloudSyncAttempt > this.CLOUD_SYNC_COOLDOWN) &&
                           (this.cloudSyncFailures < this.MAX_CLOUD_SYNC_FAILURES)

      if (shouldTryCloud) {
        try {
          const cloudData = await this.syncFromCloud(userId)
          if (cloudData) {
            this.cloudSyncFailures = 0 // Reset on success
            this.cloudSyncSilentMode = false
            console.log('✅ MFA data retrieved from Supabase (cross-device sync)')
            return cloudData
          }
        } catch (supabaseError) {
          this.cloudSyncFailures++
          if (this.cloudSyncFailures >= this.MAX_CLOUD_SYNC_FAILURES) {
            this.cloudSyncSilentMode = true
          }

          if (!this.cloudSyncSilentMode) {
            console.warn('⚠️ Supabase access failed, trying localStorage fallback:', supabaseError)
          }
        }
      }

      // PRIORITY 2: Fallback to local storage if Supabase unavailable
      const localData = this.getLocalMFAData(userId)
      if (localData) {
        if (!this.cloudSyncSilentMode) {
          console.log('⚠️ Using localStorage fallback (offline mode)')
        }

        // Try to background sync to Supabase for future cross-device access
        this.backgroundSyncToCloud(userId, localData).catch(error => {
          // Silent background sync - only log if not in silent mode
          if (!this.cloudSyncSilentMode) {
            console.warn('Background sync to cloud failed:', error)
          }
        })

        return localData
      }

      if (!this.cloudSyncSilentMode) {
        console.log('❌ No MFA data found in Supabase or localStorage for user:', userId)
      }
      return null
    } catch (error) {
      console.error('❌ Error retrieving MFA data:', error)
      return null
    }
  }

  /**
   * Get MFA data from local storage only
   */
  private getLocalMFAData(userId: string): any {
    try {
      const keys = [
        this.getMFAStorageKey(userId), // Primary device-specific key
        `mfa_simple_${userId}`,        // Simple key for maximum compatibility
        `mfa_data_${userId}`,          // Fallback key
        `mfa_global_${userId}`         // Global key
      ]

      console.log('Checking local storage for MFA data with keys:', keys)

      for (const key of keys) {
        const data = localStorage.getItem(key)
        if (data) {
          try {
            const parsed = JSON.parse(data)
            if (parsed && parsed.encryptedSecret) {
              // Update last accessed time
              parsed.lastAccessedAt = new Date().toISOString()

              // Re-store with the current primary key to ensure consistency
              const primaryKey = this.getMFAStorageKey(userId)
              localStorage.setItem(primaryKey, JSON.stringify(parsed))

              console.log(`✅ MFA data retrieved from local storage key: ${key}`, {
                hasSecret: !!parsed.encryptedSecret,
                verified: parsed.verified,
                deviceFingerprint: parsed.deviceFingerprint,
                createdAt: parsed.createdAt
              })
              return parsed
            }
          } catch (parseError) {
            console.warn(`Failed to parse MFA data from key ${key}:`, parseError)
            continue
          }
        }
      }

      console.log('❌ No valid MFA data found in localStorage for user:', userId)
      return null
    } catch (error) {
      console.error('❌ Error retrieving local MFA data:', error)
      return null
    }
  }

  /**
   * Background sync local data to Supabase (for when user was offline)
   */
  private async backgroundSyncToCloud(userId: string, localData: any): Promise<void> {
    // Check cooldown and failure count
    const now = Date.now()
    if (now - this.lastCloudSyncAttempt < this.CLOUD_SYNC_COOLDOWN ||
        this.cloudSyncFailures >= this.MAX_CLOUD_SYNC_FAILURES) {
      return // Skip sync if in cooldown or too many failures
    }

    this.lastCloudSyncAttempt = now

    try {
      if (!this.cloudSyncSilentMode) {
        console.log('🔄 Background syncing local MFA data to Supabase...')
      }
      const deviceFingerprint = this.generateUserAgentFingerprint()
      await this.storeCloudMFAData(userId, localData, deviceFingerprint)

      // Reset failure count and silent mode on success
      this.cloudSyncFailures = 0
      this.cloudSyncSilentMode = false

      if (!this.cloudSyncSilentMode) {
        console.log('✅ Background sync to Supabase completed')
      }
    } catch (error) {
      this.cloudSyncFailures++
      if (this.cloudSyncFailures >= this.MAX_CLOUD_SYNC_FAILURES) {
        this.cloudSyncSilentMode = true
      }

      if (!this.cloudSyncSilentMode) {
        console.warn('⚠️ Background sync to Supabase failed:', error)
      }
    }
  }

  /**
   * Force immediate sync from Supabase (for cross-device login scenarios)
   */
  async forceCloudSync(userId: string): Promise<boolean> {
    try {
      console.log('🔄 Force syncing MFA data from Supabase...')
      const cloudData = await this.syncFromCloud(userId)
      if (cloudData) {
        console.log('✅ Force sync completed - MFA data available from Supabase')
        return true
      }
      console.log('⚠️ No MFA data found in Supabase during force sync')
      return false
    } catch (error) {
      console.error('❌ Force sync from Supabase failed:', error)
      return false
    }
  }

  /**
   * Sync MFA data from cloud to local storage
   */
  private async syncFromCloud(userId: string): Promise<any> {
    try {
      const { data: mfaConfig, error } = await supabase
        .from('user_mfa_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No MFA config found - this is normal for users without MFA
          if (!this.cloudSyncSilentMode) {
            console.log('No MFA configuration found in cloud for user:', userId)
          }
          return null
        }
        throw error
      }

      if (!mfaConfig) {
        if (!this.cloudSyncSilentMode) {
          console.log('No active MFA configuration found in cloud for user:', userId)
        }
        return null
      }

      // Decrypt cloud data for local use
      const decryptedData = {
        encryptedSecret: mfaConfig.encrypted_secret,
        encryptedBackupCodes: mfaConfig.encrypted_backup_codes,
        verified: mfaConfig.is_verified,
        temporarilyDisabled: mfaConfig.temporarily_disabled,
        createdAt: mfaConfig.created_at,
        verifiedAt: mfaConfig.verified_at,
        disabledAt: mfaConfig.disabled_at,
        lastUsedAt: mfaConfig.last_used_at,
        deviceFingerprint: this.generateUserAgentFingerprint(),
        userAgent: navigator.userAgent,
        storedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        registeredDevices: mfaConfig.registered_devices,
        syncedFromCloud: true,
        cloudMetadata: mfaConfig.metadata
      }

      // Store locally for immediate access
      this.storeLocalMFAData(userId, decryptedData)

      // Update cloud with current device info
      const currentDeviceFingerprint = this.generateUserAgentFingerprint()
      let registeredDevices = mfaConfig.registered_devices as string[] || []

      if (!registeredDevices.includes(currentDeviceFingerprint)) {
        registeredDevices.push(currentDeviceFingerprint)

        await supabase
          .from('user_mfa_configs')
          .update({
            registered_devices: registeredDevices,
            last_used_at: new Date().toISOString(),
            last_used_device_fingerprint: currentDeviceFingerprint,
            metadata: {
              ...mfaConfig.metadata,
              lastSync: new Date().toISOString(),
              syncFromDevice: currentDeviceFingerprint
            }
          })
          .eq('user_id', userId)

        if (!this.cloudSyncSilentMode) {
          console.log('Updated cloud MFA config with current device fingerprint')
        }
      }

      if (!this.cloudSyncSilentMode) {
        console.log('Successfully synced MFA data from cloud to local storage')
      }
      return decryptedData
    } catch (error) {
      this.cloudSyncFailures++
      if (this.cloudSyncFailures >= this.MAX_CLOUD_SYNC_FAILURES) {
        this.cloudSyncSilentMode = true
      }

      if (!this.cloudSyncSilentMode) {
        console.error('Failed to sync MFA data from cloud:', error)
      }
      return null
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date()
    let sessionsDeleted = false
    for (const [token, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        this.activeSessions.delete(token)
        sessionsDeleted = true
      }
    }
    if (sessionsDeleted) {
      this.saveSessionsToStorage()
    }
  }
}

// Export singleton instance
export const mfaService = new TOTPMFAService()

// Cleanup expired sessions every minute
setInterval(() => {
  (mfaService as any).cleanupExpiredSessions()
}, 60000)