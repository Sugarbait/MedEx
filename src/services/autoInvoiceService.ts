/**
 * Auto-Invoice Service
 *
 * Checks if automatic monthly invoices should be generated when user logs in
 * Backup trigger for Supabase Cron (runs on 1st of month)
 */

import { stripeInvoiceService } from './stripeInvoiceService'
import { userSettingsService } from './userSettingsService'
import { AuditService } from './auditService'

interface AutoInvoiceCheckResult {
  shouldGenerate: boolean
  reason: string
  lastRun?: Date
  currentMonth: string
}

class AutoInvoiceService {
  private isChecking = false
  private lastCheckDate: string | null = null

  /**
   * Check if we should generate invoice on login (1st of month)
   * This is a backup to the Supabase Cron job
   */
  public async checkOnLogin(userId: string): Promise<AutoInvoiceCheckResult> {
    try {
      // Prevent concurrent checks
      if (this.isChecking) {
        return {
          shouldGenerate: false,
          reason: 'Check already in progress',
          currentMonth: this.getCurrentMonth()
        }
      }

      this.isChecking = true

      // Check if today is the 1st of the month
      const now = new Date()
      const isFirstOfMonth = now.getDate() === 1

      if (!isFirstOfMonth) {
        return {
          shouldGenerate: false,
          reason: 'Not the 1st of the month',
          currentMonth: this.getCurrentMonth()
        }
      }

      // Check if we already checked today (prevent multiple checks on same day)
      const todayKey = now.toISOString().split('T')[0]
      if (this.lastCheckDate === todayKey) {
        return {
          shouldGenerate: false,
          reason: 'Already checked today',
          currentMonth: this.getCurrentMonth()
        }
      }

      // Get user settings
      const settings = await userSettingsService.getUserSettings(userId)

      if (!settings) {
        return {
          shouldGenerate: false,
          reason: 'User settings not found',
          currentMonth: this.getCurrentMonth()
        }
      }

      // Check if auto-invoice is enabled
      if (!settings.stripe_auto_invoice_enabled) {
        return {
          shouldGenerate: false,
          reason: 'Auto-invoice not enabled',
          currentMonth: this.getCurrentMonth()
        }
      }

      // Check if customer info is configured
      if (!settings.stripe_customer_email || !settings.stripe_customer_name) {
        return {
          shouldGenerate: false,
          reason: 'Customer info not configured',
          currentMonth: this.getCurrentMonth()
        }
      }

      // Check if invoice was already generated this month
      const currentMonth = this.getCurrentMonth()
      const lastRun = settings.stripe_auto_invoice_last_run
        ? new Date(settings.stripe_auto_invoice_last_run)
        : null

      if (lastRun) {
        const lastRunMonth = `${lastRun.getFullYear()}-${String(lastRun.getMonth() + 1).padStart(2, '0')}`
        if (lastRunMonth === currentMonth) {
          return {
            shouldGenerate: false,
            reason: 'Invoice already generated this month',
            lastRun,
            currentMonth
          }
        }
      }

      // All checks passed - we should generate invoice
      this.lastCheckDate = todayKey

      console.log(`✅ Auto-invoice check passed for user ${userId}`)

      return {
        shouldGenerate: true,
        reason: 'Ready to generate invoice',
        lastRun: lastRun || undefined,
        currentMonth
      }

    } catch (error) {
      console.error('Failed to check auto-invoice on login:', error)

      await AuditService.createSecurityEvent({
        action: 'AUTO_INVOICE_CHECK_FAILED',
        resource: 'auto_invoice_service',
        success: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId
        },
        severity: 'medium'
      })

      return {
        shouldGenerate: false,
        reason: error instanceof Error ? error.message : 'Check failed',
        currentMonth: this.getCurrentMonth()
      }
    } finally {
      this.isChecking = false
    }
  }

  /**
   * Generate monthly invoice (called after checkOnLogin)
   * Includes retry logic (up to 3 attempts)
   */
  public async generateMonthlyInvoice(
    userId: string,
    customerEmail: string,
    customerName: string,
    retryCount: number = 0
  ): Promise<{
    success: boolean
    invoiceId?: string
    invoiceUrl?: string
    error?: string
    retries: number
  }> {
    const MAX_RETRIES = 3

    try {
      console.log(`🔄 Generating monthly invoice for ${customerEmail} (attempt ${retryCount + 1}/${MAX_RETRIES})`)

      // Initialize Stripe if not already done
      if (!stripeInvoiceService.isConfigured()) {
        // Try to load API key from settings
        const settings = await userSettingsService.getUserSettings(userId)
        const localSettings = localStorage.getItem(`settings_${userId}`)
        const apiKey = localSettings
          ? JSON.parse(localSettings).stripeSecretKey
          : undefined

        if (apiKey) {
          const initResult = await stripeInvoiceService.initialize(apiKey)
          if (!initResult.success) {
            throw new Error(`Stripe initialization failed: ${initResult.error}`)
          }
        } else {
          throw new Error('Stripe API key not configured')
        }
      }

      // Generate invoice for previous month
      const result = await stripeInvoiceService.generateMonthlyInvoice({
        email: customerEmail,
        name: customerName,
        description: 'CareXPS Healthcare CRM Customer (Auto-Generated)'
      })

      if (result.success) {
        // Update last run timestamp
        await userSettingsService.updateUserSettings(userId, {
          stripe_auto_invoice_last_run: new Date().toISOString()
        })

        // Log success
        await AuditService.logAction(
          'AUTO_INVOICE_GENERATED',
          'stripe_invoice',
          {
            invoiceId: result.invoiceId,
            customerEmail,
            retries: retryCount,
            generatedAutomatically: true
          }
        )

        console.log(`✅ Monthly invoice generated successfully: ${result.invoiceId}`)

        return {
          success: true,
          invoiceId: result.invoiceId,
          invoiceUrl: result.invoiceUrl,
          retries: retryCount
        }
      } else {
        throw new Error(result.error || 'Invoice generation failed')
      }

    } catch (error) {
      console.error(`❌ Failed to generate monthly invoice (attempt ${retryCount + 1}):`, error)

      // Retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`⏳ Retrying in 5 seconds... (${retryCount + 2}/${MAX_RETRIES})`)

        // Wait 5 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 5000))

        // Recursive retry
        return this.generateMonthlyInvoice(userId, customerEmail, customerName, retryCount + 1)
      } else {
        // Max retries exceeded - log failure
        await AuditService.createSecurityEvent({
          action: 'AUTO_INVOICE_GENERATION_FAILED',
          resource: 'stripe_invoice',
          success: false,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            customerEmail,
            retries: retryCount,
            maxRetriesExceeded: true
          },
          severity: 'high'
        })

        console.error(`❌ Max retries (${MAX_RETRIES}) exceeded for monthly invoice generation`)

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Invoice generation failed',
          retries: retryCount
        }
      }
    }
  }

  /**
   * Get current month in YYYY-MM format
   */
  private getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  /**
   * Check if invoice notification should be sent
   * (To be implemented with email notification service)
   */
  public async sendInvoiceNotification(
    userId: string,
    invoiceId: string,
    invoiceUrl: string
  ): Promise<void> {
    try {
      console.log(`📧 Sending invoice notification for ${invoiceId}`)

      // TODO: Integrate with email notification service
      // For now, just log to audit
      await AuditService.logAction(
        'AUTO_INVOICE_NOTIFICATION_SENT',
        'email_notification',
        {
          invoiceId,
          invoiceUrl,
          userId
        }
      )

      console.log(`✅ Invoice notification logged for ${invoiceId}`)
    } catch (error) {
      console.error('Failed to send invoice notification:', error)
      // Don't throw - notification failure shouldn't block invoice generation
    }
  }
}

// Export singleton instance
export const autoInvoiceService = new AutoInvoiceService()
export default autoInvoiceService
