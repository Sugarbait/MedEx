import { useState, useEffect, useRef, useCallback } from 'react'
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
      loadingOperationsRef.current.clear()
    }
  }, [])

  /**
   * Calculate SMS cost for a chat using available chat data
   */
  const calculateChatCost = useCallback(async (chat: Chat): Promise<number> => {
    try {

      // Use the messages already available in the chat object
      const messages = chat.message_with_tool_calls || []

      if (messages.length > 0) {
        // Use actual messages if available
        return twilioCostService.getSMSCostCAD(messages)
      } else {
        // Fallback to realistic estimation based on typical SMS patterns
        // Most SMS chats follow this pattern: user query + AI response + confirmation + final response
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
    } catch (error) {
      console.error(`Failed to calculate cost for ${chat.chat_id}:`, error)
      return 0
    }
  }, [])

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
      // Calculate costs directly using available chat data
      for (const chat of backgroundChats) {
        if (!mountedRef.current) return

        try {
          const cost = await calculateChatCost(chat)

          if (!mountedRef.current) return

          setState(prev => {
            const newCosts = new Map(prev.costs)
            newCosts.set(chat.chat_id, cost)
            return { ...prev, costs: newCosts }
          })

        } catch (error) {
          console.warn(`Failed to calculate cost for background chat ${chat.chat_id}:`, error)
        } finally {
          loadingOperationsRef.current.delete(chat.chat_id)
        }

        // Small delay between calculations to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10))
      }

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
    return {
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