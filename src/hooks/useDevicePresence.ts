/**
 * Hook for real-time device presence tracking
 *
 * Provides functionality for monitoring which devices are currently
 * active and connected in real-time across the cross-device ecosystem.
 */

import { useCallback, useEffect, useState } from 'react'
import { useCrossDevice } from '@/contexts/CrossDeviceContext'
import { realTimeSyncService } from '@/services/realTimeSyncService'
import { crossDeviceSessionService } from '@/services/crossDeviceSessionService'
import { secureLogger } from '@/services/secureLogger'
import type { DeviceInfo } from '@/services/deviceFingerprintService'

const logger = secureLogger.component('useDevicePresence')

export interface DevicePresenceInfo {
  deviceId: string
  deviceName: string
  isOnline: boolean
  lastSeen: Date
  isCurrentDevice: boolean
  trustLevel: 'trusted' | 'untrusted' | 'unknown'
  location?: string
  platform?: string
  browser?: string
  sessionId?: string
}

export interface PresenceHookResult {
  // Presence State
  onlineDevices: DevicePresenceInfo[]
  offlineDevices: DevicePresenceInfo[]
  allDevicePresence: DevicePresenceInfo[]
  onlineCount: number
  totalDeviceCount: number

  // Current Device
  currentDevicePresence: DevicePresenceInfo | null
  isCurrentDeviceOnline: boolean

  // Real-time Updates
  updatePresence: () => Promise<void>
  broadcastPresence: () => Promise<void>

  // Presence Monitoring
  startPresenceMonitoring: () => void
  stopPresenceMonitoring: () => void
  isMonitoringPresence: boolean

  // Event Handling
  onDeviceOnline: (callback: (device: DevicePresenceInfo) => void) => () => void
  onDeviceOffline: (callback: (device: DevicePresenceInfo) => void) => () => void
  onPresenceUpdate: (callback: (devices: DevicePresenceInfo[]) => void) => () => void

  // Utilities
  getDevicePresence: (deviceId: string) => DevicePresenceInfo | null
  isDeviceOnline: (deviceId: string) => boolean
  getLastSeenText: (deviceId: string) => string
  exportPresenceData: () => any
}

export const useDevicePresence = (): PresenceHookResult => {
  const { currentDevice, connectedDevices, isInitialized } = useCrossDevice()

  const [devicePresence, setDevicePresence] = useState<DevicePresenceInfo[]>([])
  const [isMonitoringPresence, setIsMonitoringPresence] = useState(false)
  const [eventListeners, setEventListeners] = useState<Set<() => void>>(new Set())
  const [presenceInterval, setPresenceInterval] = useState<NodeJS.Timeout | null>(null)

  // Filter online and offline devices
  const onlineDevices = devicePresence.filter(device => device.isOnline)
  const offlineDevices = devicePresence.filter(device => !device.isOnline)
  const onlineCount = onlineDevices.length
  const totalDeviceCount = devicePresence.length

  // Current device presence
  const currentDevicePresence = currentDevice
    ? devicePresence.find(device => device.deviceId === currentDevice.id) || null
    : null
  const isCurrentDeviceOnline = currentDevicePresence?.isOnline || false

  // Cleanup event listeners and intervals on unmount
  useEffect(() => {
    return () => {
      eventListeners.forEach(cleanup => cleanup())
      if (presenceInterval) {
        clearInterval(presenceInterval)
      }
    }
  }, [eventListeners, presenceInterval])

  // Initialize presence tracking when cross-device is ready
  useEffect(() => {
    if (isInitialized && currentDevice) {
      updatePresence()
      startPresenceMonitoring()
    }

    return () => {
      stopPresenceMonitoring()
    }
  }, [isInitialized, currentDevice])

  // Update device presence based on connected devices
  useEffect(() => {
    if (connectedDevices.length > 0) {
      const updatedPresence = connectedDevices.map(device => ({
        deviceId: device.id,
        deviceName: device.name || `${device.platform} Device`,
        isOnline: false, // Will be updated by presence monitoring
        lastSeen: new Date(device.lastUsed || device.createdAt),
        isCurrentDevice: device.id === currentDevice?.id,
        trustLevel: device.trustLevel,
        location: device.location,
        platform: device.platform,
        browser: device.browser,
        sessionId: device.sessionId
      }))

      setDevicePresence(updatedPresence)
    }
  }, [connectedDevices, currentDevice])

  const updatePresence = useCallback(async (): Promise<void> => {
    try {
      if (!currentDevice) return

      logger.debug('Updating device presence')

      // Get active sessions for presence detection
      const activeSessions = await crossDeviceSessionService.getActiveSessions()

      // Update presence based on active sessions
      setDevicePresence(prev => prev.map(device => {
        const activeSession = activeSessions.find(session => session.deviceId === device.deviceId)
        const isOnline = !!activeSession && activeSession.isActive

        return {
          ...device,
          isOnline,
          lastSeen: activeSession ? new Date(activeSession.lastActivity) : device.lastSeen,
          sessionId: activeSession?.sessionId
        }
      }))

      logger.debug('Device presence updated', undefined, undefined, {
        totalDevices: devicePresence.length,
        onlineDevices: onlineDevices.length
      })

    } catch (error) {
      logger.error('Failed to update device presence', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [currentDevice, devicePresence.length, onlineDevices.length])

  const broadcastPresence = useCallback(async (): Promise<void> => {
    try {
      if (!currentDevice || !isInitialized) return

      logger.debug('Broadcasting device presence')

      // Send presence heartbeat via real-time sync
      await realTimeSyncService.queueSyncEvent(
        'device_heartbeat',
        {
          deviceId: currentDevice.id,
          timestamp: new Date().toISOString(),
          status: 'online'
        },
        'normal',
        false
      )

      // Update session activity
      await crossDeviceSessionService.updateSessionActivity()

      logger.debug('Device presence broadcasted')

    } catch (error) {
      logger.error('Failed to broadcast device presence', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [currentDevice, isInitialized])

  const startPresenceMonitoring = useCallback((): void => {
    if (isMonitoringPresence || !isInitialized) return

    logger.debug('Starting presence monitoring')

    // Set up presence heartbeat (every 30 seconds)
    const interval = setInterval(async () => {
      await broadcastPresence()
      await updatePresence()
    }, 30000)

    setPresenceInterval(interval)
    setIsMonitoringPresence(true)

    // Initial broadcast
    broadcastPresence()

    logger.info('Presence monitoring started')
  }, [isMonitoringPresence, isInitialized, broadcastPresence, updatePresence])

  const stopPresenceMonitoring = useCallback((): void => {
    if (!isMonitoringPresence) return

    logger.debug('Stopping presence monitoring')

    if (presenceInterval) {
      clearInterval(presenceInterval)
      setPresenceInterval(null)
    }

    setIsMonitoringPresence(false)

    logger.info('Presence monitoring stopped')
  }, [isMonitoringPresence, presenceInterval])

  const onDeviceOnline = useCallback((callback: (device: DevicePresenceInfo) => void) => {
    const handleDeviceOnline = (event: CustomEvent) => {
      callback(event.detail.device)
    }

    window.addEventListener('devicePresenceOnline', handleDeviceOnline)

    const cleanup = () => {
      window.removeEventListener('devicePresenceOnline', handleDeviceOnline)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  const onDeviceOffline = useCallback((callback: (device: DevicePresenceInfo) => void) => {
    const handleDeviceOffline = (event: CustomEvent) => {
      callback(event.detail.device)
    }

    window.addEventListener('devicePresenceOffline', handleDeviceOffline)

    const cleanup = () => {
      window.removeEventListener('devicePresenceOffline', handleDeviceOffline)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  const onPresenceUpdate = useCallback((callback: (devices: DevicePresenceInfo[]) => void) => {
    const handlePresenceUpdate = (event: CustomEvent) => {
      callback(event.detail.devices)
    }

    window.addEventListener('devicePresenceUpdate', handlePresenceUpdate)

    const cleanup = () => {
      window.removeEventListener('devicePresenceUpdate', handlePresenceUpdate)
    }

    setEventListeners(prev => new Set([...prev, cleanup]))

    return cleanup
  }, [])

  const getDevicePresence = useCallback((deviceId: string): DevicePresenceInfo | null => {
    return devicePresence.find(device => device.deviceId === deviceId) || null
  }, [devicePresence])

  const isDeviceOnline = useCallback((deviceId: string): boolean => {
    const device = getDevicePresence(deviceId)
    return device?.isOnline || false
  }, [getDevicePresence])

  const getLastSeenText = useCallback((deviceId: string): string => {
    const device = getDevicePresence(deviceId)
    if (!device) return 'Unknown'

    if (device.isOnline) return 'Online now'

    const now = new Date()
    const lastSeen = device.lastSeen
    const diffMs = now.getTime() - lastSeen.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

    return lastSeen.toLocaleDateString()
  }, [getDevicePresence])

  const exportPresenceData = useCallback(() => {
    const presenceData = {
      timestamp: new Date().toISOString(),
      isMonitoringPresence,
      onlineCount,
      totalDeviceCount,
      currentDeviceOnline: isCurrentDeviceOnline,
      devices: devicePresence.map(device => ({
        ...device,
        // Remove sensitive data
        sessionId: device.sessionId ? '[REDACTED]' : undefined
      })),
      statistics: {
        onlineDevices: onlineCount,
        offlineDevices: offlineDevices.length,
        trustedOnline: onlineDevices.filter(d => d.trustLevel === 'trusted').length,
        untrustedOnline: onlineDevices.filter(d => d.trustLevel === 'untrusted').length
      }
    }

    logger.info('Presence data exported', undefined, undefined, {
      onlineCount,
      totalDeviceCount
    })

    return presenceData
  }, [
    isMonitoringPresence,
    onlineCount,
    totalDeviceCount,
    isCurrentDeviceOnline,
    devicePresence,
    onlineDevices,
    offlineDevices
  ])

  // Emit presence change events
  useEffect(() => {
    const previousOnlineDevices = new Set<string>()

    devicePresence.forEach(device => {
      if (device.isOnline && !previousOnlineDevices.has(device.deviceId)) {
        // Device came online
        window.dispatchEvent(new CustomEvent('devicePresenceOnline', {
          detail: { device }
        }))
      } else if (!device.isOnline && previousOnlineDevices.has(device.deviceId)) {
        // Device went offline
        window.dispatchEvent(new CustomEvent('devicePresenceOffline', {
          detail: { device }
        }))
      }

      if (device.isOnline) {
        previousOnlineDevices.add(device.deviceId)
      }
    })

    // Emit general presence update
    window.dispatchEvent(new CustomEvent('devicePresenceUpdate', {
      detail: { devices: devicePresence }
    }))
  }, [devicePresence])

  return {
    // Presence State
    onlineDevices,
    offlineDevices,
    allDevicePresence: devicePresence,
    onlineCount,
    totalDeviceCount,

    // Current Device
    currentDevicePresence,
    isCurrentDeviceOnline,

    // Real-time Updates
    updatePresence,
    broadcastPresence,

    // Presence Monitoring
    startPresenceMonitoring,
    stopPresenceMonitoring,
    isMonitoringPresence,

    // Event Handling
    onDeviceOnline,
    onDeviceOffline,
    onPresenceUpdate,

    // Utilities
    getDevicePresence,
    isDeviceOnline,
    getLastSeenText,
    exportPresenceData
  }
}