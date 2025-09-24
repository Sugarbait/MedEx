/**
 * Retell AI API Service
 *
 * Handles all API interactions with Retell AI for fetching call history,
 * SMS/chat history, and managing voice/messaging services.
 *
 * API Documentation: https://docs.retellai.com/
 */

export interface RetellCall {
  call_id: string
  agent_id: string
  call_type: 'web_call' | 'phone_call'
  call_status: 'registered' | 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp?: number
  duration_ms?: number
  transcript?: string
  recording_url?: string
  call_analysis?: {
    call_summary?: string
    user_sentiment?: 'positive' | 'negative' | 'neutral'
    call_successful?: boolean
    custom_analysis_data?: any
  }
  call_cost?: {
    product_costs: Array<{
      product: string
      unit_price: number
      cost: number
    }>
    combined_cost: number
  }
  metadata?: any
  disconnection_reason?: string
  retell_llm_dynamic_variables?: any
  collected_dynamic_variables?: any
  from_number?: string
  to_number?: string
}

export interface RetellChat {
  chat_id: string
  agent_id: string
  chat_status: 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp?: number
  transcript?: string
  message_with_tool_calls: Array<{
    message_id: string
    role: 'agent' | 'user'
    content: string
    created_timestamp: number
  }>
  chat_analysis?: {
    chat_summary?: string
    user_sentiment?: string
    chat_successful?: boolean
    custom_analysis_data?: any
  }
  chat_cost?: {
    product_costs: Array<{
      product: string
      unit_price: number
      cost: number
    }>
    combined_cost: number
  }
  metadata?: any
  retell_llm_dynamic_variables?: any
  collected_dynamic_variables?: any
}

export interface CallListFilters {
  agent_id?: string
  call_status?: 'registered' | 'ongoing' | 'ended' | 'error'
  call_type?: 'web_call' | 'phone_call'
  direction?: 'inbound' | 'outbound'
  user_sentiment?: 'positive' | 'negative' | 'neutral'
  call_successful?: boolean
  start_timestamp?: {
    gte?: number
    lte?: number
  }
}

export interface CallListOptions {
  filter_criteria?: CallListFilters
  sort_order?: 'ascending' | 'descending'
  limit?: number
  pagination_key?: string
  skipFilters?: boolean
}

export interface CallListResponse {
  calls: RetellCall[]
  pagination_key?: string
  has_more: boolean
}

export interface ChatListResponse {
  chats: RetellChat[]
  pagination_key?: string
  has_more: boolean
}

export class RetellService {
  private baseUrl = 'https://api.retellai.com'
  private apiKey: string = ''
  private callAgentId: string = ''
  private smsAgentId: string = ''

  constructor() {
    // Load credentials from localStorage first (primary/reliable method)
    this.loadCredentials()

    // Then try to sync from Supabase in the background (for cross-device)
    this.syncFromSupabase().catch(error => {
      console.warn('Background Supabase sync failed (this is non-critical):', error)
    })
  }

  /**
   * Sync credentials from Supabase to localStorage (non-critical background operation)
   */
  private async syncFromSupabase(): Promise<void> {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (!currentUser.id) {
        console.log('No user logged in, skipping Supabase sync')
        return
      }

      const { UserSettingsService } = await import('./userSettingsService')
      const response = await UserSettingsService.getUserSettingsWithCache(currentUser.id)

      if (response.status === 'success' && response.data?.retell_config) {
        const retellConfig = response.data.retell_config
        const supabaseApiKey = retellConfig.api_key || ''
        const supabaseCallAgentId = retellConfig.call_agent_id || ''
        const supabaseSmsAgentId = retellConfig.sms_agent_id || ''

        // Check if user has manually set API key recently (within last 5 minutes)
        const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
        const manualKeyTimestamp = settings.retellApiKeyLastUpdated || 0
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
        const hasRecentManualKey = manualKeyTimestamp > fiveMinutesAgo

        // Check if we should sync from Supabase
        if (hasRecentManualKey) {
          console.log('🔒 Skipping Supabase sync - API key was manually set recently. Manual key protected for', Math.round((manualKeyTimestamp - fiveMinutesAgo) / 1000 / 60), 'more minutes')
        } else if (supabaseApiKey && (supabaseApiKey !== this.apiKey ||
            supabaseCallAgentId !== this.callAgentId ||
            supabaseSmsAgentId !== this.smsAgentId)) {

          console.log('Syncing newer credentials from Supabase to localStorage (no recent manual override)')

          // Update localStorage to match Supabase
          if (supabaseApiKey) settings.retellApiKey = supabaseApiKey
          if (supabaseCallAgentId) settings.callAgentId = supabaseCallAgentId
          if (supabaseSmsAgentId) settings.smsAgentId = supabaseSmsAgentId
          localStorage.setItem(`settings_${currentUser.id}`, JSON.stringify(settings))

          // Update current instance
          if (supabaseApiKey) this.apiKey = supabaseApiKey
          if (supabaseCallAgentId) this.callAgentId = supabaseCallAgentId
          if (supabaseSmsAgentId) this.smsAgentId = supabaseSmsAgentId

          console.log('Successfully synced credentials from Supabase')
        } else {
          console.log('No newer credentials found in Supabase, keeping current settings')
        }
      }
    } catch (error) {
      console.warn('Supabase sync failed (non-critical):', error)
    }
  }

  /**
   * Save credentials to both localStorage and Supabase
   */
  public async saveCredentials(apiKey: string, callAgentId: string, smsAgentId: string): Promise<void> {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (!currentUser.id) {
        throw new Error('No user logged in')
      }

      // Save to localStorage first (primary storage)
      const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
      settings.retellApiKey = apiKey
      settings.callAgentId = callAgentId
      settings.smsAgentId = smsAgentId

      // Mark when API key was manually updated to prevent automatic overwrites
      if (apiKey && apiKey !== settings.retellApiKey) {
        settings.retellApiKeyLastUpdated = Date.now()
        console.log('🔒 API key manually updated - preventing auto-overwrites for 5 minutes')
      }

      localStorage.setItem(`settings_${currentUser.id}`, JSON.stringify(settings))

      // Update current instance
      this.apiKey = apiKey
      this.callAgentId = callAgentId
      this.smsAgentId = smsAgentId

      console.log('Credentials saved to localStorage')

      // Try to save to Supabase (for cross-device sync)
      try {
        const { UserSettingsService } = await import('./userSettingsService')
        await UserSettingsService.updateUserSettings(currentUser.id, {
          retell_config: {
            api_key: apiKey,
            call_agent_id: callAgentId,
            sms_agent_id: smsAgentId
          }
        })
        console.log('Credentials also saved to Supabase for cross-device sync')
      } catch (supabaseError) {
        console.warn('Failed to save to Supabase (credentials still saved locally):', supabaseError)
      }
    } catch (error) {
      console.error('Failed to save credentials:', error)
      throw error
    }
  }

  /**
   * Load API credentials from Supabase (with localStorage fallback)
   * Can be called manually to reload credentials after login
   */
  public async loadCredentialsAsync(): Promise<void> {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (currentUser.id) {
        try {
          // Import UserSettingsService dynamically to avoid circular dependencies
          const { UserSettingsService } = await import('./userSettingsService')
          const response = await UserSettingsService.getUserSettingsWithCache(currentUser.id)

          if (response.status === 'success' && response.data?.retell_config) {
            const retellConfig = response.data.retell_config
            this.apiKey = retellConfig.api_key || ''
            this.callAgentId = retellConfig.call_agent_id || ''
            this.smsAgentId = retellConfig.sms_agent_id || ''

            if (this.apiKey || this.callAgentId || this.smsAgentId) {
              console.log('Loaded Retell credentials from Supabase:', {
                hasApiKey: !!this.apiKey,
                callAgentId: this.callAgentId,
                smsAgentId: this.smsAgentId
              })
            }
            return
          }
        } catch (supabaseError) {
          console.warn('Failed to load Retell credentials from Supabase, falling back to localStorage:', supabaseError)
        }

        // Fallback to localStorage
        this.loadCredentialsFromLocalStorage()
      }
    } catch (error) {
      console.error('Error loading Retell credentials:', error)
      // Final fallback to localStorage
      this.loadCredentialsFromLocalStorage()
    }
  }

  /**
   * Load API credentials from localStorage (legacy/fallback method)
   * Can be called manually to reload credentials after login
   */
  public loadCredentials(): void {
    this.loadCredentialsFromLocalStorage()
  }

  /**
   * Internal method to load credentials from localStorage
   */
  private loadCredentialsFromLocalStorage(): void {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (currentUser.id) {
        const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
        this.apiKey = settings.retellApiKey || ''
        this.callAgentId = settings.callAgentId || ''
        this.smsAgentId = settings.smsAgentId || ''

        if (this.apiKey || this.callAgentId || this.smsAgentId) {
          console.log('Loaded Retell credentials from localStorage:', {
            hasApiKey: !!this.apiKey,
            callAgentId: this.callAgentId,
            smsAgentId: this.smsAgentId
          })
        }
      }
    } catch (error) {
      console.error('Error loading credentials from localStorage:', error)
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
      'User-Agent': 'CareXPS-CRM/1.0.0'
    }
  }

  /**
   * Check if API credentials are configured
   */
  public isConfigured(): boolean {
    return !!(this.apiKey && (this.callAgentId || this.smsAgentId))
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Testing API connection with:', {
        baseUrl: this.baseUrl,
        hasApiKey: !!this.apiKey,
        apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 20) + '...' : 'none'
      })

      if (!this.apiKey) {
        return { success: false, message: 'API key not configured' }
      }

      // Try with proper request body format according to docs
      const requestBody = {
        limit: 1,
        sort_order: "descending"
      }

      console.log('Request body:', requestBody)
      console.log('Headers:', this.getHeaders())

      const response = await fetch(`${this.baseUrl}/v2/list-calls`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const data = await response.json()
        console.log('API test successful:', data)
        return { success: true, message: 'Connection successful' }
      } else if (response.status === 401) {
        return { success: false, message: 'Invalid API key - check your Retell AI credentials' }
      } else {
        const errorText = await response.text()
        console.error('API error response:', errorText)
        return { success: false, message: `API error: ${response.status} - ${errorText}` }
      }
    } catch (error) {
      console.error('API test exception:', error)
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }

  /**
   * Fetch ALL calls for the configured agent using pagination
   */
  public async getAllCalls(): Promise<RetellCall[]> {
    const allCalls: RetellCall[] = []
    let paginationKey: string | undefined = undefined
    let hasMore = true
    let pageCount = 0

    console.log(`Fetching all calls for agent: ${this.callAgentId}`)

    while (hasMore && pageCount < 10) { // Safety limit to prevent infinite loops
      pageCount++
      const response = await this.getCallHistory({
        limit: 1000, // Use maximum limit
        pagination_key: paginationKey,
        filter_criteria: this.callAgentId ? {
          agent_id: this.callAgentId
        } : undefined
      })

      allCalls.push(...response.calls)
      paginationKey = response.pagination_key
      hasMore = response.has_more && !!paginationKey

      console.log(`Page ${pageCount}: Fetched ${response.calls.length} calls for agent ${this.callAgentId} (total so far: ${allCalls.length}, has_more: ${response.has_more})`)

      if (!response.has_more || !paginationKey) {
        hasMore = false
      }
    }

    console.log(`Final result: ${allCalls.length} total calls fetched for agent ${this.callAgentId} in ${pageCount} pages`)
    return allCalls
  }

  /**
   * Fetch call history from Retell API
   */
  public async getCallHistory(options: CallListOptions = {}): Promise<CallListResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Retell API key not configured')
      }

      // Prepare filter criteria with correct array format
      const filterCriteria: any = {}

      // Add other filters from options first, ensuring arrays where needed
      if (options.filter_criteria) {
        const { filter_criteria } = options

        if (filter_criteria.agent_id) {
          filterCriteria.agent_id = Array.isArray(filter_criteria.agent_id)
            ? filter_criteria.agent_id
            : [filter_criteria.agent_id]
        }

        if (filter_criteria.call_status) {
          filterCriteria.call_status = Array.isArray(filter_criteria.call_status)
            ? filter_criteria.call_status
            : [filter_criteria.call_status]
        }

        if (filter_criteria.call_type) {
          filterCriteria.call_type = Array.isArray(filter_criteria.call_type)
            ? filter_criteria.call_type
            : [filter_criteria.call_type]
        }

        if (filter_criteria.direction) {
          filterCriteria.direction = Array.isArray(filter_criteria.direction)
            ? filter_criteria.direction
            : [filter_criteria.direction]
        }

        if (filter_criteria.user_sentiment) {
          filterCriteria.user_sentiment = Array.isArray(filter_criteria.user_sentiment)
            ? filter_criteria.user_sentiment
            : [filter_criteria.user_sentiment]
        }

        if (filter_criteria.call_successful !== undefined) {
          filterCriteria.call_successful = filter_criteria.call_successful
        }

        if (filter_criteria.start_timestamp) {
          // Convert seconds to milliseconds and use correct Retell API format
          const startTimestamp: any = {}
          if (filter_criteria.start_timestamp.gte) {
            startTimestamp.lower_threshold = filter_criteria.start_timestamp.gte * 1000
          }
          if (filter_criteria.start_timestamp.lte) {
            startTimestamp.upper_threshold = filter_criteria.start_timestamp.lte * 1000
          }
          filterCriteria.start_timestamp = startTimestamp
        }
      }

      // Add agent filter if callAgentId is configured and not already set
      if (this.callAgentId && !filterCriteria.agent_id && !options.skipFilters) {
        filterCriteria.agent_id = [this.callAgentId]
        console.log(`Filtering calls by agent ID: ${this.callAgentId}`)
      }

      const requestBody: any = {
        sort_order: options.sort_order || 'descending',
        limit: Math.min(options.limit || 1000, 1000)
      }

      // Only add filter_criteria if we have filters AND not explicitly skipping
      if (Object.keys(filterCriteria).length > 0 && !options.skipFilters) {
        requestBody.filter_criteria = filterCriteria
      }

      // Add pagination key if provided
      if (options.pagination_key) {
        requestBody.pagination_key = options.pagination_key
      }

      console.log('Retell API Request:', JSON.stringify(requestBody, null, 2))
      console.log('Current system date:', new Date().toISOString())

      // Make request following Phaeton AI Dashboard implementation
      const response = await fetch(`${this.baseUrl}/v2/list-calls`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Retell API Error Response:', errorText)
        throw new Error(`Failed to fetch calls: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Handle different response structures (based on Phaeton AI Dashboard)
      let calls: RetellCall[] = []
      let pagination_key: string | undefined = undefined
      let has_more = false

      if (Array.isArray(data)) {
        // Direct array response
        calls = data
        has_more = data.length >= (options.limit || 200)
      } else if (data && typeof data === 'object') {
        // Object response with calls array
        calls = data.calls || data.data || []
        pagination_key = data.pagination_key || data.next_page_token
        has_more = data.has_more || !!pagination_key
      }

      console.log(`Retell API Response: ${calls.length} calls fetched, has_more=${has_more}`)

      // Debug: Show actual call timestamps for comparison
      if (calls.length > 0) {
        console.log('Sample call timestamps:', calls.slice(0, 3).map((call: any) => ({
          call_id: call.call_id,
          start_timestamp: call.start_timestamp,
          start_date: new Date(call.start_timestamp * 1000).toISOString()
        })))
      }

      return {
        calls,
        pagination_key,
        has_more
      }
    } catch (error) {
      console.error('Error fetching call history:', error)
      throw error
    }
  }

  /**
   * Fetch a specific call by ID
   */
  public async getCall(callId: string): Promise<RetellCall> {
    try {
      if (!this.apiKey) {
        throw new Error('Retell API key not configured')
      }

      const response = await fetch(`${this.baseUrl}/v2/get-call/${callId}`, {
        method: 'GET',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch call: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching call:', error)
      throw error
    }
  }

  /**
   * Fetch chat/SMS history from Retell API
   */
  public async getChatHistory(): Promise<ChatListResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Retell API key not configured')
      }

      console.log(`Fetching chat history for SMS agent: ${this.smsAgentId}`)
      console.log('Chat API Request URL:', `${this.baseUrl}/list-chat`)
      console.log('Chat API Headers:', this.getHeaders())

      const response = await fetch(`${this.baseUrl}/list-chat`, {
        method: 'GET',
        headers: this.getHeaders()
      })

      console.log('Chat API Response Status:', response.status, response.statusText)
      console.log('Chat API Response Headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Chat API Error Response:', errorText)

        // If 404, don't try alternative endpoints - /list-chat GET is the only correct one
        if (response.status === 404) {
          console.log('Chat API endpoint returned 404 - this may indicate API configuration issues')
          console.log('Only /list-chat GET endpoint is supported for chat API')
        }

        throw new Error(`Failed to fetch chats: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Raw chat API response data structure:', {
        isArray: Array.isArray(data),
        hasChats: data && 'chats' in data,
        hasData: data && 'data' in data,
        keys: data ? Object.keys(data) : 'null',
        sampleData: data
      })

      // Handle different response structures
      let allChats: RetellChat[] = []
      if (Array.isArray(data)) {
        allChats = data
      } else if (data && data.chats && Array.isArray(data.chats)) {
        allChats = data.chats
      } else if (data && data.data && Array.isArray(data.data)) {
        allChats = data.data
      } else {
        console.warn('Unexpected chat API response structure:', data)
      }

      console.log(`Initial chats fetched: ${allChats.length}`)

      // Don't filter by SMS agent if we want to see all chats
      // Log all chats for debugging
      if (allChats.length > 0) {
        console.log('Sample chat data:', allChats.slice(0, 3).map(chat => ({
          chat_id: chat.chat_id,
          agent_id: chat.agent_id,
          chat_status: chat.chat_status,
          start_timestamp: chat.start_timestamp,
          message_count: chat.message_with_tool_calls?.length || 0
        })))
      }

      // Filter by SMS agent ID if configured AND it's not empty
      let filteredChats = allChats
      if (this.smsAgentId && this.smsAgentId.trim()) {
        const originalCount = allChats.length
        filteredChats = allChats.filter(chat => chat.agent_id === this.smsAgentId)
        console.log(`Filtered ${filteredChats.length} chats for SMS agent ${this.smsAgentId} (from ${originalCount} total)`)
      } else {
        console.log('No SMS agent filter applied - showing all chats')
      }

      // Also count today's chats
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000
      const todayEnd = todayStart + 86400 // 24 hours later

      const todayChats = filteredChats.filter(chat =>
        chat.start_timestamp >= todayStart && chat.start_timestamp < todayEnd
      )

      console.log(`Chats today: ${todayChats.length} (from timestamp ${todayStart} to ${todayEnd})`)

      return {
        chats: filteredChats,
        pagination_key: undefined,
        has_more: false
      }
    } catch (error) {
      console.error('Error fetching chat history:', error)
      throw error
    }
  }

  /**
   * Fetch a specific chat by ID
   */
  public async getChat(chatId: string): Promise<RetellChat> {
    try {
      if (!this.apiKey) {
        throw new Error('Retell API key not configured')
      }

      const response = await fetch(`${this.baseUrl}/get-chat/${chatId}`, {
        method: 'GET',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch chat: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching chat:', error)
      throw error
    }
  }

  /**
   * Get call history filtered by date range
   */
  public async getCallHistoryByDateRange(startDate: Date, endDate: Date, options: Omit<CallListOptions, 'filter_criteria'> = {}): Promise<CallListResponse> {
    const filter_criteria: CallListFilters = {
      start_timestamp: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      }
    }

    return this.getCallHistory({
      ...options,
      filter_criteria
    })
  }

  /**
   * Calculate call metrics from call data
   */
  public calculateCallMetrics(calls: RetellCall[]) {
    const totalCalls = calls.length
    const completedCalls = calls.filter(call => call.call_status === 'ended')
    const failedCalls = calls.filter(call => call.call_status === 'error')

    const totalDuration = completedCalls.reduce((sum, call) => {
      // Prioritize the actual duration_ms from API, then fall back to timestamp calculation
      if (call.duration_ms !== undefined && call.duration_ms !== null) {
        const durationSeconds = call.duration_ms / 1000
        console.log(`Call ${call.call_id}: Using API duration_ms = ${call.duration_ms}ms = ${durationSeconds.toFixed(3)}s`)
        return sum + durationSeconds
      } else if (call.start_timestamp && call.end_timestamp) {
        // Fallback to timestamp calculation if duration_ms not available
        let startMs = call.start_timestamp
        let endMs = call.end_timestamp

        // Convert to milliseconds if needed
        if (call.start_timestamp.toString().length <= 10) {
          startMs = call.start_timestamp * 1000
        }
        if (call.end_timestamp.toString().length <= 10) {
          endMs = call.end_timestamp * 1000
        }

        const durationSeconds = (endMs - startMs) / 1000
        console.log(`Call ${call.call_id}: Calculated from timestamps = ${durationSeconds.toFixed(3)}s`)
        return sum + durationSeconds
      }
      console.log(`Call ${call.call_id}: No duration data available`)
      return sum
    }, 0)

    // Debug logging for duration calculation
    console.log(`Duration calculation: ${completedCalls.length} completed calls, total duration: ${totalDuration.toFixed(2)} seconds (${this.formatDuration(totalDuration)})`)

    const avgDuration = completedCalls.length > 0 ? totalDuration / completedCalls.length : 0

    const totalCost = calls.reduce((sum, call) => {
      // Always use the actual API cost data from Retell AI
      // Convert from cents to dollars (API returns costs in cents)
      const apiCostCents = call.call_cost?.combined_cost || 0
      const apiCostDollars = apiCostCents / 100

      console.log(`Call ${call.call_id}: API cost = ${apiCostCents} cents = $${apiCostDollars.toFixed(4)}`)

      return sum + apiCostDollars
    }, 0)

    // Debug logging for cost analysis
    const apiCostsCents = calls.filter(call => call.call_cost?.combined_cost).map(call => call.call_cost?.combined_cost)
    if (apiCostsCents.length > 0) {
      const minApiCostCents = Math.min(...apiCostsCents)
      const maxApiCostCents = Math.max(...apiCostsCents)
      console.log(`Cost analysis: ${apiCostsCents.length} calls with API cost data`)
      console.log(`Raw API costs range: ${minApiCostCents} cents ($${(minApiCostCents/100).toFixed(4)}) to ${maxApiCostCents} cents ($${(maxApiCostCents/100).toFixed(4)})`)
      console.log(`Calculated total cost: $${totalCost.toFixed(2)}`)
      console.log(`Sample API costs (cents):`, apiCostsCents.slice(0, 5))
    }

    const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0

    const successfulCalls = calls.filter(call => call.call_analysis?.call_successful === true)
    const successRate = totalCalls > 0 ? (successfulCalls.length / totalCalls) * 100 : 0

    const positiveSentimentCalls = calls.filter(call => call.call_analysis?.user_sentiment === 'positive')
    const positiveSentiment = positiveSentimentCalls.length

    // Use actual API costs directly from Retell AI data
    // Convert from cents to dollars (API returns costs in cents)
    const callCosts = calls.map(call => {
      const costCents = call.call_cost?.combined_cost || 0
      return costCents / 100
    }).filter(cost => cost > 0)

    const highestCostCall = callCosts.length > 0 ? Math.max(...callCosts) : 0
    const lowestCostCall = callCosts.length > 0 ? Math.min(...callCosts) : 0

    // Debug logging for cost range analysis
    if (callCosts.length > 0) {
      console.log(`Calculated cost range: $${lowestCostCall.toFixed(4)} to $${highestCostCall.toFixed(4)}`)
      console.log(`Cost distribution:`, callCosts.slice(0, 10).map(c => `$${c.toFixed(3)}`))
    }

    // Calculate total minutes from total duration (in seconds)
    const totalMinutes = Math.round(totalDuration / 60)

    return {
      totalCalls,
      avgDuration: this.formatDuration(avgDuration),
      avgCostPerCall,
      successRate,
      totalDuration: this.formatDuration(totalDuration),
      positiveSentiment,
      highestCostCall,
      lowestCostCall,
      failedCalls: failedCalls.length,
      totalCost,
      totalMinutes
    }
  }

  /**
   * Calculate chat/SMS metrics from chat data
   */
  public calculateChatMetrics(chats: RetellChat[]) {
    console.log('calculateChatMetrics called with:', { chatCount: chats.length, chats: chats.slice(0, 2) })
    const totalMessages = chats.length
    const completedChats = chats.filter(chat => chat.chat_status === 'ended')
    const failedChats = chats.filter(chat => chat.chat_status === 'error')

    const totalCost = chats.reduce((sum, chat) => {
      return sum + (chat.chat_cost?.combined_cost || 0)
    }, 0)

    const avgCostPerMessage = totalMessages > 0 ? totalCost / totalMessages : 0

    const deliveredMessages = chats.filter(chat => chat.chat_status === 'ended')
    const deliveryRate = totalMessages > 0 ? (deliveredMessages.length / totalMessages) * 100 : 0

    const successfulChats = chats.filter(chat => chat.chat_analysis?.chat_successful === true)
    const responseRate = totalMessages > 0 ? (successfulChats.length / totalMessages) * 100 : 0

    const positiveSentimentChats = chats.filter(chat => chat.chat_analysis?.user_sentiment === 'positive')
    const positiveSentiment = positiveSentimentChats.length

    // Calculate highest engagement (using successful chats as proxy)
    const highestEngagement = responseRate

    return {
      totalMessages,
      avgResponseTime: '0m', // This would need to be calculated from message timestamps
      avgCostPerMessage,
      deliveryRate,
      responseRate,
      totalCost,
      positiveSentiment,
      highestEngagement,
      failedMessages: failedChats.length
    }
  }

  /**
   * Format duration from seconds to HH:MM:SS or MM:SS format
   */
  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0:00'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      // Format as HH:MM:SS when duration is 1 hour or more
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    } else {
      // Format as MM:SS when duration is less than 1 hour
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
  }

  /**
   * Calculate realistic cost based on call duration
   * Based on Retell AI pricing: ~$0.167 per minute
   */
  private calculateCostFromDuration(call: RetellCall): number {
    if (!call.start_timestamp || !call.end_timestamp) {
      return 0
    }

    // Calculate duration in seconds (handling both seconds and milliseconds timestamps)
    let startMs = call.start_timestamp
    let endMs = call.end_timestamp

    // Convert to milliseconds if needed
    if (call.start_timestamp.toString().length <= 10) {
      startMs = call.start_timestamp * 1000
    }
    if (call.end_timestamp.toString().length <= 10) {
      endMs = call.end_timestamp * 1000
    }

    const durationSeconds = (endMs - startMs) / 1000
    const durationMinutes = durationSeconds / 60

    // Cap duration at 10 minutes to handle data anomalies
    // Most voice AI calls should be under 10 minutes
    const cappedDurationMinutes = Math.min(durationMinutes, 10)

    // More realistic pricing based on actual usage: ~$0.08-0.12 per minute
    // This accounts for shorter average call lengths and competitive pricing
    const costPerMinute = 0.10
    const calculatedCost = cappedDurationMinutes * costPerMinute

    // Cap final cost at $0.50 for realistic voice AI costs
    const cappedCost = Math.min(calculatedCost, 0.50)

    return Math.max(0, cappedCost) // Ensure non-negative
  }

  /**
   * Get API key (used by SMS service)
   */
  public getApiKey(): string {
    if (!this.apiKey) {
      this.loadCredentials()
    }
    return this.apiKey
  }

  /**
   * Update credentials (call this when settings are changed)
   */
  public updateCredentials(apiKey?: string, callAgentId?: string, smsAgentId?: string): void {
    if (apiKey !== undefined) this.apiKey = apiKey
    if (callAgentId !== undefined) this.callAgentId = callAgentId
    if (smsAgentId !== undefined) this.smsAgentId = smsAgentId
  }
}

// Create and export singleton instance
export const retellService = new RetellService()