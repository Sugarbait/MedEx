/**
 * AUTOMATED LOCKOUT SERVICE
 *
 * Provides advanced automated account lockout functionality for suspicious
 * activity beyond just MFA failures. Integrates with incident response
 * system to provide comprehensive account protection.
 *
 * Features:
 * - Multiple lockout triggers and conditions
 * - Graduated response based on threat level
 * - Automatic unlock scheduling
 * - Emergency override capabilities
 * - HIPAA-compliant lockout logging
 * - User notification and communication
 * - Administrative review workflows
 */

import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'
import { incidentResponseService } from './incidentResponseService'
import { notificationService } from './notificationService'
import {
  SecurityIncident,
  IncidentType,
  IncidentSeverity,
  UserSecurityProfile,
  NotificationType
} from '@/types/incidentTypes'

export interface LockoutRule {
  id: string
  name: string
  description: string
  triggers: LockoutTrigger[]
  conditions: LockoutConditions
  response: LockoutResponse
  isActive: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
}

export interface LockoutTrigger {
  type: 'incident_type' | 'incident_count' | 'risk_score' | 'failed_attempts' | 'suspicious_pattern'
  value: any
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches'
  timeWindow?: number // milliseconds
}

export interface LockoutConditions {
  minimumIncidents?: number
  maximumRiskScore?: number
  userRoles?: string[]
  businessHoursOnly?: boolean
  excludeEmergencyUsers?: boolean
  requireManagerApproval?: boolean
}

export interface LockoutResponse {
  lockoutType: 'temporary' | 'permanent' | 'conditional'
  duration?: number // milliseconds for temporary lockouts
  severity: 'warning' | 'lockout' | 'suspend' | 'disable'
  notifyUser: boolean
  notifyAdministrators: boolean
  requireManualUnlock: boolean
  escalationRules?: LockoutEscalation[]
}

export interface LockoutEscalation {
  delay: number // milliseconds
  action: 'notify_security' | 'disable_account' | 'require_manager_approval' | 'emergency_review'
  recipients: string[]
}

export interface UserLockout {
  id: string
  userId: string
  userEmail: string
  ruleId: string
  ruleName: string
  lockoutType: 'temporary' | 'permanent' | 'conditional'
  severity: 'warning' | 'lockout' | 'suspend' | 'disable'
  reason: string
  triggerIncidentId?: string
  lockedAt: Date
  expiresAt?: Date
  unlockConditions?: string[]
  status: 'active' | 'expired' | 'manually_unlocked' | 'escalated'
  attempts: LockoutAttempt[]
  notifications: LockoutNotification[]
  adminActions: LockoutAdminAction[]
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface LockoutAttempt {
  id: string
  timestamp: Date
  attemptType: 'login' | 'password_reset' | 'mfa_verify' | 'api_access'
  sourceIP: string
  userAgent: string
  success: boolean
  blockReason?: string
  metadata?: Record<string, any>
}

export interface LockoutNotification {
  id: string
  type: 'user_notification' | 'admin_notification' | 'escalation'
  channel: 'email' | 'sms' | 'push' | 'webhook'
  recipient: string
  sentAt: Date
  delivered: boolean
  message: string
  error?: string
}

export interface LockoutAdminAction {
  id: string
  adminUserId: string
  adminUserEmail: string
  action: 'unlock' | 'extend' | 'escalate' | 'approve' | 'deny' | 'review'
  reason: string
  timestamp: Date
  effectiveAt?: Date
  metadata?: Record<string, any>
}

export interface LockoutStats {
  // Lockout counts
  totalLockouts: number
  activeLockouts: number
  expiredLockouts: number
  manualUnlocks: number

  // Lockout types
  temporaryLockouts: number
  permanentLockouts: number
  conditionalLockouts: number

  // Severity distribution
  warnings: number
  lockouts: number
  suspensions: number
  disabled: number

  // Time-based metrics
  averageLockoutDuration: number
  longestActiveLockout: number
  recentLockouts: UserLockout[]

  // User metrics
  usersAffected: number
  repeatOffenders: number
  escalatedCases: number
}

export class AutomatedLockoutService {
  private static instance: AutomatedLockoutService
  private lockoutRules: Map<string, LockoutRule> = new Map()
  private activeLockouts: Map<string, UserLockout> = new Map()
  private isInitialized = false

  // Storage keys
  private static readonly STORAGE_KEYS = {
    RULES: 'automated_lockout_rules',
    LOCKOUTS: 'active_lockouts',
    ATTEMPTS: 'lockout_attempts',
    STATS: 'lockout_statistics'
  }

  constructor() {
    this.setupDefaultRules()
  }

  /**
   * Singleton instance
   */
  static getInstance(): AutomatedLockoutService {
    if (!AutomatedLockoutService.instance) {
      AutomatedLockoutService.instance = new AutomatedLockoutService()
    }
    return AutomatedLockoutService.instance
  }

  /**
   * Initialize the automated lockout service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Load configuration
      this.loadConfiguration()

      // Set up incident monitoring
      this.setupIncidentMonitoring()

      // Set up periodic tasks
      this.setupPeriodicTasks()

      // Clean up expired lockouts
      await this.cleanupExpiredLockouts()

      // Log initialization
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACCESS,
        ResourceType.SYSTEM,
        'automated-lockout-service',
        AuditOutcome.SUCCESS,
        {
          operation: 'automated_lockout_service_initialization',
          rulesCount: this.lockoutRules.size,
          activeLockoutsCount: this.activeLockouts.size,
          timestamp: new Date().toISOString()
        }
      )

      this.isInitialized = true
      console.log('✅ Automated Lockout Service initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize Automated Lockout Service:', error)
      throw error
    }
  }

  /**
   * Evaluate whether a user should be locked out based on an incident
   */
  async evaluateIncidentForLockout(incident: SecurityIncident): Promise<UserLockout | null> {
    try {
      if (!incident.userId || !incident.userEmail) {
        return null // Cannot lock out without user information
      }

      // Check if user is already locked out
      const existingLockout = this.getActiveLockout(incident.userId)
      if (existingLockout && existingLockout.severity === 'disable') {
        console.log(`⏭️ User ${incident.userId} already disabled, skipping lockout evaluation`)
        return null
      }

      // Find matching rules
      const matchingRules = await this.findMatchingRules(incident)

      if (matchingRules.length === 0) {
        return null // No rules match
      }

      // Sort by priority and take the highest priority rule
      const rule = matchingRules.sort((a, b) => b.priority - a.priority)[0]

      // Create lockout
      const lockout = await this.createLockout(incident.userId, incident.userEmail, rule, incident)

      // Execute lockout response
      await this.executeLockoutResponse(lockout)

      console.log(`🔒 User ${incident.userEmail} locked out by rule: ${rule.name}`)
      return lockout

    } catch (error) {
      console.error('❌ Failed to evaluate incident for lockout:', error)
      return null
    }
  }

  /**
   * Evaluate user for lockout based on risk score
   */
  async evaluateUserRiskForLockout(userId: string): Promise<UserLockout | null> {
    try {
      const userProfile = incidentResponseService.getUserSecurityProfile(userId)
      if (!userProfile) {
        return null
      }

      // Check if user is already locked out
      const existingLockout = this.getActiveLockout(userId)
      if (existingLockout) {
        return null // Already locked out
      }

      // Find rules that match risk score
      const matchingRules = Array.from(this.lockoutRules.values()).filter(rule => {
        if (!rule.isActive) return false

        return rule.triggers.some(trigger =>
          trigger.type === 'risk_score' &&
          this.evaluateTrigger(trigger, { riskScore: userProfile.riskScore })
        )
      })

      if (matchingRules.length === 0) {
        return null
      }

      // Sort by priority and take the highest priority rule
      const rule = matchingRules.sort((a, b) => b.priority - a.priority)[0]

      // Create a synthetic incident for the risk score
      const riskIncident: SecurityIncident = {
        id: `risk-${Date.now()}`,
        type: IncidentType.ANOMALOUS_BEHAVIOR,
        severity: userProfile.riskScore >= 80 ? IncidentSeverity.CRITICAL : IncidentSeverity.HIGH,
        status: 'OPEN' as any,
        title: 'High Risk Score Detected',
        description: `User ${userProfile.userEmail} has high risk score: ${userProfile.riskScore}/100`,
        timestamp: new Date(),
        userId: userProfile.userId,
        userEmail: userProfile.userEmail,
        sourceIP: '127.0.0.1',
        userAgent: 'automated-lockout-service',
        metadata: { riskScore: userProfile.riskScore, automated: true },
        evidence: [],
        response: { automated: [], manual: [], notifications: [], containment: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Create lockout
      const lockout = await this.createLockout(userId, userProfile.userEmail, rule, riskIncident)

      // Execute lockout response
      await this.executeLockoutResponse(lockout)

      console.log(`🔒 User ${userProfile.userEmail} locked out due to high risk score: ${userProfile.riskScore}`)
      return lockout

    } catch (error) {
      console.error('❌ Failed to evaluate user risk for lockout:', error)
      return null
    }
  }

  /**
   * Attempt to access account (check if locked out)
   */
  async checkAccountAccess(userId: string, attemptType: 'login' | 'password_reset' | 'mfa_verify' | 'api_access'): Promise<{
    allowed: boolean
    lockout?: UserLockout
    reason?: string
  }> {
    try {
      const lockout = this.getActiveLockout(userId)

      if (!lockout) {
        return { allowed: true }
      }

      // Record the attempt
      await this.recordLockoutAttempt(lockout, attemptType, false, 'Account locked')

      // Check if lockout has expired
      if (lockout.expiresAt && new Date() > lockout.expiresAt) {
        await this.unlockUser(userId, 'automatic_expiration', 'system', 'Lockout period expired')
        return { allowed: true }
      }

      // Check if lockout is conditional and conditions are met
      if (lockout.lockoutType === 'conditional' && await this.checkUnlockConditions(lockout)) {
        await this.unlockUser(userId, 'conditions_met', 'system', 'Unlock conditions satisfied')
        return { allowed: true }
      }

      return {
        allowed: false,
        lockout,
        reason: `Account locked: ${lockout.reason}`
      }

    } catch (error) {
      console.error('❌ Failed to check account access:', error)
      return { allowed: false, reason: 'Error checking account status' }
    }
  }

  /**
   * Manually unlock a user
   */
  async unlockUser(
    userId: string,
    action: 'manual_unlock' | 'emergency_unlock' | 'automatic_expiration' | 'conditions_met',
    adminUserId: string,
    reason: string
  ): Promise<boolean> {
    try {
      const lockout = this.getActiveLockout(userId)
      if (!lockout) {
        console.log(`⚠️ No active lockout found for user ${userId}`)
        return false
      }

      // Record admin action
      const adminAction: LockoutAdminAction = {
        id: this.generateId(),
        adminUserId,
        adminUserEmail: adminUserId, // Would get from user service in real implementation
        action: action.includes('unlock') ? 'unlock' : 'approve',
        reason,
        timestamp: new Date(),
        effectiveAt: new Date()
      }

      lockout.adminActions.push(adminAction)
      lockout.status = 'manually_unlocked'
      lockout.updatedAt = new Date()

      // Update storage
      this.activeLockouts.set(userId, lockout)
      this.saveLockouts()

      // Send notification to user
      if (lockout.status === 'manually_unlocked') {
        await notificationService.sendCustomNotification(
          NotificationType.ACCOUNT_LOCKOUT,
          [{
            type: 'email',
            value: lockout.userEmail,
            channel: 'email'
          }],
          'account_unlocked',
          {
            userEmail: lockout.userEmail,
            reason: reason,
            unlockedBy: adminUserId,
            timestamp: new Date().toISOString()
          }
        )
      }

      // Log the unlock
      await auditLogger.logPHIAccess(
        AuditAction.UPDATE,
        ResourceType.USER,
        `lockout-unlock-${userId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'user_account_unlocked',
          userId,
          userEmail: lockout.userEmail,
          lockoutId: lockout.id,
          unlockReason: reason,
          unlockedBy: adminUserId,
          lockoutDuration: Date.now() - lockout.lockedAt.getTime()
        }
      )

      // Remove from active lockouts
      this.activeLockouts.delete(userId)
      this.saveLockouts()

      console.log(`✅ User ${lockout.userEmail} unlocked by ${adminUserId}: ${reason}`)
      return true

    } catch (error) {
      console.error('❌ Failed to unlock user:', error)
      return false
    }
  }

  /**
   * Get lockout statistics
   */
  async getLockoutStats(): Promise<LockoutStats> {
    try {
      const allLockouts = this.getAllLockouts()
      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000

      const activeLockouts = Array.from(this.activeLockouts.values())
      const expiredLockouts = allLockouts.filter(l => l.status === 'expired')
      const manualUnlocks = allLockouts.filter(l => l.status === 'manually_unlocked')

      const recentLockouts = allLockouts
        .filter(l => l.createdAt.getTime() > oneDayAgo)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)

      const lockoutDurations = allLockouts
        .filter(l => l.expiresAt)
        .map(l => l.expiresAt!.getTime() - l.lockedAt.getTime())

      const averageLockoutDuration = lockoutDurations.length > 0
        ? lockoutDurations.reduce((sum, duration) => sum + duration, 0) / lockoutDurations.length
        : 0

      const longestActiveLockout = activeLockouts.length > 0
        ? Math.max(...activeLockouts.map(l => now - l.lockedAt.getTime()))
        : 0

      const userIds = new Set(allLockouts.map(l => l.userId))
      const repeatOffenders = Array.from(userIds).filter(userId =>
        allLockouts.filter(l => l.userId === userId).length > 1
      ).length

      return {
        totalLockouts: allLockouts.length,
        activeLockouts: activeLockouts.length,
        expiredLockouts: expiredLockouts.length,
        manualUnlocks: manualUnlocks.length,
        temporaryLockouts: allLockouts.filter(l => l.lockoutType === 'temporary').length,
        permanentLockouts: allLockouts.filter(l => l.lockoutType === 'permanent').length,
        conditionalLockouts: allLockouts.filter(l => l.lockoutType === 'conditional').length,
        warnings: allLockouts.filter(l => l.severity === 'warning').length,
        lockouts: allLockouts.filter(l => l.severity === 'lockout').length,
        suspensions: allLockouts.filter(l => l.severity === 'suspend').length,
        disabled: allLockouts.filter(l => l.severity === 'disable').length,
        averageLockoutDuration,
        longestActiveLockout,
        recentLockouts,
        usersAffected: userIds.size,
        repeatOffenders,
        escalatedCases: allLockouts.filter(l => l.status === 'escalated').length
      }

    } catch (error) {
      console.error('❌ Failed to get lockout stats:', error)
      throw error
    }
  }

  /**
   * Find matching lockout rules for an incident
   */
  private async findMatchingRules(incident: SecurityIncident): Promise<LockoutRule[]> {
    const matchingRules: LockoutRule[] = []

    for (const rule of this.lockoutRules.values()) {
      if (!rule.isActive) continue

      // Check if rule matches the incident
      let ruleMatches = false

      for (const trigger of rule.triggers) {
        if (this.evaluateTrigger(trigger, {
          incidentType: incident.type,
          incidentSeverity: incident.severity,
          incidentCount: await this.getIncidentCountForUser(incident.userId!, trigger.timeWindow),
          riskScore: await this.getUserRiskScore(incident.userId!)
        })) {
          ruleMatches = true
          break
        }
      }

      if (ruleMatches && await this.checkRuleConditions(rule, incident)) {
        matchingRules.push(rule)
      }
    }

    return matchingRules
  }

  /**
   * Evaluate a trigger against provided data
   */
  private evaluateTrigger(trigger: LockoutTrigger, data: any): boolean {
    const getValue = () => {
      switch (trigger.type) {
        case 'incident_type':
          return data.incidentType
        case 'incident_count':
          return data.incidentCount
        case 'risk_score':
          return data.riskScore
        case 'failed_attempts':
          return data.failedAttempts
        default:
          return null
      }
    }

    const value = getValue()
    if (value === null || value === undefined) return false

    switch (trigger.operator) {
      case 'equals':
        return value === trigger.value
      case 'greater_than':
        return value > trigger.value
      case 'less_than':
        return value < trigger.value
      case 'contains':
        return Array.isArray(trigger.value) ? trigger.value.includes(value) : false
      case 'matches':
        return new RegExp(trigger.value).test(String(value))
      default:
        return false
    }
  }

  /**
   * Check rule conditions
   */
  private async checkRuleConditions(rule: LockoutRule, incident: SecurityIncident): Promise<boolean> {
    // Check minimum incidents
    if (rule.conditions.minimumIncidents) {
      const incidentCount = await this.getIncidentCountForUser(incident.userId!, 24 * 60 * 60 * 1000) // 24 hours
      if (incidentCount < rule.conditions.minimumIncidents) {
        return false
      }
    }

    // Check maximum risk score
    if (rule.conditions.maximumRiskScore) {
      const riskScore = await this.getUserRiskScore(incident.userId!)
      if (riskScore > rule.conditions.maximumRiskScore) {
        return false
      }
    }

    // Check business hours
    if (rule.conditions.businessHoursOnly && !this.isBusinessHours()) {
      return false
    }

    return true
  }

  /**
   * Create a lockout for a user
   */
  private async createLockout(
    userId: string,
    userEmail: string,
    rule: LockoutRule,
    incident: SecurityIncident
  ): Promise<UserLockout> {
    const lockout: UserLockout = {
      id: this.generateId(),
      userId,
      userEmail,
      ruleId: rule.id,
      ruleName: rule.name,
      lockoutType: rule.response.lockoutType,
      severity: rule.response.severity,
      reason: `${rule.name}: ${incident.title}`,
      triggerIncidentId: incident.id,
      lockedAt: new Date(),
      expiresAt: rule.response.duration ? new Date(Date.now() + rule.response.duration) : undefined,
      unlockConditions: [],
      status: 'active',
      attempts: [],
      notifications: [],
      adminActions: [],
      metadata: {
        ruleId: rule.id,
        incidentId: incident.id,
        incidentType: incident.type,
        severity: incident.severity,
        automated: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Store lockout
    this.activeLockouts.set(userId, lockout)
    this.saveLockouts()

    // Log the lockout
    await auditLogger.logPHIAccess(
      AuditAction.CREATE,
      ResourceType.USER,
      `lockout-${lockout.id}`,
      AuditOutcome.SUCCESS,
      {
        operation: 'user_account_locked',
        userId,
        userEmail,
        lockoutId: lockout.id,
        ruleId: rule.id,
        ruleName: rule.name,
        lockoutType: rule.response.lockoutType,
        severity: rule.response.severity,
        incidentId: incident.id,
        expiresAt: lockout.expiresAt?.toISOString()
      }
    )

    return lockout
  }

  /**
   * Execute lockout response
   */
  private async executeLockoutResponse(lockout: UserLockout): Promise<void> {
    try {
      const rule = this.lockoutRules.get(lockout.ruleId)
      if (!rule) return

      // Send user notification
      if (rule.response.notifyUser) {
        const notification = await this.sendUserNotification(lockout)
        lockout.notifications.push(notification)
      }

      // Send administrator notifications
      if (rule.response.notifyAdministrators) {
        const notifications = await this.sendAdminNotifications(lockout)
        lockout.notifications.push(...notifications)
      }

      // Handle escalation rules
      if (rule.response.escalationRules) {
        for (const escalation of rule.response.escalationRules) {
          setTimeout(() => {
            this.executeEscalation(lockout, escalation)
          }, escalation.delay)
        }
      }

      // Update lockout
      lockout.updatedAt = new Date()
      this.activeLockouts.set(lockout.userId, lockout)
      this.saveLockouts()

    } catch (error) {
      console.error('❌ Failed to execute lockout response:', error)
    }
  }

  /**
   * Send user notification
   */
  private async sendUserNotification(lockout: UserLockout): Promise<LockoutNotification> {
    const notification: LockoutNotification = {
      id: this.generateId(),
      type: 'user_notification',
      channel: 'email',
      recipient: lockout.userEmail,
      sentAt: new Date(),
      delivered: false,
      message: 'Account lockout notification'
    }

    try {
      const responses = await notificationService.sendCustomNotification(
        NotificationType.ACCOUNT_LOCKOUT,
        [{
          type: 'email',
          value: lockout.userEmail,
          channel: 'email'
        }],
        'account_lockout',
        {
          userEmail: lockout.userEmail,
          reason: lockout.reason,
          severity: lockout.severity,
          expiresAt: lockout.expiresAt?.toISOString() || 'Never',
          timestamp: lockout.lockedAt.toISOString()
        }
      )

      notification.delivered = responses.length > 0 && responses[0].delivered
      if (!notification.delivered && responses[0]) {
        notification.error = responses[0].error
      }

    } catch (error) {
      notification.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return notification
  }

  /**
   * Send administrator notifications
   */
  private async sendAdminNotifications(lockout: UserLockout): Promise<LockoutNotification[]> {
    const notifications: LockoutNotification[] = []

    try {
      // Send to administrators
      const adminRecipients = ['admin@carexps.com', 'security@carexps.com'] // Would get from config

      for (const recipient of adminRecipients) {
        const notification: LockoutNotification = {
          id: this.generateId(),
          type: 'admin_notification',
          channel: 'email',
          recipient,
          sentAt: new Date(),
          delivered: false,
          message: 'Account lockout admin notification'
        }

        try {
          const responses = await notificationService.sendCustomNotification(
            NotificationType.ACCOUNT_LOCKOUT,
            [{
              type: 'email',
              value: recipient,
              channel: 'email'
            }],
            'admin_lockout_notification',
            {
              userEmail: lockout.userEmail,
              reason: lockout.reason,
              severity: lockout.severity,
              lockoutId: lockout.id,
              timestamp: lockout.lockedAt.toISOString()
            }
          )

          notification.delivered = responses.length > 0 && responses[0].delivered
          if (!notification.delivered && responses[0]) {
            notification.error = responses[0].error
          }

        } catch (error) {
          notification.error = error instanceof Error ? error.message : 'Unknown error'
        }

        notifications.push(notification)
      }

    } catch (error) {
      console.error('❌ Failed to send admin notifications:', error)
    }

    return notifications
  }

  /**
   * Execute escalation
   */
  private async executeEscalation(lockout: UserLockout, escalation: LockoutEscalation): Promise<void> {
    try {
      // Check if lockout is still active
      const currentLockout = this.getActiveLockout(lockout.userId)
      if (!currentLockout || currentLockout.id !== lockout.id) {
        return // Lockout no longer active
      }

      switch (escalation.action) {
        case 'notify_security':
          await this.notifySecurityTeam(lockout, escalation)
          break
        case 'disable_account':
          await this.disableAccount(lockout)
          break
        case 'require_manager_approval':
          await this.requireManagerApproval(lockout)
          break
        case 'emergency_review':
          await this.triggerEmergencyReview(lockout)
          break
      }

      // Update lockout status
      currentLockout.status = 'escalated'
      currentLockout.updatedAt = new Date()
      this.activeLockouts.set(lockout.userId, currentLockout)
      this.saveLockouts()

    } catch (error) {
      console.error('❌ Failed to execute escalation:', error)
    }
  }

  /**
   * Notify security team
   */
  private async notifySecurityTeam(lockout: UserLockout, escalation: LockoutEscalation): Promise<void> {
    try {
      for (const recipient of escalation.recipients) {
        await notificationService.sendCustomNotification(
          NotificationType.SECURITY_INCIDENT,
          [{
            type: 'email',
            value: recipient,
            channel: 'email'
          }],
          'security_escalation',
          {
            userEmail: lockout.userEmail,
            lockoutId: lockout.id,
            reason: lockout.reason,
            severity: lockout.severity,
            escalationReason: 'Automated escalation due to prolonged lockout'
          }
        )
      }
    } catch (error) {
      console.error('❌ Failed to notify security team:', error)
    }
  }

  /**
   * Disable account
   */
  private async disableAccount(lockout: UserLockout): Promise<void> {
    try {
      lockout.severity = 'disable'
      lockout.lockoutType = 'permanent'
      lockout.expiresAt = undefined // No expiration for disabled accounts
      lockout.updatedAt = new Date()

      this.activeLockouts.set(lockout.userId, lockout)
      this.saveLockouts()

      console.log(`🚫 Account disabled for user ${lockout.userEmail}`)
    } catch (error) {
      console.error('❌ Failed to disable account:', error)
    }
  }

  /**
   * Require manager approval
   */
  private async requireManagerApproval(lockout: UserLockout): Promise<void> {
    try {
      lockout.unlockConditions = ['manager_approval']
      lockout.updatedAt = new Date()

      this.activeLockouts.set(lockout.userId, lockout)
      this.saveLockouts()

      console.log(`👔 Manager approval required for user ${lockout.userEmail}`)
    } catch (error) {
      console.error('❌ Failed to require manager approval:', error)
    }
  }

  /**
   * Trigger emergency review
   */
  private async triggerEmergencyReview(lockout: UserLockout): Promise<void> {
    try {
      // Create critical incident
      await incidentResponseService.createIncident({
        type: IncidentType.ACCOUNT_COMPROMISE_SUSPECTED,
        severity: IncidentSeverity.CRITICAL,
        title: 'Emergency Account Review Required',
        description: `Account ${lockout.userEmail} requires emergency review due to escalated lockout`,
        userId: lockout.userId,
        userEmail: lockout.userEmail,
        evidence: [{
          type: 'system_event',
          data: {
            lockoutId: lockout.id,
            lockoutReason: lockout.reason,
            lockoutDuration: Date.now() - lockout.lockedAt.getTime(),
            escalationTrigger: 'emergency_review'
          },
          source: 'automated_lockout_service',
          description: 'Emergency review triggered by lockout escalation'
        }],
        metadata: {
          lockoutId: lockout.id,
          emergencyReview: true,
          requiresImmediateAction: true
        }
      })

      console.log(`🚨 Emergency review triggered for user ${lockout.userEmail}`)
    } catch (error) {
      console.error('❌ Failed to trigger emergency review:', error)
    }
  }

  /**
   * Record lockout attempt
   */
  private async recordLockoutAttempt(
    lockout: UserLockout,
    attemptType: 'login' | 'password_reset' | 'mfa_verify' | 'api_access',
    success: boolean,
    blockReason?: string
  ): Promise<void> {
    const attempt: LockoutAttempt = {
      id: this.generateId(),
      timestamp: new Date(),
      attemptType,
      sourceIP: '127.0.0.1', // Would get real IP
      userAgent: navigator.userAgent,
      success,
      blockReason,
      metadata: {
        lockoutId: lockout.id,
        lockoutStatus: lockout.status
      }
    }

    lockout.attempts.push(attempt)
    lockout.updatedAt = new Date()

    this.activeLockouts.set(lockout.userId, lockout)
    this.saveLockouts()

    // Log the attempt
    await auditLogger.logPHIAccess(
      AuditAction.LOGIN_FAILURE,
      ResourceType.USER,
      `lockout-attempt-${attempt.id}`,
      success ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
      {
        operation: 'lockout_access_attempt',
        userId: lockout.userId,
        userEmail: lockout.userEmail,
        attemptType,
        success,
        blockReason,
        lockoutId: lockout.id
      }
    )
  }

  /**
   * Check unlock conditions
   */
  private async checkUnlockConditions(lockout: UserLockout): Promise<boolean> {
    if (!lockout.unlockConditions || lockout.unlockConditions.length === 0) {
      return true
    }

    for (const condition of lockout.unlockConditions) {
      switch (condition) {
        case 'manager_approval':
          // Check if manager has approved
          const managerApproval = lockout.adminActions.find(a =>
            a.action === 'approve' && a.adminUserId !== lockout.userId
          )
          if (!managerApproval) return false
          break

        case 'security_review':
          // Check if security team has reviewed
          const securityReview = lockout.adminActions.find(a =>
            a.action === 'review' && a.adminUserEmail.includes('security')
          )
          if (!securityReview) return false
          break

        case 'time_elapsed':
          // Check if enough time has passed
          const minimumDuration = 24 * 60 * 60 * 1000 // 24 hours
          if (Date.now() - lockout.lockedAt.getTime() < minimumDuration) return false
          break
      }
    }

    return true
  }

  /**
   * Setup incident monitoring
   */
  private setupIncidentMonitoring(): void {
    // Listen for new incidents
    incidentResponseService.addEventListener('incident_created', (event) => {
      if (event.incident) {
        this.evaluateIncidentForLockout(event.incident)
      }
    })

    console.log('📊 Incident monitoring set up for automated lockouts')
  }

  /**
   * Setup periodic tasks
   */
  private setupPeriodicTasks(): void {
    // Check for expired lockouts every 5 minutes
    setInterval(() => {
      this.cleanupExpiredLockouts()
    }, 5 * 60 * 1000)

    // Check user risk scores every hour
    setInterval(() => {
      this.checkUserRiskScores()
    }, 60 * 60 * 1000)

    console.log('⏰ Periodic tasks set up for automated lockouts')
  }

  /**
   * Clean up expired lockouts
   */
  private async cleanupExpiredLockouts(): Promise<void> {
    try {
      const now = new Date()
      const expiredLockouts: string[] = []

      for (const [userId, lockout] of this.activeLockouts) {
        if (lockout.expiresAt && now > lockout.expiresAt) {
          lockout.status = 'expired'
          expiredLockouts.push(userId)

          // Log expiration
          await auditLogger.logPHIAccess(
            AuditAction.UPDATE,
            ResourceType.USER,
            `lockout-expired-${lockout.id}`,
            AuditOutcome.SUCCESS,
            {
              operation: 'lockout_expired',
              userId,
              userEmail: lockout.userEmail,
              lockoutId: lockout.id,
              lockoutDuration: now.getTime() - lockout.lockedAt.getTime()
            }
          )
        }
      }

      // Remove expired lockouts
      for (const userId of expiredLockouts) {
        this.activeLockouts.delete(userId)
      }

      if (expiredLockouts.length > 0) {
        this.saveLockouts()
        console.log(`🧹 Cleaned up ${expiredLockouts.length} expired lockouts`)
      }

    } catch (error) {
      console.error('❌ Failed to cleanup expired lockouts:', error)
    }
  }

  /**
   * Check user risk scores
   */
  private async checkUserRiskScores(): Promise<void> {
    try {
      const userProfiles = incidentResponseService.getAllUserSecurityProfiles()

      for (const profile of userProfiles) {
        if (profile.riskScore >= 90 && !this.getActiveLockout(profile.userId)) {
          await this.evaluateUserRiskForLockout(profile.userId)
        }
      }

    } catch (error) {
      console.error('❌ Failed to check user risk scores:', error)
    }
  }

  /**
   * Setup default lockout rules
   */
  private setupDefaultRules(): void {
    const rules: LockoutRule[] = [
      {
        id: 'critical_incident_lockout',
        name: 'Critical Incident Lockout',
        description: 'Lock account after critical security incident',
        triggers: [{
          type: 'incident_type',
          value: [IncidentType.ACCOUNT_COMPROMISE_SUSPECTED, IncidentType.SESSION_HIJACKING_ATTEMPT],
          operator: 'contains'
        }],
        conditions: {},
        response: {
          lockoutType: 'temporary',
          duration: 24 * 60 * 60 * 1000, // 24 hours
          severity: 'lockout',
          notifyUser: true,
          notifyAdministrators: true,
          requireManualUnlock: false,
          escalationRules: [{
            delay: 4 * 60 * 60 * 1000, // 4 hours
            action: 'notify_security',
            recipients: ['security@carexps.com']
          }]
        },
        isActive: true,
        priority: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'high_risk_score_lockout',
        name: 'High Risk Score Lockout',
        description: 'Lock account when user risk score exceeds threshold',
        triggers: [{
          type: 'risk_score',
          value: 90,
          operator: 'greater_than'
        }],
        conditions: {
          minimumIncidents: 2
        },
        response: {
          lockoutType: 'conditional',
          severity: 'suspend',
          notifyUser: true,
          notifyAdministrators: true,
          requireManualUnlock: true,
          escalationRules: [{
            delay: 2 * 60 * 60 * 1000, // 2 hours
            action: 'require_manager_approval',
            recipients: []
          }]
        },
        isActive: true,
        priority: 80,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'multiple_incidents_lockout',
        name: 'Multiple Incidents Lockout',
        description: 'Lock account after multiple security incidents',
        triggers: [{
          type: 'incident_count',
          value: 3,
          operator: 'greater_than',
          timeWindow: 24 * 60 * 60 * 1000 // 24 hours
        }],
        conditions: {},
        response: {
          lockoutType: 'temporary',
          duration: 12 * 60 * 60 * 1000, // 12 hours
          severity: 'lockout',
          notifyUser: true,
          notifyAdministrators: true,
          requireManualUnlock: false
        },
        isActive: true,
        priority: 60,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    for (const rule of rules) {
      this.lockoutRules.set(rule.id, rule)
    }
  }

  /**
   * Utility methods
   */
  private getActiveLockout(userId: string): UserLockout | null {
    return this.activeLockouts.get(userId) || null
  }

  private getAllLockouts(): UserLockout[] {
    const stored = this.getStoredData(AutomatedLockoutService.STORAGE_KEYS.LOCKOUTS, [])
    return [...Array.from(this.activeLockouts.values()), ...stored]
  }

  private async getIncidentCountForUser(userId: string, timeWindow?: number): Promise<number> {
    try {
      const criteria = {
        userId,
        startDate: timeWindow ? new Date(Date.now() - timeWindow) : undefined
      }
      const response = await incidentResponseService.searchIncidents(criteria)
      return response.totalCount
    } catch (error) {
      return 0
    }
  }

  private async getUserRiskScore(userId: string): Promise<number> {
    const profile = incidentResponseService.getUserSecurityProfile(userId)
    return profile?.riskScore || 0
  }

  private isBusinessHours(): boolean {
    const hour = new Date().getHours()
    const day = new Date().getDay()
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17
  }

  private generateId(): string {
    return `lockout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getStoredData(key: string, defaultValue: any): any {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : defaultValue
    } catch (error) {
      return defaultValue
    }
  }

  private storeData(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error(`❌ Failed to store data for key ${key}:`, error)
    }
  }

  private loadConfiguration(): void {
    try {
      const rules = this.getStoredData(AutomatedLockoutService.STORAGE_KEYS.RULES, {})
      for (const [id, rule] of Object.entries(rules)) {
        this.lockoutRules.set(id, rule as LockoutRule)
      }

      const lockouts = this.getStoredData(AutomatedLockoutService.STORAGE_KEYS.LOCKOUTS, {})
      for (const [userId, lockout] of Object.entries(lockouts)) {
        this.activeLockouts.set(userId, lockout as UserLockout)
      }
    } catch (error) {
      console.error('❌ Failed to load lockout configuration:', error)
    }
  }

  private saveLockouts(): void {
    const lockouts = Object.fromEntries(this.activeLockouts)
    this.storeData(AutomatedLockoutService.STORAGE_KEYS.LOCKOUTS, lockouts)
  }

  /**
   * Public API methods
   */
  getLockoutRules(): LockoutRule[] {
    return Array.from(this.lockoutRules.values())
  }

  getActiveLockouts(): UserLockout[] {
    return Array.from(this.activeLockouts.values())
  }

  addLockoutRule(rule: Omit<LockoutRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const newRule: LockoutRule = {
      ...rule,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.lockoutRules.set(newRule.id, newRule)
    this.storeData(AutomatedLockoutService.STORAGE_KEYS.RULES, Object.fromEntries(this.lockoutRules))

    return newRule.id
  }

  updateLockoutRule(id: string, updates: Partial<LockoutRule>): boolean {
    const rule = this.lockoutRules.get(id)
    if (!rule) return false

    const updatedRule = { ...rule, ...updates, updatedAt: new Date() }
    this.lockoutRules.set(id, updatedRule)
    this.storeData(AutomatedLockoutService.STORAGE_KEYS.RULES, Object.fromEntries(this.lockoutRules))

    return true
  }

  deleteLockoutRule(id: string): boolean {
    const deleted = this.lockoutRules.delete(id)
    if (deleted) {
      this.storeData(AutomatedLockoutService.STORAGE_KEYS.RULES, Object.fromEntries(this.lockoutRules))
    }
    return deleted
  }
}

// Export singleton instance
export const automatedLockoutService = AutomatedLockoutService.getInstance()

// Export class for testing
export { AutomatedLockoutService }