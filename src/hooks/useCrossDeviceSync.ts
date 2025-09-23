/**
 * Main hook for cross-device synchronization operations
 *
 * Provides easy access to sync functionality, status monitoring,
 * and event handling for cross-device data operations.
 */

import { useCallback, useEffect, useState } from 'react'
import { useCrossDevice } from '@/contexts/CrossDeviceContext'
import { crossDeviceDataService } from '@/services/crossDeviceDataService'
import { secureLogger } from '@/services/secureLogger'
import type {
  SyncResult,
  DataChangeEvent,
  SyncStatus
} from '@/services/crossDeviceDataService'

const logger = secureLogger.component('useCrossDeviceSync')

export interface SyncHookResult {
  // Sync Status
  syncStatus: SyncStatus
  isOnline: boolean
  isSyncing: boolean
  queueSize: number
  lastSyncTime: Date | null

  // Sync Operations
  syncData: (
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId: string,
    data?: any,
    priority?: 'low' | 'normal' | 'high' | 'critical'
  ) => Promise<SyncResult>

  forceSyncNow: () => Promise<void>

  // Queue Management
  clearQueue: () => Promise<void>

  // Event Handling
  onDataChange: (callback: (event: DataChangeEvent) => void) => () => void
  onSyncComplete: (callback: (result: any) => void) => () => void
  onSyncError: (callback: (error: any) => void) => () => void

  // Utilities
  exportSyncDiagnostics: () => Promise<any>
}

export const useCrossDeviceSync = (): SyncHookResult => {
  const {
    syncStatus,
    isOnline,
    lastSyncTime,
    forceSyncNow,
    clearSyncQueue,
    exportDiagnostics
  } = useCrossDevice()

  const [eventListeners, setEventListeners] = useState<Set<() => void>>(new Set())

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      eventListeners.forEach(cleanup => cleanup())
    }
  }, [eventListeners])

  const syncData = useCallback(async (
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId: string,
    data?: any,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<SyncResult> => {
    try {
      logger.debug('Syncing data via hook', undefined, undefined, {
        operation,
        tableName,
        recordId,
        priority
      })

      const result = await crossDeviceDataService.syncData(
        operation,
        tableName,
        recordId,
        data,
        priority
      )

      if (!result.success) {
        logger.warn('Sync operation failed', undefined, undefined, {
          error: result.error,
          operation,
          tableName
        })
      }

      return result

    } catch (error) {
      logger.error('Sync operation error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
        tableName,
        recordId
      })

      return {
        success: false,
        operationId: '',
        conflictsDetected: 0,
        conflictsResolved: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }, [])

  const clearQueue = useCallback(async (): Promise<void> => {
    try {
      await clearSyncQueue()
      logger.info('Sync queue cleared via hook')
    } catch (error) {
      logger.error('Failed to clear queue via hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [clearSyncQueue])

  const onDataChange = useCallback((callback: (event: DataChangeEvent) => void) => {
    const handleDataChange = (event: CustomEvent) => {
      callback(event.detail)
    }

    window.addEventListener('crossDeviceDataChange', handleDataChange)

    const cleanup = () => {
      window.removeEventListener('crossDeviceDataChange', handleDataChange)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  const onSyncComplete = useCallback((callback: (result: any) => void) => {
    const handleSyncComplete = (event: CustomEvent) => {
      callback(event.detail)
    }

    window.addEventListener('crossDeviceSyncComplete', handleSyncComplete)

    const cleanup = () => {
      window.removeEventListener('crossDeviceSyncComplete', handleSyncComplete)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  const onSyncError = useCallback((callback: (error: any) => void) => {
    const handleSyncError = (event: CustomEvent) => {
      callback(event.detail)
    }

    window.addEventListener('crossDeviceSyncError', handleSyncError)

    const cleanup = () => {
      window.removeEventListener('crossDeviceSyncError', handleSyncError)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  return {
    // Status
    syncStatus,
    isOnline,
    isSyncing: syncStatus.isSyncing,
    queueSize: syncStatus.queueSize,
    lastSyncTime,

    // Operations
    syncData,
    forceSyncNow,

    // Queue Management
    clearQueue,

    // Event Handling
    onDataChange,
    onSyncComplete,
    onSyncError,

    // Utilities
    exportSyncDiagnostics: exportDiagnostics
  }
}