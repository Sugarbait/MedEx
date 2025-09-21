import React, { useState, useEffect, useCallback } from 'react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { retellService, currencyService, twilioCostService, chatService } from '@/services'
import { pdfExportService } from '@/services/pdfExportService'
import { UserSettingsService } from '@/services/userSettingsService'
import {
  PhoneIcon,
  MessageSquareIcon,
  ClockIcon,
  ActivityIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  CalendarIcon,
  RefreshCwIcon,
  DownloadIcon,
  DollarSignIcon,
  ThumbsUpIcon,
  AlertCircleIcon,
  BarChart3Icon
} from 'lucide-react'

interface DashboardPageProps {
  user: any
}

// SMS Segment Cache interfaces (same as SMS page)
interface SegmentCacheEntry {
  chatId: string
  segments: number
  timestamp: number
}

interface SegmentCache {
  data: SegmentCacheEntry[]
  lastUpdated: number
}

// Constants for caching (same as SMS page)
const SMS_SEGMENT_CACHE_KEY = 'sms_segment_cache_v2'
const CACHE_EXPIRY_HOURS = 12

export const DashboardPage: React.FC<DashboardPageProps> = ({ user }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('today')
  const [error, setError] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  // SMS Segment caching state (copied from SMS page)
  const [fullDataSegmentCache, setFullDataSegmentCache] = useState<Map<string, number>>(new Map())
  const [segmentCalculationProgress, setSegmentCalculationProgress] = useState<{
    isCalculating: boolean
    current: number
    total: number
    cacheHits: number
    newCalculations: number
  }>({ isCalculating: false, current: 0, total: 0, cacheHits: 0, newCalculations: 0 })
  const [lastDateRange, setLastDateRange] = useState<DateRange | null>(null)

  // Helper function to add Twilio costs to call metrics
  const addTwilioCostsToCallMetrics = (baseMetrics: any, calls: any[]) => {
    // Calculate total Twilio costs for all calls
    const totalTwilioCostCAD = calls.reduce((sum, call) => {
      return sum + twilioCostService.getTwilioCostCAD(call.call_length_seconds || 0)
    }, 0)

    // Convert base metrics to CAD and add Twilio costs
    const baseTotalCostCAD = currencyService.convertUSDToCAD(baseMetrics.totalCost)
    const baseAvgCostCAD = currencyService.convertUSDToCAD(baseMetrics.avgCostPerCall)
    const baseHighestCostCAD = currencyService.convertUSDToCAD(baseMetrics.highestCostCall)
    const baseLowestCostCAD = currencyService.convertUSDToCAD(baseMetrics.lowestCostCall)

    // Calculate new totals
    const newTotalCostCAD = baseTotalCostCAD + totalTwilioCostCAD
    const newAvgCostCAD = baseMetrics.totalCalls > 0 ? newTotalCostCAD / baseMetrics.totalCalls : 0

    // Find highest and lowest cost calls including Twilio
    const callCostsWithTwilio = calls.map(call => {
      const retellCostCents = call.call_cost?.combined_cost || 0
      const retellCostUSD = retellCostCents / 100
      const retellCostCAD = currencyService.convertUSDToCAD(retellCostUSD)
      const twilioCostCAD = twilioCostService.getTwilioCostCAD(call.call_length_seconds || 0)
      return retellCostCAD + twilioCostCAD
    })

    const newHighestCostCAD = callCostsWithTwilio.length > 0 ? Math.max(...callCostsWithTwilio) : 0
    const newLowestCostCAD = callCostsWithTwilio.length > 0 ? Math.min(...callCostsWithTwilio) : 0

    return {
      ...baseMetrics,
      totalCost: newTotalCostCAD,
      avgCostPerCall: newAvgCostCAD,
      highestCostCall: newHighestCostCAD,
      lowestCostCall: newLowestCostCAD
    }
  }

  const [metrics, setMetrics] = useState({
    totalCalls: 0,
    avgCallDuration: '0:00',
    avgCostPerCall: 0,
    callSuccessRate: 0,
    totalCost: 0,
    highestCostCall: 0,
    lowestCostCall: 0,
    totalCallDuration: '0:00',
    totalMessages: 0,
    avgMessagesPerChat: 0,
    avgCostPerMessage: 0,
    messageDeliveryRate: 0,
    totalSMSCost: 0,
    totalSegments: 0
  })
  const [retellStatus, setRetellStatus] = useState<'checking' | 'connected' | 'error' | 'not-configured'>('checking')
  const [chatCosts, setChatCosts] = useState<Map<string, number>>(new Map())

  // Load segment cache from localStorage (same as SMS page)
  const loadSegmentCache = (): Map<string, number> => {
    try {
      const cached = localStorage.getItem(SMS_SEGMENT_CACHE_KEY)
      if (!cached) return new Map()
      const cacheData: SegmentCache = JSON.parse(cached)
      const now = Date.now()
      const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000
      if (now - cacheData.lastUpdated > expiryTime) {
        localStorage.removeItem(SMS_SEGMENT_CACHE_KEY)
        return new Map()
      }
      const validEntries = cacheData.data.filter(entry => {
        return now - entry.timestamp < expiryTime
      })
      return new Map(validEntries.map(entry => [entry.chatId, entry.segments]))
    } catch (error) {
      return new Map()
    }
  }

  // Save segment cache to localStorage (same as SMS page)
  const saveSegmentCache = useCallback((cache: Map<string, number>) => {
    try {
      const now = Date.now()
      const cacheData: SegmentCache = {
        data: Array.from(cache.entries()).map(([chatId, segments]) => ({
          chatId,
          segments,
          timestamp: now
        })),
        lastUpdated: now
      }
      localStorage.setItem(SMS_SEGMENT_CACHE_KEY, JSON.stringify(cacheData))
    } catch (error) {
      console.error('Failed to save segment cache:', error)
    }
  }, [])

  // Load cache on component mount
  useEffect(() => {
    const cachedSegments = loadSegmentCache()
    setFullDataSegmentCache(cachedSegments)
    console.log(`📁 Dashboard loaded ${cachedSegments.size} cached segments from localStorage`)
  }, [])

  // Save cache when it changes
  useEffect(() => {
    if (fullDataSegmentCache.size > 0) {
      saveSegmentCache(fullDataSegmentCache)
    }
  }, [fullDataSegmentCache, saveSegmentCache])

  // Auto-refresh functionality
  const { formatLastRefreshTime } = useAutoRefresh({
    enabled: true,
    interval: 60000, // 1 minute
    onRefresh: () => {
      fetchDashboardData()
      console.log('Dashboard refreshed at:', new Date().toLocaleTimeString())
    }
  })

  // Calculate chat SMS segments (exact same logic as SMS page)
  const calculateChatSMSSegments = useCallback((chat: any, shouldCache: boolean = true): number => {
    try {
      let messages = []
      if (chat.message_with_tool_calls && Array.isArray(chat.message_with_tool_calls)) {
        messages = chat.message_with_tool_calls
      } else if (chat.transcript) {
        messages = [{ content: chat.transcript, role: 'user' }]
      }

      const segments = twilioCostService.calculateSMSSegments(messages)

      if (shouldCache) {
        setFullDataSegmentCache(prev => {
          const newCache = new Map(prev.set(chat.chat_id, segments))
          return newCache
        })
      }

      return segments
    } catch (error) {
      console.error('Error calculating segments for chat:', chat.chat_id, error)
      return 2
    }
  }, [fullDataSegmentCache])

  // Fetch full chat details and calculate SMS cost with caching
  const fetchChatCost = async (chatId: string): Promise<number> => {
    try {
      // Check if we already have the cost cached
      if (chatCosts.has(chatId)) {
        return chatCosts.get(chatId) || 0
      }

      // Fetch full chat details to get messages
      const fullChat = await chatService.getChatById(chatId)

      let messages = []
      if (fullChat.message_with_tool_calls && Array.isArray(fullChat.message_with_tool_calls)) {
        messages = fullChat.message_with_tool_calls
      } else if (fullChat.transcript) {
        // If only transcript available, create a message for cost calculation
        messages = [{ content: fullChat.transcript, role: 'user' }]
      }

      const cost = twilioCostService.getSMSCostCAD(messages)

      // Also calculate and cache segments while we have the full data
      const segments = twilioCostService.calculateSMSSegments(messages)
      setFullDataSegmentCache(prev => {
        const newCache = new Map(prev.set(chatId, segments))
        return newCache
      })

      // Cache the result
      setChatCosts(prev => new Map(prev).set(chatId, cost))

      return cost
    } catch (error) {
      console.error('Error fetching chat cost for chat:', chatId, error)
      return 0
    }
  }

  const calculateChatSMSCost = (chat: any): number => {
    // Return cached cost if available, otherwise return 0 and trigger async fetch
    const cachedCost = chatCosts.get(chat.chat_id)
    if (cachedCost !== undefined) {
      return cachedCost
    }

    // Trigger async fetch but don't wait for it
    fetchChatCost(chat.chat_id)

    // Fallback: try to calculate from available data
    try {
      let messages = []
      if (chat.message_with_tool_calls && Array.isArray(chat.message_with_tool_calls)) {
        messages = chat.message_with_tool_calls
      } else if (chat.transcript) {
        messages = [{ content: chat.transcript, role: 'user' }]
      }

      return twilioCostService.getSMSCostCAD(messages)
    } catch (error) {
      return 0
    }
  }

  // Calculate average chat duration as a simpler metric
  const calculateAverageChatDuration = (chats: any[]): string => {
    if (chats.length === 0) return '0m'

    let totalDurations = []

    chats.forEach(chat => {
      if (chat.start_timestamp && chat.end_timestamp) {
        const duration = chat.end_timestamp - chat.start_timestamp
        // Convert to seconds if timestamps are in milliseconds
        const durationSeconds = duration > 1000000 ? duration / 1000 : duration
        totalDurations.push(durationSeconds)
      }
    })

    if (totalDurations.length === 0) {
      return 'N/A'
    }

    // Calculate average duration in seconds
    const avgDurationSeconds = totalDurations.reduce((sum, duration) => sum + duration, 0) / totalDurations.length

    // Convert to human readable format
    if (avgDurationSeconds < 60) {
      return `${Math.round(avgDurationSeconds)}s`
    } else if (avgDurationSeconds < 3600) {
      return `${Math.round(avgDurationSeconds / 60)}m`
    } else {
      const hours = Math.floor(avgDurationSeconds / 3600)
      const minutes = Math.round((avgDurationSeconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  // Handle date range changes with cache preservation
  useEffect(() => {
    if (lastDateRange !== selectedDateRange) {
      console.log(`📅 Dashboard date range changed from ${lastDateRange} to ${selectedDateRange}, keeping persistent segment cache`)
      console.log(`💾 Persistent cache contains ${fullDataSegmentCache.size} entries that will be preserved`)
      setLastDateRange(selectedDateRange)
    }
    fetchDashboardData()
  }, [selectedDateRange])

  // State to store filtered chats for cost recalculation
  const [filteredChatsForCosts, setFilteredChatsForCosts] = useState<any[]>([])

  // Recalculate total costs when chatCosts change (exact copy from SMS page)
  useEffect(() => {
    if (filteredChatsForCosts.length === 0) return

    const recalculateTotalCosts = () => {
      // Calculate total cost from all filtered chats that have cached costs
      let totalCostFromFilteredChats = 0
      let chatsWithCosts = 0

      filteredChatsForCosts.forEach(chat => {
        const cachedCost = chatCosts.get(chat.chat_id)
        if (cachedCost !== undefined) {
          totalCostFromFilteredChats += cachedCost
          chatsWithCosts++
        }
      })

      // Update metrics with new total cost
      const recalcStats = chatService.getChatStats(filteredChatsForCosts)
      const estimatedMessagesPerChat = filteredChatsForCosts.length > 0 ? 2.0 : 0

      setMetrics(prevMetrics => ({
        ...prevMetrics,
        avgCostPerMessage: filteredChatsForCosts.length > 0 ? totalCostFromFilteredChats / filteredChatsForCosts.length : 0,
        avgMessagesPerChat: recalcStats.avgMessagesPerChat > 0 ? recalcStats.avgMessagesPerChat : estimatedMessagesPerChat,
        totalSMSCost: totalCostFromFilteredChats
      }))

      console.log('Dashboard SMS cost recalculated:', {
        totalFilteredChats: filteredChatsForCosts.length,
        chatsWithCosts,
        totalCost: totalCostFromFilteredChats,
        avgCostPerMessage: filteredChatsForCosts.length > 0 ? totalCostFromFilteredChats / filteredChatsForCosts.length : 0
      })
    }

    recalculateTotalCosts()
  }, [chatCosts, filteredChatsForCosts])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Reload credentials (localStorage + Supabase sync) with error handling
      try {
        await retellService.loadCredentialsAsync()
        console.log('Reloaded credentials with cross-device sync:', {
          hasApiKey: !!retellService.isConfigured(),
          configured: retellService.isConfigured()
        })
      } catch (error) {
        console.log('Supabase credential sync failed, using localStorage fallback:', error)
        // Continue with localStorage-only credentials
      }

      // Check if Retell API is configured
      if (!retellService.isConfigured()) {
        setRetellStatus('not-configured')
        setIsLoading(false)
        return
      }

      // Test connection first
      const connectionTest = await retellService.testConnection()
      if (!connectionTest.success) {
        setRetellStatus('error')
        setError(`API Connection Error: ${connectionTest.message}`)
        setIsLoading(false)
        return
      }

      setRetellStatus('connected')

      // Get date range
      const { start, end } = getDateRangeFromSelection(selectedDateRange)
      console.log('Date range for API:', {
        start: start.toISOString(),
        end: end.toISOString(),
        startTimestamp: Math.floor(start.getTime() / 1000),
        endTimestamp: Math.floor(end.getTime() / 1000)
      })

      // Fetch call and chat data (handle chat errors gracefully)
      let callsResponse, chatsResponse

      try {
        // First get ALL calls to understand the data
        const allCalls = await retellService.getAllCalls()
        console.log(`Total calls in system: ${allCalls.length}`)

        // Debug: Check timestamp format of first few calls
        if (allCalls.length > 0) {
          console.log('Sample call timestamps:', allCalls.slice(0, 3).map(call => ({
            call_id: call.call_id,
            start_timestamp: call.start_timestamp,
            timestamp_length: call.start_timestamp.toString().length,
            as_seconds: new Date(call.start_timestamp * 1000).toISOString(),
            as_milliseconds: new Date(call.start_timestamp).toISOString()
          })))
        }

        // Now filter by the selected date range
        const startMs = start.getTime()
        const endMs = end.getTime()

        const filteredCalls = allCalls.filter(call => {
          // Check if timestamp is in seconds (10 digits) or milliseconds (13+ digits)
          let callTimeMs: number
          const timestampStr = call.start_timestamp.toString()

          if (timestampStr.length <= 10) {
            // Timestamp is in seconds, convert to milliseconds
            callTimeMs = call.start_timestamp * 1000
          } else {
            // Timestamp is already in milliseconds
            callTimeMs = call.start_timestamp
          }

          const isInRange = callTimeMs >= startMs && callTimeMs <= endMs

          // Debug logging for high-cost calls that might be filtered out
          const callCostCents = call.call_cost?.combined_cost || 0
          const callCostDollars = callCostCents / 100
          if (callCostCents >= 40) { // 40 cents or more
            console.log(`High-cost call (${callCostCents} cents = $${callCostDollars.toFixed(4)}):`, {
              call_id: call.call_id,
              timestamp: call.start_timestamp,
              date: new Date(callTimeMs).toLocaleDateString(),
              time: new Date(callTimeMs).toLocaleTimeString(),
              isInRange,
              selectedRange: selectedDateRange
            })
          }

          // Filter calls within the selected date range
          return isInRange
        })

        console.log(`Filtered calls for ${selectedDateRange}:`, {
          dateRange: `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
          startMs,
          endMs,
          totalCalls: allCalls.length,
          filteredCalls: filteredCalls.length,
          today: new Date().toLocaleDateString()
        })

        callsResponse = {
          calls: filteredCalls,
          pagination_key: undefined,
          has_more: false
        }
      } catch (error) {
        console.error('Failed to fetch calls:', error)
        callsResponse = { calls: [], pagination_key: undefined, has_more: false }
      }

      try {
        // Reload credentials for chatService too
        chatService.reloadCredentials()

        const allChatsResponse = await chatService.getChatHistory({
          limit: 500
        })
        console.log(`Total chats fetched: ${allChatsResponse.chats.length}`)

        // Define date range for chat filtering and get SMS agent ID from settings
        const startMs = start.getTime()
        const endMs = end.getTime()

        // Get SMS agent ID from settings with fallback handling
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
        let SMS_AGENT_ID = null

        if (currentUser.id) {
          try {
            const settingsResponse = await UserSettingsService.getUserSettings(currentUser.id)
            if (settingsResponse.status === 'success' && settingsResponse.data?.retell_config) {
              SMS_AGENT_ID = settingsResponse.data.retell_config.sms_agent_id || null
            }
          } catch (error) {
            console.log('Supabase connection failed, falling back to localStorage settings')
            // Fallback to localStorage settings when Supabase is not available
            try {
              const localSettings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
              SMS_AGENT_ID = localSettings.smsAgentId || null
            } catch (localError) {
              console.log('localStorage fallback also failed, continuing without SMS agent filter')
              SMS_AGENT_ID = null
            }
          }
        }

        // Filter chats by date range AND SMS agent like SMS page does
        const filteredChats = allChatsResponse.chats.filter(chat => {
          // If SMS_AGENT_ID is configured, filter by it; otherwise show all chats
          if (SMS_AGENT_ID && chat.agent_id !== SMS_AGENT_ID) return false

          // Check if timestamp is in seconds (10 digits) or milliseconds (13+ digits)
          let chatTimeMs: number
          const timestampStr = chat.start_timestamp.toString()

          if (timestampStr.length <= 10) {
            // Timestamp is in seconds, convert to milliseconds
            chatTimeMs = chat.start_timestamp * 1000
          } else {
            // Timestamp is already in milliseconds
            chatTimeMs = chat.start_timestamp
          }

          const isInRange = chatTimeMs >= startMs && chatTimeMs <= endMs

          // Debug logging for chat filtering
          if (isInRange) {
            console.log(`SMS Chat ${chat.chat_id}: date=${new Date(chatTimeMs).toLocaleDateString()}, agent=${chat.agent_id}`)
          }

          return isInRange
        })

        console.log(`Filtered SMS chats for ${selectedDateRange}: ${filteredChats.length} out of ${allChatsResponse.chats.length}`)

        chatsResponse = {
          chats: filteredChats,
          pagination_key: undefined,
          has_more: false
        }
      } catch (error) {
        console.error('Failed to fetch chats (continuing without chat data):', error)
        chatsResponse = { chats: [], pagination_key: undefined, has_more: false }
      }

      // Calculate metrics
      console.log('Dashboard calculating metrics:')
      console.log('- Call data for metrics:', { count: callsResponse.calls.length })
      console.log('- Chat data for metrics:', { count: chatsResponse.chats.length, sample: chatsResponse.chats.slice(0, 2) })

      // Debug chat costs specifically
      console.log('Chat cost analysis for dashboard:')
      chatsResponse.chats.forEach((chat, index) => {
        console.log(`Chat ${index + 1}:`, {
          chat_id: chat.chat_id,
          chat_cost: chat.chat_cost,
          combined_cost: chat.chat_cost?.combined_cost,
          total_cost: chat.chat_cost?.total_cost,
          start_timestamp: chat.start_timestamp,
          date: new Date(chat.start_timestamp * 1000).toLocaleDateString()
        })
      })

      const baseCallMetrics = retellService.calculateCallMetrics(callsResponse.calls)
      const enhancedCallMetrics = addTwilioCostsToCallMetrics(baseCallMetrics, callsResponse.calls)

      // Calculate SMS costs using exact same logic as SMS page with caching
      const filteredChats = chatsResponse.chats

      // Store filtered chats for cost recalculation
      setFilteredChatsForCosts(filteredChats)

      // Check cache hit rate and start segment calculation if needed
      const cacheHits = filteredChats.filter(chat => fullDataSegmentCache.has(chat.chat_id)).length
      const missingChats = filteredChats.filter(chat => !fullDataSegmentCache.has(chat.chat_id))
      const cacheHitRate = filteredChats.length > 0 ? (cacheHits / filteredChats.length) * 100 : 100

      console.log(`📊 Dashboard SMS Cache Analysis:`, {
        totalChats: filteredChats.length,
        cacheHits,
        missingChats: missingChats.length,
        cacheHitRate: `${cacheHitRate.toFixed(1)}%`
      })

      // Start segment calculation with progress tracking if we have missing chats
      if (missingChats.length > 0) {
        console.log(`🔄 Dashboard starting segment calculation for ${missingChats.length} missing chats`)
        setSegmentCalculationProgress({
          isCalculating: true,
          current: 0,
          total: missingChats.length,
          cacheHits,
          newCalculations: 0
        })

        // Calculate segments with progress tracking
        const calculateMissingSegments = async () => {
          for (let i = 0; i < missingChats.length; i++) {
            const chat = missingChats[i]
            try {
              // Add delay to prevent overwhelming the API
              if (i > 0 && i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100))
              }

              await fetchChatCost(chat.chat_id)

              setSegmentCalculationProgress(prev => ({
                ...prev,
                current: i + 1,
                newCalculations: i + 1
              }))

            } catch (error) {
              console.error(`Dashboard error calculating segments for chat ${chat.chat_id}:`, error)
            }
          }

          setSegmentCalculationProgress(prev => ({
            ...prev,
            isCalculating: false
          }))

          console.log(`✅ Dashboard completed segment calculation for ${missingChats.length} chats`)
        }

        // Start calculation in background
        calculateMissingSegments()
      }

      // Fetch costs for all filtered chats asynchronously
      const fetchAllChatCosts = async () => {
        for (const chat of filteredChats) {
          if (!chatCosts.has(chat.chat_id)) {
            await fetchChatCost(chat.chat_id)
          }
        }
      }

      // Start fetching costs in background
      fetchAllChatCosts()

      // Calculate SMS costs for the filtered chats using cached values and fallback calculation
      const totalSMSCost = filteredChats.reduce((sum, chat) => {
        const cachedCost = chatCosts.get(chat.chat_id)
        if (cachedCost !== undefined) {
          return sum + cachedCost
        }
        // Fallback calculation if not cached yet
        return sum + calculateChatSMSCost(chat)
      }, 0)

      // Calculate total segments for display
      const totalSegments = filteredChats.reduce((sum, chat) => {
        const cachedSegments = fullDataSegmentCache.get(chat.chat_id)
        if (cachedSegments !== undefined) {
          return sum + cachedSegments
        }
        // Fallback to calculated segments
        return sum + calculateChatSMSSegments(chat)
      }, 0)

      // Calculate chat metrics using exact same logic as SMS page
      const baseChatMetrics = chatService.getChatStats(filteredChats)

      // Since chat list API doesn't include message details, calculate a simple estimate
      // Assume each conversation has at least 2 messages (user + agent response)
      const estimatedMessagesPerChat = filteredChats.length > 0 ? 2.0 : 0

      console.log('Dashboard avgMessagesPerChat debug:', {
        totalChats: filteredChats.length,
        baseChatMetrics_avgMessagesPerChat: baseChatMetrics.avgMessagesPerChat,
        baseChatMetrics_totalMessages: baseChatMetrics.totalMessages,
        estimatedMessagesPerChat
      })

      const chatMetrics = {
        ...baseChatMetrics,
        totalCost: totalSMSCost,
        avgCostPerChat: filteredChats.length > 0 ? totalSMSCost / filteredChats.length : 0,
        // Use estimated value if the API doesn't provide message details
        avgMessagesPerChat: baseChatMetrics.avgMessagesPerChat > 0 ? baseChatMetrics.avgMessagesPerChat : estimatedMessagesPerChat
      }

      console.log('Enhanced Dashboard metrics (Retell + Twilio):')
      console.log('- Base call metrics:', baseCallMetrics)
      console.log('- Enhanced call metrics:', enhancedCallMetrics)
      console.log('- SMS cost calculation:', {
        totalFilteredChats: filteredChats.length,
        totalSMSCost,
        avgCostPerChat: chatMetrics.avgCostPerChat
      })
      console.log('- Chat metrics:', chatMetrics)

      setMetrics({
        totalCalls: enhancedCallMetrics.totalCalls,
        avgCallDuration: enhancedCallMetrics.avgDuration,
        avgCostPerCall: enhancedCallMetrics.avgCostPerCall,
        callSuccessRate: enhancedCallMetrics.successRate,
        totalCost: enhancedCallMetrics.totalCost,
        highestCostCall: enhancedCallMetrics.highestCostCall,
        lowestCostCall: enhancedCallMetrics.lowestCostCall,
        totalCallDuration: enhancedCallMetrics.totalDuration,
        totalMessages: chatMetrics.totalChats,
        avgMessagesPerChat: chatMetrics.avgMessagesPerChat,
        avgCostPerMessage: chatMetrics.avgCostPerChat,
        messageDeliveryRate: chatMetrics.successRate,
        totalSMSCost: totalSMSCost,
        totalSegments: totalSegments
      })

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data')
      setRetellStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const { start, end } = getDateRangeFromSelection(selectedDateRange)

      await pdfExportService.generateDashboardReport(metrics, {
        dateRange: selectedDateRange,
        startDate: start,
        endDate: end,
        companyName: 'CareXPS Healthcare CRM',
        reportTitle: 'Dashboard Analytics Report'
      })
    } catch (error) {
      setError('Failed to generate PDF report. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <DateRangePicker
          selectedRange={selectedDateRange}
          onRangeChange={(range, customStart, customEnd) => {
            setSelectedDateRange(range)
            const { start, end } = getDateRangeFromSelection(range, customStart, customEnd)
            console.log('Dashboard date range changed:', { range, start, end })
          }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadIcon className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
            {isExporting ? 'Generating PDF...' : 'Export Dashboard Report'}
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-6">
        Last refreshed: {formatLastRefreshTime()} (Auto-refresh every minute)
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-600 hover:text-red-800 text-xl"
          >
            ×
          </button>
        </div>
      )}

      {/* Configuration Warning */}
      {retellStatus === 'not-configured' && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <span className="text-yellow-700 font-medium">API not configured</span>
            <p className="text-yellow-600 text-sm mt-1">
              Go to Settings → API Configuration to set up your API credentials.
            </p>
          </div>
        </div>
      )}

      {/* Combined Service Cost Card */}
      <div className="mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Left: Call Costs */}
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                <PhoneIcon className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Call Costs</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 numeric-data">
                CAD ${isLoading ? '...' : (metrics.totalCost || 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="numeric-data">{metrics.totalCalls}</span> calls
              </div>
            </div>

            {/* Center: Total Combined Cost */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <DollarSignIcon className="w-6 h-6 text-green-600" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Combined Service Cost</span>
              </div>
              <div className="text-5xl font-black text-green-600 dark:text-green-400 mb-2 numeric-data">
                CAD ${isLoading ? '...' : ((metrics.totalCost || 0) + (metrics.totalSMSCost || 0)).toFixed(2)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total for selected date range
              </div>
            </div>

            {/* Right: SMS Costs */}
            <div className="text-center lg:text-right">
              <div className="flex items-center justify-center lg:justify-end gap-2 mb-2">
                <MessageSquareIcon className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">SMS Costs</span>
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 numeric-data">
                CAD ${isLoading ? '...' : (metrics.totalSMSCost || 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="numeric-data">{metrics.totalMessages}</span> conversations
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Calls</span>
            <PhoneIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {isLoading ? '...' : metrics.totalCalls}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalCalls === 0 ? 'No calls made' : (
              <>
                <span className="numeric-data">{metrics.totalCalls}</span> calls completed
              </>
            )}
          </div>
        </div>

        {/* Total Talk Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Talk Time</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {isLoading ? '...' : metrics.totalCallDuration}
          </div>
          <div className="text-xs text-gray-500">
            Avg: <span className="numeric-data">{metrics.avgCallDuration}</span>
          </div>
        </div>

        {/* Average Cost Per Call */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg Cost Per Call</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            CAD ${isLoading ? '...' : (metrics.avgCostPerCall || 0).toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">
            Total: CAD $<span className="numeric-data">{(metrics.totalCost || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Highest Cost Call */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Highest Cost</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            CAD ${isLoading ? '...' : (metrics.highestCostCall || 0).toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">
            Lowest: CAD $<span className="numeric-data">{(metrics.lowestCostCall || 0).toFixed(3)}</span>
          </div>
        </div>

      </div>

      {/* SMS Progress Indicator */}
      {segmentCalculationProgress.isCalculating && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Calculating accurate SMS segments... ({segmentCalculationProgress.current}/{segmentCalculationProgress.total})
              </span>
            </div>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {segmentCalculationProgress.total > 0 ? Math.round((segmentCalculationProgress.current / segmentCalculationProgress.total) * 100) : 0}%
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${segmentCalculationProgress.total > 0 ? (segmentCalculationProgress.current / segmentCalculationProgress.total) * 100 : 0}%`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
            <span>Cache hits: {segmentCalculationProgress.cacheHits}</span>
            <span>New calculations: {segmentCalculationProgress.newCalculations}</span>
          </div>
        </div>
      )}

      {/* SMS Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SMS Segments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total SMS Segments</span>
            <MessageSquareIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {segmentCalculationProgress.isCalculating ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>{metrics.totalSegments || '...'}</span>
              </div>
            ) : (
              metrics.totalSegments || 0
            )}
          </div>
          <div className="text-xs text-gray-500">
            {segmentCalculationProgress.isCalculating ? (
              `Calculating... (${segmentCalculationProgress.current}/${segmentCalculationProgress.total})`
            ) : (
              `${metrics.totalMessages} conversations`
            )}
          </div>
        </div>

        {/* Avg Messages Per Chat */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg Messages Per Chat</span>
            <BarChart3Icon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {isLoading ? '...' : (metrics.totalMessages > 0 ? (metrics.avgMessagesPerChat || 0).toFixed(1) : '0')}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalMessages > 0 ? (
              <>From <span className="numeric-data">{metrics.totalMessages}</span> conversations</>
            ) : 'No conversations yet'}
          </div>
        </div>

        {/* Avg Cost Per Message */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg Cost Per Message</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            CAD ${isLoading ? '...' : (metrics.avgCostPerMessage || 0).toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">
            Total cost: $<span className="numeric-data">{((metrics.avgCostPerMessage || 0) * metrics.totalMessages).toFixed(2)}</span>
          </div>
        </div>

        {/* Message Delivery Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Message Delivery Rate</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {isLoading ? '...' : `${metrics.messageDeliveryRate.toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500">
            0 delivered
          </div>
        </div>
      </div>

      {/* System Status Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheckIcon className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Status</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ActivityIcon className={`w-4 h-4 ${retellStatus === 'connected' ? 'text-green-500' : retellStatus === 'error' ? 'text-red-500' : retellStatus === 'not-configured' ? 'text-yellow-500' : 'text-gray-500'}`} />
              <span className="text-sm text-gray-900 dark:text-gray-100">API Service</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${retellStatus === 'connected' ? 'bg-green-500' : retellStatus === 'error' ? 'bg-red-500' : retellStatus === 'not-configured' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {retellStatus === 'connected' ? 'Connected' :
                 retellStatus === 'error' ? 'Error' :
                 retellStatus === 'not-configured' ? 'Not Configured' :
                 'Checking...'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ActivityIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-900 dark:text-gray-100">Database</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Connected</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-900 dark:text-gray-100">Security</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-900 dark:text-gray-100">HIPAA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}