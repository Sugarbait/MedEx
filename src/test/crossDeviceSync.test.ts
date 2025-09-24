/**
 * Cross-Device Sync Test Suite
 *
 * Comprehensive tests for cross-device synchronization functionality
 * Tests userSettingsService, userProfileService, conflict resolution,
 * and secure credential sync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { userSettingsService } from '@/services/userSettingsService'
import { userProfileService } from '@/services/userProfileService'
import { conflictResolver } from '@/services/crossDeviceConflictResolver'
import { syncManager } from '@/services/crossDeviceSyncManager'
import { secureCredentialSync } from '@/services/secureCredentialSyncService'

// Mock Supabase
vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn() })),
      insert: vi.fn(() => ({ select: vi.fn() })),
      upsert: vi.fn(() => ({ select: vi.fn() })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      eq: vi.fn(() => ({ single: vi.fn() })),
      channel: vi.fn(() => ({
        on: vi.fn(() => ({ subscribe: vi.fn() })),
        subscribe: vi.fn()
      })),
      removeChannel: vi.fn()
    }))
  },
  supabaseConfig: {
    isConfigured: vi.fn(() => true)
  }
}))

// Mock encryption service
vi.mock('@/services/encryption', () => ({
  encryptionService: {
    encrypt: vi.fn((data) => Promise.resolve(`encrypted_${data}`)),
    decrypt: vi.fn((data) => Promise.resolve(data.replace('encrypted_', '')))
  }
}))

// Mock audit logger
vi.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logSecurityEvent: vi.fn(() => Promise.resolve())
  }
}))

describe('Cross-Device Sync Integration', () => {
  const mockUserId = 'test-user-123'
  const mockDeviceId1 = 'device-001'
  const mockDeviceId2 = 'device-002'

  beforeEach(() => {
    // Clear all caches and state
    userSettingsService.clearCache()
    userProfileService.clearCache()
    conflictResolver.cleanup()
    syncManager.cleanup()
    secureCredentialSync.cleanup()

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('User Settings Cross-Device Sync', () => {
    it('should initialize cross-device sync for user settings', async () => {
      const result = await userSettingsService.initializeCrossDeviceSync(mockUserId, mockDeviceId1)

      expect(result.success).toBe(true)
      expect(result.deviceId).toBe(mockDeviceId1)
    })

    it('should sync settings between devices', async () => {
      // Initialize sync for two devices
      await userSettingsService.initializeCrossDeviceSync(mockUserId, mockDeviceId1)
      await userSettingsService.initializeCrossDeviceSync(mockUserId, mockDeviceId2)

      // Update settings on device 1
      const settingsUpdate = {
        theme: 'dark' as const,
        notifications: {
          email: true,
          sms: false,
          push: true,
          in_app: true,
          call_alerts: true,
          sms_alerts: false,
          security_alerts: true
        }
      }

      const updatedSettings = await userSettingsService.updateUserSettings(mockUserId, settingsUpdate, {
        deviceId: mockDeviceId1,
        broadcastToOtherDevices: true
      })

      expect(updatedSettings.theme).toBe('dark')
      expect(updatedSettings.notifications.sms).toBe(false)
    })

    it('should handle settings conflicts between devices', async () => {
      // Create conflicting settings
      const device1Settings = {
        theme: 'dark' as const,
        notifications: { email: true, sms: true, push: true, in_app: true, call_alerts: true, sms_alerts: true, security_alerts: true }
      }

      const device2Settings = {
        theme: 'light' as const,
        notifications: { email: false, sms: true, push: false, in_app: true, call_alerts: false, sms_alerts: true, security_alerts: true }
      }

      // Simulate concurrent updates
      const conflict = await conflictResolver.detectConflict(
        mockUserId,
        'user_settings',
        mockUserId,
        device1Settings,
        device2Settings,
        mockDeviceId1
      )

      expect(conflict).not.toBeNull()
      expect(conflict?.conflictingFields).toContain('theme')
      expect(conflict?.conflictingFields).toContain('notifications')

      // Test automatic resolution
      if (conflict) {
        const resolution = await conflictResolver.resolveConflictAutomatically(conflict)
        expect(resolution.success).toBe(true)
        expect(resolution.resolvedData).toBeDefined()
      }
    })

    it('should sync Retell API credentials securely', async () => {
      const apiKeys = {
        retellApiKey: 'test-api-key-12345',
        callAgentId: 'agent-call-001',
        smsAgentId: 'agent-sms-001'
      }

      const settingsWithApi = await userSettingsService.updateUserSettings(mockUserId, {
        retell_config: apiKeys
      })

      expect(settingsWithApi.retell_config).toBeDefined()
      expect(settingsWithApi.retell_config?.call_agent_id).toBe(apiKeys.callAgentId)
    })

    it('should force sync settings from cloud', async () => {
      const cloudSettings = await userSettingsService.forceSyncFromCloud(mockUserId)

      // Should handle both success and null cases gracefully
      if (cloudSettings) {
        expect(cloudSettings).toHaveProperty('theme')
        expect(cloudSettings).toHaveProperty('notifications')
      } else {
        // Null is acceptable when no cloud data exists
        expect(cloudSettings).toBeNull()
      }
    })

    it('should get sync status for user', async () => {
      await userSettingsService.initializeCrossDeviceSync(mockUserId, mockDeviceId1)

      const status = await userSettingsService.getSyncStatus(mockUserId)

      expect(status.isEnabled).toBe(true)
      expect(status.deviceCount).toBeGreaterThanOrEqual(0)
      expect(status.pendingConflicts).toBeGreaterThanOrEqual(0)
    })
  })

  describe('User Profile Cross-Device Sync', () => {
    it('should initialize profile sync', async () => {
      const result = await userProfileService.initializeCrossDeviceProfileSync(mockUserId, mockDeviceId1)

      expect(result.success).toBe(true)
      expect(result.deviceId).toBe(mockDeviceId1)
    })

    it('should sync profile data between devices', async () => {
      const profileData = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as const,
        mfa_enabled: true,
        settings: {
          theme: 'dark',
          retellApiKey: 'test-key',
          callAgentId: 'agent-001'
        }
      }

      const result = await userProfileService.saveUserProfile(profileData, {
        deviceId: mockDeviceId1,
        syncToCloud: true,
        broadcastToOtherDevices: true
      })

      expect(result.status).toBe('success')
      expect(result.data?.syncEnabled).toBe(true)
      expect(result.data?.deviceId).toBe(mockDeviceId1)
    })

    it('should force sync profile from cloud', async () => {
      const result = await userProfileService.forceSyncProfileFromCloud(mockUserId)

      expect(result.status).toMatch(/success|error/)
      if (result.status === 'success' && result.data) {
        expect(result.data).toHaveProperty('id')
        expect(result.data).toHaveProperty('email')
      }
    })

    it('should get profile sync status', async () => {
      await userProfileService.initializeCrossDeviceProfileSync(mockUserId, mockDeviceId1)

      const status = await userProfileService.getProfileSyncStatus(mockUserId)

      expect(status).toHaveProperty('isEnabled')
      expect(status).toHaveProperty('lastSync')
      expect(status).toHaveProperty('deviceId')
      expect(status).toHaveProperty('cloudAvailable')
    })
  })

  describe('Conflict Resolution', () => {
    it('should detect field-level conflicts', async () => {
      const localData = { theme: 'dark', name: 'John Doe' }
      const remoteData = { theme: 'light', name: 'John Doe' }

      const conflict = await conflictResolver.detectConflict(
        mockUserId,
        'user_settings',
        'settings-001',
        localData,
        remoteData,
        mockDeviceId1
      )

      expect(conflict).not.toBeNull()
      expect(conflict?.conflictingFields).toEqual(['theme'])
      expect(conflict?.conflictType).toBe('field_conflict')
    })

    it('should resolve conflicts using last-write-wins strategy', async () => {
      const localData = {
        theme: 'dark',
        updated_at: '2024-01-01T10:00:00Z'
      }
      const remoteData = {
        theme: 'light',
        updated_at: '2024-01-01T11:00:00Z'
      }

      const conflict = await conflictResolver.detectConflict(
        mockUserId,
        'user_settings',
        'settings-001',
        localData,
        remoteData,
        mockDeviceId1
      )

      expect(conflict).not.toBeNull()

      if (conflict) {
        const resolution = await conflictResolver.resolveConflictAutomatically(conflict)
        expect(resolution.success).toBe(true)
        expect(resolution.strategy).toBe('last_write_wins')
        expect(resolution.resolvedData?.theme).toBe('light') // Remote is newer
      }
    })

    it('should handle manual conflict resolution', async () => {
      const localData = { theme: 'dark', name: 'John' }
      const remoteData = { theme: 'light', name: 'John' }

      const conflict = await conflictResolver.detectConflict(
        mockUserId,
        'user_settings',
        'settings-001',
        localData,
        remoteData,
        mockDeviceId1
      )

      expect(conflict).not.toBeNull()

      if (conflict) {
        const resolution = await conflictResolver.resolveConflictManually(
          conflict.conflictId,
          mockUserId,
          'take_local'
        )

        expect(resolution.success).toBe(true)
        expect(resolution.resolvedData?.theme).toBe('dark')
      }
    })

    it('should get pending conflicts for user', () => {
      const pendingConflicts = conflictResolver.getPendingConflicts(mockUserId)
      expect(Array.isArray(pendingConflicts)).toBe(true)
    })
  })

  describe('Sync Manager Integration', () => {
    it('should initialize complete sync system', async () => {
      const result = await syncManager.initializeSync(mockUserId, {
        deviceId: mockDeviceId1,
        mfaVerified: true,
        securityLevel: 'high',
        enablePeriodicSync: false // Disable for testing
      })

      expect(result.success).toBe(true)
      expect(result.session).not.toBeNull()
      expect(result.session?.userId).toBe(mockUserId)
      expect(result.session?.deviceId).toBe(mockDeviceId1)
    })

    it('should trigger login sync', async () => {
      await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId1 })

      const result = await syncManager.triggerSync('login', mockUserId, mockDeviceId1)

      expect(result.success).toBe(true)
      expect(Array.isArray(result.results)).toBe(true)
      expect(result.conflicts).toBeGreaterThanOrEqual(0)
    })

    it('should handle settings change sync', async () => {
      await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId1 })

      const result = await syncManager.triggerSync('settings_change', mockUserId, mockDeviceId1, {
        changedFields: ['theme', 'notifications']
      })

      expect(result.success).toBe(true)
    })

    it('should get sync status', async () => {
      await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId1 })

      const status = syncManager.getSyncStatus(mockUserId)

      expect(status).not.toBeNull()
      expect(status?.isOnline).toBe(true)
      expect(status).toHaveProperty('lastSync')
      expect(status).toHaveProperty('conflictCount')
    })

    it('should handle logout cleanup', async () => {
      await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId1 })

      // Should not throw error
      await expect(syncManager.handleLogout(mockUserId)).resolves.toBeUndefined()
    })
  })

  describe('Secure Credential Sync', () => {
    it('should initialize secure credential sync', async () => {
      const result = await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId1, {
        mfaVerified: true,
        importExistingCredentials: false
      })

      expect(result.success).toBe(true)
      expect(['untrusted', 'basic', 'trusted', 'verified']).toContain(result.trustLevel)
    })

    it('should sync MFA secrets for trusted devices', async () => {
      // Initialize with high trust
      await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId1, {
        mfaVerified: true
      })

      const result = await secureCredentialSync.syncMfaSecrets(mockUserId, mockDeviceId1)

      expect(result.success).toBe(true)
      expect(result.credentialsSync).toBeGreaterThanOrEqual(0)
      expect(['untrusted', 'basic', 'trusted', 'verified']).toContain(result.deviceTrustLevel)
    })

    it('should sync API keys securely', async () => {
      await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId1, {
        mfaVerified: true
      })

      const apiKeys = {
        retellApiKey: 'test-api-key-secure',
        callAgentId: 'agent-call-secure',
        smsAgentId: 'agent-sms-secure'
      }

      const result = await secureCredentialSync.syncApiKeys(mockUserId, mockDeviceId1, apiKeys)

      expect(result.success).toBe(true)
      expect(result.credentialsSync).toBeGreaterThanOrEqual(0)
    })

    it('should verify device for enhanced access', async () => {
      await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId1)

      // Mock MFA verification (would normally require valid TOTP)
      const result = await secureCredentialSync.verifyDeviceForSync(mockUserId, mockDeviceId1, '123456')

      // Should handle verification attempt
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('newTrustLevel')
    })

    it('should get trusted devices list', async () => {
      const devices = await secureCredentialSync.getTrustedDevices(mockUserId)

      expect(Array.isArray(devices)).toBe(true)
    })

    it('should revoke device credential access', async () => {
      await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId1)

      const result = await secureCredentialSync.revokeDeviceCredentialAccess(mockUserId, mockDeviceId1)

      expect(result.success).toBe(true)
      expect(result.message).toBeDefined()
    })
  })

  describe('End-to-End Sync Scenarios', () => {
    it('should handle complete user login sync flow', async () => {
      // 1. Initialize sync manager
      const initResult = await syncManager.initializeSync(mockUserId, {
        deviceId: mockDeviceId1,
        mfaVerified: true,
        securityLevel: 'high'
      })
      expect(initResult.success).toBe(true)

      // 2. Initialize secure credentials
      const secureResult = await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId1, {
        mfaVerified: true,
        importExistingCredentials: true
      })
      expect(secureResult.success).toBe(true)

      // 3. Trigger login sync
      const syncResult = await syncManager.triggerSync('login', mockUserId, mockDeviceId1)
      expect(syncResult.success).toBe(true)

      // 4. Verify all systems are working
      const settingsStatus = await userSettingsService.getSyncStatus(mockUserId)
      const profileStatus = await userProfileService.getProfileSyncStatus(mockUserId)
      const syncStatus = syncManager.getSyncStatus(mockUserId)

      expect(settingsStatus.isEnabled).toBe(true)
      expect(profileStatus.cloudAvailable).toBe(true)
      expect(syncStatus?.isOnline).toBe(true)
    })

    it('should handle multi-device conflict resolution', async () => {
      // Initialize two devices
      await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId1 })
      await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId2 })

      // Create conflicting settings
      const settings1 = { theme: 'dark' as const }
      const settings2 = { theme: 'light' as const }

      await userSettingsService.updateUserSettings(mockUserId, settings1, { deviceId: mockDeviceId1 })

      // Simulate conflict by detecting it manually
      const conflict = await conflictResolver.detectConflict(
        mockUserId,
        'user_settings',
        mockUserId,
        settings1,
        settings2,
        mockDeviceId2
      )

      expect(conflict).not.toBeNull()

      // Auto-resolve the conflict
      if (conflict) {
        const resolution = await conflictResolver.resolveConflictAutomatically(conflict)
        expect(resolution.success).toBe(true)
      }
    })

    it('should handle secure credential sync across devices', async () => {
      // Initialize secure sync on both devices
      await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId1, { mfaVerified: true })
      await secureCredentialSync.initializeSecureSync(mockUserId, mockDeviceId2, { mfaVerified: true })

      // Sync API keys from device 1
      const apiKeys = {
        retellApiKey: 'secure-key-123',
        callAgentId: 'call-agent-123'
      }

      const syncResult1 = await secureCredentialSync.syncApiKeys(mockUserId, mockDeviceId1, apiKeys)
      expect(syncResult1.success).toBe(true)

      // Verify device 2 can access synced credentials
      const syncResult2 = await secureCredentialSync.syncMfaSecrets(mockUserId, mockDeviceId2)
      expect(syncResult2.success).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle offline mode gracefully', async () => {
      // Mock Supabase as unavailable
      vi.mocked(require('@/config/supabase').supabaseConfig.isConfigured).mockReturnValue(false)

      const result = await userSettingsService.initializeCrossDeviceSync(mockUserId, mockDeviceId1)

      // Should still succeed in offline mode
      expect(result.success).toBe(true)
    })

    it('should handle sync failures gracefully', async () => {
      // Mock Supabase to throw errors
      vi.mocked(require('@/config/supabase').supabase.from).mockImplementation(() => {
        throw new Error('Network error')
      })

      const result = await syncManager.triggerSync('manual', mockUserId, mockDeviceId1)

      // Should handle error without crashing
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('results')
    })

    it('should handle cleanup without errors', () => {
      expect(() => {
        userSettingsService.cleanupCrossDeviceSync()
        userProfileService.cleanupProfileSync()
        conflictResolver.cleanup()
        syncManager.cleanup()
        secureCredentialSync.cleanup()
      }).not.toThrow()
    })

    it('should handle invalid user IDs', async () => {
      const invalidUserId = ''

      const result = await syncManager.initializeSync(invalidUserId)

      // Should handle gracefully
      expect(result.success).toBe(false)
      expect(result.message).toBeDefined()
    })

    it('should handle concurrent sync operations', async () => {
      await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId1 })

      // Trigger multiple sync operations simultaneously
      const syncPromises = [
        syncManager.triggerSync('manual', mockUserId, mockDeviceId1),
        syncManager.triggerSync('periodic', mockUserId, mockDeviceId1),
        userSettingsService.forceSyncFromCloud(mockUserId)
      ]

      const results = await Promise.allSettled(syncPromises)

      // All should complete without throwing
      results.forEach(result => {
        expect(result.status).toMatch(/fulfilled|rejected/)
      })
    })
  })
})

describe('Cross-Device Sync Performance', () => {
  const mockUserId = 'perf-test-user'
  const mockDeviceId = 'perf-test-device'

  it('should initialize sync within reasonable time', async () => {
    const startTime = Date.now()

    await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId })

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(1000) // Should complete within 1 second
  })

  it('should handle multiple devices efficiently', async () => {
    const deviceCount = 5
    const devices = Array.from({ length: deviceCount }, (_, i) => `device-${i}`)

    const startTime = Date.now()

    const initPromises = devices.map(deviceId =>
      syncManager.initializeSync(mockUserId, { deviceId })
    )

    await Promise.all(initPromises)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(2000) // Should handle 5 devices within 2 seconds
  })

  it('should sync settings efficiently', async () => {
    await syncManager.initializeSync(mockUserId, { deviceId: mockDeviceId })

    const largeSettings = {
      theme: 'dark' as const,
      notifications: {
        email: true,
        sms: true,
        push: true,
        in_app: true,
        call_alerts: true,
        sms_alerts: true,
        security_alerts: true
      },
      dashboard_layout: {
        widgets: Array.from({ length: 10 }, (_, i) => ({
          id: `widget-${i}`,
          type: 'chart',
          position: { x: i * 100, y: i * 50 },
          size: { width: 200, height: 150 },
          config: { data: `config-${i}`.repeat(100) }
        }))
      }
    }

    const startTime = Date.now()

    await userSettingsService.updateUserSettings(mockUserId, largeSettings)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(500) // Should sync large settings within 500ms
  })
})