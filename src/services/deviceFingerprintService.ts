/**
 * HIPAA-Compliant Device Fingerprinting Service
 *
 * Generates unique device fingerprints for secure device identification
 * while maintaining user privacy and HIPAA compliance.
 *
 * Features:
 * - Browser fingerprinting using non-sensitive characteristics
 * - Device registration and trust level management
 * - Secure device validation
 * - Cross-device synchronization support
 */

import { supabase } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import { secureStorage } from '@/services/secureStorage'
import { auditLogger } from '@/services/auditLogger'
import { encryptionService } from '@/services/encryption'
import { UserDevice } from '@/types/supabase'

const logger = secureLogger.component('DeviceFingerprintService')

export interface DeviceFingerprint {
  id: string
  platform: string
  browserName: string
  browserVersion: string
  screenResolution: string
  timezone: string
  language: string
  hardwareConcurrency: number
  deviceMemory?: number
  colorDepth: number
  pixelRatio: number
  touchSupport: boolean
  webglVendor?: string
  webglRenderer?: string
  audioFingerprint?: string
}

export interface DeviceInfo {
  fingerprint: DeviceFingerprint
  trustLevel: 'unknown' | 'trusted' | 'suspicious' | 'blocked'
  isRegistered: boolean
  lastSeen: string
  registrationDate?: string
  deviceName?: string
}

export interface DeviceRegistrationResult {
  success: boolean
  deviceId?: string
  trustLevel: 'unknown' | 'trusted' | 'suspicious' | 'blocked'
  requiresVerification: boolean
  error?: string
}

class DeviceFingerprintService {
  private deviceInfo: DeviceInfo | null = null
  private fingerprintCache: Map<string, DeviceFingerprint> = new Map()

  /**
   * Generate a unique device fingerprint using browser characteristics
   */
  async generateFingerprint(): Promise<DeviceFingerprint> {
    try {
      logger.debug('Generating device fingerprint')

      // Generate a unique device ID based on stable characteristics
      const characteristics = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages?.join(',') || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenResolution: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency,
        touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack
      }

      // Parse user agent for browser info
      const browserInfo = this.parseBrowserInfo(navigator.userAgent)

      // Get WebGL info (if available)
      const webglInfo = this.getWebGLInfo()

      // Get device memory (if available)
      const deviceMemory = (navigator as any).deviceMemory

      // Generate audio fingerprint (minimal, privacy-friendly)
      const audioFingerprint = await this.generateAudioFingerprint()

      // Create stable hash from characteristics
      const fingerprintData = JSON.stringify({
        ...characteristics,
        ...browserInfo,
        ...webglInfo,
        deviceMemory,
        audioFingerprint
      })

      const fingerprintHash = await this.hashFingerprint(fingerprintData)

      const fingerprint: DeviceFingerprint = {
        id: fingerprintHash,
        platform: characteristics.platform,
        browserName: browserInfo.name,
        browserVersion: browserInfo.version,
        screenResolution: characteristics.screenResolution,
        timezone: characteristics.timezone,
        language: characteristics.language,
        hardwareConcurrency: characteristics.hardwareConcurrency,
        deviceMemory,
        colorDepth: characteristics.colorDepth,
        pixelRatio: characteristics.pixelRatio,
        touchSupport: characteristics.touchSupport,
        webglVendor: webglInfo.vendor,
        webglRenderer: webglInfo.renderer,
        audioFingerprint
      }

      // Cache the fingerprint
      this.fingerprintCache.set(fingerprintHash, fingerprint)

      logger.info('Device fingerprint generated successfully')
      return fingerprint

    } catch (error) {
      logger.error('Failed to generate device fingerprint', '', undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
      throw new Error('Failed to generate device fingerprint')
    }
  }

  /**
   * Register a device for a user
   */
  async registerDevice(
    userId: string,
    deviceName?: string,
    trustLevel: 'unknown' | 'trusted' = 'unknown'
  ): Promise<DeviceRegistrationResult> {
    try {
      logger.debug('Registering device for user', userId)

      const fingerprint = await this.generateFingerprint()

      // Check if device is already registered
      const existingDevice = await this.getRegisteredDevice(userId, fingerprint.id)

      if (existingDevice) {
        // Update last seen
        await this.updateDeviceLastSeen(existingDevice.id)

        return {
          success: true,
          deviceId: existingDevice.id,
          trustLevel: existingDevice.trust_level as 'unknown' | 'trusted' | 'suspicious' | 'blocked',
          requiresVerification: existingDevice.trust_level === 'unknown' || existingDevice.trust_level === 'suspicious'
        }
      }

      // Encrypt device fingerprint for storage
      const encryptedFingerprint = await encryptionService.encryptData(JSON.stringify(fingerprint))

      // Insert new device registration
      const { data: newDevice, error } = await supabase
        .from('user_devices')
        .insert({
          user_id: userId,
          device_fingerprint: encryptedFingerprint,
          device_name: deviceName || this.generateDeviceName(fingerprint),
          trust_level: trustLevel,
          is_active: true,
          metadata: {
            browser: fingerprint.browserName,
            platform: fingerprint.platform,
            registrationDate: new Date().toISOString()
          }
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to register device in database', userId, undefined, { error: error.message })
        throw new Error('Failed to register device')
      }

      // Store device info locally
      await this.storeDeviceInfoLocally(newDevice, fingerprint)

      // Log audit event
      await auditLogger.logSecurityEvent({
        action: 'device_registered',
        resource: 'user_devices',
        resourceId: newDevice.id,
        userId,
        details: {
          deviceName: newDevice.device_name,
          trustLevel: newDevice.trust_level,
          browser: fingerprint.browserName,
          platform: fingerprint.platform
        },
        severity: 'medium'
      })

      logger.info('Device registered successfully', userId)

      return {
        success: true,
        deviceId: newDevice.id,
        trustLevel: newDevice.trust_level as 'unknown' | 'trusted' | 'suspicious' | 'blocked',
        requiresVerification: newDevice.trust_level === 'unknown'
      }

    } catch (error) {
      logger.error('Failed to register device', userId, undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
      return {
        success: false,
        trustLevel: 'unknown',
        requiresVerification: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Validate device against registered devices
   */
  async validateDevice(userId: string): Promise<{ isValid: boolean; deviceId?: string; trustLevel?: string }> {
    try {
      logger.debug('Validating device for user', userId)

      const fingerprint = await this.generateFingerprint()
      const device = await this.getRegisteredDevice(userId, fingerprint.id)

      if (!device) {
        logger.warn('Device not registered for user', userId)
        return { isValid: false }
      }

      if (!device.is_active) {
        logger.warn('Device is inactive for user', userId)
        return { isValid: false, deviceId: device.id, trustLevel: device.trust_level }
      }

      // Update last seen
      await this.updateDeviceLastSeen(device.id)

      logger.info('Device validated successfully', userId)
      return {
        isValid: true,
        deviceId: device.id,
        trustLevel: device.trust_level
      }

    } catch (error) {
      logger.error('Failed to validate device', userId, undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
      return { isValid: false }
    }
  }

  /**
   * Update device trust level
   */
  async updateDeviceTrustLevel(
    deviceId: string,
    trustLevel: 'trusted' | 'suspicious' | 'blocked'
  ): Promise<boolean> {
    try {
      logger.debug('Updating device trust level', '', undefined, { deviceId, trustLevel })

      const { error } = await supabase
        .from('user_devices')
        .update({ trust_level: trustLevel, updated_at: new Date().toISOString() })
        .eq('id', deviceId)

      if (error) {
        logger.error('Failed to update device trust level', '', undefined, { error: error.message })
        return false
      }

      // Log audit event
      await auditLogger.logSecurityEvent({
        action: 'device_trust_updated',
        resource: 'user_devices',
        resourceId: deviceId,
        details: { newTrustLevel: trustLevel },
        severity: trustLevel === 'blocked' ? 'high' : 'medium'
      })

      logger.info('Device trust level updated successfully', '', undefined, { deviceId, trustLevel })
      return true

    } catch (error) {
      logger.error('Failed to update device trust level', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId,
        trustLevel
      })
      return false
    }
  }

  /**
   * Get all registered devices for a user
   */
  async getUserDevices(userId: string): Promise<UserDevice[]> {
    try {
      logger.debug('Fetching user devices', userId)

      const { data: devices, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_seen', { ascending: false })

      if (error) {
        logger.error('Failed to fetch user devices', userId, undefined, { error: error.message })
        return []
      }

      logger.info('User devices fetched successfully', userId, undefined, { deviceCount: devices.length })
      return devices

    } catch (error) {
      logger.error('Failed to fetch user devices', userId, undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
      return []
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(deviceId: string): Promise<boolean> {
    try {
      logger.debug('Deactivating device', '', undefined, { deviceId })

      const { error } = await supabase
        .from('user_devices')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', deviceId)

      if (error) {
        logger.error('Failed to deactivate device', '', undefined, { error: error.message })
        return false
      }

      // Log audit event
      await auditLogger.logSecurityEvent({
        action: 'device_deactivated',
        resource: 'user_devices',
        resourceId: deviceId,
        details: { reason: 'manual_deactivation' },
        severity: 'medium'
      })

      logger.info('Device deactivated successfully', '', undefined, { deviceId })
      return true

    } catch (error) {
      logger.error('Failed to deactivate device', '', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceId
      })
      return false
    }
  }

  /**
   * Get current device info
   */
  async getCurrentDeviceInfo(): Promise<DeviceInfo | null> {
    if (this.deviceInfo) {
      return this.deviceInfo
    }

    try {
      const fingerprint = await this.generateFingerprint()
      const storedInfo = await secureStorage.getItem(`device_info_${fingerprint.id}`)

      if (storedInfo) {
        this.deviceInfo = JSON.parse(storedInfo)
        return this.deviceInfo
      }

      // Create new device info
      this.deviceInfo = {
        fingerprint,
        trustLevel: 'unknown',
        isRegistered: false,
        lastSeen: new Date().toISOString()
      }

      return this.deviceInfo

    } catch (error) {
      logger.error('Failed to get current device info', '', undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }

  // Private helper methods

  private async getRegisteredDevice(userId: string, fingerprintId: string): Promise<UserDevice | null> {
    try {
      const { data: devices, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error || !devices) {
        return null
      }

      // Check each device's fingerprint
      for (const device of devices) {
        try {
          const decryptedFingerprint = await encryptionService.decryptData(device.device_fingerprint)
          const fingerprint = JSON.parse(decryptedFingerprint)

          if (fingerprint.id === fingerprintId) {
            return device
          }
        } catch {
          // Skip devices with corrupted fingerprints
          continue
        }
      }

      return null

    } catch (error) {
      logger.error('Failed to get registered device', userId, undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
      return null
    }
  }

  private async updateDeviceLastSeen(deviceId: string): Promise<void> {
    try {
      await supabase
        .from('user_devices')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', deviceId)
    } catch (error) {
      // Non-critical error, log but don't throw
      logger.warn('Failed to update device last seen', '', undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async storeDeviceInfoLocally(device: UserDevice, fingerprint: DeviceFingerprint): Promise<void> {
    try {
      const deviceInfo: DeviceInfo = {
        fingerprint,
        trustLevel: device.trust_level as 'unknown' | 'trusted' | 'suspicious' | 'blocked',
        isRegistered: true,
        lastSeen: device.last_seen,
        registrationDate: device.created_at,
        deviceName: device.device_name
      }

      await secureStorage.setItem(`device_info_${fingerprint.id}`, JSON.stringify(deviceInfo))
      this.deviceInfo = deviceInfo

    } catch (error) {
      logger.warn('Failed to store device info locally', '', undefined, { error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private parseBrowserInfo(userAgent: string): { name: string; version: string } {
    const browsers = [
      { name: 'Chrome', pattern: /Chrome\/(\d+)/ },
      { name: 'Firefox', pattern: /Firefox\/(\d+)/ },
      { name: 'Safari', pattern: /Safari\/(\d+)/ },
      { name: 'Edge', pattern: /Edg\/(\d+)/ },
      { name: 'Opera', pattern: /OPR\/(\d+)/ }
    ]

    for (const browser of browsers) {
      const match = userAgent.match(browser.pattern)
      if (match) {
        return { name: browser.name, version: match[1] }
      }
    }

    return { name: 'Unknown', version: '0' }
  }

  private getWebGLInfo(): { vendor?: string; renderer?: string } {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

      if (!gl) return {}

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (!debugInfo) return {}

      return {
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      }
    } catch {
      return {}
    }
  }

  private async generateAudioFingerprint(): Promise<string | undefined> {
    try {
      // Simple audio context fingerprint (minimal for privacy)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const analyser = audioContext.createAnalyser()

      oscillator.connect(analyser)
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime)
      oscillator.start()

      const frequencyData = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(frequencyData)

      oscillator.stop()
      audioContext.close()

      // Create a simple hash from frequency data
      return Array.from(frequencyData.slice(0, 10)).join(',')

    } catch {
      return undefined
    }
  }

  private async hashFingerprint(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const encodedData = encoder.encode(data)
      const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
      // Fallback to simple hash if Web Crypto API is not available
      let hash = 0
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16)
    }
  }

  private generateDeviceName(fingerprint: DeviceFingerprint): string {
    const platform = fingerprint.platform.includes('Win') ? 'Windows' :
                    fingerprint.platform.includes('Mac') ? 'Mac' :
                    fingerprint.platform.includes('Linux') ? 'Linux' :
                    fingerprint.platform.includes('iPhone') ? 'iPhone' :
                    fingerprint.platform.includes('Android') ? 'Android' : 'Unknown'

    return `${fingerprint.browserName} on ${platform}`
  }
}

// Export singleton instance
export const deviceFingerprintService = new DeviceFingerprintService()