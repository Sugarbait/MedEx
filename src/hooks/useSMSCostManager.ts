import { useState, useEffect, useRef, useCallback } from 'react'
import { smsCostCacheService } from '@/services/smsCostCacheService'
import type { Chat } from '@/services/chatService'

interface SMSCostState {
  costs: Record<string, number>
  loadingCosts: Record<string, boolean>
  totalCost: number
  averageCost: number
  isLoading: boolean
  error: string | null
  progress: { loaded: number; total: number } | null
}

interface UseSMSCostManagerOptions {
  onProgress?: (loaded: number, total: number) => void
}

/**
 * Custom hook for managing SMS costs with proper cleanup and singleton loading
 */
export function useSMSCostManager(options: UseSMSCostManagerOptions = {}) {
  const [state, setState] = useState<SMSCostState>({
    costs: {},
    loadingCosts: {},
    totalCost: 0,
    averageCost: 0,
    isLoading: false,
    error: null,
    progress: null
  })

  const mountedRef = useRef(true)
  const instanceIdRef = useRef(`sms-cost-hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Store the onProgress callback in a ref to ensure stability
  const onProgressRef = useRef(options.onProgress)

  // Update the ref when options change
  useEffect(() => {
    onProgressRef.current = options.onProgress
  }, [options.onProgress])

  // Create a stable progress callback wrapper
  const progressCallback = useCallback((loaded: number, total: number) => {
    if (!mountedRef.current) return

    // Update progress state
    setState(prevState => ({
      ...prevState,
      progress: { loaded, total }
    }))

    // Call the original onProgress callback
    onProgressRef.current?.(loaded, total)
  }, [])

  // Subscribe to cost cache updates
  useEffect(() => {
    // CRITICAL FIX: Set mounted flag to true on every mount (handles React StrictMode remount)
    mountedRef.current = true
    console.log(`[useSMSCostManager] Initializing instance: ${instanceIdRef.current}`)

    const unsubscribe = smsCostCacheService.subscribe((chatId: string, cost: number, loading: boolean) => {
      if (!mountedRef.current) return

      setState(prevState => {
        const newCosts = { ...prevState.costs }
        const newLoadingCosts = { ...prevState.loadingCosts }

        if (loading) {
          newLoadingCosts[chatId] = true
        } else {
          newCosts[chatId] = cost
          delete newLoadingCosts[chatId]
        }

        // Recalculate totals
        const totalCost = Object.values(newCosts).reduce((sum, c) => sum + c, 0)
        const averageCost = Object.keys(newCosts).length > 0 ? totalCost / Object.keys(newCosts).length : 0

        return {
          ...prevState,
          costs: newCosts,
          loadingCosts: newLoadingCosts,
          totalCost,
          averageCost,
          isLoading: Object.keys(newLoadingCosts).length > 0
        }
      })
    })

    unsubscribeRef.current = unsubscribe

    return () => {
      console.log(`[useSMSCostManager] Cleanup for instance: ${instanceIdRef.current}`)
      unsubscribe()
      unsubscribeRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log(`[useSMSCostManager] Component unmounting, cancelling operations: ${instanceIdRef.current}`)
      mountedRef.current = false

      // Cancel any ongoing loading operations
      smsCostCacheService.cancelAllLoading()

      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  /**
   * Load costs for multiple chats
   */
  const loadCostsForChats = useCallback(async (chats: Chat[]) => {
    if (!mountedRef.current) return

    console.log(`[useSMSCostManager] Loading costs for ${chats.length} chats: ${instanceIdRef.current}`)

    setState(prevState => ({
      ...prevState,
      error: null,
      isLoading: true,
      progress: { loaded: 0, total: chats.length }
    }))

    try {
      // Initialize loading states for all chats
      const initialLoadingCosts: Record<string, boolean> = {}
      chats.forEach(chat => {
        const cached = smsCostCacheService.getChatCost(chat.chat_id)
        if (!cached.cached) {
          initialLoadingCosts[chat.chat_id] = true
        }
      })

      if (Object.keys(initialLoadingCosts).length > 0) {
        setState(prevState => ({
          ...prevState,
          loadingCosts: { ...prevState.loadingCosts, ...initialLoadingCosts }
        }))
      }

      const costs = await smsCostCacheService.loadMultipleChatCosts(chats, progressCallback)

      if (!mountedRef.current) return

      // Final state update will be handled by the subscriber
      setState(prevState => ({
        ...prevState,
        progress: null,
        isLoading: false
      }))

      console.log(`[useSMSCostManager] Successfully loaded costs for ${Object.keys(costs).length} chats`)

    } catch (error) {
      if (!mountedRef.current) return

      console.error(`[useSMSCostManager] Failed to load costs:`, error)
      setState(prevState => ({
        ...prevState,
        error: error instanceof Error ? error.message : 'Failed to load SMS costs',
        isLoading: false,
        loadingCosts: {},
        progress: null
      }))
    }
  }, [progressCallback]) // Add dependency on progressCallback

  /**
   * Clear all costs (useful when date range changes)
   */
  const clearCosts = useCallback(() => {
    console.log(`[useSMSCostManager] Clearing costs: ${instanceIdRef.current}`)

    smsCostCacheService.clearCacheForDateRange()

    setState({
      costs: {},
      loadingCosts: {},
      totalCost: 0,
      averageCost: 0,
      isLoading: false,
      error: null,
      progress: null
    })
  }, [])

  /**
   * Get cost for a specific chat
   */
  const getChatCost = useCallback((chatId: string): { cost: number; loading: boolean } => {
    return {
      cost: state.costs[chatId] || 0,
      loading: state.loadingCosts[chatId] || false
    }
  }, [state.costs, state.loadingCosts])

  /**
   * Load cost for a single chat
   */
  const loadChatCost = useCallback(async (chat: Chat): Promise<number> => {
    if (!mountedRef.current) return 0

    try {
      return await smsCostCacheService.loadChatCost(chat)
    } catch (error) {
      console.error(`[useSMSCostManager] Failed to load cost for chat ${chat.chat_id}:`, error)
      return 0
    }
  }, [])

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    return smsCostCacheService.getCacheStats()
  }, [])

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
    loadCostsForChats,
    clearCosts,
    getChatCost,
    loadChatCost,
    getCacheStats,

    // Metadata
    instanceId: instanceIdRef.current
  }
}