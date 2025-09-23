/**
 * HIPAA-Compliant Cross-Device Data Service
 *
 * Main orchestrator for cross-device data synchronization, integrating all
 * cross-device services to provide a unified data management experience.
 *
 * Features:
 * - Coordinated data synchronization across devices
 * - Offline queue management with PHI encryption
 * - Data consistency and integrity enforcement
 * - Integration with all cross-device services
 * - HIPAA-compliant audit logging
 */

import { supabase } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import { secureStorage } from '@/services/secureStorage'
import { auditLogger } from '@/services/auditLogger'
import { encryptionService } from '@/services/encryption'
import { deviceFingerprintService } from '@/services/deviceFingerprintService'
import { crossDeviceSessionService } from '@/services/crossDeviceSessionService'
import { realTimeSyncService } from '@/services/realTimeSyncService'
import { conflictResolutionService } from '@/services/conflictResolutionService'
import { SyncQueueItem } from '@/types/supabase'

const logger = secureLogger.component('CrossDeviceDataService')

export interface SyncOperation {
  id: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  tableName: string
  recordId: string
  data: any
  timestamp: string
  deviceId: string
  userId: string
  encrypted: boolean
  priority: 'low' | 'normal' | 'high' | 'critical'
  retryCount: number
  maxRetries: number
}

export interface SyncResult {
  success: boolean
  operationId: string
  conflictsDetected: number
  conflictsResolved: number
  error?: string
  metadata?: Record<string, any>
}

export interface DataSyncConfiguration {
  enableOfflineQueue: boolean
  enableConflictResolution: boolean
  enableRealTimeSync: boolean
  maxQueueSize: number
  syncBatchSize: number
  encryptPHI: boolean
  auditAllOperations: boolean
  autoResolveConflicts: boolean
}

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  queueSize: number
  lastSyncTime: string | null
  pendingConflicts: number
  totalSynced: number
  errors: number
}

export interface DataChangeEvent {
  tableName: string
  recordId: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  data: any
  timestamp: string
  source: 'local' | 'remote'
  deviceId: string
}

export interface CrossDeviceDataHandlers {
  onDataChange: (event: DataChangeEvent) => void
  onSyncProgress: (progress: { current: number; total: number; operation: string }) => void
  onConflictDetected: (conflicts: any[]) => void
  onSyncError: (error: { type: string; message: string; details?: any }) => void
  onSyncComplete: (result: { synced: number; conflicts: number; errors: number }) => void
}

class CrossDeviceDataService {
  private userId: string | null = null
  private deviceId: string | null = null
  private configuration: DataSyncConfiguration
  private syncQueue: SyncOperation[] = []
  private isSyncing: boolean = false
  private lastSyncTime: string | null = null
  private syncStats = { totalSynced: 0, errors: 0 }
  private eventHandlers: Partial<CrossDeviceDataHandlers> = {}
  private syncInterval: NodeJS.Timeout | null = null
  private isInitialized: boolean = false

  constructor() {
    this.configuration = {
      enableOfflineQueue: true,
      enableConflictResolution: true,
      enableRealTimeSync: true,
      maxQueueSize: 1000,
      syncBatchSize: 20,
      encryptPHI: true,
      auditAllOperations: true,
      autoResolveConflicts: true
    }
  }

  /**
   * Initialize the cross-device data service
   */
  async initialize(userId: string, config?: Partial<DataSyncConfiguration>): Promise<boolean> {
    try {
      logger.debug('Initializing cross-device data service', userId)

      this.userId = userId

      if (config) {
        this.configuration = { ...this.configuration, ...config }
      }

      // Initialize device fingerprinting
      const deviceInfo = await deviceFingerprintService.getCurrentDeviceInfo()
      if (!deviceInfo) {
        logger.error('Failed to get device info during initialization', userId)
        return false
      }

      // Register device if not already registered
      if (!deviceInfo.isRegistered) {
        const result = await deviceFingerprintService.registerDevice(userId)
        if (!result.success) {
          logger.error('Failed to register device', userId)
          return false
        }
        this.deviceId = result.deviceId!
      } else {
        const validation = await deviceFingerprintService.validateDevice(userId)
        if (!validation.isValid) {
          logger.error('Device validation failed', userId)
          return false
        }
        this.deviceId = validation.deviceId!
      }

      // Initialize session management
      const sessionInitialized = await crossDeviceSessionService.initialize(userId)
      if (!sessionInitialized) {
        logger.error('Failed to initialize session service', userId)
        return false
      }

      // Initialize real-time sync
      if (this.configuration.enableRealTimeSync) {
        const syncInitialized = await realTimeSyncService.initialize(userId, this.deviceId)
        if (!syncInitialized) {
          logger.warn('Failed to initialize real-time sync, continuing without it', userId)
        } else {
          this.setupRealTimeSyncHandlers()
        }
      }

      // Initialize conflict resolution
      if (this.configuration.enableConflictResolution) {
        const conflictInitialized = await conflictResolutionService.initialize(userId)
        if (!conflictInitialized) {
          logger.warn('Failed to initialize conflict resolution, continuing without it', userId)
        }
      }

      // Load persisted sync queue
      await this.loadSyncQueue()

      // Start sync interval
      this.startSyncInterval()

      // Process any pending operations
      if (this.syncQueue.length > 0) {
        await this.processSyncQueue()
      }

      this.isInitialized = true

      logger.info('Cross-device data service initialized successfully', userId, undefined, {
        deviceId: this.deviceId,
        queueSize: this.syncQueue.length
      })

      return true

    } catch (error) {
      logger.error('Failed to initialize cross-device data service', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Sync data operation across devices
   */
  async syncData(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId: string,
    data?: any,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
  ): Promise<SyncResult> {
    try {
      if (!this.isInitialized || !this.userId || !this.deviceId) {
        return {
          success: false,
          operationId: '',
          conflictsDetected: 0,
          conflictsResolved: 0,
          error: 'Service not initialized'
        }
      }

      logger.debug('Syncing data operation', this.userId, undefined, {
        operation,
        tableName,
        recordId,
        priority
      })

      // Create sync operation
      const syncOperation: SyncOperation = {
        id: crypto.randomUUID(),
        operation,
        tableName,
        recordId,
        data: data || {},
        timestamp: new Date().toISOString(),
        deviceId: this.deviceId,
        userId: this.userId,
        encrypted: this.shouldEncryptTable(tableName),
        priority,
        retryCount: 0,
        maxRetries: 3
      }

      // Add to sync queue
      await this.queueSyncOperation(syncOperation)

      // Process immediately if critical or if we're online
      if (priority === 'critical' || navigator.onLine) {
        const result = await this.processSyncOperation(syncOperation)

        if (result.success) {
          // Remove from queue on success
          this.removeSyncOperation(syncOperation.id)
        }

        return result
      }

      // Queue for later processing
      logger.info('Operation queued for offline sync', this.userId, undefined, {
        operationId: syncOperation.id,
        tableName,
        operation
      })

      return {
        success: true,
        operationId: syncOperation.id,
        conflictsDetected: 0,
        conflictsResolved: 0,
        metadata: { queued: true }
      }

    } catch (error) {
      logger.error('Failed to sync data operation', this.userId, undefined, {
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
  }

  /**
   * Process the sync queue
   */
  async processSyncQueue(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) {
      return
    }

    this.isSyncing = true

    try {
      logger.debug('Processing sync queue', this.userId, undefined, { queueSize: this.syncQueue.length })

      const batch = this.syncQueue
        .slice(0, this.configuration.syncBatchSize)
        .sort((a, b) => {
          const priorities = { critical: 0, high: 1, normal: 2, low: 3 }
          return priorities[a.priority] - priorities[b.priority]
        })

      let processed = 0
      let errors = 0
      let totalConflicts = 0

      for (const operation of batch) {
        try {
          this.eventHandlers.onSyncProgress?.({
            current: processed + 1,
            total: batch.length,
            operation: `${operation.operation} ${operation.tableName}`
          })

          const result = await this.processSyncOperation(operation)

          if (result.success) {
            processed++
            totalConflicts += result.conflictsDetected
            this.removeSyncOperation(operation.id)
          } else {
            errors++
            await this.handleFailedOperation(operation, result.error)
          }

        } catch (error) {
          errors++
          logger.error('Failed to process sync operation', this.userId, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error',
            operationId: operation.id
          })
          await this.handleFailedOperation(operation, error instanceof Error ? error.message : 'Unknown error')
        }
      }

      // Update stats
      this.syncStats.totalSynced += processed
      this.syncStats.errors += errors
      this.lastSyncTime = new Date().toISOString()

      // Persist queue changes
      await this.persistSyncQueue()

      // Emit completion event
      this.eventHandlers.onSyncComplete?.({
        synced: processed,
        conflicts: totalConflicts,
        errors
      })

      logger.info('Sync queue processing completed', this.userId, undefined, {
        processed,
        errors,
        conflicts: totalConflicts,
        remaining: this.syncQueue.length
      })

    } catch (error) {
      logger.error('Failed to process sync queue', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      queueSize: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      pendingConflicts: conflictResolutionService.getPendingConflicts().length,
      totalSynced: this.syncStats.totalSynced,
      errors: this.syncStats.errors
    }
  }

  /**
   * Force immediate sync of all queued operations
   */
  async forceSyncAll(): Promise<{ processed: number; failed: number; conflicts: number }> {
    if (!navigator.onLine) {
      throw new Error('Cannot force sync while offline')
    }

    const results = { processed: 0, failed: 0, conflicts: 0 }

    while (this.syncQueue.length > 0 && !this.isSyncing) {
      await this.processSyncQueue()

      // Count results
      const status = this.getSyncStatus()
      results.conflicts = status.pendingConflicts
      results.processed = this.syncStats.totalSynced
      results.failed = this.syncStats.errors
    }

    return results
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: Partial<CrossDeviceDataHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers }
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<DataSyncConfiguration>): void {
    this.configuration = { ...this.configuration, ...config }
    logger.info('Data sync configuration updated', this.userId, undefined, { config })
  }

  /**
   * Clear sync queue (emergency use only)
   */
  async clearSyncQueue(): Promise<void> {
    this.syncQueue = []
    await this.persistSyncQueue()
    logger.warn('Sync queue cleared manually', this.userId)
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.debug('Cleaning up cross-device data service')

    // Stop sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }

    // Process remaining queue items if online
    if (navigator.onLine && this.syncQueue.length > 0) {
      await this.processSyncQueue()
    }

    // Cleanup other services
    await realTimeSyncService.cleanup()
    await crossDeviceSessionService.cleanup()

    this.isInitialized = false

    logger.info('Cross-device data service cleanup completed')
  }

  // Private helper methods

  private async queueSyncOperation(operation: SyncOperation): Promise<void> {
    // Check queue size limit
    if (this.syncQueue.length >= this.configuration.maxQueueSize) {
      // Remove oldest low-priority operations
      this.syncQueue = this.syncQueue
        .filter(op => op.priority !== 'low')
        .slice(-this.configuration.maxQueueSize + 1)
      logger.warn('Sync queue full, removed old low-priority operations', this.userId)
    }

    this.syncQueue.push(operation)
    await this.persistSyncQueue()

    // Add to real-time sync queue if enabled
    if (this.configuration.enableRealTimeSync) {
      await realTimeSyncService.queueSyncEvent(
        `data_${operation.operation.toLowerCase()}`,
        {
          tableName: operation.tableName,
          recordId: operation.recordId,
          data: operation.data
        },
        operation.priority,
        operation.encrypted
      )
    }
  }

  private async processSyncOperation(operation: SyncOperation): Promise<SyncResult> {
    try {
      // Encrypt data if required
      let processedData = operation.data
      if (operation.encrypted && processedData) {
        processedData = await encryptionService.encryptData(JSON.stringify(processedData))
      }

      // Get existing data for conflict detection
      let existingData = null
      if (operation.operation === 'UPDATE') {
        existingData = await this.getExistingRecord(operation.tableName, operation.recordId)
      }

      // Detect conflicts if enabled
      let conflicts: any[] = []
      if (this.configuration.enableConflictResolution && existingData && operation.operation === 'UPDATE') {
        conflicts = await conflictResolutionService.detectConflict(
          operation.tableName,
          operation.recordId,
          existingData,
          operation.data,
          existingData.updated_at || existingData.created_at,
          operation.timestamp,
          'existing_device', // Would be retrieved from existing data
          operation.deviceId
        )

        if (conflicts.length > 0) {
          this.eventHandlers.onConflictDetected?.(conflicts)

          // Auto-resolve if enabled
          if (this.configuration.autoResolveConflicts) {
            for (const conflict of conflicts) {
              await conflictResolutionService.resolveConflict(conflict.id)
            }
          }
        }
      }

      // Execute the operation
      let success = false
      let error: string | undefined

      switch (operation.operation) {
        case 'CREATE':
          success = await this.executeCreate(operation.tableName, operation.recordId, processedData)
          break
        case 'UPDATE':
          success = await this.executeUpdate(operation.tableName, operation.recordId, processedData)
          break
        case 'DELETE':
          success = await this.executeDelete(operation.tableName, operation.recordId)
          break
      }

      if (success) {
        // Log audit event if required
        if (this.configuration.auditAllOperations) {
          await auditLogger.logSecurityEvent({
            action: `data_${operation.operation.toLowerCase()}`,
            resource: operation.tableName,
            resourceId: operation.recordId,
            userId: this.userId!,
            details: {
              deviceId: operation.deviceId,
              operation: operation.operation,
              encrypted: operation.encrypted,
              conflicts: conflicts.length
            },
            severity: conflicts.length > 0 ? 'medium' : 'low'
          })
        }

        // Emit data change event
        this.eventHandlers.onDataChange?.({
          tableName: operation.tableName,
          recordId: operation.recordId,
          operation: operation.operation,
          data: operation.data,
          timestamp: operation.timestamp,
          source: 'local',
          deviceId: operation.deviceId
        })
      }

      return {
        success,
        operationId: operation.id,
        conflictsDetected: conflicts.length,
        conflictsResolved: this.configuration.autoResolveConflicts ? conflicts.length : 0,
        error,
        metadata: {
          tableName: operation.tableName,
          operation: operation.operation,
          encrypted: operation.encrypted
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to process sync operation', this.userId, undefined, {
        error: errorMessage,
        operationId: operation.id
      })

      return {
        success: false,
        operationId: operation.id,
        conflictsDetected: 0,
        conflictsResolved: 0,
        error: errorMessage
      }
    }
  }

  private async handleFailedOperation(operation: SyncOperation, error?: string): Promise<void> {
    operation.retryCount++

    if (operation.retryCount <= operation.maxRetries) {
      // Exponential backoff
      const delay = Math.pow(2, operation.retryCount) * 1000
      setTimeout(() => {
        // Re-queue for retry
        const retryIndex = this.syncQueue.findIndex(op => op.id === operation.id)
        if (retryIndex === -1) {
          this.syncQueue.push(operation)
        }
      }, delay)

      logger.debug('Operation queued for retry', this.userId, undefined, {
        operationId: operation.id,
        retryCount: operation.retryCount,
        delay
      })
    } else {
      // Max retries exceeded
      this.removeSyncOperation(operation.id)

      this.eventHandlers.onSyncError?.({
        type: 'max_retries_exceeded',
        message: `Operation ${operation.id} failed after ${operation.maxRetries} retries`,
        details: { operation, error }
      })

      logger.error('Operation failed after max retries', this.userId, undefined, {
        operationId: operation.id,
        operation: operation.operation,
        tableName: operation.tableName,
        error
      })
    }
  }

  private removeSyncOperation(operationId: string): void {
    const index = this.syncQueue.findIndex(op => op.id === operationId)
    if (index !== -1) {
      this.syncQueue.splice(index, 1)
    }
  }

  private async getExistingRecord(tableName: string, recordId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', recordId)
        .single()

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to get existing record', this.userId, undefined, {
          error: error.message,
          tableName,
          recordId
        })
        return null
      }

      return data
    } catch (error) {
      logger.error('Error getting existing record', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName,
        recordId
      })
      return null
    }
  }

  private async executeCreate(tableName: string, recordId: string, data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(tableName)
        .insert({ id: recordId, ...data })

      if (error) {
        logger.error('Failed to execute CREATE operation', this.userId, undefined, {
          error: error.message,
          tableName,
          recordId
        })
        return false
      }

      return true
    } catch (error) {
      logger.error('Error executing CREATE operation', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName,
        recordId
      })
      return false
    }
  }

  private async executeUpdate(tableName: string, recordId: string, data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', recordId)

      if (error) {
        logger.error('Failed to execute UPDATE operation', this.userId, undefined, {
          error: error.message,
          tableName,
          recordId
        })
        return false
      }

      return true
    } catch (error) {
      logger.error('Error executing UPDATE operation', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName,
        recordId
      })
      return false
    }
  }

  private async executeDelete(tableName: string, recordId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId)

      if (error) {
        logger.error('Failed to execute DELETE operation', this.userId, undefined, {
          error: error.message,
          tableName,
          recordId
        })
        return false
      }

      return true
    } catch (error) {
      logger.error('Error executing DELETE operation', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName,
        recordId
      })
      return false
    }
  }

  private shouldEncryptTable(tableName: string): boolean {
    if (!this.configuration.encryptPHI) {
      return false
    }

    // Tables that typically contain PHI
    const phiTables = ['patients', 'medical_records', 'appointments', 'notes', 'calls', 'sms_messages']
    return phiTables.includes(tableName)
  }

  private setupRealTimeSyncHandlers(): void {
    realTimeSyncService.setEventHandlers({
      onSyncEvent: async (event) => {
        // Handle incoming sync events from other devices
        if (event.type.startsWith('data_')) {
          this.eventHandlers.onDataChange?.({
            tableName: event.data.tableName,
            recordId: event.data.recordId,
            operation: event.type.includes('create') ? 'CREATE' :
                      event.type.includes('update') ? 'UPDATE' : 'DELETE',
            data: event.data.data,
            timestamp: event.timestamp,
            source: 'remote',
            deviceId: event.source
          })
        }
      },
      onConnectionChange: (state) => {
        logger.debug('Real-time connection state changed', this.userId, undefined, {
          isConnected: state.isConnected,
          isOnline: state.isOnline
        })
      },
      onError: (error) => {
        this.eventHandlers.onSyncError?.(error)
      }
    })
  }

  private startSyncInterval(): void {
    // Process sync queue every 30 seconds
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine && this.syncQueue.length > 0 && !this.isSyncing) {
        await this.processSyncQueue()
      }
    }, 30000)
  }

  private async persistSyncQueue(): Promise<void> {
    try {
      if (this.userId) {
        const queueData = JSON.stringify(this.syncQueue)
        await secureStorage.setItem(`cross_device_sync_queue_${this.userId}`, queueData)
      }
    } catch (error) {
      logger.warn('Failed to persist sync queue', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      if (this.userId) {
        const queueData = await secureStorage.getItem(`cross_device_sync_queue_${this.userId}`)
        if (queueData) {
          this.syncQueue = JSON.parse(queueData) || []
          logger.debug('Loaded sync queue from storage', this.userId, undefined, {
            queueSize: this.syncQueue.length
          })
        }
      }
    } catch (error) {
      logger.warn('Failed to load sync queue', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      this.syncQueue = []
    }
  }
}

// Export singleton instance
export const crossDeviceDataService = new CrossDeviceDataService()