import React, { useState, useEffect } from 'react'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { DateRangePicker, DateRange, getDateRangeFromSelection } from '@/components/common/DateRangePicker'
import { CallDetailModal } from '@/components/common/CallDetailModal'
import { RetellWebClient } from 'retell-client-js-sdk'
import { retellService, type RetellCall, currencyService, twilioCostService } from '@/services'
import { notesService } from '@/services/notesService'
import {
  PhoneIcon,
  PlayIcon,
  DownloadIcon,
  MicIcon,
  MicOffIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SearchIcon,
  FilterIcon,
  MoreVerticalIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  DollarSignIcon,
  ThumbsUpIcon,
  BarChart3Icon,
  StickyNoteIcon
} from 'lucide-react'
import { supabase } from '@/config/supabase'
import { PHIDataHandler, encryptionService } from '@/services/encryption'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '@/services/auditLogger'

interface CallsPageProps {
  user: any
}

interface CallMetrics {
  totalCalls: number
  avgDuration: string
  avgCostPerCall: number
  successRate: number
  totalDuration: string
  positiveSentiment: number
  highestCostCall: number
  failedCalls: number
  totalCost: number
  totalMinutes: number
}

// Using RetellCall interface from service
type Call = RetellCall & {
  // Add any additional fields for compatibility
  patient_id?: string
  call_length_seconds?: number
  call_summary?: string
  metadata?: {
    patient_name?: string
    call_type?: string
    [key: string]: any
  }
  sentiment_analysis?: {
    overall_sentiment: 'positive' | 'negative' | 'neutral'
    confidence_score: number
  }
}

export const CallsPage: React.FC<CallsPageProps> = ({ user }) => {
  const [retellWebClient] = useState(() => new RetellWebClient())
  const [isCallActive, setIsCallActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [calls, setCalls] = useState<Call[]>([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [callStatus, setCallStatus] = useState<string>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>('today')
  const [metrics, setMetrics] = useState<CallMetrics>({
    totalCalls: 0,
    avgDuration: '0:00',
    avgCostPerCall: 0,
    successRate: 0,
    totalDuration: '0:00',
    positiveSentiment: 0,
    highestCostCall: 0,
    failedCalls: 0,
    totalCost: 0,
    totalMinutes: 0
  })
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [notesCount, setNotesCount] = useState<Record<string, number>>({})
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Function to refresh notes count for a specific call
  const refreshNotesCount = async (callId: string) => {
    try {
      console.log('CallsPage: Refreshing notes count for callId:', callId)
      // Small delay to ensure database operation completes
      await new Promise(resolve => setTimeout(resolve, 100))
      const notesCountData = await notesService.getNotesCount([callId], 'call')
      console.log('CallsPage: Got notes count data:', notesCountData)
      setNotesCount(prev => {
        const updated = { ...prev, ...notesCountData }
        // If the call has no notes, remove it from the count object
        if (!notesCountData[callId] || notesCountData[callId] === 0) {
          console.log('CallsPage: Removing callId from notes count (no notes):', callId)
          delete updated[callId]
        } else {
          console.log('CallsPage: Updated notes count for callId:', callId, 'count:', notesCountData[callId])
        }
        console.log('CallsPage: New notes count state:', updated)
        return updated
      })
    } catch (error) {
      console.error('Error refreshing notes count:', error)
    }
  }
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCallsCount, setTotalCallsCount] = useState(0)
  const recordsPerPage = 50

  // Auto-refresh functionality
  const { formatLastRefreshTime } = useAutoRefresh({
    enabled: true,
    interval: 60000, // 1 minute refresh interval
    onRefresh: () => {
      fetchCalls()
      console.log('Calls page refreshed at:', new Date().toLocaleTimeString())
    }
  })

  useEffect(() => {
    // Set up Retell client event listeners
    retellWebClient.on("call_started", () => {
      console.log("Call started")
      setIsCallActive(true)
      setCallStatus('active')
      setCurrentTranscript('')
    })

    retellWebClient.on("call_ended", () => {
      console.log("Call ended")
      setIsCallActive(false)
      setCallStatus('completed')
      fetchCalls()
    })

    retellWebClient.on("update", (update) => {
      if (update.transcript) {
        setCurrentTranscript(update.transcript)
      }
    })

    retellWebClient.on("error", (error) => {
      console.error("Call error:", error)
      setError(`Call error: ${error.message}`)
      setIsCallActive(false)
      setCallStatus('failed')
    })

    return () => {
      if (isCallActive) {
        retellWebClient.stopCall()
      }
    }
  }, [retellWebClient])

  // Fetch calls when component mounts or date range changes
  useEffect(() => {
    setCurrentPage(1) // Reset to first page when date range changes
    fetchCalls()
  }, [selectedDateRange])

  useEffect(() => {
    fetchCalls()
  }, [currentPage])

  const fetchCalls = async (retryCount = 0) => {
    setLoading(true)
    setError('')

    try {
      // Reload credentials (localStorage + Supabase sync)
      await retellService.loadCredentialsAsync()
      console.log('Reloaded credentials with cross-device sync:', {
        hasApiKey: !!retellService.isConfigured(),
        configured: retellService.isConfigured()
      })

      if (!retellService.isConfigured()) {
        setError('API not configured. Go to Settings → API Configuration to set up your credentials.')
        setLoading(false)
        return
      }

      // Skip connection test for faster subsequent loads
      const skipConnectionTest = retellService.isConfigured()
      if (!skipConnectionTest) {
        const connectionTest = await retellService.testConnection()
        if (!connectionTest.success) {
          setError(`API Connection Error: ${connectionTest.message}`)
          setLoading(false)
          return
        }
      }

      // Get date range
      const { start, end } = getDateRangeFromSelection(selectedDateRange)

      // Fetch with retry logic for rate limiting
      let allCallsResponse
      try {
        // Add small delay to prevent rate limiting
        if (retryCount > 0) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 8000) // Exponential backoff, max 8 seconds
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1})`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        // Optimized: Fetch with reduced limit for faster initial load
        allCallsResponse = await retellService.getCallHistoryByDateRange(start, end, { limit: 300 })
      } catch (error: any) {
        // Handle rate limiting specifically
        if (error.message?.includes('429') || error.status === 429) {
          if (retryCount < 3) {
            console.log(`Rate limited (429), retrying... (attempt ${retryCount + 1}/3)`)
            return fetchCalls(retryCount + 1)
          } else {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.')
          }
        }
        throw error
      }

      const totalCalls = allCallsResponse.calls
      setTotalCallsCount(totalCalls.length)

      // Calculate pagination
      const startIndex = (currentPage - 1) * recordsPerPage
      const endIndex = startIndex + recordsPerPage
      const paginatedCalls = totalCalls.slice(startIndex, endIndex)

      // Transform paginated calls to our Call interface
      const transformedCalls: Call[] = paginatedCalls.map(retellCall => {
        // Calculate duration properly using the same logic as retell service
        let durationSeconds: number | undefined = undefined

        if (retellCall.duration_ms !== undefined && retellCall.duration_ms !== null) {
          // Use API duration_ms if available (prioritize this field as per Retell AI docs)
          durationSeconds = retellCall.duration_ms / 1000
          console.log(`Call ${retellCall.call_id}: Using API duration_ms = ${retellCall.duration_ms}ms = ${durationSeconds.toFixed(3)}s`)
        } else if (retellCall.start_timestamp && retellCall.end_timestamp) {
          // Calculate from timestamps with proper conversion
          let startMs = retellCall.start_timestamp
          let endMs = retellCall.end_timestamp

          // Convert to milliseconds if needed (timestamps might be in seconds)
          if (retellCall.start_timestamp.toString().length <= 10) {
            startMs = retellCall.start_timestamp * 1000
          }
          if (retellCall.end_timestamp.toString().length <= 10) {
            endMs = retellCall.end_timestamp * 1000
          }

          durationSeconds = (endMs - startMs) / 1000
          console.log(`Call ${retellCall.call_id}: Calculated from timestamps: start=${startMs}, end=${endMs}, duration=${durationSeconds.toFixed(3)}s`)
        } else {
          console.log(`Call ${retellCall.call_id}: No duration data available`)
        }

        return {
          ...retellCall,
          patient_id: retellCall.metadata?.patient_id || `patient_${Math.random().toString(36).substr(2, 9)}`,
          call_length_seconds: durationSeconds,
          call_summary: retellCall.call_analysis?.call_summary || undefined,
          sentiment_analysis: retellCall.call_analysis?.user_sentiment ? {
            overall_sentiment: retellCall.call_analysis.user_sentiment as 'positive' | 'negative' | 'neutral',
            confidence_score: 0.8 // Default confidence score
          } : undefined,
          metadata: {
            patient_name: retellCall.metadata?.patient_name || `Patient ${retellCall.metadata?.patient_id || 'Unknown'}`,
            call_type: retellCall.call_type === 'phone_call' ? 'Phone Call' : 'Web Call',
            ...retellCall.metadata
          }
        }
      })

      setCalls(transformedCalls)

      // Fetch notes count for all calls
      try {
        const callIds = transformedCalls.map(call => call.call_id)
        const notesCountData = await notesService.getNotesCount(callIds, 'call')
        setNotesCount(notesCountData)
      } catch (notesError) {
        console.error('Error fetching notes count:', notesError)
        // Don't fail the whole operation if notes fetch fails
      }

      // Calculate base metrics using ALL calls for accurate totals
      const baseMetrics = retellService.calculateCallMetrics(totalCalls)

      // Add Twilio costs to the metrics
      const metricsWithTwilio = addTwilioCostsToMetrics(baseMetrics, totalCalls)

      // Debug: Log the total cost to verify it's correct
      console.log('📊 Enhanced Metrics (Retell + Twilio):', {
        totalCalls: metricsWithTwilio.totalCalls,
        totalCostCAD: metricsWithTwilio.totalCost,
        avgCostPerCallCAD: metricsWithTwilio.avgCostPerCall,
        baseRetellCostUSD: baseMetrics.totalCost,
        sampleCallCosts: totalCalls.slice(0, 3).map(c => ({
          id: c.call_id,
          retell_cents: c.call_cost?.combined_cost,
          duration_sec: c.call_length_seconds,
          total_cad: calculateTotalCallCostCAD(c).toFixed(4)
        }))
      })

      setMetrics(metricsWithTwilio)

      // Log audit event for HIPAA compliance
      await auditLogger.logPHIAccess(
        AuditAction.VIEW,
        ResourceType.CALL,
        'call-list-access',
        AuditOutcome.SUCCESS,
        {
          calls_count: transformedCalls.length,
          date_range: selectedDateRange,
          user_id: user.id
        }
      )

    } catch (error) {
      console.error('Failed to fetch calls:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch call data')
    } finally {
      setLoading(false)
    }
  }

  const startCall = async (patientId?: string) => {
    setLoading(true)
    setError('')

    try {
      console.log('Starting demo call...')
      setCallStatus('connecting')

      setTimeout(() => {
        setIsCallActive(true)
        setCallStatus('active')
        setCurrentTranscript('Call connected. AI agent is ready to assist...')
      }, 2000)

    } catch (error) {
      console.error('Failed to start call:', error)
      setError('Failed to start call. Please try again.')
      setCallStatus('failed')
    } finally {
      setLoading(false)
    }
  }

  const stopCall = () => {
    retellWebClient.stopCall()
    setIsCallActive(false)
    setCallStatus('completed')
  }

  const toggleMute = () => {
    if (isCallActive) {
      setIsMuted(!isMuted)
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s'

    // Show exact duration without any rounding
    // For very short calls (less than 1 second), show with high precision
    if (seconds < 1) {
      return `${seconds.toFixed(3)}s`
    }

    // For calls less than 60 seconds, show exact seconds with 2 decimal places
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`
    }

    // For calls 60 seconds or longer, show exact minutes with 3 decimal places
    const minutes = seconds / 60
    if (minutes < 60) {
      return `${minutes.toFixed(3)} min`
    }

    // For calls 1 hour or longer, show exact hours and remaining minutes
    const hours = seconds / 3600
    return `${hours.toFixed(3)}h`
  }

  const calculateTotalCallCostCAD = (call: Call) => {
    // Get Retell cost (converted to CAD)
    const retellCostCents = call.call_cost?.combined_cost || 0
    const retellCostUSD = retellCostCents / 100
    const retellCostCAD = currencyService.convertUSDToCAD(retellCostUSD)

    // Get Twilio cost (already in CAD)
    const twilioCostCAD = twilioCostService.getTwilioCostCAD(call.call_length_seconds || 0)

    // Total cost
    return retellCostCAD + twilioCostCAD
  }

  const formatCallCost = (call: Call) => {
    const totalCostCAD = calculateTotalCallCostCAD(call)
    return `CAD ${totalCostCAD.toFixed(3)}`
  }

  const addTwilioCostsToMetrics = (baseMetrics: any, calls: Call[]) => {
    // Calculate total Twilio costs for all calls
    const totalTwilioCostCAD = calls.reduce((sum, call) => {
      return sum + twilioCostService.getTwilioCostCAD(call.call_length_seconds || 0)
    }, 0)

    // Convert base metrics to CAD and add Twilio costs
    const baseTotalCostCAD = currencyService.convertUSDToCAD(baseMetrics.totalCost)
    const baseAvgCostCAD = currencyService.convertUSDToCAD(baseMetrics.avgCostPerCall)
    const baseHighestCostCAD = currencyService.convertUSDToCAD(baseMetrics.highestCostCall)

    // Calculate new totals
    const newTotalCostCAD = baseTotalCostCAD + totalTwilioCostCAD
    const newAvgCostCAD = baseMetrics.totalCalls > 0 ? newTotalCostCAD / baseMetrics.totalCalls : 0

    // Find highest cost call including Twilio
    const callCostsWithTwilio = calls.map(call => calculateTotalCallCostCAD(call))
    const newHighestCostCAD = callCostsWithTwilio.length > 0 ? Math.max(...callCostsWithTwilio) : 0

    return {
      ...baseMetrics,
      totalCost: newTotalCostCAD,
      avgCostPerCall: newAvgCostCAD,
      highestCostCall: newHighestCostCAD
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'active': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const filteredCalls = calls.filter(call => {
    const matchesSearch = !searchTerm ||
      call.patient_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.metadata?.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.transcript?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || call.call_status === statusFilter
    const matchesSentiment = sentimentFilter === 'all' || call.sentiment_analysis?.overall_sentiment === sentimentFilter

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
            const { start, end } = getDateRangeFromSelection(range, customStart, customEnd)
            console.log('Calls date range changed:', { range, start, end })
          }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCalls}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <RefreshCwIcon className="w-4 h-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <DownloadIcon className="w-4 h-4" />
            Export Call Report
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Last refreshed: {formatLastRefreshTime()} (Auto-refresh every minute)
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Calls</span>
            <PhoneIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 numeric-data">
            {loading ? '...' : metrics.totalCalls}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {metrics.totalCalls > 0 ? (
              <><span className="numeric-data">{metrics.totalCalls - metrics.failedCalls}</span> completed, <span className="numeric-data">{metrics.failedCalls}</span> failed</>
            ) : 'No calls made'}
          </div>
        </div>

        {/* Avg Call Duration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg Call Duration</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 numeric-data">
            {loading ? '...' : metrics.avgDuration}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Longest: <span className="numeric-data">{metrics.avgDuration}</span>
          </div>
        </div>

        {/* Avg Cost Per Call */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg Cost Per Call</span>
            <DollarSignIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 numeric-data">
            CAD ${loading ? '...' : (metrics.avgCostPerCall || 0).toFixed(3)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Total cost: CAD $<span className="numeric-data">{(metrics.totalCost || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 numeric-data">
            {loading ? '...' : `${metrics.successRate.toFixed(1)}%`}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {metrics.totalCalls > 0 ? (
              <><span className="numeric-data">{metrics.totalCalls - metrics.failedCalls}</span> goals achieved</>
            ) : (<><span className="numeric-data">0</span> goals achieved</>)}
          </div>
        </div>

        {/* Total Duration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Duration</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 numeric-data">
            {loading ? '...' : metrics.totalDuration}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            0 calls analyzed
          </div>
        </div>

        {/* Total Minutes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Minutes</span>
            <ClockIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 numeric-data">
            {loading ? '...' : (metrics.totalMinutes || 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="numeric-data">{metrics.totalCalls}</span> calls
          </div>
        </div>

        {/* Highest Cost Call */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Highest Cost Call</span>
            <TrendingUpIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 numeric-data">
            CAD ${loading ? '...' : (metrics.highestCostCall || 0).toFixed(3)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Per-call range with Retell + Twilio costs
          </div>
        </div>

        {/* Failed Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Failed Calls</span>
            <AlertCircleIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1">
            {loading ? '...' : metrics.failedCalls}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            0% failure rate
          </div>
        </div>
      </div>

      {/* Total Call Costs Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSignIcon className="w-5 h-5 text-green-600" />
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">Total Call Costs</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Complete cost breakdown for selected date range</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-green-600 dark:text-green-400">CAD ${loading ? '...' : (metrics.totalCost || 0).toFixed(2)}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{metrics.totalCalls} calls</div>
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

        {/* Active Call Interface */}
        {isCallActive && (
          <div className="mb-8 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-600 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <PhoneCallIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Call</h3>
                  <p className="text-gray-600 dark:text-gray-400">Status: {callStatus}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-lg transition-colors ${
                    isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {isMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
                </button>
                <button
                  onClick={stopCall}
                  className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg transition-colors"
                >
                  <PhoneOffIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Live Transcript */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Live Transcript</h4>
              <div className="h-32 overflow-y-auto bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600 text-sm text-gray-900 dark:text-gray-100">
                {currentTranscript || 'Listening...'}
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search calls by patient name, ID, or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
              >
                <option value="all">All Sentiment</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calls Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 dark:text-gray-400 mt-4">Loading calls...</p>
            </div>
          ) : filteredCalls.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Table Header */}
              <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-6 py-3 hidden md:block">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Patient</div>
                  <div className="col-span-2">Date & Time</div>
                  <div className="col-span-2">Duration</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Cost</div>
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {filteredCalls.map((call, index) => {
                  // Calculate the actual row number based on current page and pagination
                  const rowNumber = (currentPage - 1) * recordsPerPage + index + 1
                  // Determine if this row should have gray background (even rows)
                  const isEvenRow = index % 2 === 0
                  const rowBgColor = isEvenRow ? 'bg-white' : 'bg-gray-25'

                  return (
                    <div
                      key={call.call_id}
                      className={`px-6 py-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors ${rowBgColor}`}
                      onClick={() => {
                        setSelectedCall(call)
                        setIsDetailModalOpen(true)
                      }}
                    >
                      {/* Desktop Layout */}
                      <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                        {/* Row Number */}
                        <div className="col-span-1">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">#{rowNumber}</span>
                        </div>

                        {/* Patient Info */}
                        <div className="col-span-3">
                        <div className="flex items-center">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              {call.metadata?.patient_name || `Patient ${call.patient_id}`}
                              {notesCount[call.call_id] && (
                                <div className="flex items-center gap-1">
                                  <StickyNoteIcon className="h-4 w-4 text-blue-500" />
                                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    {notesCount[call.call_id]}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {call.from_number || call.to_number || 'No phone number'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div className="col-span-2">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(call.start_timestamp).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(call.start_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatDuration(call.call_length_seconds)}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.call_status)}`}>
                            {call.call_status}
                          </span>
                          {call.sentiment_analysis && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(call.sentiment_analysis.overall_sentiment)}`}>
                              {call.sentiment_analysis.overall_sentiment}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cost */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <DollarSignIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatCallCost(call)}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {call.metadata?.patient_name || `Patient ${call.patient_id}`}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {call.from_number || call.to_number || 'No phone number'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.call_status)}`}>
                          {call.call_status}
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <ClockIcon className="w-3 h-3" />
                          {formatDuration(call.call_length_seconds)}
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <DollarSignIcon className="w-3 h-3" />
                          {formatCallCost(call)}
                        </span>
                        {call.sentiment_analysis && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(call.sentiment_analysis.overall_sentiment)}`}>
                            {call.sentiment_analysis.overall_sentiment}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-500">
                        {new Date(call.start_timestamp).toLocaleDateString()} at {new Date(call.start_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <PhoneIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">No calls found</h3>
              <p className="text-gray-600 dark:text-gray-400">No calls have been made yet.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalCallsCount > recordsPerPage && (
          <div className="flex items-center justify-between mt-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <span>
                Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, totalCallsCount)} of {totalCallsCount} calls
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {(() => {
                  const totalPages = Math.ceil(totalCallsCount / recordsPerPage)
                  const pages = []
                  const startPage = Math.max(1, currentPage - 2)
                  const endPage = Math.min(totalPages, currentPage + 2)

                  // First page
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => setCurrentPage(1)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        1
                      </button>
                    )
                    if (startPage > 2) {
                      pages.push(<span key="ellipsis1" className="px-2 text-gray-500 dark:text-gray-400">...</span>)
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
                            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600'
                            : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {i}
                      </button>
                    )
                  }

                  // Last page
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(<span key="ellipsis2" className="px-2 text-gray-500 dark:text-gray-400">...</span>)
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                      >
                        {totalPages}
                      </button>
                    )
                  }

                  return pages
                })()}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCallsCount / recordsPerPage)))}
                disabled={currentPage >= Math.ceil(totalCallsCount / recordsPerPage)}
                className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Call Detail Modal */}
        {selectedCall && (
          <CallDetailModal
            call={selectedCall}
            isOpen={isDetailModalOpen}
            onClose={() => {
              setIsDetailModalOpen(false)
              setSelectedCall(null)
            }}
            onNotesChanged={() => refreshNotesCount(selectedCall.call_id)}
          />
        )}

    </div>
  )
}