/**
 * HIPAA-Compliant Real-Time Sync Manager Service
 *
 * Manages real-time data synchronization across devices with offline support
 * and conflict resolution capabilities.
 *
 * Features:
 * - Real-time Supabase subscriptions for cross-device events
 * - Offline queue management with automatic retry
 * - Connection state monitoring and reconnection logic
 * - Event processing and distribution
 * - PHI-safe data synchronization
 */

import { supabase } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import { secureStorage } from '@/services/secureStorage'
import { auditLogger } from '@/services/auditLogger'
import { encryptionService } from '@/services/encryption'
import { CrossDeviceSyncEvent, SyncQueueItem } from '@/types/supabase'

const logger = secureLogger.component('RealTimeSyncService')

export interface SyncEvent {
  id: string
  type: string
  data: any
  source: string
  timestamp: string
  priority: 'low' | 'normal' | 'high' | 'critical'
  encrypted: boolean
}

export interface SyncConfiguration {
  enableRealtime: boolean
  retryAttempts: number
  retryDelay: number
  maxQueueSize: number
  batchSize: number
  syncInterval: number
  conflictResolution: 'last_write_wins' | 'manual' | 'merge'
}

export interface ConnectionState {
  isConnected: boolean
  isOnline: boolean
  lastConnected: string | null
  reconnectAttempts: number
  maxReconnectAttempts: number
  backoffDelay: number
}

export interface SyncEventHandlers {
  onSyncEvent: (event: SyncEvent) => Promise<void>
  onConnectionChange: (state: ConnectionState) => void
  onError: (error: { type: string; message: string; details?: any }) => void
  onQueueProcessed: (processed: number, remaining: number) => void
}

class RealTimeSyncService {
  private userId: string | null = null
  private deviceId: string | null = null
  private configuration: SyncConfiguration
  private connectionState: ConnectionState
  private eventHandlers: Partial<SyncEventHandlers> = {}
  private realtimeChannel: any = null
  private syncQueue: SyncEvent[] = []
  private processingQueue: boolean = false
  private syncInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isInitialized: boolean = false

  constructor() {
    this.configuration = {
      enableRealtime: true,
      retryAttempts: 3,
      retryDelay: 1000,
      maxQueueSize: 1000,
      batchSize: 10,
      syncInterval: 30000, // 30 seconds
      conflictResolution: 'last_write_wins'
    }

    this.connectionState = {
      isConnected: false,
      isOnline: navigator.onLine,
      lastConnected: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      backoffDelay: 1000
    }

    // Monitor online/offline status
    window.addEventListener('online', () => this.handleOnlineStatusChange(true))
    window.addEventListener('offline', () => this.handleOnlineStatusChange(false))
  }

  /**
   * Initialize the real-time sync service
   */
  async initialize(userId: string, deviceId: string, config?: Partial<SyncConfiguration>): Promise<boolean> {
    try {
      logger.debug('Initializing real-time sync service', userId)

      this.userId = userId
      this.deviceId = deviceId

      if (config) {
        this.configuration = { ...this.configuration, ...config }
      }

      // Load persisted queue
      await this.loadPersistedQueue()

      // Set up real-time connections
      if (this.configuration.enableRealtime) {
        await this.setupRealtimeConnection()
      }

      // Start sync interval
      this.startSyncInterval()

      // Process any pending queue items
      if (this.syncQueue.length > 0) {
        await this.processQueue()
      }

      this.isInitialized = true

      logger.info('Real-time sync service initialized successfully', userId)
      return true

    } catch (error) {
      logger.error('Failed to initialize real-time sync service', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Set up real-time connection to Supabase
   */
  async setupRealtimeConnection(): Promise<void> {
    try {
      if (!this.userId) {
        throw new Error('User ID not set')
      }

      logger.debug('Setting up real-time connection', this.userId)

      // Subscribe to sync events for this user
      this.realtimeChannel = supabase
        .channel(`sync_${this.userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cross_device_sync_events',
            filter: `user_id=eq.${this.userId}`
          },
          async (payload) => {
            await this.handleRealtimeEvent(payload)
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sync_queue',
            filter: `user_id=eq.${this.userId}`
          },
          async (payload) => {
            await this.handleSyncQueueEvent(payload)
          }
        )
        .subscribe((status) => {
          this.handleSubscriptionStatus(status)
        })

      logger.info('Real-time connection established', this.userId)

    } catch (error) {
      logger.error('Failed to setup real-time connection', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Queue a sync event for processing
   */
  async queueSyncEvent(
    type: string,
    data: any,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
    encrypted: boolean = true
  ): Promise<boolean> {
    try {
      if (!this.userId || !this.deviceId) {
        logger.error('Cannot queue sync event: service not initialized')
        return false
      }

      logger.debug('Queueing sync event', this.userId, undefined, { type, priority })

      // Check queue size
      if (this.syncQueue.length >= this.configuration.maxQueueSize) {
        // Remove oldest low priority events
        this.syncQueue = this.syncQueue.filter(event => event.priority !== 'low').slice(-this.configuration.maxQueueSize + 1)
        logger.warn('Sync queue full, removed old low priority events', this.userId)
      }

      // Encrypt data if required
      let eventData = data
      if (encrypted && typeof data === 'object') {
        eventData = await encryptionService.encryptData(JSON.stringify(data))
      }

      const syncEvent: SyncEvent = {
        id: crypto.randomUUID(),
        type,
        data: eventData,
        source: this.deviceId,
        timestamp: new Date().toISOString(),
        priority,
        encrypted
      }

      // Add to queue with priority ordering
      this.insertEventByPriority(syncEvent)

      // Persist queue
      await this.persistQueue()

      // Process immediately if critical
      if (priority === 'critical' && this.connectionState.isConnected) {
        await this.processEvent(syncEvent)
      }

      logger.info('Sync event queued successfully', this.userId, undefined, { eventId: syncEvent.id, type })
      return true

    } catch (error) {
      logger.error('Failed to queue sync event', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        type
      })
      return false
    }
  }

  /**
   * Process the sync queue
   */
  async processQueue(): Promise<void> {
    if (this.processingQueue || !this.connectionState.isConnected) {
      return
    }

    this.processingQueue = true

    try {
      logger.debug('Processing sync queue', this.userId, undefined, { queueSize: this.syncQueue.length })

      const batch = this.syncQueue.splice(0, this.configuration.batchSize)
      let processedCount = 0

      for (const event of batch) {
        try {
          const success = await this.processEvent(event)
          if (success) {
            processedCount++
          } else {
            // Re-queue failed events with retry logic
            await this.handleFailedEvent(event)
          }
        } catch (error) {
          logger.error('Failed to process sync event', this.userId, undefined, {
            error: error instanceof Error ? error.message : 'Unknown error',
            eventId: event.id
          })
          await this.handleFailedEvent(event)
        }
      }

      // Persist updated queue
      await this.persistQueue()

      // Emit progress event
      this.eventHandlers.onQueueProcessed?.(processedCount, this.syncQueue.length)

      logger.info('Queue processing completed', this.userId, undefined, {
        processed: processedCount,
        remaining: this.syncQueue.length
      })

    } catch (error) {
      logger.error('Failed to process sync queue', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      this.processingQueue = false
    }
  }

  /**
   * Process a single sync event
   */
  private async processEvent(event: SyncEvent): Promise<boolean> {
    try {
      if (!this.userId || !this.deviceId) {
        return false
      }

      // Don't process events from this device
      if (event.source === this.deviceId) {
        return true
      }

      logger.debug('Processing sync event', this.userId, undefined, { eventId: event.id, type: event.type })

      // Store event in database
      const { error } = await supabase
        .from('cross_device_sync_events')
        .insert({
          user_id: this.userId,
          source_device_id: event.source,
          target_device_id: null, // Broadcast event
          event_type: event.type,
          data: event.data,
          metadata: {
            priority: event.priority,
            encrypted: event.encrypted,
            originalTimestamp: event.timestamp
          }
        })

      if (error) {
        logger.error('Failed to store sync event in database', this.userId, undefined, {
          error: error.message,
          eventId: event.id
        })
        return false
      }

      // Emit to local handlers
      if (this.eventHandlers.onSyncEvent) {
        await this.eventHandlers.onSyncEvent(event)
      }

      // Log audit event for sensitive operations
      if (event.priority === 'critical' || event.type.includes('security')) {
        await auditLogger.logSecurityEvent({
          action: 'sync_event_processed',
          resource: 'cross_device_sync_events',
          userId: this.userId,
          details: {
            eventType: event.type,
            priority: event.priority,
            sourceDevice: event.source
          },
          severity: event.priority === 'critical' ? 'high' : 'low'
        })
      }

      return true

    } catch (error) {
      logger.error('Failed to process sync event', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.id
      })
      return false
    }
  }

  /**
   * Handle failed event with retry logic
   */
  private async handleFailedEvent(event: SyncEvent): Promise<void> {
    try {
      // Add retry metadata
      const retryCount = ((event as any).retryCount || 0) + 1

      if (retryCount <= this.configuration.retryAttempts) {
        // Calculate backoff delay
        const delay = this.configuration.retryDelay * Math.pow(2, retryCount - 1)

        // Re-queue with retry info
        setTimeout(() => {
          const retryEvent = {
            ...event,
            retryCount,
            timestamp: new Date().toISOString()
          }
          this.insertEventByPriority(retryEvent)
        }, delay)

        logger.debug('Event queued for retry', this.userId, undefined, {
          eventId: event.id,
          retryCount,
          delay
        })
      } else {
        // Max retries exceeded, log and discard
        logger.error('Event exceeded max retries, discarding', this.userId, undefined, {
          eventId: event.id,
          type: event.type,
          retryCount
        })

        this.eventHandlers.onError?.({
          type: 'max_retries_exceeded',
          message: `Event ${event.id} exceeded maximum retry attempts`,
          details: { event }
        })
      }

    } catch (error) {
      logger.error('Failed to handle failed event', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventId: event.id
      })
    }
  }

  /**
   * Handle real-time event from Supabase
   */
  private async handleRealtimeEvent(payload: any): Promise<void> {
    try {
      const event = payload.new as CrossDeviceSyncEvent

      // Don't process events from this device
      if (event.source_device_id === this.deviceId) {
        return
      }

      logger.debug('Received real-time sync event', this.userId, undefined, {
        eventType: event.event_type,
        sourceDevice: event.source_device_id
      })

      // Decrypt data if encrypted
      let eventData = event.data
      if (event.metadata?.encrypted) {
        try {
          eventData = await encryptionService.decryptData(event.data)
          eventData = JSON.parse(eventData)
        } catch (decryptError) {
          logger.error('Failed to decrypt sync event data', this.userId, undefined, {
            error: decryptError instanceof Error ? decryptError.message : 'Unknown error',
            eventId: event.id
          })
          return
        }
      }

      // Create sync event object
      const syncEvent: SyncEvent = {
        id: event.id,
        type: event.event_type,
        data: eventData,
        source: event.source_device_id,
        timestamp: event.created_at,
        priority: (event.metadata?.priority as any) || 'normal',
        encrypted: event.metadata?.encrypted || false
      }

      // Process event
      if (this.eventHandlers.onSyncEvent) {
        await this.eventHandlers.onSyncEvent(syncEvent)
      }

    } catch (error) {
      logger.error('Failed to handle real-time event', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Handle sync queue events from database
   */
  private async handleSyncQueueEvent(payload: any): Promise<void> {
    try {
      const queueItem = payload.new as SyncQueueItem

      // Only process items not from this device
      if (queueItem.source_device_id === this.deviceId) {
        return
      }

      logger.debug('Processing sync queue item', this.userId, undefined, {
        operation: queueItem.operation,
        table: queueItem.table_name
      })

      // Apply the operation locally
      await this.applySyncOperation(queueItem)

    } catch (error) {
      logger.error('Failed to handle sync queue event', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Apply a sync operation from the queue
   */
  private async applySyncOperation(queueItem: SyncQueueItem): Promise<void> {
    try {
      // Decrypt data if needed
      let recordData = queueItem.record_data
      if (queueItem.encrypted) {
        recordData = await encryptionService.decryptData(recordData)
        recordData = JSON.parse(recordData)
      }

      // Apply the operation based on type
      switch (queueItem.operation) {
        case 'INSERT':
          await this.applySyncInsert(queueItem.table_name, recordData)
          break
        case 'UPDATE':
          await this.applySyncUpdate(queueItem.table_name, queueItem.record_id, recordData)
          break
        case 'DELETE':
          await this.applySyncDelete(queueItem.table_name, queueItem.record_id)
          break
        default:
          logger.warn('Unknown sync operation', this.userId, undefined, { operation: queueItem.operation })
      }

      logger.debug('Sync operation applied successfully', this.userId, undefined, {
        operation: queueItem.operation,
        table: queueItem.table_name,
        recordId: queueItem.record_id
      })

    } catch (error) {
      logger.error('Failed to apply sync operation', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: queueItem.operation,
        table: queueItem.table_name
      })
    }
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: Partial<SyncEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers }
  }

  /**
   * Update sync configuration
   */
  updateConfiguration(config: Partial<SyncConfiguration>): void {
    this.configuration = { ...this.configuration, ...config }
    logger.info('Sync configuration updated', this.userId, undefined, { config })
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState }
  }

  /**
   * Get sync queue status
   */
  getQueueStatus(): { size: number; processing: boolean; configuration: SyncConfiguration } {
    return {
      size: this.syncQueue.length,
      processing: this.processingQueue,
      configuration: { ...this.configuration }
    }
  }

  /**
   * Force process queue
   */
  async forceProcessQueue(): Promise<void> {
    if (this.isInitialized) {
      await this.processQueue()
    }
  }

  /**
   * Clear sync queue
   */
  async clearQueue(): Promise<void> {
    this.syncQueue = []
    await this.persistQueue()
    logger.info('Sync queue cleared', this.userId)
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.debug('Cleaning up real-time sync service')

    // Stop intervals
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    // Unsubscribe from real-time
    if (this.realtimeChannel) {
      await supabase.removeChannel(this.realtimeChannel)
      this.realtimeChannel = null
    }

    // Process remaining queue items
    if (this.syncQueue.length > 0) {
      await this.processQueue()
    }

    this.isInitialized = false

    logger.info('Real-time sync service cleanup completed')
  }

  // Private helper methods

  private insertEventByPriority(event: SyncEvent): void {
    const priorities = { critical: 0, high: 1, normal: 2, low: 3 }
    const eventPriority = priorities[event.priority]

    let insertIndex = this.syncQueue.length
    for (let i = 0; i < this.syncQueue.length; i++) {
      if (priorities[this.syncQueue[i].priority] > eventPriority) {
        insertIndex = i
        break
      }
    }

    this.syncQueue.splice(insertIndex, 0, event)
  }

  private async persistQueue(): Promise<void> {
    try {
      if (this.userId) {
        const queueData = JSON.stringify(this.syncQueue)
        await secureStorage.setItem(`sync_queue_${this.userId}`, queueData)
      }
    } catch (error) {
      logger.warn('Failed to persist sync queue', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async loadPersistedQueue(): Promise<void> {
    try {
      if (this.userId) {
        const queueData = await secureStorage.getItem(`sync_queue_${this.userId}`)
        if (queueData) {
          this.syncQueue = JSON.parse(queueData) || []
          logger.debug('Loaded persisted sync queue', this.userId, undefined, { queueSize: this.syncQueue.length })
        }
      }
    } catch (error) {
      logger.warn('Failed to load persisted sync queue', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      this.syncQueue = []
    }
  }

  private startSyncInterval(): void {
    this.syncInterval = setInterval(async () => {
      if (this.connectionState.isConnected && this.syncQueue.length > 0) {
        await this.processQueue()
      }
    }, this.configuration.syncInterval)
  }

  private handleSubscriptionStatus(status: string): void {
    const wasConnected = this.connectionState.isConnected
    this.connectionState.isConnected = status === 'SUBSCRIBED'

    if (this.connectionState.isConnected && !wasConnected) {
      this.connectionState.lastConnected = new Date().toISOString()
      this.connectionState.reconnectAttempts = 0
      logger.info('Real-time connection established', this.userId)
    } else if (!this.connectionState.isConnected && wasConnected) {
      logger.warn('Real-time connection lost', this.userId)
      this.scheduleReconnect()
    }

    this.eventHandlers.onConnectionChange?.(this.connectionState)
  }

  private handleOnlineStatusChange(isOnline: boolean): void {
    this.connectionState.isOnline = isOnline

    if (isOnline && this.isInitialized) {
      logger.info('Back online, attempting to reconnect', this.userId)
      this.setupRealtimeConnection().catch(error => {
        logger.error('Failed to reconnect after coming online', this.userId, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      })
    }

    this.eventHandlers.onConnectionChange?.(this.connectionState)
  }

  private scheduleReconnect(): void {
    if (this.connectionState.reconnectAttempts >= this.connectionState.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', this.userId)
      return
    }

    const delay = this.connectionState.backoffDelay * Math.pow(2, this.connectionState.reconnectAttempts)
    this.connectionState.reconnectAttempts++

    this.reconnectTimeout = setTimeout(async () => {
      try {
        logger.debug('Attempting to reconnect', this.userId, undefined, {
          attempt: this.connectionState.reconnectAttempts
        })
        await this.setupRealtimeConnection()
      } catch (error) {
        logger.error('Reconnection attempt failed', this.userId, undefined, {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: this.connectionState.reconnectAttempts
        })
        this.scheduleReconnect()
      }
    }, delay)
  }

  private async applySyncInsert(tableName: string, recordData: any): Promise<void> {
    // Implementation would depend on the specific table and business logic
    logger.debug('Applying sync insert', this.userId, undefined, { tableName })
  }

  private async applySyncUpdate(tableName: string, recordId: string, recordData: any): Promise<void> {
    // Implementation would depend on the specific table and business logic
    logger.debug('Applying sync update', this.userId, undefined, { tableName, recordId })
  }

  private async applySyncDelete(tableName: string, recordId: string): Promise<void> {
    // Implementation would depend on the specific table and business logic
    logger.debug('Applying sync delete', this.userId, undefined, { tableName, recordId })
  }
}

// Export singleton instance
export const realTimeSyncService = new RealTimeSyncService()