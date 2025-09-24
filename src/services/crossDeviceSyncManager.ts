/**
 * Cross-Device Sync Manager
 *
 * Central orchestrator for all cross-device synchronization activities.
 * Handles login triggers, real-time sync coordination, and integration
 * between userSettingsService, userProfileService, and conflict resolution.
 */

import { supabase, supabaseConfig } from '@/config/supabase'
import { Database } from '@/types/supabase'
import { auditLogger } from './auditLogger'
import { userSettingsService } from './userSettingsService'
import { userProfileService } from './userProfileService'
import { conflictResolver } from './crossDeviceConflictResolver'
import { secureTotpService } from './secureTotpService'

export interface SyncSession {
  userId: string
  deviceId: string
  sessionToken: string
  startedAt: string
  lastActivity: string
  syncEnabled: boolean
  mfaVerified: boolean
  securityLevel: 'low' | 'standard' | 'high' | 'critical'
}

export interface SyncStatus {
  isOnline: boolean
  lastSync: string | null
  pendingOperations: number
  connectedDevices: number
  conflictCount: number
  syncHealth: 'healthy' | 'warning' | 'error' | 'offline'
}

export interface SyncTriggerEvent {
  trigger: 'login' | 'logout' | 'settings_change' | 'profile_update' | 'mfa_change' | 'manual' | 'periodic'
  userId: string
  deviceId: string
  data?: any
  timestamp: string
}

class CrossDeviceSyncManager {
  private activeSessions = new Map<string, SyncSession>()
  private syncStatus = new Map<string, SyncStatus>()
  private periodicSyncIntervals = new Map<string, number>()
  private eventListeners = new Map<string, ((event: SyncTriggerEvent) => void)[]>()
  private isInitialized = false
  private currentUserId: string | null = null
  private currentDeviceId: string | null = null

  /**
   * Initialize cross-device sync for a user session
   */
  async initializeSync(userId: string, options?: {
    deviceId?: string,
    mfaVerified?: boolean,
    securityLevel?: 'low' | 'standard' | 'high' | 'critical',
    enablePeriodicSync?: boolean,
    syncInterval?: number
  }): Promise<{ success: boolean; session: SyncSession | null; message?: string }> {
    try {
      console.log(`🚀 SYNC MANAGER: Initializing cross-device sync for user ${userId}`)

      this.currentUserId = userId
      const deviceId = options?.deviceId || this.generateDeviceId()
      this.currentDeviceId = deviceId

      // Initialize settings service
      const settingsInit = await userSettingsService.initializeCrossDeviceSync(userId, deviceId)
      if (!settingsInit.success) {
        console.warn('Settings service initialization failed:', settingsInit)
      }

      // Initialize profile service
      const profileInit = await userProfileService.initializeCrossDeviceProfileSync(userId, deviceId)
      if (!profileInit.success) {
        console.warn('Profile service initialization failed:', profileInit)
      }

      // Create sync session
      const session: SyncSession = {
        userId,
        deviceId,
        sessionToken: this.generateSessionToken(),
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        syncEnabled: true,
        mfaVerified: options?.mfaVerified || false,
        securityLevel: options?.securityLevel || 'standard'
      }

      // Register session in Supabase if available
      if (supabaseConfig.isConfigured()) {
        await this.registerSyncSession(session)
      }

      this.activeSessions.set(userId, session)

      // Initialize sync status
      const status: SyncStatus = {
        isOnline: supabaseConfig.isConfigured(),
        lastSync: null,
        pendingOperations: 0,
        connectedDevices: 1,
        conflictCount: 0,
        syncHealth: 'healthy'
      }
      this.syncStatus.set(userId, status)

      // Set up periodic sync if enabled
      if (options?.enablePeriodicSync !== false) {
        this.startPeriodicSync(userId, options?.syncInterval || 60000) // 1 minute default
      }

      // Set up real-time listeners
      await this.setupRealtimeListeners(userId, deviceId)

      // Trigger initial sync
      await this.triggerSync('login', userId, deviceId)

      // Log session initialization
      await auditLogger.logSecurityEvent('SYNC_SESSION_STARTED', 'user_sessions', true, {
        userId,
        deviceId,
        securityLevel: session.securityLevel,
        mfaVerified: session.mfaVerified
      })

      this.isInitialized = true
      console.log(`✅ SYNC MANAGER: Initialized successfully for user ${userId}`)

      return { success: true, session }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await auditLogger.logSecurityEvent('SYNC_SESSION_START_FAILED', 'user_sessions', false, {
        userId,
        error: errorMessage
      })

      console.error('Failed to initialize sync manager:', errorMessage)
      return { success: false, session: null, message: errorMessage }
    }
  }

  /**
   * Trigger sync operation
   */
  async triggerSync(
    trigger: SyncTriggerEvent['trigger'],
    userId: string,
    deviceId: string,
    data?: any
  ): Promise<{ success: boolean; results: any[]; conflicts: number; message?: string }> {
    try {
      console.log(`🔄 SYNC TRIGGERED: ${trigger} for user ${userId}`)

      const event: SyncTriggerEvent = {
        trigger,
        userId,
        deviceId,
        data,
        timestamp: new Date().toISOString()
      }

      // Notify event listeners
      this.notifyEventListeners(userId, event)

      // Update last activity
      this.updateLastActivity(userId)

      const results: any[] = []
      let totalConflicts = 0

      // Sync user settings
      if (trigger !== 'profile_update') {
        try {
          const settingsResult = await userSettingsService.forceSyncFromCloud(userId)
          if (settingsResult) {
            results.push({ type: 'settings', success: true, data: settingsResult })
          }
        } catch (error) {
          results.push({ type: 'settings', success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }

      // Sync user profile
      if (trigger !== 'settings_change') {
        try {
          const profileResult = await userProfileService.forceSyncProfileFromCloud(userId)
          if (profileResult.status === 'success') {
            results.push({ type: 'profile', success: true, data: profileResult.data })
          } else {
            results.push({ type: 'profile', success: false, error: profileResult.error })
          }
        } catch (error) {
          results.push({ type: 'profile', success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }

      // Handle MFA sync for security-sensitive triggers
      if (trigger === 'mfa_change' || trigger === 'login') {
        try {
          const mfaResult = await this.syncMfaConfiguration(userId, deviceId)
          results.push({ type: 'mfa', success: mfaResult.success, data: mfaResult })
          if (!mfaResult.success) {
            totalConflicts += mfaResult.conflicts || 0
          }
        } catch (error) {
          results.push({ type: 'mfa', success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }

      // Check for conflicts
      const pendingConflicts = conflictResolver.getPendingConflicts(userId)
      totalConflicts += pendingConflicts.length

      // Auto-resolve conflicts if possible
      for (const conflict of pendingConflicts) {
        if (conflict.autoResolvable) {
          const resolution = await conflictResolver.resolveConflictAutomatically(conflict)
          if (resolution.success) {
            totalConflicts--
          }
        }
      }

      // Update sync status
      this.updateSyncStatus(userId, {
        lastSync: new Date().toISOString(),
        conflictCount: totalConflicts,
        syncHealth: totalConflicts > 0 ? (totalConflicts > 5 ? 'error' : 'warning') : 'healthy'
      })

      // Log sync completion
      await auditLogger.logSecurityEvent('SYNC_COMPLETED', 'sync_events', true, {
        trigger,
        userId,
        deviceId,
        resultsCount: results.length,
        conflictsDetected: totalConflicts,
        success: results.every(r => r.success)
      })

      console.log(`✅ SYNC COMPLETED: ${trigger} - ${results.length} operations, ${totalConflicts} conflicts`)

      return {
        success: true,
        results,
        conflicts: totalConflicts,
        message: `Sync completed: ${results.filter(r => r.success).length}/${results.length} successful`
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await auditLogger.logSecurityEvent('SYNC_FAILED', 'sync_events', false, {
        trigger,
        userId,
        error: errorMessage
      })

      console.error('Sync trigger failed:', errorMessage)
      return { success: false, results: [], conflicts: 0, message: errorMessage }
    }
  }

  /**
   * Sync MFA configuration across devices
   */
  private async syncMfaConfiguration(userId: string, deviceId: string): Promise<{ success: boolean; conflicts?: number }> {
    try {
      console.log(`🔐 SYNCING MFA: Configuration for user ${userId}`)

      // Get MFA status from secure service
      const mfaEnabled = await secureTotpService.isTOTPEnabled(userId)

      if (mfaEnabled) {
        // Check if MFA config needs to be synced across devices
        const deviceMfaConfigs = await this.getMfaDeviceConfigurations(userId)

        // Ensure current device has proper MFA setup
        const currentDeviceConfig = deviceMfaConfigs.find(config => config.deviceId === deviceId)
        if (!currentDeviceConfig) {
          // Register current device for MFA
          await this.registerDeviceForMfa(userId, deviceId)
        }

        console.log(`✅ MFA SYNC: Configuration synchronized for ${deviceMfaConfigs.length} devices`)
      }

      return { success: true, conflicts: 0 }

    } catch (error) {
      console.error('MFA sync failed:', error)
      return { success: false, conflicts: 1 }
    }
  }

  /**
   * Get MFA device configurations
   */
  private async getMfaDeviceConfigurations(userId: string): Promise<any[]> {
    if (!supabaseConfig.isConfigured()) {
      return []
    }

    try {
      const { data: configs, error } = await supabase
        .from('user_mfa_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) {
        console.warn('Failed to get MFA device configs:', error)
        return []
      }

      return configs || []
    } catch (error) {
      console.error('Error getting MFA device configurations:', error)
      return []
    }
  }

  /**
   * Register device for MFA
   */
  private async registerDeviceForMfa(userId: string, deviceId: string): Promise<void> {
    if (!supabaseConfig.isConfigured()) return

    try {
      const deviceInfo = {
        deviceId,
        deviceType: this.detectDeviceType(),
        registeredAt: new Date().toISOString(),
        trusted: false
      }

      const { error } = await supabase
        .from('user_mfa_configs')
        .update({
          registered_devices: { [deviceId]: deviceInfo }
        })
        .eq('user_id', userId)

      if (error) {
        console.warn('Failed to register device for MFA:', error)
      } else {
        console.log('✅ Device registered for MFA:', deviceId)
      }
    } catch (error) {
      console.error('Error registering device for MFA:', error)
    }
  }

  /**
   * Handle logout and cleanup
   */
  async handleLogout(userId: string): Promise<void> {
    try {
      console.log(`🚪 SYNC MANAGER: Handling logout for user ${userId}`)

      // Trigger final sync
      await this.triggerSync('logout', userId, this.currentDeviceId || '', { finalSync: true })

      // Stop periodic sync
      this.stopPeriodicSync(userId)

      // Clean up real-time listeners
      await this.cleanupRealtimeListeners(userId)

      // Mark session as inactive
      const session = this.activeSessions.get(userId)
      if (session && supabaseConfig.isConfigured()) {
        await this.deactivateSyncSession(session)
      }

      // Clean up local state
      this.activeSessions.delete(userId)
      this.syncStatus.delete(userId)
      this.eventListeners.delete(userId)

      // Clean up service caches
      userSettingsService.cleanupCrossDeviceSync(userId)
      userProfileService.cleanupProfileSync(userId)
      conflictResolver.cleanup(userId)

      // Log logout
      await auditLogger.logSecurityEvent('SYNC_SESSION_ENDED', 'user_sessions', true, {
        userId,
        reason: 'user_logout'
      })

      console.log(`✅ SYNC MANAGER: Logout cleanup completed for user ${userId}`)

    } catch (error) {
      console.error('Error during logout cleanup:', error)
    }
  }

  /**
   * Get sync status for a user
   */
  getSyncStatus(userId: string): SyncStatus | null {
    return this.syncStatus.get(userId) || null
  }

  /**
   * Get active session
   */
  getActiveSession(userId: string): SyncSession | null {
    return this.activeSessions.get(userId) || null
  }

  /**
   * Subscribe to sync events
   */
  subscribeToSyncEvents(userId: string, callback: (event: SyncTriggerEvent) => void): void {
    const listeners = this.eventListeners.get(userId) || []
    listeners.push(callback)
    this.eventListeners.set(userId, listeners)
  }

  /**
   * Unsubscribe from sync events
   */
  unsubscribeFromSyncEvents(userId: string, callback?: (event: SyncTriggerEvent) => void): void {
    const listeners = this.eventListeners.get(userId) || []

    if (callback) {
      const filteredListeners = listeners.filter(l => l !== callback)
      this.eventListeners.set(userId, filteredListeners)
    } else {
      this.eventListeners.delete(userId)
    }
  }

  /**
   * Force full sync for all data
   */
  async forceFullSync(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`🔄 FORCE FULL SYNC: Starting for user ${userId}`)

      const result = await this.triggerSync('manual', userId, this.currentDeviceId || '', {
        fullSync: true,
        forced: true
      })

      return {
        success: result.success,
        message: result.message || 'Full sync completed'
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Full sync failed'
      }
    }
  }

  /**
   * Private helper methods
   */

  private generateDeviceId(): string {
    const stored = localStorage.getItem('carexps_device_id')
    if (stored) return stored

    const deviceId = `device_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`
    localStorage.setItem('carexps_device_id', deviceId)
    return deviceId
  }

  private generateSessionToken(): string {
    return `session_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`
  }

  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase()
    if (/mobile|android|iphone|ipod/.test(userAgent)) return 'mobile'
    if (/tablet|ipad/.test(userAgent)) return 'tablet'
    return 'desktop'
  }

  private async registerSyncSession(session: SyncSession): Promise<void> {
    try {
      const { error } = await supabase
        .from('device_sessions')
        .upsert({
          id: session.sessionToken,
          user_id: session.userId,
          device_id: session.deviceId,
          session_token: session.sessionToken,
          status: 'active',
          started_at: session.startedAt,
          last_activity: session.lastActivity,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          sync_enabled: session.syncEnabled,
          security_level: session.securityLevel,
          mfa_verified: session.mfaVerified,
          metadata: {
            browserInfo: {
              userAgent: navigator.userAgent,
              language: navigator.language
            }
          }
        }, { onConflict: 'session_token' })

      if (error) {
        console.warn('Failed to register sync session:', error)
      }
    } catch (error) {
      console.error('Error registering sync session:', error)
    }
  }

  private async deactivateSyncSession(session: SyncSession): Promise<void> {
    try {
      const { error } = await supabase
        .from('device_sessions')
        .update({
          status: 'expired',
          last_activity: new Date().toISOString()
        })
        .eq('session_token', session.sessionToken)

      if (error) {
        console.warn('Failed to deactivate sync session:', error)
      }
    } catch (error) {
      console.error('Error deactivating sync session:', error)
    }
  }

  private startPeriodicSync(userId: string, interval: number): void {
    this.stopPeriodicSync(userId) // Clear any existing interval

    const intervalId = window.setInterval(async () => {
      try {
        await this.triggerSync('periodic', userId, this.currentDeviceId || '')
      } catch (error) {
        console.error('Periodic sync failed:', error)
      }
    }, interval)

    this.periodicSyncIntervals.set(userId, intervalId)
    console.log(`⏰ Periodic sync started for user ${userId} (${interval}ms interval)`)
  }

  private stopPeriodicSync(userId: string): void {
    const intervalId = this.periodicSyncIntervals.get(userId)
    if (intervalId) {
      window.clearInterval(intervalId)
      this.periodicSyncIntervals.delete(userId)
      console.log(`⏹️ Periodic sync stopped for user ${userId}`)
    }
  }

  private async setupRealtimeListeners(userId: string, deviceId: string): Promise<void> {
    // Real-time listeners are handled by individual services
    // This is just for coordination
    console.log(`👂 Setting up real-time listeners for user ${userId} on device ${deviceId}`)
  }

  private async cleanupRealtimeListeners(userId: string): Promise<void> {
    // Cleanup is handled by individual services
    console.log(`🧹 Cleaning up real-time listeners for user ${userId}`)
  }

  private updateLastActivity(userId: string): void {
    const session = this.activeSessions.get(userId)
    if (session) {
      session.lastActivity = new Date().toISOString()
      this.activeSessions.set(userId, session)
    }
  }

  private updateSyncStatus(userId: string, updates: Partial<SyncStatus>): void {
    const currentStatus = this.syncStatus.get(userId)
    if (currentStatus) {
      const updatedStatus = { ...currentStatus, ...updates }
      this.syncStatus.set(userId, updatedStatus)
    }
  }

  private notifyEventListeners(userId: string, event: SyncTriggerEvent): void {
    const listeners = this.eventListeners.get(userId) || []
    listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in sync event listener:', error)
      }
    })
  }

  /**
   * Global cleanup
   */
  cleanup(): void {
    // Stop all periodic syncs
    this.periodicSyncIntervals.forEach((intervalId) => {
      window.clearInterval(intervalId)
    })
    this.periodicSyncIntervals.clear()

    // Clear all state
    this.activeSessions.clear()
    this.syncStatus.clear()
    this.eventListeners.clear()

    // Clean up individual services
    userSettingsService.cleanupCrossDeviceSync()
    userProfileService.cleanupProfileSync()
    conflictResolver.cleanup()

    console.log('🧹 Sync manager cleaned up completely')
  }
}

// Export singleton instance
export const syncManager = new CrossDeviceSyncManager()

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    syncManager.cleanup()
  })

  // Handle visibility change for activity tracking
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && syncManager['currentUserId']) {
      // Trigger sync when page becomes visible again
      syncManager.triggerSync('manual', syncManager['currentUserId'], syncManager['currentDeviceId'] || '')
    }
  })
}