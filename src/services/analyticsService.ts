/**
 * Analytics Service for Chatbot Historical Data Access
 *
 * CRITICAL SECURITY: This service provides ONLY aggregated, anonymized statistics.
 * NO PHI (Protected Health Information) or personally identifiable data is exposed.
 * All data is sanitized and aggregated to prevent any patient identification.
 */

import { retellService, chatService, currencyService, twilioCostService } from '@/services'
import { getDateRangeFromSelection } from '@/components/common/DateRangePicker'

export interface AnalyticsData {
  // Call Analytics - Aggregated Only
  calls: {
    totalCalls: number
    avgDuration: string
    totalDuration: string
    avgCostCAD: number
    totalCostCAD: number
    successRate: number
    peakHours: { hour: number, count: number }[]
    dailyDistribution: { day: string, count: number }[]
    durationRanges: { range: string, count: number }[]
  }

  // SMS Analytics - Aggregated Only
  sms: {
    totalConversations: number
    totalSegments: number
    avgSegmentsPerChat: number
    totalCostCAD: number
    avgCostPerConversation: number
    peakHours: { hour: number, count: number }[]
    dailyDistribution: { day: string, count: number }[]
  }

  // System Analytics - General Only
  system: {
    dataRange: string
    totalInteractions: number
    avgResponseTime: string
    systemUptime: string
  }
}

class AnalyticsService {
  private static instance: AnalyticsService
  private cachedData: AnalyticsData | null = null
  private cacheExpiry: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService()
    }
    return AnalyticsService.instance
  }

  /**
   * Get aggregated analytics data (anonymized and PHI-safe)
   */
  async getAnalytics(dateRange: string = 'last7days'): Promise<AnalyticsData> {
    // Return cached data if still valid
    if (this.cachedData && Date.now() < this.cacheExpiry) {
      return this.cachedData
    }

    try {
      console.log('🔍 Analytics Service: Fetching aggregated data (NO PHI)')

      // Get date range for analysis
      const { start, end } = this.getDateRangeForAnalytics(dateRange)

      // Fetch anonymized call data
      const callsData = await this.getCallAnalytics(start, end)

      // Fetch anonymized SMS data
      const smsData = await this.getSMSAnalytics(start, end)

      // Compile system data
      const systemData = this.getSystemAnalytics(start, end)

      const analytics: AnalyticsData = {
        calls: callsData,
        sms: smsData,
        system: systemData
      }

      // Cache the results
      this.cachedData = analytics
      this.cacheExpiry = Date.now() + this.CACHE_DURATION

      console.log('✅ Analytics Service: Data compiled successfully')
      return analytics

    } catch (error) {
      console.error('Analytics Service Error:', error)
      return this.getEmptyAnalytics()
    }
  }

  /**
   * Get anonymized call analytics
   */
  private async getCallAnalytics(start: Date, end: Date) {
    try {
      // Reload credentials and check configuration
      await retellService.loadCredentialsAsync()
      if (!retellService.isConfigured()) {
        return this.getEmptyCallAnalytics()
      }

      // Get all calls and filter by date range
      const allCalls = await retellService.getAllCalls()
      const startMs = start.getTime()
      const endMs = end.getTime()

      const filteredCalls = allCalls.filter(call => {
        const timestampStr = call.start_timestamp.toString()
        let callTimeMs: number

        if (timestampStr.length <= 10) {
          callTimeMs = call.start_timestamp * 1000
        } else {
          callTimeMs = call.start_timestamp
        }

        return callTimeMs >= startMs && callTimeMs <= endMs
      })

      // Calculate aggregated metrics (NO individual call details)
      const metrics = retellService.calculateCallMetrics(filteredCalls)

      // Add Twilio costs
      const totalTwilioCostCAD = filteredCalls.reduce((sum, call) => {
        return sum + twilioCostService.getTwilioCostCAD(call.call_length_seconds || 0)
      }, 0)

      const baseTotalCostCAD = currencyService.convertUSDToCAD(metrics.totalCost)
      const totalCostCAD = baseTotalCostCAD + totalTwilioCostCAD
      const avgCostCAD = filteredCalls.length > 0 ? totalCostCAD / filteredCalls.length : 0

      // Calculate time-based patterns (anonymized)
      const peakHours = this.calculatePeakHours(filteredCalls)
      const dailyDistribution = this.calculateDailyDistribution(filteredCalls)
      const durationRanges = this.calculateDurationRanges(filteredCalls)

      return {
        totalCalls: metrics.totalCalls,
        avgDuration: metrics.avgDuration,
        totalDuration: metrics.totalDuration,
        avgCostCAD: avgCostCAD,
        totalCostCAD: totalCostCAD,
        successRate: metrics.successRate,
        peakHours,
        dailyDistribution,
        durationRanges
      }

    } catch (error) {
      console.error('Call analytics error:', error)
      return this.getEmptyCallAnalytics()
    }
  }

  /**
   * Get anonymized SMS analytics
   */
  private async getSMSAnalytics(start: Date, end: Date) {
    try {
      // Reload credentials
      chatService.reloadCredentials()

      const allChatsResponse = await chatService.getChatHistory({ limit: 500 })
      const startMs = start.getTime()
      const endMs = end.getTime()

      const filteredChats = allChatsResponse.chats.filter(chat => {
        const timestampStr = chat.start_timestamp.toString()
        let chatTimeMs: number

        if (timestampStr.length <= 10) {
          chatTimeMs = chat.start_timestamp * 1000
        } else {
          chatTimeMs = chat.start_timestamp
        }

        return chatTimeMs >= startMs && chatTimeMs <= endMs
      })

      // Calculate aggregated SMS metrics
      const stats = chatService.getChatStats(filteredChats)

      // Calculate segments and costs (aggregated only)
      let totalSegments = 0
      let totalCost = 0

      for (const chat of filteredChats) {
        try {
          const messages = chat.message_with_tool_calls || []
          const segments = twilioCostService.calculateSMSSegments(messages)
          const cost = twilioCostService.getSMSCostCAD(messages)

          totalSegments += segments
          totalCost += cost
        } catch (error) {
          // Skip chat if there's an error calculating
          continue
        }
      }

      // Calculate time-based patterns for SMS
      const peakHours = this.calculatePeakHours(filteredChats, 'sms')
      const dailyDistribution = this.calculateDailyDistribution(filteredChats, 'sms')

      return {
        totalConversations: filteredChats.length,
        totalSegments,
        avgSegmentsPerChat: filteredChats.length > 0 ? totalSegments / filteredChats.length : 0,
        totalCostCAD: totalCost,
        avgCostPerConversation: filteredChats.length > 0 ? totalCost / filteredChats.length : 0,
        peakHours,
        dailyDistribution
      }

    } catch (error) {
      console.error('SMS analytics error:', error)
      return this.getEmptySMSAnalytics()
    }
  }

  /**
   * Calculate peak hours from timestamps (anonymized aggregation)
   */
  private calculatePeakHours(data: any[], type: 'calls' | 'sms' = 'calls') {
    const hourCounts = new Array(24).fill(0)

    data.forEach(item => {
      try {
        const timestampStr = item.start_timestamp.toString()
        let timeMs: number

        if (timestampStr.length <= 10) {
          timeMs = item.start_timestamp * 1000
        } else {
          timeMs = item.start_timestamp
        }

        const date = new Date(timeMs)
        const hour = date.getHours()
        hourCounts[hour]++
      } catch (error) {
        // Skip invalid timestamps
      }
    })

    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 peak hours
  }

  /**
   * Calculate daily distribution (anonymized aggregation)
   */
  private calculateDailyDistribution(data: any[], type: 'calls' | 'sms' = 'calls') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayCounts = new Array(7).fill(0)

    data.forEach(item => {
      try {
        const timestampStr = item.start_timestamp.toString()
        let timeMs: number

        if (timestampStr.length <= 10) {
          timeMs = item.start_timestamp * 1000
        } else {
          timeMs = item.start_timestamp
        }

        const date = new Date(timeMs)
        const dayOfWeek = date.getDay()
        dayCounts[dayOfWeek]++
      } catch (error) {
        // Skip invalid timestamps
      }
    })

    return dayCounts
      .map((count, index) => ({ day: dayNames[index], count }))
      .filter(item => item.count > 0)
  }

  /**
   * Calculate call duration ranges (anonymized aggregation)
   */
  private calculateDurationRanges(calls: any[]) {
    const ranges = [
      { range: 'Under 1 minute', min: 0, max: 60, count: 0 },
      { range: '1-3 minutes', min: 60, max: 180, count: 0 },
      { range: '3-5 minutes', min: 180, max: 300, count: 0 },
      { range: '5-10 minutes', min: 300, max: 600, count: 0 },
      { range: 'Over 10 minutes', min: 600, max: Infinity, count: 0 }
    ]

    calls.forEach(call => {
      const duration = call.call_length_seconds || 0
      const range = ranges.find(r => duration >= r.min && duration < r.max)
      if (range) {
        range.count++
      }
    })

    return ranges
      .filter(range => range.count > 0)
      .map(({ range, count }) => ({ range, count }))
  }

  /**
   * Get date range for analytics
   */
  private getDateRangeForAnalytics(dateRange: string) {
    switch (dateRange) {
      case 'today':
        return getDateRangeFromSelection('today')
      case 'yesterday':
        return getDateRangeFromSelection('yesterday')
      case 'last7days':
        return getDateRangeFromSelection('last7days')
      case 'last30days':
        return getDateRangeFromSelection('last30days')
      case 'thismonth':
        return getDateRangeFromSelection('thismonth')
      default:
        return getDateRangeFromSelection('last7days')
    }
  }

  /**
   * Get system analytics (general information only)
   */
  private getSystemAnalytics(start: Date, end: Date) {
    return {
      dataRange: `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      totalInteractions: 0, // This would be calculated from combined calls + SMS
      avgResponseTime: '< 1 second',
      systemUptime: '99.9%'
    }
  }

  // Empty analytics fallbacks
  private getEmptyAnalytics(): AnalyticsData {
    return {
      calls: this.getEmptyCallAnalytics(),
      sms: this.getEmptySMSAnalytics(),
      system: {
        dataRange: 'No data available',
        totalInteractions: 0,
        avgResponseTime: 'N/A',
        systemUptime: 'N/A'
      }
    }
  }

  private getEmptyCallAnalytics() {
    return {
      totalCalls: 0,
      avgDuration: '0:00',
      totalDuration: '0:00',
      avgCostCAD: 0,
      totalCostCAD: 0,
      successRate: 0,
      peakHours: [],
      dailyDistribution: [],
      durationRanges: []
    }
  }

  private getEmptySMSAnalytics() {
    return {
      totalConversations: 0,
      totalSegments: 0,
      avgSegmentsPerChat: 0,
      totalCostCAD: 0,
      avgCostPerConversation: 0,
      peakHours: [],
      dailyDistribution: []
    }
  }

  /**
   * Clear cache to force fresh data fetch
   */
  clearCache() {
    this.cachedData = null
    this.cacheExpiry = 0
  }

  /**
   * Get natural language summary of analytics for chatbot
   */
  async getNaturalLanguageSummary(question: string): Promise<string> {
    const analytics = await this.getAnalytics()

    // Generate natural language responses based on the question
    const lowerQuestion = question.toLowerCase()

    if (lowerQuestion.includes('peak hour') || lowerQuestion.includes('busy time') || lowerQuestion.includes('most call')) {
      return this.formatPeakHoursResponse(analytics)
    }

    if (lowerQuestion.includes('daily') || lowerQuestion.includes('day of week') || lowerQuestion.includes('busiest day')) {
      return this.formatDailyDistributionResponse(analytics)
    }

    if (lowerQuestion.includes('cost') || lowerQuestion.includes('spend') || lowerQuestion.includes('expense')) {
      return this.formatCostResponse(analytics)
    }

    if (lowerQuestion.includes('duration') || lowerQuestion.includes('long') || lowerQuestion.includes('average call')) {
      return this.formatDurationResponse(analytics)
    }

    if (lowerQuestion.includes('sms') || lowerQuestion.includes('message') || lowerQuestion.includes('text')) {
      return this.formatSMSResponse(analytics)
    }

    // General overview
    return this.formatGeneralOverview(analytics)
  }

  private formatPeakHoursResponse(analytics: AnalyticsData): string {
    const { calls, sms } = analytics

    if (calls.peakHours.length === 0) {
      return "I don't have enough call data to determine peak hours yet. Once you have more calls, I'll be able to analyze the busiest times for you."
    }

    const topHour = calls.peakHours[0]
    const timeStr = this.formatHour(topHour.hour)

    let response = `**Peak Activity Analysis**\n\n`
    response += `Based on your recent call data, the busiest time is **${timeStr}** with ${topHour.count} calls. `

    if (calls.peakHours.length > 1) {
      response += `Other busy periods include:\n\n`
      calls.peakHours.slice(1, 3).forEach(hour => {
        response += `• **${this.formatHour(hour.hour)}** - ${hour.count} calls\n`
      })
    }

    response += `\nThis information can help you plan staffing and prepare for high-volume periods.`

    return response
  }

  private formatDailyDistributionResponse(analytics: AnalyticsData): string {
    const { calls } = analytics

    if (calls.dailyDistribution.length === 0) {
      return "I need more call data to analyze daily patterns. Keep using the system and I'll be able to show you which days are busiest!"
    }

    const sortedDays = calls.dailyDistribution.sort((a, b) => b.count - a.count)
    const busiestDay = sortedDays[0]

    let response = `**Daily Activity Patterns**\n\n`
    response += `Your busiest day of the week is **${busiestDay.day}** with ${busiestDay.count} calls. `

    if (sortedDays.length > 1) {
      response += `Here's the breakdown for all active days:\n\n`
      sortedDays.forEach(day => {
        response += `• **${day.day}**: ${day.count} calls\n`
      })
    }

    response += `\nUnderstanding these patterns helps optimize your schedule and resource allocation.`

    return response
  }

  private formatCostResponse(analytics: AnalyticsData): string {
    const { calls, sms } = analytics
    const totalCost = calls.totalCostCAD + sms.totalCostCAD

    let response = `**Cost Analysis Summary**\n\n`

    if (totalCost === 0) {
      return "No cost data is available yet. Once you start making calls and sending messages, I'll be able to provide detailed cost breakdowns."
    }

    response += `**Total Communication Costs: CAD $${totalCost.toFixed(2)}**\n\n`

    if (calls.totalCostCAD > 0) {
      response += `**Call Costs:**\n`
      response += `• Total: CAD $${calls.totalCostCAD.toFixed(2)}\n`
      response += `• Average per call: CAD $${calls.avgCostCAD.toFixed(3)}\n`
      response += `• Total calls: ${calls.totalCalls}\n\n`
    }

    if (sms.totalCostCAD > 0) {
      response += `**SMS Costs:**\n`
      response += `• Total: CAD $${sms.totalCostCAD.toFixed(2)}\n`
      response += `• Average per conversation: CAD $${sms.avgCostPerConversation.toFixed(3)}\n`
      response += `• Total conversations: ${sms.totalConversations}\n\n`
    }

    response += `These costs include both platform fees and carrier charges for comprehensive tracking.`

    return response
  }

  private formatDurationResponse(analytics: AnalyticsData): string {
    const { calls } = analytics

    if (calls.totalCalls === 0) {
      return "No call duration data is available yet. Once you start making calls, I'll provide detailed duration analysis."
    }

    let response = `**Call Duration Analysis**\n\n`
    response += `**Average call duration: ${calls.avgDuration}**\n`
    response += `**Total talk time: ${calls.totalDuration}**\n`
    response += `**Total calls analyzed: ${calls.totalCalls}**\n\n`

    if (calls.durationRanges.length > 0) {
      response += `**Duration Distribution:**\n\n`
      calls.durationRanges.forEach(range => {
        response += `• **${range.range}**: ${range.count} calls\n`
      })
    }

    response += `\nThis helps understand conversation patterns and can guide training or process improvements.`

    return response
  }

  private formatSMSResponse(analytics: AnalyticsData): string {
    const { sms } = analytics

    if (sms.totalConversations === 0) {
      return "No SMS data is available yet. Start using the messaging features and I'll provide detailed analytics!"
    }

    let response = `**SMS Communication Summary**\n\n`
    response += `**Total conversations: ${sms.totalConversations}**\n`
    response += `**Total message segments: ${sms.totalSegments}**\n`
    response += `**Average segments per conversation: ${sms.avgSegmentsPerChat.toFixed(1)}**\n`
    response += `**Total SMS costs: CAD $${sms.totalCostCAD.toFixed(2)}**\n\n`

    if (sms.peakHours.length > 0) {
      const topHour = sms.peakHours[0]
      response += `**Peak messaging time: ${this.formatHour(topHour.hour)}** with ${topHour.count} conversations\n\n`
    }

    response += `Message segments are charged based on length - longer messages are automatically split into multiple segments.`

    return response
  }

  private formatGeneralOverview(analytics: AnalyticsData): string {
    const { calls, sms, system } = analytics
    const totalCost = calls.totalCostCAD + sms.totalCostCAD
    const totalInteractions = calls.totalCalls + sms.totalConversations

    let response = `**CareXPS Platform Analytics Overview**\n\n`
    response += `**Data Period:** ${system.dataRange}\n\n`

    if (totalInteractions === 0) {
      return response + "No activity data is available yet. Start using the platform's call and messaging features to see detailed analytics and insights!"
    }

    response += `**Activity Summary:**\n`
    response += `• Total interactions: ${totalInteractions}\n`

    if (calls.totalCalls > 0) {
      response += `• Calls made: ${calls.totalCalls}\n`
      response += `• Total talk time: ${calls.totalDuration}\n`
    }

    if (sms.totalConversations > 0) {
      response += `• SMS conversations: ${sms.totalConversations}\n`
      response += `• Message segments: ${sms.totalSegments}\n`
    }

    if (totalCost > 0) {
      response += `\n**Cost Summary:**\n`
      response += `• Total communication costs: CAD $${totalCost.toFixed(2)}\n\n`
    }

    response += `I can provide more specific insights about peak hours, daily patterns, costs, and usage trends. Just ask me questions like "What time are most calls made?" or "What are my SMS costs?"`

    return response
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:00 ${period}`
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance()
export default analyticsService