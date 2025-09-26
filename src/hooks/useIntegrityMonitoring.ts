/**
 * REACT HOOK FOR INTEGRITY MONITORING
 *
 * Custom React hook that provides seamless integration with the integrity
 * monitoring service, enabling components to easily access monitoring data,
 * control monitoring state, and respond to integrity events.
 *
 * Features:
 * - Real-time monitoring status and results
 * - Event-driven updates via service events
 * - Error handling and loading states
 * - Performance optimization with stable references
 * - TypeScript integration with full type safety
 * - Non-breaking integration with existing components
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { integrityMonitoringService } from '@/services/integrityMonitoringService'
import {
  IntegrityStatusSummary,
  IntegrityAlert,
  IntegrityResult,
  IntegrityPerformance,
  IntegrityDashboardData,
  IntegritySystemHealth,
  IntegrityBaseline,
  IntegrityMonitoringConfig,
  IntegrityReport,
  IntegrityReportType,
  ReportPeriod,
  UseIntegrityMonitoring,
  IntegrityServiceResponse
} from '@/types/integrityTypes'

interface UseIntegrityMonitoringOptions {
  autoStart?: boolean
  pollInterval?: number
  maxAlerts?: number
  maxResults?: number
  enableRealTimeUpdates?: boolean
}

interface IntegrityMonitoringState {
  isMonitoring: boolean
  status: IntegrityStatusSummary | null
  alerts: IntegrityAlert[]
  recentResults: IntegrityResult[]
  performance: IntegrityPerformance | null
  dashboardData: IntegrityDashboardData | null
  systemHealth: IntegritySystemHealth | null
  error: Error | null
  loading: boolean
  lastUpdate: Date | null
}

/**
 * Custom hook for integrity monitoring integration
 */
export function useIntegrityMonitoring(
  options: UseIntegrityMonitoringOptions = {}
): UseIntegrityMonitoring {
  // Default options
  const {
    autoStart = false,
    pollInterval = 30000, // 30 seconds
    maxAlerts = 50,
    maxResults = 100,
    enableRealTimeUpdates = true
  } = options

  // State management
  const [state, setState] = useState<IntegrityMonitoringState>({
    isMonitoring: false,
    status: null,
    alerts: [],
    recentResults: [],
    performance: null,
    dashboardData: null,
    systemHealth: null,
    error: null,
    loading: false,
    lastUpdate: null
  })

  // Refs for stable callback management
  const serviceRef = useRef(integrityMonitoringService)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const eventListenersRef = useRef<Array<{ type: string; handler: Function }>>([])

  /**
   * Update state safely
   */
  const updateState = useCallback((updates: Partial<IntegrityMonitoringState>) => {
    setState(prevState => ({
      ...prevState,
      ...updates,
      lastUpdate: new Date()
    }))
  }, [])

  /**
   * Set error state
   */
  const setError = useCallback((error: Error | string | null) => {
    const errorObj = error instanceof Error ? error :
                    typeof error === 'string' ? new Error(error) : null
    updateState({ error: errorObj, loading: false })
  }, [updateState])

  /**
   * Set loading state
   */
  const setLoading = useCallback((loading: boolean) => {
    updateState({ loading })
  }, [updateState])

  /**
   * Start monitoring
   */
  const startMonitoring = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const response = await serviceRef.current.startMonitoring()
      if (response.success) {
        updateState({ isMonitoring: true })

        // Immediately fetch current data
        await refreshData()
      } else {
        throw new Error(response.error || 'Failed to start monitoring')
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to start monitoring'))
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError, updateState])

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const response = await serviceRef.current.stopMonitoring()
      if (response.success) {
        updateState({ isMonitoring: false })
      } else {
        throw new Error(response.error || 'Failed to stop monitoring')
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to stop monitoring'))
    } finally {
      setLoading(false)
    }
  }, [setLoading, setError, updateState])

  /**
   * Run a specific check
   */
  const runCheck = useCallback(async (checkId: string): Promise<IntegrityResult> => {
    try {
      setError(null)

      const response = await serviceRef.current.runCheck(checkId)
      if (response.success && response.data) {
        // Add result to recent results
        setState(prevState => {
          const newResults = [response.data!, ...prevState.recentResults]
            .slice(0, maxResults)

          return {
            ...prevState,
            recentResults: newResults,
            lastUpdate: new Date()
          }
        })

        return response.data
      } else {
        throw new Error(response.error || 'Failed to run check')
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to run check'))
      throw error
    }
  }, [setError, maxResults])

  /**
   * Acknowledge an alert
   */
  const acknowledgeAlert = useCallback(async (alertId: string): Promise<void> => {
    try {
      setError(null)

      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const acknowledgedBy = currentUser.name || 'Unknown User'

      const response = await serviceRef.current.acknowledgeAlert(alertId, acknowledgedBy)
      if (response.success) {
        // Update alert in state
        setState(prevState => ({
          ...prevState,
          alerts: prevState.alerts.map(alert =>
            alert.id === alertId
              ? { ...alert, acknowledged: true, acknowledgedBy, acknowledgedAt: new Date() }
              : alert
          ),
          lastUpdate: new Date()
        }))
      } else {
        throw new Error(response.error || 'Failed to acknowledge alert')
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to acknowledge alert'))
    }
  }, [setError])

  /**
   * Resolve an alert
   */
  const resolveAlert = useCallback(async (alertId: string): Promise<void> => {
    try {
      setError(null)

      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      const resolvedBy = currentUser.name || 'Unknown User'

      const response = await serviceRef.current.resolveAlert(alertId, resolvedBy)
      if (response.success) {
        // Update alert in state
        setState(prevState => ({
          ...prevState,
          alerts: prevState.alerts.map(alert =>
            alert.id === alertId
              ? { ...alert, resolved: true, resolvedBy, resolvedAt: new Date() }
              : alert
          ),
          lastUpdate: new Date()
        }))
      } else {
        throw new Error(response.error || 'Failed to resolve alert')
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to resolve alert'))
    }
  }, [setError])

  /**
   * Create baseline for a check
   */
  const createBaseline = useCallback(async (checkId: string): Promise<IntegrityBaseline> => {
    try {
      setError(null)

      const response = await serviceRef.current.createBaseline(checkId)
      if (response.success && response.data) {
        return response.data
      } else {
        throw new Error(response.error || 'Failed to create baseline')
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to create baseline'))
      throw error
    }
  }, [setError])

  /**
   * Update configuration
   */
  const updateConfiguration = useCallback(async (
    config: Partial<IntegrityMonitoringConfig>
  ): Promise<void> => {
    try {
      setError(null)

      const response = await serviceRef.current.updateConfiguration(config)
      if (!response.success) {
        throw new Error(response.error || 'Failed to update configuration')
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to update configuration'))
    }
  }, [setError])

  /**
   * Generate report
   */
  const generateReport = useCallback(async (
    type: IntegrityReportType,
    period: ReportPeriod
  ): Promise<IntegrityReport> => {
    try {
      setError(null)

      // This would integrate with a report generation service
      // For now, we'll create a basic report structure
      const dashboardData = await serviceRef.current.getDashboardData()

      if (!dashboardData.success || !dashboardData.data) {
        throw new Error('Failed to get dashboard data for report')
      }

      const report: IntegrityReport = {
        id: `report_${Date.now()}`,
        title: `Integrity Monitoring Report - ${type}`,
        description: `${type} report generated for period ${period.startDate.toISOString()} to ${period.endDate.toISOString()}`,
        generatedAt: new Date(),
        generatedBy: JSON.parse(localStorage.getItem('currentUser') || '{}').name || 'System',
        reportType: type,
        period,
        data: {
          summary: dashboardData.data.summary,
          trends: dashboardData.data.trends,
          alerts: dashboardData.data.activeAlerts,
          incidents: [], // Would be populated from incident service
          remediations: [], // Would be populated from remediation tracking
          coverage: dashboardData.data.coverage,
          performance: dashboardData.data.performance,
          recommendations: [
            'Review and address active alerts',
            'Ensure all critical checks have recent baselines',
            'Monitor system performance metrics'
          ],
          complianceScore: dashboardData.data.summary.overallHealthScore,
          riskAssessment: {
            overallRisk: dashboardData.data.summary.overallHealthScore > 90 ? 'LOW' as const :
                        dashboardData.data.summary.overallHealthScore > 70 ? 'MEDIUM' as const : 'HIGH' as const,
            categories: {},
            threats: [],
            mitigations: [],
            timeline: []
          }
        },
        format: 'JSON' as const,
        metadata: {
          generationDuration: 0,
          dataPoints: dashboardData.data.recentChecks.length
        }
      }

      return report
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to generate report'))
      throw error
    }
  }, [setError])

  /**
   * Refresh all data
   */
  const refreshData = useCallback(async (): Promise<void> => {
    try {
      const [dashboardResponse, healthResponse] = await Promise.all([
        serviceRef.current.getDashboardData(),
        serviceRef.current.getSystemHealth()
      ])

      const updates: Partial<IntegrityMonitoringState> = {}

      if (dashboardResponse.success && dashboardResponse.data) {
        const data = dashboardResponse.data
        updates.status = data.summary
        updates.alerts = data.activeAlerts.slice(0, maxAlerts)
        updates.recentResults = data.recentChecks.slice(0, maxResults)
        updates.performance = data.performance
        updates.dashboardData = data
      }

      if (healthResponse.success && healthResponse.data) {
        updates.systemHealth = healthResponse.data
      }

      updateState(updates)
    } catch (error) {
      console.error('Failed to refresh data:', error)
      // Don't set error state for refresh failures to avoid disrupting UI
    }
  }, [updateState, maxAlerts, maxResults])

  /**
   * Setup event listeners for real-time updates
   */
  const setupEventListeners = useCallback(() => {
    if (!enableRealTimeUpdates) return

    // Clean up existing listeners
    eventListenersRef.current.forEach(({ type, handler }) => {
      serviceRef.current.removeEventListener(type, handler as any)
    })
    eventListenersRef.current = []

    // Check completed event
    const onCheckCompleted = (result: IntegrityResult) => {
      setState(prevState => {
        const newResults = [result, ...prevState.recentResults].slice(0, maxResults)
        return {
          ...prevState,
          recentResults: newResults,
          lastUpdate: new Date()
        }
      })
    }

    // Alert created event
    const onAlertCreated = (alert: IntegrityAlert) => {
      setState(prevState => {
        const newAlerts = [alert, ...prevState.alerts].slice(0, maxAlerts)
        return {
          ...prevState,
          alerts: newAlerts,
          lastUpdate: new Date()
        }
      })
    }

    // Monitoring state change events
    const onMonitoringStarted = () => {
      updateState({ isMonitoring: true })
    }

    const onMonitoringStopped = () => {
      updateState({ isMonitoring: false })
    }

    // Setup listeners
    const listeners = [
      { type: 'check-completed', handler: onCheckCompleted },
      { type: 'alert-created', handler: onAlertCreated },
      { type: 'monitoring-started', handler: onMonitoringStarted },
      { type: 'monitoring-stopped', handler: onMonitoringStopped }
    ]

    listeners.forEach(({ type, handler }) => {
      serviceRef.current.addEventListener(type, handler as any)
    })

    eventListenersRef.current = listeners
  }, [enableRealTimeUpdates, maxAlerts, maxResults, updateState])

  /**
   * Setup polling for periodic updates
   */
  const setupPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    if (pollInterval > 0) {
      pollIntervalRef.current = setInterval(() => {
        if (state.isMonitoring) {
          refreshData()
        }
      }, pollInterval)
    }
  }, [pollInterval, state.isMonitoring, refreshData])

  /**
   * Initialize the hook
   */
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        setLoading(true)

        // Initialize the service
        const initResponse = await serviceRef.current.initialize()
        if (!initResponse.success) {
          throw new Error(initResponse.error || 'Failed to initialize service')
        }

        if (mounted) {
          // Setup event listeners
          setupEventListeners()

          // Initial data fetch
          await refreshData()

          // Auto-start if requested
          if (autoStart) {
            await startMonitoring()
          }
        }
      } catch (error) {
        if (mounted) {
          setError(error instanceof Error ? error : new Error('Initialization failed'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [autoStart, setupEventListeners, refreshData, startMonitoring, setError, setLoading])

  /**
   * Setup polling when monitoring state or interval changes
   */
  useEffect(() => {
    setupPolling()

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [setupPolling])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Clear polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }

      // Remove event listeners
      eventListenersRef.current.forEach(({ type, handler }) => {
        serviceRef.current.removeEventListener(type, handler as any)
      })
    }
  }, [])

  /**
   * Memoized return value for performance optimization
   */
  return useMemo(() => ({
    isMonitoring: state.isMonitoring,
    status: state.status,
    alerts: state.alerts,
    recentResults: state.recentResults,
    performance: state.performance,
    startMonitoring,
    stopMonitoring,
    runCheck,
    acknowledgeAlert,
    resolveAlert,
    createBaseline,
    updateConfiguration,
    generateReport,
    error: state.error,
    loading: state.loading
  }), [
    state.isMonitoring,
    state.status,
    state.alerts,
    state.recentResults,
    state.performance,
    state.error,
    state.loading,
    startMonitoring,
    stopMonitoring,
    runCheck,
    acknowledgeAlert,
    resolveAlert,
    createBaseline,
    updateConfiguration,
    generateReport
  ])
}

/**
 * Simplified hook for basic monitoring status
 */
export function useIntegrityStatus() {
  const { isMonitoring, status, error } = useIntegrityMonitoring({
    enableRealTimeUpdates: false,
    pollInterval: 60000 // 1 minute
  })

  return useMemo(() => ({
    isMonitoring,
    status,
    error,
    healthScore: status?.overallHealthScore || 0,
    hasIssues: status ? (status.failedChecks > 0 || status.errorChecks > 0) : false
  }), [isMonitoring, status, error])
}

/**
 * Hook for alerts management
 */
export function useIntegrityAlerts(maxAlerts = 20) {
  const { alerts, acknowledgeAlert, resolveAlert, error } = useIntegrityMonitoring({
    maxAlerts,
    enableRealTimeUpdates: true
  })

  const activeAlerts = useMemo(() =>
    alerts.filter(alert => !alert.resolved),
    [alerts]
  )

  const criticalAlerts = useMemo(() =>
    activeAlerts.filter(alert => alert.severity === 'CRITICAL'),
    [activeAlerts]
  )

  return useMemo(() => ({
    alerts,
    activeAlerts,
    criticalAlerts,
    alertCount: alerts.length,
    activeCount: activeAlerts.length,
    criticalCount: criticalAlerts.length,
    acknowledgeAlert,
    resolveAlert,
    error
  }), [
    alerts,
    activeAlerts,
    criticalAlerts,
    acknowledgeAlert,
    resolveAlert,
    error
  ])
}

/**
 * Hook for dashboard data
 */
export function useIntegrityDashboard() {
  const monitoring = useIntegrityMonitoring({
    pollInterval: 30000, // 30 seconds
    enableRealTimeUpdates: true
  })

  const dashboardData = monitoring.status ? {
    summary: monitoring.status,
    alerts: monitoring.alerts,
    recentResults: monitoring.recentResults,
    performance: monitoring.performance
  } : null

  return useMemo(() => ({
    ...monitoring,
    dashboardData
  }), [monitoring])
}

export default useIntegrityMonitoring