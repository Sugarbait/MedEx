/**
 * useTransmissionSecurity Hook
 * React integration for Enhanced Transmission Security System
 *
 * Features:
 * - Real-time security monitoring status
 * - Certificate and header validation
 * - Security metrics and events
 * - Configuration management
 * - Error handling and loading states
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SecurityAssessment,
  TransmissionSecurityMetrics,
  TransmissionSecurityEvent,
  SecurityMonitoringConfig,
  UseTransmissionSecurityReturn,
  TransmissionSecurityError
} from '@/types/transmissionSecurityTypes'
import { transmissionSecurityService } from '@/services/transmissionSecurityService'
import { certificateMonitoringService } from '@/services/certificateMonitoringService'
import { auditService } from '@/services/auditService'

/**
 * Custom hook for transmission security management
 */
export function useTransmissionSecurity(
  domain?: string,
  autoStart: boolean = true
): UseTransmissionSecurityReturn {
  // State management
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [lastAssessment, setLastAssessment] = useState<SecurityAssessment | null>(null)
  const [metrics, setMetrics] = useState<TransmissionSecurityMetrics | null>(null)
  const [events, setEvents] = useState<TransmissionSecurityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SecurityMonitoringConfig | null>(null)

  // Refs for cleanup and event handling
  const eventListenersRef = useRef<Map<string, Function>>(new Map())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  /**
   * Safe state update helper
   */
  const safeSetState = useCallback(<T>(setter: (value: T) => void, value: T) => {
    if (mountedRef.current) {
      setter(value)
    }
  }, [])

  /**
   * Error handler with audit logging
   */
  const handleError = useCallback(async (error: any, context: string) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`Transmission security error in ${context}:`, error)

    safeSetState(setError, errorMessage)

    try {
      await auditService.logSecurityEvent({
        action: 'transmission_security_hook_error',
        resource: `hook_${context}`,
        success: false,
        details: { error: errorMessage, context },
        severity: 'medium'
      })
    } catch (auditError) {
      console.error('Failed to log transmission security hook error:', auditError)
    }
  }, [safeSetState])

  /**
   * Load initial configuration
   */
  const loadConfiguration = useCallback(async () => {
    try {
      const currentConfig = await transmissionSecurityService.getMonitoringConfig()
      safeSetState(setConfig, currentConfig)
    } catch (error) {
      await handleError(error, 'loadConfiguration')
    }
  }, [safeSetState, handleError])

  /**
   * Refresh security metrics
   */
  const refreshMetrics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [currentMetrics, currentEvents] = await Promise.all([
        transmissionSecurityService.getSecurityMetrics(),
        transmissionSecurityService.getSecurityEvents()
      ])

      safeSetState(setMetrics, currentMetrics)
      safeSetState(setEvents, currentEvents)
    } catch (error) {
      await handleError(error, 'refreshMetrics')
    } finally {
      safeSetState(setLoading, false)
    }
  }, [safeSetState, handleError])

  /**
   * Perform security assessment
   */
  const performAssessment = useCallback(async (targetDomain?: string) => {
    try {
      setLoading(true)
      setError(null)

      const assessmentDomain = targetDomain || domain || window.location.hostname
      const assessment = await transmissionSecurityService.performSecurityAssessment(assessmentDomain)

      safeSetState(setLastAssessment, assessment)

      await auditService.logSecurityEvent({
        action: 'transmission_security_assessment_performed',
        resource: `domain_${assessmentDomain}`,
        success: true,
        details: {
          domain: assessmentDomain,
          grade: assessment.overallGrade,
          risksCount: assessment.risks.length
        },
        severity: 'low'
      })
    } catch (error) {
      await handleError(error, 'performAssessment')
    } finally {
      safeSetState(setLoading, false)
    }
  }, [domain, safeSetState, handleError])

  /**
   * Start security monitoring
   */
  const startMonitoring = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      await Promise.all([
        transmissionSecurityService.startMonitoring(),
        certificateMonitoringService.startMonitoring()
      ])

      safeSetState(setIsMonitoring, true)

      // Start periodic updates
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      intervalRef.current = setInterval(async () => {
        if (mountedRef.current) {
          await refreshMetrics()
        }
      }, 300000) // Update every 5 minutes

      await auditService.logSecurityEvent({
        action: 'transmission_security_monitoring_started_via_hook',
        resource: 'transmission_security_hook',
        success: true,
        details: { domain: domain || 'current' },
        severity: 'low'
      })
    } catch (error) {
      await handleError(error, 'startMonitoring')
    } finally {
      safeSetState(setLoading, false)
    }
  }, [domain, safeSetState, handleError, refreshMetrics])

  /**
   * Stop security monitoring
   */
  const stopMonitoring = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      await Promise.all([
        transmissionSecurityService.stopMonitoring(),
        certificateMonitoringService.stopMonitoring()
      ])

      safeSetState(setIsMonitoring, false)

      // Clear periodic updates
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      await auditService.logSecurityEvent({
        action: 'transmission_security_monitoring_stopped_via_hook',
        resource: 'transmission_security_hook',
        success: true,
        details: { domain: domain || 'current' },
        severity: 'low'
      })
    } catch (error) {
      await handleError(error, 'stopMonitoring')
    } finally {
      safeSetState(setLoading, false)
    }
  }, [domain, safeSetState, handleError])

  /**
   * Acknowledge security event
   */
  const acknowledgeEvent = useCallback(async (eventId: string) => {
    try {
      setError(null)

      const success = await transmissionSecurityService.acknowledgeEvent(
        eventId,
        'user' // In production, this would be the actual user ID
      )

      if (success) {
        // Refresh events to show updated status
        await refreshMetrics()

        await auditService.logSecurityEvent({
          action: 'transmission_security_event_acknowledged_via_hook',
          resource: `event_${eventId}`,
          success: true,
          details: { eventId },
          severity: 'low'
        })
      } else {
        throw new Error('Failed to acknowledge event')
      }
    } catch (error) {
      await handleError(error, 'acknowledgeEvent')
    }
  }, [handleError, refreshMetrics])

  /**
   * Resolve security event
   */
  const resolveEvent = useCallback(async (eventId: string, mitigation: string) => {
    try {
      setError(null)

      const success = await transmissionSecurityService.resolveEvent(eventId, mitigation)

      if (success) {
        // Refresh events to show updated status
        await refreshMetrics()

        await auditService.logSecurityEvent({
          action: 'transmission_security_event_resolved_via_hook',
          resource: `event_${eventId}`,
          success: true,
          details: { eventId, mitigation },
          severity: 'low'
        })
      } else {
        throw new Error('Failed to resolve event')
      }
    } catch (error) {
      await handleError(error, 'resolveEvent')
    }
  }, [handleError, refreshMetrics])

  /**
   * Update monitoring configuration
   */
  const updateConfig = useCallback(async (newConfig: Partial<SecurityMonitoringConfig>) => {
    try {
      setLoading(true)
      setError(null)

      const success = await transmissionSecurityService.updateMonitoringConfig(newConfig)

      if (success) {
        // Reload configuration
        await loadConfiguration()

        await auditService.logSecurityEvent({
          action: 'transmission_security_config_updated_via_hook',
          resource: 'transmission_security_hook',
          success: true,
          details: { updatedFields: Object.keys(newConfig) },
          severity: 'low'
        })
      } else {
        throw new Error('Failed to update configuration')
      }
    } catch (error) {
      await handleError(error, 'updateConfig')
    } finally {
      safeSetState(setLoading, false)
    }
  }, [safeSetState, handleError, loadConfiguration])

  /**
   * Set up event listeners for real-time updates
   */
  const setupEventListeners = useCallback(() => {
    const handleSecurityEvent = (event: TransmissionSecurityEvent) => {
      if (mountedRef.current) {
        setEvents(prevEvents => [event, ...prevEvents.slice(0, 99)]) // Keep last 100 events
      }
    }

    const handleMonitoringStatusChange = (status: boolean) => {
      if (mountedRef.current) {
        setIsMonitoring(status)
      }
    }

    // Store listeners for cleanup
    eventListenersRef.current.set('securityEvent', handleSecurityEvent)
    eventListenersRef.current.set('monitoringStatusChange', handleMonitoringStatusChange)

    // Add listeners (if the service supports event emission)
    if (typeof transmissionSecurityService.addEventListener === 'function') {
      transmissionSecurityService.addEventListener('securityEvent', handleSecurityEvent)
      transmissionSecurityService.addEventListener('monitoringStatusChange', handleMonitoringStatusChange)
    }
  }, [])

  /**
   * Clean up event listeners
   */
  const cleanupEventListeners = useCallback(() => {
    if (typeof transmissionSecurityService.removeEventListener === 'function') {
      for (const [event, listener] of eventListenersRef.current) {
        transmissionSecurityService.removeEventListener(event, listener)
      }
    }
    eventListenersRef.current.clear()
  }, [])

  /**
   * Initialize hook
   */
  const initialize = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Load initial data
      await Promise.all([
        loadConfiguration(),
        refreshMetrics()
      ])

      // Check current monitoring status
      const currentlyMonitoring = transmissionSecurityService.isMonitoring()
      safeSetState(setIsMonitoring, currentlyMonitoring)

      // Perform initial assessment if domain is provided
      if (domain) {
        await performAssessment(domain)
      }

      // Auto-start monitoring if requested and not already running
      if (autoStart && !currentlyMonitoring) {
        await startMonitoring()
      }

      // Set up event listeners
      setupEventListeners()

    } catch (error) {
      await handleError(error, 'initialize')
    } finally {
      safeSetState(setLoading, false)
    }
  }, [
    autoStart,
    domain,
    loadConfiguration,
    refreshMetrics,
    performAssessment,
    startMonitoring,
    setupEventListeners,
    safeSetState,
    handleError
  ])

  /**
   * Effect for initialization
   */
  useEffect(() => {
    initialize()

    return () => {
      mountedRef.current = false
      cleanupEventListeners()

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [initialize, cleanupEventListeners])

  /**
   * Effect for window focus handling (refresh data when window gains focus)
   */
  useEffect(() => {
    const handleFocus = () => {
      if (mountedRef.current && isMonitoring) {
        refreshMetrics()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isMonitoring, refreshMetrics])

  /**
   * Effect for monitoring status changes
   */
  useEffect(() => {
    if (isMonitoring) {
      // Refresh data when monitoring starts
      refreshMetrics()
    }
  }, [isMonitoring, refreshMetrics])

  return {
    // State
    isMonitoring,
    lastAssessment,
    metrics,
    events,
    loading,
    error,
    config,

    // Actions
    startMonitoring,
    stopMonitoring,
    performAssessment,
    acknowledgeEvent,
    resolveEvent,
    refreshMetrics,
    updateConfig
  }
}

/**
 * Hook for simplified certificate monitoring
 */
export function useCertificateMonitoring(domains: string[] = []) {
  const [certificates, setCertificates] = useState<any[]>([])
  const [statistics, setStatistics] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCertificates = useCallback(async () => {
    if (domains.length === 0) return

    try {
      setLoading(true)
      setError(null)

      const allCertificates = []
      for (const domain of domains) {
        try {
          const domainCerts = await certificateMonitoringService.getCertificatesForDomain(domain)
          allCertificates.push(...domainCerts)
        } catch (error) {
          console.warn(`Failed to load certificates for ${domain}:`, error)
        }
      }

      setCertificates(allCertificates)

      // Load statistics
      const stats = await certificateMonitoringService.getMonitoringStatistics()
      setStatistics(stats)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      console.error('Certificate monitoring error:', error)
    } finally {
      setLoading(false)
    }
  }, [domains])

  useEffect(() => {
    loadCertificates()
  }, [loadCertificates])

  return {
    certificates,
    statistics,
    loading,
    error,
    refresh: loadCertificates
  }
}

/**
 * Hook for security header validation
 */
export function useSecurityHeaders(url?: string) {
  const [headers, setHeaders] = useState<any[]>([])
  const [score, setScore] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateHeaders = useCallback(async (targetUrl?: string) => {
    const validationUrl = targetUrl || url || window.location.href

    try {
      setLoading(true)
      setError(null)

      const headerChecks = await transmissionSecurityService.validateSecurityHeaders(validationUrl)
      setHeaders(headerChecks)

      // Calculate score (simplified)
      const compliantHeaders = headerChecks.filter(h => h.compliant).length
      const scorePercentage = (compliantHeaders / headerChecks.length) * 100
      setScore(Math.round(scorePercentage))

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      console.error('Security header validation error:', error)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (url) {
      validateHeaders()
    }
  }, [url, validateHeaders])

  return {
    headers,
    score,
    loading,
    error,
    validate: validateHeaders
  }
}

export default useTransmissionSecurity