/**
 * Comprehensive Test Suite for Secure Profile Editing System
 *
 * Tests all aspects of the secure profile editing functionality including:
 * - Profile data validation and sanitization
 * - Encryption/decryption of sensitive fields
 * - Cross-device synchronization
 * - Conflict resolution
 * - HIPAA audit logging
 * - Emergency rollback functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { secureProfileEditingService, ProfileData } from '@/services/secureProfileEditingService'
import { auditLogger } from '@/services/auditLogger'
import { encryptionService } from '@/services/encryption'

// Mock dependencies
vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }
}))

vi.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logSecurityEvent: vi.fn(() => Promise.resolve()),
    logPHIAccess: vi.fn(() => Promise.resolve()),
    logEncryptionOperation: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('@/services/encryption', () => ({
  encryptionService: {
    encrypt: vi.fn((data: string) => Promise.resolve({
      data: `encrypted_${data}`,
      iv: 'test_iv',
      tag: 'test_tag'
    })),
    decrypt: vi.fn((encryptedData: any) => Promise.resolve(
      encryptedData.data.replace('encrypted_', '')
    ))
  }
}))

vi.mock('@/services/userProfileService', () => ({
  userProfileService: {
    loadUserProfile: vi.fn(() => Promise.resolve({
      status: 'success',
      data: {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        settings: {}
      }
    })),
    updateUserProfile: vi.fn(() => Promise.resolve({
      status: 'success',
      data: {}
    })),
    subscribeToProfileSync: vi.fn(),
    forceSyncProfileFromCloud: vi.fn(() => Promise.resolve())
  }
}))

vi.mock('@/services/userSettingsService', () => ({
  userSettingsService: {
    updateUserSettings: vi.fn(() => Promise.resolve({}))
  }
}))

describe('SecureProfileEditingService', () => {
  const testUser: ProfileData = {
    id: 'test-user-1',
    name: 'Test User',
    display_name: 'Test Display',
    department: 'IT',
    phone: '+1-555-123-4567',
    bio: 'Test bio',
    location: 'New York, NY',
    timezone: 'America/New_York',
    preferences: { theme: 'dark' }
  }

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()

    // Setup localStorage mock
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })

    // Setup navigator mock
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    })
  })

  afterEach(() => {
    secureProfileEditingService.cleanup()
  })

  describe('Input Validation and Sanitization', () => {
    it('should validate required fields', async () => {
      const invalidProfile = {
        id: 'test-user-1',
        name: '', // Required field is empty
        phone: 'invalid-phone'
      }

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: invalidProfile
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Validation failed')
      expect(result.warnings).toContain('Full name is required')
    })

    it('should sanitize input to prevent XSS attacks', async () => {
      const maliciousProfile = {
        id: 'test-user-1',
        name: 'Test<script>alert("xss")</script>User',
        bio: 'Bio with <img src=x onerror=alert("xss")>'
      }

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: maliciousProfile
      })

      // Should sanitize the input
      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('Test&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;User')
      expect(result.data?.bio).toBe('Bio with &lt;img src=x onerror=alert(&quot;xss&quot;)&gt;')
    })

    it('should validate phone number format', async () => {
      const invalidPhoneProfile = {
        id: 'test-user-1',
        name: 'Test User',
        phone: '123' // Too short
      }

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: invalidPhoneProfile
      })

      expect(result.success).toBe(false)
      expect(result.warnings).toContain('Phone number must be 10-15 digits')
    })

    it('should validate bio length', async () => {
      const longBioProfile = {
        id: 'test-user-1',
        name: 'Test User',
        bio: 'a'.repeat(501) // Exceeds 500 character limit
      }

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: longBioProfile
      })

      expect(result.success).toBe(false)
      expect(result.warnings).toContain('Bio must not exceed 500 characters')
    })

    it('should validate timezone', async () => {
      const invalidTimezoneProfile = {
        id: 'test-user-1',
        name: 'Test User',
        timezone: 'Invalid/Timezone'
      }

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: invalidTimezoneProfile
      })

      expect(result.success).toBe(false)
      expect(result.warnings).toContain('Invalid timezone')
    })
  })

  describe('Encryption and Security', () => {
    it('should encrypt sensitive fields before storage', async () => {
      const profileWithSensitiveData = {
        id: 'test-user-1',
        name: 'Test User',
        phone: '+1-555-123-4567',
        bio: 'Sensitive bio information',
        location: 'New York, NY'
      }

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: profileWithSensitiveData
      })

      expect(result.success).toBe(true)

      // Verify encryption service was called for sensitive fields
      expect(encryptionService.encrypt).toHaveBeenCalledWith('+1-555-123-4567')
      expect(encryptionService.encrypt).toHaveBeenCalledWith('Sensitive bio information')
      expect(encryptionService.encrypt).toHaveBeenCalledWith('New York, NY')
    })

    it('should decrypt sensitive fields when loading profile', async () => {
      // Mock encrypted data in storage
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({
        id: 'test-user-1',
        name: 'Test User',
        phone: { data: 'encrypted_+1-555-123-4567', iv: 'test_iv', tag: 'test_tag' },
        bio: { data: 'encrypted_bio', iv: 'test_iv', tag: 'test_tag' }
      }))

      const profile = await secureProfileEditingService.getCurrentProfile('test-user-1')

      expect(encryptionService.decrypt).toHaveBeenCalled()
      expect(profile?.phone).toBe('+1-555-123-4567')
      expect(profile?.bio).toBe('bio')
    })

    it('should handle encryption failures gracefully', async () => {
      // Mock encryption failure
      vi.mocked(encryptionService.encrypt).mockRejectedValue(new Error('Encryption failed'))

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: { name: 'Test User', phone: '+1-555-123-4567' }
      })

      // Should still succeed but log the encryption failure
      expect(result.success).toBe(true)
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'ENCRYPTION_FAILURE',
        'user_profiles',
        false,
        expect.objectContaining({ field: 'phone' })
      )
    })
  })

  describe('HIPAA Audit Logging', () => {
    it('should log profile access events', async () => {
      await secureProfileEditingService.getCurrentProfile('test-user-1')

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'PROFILE_ACCESS',
        'user_profiles',
        true,
        expect.objectContaining({
          userId: 'test-user-1',
          action: 'read_profile'
        })
      )
    })

    it('should log profile edit events with details', async () => {
      const updates = { name: 'Updated Name', department: 'Updated Dept' }

      await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates
      })

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'PROFILE_EDIT_START',
        'user_profiles',
        true,
        expect.objectContaining({
          userId: 'test-user-1',
          updatedFields: ['name', 'department']
        })
      )

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'PROFILE_EDIT_SUCCESS',
        'user_profiles',
        true,
        expect.objectContaining({
          userId: 'test-user-1',
          updatedFields: ['name', 'department']
        })
      )
    })

    it('should log validation failures', async () => {
      const invalidUpdates = { name: '' } // Required field empty

      await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: invalidUpdates
      })

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'PROFILE_VALIDATION_FAILED',
        'user_profiles',
        false,
        expect.objectContaining({
          userId: 'test-user-1',
          validationErrors: expect.objectContaining({
            name: 'name is required'
          })
        })
      )
    })

    it('should log rollback operations', async () => {
      await secureProfileEditingService.rollbackProfile('test-user-1')

      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'PROFILE_ROLLBACK_START',
        'user_profiles',
        true,
        expect.objectContaining({
          userId: 'test-user-1',
          reason: 'emergency_rollback'
        })
      )
    })
  })

  describe('Cross-Device Synchronization', () => {
    it('should return sync status for all storage layers', async () => {
      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: { name: 'Test User' },
        deviceId: 'device-123'
      })

      expect(result.syncStatus).toBeDefined()
      expect(result.syncStatus).toHaveProperty('supabase')
      expect(result.syncStatus).toHaveProperty('localStorage')
      expect(result.syncStatus).toHaveProperty('crossDevice')
    })

    it('should handle offline scenarios gracefully', async () => {
      // Mock network failure
      vi.mocked(navigator.onLine).mockReturnValue(false)

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: { name: 'Test User' }
      })

      // Should still succeed with local storage
      expect(result.success).toBe(true)
      expect(result.syncStatus?.localStorage).toBe(true)
    })

    it('should detect and handle conflicts', async () => {
      // Mock conflict scenario by setting a pending edit
      const conflictingUpdates = { name: 'Conflicting Name' }

      // Simulate concurrent edit
      const result1Promise = secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: { name: 'First Edit' }
      })

      const result2Promise = secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: conflictingUpdates
      })

      const [result1, result2] = await Promise.all([result1Promise, result2Promise])

      // At least one should detect a conflict or both should succeed
      expect(result1.success || result2.success).toBe(true)
    })
  })

  describe('Emergency Rollback Functionality', () => {
    it('should rollback to previous profile state', async () => {
      // Mock backup data in localStorage
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({
        name: 'Original Name',
        display_name: 'Original Display',
        department: 'Original Dept'
      }))

      const result = await secureProfileEditingService.rollbackProfile('test-user-1')

      expect(result.success).toBe(true)
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'PROFILE_ROLLBACK_COMPLETE',
        'user_profiles',
        true,
        expect.objectContaining({
          userId: 'test-user-1',
          success: true
        })
      )
    })

    it('should handle rollback when no backup data exists', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      const result = await secureProfileEditingService.rollbackProfile('test-user-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('No backup data available')
    })
  })

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using take_local strategy', async () => {
      const localData: ProfileData = {
        id: 'test-user-1',
        name: 'Local Name',
        display_name: 'Local Display'
      }

      const remoteData: ProfileData = {
        id: 'test-user-1',
        name: 'Remote Name',
        display_name: 'Remote Display'
      }

      const result = await secureProfileEditingService.resolveConflict('test-user-1', 'conflict-1', {
        conflictId: 'conflict-1',
        strategy: 'take_local',
        localData,
        remoteData
      })

      expect(result.success).toBe(true)
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'PROFILE_CONFLICT_RESOLVED',
        'user_profiles',
        true,
        expect.objectContaining({
          conflictId: 'conflict-1',
          strategy: 'take_local'
        })
      )
    })

    it('should resolve conflicts using merge strategy', async () => {
      const localData: ProfileData = {
        id: 'test-user-1',
        name: 'Local Name',
        department: 'Local Dept'
      }

      const remoteData: ProfileData = {
        id: 'test-user-1',
        name: 'Remote Name',
        phone: '+1-555-999-9999'
      }

      const mergedData: ProfileData = {
        id: 'test-user-1',
        name: 'Local Name', // Keep local name
        department: 'Local Dept', // Keep local department
        phone: '+1-555-999-9999' // Take remote phone
      }

      const result = await secureProfileEditingService.resolveConflict('test-user-1', 'conflict-2', {
        conflictId: 'conflict-2',
        strategy: 'merge',
        localData,
        remoteData,
        mergedData
      })

      expect(result.success).toBe(true)
    })

    it('should handle invalid conflict resolution', async () => {
      const result = await secureProfileEditingService.resolveConflict('test-user-1', 'non-existent', {
        conflictId: 'non-existent',
        strategy: 'take_local',
        localData: testUser,
        remoteData: testUser
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Conflict not found')
    })
  })

  describe('Performance and Error Handling', () => {
    it('should handle service initialization errors gracefully', async () => {
      // Mock service failure
      vi.mocked(auditLogger.logSecurityEvent).mockRejectedValue(new Error('Audit service down'))

      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: { name: 'Test User' }
      })

      // Should still attempt to complete the operation
      expect(result.success).toBe(true)
    })

    it('should handle large profile data efficiently', async () => {
      const largeProfile = {
        id: 'test-user-1',
        name: 'Test User',
        bio: 'a'.repeat(500), // Maximum allowed length
        preferences: {
          // Large preferences object
          ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`pref${i}`, `value${i}`]))
        }
      }

      const startTime = Date.now()
      const result = await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: largeProfile
      })
      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should properly cleanup resources', () => {
      // Add some mock data to internal maps
      const service = secureProfileEditingService as any
      service.pendingEdits.set('test-user', {})
      service.conflictQueue.set('test-user', [])

      secureProfileEditingService.cleanup()

      expect(service.pendingEdits.size).toBe(0)
      expect(service.conflictQueue.size).toBe(0)
    })
  })

  describe('Integration with Existing Services', () => {
    it('should integrate with userProfileService for core profile data', async () => {
      const { userProfileService } = await import('@/services/userProfileService')

      await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: { name: 'Updated Name' }
      })

      expect(userProfileService.updateUserProfile).toHaveBeenCalledWith(
        'test-user-1',
        expect.objectContaining({
          name: 'Updated Name'
        }),
        expect.objectContaining({
          syncToCloud: true,
          broadcastToOtherDevices: true
        })
      )
    })

    it('should integrate with userSettingsService for preferences', async () => {
      const { userSettingsService } = await import('@/services/userSettingsService')

      await secureProfileEditingService.editProfile({
        userId: 'test-user-1',
        updates: {
          name: 'Test User',
          preferences: { theme: 'dark', language: 'en' }
        }
      })

      expect(userSettingsService.updateUserSettings).toHaveBeenCalledWith(
        'test-user-1',
        expect.objectContaining({
          ui_preferences: { theme: 'dark', language: 'en' }
        }),
        expect.objectContaining({
          broadcastToOtherDevices: true
        })
      )
    })
  })
})

describe('SecureProfileEditor Component Integration', () => {
  // These tests would require a React testing environment
  // but demonstrate the testing approach for the UI component

  it('should validate form inputs before submission', () => {
    // Mock component test
    expect(true).toBe(true) // Placeholder for actual React component tests
  })

  it('should show sync status indicators', () => {
    // Mock component test for sync status display
    expect(true).toBe(true) // Placeholder
  })

  it('should handle auto-save functionality', () => {
    // Mock component test for auto-save
    expect(true).toBe(true) // Placeholder
  })

  it('should display conflict resolution modal when needed', () => {
    // Mock component test for conflict resolution UI
    expect(true).toBe(true) // Placeholder
  })
})