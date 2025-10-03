/**
 * Enhanced Call Cost Display Component
 *
 * Fetches and displays accurate Twilio API costs when available,
 * falls back to calculation if API unavailable.
 */

import React, { useEffect, useState } from 'react'
import { enhancedCostService } from '@/services/enhancedCostService'
import type { RetellCall } from '@/services/retellService'

interface EnhancedCallCostProps {
  call: RetellCall
  className?: string
}

export function EnhancedCallCost({ call, className = '' }: EnhancedCallCostProps) {
  const [cost, setCost] = useState<string>('Loading...')
  const [isApiData, setIsApiData] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchCost = async () => {
      try {
        const enhancedCost = await enhancedCostService.getEnhancedCallCost(call)

        if (!cancelled) {
          if (enhancedCost.error) {
            setCost('Cost unavailable')
          } else {
            setCost(`CAD $${enhancedCost.totalCostCAD.toFixed(3)}`)
            setIsApiData(enhancedCost.isActualData)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCost('Cost unavailable')
        }
      }
    }

    fetchCost()

    return () => {
      cancelled = true
    }
  }, [call.call_id])

  return (
    <span className={className} title={isApiData ? 'Using real Twilio API data' : 'Calculated estimate'}>
      {cost}
      {isApiData && <span className="ml-1 text-green-600">✓</span>}
    </span>
  )
}

/**
 * Batch version for displaying multiple call costs efficiently
 */
interface EnhancedCallCostBatchProps {
  calls: RetellCall[]
  renderCost: (callId: string, cost: string, isApiData: boolean) => React.ReactNode
}

export function EnhancedCallCostBatch({ calls, renderCost }: EnhancedCallCostBatchProps) {
  const [costs, setCosts] = useState<Map<string, { cost: string; isApiData: boolean }>>(new Map())

  useEffect(() => {
    let cancelled = false

    const fetchCosts = async () => {
      try {
        const enhancedCosts = await enhancedCostService.getEnhancedCallCostsBatch(calls)

        if (!cancelled) {
          const newCosts = new Map<string, { cost: string; isApiData: boolean }>()

          enhancedCosts.forEach((enhancedCost, callId) => {
            if (enhancedCost.error) {
              newCosts.set(callId, { cost: 'Cost unavailable', isApiData: false })
            } else {
              newCosts.set(callId, {
                cost: `CAD $${enhancedCost.totalCostCAD.toFixed(3)}`,
                isApiData: enhancedCost.isActualData
              })
            }
          })

          setCosts(newCosts)
        }
      } catch (error) {
        console.error('Failed to fetch batch costs:', error)
      }
    }

    if (calls.length > 0) {
      fetchCosts()
    }

    return () => {
      cancelled = true
    }
  }, [calls.map(c => c.call_id).join(',')])

  return (
    <>
      {calls.map(call => {
        const costData = costs.get(call.call_id)
        return renderCost(
          call.call_id,
          costData?.cost || 'Loading...',
          costData?.isApiData || false
        )
      })}
    </>
  )
}
