import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { useDebounce, useDebouncedCallback } from '@/hooks/useDebounce'
import { useSMSCostManager } from '@/hooks/useSMSCostManager'
import { useNotesCount } from '@/hooks/useNotesCount'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { ChatDetailModal } from '@/components/common/ChatDetailModal'
import { SiteHelpChatbot } from '@/components/common/SiteHelpChatbot'
import { chatService, type Chat, type ChatListOptions } from '@/services/chatService'
import { optimizedChatService } from '@/services/optimizedChatService'
import { retellService } from '@/services'
import { twilioCostService } from '@/services/twilioCostService'
import { currencyService } from '@/services/currencyService'
import { userSettingsService } from '@/services'
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
  EyeIcon,
  StickyNoteIcon
} from 'lucide-react'

// Persistent cache utilities for SMS segments
const SMS_SEGMENT_CACHE_KEY = 'sms_segment_cache_v2'
const CACHE_EXPIRY_HOURS = 12 // Cache expires after 12 hours

interface CachedSegmentData {
  chatId: string
  segments: number
  timestamp: number
  content?: string // Optional: store content hash for validation
}

interface SegmentCache {
  data: CachedSegmentData[]
  lastUpdated: number
}

const loadSegmentCache = (): Map<string, number> => {
  try {
    const cached = localStorage.getItem(SMS_SEGMENT_CACHE_KEY)
    if (!cached) return new Map()

    const cacheData: SegmentCache = JSON.parse(cached)
    const now = Date.now()
    const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000

    // Check if cache is expired
    if (now - cacheData.lastUpdated > expiryTime) {
      console.log('📅 SMS segment cache expired, clearing old data')
      localStorage.removeItem(SMS_SEGMENT_CACHE_KEY)
      return new Map()
    }

    // Filter out expired individual entries and convert to Map
    const validEntries = cacheData.data.filter(entry => {
      return now - entry.timestamp < expiryTime
    })

    console.log(`💾 Loaded ${validEntries.length} cached SMS segment calculations`)
    return new Map(validEntries.map(entry => [entry.chatId, entry.segments]))
  } catch (error) {
    console.error('Failed to load SMS segment cache:', error)
    return new Map()
  }
}

const saveSegmentCache = (cache: Map<string, number>) => {
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
    console.log(`💾 Saved ${cache.size} SMS segment calculations to cache`)
  } catch (error) {
    console.error('Failed to save SMS segment cache:', error)
  }
}

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
  const { user: currentUser } = useAuth()
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

  // State for custom date range
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('sms_page_custom_start_date')
    return saved ? new Date(saved) : undefined
  })
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('sms_page_custom_end_date')
    return saved ? new Date(saved) : undefined
  })

  // Optimization state
  const [lastDataFetch, setLastDataFetch] = useState<number>(0)
  const [isSmartRefreshing, setIsSmartRefreshing] = useState(false)
  const [showHelpChatbot, setShowHelpChatbot] = useState(false)
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

  // Cache for SMS segment calculations to avoid repeated API calls
  const [segmentCache, setSegmentCache] = useState<Map<string, number>>(new Map())
  const [loadingFullChats, setLoadingFullChats] = useState<Set<string>>(new Set())
  // Cache for accurate segment calculations from full chat data (used by modal) with persistent storage
  const [fullDataSegmentCache, setFullDataSegmentCache] = useState<Map<string, number>>(() => {
    // Load cached data on initial mount
    return loadSegmentCache()
  })
  // Force re-render trigger for segment updates
  const [segmentUpdateTrigger, setSegmentUpdateTrigger] = useState(0)

  // Progress tracking for bulk segment loading
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const [segmentLoadingProgress, setSegmentLoadingProgress] = useState({ completed: 0, total: 0 })
  const [segmentLoadingComplete, setSegmentLoadingComplete] = useState(false)

  // Use the notes count hook for cross-device accessible note icons
  const {
    hasNotes,
    getNoteCount,
    refetch: refetchNotesCount
  } = useNotesCount({
    referenceType: 'sms',
    referenceIds: chats.map(chat => chat.chat_id),
    enabled: chats.length > 0
  })

  // Helper function to calculate SMS segments for a chat (prioritizes modal's accurate data)
  // Note: This function should NOT update caches during metrics calculation to prevent circular dependencies
  const calculateChatSMSSegments = useCallback((chat: Chat, shouldCache: boolean = true): number => {
    try {
      // Priority 1: Check full data cache first (populated by modal with accurate data)
      const fullDataCached = fullDataSegmentCache.get(chat.chat_id)
      if (fullDataCached !== undefined) {
        console.log(`✅ Using accurate segment count from modal: ${fullDataCached} segments for chat ${chat.chat_id}`)
        return fullDataCached
      }

      // Priority 2: Check regular cache
      const cached = segmentCache.get(chat.chat_id)
      if (cached !== undefined) {
        return cached
      }

      let messages = []
      let segments = 1 // Default fallback

      console.log(`🔍 Calculating segments for chat ${chat.chat_id}:`, {
        hasMessages: !!(chat.message_with_tool_calls?.length),
        messageCount: chat.message_with_tool_calls?.length || 0,
        hasTranscript: !!chat.transcript,
        transcriptLength: chat.transcript?.length || 0
      })

      // Priority 1: Use full message array if available and has content
      if (chat.message_with_tool_calls && Array.isArray(chat.message_with_tool_calls) && chat.message_with_tool_calls.length > 0) {
        // Check if messages actually have content
        const messagesWithContent = chat.message_with_tool_calls.filter(m => m.content && m.content.trim().length > 0)
        if (messagesWithContent.length > 0) {
          messages = messagesWithContent
          console.log(`📝 Using ${messages.length} content messages from message_with_tool_calls`)
        }
      }

      // Priority 2: Use transcript as fallback if no proper messages found
      if (messages.length === 0 && chat.transcript && chat.transcript.trim().length > 0) {
        messages = [{ content: chat.transcript, role: 'user' }]
        console.log(`📝 Using transcript (${chat.transcript.trim().length} chars) as single message`)
      }

      // Calculate segments if we have content
      if (messages.length > 0 && messages.some(m => m.content && m.content.trim().length > 0)) {
        const breakdown = twilioCostService.getDetailedSMSBreakdown(messages)
        segments = Math.max(breakdown.segmentCount, 1)
        console.log(`📊 Chat ${chat.chat_id}: ${segments} segments calculated from available data`)
      } else {
        // No content available - use a reasonable estimate based on typical SMS conversations
        // Most basic SMS conversations are 1-3 segments
        segments = 1
        console.log(`📊 Chat ${chat.chat_id}: Using fallback ${segments} segment (no content available)`)
      }

      // Only cache the result if explicitly requested (prevents circular dependencies in metrics calculation)
      if (shouldCache) {
        setSegmentCache(prev => {
          const newCache = new Map(prev.set(chat.chat_id, segments))
          return newCache
        })
      }
      return segments

    } catch (error) {
      console.error(`❌ Error calculating SMS segments for chat ${chat.chat_id}:`, error)

      // Try to use transcript as last resort
      try {
        if (chat.transcript && chat.transcript.trim().length > 0) {
          const transcriptLength = chat.transcript.trim().length
          let fallbackSegments

          try {
            // Try using Twilio service for accurate calculation
            fallbackSegments = twilioCostService.getDetailedSMSBreakdown([{ content: chat.transcript, role: 'user' }]).segmentCount
            fallbackSegments = Math.max(fallbackSegments, 1)
          } catch (twilioError) {
            // Fallback to rough estimation
            fallbackSegments = Math.max(Math.ceil(transcriptLength / 160), 1)
          }

          console.log(`🆘 Emergency fallback using transcript for ${chat.chat_id}: ${fallbackSegments} segments`)

          // Only cache this emergency fallback if explicitly requested
          if (shouldCache) {
            setSegmentCache(prev => {
              const newCache = new Map(prev.set(chat.chat_id, fallbackSegments))
              return newCache
            })
          }

          return fallbackSegments
        }
      } catch (fallbackError) {
        console.error(`❌ Emergency fallback failed for ${chat.chat_id}:`, fallbackError)
      }

      // Final fallback - use 1 instead of 2 for more realistic base cost
      return 1
    }
  }, [segmentCache, fullDataSegmentCache])

  // Function for modals to register accurate segment calculations from full chat data
  const updateFullDataSegmentCache = useCallback((chatId: string, fullChatData: any) => {
    try {
      if (!fullChatData?.message_with_tool_calls || !Array.isArray(fullChatData.message_with_tool_calls)) {
        console.log(`⚠️ No full message data available for chat ${chatId}`)
        return
      }

      const messagesWithContent = fullChatData.message_with_tool_calls.filter(m => m.content && m.content.trim().length > 0)

      if (messagesWithContent.length > 0) {
        const breakdown = twilioCostService.getDetailedSMSBreakdown(messagesWithContent)
        const accurateSegments = Math.max(breakdown.segmentCount, 1)

        console.log(`🎯 Modal calculated accurate segments for chat ${chatId}: ${accurateSegments} segments`)

        // Update the full data cache and persist to localStorage
        setFullDataSegmentCache(prev => {
          const newCache = new Map(prev.set(chatId, accurateSegments))
          // Save updated cache to localStorage
          saveSegmentCache(newCache)
          return newCache
        })

        // Trigger re-render to update cost column
        setSegmentUpdateTrigger(prev => prev + 1)

        return accurateSegments
      }
    } catch (error) {
      console.error(`❌ Error calculating accurate segments for chat ${chatId}:`, error)
    }
  }, [])

  // Expose the function globally so modals can access it
  useEffect(() => {
    (window as any).updateSMSSegments = updateFullDataSegmentCache
    return () => {
      delete (window as any).updateSMSSegments
    }
  }, [updateFullDataSegmentCache])

  // Smart cache management for date range changes
  // Only clear cache if the date range actually changed (not initial mount)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [lastDateRange, setLastDateRange] = useState<DateRange>(selectedDateRange)

  useEffect(() => {
    // Skip clearing cache on initial mount - preserve loaded cache
    if (!hasInitiallyLoaded) {
      setHasInitiallyLoaded(true)
      setLastDateRange(selectedDateRange)
      return
    }

    // Only update tracking if date range actually changed
    // Note: We do NOT clear fullDataSegmentCache as it contains persistent data that should survive date range changes
    if (lastDateRange !== selectedDateRange) {
      console.log(`📅 Date range changed from ${lastDateRange} to ${selectedDateRange}, keeping persistent segment cache`)
      console.log(`💾 Persistent cache contains ${fullDataSegmentCache.size} entries that will be preserved`)
      setLastDateRange(selectedDateRange)
    }
  }, [selectedDateRange, hasInitiallyLoaded, lastDateRange])

  // Function to bulk load accurate segment data for all visible chats
  const loadAccurateSegmentsForAllChats = useCallback(async () => {
    if (!allFilteredChats || allFilteredChats.length === 0) return

    // Add debugging to verify we're processing the correct chats for this date range
    console.log(`🔍 loadAccurateSegmentsForAllChats called for ${selectedDateRange} with ${allFilteredChats.length} chats`)
    console.log(`📊 Current date range: ${selectedDateRange}`)
    console.log(`📅 Sample chat dates:`, allFilteredChats.slice(0, 3).map(chat => ({
      id: chat.chat_id,
      created: chat.created_at,
      date: new Date(chat.created_at).toLocaleDateString()
    })))

    const chatsToProcess = allFilteredChats.filter(chat => !fullDataSegmentCache.has(chat.chat_id))
    const cachedCount = allFilteredChats.length - chatsToProcess.length

    if (chatsToProcess.length === 0) {
      console.log(`💾 All ${allFilteredChats.length} chats already have cached segment data - no processing needed!`)
      return
    }

    console.log(`🚀 Loading accurate segment data for ${chatsToProcess.length} chats (${cachedCount} already cached)...`)
    console.log(`📊 Processing ${chatsToProcess.length} chats for ${selectedDateRange} date range (Total: ${allFilteredChats.length} chats)`)
    console.log(`📅 Date range: ${selectedDateRange} - Expected large batches for extended ranges like "year"`)

    // Safety check: If processing too many chats for "today", something is wrong
    // But allow larger ranges like "year" to process all chats
    if (selectedDateRange === 'today' && chatsToProcess.length > 50) {
      console.error(`🚨 SAFETY ABORT: Attempting to process ${chatsToProcess.length} chats for "today" - this seems wrong! Aborting to prevent server overload.`)
      console.error(`🚨 Expected ~10 chats for today, got ${allFilteredChats.length} total chats`)
      console.error(`🚨 This suggests the allFilteredChats contains data from wrong date range`)
      return
    }

    // For larger date ranges (year, etc.), allow processing but with warning
    if (chatsToProcess.length > 500) {
      console.warn(`⚠️ Processing ${chatsToProcess.length} chats for ${selectedDateRange} - this is a large batch but expected for extended date ranges`)
    }

    // Start loading state
    setIsLoadingSegments(true)
    setSegmentLoadingProgress({ completed: 0, total: chatsToProcess.length })
    setSegmentLoadingComplete(false)

    let completed = 0
    for (const chat of chatsToProcess) {
      try {
        const fullChatDetails = await chatService.getChatById(chat.chat_id)
        if (fullChatDetails) {
          updateFullDataSegmentCache(chat.chat_id, fullChatDetails)
        }
        completed++
        setSegmentLoadingProgress({ completed, total: chatsToProcess.length })

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Failed to load accurate segments for chat ${chat.chat_id}:`, error)
        completed++
        setSegmentLoadingProgress({ completed, total: chatsToProcess.length })
      }
    }

    // Finish loading state
    setIsLoadingSegments(false)
    setSegmentLoadingComplete(true)
    console.log(`✅ Finished loading accurate segment data`)

    // Hide completion message after 3 seconds
    setTimeout(() => {
      setSegmentLoadingComplete(false)
    }, 3000)
  }, [allFilteredChats, fullDataSegmentCache, updateFullDataSegmentCache])

  // Smart auto-load segments with proper cache synchronization
  useEffect(() => {
    if (allFilteredChats.length === 0) return

    // Wait for cache to be properly initialized on mount
    if (!hasInitiallyLoaded) {
      console.log(`⏳ Waiting for initial cache load to complete before processing ${allFilteredChats.length} chats`)
      return
    }

    // Check how many chats need processing after cache is ready
    const chatsToProcess = allFilteredChats.filter(chat => !fullDataSegmentCache.has(chat.chat_id))
    const cachedCount = allFilteredChats.length - chatsToProcess.length

    console.log(`📊 Chats loaded: ${allFilteredChats.length} total, ${cachedCount} already cached, ${chatsToProcess.length} need processing`)

    // Only trigger bulk loading if there are uncached chats AND it's worth processing
    if (chatsToProcess.length > 0) {
      const cacheHitRate = cachedCount / allFilteredChats.length
      console.log(`💾 Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}% (${cachedCount}/${allFilteredChats.length})`)

      // For full date range coverage, always auto-load if there are uncached chats
      // Only skip if very few chats need processing to avoid unnecessary API calls
      if (chatsToProcess.length >= 2) {
        console.log(`🚀 Auto-triggering bulk load for ${chatsToProcess.length} uncached chats (cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%) - ensuring complete date range coverage`)
        const timer = setTimeout(() => {
          loadAccurateSegmentsForAllChats()
        }, 1000)
        return () => clearTimeout(timer)
      } else {
        console.log(`✨ Only ${chatsToProcess.length} chat(s) need processing (cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%), will load on demand.`)
      }
    } else {
      console.log(`💾 All ${allFilteredChats.length} chats already cached - no bulk loading needed!`)
    }
  }, [allFilteredChats, fullDataSegmentCache, loadAccurateSegmentsForAllChats, hasInitiallyLoaded])

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

    // Only clear other caches if not initial load (preserve persistent segment cache)
    if (hasInitiallyLoaded) {
      smsCostManager.clearCosts() // Clear costs when date range changes
      setSegmentCache(new Map()) // Clear segment cache for new date range
      setLoadingFullChats(new Set()) // Clear loading state for new date range
      setTotalSegments(0) // Reset segments count for new date range
      setSegmentUpdateTrigger(0) // Reset segment update trigger
      console.log('📅 Date range changed, cleared non-persistent caches and reset state')
    } else {
      console.log('📅 Initial mount, preserving cached segment data')
    }

    setIsSmartRefreshing(false) // Reset smart refresh state to prevent infinite spinning
    debouncedFetchChats.debouncedCallback(true)
  }, [selectedDateRange, customStartDate, customEndDate, hasInitiallyLoaded])

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

  // Optimized metrics calculation with consolidated SMS segments calculation
  useEffect(() => {
    if (allFilteredChats.length === 0) {
      // Reset everything when no chats
      setTotalSegments(0)
      setMetrics(prevMetrics => ({
        ...prevMetrics,
        totalSMSSegments: 0,
        totalCost: 0,
        avgCostPerChat: 0,
        positiveSentimentCount: 0,
        peakHour: 'N/A',
        peakHourCount: 0
      }))
      return
    }

    const calculateMetrics = () => {
      // Calculate SMS segments using accurate modal data when available
      let calculatedTotalSegments = 0
      let chatsWithAccurateData = 0
      console.log(`📊 Calculating SMS segments for ${allFilteredChats.length} chats using fullDataSegmentCache priority`)
      console.log(`📅 Date range: ${selectedDateRange} - Processing ${allFilteredChats.length} total chats for segment calculation`)

      allFilteredChats.forEach((chat, index) => {
        // Priority: Use accurate data from modal if available
        const accurateSegments = fullDataSegmentCache.get(chat.chat_id)
        if (accurateSegments !== undefined) {
          calculatedTotalSegments += accurateSegments
          chatsWithAccurateData++
          // Only log every 50th chat to avoid console spam for large date ranges
          if (index % 50 === 0 || index < 10 || index >= allFilteredChats.length - 5) {
            console.log(`Chat ${index + 1} (${chat.chat_id}): ${accurateSegments} segments (ACCURATE from modal)`)
          }
        } else {
          // Fallback to basic calculation only when no accurate data available
          // Use shouldCache: false to prevent circular dependency during metrics calculation
          const fallbackSegments = calculateChatSMSSegments(chat, false)
          calculatedTotalSegments += fallbackSegments
          // Only log every 50th chat to avoid console spam for large date ranges
          if (index % 50 === 0 || index < 10 || index >= allFilteredChats.length - 5) {
            console.log(`Chat ${index + 1} (${chat.chat_id}): ${fallbackSegments} segments (fallback)`)
          }
        }
      })

      console.log(`📊 ✅ COMPLETE: Total SMS segments calculated: ${calculatedTotalSegments} (${chatsWithAccurateData}/${allFilteredChats.length} from accurate modal data)`)
      console.log(`📈 Segment breakdown: ${chatsWithAccurateData} accurate + ${allFilteredChats.length - chatsWithAccurateData} fallback = ${calculatedTotalSegments} total segments`)
      setTotalSegments(calculatedTotalSegments)

      // Calculate total cost from calculated segments (more accurate than individual chat costs)
      const totalCostFromSegmentsUSD = calculatedTotalSegments * 0.0083 // USD per segment
      const totalCostFromSegments = currencyService.convertUSDToCAD(totalCostFromSegmentsUSD) // Convert to CAD
      console.log(`💰 Total cost calculated from ${calculatedTotalSegments} segments: $${totalCostFromSegmentsUSD.toFixed(4)} USD → $${totalCostFromSegments.toFixed(4)} CAD`)

      // Also calculate from individual chat costs for comparison/fallback
      let totalCostFromFilteredChats = 0
      let costsCalculated = 0

      allFilteredChats.forEach(chat => {
        const { cost } = smsCostManager.getChatCost(chat.chat_id)
        if (cost > 0) {
          totalCostFromFilteredChats += cost
          costsCalculated++
        }
      })

      // Use segments-based calculation as primary, fallback to individual costs if no segments
      const finalTotalCost = calculatedTotalSegments > 0 ? totalCostFromSegments : totalCostFromFilteredChats
      const avgCostPerChat = allFilteredChats.length > 0 ? finalTotalCost / allFilteredChats.length : 0

      console.log(`💰 Cost comparison - Segments: $${totalCostFromSegments.toFixed(4)} CAD, Individual: $${totalCostFromFilteredChats.toFixed(4)}, Using: $${finalTotalCost.toFixed(4)} CAD`)

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

      // Update metrics with calculated SMS segments (prioritizing accurate modal data)
      console.log(`💰 Updating metrics with totalSMSSegments: ${calculatedTotalSegments} (${chatsWithAccurateData}/${allFilteredChats.length} from accurate modal data)`)

      setMetrics(prevMetrics => {
        const updatedMetrics = {
          ...prevMetrics,
          totalCost: finalTotalCost, // Use segments-based calculation
          avgCostPerChat,
          totalSMSSegments: calculatedTotalSegments,
          positiveSentimentCount,
          peakHour,
          peakHourCount
        }
        console.log(`💰 Updated metrics: Total SMS Segments = ${updatedMetrics.totalSMSSegments}, Total Cost = $${updatedMetrics.totalCost.toFixed(4)} CAD`)
        return updatedMetrics
      })
    }

    calculateMetrics()
  }, [allFilteredChats, smsCostManager.costs, segmentUpdateTrigger, fullDataSegmentCache])

  // Proactively load segment data for all chats to ensure accurate totals
  const loadSegmentDataForChats = useCallback(async (chats: Chat[]) => {
    // Only load for chats that don't already have cached data
    const chatsNeedingData = chats.filter(chat => !fullDataSegmentCache.has(chat.chat_id))

    if (chatsNeedingData.length === 0) {
      console.log('📊 All chats already have cached segment data')
      return
    }

    console.log(`📊 Loading segment data for ${chatsNeedingData.length}/${chats.length} chats in background`)

    // Process in batches to avoid overwhelming the API
    const batchSize = 10
    const batches = []
    for (let i = 0; i < chatsNeedingData.length; i += batchSize) {
      batches.push(chatsNeedingData.slice(i, i + batchSize))
    }

    // Process batches with delay between them
    for (const [batchIndex, batch] of batches.entries()) {
      try {
        // Process batch in parallel
        const batchPromises = batch.map(async (chat) => {
          try {
            const fullChatData = await chatService.getChat(chat.chat_id)
            if (fullChatData?.message_with_tool_calls) {
              const segments = twilioCostService.calculateSMSSegments(fullChatData.message_with_tool_calls)

              // Update the cache
              setFullDataSegmentCache(prev => {
                const newCache = new Map(prev.set(chat.chat_id, segments))
                saveSegmentCache(newCache)
                return newCache
              })

              return { chatId: chat.chat_id, segments }
            }
          } catch (error) {
            console.warn(`Failed to load segment data for chat ${chat.chat_id}:`, error)
          }
          return null
        })

        const batchResults = await Promise.all(batchPromises)
        const successCount = batchResults.filter(r => r !== null).length
        console.log(`📊 Batch ${batchIndex + 1}/${batches.length}: Loaded segment data for ${successCount}/${batch.length} chats`)

        // Small delay between batches to avoid overwhelming the API
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Error processing batch ${batchIndex + 1}:`, error)
      }
    }

    console.log(`📊 ✅ Finished loading segment data for ${chatsNeedingData.length} chats`)
  }, [fullDataSegmentCache, saveSegmentCache])

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
      const { start, end } = getDateRangeFromSelection(selectedDateRange, customStartDate, customEndDate)
      console.log(`🔍 fetchChatsOptimized: selectedDateRange = "${selectedDateRange}"`)
      console.log(`📅 Date range for filtering: ${start.toLocaleString()} to ${end.toLocaleString()}`)
      console.log(`⏰ Current time: ${new Date().toLocaleString()}`)

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
          limit: 2000, // Increased limit to handle full year range data
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

      console.log(`🔍 Total chats received from API: ${allChatsResponse.chats.length} (requested up to 2000 chats)`)
      console.log(`📅 Filtering range: ${startMs} to ${endMs}`)

      // Warn if we hit the API limit - might need multiple requests for very large date ranges
      if (allChatsResponse.chats.length >= 2000) {
        console.warn(`⚠️ WARNING: Received maximum API limit (2000 chats). Some chats from ${selectedDateRange} may be missing!`)
        console.warn(`📋 Consider implementing pagination for date ranges with >2000 chats`)
      }

      const finalFiltered = allChatsResponse.chats.filter(chat => {
        const timestamp = chat.start_timestamp
        const chatTimeMs = timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp
        const isInRange = chatTimeMs >= startMs && chatTimeMs <= endMs

        // Debug first few chats
        if (allChatsResponse.chats.indexOf(chat) < 3) {
          console.log(`Chat ${chat.chat_id}: timestamp=${timestamp}, chatTimeMs=${chatTimeMs}, date=${new Date(chatTimeMs).toLocaleString()}, inRange=${isInRange}`)
        }

        return isInRange
      })

      console.log(`📊 After filtering: ${finalFiltered.length} chats match "${selectedDateRange}" date range`)

      // If "today" has many chats, show warning
      if (selectedDateRange === 'today' && finalFiltered.length > 20) {
        console.warn(`⚠️ WARNING: "today" date range contains ${finalFiltered.length} chats - this seems high!`)
        console.warn(`📅 Today range: ${start.toLocaleString()} to ${end.toLocaleString()}`)
        console.warn(`⏰ Current time: ${new Date().toLocaleString()}`)
      }

      setTotalChatsCount(finalFiltered.length)
      setAllFilteredChats(finalFiltered)

      // Calculate pagination
      const startIndex = (currentPage - 1) * recordsPerPage
      const endIndex = startIndex + recordsPerPage
      const paginatedChats = finalFiltered.slice(startIndex, endIndex)

      setChats(paginatedChats)

      // Proactively load segment data for accurate totals (async, don't block UI)
      loadSegmentDataForChats(finalFiltered)
      setLastDataFetch(Date.now())

      // Calculate basic metrics using optimized service (exclude SMS segments, handled separately)
      const calculatedMetrics = chatService.getChatStats(finalFiltered)
      console.log('📊 Chat metrics calculated:', calculatedMetrics)
      setMetrics(prev => ({
        ...prev,
        ...calculatedMetrics,
        // Preserve totalSMSSegments - it will be calculated in the separate useEffect
        totalSMSSegments: prev.totalSMSSegments
      }))

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
  }, [selectedDateRange, customStartDate, customEndDate, currentPage, lastDataFetch])



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
    if (!mountedRef.current || loading || isSmartRefreshing) {
      console.log('Skipping smart refresh - component unmounted, loading, or already refreshing')
      return
    }

    console.log('🔄 Starting smart refresh...')
    setIsSmartRefreshing(true)

    try {
      const result = await optimizedChatService.smartRefresh(chats, {
        limit: recordsPerPage * 2,
        filter_criteria: smsAgentConfigured && smsAgentId ? { agent_id: smsAgentId } : undefined
      })

      if (result.hasChanges && mountedRef.current) {
        console.log('✅ Smart refresh detected changes, updating data')
        // Don't call fetchChatsOptimized to avoid recursion, just use the result data
        if (result.chats) {
          setChats(result.chats)
          setLastDataFetch(Date.now())
        }
      } else {
        console.log('✅ Smart refresh: no changes detected')
      }
    } catch (error) {
      console.warn('❌ Smart refresh failed:', error)
      // Don't do fallback refresh to avoid infinite loops
    } finally {
      // Always ensure we reset the smart refreshing state
      if (mountedRef.current) {
        console.log('🔄 Smart refresh finished, resetting state')
        setIsSmartRefreshing(false)
      }
    }
  }, [chats, loading, isSmartRefreshing, smsAgentConfigured, smsAgentId])

  // Load SMS agent configuration on mount
  useEffect(() => {
    const loadSMSAgentConfig = async () => {
      try {
        // Load from user settings
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

            // Handle custom date range
            if (range === 'custom' && customStart && customEnd) {
              setCustomStartDate(customStart)
              setCustomEndDate(customEnd)
              // Save custom dates to localStorage
              localStorage.setItem('sms_page_custom_start_date', customStart.toISOString())
              localStorage.setItem('sms_page_custom_end_date', customEnd.toISOString())
            } else if (range !== 'custom') {
              // Clear custom dates when switching to non-custom range
              setCustomStartDate(undefined)
              setCustomEndDate(undefined)
              localStorage.removeItem('sms_page_custom_start_date')
              localStorage.removeItem('sms_page_custom_end_date')
            }

            const { start, end } = getDateRangeFromSelection(range, customStart, customEnd)
            console.log('SMS date range changed:', { range, start, end, customStart, customEnd })
          }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              console.log('SMS page manual refresh triggered at:', new Date().toLocaleTimeString())
              // Clear caches and force a complete refresh
              optimizedChatService.clearAllCaches()
              smsCostManager.clearCosts()
              setSegmentCache(new Map()) // Clear segment cache on manual refresh
              setLoadingFullChats(new Set()) // Clear loading state
              setSegmentUpdateTrigger(0) // Reset segment update trigger
              setError('')
              // Note: We preserve fullDataSegmentCache as it contains persistent data
              // It will be validated against new chat data automatically
              console.log('🔄 Manual refresh: cleared temporary caches, preserving persistent segment cache')
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

          {/* Progress Indicator */}
          {isLoadingSegments && (
            <div className="mt-2 mb-1">
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Calculating accurate segments... ({segmentLoadingProgress.completed}/{segmentLoadingProgress.total})</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: segmentLoadingProgress.total > 0
                      ? `${(segmentLoadingProgress.completed / segmentLoadingProgress.total) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
              {/* Cache info */}
              <div className="text-[10px] text-gray-500 mt-1">
                💾 {fullDataSegmentCache.size} chats cached • Only processing uncached chats
              </div>
            </div>
          )}

          {/* Completion Message */}
          {segmentLoadingComplete && !isLoadingSegments && (
            <div className="mt-2 mb-1">
              <div className="flex items-center gap-2 text-xs text-green-600">
                <div className="w-3 h-3 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">✓</span>
                </div>
                <span>✅ Calculation complete!</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                💾 {fullDataSegmentCache.size} chats now cached • Future loads will be faster
              </div>
            </div>
          )}

          {/* Manual Refresh Button (show when there are uncached chats but auto-load was skipped) */}
          {!isLoadingSegments && !segmentLoadingComplete && allFilteredChats.length > 0 && (
            (() => {
              const chatsToProcess = allFilteredChats.filter(chat => !fullDataSegmentCache.has(chat.chat_id))
              const cachedCount = allFilteredChats.length - chatsToProcess.length
              const cacheHitRate = cachedCount / allFilteredChats.length

              // Show button if there are uncached chats
              return chatsToProcess.length > 0 ? (
                <div className="mt-2 mb-1">
                  <button
                    onClick={() => loadAccurateSegmentsForAllChats()}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 transition-colors"
                    title={`Calculate accurate segments for ${chatsToProcess.length} uncached chats`}
                  >
                    <RefreshCwIcon className="w-3 h-3" />
                    <span>Calculate {chatsToProcess.length} uncached</span>
                  </button>
                </div>
              ) : null
            })()
          )}

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
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  {patientName}
                                  {hasNotes(chat.chat_id) && (
                                    <div className="flex items-center gap-1">
                                      <StickyNoteIcon className="h-4 w-4 text-blue-500" />
                                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        {getNoteCount(chat.chat_id)}
                                      </span>
                                    </div>
                                  )}
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
                                  "SMS cost"
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
            onNotesChanged={() => refetchNotesCount()}
          />
        )}

        {/* Site Help Chatbot - NO PHI ACCESS */}
        <SiteHelpChatbot
          isVisible={showHelpChatbot}
          onToggle={() => setShowHelpChatbot(!showHelpChatbot)}
        />

    </div>
  )
}