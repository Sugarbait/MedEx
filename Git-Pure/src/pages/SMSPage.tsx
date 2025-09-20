import React, { useState, useEffect } from 'react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { ChatDetailModal } from '@/components/common/ChatDetailModal'
import { chatService, type Chat, type ChatListOptions } from '@/services/chatService'
import { retellService } from '@/services'
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
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [isChatDetailModalOpen, setIsChatDetailModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalChatsCount, setTotalChatsCount] = useState(0)
  const recordsPerPage = 25

  // Auto-refresh functionality
  const { formatLastRefreshTime } = useAutoRefresh({
    enabled: true,
    interval: 60000, // 1 minute
    onRefresh: () => {
      fetchChats()
      console.log('SMS Chat page refreshed at:', new Date().toLocaleTimeString())
    }
  })

  // Fetch chats when component mounts or date range changes
  useEffect(() => {
    setCurrentPage(1) // Reset to first page when date range changes
    fetchChats()
  }, [selectedDateRange])

  useEffect(() => {
    fetchChats()
  }, [currentPage])

  const fetchChats = async () => {
    setLoading(true)
    setError('')

    try {
      // Skip credential reload if already configured to reduce overhead
      if (!chatService.isConfigured()) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
        if (currentUser.id) {
          const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
          chatService.updateCredentials(settings.retellApiKey, settings.smsAgentId)
        }

        if (!chatService.isConfigured()) {
          setError('API not configured. Go to Settings → API Configuration to set up your credentials.')
          setLoading(false)
          return
        }
      }

      // Skip connection test on subsequent calls for faster loading
      const skipConnectionTest = chatService.isConfigured()
      if (!skipConnectionTest) {
        const connectionTest = await chatService.testConnection()
        if (!connectionTest.success) {
          setError(`API Connection Error: ${connectionTest.message}`)
          setLoading(false)
          return
        }
      }

      // Get date range for filtering
      const { start, end } = getDateRangeFromSelection(selectedDateRange)
      const SMS_AGENT_ID = 'agent_643486efd4b5a0e9d7e094ab99'

      // Optimized: Fetch with reduced limit and use pagination on server side if possible
      const allChatsResponse = await chatService.getChatHistory({
        limit: 500 // Reduced from 1000 for faster initial load
      })

      // Combined filtering for better performance
      const startMs = start.getTime()
      const endMs = end.getTime()

      const finalFiltered = allChatsResponse.chats.filter(chat => {
        // Early return if not SMS agent
        if (chat.agent_id !== SMS_AGENT_ID) return false

        // Optimized timestamp conversion
        let chatTimeMs: number
        const timestamp = chat.start_timestamp
        chatTimeMs = timestamp.toString().length <= 10 ? timestamp * 1000 : timestamp

        return chatTimeMs >= startMs && chatTimeMs <= endMs
      })

      setTotalChatsCount(finalFiltered.length)

      // Calculate pagination using filtered data
      const startIndex = (currentPage - 1) * recordsPerPage
      const endIndex = startIndex + recordsPerPage
      const paginatedChats = finalFiltered.slice(startIndex, endIndex)

      setChats(paginatedChats)

      // Calculate metrics using filtered chat service
      const calculatedMetrics = chatService.getChatStats(finalFiltered)
      setMetrics(calculatedMetrics)

      console.log('SMS Chats fetched for agent', SMS_AGENT_ID + ':', paginatedChats.length, 'of', finalFiltered.length)
      console.log('Final filtering result - using: service method filter')
      console.log('Chat Analytics:', calculatedMetrics)

    } catch (error) {
      console.error('Failed to fetch chats:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch chat data')
    } finally {
      setLoading(false)
    }
  }



  const endChat = async (chatId: string) => {
    try {
      const result = await chatService.endChat(chatId)
      if (result.success) {
        console.log('Chat ended successfully:', chatId)
        fetchChats() // Refresh to show updated status
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

  const filteredChats = chats.filter(chat => {
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

    const matchesSearch = !searchTerm ||
      phoneNumber.includes(searchTerm) ||
      patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.transcript.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.chat_id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || chat.chat_status === statusFilter
    const matchesSentiment = sentimentFilter === 'all' || chat.chat_analysis?.user_sentiment === sentimentFilter

    return matchesSearch && matchesStatus && matchesSentiment
  })

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
              // Force a complete refresh by clearing error state and triggering fetch
              setError('')
              setLoading(true)
              fetchChats()
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <DownloadIcon className="w-4 h-4" />
            Export Chat Report
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-6">
        Last refreshed: {formatLastRefreshTime()} (Auto-refresh every minute) | {totalChatsCount} total chats
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Chats</span>
            <MessageCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {loading ? '...' : metrics.totalChats}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? `${metrics.completedChats} completed, ${metrics.errorChats} failed` : 'No chats started'}
          </div>
        </div>

        {/* Active Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Active Chats</span>
            <PlayCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
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
          <div className="text-3xl font-black text-blue-600 mb-1">
            ${loading ? '...' : metrics.avgCostPerChat.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">
            Total cost: ${metrics.totalCost.toFixed(2)}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Success Rate</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {loading ? '...' : `${metrics.successRate.toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalChats > 0 ? `${Math.round(metrics.totalChats * metrics.successRate / 100)} successful chats` : '0 successful chats'}
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Duration</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {loading ? '...' : metrics.avgDuration}
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
            {loading ? '...' : metrics.positiveSentimentCount}
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
            {loading ? '...' : metrics.totalMessages}
          </div>
          <div className="text-xs text-gray-500">
            Avg {metrics.avgMessagesPerChat.toFixed(1)} messages per chat
          </div>
        </div>

        {/* Error Chats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Error Chats</span>
            <AlertCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {loading ? '...' : metrics.errorChats}
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
                                ${(chat.chat_cost?.total_cost || 0).toFixed(3)}
                              </div>
                              <div className="text-xs text-gray-500">
                                SMS Cost
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
                              <span className="text-gray-500">
                                ${(chat.chat_cost?.total_cost || 0).toFixed(3)}
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

    </div>
  )
}