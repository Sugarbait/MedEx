/**
 * MFA LOCKOUT SERVICE
 *
 * Handles MFA attempt limiting and lockout functionality for enhanced security:
 * - Tracks failed MFA attempts per user
 * - Enforces 3-attempt limit before lockout
 * - Implements 30-minute lockout period
 * - Maintains HIPAA compliance with audit logging
 * - Persists lockout state across browser sessions
 */

import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'

interface MfaAttemptRecord {
  userId: string
  userEmail: string
  attempts: number
  lastAttempt: number
  lockedUntil?: number
}

interface LockoutStatus {
  isLocked: boolean
  attemptsRemaining: number
  lockoutEnds?: Date
  remainingTime?: number
}

export class MfaLockoutService {
  private static readonly MAX_ATTEMPTS = 3
  private static readonly LOCKOUT_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds
  private static readonly STORAGE_KEY = 'mfa_lockout_data'

  /**
   * Check if user is currently locked out from MFA attempts
   */
  static getLockoutStatus(userId: string, userEmail: string): LockoutStatus {
    const record = this.getMfaAttemptRecord(userId)

    if (!record) {
      return {
        isLocked: false,
        attemptsRemaining: this.MAX_ATTEMPTS
      }
    }

    const now = Date.now()

    // Check if lockout has expired
    if (record.lockedUntil && now >= record.lockedUntil) {
      // Lockout expired - clear the record
      this.clearMfaAttemptRecord(userId)
      return {
        isLocked: false,
        attemptsRemaining: this.MAX_ATTEMPTS
      }
    }

    // Check if currently locked out
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingTime = record.lockedUntil - now
      return {
        isLocked: true,
        attemptsRemaining: 0,
        lockoutEnds: new Date(record.lockedUntil),
        remainingTime
      }
    }

    // Not locked out, return remaining attempts
    return {
      isLocked: false,
      attemptsRemaining: Math.max(0, this.MAX_ATTEMPTS - record.attempts)
    }
  }

  /**
   * Record a failed MFA attempt and check if lockout should be triggered
   */
  static async recordFailedMfaAttempt(userId: string, userEmail: string): Promise<LockoutStatus> {
    const now = Date.now()
    let record = this.getMfaAttemptRecord(userId) || {
      userId,
      userEmail,
      attempts: 0,
      lastAttempt: now
    }

    // Increment attempts
    record.attempts++
    record.lastAttempt = now

    // Check if lockout should be triggered
    if (record.attempts >= this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_DURATION

      // Log lockout event for HIPAA compliance
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACTION,
        ResourceType.SYSTEM,
        `mfa-lockout-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'mfa_lockout_triggered',
          userId: userId,
          userEmail: userEmail,
          attempts: record.attempts,
          lockoutUntil: new Date(record.lockedUntil).toISOString(),
          reason: 'Maximum MFA attempts exceeded'
        }
      )

      console.warn(`🔒 MFA LOCKOUT: User ${userId} locked out for 30 minutes after ${record.attempts} failed attempts`)
    } else {
      // Log failed attempt
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN_FAILURE,
        ResourceType.SYSTEM,
        `mfa-attempt-failed-${userId}`,
        AuditOutcome.FAILURE,
        {
          operation: 'mfa_attempt_failed',
          userId: userId,
          userEmail: userEmail,
          attempts: record.attempts,
          maxAttempts: this.MAX_ATTEMPTS,
          remainingAttempts: this.MAX_ATTEMPTS - record.attempts
        }
      )
    }

    // Store updated record
    this.storeMfaAttemptRecord(record)

    return this.getLockoutStatus(userId, userEmail)
  }

  /**
   * Clear MFA attempts after successful verification
   */
  static async clearMfaAttempts(userId: string, userEmail: string): Promise<void> {
    const record = this.getMfaAttemptRecord(userId)

    if (record && record.attempts > 0) {
      // Log successful MFA completion
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN,
        ResourceType.SYSTEM,
        `mfa-success-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'mfa_verification_success',
          userId: userId,
          userEmail: userEmail,
          previousAttempts: record.attempts,
          action: 'attempts_cleared'
        }
      )
    }

    this.clearMfaAttemptRecord(userId)
    console.log(`✅ MFA attempts cleared for user ${userId}`)
  }

  /**
   * Emergency clear all lockouts (for system administrators)
   */
  static async emergencyClearAllLockouts(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY)

      // Log emergency clear action
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACTION,
        ResourceType.SYSTEM,
        'mfa-emergency-clear',
        AuditOutcome.SUCCESS,
        {
          operation: 'emergency_mfa_lockout_clear',
          action: 'all_lockouts_cleared',
          reason: 'Emergency system action'
        }
      )

      console.log('🚨 EMERGENCY: All MFA lockouts have been cleared')
    } catch (error) {
      console.error('❌ Failed to emergency clear MFA lockouts:', error)
    }
  }

  /**
   * Get formatted lockout time remaining
   */
  static formatTimeRemaining(remainingTime: number): string {
    const minutes = Math.ceil(remainingTime / (60 * 1000))

    if (minutes <= 1) {
      return 'less than 1 minute'
    } else if (minutes < 60) {
      return `${minutes} minutes`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours} hour${hours > 1 ? 's' : ''} and ${remainingMinutes} minutes`
    }
  }

  // ===============================
  // PRIVATE HELPER METHODS
  // ===============================

  /**
   * Get MFA attempt record from storage
   */
  private static getMfaAttemptRecord(userId: string): MfaAttemptRecord | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (!data) return null

      const records: { [userId: string]: MfaAttemptRecord } = JSON.parse(data)
      return records[userId] || null
    } catch (error) {
      console.error('❌ Error reading MFA attempt records:', error)
      return null
    }
  }

  /**
   * Store MFA attempt record
   */
  private static storeMfaAttemptRecord(record: MfaAttemptRecord): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      let records: { [userId: string]: MfaAttemptRecord } = {}

      if (data) {
        records = JSON.parse(data)
      }

      records[record.userId] = record
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records))
    } catch (error) {
      console.error('❌ Error storing MFA attempt record:', error)
    }
  }

  /**
   * Clear MFA attempt record for user
   */
  private static clearMfaAttemptRecord(userId: string): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (!data) return

      const records: { [userId: string]: MfaAttemptRecord } = JSON.parse(data)
      delete records[userId]

      if (Object.keys(records).length === 0) {
        localStorage.removeItem(this.STORAGE_KEY)
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records))
      }
    } catch (error) {
      console.error('❌ Error clearing MFA attempt record:', error)
    }
  }

  /**
   * Clean up expired lockout records (maintenance)
   */
  static cleanupExpiredLockouts(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (!data) return

      const records: { [userId: string]: MfaAttemptRecord } = JSON.parse(data)
      const now = Date.now()
      let hasChanges = false

      for (const [userId, record] of Object.entries(records)) {
        if (record.lockedUntil && now >= record.lockedUntil) {
          delete records[userId]
          hasChanges = true
        }
      }

      if (hasChanges) {
        if (Object.keys(records).length === 0) {
          localStorage.removeItem(this.STORAGE_KEY)
        } else {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records))
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired lockouts:', error)
    }
  }
}

// Export for use in components
export const mfaLockoutService = MfaLockoutService