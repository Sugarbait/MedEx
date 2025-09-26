/**
 * INCIDENT MONITORING REACT HOOK
 *
 * React hook for monitoring security incidents and integrating with the
 * incident response system. Provides real-time updates, state management,
 * and UI integration for security incident monitoring.
 *
 * Features:
 * - Real-time incident monitoring
 * - Incident statistics and metrics
 * - User security profile tracking
 * - Configuration management
 * - Event listeners for live updates
 * - Loading states and error handling
 * - HIPAA-compliant data handling
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { incidentResponseService } from '@/services/incidentResponseService'
import { notificationService } from '@/services/notificationService'
import {
  SecurityIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  IncidentConfiguration,
  IncidentMetrics,
  UserSecurityProfile,
  IncidentEventData,
  IncidentSearchCriteria,
  IncidentSearchResponse,
  CreateIncidentRequest,
  NotificationStats
} from '@/types/incidentTypes'

export interface IncidentMonitoringState {
  // Incidents
  incidents: SecurityIncident[]
  activeIncidents: SecurityIncident[]
  recentIncidents: SecurityIncident[]

  // Metrics
  metrics: IncidentMetrics | null
  notificationStats: NotificationStats | null

  // User profiles
  userProfiles: UserSecurityProfile[]
  currentUserProfile: UserSecurityProfile | null

  // Configuration
  configuration: IncidentConfiguration | null

  // UI state
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null

  // Real-time status
  isConnected: boolean
  pendingAlerts: number
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface IncidentMonitoringActions {
  // Incident management
  createIncident: (request: CreateIncidentRequest) => Promise<SecurityIncident>
  searchIncidents: (criteria: IncidentSearchCriteria) => Promise<IncidentSearchResponse>
  resolveIncident: (incidentId: string, notes?: string) => Promise<void>
  markAsFalsePositive: (incidentId: string, reason: string) => Promise<void>

  // Data refresh
  refreshIncidents: () => Promise<void>
  refreshMetrics: () => Promise<void>
  refreshUserProfiles: () => Promise<void>

  // Configuration
  updateConfiguration: (config: Partial<IncidentConfiguration>) => Promise<void>

  // User profiles
  getUserProfile: (userId: string) => UserSecurityProfile | null

  // Testing
  triggerTestIncident: (type: IncidentType, severity: IncidentSeverity) => Promise<SecurityIncident>
  testNotifications: () => Promise<boolean>

  // MFA monitoring
  handleMfaFailure: (userId: string, userEmail: string) => Promise<void>
  handleEmergencyLogout: (userId?: string, userEmail?: string) => Promise<void>
  handleSuspiciousActivity: (userId: string, userEmail: string, reasons: string[]) => Promise<void>
}

export interface UseIncidentMonitoringOptions {
  // Auto-refresh settings
  autoRefresh?: boolean
  refreshInterval?: number // milliseconds

  // Real-time updates
  enableRealTime?: boolean

  // Initial data loading
  loadOnMount?: boolean

  // Filtering
  initialFilters?: Partial<IncidentSearchCriteria>

  // User context
  currentUserId?: string
  currentUserEmail?: string
}

export interface UseIncidentMonitoringReturn {
  state: IncidentMonitoringState
  actions: IncidentMonitoringActions
}

/**
 * Custom hook for incident monitoring
 */
export function useIncidentMonitoring(
  options: UseIncidentMonitoringOptions = {}
): UseIncidentMonitoringReturn {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    enableRealTime = true,
    loadOnMount = true,
    initialFilters = {},
    currentUserId,
    currentUserEmail
  } = options

  // State
  const [state, setState] = useState<IncidentMonitoringState>({
    incidents: [],
    activeIncidents: [],
    recentIncidents: [],
    metrics: null,
    notificationStats: null,
    userProfiles: [],
    currentUserProfile: null,
    configuration: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    isConnected: false,
    pendingAlerts: 0,
    threatLevel: 'LOW'
  })

  // Refs for cleanup
  const eventListenersRef = useRef<(() => void)[]>([])
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  /**
   * Initialize the incident monitoring system
   */
  const initialize = useCallback(async () => {
    if (isInitializedRef.current) return

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // Initialize services
      await incidentResponseService.initialize()
      await notificationService.initialize()

      // Load initial configuration
      const configuration = incidentResponseService.getConfiguration()
      setState(prev => ({ ...prev, configuration }))

      // Set up event listeners if real-time is enabled
      if (enableRealTime) {
        setupEventListeners()
      }

      // Load initial data if requested
      if (loadOnMount) {
        await Promise.all([
          loadIncidents(),
          loadMetrics(),
          loadUserProfiles(),
          loadNotificationStats()
        ])
      }

      // Set up auto-refresh if enabled
      if (autoRefresh) {
        setupAutoRefresh()
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        isConnected: true,
        lastUpdated: new Date()
      }))

      isInitializedRef.current = true
      console.log('✅ Incident monitoring initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize incident monitoring:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      }))
    }
  }, [enableRealTime, loadOnMount, autoRefresh])

  /**
   * Set up real-time event listeners
   */
  const setupEventListeners = useCallback(() => {
    const handleIncidentCreated = (event: IncidentEventData) => {
      if (event.type === 'incident_created' && event.incident) {
        setState(prev => {
          const newIncidents = [event.incident!, ...prev.incidents]
          const activeIncidents = newIncidents.filter(i => i.status === IncidentStatus.OPEN)
          const recentIncidents = newIncidents.slice(0, 10)

          return {
            ...prev,
            incidents: newIncidents,
            activeIncidents,
            recentIncidents,
            pendingAlerts: prev.pendingAlerts + 1,
            threatLevel: calculateThreatLevel(activeIncidents),
            lastUpdated: new Date()
          }
        })

        console.log('🚨 New incident detected:', event.incident?.type, event.incident?.severity)
      }
    }

    const handleIncidentUpdated = (event: IncidentEventData) => {
      if (event.type === 'incident_updated' && event.incident) {
        setState(prev => {
          const updatedIncidents = prev.incidents.map(i =>
            i.id === event.incident!.id ? event.incident! : i
          )
          const activeIncidents = updatedIncidents.filter(i => i.status === IncidentStatus.OPEN)

          return {
            ...prev,
            incidents: updatedIncidents,
            activeIncidents,
            threatLevel: calculateThreatLevel(activeIncidents),
            lastUpdated: new Date()
          }
        })
      }
    }

    const handleUserLocked = (event: IncidentEventData) => {
      if (event.type === 'user_locked' && event.userId) {
        // Update user profile
        setState(prev => {
          const updatedProfiles = prev.userProfiles.map(profile =>
            profile.userId === event.userId
              ? { ...profile, accountLocked: true, lockoutCount: profile.lockoutCount + 1 }
              : profile
          )

          return {
            ...prev,
            userProfiles: updatedProfiles,
            currentUserProfile: event.userId === currentUserId
              ? updatedProfiles.find(p => p.userId === currentUserId) || prev.currentUserProfile
              : prev.currentUserProfile
          }
        })
      }
    }

    // Add event listeners
    incidentResponseService.addEventListener('incident_created', handleIncidentCreated)
    incidentResponseService.addEventListener('incident_updated', handleIncidentUpdated)
    incidentResponseService.addEventListener('user_locked', handleUserLocked)

    // Store cleanup functions
    eventListenersRef.current = [
      () => incidentResponseService.removeEventListener('incident_created', handleIncidentCreated),
      () => incidentResponseService.removeEventListener('incident_updated', handleIncidentUpdated),
      () => incidentResponseService.removeEventListener('user_locked', handleUserLocked)
    ]

    console.log('🔗 Real-time event listeners set up')
  }, [currentUserId])

  /**
   * Set up auto-refresh
   */
  const setupAutoRefresh = useCallback(() => {
    refreshIntervalRef.current = setInterval(async () => {
      try {
        await Promise.all([
          loadMetrics(),
          loadNotificationStats()
        ])

        setState(prev => ({ ...prev, lastUpdated: new Date() }))
      } catch (error) {
        console.error('❌ Auto-refresh failed:', error)
      }
    }, refreshInterval)

    console.log(`🔄 Auto-refresh enabled (${refreshInterval}ms interval)`)
  }, [refreshInterval])

  /**
   * Load incidents
   */
  const loadIncidents = useCallback(async () => {
    try {
      const searchCriteria: IncidentSearchCriteria = {
        limit: 100,
        sortBy: 'timestamp',
        sortOrder: 'desc',
        ...initialFilters
      }

      const response = await incidentResponseService.searchIncidents(searchCriteria)
      const activeIncidents = response.incidents.filter(i => i.status === IncidentStatus.OPEN)
      const recentIncidents = response.incidents.slice(0, 10)

      setState(prev => ({
        ...prev,
        incidents: response.incidents,
        activeIncidents,
        recentIncidents,
        pendingAlerts: activeIncidents.length,
        threatLevel: calculateThreatLevel(activeIncidents)
      }))

    } catch (error) {
      console.error('❌ Failed to load incidents:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load incidents'
      }))
    }
  }, [initialFilters])

  /**
   * Load metrics
   */
  const loadMetrics = useCallback(async () => {
    try {
      const metrics = await incidentResponseService.getMetrics()
      setState(prev => ({ ...prev, metrics }))
    } catch (error) {
      console.error('❌ Failed to load metrics:', error)
    }
  }, [])

  /**
   * Load user profiles
   */
  const loadUserProfiles = useCallback(async () => {
    try {
      const userProfiles = incidentResponseService.getAllUserSecurityProfiles()
      const currentUserProfile = currentUserId
        ? incidentResponseService.getUserSecurityProfile(currentUserId)
        : null

      setState(prev => ({
        ...prev,
        userProfiles,
        currentUserProfile
      }))
    } catch (error) {
      console.error('❌ Failed to load user profiles:', error)
    }
  }, [currentUserId])

  /**
   * Load notification stats
   */
  const loadNotificationStats = useCallback(async () => {
    try {
      const notificationStats = await notificationService.getNotificationStats()
      setState(prev => ({ ...prev, notificationStats }))
    } catch (error) {
      console.error('❌ Failed to load notification stats:', error)
    }
  }, [])

  /**
   * Calculate threat level based on active incidents
   */
  const calculateThreatLevel = useCallback((activeIncidents: SecurityIncident[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    if (activeIncidents.length === 0) return 'LOW'

    const criticalCount = activeIncidents.filter(i => i.severity === IncidentSeverity.CRITICAL).length
    const highCount = activeIncidents.filter(i => i.severity === IncidentSeverity.HIGH).length

    if (criticalCount > 0) return 'CRITICAL'
    if (highCount >= 3) return 'HIGH'
    if (highCount > 0 || activeIncidents.length >= 5) return 'MEDIUM'
    return 'LOW'
  }, [])

  /**
   * Actions
   */
  const actions: IncidentMonitoringActions = {
    // Create incident
    createIncident: useCallback(async (request: CreateIncidentRequest) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const incident = await incidentResponseService.createIncident(request)

        // Update state immediately
        setState(prev => {
          const newIncidents = [incident, ...prev.incidents]
          const activeIncidents = newIncidents.filter(i => i.status === IncidentStatus.OPEN)
          const recentIncidents = newIncidents.slice(0, 10)

          return {
            ...prev,
            incidents: newIncidents,
            activeIncidents,
            recentIncidents,
            pendingAlerts: prev.pendingAlerts + 1,
            threatLevel: calculateThreatLevel(activeIncidents),
            isLoading: false,
            lastUpdated: new Date()
          }
        })

        return incident
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to create incident'
        }))
        throw error
      }
    }, [calculateThreatLevel]),

    // Search incidents
    searchIncidents: useCallback(async (criteria: IncidentSearchCriteria) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const response = await incidentResponseService.searchIncidents(criteria)

        setState(prev => ({ ...prev, isLoading: false }))
        return response
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to search incidents'
        }))
        throw error
      }
    }, []),

    // Resolve incident
    resolveIncident: useCallback(async (incidentId: string, notes?: string) => {
      try {
        // Find incident and update it
        const incident = state.incidents.find(i => i.id === incidentId)
        if (!incident) {
          throw new Error('Incident not found')
        }

        const updatedIncident: SecurityIncident = {
          ...incident,
          status: IncidentStatus.RESOLVED,
          updatedAt: new Date()
        }

        if (notes) {
          updatedIncident.response.manual.push({
            action: 'resolve_incident',
            timestamp: new Date(),
            userId: currentUserId || 'unknown',
            userEmail: currentUserEmail || 'unknown',
            notes,
            outcome: 'successful'
          })
        }

        // Update state
        setState(prev => {
          const updatedIncidents = prev.incidents.map(i =>
            i.id === incidentId ? updatedIncident : i
          )
          const activeIncidents = updatedIncidents.filter(i => i.status === IncidentStatus.OPEN)

          return {
            ...prev,
            incidents: updatedIncidents,
            activeIncidents,
            threatLevel: calculateThreatLevel(activeIncidents),
            lastUpdated: new Date()
          }
        })

        console.log(`✅ Incident ${incidentId} resolved`)
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to resolve incident'
        }))
        throw error
      }
    }, [state.incidents, currentUserId, currentUserEmail, calculateThreatLevel]),

    // Mark as false positive
    markAsFalsePositive: useCallback(async (incidentId: string, reason: string) => {
      try {
        const incident = state.incidents.find(i => i.id === incidentId)
        if (!incident) {
          throw new Error('Incident not found')
        }

        const updatedIncident: SecurityIncident = {
          ...incident,
          status: IncidentStatus.FALSE_POSITIVE,
          updatedAt: new Date()
        }

        updatedIncident.response.manual.push({
          action: 'mark_false_positive',
          timestamp: new Date(),
          userId: currentUserId || 'unknown',
          userEmail: currentUserEmail || 'unknown',
          notes: reason,
          outcome: 'successful'
        })

        // Update state
        setState(prev => {
          const updatedIncidents = prev.incidents.map(i =>
            i.id === incidentId ? updatedIncident : i
          )
          const activeIncidents = updatedIncidents.filter(i => i.status === IncidentStatus.OPEN)

          return {
            ...prev,
            incidents: updatedIncidents,
            activeIncidents,
            threatLevel: calculateThreatLevel(activeIncidents),
            lastUpdated: new Date()
          }
        })

        console.log(`✅ Incident ${incidentId} marked as false positive`)
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to mark as false positive'
        }))
        throw error
      }
    }, [state.incidents, currentUserId, currentUserEmail, calculateThreatLevel]),

    // Refresh functions
    refreshIncidents: useCallback(async () => {
      await loadIncidents()
    }, [loadIncidents]),

    refreshMetrics: useCallback(async () => {
      await loadMetrics()
    }, [loadMetrics]),

    refreshUserProfiles: useCallback(async () => {
      await loadUserProfiles()
    }, [loadUserProfiles]),

    // Update configuration
    updateConfiguration: useCallback(async (config: Partial<IncidentConfiguration>) => {
      try {
        incidentResponseService.saveConfiguration(config)
        const newConfiguration = incidentResponseService.getConfiguration()
        setState(prev => ({ ...prev, configuration: newConfiguration }))
        console.log('✅ Configuration updated')
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to update configuration'
        }))
        throw error
      }
    }, []),

    // Get user profile
    getUserProfile: useCallback((userId: string) => {
      return incidentResponseService.getUserSecurityProfile(userId)
    }, []),

    // Trigger test incident
    triggerTestIncident: useCallback(async (type: IncidentType, severity: IncidentSeverity) => {
      try {
        const testIncident = await incidentResponseService.createIncident({
          type,
          severity,
          title: `Test Incident: ${type}`,
          description: `This is a test incident of type ${type} with severity ${severity}`,
          userId: currentUserId,
          userEmail: currentUserEmail,
          evidence: [{
            type: 'system_event',
            data: {
              action: 'test_incident',
              triggeredBy: currentUserId || 'unknown',
              timestamp: new Date().toISOString()
            },
            source: 'incident_monitoring_hook',
            description: 'Test incident triggered from UI'
          }],
          metadata: {
            isTest: true,
            triggeredBy: currentUserId || 'unknown'
          }
        })

        console.log('🧪 Test incident created:', testIncident.id)
        return testIncident
      } catch (error) {
        console.error('❌ Failed to create test incident:', error)
        throw error
      }
    }, [currentUserId, currentUserEmail]),

    // Test notifications
    testNotifications: useCallback(async () => {
      try {
        const emailTest = await notificationService.testNotification(
          'email',
          currentUserEmail || 'test@example.com',
          'This is a test notification from the incident monitoring system.'
        )

        console.log('📧 Test notification result:', emailTest)
        return emailTest
      } catch (error) {
        console.error('❌ Failed to test notifications:', error)
        return false
      }
    }, [currentUserEmail]),

    // MFA monitoring helpers
    handleMfaFailure: useCallback(async (userId: string, userEmail: string) => {
      try {
        await incidentResponseService.handleMfaFailure(userId, userEmail)
        await loadIncidents()
        await loadUserProfiles()
      } catch (error) {
        console.error('❌ Failed to handle MFA failure:', error)
        throw error
      }
    }, [loadIncidents, loadUserProfiles]),

    handleEmergencyLogout: useCallback(async (userId?: string, userEmail?: string) => {
      try {
        await incidentResponseService.handleEmergencyLogout(userId, userEmail)
        await loadIncidents()
      } catch (error) {
        console.error('❌ Failed to handle emergency logout:', error)
        throw error
      }
    }, [loadIncidents]),

    handleSuspiciousActivity: useCallback(async (userId: string, userEmail: string, reasons: string[]) => {
      try {
        await incidentResponseService.handleSuspiciousLogin(userId, userEmail, reasons)
        await loadIncidents()
        await loadUserProfiles()
      } catch (error) {
        console.error('❌ Failed to handle suspicious activity:', error)
        throw error
      }
    }, [loadIncidents, loadUserProfiles])
  }

  // Initialize on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up event listeners
      eventListenersRef.current.forEach(cleanup => cleanup())

      // Clean up auto-refresh
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }

      console.log('🧹 Incident monitoring cleanup completed')
    }
  }, [])

  // Update current user profile when user ID changes
  useEffect(() => {
    if (currentUserId && state.userProfiles.length > 0) {
      const currentUserProfile = incidentResponseService.getUserSecurityProfile(currentUserId)
      setState(prev => ({ ...prev, currentUserProfile }))
    }
  }, [currentUserId, state.userProfiles])

  return {
    state,
    actions
  }
}

/**
 * Hook for simplified incident monitoring (for components that only need basic data)
 */
export function useIncidentStats() {
  const { state, actions } = useIncidentMonitoring({
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute
    enableRealTime: false,
    loadOnMount: true
  })

  return {
    activeIncidents: state.activeIncidents.length,
    recentIncidents: state.recentIncidents.length,
    threatLevel: state.threatLevel,
    pendingAlerts: state.pendingAlerts,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    refreshStats: actions.refreshMetrics
  }
}

/**
 * Hook for user-specific incident monitoring
 */
export function useUserIncidentProfile(userId: string) {
  const { state, actions } = useIncidentMonitoring({
    currentUserId: userId,
    autoRefresh: true,
    refreshInterval: 30000,
    enableRealTime: true,
    loadOnMount: true
  })

  const userIncidents = state.incidents.filter(i => i.userId === userId)
  const userProfile = state.userProfiles.find(p => p.userId === userId)

  return {
    incidents: userIncidents,
    profile: userProfile,
    isLocked: userProfile?.accountLocked || false,
    riskLevel: userProfile?.riskLevel || 'LOW',
    totalIncidents: userProfile?.totalIncidents || 0,
    isLoading: state.isLoading,
    error: state.error,
    triggerMfaFailure: () => actions.handleMfaFailure(userId, userProfile?.userEmail || ''),
    triggerEmergencyLogout: () => actions.handleEmergencyLogout(userId, userProfile?.userEmail || ''),
    triggerSuspiciousActivity: (reasons: string[]) =>
      actions.handleSuspiciousActivity(userId, userProfile?.userEmail || '', reasons)
  }
}