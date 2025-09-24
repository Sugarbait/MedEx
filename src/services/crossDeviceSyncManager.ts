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
import { secureMfaService } from './secureMfaService'

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
      const mfaStatus = await secureMfaService.getMfaStatus(userId)

      if (mfaStatus.enabled) {
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
   */\n  async handleLogout(userId: string): Promise<void> {\n    try {\n      console.log(`🚪 SYNC MANAGER: Handling logout for user ${userId}`)\n\n      // Trigger final sync\n      await this.triggerSync('logout', userId, this.currentDeviceId || '', { finalSync: true })\n\n      // Stop periodic sync\n      this.stopPeriodicSync(userId)\n\n      // Clean up real-time listeners\n      await this.cleanupRealtimeListeners(userId)\n\n      // Mark session as inactive\n      const session = this.activeSessions.get(userId)\n      if (session && supabaseConfig.isConfigured()) {\n        await this.deactivateSyncSession(session)\n      }\n\n      // Clean up local state\n      this.activeSessions.delete(userId)\n      this.syncStatus.delete(userId)\n      this.eventListeners.delete(userId)\n\n      // Clean up service caches\n      userSettingsService.cleanupCrossDeviceSync(userId)\n      userProfileService.cleanupProfileSync(userId)\n      conflictResolver.cleanup(userId)\n\n      // Log logout\n      await auditLogger.logSecurityEvent('SYNC_SESSION_ENDED', 'user_sessions', true, {\n        userId,\n        reason: 'user_logout'\n      })\n\n      console.log(`✅ SYNC MANAGER: Logout cleanup completed for user ${userId}`)\n\n    } catch (error) {\n      console.error('Error during logout cleanup:', error)\n    }\n  }\n\n  /**\n   * Get sync status for a user\n   */\n  getSyncStatus(userId: string): SyncStatus | null {\n    return this.syncStatus.get(userId) || null\n  }\n\n  /**\n   * Get active session\n   */\n  getActiveSession(userId: string): SyncSession | null {\n    return this.activeSessions.get(userId) || null\n  }\n\n  /**\n   * Subscribe to sync events\n   */\n  subscribeToSyncEvents(userId: string, callback: (event: SyncTriggerEvent) => void): void {\n    const listeners = this.eventListeners.get(userId) || []\n    listeners.push(callback)\n    this.eventListeners.set(userId, listeners)\n  }\n\n  /**\n   * Unsubscribe from sync events\n   */\n  unsubscribeFromSyncEvents(userId: string, callback?: (event: SyncTriggerEvent) => void): void {\n    const listeners = this.eventListeners.get(userId) || []\n    \n    if (callback) {\n      const filteredListeners = listeners.filter(l => l !== callback)\n      this.eventListeners.set(userId, filteredListeners)\n    } else {\n      this.eventListeners.delete(userId)\n    }\n  }\n\n  /**\n   * Force full sync for all data\n   */\n  async forceFullSync(userId: string): Promise<{ success: boolean; message?: string }> {\n    try {\n      console.log(`🔄 FORCE FULL SYNC: Starting for user ${userId}`)\n\n      const result = await this.triggerSync('manual', userId, this.currentDeviceId || '', {\n        fullSync: true,\n        forced: true\n      })\n\n      return {\n        success: result.success,\n        message: result.message || 'Full sync completed'\n      }\n    } catch (error) {\n      return {\n        success: false,\n        message: error instanceof Error ? error.message : 'Full sync failed'\n      }\n    }\n  }\n\n  /**\n   * Private helper methods\n   */\n\n  private generateDeviceId(): string {\n    const stored = localStorage.getItem('carexps_device_id')\n    if (stored) return stored\n\n    const deviceId = `device_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`\n    localStorage.setItem('carexps_device_id', deviceId)\n    return deviceId\n  }\n\n  private generateSessionToken(): string {\n    return `session_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`\n  }\n\n  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {\n    const userAgent = navigator.userAgent.toLowerCase()\n    if (/mobile|android|iphone|ipod/.test(userAgent)) return 'mobile'\n    if (/tablet|ipad/.test(userAgent)) return 'tablet'\n    return 'desktop'\n  }\n\n  private async registerSyncSession(session: SyncSession): Promise<void> {\n    try {\n      const { error } = await supabase\n        .from('device_sessions')\n        .upsert({\n          id: session.sessionToken,\n          user_id: session.userId,\n          device_id: session.deviceId,\n          session_token: session.sessionToken,\n          status: 'active',\n          started_at: session.startedAt,\n          last_activity: session.lastActivity,\n          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours\n          sync_enabled: session.syncEnabled,\n          security_level: session.securityLevel,\n          mfa_verified: session.mfaVerified,\n          metadata: {\n            browserInfo: {\n              userAgent: navigator.userAgent,\n              language: navigator.language\n            }\n          }\n        }, { onConflict: 'session_token' })\n\n      if (error) {\n        console.warn('Failed to register sync session:', error)\n      }\n    } catch (error) {\n      console.error('Error registering sync session:', error)\n    }\n  }\n\n  private async deactivateSyncSession(session: SyncSession): Promise<void> {\n    try {\n      const { error } = await supabase\n        .from('device_sessions')\n        .update({\n          status: 'expired',\n          last_activity: new Date().toISOString()\n        })\n        .eq('session_token', session.sessionToken)\n\n      if (error) {\n        console.warn('Failed to deactivate sync session:', error)\n      }\n    } catch (error) {\n      console.error('Error deactivating sync session:', error)\n    }\n  }\n\n  private startPeriodicSync(userId: string, interval: number): void {\n    this.stopPeriodicSync(userId) // Clear any existing interval\n\n    const intervalId = window.setInterval(async () => {\n      try {\n        await this.triggerSync('periodic', userId, this.currentDeviceId || '')\n      } catch (error) {\n        console.error('Periodic sync failed:', error)\n      }\n    }, interval)\n\n    this.periodicSyncIntervals.set(userId, intervalId)\n    console.log(`⏰ Periodic sync started for user ${userId} (${interval}ms interval)`)\n  }\n\n  private stopPeriodicSync(userId: string): void {\n    const intervalId = this.periodicSyncIntervals.get(userId)\n    if (intervalId) {\n      window.clearInterval(intervalId)\n      this.periodicSyncIntervals.delete(userId)\n      console.log(`⏹️ Periodic sync stopped for user ${userId}`)\n    }\n  }\n\n  private async setupRealtimeListeners(userId: string, deviceId: string): Promise<void> {\n    // Real-time listeners are handled by individual services\n    // This is just for coordination\n    console.log(`👂 Setting up real-time listeners for user ${userId} on device ${deviceId}`)\n  }\n\n  private async cleanupRealtimeListeners(userId: string): Promise<void> {\n    // Cleanup is handled by individual services\n    console.log(`🧹 Cleaning up real-time listeners for user ${userId}`)\n  }\n\n  private updateLastActivity(userId: string): void {\n    const session = this.activeSessions.get(userId)\n    if (session) {\n      session.lastActivity = new Date().toISOString()\n      this.activeSessions.set(userId, session)\n    }\n  }\n\n  private updateSyncStatus(userId: string, updates: Partial<SyncStatus>): void {\n    const currentStatus = this.syncStatus.get(userId)\n    if (currentStatus) {\n      const updatedStatus = { ...currentStatus, ...updates }\n      this.syncStatus.set(userId, updatedStatus)\n    }\n  }\n\n  private notifyEventListeners(userId: string, event: SyncTriggerEvent): void {\n    const listeners = this.eventListeners.get(userId) || []\n    listeners.forEach(listener => {\n      try {\n        listener(event)\n      } catch (error) {\n        console.error('Error in sync event listener:', error)\n      }\n    })\n  }\n\n  /**\n   * Global cleanup\n   */\n  cleanup(): void {\n    // Stop all periodic syncs\n    this.periodicSyncIntervals.forEach((intervalId) => {\n      window.clearInterval(intervalId)\n    })\n    this.periodicSyncIntervals.clear()\n\n    // Clear all state\n    this.activeSessions.clear()\n    this.syncStatus.clear()\n    this.eventListeners.clear()\n\n    // Clean up individual services\n    userSettingsService.cleanupCrossDeviceSync()\n    userProfileService.cleanupProfileSync()\n    conflictResolver.cleanup()\n\n    console.log('🧹 Sync manager cleaned up completely')\n  }\n}\n\n// Export singleton instance\nexport const syncManager = new CrossDeviceSyncManager()\n\n// Auto-cleanup on page unload\nif (typeof window !== 'undefined') {\n  window.addEventListener('beforeunload', () => {\n    syncManager.cleanup()\n  })\n\n  // Handle visibility change for activity tracking\n  document.addEventListener('visibilitychange', () => {\n    if (!document.hidden && syncManager['currentUserId']) {\n      // Trigger sync when page becomes visible again\n      syncManager.triggerSync('manual', syncManager['currentUserId'], syncManager['currentDeviceId'] || '')\n    }\n  })\n}