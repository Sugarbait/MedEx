/**
 * Twilio Cost Service for Calls and SMS Pricing
 *
 * Calculates Twilio costs for:
 * - Inbound calls to Canadian 1-800 toll-free numbers: USD $0.022/min
 * - SMS messages (inbound/outbound): USD $0.0083 per segment
 * All costs converted to CAD using currency service.
 */

import { currencyService } from './currencyService'
import { AuditService } from './auditService'

interface TwilioCostBreakdown {
  durationSeconds: number
  durationMinutes: number
  billedMinutes: number
  costUSD: number
  costCAD: number
  ratePerMinuteUSD: number
  ratePerMinuteCAD: number
}

interface TwilioSMSCostBreakdown {
  messageCount: number
  segmentCount: number
  costUSD: number
  costCAD: number
  ratePerSegmentUSD: number
  ratePerSegmentCAD: number
}

class TwilioCostService {
  private currencyServiceErrors: number = 0
  private lastCurrencyErrorTime: Date | null = null
  private readonly MAX_CURRENCY_ERRORS_PER_DAY = 10
  private readonly CURRENCY_ERROR_NOTIFICATION_THRESHOLD_HOURS = 24
  // Twilio inbound rate for Canadian 1-800 toll-free numbers (USD per minute)
  private readonly INBOUND_RATE_USD_PER_MINUTE = 0.022

  // Twilio SMS rates (USD per segment)
  private readonly SMS_RATE_USD_PER_SEGMENT = 0.0083

  /**
   * Calculate Twilio cost for an inbound call
   * @param callLengthSeconds Duration of the call in seconds
   * @returns Cost breakdown including CAD amount
   */
  public calculateInboundCallCost(callLengthSeconds: number): TwilioCostBreakdown {
    if (!callLengthSeconds || callLengthSeconds <= 0) {
      return {
        durationSeconds: 0,
        durationMinutes: 0,
        billedMinutes: 0,
        costUSD: 0,
        costCAD: 0,
        ratePerMinuteUSD: this.INBOUND_RATE_USD_PER_MINUTE,
        ratePerMinuteCAD: currencyService.convertUSDToCAD(this.INBOUND_RATE_USD_PER_MINUTE)
      }
    }

    // Convert seconds to minutes (decimal)
    const durationMinutes = callLengthSeconds / 60

    // Round up to next whole minute for billing (Twilio's billing model)
    const billedMinutes = Math.ceil(durationMinutes)

    // Calculate cost in USD first
    const costUSD = billedMinutes * this.INBOUND_RATE_USD_PER_MINUTE

    // Convert to CAD using currency service
    const costCAD = currencyService.convertUSDToCAD(costUSD)
    const ratePerMinuteCAD = currencyService.convertUSDToCAD(this.INBOUND_RATE_USD_PER_MINUTE)

    return {
      durationSeconds: callLengthSeconds,
      durationMinutes: parseFloat(durationMinutes.toFixed(2)),
      billedMinutes,
      costUSD: parseFloat(costUSD.toFixed(4)),
      costCAD: parseFloat(costCAD.toFixed(4)),
      ratePerMinuteUSD: this.INBOUND_RATE_USD_PER_MINUTE,
      ratePerMinuteCAD: parseFloat(ratePerMinuteCAD.toFixed(4))
    }
  }

  /**
   * Get Twilio cost for a call (CAD amount only)
   * @param callLengthSeconds Duration of the call in seconds
   * @returns Cost in CAD
   */
  public getTwilioCostCAD(callLengthSeconds: number): number {
    try {
      const result = this.calculateInboundCallCost(callLengthSeconds)
      return result.costCAD
    } catch (error) {
      this.handleCurrencyServiceError(error, 'getTwilioCostCAD')
      // Return fallback cost calculation (USD amount * fallback rate)
      const billedMinutes = Math.ceil(callLengthSeconds / 60)
      const costUSD = billedMinutes * this.INBOUND_RATE_USD_PER_MINUTE
      return costUSD * 1.35 // Fallback rate
    }
  }

  /**
   * Get current Twilio rate information
   * @returns Rate info string for display
   */
  public getRateInfo(): string {
    const rateCAD = currencyService.convertUSDToCAD(this.INBOUND_RATE_USD_PER_MINUTE)
    return `Inbound to Canadian 1-800: USD $${this.INBOUND_RATE_USD_PER_MINUTE.toFixed(3)}/min → CAD $${rateCAD.toFixed(3)}/min (rounded up)`
  }

  /**
   * Format Twilio cost for display
   * @param callLengthSeconds Duration of the call in seconds
   * @returns Formatted cost string
   */
  public formatTwilioCost(callLengthSeconds: number): string {
    const cost = this.getTwilioCostCAD(callLengthSeconds)
    return `CAD $${cost.toFixed(3)}`
  }

  /**
   * Get detailed cost breakdown for debugging/admin use
   * @param callLengthSeconds Duration of the call in seconds
   * @returns Detailed breakdown object
   */
  public getDetailedBreakdown(callLengthSeconds: number): TwilioCostBreakdown {
    return this.calculateInboundCallCost(callLengthSeconds)
  }

  /**
   * Calculate SMS message segment count based on message length
   * Standard SMS = 160 chars, with unicode/special chars reducing the limit
   */
  private calculateSMSSegments(messageContent: string): number {
    if (!messageContent) return 0

    // Basic SMS segmentation logic
    // Standard SMS: 160 characters per segment
    // With special characters/unicode: 70 characters per segment
    const hasUnicode = /[^\x00-\x7F]/.test(messageContent)
    const maxCharsPerSegment = hasUnicode ? 70 : 160

    return Math.ceil(messageContent.length / maxCharsPerSegment)
  }

  /**
   * Calculate Twilio SMS cost for messages in a chat
   * @param messages Array of chat messages
   * @returns SMS cost breakdown
   */
  public calculateSMSCost(messages: any[]): TwilioSMSCostBreakdown {
    if (!messages || messages.length === 0) {
      return {
        messageCount: 0,
        segmentCount: 0,
        costUSD: 0,
        costCAD: 0,
        ratePerSegmentUSD: this.SMS_RATE_USD_PER_SEGMENT,
        ratePerSegmentCAD: currencyService.convertUSDToCAD(this.SMS_RATE_USD_PER_SEGMENT)
      }
    }

    // Calculate total segments for all messages
    const totalSegments = messages.reduce((sum, message) => {
      const segments = this.calculateSMSSegments(message.content || '')
      return sum + segments
    }, 0)

    // Calculate cost in USD first
    const costUSD = totalSegments * this.SMS_RATE_USD_PER_SEGMENT

    // Convert to CAD using currency service
    const costCAD = currencyService.convertUSDToCAD(costUSD)
    const ratePerSegmentCAD = currencyService.convertUSDToCAD(this.SMS_RATE_USD_PER_SEGMENT)

    return {
      messageCount: messages.length,
      segmentCount: totalSegments,
      costUSD: parseFloat(costUSD.toFixed(6)),
      costCAD: parseFloat(costCAD.toFixed(6)),
      ratePerSegmentUSD: this.SMS_RATE_USD_PER_SEGMENT,
      ratePerSegmentCAD: parseFloat(ratePerSegmentCAD.toFixed(6))
    }
  }

  /**
   * Get SMS cost for a chat (CAD amount only)
   * @param messages Array of chat messages
   * @returns Cost in CAD
   */
  public getSMSCostCAD(messages: any[]): number {
    try {
      console.log('SMS Cost Calculation:', {
        messageCount: messages?.length || 0,
        messages: messages?.map(m => ({ content: m?.content?.substring(0, 50) + '...', length: m?.content?.length || 0 })) || []
      })

      if (!messages || messages.length === 0) {
        console.log('No messages provided for SMS cost calculation')
        return 0
      }

      const result = this.calculateSMSCost(messages)
      console.log('SMS Cost Result:', result)
      return result.costCAD
    } catch (error) {
      console.error('SMS cost calculation error:', error)
      this.handleCurrencyServiceError(error, 'getSMSCostCAD')
      // Return fallback cost calculation
      const totalSegments = messages.reduce((sum, message) => {
        return sum + this.calculateSMSSegments(message.content || '')
      }, 0)
      const costUSD = totalSegments * this.SMS_RATE_USD_PER_SEGMENT
      const fallbackCost = costUSD * 1.35 // Fallback rate
      console.log('Using fallback SMS cost calculation:', { totalSegments, costUSD, fallbackCost })
      return fallbackCost
    }
  }

  /**
   * Format SMS cost for display
   * @param messages Array of chat messages
   * @returns Formatted cost string
   */
  public formatSMSCost(messages: any[]): string {
    const cost = this.getSMSCostCAD(messages)
    return `CAD ${cost.toFixed(4)}`
  }

  /**
   * Get SMS rate information
   * @returns Rate info string for display
   */
  public getSMSRateInfo(): string {
    const rateCAD = currencyService.convertUSDToCAD(this.SMS_RATE_USD_PER_SEGMENT)
    return `SMS: USD $${this.SMS_RATE_USD_PER_SEGMENT.toFixed(4)}/segment → CAD $${rateCAD.toFixed(4)}/segment`
  }

  /**
   * Get detailed SMS cost breakdown for debugging/admin use
   * @param messages Array of chat messages
   * @returns Detailed breakdown object
   */
  public getDetailedSMSBreakdown(messages: any[]): TwilioSMSCostBreakdown {
    return this.calculateSMSCost(messages)
  }

  /**
   * Handle currency service errors and trigger notifications
   * @param error The error that occurred
   * @param context Context where the error occurred
   */
  private async handleCurrencyServiceError(error: any, context: string): Promise<void> {
    try {
      console.error(`Currency service error in ${context}:`, error)

      this.currencyServiceErrors++
      const now = new Date()

      // Check if this is the first error or if enough time has passed since last error
      if (!this.lastCurrencyErrorTime ||
          (now.getTime() - this.lastCurrencyErrorTime.getTime()) > (this.CURRENCY_ERROR_NOTIFICATION_THRESHOLD_HOURS * 60 * 60 * 1000)) {
        this.lastCurrencyErrorTime = now
        this.currencyServiceErrors = 1 // Reset counter
      }

      // Create security event for currency service error
      await AuditService.createSecurityEvent({
        action: 'CURRENCY_SERVICE_ERROR',
        resource: 'twilio_sms_costs',
        success: false,
        details: {
          context,
          error: error.message || 'Unknown currency service error',
          errorCount: this.currencyServiceErrors,
          fallbackRateUsed: 1.35,
          timestamp: now.toISOString()
        },
        severity: this.shouldTriggerNotification() ? 'high' : 'medium'
      })

      // Trigger notification if threshold exceeded
      if (this.shouldTriggerNotification()) {
        await this.triggerCurrencyServiceNotification()
      }
    } catch (notificationError) {
      console.error('Failed to handle currency service error notification:', notificationError)
    }
  }

  /**
   * Check if we should trigger a notification based on error frequency
   * @returns true if notification should be triggered
   */
  private shouldTriggerNotification(): boolean {
    if (!this.lastCurrencyErrorTime) return false

    const hoursSinceFirstError = (Date.now() - this.lastCurrencyErrorTime.getTime()) / (1000 * 60 * 60)

    // Trigger notification if:
    // 1. More than 24 hours have passed since first error, OR
    // 2. More than 10 errors in the current period
    return hoursSinceFirstError >= this.CURRENCY_ERROR_NOTIFICATION_THRESHOLD_HOURS ||
           this.currencyServiceErrors >= this.MAX_CURRENCY_ERRORS_PER_DAY
  }

  /**
   * Trigger notification for currency service issues
   */
  private async triggerCurrencyServiceNotification(): Promise<void> {
    try {
      await AuditService.createSecurityEvent({
        action: 'CURRENCY_SERVICE_NOTIFICATION_TRIGGERED',
        resource: 'notifications',
        success: true,
        details: {
          errorCount: this.currencyServiceErrors,
          timeWindow: `${this.CURRENCY_ERROR_NOTIFICATION_THRESHOLD_HOURS} hours`,
          impact: 'SMS costs are being calculated using fallback exchange rate (1.35 CAD/USD)',
          actionRequired: 'Check currency service API connectivity and exchange rate updates',
          fallbackRateUsed: 1.35,
          lastErrorTime: this.lastCurrencyErrorTime?.toISOString()
        },
        severity: 'critical'
      })

      console.warn('🚨 CURRENCY SERVICE ALERT: SMS cost calculations are using fallback rate due to currency service errors')
      console.warn(`Error count: ${this.currencyServiceErrors} errors in last ${this.CURRENCY_ERROR_NOTIFICATION_THRESHOLD_HOURS} hours`)
      console.warn('Action required: Check currency service API connectivity')

    } catch (error) {
      console.error('Failed to trigger currency service notification:', error)
    }
  }

  /**
   * Get currency service health status
   * @returns Health status information
   */
  public getCurrencyServiceHealthStatus(): {
    isHealthy: boolean
    errorCount: number
    lastErrorTime: Date | null
    usingFallbackRate: boolean
    fallbackRate: number
  } {
    const isHealthy = this.currencyServiceErrors === 0 ||
                     (this.lastCurrencyErrorTime &&
                      (Date.now() - this.lastCurrencyErrorTime.getTime()) > (24 * 60 * 60 * 1000))

    return {
      isHealthy,
      errorCount: this.currencyServiceErrors,
      lastErrorTime: this.lastCurrencyErrorTime,
      usingFallbackRate: !isHealthy,
      fallbackRate: 1.35
    }
  }
}

// Export singleton instance
export const twilioCostService = new TwilioCostService()
export default twilioCostService

// Export types
export type { TwilioCostBreakdown, TwilioSMSCostBreakdown }