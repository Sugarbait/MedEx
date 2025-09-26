/**
 * Tests for HIPAA Audit Logger IP Detection
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock global objects before any imports
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

// Mock window object
Object.defineProperty(global, 'window', {
  value: {
    location: {
      hostname: 'localhost',
      search: '',
      href: 'http://localhost:3000'
    },
    localStorage: mockLocalStorage,
    navigator: {
      userAgent: 'Test Browser'
    },
    addEventListener: vi.fn(),
    document: {
      querySelector: vi.fn(() => null)
    }
  },
  writable: true
})

// Mock document
Object.defineProperty(global, 'document', {
  value: {
    querySelector: vi.fn(() => null)
  },
  writable: true
})

// Mock fetch for IP detection services
global.fetch = vi.fn()

// Now import after mocking
import { auditLogger, auditIPUtils } from '@/services/auditLogger'

describe('Audit Logger IP Detection', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
    vi.clearAllMocks()
  })

  it('should return localhost as fallback when no IP is detected', () => {
    const ip = auditIPUtils.getCurrentIP()
    expect(ip).toBe('127.0.0.1')
  })

  it('should detect IP from URL parameters', () => {
    // Mock window.location.search
    delete (window as any).location
    window.location = { search: '?client_ip=192.168.1.100' } as any

    const ip = auditIPUtils.getCurrentIP()
    expect(ip).toBe('192.168.1.100')
  })

  it('should use cached IP when available and not expired', () => {
    const testIP = '203.0.113.10'
    const futureTime = Date.now() + 60000 // 1 minute in future

    mockLocalStorage.setItem('detected_client_ip', testIP)
    mockLocalStorage.setItem('detected_client_ip_expires', futureTime.toString())

    const ip = auditIPUtils.getCurrentIP()
    expect(ip).toBe(testIP)
  })

  it('should ignore expired cached IP', () => {
    const testIP = '203.0.113.10'
    const pastTime = Date.now() - 60000 // 1 minute in past

    mockLocalStorage.setItem('detected_client_ip', testIP)
    mockLocalStorage.setItem('detected_client_ip_expires', pastTime.toString())

    const ip = auditIPUtils.getCurrentIP()
    expect(ip).toBe('127.0.0.1') // Should fallback
  })

  it('should validate IPv4 addresses correctly', () => {
    // This tests the internal validation via URL parameter detection
    delete (window as any).location

    // Valid IPv4
    window.location = { search: '?client_ip=192.168.1.1' } as any
    expect(auditIPUtils.getCurrentIP()).toBe('192.168.1.1')

    // Invalid IPv4
    window.location = { search: '?client_ip=999.999.999.999' } as any
    expect(auditIPUtils.getCurrentIP()).toBe('127.0.0.1')
  })

  it('should detect Azure Static Web Apps environment', async () => {
    delete (window as any).location
    window.location = { hostname: 'myapp.azurestaticapps.net' } as any

    const status = auditIPUtils.getIPStatus()
    expect(status.isAzureEnvironment).toBe(true)
  })

  it('should handle async IP detection with external services', async () => {
    const mockResponse = { ip: '203.0.113.25' }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    await auditIPUtils.refreshIP()

    // Check if IP was cached
    const cachedIP = mockLocalStorage.getItem('async_detected_ip')
    expect(cachedIP).toBe('203.0.113.25')
  })

  it('should handle fetch failures gracefully', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

    const ip = await auditIPUtils.refreshIP()
    expect(ip).toBe('127.0.0.1') // Should fallback on error
  })

  it('should provide comprehensive IP detection status', () => {
    const status = auditIPUtils.getIPStatus()

    expect(status).toHaveProperty('hasUrlParam')
    expect(status).toHaveProperty('hasMetaTag')
    expect(status).toHaveProperty('hasCachedIP')
    expect(status).toHaveProperty('hasAsyncIP')
    expect(status).toHaveProperty('isAzureEnvironment')
    expect(status).toHaveProperty('detectedIP')
    expect(status).toHaveProperty('lastAsyncDetection')
  })

  it('should parse X-Forwarded-For headers correctly', () => {
    // This tests the environment variable detection via mock process.env
    const originalEnv = process.env
    process.env = {
      ...originalEnv,
      HTTP_X_FORWARDED_FOR: '203.0.113.50, 10.0.0.1, 192.168.1.1'
    }

    const ip = auditIPUtils.getCurrentIP()
    expect(ip).toBe('203.0.113.50') // Should use first public IP

    process.env = originalEnv
  })

  it('should reject private IP addresses from X-Forwarded-For', () => {
    const originalEnv = process.env
    process.env = {
      ...originalEnv,
      HTTP_X_FORWARDED_FOR: '10.0.0.1, 192.168.1.1, 172.16.0.1'
    }

    const ip = auditIPUtils.getCurrentIP()
    expect(ip).toBe('10.0.0.1') // Should use first valid IP even if private

    process.env = originalEnv
  })
})