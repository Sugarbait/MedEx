/**
 * Fresh Retell AI API Service - Simplified for 2025
 *
 * This is a clean implementation focused on the current working Retell AI endpoints
 * Based on official documentation: https://docs.retellai.com/api-references/
 *
 * BULLETPROOF CREDENTIALS: This service now includes hardcoded fallback credentials
 * that ensure the API is ALWAYS available regardless of storage issues.
 */

import { getBulletproofCredentials, validateCredentials, storeCredentialsEverywhere, type RetellCredentials } from '../config/retellCredentials'
import { cloudCredentialService } from './cloudCredentialService'

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
  telephony_identifier?: {
    twilio_call_sid?: string
  }
  metadata?: any
  disconnection_reason?: string
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

class RetellService {
  private baseUrl = 'https://api.retellai.com'
  private apiKey: string = ''
  private callAgentId: string = ''
  private smsAgentId: string = ''
  private isInitialized = false
  private loadingPromise: Promise<void> | null = null
  private persistenceTimer: NodeJS.Timeout | null = null

  constructor() {
    this.loadCredentials()
    this.setupPersistenceMonitoring()
  }

  /**
   * Setup monitoring to ensure API keys persist across navigation
   */
  private setupPersistenceMonitoring(): void {
    // Monitor for navigation events and re-validate credentials
    if (typeof window !== 'undefined') {
      const validateCredentials = () => {
        if (!this.isConfigured()) {
          console.log('🔧 RetellService - Credentials lost during navigation, reloading...')
          this.loadCredentials()
        }
      }

      // Listen for navigation events
      window.addEventListener('popstate', validateCredentials)
      window.addEventListener('pushstate', validateCredentials)
      window.addEventListener('replacestate', validateCredentials)

      // Listen for focus events (when returning to tab)
      window.addEventListener('focus', validateCredentials)

      // Periodic validation every 30 seconds
      this.persistenceTimer = setInterval(validateCredentials, 30000)
    }
  }

  /**
   * Load API credentials from localStorage with bulletproof persistence
   */
  public loadCredentials(): void {
    // Prevent concurrent loading
    if (this.loadingPromise) {
      return
    }

    this.loadingPromise = this.loadCredentialsInternal()
    this.loadingPromise.finally(() => {
      this.loadingPromise = null
    })
  }

  /**
   * Internal credentials loading with comprehensive fallback logic
   */
  private async loadCredentialsInternal(): Promise<void> {
    try {
      console.log('🔄 RetellService - Loading credentials with bulletproof persistence...')

      // PRIORITY 1: ALWAYS use hardcoded credentials for MedEx
      console.log('🔐 RetellService - Using hardcoded MedEx credentials (Priority 1)...')
      let credentials = this.loadHardcodedCredentials()

      // Only check other sources if hardcoded credentials are somehow invalid
      if (!credentials.apiKey) {
        console.warn('⚠️ Hardcoded credentials not available, checking fallbacks...')

        credentials = this.loadFromCurrentUser()

        if (!credentials.apiKey) {
          credentials = this.scanAllUserSettings()
        }

        if (!credentials.apiKey) {
          credentials = this.loadFromSessionStorage()
        }

        if (!credentials.apiKey) {
          credentials = this.loadFromMemoryBackup()
        }

        // CLOUD FALLBACK: Try cloud storage as last resort
        if (!credentials.apiKey) {
          try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
            const cloudCreds = await cloudCredentialService.getCredentialsWithFallback(currentUser.id)
            if (validateCredentials(cloudCreds)) {
              console.log('☁️ RetellService - Found credentials in cloud storage')
              credentials = {
                apiKey: cloudCreds.apiKey,
                callAgentId: cloudCreds.callAgentId,
                smsAgentId: cloudCreds.smsAgentId
              }
              storeCredentialsEverywhere(cloudCreds)
            }
          } catch (cloudError) {
            console.warn('⚠️ RetellService - Cloud credential loading failed:', cloudError)
          }
        }
      }

      // Apply loaded credentials
      this.apiKey = credentials.apiKey || this.apiKey
      this.callAgentId = credentials.callAgentId || this.callAgentId
      this.smsAgentId = credentials.smsAgentId || this.smsAgentId

      // Create memory backup for future fallback
      this.createMemoryBackup()

      // Store in sessionStorage for reliability
      this.saveToSessionStorage()

      this.isInitialized = true

      console.log('✅ RetellService - Credentials loaded successfully:', {
        hasApiKey: !!this.apiKey,
        apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 15) + '...' : 'none',
        callAgentId: this.callAgentId || 'not set',
        smsAgentId: this.smsAgentId || 'not set',
        source: 'bulletproof_loading_with_hardcoded_fallback',
        isHardcoded: credentials.apiKey === getBulletproofCredentials().apiKey
      })

      // If we successfully loaded credentials, ensure they're stored everywhere
      if (this.apiKey && this.callAgentId && this.smsAgentId) {
        storeCredentialsEverywhere({
          apiKey: this.apiKey,
          callAgentId: this.callAgentId,
          smsAgentId: this.smsAgentId
        })
      }

    } catch (error) {
      console.error('❌ RetellService - Error loading credentials:', error)
    }
  }

  /**
   * Load credentials from current user localStorage
   */
  private loadFromCurrentUser(): {apiKey: string, callAgentId: string, smsAgentId: string} {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (currentUser.id) {
        const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
        if (settings.retellApiKey) {
          console.log('🎯 RetellService - Found credentials via currentUser')
          return {
            apiKey: settings.retellApiKey,
            callAgentId: settings.callAgentId || '',
            smsAgentId: settings.smsAgentId || ''
          }
        }
      }
    } catch (error) {
      console.warn('RetellService - Error loading from currentUser:', error)
    }
    return {apiKey: '', callAgentId: '', smsAgentId: ''}
  }

  /**
   * Scan all user settings files for API keys
   */
  private scanAllUserSettings(): {apiKey: string, callAgentId: string, smsAgentId: string} {
    try {
      console.log('🔍 RetellService - Scanning all user settings for credentials...')
      const allKeys = Object.keys(localStorage)
      const settingsKeys = allKeys.filter(key => key.startsWith('settings_') && key !== 'settings_undefined')

      for (const key of settingsKeys) {
        try {
          const settings = JSON.parse(localStorage.getItem(key) || '{}')
          if (settings.retellApiKey) {
            console.log('🎯 RetellService - Found credentials in', key)
            return {
              apiKey: settings.retellApiKey,
              callAgentId: settings.callAgentId || '',
              smsAgentId: settings.smsAgentId || ''
            }
          }
        } catch (parseError) {
          console.warn(`RetellService - Error parsing settings from ${key}:`, parseError)
        }
      }
    } catch (error) {
      console.warn('RetellService - Error scanning user settings:', error)
    }
    return {apiKey: '', callAgentId: '', smsAgentId: ''}
  }

  /**
   * Load credentials from sessionStorage backup
   */
  private loadFromSessionStorage(): {apiKey: string, callAgentId: string, smsAgentId: string} {
    try {
      const sessionData = sessionStorage.getItem('retell_credentials_backup')
      if (sessionData) {
        const credentials = JSON.parse(sessionData)
        if (credentials.apiKey) {
          console.log('🎯 RetellService - Found credentials in sessionStorage backup')
          return credentials
        }
      }
    } catch (error) {
      console.warn('RetellService - Error loading from sessionStorage:', error)
    }
    return {apiKey: '', callAgentId: '', smsAgentId: ''}
  }

  /**
   * Load credentials from in-memory backup
   */
  private loadFromMemoryBackup(): {apiKey: string, callAgentId: string, smsAgentId: string} {
    try {
      const backup = (window as any).__retellCredentialsBackup
      if (backup && backup.apiKey) {
        console.log('🎯 RetellService - Found credentials in memory backup')
        return backup
      }
    } catch (error) {
      console.warn('RetellService - Error loading from memory backup:', error)
    }
    return {apiKey: '', callAgentId: '', smsAgentId: ''}
  }

  /**
   * Load hardcoded credentials as ultimate fallback
   */
  private loadHardcodedCredentials(): {apiKey: string, callAgentId: string, smsAgentId: string} {
    try {
      console.log('🔐 RetellService - Loading hardcoded credentials as ultimate fallback...')
      const bulletproofCreds = getBulletproofCredentials()

      if (validateCredentials(bulletproofCreds)) {
        console.log('✅ RetellService - Hardcoded credentials validated successfully')

        // Store hardcoded credentials in all locations for future use
        storeCredentialsEverywhere(bulletproofCreds)

        return {
          apiKey: bulletproofCreds.apiKey,
          callAgentId: bulletproofCreds.callAgentId,
          smsAgentId: bulletproofCreds.smsAgentId
        }
      } else {
        console.error('❌ RetellService - Hardcoded credentials failed validation')
      }
    } catch (error) {
      console.error('❌ RetellService - Error loading hardcoded credentials:', error)
    }
    return {apiKey: '', callAgentId: '', smsAgentId: ''}
  }

  /**
   * Create in-memory backup of credentials
   */
  private createMemoryBackup(): void {
    if (this.apiKey) {
      (window as any).__retellCredentialsBackup = {
        apiKey: this.apiKey,
        callAgentId: this.callAgentId,
        smsAgentId: this.smsAgentId,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Save credentials to sessionStorage for reliability
   */
  private saveToSessionStorage(): void {
    if (this.apiKey) {
      try {
        sessionStorage.setItem('retell_credentials_backup', JSON.stringify({
          apiKey: this.apiKey,
          callAgentId: this.callAgentId,
          smsAgentId: this.smsAgentId,
          timestamp: Date.now()
        }))
      } catch (error) {
        console.warn('RetellService - Error saving to sessionStorage:', error)
      }
    }
  }

  /**
   * Decrypt API key if it's encrypted
   */
  private async getDecryptedApiKey(): Promise<string> {
    if (!this.apiKey) return ''

    // Check if encrypted (has encryption prefix)
    if (this.apiKey.includes('cbc:') || this.apiKey.includes('gcm:') || this.apiKey.includes('aes:')) {
      try {
        const { encryptionService } = await import('./encryption')
        const decrypted = await encryptionService.decryptString(this.apiKey)
        console.log('Fresh RetellService - API key decrypted successfully')
        return decrypted
      } catch (error) {
        console.error('Fresh RetellService - Decryption failed, using fallback:', error)
        // Fallback: remove prefix and use what remains
        const parts = this.apiKey.split(':')
        if (parts.length > 1) {
          const fallbackKey = parts[parts.length - 1] // Get the last part after ':'
          console.log('Fresh RetellService - Using fallback key extraction')
          return fallbackKey
        }
        return this.apiKey // Return original if no ':' found
      }
    }

    // Not encrypted, return as-is
    return this.apiKey
  }

  /**
   * Get headers for API requests
   */
  private async getHeaders(): Promise<HeadersInit> {
    const decryptedKey = await this.getDecryptedApiKey()

    if (!decryptedKey || decryptedKey.trim() === '') {
      throw new Error('No valid Retell AI API key configured')
    }

    return {
      'Authorization': `Bearer ${decryptedKey.trim()}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * Check if service is configured with auto-recovery and hardcoded fallback
   */
  public isConfigured(): boolean {
    const configured = !!(this.apiKey && (this.callAgentId || this.smsAgentId))

    // If not configured but should be, try to reload with hardcoded fallback
    if (!configured && this.isInitialized) {
      console.log('⚠️ RetellService - Configuration lost, attempting recovery with hardcoded fallback...')
      this.loadCredentials()

      // If still not configured after reload, force use hardcoded credentials
      if (!this.apiKey) {
        console.log('🔐 RetellService - Recovery failed, forcing hardcoded credentials...')
        this.forceUpdateCredentials()
      }

      return !!(this.apiKey && (this.callAgentId || this.smsAgentId))
    }

    return configured
  }

  /**
   * Test API connection
   */
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Fresh RetellService - Testing connection...')

      if (!this.apiKey) {
        return { success: false, message: 'API key not configured' }
      }

      const headers = await this.getHeaders()
      const response = await fetch(`${this.baseUrl}/v2/list-calls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          limit: 1,
          sort_order: 'descending'
        })
      })

      console.log('Fresh RetellService - Test response:', response.status)

      if (response.ok) {
        return { success: true, message: 'Connection successful!' }
      } else {
        const errorText = await response.text()
        return {
          success: false,
          message: `API error: ${response.status} - ${errorText}`
        }
      }
    } catch (error) {
      console.error('Fresh RetellService - Connection test failed:', error)
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Fetch call history
   */
  public async getCallHistory(options: {
    limit?: number
    agent_id?: string
    start_timestamp?: { gte?: number; lte?: number }
  } = {}): Promise<CallListResponse> {
    try {
      console.log('Fresh RetellService - Fetching calls...')

      if (!this.apiKey) {
        throw new Error('Retell AI API key not configured')
      }

      const requestBody: any = {
        sort_order: 'descending',
        limit: Math.min(options.limit || 1000, 1000)
      }

      // Add filters
      const filterCriteria: any = {}

      if (options.agent_id || this.callAgentId) {
        filterCriteria.agent_id = [options.agent_id || this.callAgentId]
      }

      if (options.start_timestamp) {
        const timestamp: any = {}
        if (options.start_timestamp.gte) {
          timestamp.lower_threshold = options.start_timestamp.gte * 1000
        }
        if (options.start_timestamp.lte) {
          timestamp.upper_threshold = options.start_timestamp.lte * 1000
        }
        filterCriteria.start_timestamp = timestamp
      }

      if (Object.keys(filterCriteria).length > 0) {
        requestBody.filter_criteria = filterCriteria
      }

      console.log('Fresh RetellService - Request:', {
        url: `${this.baseUrl}/v2/list-calls`,
        body: requestBody
      })

      const headers = await this.getHeaders()
      const response = await fetch(`${this.baseUrl}/v2/list-calls`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      console.log('Fresh RetellService - Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Fresh RetellService - API error:', errorText)
        throw new Error(`Failed to fetch calls: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Fresh RetellService - Received data:', {
        type: typeof data,
        isArray: Array.isArray(data),
        keys: data ? Object.keys(data) : 'null'
      })

      // Parse response
      let calls: RetellCall[] = []
      let pagination_key: string | undefined = undefined
      let has_more = false

      if (Array.isArray(data)) {
        calls = data
        has_more = data.length >= (options.limit || 200)
      } else if (data && typeof data === 'object') {
        calls = data.calls || data.data || []
        pagination_key = data.pagination_key
        has_more = data.has_more || !!pagination_key
      }

      console.log('Fresh RetellService - Parsed calls:', calls.length)

      return {
        calls,
        pagination_key,
        has_more
      }
    } catch (error) {
      console.error('Fresh RetellService - Error fetching calls:', error)
      throw error
    }
  }

  /**
   * Fetch chat history using correct GET endpoint
   *
   * IMPORTANT: The /list-chat endpoint does NOT support agent_id filtering via query parameters.
   * The API ignores the agent_id parameter and returns ALL chats from the entire account.
   * We must filter client-side after receiving the response.
   */
  public async getChatHistory(): Promise<ChatListResponse> {
    try {
      console.log('Fresh RetellService - Fetching chats...')

      if (!this.apiKey) {
        throw new Error('Retell AI API key not configured')
      }

      // Use the correct GET /list-chat endpoint
      // NOTE: The API does NOT support agent_id filtering - we'll filter client-side
      let url = `${this.baseUrl}/list-chat`

      // Add limit parameter only
      const params = new URLSearchParams()
      params.append('limit', '1000')

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      console.log('Fresh RetellService - Chat request:', {
        url: url,
        method: 'GET',
        note: 'API does not support agent_id filtering - will filter client-side'
      })

      const headers = await this.getHeaders()
      const response = await fetch(url, {
        method: 'GET',
        headers
      })

      console.log('Fresh RetellService - Chat response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Fresh RetellService - Chat API error:', errorText)
        throw new Error(`Failed to fetch chats: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Fresh RetellService - Received chat data (BEFORE filtering):', {
        type: typeof data,
        isArray: Array.isArray(data),
        keys: data ? Object.keys(data) : 'null',
        length: Array.isArray(data) ? data.length : 'not an array'
      })

      // Parse response - the API returns an array of chat objects directly
      let allChats: RetellChat[] = []
      let pagination_key: string | undefined = undefined
      let has_more = false

      if (Array.isArray(data)) {
        allChats = data
        has_more = data.length >= 1000
      } else if (data && typeof data === 'object') {
        allChats = data.chats || data.data || []
        pagination_key = data.pagination_key
        has_more = data.has_more || !!pagination_key
      }

      console.log('Fresh RetellService - Total chats received from API:', allChats.length)

      // CLIENT-SIDE FILTERING: Filter chats by SMS agent ID if configured
      let filteredChats = allChats
      if (this.smsAgentId && this.smsAgentId.trim()) {
        filteredChats = allChats.filter(chat => chat.agent_id === this.smsAgentId)
        console.log(`Fresh RetellService - Filtered chats for agent ${this.smsAgentId}: ${filteredChats.length} of ${allChats.length} total`)

        // Log sample of filtered vs unfiltered for debugging
        if (allChats.length > 0 && filteredChats.length === 0) {
          console.warn('⚠️ No chats match the configured SMS agent ID!')
          console.log('Sample agent IDs in response:', allChats.slice(0, 5).map(c => c.agent_id))
          console.log('Configured SMS agent ID:', this.smsAgentId)
        }
      } else {
        console.warn('⚠️ No SMS agent ID configured - returning all chats unfiltered')
      }

      return {
        chats: filteredChats,
        pagination_key,
        has_more
      }
    } catch (error) {
      console.error('Fresh RetellService - Error fetching chats:', error)
      throw error
    }
  }

  /**
   * Update credentials with bulletproof persistence
   */
  public updateCredentials(apiKey?: string, callAgentId?: string, smsAgentId?: string): void {
    console.log('🔧 RetellService - Updating credentials with bulletproof persistence...')

    // Update instance variables
    if (apiKey !== undefined) this.apiKey = apiKey
    if (callAgentId !== undefined) this.callAgentId = callAgentId
    if (smsAgentId !== undefined) this.smsAgentId = smsAgentId

    // Mark as initialized
    this.isInitialized = true

    // Update all storage locations for maximum reliability
    this.updateLocalStorageCredentials(apiKey, callAgentId, smsAgentId)
    this.createMemoryBackup()
    this.saveToSessionStorage()

    // Sync to cloud storage for cross-device persistence
    this.syncCredentialsToCloud(apiKey, callAgentId, smsAgentId)

    console.log('✅ RetellService - Credentials updated across all storage locations')
  }

  /**
   * Update localStorage with plain text credentials for UI display
   */
  private updateLocalStorageCredentials(apiKey?: string, callAgentId?: string, smsAgentId?: string): void {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (currentUser.id) {
        const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')

        // Store plain text values in localStorage for UI display
        if (apiKey !== undefined) {
          settings.retellApiKey = apiKey
          console.log(`Fresh RetellService - Set API key in localStorage: ${apiKey.substring(0, 15)}...`)
        }
        if (callAgentId !== undefined) {
          settings.callAgentId = callAgentId
          console.log(`Fresh RetellService - Set call agent ID: ${callAgentId}`)
        }
        if (smsAgentId !== undefined) {
          settings.smsAgentId = smsAgentId
          console.log(`Fresh RetellService - Set SMS agent ID: ${smsAgentId}`)
        }

        localStorage.setItem(`settings_${currentUser.id}`, JSON.stringify(settings))

        console.log('Fresh RetellService - Updated localStorage with plain text credentials for UI')
      }
    } catch (error) {
      console.error('Error updating localStorage credentials:', error)
    }
  }

  /**
   * Force update credentials with the correct API key - Now uses hardcoded values
   */
  public forceUpdateCredentials(): void {
    console.log('Fresh RetellService - Force updating with bulletproof hardcoded credentials')

    try {
      // Get the bulletproof credentials
      const bulletproofCreds = getBulletproofCredentials()

      // Set the hardcoded values
      this.updateCredentials(
        bulletproofCreds.apiKey,
        bulletproofCreds.callAgentId,
        bulletproofCreds.smsAgentId
      )

      console.log('✅ Fresh RetellService - Force update completed with hardcoded credentials')
    } catch (error) {
      console.error('❌ Fresh RetellService - Force update failed:', error)

      // Fallback to the original hardcoded values if getBulletproofCredentials fails
      this.updateCredentials(
        'key_c3f084f5ca67781070e188b47d7f',
        'agent_447a1b9da540237693b0440df6',
        'agent_643486efd4b5a0e9d7e094ab99'
      )
    }
  }

  /**
   * Load credentials async with promise support
   */
  public async loadCredentialsAsync(): Promise<void> {
    if (this.loadingPromise) {
      await this.loadingPromise
      return
    }

    this.loadCredentials()
    if (this.loadingPromise) {
      await this.loadingPromise
    }
  }

  /**
   * Ensure credentials are loaded and available
   */
  public async ensureCredentialsLoaded(): Promise<boolean> {
    if (!this.isConfigured()) {
      await this.loadCredentialsAsync()
    }
    return this.isConfigured()
  }

  /**
   * Sync credentials to cloud storage
   */
  private async syncCredentialsToCloud(apiKey?: string, callAgentId?: string, smsAgentId?: string): Promise<void> {
    try {
      // Only sync if we have valid credentials
      if (!apiKey || !callAgentId || !smsAgentId) {
        return
      }

      // Get current user ID
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (!currentUser.id) {
        console.log('RetellService - No user ID available for cloud sync')
        return
      }

      const credentials: RetellCredentials = {
        apiKey,
        callAgentId,
        smsAgentId
      }

      if (validateCredentials(credentials)) {
        await cloudCredentialService.syncUserCredentialsToCloud(currentUser.id, credentials)
        console.log('✅ RetellService - Credentials synced to cloud successfully')
      }
    } catch (error) {
      console.warn('⚠️ RetellService - Failed to sync credentials to cloud:', error)
    }
  }

  /**
   * Load credentials from cloud with user-specific fallback
   */
  public async loadCredentialsFromCloud(userId?: string): Promise<boolean> {
    try {
      const cloudCreds = await cloudCredentialService.getCredentialsWithFallback(userId)

      if (validateCredentials(cloudCreds)) {
        this.updateCredentials(
          cloudCreds.apiKey,
          cloudCreds.callAgentId,
          cloudCreds.smsAgentId
        )
        return true
      }
    } catch (error) {
      console.error('RetellService - Error loading from cloud:', error)
    }
    return false
  }

  /**
   * Cleanup method for proper resource management
   */
  public destroy(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer)
      this.persistenceTimer = null
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', () => {})
      window.removeEventListener('pushstate', () => {})
      window.removeEventListener('replacestate', () => {})
      window.removeEventListener('focus', () => {})
    }
  }

  /**
   * Get all calls (for compatibility with analytics)
   */
  public async getAllCalls(): Promise<RetellCall[]> {
    try {
      const response = await this.getCallHistory({ limit: 1000 })
      return response.calls
    } catch (error) {
      console.error('Fresh RetellService - Error getting all calls:', error)
      return []
    }
  }

  /**
   * Get call history by date range (for compatibility)
   */
  public async getCallHistoryByDateRange(startDate: Date, endDate: Date): Promise<CallListResponse> {
    return this.getCallHistory({
      start_timestamp: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      }
    })
  }

  /**
   * Calculate call metrics (for compatibility with analytics)
   */
  public calculateCallMetrics(calls: RetellCall[]) {
    const totalCalls = calls.length
    const completedCalls = calls.filter(call => call.call_status === 'ended')
    const failedCalls = calls.filter(call => call.call_status === 'error')

    const totalDuration = completedCalls.reduce((sum, call) => {
      if (call.duration_ms) {
        return sum + (call.duration_ms / 1000) // Convert to seconds
      }
      return sum
    }, 0)

    const avgDuration = completedCalls.length > 0 ? totalDuration / completedCalls.length : 0

    const totalCost = calls.reduce((sum, call) => {
      const costCents = call.call_cost?.combined_cost || 0
      return sum + (costCents / 100) // Convert cents to dollars
    }, 0)

    const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0

    const successfulCalls = calls.filter(call => call.call_analysis?.call_successful === true)
    const successRate = totalCalls > 0 ? (successfulCalls.length / totalCalls) * 100 : 0

    const positiveSentimentCalls = calls.filter(call => call.call_analysis?.user_sentiment === 'positive')
    const positiveSentiment = positiveSentimentCalls.length

    const callCosts = calls.map(call => {
      const costCents = call.call_cost?.combined_cost || 0
      return costCents / 100
    }).filter(cost => cost > 0)

    const highestCostCall = callCosts.length > 0 ? Math.max(...callCosts) : 0
    const lowestCostCall = callCosts.length > 0 ? Math.min(...callCosts) : 0

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
   * Format duration helper
   */
  private formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0:00'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
  }

  /**
   * Get API key (for compatibility)
   */
  public getApiKey(): string {
    return this.apiKey
  }

  /**
   * Get call agent ID (for compatibility)
   */
  public getCallAgentId(): string {
    return this.callAgentId
  }

  /**
   * Get SMS agent ID (for compatibility)
   */
  public getSmsAgentId(): string {
    return this.smsAgentId
  }
}

// Create and export singleton instance
export const retellService = new RetellService()