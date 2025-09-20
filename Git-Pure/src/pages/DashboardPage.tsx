import React, { useState, useEffect } from 'react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { retellService } from '@/services'
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

export const DashboardPage: React.FC<DashboardPageProps> = ({ user }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('today')
  const [error, setError] = useState('')
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
    avgResponseTime: '0m',
    avgCostPerMessage: 0,
    messageDeliveryRate: 0
  })
  const [retellStatus, setRetellStatus] = useState<'checking' | 'connected' | 'error' | 'not-configured'>('checking')

  // Auto-refresh functionality
  const { formatLastRefreshTime } = useAutoRefresh({
    enabled: true,
    interval: 60000, // 1 minute
    onRefresh: () => {
      fetchDashboardData()
      console.log('Dashboard refreshed at:', new Date().toLocaleTimeString())
    }
  })

  // Load dashboard data
  useEffect(() => {
    fetchDashboardData()
  }, [selectedDateRange])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Force reload of credentials from localStorage
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (currentUser.id) {
        const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
        retellService.updateCredentials(settings.retellApiKey, settings.callAgentId, settings.smsAgentId)
        console.log('Reloaded retell credentials:', {
          hasApiKey: !!settings.retellApiKey,
          callAgentId: settings.callAgentId,
          smsAgentId: settings.smsAgentId
        })

        // Ensure the specific SMS agent is set if not configured
        if (!settings.smsAgentId) {
          console.log('SMS Agent ID not configured, using default: agent_643486efd4b5a0e9d7e094ab99')
          retellService.updateCredentials(settings.retellApiKey, settings.callAgentId, 'agent_643486efd4b5a0e9d7e094ab99')
        }
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
        const allChatsResponse = await retellService.getChatHistory()
        console.log(`Total chats fetched: ${allChatsResponse.chats.length}`)

        // Define date range for chat filtering
        const startMs = start.getTime()
        const endMs = end.getTime()

        // Filter chats by the selected date range (similar to calls)
        const filteredChats = allChatsResponse.chats.filter(chat => {
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
          console.log(`Chat ${chat.chat_id}: date=${new Date(chatTimeMs).toLocaleDateString()}, isInRange=${isInRange}`)

          return isInRange
        })

        console.log(`Filtered chats for ${selectedDateRange}: ${filteredChats.length} out of ${allChatsResponse.chats.length}`)

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

      const callMetrics = retellService.calculateCallMetrics(callsResponse.calls)
      const chatMetrics = retellService.calculateChatMetrics(chatsResponse.chats)

      console.log('Calculated metrics:')
      console.log('- Call metrics:', callMetrics)
      console.log('- Chat metrics:', chatMetrics)

      setMetrics({
        totalCalls: callMetrics.totalCalls,
        avgCallDuration: callMetrics.avgDuration,
        avgCostPerCall: callMetrics.avgCostPerCall,
        callSuccessRate: callMetrics.successRate,
        totalCost: callMetrics.totalCost,
        highestCostCall: callMetrics.highestCostCall,
        lowestCostCall: callMetrics.lowestCostCall,
        totalCallDuration: callMetrics.totalDuration,
        totalMessages: chatMetrics.totalMessages,
        avgResponseTime: chatMetrics.avgResponseTime,
        avgCostPerMessage: chatMetrics.avgCostPerMessage,
        messageDeliveryRate: chatMetrics.deliveryRate
      })

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data')
      setRetellStatus('error')
    } finally {
      setIsLoading(false)
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
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <DownloadIcon className="w-4 h-4" />
            Export Dashboard Report
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

      {/* Call Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Calls</span>
            <PhoneIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.totalCalls}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalCalls === 0 ? 'No calls made' : `${metrics.totalCalls} calls completed`}
          </div>
        </div>

        {/* Total Talk Time */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Talk Time</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.totalCallDuration}
          </div>
          <div className="text-xs text-gray-500">
            Avg: {metrics.avgCallDuration}
          </div>
        </div>

        {/* Average Cost Per Call */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Cost Per Call</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            ${isLoading ? '...' : metrics.avgCostPerCall.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            Total: ${metrics.totalCost.toFixed(2)}
          </div>
        </div>

        {/* Highest Cost Call */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Highest Cost</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            ${isLoading ? '...' : metrics.highestCostCall.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            Lowest: ${metrics.lowestCostCall.toFixed(2)}
          </div>
        </div>

      </div>

      {/* SMS Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            No messages sent
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Response Time</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.avgResponseTime}
          </div>
          <div className="text-xs text-gray-500">
            Fastest: {metrics.avgResponseTime}
          </div>
        </div>

        {/* Avg Cost Per Message */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Cost Per Message</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            ${isLoading ? '...' : metrics.avgCostPerMessage.toFixed(3)}
          </div>
          <div className="text-xs text-gray-500">
            Total cost: ${metrics.avgCostPerMessage.toFixed(2)}
          </div>
        </div>

        {/* Message Delivery Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Message Delivery Rate</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : `${metrics.messageDeliveryRate.toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500">
            0 delivered
          </div>
        </div>
      </div>

      {/* System Status Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheckIcon className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ActivityIcon className={`w-4 h-4 ${retellStatus === 'connected' ? 'text-green-500' : retellStatus === 'error' ? 'text-red-500' : retellStatus === 'not-configured' ? 'text-yellow-500' : 'text-gray-500'}`} />
              <span className="text-sm text-gray-900">API Service</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${retellStatus === 'connected' ? 'bg-green-500' : retellStatus === 'error' ? 'bg-red-500' : retellStatus === 'not-configured' ? 'bg-yellow-500' : 'bg-gray-500'}`} />
              <span className="text-xs text-gray-600">
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
              <span className="text-sm text-gray-900">Database</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600">Connected</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-900">Security</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-900">HIPAA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600">Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}