/**
 * Authentication Recovery Service
 * Handles authentication failure recovery and emergency access
 * 
 * Key Features:
 * - Emergency authentication fallback
 * - Account recovery workflows
 * - MFA bypass for critical situations
 * - Database connectivity recovery
 * - User account health monitoring
 * - Automated recovery attempts
 */

import { totpService } from './totpService'
import { authService } from './authService'
import { secureStorage } from './secureStorage'
import { secureLogger } from './secureLogger'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'
import { supabase } from '../config/supabase'
import type { User } from '../types'

const logger = secureLogger.component('AuthRecoveryService')

export interface RecoveryContext {
  userId: string
  userEmail?: string
  recoveryReason: string
  timestamp: Date
  ipAddress?: string
  userAgent?: string
}

export interface RecoveryResult {
  success: boolean
  method: string
  message: string
  temporaryAccess?: boolean
  requiresAdminApproval?: boolean
  validUntil?: Date
}

class AuthRecoveryService {
  private static instance: AuthRecoveryService
  private recoveryAttempts = new Map<string, number>()
  private emergencyAccess = new Map<string, Date>()

  private constructor() {}

  public static getInstance(): AuthRecoveryService {
    if (!AuthRecoveryService.instance) {
      AuthRecoveryService.instance = new AuthRecoveryService()
    }
    return AuthRecoveryService.instance
  }

  /**
   * Attempt comprehensive authentication recovery
   */
  async attemptRecovery(
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      logger.info('Starting authentication recovery', context.userId, undefined, {
        reason: context.recoveryReason
      })

      // Log recovery attempt
      await this.logRecoveryAttempt(context)

      // Check if user is in cooldown period
      if (this.isInCooldown(context.userId)) {
        return {
          success: false,
          method: 'cooldown',
          message: 'Too many recovery attempts. Please wait before trying again.'
        }
      }

      // Increment recovery attempts
      const attempts = this.recoveryAttempts.get(context.userId) || 0
      this.recoveryAttempts.set(context.userId, attempts + 1)

      // Try different recovery methods in order of preference
      const recoveryMethods = [
        () => this.recoverDatabaseConnectivity(context),
        () => this.recoverMFAData(context),
        () => this.recoverUserProfile(context),
        () => this.createEmergencyAccess(context)
      ]

      for (const method of recoveryMethods) {
        try {
          const result = await method()
          if (result.success) {
            // Clear recovery attempts on successful recovery
            this.recoveryAttempts.delete(context.userId)
            
            await this.logSuccessfulRecovery(context, result.method)
            return result
          }
        } catch (error) {
          logger.warn('Recovery method failed', context.userId, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // All methods failed
      await this.logFailedRecovery(context)
      return {
        success: false,
        method: 'all_failed',
        message: 'All recovery methods failed. Please contact administrator.'
      }

    } catch (error) {
      logger.error('Recovery attempt failed', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return {
        success: false,
        method: 'error',
        message: 'Recovery process encountered an error. Please contact support.'
      }
    }
  }

  /**
   * Recover database connectivity issues
   */
  private async recoverDatabaseConnectivity(
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      logger.debug('Attempting database connectivity recovery', context.userId)

      // Test database connection
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', context.userId)
        .maybeSingle()

      if (error) {
        // Database is down - enable offline mode
        await secureStorage.setUserPreference('offline_mode', true, false)
        
        return {
          success: true,
          method: 'offline_mode',
          message: 'Database connectivity issue detected. Offline mode enabled.',
          temporaryAccess: true,
          validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
        }
      }

      if (data) {
        // Database is working - disable offline mode if it was enabled
        await secureStorage.removeItem('offline_mode')
        
        return {
          success: true,
          method: 'database_recovery',
          message: 'Database connectivity restored.'
        }
      }

      return {
        success: false,
        method: 'database_connectivity',
        message: 'Database connectivity could not be restored.'
      }

    } catch (error) {
      logger.warn('Database connectivity recovery failed', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return {
        success: false,
        method: 'database_connectivity',
        message: 'Database connectivity recovery failed.'
      }
    }
  }

  /**
   * Recover MFA data from multiple sources
   */
  private async recoverMFAData(
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      logger.debug('Attempting MFA data recovery', context.userId)

      // Check if TOTP can be recovered from database
      const { data: totpData, error: totpError } = await supabase
        .from('user_totp')
        .select('*')
        .eq('user_id', context.userId)
        .maybeSingle()

      if (totpData && !totpError) {
        // Verify TOTP data integrity
        try {
          const testResult = await totpService.hasTOTPSetup(context.userId)
          if (testResult) {
            return {
              success: true,
              method: 'mfa_database_recovery',
              message: 'MFA data recovered from database.'
            }
          }
        } catch (testError) {
          logger.warn('MFA data integrity check failed', context.userId)
        }
      }

      // Try to recover from user settings
      const { userSettingsService } = await import('./userSettingsService')
      const settings = await userSettingsService.getUserSettings(context.userId)
      
      if (settings?.security_preferences?.mfa_enabled) {
        return {
          success: true,
          method: 'mfa_settings_recovery',
          message: 'MFA configuration recovered from user settings.'
        }
      }

      // Check if user is in critical user list for emergency access
      const criticalUsers = ['dynamic-pierre-user', 'pierre-user-789', 'super-user-456']
      
      if (criticalUsers.includes(context.userId)) {
        const healthStatus = await totpService.checkDatabaseHealthAndFallback(context.userId)
        
        if (healthStatus.usingFallback) {
          return {
            success: true,
            method: 'mfa_emergency_fallback',
            message: 'Emergency MFA fallback created for critical user.',
            temporaryAccess: true,
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          }
        }
      }

      return {
        success: false,
        method: 'mfa_recovery',
        message: 'MFA data could not be recovered.'
      }

    } catch (error) {
      logger.warn('MFA data recovery failed', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return {
        success: false,
        method: 'mfa_recovery',
        message: 'MFA data recovery failed.'
      }
    }
  }

  /**
   * Recover user profile data
   */
  private async recoverUserProfile(
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      logger.debug('Attempting user profile recovery', context.userId)

      // Try to get user from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', context.userId)
        .maybeSingle()

      if (userData && !userError) {
        // Verify user profile integrity
        if (userData.is_active && userData.email) {
          return {
            success: true,
            method: 'profile_database_recovery',
            message: 'User profile recovered from database.'
          }
        }
      }

      // Try alternative user lookup methods
      if (context.userEmail) {
        const { data: emailUser, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', context.userEmail)
          .maybeSingle()

        if (emailUser && !emailError) {
          return {
            success: true,
            method: 'profile_email_recovery',
            message: 'User profile recovered by email lookup.'
          }
        }
      }

      // Check secure storage for cached profile
      const cachedProfile = await secureStorage.getSessionData('current_user')
      if (cachedProfile && cachedProfile.id === context.userId) {
        return {
          success: true,
          method: 'profile_cache_recovery',
          message: 'User profile recovered from secure cache.',
          temporaryAccess: true,
          validUntil: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour
        }
      }

      return {
        success: false,
        method: 'profile_recovery',
        message: 'User profile could not be recovered.'
      }

    } catch (error) {
      logger.warn('User profile recovery failed', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return {
        success: false,
        method: 'profile_recovery',
        message: 'User profile recovery failed.'
      }
    }
  }

  /**
   * Create emergency access for critical situations
   */
  private async createEmergencyAccess(
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      logger.info('Creating emergency access', context.userId)

      // Only allow emergency access for specific scenarios
      const allowedReasons = [
        'database_unavailable',
        'mfa_system_failure',
        'critical_user_lockout',
        'system_emergency'
      ]

      if (!allowedReasons.includes(context.recoveryReason)) {
        return {
          success: false,
          method: 'emergency_access',
          message: 'Emergency access not authorized for this scenario.'
        }
      }

      // Check if user is in critical user list
      const criticalUsers = ['dynamic-pierre-user', 'pierre-user-789', 'super-user-456']
      
      if (!criticalUsers.includes(context.userId)) {
        return {
          success: false,
          method: 'emergency_access',
          message: 'Emergency access only available for critical users.',
          requiresAdminApproval: true
        }
      }

      // Create emergency access token
      const emergencyToken = crypto.randomUUID()
      const validUntil = new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
      
      // Store emergency access
      this.emergencyAccess.set(context.userId, validUntil)
      await secureStorage.setSessionData(
        `emergency_access_${context.userId}`, 
        {
          token: emergencyToken,
          validUntil,
          reason: context.recoveryReason,
          createdAt: new Date()
        }
      )

      // Log emergency access creation
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN,
        ResourceType.SYSTEM,
        `emergency-access-${context.userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'emergency_access_created',
          userId: context.userId,
          reason: context.recoveryReason,
          validUntil: validUntil.toISOString(),
          token: `${emergencyToken.substring(0, 8)}...` // Partial token for audit
        }
      )

      return {
        success: true,
        method: 'emergency_access',
        message: `Emergency access granted. Valid until ${validUntil.toLocaleString()}.`,
        temporaryAccess: true,
        validUntil,
        requiresAdminApproval: false
      }

    } catch (error) {
      logger.error('Emergency access creation failed', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return {
        success: false,
        method: 'emergency_access',
        message: 'Emergency access creation failed.'
      }
    }
  }

  /**
   * Validate emergency access token
   */
  async validateEmergencyAccess(userId: string, token?: string): Promise<boolean> {
    try {
      const emergencyData = await secureStorage.getSessionData(`emergency_access_${userId}`)
      
      if (!emergencyData) {
        return false
      }

      // Check if token matches (if provided)
      if (token && emergencyData.token !== token) {
        return false
      }

      // Check if still valid
      if (new Date() > new Date(emergencyData.validUntil)) {
        // Clean up expired emergency access
        await secureStorage.removeItem(`emergency_access_${userId}`)
        this.emergencyAccess.delete(userId)
        return false
      }

      return true

    } catch (error) {
      logger.error('Emergency access validation failed', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Check if user is in recovery cooldown period
   */
  private isInCooldown(userId: string): boolean {
    const attempts = this.recoveryAttempts.get(userId) || 0
    return attempts >= 5 // Max 5 attempts before cooldown
  }

  /**
   * Clear recovery attempts (call after successful auth)
   */
  public clearRecoveryAttempts(userId: string): void {
    this.recoveryAttempts.delete(userId)
  }

  /**
   * Log recovery attempt
   */
  private async logRecoveryAttempt(context: RecoveryContext): Promise<void> {
    try {
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN,
        ResourceType.SYSTEM,
        `recovery-attempt-${context.userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'auth_recovery_attempt',
          userId: context.userId,
          reason: context.recoveryReason,
          userEmail: context.userEmail,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          timestamp: context.timestamp.toISOString(),
          attemptNumber: this.recoveryAttempts.get(context.userId) || 0
        }
      )
    } catch (error) {
      logger.warn('Failed to log recovery attempt', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Log successful recovery
   */
  private async logSuccessfulRecovery(context: RecoveryContext, method: string): Promise<void> {
    try {
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN,
        ResourceType.SYSTEM,
        `recovery-success-${context.userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'auth_recovery_success',
          userId: context.userId,
          method,
          reason: context.recoveryReason,
          timestamp: context.timestamp.toISOString()
        }
      )
    } catch (error) {
      logger.warn('Failed to log successful recovery', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Log failed recovery
   */
  private async logFailedRecovery(context: RecoveryContext): Promise<void> {
    try {
      await auditLogger.logPHIAccess(
        AuditAction.LOGIN_FAILURE,
        ResourceType.SYSTEM,
        `recovery-failure-${context.userId}`,
        AuditOutcome.FAILURE,
        {
          operation: 'auth_recovery_failure',
          userId: context.userId,
          reason: context.recoveryReason,
          timestamp: context.timestamp.toISOString(),
          totalAttempts: this.recoveryAttempts.get(context.userId) || 0
        }
      )
    } catch (error) {
      logger.warn('Failed to log failed recovery', context.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

// Export singleton instance
export const authRecoveryService = AuthRecoveryService.getInstance()