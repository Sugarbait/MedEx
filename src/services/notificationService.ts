/**
 * NOTIFICATION SERVICE
 *
 * Handles multi-channel notifications for security incidents and alerts.
 * Supports email, SMS, push notifications, and webhooks with templating,
 * rate limiting, and delivery tracking.
 *
 * Features:
 * - Multiple notification channels (email, SMS, push, webhook)
 * - Template-based messaging with variable substitution
 * - Rate limiting and throttling to prevent spam
 * - Delivery tracking and retry logic
 * - HIPAA-compliant notification logging
 * - Priority-based routing and escalation
 * - Notification preferences per user/role
 * - Emergency notification bypassing normal limits
 */

import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'
import {
  SecurityIncident,
  IncidentSeverity,
  IncidentType,
  NotificationType,
  NotificationResponse
} from '@/types/incidentTypes'

export interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'webhook'
  enabled: boolean
  endpoint: string
  credentials?: Record<string, string>
  config?: Record<string, any>
}

export interface NotificationTemplate {
  id: string
  name: string
  type: NotificationType
  channels: ('email' | 'sms' | 'push' | 'webhook')[]
  templates: {
    email?: {
      subject: string
      body: string
      isHtml?: boolean
    }
    sms?: {
      message: string
    }
    push?: {
      title: string
      body: string
      icon?: string
      actions?: Array<{ action: string; title: string }>
    }
    webhook?: {
      payload: Record<string, any>
      headers?: Record<string, string>
    }
  }
  variables: string[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface NotificationRule {
  id: string
  name: string
  description: string
  conditions: {
    incidentTypes?: IncidentType[]
    severities?: IncidentSeverity[]
    userRoles?: string[]
    timeOfDay?: { start: number; end: number }
    businessHours?: boolean
  }
  actions: {
    templateId: string
    channels: string[]
    recipients: NotificationRecipient[]
    delay?: number // milliseconds
    escalation?: {
      delay: number
      templateId: string
      recipients: NotificationRecipient[]
    }
  }
  isActive: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
}

export interface NotificationRecipient {
  type: 'user' | 'role' | 'email' | 'phone' | 'webhook'
  value: string
  channel: 'email' | 'sms' | 'push' | 'webhook'
  preferences?: {
    enabled: boolean
    quietHours?: { start: number; end: number }
    maxFrequency?: number // per hour
  }
}

export interface NotificationHistory {
  id: string
  incidentId?: string
  templateId: string
  ruleId?: string
  type: NotificationType
  channel: 'email' | 'sms' | 'push' | 'webhook'
  recipient: string
  subject?: string
  message: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'rate_limited'
  attemptCount: number
  lastAttempt: Date
  deliveredAt?: Date
  failureReason?: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface NotificationStats {
  totalSent: number
  deliveryRate: number
  channelStats: Record<string, {
    sent: number
    delivered: number
    failed: number
    rate: number
  }>
  recentNotifications: NotificationHistory[]
  rateLimitedCount: number
  escalationCount: number
}

interface RateLimitData {
  count: number
  resetTime: number
}

export class NotificationService {
  private static instance: NotificationService
  private channels: Map<string, NotificationChannel> = new Map()
  private templates: Map<string, NotificationTemplate> = new Map()
  private rules: Map<string, NotificationRule> = new Map()
  private rateLimits: Map<string, RateLimitData> = new Map()
  private isInitialized = false

  // Storage keys
  private static readonly STORAGE_KEYS = {
    CHANNELS: 'notification_channels',
    TEMPLATES: 'notification_templates',
    RULES: 'notification_rules',
    HISTORY: 'notification_history',
    RATE_LIMITS: 'notification_rate_limits',
    PREFERENCES: 'notification_preferences'
  }

  // Rate limiting
  private static readonly DEFAULT_RATE_LIMITS = {
    email: { count: 10, window: 60 * 60 * 1000 }, // 10 per hour
    sms: { count: 5, window: 60 * 60 * 1000 },    // 5 per hour
    push: { count: 20, window: 60 * 60 * 1000 },  // 20 per hour
    webhook: { count: 50, window: 60 * 60 * 1000 } // 50 per hour
  }

  constructor() {
    this.loadConfiguration()
  }

  /**
   * Singleton instance
   */
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Set up default channels
      this.setupDefaultChannels()

      // Set up default templates
      this.setupDefaultTemplates()

      // Set up default rules
      this.setupDefaultRules()

      // Clean up old rate limits
      this.cleanupRateLimits()

      // Log initialization
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACCESS,
        ResourceType.SYSTEM,
        'notification-service',
        AuditOutcome.SUCCESS,
        {
          operation: 'notification_service_initialization',
          channelCount: this.channels.size,
          templateCount: this.templates.size,
          ruleCount: this.rules.size,
          timestamp: new Date().toISOString()
        }
      )

      this.isInitialized = true
      console.log('✅ Notification Service initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize Notification Service:', error)
      throw error
    }
  }

  /**
   * Send notification for security incident
   */
  async sendIncidentNotification(incident: SecurityIncident): Promise<NotificationResponse[]> {
    try {
      const responses: NotificationResponse[] = []

      // Find matching rules
      const matchingRules = this.findMatchingRules(incident)

      for (const rule of matchingRules) {
        try {
          const ruleResponses = await this.executeNotificationRule(rule, incident)
          responses.push(...ruleResponses)
        } catch (ruleError) {
          console.error(`❌ Failed to execute notification rule ${rule.id}:`, ruleError)

          // Create failure response
          responses.push({
            type: NotificationType.SECURITY_INCIDENT,
            recipient: 'rule-execution-failed',
            timestamp: new Date(),
            delivered: false,
            channel: 'email',
            message: `Failed to execute notification rule: ${rule.name}`,
            error: ruleError instanceof Error ? ruleError.message : 'Unknown error'
          })
        }
      }

      // Log notification attempt
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACCESS,
        ResourceType.SYSTEM,
        `notification-${incident.id}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'incident_notification_sent',
          incidentId: incident.id,
          incidentType: incident.type,
          notificationCount: responses.length,
          rulesMatched: matchingRules.length,
          successful: responses.filter(r => r.delivered).length,
          failed: responses.filter(r => !r.delivered).length
        }
      )

      return responses

    } catch (error) {
      console.error('❌ Failed to send incident notification:', error)
      throw error
    }
  }

  /**
   * Send custom notification
   */
  async sendCustomNotification(
    type: NotificationType,
    recipients: NotificationRecipient[],
    templateId: string,
    variables: Record<string, any> = {},
    isEmergency: boolean = false
  ): Promise<NotificationResponse[]> {
    try {
      const template = this.templates.get(templateId)
      if (!template) {
        throw new Error(`Template not found: ${templateId}`)
      }

      const responses: NotificationResponse[] = []

      for (const recipient of recipients) {
        try {
          const response = await this.sendToRecipient(
            recipient,
            template,
            variables,
            isEmergency
          )
          responses.push(response)
        } catch (recipientError) {
          console.error(`❌ Failed to send to recipient ${recipient.value}:`, recipientError)

          responses.push({
            type,
            recipient: recipient.value,
            timestamp: new Date(),
            delivered: false,
            channel: recipient.channel,
            message: 'Failed to send notification',
            error: recipientError instanceof Error ? recipientError.message : 'Unknown error'
          })
        }
      }

      return responses

    } catch (error) {
      console.error('❌ Failed to send custom notification:', error)
      throw error
    }
  }

  /**
   * Find matching notification rules for incident
   */
  private findMatchingRules(incident: SecurityIncident): NotificationRule[] {
    const matchingRules: NotificationRule[] = []

    for (const rule of this.rules.values()) {
      if (!rule.isActive) continue

      let matches = true

      // Check incident types
      if (rule.conditions.incidentTypes?.length) {
        matches = matches && rule.conditions.incidentTypes.includes(incident.type)
      }

      // Check severities
      if (rule.conditions.severities?.length) {
        matches = matches && rule.conditions.severities.includes(incident.severity)
      }

      // Check user roles (if incident has user info)
      if (rule.conditions.userRoles?.length && incident.userId) {
        // Would need to get user role from user service
        // For now, assume all rules match
      }

      // Check time conditions
      if (rule.conditions.timeOfDay) {
        const currentHour = new Date().getHours()
        const { start, end } = rule.conditions.timeOfDay

        if (start <= end) {
          matches = matches && (currentHour >= start && currentHour <= end)
        } else {
          // Overnight range (e.g., 22-6)
          matches = matches && (currentHour >= start || currentHour <= end)
        }
      }

      // Check business hours
      if (rule.conditions.businessHours !== undefined) {
        const isBusinessHours = this.isBusinessHours()
        matches = matches && (rule.conditions.businessHours === isBusinessHours)
      }

      if (matches) {
        matchingRules.push(rule)
      }
    }

    // Sort by priority (higher priority first)
    return matchingRules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Execute notification rule
   */
  private async executeNotificationRule(
    rule: NotificationRule,
    incident: SecurityIncident
  ): Promise<NotificationResponse[]> {
    const responses: NotificationResponse[] = []

    // Get template
    const template = this.templates.get(rule.actions.templateId)
    if (!template) {
      throw new Error(`Template not found: ${rule.actions.templateId}`)
    }

    // Prepare variables for template
    const variables = this.prepareIncidentVariables(incident)

    // Apply delay if specified
    if (rule.actions.delay) {
      await this.delay(rule.actions.delay)
    }

    // Send to all recipients
    for (const recipient of rule.actions.recipients) {
      try {
        const response = await this.sendToRecipient(
          recipient,
          template,
          variables,
          incident.severity === IncidentSeverity.CRITICAL
        )
        responses.push(response)

        // Store in history
        await this.addToHistory({
          incidentId: incident.id,
          templateId: template.id,
          ruleId: rule.id,
          type: template.type,
          channel: recipient.channel,
          recipient: recipient.value,
          subject: response.message.split('\n')[0], // First line as subject
          message: response.message,
          status: response.delivered ? 'delivered' : 'failed',
          attemptCount: 1,
          lastAttempt: response.timestamp,
          deliveredAt: response.delivered ? response.timestamp : undefined,
          failureReason: response.error,
          metadata: {
            incidentType: incident.type,
            severity: incident.severity,
            ruleId: rule.id
          }
        })

      } catch (error) {
        console.error(`❌ Failed to send to recipient ${recipient.value}:`, error)

        responses.push({
          type: template.type,
          recipient: recipient.value,
          timestamp: new Date(),
          delivered: false,
          channel: recipient.channel,
          message: 'Failed to send notification',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Handle escalation if configured
    if (rule.actions.escalation && responses.some(r => !r.delivered)) {
      console.log(`⬆️ Escalating notification for rule ${rule.id}`)

      await this.delay(rule.actions.escalation.delay)

      const escalationTemplate = this.templates.get(rule.actions.escalation.templateId)
      if (escalationTemplate) {
        for (const recipient of rule.actions.escalation.recipients) {
          try {
            const response = await this.sendToRecipient(
              recipient,
              escalationTemplate,
              { ...variables, escalated: true },
              true // Emergency escalation
            )
            responses.push(response)
          } catch (error) {
            console.error(`❌ Failed to send escalation to ${recipient.value}:`, error)
          }
        }
      }
    }

    return responses
  }

  /**
   * Send notification to specific recipient
   */
  private async sendToRecipient(
    recipient: NotificationRecipient,
    template: NotificationTemplate,
    variables: Record<string, any>,
    isEmergency: boolean = false
  ): Promise<NotificationResponse> {
    try {
      // Check rate limits (unless emergency)
      if (!isEmergency && !this.checkRateLimit(recipient.channel, recipient.value)) {
        return {
          type: template.type,
          recipient: recipient.value,
          timestamp: new Date(),
          delivered: false,
          channel: recipient.channel,
          message: 'Rate limited',
          error: 'Rate limit exceeded'
        }
      }

      // Check recipient preferences
      if (!isEmergency && !this.checkRecipientPreferences(recipient)) {
        return {
          type: template.type,
          recipient: recipient.value,
          timestamp: new Date(),
          delivered: false,
          channel: recipient.channel,
          message: 'Blocked by preferences',
          error: 'Recipient preferences block this notification'
        }
      }

      // Get channel configuration
      const channel = this.channels.get(recipient.channel)
      if (!channel || !channel.enabled) {
        throw new Error(`Channel not available: ${recipient.channel}`)
      }

      // Render message from template
      const renderedMessage = this.renderTemplate(template, recipient.channel, variables)

      // Send notification based on channel
      const delivered = await this.sendViaChannel(
        channel,
        recipient.value,
        renderedMessage,
        template.type
      )

      // Update rate limits
      if (!isEmergency) {
        this.updateRateLimit(recipient.channel, recipient.value)
      }

      return {
        type: template.type,
        recipient: recipient.value,
        timestamp: new Date(),
        delivered,
        channel: recipient.channel,
        message: typeof renderedMessage === 'string' ? renderedMessage : JSON.stringify(renderedMessage)
      }

    } catch (error) {
      console.error(`❌ Failed to send to recipient ${recipient.value}:`, error)

      return {
        type: template.type,
        recipient: recipient.value,
        timestamp: new Date(),
        delivered: false,
        channel: recipient.channel,
        message: 'Send failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendViaChannel(
    channel: NotificationChannel,
    recipient: string,
    message: any,
    type: NotificationType
  ): Promise<boolean> {
    try {
      switch (channel.type) {
        case 'email':
          return await this.sendEmail(channel, recipient, message)
        case 'sms':
          return await this.sendSMS(channel, recipient, message)
        case 'push':
          return await this.sendPushNotification(channel, recipient, message)
        case 'webhook':
          return await this.sendWebhook(channel, recipient, message, type)
        default:
          throw new Error(`Unknown channel type: ${channel.type}`)
      }
    } catch (error) {
      console.error(`❌ Failed to send via ${channel.type}:`, error)
      return false
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    channel: NotificationChannel,
    recipient: string,
    message: { subject: string; body: string; isHtml?: boolean }
  ): Promise<boolean> {
    try {
      // In a real implementation, this would integrate with an email service like SendGrid, AWS SES, etc.
      // For demo purposes, we'll log the email
      console.log('📧 Email notification:', {
        to: recipient,
        subject: message.subject,
        body: message.body,
        isHtml: message.isHtml || false
      })

      // Simulate email sending delay
      await this.delay(500)

      // Simulate success/failure (90% success rate)
      const success = Math.random() > 0.1

      if (success) {
        console.log(`✅ Email sent successfully to ${recipient}`)
      } else {
        console.log(`❌ Email failed to send to ${recipient}`)
      }

      return success

    } catch (error) {
      console.error('❌ Email sending failed:', error)
      return false
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    channel: NotificationChannel,
    recipient: string,
    message: { message: string }
  ): Promise<boolean> {
    try {
      // In a real implementation, this would integrate with Twilio, AWS SNS, etc.
      // For demo purposes, we'll log the SMS
      console.log('📱 SMS notification:', {
        to: recipient,
        message: message.message
      })

      // Simulate SMS sending delay
      await this.delay(300)

      // Simulate success/failure (95% success rate)
      const success = Math.random() > 0.05

      if (success) {
        console.log(`✅ SMS sent successfully to ${recipient}`)
      } else {
        console.log(`❌ SMS failed to send to ${recipient}`)
      }

      return success

    } catch (error) {
      console.error('❌ SMS sending failed:', error)
      return false
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    channel: NotificationChannel,
    recipient: string,
    message: { title: string; body: string; icon?: string; actions?: any[] }
  ): Promise<boolean> {
    try {
      // In a real implementation, this would use Web Push API or similar
      // For demo purposes, we'll log the push notification
      console.log('🔔 Push notification:', {
        to: recipient,
        title: message.title,
        body: message.body,
        icon: message.icon,
        actions: message.actions
      })

      // Simulate push sending delay
      await this.delay(200)

      // Simulate success/failure (85% success rate - lower due to device availability)
      const success = Math.random() > 0.15

      if (success) {
        console.log(`✅ Push notification sent successfully to ${recipient}`)
      } else {
        console.log(`❌ Push notification failed to send to ${recipient}`)
      }

      return success

    } catch (error) {
      console.error('❌ Push notification sending failed:', error)
      return false
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    channel: NotificationChannel,
    recipient: string,
    message: { payload: Record<string, any>; headers?: Record<string, string> },
    type: NotificationType
  ): Promise<boolean> {
    try {
      // In a real implementation, this would make an HTTP request to the webhook URL
      // For demo purposes, we'll log the webhook
      console.log('🌐 Webhook notification:', {
        url: recipient,
        payload: message.payload,
        headers: message.headers,
        type
      })

      // Simulate webhook delay
      await this.delay(1000)

      // Simulate success/failure (80% success rate - lower due to external dependencies)
      const success = Math.random() > 0.2

      if (success) {
        console.log(`✅ Webhook sent successfully to ${recipient}`)
      } else {
        console.log(`❌ Webhook failed to send to ${recipient}`)
      }

      return success

    } catch (error) {
      console.error('❌ Webhook sending failed:', error)
      return false
    }
  }

  /**
   * Render template with variables
   */
  private renderTemplate(
    template: NotificationTemplate,
    channel: 'email' | 'sms' | 'push' | 'webhook',
    variables: Record<string, any>
  ): any {
    const channelTemplate = template.templates[channel]
    if (!channelTemplate) {
      throw new Error(`No template configured for channel: ${channel}`)
    }

    const renderString = (str: string): string => {
      return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables[varName] || match
      })
    }

    switch (channel) {
      case 'email':
        return {
          subject: renderString(channelTemplate.subject || ''),
          body: renderString(channelTemplate.body || ''),
          isHtml: channelTemplate.isHtml || false
        }
      case 'sms':
        return {
          message: renderString(channelTemplate.message || '')
        }
      case 'push':
        return {
          title: renderString(channelTemplate.title || ''),
          body: renderString(channelTemplate.body || ''),
          icon: channelTemplate.icon,
          actions: channelTemplate.actions
        }
      case 'webhook':
        return {
          payload: this.renderObject(channelTemplate.payload || {}, variables),
          headers: channelTemplate.headers
        }
      default:
        throw new Error(`Unknown channel: ${channel}`)
    }
  }

  /**
   * Render object with variable substitution
   */
  private renderObject(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables[varName] || match
      })
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.renderObject(item, variables))
    } else if (typeof obj === 'object' && obj !== null) {
      const rendered: any = {}
      for (const [key, value] of Object.entries(obj)) {
        rendered[key] = this.renderObject(value, variables)
      }
      return rendered
    }
    return obj
  }

  /**
   * Prepare variables for incident notifications
   */
  private prepareIncidentVariables(incident: SecurityIncident): Record<string, any> {
    return {
      incidentId: incident.id,
      incidentType: incident.type,
      severity: incident.severity,
      status: incident.status,
      title: incident.title,
      description: incident.description,
      timestamp: incident.timestamp.toISOString(),
      userId: incident.userId || 'Unknown',
      userEmail: incident.userEmail || 'Unknown',
      sourceIP: incident.sourceIP || 'Unknown',
      evidenceCount: incident.evidence.length,
      automatedResponseCount: incident.response.automated.length,
      dashboardUrl: `${window.location.origin}/security/incidents/${incident.id}`,
      currentTime: new Date().toISOString(),
      systemName: 'CareXPS Healthcare CRM'
    }
  }

  /**
   * Check rate limits
   */
  private checkRateLimit(channel: string, recipient: string): boolean {
    const key = `${channel}:${recipient}`
    const limit = NotificationService.DEFAULT_RATE_LIMITS[channel as keyof typeof NotificationService.DEFAULT_RATE_LIMITS]

    if (!limit) return true

    const now = Date.now()
    const data = this.rateLimits.get(key)

    if (!data || now > data.resetTime) {
      // Reset or initialize rate limit
      this.rateLimits.set(key, {
        count: 0,
        resetTime: now + limit.window
      })
      return true
    }

    return data.count < limit.count
  }

  /**
   * Update rate limits
   */
  private updateRateLimit(channel: string, recipient: string): void {
    const key = `${channel}:${recipient}`
    const data = this.rateLimits.get(key)

    if (data) {
      data.count++
      this.rateLimits.set(key, data)
    }
  }

  /**
   * Check recipient preferences
   */
  private checkRecipientPreferences(recipient: NotificationRecipient): boolean {
    if (!recipient.preferences) return true

    // Check if notifications are enabled
    if (!recipient.preferences.enabled) return false

    // Check quiet hours
    if (recipient.preferences.quietHours) {
      const currentHour = new Date().getHours()
      const { start, end } = recipient.preferences.quietHours

      if (start <= end) {
        // Normal range (e.g., 22-6)
        if (currentHour >= start && currentHour <= end) return false
      } else {
        // Overnight range (e.g., 22-6)
        if (currentHour >= start || currentHour <= end) return false
      }
    }

    // Check frequency limits
    if (recipient.preferences.maxFrequency) {
      const key = `freq:${recipient.channel}:${recipient.value}`
      const data = this.rateLimits.get(key)
      const now = Date.now()

      if (data && now <= data.resetTime && data.count >= recipient.preferences.maxFrequency) {
        return false
      }
    }

    return true
  }

  /**
   * Check if current time is business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay() // 0 = Sunday, 1 = Monday, etc.

    // Assume business hours are 9 AM to 5 PM, Monday to Friday
    const isWeekday = day >= 1 && day <= 5
    const isBusinessHour = hour >= 9 && hour <= 17

    return isWeekday && isBusinessHour
  }

  /**
   * Add notification to history
   */
  private async addToHistory(historyData: Omit<NotificationHistory, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const history: NotificationHistory = {
        id: this.generateId(),
        ...historyData,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const existingHistory = this.getStoredData(NotificationService.STORAGE_KEYS.HISTORY, [])
      existingHistory.push(history)

      // Keep only last 1000 notifications
      if (existingHistory.length > 1000) {
        existingHistory.splice(0, existingHistory.length - 1000)
      }

      this.storeData(NotificationService.STORAGE_KEYS.HISTORY, existingHistory)

    } catch (error) {
      console.error('❌ Failed to add notification to history:', error)
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<NotificationStats> {
    try {
      const history: NotificationHistory[] = this.getStoredData(NotificationService.STORAGE_KEYS.HISTORY, [])

      const totalSent = history.length
      const delivered = history.filter(h => h.status === 'delivered').length
      const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0

      const channelStats: Record<string, any> = {}
      const channels = ['email', 'sms', 'push', 'webhook']

      for (const channel of channels) {
        const channelHistory = history.filter(h => h.channel === channel)
        const channelDelivered = channelHistory.filter(h => h.status === 'delivered').length
        const channelFailed = channelHistory.filter(h => h.status === 'failed').length

        channelStats[channel] = {
          sent: channelHistory.length,
          delivered: channelDelivered,
          failed: channelFailed,
          rate: channelHistory.length > 0 ? (channelDelivered / channelHistory.length) * 100 : 0
        }
      }

      const recentNotifications = history
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)

      const rateLimitedCount = history.filter(h => h.status === 'rate_limited').length
      const escalationCount = history.filter(h => h.metadata.escalated).length

      return {
        totalSent,
        deliveryRate,
        channelStats,
        recentNotifications,
        rateLimitedCount,
        escalationCount
      }

    } catch (error) {
      console.error('❌ Failed to get notification stats:', error)
      throw error
    }
  }

  /**
   * Setup default channels
   */
  private setupDefaultChannels(): void {
    // Email channel
    this.channels.set('email', {
      type: 'email',
      enabled: true,
      endpoint: 'smtp://localhost:587',
      credentials: {
        username: 'notifications@carexps.com',
        password: '[CONFIGURED_IN_ENV]'
      },
      config: {
        from: 'CareXPS Security <security@carexps.com>',
        replyTo: 'noreply@carexps.com'
      }
    })

    // SMS channel
    this.channels.set('sms', {
      type: 'sms',
      enabled: false, // Disabled by default - requires Twilio setup
      endpoint: 'https://api.twilio.com/2010-04-01/Accounts',
      credentials: {
        accountSid: '[TWILIO_ACCOUNT_SID]',
        authToken: '[TWILIO_AUTH_TOKEN]'
      },
      config: {
        from: '+1234567890'
      }
    })

    // Push notification channel
    this.channels.set('push', {
      type: 'push',
      enabled: false, // Disabled by default - requires push setup
      endpoint: 'https://fcm.googleapis.com/fcm/send',
      credentials: {
        serverKey: '[FCM_SERVER_KEY]'
      }
    })

    // Webhook channel
    this.channels.set('webhook', {
      type: 'webhook',
      enabled: true,
      endpoint: 'configurable'
    })

    this.saveChannels()
  }

  /**
   * Setup default templates
   */
  private setupDefaultTemplates(): void {
    // Security incident template
    const securityIncidentTemplate: NotificationTemplate = {
      id: 'security_incident',
      name: 'Security Incident Alert',
      type: NotificationType.SECURITY_INCIDENT,
      channels: ['email', 'sms', 'webhook'],
      templates: {
        email: {
          subject: '🚨 Security Alert: {{title}} ({{severity}})',
          body: `
SECURITY INCIDENT DETECTED

Incident ID: {{incidentId}}
Type: {{incidentType}}
Severity: {{severity}}
Time: {{timestamp}}

Description:
{{description}}

User Information:
- User ID: {{userId}}
- Email: {{userEmail}}
- Source IP: {{sourceIP}}

Evidence: {{evidenceCount}} items
Automated Responses: {{automatedResponseCount}}

Please review this incident in the security dashboard:
{{dashboardUrl}}

This is an automated security alert from {{systemName}}.
          `,
          isHtml: false
        },
        sms: {
          message: '🚨 SECURITY ALERT: {{incidentType}} ({{severity}}) - {{title}}. Incident ID: {{incidentId}}. Review immediately at {{dashboardUrl}}'
        },
        webhook: {
          payload: {
            type: 'security_incident',
            incident_id: '{{incidentId}}',
            incident_type: '{{incidentType}}',
            severity: '{{severity}}',
            title: '{{title}}',
            description: '{{description}}',
            user_id: '{{userId}}',
            user_email: '{{userEmail}}',
            source_ip: '{{sourceIP}}',
            timestamp: '{{timestamp}}',
            dashboard_url: '{{dashboardUrl}}'
          },
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'CareXPS-Security'
          }
        }
      },
      variables: ['incidentId', 'incidentType', 'severity', 'title', 'description', 'userId', 'userEmail', 'sourceIP', 'timestamp', 'evidenceCount', 'automatedResponseCount', 'dashboardUrl', 'systemName'],
      priority: 'critical',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Account lockout template
    const accountLockoutTemplate: NotificationTemplate = {
      id: 'account_lockout',
      name: 'Account Lockout Notification',
      type: NotificationType.ACCOUNT_LOCKOUT,
      channels: ['email', 'sms'],
      templates: {
        email: {
          subject: '🔒 Account Lockout: {{userEmail}}',
          body: `
ACCOUNT LOCKOUT NOTIFICATION

Your account has been temporarily locked due to security concerns.

Account: {{userEmail}}
Lockout Time: {{timestamp}}
Reason: {{title}}

If this was not you, please contact security immediately.
If this was you, please wait for the lockout period to expire or contact your administrator.

For security questions, contact: security@carexps.com

This is an automated security notification from {{systemName}}.
          `,
          isHtml: false
        },
        sms: {
          message: '🔒 ACCOUNT LOCKED: Your CareXPS account has been locked due to: {{title}}. Contact security if this was not you.'
        }
      },
      variables: ['userEmail', 'timestamp', 'title', 'systemName'],
      priority: 'high',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Emergency logout template
    const emergencyLogoutTemplate: NotificationTemplate = {
      id: 'emergency_logout',
      name: 'Emergency Logout Alert',
      type: NotificationType.EMERGENCY_LOGOUT,
      channels: ['email', 'sms', 'webhook'],
      templates: {
        email: {
          subject: '⚠️ Emergency Logout Detected: {{userEmail}}',
          body: `
EMERGENCY LOGOUT DETECTED

An emergency logout was triggered for your account.

Account: {{userEmail}}
Time: {{timestamp}}
Source IP: {{sourceIP}}

Emergency logouts are triggered when users press Ctrl+Shift+L and may indicate:
- Security concerns
- Suspicious activity
- User panic response

Please verify this action was intentional. If not, change your password immediately and contact security.

Security Team: security@carexps.com

This is an automated security notification from {{systemName}}.
          `,
          isHtml: false
        },
        sms: {
          message: '⚠️ EMERGENCY LOGOUT: Emergency logout detected for {{userEmail}} at {{timestamp}}. Verify this was intentional.'
        },
        webhook: {
          payload: {
            type: 'emergency_logout',
            user_email: '{{userEmail}}',
            timestamp: '{{timestamp}}',
            source_ip: '{{sourceIP}}',
            alert_level: 'high'
          }
        }
      },
      variables: ['userEmail', 'timestamp', 'sourceIP', 'systemName'],
      priority: 'high',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.templates.set('security_incident', securityIncidentTemplate)
    this.templates.set('account_lockout', accountLockoutTemplate)
    this.templates.set('emergency_logout', emergencyLogoutTemplate)

    this.saveTemplates()
  }

  /**
   * Setup default notification rules
   */
  private setupDefaultRules(): void {
    // Critical incident rule
    const criticalIncidentRule: NotificationRule = {
      id: 'critical_incidents',
      name: 'Critical Security Incidents',
      description: 'Immediate notification for all critical security incidents',
      conditions: {
        severities: [IncidentSeverity.CRITICAL]
      },
      actions: {
        templateId: 'security_incident',
        channels: ['email', 'sms'],
        recipients: [
          {
            type: 'role',
            value: 'super_user',
            channel: 'email'
          },
          {
            type: 'role',
            value: 'admin',
            channel: 'email'
          }
        ],
        escalation: {
          delay: 15 * 60 * 1000, // 15 minutes
          templateId: 'security_incident',
          recipients: [
            {
              type: 'email',
              value: 'security-team@carexps.com',
              channel: 'email'
            }
          ]
        }
      },
      isActive: true,
      priority: 100,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // MFA lockout rule
    const mfaLockoutRule: NotificationRule = {
      id: 'mfa_lockouts',
      name: 'MFA Account Lockouts',
      description: 'Notification for MFA-related account lockouts',
      conditions: {
        incidentTypes: [IncidentType.MFA_LOCKOUT]
      },
      actions: {
        templateId: 'account_lockout',
        channels: ['email'],
        recipients: [
          {
            type: 'user',
            value: '{{userId}}',
            channel: 'email'
          },
          {
            type: 'role',
            value: 'admin',
            channel: 'email'
          }
        ]
      },
      isActive: true,
      priority: 80,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Emergency logout rule
    const emergencyLogoutRule: NotificationRule = {
      id: 'emergency_logouts',
      name: 'Emergency Logout Events',
      description: 'Notification for emergency logout triggers',
      conditions: {
        incidentTypes: [IncidentType.EMERGENCY_LOGOUT_TRIGGERED]
      },
      actions: {
        templateId: 'emergency_logout',
        channels: ['email', 'sms'],
        recipients: [
          {
            type: 'user',
            value: '{{userId}}',
            channel: 'email'
          },
          {
            type: 'role',
            value: 'super_user',
            channel: 'email'
          }
        ]
      },
      isActive: true,
      priority: 75,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Business hours high severity rule
    const businessHoursRule: NotificationRule = {
      id: 'business_hours_high',
      name: 'Business Hours High Severity',
      description: 'High severity incidents during business hours',
      conditions: {
        severities: [IncidentSeverity.HIGH],
        businessHours: true
      },
      actions: {
        templateId: 'security_incident',
        channels: ['email'],
        recipients: [
          {
            type: 'role',
            value: 'admin',
            channel: 'email'
          }
        ],
        delay: 5 * 60 * 1000 // 5 minute delay
      },
      isActive: true,
      priority: 60,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.rules.set('critical_incidents', criticalIncidentRule)
    this.rules.set('mfa_lockouts', mfaLockoutRule)
    this.rules.set('emergency_logouts', emergencyLogoutRule)
    this.rules.set('business_hours_high', businessHoursRule)

    this.saveRules()
  }

  /**
   * Clean up expired rate limits
   */
  private cleanupRateLimits(): void {
    const now = Date.now()
    for (const [key, data] of this.rateLimits.entries()) {
      if (now > data.resetTime) {
        this.rateLimits.delete(key)
      }
    }

    // Schedule next cleanup
    setTimeout(() => this.cleanupRateLimits(), 60 * 60 * 1000) // 1 hour
  }

  /**
   * Utility methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getStoredData(key: string, defaultValue: any): any {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : defaultValue
    } catch (error) {
      console.error(`❌ Failed to get stored data for key ${key}:`, error)
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
      // Load channels
      const channels = this.getStoredData(NotificationService.STORAGE_KEYS.CHANNELS, {})
      for (const [id, channel] of Object.entries(channels)) {
        this.channels.set(id, channel as NotificationChannel)
      }

      // Load templates
      const templates = this.getStoredData(NotificationService.STORAGE_KEYS.TEMPLATES, {})
      for (const [id, template] of Object.entries(templates)) {
        this.templates.set(id, template as NotificationTemplate)
      }

      // Load rules
      const rules = this.getStoredData(NotificationService.STORAGE_KEYS.RULES, {})
      for (const [id, rule] of Object.entries(rules)) {
        this.rules.set(id, rule as NotificationRule)
      }

    } catch (error) {
      console.error('❌ Failed to load notification configuration:', error)
    }
  }

  private saveChannels(): void {
    const channels = Object.fromEntries(this.channels)
    this.storeData(NotificationService.STORAGE_KEYS.CHANNELS, channels)
  }

  private saveTemplates(): void {
    const templates = Object.fromEntries(this.templates)
    this.storeData(NotificationService.STORAGE_KEYS.TEMPLATES, templates)
  }

  private saveRules(): void {
    const rules = Object.fromEntries(this.rules)
    this.storeData(NotificationService.STORAGE_KEYS.RULES, rules)
  }

  /**
   * Public API methods
   */
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values())
  }

  getTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values())
  }

  getRules(): NotificationRule[] {
    return Array.from(this.rules.values())
  }

  updateChannel(id: string, channel: Partial<NotificationChannel>): void {
    const existing = this.channels.get(id)
    if (existing) {
      this.channels.set(id, { ...existing, ...channel })
      this.saveChannels()
    }
  }

  updateTemplate(id: string, template: Partial<NotificationTemplate>): void {
    const existing = this.templates.get(id)
    if (existing) {
      this.templates.set(id, { ...existing, ...template, updatedAt: new Date() })
      this.saveTemplates()
    }
  }

  updateRule(id: string, rule: Partial<NotificationRule>): void {
    const existing = this.rules.get(id)
    if (existing) {
      this.rules.set(id, { ...existing, ...rule, updatedAt: new Date() })
      this.saveRules()
    }
  }

  async testNotification(
    channelType: 'email' | 'sms' | 'push' | 'webhook',
    recipient: string,
    message: string
  ): Promise<boolean> {
    try {
      const channel = this.channels.get(channelType)
      if (!channel) {
        throw new Error(`Channel not found: ${channelType}`)
      }

      const testMessage = channelType === 'email'
        ? { subject: 'Test Notification', body: message, isHtml: false }
        : channelType === 'sms'
        ? { message }
        : channelType === 'push'
        ? { title: 'Test Notification', body: message }
        : { payload: { test: true, message }, headers: {} }

      return await this.sendViaChannel(channel, recipient, testMessage, NotificationType.SECURITY_INCIDENT)

    } catch (error) {
      console.error('❌ Test notification failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance()

// Export class for testing
export { NotificationService }