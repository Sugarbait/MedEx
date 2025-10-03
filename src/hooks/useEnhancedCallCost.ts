/**
 * useEnhancedCallCost Hook
 *
 * Optional enhancement hook that fetches real Twilio API data for call costs.
 * Falls back gracefully to calculation if API unavailable.
 * Can be used alongside existing cost calculations without breaking anything.
 */

import { useState, useEffect } from 'react'
import { enhancedCostService, type EnhancedCallCost } from '@/services/enhancedCostService'
import type { RetellCall } from '@/services/retellService'

export function useEnhancedCallCost(call: RetellCall | null) {
  const [enhancedCost, setEnhancedCost] = useState<EnhancedCallCost | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!call) {
      setEnhancedCost(null)
      return
    }

    let cancelled = false

    const fetchCost = async () => {
      setLoading(true)
      try {
        const cost = await enhancedCostService.getEnhancedCallCost(call)
        if (!cancelled) {
          setEnhancedCost(cost)
        }
      } catch (error) {
        console.error('Failed to fetch enhanced cost:', error)
        if (!cancelled) {
          setEnhancedCost(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCost()

    return () => {
      cancelled = true
    }
  }, [call?.call_id])

  return { enhancedCost, loading }
}

/**
 * Batch version for multiple calls
 */
export function useEnhancedCallCostsBatch(calls: RetellCall[]) {
  const [costsMap, setCostsMap] = useState<Map<string, EnhancedCallCost>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (calls.length === 0) {
      setCostsMap(new Map())
      return
    }

    let cancelled = false

    const fetchCosts = async () => {
      setLoading(true)
      try {
        const costs = await enhancedCostService.getEnhancedCallCostsBatch(calls)
        if (!cancelled) {
          setCostsMap(costs)
        }
      } catch (error) {
        console.error('Failed to fetch enhanced costs:', error)
        if (!cancelled) {
          setCostsMap(new Map())
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCosts()

    return () => {
      cancelled = true
    }
  }, [calls.map(c => c.call_id).join(',')])

  return { costsMap, loading }
}
