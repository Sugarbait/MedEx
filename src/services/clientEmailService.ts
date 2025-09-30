/**
 * Client-Side Email Notification Service
 * Uses EmailJS for browser-based email sending (no backend required)
 *
 * SECURITY NOTE: Safe for client-side use because:
 * - No PHI is sent in emails (notifications only)
 * - EmailJS API keys can be domain-restricted
 * - All emails are non-sensitive event notifications
 *
 * Free Tier: 200 emails/month
 * Setup: https://www.emailjs.com/
 */

import emailjs from '@emailjs/browser'

/**
 * Email notification types
 */
export type NotificationType = 'newSMS' | 'newCall' | 'securityAlert' | 'systemAlert'

/**
 * Email notification data
 */
export interface EmailNotification {
  type: NotificationType
  title: string
  message: string
  timestamp: Date
}

/**
 * EmailJS configuration
 */
interface EmailJSConfig {
  serviceId: string
  templateId: string
  publicKey: string
}

class ClientEmailService {
  private isInitialized = false
  private config: EmailJSConfig | null = null

  /**
   * Initialize EmailJS
   */
  async initialize(): Promise<void> {
    try {
      // Get configuration from environment variables
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

      if (!serviceId || !templateId || !publicKey) {
        console.warn('📧 EmailJS not configured - email notifications disabled', {
          hasServiceId: !!serviceId,
          hasTemplateId: !!templateId,
          hasPublicKey: !!publicKey
        })
        return
      }

      this.config = { serviceId, templateId, publicKey }

      // Initialize EmailJS
      emailjs.init(publicKey)

      this.isInitialized = true
      console.log('✅ Client email service initialized (EmailJS)')
    } catch (error) {
      console.error('❌ Failed to initialize client email service:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Send notification email to recipients
   */
  async sendNotification(
    recipients: string[],
    notification: EmailNotification
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isInitialized || !this.config) {
        console.warn('📧 Email service not initialized - skipping notification')
        return { success: false, error: 'Email service not configured' }
      }

      // Validate recipients
      const validRecipients = recipients.filter(email => this.isValidEmail(email))
      if (validRecipients.length === 0) {
        return { success: false, error: 'No valid recipients' }
      }

      console.log('📧 Sending email notification', {
        type: notification.type,
        recipients: validRecipients.length
      })

      // Send individual email to each recipient (EmailJS limitation)
      let successCount = 0
      let failureCount = 0

      for (const recipient of validRecipients) {
        try {
          // Prepare template parameters for this recipient
          const templateParams = {
            to_email: recipient,
            notification_type: notification.type,
            notification_title: notification.title,
            notification_message: notification.message,
            timestamp: notification.timestamp.toISOString(),
            app_name: 'CareXPS Healthcare CRM',
            app_url: import.meta.env.VITE_APP_URL || 'https://carexps.nexasync.ca'
          }

          // Send email via EmailJS
          await emailjs.send(
            this.config.serviceId,
            this.config.templateId,
            templateParams,
            this.config.publicKey
          )

          successCount++
          console.log(`✅ Email sent to: ${recipient}`)

        } catch (error) {
          failureCount++
          console.error(`❌ Failed to send email to ${recipient}:`, error instanceof Error ? error.message : 'Unknown error')
        }
      }

      console.log('✅ Email notification batch complete', {
        total: validRecipients.length,
        success: successCount,
        failed: failureCount
      })

      return {
        success: successCount > 0,
        error: failureCount > 0 ? `${failureCount} email(s) failed to send` : undefined
      }

    } catch (error) {
      console.error('❌ Failed to send email notification:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: notification.type
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      }
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(recipient: string): Promise<{ success: boolean; error?: string }> {
    const testNotification: EmailNotification = {
      type: 'systemAlert',
      title: 'Email Configuration Test',
      message: 'This is a test email to verify your healthcare CRM email notification system is working correctly.',
      timestamp: new Date()
    }

    return this.sendNotification([recipient], testNotification)
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.isInitialized
  }

  /**
   * Get service status
   */
  getStatus(): {
    available: boolean
    provider: string
    configured: boolean
  } {
    return {
      available: this.isInitialized,
      provider: 'EmailJS (Client-Side)',
      configured: !!this.config
    }
  }
}

// Export singleton instance
export const clientEmailService = new ClientEmailService()

// Auto-initialize on import
clientEmailService.initialize().catch(error => {
  console.error('Failed to initialize client email service:', error)
})

export default clientEmailService