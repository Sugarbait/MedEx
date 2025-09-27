import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock audit logger
vi.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logSecurityEvent: vi.fn()
  }
}))

// Mock Supabase config
vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      upsert: vi.fn(() => ({
        select: vi.fn()
      })),
      insert: vi.fn(() => ({
        select: vi.fn()
      }))
    }))
  }
}))

import { ProfileFieldsPersistenceService } from '@/services/profileFieldsPersistenceService'
import { supabase } from '@/config/supabase'

// Get the mocked supabase for test manipulation
const mockSupabase = supabase as any

describe('ProfileFieldsPersistenceService - Fixed Version', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset Supabase mock
    Object.values(mockSupabase.from().select().eq()).forEach(fn => fn.mockReset?.())
  })

  describe('validateUserId', () => {
    it('should validate valid user IDs', () => {
      expect(ProfileFieldsPersistenceService.validateUserId('valid-user-123')).toBe(true)
      expect(ProfileFieldsPersistenceService.validateUserId('demo-user-123')).toBe(true)
      expect(ProfileFieldsPersistenceService.validateUserId('c550502f-c39d-4bb3-bb8c-d193657fdb24')).toBe(true)
    })

    it('should reject invalid user IDs', () => {
      expect(ProfileFieldsPersistenceService.validateUserId('')).toBe(false)
      expect(ProfileFieldsPersistenceService.validateUserId('undefined')).toBe(false)
      expect(ProfileFieldsPersistenceService.validateUserId('null')).toBe(false)
      // @ts-ignore - Testing runtime behavior
      expect(ProfileFieldsPersistenceService.validateUserId(null)).toBe(false)
      // @ts-ignore - Testing runtime behavior
      expect(ProfileFieldsPersistenceService.validateUserId(undefined)).toBe(false)
      // @ts-ignore - Testing runtime behavior
      expect(ProfileFieldsPersistenceService.validateUserId(123)).toBe(false)
    })
  })

  describe('saveProfileFields', () => {
    it('should reject invalid user IDs', async () => {
      const result = await ProfileFieldsPersistenceService.saveProfileFields('undefined', {
        department: 'IT',
        phone: '555-1234'
      })

      expect(result.status).toBe('error')
      expect(result.error).toContain('Invalid user ID')
    })

    it('should successfully upsert profile data with valid user ID', async () => {
      const mockUpsertData = [{ id: 1, user_id: 'valid-user-123', department: 'IT' }]

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: mockUpsertData,
            error: null
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.saveProfileFields('valid-user-123', {
        department: 'IT Department',
        phone: '555-1234',
        location: 'Toronto, ON'
      })

      expect(result.status).toBe('success')
      expect(result.data).toEqual(mockUpsertData)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
    })

    it('should fallback to INSERT if UPSERT fails', async () => {
      const mockInsertData = [{ id: 1, user_id: 'valid-user-123', department: 'IT' }]

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'UPSERT failed', code: 'P001' }
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: mockInsertData,
            error: null
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.saveProfileFields('valid-user-123', {
        department: 'IT Department'
      })

      expect(result.status).toBe('success')
      expect(result.data).toEqual(mockInsertData)
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed', code: 'DB001' }
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert also failed', code: 'DB002' }
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.saveProfileFields('valid-user-123', {
        department: 'IT Department'
      })

      expect(result.status).toBe('error')
      expect(result.error).toContain('Database operation failed')
    })
  })

  describe('loadProfileFields', () => {
    it('should reject invalid user IDs', async () => {
      const result = await ProfileFieldsPersistenceService.loadProfileFields('undefined')

      expect(result.status).toBe('error')
      expect(result.error).toContain('Invalid user ID')
    })

    it('should successfully load profile data', async () => {
      const mockProfileData = {
        display_name: 'John Doe',
        department: 'IT Department',
        phone: '555-1234',
        location: 'Toronto, ON',
        bio: 'Software Developer'
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfileData,
              error: null
            })
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.loadProfileFields('valid-user-123')

      expect(result.status).toBe('success')
      expect(result.data?.department).toBe('IT Department')
      expect(result.data?.phone).toBe('555-1234')
      expect(result.data?.location).toBe('Toronto, ON')
    })

    it('should handle no profile found gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            })
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.loadProfileFields('valid-user-123')

      expect(result.status).toBe('success')
      expect(result.data).toEqual({})
    })
  })

  describe('saveProfileFieldsComplete', () => {
    beforeEach(() => {
      // Setup localStorage for complete methods
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'valid-user-123',
        name: 'John Doe',
        email: 'john@example.com'
      }))
    })

    it('should save to both Supabase and localStorage', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 1, user_id: 'valid-user-123' }],
            error: null
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.saveProfileFieldsComplete('valid-user-123', {
        department: 'Engineering',
        phone: '555-9999'
      })

      expect(result.status).toBe('success')

      // Check localStorage was updated
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      expect(currentUser.department).toBe('Engineering')
      expect(currentUser.phone).toBe('555-9999')
    })

    it('should continue with localStorage even if Supabase fails', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Network error', code: 'NET001' }
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed too', code: 'NET002' }
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.saveProfileFieldsComplete('valid-user-123', {
        department: 'Engineering',
        phone: '555-9999'
      })

      // Should still succeed because localStorage update works
      expect(result.status).toBe('success')

      // Check localStorage was updated despite Supabase failure
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      expect(currentUser.department).toBe('Engineering')
      expect(currentUser.phone).toBe('555-9999')
    })
  })

  describe('loadProfileFieldsComplete', () => {
    it('should load from Supabase when available', async () => {
      const mockProfileData = {
        display_name: 'Jane Smith',
        department: 'Marketing',
        phone: '555-5555',
        location: 'Vancouver, BC',
        bio: 'Marketing Manager'
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfileData,
              error: null
            })
          })
        })
      })

      const result = await ProfileFieldsPersistenceService.loadProfileFieldsComplete('valid-user-123')

      expect(result.status).toBe('success')
      expect(result.data?.department).toBe('Marketing')
      expect(result.data?.phone).toBe('555-5555')
    })

    it('should fallback to localStorage when Supabase fails', async () => {
      // Mock Supabase failure
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database unavailable', code: 'DB001' }
            })
          })
        })
      })

      // Setup localStorage fallback data
      localStorage.setItem('currentUser', JSON.stringify({
        id: 'valid-user-123',
        name: 'John Doe',
        department: 'Engineering',
        phone: '555-1111',
        location: 'Toronto, ON'
      }))

      const result = await ProfileFieldsPersistenceService.loadProfileFieldsComplete('valid-user-123')

      expect(result.status).toBe('success')
      expect(result.data?.department).toBe('Engineering')
      expect(result.data?.phone).toBe('555-1111')
      expect(result.data?.location).toBe('Toronto, ON')
    })

    it('should handle corrupted localStorage gracefully', async () => {
      // Mock Supabase failure
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            })
          })
        })
      })

      // Setup corrupted localStorage
      localStorage.setItem('currentUser', 'invalid-json{')

      const result = await ProfileFieldsPersistenceService.loadProfileFieldsComplete('valid-user-123')

      expect(result.status).toBe('success')
      expect(result.data).toEqual({})
    })
  })
})