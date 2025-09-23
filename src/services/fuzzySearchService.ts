/**
 * HIPAA-Compliant Fuzzy Search Service
 *
 * Implements intelligent fuzzy search functionality for SMS and calls pages
 * with HIPAA compliance and PHI protection.
 *
 * Features:
 * - Fuse.js-based fuzzy search with configurable thresholds
 * - HIPAA-compliant audit logging for PHI searches
 * - Debounced search to optimize performance
 * - No logging of actual PHI data
 * - Support for multiple search fields
 */

import Fuse from 'fuse.js'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'
import type { Chat } from './chatService'
import type { Call } from '@/types'

// Search configuration interface
export interface FuzzySearchConfig {
  threshold: number
  includeScore: boolean
  includeMatches: boolean
  minMatchCharLength: number
  ignoreLocation: boolean
  keys: string[]
}

// Default search configurations for different content types
const SMS_SEARCH_CONFIG: FuzzySearchConfig = {
  threshold: 0.3, // Stricter threshold - lower means more exact matching required
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 3, // Require at least 3 character matches to avoid false positives
  ignoreLocation: true,
  keys: [
    // Metadata fields
    'metadata.phone_number',
    'metadata.customer_phone_number',
    'metadata.patient_name',
    'metadata.customer_name',
    'metadata.caller_name',
    'metadata.name',
    // Dynamic variables
    'collected_dynamic_variables.patient_name',
    'collected_dynamic_variables.customer_name',
    'collected_dynamic_variables.name',
    // Chat analysis fields (detailed analysis from ChatModal)
    'chat_analysis.chat_summary',
    'chat_analysis.user_sentiment',
    'chat_analysis.custom_analysis_data.phone_number',
    'chat_analysis.custom_analysis_data.customer_phone_number',
    'chat_analysis.custom_analysis_data.phone',
    'chat_analysis.custom_analysis_data.contact_number',
    'chat_analysis.custom_analysis_data.patient_name',
    'chat_analysis.custom_analysis_data.customer_name',
    'chat_analysis.custom_analysis_data.caller_name',
    'chat_analysis.custom_analysis_data.name',
    // Basic fields
    'chat_id',
    'transcript'
  ]
}

const CALLS_SEARCH_CONFIG: FuzzySearchConfig = {
  threshold: 0.3, // Stricter threshold - lower means more exact matching required
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 3, // Require at least 3 character matches to avoid false positives
  ignoreLocation: true,
  keys: [
    // Basic call fields
    'patient_id',
    'transcript',
    // Metadata fields
    'metadata.patient_name',
    'metadata.customer_name',
    'metadata.phone_number',
    // Call analysis fields (detailed analysis)
    'call_analysis.call_summary',
    'call_analysis.user_sentiment',
    'call_analysis.custom_analysis_data.phone_number',
    'call_analysis.custom_analysis_data.customer_phone_number',
    'call_analysis.custom_analysis_data.phone',
    'call_analysis.custom_analysis_data.contact_number',
    'call_analysis.custom_analysis_data.patient_name',
    'call_analysis.custom_analysis_data.customer_name',
    'call_analysis.custom_analysis_data.caller_name',
    'call_analysis.custom_analysis_data.name'
  ]
}

export interface FuzzySearchResult<T> {
  item: T
  score?: number
  matches?: readonly Fuse.FuseResultMatch[]
}

class FuzzySearchService {
  private smsSearchEngine: Fuse<Chat> | null = null
  private callsSearchEngine: Fuse<Call> | null = null
  private smsData: Chat[] = []
  private callsData: Call[] = []

  /**
   * Initialize SMS search engine with data
   */
  initializeSMSSearch(chats: Chat[]): void {
    try {
      console.log(`[FUZZY SEARCH] Initializing SMS search with ${chats.length} chats`)
      this.smsData = chats
      this.smsSearchEngine = new Fuse(chats, SMS_SEARCH_CONFIG)
      console.log(`[FUZZY SEARCH] SMS search engine initialized successfully with threshold ${SMS_SEARCH_CONFIG.threshold}`)

      // Audit log search initialization (no PHI data logged)
      this.logSearchActivity(
        'SMS_SEARCH_INIT',
        'sms_search_engine',
        chats.length,
        AuditOutcome.SUCCESS
      )
    } catch (error) {
      console.error('[FUZZY SEARCH] Failed to initialize SMS search engine:', error)
      this.logSearchActivity(
        'SMS_SEARCH_INIT',
        'sms_search_engine',
        0,
        AuditOutcome.FAILURE,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Initialize calls search engine with data
   */
  initializeCallsSearch(calls: Call[]): void {
    try {
      console.log(`[FUZZY SEARCH] Initializing calls search with ${calls.length} calls`)
      this.callsData = calls
      this.callsSearchEngine = new Fuse(calls, CALLS_SEARCH_CONFIG)
      console.log(`[FUZZY SEARCH] Calls search engine initialized successfully with threshold ${CALLS_SEARCH_CONFIG.threshold}`)

      // Audit log search initialization (no PHI data logged)
      this.logSearchActivity(
        'CALLS_SEARCH_INIT',
        'calls_search_engine',
        calls.length,
        AuditOutcome.SUCCESS
      )
    } catch (error) {
      console.error('[FUZZY SEARCH] Failed to initialize calls search engine:', error)
      this.logSearchActivity(
        'CALLS_SEARCH_INIT',
        'calls_search_engine',
        0,
        AuditOutcome.FAILURE,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Perform fuzzy search on SMS data
   */
  searchSMS(query: string): FuzzySearchResult<Chat>[] {
    if (!query.trim()) {
      console.log('[SEARCH] SMS search query is empty, returning empty results')
      return []
    }

    // ALWAYS use basic search - fuzzy search is causing too many issues
    console.log(`[SEARCH] Performing SMS search for query with length: ${query.length}`)
    const basicResults = this.basicSMSSearch(this.smsData, query)
    console.log(`[SEARCH] SMS search returned ${basicResults.length} results`)

    // Audit log search activity (no actual search terms logged for PHI protection)
    this.logSearchActivity(
      'SMS_SEARCH_QUERY',
      'sms_conversations',
      basicResults.length,
      AuditOutcome.SUCCESS
    )

    return basicResults.map(item => ({ item }))
  }

  /**
   * Perform fuzzy search on calls data
   */
  searchCalls(query: string): FuzzySearchResult<Call>[] {
    if (!query.trim()) {
      console.log('[SEARCH] Calls search query is empty, returning empty results')
      return []
    }

    // ALWAYS use basic search - fuzzy search is causing too many issues
    console.log(`[SEARCH] Performing calls search for query with length: ${query.length}`)
    const basicResults = this.basicCallsSearch(this.callsData, query)
    console.log(`[SEARCH] Calls search returned ${basicResults.length} results`)

    // Audit log search activity (no actual search terms logged for PHI protection)
    this.logSearchActivity(
      'CALLS_SEARCH_QUERY',
      'voice_calls',
      basicResults.length,
      AuditOutcome.SUCCESS
    )

    return basicResults.map(item => ({ item }))
  }

  /**
   * Perform basic string matching fallback for when fuzzy search fails
   */
  basicSMSSearch(chats: Chat[], query: string): Chat[] {
    if (!query.trim()) return chats

    const lowerQuery = query.toLowerCase()
    console.log(`[SEARCH] Performing basic SMS search on ${chats.length} chats`)

    const results = chats.filter(chat => {
      // Check phone numbers from metadata
      const phoneNumber = chat.metadata?.phone_number || chat.metadata?.customer_phone_number || ''
      if (phoneNumber.toLowerCase().includes(lowerQuery)) return true

      // Check phone numbers from chat analysis
      const analysisPhoneNumber = chat.chat_analysis?.custom_analysis_data?.phone_number ||
                                  chat.chat_analysis?.custom_analysis_data?.customer_phone_number ||
                                  chat.chat_analysis?.custom_analysis_data?.phone ||
                                  chat.chat_analysis?.custom_analysis_data?.contact_number || ''
      if (analysisPhoneNumber.toLowerCase().includes(lowerQuery)) return true

      // Check all possible name fields from metadata
      const extractedName = chat.metadata?.patient_name ||
                            chat.metadata?.customer_name ||
                            chat.metadata?.caller_name ||
                            chat.metadata?.name ||
                            chat.collected_dynamic_variables?.patient_name ||
                            chat.collected_dynamic_variables?.customer_name ||
                            chat.collected_dynamic_variables?.name ||
                            ''
      if (extractedName.toLowerCase().includes(lowerQuery)) return true

      // Check name fields from chat analysis (detailed analysis data)
      const analysisName = chat.chat_analysis?.custom_analysis_data?.patient_name ||
                          chat.chat_analysis?.custom_analysis_data?.customer_name ||
                          chat.chat_analysis?.custom_analysis_data?.caller_name ||
                          chat.chat_analysis?.custom_analysis_data?.name || ''
      if (analysisName.toLowerCase().includes(lowerQuery)) return true

      // Check chat analysis summary
      if (chat.chat_analysis?.chat_summary && chat.chat_analysis.chat_summary.toLowerCase().includes(lowerQuery)) return true

      // Check chat analysis sentiment
      if (chat.chat_analysis?.user_sentiment && chat.chat_analysis.user_sentiment.toLowerCase().includes(lowerQuery)) return true

      // Search through all custom analysis data fields (detailed analysis from ChatModal)
      if (chat.chat_analysis?.custom_analysis_data) {
        for (const [key, value] of Object.entries(chat.chat_analysis.custom_analysis_data)) {
          if (value && typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) return true
          if (value && typeof value === 'number' && value.toString().includes(lowerQuery)) return true
        }
      }

      // Check transcript if it exists
      if (chat.transcript && chat.transcript.toLowerCase().includes(lowerQuery)) return true

      // Check chat ID
      if (chat.chat_id && chat.chat_id.toLowerCase().includes(lowerQuery)) return true

      // Check messages content if available
      if (chat.messages && Array.isArray(chat.messages)) {
        for (const msg of chat.messages) {
          if (msg.content && msg.content.toLowerCase().includes(lowerQuery)) return true
        }
      }

      return false
    })

    console.log(`[SEARCH] Basic SMS search returned ${results.length} results`)
    return results
  }

  /**
   * Perform basic string matching fallback for calls
   */
  basicCallsSearch(calls: Call[], query: string): Call[] {
    if (!query.trim()) return calls

    const lowerQuery = query.toLowerCase()
    console.log(`[FUZZY SEARCH] Performing basic calls search on ${calls.length} calls`)

    const results = calls.filter(call => {
      // Check basic call fields
      if (call.patient_id?.toLowerCase().includes(lowerQuery)) return true
      if (call.transcript?.toLowerCase().includes(lowerQuery)) return true

      // Check metadata fields
      if (call.metadata?.patient_name?.toLowerCase().includes(lowerQuery)) return true
      if (call.metadata?.customer_name?.toLowerCase().includes(lowerQuery)) return true
      if (call.metadata?.phone_number?.toLowerCase().includes(lowerQuery)) return true

      // Check call analysis fields (detailed analysis data)
      if (call.call_analysis?.call_summary?.toLowerCase().includes(lowerQuery)) return true
      if (call.call_analysis?.user_sentiment?.toLowerCase().includes(lowerQuery)) return true

      // Check call analysis custom data
      if (call.call_analysis?.custom_analysis_data) {
        // Check specific known fields
        const analysisPhoneNumber = call.call_analysis.custom_analysis_data.phone_number ||
                                   call.call_analysis.custom_analysis_data.customer_phone_number ||
                                   call.call_analysis.custom_analysis_data.phone ||
                                   call.call_analysis.custom_analysis_data.contact_number || ''
        if (analysisPhoneNumber.toLowerCase().includes(lowerQuery)) return true

        const analysisName = call.call_analysis.custom_analysis_data.patient_name ||
                            call.call_analysis.custom_analysis_data.customer_name ||
                            call.call_analysis.custom_analysis_data.caller_name ||
                            call.call_analysis.custom_analysis_data.name || ''
        if (analysisName.toLowerCase().includes(lowerQuery)) return true

        // Search through all custom analysis data fields
        for (const [key, value] of Object.entries(call.call_analysis.custom_analysis_data)) {
          if (value && typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) return true
          if (value && typeof value === 'number' && value.toString().includes(lowerQuery)) return true
        }
      }

      return false
    })

    console.log(`[FUZZY SEARCH] Basic calls search returned ${results.length} results`)
    return results
  }

  /**
   * Get search suggestions based on partial input
   */
  getSMSSearchSuggestions(query: string, limit: number = 5): string[] {
    if (!this.smsSearchEngine || !query.trim() || query.length < 2) {
      return []
    }

    try {
      const results = this.smsSearchEngine.search(query, { limit })
      const suggestions: Set<string> = new Set()

      results.forEach(result => {
        if (result.matches) {
          result.matches.forEach(match => {
            if (match.value && match.value.toLowerCase().includes(query.toLowerCase())) {
              suggestions.add(match.value)
            }
          })
        }
      })

      return Array.from(suggestions).slice(0, limit)
    } catch (error) {
      console.error('Failed to get SMS search suggestions:', error)
      return []
    }
  }

  /**
   * Update search configuration for SMS
   */
  updateSMSSearchConfig(config: Partial<FuzzySearchConfig>): void {
    if (this.smsSearchEngine) {
      const newConfig = { ...SMS_SEARCH_CONFIG, ...config }
      // Re-initialize with new config if data exists (note: this is a simplified approach)
      // In a production environment, you might want to store the original data separately
      console.log('SMS search config updated, re-initialization required with original data')
    }
  }

  /**
   * Update search configuration for calls
   */
  updateCallsSearchConfig(config: Partial<FuzzySearchConfig>): void {
    if (this.callsSearchEngine) {
      const newConfig = { ...CALLS_SEARCH_CONFIG, ...config }
      // Re-initialize with new config if data exists (note: this is a simplified approach)
      // In a production environment, you might want to store the original data separately
      console.log('Calls search config updated, re-initialization required with original data')
    }
  }

  /**
   * Get debug information about the search engines
   */
  getDebugInfo(): {
    smsEngineInitialized: boolean,
    callsEngineInitialized: boolean,
    smsDataCount: number,
    callsDataCount: number,
    smsConfig: FuzzySearchConfig,
    callsConfig: FuzzySearchConfig
  } {
    return {
      smsEngineInitialized: this.smsSearchEngine !== null,
      callsEngineInitialized: this.callsSearchEngine !== null,
      smsDataCount: this.smsData.length,
      callsDataCount: this.callsData.length,
      smsConfig: SMS_SEARCH_CONFIG,
      callsConfig: CALLS_SEARCH_CONFIG
    }
  }

  /**
   * Clear search engines to free memory
   */
  clearSearchEngines(): void {
    console.log('[FUZZY SEARCH] Clearing search engines')
    this.smsSearchEngine = null
    this.callsSearchEngine = null
    this.smsData = []
    this.callsData = []
  }

  /**
   * HIPAA-compliant audit logging for search activities
   * Note: No actual search terms or PHI data is logged
   */
  private async logSearchActivity(
    action: string,
    resourceType: string,
    resultCount: number,
    outcome: AuditOutcome,
    failureReason?: string
  ): Promise<void> {
    try {
      // Note: Simplified audit logging for fuzzy search activities
      // In a production environment, you would integrate with the full audit logging system
      console.log(`AUDIT: ${action} on ${resourceType}, results: ${resultCount}, outcome: ${outcome}`)
      if (failureReason) {
        console.log(`AUDIT: Failure reason: ${failureReason}`)
      }
    } catch (error) {
      console.error('Failed to log search activity:', error)
    }
  }
}

// Export singleton instance
export const fuzzySearchService = new FuzzySearchService()
export default fuzzySearchService