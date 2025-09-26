/**
 * SECURITY INTEGRATION SERVICE
 *
 * Integrates the incident response system with existing security services
 * without modifying protected systems. Uses observer pattern and event
 * monitoring to seamlessly connect with audit logging and MFA systems.
 *
 * Features:
 * - Non-invasive integration with existing systems
 * - Event monitoring and pattern detection
 * - Automated response coordination
 * - Security metric aggregation
 * - HIPAA-compliant integration logging
 * - Emergency response coordination
 */

import { incidentResponseService } from './incidentResponseService'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'
import { mfaLockoutService } from './mfaLockoutService'
import {
  SecurityIncident,
  IncidentType,
  IncidentSeverity,
  UserSecurityProfile
} from '@/types/incidentTypes'

export interface SecurityEventPattern {
  id: string
  name: string
  description: string
  eventTypes: string[]
  conditions: {
    frequency: number
    timeWindow: number // milliseconds
    userBased: boolean
    ipBased: boolean
    sessionBased: boolean
  }
  response: {
    incidentType: IncidentType
    severity: IncidentSeverity
    autoResponse: boolean
  }
  isActive: boolean
}

export interface SecurityMetrics {
  // Audit log metrics
  auditEvents: {
    total: number
    phiAccess: number
    failures: number
    suspiciousActivity: number
  }

  // MFA metrics
  mfaEvents: {
    totalAttempts: number
    failures: number
    lockouts: number
    successRate: number
  }

  // Incident metrics
  incidents: {
    total: number
    automated: number
    manual: number
    resolved: number
  }

  // User metrics
  users: {
    total: number
    locked: number
    highRisk: number
    monitored: number
  }

  // Time-based metrics
  timeRange: {
    start: Date
    end: Date
  }
}

export class SecurityIntegrationService {
  private static instance: SecurityIntegrationService
  private isInitialized = false
  private eventPatterns: Map<string, SecurityEventPattern> = new Map()
  private eventQueue: Array<{ event: any; timestamp: Date }> = []
  private patternMatchingInterval: NodeJS.Timeout | null = null

  // Storage keys
  private static readonly STORAGE_KEYS = {
    PATTERNS: 'security_event_patterns',
    METRICS: 'security_integration_metrics',
    EVENTS: 'security_event_queue'
  }

  constructor() {
    this.setupDefaultPatterns()
  }

  /**
   * Singleton instance
   */
  static getInstance(): SecurityIntegrationService {
    if (!SecurityIntegrationService.instance) {
      SecurityIntegrationService.instance = new SecurityIntegrationService()
    }
    return SecurityIntegrationService.instance
  }

  /**
   * Initialize security integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Set up audit log monitoring
      await this.setupAuditLogMonitoring()

      // Set up MFA monitoring
      await this.setupMfaMonitoring()

      // Set up emergency logout monitoring
      await this.setupEmergencyLogoutMonitoring()

      // Set up pattern matching
      this.setupPatternMatching()

      // Set up periodic security scans
      this.setupSecurityScans()

      // Log integration initialization
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACCESS,
        ResourceType.SYSTEM,
        'security-integration-service',
        AuditOutcome.SUCCESS,
        {
          operation: 'security_integration_initialization',
          patternsCount: this.eventPatterns.size,
          timestamp: new Date().toISOString(),
          integrationLevel: 'full'
        }
      )

      this.isInitialized = true
      console.log('✅ Security Integration Service initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize Security Integration Service:', error)
      throw error
    }
  }

  /**
   * Set up audit log monitoring (non-invasive)
   */
  private async setupAuditLogMonitoring(): Promise<void> {
    try {
      // Monitor localStorage changes to detect new audit entries
      const originalSetItem = localStorage.setItem.bind(localStorage)
      localStorage.setItem = (key: string, value: string) => {
        originalSetItem(key, value)

        // Monitor audit logs without modifying the audit logger
        if (key === 'auditLogs') {
          this.handleAuditLogChange(value)
        }
      }

      // Monitor session storage for emergency events
      const originalSessionSetItem = sessionStorage.setItem.bind(sessionStorage)
      sessionStorage.setItem = (key: string, value: string) => {
        originalSessionSetItem(key, value)

        if (key.includes('emergency') || key.includes('security')) {
          this.handleSecurityEvent('session_security_event', { key, timestamp: new Date() })
        }
      }

      console.log('🔍 Audit log monitoring set up (non-invasive)')

    } catch (error) {
      console.error('❌ Failed to set up audit log monitoring:', error)
    }
  }

  /**
   * Handle audit log changes
   */
  private async handleAuditLogChange(auditLogsJson: string): Promise<void> {
    try {
      const auditLogs = JSON.parse(auditLogsJson)
      if (!Array.isArray(auditLogs) || auditLogs.length === 0) return

      // Get the most recent entries (last 5)
      const recentEntries = auditLogs.slice(-5)

      for (const entry of recentEntries) {
        await this.analyzeAuditEntry(entry)
      }

    } catch (error) {
      console.error('❌ Failed to handle audit log change:', error)
    }
  }

  /**
   * Analyze individual audit entry for security patterns
   */
  private async analyzeAuditEntry(entry: any): Promise<void> {
    try {
      // Add to event queue for pattern matching
      this.eventQueue.push({
        event: {
          type: 'audit_log',
          action: entry.action,
          userId: entry.user_id,
          phiAccessed: entry.phi_accessed,
          outcome: entry.outcome,
          sourceIP: entry.source_ip,
          timestamp: entry.timestamp,
          data: entry
        },
        timestamp: new Date()
      })

      // Immediate analysis for critical events
      await this.performImmediateAnalysis(entry)

    } catch (error) {
      console.error('❌ Failed to analyze audit entry:', error)
    }
  }

  /**
   * Perform immediate analysis for critical security events
   */
  private async performImmediateAnalysis(entry: any): Promise<void> {
    try {
      // Check for multiple login failures
      if (entry.action === 'LOGIN_FAILURE' && entry.user_id) {
        await this.checkLoginFailurePattern(entry.user_id, entry.user_name || 'Unknown')
      }

      // Check for excessive PHI access
      if (entry.phi_accessed && entry.action === 'VIEW' && entry.user_id) {
        await this.checkPHIAccessPattern(entry.user_id, entry.user_name || 'Unknown')
      }

      // Check for unusual IP addresses
      if (entry.source_ip && entry.user_id && !this.isKnownIP(entry.source_ip)) {
        await this.checkSuspiciousIPPattern(entry.user_id, entry.user_name || 'Unknown', entry.source_ip)
      }

      // Check for off-hours access
      if (entry.phi_accessed && this.isOffHours()) {
        await this.checkOffHoursAccess(entry.user_id, entry.user_name || 'Unknown')
      }

    } catch (error) {
      console.error('❌ Failed to perform immediate analysis:', error)
    }
  }

  /**
   * Check login failure patterns
   */
  private async checkLoginFailurePattern(userId: string, userEmail: string): Promise<void> {
    try {
      // Get recent login failures from event queue
      const recentFailures = this.eventQueue
        .filter(e =>
          e.event.type === 'audit_log' &&
          e.event.action === 'LOGIN_FAILURE' &&
          e.event.userId === userId &&
          Date.now() - e.timestamp.getTime() < 15 * 60 * 1000 // Last 15 minutes
        )
        .length

      if (recentFailures >= 3) {
        await incidentResponseService.handleSuspiciousLogin(
          userId,
          userEmail,
          [`${recentFailures} login failures in 15 minutes`, 'Potential brute force attack']
        )
      }

    } catch (error) {
      console.error('❌ Failed to check login failure pattern:', error)
    }
  }

  /**
   * Check PHI access patterns
   */
  private async checkPHIAccessPattern(userId: string, userEmail: string): Promise<void> {
    try {
      // Get recent PHI access from event queue
      const recentPHIAccess = this.eventQueue
        .filter(e =>
          e.event.type === 'audit_log' &&
          e.event.phiAccessed &&
          e.event.userId === userId &&
          Date.now() - e.timestamp.getTime() < 60 * 60 * 1000 // Last hour
        )
        .length

      if (recentPHIAccess >= 20) {
        await incidentResponseService.handleExcessivePHIAccess(
          userId,
          userEmail,
          recentPHIAccess,
          60 * 60 * 1000 // 1 hour window
        )
      }

    } catch (error) {
      console.error('❌ Failed to check PHI access pattern:', error)
    }
  }

  /**
   * Check suspicious IP patterns
   */
  private async checkSuspiciousIPPattern(userId: string, userEmail: string, sourceIP: string): Promise<void> {
    try {
      // Check if this is a new IP for the user
      const userRecentIPs = this.eventQueue
        .filter(e =>
          e.event.type === 'audit_log' &&
          e.event.userId === userId &&
          Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
        )
        .map(e => e.event.sourceIP)
        .filter((ip, index, arr) => arr.indexOf(ip) === index) // Unique IPs

      if (userRecentIPs.length > 3) {
        await incidentResponseService.handleSuspiciousLogin(
          userId,
          userEmail,
          [`Access from ${userRecentIPs.length} different IP addresses`, `New IP: ${sourceIP}`, 'Potential account compromise']
        )
      }

    } catch (error) {
      console.error('❌ Failed to check suspicious IP pattern:', error)
    }
  }

  /**
   * Check off-hours access
   */
  private async checkOffHoursAccess(userId: string, userEmail: string): Promise<void> {
    try {
      const currentHour = new Date().getHours()
      const isWeekend = [0, 6].includes(new Date().getDay())

      await incidentResponseService.createIncident({
        type: IncidentType.OFF_HOURS_DATA_ACCESS,
        severity: isWeekend ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM,
        title: 'Off-Hours PHI Data Access',
        description: `PHI data accessed outside business hours by ${userEmail} at ${currentHour}:00`,
        userId,
        userEmail,
        evidence: [{
          type: 'audit_log',
          data: {
            accessTime: new Date().toISOString(),
            hour: currentHour,
            isWeekend,
            businessHours: '9:00-17:00'
          },
          source: 'security_integration_service',
          description: 'Off-hours PHI access detected'
        }],
        metadata: {
          accessHour: currentHour,
          isWeekend,
          requiresJustification: true
        }
      })

    } catch (error) {
      console.error('❌ Failed to check off-hours access:', error)
    }
  }

  /**
   * Set up MFA monitoring (non-invasive)
   */
  private async setupMfaMonitoring(): Promise<void> {
    try {
      // Monitor MFA lockout data changes
      const originalMfaSetItem = localStorage.setItem.bind(localStorage)
      localStorage.setItem = (key: string, value: string) => {
        originalMfaSetItem(key, value)

        if (key === 'mfa_lockout_data') {
          this.handleMfaLockoutChange(value)
        }
      }

      console.log('🔐 MFA monitoring set up (non-invasive)')

    } catch (error) {
      console.error('❌ Failed to set up MFA monitoring:', error)
    }
  }

  /**
   * Handle MFA lockout changes
   */
  private async handleMfaLockoutChange(lockoutDataJson: string): Promise<void> {
    try {
      const lockoutData = JSON.parse(lockoutDataJson)

      for (const [userId, record] of Object.entries(lockoutData)) {
        const typedRecord = record as any

        // Check for new lockouts
        if (typedRecord.lockedUntil && new Date(typedRecord.lockedUntil) > new Date()) {
          // Add to event queue
          this.eventQueue.push({
            event: {
              type: 'mfa_lockout',
              userId,
              userEmail: typedRecord.userEmail,
              attempts: typedRecord.attempts,
              lockedUntil: typedRecord.lockedUntil,
              timestamp: new Date().toISOString()
            },
            timestamp: new Date()
          })

          // Trigger incident response
          await incidentResponseService.handleMfaFailure(userId, typedRecord.userEmail)
        }
      }

    } catch (error) {
      console.error('❌ Failed to handle MFA lockout change:', error)
    }
  }

  /**
   * Set up emergency logout monitoring
   */
  private async setupEmergencyLogoutMonitoring(): Promise<void> {
    try {
      // Monitor for emergency logout keyboard events
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'L') {
          this.handleEmergencyLogoutTrigger()
        }
      })

      // Monitor for emergency logout storage events
      window.addEventListener('storage', (event) => {
        if (event.key === 'emergency_logout_triggered') {
          this.handleEmergencyLogoutTrigger()
        }
      })

      console.log('🚨 Emergency logout monitoring set up')

    } catch (error) {
      console.error('❌ Failed to set up emergency logout monitoring:', error)
    }
  }

  /**
   * Handle emergency logout trigger
   */
  private async handleEmergencyLogoutTrigger(): Promise<void> {
    try {
      // Get current user info
      const currentUser = this.getCurrentUser()

      // Add to event queue
      this.eventQueue.push({
        event: {
          type: 'emergency_logout',
          userId: currentUser?.id,
          userEmail: currentUser?.email,
          timestamp: new Date().toISOString(),
          trigger: 'keyboard_shortcut'
        },
        timestamp: new Date()
      })

      // Trigger incident response
      await incidentResponseService.handleEmergencyLogout(
        currentUser?.id,
        currentUser?.email
      )

      console.log('🚨 Emergency logout detected and processed')

    } catch (error) {
      console.error('❌ Failed to handle emergency logout trigger:', error)
    }
  }

  /**
   * Set up pattern matching engine
   */
  private setupPatternMatching(): void {
    try {
      // Run pattern matching every 5 minutes
      this.patternMatchingInterval = setInterval(() => {
        this.performPatternMatching()
      }, 5 * 60 * 1000)

      console.log('🔍 Pattern matching engine started')

    } catch (error) {
      console.error('❌ Failed to set up pattern matching:', error)
    }
  }

  /**
   * Perform pattern matching on event queue
   */
  private async performPatternMatching(): Promise<void> {
    try {
      // Clean up old events (older than 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      this.eventQueue = this.eventQueue.filter(e => e.timestamp.getTime() > oneDayAgo)

      // Check each pattern
      for (const pattern of this.eventPatterns.values()) {
        if (!pattern.isActive) continue

        await this.checkPattern(pattern)
      }

    } catch (error) {
      console.error('❌ Failed to perform pattern matching:', error)
    }
  }

  /**
   * Check specific pattern against event queue
   */
  private async checkPattern(pattern: SecurityEventPattern): Promise<void> {
    try {
      const timeWindow = pattern.conditions.timeWindow
      const now = Date.now()

      // Filter events for this pattern
      const relevantEvents = this.eventQueue.filter(e =>
        pattern.eventTypes.includes(e.event.type) &&
        now - e.timestamp.getTime() <= timeWindow
      )

      if (relevantEvents.length < pattern.conditions.frequency) {
        return // Pattern not matched
      }

      // Group by user/IP/session based on pattern conditions
      const groups = this.groupEvents(relevantEvents, pattern.conditions)

      for (const [groupKey, events] of groups.entries()) {
        if (events.length >= pattern.conditions.frequency) {
          await this.triggerPatternResponse(pattern, groupKey, events)
        }
      }

    } catch (error) {
      console.error(`❌ Failed to check pattern ${pattern.id}:`, error)
    }
  }

  /**
   * Group events based on pattern conditions
   */
  private groupEvents(
    events: Array<{ event: any; timestamp: Date }>,
    conditions: SecurityEventPattern['conditions']
  ): Map<string, Array<{ event: any; timestamp: Date }>> {
    const groups = new Map<string, Array<{ event: any; timestamp: Date }>>()

    for (const eventItem of events) {
      let groupKey = 'global'

      if (conditions.userBased && eventItem.event.userId) {
        groupKey = `user:${eventItem.event.userId}`
      } else if (conditions.ipBased && eventItem.event.sourceIP) {
        groupKey = `ip:${eventItem.event.sourceIP}`
      } else if (conditions.sessionBased && eventItem.event.sessionId) {
        groupKey = `session:${eventItem.event.sessionId}`
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(eventItem)
    }

    return groups
  }

  /**
   * Trigger pattern response
   */
  private async triggerPatternResponse(
    pattern: SecurityEventPattern,
    groupKey: string,
    events: Array<{ event: any; timestamp: Date }>
  ): Promise<void> {
    try {
      if (!pattern.response.autoResponse) {
        console.log(`⚠️ Pattern ${pattern.name} matched but auto-response disabled`)
        return
      }

      // Extract user info from events
      const userEvent = events.find(e => e.event.userId)
      const userId = userEvent?.event.userId
      const userEmail = userEvent?.event.userEmail || 'Unknown'

      // Create incident
      await incidentResponseService.createIncident({
        type: pattern.response.incidentType,
        severity: pattern.response.severity,
        title: `Security Pattern Detected: ${pattern.name}`,
        description: `Security pattern "${pattern.name}" detected with ${events.length} events in ${Math.round(pattern.conditions.timeWindow / 60000)} minutes`,
        userId,
        userEmail,
        evidence: [{
          type: 'system_event',
          data: {
            patternId: pattern.id,
            patternName: pattern.name,
            eventCount: events.length,
            timeWindow: pattern.conditions.timeWindow,
            groupKey,
            events: events.map(e => ({
              type: e.event.type,
              timestamp: e.timestamp.toISOString(),
              summary: this.summarizeEvent(e.event)
            }))
          },
          source: 'security_integration_pattern_matching',
          description: `Pattern matching detected: ${pattern.name}`
        }],
        metadata: {
          patternId: pattern.id,
          patternName: pattern.name,
          eventCount: events.length,
          automated: true,
          patternMatching: true
        }
      })

      console.log(`🚨 Pattern "${pattern.name}" triggered incident for ${groupKey}`)

    } catch (error) {
      console.error(`❌ Failed to trigger pattern response for ${pattern.id}:`, error)
    }
  }

  /**
   * Set up periodic security scans
   */
  private setupSecurityScans(): void {
    try {
      // Run security scans every hour
      setInterval(() => {
        this.performSecurityScan()
      }, 60 * 60 * 1000)

      console.log('🔒 Periodic security scans enabled')

    } catch (error) {
      console.error('❌ Failed to set up security scans:', error)
    }
  }

  /**
   * Perform periodic security scan
   */
  private async performSecurityScan(): Promise<void> {
    try {
      // Check for locked accounts that might need attention
      await this.checkLockedAccounts()

      // Check for users with high risk scores
      await this.checkHighRiskUsers()

      // Check for unusual system activity
      await this.checkSystemActivity()

      // Clean up old events and data
      this.performMaintenance()

    } catch (error) {
      console.error('❌ Failed to perform security scan:', error)
    }
  }

  /**
   * Check locked accounts
   */
  private async checkLockedAccounts(): Promise<void> {
    try {
      const lockoutData = JSON.parse(localStorage.getItem('mfa_lockout_data') || '{}')
      const now = Date.now()

      for (const [userId, record] of Object.entries(lockoutData)) {
        const typedRecord = record as any

        if (typedRecord.lockedUntil && new Date(typedRecord.lockedUntil).getTime() > now) {
          // Account is still locked - check if it needs escalation
          const lockDuration = now - new Date(typedRecord.lastAttempt).getTime()
          const fourHours = 4 * 60 * 60 * 1000

          if (lockDuration > fourHours) {
            await incidentResponseService.createIncident({
              type: IncidentType.ACCOUNT_COMPROMISE_SUSPECTED,
              severity: IncidentSeverity.HIGH,
              title: 'Extended Account Lockout',
              description: `Account ${typedRecord.userEmail} has been locked for over 4 hours due to repeated MFA failures`,
              userId,
              userEmail: typedRecord.userEmail,
              evidence: [{
                type: 'system_event',
                data: {
                  lockDuration: Math.round(lockDuration / 60000),
                  attempts: typedRecord.attempts,
                  lastAttempt: typedRecord.lastAttempt
                },
                source: 'security_integration_scan',
                description: 'Extended account lockout detected during security scan'
              }],
              metadata: {
                extendedLockout: true,
                lockDurationMinutes: Math.round(lockDuration / 60000),
                requiresManualReview: true
              }
            })
          }
        }
      }

    } catch (error) {
      console.error('❌ Failed to check locked accounts:', error)
    }
  }

  /**
   * Check high risk users
   */
  private async checkHighRiskUsers(): Promise<void> {
    try {
      const userProfiles = incidentResponseService.getAllUserSecurityProfiles()

      for (const profile of userProfiles) {
        if (profile.riskLevel === 'CRITICAL' || profile.riskScore >= 80) {
          // Check if we've already alerted about this user recently
          const recentAlerts = this.eventQueue.filter(e =>
            e.event.type === 'high_risk_user_alert' &&
            e.event.userId === profile.userId &&
            Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
          )

          if (recentAlerts.length === 0) {
            await incidentResponseService.createIncident({
              type: IncidentType.ANOMALOUS_BEHAVIOR,
              severity: IncidentSeverity.HIGH,
              title: 'High Risk User Detected',
              description: `User ${profile.userEmail} has a high risk score (${profile.riskScore}/100) and requires review`,
              userId: profile.userId,
              userEmail: profile.userEmail,
              evidence: [{
                type: 'user_action',
                data: {
                  riskScore: profile.riskScore,
                  riskLevel: profile.riskLevel,
                  totalIncidents: profile.totalIncidents,
                  accountLocked: profile.accountLocked,
                  enhancedMonitoring: profile.enhancedMonitoring
                },
                source: 'security_integration_scan',
                description: 'High risk user identified during security scan'
              }],
              metadata: {
                riskScore: profile.riskScore,
                riskLevel: profile.riskLevel,
                securityScan: true,
                requiresReview: true
              }
            })

            // Add to event queue to prevent duplicate alerts
            this.eventQueue.push({
              event: {
                type: 'high_risk_user_alert',
                userId: profile.userId,
                riskScore: profile.riskScore,
                timestamp: new Date().toISOString()
              },
              timestamp: new Date()
            })
          }
        }
      }

    } catch (error) {
      console.error('❌ Failed to check high risk users:', error)
    }
  }

  /**
   * Check system activity
   */
  private async checkSystemActivity(): Promise<void> {
    try {
      // Check for unusual system patterns
      const recentEvents = this.eventQueue.filter(e =>
        Date.now() - e.timestamp.getTime() < 60 * 60 * 1000 // Last hour
      )

      // Check for burst activity
      if (recentEvents.length > 100) {
        await incidentResponseService.createIncident({
          type: IncidentType.RATE_LIMIT_EXCEEDED,
          severity: IncidentSeverity.MEDIUM,
          title: 'High System Activity Detected',
          description: `Detected ${recentEvents.length} security events in the last hour, indicating high system activity`,
          evidence: [{
            type: 'system_event',
            data: {
              eventCount: recentEvents.length,
              timeWindow: '1 hour',
              eventTypes: this.getEventTypeCounts(recentEvents)
            },
            source: 'security_integration_scan',
            description: 'High system activity detected during security scan'
          }],
          metadata: {
            eventCount: recentEvents.length,
            systemActivity: true,
            securityScan: true
          }
        })
      }

    } catch (error) {
      console.error('❌ Failed to check system activity:', error)
    }
  }

  /**
   * Get event type counts
   */
  private getEventTypeCounts(events: Array<{ event: any; timestamp: Date }>): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const event of events) {
      const type = event.event.type || 'unknown'
      counts[type] = (counts[type] || 0) + 1
    }

    return counts
  }

  /**
   * Perform maintenance tasks
   */
  private performMaintenance(): void {
    try {
      // Clean up old events (keep last 1000 or 24 hours, whichever is larger)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      const oldEventCount = this.eventQueue.length

      this.eventQueue = this.eventQueue
        .filter(e => e.timestamp.getTime() > oneDayAgo)
        .slice(-1000) // Keep maximum 1000 events

      if (oldEventCount > this.eventQueue.length) {
        console.log(`🧹 Cleaned up ${oldEventCount - this.eventQueue.length} old security events`)
      }

      // Clean up expired lockouts using existing service
      mfaLockoutService.cleanupExpiredLockouts()

    } catch (error) {
      console.error('❌ Failed to perform maintenance:', error)
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(timeRange?: { start: Date; end: Date }): Promise<SecurityMetrics> {
    try {
      const start = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000)
      const end = timeRange?.end || new Date()

      // Filter events by time range
      const relevantEvents = this.eventQueue.filter(e =>
        e.timestamp >= start && e.timestamp <= end
      )

      // Calculate audit metrics
      const auditEvents = relevantEvents.filter(e => e.event.type === 'audit_log')
      const auditMetrics = {
        total: auditEvents.length,
        phiAccess: auditEvents.filter(e => e.event.phiAccessed).length,
        failures: auditEvents.filter(e => e.event.outcome === 'FAILURE').length,
        suspiciousActivity: relevantEvents.filter(e =>
          e.event.type === 'suspicious_activity' ||
          e.event.type === 'suspicious_login'
        ).length
      }

      // Calculate MFA metrics
      const mfaEvents = relevantEvents.filter(e => e.event.type === 'mfa_lockout')
      const mfaMetrics = {
        totalAttempts: mfaEvents.reduce((sum, e) => sum + (e.event.attempts || 0), 0),
        failures: mfaEvents.length,
        lockouts: mfaEvents.filter(e => e.event.lockedUntil).length,
        successRate: 0 // Would need more detailed MFA data
      }

      // Get incident metrics
      const incidentMetrics = await incidentResponseService.getMetrics()

      // Get user metrics
      const userProfiles = incidentResponseService.getAllUserSecurityProfiles()
      const userMetrics = {
        total: userProfiles.length,
        locked: userProfiles.filter(p => p.accountLocked).length,
        highRisk: userProfiles.filter(p => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL').length,
        monitored: userProfiles.filter(p => p.enhancedMonitoring).length
      }

      return {
        auditEvents: auditMetrics,
        mfaEvents: mfaMetrics,
        incidents: {
          total: incidentMetrics.totalIncidents,
          automated: 0, // Would need to calculate from incident data
          manual: 0,
          resolved: incidentMetrics.resolvedIncidents
        },
        users: userMetrics,
        timeRange: { start, end }
      }

    } catch (error) {
      console.error('❌ Failed to get security metrics:', error)
      throw error
    }
  }

  /**
   * Handle security event
   */
  private async handleSecurityEvent(type: string, data: any): Promise<void> {
    try {
      this.eventQueue.push({
        event: {
          type,
          ...data,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date()
      })

    } catch (error) {
      console.error('❌ Failed to handle security event:', error)
    }
  }

  /**
   * Setup default patterns
   */
  private setupDefaultPatterns(): void {
    const patterns: SecurityEventPattern[] = [
      {
        id: 'rapid_login_failures',
        name: 'Rapid Login Failures',
        description: 'Multiple login failures in short time period',
        eventTypes: ['audit_log'],
        conditions: {
          frequency: 5,
          timeWindow: 5 * 60 * 1000, // 5 minutes
          userBased: true,
          ipBased: false,
          sessionBased: false
        },
        response: {
          incidentType: IncidentType.MULTIPLE_LOGIN_FAILURES,
          severity: IncidentSeverity.HIGH,
          autoResponse: true
        },
        isActive: true
      },
      {
        id: 'phi_data_burst',
        name: 'PHI Data Access Burst',
        description: 'Excessive PHI data access in short period',
        eventTypes: ['audit_log'],
        conditions: {
          frequency: 15,
          timeWindow: 30 * 60 * 1000, // 30 minutes
          userBased: true,
          ipBased: false,
          sessionBased: false
        },
        response: {
          incidentType: IncidentType.EXCESSIVE_PHI_ACCESS,
          severity: IncidentSeverity.CRITICAL,
          autoResponse: true
        },
        isActive: true
      },
      {
        id: 'multiple_ip_access',
        name: 'Multiple IP Access',
        description: 'User accessing from multiple IP addresses',
        eventTypes: ['audit_log'],
        conditions: {
          frequency: 3,
          timeWindow: 60 * 60 * 1000, // 1 hour
          userBased: true,
          ipBased: false,
          sessionBased: false
        },
        response: {
          incidentType: IncidentType.SUSPICIOUS_LOGIN_LOCATION,
          severity: IncidentSeverity.MEDIUM,
          autoResponse: true
        },
        isActive: true
      }
    ]

    for (const pattern of patterns) {
      this.eventPatterns.set(pattern.id, pattern)
    }
  }

  /**
   * Utility methods
   */
  private getCurrentUser(): any {
    try {
      const userData = localStorage.getItem('currentUser')
      return userData ? JSON.parse(userData) : null
    } catch (error) {
      return null
    }
  }

  private isKnownIP(ip: string): boolean {
    // Simple implementation - in real system would check against whitelist
    const knownIPs = ['127.0.0.1', '::1', 'localhost']
    return knownIPs.includes(ip)
  }

  private isOffHours(): boolean {
    const hour = new Date().getHours()
    const day = new Date().getDay()

    // Business hours: 9 AM to 5 PM, Monday to Friday
    const isWeekday = day >= 1 && day <= 5
    const isBusinessHour = hour >= 9 && hour <= 17

    return !(isWeekday && isBusinessHour)
  }

  private summarizeEvent(event: any): string {
    if (event.type === 'audit_log') {
      return `${event.action} by ${event.userId || 'unknown'} (${event.outcome || 'unknown'})`
    } else if (event.type === 'mfa_lockout') {
      return `MFA lockout for ${event.userId || 'unknown'} after ${event.attempts || 'unknown'} attempts`
    } else if (event.type === 'emergency_logout') {
      return `Emergency logout by ${event.userId || 'unknown'}`
    }
    return `${event.type} event`
  }

  /**
   * Cleanup on service shutdown
   */
  async cleanup(): Promise<void> {
    try {
      if (this.patternMatchingInterval) {
        clearInterval(this.patternMatchingInterval)
      }

      // Log cleanup
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACCESS,
        ResourceType.SYSTEM,
        'security-integration-cleanup',
        AuditOutcome.SUCCESS,
        {
          operation: 'security_integration_cleanup',
          eventsProcessed: this.eventQueue.length,
          patternsActive: Array.from(this.eventPatterns.values()).filter(p => p.isActive).length,
          timestamp: new Date().toISOString()
        }
      )

      console.log('🧹 Security Integration Service cleanup completed')

    } catch (error) {
      console.error('❌ Failed to cleanup Security Integration Service:', error)
    }
  }
}

// Export singleton instance
export const securityIntegrationService = SecurityIntegrationService.getInstance()

// Export class for testing
export { SecurityIntegrationService }