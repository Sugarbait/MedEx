/**
 * MFA Sync Service - Handles cloud synchronization of MFA settings across devices
 * Provides graceful offline handling and smart retry logic
 */

import { encryptPHI, decryptPHI } from '../utils/encryption'

export interface MFAConfiguration {
  userId: string
  secret: string
  backupCodes: string[]
  enabled: boolean
  deviceId: string
  timestamp: number
  syncVersion: number
}

export interface SyncStatus {
  isOnline: boolean
  lastSyncTime: Date | null
  syncVersion: number
  pendingChanges: boolean
  conflictResolution: 'local' | 'remote' | 'manual'
  error: string | null
}

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  userAgent: string
  lastSeen: Date
  isOnline: boolean
  mfaEnabled: boolean
  syncVersion: number
}

export interface SyncQueueItem {
  id: string
  action: 'enable' | 'disable' | 'update'
  data: Partial<MFAConfiguration>
  timestamp: number
  retryCount: number
  priority: 'high' | 'normal' | 'low'
}

class MFASyncService {
  private syncQueue: SyncQueueItem[] = []
  private isOnline: boolean = navigator.onLine
  private syncInProgress: boolean = false
  private syncEventListeners: ((status: SyncStatus) => void)[] = []
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private maxRetryAttempts = 5
  private baseRetryDelay = 1000 // 1 second
  private maxRetryDelay = 30000 // 30 seconds

  constructor() {
    this.initializeNetworkMonitoring()
    this.loadQueueFromStorage()

    // Start periodic sync check
    setInterval(() => this.processQueue(), 30000) // Every 30 seconds
  }

  private initializeNetworkMonitoring() {
    window.addEventListener('online', () => {
      console.log('🌐 Network connection restored - resuming MFA sync')
      this.isOnline = true
      this.processQueue()
      this.notifyListeners()
    })

    window.addEventListener('offline', () => {
      console.log('🌐 Network connection lost - MFA sync will queue changes')
      this.isOnline = false
      this.notifyListeners()
    })

    // Monitor slow connections
    if ('connection' in navigator) {
      (navigator as any).connection.addEventListener('change', () => {
        const connection = (navigator as any).connection
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          console.log('🌐 Slow connection detected - adjusting sync strategy')
        }
      })
    }
  }

  /**
   * Enable MFA for a user with cloud sync
   */
  async enableMFA(userId: string, secret: string, backupCodes: string[]): Promise<{
    success: boolean
    error?: string
    queuedForSync?: boolean
  }> {
    try {
      const deviceId = this.getDeviceId()
      const mfaConfig: MFAConfiguration = {
        userId,
        secret,
        backupCodes,
        enabled: true,
        deviceId,
        timestamp: Date.now(),
        syncVersion: 1
      }

      // Always save locally first (offline-first approach)
      await this.saveMFAConfigLocal(mfaConfig)

      // If online, try to sync immediately
      if (this.isOnline) {
        try {
          await this.syncToCloud(mfaConfig)
          return { success: true }
        } catch (error) {
          console.warn('Cloud sync failed, queuing for later:', error)
          // Continue to queue for sync
        }
      }

      // Queue for sync when online
      this.addToSyncQueue({
        id: `enable-${userId}-${Date.now()}`,
        action: 'enable',
        data: mfaConfig,
        timestamp: Date.now(),
        retryCount: 0,
        priority: 'high'
      })

      return {
        success: true,
        queuedForSync: true,
        error: this.isOnline ? undefined : 'Offline - changes will sync when connection is restored'
      }
    } catch (error) {
      console.error('Failed to enable MFA:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable MFA'
      }
    }
  }

  /**
   * Disable MFA for a user with cloud sync
   */
  async disableMFA(userId: string): Promise<{
    success: boolean
    error?: string
    queuedForSync?: boolean
  }> {
    try {
      // Remove local configuration
      await this.removeMFAConfigLocal(userId)

      // If online, try to sync immediately
      if (this.isOnline) {
        try {
          await this.removeFromCloud(userId)
          return { success: true }
        } catch (error) {
          console.warn('Cloud sync failed, queuing for later:', error)
        }
      }

      // Queue for sync
      this.addToSyncQueue({
        id: `disable-${userId}-${Date.now()}`,
        action: 'disable',
        data: { userId, enabled: false },
        timestamp: Date.now(),
        retryCount: 0,
        priority: 'high'
      })

      return {
        success: true,
        queuedForSync: true,
        error: this.isOnline ? undefined : 'Offline - changes will sync when connection is restored'
      }
    } catch (error) {
      console.error('Failed to disable MFA:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable MFA'
      }
    }
  }

  /**
   * Get MFA configuration with sync status
   */
  async getMFAConfig(userId: string): Promise<{
    config: MFAConfiguration | null
    syncStatus: SyncStatus
  }> {
    try {
      // Try to get from local storage first
      const localConfig = await this.getMFAConfigLocal(userId)

      // Get sync status
      const syncStatus = await this.getSyncStatus(userId)

      // If online and sync is needed, try to sync
      if (this.isOnline && syncStatus.pendingChanges) {
        try {
          const cloudConfig = await this.getFromCloud(userId)
          if (cloudConfig && cloudConfig.syncVersion > (localConfig?.syncVersion || 0)) {
            // Cloud version is newer, update local
            await this.saveMFAConfigLocal(cloudConfig)
            return { config: cloudConfig, syncStatus }
          }
        } catch (error) {
          console.warn('Failed to sync from cloud:', error)
        }
      }

      return { config: localConfig, syncStatus }
    } catch (error) {
      console.error('Failed to get MFA config:', error)
      return {
        config: null,
        syncStatus: {
          isOnline: this.isOnline,
          lastSyncTime: null,
          syncVersion: 0,
          pendingChanges: false,
          conflictResolution: 'local',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  /**
   * Force sync MFA configuration
   */
  async forceSyncMFA(userId: string): Promise<{
    success: boolean
    error?: string
    conflictsResolved?: number
  }> {
    if (!this.isOnline) {
      return {
        success: false,
        error: 'Cannot sync while offline'
      }
    }

    try {
      this.syncInProgress = true
      this.notifyListeners()

      const localConfig = await this.getMFAConfigLocal(userId)
      const cloudConfig = await this.getFromCloud(userId)

      let conflictsResolved = 0

      if (localConfig && cloudConfig) {
        // Handle conflicts
        if (localConfig.syncVersion !== cloudConfig.syncVersion) {
          conflictsResolved++

          // Use timestamp to determine which is newer
          const winningConfig = localConfig.timestamp > cloudConfig.timestamp ? localConfig : cloudConfig

          // Update both local and cloud with winning config
          winningConfig.syncVersion = Math.max(localConfig.syncVersion, cloudConfig.syncVersion) + 1

          await this.saveMFAConfigLocal(winningConfig)
          await this.syncToCloud(winningConfig)
        }
      } else if (localConfig) {
        // Only local config exists, sync to cloud
        await this.syncToCloud(localConfig)
      } else if (cloudConfig) {
        // Only cloud config exists, sync to local
        await this.saveMFAConfigLocal(cloudConfig)
      }

      // Process any queued items
      await this.processQueue()

      return {
        success: true,
        conflictsResolved
      }
    } catch (error) {
      console.error('Force sync failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      }
    } finally {
      this.syncInProgress = false
      this.notifyListeners()
    }
  }

  /**
   * Get list of devices with MFA configured
   */
  async getDevicesWithMFA(userId: string): Promise<DeviceInfo[]> {
    try {
      if (!this.isOnline) {
        // Return only current device when offline
        return [{
          deviceId: this.getDeviceId(),
          deviceName: this.getDeviceName(),
          deviceType: this.getDeviceType(),
          userAgent: navigator.userAgent,
          lastSeen: new Date(),
          isOnline: false,
          mfaEnabled: !!(await this.getMFAConfigLocal(userId)),
          syncVersion: 0
        }]
      }

      // In a real implementation, this would fetch from your device management API
      // For now, return mock data
      return [
        {
          deviceId: this.getDeviceId(),
          deviceName: this.getDeviceName(),
          deviceType: this.getDeviceType(),
          userAgent: navigator.userAgent,
          lastSeen: new Date(),
          isOnline: true,
          mfaEnabled: true,
          syncVersion: 1
        },
        // Removed fake iPhone device - only show real devices
      ]
    } catch (error) {
      console.error('Failed to get devices:', error)
      return []
    }
  }

  /**
   * Subscribe to sync status changes
   */
  subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
    this.syncEventListeners.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.syncEventListeners.indexOf(callback)
      if (index > -1) {
        this.syncEventListeners.splice(index, 1)
      }
    }
  }

  private async processQueue() {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return
    }

    console.log(`📋 Processing MFA sync queue (${this.syncQueue.length} items)`)
    this.syncInProgress = true
    this.notifyListeners()

    // Sort by priority and timestamp
    this.syncQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.timestamp - b.timestamp
    })

    const processedItems: string[] = []

    for (const item of [...this.syncQueue]) {
      try {
        await this.processSyncItem(item)
        processedItems.push(item.id)
        console.log(`✅ Successfully synced: ${item.action} for ${item.data.userId}`)
      } catch (error) {
        console.error(`❌ Failed to sync item ${item.id}:`, error)

        // Implement exponential backoff
        item.retryCount++
        if (item.retryCount < this.maxRetryAttempts) {
          const delay = Math.min(
            this.baseRetryDelay * Math.pow(2, item.retryCount),
            this.maxRetryDelay
          )

          console.log(`⏰ Scheduling retry for ${item.id} in ${delay}ms (attempt ${item.retryCount + 1})`)

          // Schedule retry
          const timeoutId = setTimeout(() => {
            console.log(`🔄 Retrying sync item: ${item.id}`)
            this.processQueue()
          }, delay)

          this.retryTimeouts.set(item.id, timeoutId)
        } else {
          console.error(`💥 Max retries exceeded for item ${item.id}, removing from queue`)
          processedItems.push(item.id)
        }
      }
    }

    // Remove processed items from queue
    this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id))
    this.saveQueueToStorage()

    this.syncInProgress = false
    this.notifyListeners()
  }

  private async processSyncItem(item: SyncQueueItem) {
    switch (item.action) {
      case 'enable':
      case 'update':
        if (item.data.userId && item.data.secret) {
          await this.syncToCloud(item.data as MFAConfiguration)
        }
        break
      case 'disable':
        if (item.data.userId) {
          await this.removeFromCloud(item.data.userId)
        }
        break
      default:
        throw new Error(`Unknown sync action: ${item.action}`)
    }
  }

  private addToSyncQueue(item: SyncQueueItem) {
    // Remove any existing items for the same user/action to avoid duplicates
    this.syncQueue = this.syncQueue.filter(
      existing => !(existing.data.userId === item.data.userId && existing.action === item.action)
    )

    this.syncQueue.push(item)
    this.saveQueueToStorage()

    console.log(`📋 Added to sync queue: ${item.action} for ${item.data.userId}`)
  }

  private notifyListeners() {
    const status: SyncStatus = {
      isOnline: this.isOnline,
      lastSyncTime: this.getLastSyncTime(),
      syncVersion: 1,
      pendingChanges: this.syncQueue.length > 0,
      conflictResolution: 'local',
      error: null
    }

    this.syncEventListeners.forEach(listener => {
      try {
        listener(status)
      } catch (error) {
        console.error('Error notifying sync listener:', error)
      }
    })
  }

  private async getSyncStatus(userId: string): Promise<SyncStatus> {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.getLastSyncTime(),
      syncVersion: 1,
      pendingChanges: this.syncQueue.some(item => item.data.userId === userId),
      conflictResolution: 'local',
      error: null
    }
  }

  private getLastSyncTime(): Date | null {
    const lastSync = localStorage.getItem('mfa_last_sync')
    return lastSync ? new Date(parseInt(lastSync)) : null
  }

  private setLastSyncTime(time: Date) {
    localStorage.setItem('mfa_last_sync', time.getTime().toString())
  }

  // Local storage operations
  private async saveMFAConfigLocal(config: MFAConfiguration): Promise<void> {
    const encryptedConfig = encryptPHI(JSON.stringify(config))
    localStorage.setItem(`mfa_config_${config.userId}`, encryptedConfig)
  }

  private async getMFAConfigLocal(userId: string): Promise<MFAConfiguration | null> {
    try {
      const encryptedConfig = localStorage.getItem(`mfa_config_${userId}`)
      if (!encryptedConfig) return null

      const decryptedConfig = decryptPHI(encryptedConfig)
      return JSON.parse(decryptedConfig)
    } catch (error) {
      console.error('Failed to get local MFA config:', error)
      return null
    }
  }

  private async removeMFAConfigLocal(userId: string): Promise<void> {
    localStorage.removeItem(`mfa_config_${userId}`)
  }

  // Cloud sync operations (mock implementation)
  private async syncToCloud(config: MFAConfiguration): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

    // Simulate occasional failures
    if (Math.random() < 0.1) {
      throw new Error('Network timeout')
    }

    console.log(`☁️ Synced MFA config to cloud for user: ${config.userId}`)
    this.setLastSyncTime(new Date())
  }

  private async removeFromCloud(userId: string): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000))

    console.log(`☁️ Removed MFA config from cloud for user: ${userId}`)
    this.setLastSyncTime(new Date())
  }

  private async getFromCloud(userId: string): Promise<MFAConfiguration | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

    // For demo purposes, return null (no cloud config)
    return null
  }

  // Queue persistence
  private saveQueueToStorage() {
    try {
      localStorage.setItem('mfa_sync_queue', JSON.stringify(this.syncQueue))
    } catch (error) {
      console.error('Failed to save sync queue:', error)
    }
  }

  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem('mfa_sync_queue')
      if (stored) {
        this.syncQueue = JSON.parse(stored)
        console.log(`📋 Loaded ${this.syncQueue.length} items from sync queue`)
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error)
      this.syncQueue = []
    }
  }

  // Device identification
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id')
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('device_id', deviceId)
    }
    return deviceId
  }

  private getDeviceName(): string {
    const ua = navigator.userAgent
    if (/iPhone/.test(ua)) return 'iPhone'
    if (/iPad/.test(ua)) return 'iPad'
    if (/Android/.test(ua)) return 'Android Device'
    if (/Windows/.test(ua)) return 'Windows PC'
    if (/Mac/.test(ua)) return 'Mac'
    if (/Linux/.test(ua)) return 'Linux PC'
    return 'Unknown Device'
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const ua = navigator.userAgent
    if (/iPad/.test(ua)) return 'tablet'
    if (/iPhone|Android.*Mobile/.test(ua)) return 'mobile'
    return 'desktop'
  }
}

// Export singleton instance
export const mfaSyncService = new MFASyncService()
export default mfaSyncService