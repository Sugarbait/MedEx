import { chatService } from './chatService'
import { twilioCostService, twilioApiService, currencyService } from './index'
import type { Chat } from './chatService'

interface CostCacheEntry {
  cost: number
  timestamp: number
  loading: boolean
}

interface LoadingPromise {
  promise: Promise<number>
  abortController: AbortController
}

/**
 * Singleton service to manage SMS cost caching and prevent duplicate loading
 * across multiple component instances during HMR or concurrent operations
 */
class SMSCostCacheService {
  private static instance: SMSCostCacheService | null = null
  private costCache = new Map<string, CostCacheEntry>()
  private loadingPromises = new Map<string, LoadingPromise>()
  private instanceId: string
  private subscribers = new Set<(chatId: string, cost: number, loading: boolean) => void>()

  // Cache expiry time (1 second to force recalculation with new $0.03 fee)
  private readonly CACHE_EXPIRY_MS = 1 * 1000

  private constructor() {
    this.instanceId = `sms-cost-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log(`[SMSCostCache] New instance created: ${this.instanceId}`)
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SMSCostCacheService {
    if (!SMSCostCacheService.instance) {
      SMSCostCacheService.instance = new SMSCostCacheService()
    }
    return SMSCostCacheService.instance
  }

  /**
   * Subscribe to cost updates
   */
  subscribe(callback: (chatId: string, cost: number, loading: boolean) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Notify all subscribers of cost updates
   */
  private notifySubscribers(chatId: string, cost: number, loading: boolean) {
    this.subscribers.forEach(callback => {
      try {
        callback(chatId, cost, loading)
      } catch (error) {
        console.error('[SMSCostCache] Error in subscriber callback:', error)
      }
    })
  }

  /**
   * Get cached cost for a chat
   */
  getChatCost(chatId: string): { cost: number; loading: boolean; cached: boolean } {
    const entry = this.costCache.get(chatId)

    if (!entry) {
      return { cost: 0, loading: false, cached: false }
    }

    // Check if cache is expired
    const isExpired = Date.now() - entry.timestamp > this.CACHE_EXPIRY_MS
    if (isExpired && !entry.loading) {
      this.costCache.delete(chatId)
      return { cost: 0, loading: false, cached: false }
    }

    return {
      cost: entry.cost,
      loading: entry.loading,
      cached: !entry.loading
    }
  }

  /**
   * Load SMS cost for a single chat with singleton pattern
   */
  async loadChatCost(chat: Chat): Promise<number> {
    const chatId = chat.chat_id

    // Check if already in cache and not expired
    const cached = this.getChatCost(chatId)
    if (cached.cached) {
      console.log(`[SMSCostCache] Using cached cost for ${chatId}: CAD $${cached.cost.toFixed(4)}`)
      return cached.cost
    }

    // Check if already loading
    const existingLoad = this.loadingPromises.get(chatId)
    if (existingLoad) {
      console.log(`[SMSCostCache] Joining existing load for ${chatId}`)
      try {
        return await existingLoad.promise
      } catch (error) {
        // If the existing promise fails, we'll create a new one below
        console.warn(`[SMSCostCache] Existing load failed for ${chatId}, creating new load:`, error)
        this.loadingPromises.delete(chatId)
      }
    }

    // Create new loading operation
    const abortController = new AbortController()
    const loadPromise = this._loadChatCostInternal(chat, abortController.signal)

    this.loadingPromises.set(chatId, {
      promise: loadPromise,
      abortController
    })

    // Set loading state
    this.costCache.set(chatId, {
      cost: 0,
      timestamp: Date.now(),
      loading: true
    })
    this.notifySubscribers(chatId, 0, true)

    try {
      const cost = await loadPromise

      // Update cache with result
      this.costCache.set(chatId, {
        cost,
        timestamp: Date.now(),
        loading: false
      })

      this.notifySubscribers(chatId, cost, false)
      console.log(`[SMSCostCache] Loaded cost for ${chatId}: CAD $${cost.toFixed(4)}`)
      return cost
    } catch (error) {
      // Remove loading state on error
      this.costCache.delete(chatId)
      this.notifySubscribers(chatId, 0, false)

      if (error.name === 'AbortError') {
        console.log(`[SMSCostCache] Load aborted for ${chatId}`)
        throw error
      }

      console.error(`[SMSCostCache] Failed to load cost for ${chatId}:`, error)
      throw error
    } finally {
      this.loadingPromises.delete(chatId)
    }
  }

  /**
   * Internal method to actually load the cost
   */
  private async _loadChatCostInternal(chat: Chat, signal: AbortSignal): Promise<number> {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      // Get full chat details with all messages
      const fullChat = await chatService.getChatById(chat.chat_id)

      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      // Get Retell AI chat cost from API response (in cents)
      const retellChatCostCents = fullChat.chat_cost?.combined_cost ?? fullChat.chat_cost?.total_cost ?? 0
      const retellChatCostUSD = retellChatCostCents / 100

      // If Retell AI cost is $0, add flat $0.03 USD fee for chat service
      const retellChatCostWithFee = retellChatCostUSD > 0 ? retellChatCostUSD : 0.03
      const retellChatCostCAD = currencyService.convertUSDToCAD(retellChatCostWithFee)

      if (retellChatCostUSD === 0) {
        console.log(`💵 [SMSCostCache] Added $0.03 USD Retell AI fee for chat ${chat.chat_id} → $${retellChatCostCAD.toFixed(4)} CAD`)
      }

      // Try to get real Twilio SMS costs from API if phone number available
      let twilioSMSCostCAD = 0
      let usedTwilioAPI = false

      const phoneNumber = this.extractPhoneNumber(fullChat)

      if (phoneNumber && twilioApiService.isConfigured()) {
        try {
          // Get date range for this chat
          const startDate = new Date(fullChat.start_timestamp)
          const endDate = fullChat.end_timestamp ? new Date(fullChat.end_timestamp) : new Date()

          // Query Twilio API for actual SMS costs
          const twilioData = await twilioApiService.getConversationCost({
            phoneNumber,
            startDate,
            endDate
          })

          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }

          if (twilioData.totalMessages > 0) {
            // Got real data from Twilio!
            twilioSMSCostCAD = currencyService.convertUSDToCAD(twilioData.totalCostUSD)
            usedTwilioAPI = true

            console.log(`💰 [SMSCostCache] Using Twilio API data for chat ${chat.chat_id}:`, {
              phoneNumber,
              messages: twilioData.totalMessages,
              segments: twilioData.totalSegments,
              costUSD: twilioData.totalCostUSD.toFixed(6),
              costCAD: twilioSMSCostCAD.toFixed(6)
            })
          }
        } catch (error) {
          console.warn(`[SMSCostCache] Twilio API failed for ${chat.chat_id}, falling back to calculation:`, error)
        }
      }

      // Fallback: Use calculation if Twilio API not available or failed
      if (!usedTwilioAPI) {
        twilioSMSCostCAD = twilioCostService.getSMSCostCAD(fullChat.message_with_tool_calls || [])
      }

      // Combined cost: Twilio SMS + Retell AI Chat
      const combinedCost = twilioSMSCostCAD + retellChatCostCAD

      console.log(`[SMSCostCache] Combined cost breakdown for ${chat.chat_id}:`, {
        source: usedTwilioAPI ? 'Twilio API' : 'Calculation',
        twilioSMSCostCAD: twilioSMSCostCAD.toFixed(6),
        retellChatCostCAD: retellChatCostCAD.toFixed(6),
        retellChatCostUSD: retellChatCostUSD.toFixed(6),
        retellChatCostWithFee: retellChatCostWithFee.toFixed(6),
        feeAdded: retellChatCostUSD === 0 ? 'YES ($0.03)' : 'NO (API had cost)',
        combinedTotalCAD: combinedCost.toFixed(6)
      })

      return combinedCost
    } catch (error) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      // Use realistic estimation as fallback based on actual conversation patterns
      console.warn(`[SMSCostCache] Using fallback estimation for ${chat.chat_id}:`, error)

      // Use realistic conversation templates that match actual SMS patterns
      const estimatedMessages = [
        {
          content: 'User provided enrollment details and personal information for health services',
          role: 'user'
        },
        {
          content: 'Thank you for the details! I have formatted what you sent and filled in likely corrections. Please review and confirm if this is correct: Full Name, Date of Birth, Health Card Number (first 10 digits), Version Code, Sex (as on health card), Phone Number, Email Address. Is everything above correct? If yes, I will proceed with your enrollment. If anything is off, please resend with the corrected information in one line.',
          role: 'agent'
        },
        {
          content: 'Yes it is correct',
          role: 'user'
        },
        {
          content: 'Thanks! We have received your enrollment details. A CareXPS team member will review and reach out with next steps. Have a great day!',
          role: 'agent'
        }
      ]

      return twilioCostService.getSMSCostCAD(estimatedMessages)
    }
  }

  /**
   * Load costs for multiple chats efficiently
   */
  async loadMultipleChatCosts(chats: Chat[], onProgress?: (loaded: number, total: number) => void): Promise<Record<string, number>> {
    const results: Record<string, number> = {}
    let loadedCount = 0

    // Filter chats that need loading
    const chatsToLoad = chats.filter(chat => {
      const cached = this.getChatCost(chat.chat_id)
      if (cached.cached) {
        results[chat.chat_id] = cached.cost
        return false
      }
      return true
    })

    console.log(`[SMSCostCache] Loading ${chatsToLoad.length} of ${chats.length} chat costs (${Object.keys(results).length} cached)`)

    // Load costs with controlled concurrency (adjust batch size based on total chats)
    // Larger batches for big date ranges, smaller for safety
    const BATCH_SIZE = chatsToLoad.length > 100 ? 8 : 5
    for (let i = 0; i < chatsToLoad.length; i += BATCH_SIZE) {
      const batch = chatsToLoad.slice(i, i + BATCH_SIZE)

      const batchPromises = batch.map(async (chat) => {
        try {
          const cost = await this.loadChatCost(chat)
          results[chat.chat_id] = cost
          loadedCount++
          onProgress?.(loadedCount, chatsToLoad.length)
        } catch (error) {
          console.error(`[SMSCostCache] Failed to load cost for ${chat.chat_id}:`, error)
          results[chat.chat_id] = 0
          loadedCount++
          onProgress?.(loadedCount, chatsToLoad.length)
        }
      })

      await Promise.all(batchPromises)
    }

    console.log(`[SMSCostCache] Completed loading ${loadedCount} chat costs`)
    return results
  }

  /**
   * Extract phone number from chat metadata
   */
  private extractPhoneNumber(chat: Chat): string | null {
    // Try multiple possible phone number locations
    const possibleNumbers = [
      chat.metadata?.phone_number,
      chat.metadata?.customer_phone_number,
      chat.metadata?.from_phone_number,
      chat.metadata?.to_phone_number,
      chat.collected_dynamic_variables?.phone_number,
      chat.collected_dynamic_variables?.customer_phone_number
    ]

    for (const number of possibleNumbers) {
      if (number && typeof number === 'string' && number.length > 0) {
        // Clean and format phone number
        let cleaned = number.toString().replace(/[^\d+]/g, '')

        // Ensure it starts with +
        if (!cleaned.startsWith('+')) {
          if (cleaned.startsWith('1')) {
            cleaned = '+' + cleaned
          } else {
            cleaned = '+1' + cleaned
          }
        }

        return cleaned
      }
    }

    return null
  }

  /**
   * Cancel all loading operations for cleanup
   */
  cancelAllLoading(): void {
    console.log(`[SMSCostCache] Cancelling ${this.loadingPromises.size} loading operations`)

    this.loadingPromises.forEach((loadingOp, chatId) => {
      loadingOp.abortController.abort()
      // Update cache to remove loading state
      this.costCache.delete(chatId)
      this.notifySubscribers(chatId, 0, false)
    })

    this.loadingPromises.clear()
  }

  /**
   * Clear cache for specific date range (useful when date range changes)
   */
  clearCacheForDateRange(): void {
    console.log(`[SMSCostCache] Clearing cache and cancelling ongoing operations`)
    this.cancelAllLoading()
    this.costCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      instanceId: this.instanceId,
      cachedEntries: this.costCache.size,
      loadingOperations: this.loadingPromises.size,
      subscribers: this.subscribers.size
    }
  }

  /**
   * Clean up expired entries
   */
  cleanupExpiredEntries(): void {
    const now = Date.now()
    let cleanedCount = 0

    this.costCache.forEach((entry, chatId) => {
      if (now - entry.timestamp > this.CACHE_EXPIRY_MS && !entry.loading) {
        this.costCache.delete(chatId)
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      console.log(`[SMSCostCache] Cleaned up ${cleanedCount} expired cache entries`)
    }
  }
}

// Export singleton instance
export const smsCostCacheService = SMSCostCacheService.getInstance()