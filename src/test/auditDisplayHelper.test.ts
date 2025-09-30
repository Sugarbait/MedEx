/**
 * Test for HIPAA Audit Display Helper
 * Verifies that encrypted user data is properly decrypted and displayed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enhanceAuditEntryForDisplay, enhanceAuditEntriesForDisplay } from '@/utils/auditDisplayHelper'
import { auditUserLookupService } from '@/services/auditUserLookupService'

// Mock the encryption service
vi.mock('@/services/encryption', () => ({
  encryptionService: {
    decrypt: vi.fn(async (encryptedData: any) => {
      if (encryptedData.data === 'encrypted_user_name') {
        return 'John Doe'
      }
      if (encryptedData.data === 'encrypted_failure_reason') {
        return 'Authentication failed'
      }
      if (encryptedData.data === 'encrypted_additional_info') {
        return JSON.stringify({ detail: 'Login attempt from new device' })
      }
      throw new Error('Decryption failed')
    })
  }
}))

// Mock the audit user lookup service
vi.mock('@/services/auditUserLookupService', () => ({
  auditUserLookupService: {
    lookupUser: vi.fn(async (userId: string, userRole?: string) => {
      if (userId === 'user123') {
        return {
          success: true,
          displayName: 'Jane Smith',
          source: 'cache'
        }
      }
      if (userId === 'admin456') {
        return {
          success: true,
          displayName: 'Admin User',
          source: 'localStorage'
        }
      }
      return {
        success: false,
        source: 'fallback'
      }
    })
  }
}))

describe('AuditDisplayHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('enhanceAuditEntryForDisplay', () => {
    it('should decrypt encrypted user name and use lookup service', async () => {
      const mockEntry = {
        id: 'audit1',
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user123',
        user_name: {
          data: 'encrypted_user_name',
          iv: 'test_iv',
          tag: 'test_tag'
        },
        user_role: 'user',
        action: 'VIEW',
        resource_type: 'PATIENT',
        resource_id: 'patient1',
        phi_accessed: true,
        source_ip: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        session_id: 'session1',
        outcome: 'SUCCESS'
      }

      const result = await enhanceAuditEntryForDisplay(mockEntry)

      expect(result.displayName).toBe('Jane Smith')
      expect(auditUserLookupService.lookupUser).toHaveBeenCalledWith('user123', 'user')
    })

    it('should handle encrypted failure reason', async () => {
      const mockEntry = {
        id: 'audit2',
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'admin456',
        user_name: 'Admin User',
        user_role: 'admin',
        action: 'LOGIN_FAILURE',
        resource_type: 'SYSTEM',
        resource_id: 'auth-system',
        phi_accessed: false,
        source_ip: '192.168.1.2',
        user_agent: 'Mozilla/5.0',
        session_id: 'session2',
        outcome: 'FAILURE',
        failure_reason: {
          data: 'encrypted_failure_reason',
          iv: 'test_iv',
          tag: 'test_tag'
        }
      }

      const result = await enhanceAuditEntryForDisplay(mockEntry)

      expect(result.displayName).toBe('Admin User')
      expect(result.failure_reason).toBe('Authentication failed')
    })

    it('should handle encrypted additional info', async () => {
      const mockEntry = {
        id: 'audit3',
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user123',
        user_name: 'User Name',
        user_role: 'user',
        action: 'LOGIN',
        resource_type: 'SYSTEM',
        resource_id: 'auth-system',
        phi_accessed: false,
        source_ip: '192.168.1.3',
        user_agent: 'Mozilla/5.0',
        session_id: 'session3',
        outcome: 'SUCCESS',
        additional_info: {
          data: 'encrypted_additional_info',
          iv: 'test_iv',
          tag: 'test_tag'
        }
      }

      const result = await enhanceAuditEntryForDisplay(mockEntry)

      expect(result.displayName).toBe('Jane Smith')
      expect(result.additional_info).toEqual({
        detail: 'Login attempt from new device'
      })
    })

    it('should fallback gracefully when decryption fails', async () => {
      const mockEntry = {
        id: 'audit4',
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'unknown_user',
        user_name: {
          data: 'invalid_encrypted_data',
          iv: 'test_iv',
          tag: 'test_tag'
        },
        user_role: 'user',
        action: 'VIEW',
        resource_type: 'PATIENT',
        resource_id: 'patient1',
        phi_accessed: true,
        source_ip: '192.168.1.4',
        user_agent: 'Mozilla/5.0',
        session_id: 'session4',
        outcome: 'SUCCESS',
        failure_reason: {
          data: 'invalid_encrypted_reason',
          iv: 'test_iv',
          tag: 'test_tag'
        }
      }

      const result = await enhanceAuditEntryForDisplay(mockEntry)

      // Should fallback to Admin User since fallback logic provides default
      expect(result.displayName).toBe('Admin User')
      expect(result.failure_reason).toBe('[Encrypted - Unable to decrypt]')
    })

    it('should handle plain text user names', async () => {
      const mockEntry = {
        id: 'audit5',
        timestamp: '2024-01-01T00:00:00Z',
        user_id: 'user123',
        user_name: 'Plain Text User',
        user_role: 'user',
        action: 'VIEW',
        resource_type: 'PATIENT',
        resource_id: 'patient1',
        phi_accessed: true,
        source_ip: '192.168.1.5',
        user_agent: 'Mozilla/5.0',
        session_id: 'session5',
        outcome: 'SUCCESS'
      }

      const result = await enhanceAuditEntryForDisplay(mockEntry)

      // Should use lookup service result
      expect(result.displayName).toBe('Jane Smith')
    })

    it('should handle role-based fallbacks for admin users', async () => {
      const mockEntry = {
        id: 'audit6',
        timestamp: '2024-01-01T00:00:00Z',
        user_id: undefined,
        user_name: undefined,
        user_role: 'super_user',
        action: 'SYSTEM_ACCESS',
        resource_type: 'SYSTEM',
        resource_id: 'carexps-crm',
        phi_accessed: false,
        source_ip: '192.168.1.6',
        user_agent: 'Mozilla/5.0',
        session_id: 'session6',
        outcome: 'SUCCESS'
      }

      const result = await enhanceAuditEntryForDisplay(mockEntry)

      expect(result.displayName).toBe('Admin User')
    })
  })

  describe('enhanceAuditEntriesForDisplay', () => {
    it('should process multiple audit entries', async () => {
      const mockEntries = [
        {
          id: 'audit1',
          timestamp: '2024-01-01T00:00:00Z',
          user_id: 'user123',
          user_name: 'User Name',
          user_role: 'user',
          action: 'VIEW',
          resource_type: 'PATIENT',
          resource_id: 'patient1',
          phi_accessed: true,
          source_ip: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          session_id: 'session1',
          outcome: 'SUCCESS'
        },
        {
          id: 'audit2',
          timestamp: '2024-01-01T01:00:00Z',
          user_id: 'admin456',
          user_name: 'Admin Name',
          user_role: 'super_user',
          action: 'LOGIN',
          resource_type: 'SYSTEM',
          resource_id: 'auth-system',
          phi_accessed: false,
          source_ip: '192.168.1.2',
          user_agent: 'Mozilla/5.0',
          session_id: 'session2',
          outcome: 'SUCCESS'
        }
      ]

      const results = await enhanceAuditEntriesForDisplay(mockEntries)

      expect(results).toHaveLength(2)
      expect(results[0].displayName).toBe('Jane Smith')
      expect(results[1].displayName).toBe('Admin User')
    })

    it('should handle errors gracefully for individual entries', async () => {
      const mockEntries = [
        {
          id: 'audit1',
          timestamp: '2024-01-01T00:00:00Z',
          user_id: 'user123',
          user_name: 'Valid User',
          user_role: 'user',
          action: 'VIEW',
          resource_type: 'PATIENT',
          resource_id: 'patient1',
          phi_accessed: true,
          source_ip: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          session_id: 'session1',
          outcome: 'SUCCESS'
        },
        {
          // This entry has malformed data that should trigger error handling
          id: 'audit2',
          timestamp: null, // Invalid timestamp
          user_id: null,
          user_name: null,
          user_role: null,
          action: null,
          resource_type: null,
          resource_id: null,
          phi_accessed: null,
          source_ip: null,
          user_agent: null,
          session_id: null,
          outcome: null
        }
      ]

      const results = await enhanceAuditEntriesForDisplay(mockEntries)

      expect(results).toHaveLength(2)
      expect(results[0].displayName).toBe('Jane Smith')
      // Second entry should have fallback values
      expect(results[1].displayName).toBeDefined()
    })
  })
})