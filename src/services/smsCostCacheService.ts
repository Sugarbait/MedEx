import { chatService } from './chatService'
import { twilioCostService } from './index'
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

  // Cache expiry time (5 minutes)
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000

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

      // Calculate SMS cost using actual messages
      const smsCost = twilioCostService.getSMSCostCAD(fullChat.message_with_tool_calls || [])
      return smsCost
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