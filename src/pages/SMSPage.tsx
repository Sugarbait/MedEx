import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { useDebounce, useDebouncedCallback } from '@/hooks/useDebounce'
import { useSMSCostManager } from '@/hooks/useSMSCostManager'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { ChatDetailModal } from '@/components/common/ChatDetailModal'
import { APIOptimizationDebugPanel } from '@/components/common/APIOptimizationDebugPanel'
import { chatService, type Chat, type ChatListOptions } from '@/services/chatService'
import { optimizedChatService } from '@/services/optimizedChatService'
import { retellService } from '@/services'
import { twilioCostService } from '@/services/twilioCostService'
import { UserSettingsService } from '@/services/userSettingsService'
import {
  MessageSquareIcon,
  SendIcon,
  UserIcon,
  SearchIcon,
  PhoneIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
  MoreVerticalIcon,
  PlusIcon,
  DownloadIcon,
  RefreshCwIcon,
  CalendarIcon,
  TrendingUpIcon,
  DollarSignIcon,
  ThumbsUpIcon,
  MessageCircleIcon,
  BotIcon,
  PlayCircleIcon,
  StopCircleIcon,
  EyeIcon
} from 'lucide-react'

interface SMSPageProps {
  user: any
}

interface ChatMetrics {
  totalChats: number
  activeChats: number
  completedChats: number
  errorChats: number
  avgDuration: string
  totalCost: number
  avgCostPerChat: number
  successRate: number
  positiveSentimentCount: number
  totalMessages: number
  avgMessagesPerChat: number
  totalSMSSegments: number
  peakHour: string
  peakHourCount: number
}


export const SMSPage: React.FC<SMSPageProps> = ({ user }) => {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(() => {
    // Remember last selected date range from localStorage
    const saved = localStorage.getItem('sms_page_date_range')
    return (saved as DateRange) || 'thisMonth'
  })

  // Optimization state
  const [lastDataFetch, setLastDataFetch] = useState<number>(0)
  const [isSmartRefreshing, setIsSmartRefreshing] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const mountedRef = useRef(true)
  const [metrics, setMetrics] = useState<ChatMetrics>({
    totalChats: 0,
    activeChats: 0,
    completedChats: 0,
    errorChats: 0,
    avgDuration: '0s',
    totalCost: 0,
    avgCostPerChat: 0,
    successRate: 0,
    positiveSentimentCount: 0,
    totalMessages: 0,
    avgMessagesPerChat: 0,
    totalSMSSegments: 0,
    peakHour: 'N/A',
    peakHourCount: 0
  })

  // SMS cost management using cache service
  const smsCostManager = useSMSCostManager({
    onProgress: (loaded, total) => {
      console.log(`SMS cost loading progress: ${loaded}/${total}`)
    }
  })
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [isChatDetailModalOpen, setIsChatDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalChatsCount, setTotalChatsCount] = useState(0)
  const [allFilteredChats, setAllFilteredChats] = useState<Chat[]>([])
  const [totalSegments, setTotalSegments] = useState<number>(0)
  const [smsAgentConfigured, setSmsAgentConfigured] = useState<boolean>(true)
  const [smsAgentId, setSmsAgentId] = useState<string>('')
  const recordsPerPage = 25

  // Helper function to calculate SMS segments for a chat (same logic as ChatDetailModal)
  const calculateChatSMSSegments = useCallback((chat: Chat): number => {
    try {
      let messages = []
      if (chat.message_with_tool_calls && Array.isArray(chat.message_with_tool_calls)) {
        messages = chat.message_with_tool_calls
      } else if (chat.transcript) {
        // If only transcript available, create a message for segment calculation
        messages = [{ content: chat.transcript, role: 'user' }]
      }

      if (messages.length > 0) {
        const breakdown = twilioCostService.getDetailedSMSBreakdown(messages)
        return breakdown.segmentCount
      } else {
        // Fallback: use estimated typical conversation pattern
        const estimatedMessages = [
          { content: 'Patient enrollment details and personal information', role: 'user' },
          { content: 'AI Assistant confirmation response with formatted details for review', role: 'agent' },
          { content: 'Yes', role: 'user' },
          { content: 'Thanks! Enrollment received, team will follow up', role: 'agent' }
        ]
        const fallbackBreakdown = twilioCostService.getDetailedSMSBreakdown(estimatedMessages)
        return fallbackBreakdown.segmentCount
      }
    } catch (error) {
      console.error(`Error calculating SMS segments for chat ${chat.chat_id}:`, error)
      return 1 // Minimal fallback
    }
  }, [])

  // Debounced search and filters
  const { debouncedValue: debouncedSearchTerm } = useDebounce(searchTerm, 500, {
    leading: false,
    trailing: true,
    maxWait: 2000
  })

  const { debouncedValue: debouncedStatusFilter } = useDebounce(statusFilter, 300)
  const { debouncedValue: debouncedSentimentFilter } = useDebounce(sentimentFilter, 300)

  // Optimized auto-refresh with smart change detection
  const { formatLastRefreshTime } = useAutoRefresh({
    enabled: true,
    interval: 60000, // 1 minute (reduced frequency)
    onRefresh: useCallback(() => {
      performSmartRefresh()
    }, [])
  })

  // Optimized data fetching
  const debouncedFetchChats = useDebouncedCallback(
    async (resetPage: boolean = false) => {
      if (resetPage) {
        setCurrentPage(1)
      }
      await fetchChatsOptimized()
    },
    300,
    { leading: false, trailing: true }
  )

  // Fetch chats when component mounts or date range changes
  useEffect(() => {
    setCurrentPage(1)
    smsCostManager.clearCosts() // Clear costs when date range changes
    setTotalSegments(0) // Reset segments count for new date range
    debouncedFetchChats.debouncedCallback(true)
  }, [selectedDateRange])

  // Fetch when page changes (no debouncing for pagination)
  useEffect(() => {
    if (currentPage > 1) {
      fetchChatsOptimized()
    }
  }, [currentPage])

  // Fetch when debounced filters change
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm ||
        debouncedStatusFilter !== statusFilter ||
        debouncedSentimentFilter !== sentimentFilter) {
      return // Wait for debouncing to complete
    }
    setCurrentPage(1)
    debouncedFetchChats.debouncedCallback(true)
  }, [debouncedSearchTerm, debouncedStatusFilter, debouncedSentimentFilter])

  // Load SMS costs for visible chats
  useEffect(() => {
    if (chats.length > 0) {
      smsCostManager.loadCostsForChats(chats)
    }
  }, [chats, smsCostManager])

  // Calculate total segments using consistent helper function
  useEffect(() => {
    if (allFilteredChats.length > 0) {
      let totalSegments = 0
      console.log(`📊 Calculating SMS segments for ${allFilteredChats.length} chats using consistent helper method`)

      allFilteredChats.forEach((chat, index) => {
        const segments = calculateChatSMSSegments(chat)
        console.log(`Chat ${index + 1} (${chat.chat_id}): ${segments} segments`)
        totalSegments += segments
      })

      console.log(`📊 Total SMS segments calculated: ${totalSegments} (matches individual chat calculations)`)
      setTotalSegments(totalSegments)
    } else {
      console.log(`📊 No chats to calculate segments for`)
      setTotalSegments(0)
    }
  }, [allFilteredChats, calculateChatSMSSegments])

  // Optimized metrics calculation using cost manager
  useEffect(() => {
    if (allFilteredChats.length === 0) return

    const calculateMetrics = () => {
      // Calculate total cost from all filtered chats
      let totalCostFromFilteredChats = 0
      let costsCalculated = 0

      allFilteredChats.forEach(chat => {
        const { cost } = smsCostManager.getChatCost(chat.chat_id)
        if (cost > 0) {
          totalCostFromFilteredChats += cost
          costsCalculated++
        }
      })

      const avgCostPerChat = costsCalculated > 0 ? totalCostFromFilteredChats / costsCalculated : 0

      // Calculate positive sentiment count from filtered chats
      const positiveSentimentCount = allFilteredChats.filter(chat =>
        chat.chat_analysis?.user_sentiment === 'Positive'
      ).length

      // Calculate peak hours from filtered chats (optimized)
      const hourCounts = allFilteredChats.reduce((acc, chat) => {
        const timestamp = chat.start_timestamp
        const chatTimeMs = timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp
        const hour = new Date(chatTimeMs).getHours()
        acc[hour] = (acc[hour] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      let peakHour = 'N/A'
      let peakHourCount = 0

      if (Object.keys(hourCounts).length > 0) {
        const peakHourNumber = Number(Object.keys(hourCounts).reduce((a, b) =>
          hourCounts[Number(a)] > hourCounts[Number(b)] ? a : b
        ))
        peakHourCount = hourCounts[peakHourNumber]

        // Format hour in 12-hour format
        const hour12 = peakHourNumber === 0 ? 12 : peakHourNumber > 12 ? peakHourNumber - 12 : peakHourNumber
        const ampm = peakHourNumber >= 12 ? 'PM' : 'AM'
        peakHour = `${hour12}:00 ${ampm}`
      }

      // Update metrics efficiently
      console.log(`💰 Updating metrics with totalSMSSegments: ${totalSegments}`)

      // Verification: Calculate individual segments sum for comparison
      const verificationTotal = allFilteredChats.reduce((sum, chat) => sum + calculateChatSMSSegments(chat), 0)
      console.log(`✅ Verification: Sum of individual chat segments: ${verificationTotal} (should match ${totalSegments})`)

      setMetrics(prevMetrics => {
        const updatedMetrics = {
          ...prevMetrics,
          totalCost: totalCostFromFilteredChats,
          avgCostPerChat,
          totalSMSSegments: totalSegments,
          positiveSentimentCount,
          peakHour,
          peakHourCount
        }
        console.log(`💰 Updated metrics: Total SMS Segments = ${updatedMetrics.totalSMSSegments}`)
        return updatedMetrics
      })
    }

    calculateMetrics()
  }, [allFilteredChats, smsCostManager.costs, totalSegments, calculateChatSMSSegments])

  // Simplified chat fetching following CallsPage pattern
  const fetchChatsOptimized = useCallback(async (retryCount = 0) => {
    if (!mountedRef.current) return

    setLoading(true)
    setError('')

    try {
      // Reload credentials (localStorage + Supabase sync) - same as Calls page
      chatService.reloadCredentials()
      console.log('Reloaded chat credentials:', {
        hasApiKey: !!chatService.isConfigured(),
        configured: chatService.isConfigured()
      })

      if (!chatService.isConfigured()) {
        setError('API not configured. Go to Settings → API Configuration to set up your credentials.')
        setLoading(false)
        return
      }

      // Get date range for filtering
      const { start, end } = getDateRangeFromSelection(selectedDateRange)

      // Fetch with retry logic for rate limiting - same as Calls page
      let allChatsResponse
      try {
        // Add small delay to prevent rate limiting
        if (retryCount > 0) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 8000) // Exponential backoff, max 8 seconds
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1})`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        // Fetch chats using standard service - same pattern as Calls page
        allChatsResponse = await chatService.getChatHistory({
          limit: 300, // Reduced limit for faster initial load
          sort_order: 'descending'
        })
      } catch (error: any) {
        // Handle rate limiting specifically
        if (error.message?.includes('429') || error.status === 429) {
          if (retryCount < 3) {
            console.log(`Rate limited (429), retrying... (attempt ${retryCount + 1}/3)`)
            return fetchChatsOptimized(retryCount + 1)
          } else {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.')
          }
        }
        throw error
      }

      if (!mountedRef.current) return

      // Filter by date range - same as Calls page
      const startMs = start.getTime()
      const endMs = end.getTime()

      const finalFiltered = allChatsResponse.chats.filter(chat => {
        const timestamp = chat.start_timestamp
        const chatTimeMs = timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp
        return chatTimeMs >= startMs && chatTimeMs <= endMs
      })

      setTotalChatsCount(finalFiltered.length)
      setAllFilteredChats(finalFiltered)

      // Calculate pagination
      const startIndex = (currentPage - 1) * recordsPerPage
      const endIndex = startIndex + recordsPerPage
      const paginatedChats = finalFiltered.slice(startIndex, endIndex)

      setChats(paginatedChats)
      setLastDataFetch(Date.now())

      // Calculate metrics using optimized service
      const calculatedMetrics = chatService.getChatStats(finalFiltered)
      console.log('📊 Chat metrics calculated:', calculatedMetrics)
      setMetrics(prev => {
        console.log('📊 Previous totalSMSSegments:', prev.totalSMSSegments)
        console.log('📊 Current totalSegments state:', totalSegments)
        return {
          ...prev,
          ...calculatedMetrics,
          // Use current totalSegments state if prev.totalSMSSegments is undefined or 0
          totalSMSSegments: (prev.totalSMSSegments !== undefined && prev.totalSMSSegments !== 0) ? prev.totalSMSSegments : totalSegments
        }
      })

      console.log('Optimized SMS Chats fetched:', {
        agentFilter: smsAgentId || 'All agents',
        displayedChats: paginatedChats.length,
        totalFilteredChats: finalFiltered.length,
        cacheUsed: Date.now() - lastDataFetch < 300000
      })

    } catch (error) {
      if (!mountedRef.current) return

      console.error('Failed to fetch chats:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch chat data')
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [selectedDateRange, currentPage, lastDataFetch])



  const endChat = async (chatId: string) => {
    try {
      const result = await chatService.endChat(chatId)
      if (result.success) {
        console.log('Chat ended successfully:', chatId)
        fetchChatsOptimized() // Refresh to show updated status
      } else {
        throw new Error(result.error || 'Failed to end chat')
      }
    } catch (error) {
      console.error('Failed to end chat:', error)
      setError(error instanceof Error ? error.message : 'Failed to end chat')
    }
  }

  const formatDateTime = (timestamp: number) => {
    // Check if timestamp is in seconds (10 digits) or milliseconds (13+ digits)
    let timeMs: number
    const timestampStr = timestamp.toString()

    if (timestampStr.length <= 10) {
      // Timestamp is in seconds, convert to milliseconds
      timeMs = timestamp * 1000
    } else {
      // Timestamp is already in milliseconds
      timeMs = timestamp
    }

    const date = new Date(timeMs)

    return {
      date: date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    }
  }

  const formatDuration = (startTimestamp: number, endTimestamp?: number) => {
    if (!endTimestamp) return ''

    const durationSeconds = endTimestamp - startTimestamp
    if (durationSeconds < 60) {
      return `${durationSeconds}s`
    } else if (durationSeconds < 3600) {
      const minutes = Math.floor(durationSeconds / 60)
      const seconds = durationSeconds % 60
      return `${minutes}m ${seconds}s`
    } else {
      const hours = Math.floor(durationSeconds / 3600)
      const minutes = Math.floor((durationSeconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200'
      case 'negative': return 'text-red-600 bg-red-50 border-red-200'
      case 'neutral': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getChatStatusColor = (status: string) => {
    switch (status) {
      case 'ended': return 'text-green-600 bg-green-50'
      case 'ongoing': return 'text-blue-600 bg-blue-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getChatStatusIcon = (status: string) => {
    switch (status) {
      case 'ended': return <CheckCircleIcon className="w-4 h-4" />
      case 'ongoing': return <PlayCircleIcon className="w-4 h-4" />
      case 'error': return <AlertCircleIcon className="w-4 h-4" />
      default: return <ClockIcon className="w-4 h-4" />
    }
  }

  // Smart refresh that only updates when needed
  const performSmartRefresh = useCallback(async () => {
    if (!mountedRef.current || loading) return

    setIsSmartRefreshing(true)

    try {
      const result = await optimizedChatService.smartRefresh(chats, {
        limit: recordsPerPage * 2,
        filter_criteria: smsAgentConfigured && smsAgentId ? { agent_id: smsAgentId } : undefined
      })

      if (result.hasChanges) {
        console.log('Smart refresh detected changes, updating data')
        await fetchChatsOptimized()
      } else {
        console.log('Smart refresh: no changes detected')
      }
    } catch (error) {
      console.warn('Smart refresh failed, falling back to full refresh:', error)
      await fetchChatsOptimized()
    } finally {
      if (mountedRef.current) {
        setIsSmartRefreshing(false)
      }
    }
  }, [chats, loading, smsAgentConfigured, smsAgentId, fetchChatsOptimized])

  // Load SMS agent configuration on mount
  useEffect(() => {
    const loadSMSAgentConfig = async () => {
      try {
        // Load from user settings
        const currentUser = UserSettingsService.getCurrentUser()
        if (currentUser?.id) {
          const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
          const agentId = settings.smsAgentId || ''

          setSmsAgentId(agentId)
          setSmsAgentConfigured(!!agentId)

          console.log('SMS Agent Configuration:', {
            agentId,
            configured: !!agentId
          })
        }
      } catch (error) {
        console.error('Error loading SMS agent configuration:', error)
        setSmsAgentConfigured(false)
      }
    }

    loadSMSAgentConfig()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      optimizedChatService.cancelAllOperations()
      debouncedFetchChats.cancel()
    }
  }, [])

  // Memoized filtered chats for performance
  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      const phoneNumber = chat.metadata?.phone_number || chat.metadata?.customer_phone_number || ''
      const extractedName = chat.metadata?.patient_name ||
                            chat.metadata?.customer_name ||
                            chat.metadata?.caller_name ||
                            chat.metadata?.name ||
                            chat.collected_dynamic_variables?.patient_name ||
                            chat.collected_dynamic_variables?.customer_name ||
                            chat.collected_dynamic_variables?.name ||
                            null
      const patientName = extractedName || ''

      const matchesSearch = !debouncedSearchTerm ||
        phoneNumber.includes(debouncedSearchTerm) ||
        patientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        chat.transcript.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        chat.chat_id.toLowerCase().includes(debouncedSearchTerm.toLowerCase())

      const matchesStatus = debouncedStatusFilter === 'all' || chat.chat_status === debouncedStatusFilter
      const matchesSentiment = debouncedSentimentFilter === 'all' || chat.chat_analysis?.user_sentiment === debouncedSentimentFilter

      return matchesSearch && matchesStatus && matchesSentiment
    })
  }, [chats, debouncedSearchTerm, debouncedStatusFilter, debouncedSentimentFilter])

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <DateRangePicker
          selectedRange={selectedDateRange}
          onRangeChange={(range, customStart, customEnd) => {
            setSelectedDateRange(range)
            // Save selected date range to localStorage
            localStorage.setItem('sms_page_date_range', range)
            const { start, end } = getDateRangeFromSelection(range, customStart, customEnd)
            console.log('SMS date range changed:', { range, start, end })
          }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              console.log('SMS page manual refresh triggered at:', new Date().toLocaleTimeString())
              // Clear caches and force a complete refresh
              optimizedChatService.clearAllCaches()
              smsCostManager.clearCosts()
              setError('')
              fetchChatsOptimized()
            }}
            disabled={loading || isSmartRefreshing}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading || isSmartRefreshing ? 'animate-spin' : ''}`} />
            {isSmartRefreshing ? 'Smart Refresh...' : 'Refresh'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <DownloadIcon className="w-4 h-4" />
            Export Chat Report
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-6 flex items-center justify-between">
        <div>
          Last refreshed: {formatLastRefreshTime()} (Auto-refresh every 1 minute) | {totalChatsCount} total chats
        </div>
        {smsCostManager.progress && (
          <div className="flex items-center gap-2">
            <div className="w-32 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(smsCostManager.progress.loaded / smsCostManager.progress.total) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs">
              Loading costs: {smsCostManager.progress.loaded}/{smsCostManager.progress.total}
            </span>
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Chats</span>
            <MessageCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {loading ? '...' : metrics.totalChats}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? (
              <><span className="numeric-data">{metrics.completedChats}</span> completed, <span className="numeric-data">{metrics.errorChats}</span> failed</>
            ) : 'No chats started'}
          </div>
        </div>

        {/* Active Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Active Chats</span>
            <PlayCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {loading ? '...' : metrics.activeChats}
          </div>
          <div className="text-xs text-gray-500">
            Currently ongoing conversations
          </div>
        </div>

        {/* Avg Cost Per Chat */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Cost Per Chat</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            ${loading ? '...' : metrics.avgCostPerChat.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">
            Total cost: $<span className="numeric-data">{metrics.totalCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Success Rate</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1 numeric-data">
            {loading ? '...' : `${metrics.successRate.toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? (
              <><span className="numeric-data">{Math.round(metrics.totalChats * metrics.successRate / 100)}</span> successful chats</>
            ) : (<><span className="numeric-data">0</span> successful chats</>)}
          </div>
        </div>

        {/* Total SMS Segments */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total SMS Segments</span>
            <MessageSquareIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            <span className="numeric-data">{loading ? '...' : metrics.totalSMSSegments}</span>
          </div>
          <div className="text-xs text-gray-500">
            Total segments for date range
          </div>
        </div>

        {/* Positive Sentiment */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Positive Sentiment</span>
            <ThumbsUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            <span className="numeric-data">{loading ? '...' : metrics.positiveSentimentCount}</span>
          </div>
          <div className="text-xs text-gray-500">
            {allFilteredChats.length > 0 ? (
              <><span className="numeric-data">{((metrics.positiveSentimentCount / allFilteredChats.length) * 100).toFixed(1)}</span>% positive</>
            ) : (<><span className="numeric-data">0</span>% positive</>)}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Peak Hours</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            <span className="numeric-data">{loading ? '...' : metrics.peakHour}</span>
          </div>
          <div className="text-xs text-gray-500">
            {metrics.peakHourCount > 0 ? (
              <><span className="numeric-data">{metrics.peakHourCount}</span> chat{metrics.peakHourCount === 1 ? '' : 's'} at peak time</>
            ) : 'No peak data'}
          </div>
        </div>

        {/* Error Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Error Chats</span>
            <AlertCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            <span className="numeric-data">{loading ? '...' : metrics.errorChats}</span>
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? (
              <><span className="numeric-data">{((metrics.errorChats / metrics.totalChats) * 100).toFixed(1)}</span>% failure rate</>
            ) : (<><span className="numeric-data">0</span>% failure rate</>)}
          </div>
        </div>
      </div>

      {/* Total Chat Costs Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSignIcon className="w-5 h-5 text-green-600" />
              <span className="text-lg font-semibold text-gray-900">Total SMS Costs</span>
            </div>
            <p className="text-sm text-gray-500">Complete cost breakdown for selected date range</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-green-600 numeric-data">${metrics.totalCost.toFixed(2)}</div>
            <div className="text-sm text-gray-500">{metrics.totalChats} chats</div>
          </div>
        </div>
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

        {/* Chat Conversations List */}
        <div>
            {/* Search and Filters */}
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="search"
                    placeholder="Search chats by phone number, patient name, or content..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                  >
                    <option value="all">All Status</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="ended">Ended</option>
                    <option value="error">Error</option>
                  </select>
                  <select
                    value={sentimentFilter}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
                  >
                    <option value="all">All Sentiment</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Chat Conversations Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading chat conversations...</p>
                </div>
              ) : filteredChats.length > 0 ? (
                <div className="overflow-x-auto">
                  {/* Table Header */}
                  <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 hidden md:block">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                      <div className="col-span-1">#</div>
                      <div className="col-span-3">Patient</div>
                      <div className="col-span-3">Chat Info</div>
                      <div className="col-span-2">Cost</div>
                      <div className="col-span-2">Status & Duration</div>
                      <div className="col-span-1">Actions</div>
                    </div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-gray-200">
                    {filteredChats.map((chat, index) => {
                      // Calculate the actual row number based on current page and pagination
                      const rowNumber = (currentPage - 1) * recordsPerPage + index + 1
                      // Determine if this row should have gray background (even rows)
                      const isEvenRow = index % 2 === 0
                      const rowBgColor = isEvenRow ? 'bg-white' : 'bg-gray-25'
                      // Check all possible phone number fields - prioritize analysis data
                      const phoneNumber = chat.chat_analysis?.custom_analysis_data?.phone_number ||
                                        chat.chat_analysis?.custom_analysis_data?.customer_phone_number ||
                                        chat.chat_analysis?.custom_analysis_data?.phone ||
                                        chat.chat_analysis?.custom_analysis_data?.contact_number ||
                                        chat.metadata?.phone_number ||
                                        chat.metadata?.customer_phone_number ||
                                        chat.metadata?.from_phone_number ||
                                        chat.metadata?.to_phone_number ||
                                        chat.metadata?.phone ||
                                        chat.collected_dynamic_variables?.phone_number ||
                                        chat.collected_dynamic_variables?.customer_phone_number ||
                                        ''

                      // Try multiple approaches to extract name - check analysis data first
                      const extractedName = chat.chat_analysis?.custom_analysis_data?.patient_name ||
                                          chat.chat_analysis?.custom_analysis_data?.caller_name ||
                                          chat.chat_analysis?.custom_analysis_data?.customer_name ||
                                          chat.chat_analysis?.custom_analysis_data?.name ||
                                          chat.metadata?.patient_name ||
                                          chat.metadata?.customer_name ||
                                          chat.metadata?.caller_name ||
                                          chat.metadata?.name ||
                                          chat.metadata?.first_name ||
                                          chat.metadata?.last_name ||
                                          chat.collected_dynamic_variables?.patient_name ||
                                          chat.collected_dynamic_variables?.customer_name ||
                                          chat.collected_dynamic_variables?.caller_name ||
                                          chat.collected_dynamic_variables?.name ||
                                          chat.collected_dynamic_variables?.first_name ||
                                          chat.collected_dynamic_variables?.last_name ||
                                          null

                      // Create a better fallback name
                      let patientName = extractedName
                      if (!patientName) {
                        if (phoneNumber) {
                          // Format phone number nicely if we have it
                          const last4 = phoneNumber.replace(/\D/g, '').slice(-4)
                          patientName = `Patient (${last4 ? '***-' + last4 : phoneNumber})`
                        } else {
                          // Use a portion of chat ID as last resort
                          patientName = `Patient #${chat.chat_id.slice(0, 6)}`
                        }
                      }

                      return (
                        <div
                          key={chat.chat_id}
                          className={`px-6 py-4 hover:bg-blue-50 cursor-pointer transition-colors ${rowBgColor}`}
                          onClick={() => {
                            setSelectedChat(chat)
                            setIsChatDetailModalOpen(true)
                          }}
                        >
                          {/* Desktop Layout */}
                          <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                            {/* Row Number */}
                            <div className="col-span-1">
                              <span className="text-sm font-medium text-gray-500">#{rowNumber}</span>
                            </div>

                            {/* Patient Info */}
                            <div className="col-span-3">
                              <div>
                                <div className="font-medium text-gray-900">
                                  {patientName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {phoneNumber || 'No phone number'}
                                </div>
                              </div>
                            </div>

                            {/* Chat Info */}
                            <div className="col-span-3">
                              <div className="text-sm text-gray-900">
                                {formatDateTime(chat.start_timestamp).date}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDateTime(chat.start_timestamp).time}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {chat.chat_analysis?.user_sentiment && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(chat.chat_analysis.user_sentiment)}`}>
                                    {chat.chat_analysis.user_sentiment}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Cost */}
                            <div className="col-span-2">
                              <div className="text-sm font-medium text-gray-900">
                                ${smsCostManager.getChatCost(chat.chat_id).cost.toFixed(3)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {smsCostManager.getChatCost(chat.chat_id).loading ? (
                                  <span className="text-blue-600">Loading...</span>
                                ) : (
                                  `${calculateChatSMSSegments(chat)} segments`
                                )}
                              </div>
                            </div>

                            {/* Status & Duration */}
                            <div className="col-span-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChatStatusColor(chat.chat_status)}`}>
                                  {chat.chat_status}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDuration(chat.start_timestamp, chat.end_timestamp)}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="col-span-1">
                              <div className="flex items-center gap-1">
                                <button
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedChat(chat)
                                    setIsChatDetailModalOpen(true)
                                  }}
                                  title="View Details"
                                >
                                  <EyeIcon className="w-4 h-4 text-gray-500" />
                                </button>
                                {chat.chat_status === 'ongoing' && (
                                  <button
                                    className="p-1 hover:bg-red-200 rounded transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      endChat(chat.chat_id)
                                    }}
                                    title="End Chat"
                                  >
                                    <StopCircleIcon className="w-4 h-4 text-red-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Mobile Layout */}
                          <div className="md:hidden space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  chat.chat_status === 'ongoing' ? 'bg-blue-100' :
                                  chat.chat_status === 'ended' ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                  {chat.chat_status === 'ongoing' ?
                                    <BotIcon className="w-5 h-5 text-blue-600" /> :
                                    chat.chat_status === 'ended' ?
                                    <CheckCircleIcon className="w-5 h-5 text-green-600" /> :
                                    <AlertCircleIcon className="w-5 h-5 text-red-600" />
                                  }
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {patientName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {phoneNumber || 'No phone number'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {chat.chat_status === 'ongoing' && (
                                  <button
                                    className="p-1 hover:bg-red-200 rounded transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      endChat(chat.chat_id)
                                    }}
                                  >
                                    <StopCircleIcon className="w-4 h-4 text-red-500" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-sm text-gray-900 line-clamp-2">
                                {chat.transcript || 'No conversation yet'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChatStatusColor(chat.chat_status)}`}>
                                {chat.chat_status}
                              </span>
                              {chat.chat_analysis?.user_sentiment && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(chat.chat_analysis.user_sentiment)}`}>
                                  {chat.chat_analysis.user_sentiment}
                                </span>
                              )}
                              <span className="text-gray-500">
                                {formatDateTime(chat.start_timestamp).date} {formatDateTime(chat.start_timestamp).time}
                              </span>
                              <span className="text-gray-500">
                                {chat.message_with_tool_calls?.length || 0} msgs
                              </span>
                              <span className="text-green-600 font-medium">
                                ${smsCostManager.getChatCost(chat.chat_id).cost.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <MessageCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No chat conversations found</h3>
                  <p className="text-gray-600">No chat conversations have been started yet.</p>
                </div>
              )}
            </div>
          </div>

        {/* Pagination */}
        {totalChatsCount > recordsPerPage && (
          <div className="flex items-center justify-between mt-8 bg-white rounded-lg border border-gray-200 px-6 py-4">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, totalChatsCount)} of {totalChatsCount} chats
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {(() => {
                  const totalPages = Math.ceil(totalChatsCount / recordsPerPage)
                  const pages = []
                  const startPage = Math.max(1, currentPage - 2)
                  const endPage = Math.min(totalPages, currentPage + 2)

                  // First page
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => setCurrentPage(1)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        1
                      </button>
                    )
                    if (startPage > 2) {
                      pages.push(<span key="ellipsis1" className="px-2 text-gray-500">...</span>)
                    }
                  }

                  // Current page range
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg ${
                          i === currentPage
                            ? 'text-blue-600 bg-blue-50 border border-blue-200'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {i}
                      </button>
                    )
                  }

                  // Last page
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(<span key="ellipsis2" className="px-2 text-gray-500">...</span>)
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        {totalPages}
                      </button>
                    )
                  }

                  return pages
                })()}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalChatsCount / recordsPerPage)))}
                disabled={currentPage >= Math.ceil(totalChatsCount / recordsPerPage)}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Chat Detail Modal */}
        {selectedChat && isChatDetailModalOpen && (
          <ChatDetailModal
            chat={selectedChat}
            isOpen={isChatDetailModalOpen}
            onClose={() => {
              setIsChatDetailModalOpen(false)
              setSelectedChat(null)
            }}
            onEndChat={endChat}
          />
        )}

        {/* API Optimization Debug Panel */}
        <APIOptimizationDebugPanel
          isVisible={showDebugPanel}
          onToggle={() => setShowDebugPanel(!showDebugPanel)}
        />

    </div>
  )
}