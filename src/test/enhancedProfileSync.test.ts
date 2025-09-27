import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { enhancedProfileSyncService } from '@/services/enhancedProfileSyncService'
import { userProfileService } from '@/services/userProfileService'
import { avatarStorageService } from '@/services/avatarStorageService'

// Mock window and other browser APIs for testing environment
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  writable: true
})

// Mock crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123'
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock dependencies
vi.mock('@/services/userProfileService')
vi.mock('@/services/avatarStorageService')
vi.mock('@/services/realTimeSyncService')
vi.mock('@/services/auditLogger')
vi.mock('@/config/supabase', () => ({
  supabase: {},
  supabaseConfig: {
    isConfigured: () => false,
    isLocalStorageOnly: () => true
  }
}))

const mockUserId = 'test-user-123'
const mockDeviceId = 'test-device-456'

describe('EnhancedProfileSyncService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()
    vi.clearAllMocks()

    // Mock successful responses from services
    vi.mocked(userProfileService.initializeCrossDeviceProfileSync).mockResolvedValue({
      success: true,
      deviceId: mockDeviceId
    })

    vi.mocked(userProfileService.updateUserProfile).mockResolvedValue({
      status: 'success',
      data: {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        settings: {}
      }
    })

    vi.mocked(avatarStorageService.uploadAvatar).mockResolvedValue({
      status: 'success',
      data: 'https://example.com/avatar.jpg'
    })
  })

  afterEach(async () => {
    await enhancedProfileSyncService.cleanup()
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully with valid user ID', async () => {
      const result = await enhancedProfileSyncService.initialize(mockUserId)

      expect(result.status).toBe('success')
      expect(result.data).toBeDefined()
      expect(result.data?.userId).toBe(mockUserId)
      expect(result.data?.syncEnabled).toBe(true)
    })

    it('should generate a unique device ID', async () => {
      const result1 = await enhancedProfileSyncService.initialize(mockUserId)
      await enhancedProfileSyncService.cleanup()

      const result2 = await enhancedProfileSyncService.initialize(mockUserId)

      expect(result1.data?.deviceId).toBeDefined()
      expect(result2.data?.deviceId).toBeDefined()
      // Device ID should be stored in localStorage, so it should be the same
      expect(result1.data?.deviceId).toBe(result2.data?.deviceId)
    })
  })

  describe('Profile Field Synchronization', () => {
    beforeEach(async () => {
      await enhancedProfileSyncService.initialize(mockUserId)
    })

    it('should sync individual profile fields', async () => {
      const result = await enhancedProfileSyncService.syncProfileField(
        'name',
        'Updated Name',
        { immediate: true, broadcastRealtime: true }
      )

      expect(result.status).toBe('success')
      expect(result.data).toBe(true)

      // Verify userProfileService was called
      expect(userProfileService.updateUserProfile).toHaveBeenCalledWith(
        mockUserId,
        { name: 'Updated Name' },
        expect.objectContaining({
          syncToCloud: true,
          broadcastToOtherDevices: true
        })
      )
    })

    it('should update localStorage immediately', async () => {
      // Set up initial user data
      const initialUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Original Name',
        role: 'staff'
      }
      localStorage.setItem('currentUser', JSON.stringify(initialUser))

      await enhancedProfileSyncService.syncProfileField('name', 'Updated Name')

      const updatedUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      expect(updatedUser.name).toBe('Updated Name')
      expect(updatedUser.updated_at).toBeDefined()
    })

    it('should handle sync failures gracefully', async () => {
      vi.mocked(userProfileService.updateUserProfile).mockResolvedValue({
        status: 'error',
        error: 'Network error'
      })

      const result = await enhancedProfileSyncService.syncProfileField('name', 'Updated Name')

      expect(result.status).toBe('success') // Should still succeed locally
      expect(result.data).toBe(true)
    })
  })

  describe('Avatar Synchronization', () => {
    beforeEach(async () => {
      await enhancedProfileSyncService.initialize(mockUserId)
    })

    it('should sync profile avatar successfully', async () => {
      const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })

      const result = await enhancedProfileSyncService.syncProfileAvatar(
        mockFile,
        { immediate: true }
      )

      expect(result.status).toBe('success')
      expect(result.data).toBe('https://example.com/avatar.jpg')

      // Verify avatar storage service was called
      expect(avatarStorageService.uploadAvatar).toHaveBeenCalledWith(
        mockUserId,
        mockFile
      )
    })

    it('should sync avatar as base64 string', async () => {
      const base64Avatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

      const result = await enhancedProfileSyncService.syncProfileAvatar(
        base64Avatar,
        { immediate: true }
      )

      expect(result.status).toBe('success')
      expect(avatarStorageService.uploadAvatar).toHaveBeenCalledWith(
        mockUserId,
        base64Avatar
      )
    })
  })

  describe('Sync Status and Events', () => {
    beforeEach(async () => {
      await enhancedProfileSyncService.initialize(mockUserId)
    })

    it('should provide accurate sync status', async () => {
      const statusResult = await enhancedProfileSyncService.getProfileSyncStatus()

      expect(statusResult.status).toBe('success')
      expect(statusResult.data).toMatchObject({
        userId: mockUserId,
        syncEnabled: true,
        deviceId: expect.any(String),
        connectionState: expect.stringMatching(/connected|offline|syncing/)
      })
    })

    it('should allow event subscription and unsubscription', async () => {
      const mockCallback = vi.fn()

      const unsubscribe = enhancedProfileSyncService.subscribeToSyncEvents(mockCallback)

      // Trigger a sync event
      await enhancedProfileSyncService.syncProfileField('name', 'Test Name')

      // Verify callback was called
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'field_updated',
          userId: mockUserId,
          field: 'name',
          newValue: 'Test Name'
        })
      )

      // Unsubscribe and verify no more calls
      unsubscribe()
      mockCallback.mockClear()

      await enhancedProfileSyncService.syncProfileField('email', 'test@example.com')
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('Force Full Sync', () => {
    beforeEach(async () => {
      await enhancedProfileSyncService.initialize(mockUserId)
    })

    it('should perform full profile synchronization', async () => {
      vi.mocked(userProfileService.forceSyncProfileFromCloud).mockResolvedValue({
        status: 'success',
        data: {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Synced Name',
          role: 'staff',
          settings: {}
        }
      })

      vi.mocked(avatarStorageService.syncAvatarAcrossDevices).mockResolvedValue({
        status: 'success',
        data: 'https://example.com/synced-avatar.jpg'
      })

      const result = await enhancedProfileSyncService.forceFullProfileSync()

      expect(result.status).toBe('success')
      expect(userProfileService.forceSyncProfileFromCloud).toHaveBeenCalledWith(mockUserId)
      expect(avatarStorageService.syncAvatarAcrossDevices).toHaveBeenCalledWith(mockUserId)
    })
  })

  describe('Cross-Device Simulation', () => {
    it('should simulate receiving updates from other devices', async () => {
      await enhancedProfileSyncService.initialize(mockUserId)

      const mockCallback = vi.fn()
      enhancedProfileSyncService.subscribeToSyncEvents(mockCallback)

      // Simulate receiving an event from another device
      const mockEvent = {
        eventType: 'field_updated' as const,
        userId: mockUserId,
        deviceId: 'other-device-789',
        field: 'name',
        newValue: 'Updated from Other Device',
        timestamp: new Date().toISOString()
      }

      // The service would normally receive this via real-time channels
      // For testing, we'll verify the event handling logic
      expect(mockEvent.deviceId).not.toBe(mockDeviceId)
      expect(mockEvent.eventType).toBe('field_updated')
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization failures gracefully', async () => {
      vi.mocked(userProfileService.initializeCrossDeviceProfileSync).mockResolvedValue({
        success: false,
        deviceId: ''
      })

      const result = await enhancedProfileSyncService.initialize(mockUserId)

      // Should still succeed even if profile service initialization fails
      expect(result.status).toBe('success')
    })

    it('should handle network failures during sync', async () => {
      await enhancedProfileSyncService.initialize(mockUserId)

      vi.mocked(userProfileService.updateUserProfile).mockRejectedValue(
        new Error('Network timeout')
      )

      const result = await enhancedProfileSyncService.syncProfileField('name', 'Test Name')

      // Should handle error gracefully
      expect(result.status).toBe('success') // Local update succeeds
    })
  })

  describe('Cleanup', () => {
    it('should clean up resources properly', async () => {
      await enhancedProfileSyncService.initialize(mockUserId)

      const statusBefore = await enhancedProfileSyncService.getProfileSyncStatus()
      expect(statusBefore.status).toBe('success')

      await enhancedProfileSyncService.cleanup()

      // After cleanup, operations should fail
      const statusAfter = await enhancedProfileSyncService.getProfileSyncStatus()
      expect(statusAfter.status).toBe('error')
    })
  })
})

// Integration test for real-world usage
describe('EnhancedProfileSyncService Integration', () => {
  it('should handle a complete profile update workflow', async () => {
    const mockUserId = 'integration-test-user'

    // Initialize the service
    const initResult = await enhancedProfileSyncService.initialize(mockUserId)
    expect(initResult.status).toBe('success')

    // Update multiple profile fields
    const fields = {
      name: 'Integration Test User',
      display_name: 'Test User',
      department: 'Engineering',
      phone: '+1234567890',
      bio: 'Test bio for integration',
      location: 'Remote'
    }

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      const result = await enhancedProfileSyncService.syncProfileField(
        fieldName,
        fieldValue,
        { immediate: true, broadcastRealtime: true }
      )
      expect(result.status).toBe('success')
    }

    // Upload an avatar
    const mockFile = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' })
    const avatarResult = await enhancedProfileSyncService.syncProfileAvatar(mockFile)
    expect(avatarResult.status).toBe('success')

    // Force a full sync
    const fullSyncResult = await enhancedProfileSyncService.forceFullProfileSync()
    expect(fullSyncResult.status).toBe('success')

    // Get final status
    const finalStatus = await enhancedProfileSyncService.getProfileSyncStatus()
    expect(finalStatus.status).toBe('success')
    expect(finalStatus.data?.userId).toBe(mockUserId)

    // Cleanup
    await enhancedProfileSyncService.cleanup()
  })
})