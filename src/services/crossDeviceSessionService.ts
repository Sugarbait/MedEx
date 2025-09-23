/**
 * HIPAA-Compliant Cross-Device Session Management Service
 *
 * Manages user sessions across multiple devices with security and compliance features.
 *
 * Features:
 * - Multi-device session tracking and coordination
 * - Session transfer and handoff between devices
 * - Device presence monitoring
 * - Integration with existing auth and MFA services
 * - Automatic session cleanup and security enforcement
 */

import { supabase } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import { secureStorage } from '@/services/secureStorage'
import { auditLogger } from '@/services/auditLogger'
import { encryptionService } from '@/services/encryption'
import { deviceFingerprintService } from '@/services/deviceFingerprintService'
import { mfaService } from '@/services/mfaService'
import { DeviceSession, CrossDeviceSyncEvent } from '@/types/supabase'

const logger = secureLogger.component('CrossDeviceSessionService')

export interface SessionInfo {
  sessionId: string
  deviceId: string
  userId: string
  isActive: boolean
  startTime: string
  lastActivity: string
  deviceName: string
  deviceTrustLevel: string
  ipAddress?: string
  userAgent: string
  sessionData?: Record<string, any>
}

export interface SessionTransferRequest {
  fromDeviceId: string
  toDeviceId: string
  sessionData: Record<string, any>
  transferType: 'handoff' | 'sync' | 'backup'
  requiresVerification: boolean
}

export interface DevicePresence {
  deviceId: string
  userId: string
  isOnline: boolean
  lastSeen: string
  currentPage?: string
  sessionId?: string
}

export interface SessionEvents {
  onSessionStart: (session: SessionInfo) => void
  onSessionEnd: (sessionId: string) => void
  onSessionTransfer: (transfer: SessionTransferRequest) => void
  onDevicePresenceChange: (presence: DevicePresence) => void
  onSecurityEvent: (event: { type: string; details: any }) => void
}

class CrossDeviceSessionService {
  private currentSession: SessionInfo | null = null
  private activeSessions: Map<string, SessionInfo> = new Map()
  private devicePresences: Map<string, DevicePresence> = new Map()
  private eventListeners: Partial<SessionEvents> = {}
  private presenceInterval: NodeJS.Timeout | null = null
  private sessionCleanupInterval: NodeJS.Timeout | null = null
  private realtimeSubscription: any = null

  /**
   * Initialize the cross-device session service
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      logger.debug('Initializing cross-device session service', userId)

      // Register current device if not already registered
      const deviceInfo = await deviceFingerprintService.getCurrentDeviceInfo()
      if (!deviceInfo?.isRegistered) {
        const result = await deviceFingerprintService.registerDevice(userId)
        if (!result.success) {
          logger.error('Failed to register device during session initialization', userId)
          return false
        }
      }

      // Validate device
      const validation = await deviceFingerprintService.validateDevice(userId)
      if (!validation.isValid) {
        logger.error('Device validation failed during session initialization', userId)
        return false
      }

      // Start new session
      const sessionResult = await this.startSession(userId, validation.deviceId!)

      if (!sessionResult.success) {
        logger.error('Failed to start session during initialization', userId)
        return false
      }

      // Set up real-time subscriptions
      await this.setupRealtimeSubscriptions(userId)

      // Start monitoring intervals
      this.startMonitoring()

      logger.info('Cross-device session service initialized successfully', userId)
      return true

    } catch (error) {
      logger.error('Failed to initialize cross-device session service', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Start a new session on the current device
   */
  async startSession(userId: string, deviceId: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      logger.debug('Starting new session', userId, undefined, { deviceId })

      // Check for existing active session on this device
      const existingSession = await this.getActiveSessionForDevice(deviceId)
      if (existingSession) {
        logger.info('Resuming existing session', userId, undefined, { sessionId: existingSession.id })
        await this.loadSession(existingSession)
        return { success: true, sessionId: existingSession.id }
      }

      // Create session data
      const sessionData = {
        preferences: await this.loadUserPreferences(userId),
        securityContext: {
          mfaVerified: false,
          lastMfaCheck: null,
          trustLevel: 'unknown'
        },
        applicationState: {
          currentPage: window.location.pathname,
          timestamp: new Date().toISOString()
        }
      }

      // Create new session in database
      const { data: newSession, error } = await supabase
        .from('device_sessions')
        .insert({
          user_id: userId,
          device_id: deviceId,
          session_data: await encryptionService.encryptData(JSON.stringify(sessionData)),
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
          is_active: true
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create session in database', userId, undefined, { error: error.message })
        return { success: false, error: 'Failed to create session' }
      }

      // Create session info object
      const sessionInfo: SessionInfo = {
        sessionId: newSession.id,
        deviceId: newSession.device_id,
        userId: newSession.user_id,
        isActive: true,
        startTime: newSession.created_at,
        lastActivity: newSession.last_activity,
        deviceName: 'Current Device', // Will be updated from device info
        deviceTrustLevel: 'unknown',
        ipAddress: newSession.ip_address,
        userAgent: newSession.user_agent,
        sessionData
      }

      // Store session locally
      this.currentSession = sessionInfo
      await this.storeSessionLocally(sessionInfo)

      // Update device presence
      await this.updateDevicePresence(deviceId, true)

      // Log audit event
      await auditLogger.logSecurityEvent({
        action: 'session_started',
        resource: 'device_sessions',
        resourceId: newSession.id,
        userId,
        details: {
          deviceId,
          ipAddress: newSession.ip_address,
          userAgent: navigator.userAgent
        },
        severity: 'low'
      })

      // Emit event
      this.eventListeners.onSessionStart?.(sessionInfo)

      logger.info('Session started successfully', userId, undefined, { sessionId: newSession.id })
      return { success: true, sessionId: newSession.id }

    } catch (error) {
      logger.error('Failed to start session', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * End the current session
   */
  async endSession(sessionId?: string): Promise<boolean> {
    try {
      const targetSessionId = sessionId || this.currentSession?.sessionId
      if (!targetSessionId) {
        logger.warn('No session to end')
        return true
      }

      logger.debug('Ending session', '', undefined, { sessionId: targetSessionId })

      // Update session in database
      const { error } = await supabase
        .from('device_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', targetSessionId)

      if (error) {
        logger.error('Failed to end session in database', '', undefined, { error: error.message })
      }

      // Clean up local data
      if (this.currentSession?.sessionId === targetSessionId) {
        await this.clearLocalSession()
        this.currentSession = null
      }

      // Update device presence
      if (this.currentSession?.deviceId) {
        await this.updateDevicePresence(this.currentSession.deviceId, false)
      }

      // Log audit event
      await auditLogger.logSecurityEvent({
        action: 'session_ended',
        resource: 'device_sessions',
        resourceId: targetSessionId,
        details: { reason: 'manual_logout' },
        severity: 'low'
      })

      // Emit event
      this.eventListeners.onSessionEnd?.(targetSessionId)

      logger.info('Session ended successfully', '', undefined, { sessionId: targetSessionId })
      return true

    } catch (error) {
      logger.error('Failed to end session', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: targetSessionId
      })
      return false
    }
  }

  /**
   * Transfer session data between devices
   */
  async transferSession(request: SessionTransferRequest): Promise<boolean> {
    try {
      logger.debug('Transferring session between devices', '', undefined, {
        fromDevice: request.fromDeviceId,
        toDevice: request.toDeviceId,
        transferType: request.transferType
      })

      // Verify devices belong to the same user
      const fromDevice = await this.getDeviceInfo(request.fromDeviceId)
      const toDevice = await this.getDeviceInfo(request.toDeviceId)

      if (!fromDevice || !toDevice || fromDevice.user_id !== toDevice.user_id) {
        logger.error('Invalid device transfer request - devices do not belong to same user')
        return false
      }

      // Require MFA verification for sensitive transfers
      if (request.requiresVerification) {
        const mfaResult = await mfaService.requireVerification(fromDevice.user_id)
        if (!mfaResult.success) {
          logger.error('MFA verification failed for session transfer')
          return false
        }
      }

      // Encrypt session data for transfer
      const encryptedSessionData = await encryptionService.encryptData(JSON.stringify(request.sessionData))

      // Create sync event for the transfer
      const { error } = await supabase
        .from('cross_device_sync_events')
        .insert({
          user_id: fromDevice.user_id,
          source_device_id: request.fromDeviceId,
          target_device_id: request.toDeviceId,
          event_type: 'session_transfer',
          data: encryptedSessionData,
          metadata: {
            transferType: request.transferType,
            timestamp: new Date().toISOString(),
            requiresVerification: request.requiresVerification
          }
        })

      if (error) {
        logger.error('Failed to create session transfer sync event', '', undefined, { error: error.message })
        return false
      }

      // Log audit event
      await auditLogger.logSecurityEvent({
        action: 'session_transferred',
        resource: 'cross_device_sync_events',
        userId: fromDevice.user_id,
        details: {
          fromDevice: request.fromDeviceId,
          toDevice: request.toDeviceId,
          transferType: request.transferType
        },
        severity: 'medium'
      })

      // Emit event
      this.eventListeners.onSessionTransfer?.(request)

      logger.info('Session transfer completed successfully', '', undefined, {
        fromDevice: request.fromDeviceId,
        toDevice: request.toDeviceId
      })

      return true

    } catch (error) {
      logger.error('Failed to transfer session', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      })
      return false
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    try {
      logger.debug('Fetching active sessions for user', userId)

      const { data: sessions, error } = await supabase
        .from('device_sessions')
        .select(`
          *,
          user_devices (
            device_name,
            trust_level
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false })

      if (error) {
        logger.error('Failed to fetch active sessions', userId, undefined, { error: error.message })
        return []
      }

      const sessionInfos: SessionInfo[] = []

      for (const session of sessions) {
        try {
          let sessionData = {}
          if (session.session_data) {
            const decryptedData = await encryptionService.decryptData(session.session_data)
            sessionData = JSON.parse(decryptedData)
          }

          sessionInfos.push({
            sessionId: session.id,
            deviceId: session.device_id,
            userId: session.user_id,
            isActive: session.is_active,
            startTime: session.created_at,
            lastActivity: session.last_activity,
            deviceName: (session as any).user_devices?.device_name || 'Unknown Device',
            deviceTrustLevel: (session as any).user_devices?.trust_level || 'unknown',
            ipAddress: session.ip_address,
            userAgent: session.user_agent,
            sessionData
          })
        } catch (decryptError) {
          logger.warn('Failed to decrypt session data, skipping session', userId, undefined, {
            sessionId: session.id,
            error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
          })
        }
      }

      logger.info('Active sessions fetched successfully', userId, undefined, { sessionCount: sessionInfos.length })
      return sessionInfos

    } catch (error) {
      logger.error('Failed to get active sessions', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }

  /**
   * Update device presence status
   */
  async updateDevicePresence(deviceId: string, isOnline: boolean, currentPage?: string): Promise<void> {
    try {
      const presence: DevicePresence = {
        deviceId,
        userId: this.currentSession?.userId || '',
        isOnline,
        lastSeen: new Date().toISOString(),
        currentPage,
        sessionId: this.currentSession?.sessionId
      }

      this.devicePresences.set(deviceId, presence)

      // Update in database (could be a separate presence table or part of device_sessions)
      if (this.currentSession) {
        await supabase
          .from('device_sessions')
          .update({
            last_activity: new Date().toISOString(),
            metadata: {
              currentPage,
              isOnline
            }
          })
          .eq('id', this.currentSession.sessionId)
      }

      // Emit event
      this.eventListeners.onDevicePresenceChange?.(presence)

    } catch (error) {
      logger.warn('Failed to update device presence', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId,
        isOnline
      })
    }
  }

  /**
   * Set up event listeners
   */
  setEventListeners(listeners: Partial<SessionEvents>): void {
    this.eventListeners = { ...this.eventListeners, ...listeners }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): SessionInfo | null {
    return this.currentSession
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    logger.debug('Cleaning up cross-device session service')

    // Clear intervals
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval)
      this.presenceInterval = null
    }

    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval)
      this.sessionCleanupInterval = null
    }

    // Unsubscribe from real-time
    if (this.realtimeSubscription) {
      await supabase.removeChannel(this.realtimeSubscription)
      this.realtimeSubscription = null
    }

    // End current session
    if (this.currentSession) {
      await this.endSession()
    }

    logger.info('Cross-device session service cleanup completed')
  }

  // Private helper methods

  private async setupRealtimeSubscriptions(userId: string): Promise<void> {
    try {
      // Subscribe to sync events for this user
      this.realtimeSubscription = supabase
        .channel(`user_sync_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cross_device_sync_events',
            filter: `user_id=eq.${userId}`
          },
          async (payload) => {
            await this.handleSyncEvent(payload)
          }
        )
        .subscribe()

      logger.debug('Real-time subscriptions set up successfully', userId)

    } catch (error) {
      logger.error('Failed to set up real-time subscriptions', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async handleSyncEvent(payload: any): Promise<void> {
    try {
      const event = payload.new as CrossDeviceSyncEvent

      // Only process events not from this device
      if (event.source_device_id === this.currentSession?.deviceId) {
        return
      }

      logger.debug('Handling sync event', '', undefined, {
        eventType: event.event_type,
        sourceDevice: event.source_device_id
      })

      switch (event.event_type) {
        case 'session_transfer':
          await this.handleSessionTransferEvent(event)
          break
        case 'security_alert':
          await this.handleSecurityEvent(event)
          break
        default:
          logger.debug('Unknown sync event type', '', undefined, { eventType: event.event_type })
      }

    } catch (error) {
      logger.error('Failed to handle sync event', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async handleSessionTransferEvent(event: CrossDeviceSyncEvent): Promise<void> {
    try {
      if (event.target_device_id !== this.currentSession?.deviceId) {
        return // Not for this device
      }

      const decryptedData = await encryptionService.decryptData(event.data)
      const transferData = JSON.parse(decryptedData)

      // Apply transferred session data
      if (this.currentSession) {
        this.currentSession.sessionData = {
          ...this.currentSession.sessionData,
          ...transferData
        }

        await this.storeSessionLocally(this.currentSession)
      }

      logger.info('Session transfer received and applied', '', undefined, {
        sourceDevice: event.source_device_id
      })

    } catch (error) {
      logger.error('Failed to handle session transfer event', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async handleSecurityEvent(event: CrossDeviceSyncEvent): Promise<void> {
    try {
      const decryptedData = await encryptionService.decryptData(event.data)
      const securityData = JSON.parse(decryptedData)

      // Emit security event
      this.eventListeners.onSecurityEvent?.({
        type: securityData.type,
        details: securityData.details
      })

      logger.info('Security event processed', '', undefined, {
        eventType: securityData.type
      })

    } catch (error) {
      logger.error('Failed to handle security event', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private startMonitoring(): void {
    // Update presence every 30 seconds
    this.presenceInterval = setInterval(async () => {
      if (this.currentSession) {
        await this.updateDevicePresence(
          this.currentSession.deviceId,
          true,
          window.location.pathname
        )
      }
    }, 30000)

    // Clean up expired sessions every 5 minutes
    this.sessionCleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions()
    }, 300000)
  }

  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24 hours ago

      const { error } = await supabase
        .from('device_sessions')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('last_activity', expiredTime)

      if (error) {
        logger.warn('Failed to cleanup expired sessions', '', undefined, { error: error.message })
      }

    } catch (error) {
      logger.warn('Error during session cleanup', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async loadSession(session: DeviceSession): Promise<void> {
    try {
      let sessionData = {}
      if (session.session_data) {
        const decryptedData = await encryptionService.decryptData(session.session_data)
        sessionData = JSON.parse(decryptedData)
      }

      this.currentSession = {
        sessionId: session.id,
        deviceId: session.device_id,
        userId: session.user_id,
        isActive: session.is_active,
        startTime: session.created_at,
        lastActivity: session.last_activity,
        deviceName: 'Current Device',
        deviceTrustLevel: 'unknown',
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        sessionData
      }

      await this.storeSessionLocally(this.currentSession)

    } catch (error) {
      logger.error('Failed to load session', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async getActiveSessionForDevice(deviceId: string): Promise<DeviceSession | null> {
    try {
      const { data: session, error } = await supabase
        .from('device_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to get active session for device', '', undefined, { error: error.message })
        return null
      }

      return session || null

    } catch (error) {
      logger.error('Error getting active session for device', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  private async getDeviceInfo(deviceId: string): Promise<any> {
    try {
      const { data: device, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('id', deviceId)
        .single()

      if (error) {
        logger.error('Failed to get device info', '', undefined, { error: error.message })
        return null
      }

      return device

    } catch (error) {
      logger.error('Error getting device info', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  private async loadUserPreferences(userId: string): Promise<any> {
    try {
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        logger.warn('Failed to load user preferences', userId, undefined, { error: error.message })
        return {}
      }

      return settings || {}

    } catch (error) {
      logger.warn('Error loading user preferences', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return {}
    }
  }

  private async storeSessionLocally(session: SessionInfo): Promise<void> {
    try {
      await secureStorage.setItem('current_session', JSON.stringify(session))
    } catch (error) {
      logger.warn('Failed to store session locally', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async clearLocalSession(): Promise<void> {
    try {
      await secureStorage.removeItem('current_session')
    } catch (error) {
      logger.warn('Failed to clear local session', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async getClientIP(): Promise<string | null> {
    try {
      // In a real application, you might get this from a service or header
      return null // Placeholder - implement based on your infrastructure
    } catch {
      return null
    }
  }
}

// Export singleton instance
export const crossDeviceSessionService = new CrossDeviceSessionService()