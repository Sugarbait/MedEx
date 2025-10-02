/**
 * Twilio API Service
 *
 * Fetches actual SMS and voice data directly from Twilio API for accurate cost calculations.
 * Provides real segment counts, call durations, and costs that match billing exactly.
 *
 * Features:
 * - Fetch SMS message details with actual segment counts
 * - Fetch call details with actual duration and costs
 * - Automatic retry with exponential backoff
 * - Caching to reduce API calls
 * - HIPAA-compliant error logging (no PHI in logs)
 */

import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'

interface TwilioMessage {
  sid: string
  from: string
  to: string
  body: string
  status: string
  num_segments: string // Twilio returns as string
  price: string | null // Twilio returns as string
  price_unit: string
  direction: string
  date_created: string
  date_sent: string | null
  error_code: string | null
  error_message: string | null
  num_media: string
}

interface TwilioCall {
  sid: string
  from: string
  to: string
  status: string
  duration: string // Twilio returns as string (seconds)
  price: string | null // Twilio returns as string
  price_unit: string
  direction: string
  start_time: string
  end_time: string | null
  answered_by: string | null
}

interface TwilioApiResponse<T> {
  messages?: T[]
  calls?: T[]
  uri: string
  first_page_uri: string
  next_page_uri: string | null
  previous_page_uri: string | null
  page: number
  page_size: number
}

class TwilioApiService {
  private accountSid: string = ''
  private authToken: string = ''
  private baseUrl: string = ''
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheExpiry: number = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.initialize()
  }

  private initialize() {
    try {
      this.accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID || ''
      this.authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN || ''

      if (!this.accountSid || !this.authToken) {
        console.warn('📞 Twilio API credentials not configured - cost data will be unavailable')
        return
      }

      this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`
      console.log('📞 Twilio API service initialized successfully')
    } catch (error) {
      console.error('📞 Failed to initialize Twilio API service:', error)
    }
  }

  /**
   * Check if Twilio API is configured and ready
   */
  public isConfigured(): boolean {
    return !!(this.accountSid && this.authToken)
  }

  /**
   * Get cached data if available and not expired
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const isExpired = Date.now() - cached.timestamp > this.cacheExpiry
    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  /**
   * Set cache data
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  /**
   * Make authenticated request to Twilio API
   */
  private async makeRequest<T>(endpoint: string, retries: number = 3): Promise<T | null> {
    if (!this.isConfigured()) {
      console.warn('📞 Twilio API not configured - cannot fetch data')
      return null
    }

    const url = `${this.baseUrl}${endpoint}`

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(`${this.accountSid}:${this.authToken}`),
            'Accept': 'application/json',
          },
        })

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - wait and retry
            const waitTime = Math.pow(2, attempt) * 1000
            console.warn(`📞 Twilio API rate limit - waiting ${waitTime}ms before retry`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }

          if (response.status === 401) {
            console.error('📞 Twilio API authentication failed - check credentials')

            await auditLogger.logAuditEvent({
              action: AuditAction.SYSTEM_ACCESS,
              resourceType: ResourceType.SYSTEM,
              resourceId: 'twilio-api',
              outcome: AuditOutcome.FAILURE,
              details: 'Twilio API authentication failed',
              phiAccessed: false,
              additionalInfo: { endpoint: endpoint.split('?')[0] } // Remove query params
            })

            return null
          }

          throw new Error(`Twilio API error: ${response.status} ${response.statusText}`)
        }

        const data: T = await response.json()
        return data

      } catch (error) {
        if (attempt === retries) {
          console.error(`📞 Twilio API request failed after ${retries} attempts:`, error)

          await auditLogger.logAuditEvent({
            action: AuditAction.SYSTEM_ACCESS,
            resourceType: ResourceType.SYSTEM,
            resourceId: 'twilio-api',
            outcome: AuditOutcome.FAILURE,
            details: 'Twilio API request failed',
            phiAccessed: false,
            additionalInfo: {
              endpoint: endpoint.split('?')[0],
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })

          return null
        }

        // Wait before retry
        const waitTime = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    return null
  }

  /**
   * Fetch SMS message details by SID
   * Returns actual segment count and price from Twilio
   */
  public async getMessageDetails(messageSid: string): Promise<{
    segments: number
    price: number
    priceUnit: string
    status: string
  } | null> {
    try {
      // Check cache first
      const cacheKey = `msg:${messageSid}`
      const cached = this.getCached<ReturnType<typeof this.getMessageDetails>>(cacheKey)
      if (cached) return cached

      const data = await this.makeRequest<TwilioMessage>(`/Messages/${messageSid}.json`)
      if (!data) return null

      const result = {
        segments: parseInt(data.num_segments) || 1,
        price: Math.abs(parseFloat(data.price || '0')),
        priceUnit: data.price_unit || 'USD',
        status: data.status
      }

      this.setCache(cacheKey, result)
      return result

    } catch (error) {
      console.error('📞 Error fetching message details:', error)
      return null
    }
  }

  /**
   * Query messages by phone number and date range
   * Returns all matching messages with actual segments and costs
   */
  public async queryMessagesByPhone(params: {
    phoneNumber: string
    startDate?: Date
    endDate?: Date
    direction?: 'inbound' | 'outbound'
  }): Promise<{
    sid: string
    from: string
    to: string
    body: string
    segments: number
    price: number
    priceUnit: string
    status: string
    dateSent: string
    direction: string
  }[]> {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams()

      // Add phone number filter (check both To and From)
      if (params.direction === 'inbound') {
        queryParams.append('From', params.phoneNumber)
      } else if (params.direction === 'outbound') {
        queryParams.append('To', params.phoneNumber)
      } else {
        // Query both directions separately and merge
        const inbound = await this.queryMessagesByPhone({ ...params, direction: 'inbound' })
        const outbound = await this.queryMessagesByPhone({ ...params, direction: 'outbound' })
        return [...inbound, ...outbound].sort((a, b) =>
          new Date(a.dateSent).getTime() - new Date(b.dateSent).getTime()
        )
      }

      // Add date filters if provided
      if (params.startDate) {
        queryParams.append('DateSent>', params.startDate.toISOString().split('T')[0])
      }
      if (params.endDate) {
        queryParams.append('DateSent<', params.endDate.toISOString().split('T')[0])
      }

      // Fetch from Twilio API
      const endpoint = `/Messages.json?${queryParams.toString()}`
      console.log('📞 Twilio API request:', {
        endpoint,
        phoneNumber: params.phoneNumber,
        direction: params.direction,
        startDate: params.startDate?.toISOString(),
        endDate: params.endDate?.toISOString()
      })

      const response = await this.makeRequest<TwilioApiResponse<TwilioMessage>>(endpoint)

      console.log('📞 Twilio API response:', {
        hasResponse: !!response,
        hasMessages: !!response?.messages,
        messageCount: response?.messages?.length || 0
      })

      if (!response || !response.messages) {
        console.log('📞 No response or no messages from Twilio API')
        return []
      }

      // Transform to simplified format
      return response.messages.map(msg => ({
        sid: msg.sid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        segments: parseInt(msg.num_segments) || 1,
        price: Math.abs(parseFloat(msg.price || '0')),
        priceUnit: msg.price_unit || 'USD',
        status: msg.status,
        dateSent: msg.date_sent,
        direction: msg.direction
      }))

    } catch (error) {
      console.error('📞 Error querying messages by phone:', error)
      return []
    }
  }

  /**
   * Get total cost for all messages in a conversation
   */
  public async getConversationCost(params: {
    phoneNumber: string
    startDate?: Date
    endDate?: Date
  }): Promise<{
    totalMessages: number
    totalSegments: number
    totalCostUSD: number
    messages: any[]
  }> {
    const messages = await this.queryMessagesByPhone(params)

    const totalSegments = messages.reduce((sum, msg) => sum + msg.segments, 0)
    const totalCostUSD = messages.reduce((sum, msg) => sum + msg.price, 0)

    return {
      totalMessages: messages.length,
      totalSegments,
      totalCostUSD,
      messages
    }
  }

  /**
   * Fetch call details by SID
   * Returns actual duration and price from Twilio
   */
  public async getCallDetails(callSid: string): Promise<{
    duration: number
    price: number
    priceUnit: string
    status: string
  } | null> {
    try {
      // Check cache first
      const cacheKey = `call:${callSid}`
      const cached = this.getCached<ReturnType<typeof this.getCallDetails>>(cacheKey)
      if (cached) return cached

      const data = await this.makeRequest<TwilioCall>(`/Calls/${callSid}.json`)
      if (!data) return null

      const result = {
        duration: parseInt(data.duration) || 0,
        price: Math.abs(parseFloat(data.price || '0')),
        priceUnit: data.price_unit || 'USD',
        status: data.status
      }

      this.setCache(cacheKey, result)
      return result

    } catch (error) {
      console.error('📞 Error fetching call details:', error)
      return null
    }
  }

  /**
   * Fetch multiple messages at once (batch operation)
   */
  public async getMultipleMessages(messageSids: string[]): Promise<Map<string, {
    segments: number
    price: number
    priceUnit: string
    status: string
  }>> {
    const results = new Map()

    // Process in parallel with limit to avoid rate limiting
    const chunkSize = 5
    for (let i = 0; i < messageSids.length; i += chunkSize) {
      const chunk = messageSids.slice(i, i + chunkSize)
      const promises = chunk.map(sid => this.getMessageDetails(sid))
      const chunkResults = await Promise.all(promises)

      chunkResults.forEach((result, index) => {
        if (result) {
          results.set(chunk[index], result)
        }
      })

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < messageSids.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * Fetch multiple calls at once (batch operation)
   */
  public async getMultipleCalls(callSids: string[]): Promise<Map<string, {
    duration: number
    price: number
    priceUnit: string
    status: string
  }>> {
    const results = new Map()

    // Process in parallel with limit to avoid rate limiting
    const chunkSize = 5
    for (let i = 0; i < callSids.length; i += chunkSize) {
      const chunk = callSids.slice(i, i + chunkSize)
      const promises = chunk.map(sid => this.getCallDetails(sid))
      const chunkResults = await Promise.all(promises)

      chunkResults.forEach((result, index) => {
        if (result) {
          results.set(chunk[index], result)
        }
      })

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < callSids.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * Clear cache manually (for debugging/testing)
   */
  public clearCache(): void {
    this.cache.clear()
    console.log('📞 Twilio API cache cleared')
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Export singleton instance
export const twilioApiService = new TwilioApiService()
export default twilioApiService
