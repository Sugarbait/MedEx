/**
 * Optimized bulk SMS segment calculator
 *
 * This service calculates SMS segments for multiple chats WITHOUT making API calls
 * by using the message data that's already present in the chat objects.
 *
 * This is MUCH faster than fetching full chat data for each chat individually.
 */

import { twilioCostService } from './twilioCostService'

interface Chat {
  chat_id: string
  message_with_tool_calls?: Array<{ content: string; role: string }>
  transcript?: string
  start_timestamp: number
  end_timestamp?: number
}

interface BulkSegmentResult {
  chatId: string
  segments: number
  cached: boolean
  hasMessages: boolean
}

class BulkSegmentCalculator {
  /**
   * Calculate segments for multiple chats in bulk without API calls
   * Uses only the data already present in the chat objects
   */
  public calculateBulkSegments(chats: Chat[]): BulkSegmentResult[] {
    console.log(`📊 Bulk segment calculator: Processing ${chats.length} chats...`)
    const startTime = Date.now()

    const results = chats.map(chat => {
      let segments = 1
      let hasMessages = false

      // Priority 1: Use message_with_tool_calls if available
      if (chat.message_with_tool_calls && chat.message_with_tool_calls.length > 0) {
        const messagesWithContent = chat.message_with_tool_calls.filter(
          m => m.content && m.content.trim().length > 0
        )

        if (messagesWithContent.length > 0) {
          hasMessages = true
          const breakdown = twilioCostService.getDetailedSMSBreakdown(messagesWithContent)
          segments = Math.max(breakdown.segmentCount, 1)
        }
      }

      // Priority 2: Use transcript as fallback
      if (!hasMessages && chat.transcript && chat.transcript.trim().length > 0) {
        hasMessages = true
        const messages = [{ content: chat.transcript, role: 'user' }]
        const breakdown = twilioCostService.getDetailedSMSBreakdown(messages)
        segments = Math.max(breakdown.segmentCount, 1)
      }

      // Priority 3: Estimate based on duration if no content available
      if (!hasMessages && chat.end_timestamp && chat.start_timestamp) {
        const duration = Math.abs(chat.end_timestamp - chat.start_timestamp)
        const durationMinutes = duration / 60

        if (durationMinutes > 10) {
          segments = 3
        } else if (durationMinutes > 5) {
          segments = 2
        } else {
          segments = 1
        }
      }

      return {
        chatId: chat.chat_id,
        segments,
        cached: false,
        hasMessages
      }
    })

    const elapsed = Date.now() - startTime
    console.log(`✅ Bulk calculation complete: ${chats.length} chats in ${elapsed}ms (${(elapsed / chats.length).toFixed(1)}ms per chat)`)

    return results
  }

  /**
   * Calculate total segments for a list of chats
   */
  public calculateTotalSegments(chats: Chat[]): number {
    const results = this.calculateBulkSegments(chats)
    return results.reduce((total, result) => total + result.segments, 0)
  }

  /**
   * Get segment count for a single chat without API calls
   */
  public getSegmentCount(chat: Chat): number {
    const results = this.calculateBulkSegments([chat])
    return results[0]?.segments || 1
  }
}

// Export singleton instance
export const bulkSegmentCalculator = new BulkSegmentCalculator()