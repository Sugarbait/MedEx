/**
 * EMERGENCY ACCESS UTILITY
 * One-time bypass for MFA to access settings
 * This is a CRITICAL SECURITY FEATURE and must be used with extreme caution
 */

import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '../services/auditLogger'

interface EmergencyAccessData {
  token: string
  userId: string
  expiresAt: Date
  used: boolean
  reason: string
}

class EmergencyAccessManager {
  private static instance: EmergencyAccessManager
  private emergencyAccess: EmergencyAccessData | null = null

  private constructor() {}

  static getInstance(): EmergencyAccessManager {
    if (!EmergencyAccessManager.instance) {
      EmergencyAccessManager.instance = new EmergencyAccessManager()
    }
    return EmergencyAccessManager.instance
  }

  /**
   * Generate a one-time emergency access token
   * This token expires in 5 minutes or after first use
   */
  generateEmergencyAccess(userId: string, reason: string): string {
    // Generate secure token
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')

    // Store emergency access
    this.emergencyAccess = {
      token,
      userId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      used: false,
      reason
    }

    // Log the emergency access generation
    auditLogger.logPHIAccess(
      AuditAction.EMERGENCY_ACCESS_GENERATED,
      ResourceType.SYSTEM,
      `emergency-access-${userId}`,
      AuditOutcome.SUCCESS,
      {
        reason,
        expiresAt: this.emergencyAccess.expiresAt.toISOString(),
        warning: 'CRITICAL SECURITY EVENT - Emergency MFA bypass generated'
      }
    ).catch(console.error)

    console.warn('🚨 EMERGENCY ACCESS GENERATED', {
      userId,
      reason,
      expiresAt: this.emergencyAccess.expiresAt,
      token: token.substring(0, 8) + '...' // Only log partial token for security
    })

    return token
  }

  /**
   * Validate emergency access token
   * Token is immediately invalidated after successful use
   */
  validateEmergencyAccess(userId: string, token: string): boolean {
    if (!this.emergencyAccess) {
      console.error('No emergency access token exists')
      return false
    }

    // Check if token matches
    if (this.emergencyAccess.token !== token) {
      auditLogger.logPHIAccess(
        AuditAction.EMERGENCY_ACCESS_FAILED,
        ResourceType.SYSTEM,
        `emergency-access-${userId}`,
        AuditOutcome.FAILURE,
        { reason: 'Invalid token' }
      ).catch(console.error)
      return false
    }

    // Check if token belongs to user
    if (this.emergencyAccess.userId !== userId) {
      auditLogger.logPHIAccess(
        AuditAction.EMERGENCY_ACCESS_FAILED,
        ResourceType.SYSTEM,
        `emergency-access-${userId}`,
        AuditOutcome.FAILURE,
        { reason: 'Token user mismatch' }
      ).catch(console.error)
      return false
    }

    // Check if token is expired
    if (new Date() > this.emergencyAccess.expiresAt) {
      auditLogger.logPHIAccess(
        AuditAction.EMERGENCY_ACCESS_FAILED,
        ResourceType.SYSTEM,
        `emergency-access-${userId}`,
        AuditOutcome.FAILURE,
        { reason: 'Token expired' }
      ).catch(console.error)
      this.emergencyAccess = null // Clear expired token
      return false
    }

    // Check if token has been used
    if (this.emergencyAccess.used) {
      auditLogger.logPHIAccess(
        AuditAction.EMERGENCY_ACCESS_FAILED,
        ResourceType.SYSTEM,
        `emergency-access-${userId}`,
        AuditOutcome.FAILURE,
        { reason: 'Token already used' }
      ).catch(console.error)
      return false
    }

    // Mark token as used and log successful access
    this.emergencyAccess.used = true

    auditLogger.logPHIAccess(
      AuditAction.EMERGENCY_ACCESS_USED,
      ResourceType.SYSTEM,
      `emergency-access-${userId}`,
      AuditOutcome.SUCCESS,
      {
        reason: this.emergencyAccess.reason,
        warning: 'CRITICAL SECURITY EVENT - Emergency MFA bypass used'
      }
    ).catch(console.error)

    console.warn('🚨 EMERGENCY ACCESS USED', {
      userId,
      reason: this.emergencyAccess.reason
    })

    // Clear the token after successful use
    setTimeout(() => {
      this.emergencyAccess = null
    }, 1000)

    return true
  }

  /**
   * Check if emergency access is active for a user
   */
  hasActiveEmergencyAccess(userId: string): boolean {
    if (!this.emergencyAccess) return false
    if (this.emergencyAccess.userId !== userId) return false
    if (this.emergencyAccess.used) return false
    if (new Date() > this.emergencyAccess.expiresAt) {
      this.emergencyAccess = null
      return false
    }
    return true
  }

  /**
   * Clear emergency access (for security)
   */
  clearEmergencyAccess(): void {
    if (this.emergencyAccess) {
      auditLogger.logPHIAccess(
        AuditAction.EMERGENCY_ACCESS_CLEARED,
        ResourceType.SYSTEM,
        `emergency-access-${this.emergencyAccess.userId}`,
        AuditOutcome.SUCCESS,
        { reason: 'Manual clear' }
      ).catch(console.error)
    }
    this.emergencyAccess = null
  }
}

export const emergencyAccessManager = EmergencyAccessManager.getInstance()

// Expose to window for emergency use
if (typeof window !== 'undefined') {
  (window as any).emergencyAccess = {
    generate: (userId: string) => {
      const token = emergencyAccessManager.generateEmergencyAccess(
        userId,
        'Administrator emergency access to settings for MFA configuration'
      )
      console.log('🚨 EMERGENCY ACCESS TOKEN (ONE-TIME USE):', token)
      console.log('This token expires in 5 minutes or after first use')
      console.log('To use: window.emergencyAccess.use("' + userId + '", "' + token + '")')
      return 'Token generated - see console for details'
    },
    use: (userId: string, token: string) => {
      const valid = emergencyAccessManager.validateEmergencyAccess(userId, token)
      if (valid) {
        // Set a temporary flag in sessionStorage
        sessionStorage.setItem('emergency_mfa_bypass', 'active')
        sessionStorage.setItem('emergency_mfa_bypass_expires', (Date.now() + 60000).toString()) // 1 minute
        console.log('✅ Emergency access granted for 1 minute. Refresh the page to access settings.')
        return 'Access granted - refresh page'
      } else {
        console.error('❌ Invalid or expired emergency access token')
        return 'Access denied'
      }
    },
    clear: () => {
      emergencyAccessManager.clearEmergencyAccess()
      sessionStorage.removeItem('emergency_mfa_bypass')
      sessionStorage.removeItem('emergency_mfa_bypass_expires')
      return 'Emergency access cleared'
    }
  }
}