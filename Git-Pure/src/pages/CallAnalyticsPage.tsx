import React, { useState, useEffect } from 'react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { retellService } from '@/services'
import {
  BarChart3Icon,
  PhoneIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UsersIcon,
  CalendarIcon,
  FilterIcon,
  DollarSignIcon,
  ThumbsUpIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  DownloadIcon
} from 'lucide-react'

interface CallMetrics {
  totalCalls: number
  avgDuration: string
  avgCostPerCall: number
  successRate: number
  totalDuration: string
  positiveSentiment: number
  highestCostCall: number
  failedCalls: number
}

interface CallData {
  date: string
  calls: number
  duration: number
  success: number
}

export const CallAnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<CallMetrics>({
    totalCalls: 0,
    avgDuration: '0:00',
    avgCostPerCall: 0,
    successRate: 0,
    totalDuration: '0:00',
    positiveSentiment: 0,
    highestCostCall: 0,
    failedCalls: 0
  })

  const [callData, setCallData] = useState<CallData[]>([])
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('today')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [retellStatus, setRetellStatus] = useState<'checking' | 'connected' | 'error' | 'not-configured'>('checking')

  // Auto-refresh functionality
  const { formatLastRefreshTime } = useAutoRefresh({
    enabled: true,
    interval: 60000, // 1 minute
    onRefresh: () => {
      fetchAnalytics()
      console.log('Call Analytics page refreshed at:', new Date().toLocaleTimeString())
    }
  })

  useEffect(() => {
    fetchAnalytics()
  }, [selectedDateRange])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Force reload of credentials from localStorage (same as Dashboard)
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      if (currentUser.id) {
        const settings = JSON.parse(localStorage.getItem(`settings_${currentUser.id}`) || '{}')
        retellService.updateCredentials(settings.retellApiKey, settings.callAgentId, settings.smsAgentId)
        console.log('Call Analytics: Reloaded retell credentials:', {
          hasApiKey: !!settings.retellApiKey,
          callAgentId: settings.callAgentId,
          smsAgentId: settings.smsAgentId
        })
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
      console.log('Call Analytics: Date range for API:', {
        start: start.toISOString(),
        end: end.toISOString(),
        startTimestamp: Math.floor(start.getTime() / 1000),
        endTimestamp: Math.floor(end.getTime() / 1000)
      })

      // Fetch call data with optimized performance
      let callsResponse
      try {
        // Optimized: Use date range endpoint with reduced limit for faster loading
        const dateRangeResponse = await retellService.getCallHistoryByDateRange(start, end, { limit: 300 })
        console.log(`Call Analytics: Fetched ${dateRangeResponse.calls.length} calls for date range`)

        callsResponse = {
          calls: dateRangeResponse.calls,
          pagination_key: undefined,
          has_more: false
        }
      } catch (error) {
        console.error('Call Analytics: Failed to fetch calls:', error)
        callsResponse = { calls: [], pagination_key: undefined, has_more: false }
      }

      // Calculate metrics using the same method as Dashboard
      console.log('Call Analytics calculating metrics:')
      console.log('- Call data for metrics:', { count: callsResponse.calls.length })

      const calculatedMetrics = retellService.calculateCallMetrics(callsResponse.calls)
      console.log('Call Analytics: Calculated metrics:', calculatedMetrics)

      setMetrics({
        totalCalls: calculatedMetrics.totalCalls,
        avgDuration: calculatedMetrics.avgCallDuration,
        avgCostPerCall: calculatedMetrics.avgCostPerCall,
        successRate: calculatedMetrics.callSuccessRate,
        totalDuration: calculatedMetrics.totalCallDuration,
        positiveSentiment: 85, // This would need sentiment analysis from call transcripts
        highestCostCall: calculatedMetrics.highestCostCall,
        failedCalls: callsResponse.calls.filter(call => call.call_status === 'error').length
      })

      // Generate chart data grouped by date
      const chartData = generateChartData(callsResponse.calls)
      setCallData(chartData)

    } catch (error) {
      console.error('Call Analytics: Failed to fetch analytics:', error)
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data')
      setRetellStatus('error')

      // Set empty state
      setMetrics({
        totalCalls: 0,
        avgDuration: '0:00',
        avgCostPerCall: 0,
        successRate: 0,
        totalDuration: '0:00',
        positiveSentiment: 0,
        highestCostCall: 0,
        failedCalls: 0
      })
      setCallData([])
    } finally {
      setIsLoading(false)
    }
  }

  const generateChartData = (calls: any[]): CallData[] => {
    const grouped: { [date: string]: { calls: number; duration: number; success: number } } = {}

    calls.forEach(call => {
      const date = new Date(call.start_timestamp).toISOString().split('T')[0]
      if (!grouped[date]) {
        grouped[date] = { calls: 0, duration: 0, success: 0 }
      }
      grouped[date].calls++
      grouped[date].duration += call.call_length_seconds || 0
      if (call.call_status === 'completed') {
        grouped[date].success++
      }
    })

    return Object.entries(grouped).map(([date, data]) => ({
      date,
      calls: data.calls,
      duration: data.duration,
      success: (data.success / data.calls) * 100
    })).sort((a, b) => a.date.localeCompare(b.date))
  }

  const maxCalls = callData.length > 0 ? Math.max(...callData.map(d => d.calls)) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <DateRangePicker
          selectedRange={selectedDateRange}
          onRangeChange={(range, customStart, customEnd) => {
            setSelectedDateRange(range)
            const { start, end } = getDateRangeFromSelection(range, customStart, customEnd)
            console.log('Call Analytics date range changed:', { range, start, end })
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
            Export Analytics Report
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-6">
        Last refreshed: {formatLastRefreshTime()} (Auto-refresh every minute)
      </div>

      {/* Status Messages */}
      {retellStatus === 'not-configured' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangleIcon className="w-5 h-5" />
            <p className="font-medium">Retell API Not Configured</p>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            Please configure your Retell API credentials in Settings to view call analytics.
          </p>
        </div>
      )}

      {retellStatus === 'error' && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangleIcon className="w-5 h-5" />
            <p className="font-medium">API Connection Error</p>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Key Metrics Grid */}
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
            {metrics.totalCalls > 0 ? `${metrics.totalCalls - (metrics.failedCalls || 0)} completed, ${metrics.failedCalls || 0} failed` : 'No calls made'}
          </div>
        </div>

        {/* Avg Call Duration */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Call Duration</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.avgDuration}
          </div>
          <div className="text-xs text-gray-500">
            Longest: {metrics.avgDuration}
          </div>
        </div>

        {/* Avg Cost Per Call */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Cost Per Call</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            ${isLoading ? '...' : (metrics.avgCostPerCall || 0).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            Total cost: ${(metrics.avgCostPerCall || 0).toFixed(2)}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Success Rate</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : `${(metrics.successRate || 0).toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500">
            {metrics.totalCalls > 0 ? `${metrics.totalCalls - (metrics.failedCalls || 0)} goals achieved` : '0 goals achieved'}
          </div>
        </div>

        {/* Total Duration */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Duration</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.totalDuration}
          </div>
          <div className="text-xs text-gray-500">
            0 calls analyzed
          </div>
        </div>

        {/* Positive Sentiment */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Positive Sentiment</span>
            <ThumbsUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : `${metrics.positiveSentiment}/0`}
          </div>
          <div className="text-xs text-gray-500">
            0% positive
          </div>
        </div>

        {/* Highest Cost Call */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Highest Cost Call</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            ${isLoading ? '...' : (metrics.highestCostCall || 0).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            Lowest: ${(metrics.highestCostCall || 0).toFixed(2)}
          </div>
        </div>

        {/* Failed Calls */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Failed Calls</span>
            <AlertTriangleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 mb-1">
            {isLoading ? '...' : metrics.failedCalls}
          </div>
          <div className="text-xs text-gray-500">
            0% failure rate
          </div>
        </div>
      </div>

      {/* Total Call Costs Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSignIcon className="w-5 h-5 text-green-600" />
              <span className="text-lg font-semibold text-gray-900">Total Call Costs</span>
            </div>
            <p className="text-sm text-gray-500">Complete cost breakdown for selected date range</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-green-600">${(metrics.avgCostPerCall || 0).toFixed(2)}</div>
            <div className="text-sm text-gray-500">{metrics.totalCalls} calls</div>
          </div>
        </div>
      </div>


    </div>
  )
}