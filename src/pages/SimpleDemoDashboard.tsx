import React, { useState, useEffect } from 'react'
import { PhoneIcon, MessageSquareIcon, DollarSignIcon, TrendingUpIcon, CalendarIcon } from 'lucide-react'
import { demoDataService } from '@/services/demoDataService'

export const SimpleDemoDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [dateRange, setDateRange] = useState<'today' | 'thisWeek' | 'thisMonth' | 'all'>('thisWeek')

  useEffect(() => {
    loadDemoData()
  }, [dateRange])

  const loadDemoData = async () => {
    setIsLoading(true)
    try {
      const { startDate, endDate } = getDateRange()
      const data = await demoDataService.getAnalytics(startDate, endDate)
      setAnalytics(data)
    } catch (error) {
      console.error('Error loading demo data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (dateRange) {
      case 'today':
        return { startDate: today, endDate: now }
      case 'thisWeek':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        return { startDate: weekStart, endDate: now }
      case 'thisMonth':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        return { startDate: monthStart, endDate: now }
      case 'all':
      default:
        const farPast = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        return { startDate: farPast, endDate: now }
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${(amount * 1.45).toFixed(2)} CAD` // Convert to CAD
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading demo data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Demo Mode - Showing sample data (no external API calls)</p>
        </div>

        {/* Demo Mode Warning */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-yellow-800 dark:text-yellow-300 text-sm">
            <strong>Demo Mode Active:</strong> This dashboard is displaying sample data. No real calls or SMS are being fetched.
            All data is generated locally with NO connections to MedEx or any external APIs.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="mb-6 flex gap-2">
          {(['today', 'thisWeek', 'thisMonth', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <CalendarIcon className="inline w-4 h-4 mr-1" />
              {range === 'today' && 'Today'}
              {range === 'thisWeek' && 'This Week'}
              {range === 'thisMonth' && 'This Month'}
              {range === 'all' && 'All Time'}
            </button>
          ))}
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Total Calls */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Calls</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
                  {analytics?.totalCalls || 0}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                <PhoneIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* Total SMS */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total SMS</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
                  {analytics?.totalSMS || 0}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                <MessageSquareIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* Total Cost */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
                  {formatCurrency(analytics?.totalCost || 0)}
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
                <DollarSignIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          {/* Avg Call Duration */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Call Duration</p>
                <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
                  {formatDuration(analytics?.avgCallDuration || 0)}
                </p>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
                <TrendingUpIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Cost Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Call Costs</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatCurrency(analytics?.totalCallCost || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">SMS Costs</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatCurrency(analytics?.totalSMSCost || 0)}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 dark:text-white">Total</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(analytics?.totalCost || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Activity Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Inbound Calls</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {analytics?.calls?.filter((c: any) => c.direction === 'inbound').length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Outbound Calls</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {analytics?.calls?.filter((c: any) => c.direction === 'outbound').length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">SMS Conversations</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {analytics?.totalSMS || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {analytics?.calls?.slice(0, 5).map((call: any, index: number) => (
              <div key={call.call_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex items-center gap-3">
                  <PhoneIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">{call.to_number}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(call.start_timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {formatCurrency(call.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
