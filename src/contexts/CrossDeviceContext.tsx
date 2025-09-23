import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useSupabase } from './SupabaseContext'
import { crossDeviceDataService } from '@/services/crossDeviceDataService'
import { deviceFingerprintService } from '@/services/deviceFingerprintService'
import { crossDeviceSessionService } from '@/services/crossDeviceSessionService'
import { conflictResolutionService } from '@/services/conflictResolutionService'
import { realTimeSyncService } from '@/services/realTimeSyncService'
import { secureLogger } from '@/services/secureLogger'
import type {
  SyncStatus,
  DataChangeEvent,
  CrossDeviceDataHandlers,
  DataSyncConfiguration
} from '@/services/crossDeviceDataService'
import type { DeviceInfo, DeviceRegistrationResult } from '@/services/deviceFingerprintService'
import type { ConflictData } from '@/services/conflictResolutionService'

const logger = secureLogger.component('CrossDeviceContext')

export interface CrossDeviceState {
  // Device Management
  currentDevice: DeviceInfo | null
  connectedDevices: DeviceInfo[]
  deviceRegistration: DeviceRegistrationResult | null

  // Sync Status
  syncStatus: SyncStatus
  isInitialized: boolean
  isOnline: boolean

  // Conflicts
  pendingConflicts: ConflictData[]
  conflictCount: number

  // Configuration
  configuration: DataSyncConfiguration

  // Notifications
  lastSyncTime: Date | null
  recentActivity: DataChangeEvent[]

  // Error States
  lastError: string | null
  deviceTrustIssues: boolean
}

export interface CrossDeviceActions {
  // Device Management
  registerDevice: (deviceName?: string) => Promise<boolean>
  removeDevice: (deviceId: string) => Promise<boolean>
  refreshDeviceList: () => Promise<void>
  updateDeviceTrust: (deviceId: string, trustLevel: 'trusted' | 'untrusted' | 'unknown') => Promise<boolean>

  // Sync Operations
  forceSyncNow: () => Promise<void>
  enableSync: () => Promise<void>
  disableSync: () => Promise<void>
  clearSyncQueue: () => Promise<void>

  // Conflict Resolution
  resolveConflict: (conflictId: string, resolution: 'keep_local' | 'keep_remote' | 'merge') => Promise<boolean>
  resolveAllConflicts: (resolution: 'keep_local' | 'keep_remote' | 'merge') => Promise<void>
  refreshConflicts: () => Promise<void>

  // Configuration
  updateConfiguration: (config: Partial<DataSyncConfiguration>) => void
  resetConfiguration: () => void

  // Utilities
  clearError: () => void
  clearActivity: () => void
  exportDiagnostics: () => Promise<any>
}

interface CrossDeviceContextType extends CrossDeviceState, CrossDeviceActions {}

const CrossDeviceContext = createContext<CrossDeviceContextType | undefined>(undefined)

export const useCrossDevice = () => {
  const context = useContext(CrossDeviceContext)
  if (context === undefined) {
    throw new Error('useCrossDevice must be used within a CrossDeviceProvider')
  }
  return context
}

interface CrossDeviceProviderProps {
  children: ReactNode
}

export const CrossDeviceProvider: React.FC<CrossDeviceProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const { supabase } = useSupabase()

  // State
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null)
  const [connectedDevices, setConnectedDevices] = useState<DeviceInfo[]>([])
  const [deviceRegistration, setDeviceRegistration] = useState<DeviceRegistrationResult | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    queueSize: 0,
    lastSyncTime: null,
    pendingConflicts: 0,
    totalSynced: 0,
    errors: 0
  })
  const [isInitialized, setIsInitialized] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingConflicts, setPendingConflicts] = useState<ConflictData[]>([])
  const [conflictCount, setConflictCount] = useState(0)
  const [configuration, setConfiguration] = useState<DataSyncConfiguration>({
    enableOfflineQueue: true,
    enableConflictResolution: true,
    enableRealTimeSync: true,
    maxQueueSize: 1000,
    syncBatchSize: 20,
    encryptPHI: true,
    auditAllOperations: true,
    autoResolveConflicts: false // Default to manual resolution for user control
  })
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [recentActivity, setRecentActivity] = useState<DataChangeEvent[]>([])
  const [lastError, setLastError] = useState<string | null>(null)
  const [deviceTrustIssues, setDeviceTrustIssues] = useState(false)

  // Online/Offline monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      logger.debug('Device went online')
    }

    const handleOffline = () => {
      setIsOnline(false)
      logger.debug('Device went offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Initialize cross-device functionality when user is authenticated
  useEffect(() => {
    const initializeCrossDevice = async () => {
      if (!isAuthenticated || !user?.id) {
        setIsInitialized(false)
        return
      }

      try {
        logger.debug('Initializing cross-device functionality', user.id)

        // Initialize the main data service
        const dataServiceInitialized = await crossDeviceDataService.initialize(user.id, configuration)

        if (!dataServiceInitialized) {
          logger.error('Failed to initialize cross-device data service', user.id)
          setLastError('Failed to initialize cross-device synchronization')
          return
        }

        // Get current device info
        const deviceInfo = await deviceFingerprintService.getCurrentDeviceInfo()
        setCurrentDevice(deviceInfo)

        // Load connected devices
        await refreshDeviceList()

        // Load pending conflicts
        await refreshConflicts()

        // Set up event handlers
        setupEventHandlers()

        // Update sync status
        const status = crossDeviceDataService.getSyncStatus()
        setSyncStatus(status)

        setIsInitialized(true)
        logger.info('Cross-device functionality initialized successfully', user.id)

      } catch (error) {
        logger.error('Failed to initialize cross-device functionality', user.id, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        setLastError(error instanceof Error ? error.message : 'Failed to initialize cross-device features')
      }
    }

    initializeCrossDevice()
  }, [isAuthenticated, user?.id])

  // Cleanup on unmount or logout
  useEffect(() => {
    return () => {
      if (isInitialized) {
        crossDeviceDataService.cleanup()
        setIsInitialized(false)
      }
    }
  }, [isInitialized])

  // Periodic sync status updates
  useEffect(() => {
    if (!isInitialized) return

    const statusInterval = setInterval(() => {
      const status = crossDeviceDataService.getSyncStatus()
      setSyncStatus(status)

      if (status.lastSyncTime) {
        setLastSyncTime(new Date(status.lastSyncTime))
      }
    }, 5000) // Update every 5 seconds

    return () => clearInterval(statusInterval)
  }, [isInitialized])

  // Setup event handlers for cross-device services
  const setupEventHandlers = useCallback(() => {
    const handlers: CrossDeviceDataHandlers = {
      onDataChange: (event: DataChangeEvent) => {
        logger.debug('Data change event received', user?.id, undefined, {
          source: event.source,
          operation: event.operation,
          tableName: event.tableName
        })

        // Add to recent activity
        setRecentActivity(prev => {
          const newActivity = [event, ...prev.slice(0, 19)] // Keep last 20 events
          return newActivity
        })

        // Emit custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('crossDeviceDataChange', {
          detail: event
        }))
      },

      onSyncProgress: (progress) => {
        logger.debug('Sync progress update', user?.id, undefined, progress)

        // Update sync status to show progress
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: true
        }))
      },

      onConflictDetected: (conflicts) => {
        logger.info('Conflicts detected', user?.id, undefined, {
          conflictCount: conflicts.length
        })

        setPendingConflicts(prev => [...prev, ...conflicts])
        setConflictCount(prev => prev + conflicts.length)

        // Emit conflict event
        window.dispatchEvent(new CustomEvent('crossDeviceConflict', {
          detail: { conflicts, count: conflicts.length }
        }))
      },

      onSyncError: (error) => {
        logger.error('Sync error occurred', user?.id, undefined, error)
        setLastError(error.message)

        // Emit error event
        window.dispatchEvent(new CustomEvent('crossDeviceSyncError', {
          detail: error
        }))
      },

      onSyncComplete: (result) => {
        logger.info('Sync completed', user?.id, undefined, result)

        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false
        }))

        setLastSyncTime(new Date())

        // Emit completion event
        window.dispatchEvent(new CustomEvent('crossDeviceSyncComplete', {
          detail: result
        }))
      }
    }

    crossDeviceDataService.setEventHandlers(handlers)
  }, [user?.id])

  // Actions implementation
  const registerDevice = useCallback(async (deviceName?: string): Promise<boolean> => {
    if (!user?.id) return false

    try {
      logger.debug('Registering new device', user.id)

      const result = await deviceFingerprintService.registerDevice(user.id, deviceName)
      setDeviceRegistration(result)

      if (result.success) {
        await refreshDeviceList()
        logger.info('Device registered successfully', user.id, undefined, {
          deviceId: result.deviceId
        })
      }

      return result.success

    } catch (error) {
      logger.error('Failed to register device', user.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setLastError('Failed to register device')
      return false
    }
  }, [user?.id])

  const removeDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    if (!user?.id) return false

    try {
      logger.debug('Removing device', user.id, undefined, { deviceId })

      const result = await deviceFingerprintService.removeDevice(user.id, deviceId)

      if (result.success) {
        await refreshDeviceList()
        logger.info('Device removed successfully', user.id, undefined, { deviceId })
      }

      return result.success

    } catch (error) {
      logger.error('Failed to remove device', user.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId
      })
      setLastError('Failed to remove device')
      return false
    }
  }, [user?.id])

  const refreshDeviceList = useCallback(async (): Promise<void> => {
    if (!user?.id) return

    try {
      const devices = await deviceFingerprintService.getUserDevices(user.id)
      setConnectedDevices(devices)

      // Check for trust issues
      const untrustedDevices = devices.filter(d => d.trustLevel === 'untrusted')
      setDeviceTrustIssues(untrustedDevices.length > 0)

    } catch (error) {
      logger.error('Failed to refresh device list', user.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [user?.id])

  const updateDeviceTrust = useCallback(async (
    deviceId: string,
    trustLevel: 'trusted' | 'untrusted' | 'unknown'
  ): Promise<boolean> => {
    if (!user?.id) return false

    try {
      const result = await deviceFingerprintService.updateDeviceTrust(user.id, deviceId, trustLevel)

      if (result.success) {
        await refreshDeviceList()
      }

      return result.success

    } catch (error) {
      logger.error('Failed to update device trust', user.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId,
        trustLevel
      })
      setLastError('Failed to update device trust level')
      return false
    }
  }, [user?.id])

  const forceSyncNow = useCallback(async (): Promise<void> => {
    if (!isInitialized) return

    try {
      logger.debug('Forcing immediate sync', user?.id)
      setSyncStatus(prev => ({ ...prev, isSyncing: true }))

      const result = await crossDeviceDataService.forceSyncAll()

      logger.info('Force sync completed', user?.id, undefined, result)

    } catch (error) {
      logger.error('Force sync failed', user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setLastError('Failed to force synchronization')
    }
  }, [isInitialized, user?.id])

  const enableSync = useCallback(async (): Promise<void> => {
    if (!user?.id) return

    try {
      updateConfiguration({ enableRealTimeSync: true, enableOfflineQueue: true })
      await realTimeSyncService.initialize(user.id, currentDevice?.id || 'unknown')

      logger.info('Cross-device sync enabled', user.id)

    } catch (error) {
      logger.error('Failed to enable sync', user.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setLastError('Failed to enable synchronization')
    }
  }, [user?.id, currentDevice?.id])

  const disableSync = useCallback(async (): Promise<void> => {
    try {
      updateConfiguration({ enableRealTimeSync: false, enableOfflineQueue: false })
      await realTimeSyncService.cleanup()

      logger.info('Cross-device sync disabled', user?.id)

    } catch (error) {
      logger.error('Failed to disable sync', user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setLastError('Failed to disable synchronization')
    }
  }, [user?.id])

  const clearSyncQueue = useCallback(async (): Promise<void> => {
    if (!isInitialized) return

    try {
      await crossDeviceDataService.clearSyncQueue()
      setSyncStatus(prev => ({ ...prev, queueSize: 0 }))

      logger.info('Sync queue cleared', user?.id)

    } catch (error) {
      logger.error('Failed to clear sync queue', user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setLastError('Failed to clear sync queue')
    }
  }, [isInitialized, user?.id])

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'keep_local' | 'keep_remote' | 'merge'
  ): Promise<boolean> => {
    try {
      const result = await conflictResolutionService.resolveConflict(conflictId, resolution)

      if (result.success) {
        // Remove resolved conflict from pending list
        setPendingConflicts(prev => prev.filter(c => c.id !== conflictId))
        setConflictCount(prev => Math.max(0, prev - 1))

        logger.info('Conflict resolved', user?.id, undefined, {
          conflictId,
          resolution
        })
      }

      return result.success

    } catch (error) {
      logger.error('Failed to resolve conflict', user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId,
        resolution
      })
      setLastError('Failed to resolve conflict')
      return false
    }
  }, [user?.id])

  const resolveAllConflicts = useCallback(async (
    resolution: 'keep_local' | 'keep_remote' | 'merge'
  ): Promise<void> => {
    try {
      const conflicts = conflictResolutionService.getPendingConflicts()

      for (const conflict of conflicts) {
        await resolveConflict(conflict.id, resolution)
      }

      logger.info('All conflicts resolved', user?.id, undefined, {
        count: conflicts.length,
        resolution
      })

    } catch (error) {
      logger.error('Failed to resolve all conflicts', user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        resolution
      })
      setLastError('Failed to resolve all conflicts')
    }
  }, [user?.id, resolveConflict])

  const refreshConflicts = useCallback(async (): Promise<void> => {
    try {
      const conflicts = conflictResolutionService.getPendingConflicts()
      setPendingConflicts(conflicts)
      setConflictCount(conflicts.length)

    } catch (error) {
      logger.error('Failed to refresh conflicts', user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [user?.id])

  const updateConfiguration = useCallback((config: Partial<DataSyncConfiguration>): void => {
    const newConfig = { ...configuration, ...config }
    setConfiguration(newConfig)
    crossDeviceDataService.updateConfiguration(config)

    logger.debug('Configuration updated', user?.id, undefined, config)
  }, [configuration, user?.id])

  const resetConfiguration = useCallback((): void => {
    const defaultConfig: DataSyncConfiguration = {
      enableOfflineQueue: true,
      enableConflictResolution: true,
      enableRealTimeSync: true,
      maxQueueSize: 1000,
      syncBatchSize: 20,
      encryptPHI: true,
      auditAllOperations: true,
      autoResolveConflicts: false
    }

    setConfiguration(defaultConfig)
    crossDeviceDataService.updateConfiguration(defaultConfig)

    logger.info('Configuration reset to defaults', user?.id)
  }, [user?.id])

  const clearError = useCallback((): void => {
    setLastError(null)
  }, [])

  const clearActivity = useCallback((): void => {
    setRecentActivity([])
  }, [])

  const exportDiagnostics = useCallback(async (): Promise<any> => {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        isInitialized,
        isOnline,
        currentDevice,
        connectedDevices: connectedDevices.length,
        syncStatus,
        conflictCount,
        configuration,
        recentActivity: recentActivity.slice(0, 10), // Last 10 events
        lastError,
        deviceTrustIssues,
        systemInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        }
      }

      logger.info('Diagnostics exported', user?.id, undefined, {
        diagnosticsSize: JSON.stringify(diagnostics).length
      })

      return diagnostics

    } catch (error) {
      logger.error('Failed to export diagnostics', user?.id, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [
    user?.id, isInitialized, isOnline, currentDevice, connectedDevices,
    syncStatus, conflictCount, configuration, recentActivity, lastError, deviceTrustIssues
  ])

  const value: CrossDeviceContextType = {
    // State
    currentDevice,
    connectedDevices,
    deviceRegistration,
    syncStatus,
    isInitialized,
    isOnline,
    pendingConflicts,
    conflictCount,
    configuration,
    lastSyncTime,
    recentActivity,
    lastError,
    deviceTrustIssues,

    // Actions
    registerDevice,
    removeDevice,
    refreshDeviceList,
    updateDeviceTrust,
    forceSyncNow,
    enableSync,
    disableSync,
    clearSyncQueue,
    resolveConflict,
    resolveAllConflicts,
    refreshConflicts,
    updateConfiguration,
    resetConfiguration,
    clearError,
    clearActivity,
    exportDiagnostics
  }

  return (
    <CrossDeviceContext.Provider value={value}>
      {children}
    </CrossDeviceContext.Provider>
  )
}