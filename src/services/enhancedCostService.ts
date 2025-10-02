/**
 * Enhanced Cost Service
 *
 * Combines actual Twilio API data with Retell AI costs for accurate billing.
 * Falls back gracefully to calculations if API data unavailable.
 *
 * Features:
 * - Fetches real Twilio call costs and durations
 * - Combines Twilio + Retell AI costs
 * - Converts all costs to CAD with live exchange rates
 * - Graceful fallback to calculations if APIs fail
 * - Customer-facing display (no service names shown)
 */

import { twilioApiService } from './twilioApiService'
import { twilioCostService } from './twilioCostService'
import { currencyService } from './currencyService'
import type { RetellCall } from './retellService'

export interface EnhancedCallCost {
  // Twilio costs (voice call)
  twilioVoiceCostUSD: number
  twilioVoiceCostCAD: number
  twilioVoiceDuration: number // seconds
  twilioDataAvailable: boolean

  // Retell AI costs (AI processing)
  retellCostUSD: number
  retellCostCAD: number
  retellDataAvailable: boolean

  // Combined totals
  totalCostUSD: number
  totalCostCAD: number

  // Status
  isActualData: boolean // true if using API data, false if calculated
  error?: string
}

class EnhancedCostService {
  /**
   * Get enhanced call cost with Twilio API data
   * Falls back to calculation if API unavailable
   */
  public async getEnhancedCallCost(call: RetellCall): Promise<EnhancedCallCost> {
    try {
      // Extract Retell AI cost (already in cents)
      const retellCostCents = call.call_cost?.combined_cost || 0
      const retellCostUSD = retellCostCents / 100
      const retellCostCAD = currencyService.convertUSDToCAD(retellCostUSD)

      // Try to get Twilio API data if Call SID is available
      const twilioCallSid = call.telephony_identifier?.twilio_call_sid

      if (twilioCallSid && twilioApiService.isConfigured()) {
        // Fetch actual Twilio data
        const twilioData = await twilioApiService.getCallDetails(twilioCallSid)

        if (twilioData) {
          // Successfully got Twilio API data
          const twilioVoiceCostUSD = twilioData.price
          const twilioVoiceCostCAD = currencyService.convertUSDToCAD(twilioVoiceCostUSD)
          const twilioVoiceDuration = twilioData.duration

          return {
            twilioVoiceCostUSD,
            twilioVoiceCostCAD,
            twilioVoiceDuration,
            twilioDataAvailable: true,
            retellCostUSD,
            retellCostCAD,
            retellDataAvailable: retellCostCents > 0,
            totalCostUSD: twilioVoiceCostUSD + retellCostUSD,
            totalCostCAD: twilioVoiceCostCAD + retellCostCAD,
            isActualData: true
          }
        }
      }

      // Fallback: Use calculation method
      const durationSeconds = call.duration_ms ? Math.ceil(call.duration_ms / 1000) : 0
      const twilioBreakdown = twilioCostService.getDetailedBreakdown(durationSeconds)

      return {
        twilioVoiceCostUSD: twilioBreakdown.costUSD,
        twilioVoiceCostCAD: twilioBreakdown.costCAD,
        twilioVoiceDuration: durationSeconds,
        twilioDataAvailable: false,
        retellCostUSD,
        retellCostCAD,
        retellDataAvailable: retellCostCents > 0,
        totalCostUSD: twilioBreakdown.costUSD + retellCostUSD,
        totalCostCAD: twilioBreakdown.costCAD + retellCostCAD,
        isActualData: false
      }

    } catch (error) {
      console.error('💰 Enhanced cost calculation failed:', error)

      // Ultimate fallback: Return zero costs with error
      return {
        twilioVoiceCostUSD: 0,
        twilioVoiceCostCAD: 0,
        twilioVoiceDuration: 0,
        twilioDataAvailable: false,
        retellCostUSD: 0,
        retellCostCAD: 0,
        retellDataAvailable: false,
        totalCostUSD: 0,
        totalCostCAD: 0,
        isActualData: false,
        error: error instanceof Error ? error.message : 'Cost calculation failed'
      }
    }
  }

  /**
   * Batch process multiple calls for better performance
   */
  public async getEnhancedCallCostsBatch(calls: RetellCall[]): Promise<Map<string, EnhancedCallCost>> {
    const results = new Map<string, EnhancedCallCost>()

    // Extract Call SIDs for batch fetching
    const callSidsMap = new Map<string, string>() // call_id -> twilio_call_sid
    calls.forEach(call => {
      const sid = call.telephony_identifier?.twilio_call_sid
      if (sid) {
        callSidsMap.set(call.call_id, sid)
      }
    })

    // Fetch all Twilio data in batch if available
    let twilioDataMap = new Map()
    if (callSidsMap.size > 0 && twilioApiService.isConfigured()) {
      const sids = Array.from(callSidsMap.values())
      twilioDataMap = await twilioApiService.getMultipleCalls(sids)
    }

    // Process each call
    for (const call of calls) {
      const retellCostCents = call.call_cost?.combined_cost || 0
      const retellCostUSD = retellCostCents / 100
      const retellCostCAD = currencyService.convertUSDToCAD(retellCostUSD)

      const twilioSid = callSidsMap.get(call.call_id)
      const twilioData = twilioSid ? twilioDataMap.get(twilioSid) : null

      if (twilioData) {
        // Use actual Twilio data
        results.set(call.call_id, {
          twilioVoiceCostUSD: twilioData.price,
          twilioVoiceCostCAD: currencyService.convertUSDToCAD(twilioData.price),
          twilioVoiceDuration: twilioData.duration,
          twilioDataAvailable: true,
          retellCostUSD,
          retellCostCAD,
          retellDataAvailable: retellCostCents > 0,
          totalCostUSD: twilioData.price + retellCostUSD,
          totalCostCAD: currencyService.convertUSDToCAD(twilioData.price) + retellCostCAD,
          isActualData: true
        })
      } else {
        // Fallback to calculation
        const durationSeconds = call.duration_ms ? Math.ceil(call.duration_ms / 1000) : 0
        const twilioBreakdown = twilioCostService.getDetailedBreakdown(durationSeconds)

        results.set(call.call_id, {
          twilioVoiceCostUSD: twilioBreakdown.costUSD,
          twilioVoiceCostCAD: twilioBreakdown.costCAD,
          twilioVoiceDuration: durationSeconds,
          twilioDataAvailable: false,
          retellCostUSD,
          retellCostCAD,
          retellDataAvailable: retellCostCents > 0,
          totalCostUSD: twilioBreakdown.costUSD + retellCostUSD,
          totalCostCAD: twilioBreakdown.costCAD + retellCostCAD,
          isActualData: false
        })
      }
    }

    return results
  }

  /**
   * Format cost for customer-facing display (no service names)
   */
  public formatCustomerCost(costCAD: number): string {
    if (costCAD === 0) {
      return 'Cost unavailable'
    }
    return `$${costCAD.toFixed(2)} CAD`
  }

  /**
   * Get cost breakdown message for debugging
   */
  public getCostBreakdownMessage(cost: EnhancedCallCost): string {
    if (cost.error) {
      return `Cost calculation error: ${cost.error}`
    }

    const dataSource = cost.isActualData ? 'Actual API data' : 'Calculated estimate'

    return `${dataSource} - Voice: $${cost.twilioVoiceCostCAD.toFixed(4)} + AI: $${cost.retellCostCAD.toFixed(4)} = $${cost.totalCostCAD.toFixed(4)} CAD`
  }
}

// Export singleton instance
export const enhancedCostService = new EnhancedCostService()
export default enhancedCostService
