/**
 * Hook for conflict resolution management
 *
 * Provides functionality for detecting, managing, and resolving
 * data conflicts that occur during cross-device synchronization.
 */

import { useCallback, useEffect, useState } from 'react'
import { useCrossDevice } from '@/contexts/CrossDeviceContext'
import { conflictResolutionService } from '@/services/conflictResolutionService'
import { secureLogger } from '@/services/secureLogger'
import type { ConflictData, ConflictResolution } from '@/services/conflictResolutionService'

const logger = secureLogger.component('useConflictResolution')

export interface ConflictResolutionResult {
  // Conflict State
  pendingConflicts: ConflictData[]
  conflictCount: number
  hasConflicts: boolean

  // Conflict Operations
  resolveConflict: (conflictId: string, resolution: 'keep_local' | 'keep_remote' | 'merge') => Promise<boolean>
  resolveAllConflicts: (resolution: 'keep_local' | 'keep_remote' | 'merge') => Promise<void>
  ignoreConflict: (conflictId: string) => Promise<boolean>
  refreshConflicts: () => Promise<void>

  // Conflict Analysis
  getConflictById: (conflictId: string) => ConflictData | null
  getConflictsByTable: (tableName: string) => ConflictData[]
  getHighPriorityConflicts: () => ConflictData[]

  // Auto-resolution
  enableAutoResolution: (strategy: 'latest_wins' | 'local_wins' | 'remote_wins') => Promise<void>
  disableAutoResolution: () => Promise<void>
  isAutoResolutionEnabled: boolean

  // Event Handling
  onConflictDetected: (callback: (conflicts: ConflictData[]) => void) => () => void
  onConflictResolved: (callback: (conflictId: string, resolution: ConflictResolution) => void) => () => void

  // Utilities
  exportConflictData: () => any
  getConflictStatistics: () => {
    byTable: Record<string, number>
    byType: Record<string, number>
    byPriority: Record<string, number>
    resolutionSuggestions: Record<string, string>
  }
}

export const useConflictResolution = (): ConflictResolutionResult => {
  const {
    pendingConflicts,
    conflictCount,
    resolveConflict: contextResolveConflict,
    resolveAllConflicts: contextResolveAllConflicts,
    refreshConflicts: contextRefreshConflicts,
    configuration,
    updateConfiguration
  } = useCrossDevice()

  const [eventListeners, setEventListeners] = useState<Set<() => void>>(new Set())
  const [isAutoResolutionEnabled, setIsAutoResolutionEnabled] = useState(
    configuration.autoResolveConflicts
  )

  const hasConflicts = conflictCount > 0

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      eventListeners.forEach(cleanup => cleanup())
    }
  }, [eventListeners])

  // Update auto-resolution state when configuration changes
  useEffect(() => {
    setIsAutoResolutionEnabled(configuration.autoResolveConflicts)
  }, [configuration.autoResolveConflicts])

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'keep_local' | 'keep_remote' | 'merge'
  ): Promise<boolean> => {
    try {
      logger.debug('Resolving conflict via hook', undefined, undefined, {
        conflictId,
        resolution
      })

      const result = await contextResolveConflict(conflictId, resolution)

      if (result) {
        logger.info('Conflict resolved successfully via hook', undefined, undefined, {
          conflictId,
          resolution
        })
      } else {
        logger.warn('Conflict resolution failed via hook', undefined, undefined, {
          conflictId,
          resolution
        })
      }

      return result

    } catch (error) {
      logger.error('Conflict resolution error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId,
        resolution
      })
      return false
    }
  }, [contextResolveConflict])

  const resolveAllConflicts = useCallback(async (
    resolution: 'keep_local' | 'keep_remote' | 'merge'
  ): Promise<void> => {
    try {
      logger.debug('Resolving all conflicts via hook', undefined, undefined, {
        resolution,
        count: conflictCount
      })

      await contextResolveAllConflicts(resolution)

      logger.info('All conflicts resolved successfully via hook', undefined, undefined, {
        resolution,
        count: conflictCount
      })

    } catch (error) {
      logger.error('Bulk conflict resolution error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        resolution,
        count: conflictCount
      })
      throw error
    }
  }, [contextResolveAllConflicts, conflictCount])

  const ignoreConflict = useCallback(async (conflictId: string): Promise<boolean> => {
    try {
      logger.debug('Ignoring conflict via hook', undefined, undefined, { conflictId })

      const result = await conflictResolutionService.ignoreConflict(conflictId)

      if (result.success) {
        // Refresh conflicts to remove ignored conflict
        await contextRefreshConflicts()
        logger.info('Conflict ignored successfully via hook', undefined, undefined, { conflictId })
      } else {
        logger.warn('Conflict ignore failed via hook', undefined, undefined, {
          conflictId,
          error: result.error
        })
      }

      return result.success

    } catch (error) {
      logger.error('Conflict ignore error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId
      })
      return false
    }
  }, [contextRefreshConflicts])

  const refreshConflicts = useCallback(async (): Promise<void> => {
    try {
      logger.debug('Refreshing conflicts via hook')
      await contextRefreshConflicts()
      logger.info('Conflicts refreshed successfully via hook')
    } catch (error) {
      logger.error('Conflict refresh error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [contextRefreshConflicts])

  const getConflictById = useCallback((conflictId: string): ConflictData | null => {
    return pendingConflicts.find(conflict => conflict.id === conflictId) || null
  }, [pendingConflicts])

  const getConflictsByTable = useCallback((tableName: string): ConflictData[] => {
    return pendingConflicts.filter(conflict => conflict.tableName === tableName)
  }, [pendingConflicts])

  const getHighPriorityConflicts = useCallback((): ConflictData[] => {
    return pendingConflicts.filter(conflict =>
      conflict.priority === 'critical' || conflict.priority === 'high'
    )
  }, [pendingConflicts])

  const enableAutoResolution = useCallback(async (
    strategy: 'latest_wins' | 'local_wins' | 'remote_wins'
  ): Promise<void> => {
    try {
      logger.debug('Enabling auto-resolution via hook', undefined, undefined, { strategy })

      // Update configuration to enable auto-resolution
      updateConfiguration({ autoResolveConflicts: true })

      // Set the strategy in the conflict resolution service
      await conflictResolutionService.setAutoResolutionStrategy(strategy)

      setIsAutoResolutionEnabled(true)

      logger.info('Auto-resolution enabled via hook', undefined, undefined, { strategy })

    } catch (error) {
      logger.error('Auto-resolution enable error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        strategy
      })
      throw error
    }
  }, [updateConfiguration])

  const disableAutoResolution = useCallback(async (): Promise<void> => {
    try {
      logger.debug('Disabling auto-resolution via hook')

      // Update configuration to disable auto-resolution
      updateConfiguration({ autoResolveConflicts: false })

      setIsAutoResolutionEnabled(false)

      logger.info('Auto-resolution disabled via hook')

    } catch (error) {
      logger.error('Auto-resolution disable error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [updateConfiguration])

  const onConflictDetected = useCallback((callback: (conflicts: ConflictData[]) => void) => {
    const handleConflictDetected = (event: CustomEvent) => {
      callback(event.detail.conflicts)
    }

    window.addEventListener('crossDeviceConflict', handleConflictDetected)

    const cleanup = () => {
      window.removeEventListener('crossDeviceConflict', handleConflictDetected)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  const onConflictResolved = useCallback((
    callback: (conflictId: string, resolution: ConflictResolution) => void
  ) => {
    const handleConflictResolved = (event: CustomEvent) => {
      callback(event.detail.conflictId, event.detail.resolution)
    }

    window.addEventListener('crossDeviceConflictResolved', handleConflictResolved)

    const cleanup = () => {
      window.removeEventListener('crossDeviceConflictResolved', handleConflictResolved)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  const exportConflictData = useCallback(() => {
    const conflictData = {
      timestamp: new Date().toISOString(),
      conflictCount,
      hasConflicts,
      isAutoResolutionEnabled,
      conflicts: pendingConflicts.map(conflict => ({
        ...conflict,
        // Remove potentially sensitive data
        localData: conflict.localData ? '[REDACTED]' : null,
        remoteData: conflict.remoteData ? '[REDACTED]' : null
      })),
      statistics: getConflictStatistics()
    }

    logger.info('Conflict data exported', undefined, undefined, {
      conflictCount,
      hasConflicts
    })

    return conflictData
  }, [conflictCount, hasConflicts, isAutoResolutionEnabled, pendingConflicts])

  const getConflictStatistics = useCallback(() => {
    const byTable: Record<string, number> = {}
    const byType: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    const resolutionSuggestions: Record<string, string> = {}

    pendingConflicts.forEach(conflict => {
      // By table
      byTable[conflict.tableName] = (byTable[conflict.tableName] || 0) + 1

      // By type
      byType[conflict.conflictType] = (byType[conflict.conflictType] || 0) + 1

      // By priority
      byPriority[conflict.priority] = (byPriority[conflict.priority] || 0) + 1

      // Resolution suggestions
      if (!resolutionSuggestions[conflict.tableName]) {
        // Simple heuristic: suggest keeping latest for most conflicts
        if (conflict.conflictType === 'timestamp_mismatch') {
          resolutionSuggestions[conflict.tableName] = 'keep_remote' // Assuming remote is typically newer
        } else if (conflict.conflictType === 'data_mismatch') {
          resolutionSuggestions[conflict.tableName] = 'merge'
        } else {
          resolutionSuggestions[conflict.tableName] = 'keep_local'
        }
      }
    })

    return {
      byTable,
      byType,
      byPriority,
      resolutionSuggestions
    }
  }, [pendingConflicts])

  return {
    // Conflict State
    pendingConflicts,
    conflictCount,
    hasConflicts,

    // Conflict Operations
    resolveConflict,
    resolveAllConflicts,
    ignoreConflict,
    refreshConflicts,

    // Conflict Analysis
    getConflictById,
    getConflictsByTable,
    getHighPriorityConflicts,

    // Auto-resolution
    enableAutoResolution,
    disableAutoResolution,
    isAutoResolutionEnabled,

    // Event Handling
    onConflictDetected,
    onConflictResolved,

    // Utilities
    exportConflictData,
    getConflictStatistics
  }
}