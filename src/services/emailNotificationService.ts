/**
 * Email Notification Service for CareXPS CRM
 * Handles PHI-safe email notifications via EmailJS (client-side)
 */

import { supabase } from '@/config/supabase'
import { clientEmailService } from './clientEmailService'

export interface EmailNotificationConfig {
  enabled: boolean
  recipientEmails: string[]
  notificationTypes: {
    newSMS: boolean
    newCall: boolean
    securityAlerts: boolean
    systemAlerts: boolean
  }
}

export interface NotificationData {
  type: 'new_sms' | 'new_call' | 'security_alert' | 'system_alert'
  title: string
  message: string
  timestamp: Date
  metadata?: {
    count?: number
    severity?: 'low' | 'medium' | 'high' | 'critical'
  }
}

class EmailNotificationServiceClass {
  private config: EmailNotificationConfig | null = null
  private isInitialized = false
  private realtimeSubscription: any = null

  /**
   * Initialize the email notification service
   */
  async initialize(): Promise<void> {
    try {
      console.log('📧 EmailNotificationService: Initializing...')

      // Load configuration from user settings
      await this.loadConfiguration()

      // Set up real-time synchronization
      await this.setupRealtimeSync()

      this.isInitialized = true
      console.log('✅ EmailNotificationService: Initialized successfully (cloud-synced)')
    } catch (error) {
      console.error('❌ EmailNotificationService: Initialization failed:', error)
    }
  }

  /**
   * Load notification configuration from Supabase user_settings (cloud-synced with RLS fallback)
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const currentUser = localStorage.getItem('currentUser')
      if (!currentUser) return

      const userData = JSON.parse(currentUser)
      const userId = userData.id

      console.log('📧 Loading email notification config from Supabase for user:', userId)

      // Try to load from Supabase user_settings table
      const { data: userSettings, error } = await supabase
        .from('user_settings')
        .select('email_notifications')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - this is OK, use defaults
          console.log('📧 No email settings found in Supabase, checking localStorage')
        } else if (error.code === '42501' || error.message?.includes('row-level security policy')) {
          // RLS policy blocking read access
          console.warn('🔒 EMAIL SETTINGS: RLS policy blocking read operation - using localStorage fallback')
        } else {
          // Other error
          console.warn('📧 Failed to load from Supabase, falling back to localStorage:', error)
        }

        // Fallback to localStorage
        const settingsKey = `settings_${userId}`
        const localSettings = localStorage.getItem(settingsKey)
        if (localSettings) {
          const settings = JSON.parse(localSettings)
          this.config = settings.emailNotifications || this.getDefaultConfig()
          console.log('📧 Loaded email config from localStorage fallback')
        } else {
          this.config = this.getDefaultConfig()
          console.log('📧 Using default email notification config')
        }
      } else if (userSettings?.email_notifications) {
        // Use Supabase settings
        this.config = userSettings.email_notifications as EmailNotificationConfig
        console.log('📧 Loaded email config from Supabase (cloud-synced)')

        // Cache in localStorage for quick access
        const settingsKey = `settings_${userId}`
        const localSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}')
        localSettings.emailNotifications = this.config
        localStorage.setItem(settingsKey, JSON.stringify(localSettings))
      } else {
        // No settings found, use defaults
        this.config = this.getDefaultConfig()
        console.log('📧 Using default email notification config')
      }

      console.log('📧 Email notification config loaded:', {
        enabled: this.config.enabled,
        recipientCount: this.config.recipientEmails.length,
        types: this.config.notificationTypes,
        source: (userSettings?.email_notifications) ? 'supabase' : 'localStorage'
      })
    } catch (error) {
      console.error('❌ Failed to load email notification config:', error)

      // Emergency fallback to localStorage
      try {
        const currentUser = localStorage.getItem('currentUser')
        if (currentUser) {
          const userData = JSON.parse(currentUser)
          const settingsKey = `settings_${userData.id}`
          const localSettings = localStorage.getItem(settingsKey)
          if (localSettings) {
            const settings = JSON.parse(localSettings)
            this.config = settings.emailNotifications || this.getDefaultConfig()
            console.log('📧 Emergency fallback: Loaded from localStorage')
          } else {
            this.config = this.getDefaultConfig()
            console.log('📧 Emergency fallback: Using defaults')
          }
        } else {
          this.config = this.getDefaultConfig()
        }
      } catch (fallbackError) {
        console.error('❌ Even localStorage fallback failed:', fallbackError)
        this.config = this.getDefaultConfig()
      }
    }
  }

  /**
   * Set up real-time synchronization for cross-device email settings
   */
  private async setupRealtimeSync(): Promise<void> {
    try {
      const currentUser = localStorage.getItem('currentUser')
      if (!currentUser) return

      const userData = JSON.parse(currentUser)
      const userId = userData.id

      // Clean up existing subscription
      if (this.realtimeSubscription) {
        await supabase.removeChannel(this.realtimeSubscription)
      }

      // Subscribe to user_settings changes
      this.realtimeSubscription = supabase
        .channel(`email_settings_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('📧 Email settings updated from another device:', payload)
            this.handleRealtimeUpdate(payload.new)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Email settings real-time sync active')
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('📧 Email settings sync error, will retry...')
          }
        })

    } catch (error) {
      console.error('❌ Failed to set up email settings real-time sync:', error)
    }
  }

  /**
   * Handle real-time updates from other devices
   */
  private handleRealtimeUpdate(updatedSettings: any): void {
    try {
      if (updatedSettings.email_notifications) {
        const newConfig = updatedSettings.email_notifications as EmailNotificationConfig

        // Only update if it's actually different
        if (JSON.stringify(newConfig) !== JSON.stringify(this.config)) {
          console.log('📧 Applying email settings from another device')
          this.config = newConfig

          // Update localStorage cache
          const currentUser = localStorage.getItem('currentUser')
          if (currentUser) {
            const userData = JSON.parse(currentUser)
            const settingsKey = `settings_${userData.id}`
            const localSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}')
            localSettings.emailNotifications = newConfig
            localStorage.setItem(settingsKey, JSON.stringify(localSettings))
          }

          // Notify UI components of the change
          window.dispatchEvent(new CustomEvent('emailConfigUpdated', {
            detail: { config: newConfig }
          }))

          console.log('✅ Email settings synchronized from another device')
        }
      }
    } catch (error) {
      console.error('❌ Error handling email settings real-time update:', error)
    }
  }

  /**
   * Get default notification configuration
   */
  private getDefaultConfig(): EmailNotificationConfig {
    return {
      enabled: false,
      recipientEmails: [],
      notificationTypes: {
        newSMS: true,
        newCall: true,
        securityAlerts: true,
        systemAlerts: true
      }
    }
  }

  /**
   * Send email notification (using client-side EmailJS)
   */
  async sendNotification(data: NotificationData): Promise<void> {
    try {
      if (!this.isInitialized || !this.config?.enabled) {
        console.log('📧 Email notifications disabled, skipping...')
        return
      }

      // Check if this notification type is enabled
      const typeEnabled = this.isNotificationTypeEnabled(data.type)
      if (!typeEnabled) {
        console.log(`📧 Notification type ${data.type} is disabled, skipping...`)
        return
      }

      if (this.config.recipientEmails.length === 0) {
        console.log('📧 No recipient emails configured, skipping notification...')
        return
      }

      console.log(`📧 Sending ${data.type} notification to ${this.config.recipientEmails.length} recipients via EmailJS`)

      // Map notification types to EmailJS format
      const emailType = data.type.replace('_', '') as 'newSMS' | 'newCall' | 'securityAlert' | 'systemAlert'

      // Send via client-side EmailJS service
      const result = await clientEmailService.sendNotification(
        this.config.recipientEmails,
        {
          type: emailType,
          title: data.title,
          message: data.message,
          timestamp: data.timestamp
        }
      )

      if (result.success) {
        console.log('✅ Email notification sent successfully via EmailJS')
      } else {
        throw new Error(result.error || 'Failed to send email')
      }

    } catch (error) {
      console.error('❌ Failed to send email notification:', error)

      // Log to audit system for debugging
      try {
        const { auditLogger, AuditAction, AuditOutcome } = await import('./auditLogger')
        await auditLogger.logSecurityEvent(
          AuditAction.SYSTEM_ACCESS,
          'SYSTEM',
          AuditOutcome.FAILURE,
          JSON.stringify({
            action: 'email_notification_failed',
            type: data.type,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        )
      } catch (auditError) {
        console.error('Failed to log notification error:', auditError)
      }
    }
  }

  /**
   * Check if notification type is enabled
   */
  private isNotificationTypeEnabled(type: NotificationData['type']): boolean {
    if (!this.config) return false

    switch (type) {
      case 'new_sms':
        return this.config.notificationTypes.newSMS
      case 'new_call':
        return this.config.notificationTypes.newCall
      case 'security_alert':
        return this.config.notificationTypes.securityAlerts
      case 'system_alert':
        return this.config.notificationTypes.systemAlerts
      default:
        return false
    }
  }

  /**
   * Generate HTML email template
   */
  private getEmailTemplate(data: NotificationData): string {
    const severityColor = this.getSeverityColor(data.metadata?.severity)
    const icon = this.getNotificationIcon(data.type)

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CareXPS Notification</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2563eb, #3b82f6);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 30px;
        }
        .notification-box {
            background: ${severityColor.bg};
            border-left: 4px solid ${severityColor.border};
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .notification-title {
            font-size: 18px;
            font-weight: 600;
            color: ${severityColor.text};
            margin: 0 0 10px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .notification-message {
            color: #374151;
            font-size: 16px;
            line-height: 1.5;
            margin: 0;
        }
        .metadata {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .metadata-item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 14px;
        }
        .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .logo {
            text-align: center;
            margin-bottom: 10px;
        }
        .logo img {
            max-width: 220px;
            height: auto;
        }
        .disclaimer {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <img src="cid:logo" alt="CareXPS Logo" style="max-width: 220px; height: auto; margin-bottom: 10px;" />
            </div>
            <h1>CareXPS Healthcare CRM</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">System Notification</p>
        </div>

        <div class="content">
            <div class="notification-box">
                <div class="notification-title">
                    <span>${icon}</span>
                    ${data.title}
                </div>
                <p class="notification-message">${data.message}</p>
            </div>

            <div class="metadata">
                <div class="metadata-item">
                    <span><strong>Time:</strong></span>
                    <span>${data.timestamp.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'long' })}</span>
                </div>
                <div class="metadata-item">
                    <span><strong>Type:</strong></span>
                    <span>${this.getTypeDisplayName(data.type)}</span>
                </div>
                ${data.metadata?.count ? `
                <div class="metadata-item">
                    <span><strong>Count:</strong></span>
                    <span>${data.metadata.count}</span>
                </div>
                ` : ''}
                ${data.metadata?.severity ? `
                <div class="metadata-item">
                    <span><strong>Severity:</strong></span>
                    <span style="color: ${severityColor.text}; font-weight: 600;">${data.metadata.severity.toUpperCase()}</span>
                </div>
                ` : ''}
            </div>
        </div>

        <div class="footer">
            <p><strong>CareXPS Healthcare CRM</strong></p>
            <p>Secure Healthcare Communication Platform</p>

            <div class="disclaimer">
                <p><strong>PRIVACY NOTICE:</strong> This notification contains no Protected Health Information (PHI).
                Only general activity notifications are sent via email to maintain HIPAA compliance.</p>
                <p>© ${new Date().getFullYear()} CareXPS. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `
  }

  /**
   * Get severity color scheme
   */
  private getSeverityColor(severity?: string) {
    switch (severity) {
      case 'critical':
        return { bg: '#fef2f2', border: '#dc2626', text: '#dc2626' }
      case 'high':
        return { bg: '#fff7ed', border: '#ea580c', text: '#ea580c' }
      case 'medium':
        return { bg: '#fffbeb', border: '#d97706', text: '#d97706' }
      case 'low':
        return { bg: '#f0f9ff', border: '#0284c7', text: '#0284c7' }
      default:
        return { bg: '#f0f9ff', border: '#2563eb', text: '#2563eb' }
    }
  }

  /**
   * Get notification type icon
   */
  private getNotificationIcon(type: string): string {
    switch (type) {
      case 'new_sms': return '💬'
      case 'new_call': return '📞'
      case 'security_alert': return '🔒'
      case 'system_alert': return '⚠️'
      default: return '📢'
    }
  }

  /**
   * Get display name for notification type
   */
  private getTypeDisplayName(type: string): string {
    switch (type) {
      case 'new_sms': return 'New SMS Message'
      case 'new_call': return 'New Voice Call'
      case 'security_alert': return 'Security Alert'
      case 'system_alert': return 'System Alert'
      default: return 'Notification'
    }
  }

  /**
   * Update notification configuration (cloud-synced to Supabase with RLS fallback)
   */
  async updateConfiguration(config: EmailNotificationConfig): Promise<void> {
    try {
      const currentUser = localStorage.getItem('currentUser')
      if (!currentUser) throw new Error('No current user found')

      const userData = JSON.parse(currentUser)
      const userId = userData.id

      console.log('📧 Updating email notification config to Supabase for user:', userId)

      // Try to update in Supabase user_settings table
      const { error: upsertError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          email_notifications: config,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (upsertError) {
        // Check if this is an RLS policy error
        if (upsertError.code === '42501' || upsertError.message?.includes('row-level security policy')) {
          console.warn('🔒 EMAIL SETTINGS: RLS policy blocking operation - using localStorage fallback')

          // Update local cache only (graceful fallback)
          const settingsKey = `settings_${userId}`
          const userSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}')
          userSettings.emailNotifications = config
          localStorage.setItem(settingsKey, JSON.stringify(userSettings))

          this.config = config
          console.log('✅ Email notification configuration updated (localStorage fallback)')

          // Trigger settings sync if available
          window.dispatchEvent(new CustomEvent('userSettingsUpdated', {
            detail: { userId, settings: userSettings }
          }))

          return
        } else {
          console.error('❌ Failed to save to Supabase:', upsertError)
          // Still update localStorage even if cloud save fails
          const settingsKey = `settings_${userId}`
          const userSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}')
          userSettings.emailNotifications = config
          localStorage.setItem(settingsKey, JSON.stringify(userSettings))
          this.config = config
          console.log('✅ Email notification configuration updated (localStorage only, cloud failed)')
          return
        }
      }

      // Supabase save successful - update local cache
      const settingsKey = `settings_${userId}`
      const userSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}')
      userSettings.emailNotifications = config
      localStorage.setItem(settingsKey, JSON.stringify(userSettings))

      this.config = config
      console.log('✅ Email notification configuration updated (cloud-synced)')

      // Trigger settings sync if available
      window.dispatchEvent(new CustomEvent('userSettingsUpdated', {
        detail: { userId, settings: userSettings }
      }))

    } catch (error) {
      console.error('❌ Failed to update email notification configuration:', error)

      // Final fallback - still try to save to localStorage
      try {
        const currentUser = localStorage.getItem('currentUser')
        if (currentUser) {
          const userData = JSON.parse(currentUser)
          const settingsKey = `settings_${userData.id}`
          const userSettings = JSON.parse(localStorage.getItem(settingsKey) || '{}')
          userSettings.emailNotifications = config
          localStorage.setItem(settingsKey, JSON.stringify(userSettings))
          this.config = config
          console.log('✅ Email notification configuration updated (localStorage emergency fallback)')
        }
      } catch (fallbackError) {
        console.error('❌ Even localStorage fallback failed:', fallbackError)
        throw new Error('Failed to save email settings anywhere')
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): EmailNotificationConfig | null {
    return this.config
  }

  /**
   * Test email notification
   */
  async testNotification(): Promise<void> {
    const testData: NotificationData = {
      type: 'system_alert',
      title: 'Test Notification',
      message: 'This is a test notification to verify your email configuration is working correctly.',
      timestamp: new Date(),
      metadata: {
        severity: 'low'
      }
    }

    await this.sendNotification(testData)
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationServiceClass()

// Convenience functions for common notifications
export const sendNewSMSNotification = (count: number = 1) => {
  emailNotificationService.sendNotification({
    type: 'new_sms',
    title: count === 1 ? 'New SMS Message' : `${count} New SMS Messages`,
    message: count === 1
      ? 'A new SMS message has been received in your CareXPS CRM.'
      : `${count} new SMS messages have been received in your CareXPS CRM.`,
    timestamp: new Date(),
    metadata: { count }
  })
}

export const sendNewCallNotification = (count: number = 1) => {
  emailNotificationService.sendNotification({
    type: 'new_call',
    title: count === 1 ? 'New Voice Call' : `${count} New Voice Calls`,
    message: count === 1
      ? 'A new voice call has been received in your CareXPS CRM.'
      : `${count} new voice calls have been received in your CareXPS CRM.`,
    timestamp: new Date(),
    metadata: { count }
  })
}

export const sendSecurityAlert = (message: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
  emailNotificationService.sendNotification({
    type: 'security_alert',
    title: 'Security Alert',
    message,
    timestamp: new Date(),
    metadata: { severity }
  })
}

export const sendSystemAlert = (message: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
  emailNotificationService.sendNotification({
    type: 'system_alert',
    title: 'System Alert',
    message,
    timestamp: new Date(),
    metadata: { severity }
  })
}

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  // Initialize on next tick
  setTimeout(() => {
    emailNotificationService.initialize()
  }, 1000)

  // Make available globally for debugging
  ;(window as any).emailNotificationService = emailNotificationService
  ;(window as any).sendTestEmail = () => emailNotificationService.testNotification()
  ;(window as any).sendQuickTestEmail = async (email?: string) => {
    try {
      const testEmail = email || 'test@example.com'

      // Determine email API endpoint based on environment
      const emailApiEndpoint = (() => {
        const prodEmailApi = import.meta.env.VITE_EMAIL_API_URL
        if (prodEmailApi) {
          return `${prodEmailApi}/api/test-email`
        }
        // TEMPORARY: Use localhost while Azure Function is debugged
        // if (window.location.hostname !== 'localhost' &&
        //     window.location.hostname !== '127.0.0.1') {
        //   return '/api/test-email'
        // }
        return 'http://localhost:4001/api/test-email'
      })()

      const response = await fetch(emailApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testEmail })
      })
      const result = await response.json()
      console.log('✅ Test email result:', result)
      return result
    } catch (error) {
      console.error('❌ Test email failed:', error)
      return { error: error.message }
    }
  }

  console.log('📧 EmailNotificationService loaded. Available commands:')
  console.log('  - emailNotificationService.testNotification() - Send test email')
  console.log('  - sendTestEmail() - Quick test function')
  console.log('  - sendQuickTestEmail("your@email.com") - Direct test to any email')
}