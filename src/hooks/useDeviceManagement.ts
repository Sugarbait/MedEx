/**
 * Hook for device management operations
 *
 * Provides functionality for registering, removing, and managing
 * trusted devices in the cross-device ecosystem.
 */

import { useCallback, useEffect, useState } from 'react'
import { useCrossDevice } from '@/contexts/CrossDeviceContext'
import { deviceFingerprintService } from '@/services/deviceFingerprintService'
import { secureLogger } from '@/services/secureLogger'
import type { DeviceInfo, DeviceRegistrationResult } from '@/services/deviceFingerprintService'

const logger = secureLogger.component('useDeviceManagement')

export interface DeviceManagementResult {
  // Device State
  currentDevice: DeviceInfo | null
  connectedDevices: DeviceInfo[]
  deviceCount: number
  trustedDeviceCount: number
  untrustedDeviceCount: number
  deviceTrustIssues: boolean

  // Device Operations
  registerDevice: (deviceName?: string) => Promise<boolean>
  removeDevice: (deviceId: string) => Promise<boolean>
  updateDeviceName: (deviceId: string, newName: string) => Promise<boolean>
  updateDeviceTrust: (deviceId: string, trustLevel: 'trusted' | 'untrusted' | 'unknown') => Promise<boolean>
  refreshDevices: () => Promise<void>

  // Device Info
  getCurrentDeviceFingerprint: () => Promise<string | null>
  getDeviceInfo: (deviceId: string) => DeviceInfo | null
  isDeviceTrusted: (deviceId: string) => boolean

  // Registration State
  registrationResult: DeviceRegistrationResult | null
  isRegistering: boolean

  // Utilities
  exportDeviceData: () => any
  validateCurrentDevice: () => Promise<boolean>
}

export const useDeviceManagement = (): DeviceManagementResult => {
  const {
    currentDevice,
    connectedDevices,
    deviceRegistration,
    deviceTrustIssues,
    registerDevice: contextRegisterDevice,
    removeDevice: contextRemoveDevice,
    updateDeviceTrust: contextUpdateDeviceTrust,
    refreshDeviceList
  } = useCrossDevice()

  const [isRegistering, setIsRegistering] = useState(false)

  // Calculate device counts
  const deviceCount = connectedDevices.length
  const trustedDeviceCount = connectedDevices.filter(d => d.trustLevel === 'trusted').length
  const untrustedDeviceCount = connectedDevices.filter(d => d.trustLevel === 'untrusted').length

  const registerDevice = useCallback(async (deviceName?: string): Promise<boolean> => {
    try {
      setIsRegistering(true)
      logger.debug('Registering device via hook', undefined, undefined, { deviceName })

      const result = await contextRegisterDevice(deviceName)

      if (result) {
        logger.info('Device registered successfully via hook', undefined, undefined, { deviceName })
      } else {
        logger.warn('Device registration failed via hook', undefined, undefined, { deviceName })
      }

      return result

    } catch (error) {
      logger.error('Device registration error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceName
      })
      return false
    } finally {
      setIsRegistering(false)
    }
  }, [contextRegisterDevice])

  const removeDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      logger.debug('Removing device via hook', undefined, undefined, { deviceId })

      const result = await contextRemoveDevice(deviceId)

      if (result) {
        logger.info('Device removed successfully via hook', undefined, undefined, { deviceId })
      } else {
        logger.warn('Device removal failed via hook', undefined, undefined, { deviceId })
      }

      return result

    } catch (error) {
      logger.error('Device removal error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId
      })
      return false
    }
  }, [contextRemoveDevice])

  const updateDeviceName = useCallback(async (deviceId: string, newName: string): Promise<boolean> => {
    try {
      logger.debug('Updating device name via hook', undefined, undefined, {
        deviceId,
        newName
      })

      const result = await deviceFingerprintService.updateDeviceName(deviceId, newName)

      if (result.success) {
        // Refresh the device list to show updated name
        await refreshDeviceList()
        logger.info('Device name updated successfully via hook', undefined, undefined, {
          deviceId,
          newName
        })
      } else {
        logger.warn('Device name update failed via hook', undefined, undefined, {
          deviceId,
          newName,
          error: result.error
        })
      }

      return result.success

    } catch (error) {
      logger.error('Device name update error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId,
        newName
      })
      return false
    }
  }, [refreshDeviceList])

  const updateDeviceTrust = useCallback(async (
    deviceId: string,
    trustLevel: 'trusted' | 'untrusted' | 'unknown'
  ): Promise<boolean> => {
    try {
      logger.debug('Updating device trust via hook', undefined, undefined, {
        deviceId,
        trustLevel
      })

      const result = await contextUpdateDeviceTrust(deviceId, trustLevel)

      if (result) {
        logger.info('Device trust updated successfully via hook', undefined, undefined, {
          deviceId,
          trustLevel
        })
      } else {
        logger.warn('Device trust update failed via hook', undefined, undefined, {
          deviceId,
          trustLevel
        })
      }

      return result

    } catch (error) {
      logger.error('Device trust update error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId,
        trustLevel
      })
      return false
    }
  }, [contextUpdateDeviceTrust])

  const refreshDevices = useCallback(async (): Promise<void> => {
    try {
      logger.debug('Refreshing devices via hook')
      await refreshDeviceList()
      logger.info('Devices refreshed successfully via hook')
    } catch (error) {
      logger.error('Device refresh error in hook', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }, [refreshDeviceList])

  const getCurrentDeviceFingerprint = useCallback(async (): Promise<string | null> => {
    try {
      const fingerprint = await deviceFingerprintService.generateFingerprint()
      return fingerprint
    } catch (error) {
      logger.error('Failed to get device fingerprint', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }, [])

  const getDeviceInfo = useCallback((deviceId: string): DeviceInfo | null => {
    return connectedDevices.find(device => device.id === deviceId) || null
  }, [connectedDevices])

  const isDeviceTrusted = useCallback((deviceId: string): boolean => {
    const device = getDeviceInfo(deviceId)
    return device?.trustLevel === 'trusted' || false
  }, [getDeviceInfo])

  const exportDeviceData = useCallback(() => {
    const deviceData = {
      timestamp: new Date().toISOString(),
      currentDevice: currentDevice ? {
        ...currentDevice,
        // Remove sensitive data for export
        fingerprint: '[REDACTED]'
      } : null,
      connectedDevices: connectedDevices.map(device => ({
        ...device,
        fingerprint: '[REDACTED]'
      })),
      deviceCount,
      trustedDeviceCount,
      untrustedDeviceCount,
      deviceTrustIssues,
      registrationResult: deviceRegistration ? {
        ...deviceRegistration,
        // Remove sensitive data
        deviceId: deviceRegistration.deviceId ? '[REDACTED]' : null
      } : null
    }

    logger.info('Device data exported', undefined, undefined, {
      deviceCount,
      trustedDeviceCount,
      untrustedDeviceCount
    })

    return deviceData
  }, [
    currentDevice,
    connectedDevices,
    deviceCount,
    trustedDeviceCount,
    untrustedDeviceCount,
    deviceTrustIssues,
    deviceRegistration
  ])

  const validateCurrentDevice = useCallback(async (): Promise<boolean> => {
    try {
      logger.debug('Validating current device')

      if (!currentDevice?.userId) {
        logger.warn('No current device or user ID available for validation')
        return false
      }

      const result = await deviceFingerprintService.validateDevice(currentDevice.userId)

      if (result.isValid) {
        logger.info('Current device validation successful')
      } else {
        logger.warn('Current device validation failed', undefined, undefined, {
          reason: result.reason
        })
      }

      return result.isValid

    } catch (error) {
      logger.error('Device validation error', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }, [currentDevice])

  return {
    // Device State
    currentDevice,
    connectedDevices,
    deviceCount,
    trustedDeviceCount,
    untrustedDeviceCount,
    deviceTrustIssues,

    // Device Operations
    registerDevice,
    removeDevice,
    updateDeviceName,
    updateDeviceTrust,
    refreshDevices,

    // Device Info
    getCurrentDeviceFingerprint,
    getDeviceInfo,
    isDeviceTrusted,

    // Registration State
    registrationResult: deviceRegistration,
    isRegistering,

    // Utilities
    exportDeviceData,
    validateCurrentDevice
  }
}