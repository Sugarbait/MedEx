import React, { useState, useEffect } from 'react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { chatService, type Chat, type ChatAnalytics } from '@/services/chatService'
import { retellService } from '@/services'
import {
  BarChart3Icon,
  MessageSquareIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ClockIcon,
  UsersIcon,
  FilterIcon,
  CheckIcon,
  XIcon,
  CalendarIcon,
  RefreshCwIcon,
  DownloadIcon,
  SendIcon,
  DollarSignIcon,
  ThumbsUpIcon,
  AlertTriangleIcon,
  MessageCircleIcon,
  BotIcon,
  PlayCircleIcon,
  PieChartIcon,
  ActivityIcon
} from 'lucide-react'

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
}

interface ChatTrendData {
  date: string
  chatCount: number
  avgDuration: number
  totalCost: number
  successRate: number
}

interface SentimentData {
  positive: number
  negative: number
  neutral: number
}

interface PeakHoursData {
  hour: number
  chatCount: number
}

export const SMSAnalyticsPage: React.FC = () => {
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
    avgMessagesPerChat: 0
  })
  const [analytics, setAnalytics] = useState<ChatAnalytics | null>(null)
  const [trendData, setTrendData] = useState<ChatTrendData[]>([])
  const [sentimentData, setSentimentData] = useState<SentimentData>({ positive: 0, negative: 0, neutral: 0 })
  const [peakHours, setPeakHours] = useState<PeakHoursData[]>([])
  const [error, setError] = useState('')

  // Auto-refresh functionality
  const { formatLastRefreshTime } = useAutoRefresh({
    enabled: true,
    interval: 60000, // 1 minute
    onRefresh: () => {
      fetchAnalytics()
      console.log('Chat Analytics page refreshed at:', new Date().toLocaleTimeString())
    }
  })

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('today')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [selectedDateRange])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Skip credential reload if already configured for faster loading
      if (!chatService.isConfigured()) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
        if (currentUser.id) {
          const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
          chatService.updateCredentials(settings.retellApiKey, settings.smsAgentId)
        }

        if (!chatService.isConfigured()) {
          setError('API not configured. Go to Settings → API Configuration to set up your credentials.')
          setIsLoading(false)
          return
        }
      }

      // Skip connection test for faster subsequent loads
      const skipConnectionTest = chatService.isConfigured()
      if (!skipConnectionTest) {
        const connectionTest = await chatService.testConnection()
        if (!connectionTest.success) {
          setError(`API Connection Error: ${connectionTest.message}`)
          setIsLoading(false)
          return
        }
      }

      // Get date range for filtering
      const { start, end } = getDateRangeFromSelection(selectedDateRange)
      const SMS_AGENT_ID = 'agent_643486efd4b5a0e9d7e094ab99'

      // Parallel data fetching for better performance
      const [allChatsResponse, chatAnalytics] = await Promise.all([
        chatService.getChatHistory({
          limit: 500 // Reduced limit for faster loading
        }),
        chatService.getChatAnalytics({
          agent_id: SMS_AGENT_ID
        })
      ])

      // Optimized combined filtering
      const startMs = start.getTime()
      const endMs = end.getTime()

      const filteredChats = allChatsResponse.chats.filter(chat => {
        // Early return for non-SMS agent
        if (chat.agent_id !== SMS_AGENT_ID) return false

        // Optimized timestamp handling
        const timestamp = chat.start_timestamp
        const chatTimeMs = timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp

        return chatTimeMs >= startMs && chatTimeMs <= endMs
      })

      // Calculate metrics using filtered chat data
      const calculatedMetrics = chatService.getChatStats(filteredChats)
      setMetrics(calculatedMetrics)
      setAnalytics(chatAnalytics)

      // Set analytics data
      setTrendData(chatAnalytics.trends)
      setSentimentData(chatAnalytics.sentimentDistribution)
      setPeakHours(chatAnalytics.peakHours)

    } catch (error: any) {
      console.error('Failed to fetch chat analytics:', error)
      setError(error.message || 'Failed to fetch chat analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const getTotalSentimentCount = () => {
    return sentimentData.positive + sentimentData.negative + sentimentData.neutral
  }

  const getSentimentPercentage = (count: number) => {
    const total = getTotalSentimentCount()
    return total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  }

  const getTopPeakHour = () => {
    if (peakHours.length === 0) return null
    return peakHours.reduce((max, hour) => hour.chatCount > max.chatCount ? hour : max, peakHours[0])
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
            console.log('SMS Analytics date range changed:', { range, start, end })
            fetchAnalytics()
          }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <RefreshCwIcon className="w-4 h-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <DownloadIcon className="w-4 h-4" />
            Export SMS Report
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-6">
        Last refreshed: {formatLastRefreshTime()} (Auto-refresh every minute) | Chat Analytics Dashboard
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-600 hover:text-red-800 text-xl"
          >
            ×
          </button>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Chats</span>
            <MessageCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.totalChats}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? `${metrics.completedChats} completed, ${metrics.errorChats} failed` : 'No chats started'}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Success Rate</span>
            <CheckIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : `${metrics.successRate.toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? `${Math.round(metrics.totalChats * metrics.successRate / 100)} successful` : '0 successful'}
          </div>
        </div>

        {/* Avg Cost Per Chat */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Cost Per Chat</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            ${isLoading ? '...' : metrics.avgCostPerChat.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">
            Total cost: ${metrics.totalCost.toFixed(2)}
          </div>
        </div>

        {/* Active Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Active Chats</span>
            <PlayCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.activeChats}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.activeChats > 0 ? 'Currently ongoing' : 'None active'}
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Duration</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.avgDuration}
          </div>
          <div className="text-xs text-gray-500">
            Average conversation length
          </div>
        </div>

        {/* Positive Sentiment */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Positive Sentiment</span>
            <ThumbsUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.positiveSentimentCount}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? `${((metrics.positiveSentimentCount / metrics.totalChats) * 100).toFixed(1)}% positive` : '0% positive'}
          </div>
        </div>

        {/* Total Messages */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Messages</span>
            <MessageSquareIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.totalMessages}
          </div>
          <div className="text-xs text-gray-500">
            Avg {metrics.avgMessagesPerChat.toFixed(1)} per chat
          </div>
        </div>

        {/* Error Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Error Chats</span>
            <AlertTriangleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.errorChats}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? `${((metrics.errorChats / metrics.totalChats) * 100).toFixed(1)}% failure rate` : '0% failure rate'}
          </div>
        </div>
      </div>

      {/* Total Chat Costs Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSignIcon className="w-5 h-5 text-green-600" />
              <span className="text-lg font-semibold text-gray-900">Total Chat Costs</span>
            </div>
            <p className="text-sm text-gray-500">Complete cost breakdown for selected date range</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-green-600">${metrics.totalCost.toFixed(2)}</div>
            <div className="text-sm text-gray-500">{metrics.totalChats} chats</div>
          </div>
        </div>
      </div>


    </div>
  )
}