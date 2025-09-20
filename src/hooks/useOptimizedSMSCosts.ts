import { useState, useEffect, useRef, useCallback } from 'react'
import { optimizedApiService } from '@/services/optimizedApiService'
import { chatService } from '@/services/chatService'
import { twilioCostService } from '@/services/twilioCostService'
import type { Chat } from '@/services/chatService'

interface SMSCostState {
  costs: Map<string, number>
  loadingCosts: Set<string>
  totalCost: number
  averageCost: number
  isLoading: boolean
  error: string | null
  progress: { loaded: number; total: number } | null
}

interface OptimizedSMSCostOptions {
  visibleChatsOnly?: boolean
  backgroundPriority?: 'high' | 'medium' | 'low'
  maxConcurrentRequests?: number
  cacheTimeout?: number
  onProgress?: (loaded: number, total: number) => void
}

/**
 * Optimized SMS cost manager with intelligent loading strategies
 *
 * Features:
 * - Lazy loading (visible costs first)
 * - Background loading for non-visible costs
 * - Request deduplication
 * - Intelligent batching
 * - Priority-based loading
 * - Progress tracking
 */
export function useOptimizedSMSCosts(options: OptimizedSMSCostOptions = {}) {
  const {
    visibleChatsOnly = false,
    backgroundPriority = 'low',
    maxConcurrentRequests = 5,
    cacheTimeout = 5 * 60 * 1000, // 5 minutes
    onProgress
  } = options

  const [state, setState] = useState<SMSCostState>({
    costs: new Map(),
    loadingCosts: new Set(),
    totalCost: 0,
    averageCost: 0,
    isLoading: false,
    error: null,
    progress: null
  })

  const mountedRef = useRef(true)
  const loadingOperationsRef = useRef(new Set<string>())

  // Track what we've attempted to load to avoid duplicates
  const attemptedLoadsRef = useRef(new Set<string>())

  useEffect(() => {
    return () => {
      mountedRef.current = false
      // Cancel all ongoing operations
      optimizedApiService.cancelAllRequests()
    }
  }, [])

  /**
   * Calculate SMS cost for a chat using cached data when possible
   */
  const calculateChatCost = useCallback(async (chat: Chat): Promise<number> => {
    try {
      // Try to get full chat data with messages for accurate cost calculation
      const fullChat = await optimizedApiService.request<Chat>(
        `/api/chat/${chat.chat_id}`,
        {
          priority: 'medium',
          cacheTTL: cacheTimeout,
          timeout: 15000
        }
      )

      const messages = fullChat.message_with_tool_calls || []
      return twilioCostService.getSMSCostCAD(messages)
    } catch (error) {
      console.warn(`Failed to get detailed cost for ${chat.chat_id}, using estimation:`, error)

      // Fallback to estimation based on available data
      let estimatedMessages = 2
      if (chat.end_timestamp && chat.start_timestamp) {
        const durationMinutes = (chat.end_timestamp - chat.start_timestamp) / 60
        estimatedMessages = Math.max(2, Math.ceil(durationMinutes * 2))
      }
      estimatedMessages = Math.min(estimatedMessages, 20)

      const mockMessages = Array(estimatedMessages).fill(null).map((_, i) => ({
        content: 'Average SMS message for cost estimation',
        role: i % 2 === 0 ? 'user' : 'agent'
      }))

      return twilioCostService.getSMSCostCAD(mockMessages)
    }
  }, [cacheTimeout])

  /**
   * Load costs for visible chats with high priority
   */
  const loadVisibleCosts = useCallback(async (chats: Chat[]): Promise<void> => {
    if (!mountedRef.current || chats.length === 0) return

    const chatsToLoad = chats.filter(chat =>
      !state.costs.has(chat.chat_id) &&
      !loadingOperationsRef.current.has(chat.chat_id)
    )

    if (chatsToLoad.length === 0) return

    console.log(`[OptimizedSMSCosts] Loading visible costs for ${chatsToLoad.length} chats`)

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: { loaded: 0, total: chatsToLoad.length }
    }))

    // Mark as loading
    chatsToLoad.forEach(chat => {
      loadingOperationsRef.current.add(chat.chat_id)
      setState(prev => ({
        ...prev,
        loadingCosts: new Set(prev.loadingCosts).add(chat.chat_id)
      }))
    })

    try {
      // Batch load with high priority for visible chats
      const requests = chatsToLoad.map(chat => ({
        chat,
        request: () => calculateChatCost(chat)
      }))

      let loaded = 0
      const batchSize = Math.min(maxConcurrentRequests, 3) // Conservative for visible chats

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize)

        const batchPromises = batch.map(async ({ chat, request }) => {
          try {
            const cost = await request()

            if (!mountedRef.current) return

            setState(prev => {
              const newCosts = new Map(prev.costs)
              const newLoadingCosts = new Set(prev.loadingCosts)

              newCosts.set(chat.chat_id, cost)
              newLoadingCosts.delete(chat.chat_id)

              return {
                ...prev,
                costs: newCosts,
                loadingCosts: newLoadingCosts,
                progress: { loaded: loaded + 1, total: chatsToLoad.length }
              }
            })

            loaded++
            onProgress?.(loaded, chatsToLoad.length)

            return { chatId: chat.chat_id, cost }
          } catch (error) {
            console.error(`Failed to load cost for visible chat ${chat.chat_id}:`, error)

            if (!mountedRef.current) return

            setState(prev => ({
              ...prev,
              loadingCosts: new Set(prev.loadingCosts).delete(chat.chat_id) ? new Set(prev.loadingCosts) : prev.loadingCosts
            }))

            loaded++
            return { chatId: chat.chat_id, cost: 0 }
          } finally {
            loadingOperationsRef.current.delete(chat.chat_id)
          }
        })

        await Promise.all(batchPromises)

        // Small delay between batches to prevent overwhelming
        if (i + batchSize < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

    } catch (error) {
      if (!mountedRef.current) return

      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load SMS costs',
        isLoading: false
      }))
    } finally {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          progress: null
        }))
      }
    }
  }, [state.costs, calculateChatCost, maxConcurrentRequests, onProgress])

  /**
   * Load costs for background chats with lower priority
   */
  const loadBackgroundCosts = useCallback(async (chats: Chat[]): Promise<void> => {
    if (!mountedRef.current || chats.length === 0 || visibleChatsOnly) return

    const chatsToLoad = chats.filter(chat =>
      !state.costs.has(chat.chat_id) &&
      !loadingOperationsRef.current.has(chat.chat_id) &&
      !attemptedLoadsRef.current.has(chat.chat_id)
    )

    if (chatsToLoad.length === 0) return

    // Limit background loading to prevent excessive API usage
    const maxBackgroundLoads = Math.min(chatsToLoad.length, 20)
    const backgroundChats = chatsToLoad.slice(0, maxBackgroundLoads)

    console.log(`[OptimizedSMSCosts] Loading background costs for ${backgroundChats.length} chats`)

    // Mark as attempted
    backgroundChats.forEach(chat => {
      attemptedLoadsRef.current.add(chat.chat_id)
      loadingOperationsRef.current.add(chat.chat_id)
    })

    try {
      // Use optimized API service for batch requests with low priority
      const requests = backgroundChats.map(chat => ({
        url: `/api/chat/${chat.chat_id}`,
        options: {
          priority: backgroundPriority,
          cacheTTL: cacheTimeout,
          timeout: 30000,
          backgroundRequest: true
        }
      }))

      const results = await optimizedApiService.batchRequests<Chat>(requests, {
        maxConcurrency: 3, // Very conservative for background
        delayBetweenBatches: 500, // Longer delay for background
        priority: backgroundPriority
      })

      // Process results
      results.forEach((result, index) => {
        if (!mountedRef.current) return

        const chat = backgroundChats[index]
        loadingOperationsRef.current.delete(chat.chat_id)

        if (result instanceof Error) {
          console.warn(`Background cost load failed for ${chat.chat_id}:`, result)
          return
        }

        try {
          const messages = (result as Chat).message_with_tool_calls || []
          const cost = twilioCostService.getSMSCostCAD(messages)

          setState(prev => {
            const newCosts = new Map(prev.costs)
            newCosts.set(chat.chat_id, cost)
            return { ...prev, costs: newCosts }
          })
        } catch (error) {
          console.warn(`Failed to calculate cost for background chat ${chat.chat_id}:`, error)
        }
      })

    } catch (error) {
      console.warn('Background cost loading failed:', error)
      // Clean up loading states
      backgroundChats.forEach(chat => {
        loadingOperationsRef.current.delete(chat.chat_id)
      })
    }
  }, [state.costs, backgroundPriority, cacheTimeout, visibleChatsOnly])

  /**
   * Recalculate totals when costs change
   */
  useEffect(() => {
    if (state.costs.size === 0) return

    const totalCost = Array.from(state.costs.values()).reduce((sum, cost) => sum + cost, 0)
    const averageCost = totalCost / state.costs.size

    setState(prev => ({
      ...prev,
      totalCost,
      averageCost
    }))
  }, [state.costs])

  /**
   * Get cost for a specific chat
   */
  const getChatCost = useCallback((chatId: string): { cost: number; loading: boolean } => {
    return {
      cost: state.costs.get(chatId) || 0,
      loading: state.loadingCosts.has(chatId)
    }
  }, [state.costs, state.loadingCosts])

  /**
   * Clear all costs and cache
   */
  const clearCosts = useCallback(() => {
    optimizedApiService.clearCache('chat')
    loadingOperationsRef.current.clear()
    attemptedLoadsRef.current.clear()

    setState({
      costs: new Map(),
      loadingCosts: new Set(),
      totalCost: 0,
      averageCost: 0,
      isLoading: false,
      error: null,
      progress: null
    })
  }, [])

  /**
   * Get loading statistics
   */
  const getStats = useCallback(() => {
    const apiStats = optimizedApiService.getStats()
    return {
      ...apiStats,
      costs: {
        cached: state.costs.size,
        loading: state.loadingCosts.size,
        total: state.costs.size + state.loadingCosts.size
      }
    }
  }, [state.costs.size, state.loadingCosts.size])

  return {
    // State
    costs: state.costs,
    loadingCosts: state.loadingCosts,
    totalCost: state.totalCost,
    averageCost: state.averageCost,
    isLoading: state.isLoading,
    error: state.error,
    progress: state.progress,

    // Actions
    loadVisibleCosts,
    loadBackgroundCosts,
    getChatCost,
    clearCosts,
    getStats
  }
}