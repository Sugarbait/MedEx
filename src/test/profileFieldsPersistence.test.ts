import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Supabase before importing the service
vi.mock('@/config/supabase', () => {
  const mockSupabase = {
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    insert: vi.fn(() => mockSupabase),
    update: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
    single: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }
  return {
    supabase: mockSupabase
  }
})

// Mock audit logger
vi.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logSecurityEvent: vi.fn(() => Promise.resolve())
  }
}))

// Import the service after mocking
import { profileFieldsPersistenceService } from '@/services/profileFieldsPersistenceService'

describe('Profile Fields Persistence Service', () => {
  const testUserId = 'test-user-123'
  const testProfileData = {
    name: 'Test User',
    display_name: 'Test Display Name',
    department: 'Emergency Medicine',
    phone: '+1-555-123-4567',
    bio: 'Test bio content',
    location: 'Toronto General Hospital'
  }

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('saveProfileFields', () => {
    it('should save profile fields to Supabase successfully', async () => {
      // Import the mocked supabase
      const { supabase } = await import('@/config/supabase')

      // Mock successful database operations
      vi.mocked(supabase.select).mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'existing-profile-id' },
            error: null
          })
        })
      } as any)

      vi.mocked(supabase.update).mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'updated-profile-id', ...testProfileData }],
            error: null
          })
        })
      } as any)

      const result = await profileFieldsPersistenceService.saveProfileFields(testUserId, testProfileData)

      expect(result.status).toBe('success')
      expect(supabase.from).toHaveBeenCalledWith('user_profiles')
    })

    it('should create new profile if none exists', async () => {
      // Mock no existing profile
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          })
        })
      })

      // Mock successful insert
      mockSupabase.insert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'new-profile-id', ...testProfileData }],
          error: null
        })
      })

      const result = await profileFieldsPersistenceService.saveProfileFields(testUserId, testProfileData)

      expect(result.status).toBe('success')
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        })
      })

      const result = await profileFieldsPersistenceService.saveProfileFields(testUserId, testProfileData)

      expect(result.status).toBe('error')
      expect(result.error).toContain('Database connection failed')
    })
  })

  describe('loadProfileFields', () => {
    it('should load profile fields from Supabase successfully', async () => {
      // Mock successful load
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: testProfileData,
            error: null
          })
        })
      })

      const result = await profileFieldsPersistenceService.loadProfileFields(testUserId)

      expect(result.status).toBe('success')
      expect(result.data?.department).toBe(testProfileData.department)
      expect(result.data?.phone).toBe(testProfileData.phone)
      expect(result.data?.location).toBe(testProfileData.location)
    })

    it('should return empty data if no profile exists', async () => {
      // Mock no profile found
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          })
        })
      })

      const result = await profileFieldsPersistenceService.loadProfileFields(testUserId)

      expect(result.status).toBe('success')
      expect(result.data).toEqual({})
    })
  })

  describe('updateLocalStorageProfileFields', () => {
    it('should update currentUser in localStorage', () => {
      // Setup existing currentUser
      const existingUser = {
        id: testUserId,
        email: 'test@example.com',
        name: 'Old Name'
      }
      localStorage.setItem('currentUser', JSON.stringify(existingUser))

      profileFieldsPersistenceService.updateLocalStorageProfileFields(testUserId, testProfileData)

      const updatedUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      expect(updatedUser.department).toBe(testProfileData.department)
      expect(updatedUser.phone).toBe(testProfileData.phone)
      expect(updatedUser.location).toBe(testProfileData.location)
      expect(updatedUser.updated_at).toBeDefined()
    })

    it('should update userProfile storage', () => {
      // Setup existing userProfile
      const existingProfile = {
        id: testUserId,
        name: 'Old Name'
      }
      localStorage.setItem(`userProfile_${testUserId}`, JSON.stringify(existingProfile))

      profileFieldsPersistenceService.updateLocalStorageProfileFields(testUserId, testProfileData)

      const updatedProfile = JSON.parse(localStorage.getItem(`userProfile_${testUserId}`) || '{}')
      expect(updatedProfile.department).toBe(testProfileData.department)
      expect(updatedProfile.phone).toBe(testProfileData.phone)
      expect(updatedProfile.location).toBe(testProfileData.location)
    })

    it('should create new userProfile if none exists', () => {
      profileFieldsPersistenceService.updateLocalStorageProfileFields(testUserId, testProfileData)

      const newProfile = JSON.parse(localStorage.getItem(`userProfile_${testUserId}`) || '{}')
      expect(newProfile.id).toBe(testUserId)
      expect(newProfile.department).toBe(testProfileData.department)
      expect(newProfile.phone).toBe(testProfileData.phone)
      expect(newProfile.location).toBe(testProfileData.location)
    })

    it('should update systemUsers array', () => {
      // Setup existing systemUsers
      const existingUsers = [
        { id: testUserId, name: 'Old Name' },
        { id: 'other-user', name: 'Other User' }
      ]
      localStorage.setItem('systemUsers', JSON.stringify(existingUsers))

      profileFieldsPersistenceService.updateLocalStorageProfileFields(testUserId, testProfileData)

      const updatedUsers = JSON.parse(localStorage.getItem('systemUsers') || '[]')
      const updatedUser = updatedUsers.find((u: any) => u.id === testUserId)

      expect(updatedUser.department).toBe(testProfileData.department)
      expect(updatedUser.phone).toBe(testProfileData.phone)
      expect(updatedUser.location).toBe(testProfileData.location)
      expect(updatedUsers).toHaveLength(2) // Should maintain other users
    })
  })

  describe('saveProfileFieldsComplete', () => {
    beforeEach(() => {
      // Mock DOM events
      global.window = Object.create(window)
      global.window.dispatchEvent = vi.fn()
    })

    it('should save to both database and localStorage', async () => {
      // Mock successful Supabase save
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'existing-profile-id' },
            error: null
          })
        })
      })

      mockSupabase.update.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'updated-profile-id', ...testProfileData }],
            error: null
          })
        })
      })

      // Setup localStorage
      localStorage.setItem('currentUser', JSON.stringify({ id: testUserId, name: 'Test' }))

      const result = await profileFieldsPersistenceService.saveProfileFieldsComplete(testUserId, testProfileData)

      expect(result.status).toBe('success')

      // Verify localStorage was updated
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      expect(currentUser.department).toBe(testProfileData.department)

      // Verify events were dispatched
      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'userDataUpdated' })
      )
    })

    it('should continue with localStorage even if Supabase fails', async () => {
      // Mock Supabase failure
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      })

      // Setup localStorage
      localStorage.setItem('currentUser', JSON.stringify({ id: testUserId, name: 'Test' }))

      const result = await profileFieldsPersistenceService.saveProfileFieldsComplete(testUserId, testProfileData)

      expect(result.status).toBe('success')

      // Verify localStorage was still updated
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      expect(currentUser.department).toBe(testProfileData.department)
    })
  })

  describe('loadProfileFieldsComplete', () => {
    it('should prefer Supabase data when available', async () => {
      // Mock successful Supabase load
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: testProfileData,
            error: null
          })
        })
      })

      // Setup localStorage with different data
      localStorage.setItem('currentUser', JSON.stringify({
        id: testUserId,
        department: 'Old Department'
      }))

      const result = await profileFieldsPersistenceService.loadProfileFieldsComplete(testUserId)

      expect(result.status).toBe('success')
      expect(result.data?.department).toBe(testProfileData.department) // Should use Supabase data
    })

    it('should fallback to localStorage when Supabase fails', async () => {
      // Mock Supabase failure
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      })

      // Setup localStorage
      localStorage.setItem('currentUser', JSON.stringify({
        id: testUserId,
        ...testProfileData
      }))

      const result = await profileFieldsPersistenceService.loadProfileFieldsComplete(testUserId)

      expect(result.status).toBe('success')
      expect(result.data?.department).toBe(testProfileData.department)
    })

    it('should check userProfile storage as secondary fallback', async () => {
      // Mock Supabase failure
      mockSupabase.select.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('Database error'))
        })
      })

      // Setup userProfile storage only
      localStorage.setItem(`userProfile_${testUserId}`, JSON.stringify(testProfileData))

      const result = await profileFieldsPersistenceService.loadProfileFieldsComplete(testUserId)

      expect(result.status).toBe('success')
      expect(result.data?.department).toBe(testProfileData.department)
    })
  })

  describe('Integration: Full Save and Load Cycle', () => {
    it('should maintain data consistency through save-load cycle', async () => {
      // Mock successful database operations
      mockSupabase.select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn()
            .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No existing profile
            .mockResolvedValueOnce({ data: testProfileData, error: null }) // Load returns saved data
        })
      })

      mockSupabase.insert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'new-profile-id', ...testProfileData }],
          error: null
        })
      })

      // Save profile fields
      const saveResult = await profileFieldsPersistenceService.saveProfileFieldsComplete(testUserId, testProfileData)
      expect(saveResult.status).toBe('success')

      // Load profile fields
      const loadResult = await profileFieldsPersistenceService.loadProfileFieldsComplete(testUserId)
      expect(loadResult.status).toBe('success')
      expect(loadResult.data?.department).toBe(testProfileData.department)
      expect(loadResult.data?.phone).toBe(testProfileData.phone)
      expect(loadResult.data?.location).toBe(testProfileData.location)

      // Verify localStorage consistency
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      expect(currentUser.department).toBe(testProfileData.department)
    })
  })
})