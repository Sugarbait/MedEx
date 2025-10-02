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

interface CombinedSMSCostBreakdown extends TwilioSMSCostBreakdown {
  retellChatCostUSD: number
  retellChatCostCAD: number
  twilioSMSCostUSD: number
  twilioSMSCostCAD: number
  totalCombinedCostUSD: number
  totalCombinedCostCAD: number
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
      return costUSD * 1.45 // Fallback rate
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
   * Fixed: 160 characters per segment (no Unicode special handling)
   */
  /**
   * Calculate SMS segments using Twilio toll-free (800) rules for US/Canada
   * - GSM-7: Single segment ≤160 chars, multi-segment uses 152 chars/segment
   * - UCS-2: Single segment ≤70 chars, multi-segment uses 66 chars/segment
   * - Encoding detection: GSM-7 unless non-GSM character found (then UCS-2)
   */
  private calculateSMSSegments(messageContent: string): number {
    if (!messageContent) return 0

    const contentLength = messageContent.length

    // Detect encoding: Check if content requires UCS-2 (Unicode)
    const requiresUCS2 = this.requiresUCS2Encoding(messageContent)

    if (requiresUCS2) {
      // UCS-2/Unicode encoding (emojis, smart quotes, non-GSM chars)
      if (contentLength <= 70) {
        return 1 // Single segment: up to 70 UCS-2 characters
      } else {
        // Multi-segment: 66 characters per segment for toll-free US/Canada
        return Math.ceil(contentLength / 66)
      }
    } else {
      // GSM-7 encoding (standard ASCII + GSM special chars)
      if (contentLength <= 160) {
        return 1 // Single segment: up to 160 GSM-7 characters
      } else {
        // Multi-segment: 152 characters per segment for toll-free US/Canada
        return Math.ceil(contentLength / 152)
      }
    }
  }

  /**
   * Check if message content requires UCS-2 encoding
   * Returns true if content contains non-GSM-7 characters
   */
  private requiresUCS2Encoding(content: string): boolean {
    // GSM-7 basic character set
    // Includes: A-Z, a-z, 0-9, and GSM special chars
    const gsm7BasicChars = /^[@£$¥èéùìòÇ\n\fØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&'()*+,\-.\/0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\[\\\]\^\{\|\}\~]*$/

    // GSM-7 extended characters (each counts as 2 bytes)
    // For simplicity, if extended chars present, treat as needing special handling
    const hasExtendedChars = /[\f\^{}\\\[\]|~€]/.test(content)

    // If content doesn't match GSM-7 basic pattern, it requires UCS-2
    if (!gsm7BasicChars.test(content)) {
      return true
    }

    // If extended chars present, they reduce capacity but don't force UCS-2
    // For toll-free US/Canada billing, extended chars are still GSM-7
    // (each extended char uses 2 bytes but stays in GSM-7 encoding)

    return false
  }

  /**
   * Parse chat content to exclude role/title indicators, tool invocations, and timestamps
   * Removes "Patient", "AI Assistant", tool calls, timestamps from SMS segment calculations
   * Fixed: Added case-insensitive matching and improved pattern handling
   */
  private parseMessageContent(content: string): string {
    if (!content) return ''

    // Remove role indicators at the start of lines, including the newline if they're on their own line
    // Patterns: "Patient", "AI Assistant", "User", "Agent", etc.
    // Fixed: Added case-insensitive flag (i) and improved whitespace handling
    const rolePatterns = [
      /^Patient(?:\s*\n?)/gmi,      // Case-insensitive
      /^AI Assistant(?:\s*\n?)/gmi, // Case-insensitive
      /^User(?:\s*\n?)/gmi,         // Case-insensitive
      /^Agent(?:\s*\n?)/gmi,        // Case-insensitive
      /^Assistant(?:\s*\n?)/gmi,    // Case-insensitive
      /^Bot(?:\s*\n?)/gmi           // Case-insensitive
    ]

    // Remove tool invocations and tool results (don't count in SMS segments)
    const toolPatterns = [
      /Tool Invocation:.*?(?=\n|$)/gmi,  // Tool Invocation lines
      /Tool Result.*?(?=\n|$)/gmi,       // Tool Result lines
      /🔧.*?(?=\n|$)/gmi,                // Tool emojis with content
      /📋.*?(?=\n|$)/gmi                 // Tool result emojis with content
    ]

    // Remove timestamps (don't count in SMS segments)
    const timestampPatterns = [
      /\d{1,2}:\d{2}:\d{2},\s*\d{1,2}\/\d{1,2}/g,  // SMS format: 11:26:13, 09/23
      /^\d{1,2}:\d{2}$/gm,                          // Call format: 0:00, 0:28
      /\b\d{1,2}:\d{2}\b/g                          // Any MM:SS or HH:MM format
    ]

    let cleanContent = content

    // Remove role indicators
    rolePatterns.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, '')
    })

    // Remove tool invocations and results
    toolPatterns.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, '')
    })

    // Remove timestamps
    timestampPatterns.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, '')
    })

    // Remove empty lines that might be left after removal
    cleanContent = cleanContent.replace(/^\s*$/gm, '').trim()

    return cleanContent
  }

  /**
   * Calculate Twilio SMS cost for messages in a chat
   * @param messages Array of chat messages
   * @returns SMS cost breakdown
   * TWILIO METHOD: Calculate segments per individual message, then sum
   * This matches Twilio's actual billing where each SMS is calculated separately
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

    // TWILIO METHOD: Calculate segments for each message individually, then sum
    // This matches how Twilio actually bills - each SMS message is segmented separately
    // IMPORTANT: Use RAW content as Twilio bills for actual SMS body (no stripping)
    let totalSegments = 0
    for (const message of messages) {
      const rawContent = message.content || ''
      if (rawContent.trim().length > 0) {
        const messageSegments = this.calculateSMSSegments(rawContent)
        totalSegments += messageSegments
      }
    }

    // CRITICAL: Add 4 segments for initial SMS prompt that's always sent but not captured
    // Initial prompt: "Hi from CareXPS. Please reply with: • Full name • Date of birth..."
    // This message is sent to every caller but not stored in chat history
    const INITIAL_PROMPT_SEGMENTS = 4
    totalSegments += INITIAL_PROMPT_SEGMENTS

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
      if (!messages || messages.length === 0) {
        return 0
      }

      const result = this.calculateSMSCost(messages)
      return result.costCAD
    } catch (error) {
      this.handleCurrencyServiceError(error, 'getSMSCostCAD')
      // Return fallback cost calculation using per-message method with raw content
      let totalSegments = 0
      for (const message of messages) {
        const rawContent = message.content || ''
        if (rawContent.trim().length > 0) {
          totalSegments += this.calculateSMSSegments(rawContent)
        }
      }
      // Add initial prompt segments
      totalSegments += 4
      const costUSD = totalSegments * this.SMS_RATE_USD_PER_SEGMENT
      return costUSD * 1.45 // Fallback rate
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
   * Calculate combined cost: Twilio SMS + Retell AI Chat
   * @param messages Array of chat messages
   * @param retellChatCostCents Retell AI chat cost in cents (from chat_cost.combined_cost)
   * @returns Combined cost breakdown
   */
  public calculateCombinedSMSCost(messages: any[], retellChatCostCents: number = 0): CombinedSMSCostBreakdown {
    // Get Twilio SMS cost breakdown
    const twilioBreakdown = this.calculateSMSCost(messages)

    // Convert Retell AI chat cost from cents to USD
    const retellChatCostUSD = retellChatCostCents / 100

    // Convert Retell AI cost to CAD
    const retellChatCostCAD = currencyService.convertUSDToCAD(retellChatCostUSD)

    // Calculate total combined cost
    const totalCombinedCostUSD = twilioBreakdown.costUSD + retellChatCostUSD
    const totalCombinedCostCAD = twilioBreakdown.costCAD + retellChatCostCAD

    return {
      // Twilio breakdown
      messageCount: twilioBreakdown.messageCount,
      segmentCount: twilioBreakdown.segmentCount,
      costUSD: twilioBreakdown.costUSD,
      costCAD: twilioBreakdown.costCAD,
      ratePerSegmentUSD: twilioBreakdown.ratePerSegmentUSD,
      ratePerSegmentCAD: twilioBreakdown.ratePerSegmentCAD,

      // Retell AI breakdown
      retellChatCostUSD: parseFloat(retellChatCostUSD.toFixed(6)),
      retellChatCostCAD: parseFloat(retellChatCostCAD.toFixed(6)),

      // Twilio costs (for clarity)
      twilioSMSCostUSD: twilioBreakdown.costUSD,
      twilioSMSCostCAD: twilioBreakdown.costCAD,

      // Combined total
      totalCombinedCostUSD: parseFloat(totalCombinedCostUSD.toFixed(6)),
      totalCombinedCostCAD: parseFloat(totalCombinedCostCAD.toFixed(6))
    }
  }

  /**
   * Get combined SMS + Retell AI cost (CAD amount only)
   * @param messages Array of chat messages
   * @param retellChatCostCents Retell AI chat cost in cents
   * @returns Total combined cost in CAD
   */
  public getCombinedSMSCostCAD(messages: any[], retellChatCostCents: number = 0): number {
    try {
      const result = this.calculateCombinedSMSCost(messages, retellChatCostCents)
      return result.totalCombinedCostCAD
    } catch (error) {
      this.handleCurrencyServiceError(error, 'getCombinedSMSCostCAD')
      // Fallback calculation
      const twilioSMS = this.getSMSCostCAD(messages)
      const retellCAD = (retellChatCostCents / 100) * 1.45 // Fallback rate
      return twilioSMS + retellCAD
    }
  }

  /**
   * Format combined SMS + Retell AI cost for display
   * @param messages Array of chat messages
   * @param retellChatCostCents Retell AI chat cost in cents
   * @returns Formatted cost string
   */
  public formatCombinedSMSCost(messages: any[], retellChatCostCents: number = 0): string {
    const cost = this.getCombinedSMSCostCAD(messages, retellChatCostCents)
    return `CAD ${cost.toFixed(4)}`
  }

  /**
   * Get detailed combined cost breakdown for debugging/admin use
   * @param messages Array of chat messages
   * @param retellChatCostCents Retell AI chat cost in cents
   * @returns Detailed combined breakdown object
   */
  public getDetailedCombinedBreakdown(messages: any[], retellChatCostCents: number = 0): CombinedSMSCostBreakdown {
    return this.calculateCombinedSMSCost(messages, retellChatCostCents)
  }

  /**
   * Debug method to test SMS calculation with parsed content
   * Shows character count, segments, and cost breakdown
   * Fixed: Now shows both per-message and combined calculation methods
   */
  public debugSMSCalculation(messages: any[]): {
    originalMessages: { content: string; originalLength: number; cleanContent: string; cleanLength: number; segments: number }[]
    totalOriginalChars: number
    totalCleanChars: number
    totalSegments: number
    totalSegmentsCombined: number
    combinedCleanContent: string
    combinedCleanLength: number
    costBreakdown: TwilioSMSCostBreakdown
  } {
    const originalMessages = messages.map(message => {
      const originalContent = message.content || ''
      const cleanContent = this.parseMessageContent(originalContent)
      return {
        content: originalContent,
        originalLength: originalContent.length,
        cleanContent: cleanContent,
        cleanLength: cleanContent.length,
        segments: this.calculateSMSSegments(cleanContent)
      }
    })

    const totalOriginalChars = originalMessages.reduce((sum, msg) => sum + msg.originalLength, 0)
    const totalCleanChars = originalMessages.reduce((sum, msg) => sum + msg.cleanLength, 0)
    const totalSegments = originalMessages.reduce((sum, msg) => sum + msg.segments, 0)

    // Combined approach calculation (new method)
    const combinedCleanContent = messages
      .map(message => this.parseMessageContent(message.content || ''))
      .filter(content => content.trim().length > 0)
      .join(' ')
    const combinedCleanLength = combinedCleanContent.length
    const totalSegmentsCombined = this.calculateSMSSegments(combinedCleanContent)

    const costBreakdown = this.calculateSMSCost(messages)

    return {
      originalMessages,
      totalOriginalChars,
      totalCleanChars,
      totalSegments,
      totalSegmentsCombined,
      combinedCleanContent,
      combinedCleanLength,
      costBreakdown
    }
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
          fallbackRateUsed: 1.45,
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
          impact: 'SMS costs are being calculated using fallback exchange rate (1.45 CAD/USD)',
          actionRequired: 'Check currency service API connectivity and exchange rate updates',
          fallbackRateUsed: 1.45,
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
      fallbackRate: 1.45
    }
  }
}

// Export singleton instance
export const twilioCostService = new TwilioCostService()
export default twilioCostService

// Export types
export type { TwilioCostBreakdown, TwilioSMSCostBreakdown, CombinedSMSCostBreakdown }