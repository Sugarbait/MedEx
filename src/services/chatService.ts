/**
 * Comprehensive Retell AI Chat Service
 *
 * Handles all chat-related operations including fetching, filtering, creating,
 * and managing Retell AI Chat data. Follows the same patterns as the existing
 * callService and integrates with the existing configuration system.
 */

import { retellService } from './retellService'

// ============================================================================
// TypeScript Interfaces for Chat Data Structures
// ============================================================================

export interface Chat {
  chat_id: string
  agent_id: string
  chat_status: 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp?: number
  transcript: string
  message_with_tool_calls: ChatMessage[]
  collected_dynamic_variables: Record<string, any>
  retell_llm_dynamic_variables: Record<string, any>
  chat_analysis: {
    chat_summary: string
    user_sentiment: string
    chat_successful: boolean
    custom_analysis_data: Record<string, any>
  }
  chat_cost: {
    product_costs: Record<string, number>
    total_cost: number
  }
  metadata?: Record<string, any>
}

export interface ChatMessage {
  message_id: string
  role: 'agent' | 'user'
  content: string
  created_timestamp: number
  tool_calls?: ToolCall[]
  metadata?: Record<string, any>
}

export interface ToolCall {
  id: string
  type: string
  function?: {
    name: string
    arguments: string
  }
}

export interface ChatFilters {
  agent_id?: string
  chat_status?: 'ongoing' | 'ended' | 'error'
  user_sentiment?: string
  chat_successful?: boolean
  start_timestamp?: {
    gte?: number
    lte?: number
  }
  end_timestamp?: {
    gte?: number
    lte?: number
  }
  phone_number?: string
  patient_id?: string
}

export interface ChatListOptions {
  filter_criteria?: ChatFilters
  sort_order?: 'ascending' | 'descending'
  limit?: number
  pagination_key?: string
  skipFilters?: boolean
}

export interface ChatListResponse {
  chats: Chat[]
  pagination_key?: string
  has_more: boolean
}

export interface CreateChatData {
  agent_id: string
  phone_number?: string
  customer_phone_number?: string
  customer_name?: string
  initial_message?: string
  metadata?: Record<string, any>
  retell_llm_dynamic_variables?: Record<string, any>
}

export interface CreateChatResponse {
  success: boolean
  chat_id?: string
  error?: string
  access_token?: string
}

export interface ChatStats {
  totalChats: number
  activeChats: number
  completedChats: number
  errorChats: number
  avgDuration: string
  totalCost: number
  avgCostPerChat: number
  successRate: number
  positiveSentimentCount: number
  totalMessages: number
  avgMessagesPerChat: number
}

export interface ChatAnalytics {
  today: ChatStats
  thisWeek: ChatStats
  thisMonth: ChatStats
  trends: Array<{
    date: string
    chatCount: number
    avgDuration: number
    totalCost: number
    successRate: number
  }>
  sentimentDistribution: {
    positive: number
    negative: number
    neutral: number
  }
  peakHours: Array<{
    hour: number
    chatCount: number
  }>
}

// ============================================================================
// Mock Data for Demo/Local Mode
// ============================================================================

// Mock data removed - using real API data only

// ============================================================================
// Chat Service Implementation
// ============================================================================

export class ChatService {
  private baseUrl = 'https://api.retellai.com'
  private apiKey: string = ''
  private smsAgentId: string = ''
  private isDemoMode: boolean = false
  private lastRequestTime: number = 0
  private minRequestInterval: number = 1000 // 1 second between requests (more reasonable)
  private chatCache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheExpiry: number = 60000 // 1 minute cache for better performance
  private requestQueue: Promise<any>[] = [] // Queue to handle concurrent requests

  constructor() {
    this.loadCredentials()
  }

  /**
   * Reload credentials (public method for external calls)
   */
  public reloadCredentials(): void {
    this.loadCredentials()
  }

  /**
   * Load API credentials from localStorage
   */
  private loadCredentials(): void {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.error('Chat Service: Browser environment not available, cannot load credentials')
      this.isDemoMode = true
      return
    }

    try {
      // Try to get current user's settings
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      console.log('Chat Service: Loading credentials for user:', currentUser.id)

      if (currentUser.id) {
        const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
        this.apiKey = settings.retellApiKey || ''
        this.smsAgentId = settings.smsAgentId || ''

        console.log('Chat Service: Credentials loaded:', {
          hasApiKey: !!this.apiKey,
          apiKeyLength: this.apiKey.length,
          smsAgentId: this.smsAgentId,
          isDemoMode: !this.apiKey
        })

        // Disable demo mode - always try real API
        this.isDemoMode = false
      } else {
        console.error('Chat Service: No current user found in localStorage')
        this.isDemoMode = false // Still try real API
      }
    } catch (error) {
      console.error('Chat Service: Failed to load credentials from localStorage:', error)
      this.isDemoMode = false // Still try real API
    }
  }


  /**
   * Get authorization headers for API requests
   */
  private getHeaders(): HeadersInit {
    if (!this.apiKey) {
      this.loadCredentials()
    }

    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CareXPS-CRM/1.0 (Retell-AI-Client)',
      'Accept': 'application/json'
    }
  }

  /**
   * Rate limiting helper to prevent 429 errors
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest
      console.log(`Rate limiting: waiting ${waitTime}ms before next request`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now()
    for (const [key, value] of this.chatCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.chatCache.delete(key)
      }
    }
  }

  /**
   * Check if we have cached data for a request
   */
  private getCachedData(cacheKey: string): any | null {
    this.clearExpiredCache() // Clean up expired entries
    const cached = this.chatCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      console.log(`Using cached data for: ${cacheKey}`)
      return cached.data
    }
    return null
  }

  /**
   * Cache data for future requests
   */
  private setCachedData(cacheKey: string, data: any): void {
    this.chatCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    })
  }

  /**
   * Make API request with retry logic for rate limiting
   */
  private async makeApiRequest(url: string, options: RequestInit = {}, retries: number = 3): Promise<Response> {
    await this.respectRateLimit()

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options)

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000

          console.log(`Rate limited (429). Attempt ${attempt}/${retries}. Waiting ${waitTime}ms before retry...`)

          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }

        // Handle other common HTTP errors
        if (response.status === 403) {
          console.error('API request forbidden (403). Check API key and permissions.')
          throw new Error('API access forbidden. Please check your API key and permissions.')
        }

        if (response.status === 401) {
          console.error('API request unauthorized (401). Invalid API key.')
          throw new Error('Invalid API key. Please check your Retell AI API credentials.')
        }

        return response
      } catch (error) {
        console.error(`API request attempt ${attempt} failed:`, error)
        if (attempt === retries) throw error

        const waitTime = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    throw new Error('Max retries exceeded')
  }

  /**
   * Check if API credentials are configured
   */
  public isConfigured(): boolean {
    const configured = !!this.apiKey // Only require API key, not SMS agent ID
    console.log('Chat Service: isConfigured check:', {
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey?.length || 0,
      hasSmsAgentId: !!this.smsAgentId,
      smsAgentId: this.smsAgentId,
      isDemoMode: this.isDemoMode,
      configured: configured
    })
    return configured
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    if (this.isDemoMode) {
      return { success: true, message: 'Demo mode - using mock data' }
    }

    try {
      if (!this.apiKey) {
        return { success: false, message: 'API key not configured' }
      }

      const response = await this.makeApiRequest(`${this.baseUrl}/list-chat?limit=10`, {
        method: 'GET',
        headers: this.getHeaders()
      })

      if (response.ok) {
        return { success: true, message: 'Connection successful' }
      } else if (response.status === 401) {
        return { success: false, message: 'Invalid API key' }
      } else {
        return { success: false, message: `API error: ${response.status}` }
      }
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }

  /**
   * Get all chats with optional filtering and pagination
   */
  public async getAllChats(filters?: ChatFilters): Promise<Chat[]> {
    // Demo mode disabled - always use real API
    // if (this.isDemoMode) {
    //   return []
    // }

    const allChats: Chat[] = []
    let paginationKey: string | undefined = undefined
    let hasMore = true
    let pageCount = 0

    console.log(`Fetching all chats for agent: ${this.smsAgentId}`)

    while (hasMore && pageCount < 10) { // Safety limit to prevent infinite loops
      pageCount++
      const response = await this.getChatHistory({
        limit: 1000, // Use maximum limit
        pagination_key: paginationKey,
        filter_criteria: filters || (this.smsAgentId ? {
          agent_id: this.smsAgentId
        } : undefined)
      })

      allChats.push(...response.chats)
      paginationKey = response.pagination_key
      hasMore = response.has_more && !!paginationKey

      console.log(`Page ${pageCount}: Fetched ${response.chats.length} chats (total so far: ${allChats.length}, has_more: ${response.has_more})`)

      if (!response.has_more || !paginationKey) {
        hasMore = false
      }
    }

    console.log(`Final result: ${allChats.length} total chats fetched in ${pageCount} pages`)
    return allChats
  }

  /**
   * Get chat history with filtering and pagination
   */
  public async getChatHistory(options: ChatListOptions = {}): Promise<ChatListResponse> {
    // Demo mode disabled - always use real API
    // if (this.isDemoMode) {
    //   return { chats: [], pagination_key: undefined, has_more: false }
    // }

    // Create cache key based on options
    const cacheKey = `chat_history_${JSON.stringify(options)}`
    const cachedData = this.getCachedData(cacheKey)
    if (cachedData) {
      return cachedData
    }

    try {
      if (!this.apiKey) {
        console.error('Chat Service: API key not configured for getChatHistory')
        throw new Error('Retell API key not configured - check Settings → API Configuration')
      }

      console.log('Chat Service: Making getChatHistory request with options:', options)

      // Use the correct API endpoint based on retellService.ts implementation
      // Only use the GET /list-chat endpoint which is the working one
      const endpoints = [
        { url: `${this.baseUrl}/list-chat`, method: 'GET' as const }
      ]

      let response: Response | null = null
      let lastError: Error | null = null

      // Try each endpoint configuration
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i]
        console.log(`Trying endpoint ${i + 1}/${endpoints.length}: ${endpoint.method} ${endpoint.url}`)

        try {
          // Only GET method is supported for chat API
          const queryParams = new URLSearchParams()

          if (options.limit) {
            queryParams.append('limit', options.limit.toString())
          }

          if (options.pagination_key) {
            queryParams.append('pagination_key', options.pagination_key)
          }

          if (options.sort_order) {
            queryParams.append('sort_order', options.sort_order)
          }

          // Add agent ID filter if available
          if (this.smsAgentId && !options.filter_criteria?.agent_id && !options.skipFilters) {
            queryParams.append('agent_id', this.smsAgentId)
            console.log(`[ChatService] Adding agent_id filter to GET request: ${this.smsAgentId}`)
          }

          const url = `${endpoint.url}${queryParams.toString() ? '?' + queryParams.toString() : ''}`
          console.log('Chat API Request URL:', url)

          response = await this.makeApiRequest(url, {
            method: 'GET',
            headers: this.getHeaders()
          })

          // If request was successful, break out of the loop
          if (response.ok) {
            console.log(`Successfully connected using endpoint ${i + 1}: ${endpoint.method} ${endpoint.url}`)
            break
          } else {
            console.log(`Endpoint ${i + 1} failed with status: ${response.status}`)
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
            response = null
          }
        } catch (error) {
          console.error(`Endpoint ${i + 1} threw error:`, error)
          lastError = error instanceof Error ? error : new Error('Unknown error')
          response = null
        }
      }

      // If all endpoints failed, throw the last error
      if (!response || !response.ok) {
        console.error('All chat API endpoints failed')
        if (lastError) {
          throw lastError
        } else {
          throw new Error('All chat API endpoints failed')
        }
      }


      const data = await response.json()
      console.log('Raw chat API response structure:', {
        type: typeof data,
        isArray: Array.isArray(data),
        keys: data && typeof data === 'object' ? Object.keys(data) : null,
        dataLength: Array.isArray(data) ? data.length : (data?.chats?.length || data?.data?.length || 'unknown')
      })

      // Handle different response structures based on Retell AI API documentation
      let chats: Chat[] = []
      let pagination_key: string | undefined = undefined
      let has_more = false

      if (Array.isArray(data)) {
        // Direct array response
        chats = data
        has_more = data.length >= (options.limit || 50)
        console.log('Response format: Direct array with', chats.length, 'chats')
      } else if (data && typeof data === 'object') {
        // Object response with chats array (most common format)
        chats = data.chats || data.data || data.results || []
        pagination_key = data.pagination_key || data.next_page_token || data.nextPageToken
        has_more = data.has_more !== undefined ? data.has_more : !!pagination_key
        console.log('Response format: Object wrapper with', chats.length, 'chats, has_more:', has_more)
      } else {
        console.warn('Unexpected response format:', data)
        chats = []
      }

      // Apply client-side filtering if needed (for reliability)
      if (options.filter_criteria && !options.skipFilters) {
        const originalCount = chats.length
        chats = this.applyClientSideFilters(chats, options.filter_criteria)
        console.log(`[ChatService] Client-side filtering: ${originalCount} -> ${chats.length} chats`)

        // Log specific filtering applied
        if (options.filter_criteria.agent_id) {
          const agentFilteredCount = chats.filter(chat => chat.agent_id === options.filter_criteria?.agent_id).length
          console.log(`[ChatService] Agent filter (${options.filter_criteria.agent_id}): ${agentFilteredCount}/${chats.length} chats match`)
        }
      }

      console.log(`[ChatService] Final Chat API Response: ${chats.length} chats fetched, has_more=${has_more}`)

      // Log agent distribution for debugging
      const agentDistribution: Record<string, number> = {}
      chats.forEach(chat => {
        agentDistribution[chat.agent_id] = (agentDistribution[chat.agent_id] || 0) + 1
      })
      console.log(`[ChatService] Agent distribution:`, agentDistribution)

      const result = {
        chats,
        pagination_key,
        has_more
      }

      // Cache the result
      this.setCachedData(cacheKey, result)

      return result
    } catch (error) {
      console.error('[ChatService] Error fetching chat history:', error)

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        } else if (error.message.includes('403')) {
          throw new Error('API access forbidden. Please check your API key permissions.')
        } else if (error.message.includes('401')) {
          throw new Error('Invalid API key. Please update your Retell AI credentials.')
        } else if (error.message.includes('404')) {
          throw new Error('API endpoint not found. This may indicate an API version issue.')
        }
      }

      throw error
    }
  }

  /**
   * Get a specific chat by ID
   */
  public async getChatById(chatId: string): Promise<Chat> {
    // Demo mode disabled - always use real API
    // if (this.isDemoMode) {
    //   throw new Error(`Chat not found: ${chatId}`)
    // }

    try {
      if (!this.apiKey) {
        throw new Error('Retell API key not configured')
      }

      // Check cache first for individual chat requests
      const cacheKey = `chat_${chatId}`
      const cachedChat = this.getCachedData(cacheKey)
      if (cachedChat) {
        return cachedChat
      }

      const response = await this.makeApiRequest(`${this.baseUrl}/get-chat/${chatId}`, {
        method: 'GET',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch chat: ${response.status} ${response.statusText}`)
      }

      const chatData = await response.json()

      // Cache the individual chat data
      this.setCachedData(cacheKey, chatData)

      return chatData
    } catch (error) {
      console.error('Error fetching chat:', error)
      throw error
    }
  }

  /**
   * Get chats filtered by date range
   */
  public async getChatsByDateRange(startDate: Date, endDate: Date, options: ChatListOptions = {}): Promise<ChatListResponse> {
    const dateFilter: ChatFilters = {
      start_timestamp: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      }
    }

    // Merge date filter with existing filter_criteria
    const mergedFilters: ChatFilters = {
      ...options.filter_criteria,
      ...dateFilter
    }

    return this.getChatHistory({
      ...options,
      filter_criteria: mergedFilters
    })
  }

  /**
   * Create a new SMS chat
   */
  public async createSMSChat(data: CreateChatData): Promise<CreateChatResponse> {
    if (this.isDemoMode) {
      // Return mock response for demo mode
      return {
        success: true,
        chat_id: `chat_demo_${Date.now()}`,
        access_token: 'demo_token_123'
      }
    }

    try {
      if (!this.apiKey) {
        throw new Error('Retell API key not configured')
      }

      const response = await fetch(`${this.baseUrl}/create-sms-chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText} - ${errorText}`
        }
      }

      const result = await response.json()
      return {
        success: true,
        chat_id: result.chat_id,
        access_token: result.access_token
      }
    } catch (error) {
      console.error('Error creating SMS chat:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * End an ongoing chat
   */
  public async endChat(chatId: string): Promise<{ success: boolean; error?: string }> {
    if (this.isDemoMode) {
      // Return mock response for demo mode
      return { success: true }
    }

    try {
      if (!this.apiKey) {
        throw new Error('Retell API key not configured')
      }

      const response = await fetch(`${this.baseUrl}/end-chat/${chatId}`, {
        method: 'PUT',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText} - ${errorText}`
        }
      }

      return { success: true }
    } catch (error) {
      console.error('Error ending chat:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Calculate comprehensive chat statistics
   */
  public getChatStats(chats: Chat[]): ChatStats {
    const totalChats = chats.length
    const activeChats = chats.filter(chat => chat.chat_status === 'ongoing')
    const completedChats = chats.filter(chat => chat.chat_status === 'ended')
    const errorChats = chats.filter(chat => chat.chat_status === 'error')

    const totalDuration = completedChats.reduce((sum, chat) => {
      if (chat.start_timestamp && chat.end_timestamp) {
        return sum + (chat.end_timestamp - chat.start_timestamp)
      }
      return sum
    }, 0)

    const avgDuration = completedChats.length > 0 ? totalDuration / completedChats.length : 0

    const totalCost = chats.reduce((sum, chat) => {
      return sum + (chat.chat_cost?.total_cost || 0)
    }, 0)

    const avgCostPerChat = totalChats > 0 ? totalCost : 0

    const successfulChats = chats.filter(chat => chat.chat_analysis?.chat_successful === true)
    const successRate = totalChats > 0 ? (successfulChats.length / totalChats) * 100 : 0

    const positiveSentimentCount = chats.filter(chat =>
      chat.chat_analysis?.user_sentiment === 'positive'
    ).length

    const totalMessages = chats.reduce((sum, chat) => {
      return sum + (chat.message_with_tool_calls?.length || 0)
    }, 0)

    const avgMessagesPerChat = totalChats > 0 ? totalMessages / totalChats : 0

    return {
      totalChats,
      activeChats: activeChats.length,
      completedChats: completedChats.length,
      errorChats: errorChats.length,
      avgDuration: this.formatDuration(avgDuration),
      totalCost,
      avgCostPerChat,
      successRate,
      positiveSentimentCount,
      totalMessages,
      avgMessagesPerChat
    }
  }

  /**
   * Get comprehensive chat analytics
   */
  public async getChatAnalytics(filters?: ChatFilters): Promise<ChatAnalytics> {
    const allChats = await this.getAllChats(filters)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const todayChats = allChats.filter(chat => {
      const chatDate = new Date(chat.start_timestamp * 1000)
      return chatDate >= todayStart
    })

    const weekChats = allChats.filter(chat => {
      const chatDate = new Date(chat.start_timestamp * 1000)
      return chatDate >= weekStart
    })

    const monthChats = allChats.filter(chat => {
      const chatDate = new Date(chat.start_timestamp * 1000)
      return chatDate >= monthStart
    })

    // Calculate sentiment distribution
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
    allChats.forEach(chat => {
      const sentiment = chat.chat_analysis?.user_sentiment || 'neutral'
      if (sentiment in sentimentCounts) {
        sentimentCounts[sentiment as keyof typeof sentimentCounts]++
      }
    })

    // Calculate peak hours
    const hourCounts: Record<number, number> = {}
    allChats.forEach(chat => {
      const hour = new Date(chat.start_timestamp * 1000).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), chatCount: count }))
      .sort((a, b) => b.chatCount - a.chatCount)
      .slice(0, 5)

    return {
      today: this.getChatStats(todayChats),
      thisWeek: this.getChatStats(weekChats),
      thisMonth: this.getChatStats(monthChats),
      trends: this.calculateTrends(allChats),
      sentimentDistribution: sentimentCounts,
      peakHours
    }
  }

  /**
   * Update credentials (call this when settings are changed)
   */
  public updateCredentials(apiKey?: string, smsAgentId?: string): void {
    if (apiKey !== undefined) {
      this.apiKey = apiKey
      this.isDemoMode = !apiKey
    }
    if (smsAgentId !== undefined) this.smsAgentId = smsAgentId
  }

  /**
   * Mock data removed - no longer supported
   */
  private getMockChats(filters?: ChatFilters): Chat[] {
    console.warn('getMockChats called but mock data has been removed')
    return []
  }

  /**
   * Format duration from seconds to readable format
   */
  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0s'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }

  /**
   * Apply client-side filters for reliability (when API filtering is not working)
   */
  private applyClientSideFilters(chats: Chat[], filters: ChatFilters): Chat[] {
    return chats.filter(chat => {
      // Agent ID filter
      if (filters.agent_id && chat.agent_id !== filters.agent_id) {
        return false
      }

      // Chat status filter
      if (filters.chat_status && chat.chat_status !== filters.chat_status) {
        return false
      }

      // User sentiment filter
      if (filters.user_sentiment && chat.chat_analysis?.user_sentiment !== filters.user_sentiment) {
        return false
      }

      // Chat successful filter
      if (filters.chat_successful !== undefined && chat.chat_analysis?.chat_successful !== filters.chat_successful) {
        return false
      }

      // Start timestamp filter
      if (filters.start_timestamp) {
        const chatTime = chat.start_timestamp
        if (filters.start_timestamp.gte && chatTime < filters.start_timestamp.gte) {
          return false
        }
        if (filters.start_timestamp.lte && chatTime > filters.start_timestamp.lte) {
          return false
        }
      }

      // End timestamp filter
      if (filters.end_timestamp && chat.end_timestamp) {
        const chatEndTime = chat.end_timestamp
        if (filters.end_timestamp.gte && chatEndTime < filters.end_timestamp.gte) {
          return false
        }
        if (filters.end_timestamp.lte && chatEndTime > filters.end_timestamp.lte) {
          return false
        }
      }

      // Phone number filter (check multiple possible fields)
      if (filters.phone_number) {
        const phoneFields = [
          chat.metadata?.phone_number,
          chat.metadata?.customer_phone_number,
          chat.metadata?.from_phone_number,
          chat.metadata?.to_phone_number,
          chat.collected_dynamic_variables?.phone_number,
          chat.collected_dynamic_variables?.customer_phone_number
        ]
        const hasMatchingPhone = phoneFields.some(phone =>
          phone && phone.toString().includes(filters.phone_number!)
        )
        if (!hasMatchingPhone) {
          return false
        }
      }

      // Patient ID filter
      if (filters.patient_id) {
        const patientIdFields = [
          chat.metadata?.patient_id,
          chat.metadata?.customer_id,
          chat.collected_dynamic_variables?.patient_id,
          chat.collected_dynamic_variables?.customer_id
        ]
        const hasMatchingPatientId = patientIdFields.some(id =>
          id && id.toString().includes(filters.patient_id!)
        )
        if (!hasMatchingPatientId) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Calculate trends for analytics
   */
  private calculateTrends(chats: Chat[]): Array<{
    date: string
    chatCount: number
    avgDuration: number
    totalCost: number
    successRate: number
  }> {
    const trends: Record<string, {
      chats: Chat[]
      date: string
    }> = {}

    // Group chats by date
    chats.forEach(chat => {
      const date = new Date(chat.start_timestamp * 1000).toISOString().split('T')[0]
      if (!trends[date]) {
        trends[date] = { chats: [], date }
      }
      trends[date].chats.push(chat)
    })

    // Calculate metrics for each date
    return Object.values(trends).map(({ chats, date }) => {
      const stats = this.getChatStats(chats)
      return {
        date,
        chatCount: stats.totalChats,
        avgDuration: parseFloat(stats.avgDuration.replace(/[^\d.]/g, '')) || 0,
        totalCost: stats.totalCost,
        successRate: stats.successRate
      }
    }).sort((a, b) => a.date.localeCompare(b.date))
  }
}

// Create and export singleton instance
export const chatService = new ChatService()